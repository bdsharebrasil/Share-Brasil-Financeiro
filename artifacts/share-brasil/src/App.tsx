import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getGetDashboardSummaryQueryKey,
  getGetFinancialMovementsQueryKey,
  getGetShareholdersQueryKey,
  getHealthCheckQueryKey,
  useGetDashboardSummary,
  useGetFinancialMovements,
  useGetShareholders,
  useHealthCheck,
} from '@/lib/api';
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CloudSun,
  CreditCard,
  FileBarChart,
  FileText,
  Filter,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient();

type Department = 'operacoes' | 'financeiro' | 'gestor' | 'portal';
type Theme = 'dark' | 'light';

const departmentLabels: Record<Department, string> = {
  operacoes: 'Operações',
  financeiro: 'Financeiro',
  gestor: 'Gestor',
  portal: 'Portal Cliente',
};

const navItems = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/operacoes', label: 'Operações', icon: Plane },
  { href: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { href: '/cotistas', label: 'Cotistas', icon: Users },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(date)
    .replace('.', '');
};

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', compact && 'gap-0')}>
      <div className="relative h-8 w-8 shrink-0" aria-label="Share Brasil">
        <span className="absolute left-1 top-1 h-4 w-4 rounded-[7px] bg-[#4f7d4a] rotate-[-12deg]" />
        <span className="absolute bottom-1 left-1.5 h-4 w-4 rounded-[7px] bg-[#f1c348] rotate-[18deg]" />
        <span className="absolute right-1 top-1.5 h-4 w-4 rounded-[7px] bg-[#0b4a78] rotate-[14deg]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="font-extrabold tracking-[.19em] text-[13px] text-foreground">SHARE</p>
          <p className="mt-0.5 font-semibold italic text-[10px] tracking-[.1em] text-primary">Brasil</p>
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
      className="group flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      <span className="hidden text-[10px] font-bold uppercase tracking-[.14em] sm:block">
        {theme === 'dark' ? 'Claro' : 'Escuro'}
      </span>
    </button>
  );
}

