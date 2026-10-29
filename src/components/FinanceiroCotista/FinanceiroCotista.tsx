import { DarBaixaCotistaDialog } from "./DarBaixaCotistaDialog";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  CircleAlert,
  Loader2,
  Plus,
  X,
  Building2,
  User,
  Plane,
  BarChart3,
  ReceiptText,
  ListOrdered,
  LayoutDashboard,
  PieChart,
  Fuel,
  Landmark,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Coins,
  Gauge,
  Eye,
  MoreHorizontal,
  Search,
  ExternalLink,
  KeyRound,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  criarLancamentoEconomico,
  parseValorReais,
  buscarOpcoesLancamento,
  buscarDashboardCotista,
  formatarMoeda,
  formatarCentavos,
  formatarData,
  editarLancamento,
  excluirLancamento,
} from "@/lib/financeiro-share-api";
import type {
  OpcoesLancamento,
  DashboardCotista,
  LancamentoEconomico,
} from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { allocateCentavos } from "@/lib/money";
import {
  buscarAeronavesShare,
  buscarCotistasAeronave,
  atualizarParticipacaoCotista,
  excluirParticipacaoCotista,
} from "@/lib/colaborador-api";
import { MediasCotista } from "./MediasCotista";
import { PortalClienteTab } from "./PortalClienteTab";
import { FechamentoBalancoDashboardCotista } from "./FechamentoBalancoDashboardCotista";
import {
  agruparPorMes,
  mesAtualLocal,
  periodoDoMes,
  rotuloMesCotista,
  type PeriodoCotista,
} from "@/lib/financeiro-cotista-periodo";


/* Estilos locais: não alteram o tema das demais abas do financeiro.
 * Mantém os componentes e APIs; tabela com seleção, data, descrição, valor, status e ações.
 */
const DESPESAS_ESTILOS = `
/* Escopo local: superfícies opacas e uma única definição do grid. */
.financeiro-profissional, .despesas-theme {
  --background: 228 38% 5%; --foreground: 214 25% 92%;
  --card: 222 51% 9%; --card-foreground: 214 25% 92%;
  --popover: 222 45% 11%; --popover-foreground: 214 25% 92%;
  --muted: 222 40% 12%; --muted-foreground: 215 17% 66%;
  --border: 218 22% 18%; --input: 218 22% 26%;
  --primary: 200 80% 62%; --primary-foreground: 0 0% 100%;
  --accent: 217 35% 15%; --accent-foreground: 214 25% 92%;
  --ring: 200 80% 62%; --destructive: 0 75% 70%;
  color: hsl(var(--foreground)); color-scheme: dark;
  font-family: inherit; font-size: 13px; line-height: 1.5;
}
.financeiro-profissional.financeiro-shell {
  width:100%; min-width:0; max-width:100%; padding:0;
  background:rgba(8,10,18,0); filter:none; backdrop-filter:none;
  -webkit-backdrop-filter:none; box-shadow:none; animation:none; transform:none;
}
.financeiro-profissional *, .despesas-theme * { box-sizing:border-box; }
.financeiro-profissional .financeiro-panel,
.financeiro-profissional .financeiro-header,
.financeiro-profissional .financeiro-tabs,
.despesas-theme .despesa-ledger, .despesa-dialog {
  background:hsl(var(--card)); border:1px solid hsl(var(--border));
  border-radius:5px; box-shadow:none; filter:none; backdrop-filter:none;
  -webkit-backdrop-filter:none; background-image:none;
}
.financeiro-profissional .financeiro-header { padding:16px; }
.financeiro-profissional .financeiro-header h2 { margin:0; font-size:20px; font-weight:600; letter-spacing:-.02em; }
.financeiro-profissional .financeiro-panel-header { display:flex; align-items:center; justify-content:flex-start; gap:10px; padding:16px; border-bottom:1px solid hsl(var(--border)); text-align:left; }
.financeiro-profissional .financeiro-panel-header > div { min-width:0; }
.financeiro-profissional .financeiro-tabs { padding:0 8px; gap:4px; }
.financeiro-profissional .financeiro-tabs button { border-radius:7px; padding:12px; font-size:12px; font-weight:500; box-shadow:none; background:transparent; }
.financeiro-profissional .financeiro-tabs button[aria-selected="true"] { background:#057baf; color:#fff; }
.financeiro-profissional :is(input,button,[role="combobox"]) { box-shadow:none; }
.financeiro-profissional :is(input,[role="combobox"]) { border-radius:4px; background:hsl(var(--card)); }
.despesas-shell { min-width:0; width:100%; }
.despesas-theme .text-muted-foreground { color:hsl(var(--muted-foreground)); }
.despesas-theme .text-foreground { color:hsl(var(--foreground)); }
.despesas-theme .text-primary { color:hsl(var(--primary)); }
.despesas-theme .border-border { border-color:hsl(var(--border)); }
.despesas-theme .bg-background { background:hsl(var(--background)); }
.despesas-theme .bg-card { background:hsl(var(--card)); }
.despesas-theme :is(input,textarea,[role="combobox"]) { border-color:hsl(var(--input)); background:hsl(var(--card)); color:hsl(var(--foreground)); border-radius:4px; box-shadow:none; }
.despesas-theme :is(input,textarea)::placeholder { color:hsl(var(--muted-foreground)); }
.despesas-theme :focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:2px; }
.despesas-theme .despesa-primary { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border:1px solid hsl(var(--primary)); border-radius:4px; font-weight:600; box-shadow:none; }
.despesas-theme .despesa-primary:hover { filter:brightness(.94); }
.despesa-ledger { min-width:0; overflow:hidden; }
.despesa-heading { padding:12px 16px; background:hsl(var(--card)); }
.despesa-heading h3 { font-size:14px; font-weight:600; color:hsl(var(--foreground)); }
.despesa-toolbar { padding:12px 16px; background:hsl(var(--card)); }
.despesa-toolbar-main { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.despesa-toolbar input { height:36px; font-size:13px; }
.despesa-control { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:36px; padding:0 12px; border:1px solid hsl(var(--input)); border-radius:4px; background:hsl(var(--card)); color:hsl(var(--foreground)); font-size:12px; white-space:nowrap; }
.despesa-control:hover,.despesa-control[aria-expanded="true"] { background:hsl(var(--muted)); }
.despesa-filter-count { font-size:11px; font-weight:600; }
.despesa-filter-panel { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; padding-top:12px; margin-top:12px; border-top:1px solid hsl(var(--border)); }
.despesa-table-scroll { width:100%; max-width:100%; overflow:auto; max-height:68vh; max-height:68dvh; overscroll-behavior:contain; scrollbar-color:#3c4b5d #10151a; scrollbar-width:auto; border:1px solid #27313b; border-radius:5px 5px 3px 3px; }
.despesa-table { width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; font-size:13px; text-align:left; color:#e7edf6; }
.despesa-table th,.despesa-table td { box-sizing:border-box; }
.despesa-table > thead > tr > th { position:sticky; top:0; z-index:3; height:32px; padding:0 16px; background:#161e25; border-bottom:1px solid #27313b; border-right:1px solid #27313b88; color:#c5d5ea; font-size:10px; line-height:1.5; font-weight:700; letter-spacing:.9px; text-transform:uppercase; vertical-align:middle; overflow-wrap:break-word; }
.despesa-table > thead > tr > th:last-child { border-right:0; }
.despesa-table .despesa-row { --row-bg:#11171c66; background:var(--row-bg); }
.despesa-table .despesa-row:nth-child(even) { --row-bg:#151c2255; }
.despesa-table .despesa-row:hover { --row-bg:#202a3488; }
.despesa-table .despesa-row[data-expanded="true"],.despesa-table .despesa-row[data-selected="true"] { --row-bg:#27313c88; }
.despesa-table .despesa-row { height:39px; }
.despesa-table .despesa-row td { padding:3px 16px; background:var(--row-bg); vertical-align:middle; border-bottom:1px solid #27313b99; border-right:1px solid #27313b77; overflow-wrap:break-word; }
.despesa-table .despesa-row td:last-child { border-right:0; }
.despesa-table > thead > tr > th:first-child,.despesa-table .despesa-row td:first-child { padding:8px; text-align:center; }
.despesa-table .despesa-row td:last-child { padding:8px; }
.despesa-table .despesa-month th { padding:10px 16px; background:#161e25; border-bottom:1px solid #27313b; text-align:left; }
.despesa-col-resizer { position:absolute; top:0; right:-4px; width:8px; height:100%; cursor:col-resize; touch-action:none; z-index:5; }
.despesa-col-resizer:hover,.despesa-col-resizer:active { background:hsl(var(--primary) / 0.35); }
.despesa-row .despesa-line-supplier { margin:0; font-size:12px; line-height:1.5; font-weight:600; overflow-wrap:break-word; }
.despesa-row .despesa-line-description { margin:4px 0 0; font-size:12px; line-height:1.5; font-weight:400; color:#a6b5c9; overflow-wrap:break-word; }
.despesa-row .despesa-money,.despesa-rateio-value { font-family:inherit; font-size:12px; line-height:1.5; font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; overflow-wrap:normal; }
.despesa-rateio-cell { display:flex; flex-direction:column; align-items:flex-end; gap:4px; white-space:nowrap; font-size:12px; font-variant-numeric:tabular-nums; }
.despesa-cotista-heading { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.despesa-cotista-heading small { font-size:11px; font-weight:400; }
.despesa-date { margin:0; white-space:nowrap; font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; }
.despesa-date-caption { margin:4px 0 0; color:hsl(var(--muted-foreground)); font-size:11px; line-height:1.4; overflow-wrap:anywhere; }
.despesa-category { margin:0; font-size:11px; color:#a6b5c9; line-height:1.5; }
.despesa-sort-date { display:flex; width:100%; align-items:center; justify-content:space-between; gap:4px; font:inherit; text-align:left; }
.despesas-theme .despesa-checkbox { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; min-width:16px; padding:0; border:1px solid hsl(var(--input)); border-radius:3px; background:hsl(var(--card)); color:hsl(var(--primary-foreground)); box-shadow:none; }
.despesas-theme .despesa-checkbox[data-state="checked"],.despesas-theme .despesa-checkbox[data-state="indeterminate"] { background:hsl(var(--primary)); border-color:hsl(var(--primary)); }
.despesa-checkbox svg { width:12px; height:12px; }
.despesa-checkbox[data-state="indeterminate"] svg { display:none; }
.despesa-checkbox[data-state="indeterminate"]::after { content:""; width:8px; height:2px; background:currentColor; }
.despesas-theme .despesa-status { display:inline-flex; align-items:center; gap:5px; max-width:100%; padding:3px 6px; border:1px solid hsl(var(--border)); border-radius:4px; white-space:normal; font-size:11px; line-height:1.4; font-weight:500; background:hsl(var(--muted)); color:hsl(var(--foreground)); }
.despesa-pagination { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-top:1px solid hsl(var(--border)); background:hsl(var(--card)); font-size:12px; color:hsl(var(--muted-foreground)); }
.despesa-pagination button { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid hsl(var(--border)); border-radius:4px; background:hsl(var(--card)); color:hsl(var(--foreground)); }
.despesa-pagination button[aria-current="page"] { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); }
.despesa-pagination button:disabled { opacity:.4; cursor:not-allowed; }
.despesa-detail { padding:20px; background:hsl(var(--muted)); border-bottom:1px solid hsl(var(--border)); }
.despesa-detail-title { margin:0 0 12px; font-size:12px; font-weight:600; color:hsl(var(--foreground)); }
.despesa-detail-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; }
.despesa-detail :is(dt,dd) { font-size:12px; }
.despesa-detail dd { overflow-wrap:break-word; }
.despesa-supplier { margin:0 0 16px; }
.despesa-supplier dd { margin:0; font-weight:500; }
.despesa-documents { display:flex; flex-direction:column; align-items:flex-start; gap:10px; }
.despesa-document { display:inline-flex; align-items:center; gap:8px; padding:8px 10px; max-width:100%; border:1px solid hsl(var(--input)); border-radius:4px; background:hsl(var(--card)); color:hsl(var(--primary)); font-size:12px; text-align:left; }
.despesa-document:hover { background:hsl(var(--accent)); }
.despesa-dialog { background:hsl(var(--card)); border-color:hsl(var(--border)); }
@media(max-width:640px) {
  .despesa-toolbar-main { flex-wrap:wrap; }
  .despesa-toolbar-main > div:first-child { flex-basis:100%; }
  .despesa-filter-panel { grid-template-columns:1fr; }
  .despesa-table-scroll { max-height:65dvh; }
}
@media(prefers-reduced-motion:reduce) { .despesas-theme * { transition:none!important; } }
.despesas-theme .despesa-status[data-status="EM_ABERTO"] { color: #965000; background: #fff4cc; border-color: #ffc328; }
.dark .despesas-theme .despesa-status[data-status="EM_ABERTO"] { color: #ffd36c; background: #352e20; border-color: #62502c; }
.despesas-theme .despesa-status[data-status="PAGO"] { color: #006950; background: #d2fae7; border-color: #56c999; }
.dark .despesas-theme .despesa-status[data-status="PAGO"] { color: #5ce0bf; background: #113b39; border-color: #206052; }
.despesas-theme .despesa-status[data-status="PAGO_DIRETAMENTE"] { color: #0e7490; background: #cffafe; border-color: #67cde0; }
.dark .despesas-theme .despesa-status[data-status="PAGO_DIRETAMENTE"] { color: #67e8f9; background: #12343e; border-color: #236373; }
.despesas-theme .despesa-status[data-status="EM_ATRASO"] { color: #b91c1c; background: #fef2f2; border-color: #fca5a5; }
.dark .despesas-theme .despesa-status[data-status="EM_ATRASO"] { color: #ffaaa8; background: #3c252e; border-color: #75404b; }
.despesas-theme .despesa-status[data-status="ESTORNO"] { color: #9a3412; background: #ffedd5; border-color: #fdba74; }
.dark .despesas-theme .despesa-status[data-status="ESTORNO"] { color: #fdba74; background: #3b2b20; border-color: #80532d; }
.despesas-theme .despesa-status[data-status="SAIDA"] { color: #475569; background: #f1f5f9; border-color: #cbd5e1; }
.dark .despesas-theme .despesa-status[data-status="SAIDA"] { color: #c0cada; background: #283246; border-color: #475570; }
.despesas-theme .despesa-status[data-status="AGUARDANDO_REEMBOLSO"] { color: #6d28d9; background: #ede9fe; border-color: #c4b5fd; }
.dark .despesas-theme .despesa-status[data-status="AGUARDANDO_REEMBOLSO"] { color: #c4b5fd; background: #302346; border-color: #654793; }
.despesas-theme .despesa-status[data-status="REEMBOLSADO"] { color: #174cc6; background: #deebff; border-color: #90baff; }
.dark .despesas-theme .despesa-status[data-status="REEMBOLSADO"] { color: #93c5fd; background: #1b3155; border-color: #355787; }
.despesas-theme .despesa-status[data-status="CANCELADO"] { color: #52525b; background: #f4f4f5; border-color: #d4d4d8; }
.dark .despesas-theme .despesa-status[data-status="CANCELADO"] { color: #b3b3bf; background: #292a31; border-color: #50515b; }

`;

