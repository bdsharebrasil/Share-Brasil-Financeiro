import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, FileText, ImagePlus, Loader2, Plus, X } from "lucide-react";
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

const FORMAS_BAIXA = ["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"];

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
  const [fornecedor, setFornecedor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [categoriaClienteId, setCategoriaClienteId] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
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
    setFornecedor("");
    setFornecedorId("");
    setNumeroDoc("");
    setObservacoes("");
    setCategoriaClienteId("");
    setDataPagamento("");
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
    setDescricao(lancamentoInicial.descricao ?? "");
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
    setFornecedorId(lancamentoInicial.fornecedorId ?? "");
    setFornecedor(lancamentoInicial.fornecedor ?? "");
    setNumeroDoc(lancamentoInicial.numeroDoc ?? "");
    setObservacoes(lancamentoInicial.observacoes ?? "");
    setCategoriaClienteId(lancamentoInicial.categoriaClienteId ?? "");
    setDataPagamento(
      normalizarDataInput(lancamentoInicial.dataPagamento ?? lancamentoInicial.data_pagamento),
    );
    setContaBancariaId(lancamentoInicial.contaBancariaId || "nenhuma");
    setFormaPagamento(lancamentoInicial.formaPagamento || "nenhuma");
    setComprovanteUrl(lancamentoInicial.comprovanteUrl ?? "");
    setPagoPor(lancamentoInicial.pagoPor ?? "");
    setImagens([]);
  }, [aberto, lancamentoInicial, limpar, fluxoInicial, somenteDespesa, somenteEntrada]);

  const gruposCategoria = useMemo(() => {
    const mapa = new Map<string, CategoriaCaixaShare[]>();
    const tiposDoFluxo = fluxo === "saida" ? ["DESPESA", "SAIDA"] : ["RECEITA", "ENTRADA"];
    const categoriasVisiveis = categorias.filter((categoria) => {
      const tipo = String(categoria.tipo ?? "").trim().toUpperCase();
      return !tipo || tiposDoFluxo.includes(tipo) || (editando && categoria.id === lancamentoInicial?.categoriaId);
    });

    categoriasVisiveis.forEach((categoria) => {
      const grupo = categoria.grupo?.trim() || "OUTRAS";
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), categoria]);
    });
    return [...mapa.entries()];
  }, [categorias, editando, fluxo, lancamentoInicial?.categoriaId]);

  const salvar = async () => {
    const categoria = categorias.find((item) => item.id === categoriaId);
    const fornecedorSelecionado = fornecedores.find((item) => item.id === fornecedorId);
    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));

    if (!descricao.trim()) return toast.error("Informe a descrição do lançamento.");
    if (!categoria) return toast.error("Selecione a categoria do caixa Share.");
    const tiposDoFluxo = fluxo === "saida" ? ["DESPESA", "SAIDA"] : ["RECEITA", "ENTRADA"];
    const tipoCategoria = String(categoria.tipo ?? "").trim().toUpperCase();
    if (tipoCategoria && !tiposDoFluxo.includes(tipoCategoria)) {
      return toast.error("Selecione uma categoria compatível com o tipo de lançamento.");
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return toast.error("Informe um valor válido.");
    }

    setSalvando(true);
    try {
      const emissaoFinal = dataEmissao || null;
      const vencimentoFinal = dataVencimento || null;

      const payload = {
        descricao: descricao.trim(),
        fluxo: fluxo === "entrada" ? "ENTRADA" : "SAIDA",
        tipo_caixa: "SHARE",
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        grupo_categoria: categoria.grupo?.trim() || null,
        valor_total: valorNumerico,
        data: emissaoFinal,
        data_emissao: emissaoFinal,
        prazo: vencimentoFinal,
        data_vencimento: vencimentoFinal,
        fornecedor_id: fornecedorId || null,
        fornecedor: (fornecedorSelecionado?.nome ?? fornecedor).trim() || null,
        fornecedor_nome: (fornecedorSelecionado?.nome ?? fornecedor).trim() || null,
        numero_doc: numeroDoc.trim() || null,
        periodicidade: categoria.classificacao,
        observacoes: observacoes.trim() || null,
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
                  pago_por: pagoPor.trim() || null,
                }
              : {}),
          })
        : await (fluxo === "entrada" ? emitirReceita : criarDespesa)(payload);

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
          errosUpload.push(imagem.name);
        }
      }

      if (errosUpload.length) {
        toast.error(
          `Lançamento salvo, mas não foi possível anexar: ${errosUpload.join(", ")}. Edite o lançamento para tentar novamente.`,
        );
      } else {
        toast.success(editando ? "Lançamento atualizado." : "Lançamento do caixa Share registrado.");
      }

      aoCriar(lancamento);
      limpar();
      aoFechar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o lançamento.");
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
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl border-border bg-card p-4 shadow-2xl sm:w-full sm:p-6">
        <DialogHeader className="border-b border-border/70 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
            Financeiro Share · Caixa próprio
          </p>
          <DialogTitle className="text-xl font-bold tracking-[-.03em]">
            {editando ? "Editar lançamento" : somenteDespesa ? "Nova conta a pagar" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Despesas e entradas internas da Share Brasil. Lançamentos rateados de cotistas não entram aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* BLOCO 1: Descrição, Valor e Categoria */}
          <section className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nl-descricao">Descrição *</Label>
              <Input
                id="nl-descricao"
                className="h-10"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex.: Aluguel da sede — setembro"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {mostrarSeletorFluxo && (
                <div className="space-y-1.5">
                  <Label>Tipo de fluxo</Label>
                  <Select
                    value={fluxo}
                    onValueChange={(proximoFluxo) => {
                      setFluxo(proximoFluxo);
                      setCategoriaId("");
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saida">Saída (despesa)</SelectItem>
                      <SelectItem value="entrada">Entrada (receita)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nl-valor">Valor (R$) *</Label>
                <Input
                  id="nl-valor"
                  className="h-10 font-mono text-base font-semibold"
                  inputMode="decimal"
                  value={valor}
                  onChange={(evento) => setValor(evento.target.value)}
                  placeholder="0,00"
                />
              </div>

              {!mostrarSeletorFluxo && (
                <div className="space-y-1.5">
                  <Label htmlFor="nl-doc-inline">Documento / NF</Label>
                  <Input
                    id="nl-doc-inline"
                    className="h-10"
                    value={numeroDoc}
                    onChange={(evento) => setNumeroDoc(evento.target.value)}
                    placeholder="Ex.: NF-1042"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Categoria do caixa (por grupo) *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {gruposCategoria.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhuma categoria configurada para este tipo de lançamento.
                    </div>
                  )}
                  {gruposCategoria.map(([grupo, itens]) => (
                    <div key={grupo}>
                      <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                        {grupo}
                      </p>
                      {itens.map((categoria) => (
                        <SelectItem key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* BLOCO 2: Datas (Emissão e Vencimento) */}
          <section className="rounded-xl border border-border bg-muted/25 p-3.5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Calendar size={14} className="text-primary" />
              <span>Datas do lançamento</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nl-data-emissao">Data de emissão</Label>
                <Input
                  id="nl-data-emissao"
                  type="date"
                  className="h-10 bg-background [color-scheme:light] dark:[color-scheme:dark]"
                  value={dataEmissao}
                  onChange={(evento) => setDataEmissao(evento.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nl-data-vencimento">Vencimento</Label>
                <Input
                  id="nl-data-vencimento"
                  type="date"
                  className="h-10 bg-background [color-scheme:light] dark:[color-scheme:dark]"
                  value={dataVencimento}
                  onChange={(evento) => setDataVencimento(evento.target.value)}
                />
              </div>
            </div>
          </section>

          {/* BLOCO 3: Dados da Baixa (apenas se já estiver pago/recebido) */}
          {temBaixaEditavel && (
            <section
              className="grid gap-4 rounded-xl border border-primary/25 bg-primary/[.03] p-4 sm:grid-cols-2"
              aria-label="Dados da baixa"
            >
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold">Dados da baixa</h3>
                <p className="text-xs text-muted-foreground">
                  Edite os dados do pagamento já registrado neste lançamento.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-data-pagamento">Data do pagamento</Label>
                <Input
                  id="nl-data-pagamento"
                  type="date"
                  className="h-10 bg-background [color-scheme:light] dark:[color-scheme:dark]"
                  value={dataPagamento}
                  onChange={(evento) => setDataPagamento(evento.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conta bancária</Label>
                <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Não informada</SelectItem>
                    {contaBancariaId !== "nenhuma" &&
                      !contasBancarias.some((conta) => conta.id === contaBancariaId) && (
                        <SelectItem value={contaBancariaId}>
                          {lancamentoInicial?.contaBancariaRotulo || contaBancariaId}
                        </SelectItem>
                      )}
                    {contasBancarias.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.banco}
                        {conta.numero_conta ? ` • ${conta.numero_conta}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Não informada</SelectItem>
                    {formaPagamento !== "nenhuma" && !FORMAS_BAIXA.includes(formaPagamento) && (
                      <SelectItem value={formaPagamento}>{formaPagamento}</SelectItem>
                    )}
                    {FORMAS_BAIXA.map((forma) => (
                      <SelectItem key={forma} value={forma}>
                        {forma}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-pago-por">Pago por</Label>
                <Input
                  id="nl-pago-por"
                  className="h-10 bg-background"
                  value={pagoPor}
                  onChange={(evento) => setPagoPor(evento.target.value)}
                  placeholder="Responsável pelo pagamento"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nl-comprovante">Link do comprovante</Label>
                <Input
                  id="nl-comprovante"
                  type="url"
                  className="h-10 bg-background"
                  value={comprovanteUrl}
                  onChange={(evento) => setComprovanteUrl(evento.target.value)}
                  placeholder="https://..."
                />
              </div>
            </section>
          )}

          {/* BLOCO 4: Fornecedor, Categoria do Cliente, Anexos e Observações */}
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <SearchableCombobox
                  items={fornecedores.map((item) => ({
                    id: item.id,
                    label: `${item.nome}${item.cidade ? ` · ${item.cidade}` : ""}`,
                  }))}
                  value={fornecedorId}
                  onChange={(id, label) => {
                    setFornecedorId(id);
                    setFornecedor(label.split(" · ")[0]);
                  }}
                  placeholder="Selecione o fornecedor"
                  searchPlaceholder="Buscar fornecedor..."
                  emptyMessage="Nenhum fornecedor encontrado."
                  clearable
                />
              </div>

              <div className="space-y-1.5">
                <Label>Categoria do cliente (opcional)</Label>
                <Select
                  value={categoriaClienteId || "nenhuma"}
                  onValueChange={(value) => setCategoriaClienteId(value === "nenhuma" ? "" : value)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sem categoria de cliente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="nenhuma">Sem categoria de cliente</SelectItem>
                    {categoriasCliente.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mostrarSeletorFluxo && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nl-doc-full">Documento / NF</Label>
                  <Input
                    id="nl-doc-full"
                    className="h-10"
                    value={numeroDoc}
                    onChange={(evento) => setNumeroDoc(evento.target.value)}
                    placeholder="Número do documento ou nota fiscal"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Imagens e comprovantes</Label>
              {lancamentoInicial?.anexos?.length ? (
                <div className="flex flex-wrap gap-2">
                  {lancamentoInicial.anexos.map((anexo, index) => (
                    <a
                      key={anexo.id ?? `${anexo.url}-${index}`}
                      href={anexo.url.startsWith("/") ? `${API_BASE}${anexo.url}` : anexo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileText size={13} className="text-primary" />
                      <span className="max-w-[200px] truncate">{anexo.nome}</span>
                    </a>
                  ))}
                </div>
              ) : null}

              {imagens.map((arquivo, index) => (
                <div
                  key={`${arquivo.name}-${arquivo.lastModified}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs"
                >
                  <span className="truncate font-medium">{arquivo.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remover ${arquivo.name}`}
                    onClick={() => setImagens((atuais) => atuais.filter((_, i) => i !== index))}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2.5">
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
                    if (invalidos.length) toast.error("Selecione imagens de até 20 MB cada.");
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
                  className="h-9 gap-2"
                  onClick={() => document.getElementById("imagens-lancamento")?.click()}
                >
                  <ImagePlus size={15} />
                  {imagens.length ? "Adicionar mais imagens" : "Anexar imagem"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  JPG, PNG ou WebP · até 20 MB por arquivo
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-obs">Observações</Label>
              <Textarea
                id="nl-obs"
                rows={2}
                value={observacoes}
                onChange={(evento) => setObservacoes(evento.target.value)}
                placeholder="Anotações internas opcionais..."
              />
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-[-1rem] -mx-4 mt-4 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:bottom-[-1.5rem] sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            onClick={aoFechar}
            disabled={salvando}
            className="min-h-10"
          >
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="min-h-10 gap-2">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {editando ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
