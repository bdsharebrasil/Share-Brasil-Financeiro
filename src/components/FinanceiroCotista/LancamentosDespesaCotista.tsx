import "./lancamentos-cotista-table.css";
import { DarBaixaCotistaDialog } from "./DarBaixaCotistaDialog";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Clock3,
  Coins,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { IconeAnexo } from "@/components/financeiro-share/IconeAnexo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  editarLancamento,
  excluirLancamento,
  formatarCentavos,
  formatarData,
  parseValorReais,
  type LancamentoEconomico,
} from "@/lib/financeiro-share-api";
import {
  documentoDoLancamento,
  documentosDoLancamento,
  nomeFornecedorLancamento,
  nomePagadoresDoLancamento,
  numerosDocumentosDoLancamento,
  opcaoFornecedorLancamento,
  rateioDoCotista,
  tipoRateioLancamento,
  valorPagoLancamento,
} from "@/lib/financeiro-cotista-lancamentos";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { mesAtualLocal, rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";

export function deslocarMes(competencia: string, deslocamento: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + deslocamento, 1, 12);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export function SeletorMesesCotista({
  mesesSelecionados,
  aoAlternar,
  aoSelecionarMesAtual,
}: {
  mesesSelecionados: string[];
  aoAlternar: (mes: string) => void;
  aoSelecionarMesAtual: () => void;
}) {
  const mesAtual = mesAtualLocal();
  const mesReferencia = mesesSelecionados[mesesSelecionados.length - 1] || mesAtual;
  const [ano, setAno] = useState(Number(mesReferencia.slice(0, 4)));
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setAno(Number(mesReferencia.slice(0, 4)));
  }, [mesReferencia]);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" className="cotista-btn" aria-expanded={aberto}>
          Mês Atual <ChevronDown size={13} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] border-border bg-popover p-3 text-popover-foreground">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="cotista-btn cotista-btn-icon"
              aria-label="Ano anterior"
              onClick={() => setAno((valor) => Math.max(1900, valor - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <strong className="min-w-12 text-center text-sm tabular-nums">{ano}</strong>
            <button
              type="button"
              className="cotista-btn cotista-btn-icon"
              aria-label="Próximo ano"
              onClick={() => setAno((valor) => Math.min(9999, valor + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Meses de ${ano}`}>
          {MESES_CURTOS.map((mes, indice) => {
            const competencia = `${ano}-${String(indice + 1).padStart(2, "0")}`;
            const selecionado = mesesSelecionados.includes(competencia);
            return (
              <button
                key={competencia}
                type="button"
                aria-pressed={selecionado}
                onClick={() => aoAlternar(competencia)}
                className={`h-8 rounded border text-xs transition-colors ${
                  selecionado
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {mes}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Um ou mais meses</span>
          <button
            type="button"
            className="cotista-btn h-7 px-2.5 text-[11px]"
            onClick={() => {
              aoSelecionarMesAtual();
              setAberto(false);
            }}
          >
            Mês atual
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_LANCAMENTO = [
  { value: "EM_ABERTO", label: "Em aberto", Icon: Clock3 },
  { value: "PAGO", label: "Pago", Icon: CircleCheck },
  { value: "PAGO_DIRETAMENTE", label: "Pago diretamente", Icon: CircleCheck },
  { value: "EM_ATRASO", label: "Em atraso", Icon: CircleAlert },
  { value: "ESTORNO", label: "Estorno", Icon: Undo2 },
  { value: "SAIDA", label: "Saída", Icon: ReceiptText },
  { value: "AGUARDANDO_REEMBOLSO", label: "Aguardando reembolso", Icon: Clock3 },
  { value: "REEMBOLSADO", label: "Reembolsado", Icon: Undo2 },
  { value: "CANCELADO", label: "Cancelado", Icon: X },
] as const;

function normalizarStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

function statusLancamento(status: string | null | undefined) {
  const value = normalizarStatus(status);
  return (
    STATUS_LANCAMENTO.find((opcao) => opcao.value === value) ?? {
      value,
      label: value ? value.replace(/_/g, " ") : "Não informado",
      Icon: CircleAlert,
    }
  );
}

const COR_STATUS: Record<string, string> = {
  PAGO: "bg-[var(--app-success-soft)] text-[var(--app-success)] border-[var(--app-success-line)]",
  PAGO_DIRETAMENTE: "bg-[var(--app-success-soft)] text-[var(--app-success)] border-[var(--app-success-line)]",
  RECEBIDO: "bg-[var(--app-success-soft)] text-[var(--app-success)] border-[var(--app-success-line)]",
  REEMBOLSADO: "bg-[var(--app-success-soft)] text-[var(--app-success)] border-[var(--app-success-line)]",
  EM_ABERTO: "bg-[var(--app-warning-soft)] text-[var(--app-warning)] border-[var(--app-warning-line)]",
  EM_ATRASO: "bg-[var(--app-danger-soft)] text-[var(--app-danger)] border-[var(--app-danger-line)]",
  AGUARDANDO_REEMBOLSO: "bg-[var(--app-violet-soft)] text-[var(--app-violet)] border-[var(--app-violet-line)]",
};

function BadgeStatus({ status }: { status: string }) {
  const visual = statusLancamento(status);
  const classe = COR_STATUS[visual.value] ?? "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${classe}`}>
      {visual.label}
    </span>
  );
}

const TIPOS_DOCUMENTO_COTISTA = [
  { valor: "demonstrativo", rotulo: "Demonstrativo" },
  { valor: "nota", rotulo: "Nota fiscal" },
  { valor: "recibo", rotulo: "Recibo" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "documento", rotulo: "Documento" },
] as const;

function tipoDocumentoLancamento(lancamento: LancamentoEconomico) {
  if (lancamento.numeroNf) return "nota";
  if (lancamento.numeroRecibo) return "recibo";
  if (lancamento.numeroBoleto) return "boleto";
  if (lancamento.numeroDemonstrativo) return "demonstrativo";
  if (lancamento.numeroDoc || lancamento.documentoNumero) return "documento";
  return null;
}

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function cotistaPagouLancamento(
  item: LancamentoEconomico,
  cotista: CotistaAeronave,
  rateio: { pagoPor?: string | null; percentual?: number; valorCentavos?: number } | null,
) {
  const idsCotista = new Set(
    [cotista.id, cotista.cliente_id, cotista.socio_id, ...(cotista.cotista_ids ?? [])].filter(Boolean),
  );
  if (rateio?.pagoPor && idsCotista.has(rateio.pagoPor)) return true;
  if (item.pagoPor && idsCotista.has(item.pagoPor)) return true;
  const nomeCotista = normalizarBusca(cotista.nome);
  if (rateio?.pagoPor && normalizarBusca(rateio.pagoPor) === nomeCotista) return true;
  if (item.pagoPor && normalizarBusca(item.pagoPor) === nomeCotista) return true;
  return false;
}

export type OpcaoEdicao = { id: string; label: string };
type CampoDocumentoLancamento =
  | "documento_numero"
  | "numero_doc"
  | "numero_nf"
  | "numero_recibo"
  | "numero_demonstrativo"
  | "documento";

const TIPOS_RATEIO_EDICAO: OpcaoEdicao[] = [
  { id: "FIXO", label: "FIXO" },
  { id: "VARIAVEL POR VOO", label: "VARIAVEL POR VOO" },
  { id: "VARIAVEL POR HORA", label: "VARIAVEL POR HORA" },
  { id: "EXTRA", label: "EXTRA" },
];

function LancamentoExpandido({
  lancamento,
  cotistasAeronave,
  fornecedoresEdicao,
  aoAbrirDocumento,
}: {
  lancamento: LancamentoEconomico;
  cotistasAeronave: CotistaAeronave[];
  fornecedoresEdicao: OpcaoEdicao[];
  aoAbrirDocumento: (nome: string, url: string) => void;
}) {
  const documentosExpansao = documentosDoLancamento(lancamento, cotistasAeronave).filter((d) =>
    Boolean(d.url),
  );

  return (
    <div className="sticky left-0 w-[calc(100cqi-2px)] max-w-full border-l-2 border-primary bg-card px-5 py-4 text-xs text-card-foreground">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Categoria
          </span>
          <strong className="mt-0.5 block font-medium">{lancamento.categoria || "—"}</strong>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Favorecido
          </span>
          <strong className="mt-0.5 block font-medium">
            {nomeFornecedorLancamento(lancamento, fornecedoresEdicao) || "—"}
          </strong>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Nº dos documentos
          </span>
          <strong className="mt-0.5 block font-medium">
            {numerosDocumentosDoLancamento(lancamento) || "—"}
          </strong>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Observações
          </span>
          <p className="mt-0.5 whitespace-pre-wrap text-slate-300">
            {lancamento.observacoes || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Anexos e documentos ({documentosExpansao.length})
          </span>
        </div>
        {documentosExpansao.length ? (
          <div className="flex flex-wrap gap-2">
            {documentosExpansao.map((documento) => {
              const titulo = documento.nome || "Documento";
              const responsaveis = documento.responsaveis.join(", ");
              const rotulo = `${responsaveis ? `${responsaveis} · ` : ""}${titulo}${
                documento.numero ? ` · ${documento.numero}` : ""
              }`;
              return (
                <button
                  key={documento.url}
                  type="button"
                  onClick={() => aoAbrirDocumento(rotulo, documento.url)}
                  className="inline-flex items-center gap-2 rounded border border-border bg-secondary px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary hover:bg-accent"
                >
                  <IconeAnexo nome={titulo} />
                  <span>
                    <strong className="block font-medium">{titulo}</strong>
                    <small className="text-[10px] text-slate-400">
                      {responsaveis || "Documento do lançamento"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500">Nenhum anexo vinculado a este lançamento.</p>
        )}
      </div>
    </div>
  );
}

export function LancamentosDespesaCotista({
  lancamentos,
  cotistasAeronave,
  aoNovo,
  aoAtualizar,
  aoAtualizarFornecedores,
  mesesSelecionados,
  aoSelecionarMes,
  aoAlterarMeses,
  fornecedoresEdicao,
  categoriasClienteEdicao,
  carregando = false,
}: {
  lancamentos: LancamentoEconomico[];
  cotistasAeronave: CotistaAeronave[];
  aoNovo: () => void;
  aoAtualizar: () => Promise<void>;
  aoAtualizarFornecedores: () => void;
  mesesSelecionados: string[];
  aoSelecionarMes: (mes: string) => void;
  aoAlterarMeses: (meses: string[]) => void;
  fornecedoresEdicao: OpcaoEdicao[];
  categoriasClienteEdicao: OpcaoEdicao[];
  carregando?: boolean;
}) {
  const [baixaSelecionada, setBaixaSelecionada] = useState<LancamentoEconomico | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [documentoAberto, setDocumentoAberto] = useState<{ nome: string; url: string } | null>(
    null,
  );

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modoData, setModoData] = useState<"emissao" | "vencimento" | "pagamento" | "todos">(
    "emissao",
  );
  const [filtroDoc, setFiltroDoc] = useState("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Ordenação, colunas e paginação
  const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: "asc" | "desc" }>({
    coluna: "data",
    direcao: "asc",
  });
  const [larguras, setLarguras] = useState<Record<string, number>>({});
  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set());
  const [menuColunasAberto, setMenuColunasAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  const scrollRef = useRef<HTMLDivElement>(null);
  const colunasAnchorRef = useRef<HTMLDivElement>(null);
  const limparGestoRef = useRef<(() => void) | null>(null);
  const bloquearCliqueRef = useRef(false);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => () => limparGestoRef.current?.(), []);

  useEffect(() => {
    setPagina(1);
    setExpandidos(new Set());
    setSelecionados(new Set());
  }, [busca, filtroStatus, filtroCategoria, filtroDoc, modoData, ordenacao, lancamentos, porPagina]);

  useEffect(() => {
    if (!menuColunasAberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (
        evento.target instanceof Element &&
        colunasAnchorRef.current?.contains(evento.target)
      ) {
        return;
      }
      setMenuColunasAberto(false);
    };
    const fecharEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuColunasAberto(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [menuColunasAberto]);

  const iniciarRedimensionamento = (
    colunaId: string,
    minimo: number,
    evento: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    if (!evento.isPrimary || evento.button !== 0) return;
    evento.preventDefault();
    evento.stopPropagation();
    limparGestoRef.current?.();
    const inicioX = evento.clientX;
    const larguraInicial =
      evento.currentTarget.parentElement?.getBoundingClientRect().width ?? minimo;
    const cursorAnterior = document.body.style.cursor;
    const selecaoAnterior = document.body.style.userSelect;
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== evento.pointerId) return;
      setLarguras((atual) => ({
        ...atual,
        [colunaId]: Math.min(720, Math.max(minimo, larguraInicial + e.clientX - inicioX)),
      }));
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("blur", soltar);
      document.body.style.cursor = cursorAnterior;
      document.body.style.userSelect = selecaoAnterior;
      limparGestoRef.current = null;
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    limparGestoRef.current = soltar;
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);
  };

  const iniciarArraste = (evento: ReactPointerEvent<HTMLDivElement>) => {
    bloquearCliqueRef.current = false;
    const viewport = scrollRef.current;
    if (
      !viewport ||
      evento.pointerType !== "mouse" ||
      evento.button !== 0 ||
      (evento.target as HTMLElement).closest(
        "button,a,input,select,textarea,label,[role=checkbox],[role=separator],[role=menuitem]",
      )
    ) {
      return;
    }
    limparGestoRef.current?.();
    const inicioX = evento.clientX;
    const inicioScroll = viewport.scrollLeft;
    const selecaoAnterior = document.body.style.userSelect;
    let moveu = false;
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== evento.pointerId) return;
      const delta = e.clientX - inicioX;
      if (!moveu && Math.abs(delta) < 5) return;
      moveu = true;
      bloquearCliqueRef.current = true;
      setArrastando(true);
      document.body.style.userSelect = "none";
      e.preventDefault();
      viewport.scrollLeft = inicioScroll - delta;
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("blur", soltar);
      document.body.style.userSelect = selecaoAnterior;
      setArrastando(false);
      window.setTimeout(() => {
        bloquearCliqueRef.current = false;
      }, 0);
      limparGestoRef.current = null;
    };
    limparGestoRef.current = soltar;
    window.addEventListener("pointermove", mover, { passive: false });
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);
  };

  // Estados de Edição / Exclusão
  type AcaoDespesa = { tipo: "editar" | "excluir"; item: LancamentoEconomico };
  type EdicaoLancamento = {
    dataEmissao: string;
    dataVencimento: string;
    campoDocumento: CampoDocumentoLancamento;
    documentoNumero: string;
    descricao: string;
    fornecedor: string;
    fornecedorId: string;
    categoria: string;
    categoriaId: string;
    status: string;
    tipoRateio: string;
    valorTotal: string;
    valorPago: string;
    pagoPor: string;
    observacoes: string;
    rateios: Record<string, { percentual: string; valor: string; pagoPor: string }>;
  };

  const [acao, setAcao] = useState<AcaoDespesa | null>(null);
  const [edicaoLancamento, setEdicaoLancamento] = useState<EdicaoLancamento | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const processandoRef = useRef(false);

  // Regra Financeiro Cotista: apenas lançamentos de SAÍDA
  const despesas = useMemo(
    () => lancamentos.filter((item) => item.fluxo === "SAIDA"),
    [lancamentos],
  );

  const categorias = useMemo(
    () =>
      [...new Set(despesas.map((item) => item.categoria || "Sem categoria"))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [despesas],
  );

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    return despesas.filter((item) => {
      const correspondeBusca =
        !termo ||
        normalizarBusca(
          [
            item.descricao,
            nomeFornecedorLancamento(item, fornecedoresEdicao),
            item.participanteNome,
            item.categoria,
            numerosDocumentosDoLancamento(item),
            formatarData(item.dataEmissao || item.data),
            formatarCentavos(item.valorCentavos),
            formatarCentavos(valorPagoLancamento(item)),
            item.tipoRateio || item.tipo,
            ...item.rateios.map((r) => r.cotista),
            item.pagoPor,
            ...item.rateios.map((r) => r.pagoPor),
            item.observacoes,
            statusLancamento(item.status).label,
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(termo);

      return (
        correspondeBusca &&
        (filtroStatus === "todos" || normalizarStatus(item.status) === filtroStatus) &&
        (filtroCategoria === "todas" ||
          (item.categoria || "Sem categoria") === filtroCategoria) &&
        (filtroDoc === "todos" || tipoDocumentoLancamento(item) === filtroDoc)
      );
    });
  }, [despesas, busca, filtroStatus, filtroCategoria, filtroDoc, fornecedoresEdicao]);

  const ordenarDataPor =
    modoData === "vencimento"
      ? "vencimento"
      : modoData === "pagamento"
        ? "pagamento"
        : "emissao";

  const dataParaOrdenacao = (item: LancamentoEconomico) =>
    ordenarDataPor === "emissao"
      ? item.dataEmissao || item.data
      : ordenarDataPor === "vencimento"
        ? item.prazo
        : item.dataPagamento;

  const formatarDataCurta = (valor: string | null | undefined) =>
    formatarData(valor).replace(/\/\d{4}$/, "");

  type ColunaDespesa = {
    id: string;
    titulo: string;
    subtitulo?: string;
    largura: number;
    minimo: number;
    numerica?: boolean;
    cotista?: boolean;
    primeiraCotista?: boolean;
    valor?: (item: LancamentoEconomico) => string | number | null | undefined;
    render: (item: LancamentoEconomico) => ReactNode;
  };

  const colunas: ColunaDespesa[] = [
    {
      id: "data",
      titulo: "Data",
      largura: 112,
      minimo: 96,
      valor: dataParaOrdenacao,
      render: (item) => (
        <div className="leading-tight">
          {(modoData === "emissao" || modoData === "todos") && (
            <span className="block">{formatarDataCurta(item.dataEmissao || item.data)}</span>
          )}
          {(modoData === "vencimento" || modoData === "todos") && (
            <span className="block text-[11px] text-slate-400">
              {modoData === "todos" ? "Venc. " : ""}
              {formatarDataCurta(item.prazo)}
            </span>
          )}
          {modoData === "todos" && item.dataPagamento && (
            <span className="block text-[11px] text-emerald-400">
              Pag. {formatarDataCurta(item.dataPagamento)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "documento",
      titulo: "Doc",
      largura: 115,
      minimo: 88,
      valor: numerosDocumentosDoLancamento,
      render: (item) => (
        <span
          className="cotista-cell-ellipsis font-mono text-[11.5px] text-slate-300"
          title={numerosDocumentosDoLancamento(item) || undefined}
        >
          {numerosDocumentosDoLancamento(item) || "—"}
        </span>
      ),
    },
    {
      id: "descricao",
      titulo: "Descrição",
      largura: 250,
      minimo: 150,
      valor: (item) => item.descricao,
      render: (item) => (
        <span className="cotista-cell-ellipsis font-medium text-slate-100" title={item.descricao}>
          {item.descricao || "—"}
        </span>
      ),
    },
    {
      id: "fornecedor",
      titulo: "Favorecido",
      largura: 195,
      minimo: 130,
      valor: (item) => nomeFornecedorLancamento(item, fornecedoresEdicao),
      render: (item) => {
        const nome = nomeFornecedorLancamento(item, fornecedoresEdicao);
        return (
          <span className="cotista-cell-ellipsis text-slate-300" title={nome || undefined}>
            {nome || "—"}
          </span>
        );
      },
    },
    {
      id: "categoria",
      titulo: "Categoria",
      largura: 155,
      minimo: 110,
      valor: (item) => item.categoria || "Sem categoria",
      render: (item) => (
        <span className="cotista-cell-ellipsis text-slate-300" title={item.categoria || undefined}>
          {item.categoria || "Sem categoria"}
        </span>
      ),
    },
    {
      id: "status",
      titulo: "Status",
      largura: 155,
      minimo: 130,
      valor: (item) => statusLancamento(item.status).label,
      render: (item) => <BadgeStatus status={item.status} />,
    },
    {
      id: "tipo",
      titulo: "Tipo Rateio",
      largura: 145,
      minimo: 115,
      valor: (item) => item.tipoRateio || item.tipo,
      render: (item) => (
        <span className="cotista-cell-ellipsis text-[11.5px] text-slate-300">
          {tipoRateioLancamento(item)}
        </span>
      ),
    },
    {
      id: "valor-total",
      titulo: "Valor Total",
      largura: 135,
      minimo: 115,
      numerica: true,
      valor: (item) => item.valorCentavos,
      render: (item) => (
        <span className="cotista-cell-money text-slate-100">
          {formatarCentavos(item.valorCentavos)}
        </span>
      ),
    },
    {
      id: "valor-pago",
      titulo: "Valor Pago",
      largura: 135,
      minimo: 115,
      numerica: true,
      valor: valorPagoLancamento,
      render: (item) => {
        const pago = valorPagoLancamento(item);
        return (
          <span className={`cotista-cell-money ${pago > 0 ? "text-emerald-400" : "text-slate-400"}`}>
            {formatarCentavos(pago)}
          </span>
        );
      },
    },
    {
      id: "pago-por",
      titulo: "Pago Por",
      largura: 155,
      minimo: 120,
      valor: (item) => nomePagadoresDoLancamento(item, cotistasAeronave),
      render: (item) => {
        const pagador = nomePagadoresDoLancamento(item, cotistasAeronave);
        return (
          <span className="cotista-cell-ellipsis text-slate-200" title={pagador || undefined}>
            {pagador || "—"}
          </span>
        );
      },
    },
    // COLUNAS FINAIS: Clientes / Cotistas da aeronave, com % e valor de pagamento
    ...cotistasAeronave.map(
      (cotista, index): ColunaDespesa => ({
        id: `cotista-${cotista.id}`,
        titulo: cotista.nome,
        subtitulo: `Cota ${Number(cotista.percentual_sociedade).toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        })}% · % / R$`,
        largura: 195,
        minimo: 165,
        numerica: true,
        cotista: true,
        primeiraCotista: index === 0,
        valor: (item) => rateioDoCotista(item, cotista, cotistasAeronave)?.valorCentavos,
        render: (item) => {
          const rateio = rateioDoCotista(item, cotista, cotistasAeronave);
          if (!rateio) {
            return <span className="block text-right text-slate-500">—</span>;
          }
          const pagouDireto = cotistaPagouLancamento(item, cotista, rateio);
          const pctFormatado = Number(rateio.percentual).toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          });
          return (
            <div className="cotista-rateio-box">
              <span className="cotista-rateio-meta">
                <span>{pctFormatado}%</span>
                {pagouDireto && (
                  <span className="cotista-paid-pill" title="Pago por este cotista">
                    <Check size={10} /> Pago
                  </span>
                )}
              </span>
              <span className="cotista-rateio-amount">
                {formatarCentavos(rateio.valorCentavos)}
              </span>
            </div>
          );
        },
      }),
    ),
  ];

  const colunasVisiveis = colunas.filter((coluna) => !ocultas.has(coluna.id));

  const alternarColunaOculta = (id: string) =>
    setOcultas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const larguraTabela =
    96 +
    colunasVisiveis.reduce(
      (total, coluna) => total + (larguras[coluna.id] ?? coluna.largura),
      0,
    );

  const quantidadeColunas = colunasVisiveis.length + 1;

  const ordenarPor = (coluna: string) =>
    setOrdenacao((atual) => ({
      coluna,
      direcao: atual.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc",
    }));

  const comparador = useMemo(
    () => new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }),
    [],
  );

  const colunaOrdenada = colunas.find((coluna) => coluna.id === ordenacao.coluna);

  const itensPorMes = new Map<string, LancamentoEconomico[]>();
  for (const item of filtradas) {
    const data = String(dataParaOrdenacao(item) ?? "").slice(0, 10);
    const mes = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data.slice(0, 7) : "Sem data";
    const itens = itensPorMes.get(mes) ?? [];
    itens.push(item);
    itensPorMes.set(mes, itens);
  }

  const gruposPorMes = [...itensPorMes.entries()]
    .sort(([mesA], [mesB]) => {
      if (mesA === "Sem data") return mesB === "Sem data" ? 0 : 1;
      if (mesB === "Sem data") return -1;
      return ordenacao.coluna === "data" && ordenacao.direcao === "asc"
        ? mesA.localeCompare(mesB)
        : mesB.localeCompare(mesA);
    })
    .map(([mes, itens]) => ({
      mes,
      itens: [...itens].sort((a, b) => {
        const primeiro = colunaOrdenada?.valor?.(a);
        const segundo = colunaOrdenada?.valor?.(b);
        if (primeiro == null || primeiro === "") return segundo == null || segundo === "" ? 0 : 1;
        if (segundo == null || segundo === "") return -1;
        const resultado =
          typeof primeiro === "number" && typeof segundo === "number"
            ? primeiro - segundo
            : comparador.compare(String(primeiro), String(segundo));
        return (
          (ordenacao.direcao === "asc" ? resultado : -resultado) ||
          comparador.compare(a.id, b.id)
        );
      }),
    }));

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * porPagina;

  const gruposDaPagina = useMemo(() => {
    let deslocamento = 0;
    return gruposPorMes
      .map((grupo) => {
        const inicio = deslocamento;
        deslocamento += grupo.itens.length;
        return {
          ...grupo,
          itens: grupo.itens.slice(
            Math.max(0, inicioPagina - inicio),
            Math.max(0, inicioPagina + porPagina - inicio),
          ),
        };
      })
      .filter((grupo) => grupo.itens.length > 0);
  }, [gruposPorMes, inicioPagina, porPagina]);

  const itensDaPagina = gruposDaPagina.flatMap((grupo) => grupo.itens);

  // Totais gerais e por cotista
  const totalLancado = despesas.reduce((total, item) => total + item.valorCentavos, 0);
  const totalPago = despesas.reduce((total, item) => total + valorPagoLancamento(item), 0);
  const totalAberto = Math.max(0, totalLancado - totalPago);
  const totalFiltrado = filtradas.reduce((total, item) => total + item.valorCentavos, 0);

  const resumoPorCotista = useMemo(
    () =>
      cotistasAeronave.map((cotista) => {
        let totalRateado = 0;
        let totalPagoDireto = 0;
        for (const item of filtradas) {
          const rateio = rateioDoCotista(item, cotista, cotistasAeronave);
          if (!rateio) continue;
          totalRateado += rateio.valorCentavos;
          if (cotistaPagouLancamento(item, cotista, rateio)) {
            totalPagoDireto += rateio.valorCentavos;
          }
        }
        return {
          id: cotista.id,
          nome: cotista.nome,
          percentualSociedade: cotista.percentual_sociedade,
          totalRateado,
          totalPagoDireto,
        };
      }),
    [cotistasAeronave, filtradas],
  );

  const itensSelecionados = useMemo(
    () => filtradas.filter((item) => selecionados.has(item.id)),
    [filtradas, selecionados],
  );
  const totalSelecionado = itensSelecionados.reduce(
    (total, item) => total + item.valorCentavos,
    0,
  );

  const todosDaPaginaSelecionados =
    itensDaPagina.length > 0 && itensDaPagina.every((item) => selecionados.has(item.id));

  const alternarSelecao = (id: string) =>
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const alternarSelecaoDaPagina = () =>
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      itensDaPagina.forEach((item) => {
        if (todosDaPaginaSelecionados) proximo.delete(item.id);
        else proximo.add(item.id);
      });
      return proximo;
    });

  const alternarExpandido = (id: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const temFiltros = Boolean(
    busca || filtroStatus !== "todos" || filtroCategoria !== "todas" || filtroDoc !== "todos",
  );

  const limparFiltros = () => {
    setBusca("");
    setFiltroStatus("todos");
    setFiltroCategoria("todas");
    setFiltroDoc("todos");
  };

  // Edição / Exclusão handlers (idênticos ao fluxo existente)
  const atualizarEdicao = (campo: keyof Omit<EdicaoLancamento, "rateios">, valor: string) =>
    setEdicaoLancamento((atual) => (atual ? { ...atual, [campo]: valor } : atual));

  const atualizarRateioEdicao = (
    cotistaId: string,
    campo: keyof EdicaoLancamento["rateios"][string],
    valor: string,
  ) =>
    setEdicaoLancamento((atual) =>
      atual
        ? {
            ...atual,
            rateios: {
              ...atual.rateios,
              [cotistaId]: {
                ...atual.rateios[cotistaId],
                [campo]: valor,
              },
            },
          }
        : atual,
    );

  const abrirAcao = (tipo: AcaoDespesa["tipo"], item: LancamentoEconomico) => {
    const dinheiroInput = (centavos: number | null | undefined) =>
      (Number(centavos || 0) / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const idDoPagador = (pagador: string | null | undefined) => {
      const cotista = cotistasAeronave.find((participante) =>
        [
          participante.id,
          participante.cliente_id,
          participante.socio_id,
          ...(participante.cotista_ids ?? []),
        ].includes(pagador || ""),
      );
      return cotista?.id || pagador || "";
    };

    const camposDocumento: Array<[CampoDocumentoLancamento, string | null | undefined]> = [
      ["documento_numero", item.documentoNumero],
      ["numero_nf", item.numeroNf],
      ["numero_recibo", item.numeroRecibo],
      ["numero_demonstrativo", item.numeroDemonstrativo],
      ["numero_doc", item.numeroDoc],
      ["documento", item.documento],
    ];
    const campoDocumento =
      camposDocumento.find(([, valor]) => Boolean(valor))?.[0] ?? "documento_numero";

    const itemComIds = item as LancamentoEconomico & {
      fornecedorId?: string | null;
      fornecedor_id?: string | null;
      categoriaId?: string | null;
      categoria_id?: string | null;
    };

    const tipoOriginal = normalizarBusca(
      String(item.tipoRateio || item.tipo || "").replace(/[_/]+/g, " "),
    );
    const tipoRateio = tipoOriginal.includes("fixo")
      ? "FIXO"
      : tipoOriginal.includes("extra")
        ? "EXTRA"
        : tipoOriginal.includes("hora")
          ? "VARIAVEL POR HORA"
          : tipoOriginal.includes("voo")
            ? "VARIAVEL POR VOO"
            : "";

    setEdicaoLancamento(
      tipo === "editar"
        ? {
            dataEmissao: (item.dataEmissao || item.data || "").slice(0, 10),
            dataVencimento: (item.prazo || "").slice(0, 10),
            campoDocumento,
            documentoNumero: documentoDoLancamento(item) || "",
            descricao: item.descricao || "",
            fornecedor: nomeFornecedorLancamento(item, fornecedoresEdicao),
            fornecedorId:
              itemComIds.fornecedorId ||
              itemComIds.fornecedor_id ||
              opcaoFornecedorLancamento(item, fornecedoresEdicao)?.id ||
              fornecedoresEdicao.find(
                (f) =>
                  normalizarBusca(f.label) ===
                  normalizarBusca(nomeFornecedorLancamento(item, fornecedoresEdicao)),
              )?.id ||
              "",
            categoria: item.categoria || "",
            categoriaId:
              itemComIds.categoriaId ||
              itemComIds.categoria_id ||
              categoriasClienteEdicao.find(
                (c) => normalizarBusca(c.label) === normalizarBusca(item.categoria || ""),
              )?.id ||
              "",
            status: item.status || "EM_ABERTO",
            tipoRateio,
            valorTotal: dinheiroInput(item.valorCentavos),
            valorPago: dinheiroInput(valorPagoLancamento(item)),
            pagoPor: idDoPagador(item.pagoPor),
            observacoes: item.observacoes || "",
            rateios: Object.fromEntries(
              cotistasAeronave.map((cotista) => {
                const rateio = rateioDoCotista(
                  item,
                  cotista,
                  cotistasAeronave,
                ) as (typeof item.rateios)[number] | null;
                return [
                  cotista.id,
                  {
                    percentual: rateio?.percentual == null ? "" : String(rateio.percentual),
                    valor:
                      rateio?.valorCentavos == null ? "" : dinheiroInput(rateio.valorCentavos),
                    pagoPor: idDoPagador(rateio?.pagoPor),
                  },
                ];
              }),
            ),
          }
        : null,
    );
    setErroAcao(null);
    setAcao({ tipo, item });
    if (tipo === "editar") aoAtualizarFornecedores();
  };

  const confirmarAcao = async () => {
    if (!acao || processandoRef.current) return;
    if (acao.tipo === "editar") {
      if (!edicaoLancamento?.descricao.trim()) {
        setErroAcao("Informe a descrição do lançamento.");
        return;
      }
      if (!edicaoLancamento.valorTotal.trim()) {
        setErroAcao("Informe o valor total do lançamento.");
        return;
      }
    }
    processandoRef.current = true;
    setProcessando(true);
    setErroAcao(null);
    try {
      if (acao.tipo === "editar" && edicaoLancamento) {
        const rateiosEditados = cotistasAeronave.flatMap((cotista) => {
          const valores = edicaoLancamento.rateios[cotista.id];
          if (!valores) return [];
          const original = rateioDoCotista(
            acao.item,
            cotista,
            cotistasAeronave,
          ) as (typeof acao.item.rateios)[number] | null;
          if (
            !original &&
            !valores.percentual.trim() &&
            !valores.valor.trim() &&
            !valores.pagoPor.trim()
          ) {
            return [];
          }
          const percentualTexto = valores.percentual.trim().replace(",", ".");
          const percentual = percentualTexto ? Number(percentualTexto) : 0;
          if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
            throw new Error(`Percentual inválido para ${cotista.nome}.`);
          }
          const valorCentavos = valores.valor.trim() ? parseValorReais(valores.valor) : 0;
          return [
            {
              ...(original || {}),
              cotista_id: cotista.id,
              socio_id: cotista.socio_id || undefined,
              percentual,
              valor_centavos: valorCentavos,
              pago_por: valores.pagoPor || null,
            },
          ];
        });

        const rateiosSemCotistaCorrespondente = acao.item.rateios
          .filter(
            (rateio) =>
              !cotistasAeronave.some(
                (cotista) => rateioDoCotista(acao.item, cotista, cotistasAeronave) === rateio,
              ),
          )
          .map((rateio) => ({
            ...rateio,
            cotista_id: rateio.cotistaId || rateio.cotista,
            valor_centavos: rateio.valorCentavos,
            pago_por: rateio.pagoPor || null,
          }));

        const camposDocumento: Record<CampoDocumentoLancamento, string | null> = {
          documento_numero: null,
          numero_doc: null,
          numero_nf: null,
          numero_recibo: null,
          numero_demonstrativo: null,
          documento: null,
        };
        camposDocumento[edicaoLancamento.campoDocumento] =
          edicaoLancamento.documentoNumero.trim() || null;

        const fornecedorSelecionado = fornecedoresEdicao.find(
          (fornecedor) =>
            fornecedor.id === edicaoLancamento.fornecedorId ||
            fornecedor.id.endsWith(`:${edicaoLancamento.fornecedorId}`),
        );
        const fornecedorIdPersistido = fornecedorSelecionado
          ? fornecedorSelecionado.id.slice(fornecedorSelecionado.id.indexOf(":") + 1)
          : edicaoLancamento.fornecedorId;

        await editarLancamento(acao.item.id, {
          data: edicaoLancamento.dataEmissao || null,
          data_emissao: edicaoLancamento.dataEmissao || null,
          data_vencimento: edicaoLancamento.dataVencimento || null,
          ...camposDocumento,
          descricao: edicaoLancamento.descricao.trim(),
          fornecedor: edicaoLancamento.fornecedor || null,
          fornecedor_id: fornecedorIdPersistido || null,
          categoria: edicaoLancamento.categoria || null,
          categoria_id: edicaoLancamento.categoriaId || null,
          status: edicaoLancamento.status,
          tipo_rateio: edicaoLancamento.tipoRateio || null,
          valor_centavos: parseValorReais(edicaoLancamento.valorTotal),
          valor_pago_centavos: parseValorReais(edicaoLancamento.valorPago),
          pago_por: edicaoLancamento.pagoPor || null,
          observacoes: edicaoLancamento.observacoes || null,
          rateios: [...rateiosEditados, ...rateiosSemCotistaCorrespondente],
        });
        avisarAtualizacaoFinanceiro();
      }
      if (acao.tipo === "excluir") {
        await excluirLancamento(acao.item.id);
      }
      toast.success(acao.tipo === "editar" ? "Lançamento atualizado." : "Despesa excluída.");
      setAcao(null);
      setEdicaoLancamento(null);
      await aoAtualizar();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível concluir a operação.";
      setErroAcao(mensagem);
      toast.error(mensagem);
    } finally {
      processandoRef.current = false;
      setProcessando(false);
    }
  };

  const mesReferencia = mesesSelecionados[mesesSelecionados.length - 1] || mesAtualLocal();
  const alternarMes = (mes: string) =>
    aoAlterarMeses(
      mesesSelecionados.includes(mes)
        ? mesesSelecionados.filter((item) => item !== mes)
        : [...mesesSelecionados, mes],
    );
  const selecionarMesUnico = (mes: string) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) aoAlterarMeses([mes]);
  };

  const filtrosAtivos =
    Number(filtroStatus !== "todos") +
    Number(filtroCategoria !== "todas") +
    Number(filtroDoc !== "todos") +
    Number(modoData !== "emissao");

  return (
    <section className="cotista-ledger-shell !mt-[1px]" aria-label="Lançamentos mensais">
      {/* Cabeçalho com totais gerais */}
      <header className="cotista-ledger-header">
        <div className="cotista-ledger-title">
          <h2>Lançamentos mensais</h2>
        </div>
        <div className="cotista-ledger-kpis">
          <div className="cotista-kpi-item">
            <span>Lançado</span>
            <strong>{carregando ? "—" : formatarCentavos(totalLancado)}</strong>
          </div>
          <div className="cotista-kpi-item">
            <span>Pago</span>
            <strong className="text-emerald-400">
              {carregando ? "—" : formatarCentavos(totalPago)}
            </strong>
          </div>
          <div className="cotista-kpi-item">
            <span>Em aberto</span>
            <strong className="text-amber-400">
              {carregando ? "—" : formatarCentavos(totalAberto)}
            </strong>
          </div>
          {temFiltros && (
            <div className="cotista-kpi-item">
              <span>Total filtrado</span>
              <strong className="text-sky-400">
                {carregando ? "—" : formatarCentavos(totalFiltrado)}
              </strong>
            </div>
          )}
        </div>
      </header>

      {/* Toolbar estilo grade corporativa (Busca + Ações + Show/Hide Columns + Exportar + Paginação no topo) */}
      <div className="cotista-toolbar" role="group" aria-label="Controles dos lançamentos">
        <div className="cotista-toolbar-left">
          <div className="cotista-search-box">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição, doc, cotista..."
              aria-label="Buscar nos lançamentos"
            />
          </div>

          <button type="button" className="cotista-btn cotista-btn-primary" onClick={aoNovo}>
            <Plus size={15} aria-hidden="true" />
            Novo lançamento
          </button>

          <button
            type="button"
            className="cotista-btn"
            aria-expanded={filtrosAbertos}
            onClick={() => setFiltrosAbertos((v) => !v)}
          >
            <Filter size={14} aria-hidden="true" />
            Filtros
            {filtrosAtivos > 0 && <span className="cotista-badge-count">{filtrosAtivos}</span>}
          </button>

          {/* Show / Hide columns com ícones de olho igual à referência */}
          <div ref={colunasAnchorRef} className="cotista-columns-anchor">
            <button
              type="button"
              className="cotista-btn"
              aria-expanded={menuColunasAberto}
              onClick={() => setMenuColunasAberto((v) => !v)}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Exibir/Ocultar colunas
            </button>

            {menuColunasAberto && (
              <div className="cotista-columns-popover" role="listbox" aria-label="Colunas da tabela">
                {colunas.map((coluna) => {
                  const visivel = !ocultas.has(coluna.id);
                  return (
                    <button
                      key={coluna.id}
                      type="button"
                      role="option"
                      aria-selected={visivel}
                      data-visible={visivel}
                      disabled={visivel && colunasVisiveis.length === 1}
                      onClick={() => alternarColunaOculta(coluna.id)}
                      className="cotista-columns-item"
                    >
                      <span className="truncate">
                        {coluna.titulo}
                        {coluna.cotista ? " (Cotista)" : ""}
                      </span>
                      {visivel ? (
                        <Eye size={14} className="shrink-0 text-primary" />
                      ) : (
                        <EyeOff size={14} className="shrink-0 text-slate-500" />
                      )}
                    </button>
                  );
                })}
                <div className="cotista-columns-footer">
                  <button
                    type="button"
                    className="cotista-btn h-7 px-2 text-[11px]"
                    onClick={() => {
                      setOcultas(new Set());
                      setLarguras({});
                    }}
                  >
                    <RotateCcw size={12} /> Restaurar padrão
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="cotista-period-group">
            <SeletorMesesCotista
              mesesSelecionados={mesesSelecionados}
              aoAlternar={alternarMes}
              aoSelecionarMesAtual={() => aoSelecionarMes(mesAtualLocal())}
            />
            <button
              type="button"
              className="cotista-btn cotista-btn-icon"
              aria-label="Mês anterior"
              onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, -1))}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="cotista-period-label" aria-live="polite">
              {mesesSelecionados.length === 1
                ? rotuloMesCotista(mesReferencia)
                : `${mesesSelecionados.length} meses`}
            </span>
            <button
              type="button"
              className="cotista-btn cotista-btn-icon"
              aria-label="Próximo mês"
              onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="cotista-toolbar-right">
          {/* Paginação compacta no topo direito */}
          <div className="cotista-top-pagination">
            <span>
              Mostrando{" "}
              <strong className="text-slate-200">
                {filtradas.length ? inicioPagina + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-slate-200">
                {Math.min(inicioPagina + porPagina, filtradas.length)}
              </strong>{" "}
              de <strong className="text-slate-200">{filtradas.length}</strong>
            </span>
            <div className="cotista-page-nav" role="navigation" aria-label="Paginação">
              <button
                type="button"
                disabled={carregando || paginaAtual === 1}
                aria-label="Primeira página"
                onClick={() => setPagina(1)}
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                disabled={carregando || paginaAtual === 1}
                aria-label="Página anterior"
                onClick={() => setPagina(paginaAtual - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={carregando || paginaAtual === totalPaginas}
                aria-label="Próxima página"
                onClick={() => setPagina(paginaAtual + 1)}
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={carregando || paginaAtual === totalPaginas}
                aria-label="Última página"
                onClick={() => setPagina(totalPaginas)}
              >
                <ChevronsRight size={14} />
              </button>
            </div>
            <select
              aria-label="Registros por página"
              value={porPagina}
              onChange={(e) => setPorPagina(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((qtd) => (
                <option key={qtd} value={qtd}>
                  {qtd}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Painel de filtros avançados */}
      {filtrosAbertos && (
        <div className="cotista-filter-bar">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Exibição de Data</Label>
            <Select
              value={modoData}
              onValueChange={(v) => setModoData(v as typeof modoData)}
            >
              <SelectTrigger className="h-8 border-input bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                <SelectItem value="emissao">Emissão</SelectItem>
                <SelectItem value="vencimento">Vencimento</SelectItem>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="todos">Todas as datas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 border-input bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_LANCAMENTO.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="h-8 border-input bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64 border-border bg-popover text-popover-foreground">
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Tipo de Documento</Label>
            <Select value={filtroDoc} onValueChange={setFiltroDoc}>
              <SelectTrigger className="h-8 border-input bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                <SelectItem value="todos">Todos os documentos</SelectItem>
                {TIPOS_DOCUMENTO_COTISTA.map((doc) => (
                  <SelectItem key={doc.valor} value={doc.valor}>
                    {doc.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {temFiltros && (
            <button type="button" className="cotista-btn h-8 text-xs" onClick={limparFiltros}>
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Barra de seleção múltipla */}
      {itensSelecionados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-x border-border bg-primary/10 px-4 py-2 text-xs text-foreground">
          <span>
            <strong>{itensSelecionados.length}</strong> selecionado(s) · Soma:{" "}
            <strong className="font-mono">{formatarCentavos(totalSelecionado)}</strong>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sky-300 hover:underline"
            onClick={() => setSelecionados(new Set())}
          >
            <X size={12} /> Limpar seleção
          </button>
        </div>
      )}

      {/* Grade de dados principal */}
      <div
        ref={scrollRef}
        data-dragging={arrastando}
        className="cotista-table-viewport"
        role="region"
        aria-label="Tabela de lançamentos mensais"
        tabIndex={0}
        onPointerDown={iniciarArraste}
        onClickCapture={(evento) => {
          if (bloquearCliqueRef.current && evento.detail > 0) {
            evento.preventDefault();
            evento.stopPropagation();
            bloquearCliqueRef.current = false;
          }
        }}
      >
        <table className="cotista-grid-table" style={{ width: larguraTabela }}>
          <colgroup>
            <col style={{ width: 96 }} />
            {colunasVisiveis.map((coluna) => (
              <col key={coluna.id} style={{ width: larguras[coluna.id] ?? coluna.largura }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="cotista-sticky-left">
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={todosDaPaginaSelecionados}
                    disabled={carregando || !itensDaPagina.length}
                    aria-label="Selecionar todos desta página"
                    onChange={alternarSelecaoDaPagina}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </div>
              </th>
              {colunasVisiveis.map((coluna) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className={`${coluna.cotista ? "is-cotista-col" : ""} ${
                    coluna.primeiraCotista ? "is-cotista-first" : ""
                  }`}
                  aria-sort={
                    coluna.valor
                      ? ordenacao.coluna === coluna.id
                        ? ordenacao.direcao === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  <div className="cotista-th-inner">
                    {coluna.valor ? (
                      <button
                        type="button"
                        className="cotista-sort-btn"
                        data-active={ordenacao.coluna === coluna.id}
                        onClick={() => ordenarPor(coluna.id)}
                      >
                        <span className="cotista-th-title">
                          <span>{coluna.titulo}</span>
                          {coluna.subtitulo && <small>{coluna.subtitulo}</small>}
                        </span>
                        {ordenacao.coluna !== coluna.id ? (
                          <ChevronsUpDown size={12} className="shrink-0 text-slate-400" />
                        ) : ordenacao.direcao === "asc" ? (
                          <ChevronUp size={12} className="shrink-0 text-primary" />
                        ) : (
                          <ChevronDown size={12} className="shrink-0 text-primary" />
                        )}
                      </button>
                    ) : (
                      <span>{coluna.titulo}</span>
                    )}
                  </div>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="cotista-resizer"
                    onPointerDown={(e) => iniciarRedimensionamento(coluna.id, coluna.minimo, e)}
                    onDoubleClick={() =>
                      setLarguras((atual) => ({ ...atual, [coluna.id]: coluna.largura }))
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>

          {carregando ? (
            <tbody>
              <tr>
                <td colSpan={quantidadeColunas} className="px-4 py-10 text-center text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Carregando lançamentos…
                  </span>
                </td>
              </tr>
            </tbody>
          ) : gruposDaPagina.length ? (
            gruposDaPagina.map(({ mes, itens }) => (
              <tbody key={mes}>
                {(mesesSelecionados.length > 1 || ordenarDataPor === "vencimento") && (
                  <tr className="cotista-month-divider">
                    <th scope="rowgroup" colSpan={quantidadeColunas}>
                      <div className="flex items-center justify-between">
                        <span className="capitalize">
                          {rotuloMesCotista(mes)} ({itens.length})
                        </span>
                        <span className="font-mono text-xs text-slate-300">
                          Subtotal:{" "}
                          {formatarCentavos(itens.reduce((t, i) => t + i.valorCentavos, 0))}
                        </span>
                      </div>
                    </th>
                  </tr>
                )}
                {itens.map((item) => {
                  const aberto = expandidos.has(item.id);
                  const selecionado = selecionados.has(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className="cotista-row"
                        data-expanded={aberto}
                        data-selected={selecionado}
                      >
                        <td className="cotista-sticky-left">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              aria-label={aberto ? "Recolher detalhes" : "Expandir detalhes"}
                              aria-expanded={aberto}
                              onClick={() => alternarExpandido(item.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700/60 hover:text-white"
                            >
                              <ChevronRight
                                size={14}
                                className={`transition-transform ${aberto ? "rotate-90" : ""}`}
                              />
                            </button>
                            <input
                              type="checkbox"
                              checked={selecionado}
                              aria-label={`Selecionar ${item.descricao}`}
                              onChange={() => alternarSelecao(item.id)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => abrirAcao("editar", item)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700/60 hover:text-white"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        </td>
                        {colunasVisiveis.map((coluna) => (
                          <td
                            key={coluna.id}
                            className={`${coluna.cotista ? "is-cotista-col" : ""} ${
                              coluna.primeiraCotista ? "is-cotista-first" : ""
                            }`}
                          >
                            {coluna.render(item)}
                          </td>
                        ))}
                      </tr>
                      {aberto && (
                        <tr>
                          <td colSpan={quantidadeColunas} className="p-0">
                            <LancamentoExpandido
                              lancamento={item}
                              cotistasAeronave={cotistasAeronave}
                              fornecedoresEdicao={fornecedoresEdicao}
                              aoAbrirDocumento={(nome, url) => setDocumentoAberto({ nome, url })}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            ))
          ) : (
            <tbody>
              <tr>
                <td colSpan={quantidadeColunas} className="px-4 py-12 text-center text-slate-400">
                  Nenhum lançamento encontrado para os filtros aplicados.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {/* Rodapé consolidado com resumo de cada cliente/cotista no final */}
      <footer className="cotista-summary-footer">
        <div className="flex flex-wrap items-center gap-3 text-slate-300">
          <span>
            Total listado (<strong>{filtradas.length}</strong> itens):{" "}
            <strong className="font-mono text-white">{formatarCentavos(totalFiltrado)}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400">
            Rateio por Cotista:
          </span>
        </div>

        <div className="cotista-summary-cotistas">
          {resumoPorCotista.map((c) => (
            <div key={c.id} className="cotista-summary-chip">
              <span className="font-medium text-slate-200">
                {c.nome} ({Number(c.percentualSociedade).toLocaleString("pt-BR")}%)
              </span>
              <strong>{formatarCentavos(c.totalRateado)}</strong>
              {c.totalPagoDireto > 0 && (
                <span className="text-[10.5px] text-emerald-400">
                  · Pago: {formatarCentavos(c.totalPagoDireto)}
                </span>
              )}
            </div>
          ))}
        </div>
      </footer>

      {/* Modal de Baixa */}
      <DarBaixaCotistaDialog
        lancamento={baixaSelecionada?.reembolsavel ? null : baixaSelecionada}
        onFechar={() => setBaixaSelecionada(null)}
        onConcluido={async () => {
          await aoAtualizar();
          toast.success("Pagamento registrado.");
        }}
      />

      {/* Modal de Edição / Exclusão */}
      <Dialog
        open={Boolean(acao)}
        onOpenChange={(open) => {
          if (!open && !processandoRef.current) {
            setAcao(null);
            setEdicaoLancamento(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border-border bg-background p-6 text-foreground">
          <DialogHeader>
            <DialogTitle>
              {acao?.tipo === "editar" ? "Editar lançamento" : "Excluir despesa?"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {acao?.tipo === "editar"
                ? "Atualize os dados do lançamento e os valores rateados por cotista."
                : "A despesa será removida do fluxo financeiro. Confirme para continuar."}
            </DialogDescription>
          </DialogHeader>

          {acao && (
            <div className="space-y-4">
              {acao.tipo === "editar" && edicaoLancamento ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!acao.item.reembolsavel &&
                      ![
                        "PAGO",
                        "PAGO_DIRETAMENTE",
                        "REEMBOLSADO",
                        "CANCELADO",
                        "ESTORNO",
                      ].includes(normalizarStatus(acao.item.status)) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const alvo = acao.item;
                            setAcao(null);
                            setEdicaoLancamento(null);
                            setBaixaSelecionada(alvo);
                          }}
                        >
                          <Coins size={14} className="mr-1.5" /> Dar baixa
                        </Button>
                      )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setAcao({ tipo: "excluir", item: acao.item })}
                    >
                      <Trash2 size={14} className="mr-1.5" /> Excluir
                    </Button>
                  </div>

                  <section className="space-y-3">
                    <h3 className="border-b border-slate-800 pb-2 text-sm font-semibold">
                      Dados do lançamento
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Data de emissão</Label>
                        <Input
                          type="date"
                          value={edicaoLancamento.dataEmissao}
                          onChange={(e) => atualizarEdicao("dataEmissao", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Data de vencimento</Label>
                        <Input
                          type="date"
                          value={edicaoLancamento.dataVencimento}
                          onChange={(e) => atualizarEdicao("dataVencimento", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número do documento</Label>
                        <Input
                          value={edicaoLancamento.documentoNumero}
                          onChange={(e) => atualizarEdicao("documentoNumero", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-3">
                        <Label>Favorecido</Label>
                        <SearchableCombobox
                          items={fornecedoresEdicao}
                          value={
                            fornecedoresEdicao.find(
                              (f) =>
                                f.id === edicaoLancamento.fornecedorId ||
                                f.id.endsWith(`:${edicaoLancamento.fornecedorId}`),
                            )?.id || edicaoLancamento.fornecedor
                          }
                          onChange={(id, label) => {
                            const cadastrado = fornecedoresEdicao.some((f) => f.id === id);
                            atualizarEdicao("fornecedorId", cadastrado ? id : "");
                            atualizarEdicao("fornecedor", label);
                          }}
                          placeholder="Selecione ou digite o favorecido"
                          searchPlaceholder="Buscar fornecedor..."
                          emptyMessage="Nenhum fornecedor encontrado."
                          allowFreeText
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-3">
                        <Label>Descrição</Label>
                        <Textarea
                          rows={3}
                          value={edicaoLancamento.descricao}
                          onChange={(e) => atualizarEdicao("descricao", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Categoria</Label>
                        <SearchableCombobox
                          items={categoriasClienteEdicao}
                          value={
                            categoriasClienteEdicao.some(
                              (c) => c.id === edicaoLancamento.categoriaId,
                            )
                              ? edicaoLancamento.categoriaId
                              : edicaoLancamento.categoria
                          }
                          onChange={(id, label) => {
                            const cadastrada = categoriasClienteEdicao.some((c) => c.id === id);
                            atualizarEdicao("categoriaId", cadastrada ? id : "");
                            atualizarEdicao("categoria", label);
                          }}
                          placeholder="Categoria"
                          searchPlaceholder="Buscar categoria..."
                          emptyMessage="Nenhuma categoria encontrada."
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Situação</Label>
                        <Select
                          value={edicaoLancamento.status}
                          onValueChange={(v) => atualizarEdicao("status", v)}
                          disabled={processando}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_LANCAMENTO.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tipo de rateio</Label>
                        <SearchableCombobox
                          items={TIPOS_RATEIO_EDICAO}
                          value={edicaoLancamento.tipoRateio}
                          onChange={(v) => atualizarEdicao("tipoRateio", v)}
                          placeholder="Tipo de rateio"
                          searchPlaceholder="Buscar..."
                          emptyMessage="Nenhum tipo."
                          disabled={processando}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="border-b border-slate-800 pb-2 text-sm font-semibold">
                      Valores e pagador
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Valor total (R$)</Label>
                        <Input
                          inputMode="decimal"
                          value={edicaoLancamento.valorTotal}
                          onChange={(e) => atualizarEdicao("valorTotal", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor pago (R$)</Label>
                        <Input
                          inputMode="decimal"
                          value={edicaoLancamento.valorPago}
                          onChange={(e) => atualizarEdicao("valorPago", e.target.value)}
                          disabled={processando}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pago por</Label>
                        <Select
                          value={edicaoLancamento.pagoPor || "__nenhum__"}
                          onValueChange={(v) =>
                            atualizarEdicao("pagoPor", v === "__nenhum__" ? "" : v)
                          }
                          disabled={processando}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__nenhum__">Não informado</SelectItem>
                            {cotistasAeronave.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="border-b border-slate-800 pb-2 text-sm font-semibold">
                      Rateio por cotista
                    </h3>
                    <div className="space-y-2.5">
                      {cotistasAeronave.map((cotista) => {
                        const rateio = edicaoLancamento.rateios[cotista.id] || {
                          percentual: "",
                          valor: "",
                          pagoPor: "",
                        };
                        return (
                          <div
                            key={cotista.id}
                            className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3"
                          >
                            <div className="space-y-1">
                              <Label className="text-xs">{cotista.nome} (%)</Label>
                              <Input
                                inputMode="decimal"
                                value={rateio.percentual}
                                onChange={(e) =>
                                  atualizarRateioEdicao(cotista.id, "percentual", e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor rateado (R$)</Label>
                              <Input
                                inputMode="decimal"
                                value={rateio.valor}
                                onChange={(e) =>
                                  atualizarRateioEdicao(cotista.id, "valor", e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Pago por</Label>
                              <Select
                                value={rateio.pagoPor || "__nenhum__"}
                                onValueChange={(v) =>
                                  atualizarRateioEdicao(
                                    cotista.id,
                                    "pagoPor",
                                    v === "__nenhum__" ? "" : v,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Não informado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__nenhum__">Não informado</SelectItem>
                                  {cotistasAeronave.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      rows={2}
                      value={edicaoLancamento.observacoes}
                      onChange={(e) => atualizarEdicao("observacoes", e.target.value)}
                      disabled={processando}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm">{acao.item.descricao}</p>
                  <p className="mt-2 font-mono text-lg font-semibold">
                    {formatarCentavos(acao.item.valorCentavos)}
                  </p>
                </div>
              )}

              {erroAcao && <p className="text-xs text-rose-400">{erroAcao}</p>}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={processando}
              onClick={() => {
                setAcao(null);
                setEdicaoLancamento(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={acao?.tipo === "excluir" ? "destructive" : "default"}
              disabled={processando}
              onClick={() => void confirmarAcao()}
            >
              {processando && <Loader2 size={14} className="mr-2 animate-spin" />}
              {acao?.tipo === "editar" ? "Salvar alterações" : "Excluir despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização de Anexo */}
      <Dialog open={Boolean(documentoAberto)} onOpenChange={(o) => !o && setDocumentoAberto(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-slate-800 px-5 py-4">
            <DialogTitle className="text-sm">{documentoAberto?.nome || "Documento"}</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Anexo vinculado ao lançamento selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[65dvh] min-h-[260px] items-center justify-center overflow-auto bg-card p-4">
            {documentoAberto &&
              (/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(documentoAberto.url) ? (
                <img
                  src={documentoAberto.url}
                  alt={documentoAberto.nome}
                  className="max-h-[60dvh] max-w-full rounded object-contain"
                />
              ) : (
                <iframe
                  title={documentoAberto.nome}
                  src={documentoAberto.url}
                  className="h-[60dvh] w-full rounded border border-slate-800 bg-white"
                />
              ))}
          </div>
          {documentoAberto && (
            <div className="border-t border-slate-800 px-5 py-3">
              <a
                href={documentoAberto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:underline"
              >
                <ExternalLink size={14} /> Abrir em outra aba
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