function deslocarMes(competencia: string, deslocamento: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + deslocamento, 1, 12);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function hoje() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

type RateioDraft = { cotista: string; percentual: string };

function percentualNumerico(valor: string) {
  const normalizado = valor.trim().replace(",", ".");
  return normalizado ? Number(normalizado) : NaN;
}

function dividirPorSociedade(ids: string[], cotistas: CotistaAeronave[]): RateioDraft[] {
  if (!ids.length) return [{ cotista: "", percentual: "100" }];
  const pesos = ids.map((id) => Number(cotistas.find((c) => c.id === id)?.percentual_sociedade || 0));
  const soma = pesos.reduce((total, peso) => total + peso, 0);
  if (soma <= 0) return dividirPercentuais(ids);
  return ids.map((cotista, index) => ({ cotista, percentual: String((pesos[index] / soma) * 100) }));
}

function dividirPercentuais(ids: string[]): RateioDraft[] {
  if (!ids.length) return [{ cotista: "", percentual: "100" }];
  const unidades = 1000000;
  const base = Math.floor(unidades / ids.length);
  const resto = unidades % ids.length;
  return ids.map((cotista, index) => ({
    cotista,
    percentual: ((base + (index < resto ? 1 : 0)) / 10000).toFixed(4),
  }));
}

type AeronaveOpcao = {
  id: string;
  matricula_registro: string;
  fabricante: string;
  modelo: string;
  url_imagem?: string | null;
};