function TopBar({ theme, onToggleTheme, onOpenMenu }: { theme: Theme; onToggleTheme: () => void; onOpenMenu: () => void }) {
  const [location, setLocation] = useLocation();
  const [time, setTime] = useState(new Date());
  const queryDepartment = new URLSearchParams(location.split('?')[1] ?? '').get('departamento') as Department | null;
  const activeDepartment = location === '/' ? queryDepartment ?? 'gestor' : location.includes('financeiro') || location.includes('cotistas') ? 'financeiro' : 'operacoes';
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-7">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpenMenu} data-testid="button-open-menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
          <Menu size={20} />
        </button>
        <div className="md:hidden"><LogoMark compact /></div>
        <div className="hidden items-center gap-1 rounded-xl border border-border bg-card/70 p-1 md:flex">
          {(Object.keys(departmentLabels) as Department[]).map((department) => (
            <button
              type="button"
              key={department}
              onClick={() => setLocation(department === 'gestor' ? '/' : department === 'financeiro' ? '/financeiro' : department === 'operacoes' ? '/operacoes' : '/?departamento=portal')}
              data-testid={`button-department-${department}`}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all',
                activeDepartment === department ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {departmentLabels[department]}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-muted-foreground lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5bbd75] pulse-dot" />
          Sistema operacional
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground lg:flex">
          <Clock3 size={13} className="text-primary" />
          <span className="text-foreground">{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-primary/70">BRT</span>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-2.5 py-2 text-[10px] text-muted-foreground xl:flex">
          <CloudSun size={14} className="text-[#f1c348]" />
          <span>São Paulo</span>
          <strong className="font-mono text-foreground">24°</strong>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button type="button" data-testid="button-notifications" className="relative rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f1c348]" />
        </button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b4a78] text-[11px] font-bold text-white">CM</div>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-[#061321]/70 backdrop-blur-sm transition-opacity md:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} />
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 md:static md:z-auto md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-[68px] items-center border-b border-sidebar-border px-6">
          <LogoMark />
          <button type="button" onClick={onClose} data-testid="button-close-menu" className="ml-auto rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"><X size={17} /></button>
        </div>
        <div className="px-4 pb-3 pt-6">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[.19em] text-sidebar-foreground/40">Navegação</p>
          <nav className="mt-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const selected = href === '/' ? location === '/' : location.startsWith(href);
              return (
                <Link
                  href={href}
                  key={href}
                  onClick={onClose}
                  data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-all', selected ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground')}
                >
                  <Icon size={16} strokeWidth={selected ? 2.3 : 1.8} />
                  <span>{label}</span>
                  {selected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary-foreground" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-2 border-t border-sidebar-border px-4 pt-5">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[.19em] text-sidebar-foreground/40">Administração</p>
          <Link href="/configuracoes" onClick={onClose} data-testid="link-nav-configuracoes" className={cn('mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-all', location === '/configuracoes' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
            <Settings2 size={16} />
            Configurações
          </Link>
        </div>
        <div className="mt-auto p-4">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#5bbd75]" />
              <span className="text-[11px] font-semibold">Ambiente seguro</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-sidebar-foreground/45">Dados financeiros protegidos e sincronizados.</p>
          </div>
          <button type="button" data-testid="button-logout" className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-semibold text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut size={15} /> Encerrar sessão
          </button>
          <p className="mt-3 px-3 font-mono text-[9px] text-sidebar-foreground/30">SHARE OPS · v2.4.1</p>
        </div>
      </aside>
    </>
  );
}

function DataState({ loading, error, children, empty = false, onRetry }: { loading: boolean; error: boolean; children: ReactNode; empty?: boolean; onRetry?: () => void }) {
  if (loading) {
    return <div className="space-y-3" data-testid="state-loading">{[1, 2, 3].map((item) => <div className="skeleton h-20 rounded-xl" key={item} />)}</div>;
  }
  if (error) {
    return <div className="flex items-center justify-between rounded-xl border border-[#a84d54]/35 bg-[#a84d54]/10 p-4" data-testid="state-error"><div className="flex items-center gap-3"><AlertCircle size={17} className="text-[#e77b80]" /><div><p className="text-xs font-bold">Não foi possível carregar os dados</p><p className="mt-0.5 text-[11px] text-muted-foreground">A operação pode continuar, mas esta visão está desatualizada.</p></div></div>{onRetry && <button type="button" onClick={onRetry} data-testid="button-retry" className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold hover:bg-secondary"><RefreshCw size={12} /> Tentar novamente</button>}</div>;
  }
  if (empty) return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center" data-testid="state-empty"><div className="mb-3 rounded-xl bg-secondary p-3 text-muted-foreground"><FileText size={21} /></div><p className="text-xs font-bold">Nenhum registro encontrado</p><p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Quando novos dados entrarem no sistema, eles aparecerão nesta área.</p></div>;
  return <>{children}</>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {eyebrow}</div><h1 className="text-2xl font-extrabold tracking-[-.04em] text-foreground md:text-[30px]">{title}</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p></div>{action}</div>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pago: { label: 'Pago', className: 'bg-[#5bbd75]/12 text-[#6bd188]' },
    pendente: { label: 'Pendente', className: 'bg-[#f1c348]/14 text-[#f4cc64]' },
    agendado: { label: 'Agendado', className: 'bg-primary/12 text-primary' },
    regular: { label: 'Regular', className: 'bg-[#5bbd75]/12 text-[#6bd188]' },
    atencao: { label: 'Atenção', className: 'bg-[#f1c348]/14 text-[#f4cc64]' },
    inadimplente: { label: 'Inadimplente', className: 'bg-[#e77b80]/14 text-[#ed8c90]' },
  };
  const item = map[status] ?? { label: status, className: 'bg-secondary text-muted-foreground' };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em]', item.className)} data-testid={`status-${status}`}>{item.label}</span>;
}

function DashboardPage({ department = 'gestor' }: { department?: Department }) {
  const [location] = useLocation();
  const queryDepartment = new URLSearchParams(location.split('?')[1] ?? '').get('departamento') as Department | null;
  const currentDepartment = queryDepartment ?? department;
  const dashboard = useGetDashboardSummary({ departamento: currentDepartment }, { query: { queryKey: getGetDashboardSummaryQueryKey({ departamento: currentDepartment }) } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const summary = dashboard.data;
  const metrics = summary?.metrics ?? [];
  const alerts = summary?.alerts ?? [];
  return (
    <div className="route-enter">
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card">
        <div className="command-grid absolute inset-0 opacity-50" />
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex min-h-[174px] flex-col justify-between gap-8 p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><Activity size={13} /> Dashboard {departmentLabels[currentDepartment]}</div>
            <div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#5bbd75]" /> Live feed</div>
          </div>
          <div><p className="mb-2 text-xs font-semibold text-muted-foreground">{summary?.period ?? 'Atualização em tempo real'}</p><h1 className="text-[27px] font-extrabold tracking-[-.045em] md:text-[34px]" data-testid="text-dashboard-greeting">{summary?.greeting ?? 'Bom dia, equipe Share'}</h1></div>
        </div>
      </section>
      {health.isError && <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#f1c348]/30 bg-[#f1c348]/8 px-3 py-2.5 text-[11px] text-[#f4cc64]" data-testid="status-health-warning"><AlertCircle size={14} /> Serviço de dados operacionais em modo de contingência.</div>}
      <DataState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}>
        <section className="grid gap-3 md:grid-cols-3">
          {metrics.length ? metrics.map((metric, index) => <MetricCard key={`${metric.label}-${index}`} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} index={index} />) : <EmptyMetrics />}
        </section>
        <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-xl border border-border bg-card/80">
            <PanelHeader icon={<Zap size={15} />} title="Ações rápidas" detail="Acesso operacional" />
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              {[
                { label: 'Agenda de voos', icon: CalendarDays, href: '/operacoes' },
                { label: 'Lançamentos', icon: FileBarChart, href: '/financeiro' },
                { label: 'Cotistas', icon: Users, href: '/cotistas' },
                { label: 'Relatórios', icon: LineChart, href: '/financeiro' },
              ].map(({ label, icon: Icon, href }) => <Link href={href} key={label} data-testid={`link-quick-${label.toLowerCase().replace(/\s+/g, '-')}`} className="group flex min-h-[88px] flex-col justify-between rounded-lg border border-border/75 bg-secondary/30 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/8"><Icon size={17} className="text-primary transition-transform group-hover:translate-x-0.5" /><div className="flex items-end justify-between gap-2"><span className="text-[11px] font-bold leading-snug">{label}</span><ArrowRight size={13} className="mb-0.5 text-muted-foreground" /></div></Link>)}
            </div>
          </div>
          <AlertsPanel alerts={alerts} />
        </section>
      </DataState>
    </div>
  );
}

function MetricCard({ label, value, detail, tone, index }: { label: string; value: string; detail: string; tone: string; index: number }) {
  const toneClass = tone === 'green' ? 'text-[#6bd188] bg-[#5bbd75]/10' : tone === 'amber' ? 'text-[#f4cc64] bg-[#f1c348]/10' : tone === 'red' ? 'text-[#ed8c90] bg-[#e77b80]/10' : tone === 'blue' ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary';
  const icons = [Gauge, ArrowUpRight, WalletCards];
  const Icon = icons[index % icons.length];
  return <div className="group rounded-xl border border-border bg-card/80 p-4 transition-colors hover:border-primary/35" data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}><div className="flex items-start justify-between"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><span className={cn('rounded-lg p-2', toneClass)}><Icon size={15} /></span></div><div className="mt-4 flex items-end justify-between gap-3"><strong className="font-mono text-2xl font-medium tracking-[-.04em]">{value}</strong><span className="text-right text-[10px] leading-tight text-muted-foreground">{detail}</span></div></div>;
}

function EmptyMetrics() {
  return <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground md:col-span-3" data-testid="text-empty-metrics">Métricas aguardando a próxima sincronização.</div>;
}

function PanelHeader({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2.5"><span className="text-primary">{icon}</span><div><h2 className="text-xs font-bold">{title}</h2>{detail && <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>}</div></div>{action}</div>;
}

function AlertsPanel({ alerts }: { alerts: Array<{ id: string; title: string; description: string; severity: string }> }) {
  const [showAll, setShowAll] = useState(false);
  return <div className="rounded-xl border border-border bg-card/80"><PanelHeader icon={<Bell size={15} />} title="Alertas e pendências" detail={`${alerts.length} sinalizações`} action={alerts.length > 3 ? <button type="button" onClick={() => setShowAll(!showAll)} data-testid="button-view-alerts" className="text-[10px] font-bold text-primary hover:underline">{showAll ? 'Recolher' : 'Ver todos'}</button> : undefined} /><div className="p-3">{alerts.length ? <div className="space-y-2">{alerts.slice(0, showAll ? alerts.length : 3).map((alert) => <div key={alert.id} data-testid={`alert-item-${alert.id}`} className="flex gap-3 rounded-lg border border-border/70 bg-secondary/25 p-3"><AlertIcon severity={alert.severity} /><div className="min-w-0"><p className="text-[11px] font-bold">{alert.title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{alert.description}</p></div></div>)}</div> : <div className="flex items-center gap-3 px-2 py-7 text-[11px] text-muted-foreground"><CheckCircle2 size={17} className="text-[#6bd188]" /> Nenhuma pendência crítica no momento.</div>}</div></div>;
}

function AlertIcon({ severity }: { severity: string }) {
  const Icon = severity === 'critical' ? AlertCircle : severity === 'success' ? CheckCircle2 : severity === 'warning' ? AlertCircle : HelpCircle;
  return <Icon size={16} className={cn('mt-0.5 shrink-0', severity === 'critical' ? 'text-[#ed8c90]' : severity === 'warning' ? 'text-[#f4cc64]' : severity === 'success' ? 'text-[#6bd188]' : 'text-primary')} />;
}

function FinancePage() {
  const [cashView, setCashView] = useState<'share' | 'cliente'>('share');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const movementsQuery = useGetFinancialMovements({ limite: 50 }, { query: { queryKey: getGetFinancialMovementsQueryKey({ limite: 50 }) } });
  const movements = movementsQuery.data ?? [];
  const filtered = useMemo(() => movements.filter((item) => `${item.description} ${item.category} ${item.paidBy}`.toLowerCase().includes(search.toLowerCase())), [movements, search]);
  const viewMovements = filtered.filter((item) => item.caixa === cashView);
  const total = viewMovements.reduce((sum, item) => sum + item.amount, 0);
  const paid = viewMovements.filter((item) => item.status === 'pago').reduce((sum, item) => sum + item.amount, 0);
  const pending = viewMovements.filter((item) => item.status !== 'pago').reduce((sum, item) => sum + item.amount, 0);
  return <div className="route-enter"><PageTitle eyebrow="Financeiro / Conciliação" title="Visão de caixa" description="Acompanhe o caixa Share e o caixa Cliente sem misturar responsabilidades." action={<button type="button" onClick={() => setNotice('O formulário de lançamento estará disponível após a seleção da conta.')} data-testid="button-new-movement" className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[11px] font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"><Plus size={15} /> Novo lançamento</button>} />{notice && <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/7 px-3.5 py-2.5 text-[11px] text-primary" data-testid="status-finance-notice"><span>{notice}</span><button type="button" onClick={() => setNotice('')} data-testid="button-dismiss-finance-notice" className="rounded p-1 hover:bg-primary/10"><X size={13} /></button></div>}
    <div className="mb-5 grid gap-3 md:grid-cols-2">
      <CashCard type="share" active={cashView === 'share'} onClick={() => setCashView('share')} total={cashView === 'share' ? total : movements.filter((item) => item.caixa === 'share').reduce((sum, item) => sum + item.amount, 0)} />
      <CashCard type="cliente" active={cashView === 'cliente'} onClick={() => setCashView('cliente')} total={cashView === 'cliente' ? total : movements.filter((item) => item.caixa === 'cliente').reduce((sum, item) => sum + item.amount, 0)} />
    </div>
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#f1c348]/25 bg-[#f1c348]/7 p-3.5"><AlertCircle size={16} className="mt-0.5 shrink-0 text-[#f4cc64]" /><p className="text-[11px] leading-relaxed text-muted-foreground"><strong className="text-[#f4cc64]">Regra de rateio:</strong> despesas reembolsáveis e rateios pertencem aos cotistas. O caixa Share registra apenas os compromissos da administradora.</p></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Movimentação do período" value={formatCurrency(total)} icon={<LineChart size={15} />} /><MiniStat label="Já conciliado" value={formatCurrency(paid)} icon={<Check size={15} />} tone="green" /><MiniStat label="A liquidar" value={formatCurrency(pending)} icon={<Clock3 size={15} />} tone="amber" /></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card/80"><PanelHeader icon={<FileBarChart size={15} />} title="Lançamentos recentes" detail={`${viewMovements.length} registros · Caixa ${cashView === 'share' ? 'Share' : 'Cliente'}`} action={<div className="hidden items-center gap-2 sm:flex"><button type="button" onClick={() => setNotice('A exportação será preparada com os filtros atuais.')} data-testid="button-export-movements" className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground">Exportar CSV</button><button type="button" onClick={() => setNotice('Filtros avançados abertos.')} data-testid="button-filter-movements" className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Filter size={13} /></button></div>} /><div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-movements" placeholder="Buscar descrição, categoria ou responsável" className="h-9 w-full rounded-lg border border-border bg-secondary/45 pl-9 pr-3 text-[11px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60" /></div><button type="button" onClick={() => setNotice('Filtro de status selecionado.')} data-testid="button-filter-status" className="flex items-center justify-between gap-5 rounded-lg border border-border bg-secondary/45 px-3 text-[10px] font-semibold text-muted-foreground hover:text-foreground"><span>Todos os status</span><ChevronDown size={13} /></button></div>
      <DataState loading={movementsQuery.isLoading} error={movementsQuery.isError} empty={!movements.length && !movementsQuery.isLoading} onRetry={() => movementsQuery.refetch()}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Pago por</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{viewMovements.length ? viewMovements.map((movement) => <tr key={movement.id} data-testid={`row-movement-${movement.id}`} className="border-b border-border/60 last:border-0 transition-colors hover:bg-secondary/30"><td className="px-4 py-3.5 font-mono text-[10px] text-muted-foreground">{formatDate(movement.date)}</td><td className="px-4 py-3.5"><p className="max-w-[245px] truncate text-[11px] font-bold">{movement.description}</p><p className="mt-1 text-[9px] text-muted-foreground">{movement.account}</p></td><td className="px-4 py-3.5"><span className="rounded-md bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">{movement.category}</span>{movement.reimbursable && <span className="ml-1.5 rounded-md bg-[#f1c348]/10 px-2 py-1 text-[9px] font-bold text-[#f4cc64]">Rateio</span>}</td><td className="px-4 py-3.5 text-[10px] text-muted-foreground">{movement.paidBy}</td><td className="px-4 py-3.5 text-right font-mono text-[11px] font-medium">{formatCurrency(movement.amount)}</td><td className="px-4 py-3.5"><StatusPill status={movement.status} /></td><td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setNotice(`Ações do lançamento ${movement.id} abertas.`)} data-testid={`button-movement-menu-${movement.id}`} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><MoreHorizontal size={15} /></button></td></tr>) : <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-muted-foreground">Nenhum lançamento corresponde à busca ou a este caixa.</td></tr>}</tbody></table></div></DataState>
    </div>
  </div>;
}

function CashCard({ type, active, onClick, total }: { type: 'share' | 'cliente'; active: boolean; onClick: () => void; total: number }) {
  const share = type === 'share';
  return <button type="button" onClick={onClick} data-testid={`button-cash-${type}`} className={cn('relative overflow-hidden rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5', active ? 'border-primary/60 bg-primary/8' : 'border-border bg-card/75 hover:border-primary/30')}><div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl" /><div className="relative flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Caixa {share ? 'Share' : 'Cliente'}</p><h2 className="mt-2 text-lg font-extrabold">{share ? 'Administradora' : 'Operação dos cotistas'}</h2></div><div className={cn('rounded-lg p-2.5', share ? 'bg-primary/12 text-primary' : 'bg-[#f1c348]/12 text-[#f4cc64]')}>{share ? <CircleDollarSign size={18} /> : <Users size={18} />}</div></div><div className="relative mt-6 flex items-end justify-between"><strong className="font-mono text-2xl">{formatCurrency(total)}</strong><span className={cn('flex items-center gap-1 text-[10px] font-bold', share ? 'text-primary' : 'text-[#f4cc64]')}>{active ? 'Selecionado' : 'Visualizar'} <ArrowRight size={12} /></span></div></button>;
}

function MiniStat({ label, value, icon, tone = 'blue' }: { label: string; value: string; icon: ReactNode; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card/75 p-4"><div className={cn('mb-4 flex h-7 w-7 items-center justify-center rounded-md', tone === 'green' ? 'bg-[#5bbd75]/12 text-[#6bd188]' : tone === 'amber' ? 'bg-[#f1c348]/12 text-[#f4cc64]' : 'bg-primary/12 text-primary')}>{icon}</div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg">{value}</p></div>;
}

function ShareholdersPage() {
  const shareholdersQuery = useGetShareholders({ query: { queryKey: getGetShareholdersQueryKey() } });
  const shareholders = shareholdersQuery.data ?? [];
  const [closed, setClosed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const totalHours = shareholders.reduce((sum, item) => sum + item.hours, 0);
  const attention = shareholders.filter((item) => item.status !== 'regular').length;
  return <div className="route-enter"><PageTitle eyebrow="Financeiro / Base societária" title="Cotistas" description="Acompanhe utilização, saldos e o preparo para o próximo fechamento." action={<button type="button" onClick={() => setClosed(!closed)} data-testid="button-close-period" className={cn('flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[11px] font-bold transition-colors', closed ? 'bg-[#5bbd75]/15 text-[#6bd188]' : 'bg-primary text-primary-foreground')}>{closed ? <Check size={15} /> : <CheckCircle2 size={15} />} {closed ? 'Período preparado' : 'Fechamento do período'}</button>} /><div className="mb-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Cotistas ativos" value={String(shareholders.length)} icon={<Users size={15} />} /><MiniStat label="Horas utilizadas" value={`${totalHours.toLocaleString('pt-BR')} h`} icon={<Clock3 size={15} />} /><MiniStat label="Pontos de atenção" value={String(attention)} icon={<AlertCircle size={15} />} tone={attention ? 'amber' : 'green'} /></div><div className="overflow-hidden rounded-xl border border-border bg-card/80"><PanelHeader icon={<Users size={15} />} title="Acompanhamento de cotistas" detail="Saldo e utilização por aeronave" action={<button type="button" onClick={() => setFilterOpen(!filterOpen)} data-testid="button-filter-shareholders" className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"><SlidersHorizontal size={12} /> {filterOpen ? 'Ocultar filtros' : 'Filtros'}</button>} />{filterOpen && <div className="border-b border-border bg-secondary/25 px-4 py-3 text-[10px] text-muted-foreground" data-testid="panel-shareholder-filters">Filtro ativo: todos os cotistas · todos os status</div>}<DataState loading={shareholdersQuery.isLoading} error={shareholdersQuery.isError} empty={!shareholders.length && !shareholdersQuery.isLoading} onRetry={() => shareholdersQuery.refetch()}><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3 text-right">Horas</th><th className="px-4 py-3">Utilização</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{shareholders.map((person) => <tr key={person.id} data-testid={`row-shareholder-${person.id}`} className="border-b border-border/60 last:border-0 hover:bg-secondary/30"><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b4a78] text-[10px] font-bold text-white">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><span className="text-[11px] font-bold">{person.name}</span></div></td><td className="px-4 py-4 font-mono text-[10px] text-muted-foreground">{person.aircraft}</td><td className="px-4 py-4 text-right font-mono text-[11px]">{person.hours} h</td><td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(person.utilization, 100)}%` }} /></div><span className="font-mono text-[10px] text-muted-foreground">{person.utilization}%</span></div></td><td className={cn('px-4 py-4 text-right font-mono text-[11px] font-medium', person.balance < 0 ? 'text-[#ed8c90]' : 'text-[#6bd188]')}>{formatCurrency(person.balance)}</td><td className="px-4 py-4"><StatusPill status={person.status} /></td></tr>)}</tbody></table></div></DataState></div><div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" /><p className="text-[11px] leading-relaxed text-muted-foreground"><strong className="text-foreground">Fechamento confiável.</strong> A utilização é consolidada por aeronave e o saldo apresentado é a referência para os lançamentos do caixa Cliente.</p></div></div>;
}

function OperationsPage() {
  const dashboard = useGetDashboardSummary({ departamento: 'operacoes' }, { query: { queryKey: getGetDashboardSummaryQueryKey({ departamento: 'operacoes' }) } });
  const metrics = dashboard.data?.metrics ?? [];
  const alerts = dashboard.data?.alerts ?? [];
  const [notice, setNotice] = useState('');
  return <div className="route-enter"><PageTitle eyebrow="Operações / Centro de comando" title="Operação de voos" description="Agenda, prontidão e pendências da frota em uma única leitura." action={<button type="button" onClick={() => setNotice('O novo voo será iniciado pela agenda operacional.')} data-testid="button-new-flight" className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[11px] font-bold text-primary-foreground"><Plus size={15} /> Novo voo</button>} />{notice && <div className="mb-5 rounded-lg border border-primary/25 bg-primary/7 px-3.5 py-2.5 text-[11px] text-primary" data-testid="status-operations-notice">{notice}</div>}<DataState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}><div className="mb-5 grid gap-3 md:grid-cols-3">{metrics.length ? metrics.map((metric, index) => <MetricCard key={`${metric.label}-${index}`} {...metric} index={index} />) : <EmptyMetrics />}</div><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><FlightSchedule onAction={() => setNotice('Agenda atualizada com a última sincronização disponível.')} /><AlertsPanel alerts={alerts} /></div></DataState></div>;
}

function FlightSchedule({ onAction }: { onAction: () => void }) {
  return <div className="rounded-xl border border-border bg-card/80"><PanelHeader icon={<CalendarDays size={15} />} title="Próximos movimentos" detail="Janela operacional de hoje" action={<button type="button" onClick={onAction} data-testid="button-calendar-view" className="text-[10px] font-bold text-primary hover:underline">Abrir agenda</button>} /><div className="p-3"><div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/7 px-3 py-2 text-[10px] text-primary"><Activity size={13} /> Pista ativa · atualização automática</div><div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-11 text-center"><Plane size={22} className="mb-3 text-muted-foreground" /><p className="text-xs font-bold">Agenda sincronizada</p><p className="mt-1 max-w-[230px] text-[10px] leading-relaxed text-muted-foreground">Os próximos voos e planos de voo aparecem aqui após a confirmação operacional.</p><button type="button" onClick={onAction} data-testid="button-sync-schedule" className="mt-4 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[10px] font-bold hover:bg-secondary"><RefreshCw size={12} /> Atualizar agenda</button></div></div></div>;
}

function SettingsPage() {
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  return <div className="route-enter max-w-4xl"><PageTitle eyebrow="Administração / Preferências" title="Configurações financeiras" description="Defina como o Share Brasil organiza conciliação, alertas e fechamentos." action={saved ? <span className="flex items-center gap-2 text-[11px] font-bold text-[#6bd188]" data-testid="status-settings-saved"><CheckCircle2 size={15} /> Alterações salvas</span> : <button type="button" onClick={save} data-testid="button-save-settings" className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[11px] font-bold text-primary-foreground"><Check size={15} /> Salvar alterações</button>} /><div className="space-y-4"><SettingsSection title="Conciliação" icon={<WalletCards size={16} />} description="Automatize o acompanhamento dos movimentos importados."><SettingToggle label="Conciliação automática" description="Conferir novos lançamentos com o extrato bancário." enabled={autoReconcile} onToggle={() => setAutoReconcile(!autoReconcile)} testId="toggle-auto-reconcile" /><SettingRow label="Conta padrão Share" description="Usada para novos lançamentos da administradora." value="Conta operacional Share Brasil" /></SettingsSection><SettingsSection title="Fechamento e alertas" icon={<Bell size={16} />} description="Mantenha a equipe gestora informada no momento certo."><SettingToggle label="Alertas de vencimento" description="Avisar sobre pendências e fechamentos próximos." enabled={alerts} onToggle={() => setAlerts(!alerts)} testId="toggle-due-alerts" /><SettingRow label="Antecedência dos alertas" description="Quando a equipe deve ser avisada." value="3 dias antes" /></SettingsSection><div className="rounded-xl border border-[#f1c348]/25 bg-[#f1c348]/7 p-4"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 text-[#f4cc64]" /><div><p className="text-xs font-bold">Permissões da equipe gestora</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Alterações nestas preferências afetam as rotinas financeiras compartilhadas. Consulte o histórico antes de alterar regras de fechamento.</p></div></div></div></div></div>;
}

function SettingsSection({ title, icon, description, children }: { title: string; icon: ReactNode; description: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card/80"><PanelHeader icon={icon} title={title} detail={description} /><div className="divide-y divide-border/70">{children}</div></section>;
}

function SettingToggle({ label, description, enabled, onToggle, testId }: { label: string; description: string; enabled: boolean; onToggle: () => void; testId: string }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-4"><div><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[10px] text-muted-foreground">{description}</p></div><button type="button" onClick={onToggle} data-testid={testId} aria-pressed={enabled} className={cn('relative h-6 w-11 shrink-0 rounded-full p-1 transition-colors', enabled ? 'bg-primary' : 'bg-secondary')}><span className={cn('block h-4 w-4 rounded-full bg-background shadow-sm transition-transform', enabled ? 'translate-x-5' : 'translate-x-0')} /></button></div>;
}

function SettingRow({ label, description, value }: { label: string; description: string; value: string }) {
  const options = label.includes('Antecedência') ? ['1 dia antes', '3 dias antes', '7 dias antes'] : ['Conta operacional Share Brasil', 'Conta de reserva'];
  return <div className="flex items-center justify-between gap-4 px-4 py-4"><div><p className="text-[11px] font-bold">{label}</p><p className="mt-1 text-[10px] text-muted-foreground">{description}</p></div><div className="relative min-w-[170px]"><select defaultValue={value} data-testid={`select-setting-${label.toLowerCase().replace(/\s+/g, '-')}`} className="w-full appearance-none rounded-lg border border-border bg-secondary/45 px-3 py-2 pr-8 text-[10px] font-semibold outline-none hover:border-primary/45 focus:border-primary/60">{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div></div>;
}

function Shell() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('share-brasil-theme') as Theme) || 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('share-brasil-theme', theme); }, [theme]);
  return <div className="app-noise flex min-h-[100dvh] bg-background"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="min-w-0 flex-1"><TopBar theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onOpenMenu={() => setMenuOpen(true)} /><main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-7 md:py-8"><Switch><Route path="/" component={() => <DashboardPage />} /><Route path="/financeiro" component={FinancePage} /><Route path="/cotistas" component={ShareholdersPage} /><Route path="/operacoes" component={OperationsPage} /><Route path="/configuracoes" component={SettingsPage} /><Route component={NotFound} /></Switch></main></div></div>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Shell /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export default App;