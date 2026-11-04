import { DarBaixaCotistaDialog } from "./DarBaixaCotistaDialog";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  PieChart,
  Landmark,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Coins,
  MoreHorizontal,
  Search,
  ExternalLink,
  KeyRound,
  Filter,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Undo2,
  EyeOff,
  RotateCcw,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { ESTILOS_FINANCEIRO } from "@/components/financeiro-share/LancamentosUnificados";
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
import { useFornecedores } from "@/hooks/useFornecedores";
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
import {
  documentoDoLancamento,
  nomeFornecedorLancamento,
  nomePagadoresDoLancamento,
  opcaoFornecedorLancamento,
  rateioDoCotista,
  tipoRateioLancamento,
  valorPagoLancamento,
} from "@/lib/financeiro-cotista-lancamentos";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { allocateCentavos } from "@/lib/money";
import {
  buscarAeronavesShare,
  buscarCotistasAeronave,
  buscarOpcoesEnvioPagamento,
  atualizarParticipacaoCotista,
  excluirParticipacaoCotista,
} from "@/lib/colaborador-api";
import { PortalClienteTab } from "./PortalClienteTab";
import { FechamentoBalancoDashboardCotista } from "./FechamentoBalancoDashboardCotista";
import { FechamentoBalancoReferencia } from "./FechamentoBalancoReferencia";
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
  --tab-abrir-duracao: 320ms; --tab-fechar-duracao: 380ms;
  --tab-abrir-atraso: 140ms; --tab-fechar-atraso: 220ms;
  --tab-easing: cubic-bezier(.4,0,.2,1);
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
.financeiro-profissional .financeiro-tabs { padding:4px 8px; gap:4px; border-width:0; border-radius:0; background-color:transparent; }
.financeiro-tab { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; min-width:40px; padding:0 10px; border:0; border-radius:8px; background:transparent; color:hsl(var(--muted-foreground)); font-size:12px; font-weight:600; white-space:nowrap; flex-shrink:0; cursor:pointer; box-shadow:none; }
.financeiro-tab-label { display:inline-block; max-width:160px; opacity:1; overflow:hidden; white-space:nowrap; }
.financeiro-tab.is-active { gap:8px; background:hsl(var(--card)); color:hsl(var(--primary)); box-shadow:0 1px 2px rgba(0,0,0,.2); }
.financeiro-tab.is-active .financeiro-tab-label { max-width:160px; opacity:1; }
@media (hover:hover) {
  .financeiro-tab:not(.is-active):hover { gap:8px; background:hsl(var(--muted)); color:hsl(var(--foreground)); }
  .financeiro-tab:not(.is-active):hover .financeiro-tab-label { max-width:160px; opacity:1; }
}
.financeiro-tab:not(.is-active):focus-visible { gap:8px; color:hsl(var(--foreground)); outline:2px solid hsl(var(--ring)); outline-offset:2px; }
.financeiro-tab:not(.is-active):focus-visible .financeiro-tab-label { max-width:160px; opacity:1; }
.financeiro-profissional .financeiro-tab { transition:background-color var(--tab-fechar-duracao) var(--tab-easing) var(--tab-fechar-atraso), color var(--tab-fechar-duracao) var(--tab-easing) var(--tab-fechar-atraso), gap var(--tab-fechar-duracao) var(--tab-easing) var(--tab-fechar-atraso); }
.financeiro-profissional .financeiro-tab-label { transition:max-width var(--tab-fechar-duracao) var(--tab-easing) var(--tab-fechar-atraso), opacity var(--tab-fechar-duracao) var(--tab-easing) var(--tab-fechar-atraso); }
.financeiro-profissional .financeiro-tab:is(:hover,:focus-visible,.is-active),
.financeiro-profissional .financeiro-tab:is(:hover,:focus-visible,.is-active) .financeiro-tab-label { transition-duration:var(--tab-abrir-duracao); transition-delay:var(--tab-abrir-atraso); }
.financeiro-profissional .financeiro-tab.is-active,
.financeiro-profissional .financeiro-tab.is-active .financeiro-tab-label { transition-delay:0s; }
@media (prefers-reduced-motion:reduce) {
  .financeiro-profissional .financeiro-tab,
  .financeiro-profissional .financeiro-tab:is(:hover,:focus-visible,.is-active),
  .financeiro-profissional .financeiro-tab-label,
  .financeiro-profissional .financeiro-tab:is(:hover,:focus-visible,.is-active) .financeiro-tab-label { transition:none; }
}
.financeiro-profissional :is(input,button,[role="combobox"]) { box-shadow:none; }
.financeiro-profissional :is(input,[role="combobox"]) { border-radius:4px; background:hsl(var(--card)); }
.despesas-shell { min-width:0; width:100%; max-width:100%; contain:inline-size; }
.despesas-theme .text-muted-foreground { color:hsl(var(--muted-foreground)); }
.despesas-theme .text-foreground { color:hsl(var(--foreground)); }
.despesas-theme .text-primary { color:hsl(var(--primary)); }
.despesas-theme .border-border { border-color:hsl(var(--border)); }
.despesas-theme .bg-background { background:hsl(var(--background)); }
.despesas-theme .bg-card { background:hsl(var(--card)); }
.despesas-theme :is(input,textarea,[role="combobox"]) { min-width:0; max-width:100%; border-color:hsl(var(--input)); background:hsl(var(--card)); color:hsl(var(--foreground)); border-radius:4px; box-shadow:none; }
.despesas-theme :is(input,textarea)::placeholder { color:hsl(var(--muted-foreground)); }
.despesas-theme {
  --bg-page:#090d13; --bg-surface:#111820; --bg-hover:#151d27; --bg-selected:#164d6d;
  --ledger-border:#293542; --text:#e1e7ef; --text-muted:#9ba9ba; --ledger-accent:#1599df;
  --success:#3fb27f; --danger:#f53228e0; --warning:#f3e141d3;
  --row-height:40px; --header-height:32px; --toolbar-height:36px;
  --font-mono:ui-monospace,SFMono-Regular,Consolas,monospace;
}
.despesas-theme :focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:2px; }
.despesas-theme .despesa-ledger :focus-visible { outline:2px solid var(--ledger-accent); outline-offset:2px; }
.despesas-theme .despesa-toolbar .despesa-primary { height:32px; padding:0 10px; background:#167fb5; border:1px solid #167fb5; border-radius:4px; color:#fff; font-size:12px; font-weight:600; box-shadow:none; }
.despesas-theme .despesa-toolbar .despesa-primary:hover { background:#167fb5; filter:brightness(.92); }
.despesas-theme .despesa-ledger { min-width:0; width:100%; max-width:100%; overflow:clip; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-page); color:var(--text); font-size:13px; line-height:1.4; font-variant-numeric:tabular-nums; }
.despesa-toolbar { display:flex; flex-direction:column; gap:6px; min-height:var(--toolbar-height); padding:6px 8px; border:1px solid var(--ledger-border); border-radius:4px; background:#0d131b; overflow:visible; }
.despesa-toolbar-main { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 16px; min-width:0; }
.despesa-toolbar-actions { display:flex; flex:1 1 450px; flex-wrap:wrap; align-items:center; gap:6px; min-width:0; }
.despesa-control { display:inline-flex; flex-shrink:0; align-items:center; justify-content:center; gap:6px; height:32px; padding:0 10px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-surface); color:var(--text); font-size:12px; font-weight:500; white-space:nowrap; cursor:pointer; }
.despesa-control svg { flex-shrink:0; }
.despesa-control:hover,.despesa-control[aria-expanded="true"] { background:var(--bg-hover); }
.despesa-control:disabled { opacity:.4; cursor:not-allowed; }
.despesa-control-icon { width:32px; padding:0; }
.despesa-control-quiet { border-color:transparent; background:transparent; color:var(--text-muted); }
.despesa-toolbar-divider { width:1px; height:20px; background:var(--ledger-border); margin:0 3px; }
.despesa-period { display:flex; align-items:center; flex:0 1 auto; gap:6px; min-width:0; max-width:100%; margin-left:auto; }
.despesa-month-switcher { display:flex; min-width:0; align-items:center; gap:6px; }
.despesa-current-month { display:flex; min-width:140px; flex-direction:column; align-items:center; justify-content:center; gap:0; }
.despesa-period-label { min-width:140px; text-align:center; font-size:12px; font-weight:600; line-height:24px; border-bottom:2px solid var(--ledger-accent); text-transform:capitalize; overflow-wrap:anywhere; }
.despesa-close-month { border-color:#14866d; background:#116f5c; color:#fff; }
.despesa-close-month:hover:not(:disabled) { border-color:#1b9b7d; background:#14866d; }
.despesa-filter-count { display:inline-flex; min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px; border-radius:3px; background:rgba(31,143,214,.15); color:var(--ledger-accent); font-size:10px; }
.despesa-filter-panel { display:grid; grid-template-columns:minmax(180px,2fr) minmax(140px,1.2fr) minmax(140px,1.2fr) auto; align-items:end; gap:8px; min-width:0; margin-top:8px; padding:8px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-surface); }
.despesa-filter-panel > * { min-width:0; }
.despesa-filter-panel label:not(.sr-only) { display:block; margin-bottom:0; font-size:11px; color:var(--text-muted); }
.despesa-filter-panel :is(input,[role="combobox"]) { height:32px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-page); color:var(--text); font-size:12px; }
.despesa-search-field { position:relative; flex-grow:2; }
.despesa-filter-clear { display:flex; min-height:36px; align-items:center; white-space:nowrap; }
.despesa-search-field > svg { position:absolute; top:10px; left:10px; pointer-events:none; color:var(--text-muted); }
.despesa-month-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; margin-top:8px; }
.despesa-month-choice { min-width:0; min-height:32px; border:1px solid var(--ledger-border); border-radius:4px; color:var(--text-muted); background:var(--bg-page); font-size:12px; }
.despesa-month-choice:hover { background:var(--bg-hover); }
.despesa-month-choice[aria-pressed="true"] { color:var(--text); background:var(--bg-selected); border-color:var(--ledger-accent); }
.despesa-selected-months { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.despesa-selected-months button { display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:4px 8px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-surface); color:var(--text); font-size:11px; text-transform:capitalize; overflow-wrap:anywhere; }
.despesa-selected-months button:disabled { opacity:.6; cursor:not-allowed; }
.despesa-columns-menu { width:min(260px,calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:min(var(--radix-dropdown-menu-content-available-height,calc(100dvh - 24px)),440px); overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }
.despesa-columns-menu-heading { position:sticky; top:-4px; z-index:1; margin:0; border-bottom:1px solid var(--ledger-border); background:var(--bg-surface); }
.despesa-column-option { display:flex; min-height:36px; align-items:center; gap:9px; padding:7px 8px; font-size:12px; cursor:pointer; }
.despesa-column-option input { accent-color:var(--ledger-accent); }
/* This is the only horizontal scroll viewport. Fixed column widths never size the parent. */
.despesa-table-scroll { container-type:inline-size; width:100%; min-width:0; max-width:100%; overflow:auto; max-height:68vh; max-height:68dvh; overscroll-behavior-x:contain; scrollbar-color:#3a4350 var(--bg-page); scrollbar-width:thin; border:1px solid var(--ledger-border); border-radius:4px; touch-action:pan-x pan-y; cursor:grab; }
.despesa-table-scroll::-webkit-scrollbar { width:8px; height:8px; }
.despesa-table-scroll::-webkit-scrollbar-track { background:var(--bg-page); }
.despesa-table-scroll::-webkit-scrollbar-thumb { background:#3a4350; border:2px solid var(--bg-page); border-radius:6px; }
.despesa-table-scroll[data-dragging="true"] { cursor:grabbing; user-select:none; }
.despesa-table { min-width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; font-size:13px; line-height:1.4; font-variant-numeric:tabular-nums; text-align:left; color:var(--text); }
.despesa-table th,.despesa-table td { box-sizing:border-box; }
.despesa-table > thead > tr > th { position:sticky; top:0; z-index:3; height:var(--header-height); padding:0 14px; background:var(--bg-surface); border-bottom:1px solid var(--ledger-border); border-right:1px solid var(--ledger-border); color:var(--text-muted); font-size:10px; line-height:1.4; font-weight:700; letter-spacing:.8px; text-transform:uppercase; vertical-align:middle; }
.despesa-table > thead > tr > th:last-child { border-right:0; }
.despesa-sort { display:flex; width:100%; min-width:0; align-items:center; justify-content:space-between; gap:8px; color:inherit; font:inherit; letter-spacing:inherit; text-transform:inherit; text-align:left; }
.despesa-sort > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.despesa-sort > svg { flex-shrink:0; color:var(--text-muted); }
.despesa-sort[data-active="true"] { color:var(--ledger-accent); }
.despesa-sort small { display:block; margin-top:2px; font-size:9px; font-weight:400; letter-spacing:0; text-transform:none; }
.despesa-table .despesa-row { --row-bg:var(--bg-page); height:var(--row-height); background:var(--row-bg); }
.despesa-table .despesa-row:hover { --row-bg:var(--bg-hover); }
.despesa-table .despesa-row[data-expanded="true"],.despesa-table .despesa-row[data-selected="true"] { --row-bg:var(--bg-selected); }
.despesa-table .despesa-row td { padding:0 14px; background:var(--row-bg); vertical-align:middle; border-right:1px solid var(--ledger-border); border-bottom:1px solid var(--ledger-border); overflow-wrap:anywhere; }
.despesa-table .despesa-row td:last-child { border-right:0; }
.despesa-table .despesa-row td:last-child { padding:0 10px; }
.despesa-table > thead > tr > th:first-child,.despesa-table .despesa-row td:first-child { padding:0 8px; text-align:center; }
.despesa-table .despesa-month th { height:32px; padding:0 14px; background:var(--bg-hover); border-bottom:1px solid var(--ledger-border); font-size:12px; font-weight:600; text-align:left; }
.despesa-col-resizer { position:absolute; top:0; right:0; width:8px; height:100%; cursor:col-resize; touch-action:none; z-index:5; }
.despesa-col-resizer:hover,.despesa-col-resizer:focus-visible { background:rgba(31,143,214,.4); }
.despesa-cell-text { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.despesa-row .despesa-money,.despesa-rateio-value { font-family:var(--font-mono); font-size:13px; font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
.despesa-row .despesa-money { display:block; text-align:right; }
.despesa-rateio-cell { display:flex; flex-direction:column; align-items:flex-end; gap:2px; white-space:nowrap; font-size:11px; font-variant-numeric:tabular-nums; }
.despesa-date-group { display:grid; gap:5px; font-size:12px; font-variant-numeric:tabular-nums; }
.despesa-date-group span { display:block; white-space:nowrap; }
.despesa-date-group small { display:block; margin-bottom:1px; color:var(--text-muted); font-size:9px; line-height:1.2; }
.despesa-date-mode { display:flex; min-height:18px; align-items:center; justify-content:center; gap:4px; padding:0 5px; border-color:transparent; background:transparent; color:var(--text-muted); font-size:8px; white-space:nowrap; }
.despesa-date-mode:hover,.despesa-date-mode[aria-expanded="true"] { border-color:var(--ledger-border); background:var(--bg-hover); color:var(--text); }
.despesa-date-mode-copy { display:block; line-height:1.2; }
.despesa-date-mode-copy small { color:inherit; font-size:8px; font-weight:700; letter-spacing:.06em; }
.despesas-theme .despesa-checkbox { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; min-width:16px; padding:0; border:1px solid #3a4350; border-radius:3px; background:var(--bg-page); color:#fff; box-shadow:none; }
.despesas-theme .despesa-checkbox[data-state="checked"],.despesas-theme .despesa-checkbox[data-state="indeterminate"] { background:var(--ledger-accent); border-color:var(--ledger-accent); }
.despesa-checkbox svg { width:12px; height:12px; }
.despesa-checkbox[data-state="indeterminate"] svg { display:none; }
.despesa-checkbox[data-state="indeterminate"]::after { content:""; width:8px; height:2px; background:currentColor; }
.despesas-theme .despesa-status { display:inline-flex; align-items:center; gap:4px; max-width:100%; height:20px; padding:0 6px; border:0; border-radius:3px; background:transparent; color:var(--text-muted); font-size:11px; font-weight:500; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.despesas-theme .despesa-status[data-status="EM_ABERTO"] { color:var(--warning); background:rgba(212,167,44,.12); }
.despesas-theme .despesa-status[data-status="EM_ATRASO"] { color:var(--danger); background:rgba(229,83,75,.12); }
.despesas-theme .despesa-status[data-status="PAGO"],.despesas-theme .despesa-status[data-status="PAGO_DIRETAMENTE"],.despesas-theme .despesa-status[data-status="REEMBOLSADO"] { color:var(--success); background:rgba(63,178,127,.12); }
.despesas-theme .despesa-status[data-status="ESTORNO"] { color:#fdba74; background:rgba(253,186,116,.12); }
.despesas-theme .despesa-status[data-status="SAIDA"] { color:#c0cada; background:rgba(192,202,218,.12); }
.despesas-theme .despesa-status[data-status="AGUARDANDO_REEMBOLSO"] { color:#c4b5fd; background:rgba(196,181,253,.12); }
.despesas-theme .despesa-status[data-status="CANCELADO"] { color:#b3b3bf; background:rgba(179,179,191,.12); }
.despesa-summary { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 16px; min-width:0; min-height:36px; padding:0 12px; border:0; border-top:1px solid var(--ledger-border); background:var(--bg-hover); font-size:11px; font-weight:600; color:var(--text-muted); }
.despesa-summary-values { display:flex; flex-wrap:wrap; gap:4px 16px; min-width:0; overflow-wrap:anywhere; }
.despesa-summary-values > span { font-family:var(--font-mono); font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; }
.despesa-pagination { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px; min-width:0; min-height:32px; padding:4px 12px; font-size:12px; color:var(--text-muted); }
.despesa-pagination-info { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; min-width:0; }
.despesa-pagination > nav { display:flex; align-items:center; gap:4px; margin-left:auto; }
.despesa-pagination select { height:28px; max-width:100%; padding:0 6px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-page); color:var(--text); font-size:12px; }
.despesa-pagination button { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-surface); color:var(--text); }
.despesa-pagination button:hover { background:var(--bg-hover); }
.despesa-pagination button:disabled { opacity:.35; cursor:not-allowed; }
.despesa-expanded-content { position:sticky; left:0; width:100%; width:calc(100cqi - 2px); max-width:100%; }
.cotista-expanded { position:sticky; left:0; width:100%; width:calc(100cqi - 2px); max-width:100%; padding:0 18px 16px; border-left:3px solid #168fca; border-bottom:1px solid #d9e0e9; background:#f3f5f9; color:#243246; }
.expanded-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:11px 0 12px; border-bottom:1px solid #d5dde7; }
.expanded-heading .panel-kicker { display:block; color:#168fca; font-size:9px; font-weight:700; letter-spacing:.08em; }
.expanded-heading h3 { margin:3px 0 0; color:#263548; font-size:12px; font-weight:600; }
.expanded-support-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,.9fr); gap:0; padding-top:12px; }
.expanded-support-grid > * { min-width:0; padding:0 15px; }
.expanded-support-grid > :first-child { padding-left:0; }
.expanded-support-grid > :last-child { padding-right:0; }
.expanded-support-grid > * + * { border-left:1px solid #d5dde7; }
.detail-block-title { display:block; margin-bottom:9px; color:#75849a; font-size:8px; font-weight:700; letter-spacing:.08em; }
.document-list { display:flex; flex-wrap:wrap; align-items:flex-start; gap:6px; }
.document-list button { display:inline-flex; min-width:0; max-width:100%; min-height:32px; align-items:center; gap:6px; padding:5px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; color:#29384b; font-size:9px; text-align:left; cursor:pointer; transition:border-color .15s,background-color .15s; }
.document-list button:hover { border-color:#168fca; background:#f5fbff; }
.document-icon { display:flex; width:15px; height:17px; flex:0 0 15px; align-items:center; justify-content:center; color:#61738a; }
.document-icon.is-receipt { color:#25856d; }
.document-copy { display:block; min-width:0; }
.document-copy b { display:block; overflow:hidden; color:#29384b; font-size:9px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.document-copy small,.document-open-icon { display:none; }
.support-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:16px; row-gap:10px; }
.support-facts .detail-block-title { grid-column:1 / -1; margin-bottom:0; }
.support-facts p { display:flex; min-width:0; flex-direction:column; gap:3px; margin:0; font-size:10px; }
.support-facts p b { color:#34445a; font-size:9px; font-weight:600; }
.support-facts p small { color:#7a8798; font-size:9px; overflow-wrap:anywhere; }
.support-note { min-height:100%; }
.support-note p { margin:0; color:#78869a; font-size:9px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.dark .despesas-theme .cotista-expanded { border-bottom-color:var(--ledger-border); background:var(--bg-surface); color:var(--text); }
.dark .despesas-theme .expanded-heading { border-bottom-color:var(--ledger-border); }
.dark .despesas-theme .expanded-heading h3 { color:var(--text); }
.dark .despesas-theme .expanded-support-grid > * + * { border-left-color:var(--ledger-border); }
.dark .despesas-theme .detail-block-title { color:var(--text-muted); }
.dark .despesas-theme .document-list button { border-color:var(--ledger-border); background:var(--bg-page); color:var(--text); }
.dark .despesas-theme .document-list button:hover { border-color:var(--ledger-accent); background:var(--bg-hover); }
.dark .despesas-theme .document-icon { color:var(--text-muted); }
.dark .despesas-theme .document-copy b { color:var(--text); }
.dark .despesas-theme .support-facts p b { color:var(--text); }
.dark .despesas-theme .support-facts p small,.dark .despesas-theme .support-note p { color:var(--text-muted); }
.dark .despesas-theme .expanded-support-grid > :nth-child(3) { border-top-color:var(--ledger-border); }
.despesa-empty { min-width:0; padding:30px 16px; text-align:center; color:var(--text-muted); }
.despesa-dialog { background:hsl(var(--card)); border-color:hsl(var(--border)); }
@media(max-width:900px) {
  .expanded-support-grid { grid-template-columns:repeat(2,minmax(0,1fr)); row-gap:14px; }
  .expanded-support-grid > :nth-child(3) { grid-column:1 / -1; min-height:0; padding:12px 0 0; border-top:1px solid #d5dde7; border-left:0; }
  .expanded-support-grid > :nth-child(2) { border-left:1px solid #d5dde7; }
  .despesa-filter-panel { grid-template-columns:minmax(160px,1.5fr) minmax(130px,1fr) minmax(130px,1fr) auto; }
}
@media(max-width:760px) {
  .despesa-toolbar { padding:8px; gap:6px; }
  .despesa-period { margin-left:0; }
}
@media(max-width:640px) {
  .despesa-toolbar-actions { flex-basis:100%; gap:6px; }
  .despesa-toolbar-divider { display:none; }
  .despesa-period { flex:1 1 100%; flex-wrap:wrap; justify-content:space-between; margin-left:0; }
  .despesa-month-switcher { flex:1 1 auto; justify-content:center; }
  .despesa-period-label { min-width:0; }
  .despesa-close-month { margin-left:auto; }
  .despesa-filter-panel { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .despesa-search-field,.despesa-filter-clear { grid-column:1 / -1; }
  .cotista-expanded { padding:0 12px 14px; }
  .expanded-support-grid { grid-template-columns:minmax(0,1fr); gap:12px; }
  .expanded-support-grid > *,.expanded-support-grid > :first-child,.expanded-support-grid > :last-child { padding:0; border:0; }
  .expanded-support-grid > * + * { padding-top:11px; border-top:1px solid #d5dde7; }
  .expanded-support-grid > :nth-child(3) { grid-column:auto; min-height:0; padding-top:11px; border-top:1px solid #d5dde7; }
  .despesa-month-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .despesa-table-scroll { max-height:65dvh; }
  .despesa-pagination { font-size:11px; }
}
@media(max-width:420px) {
  .despesa-filter-panel { grid-template-columns:minmax(0,1fr); }
  .despesa-search-field,.despesa-filter-clear { grid-column:auto; }
}
@media(prefers-reduced-motion:reduce) { .despesas-theme * { transition:none!important; } }
@media print {
  .despesas-theme { --bg-page:#fff; --bg-surface:#f2f2f2; --bg-hover:#f2f2f2; --bg-selected:#f2f2f2; --ledger-border:#ccc; --text:#000; --text-muted:#444; }
  .despesa-toolbar,.despesa-filter-panel,.despesa-pagination { display:none; }
}

`;

function deslocarMes(competencia: string, deslocamento: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + deslocamento, 1, 12);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

function SeletorMesesCotista({
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
        <button type="button" className="despesa-control inline-flex items-center gap-1.5" aria-expanded={aberto}>
          Mês Atual <ChevronDown size={12} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="despesas-theme w-[290px] border-border bg-popover p-3 text-popover-foreground">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" className="despesa-control despesa-control-icon" aria-label="Ano anterior" onClick={() => setAno((valor) => Math.max(1900, valor - 1))}><ChevronLeft size={14} /></button>
            <strong className="min-w-10 text-center text-sm tabular-nums">{ano}</strong>
            <button type="button" className="despesa-control despesa-control-icon" aria-label="Próximo ano" onClick={() => setAno((valor) => Math.min(9999, valor + 1))}><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Meses de ${ano}`}>
          {MESES_CURTOS.map((mes, indice) => {
            const competencia = `${ano}-${String(indice + 1).padStart(2, "0")}`;
            const selecionado = mesesSelecionados.includes(competencia);
            return (
              <button key={competencia} type="button" aria-pressed={selecionado} onClick={() => aoAlternar(competencia)} className="despesa-month-choice">
                {mes}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Selecione um ou mais meses.</span>
          <button type="button" className="despesa-control h-[30px] px-2 text-[11px]" onClick={() => { aoSelecionarMesAtual(); setAberto(false); }}>
            Mês atual
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function hoje() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

type RateioDraft = { cotista: string; percentual: string };

function percentualNumerico(valor: string) {
  const normalizado = valor.trim().replace(",", ".");
  return normalizado ? Number(normalizado) : NaN;
}

function dividirPorSociedade(
  ids: string[],
  cotistas: CotistaAeronave[],
): RateioDraft[] {
  if (!ids.length) return [{ cotista: "", percentual: "100" }];
  const pesos = ids.map((id) =>
    Number(cotistas.find((c) => c.id === id)?.percentual_sociedade || 0),
  );
  const soma = pesos.reduce((total, peso) => total + peso, 0);
  if (soma <= 0) return dividirPercentuais(ids);
  return ids.map((cotista, index) => ({
    cotista,
    percentual: String((pesos[index] / soma) * 100),
  }));
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
                    <p className="text-xs font-semibold">
                      Prévia do valor rateado por participante
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {rateios.map((rateio, index) => {
                        const pessoa = (
                          modo === "CLIENTE" ? cotistasCliente : cotistasHolding
                        ).find((item) => item.id === rateio.cotista);
                        return (
                          <div
                            key={`${rateio.cotista}-${index}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {pessoa?.nome ||
                                `${modo === "CLIENTE" ? "Cotista" : "Sócio"} ${index + 1}`}{" "}
                              · {rateio.percentual || "0"}%
                            </span>
                            <strong className="shrink-0 tabular-nums">
                              {valorPreviewRateios
                                ? formatarCentavos(valorPreviewRateios[index])
                                : "—"}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                    {valorPreviewRateios &&
                      valorPreviewRateios.some(
                        (parte) => parte !== valorPreviewRateios[0],
                      ) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Os centavos residuais são distribuídos para que a soma
                          seja exatamente o valor total da despesa.
                        </p>
                      )}
                    {pagoDiretamenteCliente && modo === "CLIENTE" && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        O pagador indicado permanece responsável pelo pagamento
                        integral; os demais rateios registram apenas sua parte e
                        continuam sem valor pago.
                      </p>
                    )}
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
              style={{
                backgroundColor: "rgba(9, 50, 71, 1)",
                borderColor: "rgba(6, 54, 78, 1)",
                borderRadius: 12,
                overflow: "hidden",
              }}
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
  {
    value: "AGUARDANDO_REEMBOLSO",
    label: "Aguardando reembolso",
    Icon: Clock3,
  },
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

const TIPOS_DOCUMENTO_COTISTA = [
  { valor: "demonstrativo", rotulo: "Demonstrativo" },
  { valor: "nota", rotulo: "Nota fiscal" },
  { valor: "recibo", rotulo: "Recibo" },
  { valor: "documento", rotulo: "Documento" },
] as const;

const TITULOS_FILTRO_CABECALHO: Record<string, string> = {
  data: "data",
  documento: "tipo de documento",
  categoria: "categoria",
  status: "status",
};

function tipoDocumentoLancamento(lancamento: LancamentoEconomico) {
  if (lancamento.numeroDemonstrativo) return "demonstrativo";
  if (lancamento.documentoNumero) return "documento";
  if (lancamento.numeroNf) return "nota";
  if (lancamento.numeroRecibo) return "recibo";
  if (lancamento.numeroDoc || lancamento.documento) return "documento";
  return null;
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
  const tituloDocumento = (documento: {
    nome?: string;
    tipo?: string | null;
    url: string;
  }) => {
    const tipo = (documento.tipo || "").toLowerCase();
    const nome = (documento.nome || "").trim();
    const rotulos: Record<string, string> = {
      comprovante: "Comprovante",
      comprovante_pagamento: "Comprovante de pagamento",
      nota_fiscal: "Nota fiscal",
      nf: "Nota fiscal",
      recibo: "Recibo",
      relatorio: "Relatório",
      relatorio_despesa_viagem: "Relatório de viagem",
      boleto: "Boleto",
      demonstrativo: "Demonstrativo",
    };
    if (nome && !["documento", "arquivo", "anexo"].includes(nome.toLowerCase()))
      return nome;
    if (rotulos[tipo]) return rotulos[tipo];
    if (/relatorio[_-]despesa[_-]viagem|pdf_relatorios/i.test(documento.url))
      return "Relatório de viagem";
    return nome || "Documento";
  };
  const documentosLegados = [
    { nome: "Documento", url: lancamento.urlDoc, numero: lancamento.numeroDoc },
    { nome: "Nota fiscal", url: lancamento.urlNf, numero: lancamento.numeroNf },
    {
      nome: "Recibo",
      url: lancamento.urlRecibo,
      numero: lancamento.numeroRecibo,
    },
    {
      nome: "Demonstrativo",
      url: lancamento.urlDemonstrativo,
      numero: lancamento.numeroDemonstrativo,
    },
    { nome: "Boleto", url: lancamento.urlBoleto, numero: null },
  ].filter(
    (
      item,
    ): item is {
      nome: string;
      url: string;
      numero: string | null | undefined;
    } => Boolean(item.url),
  );
  const documentosGerais = [
    ...(lancamento.documentos ?? []),
    ...documentosLegados,
  ]
    .filter(
      (doc, index, todos) =>
        todos.findIndex((outro) => outro.url === doc.url) === index,
      );
  const documentosExpansao = [
    ...documentosGerais.map((documento) => ({ ...documento, responsavel: "" })),
    ...(lancamento.rateios ?? []).flatMap((rateio) =>
      (rateio.documentos ?? []).map((documento) => ({
        ...documento,
        responsavel: rateio.cotista || "Cotista",
      })),
    ),
  ].filter(
    (documento, index, todos) =>
      Boolean(documento.url) &&
      todos.findIndex((outro) => outro.url === documento.url) === index,
  );
  const dadosComplementares = [
    ["Número do voo", lancamento.numeroVoo || "Não vinculado"],
    ["Número do recibo", lancamento.numeroRecibo || "Não informado"],
    ["Número da NF", lancamento.numeroNf || "Não informado"],
    ["Periodicidade", lancamento.periodicidade || "Único"],
    ["Subcategoria", lancamento.subcategorias?.join(" · ") || "Não informada"],
  ];

  return (
    <div className="cotista-expanded">
      <div className="expanded-heading">
        <div>
          <span className="panel-kicker">INFORMAÇÕES COMPLEMENTARES</span>
          <h3>Documentos e contexto financeiro</h3>
        </div>
      </div>
      <div className="expanded-support-grid">
        <section>
          <span className="detail-block-title">DOCUMENTOS VINCULADOS</span>
          {documentosExpansao.length ? (
            <div className="document-list">
              {documentosExpansao.map((documento) => {
                const titulo = tituloDocumento(documento);
                const comprovante = /comprovante/i.test(titulo);
                return (
                  <button
                    key={`${documento.responsavel}-${documento.url}`}
                    type="button"
                    title={`${documento.responsavel ? `${documento.responsavel} · ` : ""}${titulo}${documento.numero ? ` · ${documento.numero}` : ""}`}
                    onClick={() =>
                      aoAbrirDocumento(
                        `${documento.responsavel ? `${documento.responsavel} · ` : ""}${titulo}${documento.numero ? ` · ${documento.numero}` : ""}`,
                        documento.url,
                      )
                    }
                  >
                    <span
                      className={`document-icon ${comprovante ? "is-receipt" : ""}`}
                    >
                      {comprovante ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <FileText size={14} aria-hidden="true" />
                      )}
                    </span>
                    <span className="document-copy">
                      <b>
                        {titulo}
                        {documento.numero ? ` ${documento.numero}` : ""}
                      </b>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum documento vinculado.
            </p>
          )}
        </section>
        <section className="support-facts">
          <span className="detail-block-title">DADOS COMPLEMENTARES</span>
          {dadosComplementares.map(([rotulo, valor]) => (
            <p key={rotulo}>
              <b>{rotulo}</b>
              <small>{valor}</small>
            </p>
          ))}
        </section>
        <section className="support-note">
          <span className="detail-block-title">OBSERVAÇÕES</span>
          <p>{lancamento.observacoes || "Nenhuma observação registrada."}</p>
        </section>
      </div>
    </div>
  );
}
type CampoDocumentoLancamento =
  | "documento_numero"
  | "numero_doc"
  | "numero_nf"
  | "numero_recibo"
  | "numero_demonstrativo"
  | "documento";
type OpcaoEdicao = { id: string; label: string };
const TIPOS_RATEIO_EDICAO: OpcaoEdicao[] = [
  { id: "FIXO", label: "FIXO" },
  { id: "VARIAVEL POR VOO", label: "VARIAVEL POR VOO" },
  { id: "VARIAVEL POR HORA", label: "VARIAVEL POR HORA" },
  { id: "EXTRA", label: "EXTRA" },
];

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
    const idsRelacionados = [
      item.id,
      item.cliente_id,
      item.socio_id,
      ...(item.cotista_ids ?? []),
    ];
    return Boolean(cotistaId && idsRelacionados.includes(cotistaId));
  });
  if (cotistaPorId) return cotistaPorId.percentual_sociedade;

  const nomeNormalizado = cotistaNome
    ? normalizarBusca(cotistaNome.trim())
    : "";
  if (!nomeNormalizado) return null;
  const cotistasComMesmoNome = cotistas.filter(
    (item) => normalizarBusca(item.nome.trim()) === nomeNormalizado,
  );
  const cotista =
    cotistasComMesmoNome.length === 1 ? cotistasComMesmoNome[0] : null;
  return cotista?.percentual_sociedade ?? null;
}

const TOM_STATUS_LANCAMENTO: Record<string, string> = {
  PAGO: "sucesso",
  PAGO_DIRETAMENTE: "sucesso",
  RECEBIDO: "sucesso",
  REEMBOLSADO: "sucesso",
  EM_ABERTO: "pendente",
  EM_ATRASO: "atrasado",
  AGUARDANDO_REEMBOLSO: "aguardando",
};

function BadgeStatus({ status }: { status: string }) {
  const visual = statusLancamento(status);
  return (
    <span
      data-status={visual.value}
      className={`erp-status erp-status-${TOM_STATUS_LANCAMENTO[visual.value] ?? "cancelado"}`}
    >
      {visual.label}
    </span>
  );
}

function CaixaSelecao({
  marcado,
  parcial = false,
  desabilitado = false,
  rotulo,
  aoMudar,
}: {
  marcado: boolean;
  parcial?: boolean;
  desabilitado?: boolean;
  rotulo: string;
  aoMudar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial;
  }, [parcial]);
  return (
    <label className="erp-checkbox">
      <input
        ref={ref}
        type="checkbox"
        checked={marcado}
        disabled={desabilitado}
        aria-label={rotulo}
        onChange={aoMudar}
      />
      <span aria-hidden="true">
        {parcial ? <span className="erp-checkbox-traco" /> : <Check size={12} strokeWidth={3} />}
      </span>
    </label>
  );
}

function LancamentosDespesa({
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
  const [baixaSelecionada, setBaixaSelecionada] =
    useState<LancamentoEconomico | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(),
  );
  const [documentoAberto, setDocumentoAberto] = useState<{
    nome: string;
    url: string;
  } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [modoData, setModoData] = useState<"emissao" | "vencimento" | "ambas">("emissao");
  const [filtroDoc, setFiltroDoc] = useState("todos");
  const [colunaFiltroAberta, setColunaFiltroAberta] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<{
    coluna: string;
    direcao: "asc" | "desc";
  }>({ coluna: "data", direcao: "desc" });
  const [larguras, setLarguras] = useState<Record<string, number>>({});
  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set());
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menuColunasAberto, setMenuColunasAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const scrollRef = useRef<HTMLDivElement>(null);
  const limparGestoRef = useRef<(() => void) | null>(null);
  const bloquearCliqueRef = useRef(false);
  const [arrastando, setArrastando] = useState(false);
  // All document/window listeners are removed on cancellation, blur and unmount.
  useEffect(() => () => limparGestoRef.current?.(), []);
  useEffect(() => {
    setPagina(1);
    setExpandidos(new Set());
    setSelecionados(new Set());
  }, [busca, filtroStatus, filtroCategoria, filtroDoc, modoData, ordenacao, lancamentos, porPagina]);
  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Element && evento.target.closest(".erp-coluna-filtro-anchor")) return;
      setColunaFiltroAberta(null);
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setColunaFiltroAberta(null);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [colunaFiltroAberta]);

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
      evento.currentTarget.parentElement?.getBoundingClientRect().width ??
      minimo;
    const cursorAnterior = document.body.style.cursor;
    const selecaoAnterior = document.body.style.userSelect;
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== evento.pointerId) return;
      setLarguras((atual) => ({
        ...atual,
        [colunaId]: Math.min(
          800,
          Math.max(minimo, larguraInicial + e.clientX - inicioX),
        ),
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
    // Touch uses the browser's native scrolling. Interactive controls retain their gestures.
    if (
      !viewport ||
      evento.pointerType !== "mouse" ||
      evento.button !== 0 ||
      (evento.target as HTMLElement).closest(
        "button,a,input,select,textarea,label,[role=checkbox],[role=separator],[role=menuitem]",
      )
    )
      return;
    const rect = viewport.getBoundingClientRect();
    if (
      evento.clientX >=
        rect.left + viewport.clientLeft + viewport.clientWidth ||
      evento.clientY >= rect.top + viewport.clientTop + viewport.clientHeight
    )
      return;
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
  const [acao, setAcao] = useState<AcaoDespesa | null>(null);
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
    rateios: Record<
      string,
      { percentual: string; valor: string; pagoPor: string }
    >;
  };
  const [edicaoLancamento, setEdicaoLancamento] =
    useState<EdicaoLancamento | null>(null);
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
            nomeFornecedorLancamento(item, fornecedoresEdicao),
            item.participanteNome,
            item.participanteId,
            item.categoria,
            documentoDoLancamento(item),
            item.dataEmissao || item.data,
            formatarData(item.dataEmissao || item.data),
            formatarCentavos(item.valorCentavos),
            formatarCentavos(valorPagoLancamento(item)),
            item.tipoRateio || item.tipo,
            ...item.rateios.map((rateio) => rateio.cotista),
            item.numeroDoc,
            item.numeroNf,
            item.numeroRecibo,
            item.numeroDemonstrativo,
            item.documento,
            item.pagoPor,
            ...item.rateios.map((rateio) => rateio.pagoPor),
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
          (item.categoria || "Sem categoria") === filtroCategoria) &&
        (filtroDoc === "todos" || tipoDocumentoLancamento(item) === filtroDoc)
      );
    });
  }, [despesas, busca, filtroStatus, filtroCategoria, filtroDoc, fornecedoresEdicao]);
  type ColunaDespesa = {
    id: string;
    titulo: string;
    largura: number;
    minimo: number;
    numerica?: boolean;
    cotista?: boolean;
    valor?: (item: LancamentoEconomico) => string | number | null | undefined;
    render: (item: LancamentoEconomico) => ReactNode;
  };
  const texto = (valor: string | null | undefined) => (
    <span className="despesa-cell-text" title={valor || "Não informado"}>
      {valor || "—"}
    </span>
  );
  const ordenarDataPor = modoData === "vencimento" ? "vencimento" : "emissao";
  const alterarModoData = (modo: typeof modoData) => {
    setModoData(modo);
    setOrdenacao((atual) => ({
      coluna: "data",
      direcao: atual.coluna === "data" ? atual.direcao : "asc",
    }));
  };
  const dataParaOrdenacao = (item: LancamentoEconomico) =>
    ordenarDataPor === "emissao" ? item.dataEmissao || item.data : item.prazo;
  const formatarDataSemAno = (valor: string | null | undefined) =>
    formatarData(valor).replace(/\/\d{4}$/, "");
  const colunas: ColunaDespesa[] = [
    {
      id: "data",
      titulo: "Data",
      largura: 150,
      minimo: 130,
      valor: dataParaOrdenacao,
      render: (item) => (
        <>
          {modoData !== "vencimento" && (
            <span>{formatarDataSemAno(item.dataEmissao || item.data)}</span>
          )}
          {modoData !== "emissao" && (
            <span className={modoData === "ambas" ? "erp-texto-secundario" : undefined}>
              {modoData === "ambas" ? "Venc. " : ""}
              {formatarDataSemAno(item.prazo)}
            </span>
          )}
        </>
      ),
    },
    {
      id: "documento",
      titulo: "Doc",
      largura: 130,
      minimo: 96,
      valor: documentoDoLancamento,
      render: (item) => (
        <span className="erp-documento" title={documentoDoLancamento(item) || undefined}>
          {documentoDoLancamento(item) || "—"}
        </span>
      ),
    },
    {
      id: "descricao",
      titulo: "Descrição",
      largura: 260,
      minimo: 160,
      valor: (item) => item.descricao,
      render: (item) => texto(item.descricao),
    },
    {
      id: "fornecedor",
      titulo: "Favorecido",
      largura: 220,
      minimo: 150,
      valor: (item) => nomeFornecedorLancamento(item, fornecedoresEdicao),
      render: (item) => texto(nomeFornecedorLancamento(item, fornecedoresEdicao) || "Fornecedor não informado"),
    },
    // The supplied model has a category, but no bank-account field. Keep the actual data.
    {
      id: "categoria",
      titulo: "Categoria",
      largura: 160,
      minimo: 112,
      valor: (item) => item.categoria || "Sem categoria",
      render: (item) => texto(item.categoria || "Sem categoria"),
    },
    {
      id: "status",
      titulo: "Status",
      largura: 180,
      minimo: 150,
      valor: (item) => statusLancamento(item.status).label,
      render: (item) => <BadgeStatus status={item.status} />,
    },
    {
      id: "tipo",
      titulo: "TIPO RATEIO",
      largura: 160,
      minimo: 125,
      valor: (item) => item.tipoRateio || item.tipo,
      render: (item) => texto(tipoRateioLancamento(item)),
    },
    {
      id: "pago",
      titulo: "Valor pago",
      largura: 160,
      minimo: 140,
      numerica: true,
      valor: valorPagoLancamento,
      render: (item) => formatarCentavos(valorPagoLancamento(item)),
    },
    {
      id: "pago-por",
      titulo: "PAGO POR",
      largura: 170,
      minimo: 150,
      valor: (item) => nomePagadoresDoLancamento(item, cotistasAeronave),
      render: (item) => texto(nomePagadoresDoLancamento(item, cotistasAeronave)),
    },
    ...cotistasAeronave.map((cotista): ColunaDespesa => ({
      id: `cotista-${cotista.id}`,
      titulo: cotista.nome,
      largura: 168,
      minimo: 148,
      numerica: true,
      cotista: true,
      valor: (item) =>
        rateioDoCotista(item, cotista, cotistasAeronave)?.valorCentavos,
      render: (item) => {
        const rateio = rateioDoCotista(item, cotista, cotistasAeronave);
        return rateio ? (
          <div className="despesa-rateio-cell">
            <span className="text-muted-foreground">
              {Number(rateio.percentual).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}
              %
            </span>
            <b className="despesa-rateio-value">
              {formatarCentavos(rateio.valorCentavos)}
            </b>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    })),
  ];
  const filtroCabecalhoAtivo = (id: string) =>
    id === "data"
      ? modoData !== "emissao"
      : id === "documento"
        ? filtroDoc !== "todos"
        : id === "categoria"
          ? filtroCategoria !== "todas"
          : filtroStatus !== "todos";
  const opcoesFiltroCabecalho = (id: string) => {
    if (id === "data")
      return [
        { rotulo: "Emissão", ativo: modoData === "emissao", aplicar: () => alterarModoData("emissao") },
        { rotulo: "Vencimento", ativo: modoData === "vencimento", aplicar: () => alterarModoData("vencimento") },
        { rotulo: "Emissão e vencimento", ativo: modoData === "ambas", aplicar: () => alterarModoData("ambas") },
      ];
    if (id === "documento")
      return [
        { rotulo: "Todos os documentos", ativo: filtroDoc === "todos", aplicar: () => setFiltroDoc("todos") },
        ...TIPOS_DOCUMENTO_COTISTA.map(({ valor, rotulo }) => ({
          rotulo,
          ativo: filtroDoc === valor,
          aplicar: () => setFiltroDoc(valor),
        })),
      ];
    if (id === "categoria")
      return [
        { rotulo: "Todas as categorias", ativo: filtroCategoria === "todas", aplicar: () => setFiltroCategoria("todas") },
        ...categorias.map((categoria) => ({
          rotulo: categoria,
          ativo: filtroCategoria === categoria,
          aplicar: () => setFiltroCategoria(categoria),
        })),
      ];
    return [
      { rotulo: "Todos os status", ativo: filtroStatus === "todos", aplicar: () => setFiltroStatus("todos") },
      ...STATUS_LANCAMENTO.map(({ value, label }) => ({
        rotulo: label,
        ativo: filtroStatus === value,
        aplicar: () => setFiltroStatus(value),
      })),
    ];
  };
  const renderizarFiltroCabecalho = (id: string) => {
    if (!(id in TITULOS_FILTRO_CABECALHO)) return null;
    const titulo = TITULOS_FILTRO_CABECALHO[id];
    return (
      <div className="erp-status-filtro-anchor erp-coluna-filtro-anchor">
        <button
          type="button"
          className={`erp-status-filtro-trigger ${filtroCabecalhoAtivo(id) ? "erp-status-filtro-ativo" : ""}`}
          aria-label={`Filtrar por ${titulo}`}
          title={`Filtrar por ${titulo}`}
          aria-haspopup="dialog"
          aria-expanded={colunaFiltroAberta === id}
          onClick={() => setColunaFiltroAberta((atual) => (atual === id ? null : id))}
        >
          <Filter size={13} aria-hidden="true" />
        </button>
        {colunaFiltroAberta === id && (
          <div className="erp-status-filtro-menu" role="dialog" aria-label={`Filtrar por ${titulo}`}>
            {opcoesFiltroCabecalho(id).map((opcao) => (
              <button
                key={opcao.rotulo}
                type="button"
                aria-pressed={opcao.ativo}
                onClick={() => {
                  opcao.aplicar();
                  setColunaFiltroAberta(null);
                }}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  const colunasVisiveis = colunas.filter((coluna) => !ocultas.has(coluna.id));
  const alternarColunaOculta = (id: string) =>
    setOcultas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  const alternarExpandido = (id: string) =>
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  const larguraTabela =
    120 +
    colunasVisiveis.reduce(
      (total, coluna) => total + (larguras[coluna.id] ?? coluna.largura),
      0,
    );
  const quantidadeColunas = colunasVisiveis.length + 1;
  const ordenarPor = (coluna: string) =>
    setOrdenacao((atual) => ({
      coluna,
      direcao:
        atual.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc",
    }));
  // Keep monthly grouping aligned with the selected date field; missing dates stay last.
  const comparador = new Intl.Collator("pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
  const colunaOrdenada = colunas.find(
    (coluna) => coluna.id === ordenacao.coluna,
  );
  const itensPorMes = new Map<string, LancamentoEconomico[]>();
  for (const item of filtradas) {
    const data = String(dataParaOrdenacao(item) ?? "").slice(0, 10);
    const mes = /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? data.slice(0, 7)
      : "Sem data";
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
        if (primeiro == null || primeiro === "")
          return segundo == null || segundo === "" ? 0 : 1;
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
  const totalLancado = despesas.reduce(
    (total, item) => total + item.valorCentavos,
    0,
  );
  const totalPago = despesas.reduce(
    (total, item) => total + valorPagoLancamento(item),
    0,
  );
  const totalAberto = Math.max(0, totalLancado - totalPago);
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
    busca || filtroStatus !== "todos" || filtroCategoria !== "todas" || filtroDoc !== "todos",
  );
  const limparFiltros = () => {
    setBusca("");
    setFiltroStatus("todos");
    setFiltroCategoria("todas");
    setFiltroDoc("todos");
  };
  const atualizarEdicao = (
    campo: keyof Omit<EdicaoLancamento, "rateios">,
    valor: string,
  ) =>
    setEdicaoLancamento((atual) =>
      atual ? { ...atual, [campo]: valor } : atual,
    );
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
      camposDocumento.find(([, valor]) => Boolean(valor))?.[0] ??
      "documento_numero";
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
                (fornecedor) =>
                  normalizarBusca(fornecedor.label) ===
                  normalizarBusca(nomeFornecedorLancamento(item, fornecedoresEdicao)),
              )?.id ||
              "",
            categoria: item.categoria || "",
            categoriaId:
              itemComIds.categoriaId ||
              itemComIds.categoria_id ||
              categoriasClienteEdicao.find(
                (categoria) =>
                  normalizarBusca(categoria.label) ===
                  normalizarBusca(item.categoria || ""),
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
                    percentual:
                      rateio?.percentual == null
                        ? ""
                        : String(rateio.percentual),
                    valor:
                      rateio?.valorCentavos == null
                        ? ""
                        : dinheiroInput(rateio.valorCentavos),
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
      if (acao.tipo === "editar") {
        const edicao = edicaoLancamento;
        if (!edicao) throw new Error("Não foi possível carregar os dados para edição.");
        const rateiosEditados = cotistasAeronave.flatMap((cotista) => {
          const valores = edicao.rateios[cotista.id];
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
          )
            return [];
          const percentualTexto = valores.percentual.trim().replace(",", ".");
          const percentual = percentualTexto
            ? Number(percentualTexto)
            : 0;
          if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100)
            throw new Error(`Percentual inválido para ${cotista.nome}.`);
          const valorCentavos = valores.valor.trim()
            ? parseValorReais(valores.valor)
            : 0;
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
                (cotista) =>
                  rateioDoCotista(acao.item, cotista, cotistasAeronave) ===
                  rateio,
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
        camposDocumento[edicao.campoDocumento] =
          edicao.documentoNumero.trim() || null;
        const fornecedorSelecionado = fornecedoresEdicao.find(
          (fornecedor) => fornecedor.id === edicao.fornecedorId || fornecedor.id.endsWith(`:${edicao.fornecedorId}`),
        );
        const fornecedorIdPersistido = fornecedorSelecionado
          ? fornecedorSelecionado.id.slice(fornecedorSelecionado.id.indexOf(":") + 1)
          : edicao.fornecedorId;
        await editarLancamento(acao.item.id, {
          data: edicao.dataEmissao || null,
          data_emissao: edicao.dataEmissao || null,
          data_vencimento: edicao.dataVencimento || null,
          ...camposDocumento,
          descricao: edicao.descricao.trim(),
          fornecedor: edicao.fornecedor || null,
          fornecedor_id: fornecedorIdPersistido || null,
          categoria: edicao.categoria || null,
          categoria_id: edicao.categoriaId || null,
          status: edicao.status,
          tipo_rateio: edicao.tipoRateio || null,
          valor_centavos: parseValorReais(edicao.valorTotal),
          valor_pago_centavos: parseValorReais(edicao.valorPago),
          pago_por: edicao.pagoPor || null,
          observacoes: edicao.observacoes || null,
          rateios: [...rateiosEditados, ...rateiosSemCotistaCorrespondente],
        });
        avisarAtualizacaoFinanceiro();
      }
      if (acao.tipo === "excluir") await excluirLancamento(acao.item.id);
      toast.success(
        acao.tipo === "editar"
          ? "Lançamento atualizado."
          : acao.tipo === "excluir"
            ? "Despesa excluída."
            : "Pagamento registrado.",
      );
      setAcao(null);
      setEdicaoLancamento(null);
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
          Editar 
        </DropdownMenuItem>
        {!item.reembolsavel && (
          <DropdownMenuItem
            disabled={[
              "PAGO",
              "PAGO_DIRETAMENTE",
              "REEMBOLSADO",
              "CANCELADO",
              "ESTORNO",
            ].includes(normalizarStatus(item.status))}
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
  const mesReferencia =
    mesesSelecionados[mesesSelecionados.length - 1] || mesAtualLocal();
  const todosExpandidos =
    itensDaPagina.length > 0 &&
    itensDaPagina.every((item) => expandidos.has(item.id));
  const selecionarMes = (mes: string) => {
    aoSelecionarMes(mes);
  };
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
    Number(Boolean(busca.trim())) +
    Number(filtroStatus !== "todos") +
    Number(filtroCategoria !== "todas") +
    Number(filtroDoc !== "todos");

  return (
    <div className="despesas-theme despesas-shell">
      <style>{DESPESAS_ESTILOS}</style>
      <style>{ESTILOS_FINANCEIRO}</style>
      <section className="erp-financeiro erp-saida" aria-label="Lançamentos mensais">
          <header className="erp-cabecalho">
            <div className="erp-titulo"><h2>Lançamentos mensais</h2></div>
            <div className="erp-cabecalho-acoes">
              <div className="erp-resumo">
                <span>{temFiltros ? "Total filtrado" : "Total listado"}</span>
                <strong>{carregando ? "—" : formatarCentavos(totalFiltrado)}</strong>
              </div>
            </div>
          </header>
        <div className="erp-toolbar" role="group" aria-label="Ações dos lançamentos">
          <div className="contents">
            <div className="erp-acoes">
              <button type="button" className="erp-btn erp-btn-primario" onClick={aoNovo}>
                <Plus size={17} aria-hidden="true" />
                Novo
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-texto"
                aria-expanded={filtrosAbertos}
                aria-controls="despesa-filtros"
                onClick={() => setFiltrosAbertos((atual) => !atual)}
              >
                <Filter size={17} aria-hidden="true" />
                Filtrar
                {filtrosAtivos > 0 && (
                  <span className="erp-contador">{filtrosAtivos}</span>
                )}
              </button>
              <span className="erp-divisor" aria-hidden="true" />
              <button
                type="button"
                className="erp-btn erp-btn-texto"
                disabled={carregando || !itensDaPagina.length}
                onClick={() =>
                  setExpandidos(
                    todosExpandidos
                      ? new Set()
                      : new Set(itensDaPagina.map((item) => item.id)),
                  )
                }
              >
                <ListOrdered size={18} aria-hidden="true" />
                {todosExpandidos ? "Recolher todas" : "Expandir todas"}
              </button>
              <span className="erp-divisor" aria-hidden="true" />
              <button
                type="button"
                className="erp-btn erp-btn-texto"
                title="Restaurar visibilidade e largura das colunas"
                onClick={() => {
                  setOcultas(new Set());
                  setLarguras({});
                }}
              >
                <RotateCcw size={17} aria-hidden="true" />
                Restaurar colunas
              </button>
              <div className="erp-colunas-ancora">
                <button
                  type="button"
                  className="erp-btn erp-btn-texto"
                  aria-expanded={menuColunasAberto}
                  aria-controls="despesa-colunas"
                  onClick={() => setMenuColunasAberto((atual) => !atual)}
                >
                  <EyeOff size={17} aria-hidden="true" />
                  Ocultar colunas
                </button>
                {menuColunasAberto && (
                  <div
                    className="erp-colunas-lista"
                    id="despesa-colunas"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label="Colunas visíveis"
                  >
                    {colunas.map((coluna) => {
                      const visivel = !ocultas.has(coluna.id);
                      return (
                        <button
                          key={coluna.id}
                          type="button"
                          role="option"
                          aria-selected={visivel}
                          disabled={visivel && colunasVisiveis.length === 1}
                          onClick={() => alternarColunaOculta(coluna.id)}
                        >
                          <span className="erp-coluna-marca" aria-hidden="true">
                            {visivel && <Check size={11} />}
                          </span>
                          {coluna.titulo}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div
              className="erp-periodo"
              role="group"
              aria-label="Navegar pelas competências"
            >
              <SeletorMesesCotista
                mesesSelecionados={mesesSelecionados}
                aoAlternar={alternarMes}
                aoSelecionarMesAtual={() => selecionarMes(mesAtualLocal())}
              />
              <div className="erp-navegacao-mes">
                <button
                  type="button"
                  className="erp-btn erp-btn-icone"
                  aria-label="Selecionar mês anterior"
                  onClick={() =>
                    selecionarMesUnico(deslocarMes(mesReferencia, -1))
                  }
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="erp-rotulo-periodo">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="despesa-date-mode"
                        aria-label={`Filtro de data: ${modoData === "emissao" ? "emissão" : modoData === "vencimento" ? "vencimento" : "emissão e vencimento"}`}
                        title="Escolher datas exibidas"
                      >
                        <span className="despesa-date-mode-copy">
                          <small>DATA: {modoData === "emissao" ? "EMISSÃO" : modoData === "vencimento" ? "VENCIMENTO" : "AMBAS"}</small>
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="despesas-theme despesa-dialog min-w-[190px]"
                    >
                      <DropdownMenuItem onSelect={() => alterarModoData("emissao")} className="gap-2">
                        <Check size={14} className={modoData === "emissao" ? "opacity-100" : "opacity-0"} />
                        Somente emissão
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => alterarModoData("vencimento")} className="gap-2">
                        <Check size={14} className={modoData === "vencimento" ? "opacity-100" : "opacity-0"} />
                        Somente vencimento
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => alterarModoData("ambas")} className="gap-2">
                        <Check size={14} className={modoData === "ambas" ? "opacity-100" : "opacity-0"} />
                        Emissão e vencimento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="despesa-period-label" aria-live="polite">
                    {mesesSelecionados.length === 1
                      ? rotuloMesCotista(mesReferencia)
                      : `${mesesSelecionados.length} meses selecionados`}
                  </span>
                </div>
                <button
                  type="button"
                  className="erp-btn erp-btn-icone"
                  aria-label="Selecionar próximo mês"
                  onClick={() =>
                    selecionarMesUnico(deslocarMes(mesReferencia, 1))
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          {filtrosAbertos && (
            <div id="despesa-filtros" className="erp-filtros w-full">
              <div className="erp-busca">
                <Label htmlFor="despesa-busca" className="sr-only">
                  Buscar em todos os campos
                </Label>
                <Search size={15} />
                <Input
                  id="despesa-busca"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar descrição, documento, favorecido, cotista…"
                  className="h-9 w-full pl-9 text-xs"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="despesa-status"
                  className="text-xs text-muted-foreground"
                >
                  STATUS
                </Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger id="despesa-status" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="despesas-theme despesa-dialog">
                    <SelectItem value="todos">Todas as situações</SelectItem>
                    {STATUS_LANCAMENTO.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
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
                  <SelectTrigger id="despesa-categoria" className="h-9">
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
              <div className="text-xs">
                <button
                  type="button"
                  className="erp-btn erp-btn-texto"
                  onClick={limparFiltros}
                >
                  <X size={12} />
                  Limpar busca e filtros
                </button>
              </div>
            </div>
          )}
          {temFiltros && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span role="status">
                {filtradas.length} de {despesas.length} despesas ·{" "}
                {formatarCentavos(totalFiltrado)}
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="text-primary"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {itensSelecionados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/10 px-4 py-3 text-sm">
            <span role="status">
              {itensSelecionados.length}{" "}
              {itensSelecionados.length === 1
                ? "lançamento selecionado"
                : "lançamentos selecionados"}
              {" · Soma: "}
              <strong className="tabular-nums">
                {formatarCentavos(totalSelecionado)}
              </strong>
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary"
              onClick={() => setSelecionados(new Set())}
            >
              <X size={12} />
              Limpar seleção
            </button>
          </div>
        )}
        <div
          ref={scrollRef}
          className={`erp-tabela-container ${arrastando ? "erp-arrastando" : ""}`}
          role="region"
          aria-label="Tabela de despesas. Arraste horizontalmente ou use as setas do teclado."
          tabIndex={0}
          aria-busy={carregando}
          onPointerDown={iniciarArraste}
          onClickCapture={(evento) => {
            if (bloquearCliqueRef.current && evento.detail > 0) {
              evento.preventDefault();
              evento.stopPropagation();
              bloquearCliqueRef.current = false;
            }
          }}
        >
          <table className="erp-tabela erp-tabela-saidas" style={{ width: larguraTabela }}>
            <caption className="sr-only">
              Despesas agrupadas por mês. Clique nos cabeçalhos para ordenar
              dentro de cada mês. Arraste a borda de uma coluna para
              redimensioná-la ou use as setas quando a borda estiver focada.
            </caption>
            <colgroup>
              <col style={{ width: 120 }} />
              {colunasVisiveis.map((coluna) => (
                <col
                  key={coluna.id}
                  style={{ width: larguras[coluna.id] ?? coluna.largura }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  <div className="erp-celula-selecao erp-selecao-cabecalho">
                    <CaixaSelecao
                      marcado={todosDaPaginaSelecionados}
                      parcial={!todosDaPaginaSelecionados && itensDaPagina.some((item) => selecionados.has(item.id))}
                      desabilitado={carregando || !itensDaPagina.length}
                      rotulo="Selecionar todos os lançamentos desta página"
                      aoMudar={alternarSelecaoDaPagina}
                    />
                  </div>
                </th>
                {colunasVisiveis.map((coluna) => (
                  <th
                    key={coluna.id}
                    scope="col"
                    className={coluna.numerica ? "text-right" : ""}
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
                    <div className="erp-status-th-conteudo">
                    {renderizarFiltroCabecalho(coluna.id)}
                    {coluna.valor ? (
                      <button
                        type="button"
                        className="erp-ordenar"
                        data-active={ordenacao.coluna === coluna.id}
                        title={`${coluna.titulo}: ordenar ${ordenacao.coluna === coluna.id && ordenacao.direcao === "asc" ? "decrescente" : "crescente"}${coluna.cotista ? " por valor rateado" : ""}`}
                        onClick={() => ordenarPor(coluna.id)}
                      >
                        <span>
                          {coluna.titulo}
                          {coluna.cotista && <small>Rateio · % / valor</small>}
                        </span>
                        {ordenacao.coluna !== coluna.id ? (
                          <ChevronsUpDown size={11} />
                        ) : ordenacao.direcao === "asc" ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )}
                      </button>
                    ) : (
                      coluna.titulo
                    )}
                    </div>
                    <span
                      role="separator"
                      tabIndex={0}
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${coluna.titulo}`}
                      aria-valuemin={coluna.minimo}
                      aria-valuemax={800}
                      aria-valuenow={Math.round(
                        larguras[coluna.id] ?? coluna.largura,
                      )}
                      className="erp-redimensionar"
                      onPointerDown={(evento) =>
                        iniciarRedimensionamento(
                          coluna.id,
                          coluna.minimo,
                          evento,
                        )
                      }
                      onDoubleClick={() =>
                        setLarguras((atual) => ({
                          ...atual,
                          [coluna.id]: coluna.largura,
                        }))
                      }
                      onKeyDown={(evento) => {
                        if (
                          evento.key === "ArrowLeft" ||
                          evento.key === "ArrowRight"
                        ) {
                          evento.preventDefault();
                          evento.stopPropagation();
                          setLarguras((atual) => ({
                            ...atual,
                            [coluna.id]: Math.min(
                              800,
                              Math.max(
                                coluna.minimo,
                                (atual[coluna.id] ?? coluna.largura) +
                                  (evento.key === "ArrowRight" ? 16 : -16),
                              ),
                            ),
                          }));
                        }
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            {carregando ? (
              <tbody>
                <tr>
                  <td colSpan={quantidadeColunas} className="erp-estado">
                    <div
                      className="flex items-center justify-start gap-2"
                      role="status"
                    >
                      <Loader2 size={16} className="animate-spin" />
                      Carregando lançamentos…
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : gruposDaPagina.length ? (
              gruposDaPagina.map(({ mes, itens }) => (
                <tbody key={mes}>
                  {(mesesSelecionados.length > 1 ||
                    ordenarDataPor === "vencimento") && (
                    <tr className="despesa-month">
                      <th scope="rowgroup" colSpan={quantidadeColunas}>
                        {resumoMes(mes, itens)}
                      </th>
                    </tr>
                  )}
                  {itens.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        className={`erp-linha ${expandidos.has(item.id) ? "erp-linha-aberta" : ""} ${selecionados.has(item.id) ? "erp-linha-selecionada" : ""}`}
                      >
                        <td className="erp-td-acoes">
                          <div className="erp-celula-selecao">
                            <button
                              type="button"
                              className="erp-expandir"
                              aria-label={`${expandidos.has(item.id) ? "Recolher" : "Expandir"} ${item.descricao}`}
                              aria-expanded={expandidos.has(item.id)}
                              onClick={() => alternarExpandido(item.id)}
                            >
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                            <CaixaSelecao
                              marcado={selecionados.has(item.id)}
                              rotulo={`Selecionar lançamento: ${item.descricao}`}
                              aoMudar={() => alternarSelecao(item.id)}
                            />
                            {acoesDaLinha(item)}
                          </div>
                        </td>
                        {colunasVisiveis.map((coluna) => (
                          <td
                            key={coluna.id}
                            className={coluna.numerica ? "erp-valor" : ""}
                          >
                            {coluna.render(item)}
                          </td>
                        ))}
                      </tr>
                      {expandidos.has(item.id) && (
                        <tr id={`despesa-desktop-${item.id}`}>
                          <td colSpan={quantidadeColunas} className="p-0">
                            <div className="despesa-expanded-content">
                              <LancamentoExpandido
                                lancamento={item}
                                cotistasAeronave={cotistasAeronave}
                                aoAbrirDocumento={(nome, url) =>
                                  setDocumentoAberto({ nome, url })
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              ))
            ) : (
              <tbody>
                <tr>
                  <td colSpan={quantidadeColunas} className="erp-estado">
                    Nenhum lançamento encontrado para os filtros.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
        <div className="despesa-summary">
          <strong>
            TOTAL LISTADO ({carregando ? 0 : filtradas.length} itens)
            {!carregando && ` · ${formatarCentavos(totalFiltrado)}`}
          </strong>
          <div
            className="despesa-summary-values"
            aria-hidden={carregando}
            style={carregando ? { visibility: "hidden" } : undefined}
          >
            <span>Lançado: {formatarCentavos(totalLancado)}</span>
            <span>Pago: {formatarCentavos(totalPago)}</span>
            <span>Em aberto: {formatarCentavos(totalAberto)}</span>
          </div>
        </div>
        <footer className="erp-rodape">
          <div className="erp-rodape-info">
            <span>{itensSelecionados.length} selecionados</span>
            <span>{carregando ? 0 : filtradas.length} registros</span>
            <label className="inline-flex min-w-0 items-center gap-1">
              <span className="sr-only">Linhas por página</span>
              <select
                value={porPagina}
                onChange={(evento) => setPorPagina(Number(evento.target.value))}
              >
                {[10, 25, 50, 100].map((quantidade) => (
                  <option key={quantidade} value={quantidade}>
                    {quantidade} linhas por página
                  </option>
                ))}
              </select>
            </label>
          </div>
          <nav aria-label="Paginação das despesas" className="erp-paginacao">
            <span className="mr-2 text-[11px]" role="status" aria-live="polite">
              {carregando
                ? "Carregando…"
                : `${filtradas.length ? inicioPagina + 1 : 0}–${Math.min(inicioPagina + porPagina, filtradas.length)} de ${filtradas.length}`}
            </span>
            <button
              type="button"
              className="erp-pagina-btn"
              disabled={carregando || paginaAtual === 1}
              aria-label="Página anterior"
              onClick={() => {
                setPagina(paginaAtual - 1);
                setExpandidos(new Set());
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1 tabular-nums">
              {paginaAtual} / {totalPaginas}
            </span>
            <button
              type="button"
              className="erp-pagina-btn"
              disabled={carregando || paginaAtual === totalPaginas}
              aria-label="Próxima página"
              onClick={() => {
                setPagina(paginaAtual + 1);
                setExpandidos(new Set());
              }}
            >
              <ChevronRight size={14} />
            </button>
          </nav>
        </footer>
      </section>

      <DarBaixaCotistaDialog
        lancamento={baixaSelecionada?.reembolsavel ? null : baixaSelecionada}
        onFechar={() => setBaixaSelecionada(null)}
        onConcluido={async () => {
          await aoAtualizar();
          toast.success("Pagamento registrado.");
        }}
      />

      <Dialog
        open={Boolean(acao)}
        onOpenChange={(open) => {
          if (!open && !processandoRef.current) {
            setAcao(null);
            setEdicaoLancamento(null);
          }
        }}
      >
        <DialogContent className="despesas-theme despesa-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {acao?.tipo === "editar"
                ? "Editar lançamento"
                : acao?.tipo === "excluir"
                  ? "Excluir despesa?"
                  : "Confirmar pagamento"}
            </DialogTitle>
            <DialogDescription>
              {acao?.tipo === "editar"
                ? "Atualize os dados do lançamento e os valores rateados por cotista."
                : acao?.tipo === "excluir"
                  ? "A despesa será removida do fluxo financeiro. Confirme para continuar."
                  : "A baixa registrará o valor integral como pago na data de hoje."}
            </DialogDescription>
          </DialogHeader>
          {acao && (
            <div className="min-w-0 space-y-4">
              {acao.tipo === "editar" ? (
                edicaoLancamento && (
                  <div className="space-y-5">
                    <section className="space-y-3">
                      <h3 className="border-b border-border pb-2 text-sm font-semibold">Dados do lançamento</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-data-emissao">Data de emissão</Label>
                          <Input id="edicao-data-emissao" type="date" value={edicaoLancamento.dataEmissao} onChange={(evento) => atualizarEdicao("dataEmissao", evento.target.value)} disabled={processando} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-data-vencimento">Data de vencimento</Label>
                          <Input id="edicao-data-vencimento" type="date" value={edicaoLancamento.dataVencimento} onChange={(evento) => atualizarEdicao("dataVencimento", evento.target.value)} disabled={processando} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-documento-numero">Número do documento</Label>
                          <Input id="edicao-documento-numero" value={edicaoLancamento.documentoNumero} onChange={(evento) => atualizarEdicao("documentoNumero", evento.target.value)} disabled={processando} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                          <Label htmlFor="edicao-fornecedor">Favorecido</Label>
                          <SearchableCombobox
                            id="edicao-fornecedor"
                            items={fornecedoresEdicao}
                            value={fornecedoresEdicao.find((fornecedor) => fornecedor.id === edicaoLancamento.fornecedorId || fornecedor.id.endsWith(`:${edicaoLancamento.fornecedorId}`))?.id || edicaoLancamento.fornecedor}
                            onChange={(id, label) => {
                              const cadastrado = fornecedoresEdicao.some((fornecedor) => fornecedor.id === id);
                              atualizarEdicao("fornecedorId", cadastrado ? id : "");
                              atualizarEdicao("fornecedor", label);
                            }}
                            placeholder="Selecione ou digite o favorecido"
                            searchPlaceholder="Buscar fornecedor, contato ou combustível"
                            emptyMessage="Nenhum fornecedor encontrado."
                            allowFreeText
                            wrapItemLabels
                            disabled={processando}
                            className="h-10 w-full rounded-md border-border bg-background text-foreground hover:bg-muted"
                            popoverClassName="despesas-theme despesa-dialog"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                          <Label htmlFor="edicao-descricao">Descrição</Label>
                          <Textarea id="edicao-descricao" rows={3} value={edicaoLancamento.descricao} onChange={(evento) => atualizarEdicao("descricao", evento.target.value)} disabled={processando} className="resize-y" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-categoria">Categoria</Label>
                          <SearchableCombobox
                            items={categoriasClienteEdicao}
                            value={categoriasClienteEdicao.some((categoria) => categoria.id === edicaoLancamento.categoriaId) ? edicaoLancamento.categoriaId : edicaoLancamento.categoria}
                            onChange={(id, label) => {
                              const cadastrada = categoriasClienteEdicao.some((categoria) => categoria.id === id);
                              atualizarEdicao("categoriaId", cadastrada ? id : "");
                              atualizarEdicao("categoria", label);
                            }}
                            placeholder="Selecione uma categoria"
                            searchPlaceholder="Buscar categoria"
                            emptyMessage="Nenhuma categoria de cliente encontrada."
                            disabled={processando}
                            className="h-10 w-full rounded-md border-border bg-background text-foreground hover:bg-muted"
                            popoverClassName="despesas-theme despesa-dialog"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-status">Situação</Label>
                          <Select value={edicaoLancamento.status} onValueChange={(valor) => atualizarEdicao("status", valor)} disabled={processando}>
                            <SelectTrigger id="edicao-status"><SelectValue /></SelectTrigger>
                            <SelectContent className="despesas-theme despesa-dialog">
                              {STATUS_LANCAMENTO.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-tipo-rateio">Tipo de rateio</Label>
                          <SearchableCombobox
                            items={TIPOS_RATEIO_EDICAO}
                            value={edicaoLancamento.tipoRateio}
                            onChange={(valor) => atualizarEdicao("tipoRateio", valor)}
                            placeholder="Selecione o tipo de rateio"
                            searchPlaceholder="Buscar tipo"
                            emptyMessage="Nenhum tipo encontrado."
                            disabled={processando}
                            className="h-10 w-full rounded-md border-border bg-background text-foreground hover:bg-muted"
                            popoverClassName="despesas-theme despesa-dialog"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="border-b border-border pb-2 text-sm font-semibold">Valores e pagador</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-valor-total">Valor total (R$)</Label>
                          <Input id="edicao-valor-total" inputMode="decimal" value={edicaoLancamento.valorTotal} onChange={(evento) => atualizarEdicao("valorTotal", evento.target.value)} disabled={processando} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-valor-pago">Valor pago (R$)</Label>
                          <Input id="edicao-valor-pago" inputMode="decimal" value={edicaoLancamento.valorPago} onChange={(evento) => atualizarEdicao("valorPago", evento.target.value)} disabled={processando} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edicao-pago-por">Pago por</Label>
                          <Select value={edicaoLancamento.pagoPor || "__nenhum__"} onValueChange={(valor) => atualizarEdicao("pagoPor", valor === "__nenhum__" ? "" : valor)} disabled={processando}>
                            <SelectTrigger id="edicao-pago-por"><SelectValue placeholder="Selecione o pagador" /></SelectTrigger>
                            <SelectContent className="despesas-theme despesa-dialog">
                              <SelectItem value="__nenhum__">Não informado</SelectItem>
                              {edicaoLancamento.pagoPor && !cotistasAeronave.some((cotista) => cotista.id === edicaoLancamento.pagoPor) && <SelectItem value={edicaoLancamento.pagoPor}>Pagador atual sem cadastro correspondente</SelectItem>}
                              {cotistasAeronave.map((cotista) => <SelectItem key={cotista.id} value={cotista.id}>{cotista.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div>
                        <h3 className="border-b border-border pb-2 text-sm font-semibold">Rateio por cotista</h3>
                        <p className="mt-2 text-xs text-muted-foreground">Os valores e percentuais abaixo correspondem às colunas de cada cotista na tabela.</p>
                      </div>
                      <div className="space-y-3">
                        {cotistasAeronave.map((cotista) => {
                          const rateio = edicaoLancamento.rateios[cotista.id] || { percentual: "", valor: "", pagoPor: "" };
                          const possuiRateio = Boolean(rateio.percentual || rateio.valor || rateio.pagoPor);
                          return (
                            <fieldset key={cotista.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4" disabled={processando}>
                              <legend className="px-1 text-xs font-semibold">{cotista.nome}</legend>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edicao-rateio-percentual-${cotista.id}`}>Percentual (%)</Label>
                                <Input id={`edicao-rateio-percentual-${cotista.id}`} inputMode="decimal" value={rateio.percentual} onChange={(evento) => atualizarRateioEdicao(cotista.id, "percentual", evento.target.value)} placeholder={possuiRateio ? "0" : "Sem rateio"} />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edicao-rateio-valor-${cotista.id}`}>Valor rateado (R$)</Label>
                                <Input id={`edicao-rateio-valor-${cotista.id}`} inputMode="decimal" value={rateio.valor} onChange={(evento) => atualizarRateioEdicao(cotista.id, "valor", evento.target.value)} placeholder={possuiRateio ? "0,00" : "Sem rateio"} />
                              </div>
                              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                                <Label htmlFor={`edicao-rateio-pagador-${cotista.id}`}>Pago por</Label>
                                <Select value={rateio.pagoPor || "__nenhum__"} onValueChange={(valor) => atualizarRateioEdicao(cotista.id, "pagoPor", valor === "__nenhum__" ? "" : valor)}>
                                  <SelectTrigger id={`edicao-rateio-pagador-${cotista.id}`}><SelectValue placeholder="Não informado" /></SelectTrigger>
                                  <SelectContent className="despesas-theme despesa-dialog">
                                    <SelectItem value="__nenhum__">Não informado</SelectItem>
                                    {cotistasAeronave.map((pagador) => <SelectItem key={pagador.id} value={pagador.id}>{pagador.nome}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </fieldset>
                          );
                        })}
                        {!cotistasAeronave.length && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">Nenhum cotista disponível para editar o rateio.</p>}
                      </div>
                    </section>

                    <section className="space-y-1.5">
                      <Label htmlFor="edicao-observacoes">Observações</Label>
                      <Textarea id="edicao-observacoes" rows={3} value={edicaoLancamento.observacoes} onChange={(evento) => atualizarEdicao("observacoes", evento.target.value)} disabled={processando} />
                    </section>
                  </div>
                )
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
              onClick={() => {
                setAcao(null);
                setEdicaoLancamento(null);
              }}
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
                (acao?.tipo === "editar" &&
                  (!edicaoLancamento?.descricao.trim() ||
                    !edicaoLancamento.valorTotal.trim()))
              }
              className="h-11 gap-2 rounded-xl"
            >
              {processando && <Loader2 size={16} className="animate-spin" />}
              {acao?.tipo === "editar"
                ? "Salvar alterações"
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
  const { data: fontesFornecedores = [], refetch: recarregarFornecedores } = useFornecedores({ includeFavorites: true, includeHotels: true });
  const fornecedoresEdicao = useMemo(
    () => fontesFornecedores.map((fornecedor) => ({ id: fornecedor.id, label: fornecedor.nome })),
    [fontesFornecedores],
  );
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [categoriasClienteEdicao, setCategoriasClienteEdicao] = useState<OpcaoEdicao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardCotista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDashboard, setErroDashboard] = useState<string | null>(null);
  const [aeronaves, setAeronaves] = useState<AeronaveOpcao[]>([]);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");
  const [buscaMatricula, setBuscaMatricula] = useState("");
  const aeronavesFiltradas = useMemo(() => {
    const termo = buscaMatricula.trim().toLowerCase();
    return termo
      ? aeronaves.filter((a) =>
          a.matricula_registro.toLowerCase().includes(termo),
        )
      : aeronaves;
  }, [aeronaves, buscaMatricula]);
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>(
    [],
  );
  const [participacaoEditando, setParticipacaoEditando] =
    useState<CotistaAeronave | null>(null);
  const [percentualEditado, setPercentualEditado] = useState("");
  const [aeronaveEditada, setAeronaveEditada] = useState("");
  const [salvandoParticipacao, setSalvandoParticipacao] = useState(false);
  const [cotistaEmprestimo, setCotistaEmprestimo] = useState("todos");
  const mesAtual = mesAtualLocal();
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
    const atualizar = () => {
      void carregar();
    };
    const externo = (e: StorageEvent) => {
      if (e.key === "financeiro-atualizado") atualizar();
    };
    window.addEventListener("financeiro-atualizado", atualizar);
    window.addEventListener("storage", externo);
    return () => {
      window.removeEventListener("financeiro-atualizado", atualizar);
      window.removeEventListener("storage", externo);
    };
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
      await atualizarParticipacaoCotista(participacaoEditando.id, {
        aeronave_id: aeronaveEditada,
        percentual_sociedade: percentual,
      });
      setParticipacaoEditando(null);
      await Promise.all([carregarCotistas(aeronaveSelecionada), carregar()]);
      toast.success("Participação atualizada.");
    } catch (error) {
      const codigo = error instanceof Error ? error.message : "";
      const mensagens: Record<string, string> = {
        cotista_ja_vinculado_a_aeronave:
          "Esse cotista já possui vínculo ativo com a aeronave selecionada.",
        aeronave_nao_pode_ser_alterada_com_historico_financeiro:
          "Não é possível mudar a aeronave deste vínculo porque ele já possui histórico financeiro.",
      };
      toast.error(
        mensagens[codigo] || "Não foi possível atualizar a participação.",
      );
    } finally {
      setSalvandoParticipacao(false);
    }
  };
  const removerParticipacao = async (cotista: CotistaAeronave) => {
    if (
      !window.confirm(
        `Desativar o vínculo de ${cotista.nome} com esta aeronave? O histórico financeiro será preservado.`,
      )
    )
      return;
    try {
      await excluirParticipacaoCotista(cotista.id);
      await Promise.all([carregarCotistas(aeronaveSelecionada), carregar()]);
      toast.success("Vínculo desativado; o histórico foi preservado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar o vínculo.",
      );
    }
  };

  useEffect(() => {
    void buscarOpcoesLancamento()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
    carregarAeronaves();
  }, [carregarAeronaves]);

  useEffect(() => {
    let ativo = true;
    void buscarOpcoesEnvioPagamento().catch(() => null).then((opcoesEnvio) => {
      if (!ativo) return;
      setCategoriasClienteEdicao(
        (opcoesEnvio?.categorias_cliente ?? []).map((categoria) => ({
          id: String(categoria.id),
          label: String(categoria.nome),
        })),
      );
    });
    return () => {
      ativo = false;
    };
  }, []);

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
        : (cotistasAeronave[0]?.id ?? ""),
    );
  }, [aeronaveSelecionada, cotistasAeronave]);
  const [abaAtiva, setAbaAtiva] = useState<
    | "fechamento-balanco"
    | "lancamentos"
    | "graficos"
    | "ranking"
    | "emprestimos"
    | "extrato"
    | "portal-cliente"
  >("lancamentos");
  const [paginaAberta, setPaginaAberta] = useState(false);
  const abasCotista: Array<{
    id: string;
    rotulo: string;
    Icon: typeof ReceiptText;
    corIcone: string;
  }> = [
    {
      id: "lancamentos",
      rotulo: "Lançamentos mensais",
      Icon: ReceiptText,
      corIcone: "bg-sky-400/10 text-sky-400",
    },
    {
      id: "fechamento-balanco",
      rotulo: "Fechamento Balanço",
      Icon: PieChart,
      corIcone: "bg-cyan-400/10 text-cyan-400",
    },
    {
      id: "emprestimos",
      rotulo: "Voos empréstimo",
      Icon: Plane,
      corIcone: "bg-amber-400/10 text-amber-400",
    },
    {
      id: "graficos",
      rotulo: "Gráficos",
      Icon: BarChart3,
      corIcone: "bg-rose-400/10 text-rose-400",
    },
    {
      id: "portal-cliente",
      rotulo: "Portal Cliente",
      Icon: KeyRound,
      corIcone: "bg-teal-400/10 text-teal-400",
    },
    ...(possuiHolding
      ? [
          {
            id: "extrato",
            rotulo: "Extrato Holding",
            Icon: Landmark,
            corIcone: "bg-orange-400/10 text-orange-400",
          },
        ]
      : []),
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
    setMesesAplicados(ordenados);
    setPeriodoAplicado(periodoDosMeses(ordenados));
  };
  const alternarMesSelecionado = (mes: string) => {
    if (!periodoDoMes(mes)) return;
    atualizarMeses(
      mesesAplicados.includes(mes)
        ? mesesAplicados.filter((item) => item !== mes)
        : [...mesesAplicados, mes],
    );
  };
  const selecionarMesUnico = (mes: string) => {
    if (!periodoDoMes(mes)) return;
    atualizarMeses([mes]);
  };
  const mesReferencia = mesesAplicados[mesesAplicados.length - 1] || mesAtual;

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
      if (!mesesAplicados.includes(String(v.data ?? "").slice(0, 7)))
        return false;
      if (!id) return true;
      return tipo === "socio"
        ? v.emprestador_socio_id === id
        : v.emprestador_cliente_id === id;
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
      const rateado =
        lancamento.rateios.length > 0
          ? lancamento.rateios.reduce(
              (total, rateio) => total + rateio.valorCentavos,
              0,
            )
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

  const aeronaveAtual = aeronaves.find((a) => a.id === aeronaveSelecionada);

  return (
    <div className="financeiro-shell financeiro-profissional min-w-0 max-w-full space-y-3">
      <style>{DESPESAS_ESTILOS}</style>
      {aeronaveSelecionada && (
        <div className="-mt-3.5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Financeiro Cotista
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-mono text-lg font-semibold tracking-wide text-foreground">
                {aeronaveAtual?.matricula_registro || "Aeronave selecionada"}
              </h2>
              {aeronaveAtual?.modelo && (
                <span className="text-sm text-muted-foreground">
                  {aeronaveAtual.modelo}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-2 self-start transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:self-auto"
            onClick={() => {
              setAeronaveSelecionada("");
              setPaginaAberta(false);
            }}
          >
            <Plane size={14} aria-hidden /> Trocar aeronave
          </Button>
        </div>
      )}
      {aeronaveSelecionada && paginaAberta && (
        <div className="mt-0.5 flex items-center gap-2 py-[5px]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1 border-0 px-3 sm:px-5"
            onClick={() => setPaginaAberta(false)}
          >
            <ChevronLeft size={15} /> Voltar
          </Button>
          <div
            className="financeiro-tabs flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto rounded-none border-0 border-transparent bg-transparent py-1 px-1"
            role="tablist"
            aria-label="Visões do financeiro cotista"
          >
            {abasCotista.map(({ id, rotulo, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === id}
                aria-label={rotulo}
                title={rotulo}
                onClick={() => setAbaAtiva(id as typeof abaAtiva)}
                className={`financeiro-tab group ${abaAtiva === id ? "is-active" : ""}`}
              >
                <Icon size={15} aria-hidden />
                <span className="financeiro-tab-label">{rotulo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!aeronaveSelecionada ? (
        <section className="space-y-4 py-4">
          <header className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Financeiro Cotista
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Selecione uma aeronave
            </h2>
          </header>
          <div className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={buscaMatricula}
              onChange={(e) => setBuscaMatricula(e.target.value)}
              placeholder="Digite a matrícula"
              aria-label="Filtrar aeronaves pela matrícula"
              className="h-10 pl-9 !rounded-[10px]"
            />
          </div>
          {aeronaves.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma aeronave cadastrada.
            </p>
          ) : aeronavesFiltradas.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma aeronave encontrada para &quot;{buscaMatricula}&quot;.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {aeronavesFiltradas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAeronaveSelecionada(a.id);
                    setPaginaAberta(false);
                  }}
                  className="group flex h-[68px] w-full items-center gap-3 rounded-md border border-border bg-card px-3 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {a.url_imagem ? (
                    <img
                      src={a.url_imagem}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Plane size={18} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold tracking-wide text-foreground">
                      {a.matricula_registro}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.modelo}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {paginaAberta &&
            abaAtiva !== "portal-cliente" &&
            abaAtiva !== "lancamentos" && (
              <section
                className="financeiro-panel px-4 py-3"
                aria-label="Competência dos lançamentos"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeletorMesesCotista
                      mesesSelecionados={mesesAplicados}
                      aoAlternar={alternarMesSelecionado}
                      aoSelecionarMesAtual={() => selecionarMesUnico(mesAtual)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3"
                      aria-label="Mês anterior"
                      onClick={() =>
                        selecionarMesUnico(deslocarMes(mesReferencia, -1))
                      }
                    >
                      ‹
                    </Button>
                    <span className="min-w-32 text-center text-xs text-muted-foreground" aria-live="polite">
                      {mesesAplicados.length === 1
                        ? rotuloMesCotista(mesReferencia)
                        : `${mesesAplicados.length} meses selecionados`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3"
                      aria-label="Próximo mês"
                      onClick={() =>
                        selecionarMesUnico(deslocarMes(mesReferencia, 1))
                      }
                    >
                      ›
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border sm:grid-cols-2">
                    {[
                      ["Lançamentos", String(lancamentosFiltrados.length)],
                      ["Total do mês", formatarMoeda(dashboard?.resumo?.saidas ?? 0)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-[104px] px-3 py-2 first:pl-3">
                        <p className="text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-1 font-mono text-xs font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

          {!paginaAberta ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Módulos
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {abasCotista.map(({ id, rotulo, Icon, corIcone }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setAbaAtiva(id as typeof abaAtiva);
                      setPaginaAberta(true);
                    }}
                    className="group flex min-h-[64px] w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ${corIcone}`}>
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{rotulo}</span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : abaAtiva === "portal-cliente" ? (
            <PortalClienteTab aeronaveId={aeronaveSelecionada} />
          ) : abaAtiva === "fechamento-balanco" ? (
            <div className="space-y-4">
              <div className="financeiro-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">Fechamento por cotista</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Balanço calculado pelos lançamentos da aeronave, meses e cotista selecionados.
                  </p>
                </div>
                <SearchableCombobox
                  items={cotistasAeronave.map((cotista) => ({
                    id: cotista.id,
                    label: cotista.nome,
                    descricao: `${cotista.eh_holding ? "Holding" : "Cotista"} · ${cotista.percentual_sociedade}%`,
                  }))}
                  value={cotistaVisaoId}
                  onChange={setCotistaVisaoId}
                  placeholder="Selecione um cotista"
                  searchPlaceholder="Buscar cotista..."
                  emptyMessage="Nenhum cotista encontrado."
                  icon={<User size={15} />}
                  disabled={!cotistasAeronave.length}
                  className="w-full border-border bg-background text-foreground hover:bg-muted sm:max-w-sm"
                  popoverClassName="border-border bg-popover text-popover-foreground"
                />
              </div>
              <FechamentoBalancoReferencia
                dashboard={dashboard}
                carregando={carregando}
                erro={erroDashboard}
                cotistas={cotistasAeronave}
                fornecedores={fornecedoresEdicao}
                mesesSelecionados={mesesAplicados}
                cotistaId={cotistaVisaoId}
              />
            </div>
          ) : carregando && abaAtiva !== "lancamentos" ? (
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
              {abaAtiva === "lancamentos" && (
                <LancamentosDespesa
                  lancamentos={lancamentosFiltrados}
                  cotistasAeronave={cotistasAeronave}
                  aoNovo={() => setAberto(true)}
                  aoAtualizar={carregar}
                  aoAtualizarFornecedores={() => void recarregarFornecedores()}
                  mesesSelecionados={mesesAplicados}
                  aoSelecionarMes={selecionarMesUnico}
                  aoAlterarMeses={atualizarMeses}
                  fornecedoresEdicao={fornecedoresEdicao}
                  categoriasClienteEdicao={categoriasClienteEdicao}
                  carregando={carregando}
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
                      <p className="text-sm font-bold">
                        Voos de empréstimo nesta aeronave
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Custo do tomador, fora do rateio. Escolha um cotista
                        para ver os voos emprestados em nome dele.
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
                      <p className="text-sm font-semibold">
                        Pagamentos × rateio
                      </p>
                    </div>
                    <div className="h-52 p-4 sm:h-64">
                      {dadosPagamentosRateio.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={dadosPagamentosRateio}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              stroke="hsl(var(--border))"
                              strokeDasharray="3 4"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="mes"
                              tick={{ fontSize: 10, fill: "#748399" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={formatarValorGrafico}
                              tick={{ fontSize: 10, fill: "#748399" }}
                              axisLine={false}
                              tickLine={false}
                              width={60}
                            />
                            <Tooltip
                              formatter={(valor: number) =>
                                formatarMoeda(valor)
                              }
                              {...estiloTooltip}
                            />
                            <Legend
                              align="right"
                              verticalAlign="top"
                              height={28}
                              iconType="square"
                              wrapperStyle={{ fontSize: 10 }}
                            />
                            <Bar
                              dataKey="pagamentos"
                              name="Pago"
                              fill="#08a4c9"
                              radius={[2, 2, 0, 0]}
                            />
                            <Bar
                              dataKey="rateado"
                              name="Rateado"
                              fill="#319b59"
                              radius={[2, 2, 0, 0]}
                            />
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
                          Maior diferença em{" "}
                          <b className="text-foreground">
                            {maiorDiferencaPagamentosRateio.mes}:{" "}
                            {formatarMoeda(
                              maiorDiferencaPagamentosRateio.valor,
                            )}
                          </b>
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold text-primary"
                          onClick={() => setAbaAtiva("lancamentos")}
                        >
                          Ver detalhamento <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="financeiro-panel min-w-0 overflow-hidden">
                    <div className="financeiro-panel-header">
                      <div>
                        <p className="text-sm font-bold">
                          Custos por categoria
                        </p>
                      </div>
                    </div>
                    {dadosCategorias.length > 0 ? (
                      <>
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
                                    <Cell
                                      key={item.nome}
                                      fill={
                                        coresCategorias[
                                          i % coresCategorias.length
                                        ]
                                      }
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(v: number) => formatarMoeda(v)}
                                  {...estiloTooltip}
                                />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <strong className="font-mono text-sm font-bold">
                              {totalCategoriasCompacto}
                            </strong>
                            <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                              Total
                            </span>
                          </div>
                        </div>
                        <div className="px-4 pb-3">
                          {dadosCategorias.map((item, i) => (
                            <div
                              key={item.nome}
                              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-border/70 py-2 text-[10px]"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <i
                                  className="h-2 w-2 shrink-0 rounded-[2px]"
                                  style={{
                                    backgroundColor:
                                      coresCategorias[
                                        i % coresCategorias.length
                                      ],
                                  }}
                                />
                                <span className="truncate">{item.nome}</span>
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {formatarMoeda(item.valor)}
                              </span>
                              <strong className="w-12 text-right font-mono">
                                {totalCategorias > 0
                                  ? (
                                      (item.valor / totalCategorias) *
                                      100
                                    ).toLocaleString("pt-BR", {
                                      maximumFractionDigits: 1,
                                    })
                                  : "0"}
                                %
                              </strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
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
      <Dialog
        open={Boolean(participacaoEditando)}
        onOpenChange={(open) => {
          if (!open && !salvandoParticipacao) setParticipacaoEditando(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar participação do cotista</DialogTitle>
            <DialogDescription>
              Atualize a aeronave vinculada e o percentual da cota de{" "}
              {participacaoEditando?.nome}. Alterar aeronave é bloqueado quando
              existe histórico financeiro associado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cotista-aeronave-editada">Aeronave</Label>
              <select
                id="cotista-aeronave-editada"
                value={aeronaveEditada}
                onChange={(event) => setAeronaveEditada(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {aeronaves.map((aeronave) => (
                  <option key={aeronave.id} value={aeronave.id}>
                    {aeronave.matricula_registro} · {aeronave.modelo}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cotista-percentual-editado">
                Percentual da cota (%)
              </Label>
              <Input
                id="cotista-percentual-editado"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentualEditado}
                onChange={(event) => setPercentualEditado(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={salvandoParticipacao}
              onClick={() => setParticipacaoEditando(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoParticipacao}
              onClick={() => void salvarParticipacao()}
            >
              {salvandoParticipacao ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
