import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CalendarDays, Fuel, Loader2, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buscarCotistasAeronave,
  criarContatoShare,
  criarFornecedorAbastecimento,
  enviarAnexoRecibo,
  enviarDespesaRateioRecibo,
  programarContaAPagarRecibo,
  type CategoriaClienteRecibo,
  type CotistaAeronave,
  type Recibo,
} from "@/lib/colaborador-api";
import { allocateCentavos } from "@/lib/money";
import { useFornecedores } from "@/hooks/useFornecedores";

const tipos = ["FIXO", "VARIAVEL_POR_VOO", "VARIAVEL_POR_HORA", "EXTRA"] as const;
const rotulosTipoRateio: Record<(typeof tipos)[number], string> = {
  FIXO: "FIXO",
  VARIAVEL_POR_VOO: "VARIAVEL POR VOO",
  VARIAVEL_POR_HORA: "VARIAVEL POR HORA",
  EXTRA: "EXTRA",
};
const periodicidades = ["ÚNICO", "EVENTUAL", "MENSAL", "BIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
const camposSubcategoria = ["subcategoria_1", "subcategoria_2", "subcategoria_3", "subcategoria_4"] as const;
type CampoSubcategoria = (typeof camposSubcategoria)[number];
const hoje = () => new Date().toISOString().slice(0, 10);

type TipoCadastroFornecedor = "share" | "combustivel";
type CadastroFornecedorDraft = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  contato: string;
  email: string;
  telefone: string;
  endereco: string;
  uf: string;
  cidade: string;
  codigoIcao: string;
  precoAvgas: string;
  precoJet: string;
};

const cadastroFornecedorInicial = (nome = ""): CadastroFornecedorDraft => ({
  nome,
  razaoSocial: "",
  cnpj: "",
  contato: "",
  email: "",
  telefone: "",
  endereco: "",
  uf: "",
  cidade: "",
  codigoIcao: "",
  precoAvgas: "",
  precoJet: "",
});

function parsePrecoOpcional(value: string) {
  const normalizado = value.trim().includes(",")
    ? value.trim().replace(/\./g, "").replace(",", ".")
    : value.trim();
  if (!normalizado) return null;
  const preco = Number(normalizado);
  return Number.isFinite(preco) ? preco : Number.NaN;
}

const formatarMoeda = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

export type RateioDiretoPayload = {
  aeronave_id: string;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  periodicidade?: string | null;
  data_vencimento: string;
  numero_voo?: string | null;
  observacoes?: string | null;
  subcategoria_1?: string | null;
  subcategoria_2?: string | null;
  subcategoria_3?: string | null;
  subcategoria_4?: string | null;
  rateio_linhas: Array<{ cotista_id?: string; socio_id?: string | null; percentual: number; percentual_sociedade: number; valor_centavos: number }>;
};

