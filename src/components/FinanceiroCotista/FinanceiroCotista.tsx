import "./financeiro-cotista.css";
import "./fechamento-compacto.css";
import { DarBaixaCotistaDialog } from "./DarBaixaCotistaDialog";
import {
  LancamentosDespesaCotista,
  SeletorMesesCotista,
  deslocarMes,
  type OpcaoEdicao,
} from "./LancamentosDespesaCotista";
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
  documentosDoLancamento,
  numerosDocumentosDoLancamento,
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
import { FechamentoBalancoReferencia } from "./FechamentoBalancoReferencia";
import {
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
   
   
   
   
   
   
   
   
  color: hsl(var(--foreground)); color-scheme: var(--app-color-scheme, dark);
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
.erp-financeiro .erp-tabela-saidas .erp-ordenar-cotista { height:auto; min-height:40px; padding:6px 0; }
.erp-financeiro .erp-tabela-saidas .erp-ordenar-cotista > span { overflow:visible; overflow-wrap:anywhere; text-overflow:clip; white-space:normal; line-height:1.2; }
.erp-financeiro .erp-tabela-saidas .erp-linha { height:auto; }
.erp-financeiro .erp-tabela-saidas .erp-celula-quebra { overflow:visible; overflow-wrap:anywhere; text-overflow:clip; white-space:normal; }
.erp-financeiro .erp-tabela-saidas .erp-celula-quebra .despesa-cell-text { overflow:visible; overflow-wrap:anywhere; text-overflow:clip; white-space:normal; line-height:1.35; }
.despesas-shell .erp-financeiro .erp-tabela th { height:34px; padding:0 10px; }
.despesas-shell .erp-financeiro .erp-tabela td { padding:4px 10px; font-size:12px; line-height:1.3; }
.despesas-shell .erp-financeiro .erp-tabela td.erp-td-data { padding-top:4px; padding-bottom:4px; }
.despesas-shell .erp-financeiro .erp-tabela tfoot td { padding:2px 10px; }
.despesas-shell .erp-financeiro .erp-linha { height:34px; }
.despesas-shell .erp-financeiro .erp-ordenar { height:30px; }
.despesas-shell .erp-financeiro .erp-texto-secundario { margin-top:2px; margin-bottom:2px; line-height:13px; }
.despesas-shell .erp-financeiro .erp-expandir { height:22px; }
.despesas-shell .erp-financeiro .erp-valor { font-size:13px; }
.despesas-shell .erp-financeiro .erp-tabela .erp-documento { font-size:11px; }
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
  --bg-page:var(--light-surface, #090d13); --bg-surface:var(--light-surface, #111820); --bg-hover:var(--light-surface, #151d27); --bg-selected:var(--light-info-soft, #164d6d);
  --ledger-border:var(--light-line, #293542); --text:var(--light-text, #e1e7ef); --text-muted:var(--light-muted, #9ba9ba); --ledger-accent:var(--light-info, #1599df);
  --success:var(--light-success, #3fb27f); --danger:var(--light-danger, #f53228e0); --warning:var(--light-warning, #f3e141d3);
  --row-height:40px; --header-height:32px; --toolbar-height:36px;
  --font-mono:ui-monospace,SFMono-Regular,Consolas,monospace;
}
.despesas-theme :focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:2px; }
.despesas-theme .despesa-ledger :focus-visible { outline:2px solid var(--ledger-accent); outline-offset:2px; }
.despesas-theme .despesa-toolbar .despesa-primary { height:32px; padding:0 10px; background:#167fb5; border:1px solid var(--light-line, #167fb5); border-radius:4px; color:#fff; font-size:12px; font-weight:600; box-shadow:none; }
.despesas-theme .despesa-toolbar .despesa-primary:hover { background:#167fb5; filter:brightness(.92); }
.despesas-theme .despesa-ledger { min-width:0; width:100%; max-width:100%; overflow:clip; border:1px solid var(--ledger-border); border-radius:4px; background:var(--bg-page); color:var(--text); font-size:13px; line-height:1.4; font-variant-numeric:tabular-nums; }
.despesa-toolbar { display:flex; flex-direction:column; gap:6px; min-height:var(--toolbar-height); padding:6px 8px; border:1px solid var(--ledger-border); border-radius:4px; background:var(--light-soft, #0d131b); overflow:visible; }
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
.despesa-close-month { border-color:var(--light-success-line, #14866d); background:var(--light-success-soft, #116f5c); color:var(--light-text, #fff); }
.despesa-close-month:hover:not(:disabled) { border-color:var(--light-success-line, #1b9b7d); background:var(--light-success-soft, #14866d); }
.despesa-filter-count { display:inline-flex; min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px; border-radius:3px; background:var(--light-info-soft, rgba(31,143,214,.15)); color:var(--ledger-accent); font-size:10px; }
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
.despesa-table-scroll::-webkit-scrollbar-thumb { background:var(--light-surface, #3a4350); border:2px solid var(--bg-page); border-radius:6px; }
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
.despesa-col-resizer:hover,.despesa-col-resizer:focus-visible { background:var(--light-info-soft, rgba(31,143,214,.4)); }
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
.despesas-theme .despesa-checkbox { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; min-width:16px; padding:0; border:1px solid var(--light-line, #3a4350); border-radius:3px; background:var(--bg-page); color:var(--light-text, #fff); box-shadow:none; }
.despesas-theme .despesa-checkbox[data-state="checked"],.despesas-theme .despesa-checkbox[data-state="indeterminate"] { background:var(--ledger-accent); border-color:var(--ledger-accent); }
.despesa-checkbox svg { width:12px; height:12px; }
.despesa-checkbox[data-state="indeterminate"] svg { display:none; }
.despesa-checkbox[data-state="indeterminate"]::after { content:""; width:8px; height:2px; background:currentColor; }
.despesas-theme .despesa-status { display:inline-flex; align-items:center; gap:4px; max-width:100%; height:20px; padding:0 6px; border:0; border-radius:3px; background:transparent; color:var(--text-muted); font-size:11px; font-weight:500; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.despesas-theme .despesa-status[data-status="EM_ABERTO"] { color:var(--warning); background:var(--light-warning-soft, rgba(212,167,44,.12)); }
.despesas-theme .despesa-status[data-status="EM_ATRASO"] { color:var(--danger); background:var(--light-danger-soft, rgba(229,83,75,.12)); }
.despesas-theme .despesa-status[data-status="PAGO"],.despesas-theme .despesa-status[data-status="PAGO_DIRETAMENTE"],.despesas-theme .despesa-status[data-status="REEMBOLSADO"] { color:var(--success); background:var(--light-success-soft, rgba(63,178,127,.12)); }
.despesas-theme .despesa-status[data-status="ESTORNO"] { color:var(--light-warning, #fdba74); background:var(--light-warning-soft, rgba(253,186,116,.12)); }
.despesas-theme .despesa-status[data-status="SAIDA"] { color:var(--light-text, #c0cada); background:var(--light-surface, rgba(192,202,218,.12)); }
.despesas-theme .despesa-status[data-status="AGUARDANDO_REEMBOLSO"] { color:var(--light-violet, #c4b5fd); background:var(--light-violet-soft, rgba(196,181,253,.12)); }
.despesas-theme .despesa-status[data-status="CANCELADO"] { color:var(--light-muted, #b3b3bf); background:var(--light-surface, rgba(179,179,191,.12)); }
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
.cotista-expanded { position:sticky; left:0; width:100%; width:calc(100cqi - 2px); max-width:100%; padding:0 18px 16px; border-left:3px solid var(--light-line, #168fca); border-bottom:1px solid var(--light-line, #d9e0e9); background:var(--light-surface, #f3f5f9); color:var(--light-muted, #243246); }
.expanded-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:11px 0 12px; border-bottom:1px solid var(--light-line, #d5dde7); }
.expanded-heading .panel-kicker { display:block; color:var(--light-info, #168fca); font-size:9px; font-weight:700; letter-spacing:.08em; }
.expanded-heading h3 { margin:3px 0 0; color:var(--light-muted, #263548); font-size:12px; font-weight:600; }
.expanded-support-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,.9fr); gap:0; padding-top:12px; }
.expanded-support-grid > * { min-width:0; padding:0 15px; }
.expanded-support-grid > :first-child { padding-left:0; }
.expanded-support-grid > :last-child { padding-right:0; }
.expanded-support-grid > * + * { border-left:1px solid var(--light-line, #d5dde7); }
.detail-block-title { display:block; margin-bottom:9px; color:var(--light-muted, #75849a); font-size:8px; font-weight:700; letter-spacing:.08em; }
.document-list { display:flex; flex-wrap:wrap; align-items:flex-start; gap:6px; }
.document-list button { display:inline-flex; min-width:0; max-width:100%; min-height:32px; align-items:center; gap:6px; padding:5px 8px; border:1px solid var(--light-line, #cbd5e1); border-radius:4px; background:var(--light-surface, #fff); color:var(--light-muted, #29384b); font-size:9px; text-align:left; cursor:pointer; transition:border-color .15s,background-color .15s; }
.document-list button:hover { border-color:var(--light-line, #168fca); background:var(--light-info-soft, #f5fbff); }
.document-icon { display:flex; width:15px; height:17px; flex:0 0 15px; align-items:center; justify-content:center; color:var(--light-muted, #61738a); }
.document-icon.is-receipt { color:var(--light-success, #25856d); }
.document-copy { display:block; min-width:0; }
.document-copy b { display:block; overflow:hidden; color:var(--light-muted, #29384b); font-size:9px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.document-copy small,.document-open-icon { display:none; }
.support-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:16px; row-gap:10px; }
.support-facts .detail-block-title { grid-column:1 / -1; margin-bottom:0; }
.support-facts p { display:flex; min-width:0; flex-direction:column; gap:3px; margin:0; font-size:10px; }
.support-facts p b { color:var(--light-muted, #34445a); font-size:9px; font-weight:600; }
.support-facts p small { color:var(--light-muted, #7a8798); font-size:9px; overflow-wrap:anywhere; }
.support-note { min-height:100%; }
.support-note p { margin:0; color:var(--light-muted, #78869a); font-size:9px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
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
  .expanded-support-grid > :nth-child(3) { grid-column:1 / -1; min-height:0; padding:12px 0 0; border-top:1px solid var(--light-line, #d5dde7); border-left:0; }
  .expanded-support-grid > :nth-child(2) { border-left:1px solid var(--light-line, #d5dde7); }
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
  .expanded-support-grid > * + * { padding-top:11px; border-top:1px solid var(--light-line, #d5dde7); }
  .expanded-support-grid > :nth-child(3) { grid-column:auto; min-height:0; padding-top:11px; border-top:1px solid var(--light-line, #d5dde7); }
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
  .despesas-theme { --bg-page:var(--light-surface, #fff); --bg-surface:var(--light-surface, #f2f2f2); --bg-hover:var(--light-surface, #f2f2f2); --bg-selected:var(--light-surface, #f2f2f2); --ledger-border:var(--light-line, #ccc); --text:var(--light-muted, #000); --text-muted:var(--light-muted, #444); }
  .despesa-toolbar,.despesa-filter-panel,.despesa-pagination { display:none; }
}

`;

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

export default function FinanceiroCotista({ modoFechamento = false, aoVoltarDashboard }: { modoFechamento?: boolean; aoVoltarDashboard?: () => void }) {
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
    | "ranking"
    | "extrato"
    | "portal-cliente"
  >("lancamentos");
  const [paginaAberta, setPaginaAberta] = useState(false);
  const abasCotista: Array<{
    id: string;
    rotulo: string;
    Icon: typeof ReceiptText;
    corIcone: string;
  }> = modoFechamento ? [{
    id: "fechamento-balanco",
    rotulo: "Fechamento Balanço",
    Icon: PieChart,
    corIcone: "bg-cyan-400/10 text-cyan-400",
  }] : [
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
  const cotistasParaDialog: CotistaAeronave[] = useMemo(
    () => (aeronaveSelecionada ? cotistasAeronave : []),
    [aeronaveSelecionada, cotistasAeronave],
  );


  const aeronaveAtual = aeronaves.find((a) => a.id === aeronaveSelecionada);

  const controlesMesesCotista = (
    <div className={`cotista-meses flex flex-wrap items-center ${modoFechamento ? "gap-1.5" : "gap-2"}`}>
      <SeletorMesesCotista
        mesesSelecionados={mesesAplicados}
        aoAlternar={alternarMesSelecionado}
        aoSelecionarMesAtual={() => selecionarMesUnico(mesAtual)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={modoFechamento ? "h-8 px-2" : "h-10 px-3"}
        aria-label="Mês anterior"
        onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, -1))}
      >
        ‹
      </Button>
      <span className={modoFechamento ? "min-w-28 text-center text-[11px] text-muted-foreground" : "min-w-32 text-center text-xs text-muted-foreground"} aria-live="polite">
        {mesesAplicados.length === 1
          ? rotuloMesCotista(mesReferencia)
          : `${mesesAplicados.length} meses selecionados`}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={modoFechamento ? "h-8 px-2" : "h-10 px-3"}
        aria-label="Próximo mês"
        onClick={() => selecionarMesUnico(deslocarMes(mesReferencia, 1))}
      >
        ›
      </Button>
    </div>
  );

  return (
    <div className={`financeiro-shell financeiro-profissional -mt-2 min-w-0 max-w-full ${modoFechamento ? "financeiro-fechamento-compacto space-y-2" : "space-y-3"}`}>
      <style>{DESPESAS_ESTILOS}</style>
      {aeronaveSelecionada && (
        <div className="cotista-contexto flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {modoFechamento ? "Fechamento Balanço" : "Financeiro Cotista"}
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
          <div className="cotista-contexto-acoes flex flex-wrap items-center gap-2">
            {modoFechamento && aoVoltarDashboard && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5" onClick={aoVoltarDashboard}>
                <ChevronLeft size={14} aria-hidden /> Dashboard financeiro
              </Button>
            )}
            {(modoFechamento || !paginaAberta) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={modoFechamento ? "h-8 gap-1.5 px-2.5" : "h-9 shrink-0 gap-2 self-start sm:self-auto"}
                onClick={() => {
                  setAeronaveSelecionada("");
                  setPaginaAberta(false);
                  setAbaAtiva(modoFechamento ? "fechamento-balanco" : "lancamentos");
                }}
              >
                <ChevronLeft size={14} aria-hidden /> Todas as aeronaves
              </Button>
            )}
          </div>
        </div>
      )}
      {aeronaveSelecionada && paginaAberta && !modoFechamento && (
        <div className="cotista-navegacao flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 justify-start gap-1 border-0 px-3 sm:px-5"
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
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {modoFechamento ? "Balanço Cotista" : "Financeiro Cotista"}
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Selecione uma aeronave
            </h2>
            </div>
            {modoFechamento && aoVoltarDashboard && <Button type="button" variant="outline" size="sm" onClick={aoVoltarDashboard}><ChevronLeft size={14} /> Dashboard financeiro</Button>}
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
                    setAbaAtiva(modoFechamento ? "fechamento-balanco" : "lancamentos");
                    setPaginaAberta(modoFechamento);
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
            abaAtiva !== "lancamentos" &&
            abaAtiva !== "fechamento-balanco" && (
              <section
                className="financeiro-panel -mt-px -mb-1 px-4 py-3"
                aria-label="Competência dos lançamentos"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {controlesMesesCotista}
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

          {!paginaAberta && !modoFechamento ? (
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
            <div className={modoFechamento ? "space-y-2" : "space-y-4"}>
              <div className="financeiro-panel cotista-fechamento-filtros grid grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)_auto]">
                <div className="min-w-0">
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
                  className={modoFechamento ? "h-8 lg:h-8 w-full rounded-md border-border bg-background text-foreground hover:bg-muted" : "w-full border-border bg-background text-foreground hover:bg-muted sm:max-w-sm"}
                  popoverClassName="border-border bg-popover text-popover-foreground"
                />
                {controlesMesesCotista}
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
                <LancamentosDespesaCotista
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