export function NovoLancamentoCotistaDialog({
  aberto,
  aoFechar,
  opcoes,
  cotistasAeronave,
  aeronaveId,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  opcoes: OpcoesLancamento | null;
  cotistasAeronave: CotistaAeronave[];
  aeronaveId: string;
  aoCriar: () => Promise<void>;
}) {
  const cotistasCliente = useMemo(
    () => cotistasAeronave.filter((c) => !c.eh_holding),
    [cotistasAeronave],
  );
  const cotistasHolding = useMemo(
    () => cotistasAeronave.filter((c) => Boolean(c.eh_holding)),
    [cotistasAeronave],
  );
  const possuiCliente = cotistasCliente.length > 0;
  const possuiHolding = cotistasHolding.length > 0;
  const [modo, setModo] = useState<"CLIENTE" | "HOLDING">("CLIENTE");

  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([]);

  const [fluxoCliente, setFluxoCliente] = useState<"SAIDA" | "ENTRADA">(
    "SAIDA",
  );
  const [pagoPorCotista, setPagoPorCotista] = useState("");
  const [pagoDiretamenteCliente, setPagoDiretamenteCliente] = useState(false);

  const [tipoMovimentoHold, setTipoMovimentoHold] = useState<
    "APORTE" | "DESPESA"
  >("DESPESA");
  const [holdingId, setHoldingId] = useState("");
  const [pagoDiretamenteHold, setPagoDiretamenteHold] = useState(false);

  const inicializado = useRef<string | null>(null);
  const salvandoRef = useRef(false);

  useEffect(() => {
    if (!aberto) {
      inicializado.current = null;
      return;
    }
    if (
      !opcoes ||
      !cotistasAeronave.length ||
      inicializado.current === aeronaveId
    )
      return;
    inicializado.current = aeronaveId;
    const modoInicial = possuiCliente ? "CLIENTE" : "HOLDING";
    setModo(modoInicial);
    setErroLocal(null);
    setData(hoje());
    setDescricao("");
    setValor("");
    setObservacoes("");
    setFluxoCliente("SAIDA");
    setTipoMovimentoHold("DESPESA");
    setPagoDiretamenteCliente(false);
    setPagoDiretamenteHold(false);
    setCategoriaId(opcoes.categorias[0]?.id || "");
    setPagoPorCotista(cotistasCliente[0]?.id || "");
    setHoldingId(opcoes.holdings?.[0]?.id || "");
    setRateios(
      dividirPorSociedade(
        (modoInicial === "CLIENTE" ? cotistasCliente : cotistasHolding).map(
          (c) => c.id,
        ),
        cotistasAeronave,
      ),
    );
  }, [
    aberto,
    aeronaveId,
    opcoes,
    cotistasAeronave,
    cotistasCliente,
    cotistasHolding,
    possuiCliente,
  ]);

  const alterarModo = (proximo: "CLIENTE" | "HOLDING") => {
    if (proximo === modo) return;
    setModo(proximo);
    setErroLocal(null);
    setRateios(
      dividirPorSociedade(
        (proximo === "CLIENTE" ? cotistasCliente : cotistasHolding).map(
          (c) => c.id,
        ),
        cotistasAeronave,
      ),
    );
  };
  const totalPercentual = rateios.reduce(
    (total, r) => total + (percentualNumerico(r.percentual) || 0),
    0,
  );
  const totalCentavos = parseValorReais(valor);
  const pesosRateio = rateios.map((r) => percentualNumerico(r.percentual));
  const valorPreviewRateios =
    Number.isInteger(totalCentavos) &&
    totalCentavos > 0 &&
    pesosRateio.length > 0 &&
    pesosRateio.every((p) => Number.isFinite(p) && p >= 0) &&
    pesosRateio.some((p) => p > 0)
      ? allocateCentavos(totalCentavos, pesosRateio)
      : null;

  const salvar = async () => {
    if (salvandoRef.current) return;
    const categoria = opcoes?.categorias?.find((c) => c.id === categoriaId);
    const valorCentavos = parseValorReais(valor);

    setErroLocal(null);
    if (!data) return setErroLocal("Informe a data do lançamento.");
    if (!descricao.trim()) return setErroLocal("Informe a descrição.");
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0)
      return setErroLocal("Valor inválido.");
    if (!categoria) return setErroLocal("Selecione uma categoria.");
    if (modo === "CLIENTE" && !pagoPorCotista)
      return setErroLocal("Informe o pagador.");
    if (modo === "HOLDING" && !holdingId)
      return setErroLocal("Selecione a Holding.");

    if (
      modo === "CLIENTE" ||
      (modo === "HOLDING" && tipoMovimentoHold === "DESPESA")
    ) {
      if (!rateios.length)
        return setErroLocal("Adicione ao menos um participante no rateio.");
      if (
        rateios.some(
          (r) =>
            !Number.isFinite(percentualNumerico(r.percentual)) ||
            percentualNumerico(r.percentual) <= 0 ||
            percentualNumerico(r.percentual) > 100,
        )
      )
        return setErroLocal("Informe percentuais maiores que zero e até 100%.");
      if (new Set(rateios.map((r) => r.cotista)).size !== rateios.length)
        return setErroLocal("Não repita participantes no rateio.");
      if (rateios.some((r) => !r.cotista))
        return setErroLocal("Todos os rateios precisam de um cotista/sócio.");
      if (Math.abs(totalPercentual - 100) > 0.0001)
        return setErroLocal(
          `Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`,
        );
    }

    salvandoRef.current = true;
    setSalvando(true);
    try {
      const payload = {
        modo_lancamento: modo,
        data,
        descricao: descricao.trim(),
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        grupo_categoria: categoria.grupo || undefined,
        tipo_rateio: "EXTRA",
        periodicidade: "ÚNICO",
        valor_centavos: valorCentavos,
        observacoes: observacoes.trim() || undefined,
        aeronave_id: aeronaveId || undefined,

        ...(modo === "CLIENTE" && {
          fluxo: fluxoCliente,
          cotista_aeronave_id: pagoPorCotista,
          pago_diretamente: pagoDiretamenteCliente,
          rateios: rateios.map((r, i) => ({
            cotista_id: r.cotista,
            percentual: percentualNumerico(r.percentual),
            valor_centavos: valorPreviewRateios?.[i],
          })),
        }),

        ...(modo === "HOLDING" && {
          holding_id: holdingId,
          tipo_movimento_hold: tipoMovimentoHold,
          pago_diretamente: pagoDiretamenteHold,
          cotista_aeronave_id: rateios[0]?.cotista || undefined,
          rateios:
            tipoMovimentoHold === "DESPESA"
              ? rateios.map((r, i) => {
                  const cotista = cotistasAeronave.find(
                    (item) => item.id === r.cotista,
                  );
                  return {
                    cotista_id: r.cotista,
                    socio_id: cotista?.socio_id || undefined,
                    percentual: percentualNumerico(r.percentual),
                    valor_centavos: valorPreviewRateios?.[i],
                  };
                })
              : [],
        }),
      };

      await criarLancamentoEconomico(payload);
      toast.success("Lançamento registrado com sucesso.");
      aoFechar();
      await aoCriar();
    } catch (error) {
      setErroLocal(
        error instanceof Error
          ? error.message
          : "Erro ao registrar lançamento.",
      );
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const fechar = () => {
    if (salvandoRef.current) return;
    aoFechar();
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) fechar();
      }}
    >
      <DialogContent className="despesas-theme despesa-dialog flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-4xl sm:max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:w-[calc(100%-2rem)]">
        <style>{DESPESAS_ESTILOS}</style>
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 pr-12 sm:px-7">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold tracking-tight">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ReceiptText size={20} />
            </span>
            Novo lançamento
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Registre a despesa e defina os responsáveis pelo pagamento e pelo
            rateio.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">
            {erroLocal && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <span>{erroLocal}</span>
              </div>
            )}
            <fieldset
              disabled={salvando}
              className="min-w-0 space-y-6 disabled:opacity-70"
            >
              <legend className="sr-only">Dados do lançamento</legend>
              {possuiCliente && possuiHolding ? (
                <div
                  className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-muted/30 p-1.5 sm:grid-cols-2"
                  role="group"
                  aria-label="Origem do lançamento"
                >
                  <button
                    type="button"
                    aria-pressed={modo === "CLIENTE"}
                    onClick={() => alterarModo("CLIENTE")}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${modo === "CLIENTE" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/60"}`}
                  >
                    <User size={17} />
                    Cliente / direto
                  </button>
                  <button
                    type="button"
                    aria-pressed={modo === "HOLDING"}
                    onClick={() => alterarModo("HOLDING")}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${modo === "HOLDING" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/60"}`}
                  >
                    <Building2 size={17} />
                    Holding / conta conjunta
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm font-medium">
                  {modo === "HOLDING" ? (
                    <Building2 size={17} />
                  ) : (
                    <User size={17} />
                  )}
                  {modo === "HOLDING"
                    ? "Holding / conta conjunta"
                    : "Cliente / direto"}
                </div>
              )}

              <section className="min-w-0 space-y-4">
                <div>
                  <h3 className="text-base font-semibold">Dados da despesa</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Descreva o lançamento com todos os detalhes necessários.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lancamento-descricao">
                    Descrição <span className="text-primary">*</span>
                  </Label>
                  <Textarea
                    id="lancamento-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                    rows={4}
                    placeholder="Ex.: Manutenção preventiva da aeronave, incluindo revisão dos componentes e substituição dos filtros."
                    className="min-h-[112px] resize-y rounded-xl text-base leading-relaxed sm:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    O texto será exibido por completo na lista de lançamentos.
                  </p>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="lancamento-valor">
                      Valor (R$) <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="lancamento-valor"
                      inputMode="decimal"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      required
                      placeholder="0,00"
                      className="h-12 rounded-xl text-lg font-semibold tabular-nums"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="lancamento-data">
                      Data <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="lancamento-data"
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      required
                      className="h-12 min-w-0 rounded-xl text-base sm:text-sm"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="lancamento-categoria">
                      Categoria <span className="text-primary">*</span>
                    </Label>
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger
                        id="lancamento-categoria"
                        className="h-12 min-w-0 rounded-xl"
                      >
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent className="despesas-theme despesa-dialog max-h-72">
                        {opcoes?.categorias?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="lancamento-fluxo">
                      Tipo de movimentação
                    </Label>
                    {modo === "CLIENTE" ? (
                      <Select
                        value={fluxoCliente}
                        onValueChange={(v) =>
                          setFluxoCliente(v as "SAIDA" | "ENTRADA")
                        }
                      >
                        <SelectTrigger
                          id="lancamento-fluxo"
                          className="h-12 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="despesas-theme despesa-dialog">
                          <SelectItem value="SAIDA">Saída · despesa</SelectItem>
                          <SelectItem value="ENTRADA">
                            Entrada · aporte / reembolso
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={tipoMovimentoHold}
                        onValueChange={(v) =>
                          setTipoMovimentoHold(v as "APORTE" | "DESPESA")
                        }
                      >
                        <SelectTrigger
                          id="lancamento-fluxo"
                          className="h-12 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="despesas-theme despesa-dialog">
                          <SelectItem value="DESPESA">
                            Saída · despesa da Holding
                          </SelectItem>
                          <SelectItem value="APORTE">
                            Entrada · aporte dos sócios
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </section>

              <section className="min-w-0 space-y-4 border-t border-border pt-5">
                <h3 className="text-base font-semibold">
                  Responsável pelo pagamento
                </h3>
                {modo === "CLIENTE" ? (
                  <div className="space-y-2">
                    <Label htmlFor="lancamento-pagador">
                      Pagador / responsável
                    </Label>
                    <Select
                      value={pagoPorCotista}
                      onValueChange={setPagoPorCotista}
                    >
                      <SelectTrigger
                        id="lancamento-pagador"
                        className="h-12 rounded-xl"
                      >
                        <SelectValue placeholder="Selecione o cotista" />
                      </SelectTrigger>
                      <SelectContent className="despesas-theme despesa-dialog">
                        {cotistasCliente.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="lancamento-holding">Holding</Label>
                    <Select value={holdingId} onValueChange={setHoldingId}>
                      <SelectTrigger
                        id="lancamento-holding"
                        className="h-12 rounded-xl"
                      >
                        <SelectValue placeholder="Selecione a Holding" />
                      </SelectTrigger>
                      <SelectContent className="despesas-theme despesa-dialog">
                        {opcoes?.holdings?.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(modo === "CLIENTE" || tipoMovimentoHold === "DESPESA") && (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="min-w-0">
                      <Label
                        htmlFor="lancamento-direto"
                        className="text-sm leading-relaxed"
                      >
                        Pago diretamente pelo{" "}
                        {modo === "CLIENTE" ? "cotista" : "sócio"}?
                      </Label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {modo === "CLIENTE"
                          ? "Ative quando o cotista pagou com recursos próprios, fora do caixa da Share."
                          : "Ative quando a despesa foi paga fora da conta da Holding."}
                      </p>
                    </div>
                    <Switch
                      id="lancamento-direto"
                      checked={
                        modo === "CLIENTE"
                          ? pagoDiretamenteCliente
                          : pagoDiretamenteHold
                      }
                      onCheckedChange={
                        modo === "CLIENTE"
                          ? setPagoDiretamenteCliente
                          : setPagoDiretamenteHold
                      }
                      className="mt-1 shrink-0"
                    />
                  </div>
                )}
              </section>

              {(modo === "CLIENTE" || tipoMovimentoHold === "DESPESA") && (
                <section className="min-w-0 space-y-4 border-t border-border pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        Divisão da despesa
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Defina a participação de cada{" "}
                        {modo === "CLIENTE" ? "cotista" : "sócio"}.
                      </p>
                    </div>
                    <span
                      aria-live="polite"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums ${Math.abs(totalPercentual - 100) <= 0.0001 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                    >
                      {totalPercentual.toLocaleString("pt-BR", {
                        maximumFractionDigits: 4,
                      })}
                      % de 100%
                    </span>
                  </div>
                  <div className="space-y-3">
                    {rateios.map((rateio, index) => (
                      <div
                        key={index}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-end gap-3 rounded-xl border border-border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_120px_44px] sm:p-4"
                      >
                        <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1">
                          <Label
                            htmlFor={`rateio-cotista-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            {modo === "CLIENTE" ? "Cotista" : "Sócio"}{" "}
                            {index + 1}
                          </Label>
                          <Select
                            value={rateio.cotista}
                            onValueChange={(v) =>
                              setRateios((atual) =>
                                atual.map((linha, li) =>
                                  li === index
                                    ? { ...linha, cotista: v }
                                    : linha,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              id={`rateio-cotista-${index}`}
                              className="h-11 min-w-0 rounded-lg bg-background"
                            >
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent className="despesas-theme despesa-dialog">
                              {(modo === "CLIENTE"
                                ? cotistasCliente
                                : cotistasHolding
                              ).map((c) => (
                                <SelectItem
                                  key={c.id}
                                  value={c.id}
                                  disabled={rateios.some(
                                    (r, i) => i !== index && r.cotista === c.id,
                                  )}
                                >
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0 space-y-2">
                          <Label
                            htmlFor={`rateio-percentual-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            Participação (%)
                          </Label>
                          <Input
                            id={`rateio-percentual-${index}`}
                            inputMode="decimal"
                            value={rateio.percentual}
                            onChange={(e) =>
                              setRateios((atual) =>
                                atual.map((linha, li) =>
                                  li === index
                                    ? { ...linha, percentual: e.target.value }
                                    : linha,
                                ),
                              )
                            }
                            className="h-11 rounded-lg bg-background text-base sm:text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={rateios.length === 1}
                          aria-label={`Remover participante ${index + 1}`}
                          onClick={() =>
                            setRateios((atual) =>
                              atual.filter((_, li) => li !== index),
                            )
                          }
                          className="h-11 w-11 rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={17} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-semibold">Prévia do valor rateado por participante</p>
                    <div className="mt-2 space-y-1.5">
                      {rateios.map((rateio, index) => {
                        const pessoa = (modo === "CLIENTE" ? cotistasCliente : cotistasHolding).find((item) => item.id === rateio.cotista);
                        return <div key={`${rateio.cotista}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground">{pessoa?.nome || `${modo === "CLIENTE" ? "Cotista" : "Sócio"} ${index + 1}`} · {rateio.percentual || "0"}%</span>
                          <strong className="shrink-0 tabular-nums">{valorPreviewRateios ? formatarCentavos(valorPreviewRateios[index]) : "—"}</strong>
                        </div>;
                      })}
                    </div>
                    {valorPreviewRateios && valorPreviewRateios.some((parte) => parte !== valorPreviewRateios[0]) && <p className="mt-2 text-[11px] text-muted-foreground">Os centavos residuais são distribuídos para que a soma seja exatamente o valor total da despesa.</p>}
                    {pagoDiretamenteCliente && modo === "CLIENTE" && <p className="mt-2 text-[11px] text-muted-foreground">O pagador indicado permanece responsável pelo pagamento integral; os demais rateios registram apenas sua parte e continuam sem valor pago.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        rateios.length >=
                        (modo === "CLIENTE" ? cotistasCliente : cotistasHolding)
                          .length
                      }
                      onClick={() =>
                        setRateios((atual) => [
                          ...atual,
                          { cotista: "", percentual: "0" },
                        ])
                      }
                      className="h-10 gap-2 rounded-xl border-dashed text-xs"
                    >
                      <Plus size={16} />
                      Adicionar participante
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setRateios((atual) =>
                          dividirPercentuais(atual.map((r) => r.cotista)),
                        )
                      }
                      className="h-10 rounded-xl text-xs"
                    >
                      Dividir igualmente
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setRateios((atual) =>
                          dividirPorSociedade(
                            atual.map((r) => r.cotista),
                            cotistasAeronave,
                          ),
                        )
                      }
                      className="h-10 rounded-xl text-xs"
                    >
                      Dividir pela sociedade
                    </Button>
                  </div>
                </section>
              )}
              <section className="space-y-2 border-t border-border pt-5">
                <Label htmlFor="lancamento-observacoes">
                  Observações{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <Textarea
                  id="lancamento-observacoes"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações complementares para conferência."
                  className="resize-y rounded-xl text-base leading-relaxed sm:text-sm"
                />
              </section>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:items-center sm:px-7">
            <div className="min-w-0 text-left sm:mr-auto">
              <p className="text-xs text-muted-foreground">
                Valor do lançamento
              </p>
              <p className="break-words text-lg font-semibold tabular-nums">
                {formatarCentavos(
                  Number.isFinite(parseValorReais(valor))
                    ? parseValorReais(valor)
                    : 0,
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={fechar}
              disabled={salvando}
              className="h-11 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                salvando ||
                !opcoes ||
                !(modo === "CLIENTE" ? possuiCliente : possuiHolding)
              }
              className="despesa-primary h-11 gap-2 rounded-xl px-5"
              style={{ backgroundColor: "rgba(9, 50, 71, 1)", borderColor: "rgba(6, 54, 78, 1)", borderRadius: 12, overflow: "hidden" }}
            >
              {salvando ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Check size={17} />
              )}
              {salvando ? "Registrando…" : "Registrar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Códigos usados pela API: filtro, badge e busca compartilham esta lista.
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
  return STATUS_LANCAMENTO.find((opcao) => opcao.value === value) ?? {
    value,
    label: value ? value.replace(/_/g, " ") : "Não informado",
    Icon: CircleAlert,
  };
}

function valorPagoLancamento(lancamento: LancamentoEconomico) {
  const pagoInformado = Math.max(0, Number(lancamento.valorPagoCentavos || 0));
  if (
    ["PAGO", "PAGO_DIRETAMENTE"].includes(
      normalizarStatus(lancamento.status),
    )
  ) {
    return Math.min(
      lancamento.valorCentavos,
      pagoInformado || lancamento.valorCentavos,
    );
  }
  return Math.min(lancamento.valorCentavos, pagoInformado);
}

/* Fornecedor, documentos e rateio alinhados na expansão. */
function LancamentoExpandido({
  lancamento,
  cotistasAeronave,
  aoAbrirDocumento,
}: {
  lancamento: LancamentoEconomico;
  cotistasAeronave: CotistaAeronave[];
  aoAbrirDocumento: (nome: string, url: string) => void;
}) {
  const tituloDocumento = (documento: { nome?: string; tipo?: string | null; url: string }) => {
    const tipo = (documento.tipo || "").toLowerCase();
    const nome = (documento.nome || "").trim();
    const rotulos: Record<string, string> = {
      comprovante: "Comprovante", comprovante_pagamento: "Comprovante de pagamento",
      nota_fiscal: "Nota fiscal", nf: "Nota fiscal", recibo: "Recibo",
      relatorio: "Relatório", relatorio_despesa_viagem: "Relatório de viagem",
      boleto: "Boleto", demonstrativo: "Demonstrativo",
    };
    if (nome && !["documento", "arquivo", "anexo"].includes(nome.toLowerCase())) return nome;
    if (rotulos[tipo]) return rotulos[tipo];
    if (/relatorio[_-]despesa[_-]viagem|pdf_relatorios/i.test(documento.url)) return "Relatório de viagem";
    return nome || "Documento";
  };
  const documentosLegados = [
    { nome: "Documento", url: lancamento.urlDoc, numero: lancamento.numeroDoc },
    { nome: "Nota fiscal", url: lancamento.urlNf, numero: lancamento.numeroNf },
    { nome: "Recibo", url: lancamento.urlRecibo, numero: lancamento.numeroRecibo },
    { nome: "Demonstrativo", url: lancamento.urlDemonstrativo, numero: lancamento.numeroDemonstrativo },
    { nome: "Boleto", url: lancamento.urlBoleto, numero: null },
  ].filter((item): item is { nome: string; url: string; numero: string | null | undefined } => Boolean(item.url));
  const nomePagador = (valor: string | null | undefined) => {
    const nome = (valor || "").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nome)
      ? "Pagador não identificado" : nome;
  };

  // Uma linha por cotista, preservando os documentos anexados àquela parcela.
  const partes =
    lancamento.rateios.length > 0
      ? lancamento.rateios.map((r, i) => ({
          chave: r.id || `${r.cotistaId || r.cotista}-${i}`,
          cota: percentualSociedadeDoCotista(r.cotistaId, r.cotista, cotistasAeronave),
          uso: r.percentual,
          responsavel: r.cotista,
          parcela: r.valorCentavos,
          valorPagoReal: r.valorPagoRealCentavos ?? 0,
          dataVencimento: r.dataVencimento,
          dataPagamento: r.dataPagamento,
          subcategorias: r.subcategorias ?? lancamento.subcategorias ?? [],
          tipoRateio: r.tipoRateio,
          periodicidade: r.periodicidade ?? lancamento.periodicidade,
          pagoPor: r.pagoPor,
          pagoDiretamente: Boolean(r.pagoDiretamente),
          documentos: r.documentos ?? [],
        }))
      : [
          {
            chave: "unico",
            cota: percentualSociedadeDoCotista(lancamento.participanteId, lancamento.participanteNome, cotistasAeronave),
            uso: lancamento.percentualUso ?? lancamento.percentualSociedade ?? 0,
            responsavel:
              lancamento.participanteNome || lancamento.pagoPor || "—",
            parcela:
              lancamento.valorRateadoCentavos || lancamento.valorCentavos,
            valorPagoReal: lancamento.valorPagoRealCentavos ?? 0,
            dataVencimento: lancamento.prazo,
            dataPagamento: lancamento.dataPagamento,
            subcategorias: lancamento.subcategorias ?? [],
            tipoRateio: lancamento.tipo,
            periodicidade: lancamento.periodicidade,
            pagoPor: lancamento.pagoPor,
            pagoDiretamente: false,
            documentos: lancamento.documentos ?? [],
          },
        ];
  const percentualSociedadeLancamento =
    percentualSociedadeDoCotista(
      lancamento.participanteId,
      lancamento.participanteNome,
      cotistasAeronave,
    ) ??
    (partes.length === 1 ? partes[0].cota : null);
  const documentosGerais = [ ...(lancamento.documentos ?? []), ...documentosLegados ]
    .filter((doc, index, todos) => todos.findIndex((outro) => outro.url === doc.url) === index)
    .filter((doc) => !partes.some((parte) => parte.documentos.some((outro) => outro.url === doc.url)));

  const fmtTipoRateio = (value: string | null | undefined) => value?.replace(/_/g, " ") || "—";
  const tiposRateio = [...new Set(partes.map((parte) => parte.tipoRateio).filter((value): value is string => Boolean(value)))];
  const fmtPct = (v: number | null | undefined) =>
    v == null
      ? "—"
      : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

  return (
    <div className="despesa-detail">
      <section className="mb-5 min-w-0">
        <h3 className="despesa-detail-title">Rateio e pagamento</h3>
        <p className="mb-3 break-words text-xs text-muted-foreground">Documento: {documentoDoLancamento(lancamento) || "Não informado"}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">Data de emissão</dt><dd className="mt-1 font-semibold">{formatarData(lancamento.dataEmissao || lancamento.data)}</dd></div>
          <div><dt className="text-muted-foreground">Data Vencimento</dt><dd className="mt-1 font-semibold">{formatarData(lancamento.prazo)}</dd></div>
          <div><dt className="text-muted-foreground">Número voo</dt><dd className="mt-1 font-semibold">{lancamento.numeroVoo || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Periodicidade</dt><dd className="mt-1 font-semibold">{lancamento.periodicidade || "Não informada"}</dd></div>
          <div><dt className="text-muted-foreground">Valor Total</dt><dd className="mt-1 font-mono font-semibold tabular-nums">{formatarCentavos(lancamento.valorCentavos)}</dd></div>
          {lancamento.subcategorias?.length ? <div><dt className="text-muted-foreground">Subcategoria</dt><dd className="mt-1 break-words font-semibold">{lancamento.subcategorias.join(" · ")}</dd></div> : null}
        </dl>
      </section>
      <section className="mb-5 min-w-0">
        <h3 className="despesa-detail-title">Cotistas</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                <th className="py-2 pr-3 font-bold">Cotista</th>
                <th className="px-3 py-2 font-bold">Tipo de Rateio</th>
                <th className="px-3 py-2 text-right font-bold">Percentual Sociedade</th>
                <th className="px-3 py-2 text-right font-bold">Percentual Uso</th>
                <th className="px-3 py-2 text-right font-bold">Valor Rateado</th>
                <th className="px-3 py-2 text-right font-bold">Valor pago</th>
                <th className="py-2 pl-3 font-bold">Pago por</th>
              </tr>
            </thead>
            <tbody>
              {partes.map((p) => (
                <tr key={p.chave} className="border-b border-border/60">
                  <td className="py-2.5 pr-3 font-semibold text-foreground">{p.responsavel || "Não informado"}</td>
                  <td className="px-3 py-2.5">{fmtTipoRateio(p.tipoRateio || lancamento.tipoRateio)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtPct(p.cota)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtPct(p.uso)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatarCentavos(p.parcela)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatarCentavos(p.valorPagoReal)}</td>
                  <td className="py-2.5 pl-3 break-words">{nomePagador(p.pagoPor) || (p.pagoDiretamente ? nomePagador(p.responsavel) : "Não informado")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="despesa-detail-grid">
        <section className="min-w-0">
          <dl className="despesa-supplier">
            <dt className="despesa-detail-title">Fornecedor</dt>
            <dd>{lancamento.fornecedor || "Não informado"}</dd>
          </dl>
          <h3 className="despesa-detail-title">Documentos vinculados</h3>
          {partes.some((parte) => parte.documentos.length) || documentosGerais.length ? (
            <div className="despesa-documents">
              {partes.map((parte) => parte.documentos.length ? (
                <div key={`docs-${parte.chave}`} className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{parte.responsavel}</p>
                  <div className="flex flex-col items-start gap-2">
                    {parte.documentos.map((documento) => (
                      <button
                        key={`${parte.chave}-${documento.id ?? documento.url}`}
                        type="button"
                        onClick={() => aoAbrirDocumento(`${parte.responsavel} · ${tituloDocumento(documento)}${documento.numero ? ` · ${documento.numero}` : ""}`, documento.url)}
                        className="despesa-document"
                      >
                        <FileText size={12} className={/nota|fiscal|\bnf\b/i.test(tituloDocumento(documento)) ? "shrink-0 text-red-500" : "shrink-0"} />
                        <span className="break-words [overflow-wrap:anywhere]">{tituloDocumento(documento)}{documento.numero ? ` · ${documento.numero}` : ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null)}
              {documentosGerais.map((documento) => (
                <button
                  key={`${tituloDocumento(documento)}-${documento.url}`}
                  type="button"
                  onClick={() => aoAbrirDocumento(`${tituloDocumento(documento)}${documento.numero ? ` · ${documento.numero}` : ""}`, documento.url)}
                  className="despesa-document"
                >
                  <FileText size={12} className={/nota|fiscal|\bnf\b/i.test(tituloDocumento(documento)) ? "shrink-0 text-red-500" : "shrink-0"} />
                  <span className="break-words [overflow-wrap:anywhere]">{tituloDocumento(documento)}{documento.numero ? ` · ${documento.numero}` : ""}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum documento vinculado.
            </p>
          )}
        </section>

      </div>

      {lancamento.observacoes && (
        <p className="mt-3 whitespace-pre-wrap break-words border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          <strong className="text-foreground">Observações:</strong>{" "}
          {lancamento.observacoes}
        </p>
      )}
    </div>
  );
}
type AcaoDespesa = {
  tipo: "editar" | "excluir";
  item: LancamentoEconomico;
};
const TEXTO_COMPLETO =
  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function percentualSociedadeDoCotista(
  cotistaId: string | null | undefined,
  cotistaNome: string | null | undefined,
  cotistas: CotistaAeronave[],
) {
  const cotistaPorId = cotistas.find((item) => {
    const idsRelacionados = [item.id, item.cliente_id, item.socio_id, ...(item.cotista_ids ?? [])];
    return Boolean(cotistaId && idsRelacionados.includes(cotistaId));
  });
  if (cotistaPorId) return cotistaPorId.percentual_sociedade;

  const nomeNormalizado = cotistaNome ? normalizarBusca(cotistaNome.trim()) : "";
  if (!nomeNormalizado) return null;
  const cotistasComMesmoNome = cotistas.filter(
    (item) => normalizarBusca(item.nome.trim()) === nomeNormalizado,
  );
  const cotista = cotistasComMesmoNome.length === 1 ? cotistasComMesmoNome[0] : null;
  return cotista?.percentual_sociedade ?? null;
}

function documentoDoLancamento(lancamento: LancamentoEconomico) {
  return lancamento.documentoNumero ||
    lancamento.numeroNf ||
    lancamento.numeroRecibo ||
    lancamento.numeroDemonstrativo ||
    lancamento.numeroDoc ||
    lancamento.documento ||
    null;
}

function rateioDoCotista(
  lancamento: LancamentoEconomico,
  cotista: CotistaAeronave,
  cotistas: CotistaAeronave[],
) {
  const ids = [cotista.id, cotista.cliente_id, cotista.socio_id, ...(cotista.cotista_ids ?? [])];
  const porId = lancamento.rateios.find((rateio) => rateio.cotistaId && ids.includes(rateio.cotistaId));
  if (porId) return porId;

  const nome = normalizarBusca(cotista.nome.trim());
  const nomesIguais = cotistas.filter((item) => normalizarBusca(item.nome.trim()) === nome);
  if (nomesIguais.length === 1) {
    const porNome = lancamento.rateios.find((rateio) => normalizarBusca(rateio.cotista.trim()) === nome);
    if (porNome) return porNome;
  }

  if (!lancamento.rateios.length) {
    const participanteId = lancamento.participanteId;
    const participanteNome = lancamento.participanteNome;
    const pertence = Boolean(participanteId && ids.includes(participanteId)) ||
      (!participanteId && participanteNome && nomesIguais.length === 1 && normalizarBusca(participanteNome.trim()) === nome);
    if (pertence) {
      return {
        percentual: lancamento.percentualUso ?? lancamento.percentualSociedade ?? cotista.percentual_sociedade,
        valorCentavos: lancamento.valorRateadoCentavos || lancamento.valorCentavos,
      };
    }
  }
  return null;
}

function BadgeStatus({ status }: { status: string }) {
  const visual = statusLancamento(status);
  const Icon = visual.Icon;
  return (
    <span
      data-status={visual.value}
      className="despesa-status inline-flex items-center gap-1.5 border"
    >
      <Icon size={11} className="shrink-0" aria-hidden="true" />
      {visual.label}
    </span>
  );
}

function LancamentosDespesa({
  lancamentos,
  cotistasAeronave,
  aoNovo,
  aoAtualizar,
}: {
  lancamentos: LancamentoEconomico[];
  cotistasAeronave: CotistaAeronave[];
  aoNovo: () => void;
  aoAtualizar: () => Promise<void>;
}) {
  const [baixaSelecionada, setBaixaSelecionada] = useState<LancamentoEconomico | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [documentoAberto, setDocumentoAberto] = useState<{
    nome: string;
    url: string;
  } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [ordem, setOrdem] = useState("recentes");
  const [larguras, setLarguras] = useState<Record<string, number>>({});
  const estiloColuna = (id: string, padrao?: number) => {
    const largura = larguras[id] ?? padrao;
    return largura ? { width: largura } : undefined;
  };
  const iniciarRedimensionamento = (colunaId: string, evento: ReactPointerEvent<HTMLSpanElement>) => {
    evento.preventDefault();
    evento.stopPropagation();
    const inicioX = evento.clientX;
    const larguraInicial = evento.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
    const mover = (e: PointerEvent) => setLarguras((atual) => ({ ...atual, [colunaId]: Math.max(56, larguraInicial + e.clientX - inicioX) }));
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;
  useEffect(() => { setPagina(1); setExpandido(null); setSelecionados(new Set()); }, [busca, filtroStatus, filtroCategoria, ordem, lancamentos]);
  const [acao, setAcao] = useState<AcaoDespesa | null>(null);
  const [descricaoEdicao, setDescricaoEdicao] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const processandoRef = useRef(false);
  const despesas = useMemo(
    () => lancamentos.filter((item) => item.fluxo === "SAIDA"),
    [lancamentos],
  );
  const categorias = useMemo(
    () =>
      [
        ...new Set(despesas.map((item) => item.categoria || "Sem categoria")),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
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
            item.fornecedor,
            item.participanteNome,
            item.participanteId,
            item.categoria,
            item.numeroDoc,
            item.numeroNf,
            item.numeroRecibo,
            item.numeroDemonstrativo,
            item.documento,
            item.observacoes,
            item.status,
            statusLancamento(item.status).label,
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(termo);
      return (
        correspondeBusca &&
        (filtroStatus === "todos" ||
          normalizarStatus(item.status) === filtroStatus) &&
        (filtroCategoria === "todas" ||
          (item.categoria || "Sem categoria") === filtroCategoria)
      );
    });
  }, [despesas, busca, filtroStatus, filtroCategoria]);
  // A ordenação respeita o agrupamento mensal; valores são ordenados dentro de cada mês.
  const gruposPorMes = useMemo(
    () =>
      agruparPorMes(filtradas)
        .sort((a, b) =>
          ordem === "antigas"
            ? a.mes.localeCompare(b.mes)
            : b.mes.localeCompare(a.mes),
        )
        .map((grupo) => ({
          ...grupo,
          itens: [...grupo.itens].sort((a, b) => {
            if (ordem === "maior") return b.valorCentavos - a.valorCentavos;
            if (ordem === "menor") return a.valorCentavos - b.valorCentavos;
            const comparacao = String(a.dataEmissao || a.data).localeCompare(String(b.dataEmissao || b.data));
            return ordem === "antigas" ? comparacao : -comparacao;
          }),
        })),
    [filtradas, ordem],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * porPagina;
  const gruposDaPagina = useMemo(() => {
    let deslocamento = 0;
    return gruposPorMes.map((grupo) => {
      const inicio = deslocamento;
      deslocamento += grupo.itens.length;
      return { ...grupo, itens: grupo.itens.slice(
        Math.max(0, inicioPagina - inicio), Math.max(0, inicioPagina + porPagina - inicio),
      ) };
    }).filter((grupo) => grupo.itens.length > 0);
  }, [gruposPorMes, inicioPagina]);
  const paginasVisiveis = Array.from({ length: Math.min(3, totalPaginas) }, (_, i) =>
    Math.max(1, Math.min(paginaAtual - 1, totalPaginas - 2)) + i);
  const totalLancado = despesas.reduce(
    (total, item) => total + item.valorCentavos,
    0,
  );
  const totalPago = despesas.reduce(
    (total, item) => total + valorPagoLancamento(item),
    0,
  );
  const totalAberto = Math.max(0, totalLancado - totalPago);
  const totalReembolsos = despesas.reduce(
    (total, item) => total + (item.reembolsavel ? item.valorCentavos : 0),
    0,
  );
  const totalFiltrado = filtradas.reduce(
    (total, item) => total + item.valorCentavos,
    0,
  );
  const itensSelecionados = useMemo(
    () => filtradas.filter((item) => selecionados.has(item.id)),
    [filtradas, selecionados],
  );
  const totalSelecionado = itensSelecionados.reduce(
    (total, item) => total + item.valorCentavos,
    0,
  );
  const itensDaPagina = gruposDaPagina.flatMap((grupo) => grupo.itens);
  const todosDaPaginaSelecionados =
    itensDaPagina.length > 0 &&
    itensDaPagina.every((item) => selecionados.has(item.id));
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
  const temFiltros = Boolean(
    busca || filtroStatus !== "todos" || filtroCategoria !== "todas",
  );
  const limparFiltros = () => {
    setBusca("");
    setFiltroStatus("todos");
    setFiltroCategoria("todas");
  };
  const abrirAcao = (tipo: AcaoDespesa["tipo"], item: LancamentoEconomico) => {
    setDescricaoEdicao(item.descricao);
    setErroAcao(null);
    setAcao({ tipo, item });
  };
  const confirmarAcao = async () => {
    if (!acao || processandoRef.current) return;
    if (acao.tipo === "editar" && !descricaoEdicao.trim()) {
      setErroAcao("Informe a descrição da despesa.");
      return;
    }
    processandoRef.current = true;
    setProcessando(true);
    setErroAcao(null);
    try {
      if (acao.tipo === "editar") {
        await editarLancamento(acao.item.id, {
          descricao: descricaoEdicao.trim(),
        });
        avisarAtualizacaoFinanceiro();
      }
      if (acao.tipo === "excluir") await excluirLancamento(acao.item.id);
      toast.success(
        acao.tipo === "editar"
          ? "Descrição atualizada."
          : acao.tipo === "excluir"
            ? "Despesa excluída."
            : "Pagamento registrado.",
      );
      setAcao(null);
      await aoAtualizar();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação.";
      setErroAcao(mensagem);
      toast.error(mensagem);
    } finally {
      processandoRef.current = false;
      setProcessando(false);
    }
  };
  const acoesDaLinha = (item: LancamentoEconomico) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-sm"
          aria-label={`Ações: ${item.descricao}`}
        >
          <MoreHorizontal size={19} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="despesas-theme despesa-dialog min-w-[190px] rounded-xl p-1.5"
      >
        <DropdownMenuItem
          onSelect={() => abrirAcao("editar", item)}
          className="gap-2 py-2.5"
        >
          <Pencil size={16} />
          Editar descrição
        </DropdownMenuItem>
        {!item.reembolsavel && (
          <DropdownMenuItem
            disabled={["PAGO", "PAGO_DIRETAMENTE", "REEMBOLSADO", "CANCELADO", "ESTORNO"].includes(
              normalizarStatus(item.status),
            )}
            onSelect={() => setBaixaSelecionada(item)}
            className="gap-2 py-2.5"
          >
            <Coins size={16} />
            Dar baixa
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => abrirAcao("excluir", item)}
          className="gap-2 py-2.5 text-destructive focus:text-destructive"
        >
          <Trash2 size={16} />
          Excluir despesa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const resumoMes = (mes: string, itens: LancamentoEconomico[]) => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <CalendarDays size={15} className="text-primary" />
        <span className="text-sm font-semibold capitalize">
          {rotuloMesCotista(mes)}
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {itens.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Subtotal{" "}
        <strong className="ml-1 font-semibold tabular-nums text-foreground">
          {formatarCentavos(
            itens.reduce((total, item) => total + item.valorCentavos, 0),
          )}
        </strong>
      </p>
    </div>
  );
  const cards = [
    { titulo: "Total lançado", valor: totalLancado },
    { titulo: "Total pago", valor: totalPago },
    { titulo: "Em aberto", valor: totalAberto },
  ];

  return (
    <div className="despesas-theme despesas-shell min-w-0 space-y-3">
      <style>{DESPESAS_ESTILOS}</style>
      <section
        className="despesa-ledger min-w-0"
        aria-label="Lançamentos mensais"
      >
        <header className="despesa-heading flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <h3 className="text-sm font-semibold tracking-tight">
              Lançamentos ({filtradas.length})
            </h3>
            {cards.map(({ titulo, valor }) => (
              <p key={titulo} className="text-xs text-muted-foreground">
                {titulo}{" "}
                <span className="font-semibold tabular-nums text-foreground">{formatarCentavos(valor)}</span>
              </p>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={aoNovo}
            className="despesa-primary h-9 shrink-0 gap-2 rounded-lg px-3 text-xs"
            style={{ backgroundColor: "rgba(1, 9, 24, 1)", borderColor: "rgba(4, 79, 117, 1)" }}
          >
            <Plus size={18} />
            Novo lançamento
          </Button>
          </div>
        </header>

        <div className="despesa-toolbar border-b border-border">
          <div className="despesa-toolbar-main">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Label htmlFor="despesa-busca" className="sr-only">Buscar lançamento</Label>
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" />
              <Input id="despesa-busca" type="search" value={busca}
                onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, fornecedor, cotista…"
                className="h-8 pl-9 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="despesa-control" aria-expanded={filtrosAbertos}
                aria-controls="despesa-filtros" onClick={() => setFiltrosAbertos((v) => !v)}>
                <Filter size={12} fill="currentColor" /> Filtros
                {(filtroStatus !== "todos" || filtroCategoria !== "todas") && <span className="despesa-filter-count">{Number(filtroStatus !== "todos") + Number(filtroCategoria !== "todas")}</span>}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="despesa-control"><ArrowUpDown size={12} /> Ordenar</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="despesas-theme despesa-dialog">
                  {[["recentes", "Mais recentes"], ["antigas", "Mais antigas"], ["maior", "Maior valor no mês"], ["menor", "Menor valor no mês"]].map(([valor, rotulo]) => (
                    <DropdownMenuItem key={valor} onSelect={() => setOrdem(valor)}>
                      <Check size={13} className={ordem === valor ? "mr-2" : "mr-2 invisible"} />{rotulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {filtrosAbertos && <div id="despesa-filtros" className="despesa-filter-panel">
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="despesa-status"
                className="text-xs text-muted-foreground"
              >
                Status
              </Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger
                  id="despesa-status"
                  className="h-9 rounded-md bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="despesas-theme despesa-dialog">
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {STATUS_LANCAMENTO.map(
                    (status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="despesa-categoria"
                className="text-xs text-muted-foreground"
              >
                Categoria
              </Label>
              <Select
                value={filtroCategoria}
                onValueChange={setFiltroCategoria}
              >
                <SelectTrigger
                  id="despesa-categoria"
                  className="h-9 min-w-0 rounded-md bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="despesas-theme despesa-dialog max-h-72">
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>}
          {temFiltros && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span role="status">{filtradas.length} de {despesas.length} despesas · Total filtrado: {formatarCentavos(totalFiltrado)}</span>
            <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={limparFiltros}><X size={12} />Limpar filtros</button>
          </div>}
        </div>

        {itensSelecionados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/10 px-4 py-3 text-sm">
            <span role="status">
              {itensSelecionados.length}{" "}
              {itensSelecionados.length === 1 ? "lançamento selecionado" : "lançamentos selecionados"}
              {" · Soma: "}
              <strong className="tabular-nums">{formatarCentavos(totalSelecionado)}</strong>
            </span>
            <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => setSelecionados(new Set())}><X size={12} />Limpar seleção</button>
          </div>
        )}
        {filtradas.length > 0 ? (
          <>
            {/* Uma única tabela em todas as larguras; o scroll fica restrito ao painel. */}
            <div className="despesa-table-scroll" role="region" aria-label="Tabela de despesas" tabIndex={0}>
              <table className="despesa-table" style={{ minWidth: 1048 + cotistasAeronave.length * 168 }}>
                <caption className="sr-only">
                  Despesas agrupadas por mês, com descrições completas, valores
                  e status.
                </caption>
                <colgroup>
                  <col style={{ width: 42 }} />
                  <col style={estiloColuna("data", 108)} />
                  <col style={estiloColuna("descricao")} />
                  <col style={estiloColuna("categoria", 122)} />
                  <col style={estiloColuna("tipo", 110)} />
                  <col style={estiloColuna("pago", 126)} />
                  {cotistasAeronave.map((cotista) => <col key={cotista.id} style={estiloColuna(`cotista-${cotista.id}`, 168)} />)}
                  <col style={estiloColuna("status", 104)} />
                  <col style={estiloColuna("acoes", 76)} />
                </colgroup>
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-4">
                      <Checkbox
                        className="despesa-checkbox"
                        aria-label="Selecionar todos os lançamentos desta página"
                        checked={todosDaPaginaSelecionados ? true : itensDaPagina.some((item) => selecionados.has(item.id)) ? "indeterminate" : false}
                        onCheckedChange={alternarSelecaoDaPagina}
                      />
                    </th>
                    {[
                      { id: "data", titulo: "Data / documento", numerica: false, cotista: false },
                      { id: "descricao", titulo: "Fornecedor / descrição", numerica: false, cotista: false },
                      { id: "categoria", titulo: "Categoria", numerica: false, cotista: false },
                      { id: "tipo", titulo: "Tipo de rateio", numerica: false, cotista: false },
                      { id: "pago", titulo: "Valor pago", numerica: true, cotista: false },
                      ...cotistasAeronave.map((cotista) => ({ id: `cotista-${cotista.id}`, titulo: cotista.nome, numerica: true, cotista: true })),
                      { id: "status", titulo: "Status", numerica: false, cotista: false },
                      { id: "acoes", titulo: "Ações", numerica: true, cotista: false },
                    ].map((coluna) => (
                      <th key={coluna.id} scope="col"
                        aria-sort={coluna.id === "data" ? ordem === "antigas" ? "ascending" : ordem === "recentes" ? "descending" : "none" : undefined}
                        className={coluna.numerica ? "text-right" : ""}>
                        {coluna.cotista ? (
                          <span className="despesa-cotista-heading"><span>{coluna.titulo}</span><small>Rateio · % / valor</small></span>
                        ) : coluna.id === "data" ? (
                          <button type="button" className="despesa-sort-date"
                            onClick={() => setOrdem((atual) => atual === "antigas" ? "recentes" : "antigas")}
                            aria-label={ordem === "antigas" ? "Ordenar por data mais recente" : "Ordenar por data mais antiga"}>
                            <span>{coluna.titulo}</span>
                            {ordem === "antigas" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        ) : coluna.titulo}
                        <span role="separator" aria-orientation="vertical" aria-label={`Redimensionar coluna ${coluna.titulo}`} className="despesa-col-resizer" onPointerDown={(evento) => iniciarRedimensionamento(coluna.id, evento)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                {gruposDaPagina.map(({ mes, itens }) => (
                  <tbody key={mes} className="divide-y divide-border">
                    <tr className="despesa-month">
                      <th
                        scope="rowgroup"
                        colSpan={8 + cotistasAeronave.length}
                        className="px-4 py-3 font-normal"
                      >
                        {resumoMes(mes, itens)}
                      </th>
                    </tr>
                    {itens.map((item) => {
                      const aberto = expandido === item.id;
                      const documento = documentoDoLancamento(item);
                      return (
                        <Fragment key={item.id}>
                          <tr
                            className="despesa-row"
                            data-expanded={aberto}
                            data-selected={selecionados.has(item.id)}
                          >
                            <td className="px-4 py-5 align-middle">
                              <Checkbox
                        className="despesa-checkbox"
                                aria-label={`Selecionar lançamento: ${item.descricao}`}
                                checked={selecionados.has(item.id)}
                                onCheckedChange={() => alternarSelecao(item.id)}
                              />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <p className="despesa-date">
                                {formatarData(item.dataEmissao || item.data)}
                              </p>
                              <p className="despesa-date-caption" title="Documento">{documento || "—"}</p>
                            </td>
                            <td className="px-2 py-3 align-top">
                              <p className={`despesa-line-supplier ${TEXTO_COMPLETO}`}>{item.fornecedor || "Fornecedor não informado"}</p>
                              <p className={`despesa-line-description ${TEXTO_COMPLETO}`}>{item.descricao}</p>
                            </td>
                            <td className="px-2 py-3 align-top">
                              <p
                                className={`despesa-category ${TEXTO_COMPLETO}`}
                              >
                                {item.categoria || "Sem categoria"}
                              </p>
                            </td>
                            <td className="px-2 py-3 align-top">{String(item.tipoRateio || item.tipo || "—").replace(/_/g, " ").toLocaleUpperCase("pt-BR")}</td>
                            <td className="px-2 py-3 text-right align-top"><p className="despesa-money">{formatarCentavos(valorPagoLancamento(item))}</p></td>
                            {cotistasAeronave.map((cotista) => {
                              const rateio = rateioDoCotista(item, cotista, cotistasAeronave);
                              return <td key={cotista.id} className="px-2 py-3 text-right align-top">
                                {rateio ? <div className="despesa-rateio-cell"><span className="text-muted-foreground">{Number(rateio.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span><b className="despesa-rateio-value">{formatarCentavos(rateio.valorCentavos)}</b></div> : <span className="text-muted-foreground">—</span>}
                              </td>;
                            })}
                            <td className="px-2 py-3 align-top">
                              <BadgeStatus status={item.status} />
                            </td>
                            <td className="px-1 py-2 text-right align-top">
                              <div className="flex items-center justify-end gap-1">
                                {acoesDaLinha(item)}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 rounded-sm text-primary"
                                  onClick={() => setExpandido(aberto ? null : item.id)}
                                  aria-expanded={aberto}
                                  aria-controls={`despesa-desktop-${item.id}`}
                                  aria-label={`${aberto ? "Ocultar" : "Ver"} documentos e rateio: ${item.descricao}`}
                                >
                                  {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {aberto && (
                            <tr id={`despesa-desktop-${item.id}`}>
                              <td colSpan={8 + cotistasAeronave.length} className="p-0">
                                <LancamentoExpandido
                                  lancamento={item}
                                  cotistasAeronave={cotistasAeronave}
                                  aoAbrirDocumento={(nome, url) =>
                                    setDocumentoAberto({ nome, url })
                                  }
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>

          </>
        ) : (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ReceiptText size={25} />
            </span>
            <h4 className="mt-4 text-base font-semibold">
              {temFiltros
                ? "Nenhuma despesa corresponde aos filtros"
                : "Nenhuma despesa neste período"}
            </h4>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {temFiltros
                ? "Tente outro termo ou limpe os filtros para ver todos os lançamentos."
                : "Selecione outro período ou registre uma nova movimentação para esta aeronave."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={temFiltros ? limparFiltros : aoNovo}
              className="mt-5 h-11 rounded-xl"
            >
              {temFiltros ? "Limpar filtros" : "Novo lançamento"}
            </Button>
          </div>
        )}
        <footer className="despesa-pagination">
          <p role="status" aria-live="polite">Exibindo {filtradas.length ? inicioPagina + 1 : 0}–{Math.min(inicioPagina + porPagina, filtradas.length)} de {filtradas.length} transações</p>
          <nav aria-label="Paginação das despesas" className="flex items-center gap-1">
            <button type="button" disabled={paginaAtual === 1} aria-label="Página anterior" onClick={() => { setPagina(paginaAtual - 1); setExpandido(null); }}><ChevronLeft size={14} /></button>
            {paginasVisiveis.map((numero) => <button type="button" key={numero}
              aria-label={`Página ${numero}`} aria-current={paginaAtual === numero ? "page" : undefined}
              onClick={() => { setPagina(numero); setExpandido(null); }}>{numero}</button>)}
            <button type="button" disabled={paginaAtual === totalPaginas} aria-label="Próxima página" onClick={() => { setPagina(paginaAtual + 1); setExpandido(null); }}><ChevronRight size={14} /></button>
          </nav>
        </footer>
      </section>

      <DarBaixaCotistaDialog
        lancamento={baixaSelecionada?.reembolsavel ? null : baixaSelecionada}
        onFechar={() => setBaixaSelecionada(null)}
        onConcluido={async () => { await aoAtualizar(); toast.success("Pagamento registrado."); }}
      />

      <Dialog
        open={Boolean(acao)}
        onOpenChange={(open) => {
          if (!open && !processandoRef.current) setAcao(null);
        }}
      >
        <DialogContent className="despesas-theme despesa-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {acao?.tipo === "editar"
                ? "Editar descrição"
                : acao?.tipo === "excluir"
                  ? "Excluir despesa?"
                  : "Confirmar pagamento"}
            </DialogTitle>
            <DialogDescription>
              {acao?.tipo === "editar"
                ? "Atualize o texto completo do lançamento."
                : acao?.tipo === "excluir"
                  ? "A despesa será removida do fluxo financeiro. Confirme para continuar."
                  : "A baixa registrará o valor integral como pago na data de hoje."}
            </DialogDescription>
          </DialogHeader>
          {acao && (
            <div className="min-w-0 space-y-4">
              {acao.tipo === "editar" ? (
                <div className="space-y-2">
                  <Label htmlFor="descricao-edicao">Descrição</Label>
                  <Textarea
                    id="descricao-edicao"
                    rows={6}
                    value={descricaoEdicao}
                    onChange={(e) => setDescricaoEdicao(e.target.value)}
                    disabled={processando}
                    className="resize-y rounded-xl text-base leading-relaxed sm:text-sm"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className={`text-sm leading-relaxed ${TEXTO_COMPLETO}`}>
                    {acao.item.descricao}
                  </p>
                  <p className="mt-3 text-xl font-semibold tabular-nums">
                    {formatarCentavos(acao.item.valorCentavos)}
                  </p>

                </div>
              )}
              {erroAcao && (
                <p role="alert" className="text-sm text-destructive">
                  {erroAcao}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAcao(null)}
              disabled={processando}
              className="h-11 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={acao?.tipo === "excluir" ? "destructive" : "default"}
              onClick={() => void confirmarAcao()}
              disabled={
                processando ||
                (acao?.tipo === "editar" && !descricaoEdicao.trim())
              }
              className="h-11 gap-2 rounded-xl"
            >
              {processando && <Loader2 size={16} className="animate-spin" />}
              {acao?.tipo === "editar"
                ? "Salvar descrição"
                : acao?.tipo === "excluir"
                  ? "Excluir despesa"
                  : "Confirmar baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(documentoAberto)}
        onOpenChange={(open) => {
          if (!open) setDocumentoAberto(null);
        }}
      >
        <DialogContent className="despesas-theme despesa-dialog max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl sm:max-w-5xl gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:w-[calc(100%-2rem)]">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12">
            <DialogTitle className={`text-base ${TEXTO_COMPLETO}`}>
              {documentoAberto?.nome || "Documento"}
            </DialogTitle>
            <DialogDescription>
              Documento vinculado à despesa selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[260px] max-h-[65dvh] items-center justify-center overflow-auto bg-muted/20 p-3 sm:p-5">
            {documentoAberto &&
              (/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(
                documentoAberto.url,
              ) ? (
                <img
                  src={documentoAberto.url}
                  alt={documentoAberto.nome}
                  className="max-h-[60dvh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <iframe
                  title={documentoAberto.nome}
                  src={documentoAberto.url}
                  className="h-[60dvh] w-full rounded-lg border border-border bg-background"
                />
              ))}
          </div>
          {documentoAberto && (
            <div className="border-t border-border px-5 py-3">
              <a
                href={documentoAberto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink size={16} />
                Abrir documento em outra aba
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceiroCotista() {
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [dashboard, setDashboard] = useState<DashboardCotista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDashboard, setErroDashboard] = useState<string | null>(null);
  const [aeronaves, setAeronaves] = useState<AeronaveOpcao[]>([]);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");
  const [buscaMatricula, setBuscaMatricula] = useState("");
  const aeronavesFiltradas = useMemo(() => {
    const termo = buscaMatricula.trim().toLowerCase();
    return termo
      ? aeronaves.filter((a) => a.matricula_registro.toLowerCase().includes(termo))
      : aeronaves;
  }, [aeronaves, buscaMatricula]);
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>(
    [],
  );
  const [participacaoEditando, setParticipacaoEditando] = useState<CotistaAeronave | null>(null);
  const [percentualEditado, setPercentualEditado] = useState("");
  const [aeronaveEditada, setAeronaveEditada] = useState("");
  const [salvandoParticipacao, setSalvandoParticipacao] = useState(false);
  const [cotistaEmprestimo, setCotistaEmprestimo] = useState("todos");
  const mesAtual = mesAtualLocal();
  const [anoMeses, setAnoMeses] = useState(mesAtual.slice(0, 4));
  const mesesDisponiveis = useMemo(
    () =>
      MESES_CURTOS.map(
        (_, indice) => `${anoMeses}-${String(indice + 1).padStart(2, "0")}`,
      ),
    [anoMeses],
  );
  const [mesesRascunho, setMesesRascunho] = useState<string[]>([mesAtual]);
  const [mesesAplicados, setMesesAplicados] = useState<string[]>([mesAtual]);
  const [periodoAplicado, setPeriodoAplicado] = useState<PeriodoCotista>(
    () => periodoDoMes(mesAtual) ?? { inicio: hoje(), fim: hoje() },
  );
  const dashboardRequestId = useRef(0);

  const carregar = useCallback(async () => {
    const requestId = ++dashboardRequestId.current;
    if (!aeronaveSelecionada) {
      setDashboard(null);
      setErroDashboard(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErroDashboard(null);
    try {
      const resultado = await buscarDashboardCotista(
        periodoAplicado.inicio,
        periodoAplicado.fim,
        aeronaveSelecionada,
        undefined,
        mesesAplicados,
      );
      if (requestId === dashboardRequestId.current) setDashboard(resultado);
    } catch (error) {
      if (requestId === dashboardRequestId.current) {
        setDashboard(null);
        setErroDashboard(
          error instanceof Error
            ? error.message
            : "Falha inesperada ao carregar o financeiro.",
        );
      }
    } finally {
      if (requestId === dashboardRequestId.current) setCarregando(false);
    }
  }, [aeronaveSelecionada, periodoAplicado, mesesAplicados]);

  useEffect(() => {
    const atualizar = () => { void carregar(); };
    const externo = (e: StorageEvent) => { if (e.key === 'financeiro-atualizado') atualizar(); };
    window.addEventListener('financeiro-atualizado', atualizar);
    window.addEventListener('storage', externo);
    return () => { window.removeEventListener('financeiro-atualizado', atualizar); window.removeEventListener('storage', externo); };
  }, [carregar]);

  const carregarAeronaves = useCallback(async () => {
    try {
      const resp = await buscarAeronavesShare("ativa");
      setAeronaves(resp.aeronaves || []);
    } catch {
      setAeronaves([]);
    }
  }, []);

  const carregarCotistas = useCallback(async (aeronaveId: string) => {
    if (!aeronaveId) {
      setCotistasAeronave([]);
      return;
    }
    try {
      const resp = await buscarCotistasAeronave(aeronaveId);
      setCotistasAeronave(resp.cotistas || []);
    } catch {
      setCotistasAeronave([]);
    }
  }, []);
  const salvarParticipacao = async () => {
    if (!participacaoEditando || salvandoParticipacao) return;
    const percentual = Number(percentualEditado.replace(",", "."));
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      toast.error("Informe uma participação entre 0 e 100%.");
      return;
    }
    setSalvandoParticipacao(true);
    try {
      await atualizarParticipacaoCotista(participacaoEditando.id, { aeronave_id: aeronaveEditada, percentual_sociedade: percentual });
      setParticipacaoEditando(null);
      await Promise.all([carregarCotistas(aeronaveSelecionada), carregar()]);
      toast.success("Participação atualizada.");
    } catch (error) {
      const codigo = error instanceof Error ? error.message : "";
      const mensagens: Record<string, string> = {
        cotista_ja_vinculado_a_aeronave: "Esse cotista já possui vínculo ativo com a aeronave selecionada.",
        aeronave_nao_pode_ser_alterada_com_historico_financeiro: "Não é possível mudar a aeronave deste vínculo porque ele já possui histórico financeiro.",
      };
      toast.error(mensagens[codigo] || "Não foi possível atualizar a participação.");
    } finally {
      setSalvandoParticipacao(false);
    }
  };
  const removerParticipacao = async (cotista: CotistaAeronave) => {
    if (!window.confirm(`Desativar o vínculo de ${cotista.nome} com esta aeronave? O histórico financeiro será preservado.`)) return;
    try {
      await excluirParticipacaoCotista(cotista.id);
      await Promise.all([carregarCotistas(aeronaveSelecionada), carregar()]);
      toast.success("Vínculo desativado; o histórico foi preservado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desativar o vínculo.");
    }
  };

  useEffect(() => {
    void buscarOpcoesLancamento()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
    carregarAeronaves();
  }, [carregarAeronaves]);

  useEffect(() => {
    carregar();
    carregarCotistas(aeronaveSelecionada);
  }, [aeronaveSelecionada, carregar, carregarCotistas]);
  const lancamentosFiltrados = useMemo(() => {
    if (!aeronaveSelecionada || !dashboard?.lancamentos) return [];
    return dashboard.lancamentos.filter((lancamento) => {
      const data = String(lancamento.data ?? "").slice(0, 10);
      return (
        lancamento.aeronaveId === aeronaveSelecionada &&
        data >= periodoAplicado.inicio &&
        data <= periodoAplicado.fim &&
        mesesAplicados.includes(data.slice(0, 7))
      );
    });
  }, [dashboard, aeronaveSelecionada, periodoAplicado, mesesAplicados]);

  const possuiHolding = cotistasAeronave.some((cotista) =>
    Boolean(cotista.eh_holding),
  );
  const [cotistaVisaoId, setCotistaVisaoId] = useState("");
  useEffect(() => {
    setCotistaVisaoId((atual) =>
      cotistasAeronave.some((cotista) => cotista.id === atual)
        ? atual
        : cotistasAeronave[0]?.id ?? "",
    );
  }, [aeronaveSelecionada, cotistasAeronave]);
  const [abaAtiva, setAbaAtiva] = useState<
    | "resumo"
    | "medias"
    | "lancamentos"
    | "graficos"
    | "ranking"
    | "emprestimos"
    | "extrato"
    | "portal-cliente"
  >("lancamentos");
  const [paginaAberta, setPaginaAberta] = useState(false);
  const abasCotista: Array<{ id: string; rotulo: string; Icon: typeof ReceiptText; corIcone: string }> = [
    { id: "lancamentos", rotulo: "Lançamentos mensais", Icon: ReceiptText, corIcone: "bg-sky-400/10 text-sky-400" },
    { id: "resumo", rotulo: "Visão por cotista", Icon: LayoutDashboard, corIcone: "bg-violet-400/10 text-violet-400" },
    { id: "emprestimos", rotulo: "Voos empréstimo", Icon: Fuel, corIcone: "bg-amber-400/10 text-amber-400" },
    { id: "medias", rotulo: "Médias", Icon: Gauge, corIcone: "bg-emerald-400/10 text-emerald-400" },
    { id: "graficos", rotulo: "Gráficos", Icon: BarChart3, corIcone: "bg-rose-400/10 text-rose-400" },
    { id: "portal-cliente", rotulo: "Portal Cliente", Icon: KeyRound, corIcone: "bg-teal-400/10 text-teal-400" },
    ...(possuiHolding ? [{ id: "extrato", rotulo: "Extrato Holding", Icon: Landmark, corIcone: "bg-orange-400/10 text-orange-400" }] : []),
  ];

  const periodoDosMeses = (meses: string[]): PeriodoCotista => {
    const periodos = meses
      .map((mes) => periodoDoMes(mes))
      .filter((periodo): periodo is PeriodoCotista => Boolean(periodo));
    return periodos.length
      ? { inicio: periodos[0].inicio, fim: periodos[periodos.length - 1].fim }
      : (periodoDoMes(mesAtual) ?? { inicio: hoje(), fim: hoje() });
  };
  const atualizarMeses = (proximos: string[]) => {
    const ordenados = [...new Set(proximos)].sort();
    if (!ordenados.length) return; // Mantém ao menos uma competência válida.
    setMesesRascunho(ordenados);
    setMesesAplicados(ordenados);
    setPeriodoAplicado(periodoDosMeses(ordenados));
  };
  const alternarMes = (mes: string) => {
    atualizarMeses(
      mesesRascunho.includes(mes)
        ? mesesRascunho.filter((item) => item !== mes)
        : [...mesesRascunho, mes],
    );
  };
  const selecionarTodosOsMeses = () => atualizarMeses(mesesDisponiveis);
  const limparMeses = () => selecionarMesUnico(mesAtual);
  const selecionarMesUnico = (mes: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !periodoDoMes(mes)) return;
    setAnoMeses(mes.slice(0, 4));
    atualizarMeses([mes]);
  };
  const mesReferencia = mesesAplicados[0] || mesAtual;
  const todosOsMesesSelecionados = mesesDisponiveis.every((mes) => mesesRascunho.includes(mes));

  const despesas = useMemo(
    () =>
      lancamentosFiltrados.filter((lancamento) => lancamento.fluxo === "SAIDA"),
    [lancamentosFiltrados],
  );
  const rankingGastosPorMes = useMemo(() => {
    const meses = new Map<
      string,
      Map<string, { grupo: string; valor: number; quantidade: number }>
    >();
    for (const lancamento of despesas) {
      const mes = String(lancamento.data ?? "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mes)) continue;
      const categorias =
        meses.get(mes) ??
        new Map<string, { grupo: string; valor: number; quantidade: number }>();
      const categoria = lancamento.categoria || "SEM CATEGORIA";
      const atual = categorias.get(categoria) ?? {
        grupo: lancamento.grupoCategoria || "",
        valor: 0,
        quantidade: 0,
      };
      atual.valor += lancamento.valorCentavos;
      atual.quantidade += 1;
      categorias.set(categoria, atual);
      meses.set(mes, categorias);
    }
    return [...meses.entries()]
      .sort(([mesA], [mesB]) => mesB.localeCompare(mesA))
      .map(([mes, categorias]) => ({
        mes,
        itens: [...categorias.entries()]
          .map(([categoria, valores]) => ({ categoria, ...valores }))
          .sort((a, b) => b.valor - a.valor),
      }));
  }, [despesas]);
  const gruposEmprestimos = useMemo(() => {
    const [tipo, id] = cotistaEmprestimo.split(":");
    const lista = (dashboard?.emprestimos_aeronave ?? []).filter((v) => {
      if (!mesesAplicados.includes(String(v.data ?? "").slice(0, 7))) return false;
      if (!id) return true;
      return tipo === "socio" ? v.emprestador_socio_id === id : v.emprestador_cliente_id === id;
    });
    return agruparPorMes(lista);
  }, [dashboard, mesesAplicados, cotistaEmprestimo]);
  // O dashboard já entrega ranking_gastos e fechamento_mensal em reais; os lançamentos brutos acima continuam em centavos.
  const dadosCategorias = (dashboard?.ranking_gastos ?? []).map((item) => ({
    nome: item.categoria,
    valor: item.valor,
    quantidade: item.quantidade,
    grupo: item.grupo,
  }));
  const totalCategorias = dadosCategorias.reduce(
    (total, item) => total + item.valor,
    0,
  );
  const totalCategoriasCompacto = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(totalCategorias);
  const dadosPagamentosRateio = useMemo(() => {
    const porMes = new Map<string, { pagamentos: number; rateado: number }>();
    for (const lancamento of despesas) {
      const mes = String(lancamento.data ?? "").slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) continue;
      const valores = porMes.get(mes) ?? { pagamentos: 0, rateado: 0 };
      valores.pagamentos += valorPagoLancamento(lancamento) / 100;
      const rateado = lancamento.rateios.length > 0
        ? lancamento.rateios.reduce((total, rateio) => total + rateio.valorCentavos, 0)
        : lancamento.valorRateadoCentavos || lancamento.valorCentavos;
      valores.rateado += rateado / 100;
      porMes.set(mes, valores);
    }
    return [...porMes.entries()]
      .sort(([mesA], [mesB]) => mesA.localeCompare(mesB))
      .map(([mes, valores]) => ({
        mes: rotuloMesCotista(mes).split(" ")[0].slice(0, 3),
        ...valores,
      }));
  }, [despesas]);
  const maiorDiferencaPagamentosRateio = dadosPagamentosRateio.reduce<{
    mes: string;
    valor: number;
  } | null>((maior, atual) => {
    const valor = Math.abs(atual.pagamentos - atual.rateado);
    return !maior || valor > maior.valor ? { mes: atual.mes, valor } : maior;
  }, null);

  const cotistasParaDialog: CotistaAeronave[] = useMemo(
    () => (aeronaveSelecionada ? cotistasAeronave : []),
    [aeronaveSelecionada, cotistasAeronave],
  );

  const formatarValorGrafico = (valor: number) =>
    formatarMoeda(valor).replace(",00", "");
  const mediasPorCotista = useMemo(() => {
    const totais = new Map<string, number>();
    for (const lancamento of despesas) {
      for (const rateio of lancamento.rateios ?? []) {
        const chave = rateio.cotistaId ?? rateio.cotista;
        if (!chave) continue;
        totais.set(chave, (totais.get(chave) ?? 0) + rateio.valorCentavos);
      }
    }
    const meses = Math.max(mesesAplicados.length, 1);
    return cotistasAeronave.map((cotista) => {
      const total = totais.get(cotista.id) ?? 0;
      return {
        id: cotista.id,
        nome: cotista.nome,
        total,
        media: Math.round(total / meses),
      };
    });
  }, [despesas, cotistasAeronave, mesesAplicados]);
  const estiloTooltip = {
    contentStyle: {
      background: "#0f172a",
      border: "1px solid #334155",
      borderRadius: 8,
      color: "#ffffff",
    },
    itemStyle: { color: "#ffffff" },
    labelStyle: { color: "#ffffff" },
  };
  const coresCategorias = [
    "#22d3ee",
    "#60a5fa",
    "#a78bfa",
    "#fbbf24",
    "#34d399",
    "#94a3b8",
  ];

  return (
    <div className="financeiro-shell financeiro-profissional min-w-0 max-w-full space-y-3">
      <style>{DESPESAS_ESTILOS}</style>
      {aeronaveSelecionada && (
        <div className="flex justify-start">
          <Button type="button" variant="ghost" size="sm" className="m-3 h-9 gap-[10px] overflow-hidden rounded-[15px] border-[rgb(64,114,131)] py-[21px] text-[15px]"
            onClick={() => { setAeronaveSelecionada(""); setPaginaAberta(false); }}>
            <Plane size={14} /> Trocar aeronave
          </Button>
        </div>
      )}
      {aeronaveSelecionada && paginaAberta && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 gap-1" onClick={() => setPaginaAberta(false)}>
            <ChevronLeft size={15} /> Voltar
          </Button>
          <div className="financeiro-tabs flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 py-1 px-4" role="tablist" aria-label="Visões do financeiro cotista">
            {abasCotista.map(({ id, rotulo, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === id}
                onClick={() => setAbaAtiva(id as typeof abaAtiva)}
                className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon size={14} />
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {!aeronaveSelecionada ? (
        <section className="space-y-5 py-6">
          <header className="space-y-1.5 text-center">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Selecione uma aeronave para começar</h2>
            <p className="text-sm text-muted-foreground">Os dados financeiros e de cotistas serão carregados após a seleção.</p>
          </header>
          <div className="mx-auto max-w-4xl">
            <Input
              type="search"
              value={buscaMatricula}
              onChange={(e) => setBuscaMatricula(e.target.value)}
              placeholder="Digite a matrícula (ex.: PR-GJM)"
              aria-label="Filtrar aeronaves pela matrícula"
              className="h-10"
            />
          </div>
          {aeronaves.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nenhuma aeronave cadastrada.</p>
          ) : aeronavesFiltradas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nenhuma aeronave encontrada para &quot;{buscaMatricula}&quot;.</p>
          ) : (
            <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {aeronavesFiltradas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAeronaveSelecionada(a.id);
                    setPaginaAberta(false);
                  }}
                  className="group flex items-center gap-4 rounded-xl border border-white/10 bg-card/60 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg"
                >
                  {a.url_imagem ? (
                    <img src={a.url_imagem} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="rounded-lg bg-primary/10 p-3 text-primary transition group-hover:bg-primary/20">
                      <Plane size={20} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{a.matricula_registro}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.modelo}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {paginaAberta && abaAtiva !== "lancamentos" && <section className="financeiro-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="financeiro-eyebrow">CENTRO DE CUSTOS DA AERONAVE</p>
                <p className="mt-1 text-base font-semibold">{aeronaves.find((a) => a.id === aeronaveSelecionada)?.matricula_registro || "Aeronave selecionada"}</p>
                <p className="text-[10px] text-muted-foreground"></p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border sm:grid-cols-4">
                {[
                  ["Lançamentos", String(lancamentosFiltrados.length), ""],
                  ["Total do mês", formatarMoeda(dashboard?.resumo?.saidas ?? 0), ""],
                ].map(([label, value, tone]) => (
                  <div key={label} className="min-w-[104px] px-3 py-2.5 first:pl-3">
                    <p className="text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
                    <p className={`mt-1 font-mono text-xs font-bold ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>}

          {paginaAberta && abaAtiva !== "portal-cliente" && (
            <section className="financeiro-panel px-4 py-3" aria-label="Competência dos lançamentos">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarDays size={16} className="text-muted-foreground" />
                  <span className="text-xs font-semibold">Competência</span>
                  <Button type="button" variant="outline" size="sm" className="h-10 px-3"
                    aria-label="Mês anterior" onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, -1))}>‹</Button>
                  <Input type="month" aria-label="Selecionar competência" value={mesReferencia}
                    onChange={(e) => selecionarMesUnico(e.target.value)} className="h-10 w-[160px] text-sm" />
                  <Button type="button" variant="outline" size="sm" className="h-10 px-3"
                    aria-label="Próximo mês" onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, 1))}>›</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-10 text-xs" onClick={limparMeses}>Mês atual</Button>
                </div>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {mesesAplicados.length === 1 ? rotuloMesCotista(mesReferencia) : `${mesesAplicados.length} meses selecionados`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Selecionar meses">
                <Input type="number" min="1900" max="9999" aria-label="Ano para seleção de meses" value={anoMeses}
                  onChange={(e) => { if (/^\d{4}$/.test(e.target.value)) setAnoMeses(e.target.value); }}
                  className="h-8 w-24" />
                <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                  <Checkbox
                    checked={todosOsMesesSelecionados}
                    onCheckedChange={(marcado) => (marcado ? selecionarTodosOsMeses() : limparMeses())}
                    aria-label={`Selecionar todo o ano ${anoMeses}`}
                  />
                  Ano inteiro
                </label>
                {MESES_CURTOS.map((mes, indice) => {
                  const competencia = mesesDisponiveis[indice];
                  const selecionado = mesesRascunho.includes(competencia);
                  return <button key={competencia} type="button" onClick={() => alternarMes(competencia)}
                    aria-pressed={selecionado} aria-label={`${mes} ${anoMeses}`}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${selecionado ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    {mes}
                  </button>;
                })}
              </div>
            </section>
          )}

          {!paginaAberta ? (
            <div className="!mt-[14px] grid gap-[29px] overflow-hidden rounded-[7px] px-[22px] py-[32px] sm:grid-cols-2 xl:grid-cols-3">
              {abasCotista.map(({ id, rotulo, Icon, corIcone }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAbaAtiva(id as typeof abaAtiva);
                    setPaginaAberta(true);
                  }}
                  className="financeiro-panel flex items-center gap-3 !rounded-[10px] !border-[rgb(64,114,131)] !bg-[rgba(64,70,73,1)] p-4 text-left transition hover:!bg-card"
                >
                  <span className={`rounded-lg p-2.5 ${corIcone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="text-sm font-semibold">{rotulo}</span>
                </button>
              ))}
            </div>
          ) : abaAtiva === "portal-cliente" ? (
            <PortalClienteTab aeronaveId={aeronaveSelecionada} />
          ) : carregando ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : erroDashboard ? (
            <div
              role="alert"
              className="financeiro-panel flex flex-col gap-3 border border-red-500/30 bg-red-500/5 px-4 py-4 sm:flex-row sm:items-center"
            >
              <CircleAlert className="h-4 w-4 shrink-0 text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-300">
                  Não foi possível carregar o financeiro desta aeronave.
                </p>
                <p className="mt-1 break-words text-xs text-red-200/80">
                  {erroDashboard}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void carregar()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              {abaAtiva === "resumo" && (
                <div className="space-y-4">
                  <div className="financeiro-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold">Visão por cotista</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Selecione o cotista para consultar seus dados.</p>
                    </div>
                    <SearchableCombobox
                      items={cotistasAeronave.map((cotista) => ({ id: cotista.id, label: cotista.nome, descricao: `${cotista.eh_holding ? "Holding" : "Cotista"} · ${cotista.percentual_sociedade}%` }))}
                      value={cotistaVisaoId}
                      onChange={(id) => setCotistaVisaoId(id)}
                      placeholder="Selecione um cotista"
                      searchPlaceholder="Buscar cotista..."
                      emptyMessage="Nenhum cotista encontrado."
                      icon={<User size={15} />}
                      disabled={!cotistasAeronave.length}
                      className="w-full border-border bg-background text-foreground hover:bg-muted sm:max-w-sm"
                      popoverClassName="border-border bg-popover text-popover-foreground"
                    />
                  </div>
                </div>
              )}

              {abaAtiva === "resumo" && (
                <FechamentoBalancoDashboardCotista
                  dashboard={dashboard}
                  carregando={carregando}
                  erro={erroDashboard}
                  cotistas={cotistasAeronave}
                  mesesSelecionados={mesesAplicados}
                  visao="cotista"
                  cotistaId={cotistaVisaoId}
                />
              )}
              {abaAtiva === "medias" && (
                <MediasCotista
                  mediasMensais={dashboard?.medias_mensais ?? []}
                  mediasPorCotista={mediasPorCotista}
                  totalAeronave={formatarMoeda(dashboard?.resumo?.saidas ?? 0)}
                  mediaMensal={formatarMoeda(dashboard?.resumo?.media_mensal ?? 0)}
                  mesesConsiderados={mesesAplicados.length}
                />
              )}
              {abaAtiva === "lancamentos" && (
                <LancamentosDespesa
                  lancamentos={lancamentosFiltrados}
                  cotistasAeronave={cotistasAeronave}
                  aoNovo={() => setAberto(true)}
                  aoAtualizar={carregar}
                />
              )}
              {abaAtiva === "extrato" && possuiHolding && (
                <div className="financeiro-panel overflow-hidden">
                  <div className="financeiro-panel-header">
                    <div>
                      <p className="text-sm font-bold">
                        Extrato da conta Holding
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Movimentos bancários e aportes; o rateio econômico
                        permanece na aba de lançamentos.
                      </p>
                    </div>
                  </div>
                  {(dashboard?.movimentos_holding ?? []).length ? (
                    <div className="divide-y divide-border">
                      {dashboard!.movimentos_holding.map((movimento) => {
                        const entrada = [
                          "ENTRADA",
                          "APORTE",
                          "ESTORNO",
                        ].includes(movimento.fluxo.toUpperCase());
                        return (
                          <div
                            key={movimento.id}
                            className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[90px_minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(110px,1fr)_100px_120px] sm:items-center sm:px-4"
                          >
                            <div className="text-muted-foreground">
                              {formatarData(movimento.data)}
                            </div>
                            <div className="min-w-0">
                              <p className="whitespace-pre-wrap break-words font-semibold leading-relaxed [overflow-wrap:anywhere]">
                                {movimento.descricao}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {movimento.categoria || "Sem categoria"} ·{" "}
                                {movimento.holdingNome || "Holding"}
                              </p>
                            </div>
                            <div className="text-muted-foreground">
                              {movimento.socioNome || "Sócio não informado"}
                            </div>
                            <div className="text-muted-foreground">
                              {movimento.contaBancaria || "Conta não informada"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {movimento.status}
                            </div>
                            <div
                              className={`text-right font-mono font-bold ${entrada ? "text-emerald-400" : "text-red-400"}`}
                            >
                              {entrada ? "+" : "−"}
                              {formatarCentavos(movimento.valorCentavos)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                      Nenhum movimento bancário encontrado para esta aeronave.
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === "emprestimos" && (
                <div className="financeiro-panel overflow-hidden">
                  <div className="financeiro-panel-header">
                    <div>
                      <p className="text-sm font-bold">Voos de empréstimo nesta aeronave</p>
                      <p className="text-[10px] text-muted-foreground">
                        Custo do tomador, fora do rateio. Escolha um cotista para ver os voos emprestados em nome dele.
                      </p>
                    </div>
                    <Select
                      value={cotistaEmprestimo}
                      onValueChange={setCotistaEmprestimo}
                    >
                      <SelectTrigger className="h-8 w-full text-[10px] sm:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os cotistas</SelectItem>
                        {cotistasAeronave
                          .filter(
                            (cotista) => cotista.cliente_id || cotista.socio_id,
                          )
                          .map((cotista) => (
                            <SelectItem
                              key={cotista.id}
                              value={`${cotista.socio_id ? "socio" : "cliente"}:${cotista.socio_id || cotista.cliente_id}`}
                            >
                              {cotista.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {gruposEmprestimos.length ? (
                    <div className="divide-y divide-border">
                      {gruposEmprestimos.map(({ mes, itens }) => (
                        <section key={mes}>
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/[.045] px-4 py-2.5">
                            <span className="text-[10px] font-bold capitalize">
                              {rotuloMesCotista(mes)}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {itens.length} voo(s) ·{" "}
                              {itens
                                .reduce(
                                  (total, voo) =>
                                    total + Number(voo.litros || 0),
                                  0,
                                )
                                .toLocaleString("pt-BR", {
                                  maximumFractionDigits: 2,
                                })}{" "}
                              L ·{" "}
                              {formatarMoeda(
                                itens.reduce(
                                  (total, voo) =>
                                    total + Number(voo.valor_total || 0),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          {itens.map((voo) => (
                            <div
                              key={voo.id}
                              className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {voo.numero_voo || "Voo sem número"} ·{" "}
                                  {voo.matricula_registro ||
                                    "Aeronave não informada"}
                                </p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  {formatarData(voo.data)} ·{" "}
                                  {voo.trecho || "Trecho não informado"} ·
                                  Local: {voo.local_icao || voo.local || "—"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-amber-400">
                                  {Number(voo.litros || 0).toLocaleString(
                                    "pt-BR",
                                    { minimumFractionDigits: 2 },
                                  )}{" "}
                                  L
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground">
                                  {formatarMoeda(Number(voo.valor_total || 0))}
                                </p>
                              </div>
                            </div>
                          ))}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                      Nenhum abastecimento de voo empréstimo encontrado no
                      período selecionado.
                    </div>
                  )}
                </div>
              )}
              {abaAtiva === "graficos" && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="financeiro-panel overflow-hidden">
                    <div className="financeiro-panel-header">
                      <p className="text-sm font-semibold">Pagamentos × rateio</p>
                    </div>
                    <div className="h-52 p-4 sm:h-64">
                      {dadosPagamentosRateio.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dadosPagamentosRateio} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#748399" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={formatarValorGrafico} tick={{ fontSize: 10, fill: "#748399" }} axisLine={false} tickLine={false} width={60} />
                            <Tooltip formatter={(valor: number) => formatarMoeda(valor)} {...estiloTooltip} />
                            <Legend align="right" verticalAlign="top" height={28} iconType="square" wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="pagamentos" name="Pago" fill="#08a4c9" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="rateado" name="Rateado" fill="#319b59" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Dados insuficientes para o período.
                        </div>
                      )}
                    </div>
                    {maiorDiferencaPagamentosRateio && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[10px]">
                        <span className="text-muted-foreground">
                          Maior diferença em <b className="text-foreground">{maiorDiferencaPagamentosRateio.mes}: {formatarMoeda(maiorDiferencaPagamentosRateio.valor)}</b>
                        </span>
                        <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary" onClick={() => setAbaAtiva("lancamentos")}>
                          Ver detalhamento <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="financeiro-panel min-w-0 overflow-hidden">
                    <div className="financeiro-panel-header">
                      <div>
                        <p className="text-sm font-bold">Custos por categoria</p>
                      </div>
                    </div>
                    {dadosCategorias.length > 0 ? <>
                    <div className="relative mx-auto h-44 w-full max-w-[220px]">
                      <div className="absolute inset-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={dadosCategorias}
                              dataKey="valor"
                              nameKey="nome"
                              innerRadius="62%"
                              outerRadius="88%"
                              paddingAngle={2}
                            >
                              {dadosCategorias.map((item, i) => (
                                <Cell key={item.nome} fill={coresCategorias[i % coresCategorias.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatarMoeda(v)} {...estiloTooltip} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <strong className="font-mono text-sm font-bold">{totalCategoriasCompacto}</strong>
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Total</span>
                      </div>
                    </div>
                    <div className="px-4 pb-3">
                      {dadosCategorias.map((item, i) => (
                        <div key={item.nome} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-border/70 py-2 text-[10px]">
                          <span className="flex min-w-0 items-center gap-2">
                            <i className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: coresCategorias[i % coresCategorias.length] }} />
                            <span className="truncate">{item.nome}</span>
                          </span>
                          <span className="font-mono text-muted-foreground">{formatarMoeda(item.valor)}</span>
                          <strong className="w-12 text-right font-mono">
                            {totalCategorias > 0 ? ((item.valor / totalCategorias) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%
                          </strong>
                        </div>
                      ))}
                    </div>
                    </> : (
                      <div className="flex h-44 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        Dados insuficientes para o período.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {abaAtiva === "graficos" && (
                <FechamentoBalancoDashboardCotista
                  dashboard={dashboard}
                  carregando={carregando}
                  erro={erroDashboard}
                  cotistas={cotistasAeronave}
                  mesesSelecionados={mesesAplicados}
                  visao="graficos"
                />
              )}

              {abaAtiva === "ranking" && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="financeiro-panel overflow-hidden">
                    <div className="financeiro-panel-header">
                      <div>
                        <p className="text-sm font-bold">Ranking de gastos</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Categorias e totais separados por mês
                        </p>
                      </div>
                    </div>
                    {rankingGastosPorMes.length ? (
                      <div className="divide-y divide-border">
                        {rankingGastosPorMes.map(({ mes, itens }) => (
                          <section key={mes}>
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/[.045] px-4 py-2.5">
                              <span className="text-[10px] font-bold capitalize">
                                {rotuloMesCotista(mes)}
                              </span>
                              <span className="font-mono text-[9px] text-muted-foreground">
                                {itens.length} categoria(s) ·{" "}
                                {formatarCentavos(
                                  itens.reduce(
                                    (total, item) => total + item.valor,
                                    0,
                                  ),
                                )}
                              </span>
                            </div>
                            {itens.map((g, i) => (
                              <div
                                key={`${mes}-${g.categoria}`}
                                className="flex items-center gap-3 border-t border-border/60 px-4 py-3"
                              >
                                <span className="w-5 font-mono text-xs font-bold text-primary">
                                  {i + 1}º
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold">
                                    {g.categoria}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {g.grupo || "Sem grupo"} · {g.quantidade}{" "}
                                    lançamento(s)
                                  </p>
                                </div>
                                <span className="font-mono text-xs font-bold">
                                  {formatarCentavos(g.valor)}
                                </span>
                              </div>
                            ))}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                        Ainda não há gastos no período selecionado.
                      </div>
                    )}
                  </div>
                  <div className="financeiro-panel overflow-hidden">
                    <div className="financeiro-panel-header">
                      <p className="text-sm font-bold">Ranking de cotistas</p>
                    </div>
                    <div className="divide-y divide-border">
                      {(dashboard?.ranking_cotistas ?? []).length ? (
                        dashboard!.ranking_cotistas.map((r, i) => (
                          <div
                            key={`${r.cotista}-${i}`}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <span className="w-5 font-mono text-xs font-bold text-primary">
                              {i + 1}º
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">
                                {r.cotista}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {r.quantidade} lançamento(s)
                              </p>
                            </div>
                            <div className="text-right text-[10px]">
                              <p className="font-mono text-red-400">
                                Dev.: {formatarCentavos(r.devido)}
                              </p>
                              <p className="font-mono text-emerald-400">
                                Pago: {formatarCentavos(r.pago)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                          Ainda não há rateios registrados.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {aeronaveSelecionada && (
        <NovoLancamentoCotistaDialog
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          opcoes={opcoes}
          cotistasAeronave={cotistasParaDialog}
          aeronaveId={aeronaveSelecionada}
          aoCriar={carregar}
        />
      )}
      <Dialog open={Boolean(participacaoEditando)} onOpenChange={(open) => { if (!open && !salvandoParticipacao) setParticipacaoEditando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar participação do cotista</DialogTitle>
            <DialogDescription>Atualize a aeronave vinculada e o percentual da cota de {participacaoEditando?.nome}. Alterar aeronave é bloqueado quando existe histórico financeiro associado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="cotista-aeronave-editada">Aeronave</Label><select id="cotista-aeronave-editada" value={aeronaveEditada} onChange={(event) => setAeronaveEditada(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro} · {aeronave.modelo}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="cotista-percentual-editado">Percentual da cota (%)</Label><Input id="cotista-percentual-editado" type="number" min="0" max="100" step="0.01" value={percentualEditado} onChange={(event) => setPercentualEditado(event.target.value)} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={salvandoParticipacao} onClick={() => setParticipacaoEditando(null)}>Cancelar</Button><Button type="button" disabled={salvandoParticipacao} onClick={() => void salvarParticipacao()}>{salvandoParticipacao ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