type Props = {
  open: boolean;
  recibo: Recibo | null;
  aeronaves: Array<{ id: string; matricula_registro: string }>;
  categorias: CategoriaClienteRecibo[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onRequestEmail: (recibo: Recibo, payload: RateioDiretoPayload) => void;
};

/* ---------- Estilos compartilhados ---------- */
const controle =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

function Campo({ rotulo, htmlFor, className = "", children }: { rotulo: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-foreground/90">{rotulo}</label>
      {children}
    </div>
  );
}

function Secao({ titulo, descricao, acao, children }: { titulo: string; descricao?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/40">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default function ProgramarContaAPagarDialog({ open, recibo, aeronaves, categorias, onOpenChange, onSaved, onRequestEmail }: Props) {
  const { data: fornecedores = [], refetch: recarregarFornecedores } = useFornecedores({ includeFavorites: true, includeHotels: true, enabled: open });
  const rateioDireto = recibo?.tipo_recibo === "recibo_pagamento";
  const [aeronaveId, setAeronaveId] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [tipoRateio, setTipoRateio] = useState<(typeof tipos)[number]>("FIXO");
  const [periodicidade, setPeriodicidade] = useState("ÚNICO");
  const [cotistas, setCotistas] = useState<CotistaAeronave[]>([]);
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [boleto, setBoleto] = useState<File | null>(null);
  const [carregandoCotistas, setCarregandoCotistas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviarEmailAntes, setEnviarEmailAntes] = useState(false);
  const [cadastroFornecedorAberto, setCadastroFornecedorAberto] = useState(false);
  const [tipoCadastroFornecedor, setTipoCadastroFornecedor] = useState<TipoCadastroFornecedor | null>(null);
  const [cadastroFornecedor, setCadastroFornecedor] = useState<CadastroFornecedorDraft>(() => cadastroFornecedorInicial());
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [erroCadastroFornecedor, setErroCadastroFornecedor] = useState("");

  const categoriaSelecionada = categorias.find((item) => item.id === categoriaId);
  const fornecedoresDisponiveis = fornecedores;
  const fornecedorSelecionadoId = fornecedoresDisponiveis.find((item) => item.id === `${item.origem}:${fornecedorId}`)?.id || fornecedorNome;

  const selecionarFornecedor = (id: string, label: string) => {
    const fornecedor = fornecedoresDisponiveis.find((item) => item.id === id);
    setFornecedorId(fornecedor ? id.slice(fornecedor.origem.length + 1) : "");
    setFornecedorNome(label.trim());
  };
  const abrirCadastroFornecedor = () => {
    setCadastroFornecedor(cadastroFornecedorInicial(fornecedorNome.trim()));
    setTipoCadastroFornecedor(null);
    setErroCadastroFornecedor("");
    setCadastroFornecedorAberto(true);
  };
  const alterarCampoCadastro = (campo: keyof CadastroFornecedorDraft, valor: string) => {
    setCadastroFornecedor((atual) => ({ ...atual, [campo]: valor }));
  };

  const subcategorias = useMemo(
    () => [categoriaSelecionada?.subcategoria_1, categoriaSelecionada?.subcategoria_2, categoriaSelecionada?.subcategoria_3, categoriaSelecionada?.subcategoria_4].filter((item): item is string => Boolean(item?.trim())),
    [categoriaSelecionada],
  );

  /* Reinicia o formulário ao abrir */
  useEffect(() => {
    if (!open || !recibo) return;
    setAeronaveId(recibo.aeronave_id || "");
    setDataVencimento(recibo.data_vencimento || hoje());
    const categoriaInicial = recibo.categoria_id || recibo.categoria_movimentacao_id || "";
    setCategoriaId(categorias.some((categoria) => categoria.id === categoriaInicial) ? categoriaInicial : "");
    setFornecedorId("");
    setFornecedorNome("");
    setSubcategoria(recibo.subcategoria_1 || recibo.subcategoria_2 || recibo.subcategoria_3 || recibo.subcategoria_4 || "");
    setTipoRateio("FIXO");
    setPeriodicidade("ÚNICO");
    setObservacoes("");
    setBoleto(null);
    setErro("");
    setEnviarEmailAntes(false);
    setCotistas([]);
    setPercentuais({});
  }, [open, recibo, categorias]);

  /* Fecha com ESC (exceto quando o cadastro de fornecedor está aberto) */
  useEffect(() => {
    if (!open) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cadastroFornecedorAberto && !salvando) onOpenChange(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [open, cadastroFornecedorAberto, salvando, onOpenChange]);

  /* Carrega cotistas da aeronave */
  useEffect(() => {
    if (!aeronaveId) {
      setCotistas([]);
      return;
    }
    let cancelado = false;
    setCarregandoCotistas(true);
    void buscarCotistasAeronave(aeronaveId)
      .then((resposta) => {
        if (cancelado) return;
        const lista = resposta.cotistas || [];
        setCotistas(lista);
        setPercentuais((atual) => Object.fromEntries(lista.map((cotista) => [cotista.id, atual[cotista.id] || "0"])));
      })
      .catch((cause) => {
        if (!cancelado) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar os cotistas da aeronave.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoCotistas(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aeronaveId]);

  /* Cotistas elegíveis (rateio direto filtra por tipo de pagador) */
  const cotistasParaRateio = useMemo(() => {
    if (!rateioDireto || !recibo) return cotistas;
    const pagador = cotistas.find((cotista) => cotista.id === recibo.pagador_id);
    if (recibo.pagador_tipo === "cotista_aeronave" && pagador?.eh_holding) return cotistas.filter((cotista) => cotista.eh_holding);
    if (recibo.pagador_tipo === "cliente") return cotistas.filter((cotista) => !cotista.eh_holding);
    return cotistas;
  }, [cotistas, recibo, rateioDireto]);

  const selecionados = useMemo(
    () => cotistasParaRateio.filter((cotista) => Number(percentuais[cotista.id] || 0) > 0),
    [cotistasParaRateio, percentuais],
  );
  const totalPercentual = selecionados.reduce((total, cotista) => total + Number(percentuais[cotista.id] || 0), 0);
  const percentualOk = Math.abs(totalPercentual - 100) < 0.01;

  /* Prévia do valor por cotista */
  const valoresPrevia = useMemo(() => {
    const mapa: Record<string, number> = {};
    if (!recibo || !selecionados.length || totalPercentual <= 0) return mapa;
    try {
      const valores = allocateCentavos(Number(recibo.valor || 0), selecionados.map((cotista) => Number(percentuais[cotista.id])));
      selecionados.forEach((cotista, index) => {
        mapa[cotista.id] = valores[index];
      });
    } catch {
      /* prévia indisponível */
    }
    return mapa;
  }, [recibo, selecionados, percentuais, totalPercentual]);

  const usarPercentualSociedade = () => {
    setPercentuais((atual) => {
      const proximo = { ...atual };
      cotistas.forEach((cotista) => {
        proximo[cotista.id] = cotistasParaRateio.some((item) => item.id === cotista.id)
          ? String(Number(cotista.percentual_sociedade || 0))
          : "0";
      });
      return proximo;
    });
  };
  const limparPercentuais = () => {
    setPercentuais(Object.fromEntries(cotistas.map((cotista) => [cotista.id, "0"])));
  };

  const cadastrarFornecedor = async () => {
    const nome = cadastroFornecedor.nome.trim();
    if (!nome || !tipoCadastroFornecedor) {
      setErroCadastroFornecedor("Informe o nome e o tipo do fornecedor.");
      return;
    }

    const precoAvgas = parsePrecoOpcional(cadastroFornecedor.precoAvgas);
    const precoJet = parsePrecoOpcional(cadastroFornecedor.precoJet);
    if (tipoCadastroFornecedor === "combustivel" && (!cadastroFornecedor.cidade.trim() || Number.isNaN(precoAvgas) || Number.isNaN(precoJet))) {
      setErroCadastroFornecedor("Informe a cidade e valores válidos para os preços preenchidos.");
      return;
    }

    setSalvandoFornecedor(true);
    setErroCadastroFornecedor("");
    try {
      let origem: "agenda" | "combustivel";
      let id = "";
      if (tipoCadastroFornecedor === "combustivel") {
        const resposta = await criarFornecedorAbastecimento({
          nome_fornecedor: nome,
          nome_cidade: cadastroFornecedor.cidade.trim(),
          codigo_icao: cadastroFornecedor.codigoIcao.trim() || null,
          pessoa_contato: cadastroFornecedor.contato.trim() || null,
          telefone: cadastroFornecedor.telefone.trim() || null,
          preco_avgas: precoAvgas,
          preco_jet: precoJet,
        });
        id = resposta.id;
        origem = "combustivel";
      } else {
        const resposta = await criarContatoShare({
          nome,
          razao_social: cadastroFornecedor.razaoSocial.trim() || nome,
          empresa: cadastroFornecedor.razaoSocial.trim() || nome,
          cnpj: cadastroFornecedor.cnpj.trim() || null,
          nome_contato_responsavel: cadastroFornecedor.contato.trim() || nome,
          telefone: cadastroFornecedor.telefone.trim() || null,
          email: cadastroFornecedor.email.trim() || null,
          endereco: cadastroFornecedor.endereco.trim() || null,
          uf: cadastroFornecedor.uf.trim().toUpperCase() || null,
          cidade: cadastroFornecedor.cidade.trim() || null,
          categoria: "FORNECEDOR",
          categoria_tipo: "FORNECEDOR",
        });
        const respostaTipada = resposta as { item?: { id?: string }; id?: string };
        id = String(respostaTipada.item?.id || respostaTipada.id || "");
        origem = "agenda";
      }

      const listaAtualizada = await recarregarFornecedores();
      const fornecedorAtualizado = listaAtualizada.data?.find((item) => item.id === `${origem}:${id}`);
      setFornecedorId(id || fornecedorAtualizado?.id.slice(fornecedorAtualizado.origem.length + 1) || "");
      setFornecedorNome(nome);
      setCadastroFornecedorAberto(false);
    } catch (cause) {
      setErroCadastroFornecedor(cause instanceof Error ? cause.message : "Não foi possível cadastrar o fornecedor.");
    } finally {
      setSalvandoFornecedor(false);
    }
  };

  /* Monta os campos subcategoria_1..4; retorna null se a escolha for ambígua */
  const montarSubcategorias = (): Record<CampoSubcategoria, string | null> | null => {
    const base: Record<CampoSubcategoria, string | null> = { subcategoria_1: null, subcategoria_2: null, subcategoria_3: null, subcategoria_4: null };
    const alvo = subcategoria.trim();
    if (!alvo || !recibo) return base;
    const correspondencias = camposSubcategoria.filter((campo) => categoriaSelecionada?.[campo]?.trim() === alvo);
    const campoOriginal = camposSubcategoria.find((campo) => recibo[campo]?.trim() === alvo);
    if (correspondencias.length > 1 || (correspondencias.length === 0 && !campoOriginal)) return null;
    base[correspondencias[0] || campoOriginal!] = alvo;
    return base;
  };

  const salvar = async () => {
    if (!recibo) return;
    setSalvando(true);
    setErro("");
    try {
      if (!aeronaveId || !dataVencimento || !selecionados.length || !percentualOk) {
        setErro("Informe aeronave, vencimento e percentuais dos cotistas somando 100%.");
        return;
      }
      const subcategoriasPayload = montarSubcategorias();
      if (!subcategoriasPayload) {
        setErro("A subcategoria selecionada não corresponde a uma opção única da categoria.");
        return;
      }

      if (rateioDireto) {
        const valoresRateados = allocateCentavos(Number(recibo.valor || 0), selecionados.map((cotista) => Number(percentuais[cotista.id])));
        const rateioLinhas = selecionados.map((cotista, index) => ({
          cotista_id: cotista.id,
          socio_id: cotista.socio_id,
          percentual: Number(percentuais[cotista.id]),
          percentual_sociedade: Number(cotista.percentual_sociedade || 0),
          valor_centavos: valoresRateados[index],
        }));
        const payload: RateioDiretoPayload = {
          aeronave_id: aeronaveId,
          data_vencimento: dataVencimento,
          categoria_id: categoriaId || recibo.categoria_id || recibo.categoria_movimentacao_id || null,
          categoria_nome: categoriaSelecionada?.nome || null,
          fornecedor_id: fornecedorId || null,
          fornecedor_nome: fornecedorNome || null,
          periodicidade,
          numero_voo: recibo.numero_voo || null,
          observacoes: observacoes.trim() || null,
          ...subcategoriasPayload,
          rateio_linhas: rateioLinhas,
        };
        if (enviarEmailAntes) {
          onRequestEmail(recibo, payload);
          return;
        }
        await enviarDespesaRateioRecibo(recibo.id, payload);
      } else {
        if (!categoriaSelecionada) {
          setErro("Selecione uma categoria de cliente válida antes de programar a conta.");
          return;
        }
        const boletoSalvo = boleto ? await enviarAnexoRecibo(boleto, recibo.id) : null;
        await programarContaAPagarRecibo(recibo.id, {
          aeronave_id: aeronaveId,
          data_vencimento: dataVencimento,
          categoria_id: categoriaId || recibo.categoria_id || recibo.categoria_movimentacao_id || null,
          categoria_nome: categoriaSelecionada?.nome || null,
          ...subcategoriasPayload,
          tipo_rateio: tipoRateio,
          fornecedor_id: fornecedorId || null,
          fornecedor_nome: fornecedorNome || null,
          periodicidade,
          observacoes: observacoes.trim() || null,
          boleto_url: boletoSalvo?.url || null,
          linhas: selecionados.map((cotista) => ({ cotista_id: cotista.id, percentual_uso: Number(percentuais[cotista.id]) })),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : rateioDireto ? "Não foi possível enviar a despesa para o rateio." : "Não foi possível programar a conta a pagar.");
    } finally {
      setSalvando(false);
    }
  };

  if (!open || !recibo) return null;
  const valor = formatarMoeda(Number(recibo.valor || 0));
  const fornecedorManual = fornecedorNome.trim() && !fornecedorId;
  const barra = totalPercentual > 100.01 ? "bg-red-500" : percentualOk ? "bg-emerald-500" : "bg-amber-500";
  const textoTotal = totalPercentual > 100.01 ? "text-red-600" : percentualOk ? "text-emerald-600" : "text-amber-600";

  return (
    <div
      className={rateioDireto ? "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6" : "fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-4 lg:p-6"}
      role={rateioDireto ? undefined : "dialog"}
      aria-modal={rateioDireto ? undefined : "true"}
      aria-labelledby="titulo-programar-conta"
    >
      <div className={rateioDireto ? "flex w-full flex-col rounded-xl border border-border bg-background shadow-sm" : "flex h-full w-full max-w-6xl flex-col overflow-hidden border-[rgba(11,15,20,1)] bg-[#101825] shadow-none sm:h-auto sm:max-h-[94dvh] sm:rounded-xl sm:border"}>
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="titulo-programar-conta" className="text-lg font-semibold leading-tight">
              {rateioDireto ? "Enviar despesa para rateio" : "Programar conta a pagar"}
            </h2>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">
              Recibo {recibo.numero_recibo} · {valor}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className={rateioDireto ? "px-4 py-4 sm:px-6 sm:py-5" : "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Resumo (topo no mobile, lateral fixa no desktop) */}
            <aside className="space-y-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-0 lg:self-start">
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Total do rateio</h3>
                  <span className={`font-mono text-sm font-semibold ${textoTotal}`}>{totalPercentual.toFixed(2)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${barra}`} style={{ width: `${Math.min(totalPercentual, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {percentualOk
                    ? `${selecionados.length} cotista(s) selecionado(s). Distribuição completa.`
                    : totalPercentual > 100
                      ? `Excede em ${(totalPercentual - 100).toFixed(2)}%. Reduza os percentuais.`
                      : `Faltam ${(100 - totalPercentual).toFixed(2)}% para completar 100%.`}
                </p>
              </section>

              {rateioDireto && (
                <section className="rounded-xl border border-primary/30 bg-primary/[.06] p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-[13px]">
                    <input type="checkbox" checked={enviarEmailAntes} onChange={(event) => setEnviarEmailAntes(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                    <span>
                      <strong className="block font-semibold">Enviar e-mail antes de criar o rateio</strong>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        O lançamento e o rateio só são criados após o envio ser confirmado, e o status do recibo muda para EMAIL ENVIADO. Sem marcar, o rateio é criado direto.
                      </span>
                    </span>
                  </label>
                </section>
              )}
            </aside>

            {/* Formulário principal */}
            <div className="space-y-5 lg:col-start-1 lg:row-start-1">
              <Secao titulo="Dados da despesa" descricao="Informações usadas para gerar o lançamento financeiro.">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Campo rotulo="Aeronave" htmlFor="pcp-aeronave">
                    <select id="pcp-aeronave" value={aeronaveId} onChange={(event) => setAeronaveId(event.target.value)} className={controle}>
                      <option value="">Selecione a aeronave</option>
                      {aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}</option>)}
                    </select>
                  </Campo>

                  <Campo rotulo="Vencimento" htmlFor="pcp-vencimento">
                    <div className="relative">
                      <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input id="pcp-vencimento" type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} className={`${controle} pl-9`} />
                    </div>
                  </Campo>

                  <Campo rotulo="Periodicidade">
                    <SearchableCombobox
                      items={periodicidades.map((item) => ({ id: item, label: item }))}
                      value={periodicidade}
                      onChange={(value) => setPeriodicidade(value)}
                      placeholder="Selecione a periodicidade"
                      searchPlaceholder="Buscar periodicidade..."
                      emptyMessage="Nenhuma periodicidade encontrada."
                    />
                  </Campo>

                  <Campo rotulo="Fornecedor" className="sm:col-span-2">
                    <SearchableCombobox
                      items={fornecedoresDisponiveis.map((item) => ({ id: item.id, label: item.nome }))}
                      value={fornecedorSelecionadoId}
                      onChange={selecionarFornecedor}
                      placeholder="Busque ou digite um fornecedor"
                      searchPlaceholder="Buscar fornecedor..."
                      emptyMessage="Nenhum fornecedor correspondente encontrado. Digite para usar neste recibo."
                      allowFreeText
                      clearable
                    />
                  </Campo>

                  {!rateioDireto ? (
                    <Campo rotulo="Tipo de rateio" htmlFor="pcp-tipo-rateio">
                      <select id="pcp-tipo-rateio" value={tipoRateio} onChange={(event) => setTipoRateio(event.target.value as (typeof tipos)[number])} className={controle}>
                        {tipos.map((tipo) => <option key={tipo} value={tipo}>{rotulosTipoRateio[tipo]}</option>)}
                      </select>
                    </Campo>
                  ) : (
                    <div className="hidden xl:block" aria-hidden="true" />
                  )}

                  {fornecedorManual && (
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/[.07] p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between xl:col-span-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        “{fornecedorNome.trim()}” não está cadastrado. Use somente neste recibo ou crie o cadastro.
                      </p>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setFornecedorId(""); setFornecedorNome((nome) => nome.trim()); }}>
                          Somente neste recibo
                        </Button>
                        <Button type="button" size="sm" onClick={abrirCadastroFornecedor}>
                          <Plus size={14} className="mr-1" /> Cadastrar fornecedor
                        </Button>
                      </div>
                    </div>
                  )}

                  <Campo rotulo={rateioDireto ? "Categoria" : "Categoria do cliente"} className={subcategorias.length ? "" : "sm:col-span-2"}>
                    <SearchableCombobox
                      items={categorias.map((categoria) => ({ id: categoria.id, label: categoria.nome }))}
                      value={categoriaId}
                      onChange={(id) => { setCategoriaId(id); setSubcategoria(""); }}
                      placeholder="Selecione a categoria"
                      searchPlaceholder="Buscar categoria..."
                      emptyMessage="Nenhuma categoria encontrada."
                    />
                  </Campo>

                  {subcategorias.length > 0 && (
                    <Campo rotulo="Subcategoria">
                      <SearchableCombobox
                        items={subcategorias.map((item) => ({ id: item, label: item }))}
                        value={subcategoria}
                        onChange={(id) => setSubcategoria(id)}
                        placeholder="Selecione a subcategoria"
                        searchPlaceholder="Buscar subcategoria..."
                        emptyMessage="Nenhuma subcategoria encontrada."
                      />
                    </Campo>
                  )}
                </div>
              </Secao>

              {!rateioDireto && (
                <Secao titulo="Boleto" descricao="Anexe o boleto em PDF ou imagem (opcional).">
                  <AnexosDinamicos file={boleto} onFileChange={setBoleto} accept="application/pdf,image/*" label="Boleto" description="PDF ou imagem" />
                </Secao>
              )}

              <Secao
                titulo="Cotistas e percentual de uso"
                descricao="Informe o percentual de cada cotista. A soma deve ser 100%."
                acao={
                  cotistasParaRateio.length > 0 ? (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={usarPercentualSociedade}>Usar % da sociedade</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={limparPercentuais}>Limpar</Button>
                    </div>
                  ) : undefined
                }
              >
                {carregandoCotistas ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Carregando cotistas...</div>
                ) : !aeronaveId ? (
                  <p className="py-4 text-sm text-muted-foreground">Selecione a aeronave para listar os cotistas.</p>
                ) : cotistasParaRateio.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Nenhum cotista elegível para esta aeronave.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="hidden grid-cols-[minmax(0,1fr)_110px_130px_130px] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                      <span>Cotista</span>
                      <span className="text-right">Sociedade</span>
                      <span className="text-right">Uso (%)</span>
                      <span className="text-right">Valor</span>
                    </div>
                    <ul className="divide-y divide-border/70">
                      {cotistasParaRateio.map((cotista) => {
                        const ativo = Number(percentuais[cotista.id] || 0) > 0;
                        return (
                          <li key={cotista.id} className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_110px_130px_130px] ${ativo ? "bg-primary/[.04]" : ""}`}>
                            <span className="col-span-2 min-w-0 truncate font-medium sm:col-span-1" title={cotista.nome}>
                              {cotista.nome}
                              {cotista.eh_holding && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">Holding</span>}
                            </span>
                            <span className="text-xs text-muted-foreground sm:text-right">
                              <span className="sm:hidden">Sociedade: </span>{Number(cotista.percentual_sociedade || 0).toLocaleString("pt-BR", { maximumFractionDigits: 10 })}%
                            </span>
                            <div className="relative justify-self-end sm:w-full">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                inputMode="decimal"
                                aria-label={`Percentual de uso de ${cotista.nome}`}
                                value={percentuais[cotista.id] ?? ""}
                                placeholder="0"
                                onChange={(event) => setPercentuais((atual) => ({ ...atual, [cotista.id]: event.target.value }))}
                                className="h-9 w-28 rounded-lg border border-border bg-card pl-2 pr-7 text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 sm:w-full"
                              />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                            <span className="col-span-2 text-right font-mono text-xs text-muted-foreground sm:col-span-1">
                              {valoresPrevia[cotista.id] !== undefined ? formatarMoeda(valoresPrevia[cotista.id]) : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Secao>

              <Secao titulo="Observações">
                <textarea
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Informações adicionais para o financeiro (opcional)"
                  className="min-h-24 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </Secao>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p role={erro ? "alert" : undefined} className={`min-h-5 text-sm ${erro ? "font-medium text-red-600" : "text-muted-foreground"}`}>
            {erro || (percentualOk ? "Pronto para gravar." : "Complete 100% de rateio para continuar.")}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
            <Button type="button" onClick={() => void salvar()} disabled={salvando || carregandoCotistas} className="gap-2">
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {rateioDireto ? (enviarEmailAntes ? "Continuar para e-mail" : "Enviar despesa para rateio") : "Gravar programação"}
            </Button>
          </div>
        </div>
      </div>

      {/* Cadastro de fornecedor */}
      <Dialog open={cadastroFornecedorAberto} onOpenChange={(estado) => { if (!salvandoFornecedor) setCadastroFornecedorAberto(estado); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto border-border bg-background">
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
            <DialogDescription>Escolha o tipo de cadastro para salvar o fornecedor.</DialogDescription>
          </DialogHeader>

          {!tipoCadastroFornecedor ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-4 text-left" onClick={() => setTipoCadastroFornecedor("combustivel")}>
                <Fuel size={20} className="shrink-0 text-primary" />
                <span><strong className="block text-sm">Fornecedor de combustível</strong><span className="text-xs font-normal text-muted-foreground">Cadastro de abastecimento</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-4 text-left" onClick={() => setTipoCadastroFornecedor("share")}>
                <Building2 size={20} className="shrink-0 text-primary" />
                <span><strong className="block text-sm">Fornecedor Share</strong><span className="text-xs font-normal text-muted-foreground">Agenda de contatos</span></span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
                <p className="text-sm font-medium">{tipoCadastroFornecedor === "combustivel" ? "Fornecedor de combustível" : "Fornecedor Share"}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTipoCadastroFornecedor(null)}>Trocar tipo</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Campo rotulo="Nome do fornecedor *" className="sm:col-span-2 lg:col-span-3">
                  <Input autoFocus value={cadastroFornecedor.nome} onChange={(event) => alterarCampoCadastro("nome", event.target.value)} />
                </Campo>
                {tipoCadastroFornecedor === "combustivel" ? (
                  <>
                    <Campo rotulo="Cidade *"><Input value={cadastroFornecedor.cidade} onChange={(event) => alterarCampoCadastro("cidade", event.target.value)} /></Campo>
                    <Campo rotulo="ICAO"><Input value={cadastroFornecedor.codigoIcao} onChange={(event) => alterarCampoCadastro("codigoIcao", event.target.value.toUpperCase())} maxLength={4} /></Campo>
                    <Campo rotulo="Contato"><Input value={cadastroFornecedor.contato} onChange={(event) => alterarCampoCadastro("contato", event.target.value)} /></Campo>
                    <Campo rotulo="Telefone"><Input value={cadastroFornecedor.telefone} onChange={(event) => alterarCampoCadastro("telefone", event.target.value)} /></Campo>
                    <Campo rotulo="Preço AVGAS"><Input inputMode="decimal" value={cadastroFornecedor.precoAvgas} onChange={(event) => alterarCampoCadastro("precoAvgas", event.target.value)} placeholder="0,00" /></Campo>
                    <Campo rotulo="Preço JET"><Input inputMode="decimal" value={cadastroFornecedor.precoJet} onChange={(event) => alterarCampoCadastro("precoJet", event.target.value)} placeholder="0,00" /></Campo>
                  </>
                ) : (
                  <>
                    <Campo rotulo="Razão social" className="lg:col-span-2"><Input value={cadastroFornecedor.razaoSocial} onChange={(event) => alterarCampoCadastro("razaoSocial", event.target.value)} /></Campo>
                    <Campo rotulo="CNPJ"><Input value={cadastroFornecedor.cnpj} onChange={(event) => alterarCampoCadastro("cnpj", event.target.value)} /></Campo>
                    <Campo rotulo="Contato responsável"><Input value={cadastroFornecedor.contato} onChange={(event) => alterarCampoCadastro("contato", event.target.value)} /></Campo>
                    <Campo rotulo="Telefone"><Input value={cadastroFornecedor.telefone} onChange={(event) => alterarCampoCadastro("telefone", event.target.value)} /></Campo>
                    <Campo rotulo="E-mail"><Input type="email" value={cadastroFornecedor.email} onChange={(event) => alterarCampoCadastro("email", event.target.value)} /></Campo>
                    <Campo rotulo="Endereço" className="sm:col-span-2 lg:col-span-3"><Input value={cadastroFornecedor.endereco} onChange={(event) => alterarCampoCadastro("endereco", event.target.value)} /></Campo>
                    <Campo rotulo="Cidade" className="lg:col-span-2"><Input value={cadastroFornecedor.cidade} onChange={(event) => alterarCampoCadastro("cidade", event.target.value)} /></Campo>
                    <Campo rotulo="UF"><Input value={cadastroFornecedor.uf} onChange={(event) => alterarCampoCadastro("uf", event.target.value.toUpperCase())} maxLength={2} /></Campo>
                  </>
                )}
              </div>
            </div>
          )}

          {erroCadastroFornecedor && <p role="alert" className="text-sm text-destructive">{erroCadastroFornecedor}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCadastroFornecedorAberto(false)} disabled={salvandoFornecedor}>Cancelar</Button>
            {tipoCadastroFornecedor && (
              <Button type="button" onClick={() => void cadastrarFornecedor()} disabled={salvandoFornecedor || !cadastroFornecedor.nome.trim()}>
                {salvandoFornecedor ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Salvar fornecedor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
