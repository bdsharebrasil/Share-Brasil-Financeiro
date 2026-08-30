import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CloudSun,
  CreditCard,
  FileBarChart,
  FileCheck2,
  FileClock,
  FileText,
  GraduationCap,
  Fuel,
  Gauge,
  Home,
  Key,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  Mail,
  Menu,
  Moon,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  Plane,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/login";
import { cn } from "@/lib/utils";
import { getUnreadMessageCount } from "@/lib/api";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation } from "wouter";

type Workspace = "gestor" | "operacoes" | "financeiro" | "portal";
type Theme = "dark" | "light";
type IconType = typeof LayoutDashboard;

type MenuItem = {
  id: string;
  label: string;
  icon: IconType;
  badge?: string;
};

const workspaceLabels: Record<Workspace, string> = {
  portal: "Portal Cliente",
  operacoes: "Operações",
  financeiro: "Financeiro",
  gestor: "Gestor",
};

const workspaceDescriptions: Record<Workspace, string> = {
  gestor: "Ferramentas de gestão",
  operacoes: "Controle da operação aérea",
  financeiro: "Conciliação e rotinas administrativas",
  portal: "Acompanhamento do cliente",
};

const menus: Record<Workspace, MenuItem[]> = {
  operacoes: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "agendamentos", label: "Agendamentos", icon: CalendarDays, badge: "4" },
    { id: "plano-de-voo", label: "Plano de voo", icon: FileText },
    { id: "diario-de-bordo", label: "Diário de bordo", icon: NotebookPen },
    { id: "tripulacao", label: "Tripulação", icon: Users },
    { id: "abastecimentos", label: "Abastecimentos", icon: Fuel },
    { id: "ctm", label: "CTM", icon: Wrench },
  ],
  financeiro: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "recibos", label: "Emissão de recibo", icon: Receipt, badge: "8" },
    { id: "despesas", label: "Relatório despesa de viagem", icon: FileBarChart },
    { id: "pagamentos", label: "Programação de pagamento", icon: CreditCard, badge: "5" },
    { id: "email", label: "E-mail", icon: Mail },
    { id: "ponto", label: "Ponto e histórico do ponto", icon: Clock3 },
    { id: "ciclo", label: "Ciclo de voo", icon: RefreshCw },
  ],
  gestor: [
    { id: "overview", label: "Ferramentas de Gestão", icon: LayoutDashboard },
    { id: "simulador-custos", label: "Simulador de Custos", icon: CircleDollarSign },
    { id: "financeiro-share", label: "Financeiro Share Brasil", icon: WalletCards, badge: "3" },
    { id: "gestao-funcionarios", label: "Gestão de Funcionários", icon: Users },
    { id: "financeiro-cotista", label: "Financeiro Cotistas", icon: Users },
    { id: "master", label: "Master", icon: LineChart },
    { id: "configuracoes", label: "Configurações", icon: Settings2 },
  ],
  portal: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard, badge: "2" },
    { id: "documentos", label: "Documentos", icon: FileCheck2 },
  ],
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-0")}>
      <div className="relative h-9 w-9 shrink-0" aria-label="Share Brasil">
        <span className="absolute left-1 top-1 h-[18px] w-[18px] rotate-[-12deg] rounded-[7px] bg-[#4f7d4a]" />
        <span className="absolute bottom-1 left-1.5 h-[18px] w-[18px] rotate-[18deg] rounded-[7px] bg-[#f1c348]" />
        <span className="absolute right-1 top-1.5 h-[18px] w-[18px] rotate-[14deg] rounded-[7px] bg-[#167db7]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="text-[14px] font-extrabold tracking-[.22em] text-foreground">SHARE</p>
          <p className="mt-1 text-[10px] font-semibold italic tracking-[.12em] text-primary">Brasil</p>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid="button-toggle-theme"
      aria-label={`Ativar modo ${theme === "dark" ? "claro" : "escuro"}`}
      className="hidden h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:flex"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      <span className="text-[10px] font-bold uppercase tracking-[.14em]">{theme === "dark" ? "Claro" : "Escuro"}</span>
    </button>
  );
}

