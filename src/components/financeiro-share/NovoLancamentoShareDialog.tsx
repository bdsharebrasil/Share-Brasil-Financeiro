import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  Receipt,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  anexarDocumentoLancamento,
  criarDespesa,
  darBaixaPagamentoShare,
  darBaixaRecebimentoShare,
  editarLancamento,
  emitirReceita,
  type CategoriaCaixaShare,
  type ContaBancaria,
  type FornecedorLancamento,
} from "@/lib/financeiro-share-api";
import {
  buscarOpcoesNotasSaida,
  enviarAnexoDocumentoSaida,
  type CategoriaDespesaOpcao,
} from "@/lib/nfSaidaApi";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { API_BASE } from "@/lib/api";
import type { Lancamento } from "@/components/financeiro-share/tipos";
import { opcoesPeriodicidade } from "@/data/opcoes";
import type { Periodicidade } from "@/types/financeiro";

export type LancamentoEdicao = {
  id: string;
  descricao?: string | null;
  fluxo?: string | null;
  categoriaId?: string | null;
  categoria?: string | null;
  grupoCategoria?: string | null;
  valorCentavos?: number | null;
  data?: string | null;
  dataEmissao?: string | null;
  data_emissao?: string | null;
  prazo?: string | null;
  dataVencimento?: string | null;
  periodicidade?: Periodicidade | null;
  data_vencimento?: string | null;
  fornecedorId?: string | null;
  fornecedor?: string | null;
  numeroDoc?: string | null;
  observacoes?: string | null;
  categoriaClienteId?: string | null;
  dataPagamento?: string | null;
  data_pagamento?: string | null;
  contaBancariaId?: string | null;
  contaBancariaRotulo?: string | null;
  formaPagamento?: string | null;
  comprovanteUrl?: string | null;
  pagoPor?: string | null;
  status?: string | null;
  anexos?: Array<{ id?: string; nome: string; url: string; tipo?: string | null }>;
};

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  categorias: CategoriaCaixaShare[];
  aoCriar: (lancamento: Lancamento) => void;
  somenteDespesa?: boolean;
  fluxoInicial?: "entrada" | "saida";
  somenteEntrada?: boolean;
  fornecedores?: FornecedorLancamento[];
  contasBancarias?: ContaBancaria[];
  lancamentoInicial?: LancamentoEdicao;
};

const FORMAS_BAIXA = ["PIX", "TRANSFERÊNCIA", "BOLETO", "DINHEIRO", "CARTÃO"];

/** Remove underscores e padroniza textos exibidos na UI em MAIÚSCULAS */
function formatarTextoUi(valor?: string | null): string {
  if (!valor) return "";
  return String(valor).replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

/** Padroniza digitação em tempo real (maiúsculas e sem underscores, preservando espaços) */
function sanitizarDigitacao(valor: string): string {
  return valor.replace(/_/g, " ").toUpperCase();
}

/** Converte ISO (YYYY-MM-DD...) ou BR (DD/MM/YYYY) para YYYY-MM-DD exigido pelo <input type="date"> */
function normalizarDataInput(valor?: string | null): string {
  if (!valor) return "";
  const limpo = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(limpo)) {
    return limpo.slice(0, 10);
  }
  const matchBr = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
  }
  return "";
}

const LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const INPUT_CLASS =
  "h-10 rounded-xl border-input bg-background text-xs font-semibold uppercase tracking-wide text-foreground placeholder:text-muted-foreground/70 focus-visible:border-[#233329] focus-visible:ring-[#233329]/20 dark:focus-visible:border-[#C8E636] dark:focus-visible:ring-[#C8E636]/20";
const SELECT_TRIGGER_CLASS =
  "h-10 rounded-xl border-input bg-background text-xs font-semibold uppercase tracking-wide text-foreground focus:ring-[#233329]/20 dark:focus:ring-[#C8E636]/20";
const SELECT_ITEM_CLASS = "text-xs font-semibold uppercase tracking-wide";

export function NovoLancamentoShareDialog({
  aberto,
  aoFechar,
  categorias,
  aoCriar,
  somenteDespesa = false,
  fluxoInicial,
  somenteEntrada = false,
  fornecedores = [],
  contasBancarias = [],
  lancamentoInicial,
}: Props) {
  const editando = Boolean(lancamentoInicial);
  const temBaixaEditavel = Boolean(
    editando &&
      (lancamentoInicial?.dataPagamento ||
        lancamentoInicial?.data_pagamento ||
        ["PAGO", "RECEBIDO"].includes(String(lancamentoInicial?.status ?? "").toUpperCase())),
  );

  const [salvando, setSalvando] = useState(false);
  const [fluxo, setFluxo] = useState("saida");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("ÚNICO");
  const [fornecedor, setFornecedor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [categoriaClienteId, setCategoriaClienteId] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [registrarBaixaInicial, setRegistrarBaixaInicial] = useState(false);
  const [contaBancariaId, setContaBancariaId] = useState("nenhuma");
  const [formaPagamento, setFormaPagamento] = useState("nenhuma");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [pagoPor, setPagoPor] = useState("");
  const [categoriasCliente, setCategoriasCliente] = useState<CategoriaDespesaOpcao[]>([]);
  const [imagens, setImagens] = useState<File[]>([]);
  const [inputImagemKey, setInputImagemKey] = useState(0);

  // Evita que re-renderizações do pai sobrescrevam campos editados pelo usuário
  const chaveInicializacaoRef = useRef<string | null>(null);

  const limpar = useCallback(() => {
    setFluxo(somenteEntrada ? "entrada" : fluxoInicial ?? "saida");
    setDescricao("");
    setCategoriaId("");
    setValor("");
    setDataEmissao(new Date().toISOString().slice(0, 10));
    setDataVencimento("");
    setPeriodicidade("ÚNICO");
    setFornecedor("");
    setFornecedorId("");
    setNumeroDoc("");
    setObservacoes("");
    setCategoriaClienteId("");
    setDataPagamento("");
    setRegistrarBaixaInicial(false);
    setContaBancariaId("nenhuma");
    setFormaPagamento("nenhuma");
    setComprovanteUrl("");
    setPagoPor("");
    setImagens([]);
  }, [fluxoInicial, somenteEntrada]);

  useEffect(() => {
    if (!aberto) {
      chaveInicializacaoRef.current = null;
      return;
    }
    void buscarOpcoesNotasSaida()
      .then((opcoes) => setCategoriasCliente(opcoes.categoriasDespesa ?? []))
      .catch(() => setCategoriasCliente([]));
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    const chaveAtual = lancamentoInicial ? `edit:${lancamentoInicial.id}` : "create";
    if (chaveInicializacaoRef.current === chaveAtual) return;
    chaveInicializacaoRef.current = chaveAtual;

    if (!lancamentoInicial) {
      limpar();
      return;
    }

    const fluxoResolvido =
      somenteDespesa
        ? "saida"
        : somenteEntrada
          ? "entrada"
          : String(lancamentoInicial.fluxo ?? fluxoInicial ?? "saida").toLowerCase() === "entrada"
            ? "entrada"
            : "saida";

    setFluxo(fluxoResolvido);
    setDescricao(formatarTextoUi(lancamentoInicial.descricao));
    setCategoriaId(lancamentoInicial.categoriaId ?? "");
    setValor(
      lancamentoInicial.valorCentavos != null
        ? (lancamentoInicial.valorCentavos / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })
        : "",
    );
    setDataEmissao(
      normalizarDataInput(
        lancamentoInicial.dataEmissao ?? lancamentoInicial.data_emissao ?? lancamentoInicial.data,
      ),
    );
    setDataVencimento(
      normalizarDataInput(
        lancamentoInicial.dataVencimento ??
          lancamentoInicial.data_vencimento ??
          lancamentoInicial.prazo,
      ),
    );
    setPeriodicidade(lancamentoInicial.periodicidade ?? "ÚNICO");
    setFornecedorId(lancamentoInicial.fornecedorId ?? "");
    setFornecedor(formatarTextoUi(lancamentoInicial.fornecedor));
    setNumeroDoc(formatarTextoUi(lancamentoInicial.numeroDoc));
    setObservacoes(formatarTextoUi(lancamentoInicial.observacoes));
    setCategoriaClienteId(lancamentoInicial.categoriaClienteId ?? "");
    setDataPagamento(
      normalizarDataInput(lancamentoInicial.dataPagamento ?? lancamentoInicial.data_pagamento),
    );
    setContaBancariaId(lancamentoInicial.contaBancariaId || "nenhuma");
    setFormaPagamento(lancamentoInicial.formaPagamento || "nenhuma");
    setComprovanteUrl(lancamentoInicial.comprovanteUrl ?? "");
    setPagoPor(formatarTextoUi(lancamentoInicial.pagoPor));
    setImagens([]);
  }, [aberto, lancamentoInicial, limpar, fluxoInicial, somenteDespesa, somenteEntrada]);

  const gruposCategoria = useMemo(() => {
    const mapa = new Map<string, CategoriaCaixaShare[]>();
    const tiposDoFluxo = fluxo === "saida" ? ["DESPESA", "SAIDA"] : ["RECEITA", "ENTRADA"];
    const categoriasVisiveis = categorias.filter((categoria) => {
      const tipo = String(categoria.tipo ?? "").trim().toUpperCase();
      return (
        !tipo ||
        tiposDoFluxo.includes(tipo) ||
        (editando && categoria.id === lancamentoInicial?.categoriaId)
      );
    });

    categoriasVisiveis.forEach((categoria) => {
      const grupo = formatarTextoUi(categoria.grupo) || "OUTRAS";
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), categoria]);
    });
    return [...mapa.entries()];
  }, [categorias, editando, fluxo, lancamentoInicial?.categoriaId]);

  const salvar = async () => {
    const categoria = categorias.find((item) => item.id === categoriaId);
    const fornecedorSelecionado = fornecedores.find((item) => item.id === fornecedorId);
    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));

    if (!descricao.trim()) return toast.error("INFORME A DESCRIÇÃO DO LANÇAMENTO.");
    if (!categoria) return toast.error("SELECIONE A CATEGORIA DO CAIXA SHARE.");
    const tiposDoFluxo = fluxo === "saida" ? ["DESPESA", "SAIDA"] : ["RECEITA", "ENTRADA"];
    const tipoCategoria = String(categoria.tipo ?? "").trim().toUpperCase();
    if (tipoCategoria && !tiposDoFluxo.includes(tipoCategoria)) {
      return toast.error("SELECIONE UMA CATEGORIA COMPATÍVEL COM O TIPO DE LANÇAMENTO.");
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return toast.error("INFORME UM VALOR VÁLIDO.");
    }
    if (!editando && registrarBaixaInicial && !dataPagamento) {
      return toast.error(`Informe a data do ${fluxo === "entrada" ? "recebimento" : "pagamento"}.`);
    }
    if (!editando && registrarBaixaInicial && contaBancariaId === "nenhuma") {
      return toast.error("Selecione a conta bancária usada na baixa.");
    }

    setSalvando(true);
    try {
      const emissaoFinal = dataEmissao || null;
      const vencimentoFinal = dataVencimento || null;
      const fornecedorFinal =
        formatarTextoUi(fornecedorSelecionado?.nome ?? fornecedor) || null;

      const payload = {
        descricao: formatarTextoUi(descricao),
        fluxo: fluxo === "entrada" ? "ENTRADA" : "SAIDA",
        tipo_caixa: "SHARE",
        categoria_id: categoria.id,
        categoria_nome: formatarTextoUi(categoria.nome),
        grupo_categoria: formatarTextoUi(categoria.grupo) || null,
        valor_total: valorNumerico,
        data: emissaoFinal,
        data_emissao: emissaoFinal,
        prazo: vencimentoFinal,
        data_vencimento: vencimentoFinal,
        fornecedor_id: fornecedorId || null,
        fornecedor: fornecedorFinal,
        fornecedor_nome: fornecedorFinal,
        numero_doc: formatarTextoUi(numeroDoc) || null,
        periodicidade,
        observacoes: formatarTextoUi(observacoes) || null,
        categoria_cliente_id: categoriaClienteId || null,
      };

      const lancamento = editando
        ? await editarLancamento(lancamentoInicial!.id, {
            ...payload,
            valor_centavos: Math.round(valorNumerico * 100),
            ...(temBaixaEditavel
              ? {
                  data_pagamento: dataPagamento || null,
                  conta_bancaria_id: contaBancariaId === "nenhuma" ? null : contaBancariaId,
                  forma_pagamento: formaPagamento === "nenhuma" ? null : formaPagamento,
                  comprovante_url: comprovanteUrl.trim() || null,
                  pago_por: formatarTextoUi(pagoPor) || null,
                }
              : {}),
          })
        : await (fluxo === "entrada" ? emitirReceita : criarDespesa)(payload);

      let erroBaixaInicial: string | null = null;
      if (!editando && registrarBaixaInicial) {
        try {
          const dadosBaixa = {
            dataPagamento,
            bancoPagamento: contaBancariaId,
            contaBancariaId,
            formaPagamento: formaPagamento === "nenhuma" ? undefined : formaPagamento,
            comprovantePagamentoUrl: comprovanteUrl.trim() || undefined,
            pagoPor: pagoPor.trim() || undefined,
          };
          if (fluxo === "entrada") {
            await darBaixaRecebimentoShare(lancamento.id, dadosBaixa);
          } else {
            await darBaixaPagamentoShare(lancamento.id, dadosBaixa);
          }
        } catch (erro) {
          erroBaixaInicial = erro instanceof Error ? erro.message : "Não foi possível confirmar a baixa.";
        }
      }

      const errosUpload: string[] = [];
      for (const imagem of imagens) {
        try {
          const enviado = await enviarAnexoDocumentoSaida(imagem, imagem.name, {
            origem: "lancamento",
            documentoId: lancamento.id,
          });
          await anexarDocumentoLancamento(lancamento.id, {
            nome: imagem.name,
            url: enviado.url,
            tipo: imagem.type || "image/*",
          });
        } catch {
          errosUpload.push(formatarTextoUi(imagem.name));
        }
      }

      if (errosUpload.length) {
        toast.error(
          `LANÇAMENTO SALVO, MAS NÃO FOI POSSÍVEL ANEXAR: ${errosUpload.join(", ")}. EDITE O LANÇAMENTO PARA TENTAR NOVAMENTE.`,
        );
      } else if (erroBaixaInicial) {
        toast.error(`Lançamento criado em aberto, mas a baixa não foi confirmada: ${erroBaixaInicial}. Registre a baixa pela tabela.`);
      } else {
        toast.success(
          editando
            ? "LANÇAMENTO ATUALIZADO."
            : registrarBaixaInicial
              ? `LANÇAMENTO REGISTRADO COMO ${fluxo === "entrada" ? "RECEBIDO" : "PAGO"}.`
              : "LANÇAMENTO DO CAIXA SHARE REGISTRADO EM ABERTO."
        );
      }

      aoCriar(lancamento);
      limpar();
      aoFechar();
    } catch (erro) {
      toast.error(
        erro instanceof Error
          ? formatarTextoUi(erro.message)
          : "NÃO FOI POSSÍVEL SALVAR O LANÇAMENTO.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const mostrarSeletorFluxo = !somenteDespesa && !somenteEntrada;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) aoFechar();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-[24px] border-border bg-background p-0 text-foreground uppercase shadow-2xl sm:w-full [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:p-1.5 [&>button]:text-white/85 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        {/* CABEÇALHO ESTRUTURAL EM VERDE-MUSGO (COMPATÍVEL COM LIGHT E DARK) */}
        <DialogHeader className="border-b border-border/60 bg-[#233329] px-5 pb-5 pt-5 text-left dark:bg-[#17221B] sm:px-6">
          <div className="mb-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2D4034] px-3 py-1 dark:bg-[#223328]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8E636]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C8E636]">
              FINANCEIRO SHARE · CAIXA PRÓPRIO
            </p>
          </div>
          <DialogTitle className="text-xl font-bold uppercase tracking-[-0.02em] text-white">
            {editando
              ? "EDITAR LANÇAMENTO"
              : somenteDespesa
                ? "NOVA CONTA A PAGAR"
                : "NOVO LANÇAMENTO"}
          </DialogTitle>
          <DialogDescription className="text-[11px] font-medium uppercase tracking-wide text-[#C4CFC8]">
            DESPESAS E ENTRADAS INTERNAS DA SHARE BRASIL. LANÇAMENTOS RATEADOS DE COTISTAS NÃO ENTRAM AQUI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-muted/30 px-4 py-4 dark:bg-background sm:px-6 sm:py-5">
          {/* BLOCO 1: IDENTIFICAÇÃO, VALOR E CLASSIFICAÇÃO */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#233329] text-[#C8E636] dark:bg-[#C8E636]/15 dark:text-[#C8E636]">
                <Receipt size={13} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
                IDENTIFICAÇÃO E CLASSIFICAÇÃO
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-descricao" className={LABEL_CLASS}>
                DESCRIÇÃO *
              </Label>
              <Input
                id="nl-descricao"
                className={INPUT_CLASS}
                value={descricao}
                onChange={(evento) => setDescricao(sanitizarDigitacao(evento.target.value))}
                placeholder="EX.: ALUGUEL DA SEDE — SETEMBRO"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {mostrarSeletorFluxo && (
                <div className="space-y-1.5">
                  <Label className={LABEL_CLASS}>TIPO DE FLUXO</Label>
                  <Select
                    value={fluxo}
                    onValueChange={(proximoFluxo) => {
                      setFluxo(proximoFluxo);
                      setCategoriaId("");
                    }}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="uppercase">
                      <SelectItem value="saida" className={SELECT_ITEM_CLASS}>
                        SAÍDA (DESPESA)
                      </SelectItem>
                      <SelectItem value="entrada" className={SELECT_ITEM_CLASS}>
                        ENTRADA (RECEITA)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nl-valor" className={LABEL_CLASS}>
                  VALOR (R$) *
                </Label>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="nl-valor"
                    className={`${INPUT_CLASS} pl-9 font-mono text-base font-bold tabular-nums`}
                    inputMode="decimal"
                    value={valor}
                    onChange={(evento) => setValor(evento.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {!mostrarSeletorFluxo && (
                <div className="space-y-1.5">
                  <Label htmlFor="nl-doc-inline" className={LABEL_CLASS}>
                    DOCUMENTO / NF
                  </Label>
                  <Input
                    id="nl-doc-inline"
                    className={INPUT_CLASS}
                    value={numeroDoc}
                    onChange={(evento) => setNumeroDoc(sanitizarDigitacao(evento.target.value))}
                    placeholder="EX.: NF-1042"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={LABEL_CLASS}>CATEGORIA DO CAIXA (POR GRUPO) *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="SELECIONE A CATEGORIA" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] uppercase">
                  {gruposCategoria.length === 0 && (
                    <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                      NENHUMA CATEGORIA CONFIGURADA PARA ESTE TIPO DE LANÇAMENTO.
                    </div>
                  )}
                  {gruposCategoria.map(([grupo, itens]) => (
                    <div key={grupo}>
                      <p className="bg-muted/70 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {formatarTextoUi(grupo)}
                      </p>
                      {itens.map((categoria) => (
                        <SelectItem
                          key={categoria.id}
                          value={categoria.id}
                          className={SELECT_ITEM_CLASS}
                        >
                          {formatarTextoUi(categoria.nome)}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* BLOCO 2: DATAS E RECORRÊNCIA */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#233329] text-[#C8E636] dark:bg-[#C8E636]/15 dark:text-[#C8E636]">
                <Calendar size={13} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
                DATAS E PERIODICIDADE
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="nl-data-emissao" className={LABEL_CLASS}>
                  DATA DE EMISSÃO
                </Label>
                <Input
                  id="nl-data-emissao"
                  type="date"
                  className={`${INPUT_CLASS} tabular-nums [color-scheme:light] dark:[color-scheme:dark]`}
                  value={dataEmissao}
                  onChange={(evento) => setDataEmissao(evento.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-data-vencimento" className={LABEL_CLASS}>
                  VENCIMENTO
                </Label>
                <Input
                  id="nl-data-vencimento"
                  type="date"
                  className={`${INPUT_CLASS} tabular-nums [color-scheme:light] dark:[color-scheme:dark]`}
                  value={dataVencimento}
                  onChange={(evento) => setDataVencimento(evento.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>PERIODICIDADE</Label>
                <Select
                  value={periodicidade}
                  onValueChange={(valorSelecionado) =>
                    setPeriodicidade(valorSelecionado as Periodicidade)
                  }
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="SELECIONE A PERIODICIDADE" />
                  </SelectTrigger>
                  <SelectContent className="uppercase">
                    {opcoesPeriodicidade.map((opcao) => (
                      <SelectItem
                        key={opcao.id}
                        value={opcao.id}
                        className={SELECT_ITEM_CLASS}
                      >
                        {formatarTextoUi(opcao.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editando && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nl-status-inicial">Situação inicial</Label>
                  <Select
                    value={registrarBaixaInicial ? "baixado" : "aberto"}
                    onValueChange={(value) => {
                      const baixar = value === "baixado";
                      setRegistrarBaixaInicial(baixar);
                      if (baixar && !dataPagamento) setDataPagamento(new Date().toISOString().slice(0, 10));
                    }}
                  >
                    <SelectTrigger id="nl-status-inicial" className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Em aberto</SelectItem>
                      <SelectItem value="baixado">{fluxo === "entrada" ? "Recebido" : "Pago"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* BLOCO 3: DADOS DA BAIXA (QUANDO JÁ PAGO/RECEBIDO OU BAIXA INICIAL) */}
          {(temBaixaEditavel || (!editando && registrarBaixaInicial)) && (
            <section
              className="grid gap-4 rounded-2xl border border-[#233329]/25 bg-[#233329]/[0.04] p-4 dark:border-[#C8E636]/25 dark:bg-[#C8E636]/[0.05] sm:grid-cols-2"
              aria-label="DADOS DA BAIXA"
            >
              <div className="flex items-start gap-2.5 border-b border-border/70 pb-2.5 sm:col-span-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#233329] text-[#C8E636] dark:bg-[#C8E636]/15 dark:text-[#C8E636]">
                  <CheckCircle2 size={13} />
                </span>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
                    DADOS DA BAIXA
                  </h3>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {editando ? "EDITE OS DADOS DA BAIXA JÁ REGISTRADA NESTE LANÇAMENTO." : `INFORME OS DADOS DO ${fluxo === "entrada" ? "RECEBIMENTO" : "PAGAMENTO"} PARA REGISTRAR A BAIXA AGORA.`}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-data-pagamento" className={LABEL_CLASS}>
                  DATA DO {fluxo === "entrada" ? "RECEBIMENTO" : "PAGAMENTO"}{!editando && registrarBaixaInicial ? " *" : ""}
                </Label>
                <Input
                  id="nl-data-pagamento"
                  type="date"
                  required={!editando && registrarBaixaInicial}
                  className={`${INPUT_CLASS} tabular-nums [color-scheme:light] dark:[color-scheme:dark]`}
                  value={dataPagamento}
                  onChange={(evento) => setDataPagamento(evento.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>CONTA BANCÁRIA{!editando && registrarBaixaInicial ? " *" : ""}</Label>
                <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="SELECIONE A CONTA" />
                  </SelectTrigger>
                  <SelectContent className="uppercase">
                    <SelectItem value="nenhuma" className={SELECT_ITEM_CLASS}>
                      NÃO INFORMADA
                    </SelectItem>
                    {contaBancariaId !== "nenhuma" &&
                      !contasBancarias.some((conta) => conta.id === contaBancariaId) && (
                        <SelectItem value={contaBancariaId} className={SELECT_ITEM_CLASS}>
                          {formatarTextoUi(
                            lancamentoInicial?.contaBancariaRotulo || contaBancariaId,
                          )}
                        </SelectItem>
                      )}
                    {contasBancarias.map((conta) => (
                      <SelectItem
                        key={conta.id}
                        value={conta.id}
                        className={SELECT_ITEM_CLASS}
                      >
                        {formatarTextoUi(conta.banco)}
                        {conta.numero_conta ? ` · ${formatarTextoUi(conta.numero_conta)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>FORMA DE PAGAMENTO</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="SELECIONE A FORMA" />
                  </SelectTrigger>
                  <SelectContent className="uppercase">
                    <SelectItem value="nenhuma" className={SELECT_ITEM_CLASS}>
                      NÃO INFORMADA
                    </SelectItem>
                    {formaPagamento !== "nenhuma" &&
                      !FORMAS_BAIXA.some(
                        (forma) => formatarTextoUi(forma) === formatarTextoUi(formaPagamento),
                      ) && (
                        <SelectItem value={formaPagamento} className={SELECT_ITEM_CLASS}>
                          {formatarTextoUi(formaPagamento)}
                        </SelectItem>
                      )}
                    {FORMAS_BAIXA.map((forma) => (
                      <SelectItem key={forma} value={forma} className={SELECT_ITEM_CLASS}>
                        {formatarTextoUi(forma)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-pago-por" className={LABEL_CLASS}>
                  {fluxo === "entrada" ? "RECEBIDO DE" : "PAGO POR"}
                </Label>
                <Input
                  id="nl-pago-por"
                  className={INPUT_CLASS}
                  value={pagoPor}
                  onChange={(evento) => setPagoPor(sanitizarDigitacao(evento.target.value))}
                  placeholder={fluxo === "entrada" ? "NOME DO PAGADOR" : "RESPONSÁVEL PELO PAGAMENTO"}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nl-comprovante" className={LABEL_CLASS}>
                  COMPROVANTE DO {fluxo === "entrada" ? "RECEBIMENTO" : "PAGAMENTO"} (LINK)
                </Label>
                <Input
                  id="nl-comprovante"
                  type="url"
                  className="h-10 rounded-xl border-input bg-background text-xs font-medium text-foreground placeholder:uppercase placeholder:text-muted-foreground/70"
                  value={comprovanteUrl}
                  onChange={(evento) => setComprovanteUrl(evento.target.value)}
                  placeholder="HTTPS://..."
                />
              </div>
            </section>
          )}

          {/* BLOCO 4: VÍNCULOS, COMPROVANTES E OBSERVAÇÕES */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#233329] text-[#C8E636] dark:bg-[#C8E636]/15 dark:text-[#C8E636]">
                <Layers size={13} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
                VÍNCULOS E DOCUMENTAÇÃO
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>FORNECEDOR</Label>
                <div className="uppercase [&_button]:h-10 [&_button]:rounded-xl [&_button]:border-input [&_button]:bg-background [&_button]:text-xs [&_button]:font-semibold [&_button]:uppercase [&_button]:text-foreground [&_input]:uppercase">
                  <SearchableCombobox
                    items={fornecedores.map((item) => ({
                      id: item.id,
                      label: `${formatarTextoUi(item.nome)}${
                        item.cidade ? ` · ${formatarTextoUi(item.cidade)}` : ""
                      }`,
                    }))}
                    value={fornecedorId}
                    onChange={(id, label) => {
                      setFornecedorId(id);
                      setFornecedor(formatarTextoUi(label.split(" · ")[0]));
                    }}
                    placeholder="SELECIONE O FORNECEDOR"
                    searchPlaceholder="BUSCAR FORNECEDOR..."
                    emptyMessage="NENHUM FORNECEDOR ENCONTRADO."
                    clearable
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>CATEGORIA DO CLIENTE (OPCIONAL)</Label>
                <Select
                  value={categoriaClienteId || "nenhuma"}
                  onValueChange={(value) => setCategoriaClienteId(value === "nenhuma" ? "" : value)}
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="SEM CATEGORIA DE CLIENTE" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] uppercase">
                    <SelectItem value="nenhuma" className={SELECT_ITEM_CLASS}>
                      SEM CATEGORIA DE CLIENTE
                    </SelectItem>
                    {categoriasCliente.map((item) => (
                      <SelectItem key={item.id} value={item.id} className={SELECT_ITEM_CLASS}>
                        {formatarTextoUi(item.nome)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mostrarSeletorFluxo && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nl-doc-full" className={LABEL_CLASS}>
                    DOCUMENTO / NF
                  </Label>
                  <Input
                    id="nl-doc-full"
                    className={INPUT_CLASS}
                    value={numeroDoc}
                    onChange={(evento) => setNumeroDoc(sanitizarDigitacao(evento.target.value))}
                    placeholder="NÚMERO DO DOCUMENTO OU NOTA FISCAL"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/35 p-3">
              <Label className={LABEL_CLASS}>IMAGENS E COMPROVANTES</Label>

              {lancamentoInicial?.anexos?.length ? (
                <div className="flex flex-wrap gap-2">
                  {lancamentoInicial.anexos.map((anexo, index) => (
                    <a
                      key={anexo.id ?? `${anexo.url}-${index}`}
                      href={anexo.url.startsWith("/") ? `${API_BASE}${anexo.url}` : anexo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase text-foreground hover:bg-muted"
                    >
                      <FileText size={13} className="text-[#233329] dark:text-[#C8E636]" />
                      <span className="max-w-[200px] truncate">{formatarTextoUi(anexo.nome)}</span>
                    </a>
                  ))}
                </div>
              ) : null}

              {imagens.map((arquivo, index) => (
                <div
                  key={`${arquivo.name}-${arquivo.lastModified}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs uppercase"
                >
                  <span className="truncate font-semibold text-foreground">
                    {formatarTextoUi(arquivo.name)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-destructive/15 hover:text-destructive"
                    aria-label={`REMOVER ${formatarTextoUi(arquivo.name)}`}
                    onClick={() => setImagens((atuais) => atuais.filter((_, i) => i !== index))}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <input
                  key={inputImagemKey}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  id="imagens-lancamento"
                  onChange={(evento) => {
                    const novos = Array.from(evento.target.files ?? []);
                    const invalidos = novos.filter(
                      (arquivo) =>
                        !arquivo.type.startsWith("image/") || arquivo.size > 20 * 1024 * 1024,
                    );
                    if (invalidos.length) toast.error("SELECIONE IMAGENS DE ATÉ 20 MB CADA.");
                    setImagens((atuais) => [
                      ...atuais,
                      ...novos.filter(
                        (arquivo) =>
                          arquivo.type.startsWith("image/") && arquivo.size <= 20 * 1024 * 1024,
                      ),
                    ]);
                    setInputImagemKey((key) => key + 1);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-full border-border bg-card px-4 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-[#233329] hover:text-white dark:hover:bg-[#C8E636] dark:hover:text-[#1A241E]"
                  onClick={() => document.getElementById("imagens-lancamento")?.click()}
                >
                  <ImagePlus size={14} />
                  {imagens.length ? "ADICIONAR MAIS IMAGENS" : "ANEXAR IMAGEM"}
                </Button>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  JPG, PNG OU WEBP · ATÉ 20 MB POR ARQUIVO
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-obs" className={LABEL_CLASS}>
                OBSERVAÇÕES
              </Label>
              <Textarea
                id="nl-obs"
                rows={2}
                className="rounded-xl border-input bg-background text-xs font-semibold uppercase tracking-wide text-foreground placeholder:text-muted-foreground/70 focus-visible:border-[#233329] focus-visible:ring-[#233329]/20 dark:focus-visible:border-[#C8E636] dark:focus-visible:ring-[#C8E636]/20"
                value={observacoes}
                onChange={(evento) => setObservacoes(sanitizarDigitacao(evento.target.value))}
                placeholder="ANOTAÇÕES INTERNAS OPCIONAIS..."
              />
            </div>
          </section>
        </div>

        {/* RODAPÉ FIXO ADAPTÁVEL AO TEMA */}
        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t border-border bg-card/95 px-5 py-3.5 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={aoFechar}
            disabled={salvando}
            className="min-h-10 rounded-full border-border bg-background px-5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted"
          >
            CANCELAR
          </Button>
          <Button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="min-h-10 gap-2 rounded-full bg-[#C8E636] px-6 text-xs font-bold uppercase tracking-wider text-[#1A241E] shadow-sm hover:bg-[#B9D828]"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {editando ? "SALVAR ALTERAÇÕES" : "SALVAR LANÇAMENTO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