function TopBar({
  workspace,
  theme,
  onWorkspaceChange,
  onToggleTheme,
  onOpenMenu,
}: {
  workspace: Workspace;
  theme: Theme;
  onWorkspaceChange: (workspace: Workspace) => void;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
}) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpenMenu} data-testid="button-open-menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
          <Menu size={20} />
        </button>
        <div className="md:hidden"><LogoMark compact /></div>
        <div className="hidden min-w-0 items-center gap-1 rounded-xl border border-border bg-card/70 p-1 md:flex">
          {(Object.keys(workspaceLabels) as Workspace[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onWorkspaceChange(item)}
              data-testid={`button-workspace-${item}`}
              className={cn(
                "rounded-lg px-3 py-2 text-[11px] font-bold transition-all",
                workspace === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {workspaceLabels[item]}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-muted-foreground lg:flex">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#5bbd75]" />
          Sistema operacional
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground lg:flex">
          <Clock3 size={13} className="text-primary" />
          <span className="text-foreground">{time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="text-primary/70">BRT</span>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-2.5 py-2 text-[10px] text-muted-foreground xl:flex">
          <CloudSun size={14} className="text-[#f1c348]" />
          <span>São Paulo</span>
          <strong className="font-mono text-foreground">22°C</strong>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button type="button" data-testid="button-notifications" className="relative rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f1c348]" />
        </button>
        <button type="button" data-testid="button-user-menu" className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b4a78] text-[11px] font-bold text-white ring-2 ring-primary/10">CM</button>
      </div>
    </header>
  );
}

const sidebarMenuGroups = [
  {
    title: "Navegação Principal",
    items: [
      { id: "overview", label: "Início", icon: Home },
      { id: "documentos", label: "Documentos", icon: FileText },
      { id: "senhas", label: "Senhas", icon: Key },
      { id: "mensagens", label: "Mensagens", icon: Mail, badgeKey: "unreadMessages" },
      { id: "minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare },
    ],
  },
  { title: "Agenda & Contatos", items: [{ id: "agenda", label: "Agenda", icon: Calendar }] },
  {
    title: "Financeiro & Cartões",
    items: [
      { id: "solicitacoes-compras", label: "Solicitações compras/pagamentos", icon: CreditCard },
      { id: "cartoes-corporativos", label: "Cartões Corporativos", icon: WalletCards },
    ],
  },
  { title: "Ajuda", items: [{ id: "centro-treinamento", label: "Centro Treinamento", icon: GraduationCap }] },
] satisfies Array<{ title: string; items: Array<MenuItem & { badgeKey?: "unreadMessages" }> }>;

const sidebarItems = sidebarMenuGroups.flatMap((group) => group.items);

function Sidebar({
  activeMenu,
  open,
  collapsed,
  onClose,
  onToggleCollapse,
  onMenuChange,
}: {
  activeMenu: string;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onMenuChange: (menu: string) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(sidebarMenuGroups.map((group) => group.title));
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let active = true;
    void getUnreadMessageCount()
      .then(({ unread }) => { if (active) setUnreadMessages(unread); })
      .catch(() => { if (active) setUnreadMessages(0); });
    return () => { active = false; };
  }, []);

  const selectItem = (id: string) => {
    onMenuChange(id);
    onClose();
  };

  const renderMobileItem = (item: typeof sidebarItems[number]) => {
    const Icon = item.icon;
    const selected = activeMenu === item.id;
    const badge = item.badgeKey === "unreadMessages" ? unreadMessages : 0;
    return <button type="button" key={item.id} onClick={() => selectItem(item.id)} data-testid={`link-menu-${item.id}`} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold transition-colors", selected ? "border-primary bg-primary/15 text-primary" : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground")}><Icon size={16} strokeWidth={selected ? 2.3 : 1.8} /><span className="min-w-0 flex-1 truncate">{item.label}</span>{badge > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{badge}</span>}</button>;
  };

  return <>
    {collapsed ? <div className="fixed left-3 top-[84px] z-30 hidden md:block"><button type="button" aria-label="Abrir menu" onClick={onToggleCollapse} data-testid="button-expand-sidebar" className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-colors hover:bg-sidebar-accent"><ChevronRight size={18} /></button></div> : <aside className="fixed left-0 top-[68px] z-30 hidden h-[calc(100dvh-68px)] w-[76px] flex-col items-center border-r border-sidebar-border bg-sidebar py-4 md:flex"><button type="button" aria-label="Fechar menu" onClick={onToggleCollapse} data-testid="button-collapse-sidebar" className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"><ChevronLeft size={16} /></button><nav className="flex w-full flex-col items-center gap-3 px-2">{sidebarItems.map((item) => { const Icon = item.icon; const selected = activeMenu === item.id; const badge = item.badgeKey === "unreadMessages" ? unreadMessages : 0; return <button type="button" key={item.id} onClick={() => selectItem(item.id)} data-testid={`sidebar-icon-${item.id}`} title={item.label} className={cn("group relative flex h-10 w-10 items-center justify-center rounded-full border transition-all", selected ? "border-sidebar-primary bg-sidebar-primary/15 text-sidebar-primary shadow-[0_0_15px_rgba(32,177,221,.22)]" : "border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70 hover:scale-105 hover:border-sidebar-primary hover:bg-sidebar-primary/10 hover:text-sidebar-primary")}><Icon size={18} strokeWidth={selected ? 2.3 : 1.8} />{badge > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">{badge}</span>}<span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2.5 py-1 text-xs text-sidebar-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{item.label}</span></button>; })}</nav></aside>}

    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="left" className="w-80 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <div className="flex h-[68px] items-center border-b border-sidebar-border px-6"><LogoMark /><span className="ml-auto rounded-md border border-sidebar-border px-2 py-1 font-mono text-[9px] text-sidebar-foreground/40">MENU</span></div>
        <nav className="h-[calc(100dvh-68px)] space-y-3 overflow-y-auto p-4">
          {sidebarMenuGroups.map((group) => <Collapsible key={group.title} open={expandedGroups.includes(group.title)} onOpenChange={() => setExpandedGroups((current) => current.includes(group.title) ? current.filter((title) => title !== group.title) : [...current, group.title])} className="rounded-xl border border-sidebar-border bg-sidebar-accent/25"><CollapsibleTrigger className="flex w-full items-center justify-between px-3.5 py-3 text-left text-[10px] font-bold uppercase tracking-[.12em] text-sidebar-foreground/60"><span>{group.title}</span>{expandedGroups.includes(group.title) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</CollapsibleTrigger><CollapsibleContent className="space-y-1 px-2 pb-2">{group.items.map(renderMobileItem)}</CollapsibleContent></Collapsible>)}
        </nav>
      </SheetContent>
    </Sheet>
  </>;
}

function WorkspaceIcon({ workspace, size = 18 }: { workspace: Workspace; size?: number }) {
  const Icon = workspace === "operacoes" ? Plane : workspace === "financeiro" ? CircleDollarSign : workspace === "portal" ? Users : Gauge;
  return <Icon size={size} />;
}

function PageEyebrow({ children }: { children: ReactNode }) {
  return <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{children}</div>;
}

function SectionHeader({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border px-4 py-3.5"><div className="flex min-w-0 items-center gap-2.5"><span className="text-primary">{icon}</span><div className="min-w-0"><h2 className="truncate text-xs font-bold">{title}</h2>{detail && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>}</div></div>{action}</div>;
}

function Hero({ workspace, title, subtitle, children }: { workspace: Workspace; title: string; subtitle: string; children?: ReactNode }) {
  return <section className="hero-panel relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card"><div className="command-grid absolute inset-0 opacity-40" /><div className={cn("absolute -right-24 -top-32 h-80 w-80 rounded-full blur-3xl", workspace === "operacoes" ? "bg-primary/12" : workspace === "financeiro" ? "bg-[#f1c348]/10" : workspace === "portal" ? "bg-[#8d6be8]/10" : "bg-primary/12")} /><div className="relative flex min-h-[175px] flex-col justify-between gap-8 p-6 md:min-h-[205px] md:p-8"><div className="flex items-center justify-between gap-4"><PageEyebrow>Dashboard {workspaceLabels[workspace]}</PageEyebrow><span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#5bbd75]" /> Live feed</span></div><div className="flex items-end justify-between gap-6"><div><p className="mb-2 text-xs font-semibold text-muted-foreground">{subtitle}</p><h1 className="text-[28px] font-extrabold tracking-[-.05em] text-foreground md:text-[38px]">{title}</h1></div>{children}</div></div></section>;
}

function KpiCard({ label, value, detail, tone = "blue", icon, trend }: { label: string; value: string; detail: string; tone?: "blue" | "green" | "amber" | "red" | "violet"; icon: ReactNode; trend?: string }) {
  const styles = { blue: "text-primary bg-primary/10", green: "text-[#6bd188] bg-[#5bbd75]/10", amber: "text-[#f4cc64] bg-[#f1c348]/10", red: "text-[#ed8c90] bg-[#e77b80]/10", violet: "text-[#b397ff] bg-[#8d6be8]/10" };
  return <div className="group rounded-xl border border-border bg-card/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><span className={cn("rounded-lg p-2", styles[tone])}>{icon}</span></div><div className="mt-4 flex items-end justify-between gap-3"><strong className="font-mono text-[23px] font-medium tracking-[-.05em]">{value}</strong>{trend && <span className={cn("mb-1 flex items-center gap-0.5 text-[9px] font-bold", trend.startsWith("+") ? "text-[#6bd188]" : "text-[#ed8c90]")}>{trend.startsWith("+") ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{trend}</span>}</div><p className="mt-1 text-[10px] leading-snug text-muted-foreground">{detail}</p></div>;
}

function QuickAction({ icon, label, detail, color = "blue", onClick }: { icon: ReactNode; label: string; detail: string; color?: "blue" | "green" | "amber" | "violet"; onClick: () => void }) {
  const colors = { blue: "text-primary bg-primary/10", green: "text-[#6bd188] bg-[#5bbd75]/10", amber: "text-[#f4cc64] bg-[#f1c348]/10", violet: "text-[#b397ff] bg-[#8d6be8]/10" };
  return <button type="button" onClick={onClick} className="group flex min-h-[104px] flex-col justify-between rounded-xl border border-border bg-card/65 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[.04]"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colors[color])}>{icon}</span><span><span className="flex items-center justify-between gap-2 text-[11px] font-bold"><span>{label}</span><ArrowRight size={12} className="text-muted-foreground transition-transform group-hover:translate-x-1" /></span><span className="mt-1 block text-[9px] text-muted-foreground">{detail}</span></span></button>;
}

function ProgressBar({ value, color = "blue" }: { value: number; color?: "blue" | "green" | "amber" | "red" }) {
  const colors = { blue: "bg-primary", green: "bg-[#5bbd75]", amber: "bg-[#f1c348]", red: "bg-[#e77b80]" };
  return <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full transition-all", colors[color])} style={{ width: `${value}%` }} /></div>;
}

function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  const styles = { green: "bg-[#5bbd75]/12 text-[#6bd188]", amber: "bg-[#f1c348]/14 text-[#f4cc64]", red: "bg-[#e77b80]/12 text-[#ed8c90]", blue: "bg-primary/12 text-primary", neutral: "bg-secondary text-muted-foreground" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.07em]", styles[tone])}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

function EmptyState({ label = "Nenhum registro encontrado" }: { label?: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-center"><div className="mb-3 rounded-xl bg-secondary p-3 text-muted-foreground"><FileText size={21} /></div><p className="text-xs font-bold">{label}</p><p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Os dados aparecerão aqui assim que forem registrados no sistema.</p></div>;
}

function GestorToolsDashboard({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const modules: Array<{ id: string; title: string; description: string; icon: IconType; tone: "amber" | "green" | "blue" | "violet" }> = [
    { id: "simulador-custos", title: "Simulador de Custos", description: "Projeções e cenários financeiros", icon: CircleDollarSign, tone: "amber" },
    { id: "financeiro-share", title: "Financeiro Share Brasil", description: "Caixa, contas e documentos", icon: WalletCards, tone: "green" },
    { id: "gestao-funcionarios", title: "Gestão de Funcionários", description: "Equipe, folha e permissões", icon: Users, tone: "blue" },
    { id: "financeiro-cotista", title: "Financeiro Cotistas", description: "Balanços e relatórios individuais", icon: CircleDollarSign, tone: "green" },
    { id: "master", title: "Master", description: "Visão central e parâmetros", icon: LineChart, tone: "amber" },
  ];
  return <div className="route-enter"><div className="mb-6"><PageEyebrow>Gestor / Acesso rápido</PageEyebrow><h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Ferramentas de Gestão</h1><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Selecione um módulo para acessar a página de trabalho correspondente.</p></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <ManagementToolCard key={module.id} {...module} onClick={() => onNavigate(module.id)} />)}</section><section className="mt-8 min-h-[240px] overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<Clock3 size={15} />} title="Aprovações Pendentes" detail="Itens que aguardam sua análise" action={<button type="button" className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline">Ver todas <ArrowRight size={13} /></button>} /><div className="flex min-h-[180px] flex-col items-center justify-center p-6 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/35 text-muted-foreground/45"><Clock3 size={23} /></div><p className="text-xs font-bold text-muted-foreground">Nenhuma aprovação pendente</p><p className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground/70">Quando houver pagamentos, fechamentos ou documentos aguardando sua decisão, eles aparecerão aqui.</p></div></section></div>;
}

function ManagementToolCard({ id, title, description, icon: Icon, tone, onClick }: { id: string; title: string; description: string; icon: IconType; tone: "amber" | "green" | "blue" | "violet"; onClick: () => void }) {
  const tones = { amber: "bg-[#f1c348]/10 text-[#f4a64d]", green: "bg-[#2bbf8a]/10 text-[#45d5a5]", blue: "bg-primary/10 text-primary", violet: "bg-[#8d6be8]/10 text-[#b397ff]" };
  return <button type="button" onClick={onClick} data-testid={`button-management-tool-${id}`} className="group flex min-h-[92px] items-center gap-4 rounded-xl border border-border bg-card/65 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card"><span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tones[tone])}><Icon size={22} strokeWidth={1.8} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-foreground">{title}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{description}</span></span><ArrowRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></button>;
}

function GestorDashboard({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const [period, setPeriod] = useState("Agosto 2026");
  const [notice, setNotice] = useState("");
  const months = ["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"];
  const bars = [48, 62, 54, 76, 68, 88];
  return <div className="route-enter"><Hero workspace="gestor" title="Bom dia, Camilla" subtitle="Visão executiva · atualizado há 12 minutos"><div className="hidden rounded-lg border border-border/70 bg-background/35 px-3 py-2 text-right sm:block"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Período consolidado</p><p className="mt-1 text-[11px] font-bold text-foreground">{period}</p></div></Hero>{notice && <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/7 px-3.5 py-2.5 text-[11px] text-primary"><span>{notice}</span><button type="button" onClick={() => setNotice("")}><X size={13} /></button></div>}<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Caixa Share" value="R$ 286.420" detail="Saldo consolidado da administradora" tone="green" icon={<WalletCards size={16} />} trend="+8,4%" /><KpiCard label="A receber" value="R$ 84.630" detail="12 cobranças em aberto" tone="blue" icon={<ArrowDownRight size={16} />} trend="+12,1%" /><KpiCard label="A pagar" value="R$ 42.180" detail="8 pagamentos programados" tone="amber" icon={<CreditCard size={16} />} /><KpiCard label="Fechamento mensal" value="09 / 12" detail="3 balanços aguardam conferência" tone="violet" icon={<ClipboardCheck size={16} />} /></div><div className="mb-5 rounded-xl border border-border bg-card/70 p-1"><div className="grid gap-1 sm:grid-cols-4"><QuickAction icon={<Plus size={16} />} label="Novo lançamento" detail="Registrar entrada ou saída" onClick={() => setNotice("Novo lançamento: selecione a conta e o centro de custo.")} /><QuickAction icon={<CreditCard size={16} />} label="Contas a pagar" detail="5 vencem nos próximos dias" color="amber" onClick={() => onNavigate("financeiro-share")} /><QuickAction icon={<FileCheck2 size={16} />} label="Emitir NF de saída" detail="Notas mensais da administração" color="green" onClick={() => setNotice("Emissão de NF de saída será aberta na próxima etapa.")} /><QuickAction icon={<Receipt size={16} />} label="Recibo de saída" detail="3 clientes sem nota fiscal" color="violet" onClick={() => setNotice("Recibos de saída: 3 documentos aguardando emissão.")} /></div></div><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<LineChart size={15} />} title="Movimentação do caixa Share" detail="Entradas e saídas · últimos 6 meses" action={<select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-[10px] font-semibold outline-none"><option>Agosto 2026</option><option>Julho 2026</option><option>Junho 2026</option></select>} /><div className="p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] text-muted-foreground">Saldo no período</p><p className="mt-1 font-mono text-2xl tracking-[-.05em]">R$ 286.420</p></div><StatusBadge tone="green">Caixa saudável</StatusBadge></div><div className="mt-7 flex h-[168px] items-end gap-2 border-b border-border/70 pb-0 sm:gap-4">{bars.map((height, index) => <div key={months[index]} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="relative flex w-full max-w-[42px] flex-1 items-end"><div className="w-full rounded-t-md bg-primary/20 transition-all group-hover:bg-primary/35" style={{ height: `${height}%` }} /><div className="absolute bottom-0 left-1/2 w-[5px] -translate-x-1/2 rounded-t-full bg-primary" style={{ height: `${Math.max(15, height - 20)}%` }} /></div><span className="font-mono text-[9px] text-muted-foreground">{months[index]}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Entradas</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary/25" />Saídas</span><span className="ml-auto font-mono text-[#6bd188]">+ R$ 21.940 no mês</span></div></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<AlertCircle size={15} />} title="Atenção do gestor" detail="Itens que precisam de decisão" action={<button type="button" className="text-[10px] font-bold text-primary hover:underline">Ver tudo</button>} /><div className="divide-y divide-border/70"><AttentionItem tone="amber" title="3 fechamentos aguardam conferência" description="DGA, PT-OJG e PR-SBR" action="Conferir" onClick={() => onNavigate("financeiro-cotista")} /><AttentionItem tone="red" title="2 clientes em inadimplência crítica" description="Saldo vencido há mais de 30 dias" action="Analisar" onClick={() => onNavigate("financeiro-cotista")} /><AttentionItem tone="blue" title="5 pagamentos programados" description="Próximo vencimento em 02 set." action="Abrir" onClick={() => onNavigate("financeiro-share")} /></div></section></div><div className="mt-5 grid gap-5 xl:grid-cols-[.95fr_1.05fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<ClipboardCheck size={15} />} title="Fechamento do balanço mensal" detail="Competência · agosto de 2026" action={<StatusBadge tone="amber">Em andamento</StatusBadge>} /><div className="p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-extrabold tracking-[-.05em]">75%</p><p className="mt-1 text-[10px] text-muted-foreground">9 de 12 cotistas conferidos</p></div><div className="text-right"><p className="font-mono text-[11px] font-bold text-[#f4cc64]">3 pendentes</p><p className="mt-1 text-[9px] text-muted-foreground">prazo: 05 set.</p></div></div><div className="mt-5"><ProgressBar value={75} color="amber" /></div><div className="mt-5 grid grid-cols-3 gap-2"><CloseStep label="Lançamentos" value="12 / 12" complete /><CloseStep label="Conferência" value="9 / 12" /><CloseStep label="Envio cotistas" value="0 / 12" /></div><button type="button" onClick={() => onNavigate("financeiro-cotista")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/8 py-2.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary/15">Abrir fechamento <ArrowRight size={13} /></button></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<Users size={15} />} title="Financeiro Cotista" detail="Resumo de saldos e utilização" action={<button type="button" onClick={() => onNavigate("financeiro-cotista")} className="text-[10px] font-bold text-primary hover:underline">Ver relatório</button>} /><div className="overflow-x-auto"><table className="w-full min-w-[450px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3">Horas</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Status</th></tr></thead><tbody><ShareholderRow name="DGA Administradora" aircraft="PT-OJG" hours="18,4 h" balance="R$ 12.450" tone="green" status="Regular" /><ShareholderRow name="Dejalmo Ribeiro" aircraft="PR-SBR" hours="11,2 h" balance="- R$ 1.830" tone="amber" status="Atenção" /><ShareholderRow name="Mauricio Almeida" aircraft="PT-OJG" hours="8,7 h" balance="R$ 3.260" tone="green" status="Regular" /><ShareholderRow name="Gerson Duarte" aircraft="PT-OJG" hours="4,2 h" balance="- R$ 6.420" tone="red" status="Inadimplente" /></tbody></table></div></section></div><NoticeBoard /></div>;
}

function AttentionItem({ tone, title, description, action, onClick }: { tone: "amber" | "red" | "blue"; title: string; description: string; action: string; onClick: () => void }) {
  const colors = { amber: "text-[#f4cc64] bg-[#f1c348]/10", red: "text-[#ed8c90] bg-[#e77b80]/10", blue: "text-primary bg-primary/10" };
  return <div className="flex items-start gap-3 p-4"><span className={cn("mt-0.5 rounded-lg p-2", colors[tone])}>{tone === "red" ? <AlertCircle size={14} /> : tone === "amber" ? <Clock3 size={14} /> : <FileClock size={14} />}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold leading-snug">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{description}</p></div><button type="button" onClick={onClick} className="mt-1 text-[10px] font-bold text-primary hover:underline">{action}</button></div>;
}

function CloseStep({ label, value, complete = false }: { label: string; value: string; complete?: boolean }) {
  return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><div className="flex items-center gap-1.5">{complete ? <CheckCircle2 size={12} className="text-[#6bd188]" /> : <span className="h-2.5 w-2.5 rounded-full border border-[#f4cc64]" />}<span className="truncate text-[9px] font-bold">{label}</span></div><p className="mt-2 font-mono text-[10px] text-muted-foreground">{value}</p></div>;
}

function ShareholderRow({ name, aircraft, hours, balance, tone, status }: { name: string; aircraft: string; hours: string; balance: string; tone: "green" | "amber" | "red"; status: string }) {
  return <tr className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="text-[10px] font-bold">{name}</p><p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{aircraft}</p></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{hours}</td><td className={cn("px-4 py-3 text-right font-mono text-[10px] font-bold", tone === "red" ? "text-[#ed8c90]" : "text-foreground")}>{balance}</td><td className="px-4 py-3"><StatusBadge tone={tone}>{status}</StatusBadge></td></tr>;
}

function NoticeBoard() {
  return <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<Bell size={15} />} title="Recados para todos" detail="Comunicação interna da Share Brasil" action={<button type="button" className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"><Plus size={12} /> Novo recado</button>} /><div className="grid gap-3 p-4 md:grid-cols-3"><Notice tone="blue" title="Fechamento de agosto" description="O prazo para conferência dos balanços é 05 de setembro." time="há 26 min" /><Notice tone="amber" title="Manutenção programada" description="PT-OJG ficará indisponível em 03/09 das 08h às 12h." time="há 1 h" /><Notice tone="green" title="Novo procedimento" description="Recibos de saída devem ser anexados ao lançamento." time="ontem" /></div></section>;
}

function Notice({ tone, title, description, time }: { tone: "blue" | "amber" | "green"; title: string; description: string; time: string }) {
  return <div className="rounded-lg border border-border/70 bg-secondary/20 p-3.5"><div className="flex items-start justify-between gap-3"><span className={cn("h-2 w-2 rounded-full", tone === "blue" ? "bg-primary" : tone === "amber" ? "bg-[#f1c348]" : "bg-[#5bbd75]")} /><span className="font-mono text-[9px] text-muted-foreground">{time}</span></div><p className="mt-3 text-[11px] font-bold">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p></div>;
}

function OperationsDashboard({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const [notice, setNotice] = useState("");
  return <div className="route-enter"><Hero workspace="operacoes" title="Bom dia, Camilla" subtitle="Centro de comando · quinta-feira, 30 de agosto"><div className="hidden items-center gap-2 rounded-lg border border-[#5bbd75]/25 bg-[#5bbd75]/8 px-3 py-2 sm:flex"><span className="pulse-dot h-2 w-2 rounded-full bg-[#5bbd75]" /><span className="text-[10px] font-bold text-[#6bd188]">Operação normal</span></div></Hero>{notice && <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/7 px-3.5 py-2.5 text-[11px] text-primary"><span>{notice}</span><button type="button" onClick={() => setNotice("")}><X size={13} /></button></div>}<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Voos hoje" value="04" detail="2 em voo agora" tone="blue" icon={<Plane size={16} />} /><KpiCard label="Tripulação" value="12" detail="3 escalas confirmadas" tone="violet" icon={<Users size={16} />} /><KpiCard label="Pendências" value="03" detail="1 documento crítico" tone="amber" icon={<AlertCircle size={16} />} /></div><div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><QuickAction icon={<CalendarDays size={16} />} label="Agendamentos" detail="4 voos" onClick={() => onNavigate("agendamentos")} /><QuickAction icon={<FileText size={16} />} label="Plano de voo" detail="2 em revisão" color="violet" onClick={() => onNavigate("plano-de-voo")} /><QuickAction icon={<NotebookPen size={16} />} label="Diário de bordo" detail="Atualizar" color="green" onClick={() => onNavigate("diario-de-bordo")} /><QuickAction icon={<Fuel size={16} />} label="Abastecimento" detail="Último há 1h" color="amber" onClick={() => onNavigate("abastecimentos")} /><QuickAction icon={<Wrench size={16} />} label="CTM" detail="Manutenção" color="green" onClick={() => onNavigate("ctm")} /></div><div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<Activity size={15} />} title="Status de voo ao vivo" detail="Aeronaves agendadas e em voo" action={<button type="button" className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-secondary"><RefreshCw size={12} /> Atualizar</button>} /><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Horário</th><th className="px-4 py-3">Piloto</th><th className="px-4 py-3">Status</th></tr></thead><tbody><FlightRow aircraft="PT-OJG" route="SBGR → SBRJ" time="09:40" pilot="Mauricio A." status="Em voo" tone="green" /><FlightRow aircraft="PR-SBR" route="SBMT → SBSP" time="11:20" pilot="Dejalmo R." status="Embarque" tone="blue" /><FlightRow aircraft="PT-FAZ" route="SBKP → SBGL" time="14:10" pilot="A definir" status="Agendado" tone="amber" /><FlightRow aircraft="PP-XAB" route="SBRP → SBSP" time="16:30" pilot="Gerson D." status="Agendado" tone="amber" /></tbody></table></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<Bell size={15} />} title="Recados para todos" detail="Últimas comunicações" action={<button type="button" onClick={() => setNotice("Novo recado: funcionalidade em preparação.")} className="text-[10px] font-bold text-primary hover:underline">Novo recado</button>} /><div className="divide-y divide-border/70"><NoticeCompact title="Manutenção PT-OJG" text="Aeronave liberada após inspeção de rotina." time="09:12" tone="green" /><NoticeCompact title="Alteração de escala" text="Voo PR-SBR confirmado para 11:20." time="08:48" tone="blue" /><NoticeCompact title="Atenção ao abastecimento" text="Anexar comprovante ao diário de bordo." time="ontem" tone="amber" /></div></section></div><div className="mt-5 grid gap-5 md:grid-cols-3"></div></div>;
}

function FlightRow({ aircraft, route, time, pilot, status, tone }: { aircraft: string; route: string; time: string; pilot: string; status: string; tone: "green" | "blue" | "amber" }) {
  return <tr className="border-b border-border/60 last:border-0"><td className="px-4 py-3.5"><div className="flex items-center gap-2.5"><span className={cn("flex h-7 w-7 items-center justify-center rounded-md", tone === "green" ? "bg-[#5bbd75]/10 text-[#6bd188]" : tone === "blue" ? "bg-primary/10 text-primary" : "bg-[#f1c348]/10 text-[#f4cc64]")}><Plane size={13} /></span><span className="font-mono text-[10px] font-bold">{aircraft}</span></div></td><td className="px-4 py-3.5 font-mono text-[10px] text-muted-foreground">{route}</td><td className="px-4 py-3.5 font-mono text-[10px] font-bold">{time}</td><td className="px-4 py-3.5 text-[10px] text-muted-foreground">{pilot}</td><td className="px-4 py-3.5"><StatusBadge tone={tone}>{status}</StatusBadge></td></tr>;
}

function NoticeCompact({ title, text, time, tone }: { title: string; text: string; time: string; tone: "green" | "blue" | "amber" }) {
  return <div className="flex gap-3 p-4"><span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", tone === "green" ? "bg-[#5bbd75]" : tone === "blue" ? "bg-primary" : "bg-[#f1c348]")} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="text-[10px] font-bold">{title}</p><span className="font-mono text-[9px] text-muted-foreground">{time}</span></div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{text}</p></div></div>;
}

function MiniPanel({ title, icon, value, detail, action, onClick }: { title: string; icon: ReactNode; value: string; detail: string; action: string; onClick: () => void }) {
  return <section className="rounded-xl border border-border bg-card/75 p-4"><div className="flex items-center gap-2 text-primary"><span>{icon}</span><span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{title}</span></div><p className="mt-5 font-mono text-2xl tracking-[-.05em]">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p><button type="button" onClick={onClick} className="mt-4 flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">{action}<ArrowRight size={12} /></button></section>;
}

function FinanceDashboard({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const [cashView, setCashView] = useState<"share" | "cliente">("share");
  const pending = cashView === "share" ? 42180 : 8440;
  return <div className="route-enter"><Hero workspace="financeiro" title="Visão financeira" subtitle="Conciliação, documentos e compromissos administrativos"><div className="hidden items-center gap-2 rounded-lg border border-[#f1c348]/25 bg-[#f1c348]/8 px-3 py-2 sm:flex"><Clock3 size={13} className="text-[#f4cc64]" /><span className="text-[10px] font-bold text-[#f4cc64]">5 rotinas pendentes</span></div></Hero><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Recibos a emitir" value="08" detail="5 clientes · competência atual" tone="blue" icon={<Receipt size={16} />} /><KpiCard label="Despesas de viagem" value="12" detail="R$ 8.940 aguardando relatório" tone="amber" icon={<FileBarChart size={16} />} /><KpiCard label="Pagamentos programados" value="R$ 42.180" detail="8 compromissos neste ciclo" tone="violet" icon={<CreditCard size={16} />} /><KpiCard label="Inadimplência crítica" value="02" detail="Saldo vencido acima de 30 dias" tone="red" icon={<AlertCircle size={16} />} /></div><div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><QuickAction icon={<Receipt size={16} />} label="Recibos" detail="8 pendentes" onClick={() => onNavigate("recibos")} /><QuickAction icon={<FileBarChart size={16} />} label="Despesas" detail="12 relatórios" color="amber" onClick={() => onNavigate("despesas")} /><QuickAction icon={<CreditCard size={16} />} label="Pagamentos" detail="Programar" color="violet" onClick={() => onNavigate("pagamentos")} /><QuickAction icon={<Mail size={16} />} label="E-mail" detail="Caixa de saída" color="blue" onClick={() => onNavigate("email")} /><QuickAction icon={<Clock3 size={16} />} label="Ponto" detail="Fechamento" color="green" onClick={() => onNavigate("ponto")} /><QuickAction icon={<RefreshCw size={16} />} label="Ciclo de voo" detail="Atualizado" color="amber" onClick={() => onNavigate("ciclo")} /></div><div className="mb-5 flex items-center gap-1 rounded-lg border border-border bg-card/65 p-1 sm:w-fit"><button type="button" onClick={() => setCashView("share")} className={cn("rounded-md px-4 py-2 text-[10px] font-bold", cashView === "share" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Caixa Share</button><button type="button" onClick={() => setCashView("cliente")} className={cn("rounded-md px-4 py-2 text-[10px] font-bold", cashView === "cliente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>Caixa Cliente</button></div><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<CircleDollarSign size={15} />} title={`Compromissos · Caixa ${cashView === "share" ? "Share" : "Cliente"}`} detail="Próximos vencimentos" action={<button type="button" onClick={() => onNavigate("pagamentos")} className="text-[10px] font-bold text-primary hover:underline">Ver programação</button>} /><div className="p-4"><div className="flex items-end justify-between"><div><p className="text-[10px] text-muted-foreground">Total a vencer</p><p className="mt-1 font-mono text-2xl">{formatCurrency(pending)}</p></div><StatusBadge tone="amber">Acompanhar</StatusBadge></div><div className="mt-6 space-y-4"><DueItem label="Folha e encargos" meta="02 set. · Caixa Share" value="R$ 18.600" tone="red" progress={88} /><DueItem label="Combustível JET" meta="03 set. · Caixa Cliente" value="R$ 7.751" tone="amber" progress={58} /><DueItem label="Fornecedores operacionais" meta="05 set. · Caixa Share" value="R$ 5.430" tone="blue" progress={34} /></div></div></section><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1"><section className="overflow-hidden rounded-xl border border-[#e77b80]/25 bg-[#e77b80]/[.035]"><SectionHeader icon={<AlertCircle size={15} />} title="Inadimplência crítica" detail="Ação necessária" action={<button type="button" onClick={() => onNavigate("recibos")} className="text-[10px] font-bold text-[#ed8c90] hover:underline">Analisar</button>} /><div className="divide-y divide-[#e77b80]/10"><CriticalClient name="Gerson Duarte" aircraft="PT-OJG" value="- R$ 6.420" days="42 dias em aberto" /><CriticalClient name="Dejalmo Ribeiro" aircraft="PR-SBR" value="- R$ 1.830" days="18 dias em aberto" /></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<FileClock size={15} />} title="Despesas a vencer" detail="Próximos 7 dias" action={<button type="button" onClick={() => onNavigate("despesas")} className="text-[10px] font-bold text-primary hover:underline">Abrir relatório</button>} /><div className="grid grid-cols-3 gap-2 p-4"><MiniValue label="Combustível" value="R$ 7,7k" /><MiniValue label="Viagens" value="R$ 4,1k" /><MiniValue label="Taxas" value="R$ 2,3k" /></div></section></div></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><MiniPanel title="Emissão de recibo" icon={<Receipt size={15} />} value="08 pendentes" detail="5 clientes aguardam documento" action="Abrir emissão" onClick={() => onNavigate("recibos")} /><MiniPanel title="Ponto e histórico" icon={<Clock3 size={15} />} value="98% conferido" detail="Fechamento do mês em andamento" action="Ver histórico" onClick={() => onNavigate("ponto")} /><MiniPanel title="Ciclo de voo" icon={<RefreshCw size={15} />} value="38,3 horas" detail="Dados sincronizados hoje" action="Consultar ciclo" onClick={() => onNavigate("ciclo")} /></div></div>;
}

function DueItem({ label, meta, value, tone, progress }: { label: string; meta: string; value: string; tone: "red" | "amber" | "blue"; progress: number }) {
  return <div><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[9px] text-muted-foreground">{meta}</p></div><div className="text-right"><p className="font-mono text-[10px] font-bold">{value}</p><StatusBadge tone={tone}>{progress > 75 ? "Urgente" : progress > 45 ? "A vencer" : "Programado"}</StatusBadge></div></div><div className="mt-2"><ProgressBar value={progress} color={tone} /></div></div>;
}

function CriticalClient({ name, aircraft, value, days }: { name: string; aircraft: string; value: string; days: string }) {
  return <div className="flex items-center gap-3 p-3.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e77b80]/10 text-[#ed8c90]"><Users size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{name}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{aircraft} · {days}</p></div><p className="font-mono text-[10px] font-bold text-[#ed8c90]">{value}</p></div>;
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="truncate text-[9px] text-muted-foreground">{label}</p><p className="mt-2 font-mono text-[11px] font-bold">{value}</p></div>;
}

function PortalDashboard() {
  return <div className="route-enter"><Hero workspace="portal" title="Olá, Camilla" subtitle="Portal Cliente · documentos e pagamentos"><div className="hidden items-center gap-2 rounded-lg border border-[#8d6be8]/25 bg-[#8d6be8]/8 px-3 py-2 sm:flex"><ShieldCheck size={13} className="text-[#b397ff]" /><span className="text-[10px] font-bold text-[#b397ff]">Somente visualização</span></div></Hero><div className="mb-5 grid gap-3 sm:grid-cols-3"><KpiCard label="Em aberto" value="R$ 4.475" detail="2 cobranças aguardando pagamento" tone="amber" icon={<CreditCard size={16} />} /><KpiCard label="Pagos no mês" value="R$ 18.260" detail="5 lançamentos confirmados" tone="green" icon={<CheckCircle2 size={16} />} /><KpiCard label="Documentos" value="08" detail="Todos disponíveis para consulta" tone="violet" icon={<FileCheck2 size={16} />} /></div><div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<CreditCard size={15} />} title="Pagamentos recentes" detail="Acompanhe o que foi enviado para você" /><div className="divide-y divide-border/70"><PaymentRow label="Combustível · JET" due="Vencimento 02 set. 2026" value="R$ 4.475" status="Pendente" tone="amber" /><PaymentRow label="Administração Share · agosto" due="Pago em 05 ago. 2026" value="R$ 18.260" status="Pago" tone="green" /><PaymentRow label="Tarifa aeroportuária" due="Pago em 29 jul. 2026" value="R$ 392" status="Pago" tone="green" /></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><SectionHeader icon={<FileCheck2 size={15} />} title="Documentos disponíveis" detail="Últimos arquivos enviados" /><div className="divide-y divide-border/70"><DocumentRow name="Recibo de saída · agosto" date="30 ago. 2026" /><DocumentRow name="Balanço mensal · julho" date="05 ago. 2026" /><DocumentRow name="Relatório de despesas · julho" date="05 ago. 2026" /></div></section></div></div>;
}

function PaymentRow({ label, due, value, status, tone }: { label: string; due: string; value: string; status: string; tone: "amber" | "green" }) {
  return <div className="flex items-center gap-3 p-4"><div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone === "green" ? "bg-[#5bbd75]/10 text-[#6bd188]" : "bg-[#f1c348]/10 text-[#f4cc64]")}><CreditCard size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{label}</p><p className="mt-1 text-[9px] text-muted-foreground">{due}</p></div><div className="text-right"><p className="font-mono text-[11px] font-bold">{value}</p><StatusBadge tone={tone}>{status}</StatusBadge></div></div>;
}

function DocumentRow({ name, date }: { name: string; date: string }) {
  return <button type="button" className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/25"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{name}</p><p className="mt-1 text-[9px] text-muted-foreground">Disponível desde {date}</p></div><ArrowRight size={13} className="text-muted-foreground" /></button>;
}

function PlaceholderView({ workspace, menu, onBack }: { workspace: Workspace; menu: MenuItem; onBack: () => void }) {
  const Icon = menu.icon;
  return <div className="route-enter"><div className="mb-6 flex items-end justify-between gap-4"><div><PageEyebrow>{workspaceLabels[workspace]} / Módulo</PageEyebrow><h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">{menu.label}</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">Esta tela já está separada no dashboard correto e será detalhada na próxima etapa do sistema.</p></div><button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[10px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowRight size={13} className="rotate-180" /> Voltar à visão geral</button></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card/70 p-5 sm:col-span-2"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></div><h2 className="mt-5 text-sm font-bold">Área preparada para {menu.label}</h2><p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">A navegação, a identidade visual e o contexto do departamento estão prontos. Os formulários, filtros e integrações serão construídos mantendo esta mesma linguagem operacional.</p><div className="mt-6 grid gap-2 sm:grid-cols-3"><MiniValue label="Área" value={workspaceLabels[workspace]} /><MiniValue label="Acesso" value={workspace === "portal" ? "Leitura" : "Interno"} /><MiniValue label="Status" value="Em preparação" /></div></div><div className="rounded-xl border border-border bg-card/70 p-5"><div className="flex items-center gap-2 text-[#f4cc64]"><SlidersHorizontal size={16} /><span className="text-[10px] font-bold uppercase tracking-[.12em]">Próximos passos</span></div><div className="mt-5 space-y-4"><Checklist label="Estrutura visual" done /><Checklist label="Permissões por área" /><Checklist label="Dados do módulo" /><Checklist label="Ações e relatórios" /></div></div></div></div>;
}

function Checklist({ label, done = false }: { label: string; done?: boolean }) {
  return <div className="flex items-center gap-2.5 text-[11px]">{done ? <CheckCircle2 size={15} className="text-[#6bd188]" /> : <span className="h-[15px] w-[15px] rounded-full border border-border" />}<span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span></div>;
}

function Shell() {
  const [workspace, setWorkspace] = useState<Workspace>("gestor");
  const [activeMenu, setActiveMenu] = useState("overview");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("share-brasil-theme") as Theme) || "dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const activeItem = useMemo(() => sidebarItems.find((item) => item.id === activeMenu) || menus[workspace][0], [workspace, activeMenu]);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("share-brasil-theme", theme); }, [theme]);
  const changeWorkspace = (next: Workspace) => { setWorkspace(next); setActiveMenu("overview"); setMenuOpen(false); };
  const renderDashboard = () => {
    if (activeMenu !== "overview") return <PlaceholderView workspace={workspace} menu={activeItem} onBack={() => setActiveMenu("overview")} />;
    if (workspace === "operacoes") return <OperationsDashboard onNavigate={setActiveMenu} />;
    if (workspace === "financeiro") return <FinanceDashboard onNavigate={setActiveMenu} />;
    if (workspace === "portal") return <PortalDashboard />;
    return <GestorToolsDashboard onNavigate={setActiveMenu} />;
  };
  return <div className="app-noise flex min-h-[100dvh] bg-background"><Sidebar activeMenu={activeMenu} open={menuOpen} collapsed={sidebarCollapsed} onClose={() => setMenuOpen(false)} onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)} onMenuChange={setActiveMenu} /><div className="min-w-0 flex-1"><TopBar workspace={workspace} theme={theme} onWorkspaceChange={changeWorkspace} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onOpenMenu={() => setMenuOpen(true)} /><main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-7 md:py-8">{renderDashboard()}</main></div></div>;
}

function App() {
  const [location] = useLocation();

  return (
    <>
      {location === "/login" ? <Login /> : <Shell />}
      <Toaster />
    </>
  );
}

export default App;
