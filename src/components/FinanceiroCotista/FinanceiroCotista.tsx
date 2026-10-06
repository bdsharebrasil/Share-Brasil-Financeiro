import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
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
  buscarVoosEmprestimos,
  editarLancamento,
  excluirLancamento,
  darBaixaLancamento,
} from "@/lib/financeiro-share-api";
import type {
  OpcoesLancamento,
  DashboardCotista,
  VooEmprestimo,
  LancamentoEconomico,
} from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import {
  buscarOpcoesEnvioPagamento,
  buscarCotistasAeronave,
} from "@/lib/colaborador-api";
import { MediasCotista } from "./MediasCotista";
import { RelatorioGeralCotista } from "./RelatorioGeralCotista";
import {
  agruparPorMes,
  mesAtualLocal,
  periodoDoMes,
  rotuloMesCotista,
  type PeriodoCotista,
} from "@/lib/financeiro-cotista-periodo";


/* Estilos locais: não alteram o tema das demais abas do financeiro.
 * Mantém os componentes, APIs e as seis colunas do arquivo original.
 */
const DESPESAS_ESTILOS = `
.despesas-theme {
  --background: 222 49% 9%; --foreground: 210 40% 96%;
  --card: 221 43% 12%; --card-foreground: 210 40% 96%;
  --popover: 220 40% 14%; --popover-foreground: 210 40% 96%;
  --muted: 220 35% 17%; --muted-foreground: 215 24% 70%;
  --border: 218 30% 24%; --input: 218 30% 24%;
  --primary: 204 94% 64%; --primary-foreground: 222 49% 9%;
  --accent: 218 35% 21%; --accent-foreground: 210 40% 96%;
  --ring: 204 94% 64%; --destructive: 0 85% 70%;
  color: #e6eefb; color-scheme: dark;
  font-family: inherit;
}
.despesas-shell { padding: 7px 10px; background: rgba(11, 15, 25, 1); border: 1px solid #24334c; border-radius: 20px; }
.despesas-theme .text-muted-foreground { color: #9aadc8; }
.despesas-theme .text-foreground { color: #e6eefb; }
.despesas-theme .text-primary { color: #73c5ff; }
.despesas-theme .border-border { border-color: #263650; }
.despesas-theme .bg-background { background-color: #0d1729; }
.despesas-theme .bg-card { background-color: #111d32; }
.despesas-theme :is(input, textarea, [role="combobox"]) { border-color: #30415e; background: #0d1729; color: #e6eefb; box-shadow: none; }
.despesas-theme input::placeholder, .despesas-theme textarea::placeholder { color: #91a4bf; }
.despesas-theme :is(button, input, textarea, a):focus-visible { outline: 2px solid #73c5ff; outline-offset: 3px; }
.despesas-theme .despesa-primary { background: rgba(62, 156, 218, 1); color: #081324; border: 1px solid #8ed2ff; box-shadow: 0 4px 20px #2994db18; font-weight: 700; }
.despesas-theme .despesa-primary:hover { background: #93d5ff; }
.despesa-metric { position: relative; border: 1px solid #1c273c; border-radius: 10px; background: #0e1626; padding: 10px 14px; }
.despesas-theme .text-emerald-700 { color: #5ce0bf; }
.despesas-theme .text-amber-700 { color: #ffd36c; }
.despesas-theme .text-blue-700 { color: #83bfff; }
.despesa-metric:first-child { border-color: #273752; }
.despesa-metric-value { font-size: 1.05rem; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.despesa-ledger { background: #101b2e; border: 1px solid #263650; border-radius: 16px; overflow: hidden; }
.despesa-heading { background: linear-gradient(115deg, #15243b, #101b2e); }
.despesa-toolbar { background: rgba(10, 20, 36, 1); padding: 6px 50px; }
.despesa-table-scroll { overflow: auto; max-height: 72vh; scrollbar-color: #3c5475 #101b2e; }
.despesa-table { width: 100%; min-width: 960px; table-layout: fixed; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
.despesa-table thead { position: sticky; top: 0; z-index: 2; background: #0c1627; color: #9aadc8; }
.despesa-table thead th { border-bottom: 1px solid #30415e; padding: 14px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
.despesa-table .despesa-month th { background: #111f34; border-bottom: 1px solid #263650; }
.despesa-table .despesa-row td { padding: 16px; vertical-align: middle; border-bottom: 1px solid #263650; }
.despesa-row { background: #132039; transition: background-color .15s; }
.despesa-row:nth-of-type(odd) { background: #101b2e; }
.despesa-row:hover { background: #1a2c46; }
.despesa-row[data-expanded="true"] { background: #1a2e48; }
.despesa-row[data-expanded="true"] td:first-child { box-shadow: inset 3px 0 #73c5ff; }
.despesa-row .despesa-description { font-size: 13px; font-weight: 600; line-height: 1.65; }
.despesa-row .despesa-money { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; color: #e0f2ff; }
.despesa-category { display: inline-block; max-width: 100%; margin-top: 7px; border: 1px solid #334866; border-radius: 4px; background: #1b2d46; padding: 2px 6px; font-size: 10px; color: #a6c7e9; letter-spacing: .03em; }
.despesa-status { white-space: nowrap; border-radius: 5px; padding: 4px 7px; font-size: 10px; font-weight: 650; }
.despesas-theme .despesa-status[data-status="Pago"] { color: #5ce0bf; background: #113b39; border-color: #206052; }
.despesas-theme .despesa-status[data-status="Pendente"] { color: #ffd36c; background: #352e20; border-color: #62502c; }
.despesas-theme .despesa-status[data-status="Atrasado"] { color: #ffaaa8; background: #3c252e; border-color: #75404b; }
.despesas-theme .despesa-status[data-status="Cancelado"] { color: #c0cada; background: #283246; border-color: #475570; }
.despesa-detail { background: #0d182b; border-top: 1px solid #304964; border-bottom: 1px solid #304964; }
.despesa-detail dl > div { padding: 10px 12px; border: 1px solid #263650; border-radius: 8px; background: #121f34; }
.despesas-theme .despesa-document { background: #14243b; border-color: #365070; color: #d5eaff; }
.despesas-theme .despesa-document:hover { background: #1b3351; border-color: #73c5ff; }
.despesa-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; background: #0c1627; }
.despesa-footer-total { display: flex; align-items: center; gap: 12px; }
.despesa-footer-total strong { font: 700 16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #e0f2ff; white-space: nowrap; }
.despesas-theme .despesa-mobile-card { background: #132039; border-color: #30415e; }
.despesas-theme .despesa-mobile-card[data-expanded="true"] { border-color: #6099c3; }
.despesa-dialog { background: #101b2e; border-color: #30415e; }
.despesa-dialog fieldset > .space-y-4, .despesa-dialog fieldset > .space-y-3 { border-radius: 12px; }
@media (max-width: 639px) {
  .despesas-shell { padding: 10px; border-radius: 14px; }
  .despesa-metric { padding: 8px 12px; }
  .despesa-metric-value { font-size: 0.95rem; }
  .despesa-footer-total { width: 100%; justify-content: space-between; }
}
@media (prefers-reduced-motion: reduce) { .despesas-theme * { transition: none !important; } }
`;

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
      dividirPercentuais(
        (modoInicial === "CLIENTE" ? cotistasCliente : cotistasHolding).map(
          (c) => c.id,
        ),
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
      dividirPercentuais(
        (proximo === "CLIENTE" ? cotistasCliente : cotistasHolding).map(
          (c) => c.id,
        ),
      ),
    );
  };
  const totalPercentual = rateios.reduce(
    (total, r) => total + (percentualNumerico(r.percentual) || 0),
    0,
  );

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
          rateios: rateios.map((r) => ({
            cotista_id: r.cotista,
            percentual: percentualNumerico(r.percentual),
          })),
        }),

        ...(modo === "HOLDING" && {
          holding_id: holdingId,
          tipo_movimento_hold: tipoMovimentoHold,
          pago_diretamente: pagoDiretamenteHold,
          cotista_aeronave_id: rateios[0]?.cotista || undefined,
          rateios:
            tipoMovimentoHold === "DESPESA"
              ? rateios.map((r) => {
                  const cotista = cotistasAeronave.find(
                    (item) => item.id === r.cotista,
                  );
                  return {
                    cotista_id: r.cotista,
                    socio_id: cotista?.socio_id || undefined,
                    percentual: percentualNumerico(r.percentual),
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

function statusLancamento(status: string) {
  const normalizado = status.toUpperCase();
  if (["PAGO", "RECEBIDO", "CONFIRMADO", "LIQUIDADO"].includes(normalizado))
    return {
      label: "Pago",
      className:
        "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
    };
  if (["EM_ATRASO", "ATRASADO"].includes(normalizado))
    return {
      label: "Atrasado",
      className:
        "border-red-400/25 bg-red-400/10 text-red-700 dark:text-red-300",
    };
  if (["CANCELADO", "ESTORNADO"].includes(normalizado))
    return {
      label: "Cancelado",
      className:
        "border-slate-400/25 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    };
  return {
    label: "Pendente",
    className:
      "border-amber-400/25 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  };
}

function valorPagoLancamento(lancamento: LancamentoEconomico) {
  const pagoInformado = Math.max(0, Number(lancamento.valorPagoCentavos || 0));
  if (
    ["PAGO", "RECEBIDO", "CONFIRMADO", "LIQUIDADO"].includes(
      lancamento.status.toUpperCase(),
    )
  ) {
    return Math.min(
      lancamento.valorCentavos,
      pagoInformado || lancamento.valorCentavos,
    );
  }
  return Math.min(lancamento.valorCentavos, pagoInformado);
}

function LancamentoExpandido({
  lancamento,
  aoAbrirDocumento,
}: {
  lancamento: LancamentoEconomico;
  aoAbrirDocumento: (nome: string, url: string) => void;
}) {
  const documentos = [
    ["Documento", lancamento.urlDoc, lancamento.numeroDoc],
    ["Nota fiscal", lancamento.urlNf, lancamento.numeroNf],
    ["Recibo", lancamento.urlRecibo, lancamento.numeroRecibo],
    [
      "Demonstrativo",
      lancamento.urlDemonstrativo,
      lancamento.numeroDemonstrativo,
    ],
    ["Boleto", lancamento.urlBoleto, null],
  ].filter((item): item is [string, string, string | null | undefined] =>
    Boolean(item[1]),
  );
  return (
    <div className="despesa-detail px-4 py-5 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-primary">
            Documentos vinculados
          </h3>
          {documentos.length ? (
            <div className="flex flex-wrap gap-2">
              {documentos.map(([nome, url, numero]) => (
                <button
                  key={`${nome}-${url}`}
                  type="button"
                  onClick={() =>
                    aoAbrirDocumento(
                      `${nome}${numero ? ` · ${numero}` : ""}`,
                      url,
                    )
                  }
                  className="despesa-document inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5"
                >
                  <FileText size={14} className="shrink-0 text-primary" />
                  <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {nome}
                    {numero ? ` · ${numero}` : ""}
                  </span>
                  <Eye size={13} className="shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum documento vinculado a este lançamento.
            </p>
          )}
        </section>
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-primary">
            Rateio e informações do lançamento
          </h3>
          <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Vencimento</dt>
              <dd className="mt-1 font-semibold">
                {formatarData(lancamento.prazo)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd className="mt-1 font-semibold">
                {formatarData(lancamento.dataPagamento)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Periodicidade</dt>
              <dd className="mt-1 font-semibold">
                {lancamento.periodicidade || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">% sociedade</dt>
              <dd className="mt-1 font-semibold">
                {lancamento.percentualSociedade == null
                  ? "—"
                  : `${lancamento.percentualSociedade}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">% uso</dt>
              <dd className="mt-1 font-semibold">
                {lancamento.percentualUso == null
                  ? "—"
                  : `${lancamento.percentualUso}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor pago real</dt>
              <dd className="mt-1 font-mono font-semibold">
                {formatarCentavos(lancamento.valorPagoRealCentavos || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor rateado</dt>
              <dd className="mt-1 font-mono font-semibold">
                {formatarCentavos(
                  lancamento.valorRateadoCentavos || lancamento.valorCentavos,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pago por</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-semibold">
                {lancamento.pagoPor || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">E-mail enviado em</dt>
              <dd className="mt-1 font-semibold">
                {formatarData(lancamento.emailEnviadoEm)}
              </dd>
            </div>
          </dl>
          {lancamento.rateios.length > 0 && (
            <section className="mt-5 rounded-lg border border-border bg-background/70 p-3">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-primary">
                Detalhamento do rateio
              </h4>
              <div className="divide-y divide-border">
                {lancamento.rateios.map((rateio, index) => (
                  <div
                    key={rateio.id || `${rateio.cotistaId || rateio.cotista}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground">
                        {rateio.cotista}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {rateio.percentual.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}% do rateio
                        {rateio.percentualSociedade != null
                          ? ` · ${rateio.percentualSociedade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% da sociedade`
                          : ""}
                        {rateio.status ? ` · ${statusLancamento(rateio.status).label}` : ""}
                        {rateio.pagoDiretamente ? " · Pago diretamente" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold tabular-nums text-foreground">
                        {formatarCentavos(rateio.valorCentavos)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Pago: {formatarCentavos(rateio.valorPagoRealCentavos || 0)}
                        {rateio.pagoPor ? ` · ${rateio.pagoPor}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {lancamento.observacoes && (
            <p className="mt-4 rounded-lg border border-border bg-background p-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              <strong className="text-foreground">Observações:</strong>{" "}
              {lancamento.observacoes}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
type AcaoDespesa = {
  tipo: "editar" | "excluir" | "baixa";
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

function BadgeStatus({ status }: { status: string }) {
  const visual = statusLancamento(status);
  return (
    <span
      data-status={visual.label}
      className={`despesa-status inline-flex items-center gap-1.5 border ${visual.className}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      />
      {visual.label}
    </span>
  );
}

function LancamentosDespesa({
  lancamentos,
  aoNovo,
  aoAtualizar,
}: {
  lancamentos: LancamentoEconomico[];
  aoNovo: () => void;
  aoAtualizar: () => Promise<void>;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<{
    nome: string;
    url: string;
  } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [ordem, setOrdem] = useState("recentes");
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
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(termo);
      return (
        correspondeBusca &&
        (filtroStatus === "todos" ||
          statusLancamento(item.status).label === filtroStatus) &&
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
            const comparacao = String(a.data).localeCompare(String(b.data));
            return ordem === "antigas" ? comparacao : -comparacao;
          }),
        })),
    [filtradas, ordem],
  );
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
      if (acao.tipo === "editar")
        await editarLancamento(acao.item.id, {
          descricao: descricaoEdicao.trim(),
        });
      if (acao.tipo === "excluir") await excluirLancamento(acao.item.id);
      if (acao.tipo === "baixa")
        await darBaixaLancamento(acao.item.id, {
          dataPagamento: hoje(),
          valorPagoRealCentavos: acao.item.valorCentavos,
          pagoPor: acao.item.pagoPor || null,
        });
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
          className="h-10 w-10 shrink-0 rounded-xl"
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
        <DropdownMenuItem
          disabled={["Pago", "Cancelado"].includes(
            statusLancamento(item.status).label,
          )}
          onSelect={() => abrirAcao("baixa", item)}
          className="gap-2 py-2.5"
        >
          <Coins size={16} />
          Dar baixa
        </DropdownMenuItem>
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
    {
      titulo: "Total lançado",
      valor: totalLancado,
      detalhe: `${despesas.length} despesas no período`,
      Icon: ReceiptText,
      cor: "bg-primary/10 text-primary",
    },
    {
      titulo: "Total pago",
      valor: totalPago,
      detalhe: "Pagamentos registrados",
      Icon: Check,
      cor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      titulo: "Em aberto",
      valor: totalAberto,
      detalhe: "Saldo a pagar no período",
      Icon: CalendarDays,
      cor: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      titulo: "Reembolsos",
      valor: totalReembolsos,
      detalhe: "Despesas reembolsáveis",
      Icon: FileText,
      cor: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
  ];

  return (
    <div className="despesas-theme despesas-shell min-w-0 space-y-5 py-[7px] px-[10px]">
      <style>{DESPESAS_ESTILOS}</style>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ titulo, valor, detalhe, Icon, cor }) => (
          <section
            key={titulo}
            className="despesa-metric min-w-0"
          >
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                {titulo}
              </p>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cor}`}
              >
                <Icon size={13} />
              </span>
            </div>
            <p className="despesa-metric-value mt-1 break-words [overflow-wrap:anywhere]">
              {formatarCentavos(valor)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/75">{detalhe}</p>
          </section>
        ))}
      </div>

      <section
        className="despesa-ledger min-w-0"
        aria-label="Lançamento de despesas"
      >
        <header className="despesa-heading flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Lançamento de despesas
            </h3>
          </div>
          <Button
            type="button"
            onClick={aoNovo}
            className="despesa-primary bg-[rgba(62,156,218,1)] h-11 w-full shrink-0 gap-2 rounded-lg px-5 sm:w-auto"
          >
            <Plus size={18} />
            Novo lançamento
          </Button>
        </header>

        <div className="despesa-toolbar space-y-3 border-b border-border py-[6px] px-[50px] bg-[rgba(10,20,36,1)]">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor="despesa-busca"
                className="text-xs text-muted-foreground"
              >
                Buscar lançamento
              </Label>
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"
                />
                <Input
                  id="despesa-busca"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Descrição, fornecedor, cotista…"
                  className="h-11 rounded-xl bg-background pl-10 text-base sm:text-sm"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor="despesa-status"
                className="text-xs text-muted-foreground"
              >
                Status
              </Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger
                  id="despesa-status"
                  className="h-11 rounded-xl bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="despesas-theme despesa-dialog">
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {["Pendente", "Pago", "Atrasado", "Cancelado"].map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
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
                  className="h-11 min-w-0 rounded-xl bg-background"
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
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor="despesa-ordem"
                className="text-xs text-muted-foreground"
              >
                Ordenar por mês
              </Label>
              <Select value={ordem} onValueChange={setOrdem}>
                <SelectTrigger
                  id="despesa-ordem"
                  className="h-11 rounded-xl bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="despesas-theme despesa-dialog">
                  <SelectItem value="recentes">Mais recentes</SelectItem>
                  <SelectItem value="antigas">Mais antigas</SelectItem>
                  <SelectItem value="maior">Maior valor no mês</SelectItem>
                  <SelectItem value="menor">Menor valor no mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p role="status" aria-live="polite">
              {filtradas.length} de {despesas.length} despesas · Total exibido:{" "}
              <strong className="font-semibold text-foreground">
                {formatarCentavos(totalFiltrado)}
              </strong>
            </p>
            {temFiltros ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-9 gap-1.5 text-xs"
              >
                <X size={14} />
                Limpar filtros
              </Button>
            ) : (
              <span>Expanda uma despesa para consultar documentos e rateio</span>
            )}
          </div>
        </div>

        {filtradas.length > 0 ? (
          <>
            {/* A tabela reserva a maior coluna para a descrição. Nenhum texto depende de tooltip. */}
            <div className="despesa-table-scroll hidden lg:block" tabIndex={0} role="region" aria-label="Tabela de despesas, com rolagem">
              <table className="despesa-table">
                <caption className="sr-only">
                  Despesas agrupadas por mês, com descrições completas, valores
                  e status.
                </caption>
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[30%]" />
                  <col className="w-[19%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Data / documento",
                      "Descrição",
                      "Fornecedor / cotista",
                      "Valor",
                      "Status",
                      "Ações",
                    ].map((titulo) => (
                      <th
                        key={titulo}
                        scope="col"
                        className={`px-4 py-4 font-medium ${titulo === "Valor" || titulo === "Ações" ? "text-right" : ""}`}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                {gruposPorMes.map(({ mes, itens }) => (
                  <tbody key={mes} className="divide-y divide-border">
                    <tr className="despesa-month">
                      <th
                        scope="rowgroup"
                        colSpan={6}
                        className="px-4 py-3 font-normal"
                      >
                        {resumoMes(mes, itens)}
                      </th>
                    </tr>
                    {itens.map((item) => {
                      const aberto = expandido === item.id;
                      const documento =
                        item.numeroNf ||
                        item.numeroRecibo ||
                        item.numeroDemonstrativo ||
                        item.numeroDoc ||
                        item.documento;
                      return (
                        <Fragment key={item.id}>
                          <tr
                            className="despesa-row"
                            data-expanded={aberto}
                          >
                            <td className="px-4 py-5 align-top">
                              <p className="font-mono text-xs font-semibold tabular-nums">
                                {formatarData(item.data)}
                              </p>
                              <p
                                className={`mt-2 text-xs leading-relaxed text-muted-foreground ${TEXTO_COMPLETO}`}
                              >
                                {documento || "Sem documento"}
                              </p>
                            </td>
                            <td className="px-4 py-5 align-top">
                              <p
                                className={`despesa-description text-foreground ${TEXTO_COMPLETO}`}
                              >
                                {item.descricao}
                              </p>
                              <p
                                className={`despesa-category ${TEXTO_COMPLETO}`}
                              >
                                {item.categoria || "Sem categoria"}
                              </p>

                            </td>
                            <td className="px-4 py-5 align-top">
                              <p
                                className={`leading-relaxed ${TEXTO_COMPLETO}`}
                              >
                                {item.fornecedor || "Fornecedor não informado"}
                              </p>
                              <p
                                className={`mt-2 text-xs leading-relaxed text-muted-foreground ${TEXTO_COMPLETO}`}
                              >
                                <span className="font-medium">Cotista: </span>
                                {item.participanteNome ||
                                  item.participanteId ||
                                  "Não informado"}
                              </p>
                            </td>
                            <td className="px-4 py-5 text-right align-top">
                              <p className="despesa-money">
                                {formatarCentavos(item.valorCentavos)}
                              </p>
                              {item.reembolsavel && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Reembolsável
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-5 align-top">
                              <BadgeStatus status={item.status} />
                            </td>
                            <td className="px-4 py-3 text-right align-top">
                              <div className="flex items-center justify-end gap-1">
                                {acoesDaLinha(item)}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 shrink-0 rounded-lg text-primary"
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
                              <td colSpan={6} className="p-0">
                                <LancamentoExpandido
                                  lancamento={item}
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

            {/* Celular e tablet: leitura vertical, sem precisar arrastar uma tabela larga. */}
            <div className="divide-y divide-border lg:hidden">
              {gruposPorMes.map(({ mes, itens }) => (
                <section key={mes}>
                  <div className="bg-muted/30 px-4 py-4 sm:px-6">
                    {resumoMes(mes, itens)}
                  </div>
                  <div className="space-y-3 p-3 sm:p-4">
                    {itens.map((item) => {
                      const aberto = expandido === item.id;
                      const documento =
                        item.numeroNf ||
                        item.numeroRecibo ||
                        item.numeroDemonstrativo ||
                        item.numeroDoc ||
                        item.documento;
                      return (
                        <article
                          key={item.id}
                          data-expanded={aberto}
                          className="despesa-mobile-card min-w-0 overflow-hidden rounded-xl border"
                        >
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                  {formatarData(item.data)}
                                </span>
                                <BadgeStatus status={item.status} />
                              </div>
                              {acoesDaLinha(item)}
                            </div>
                            <h4
                              className={`mt-3 text-base font-semibold leading-7 ${TEXTO_COMPLETO}`}
                            >
                              {item.descricao}
                            </h4>
                            <p
                              className={`mt-1.5 text-xs leading-relaxed text-muted-foreground ${TEXTO_COMPLETO}`}
                            >
                              {item.categoria || "Sem categoria"}
                            </p>
                            <dl className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                              <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">
                                  Fornecedor
                                </dt>
                                <dd
                                  className={`mt-1 leading-relaxed ${TEXTO_COMPLETO}`}
                                >
                                  {item.fornecedor || "Não informado"}
                                </dd>
                              </div>
                              <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">
                                  Cotista
                                </dt>
                                <dd
                                  className={`mt-1 leading-relaxed ${TEXTO_COMPLETO}`}
                                >
                                  {item.participanteNome ||
                                    item.participanteId ||
                                    "Não informado"}
                                </dd>
                              </div>
                              {documento && (
                                <div className="min-w-0 sm:col-span-2">
                                  <dt className="text-xs text-muted-foreground">
                                    Documento
                                  </dt>
                                  <dd
                                    className={`mt-1 text-xs leading-relaxed ${TEXTO_COMPLETO}`}
                                  >
                                    {documento}
                                  </dd>
                                </div>
                              )}
                            </dl>
                            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  Valor da despesa
                                </p>
                                <p className="mt-1 break-words text-xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">
                                  {formatarCentavos(item.valorCentavos)}
                                </p>
                                {item.reembolsavel && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Reembolsável
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setExpandido(aberto ? null : item.id)
                                }
                                aria-expanded={aberto}
                                aria-controls={`despesa-mobile-${item.id}`}
                                className="h-10 gap-2 rounded-xl text-xs"
                              >
                                {aberto
                                  ? "Ocultar detalhes"
                                  : "Documentos e rateio"}
                                {aberto ? (
                                  <ChevronUp size={15} />
                                ) : (
                                  <ChevronDown size={15} />
                                )}
                              </Button>
                            </div>
                          </div>
                          {aberto && (
                            <div id={`despesa-mobile-${item.id}`}>
                              <LancamentoExpandido
                                lancamento={item}
                                aoAbrirDocumento={(nome, url) =>
                                  setDocumentoAberto({ nome, url })
                                }
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
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
        <footer className="despesa-footer border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <div>
            <p>{filtradas.length} {filtradas.length === 1 ? "lançamento exibido" : "lançamentos exibidos"}</p>
            <p className="mt-1 text-[11px]">Indicadores: período completo · Total abaixo: lista filtrada</p>
          </div>
          <div className="despesa-footer-total">
            <span className="text-[10px] font-semibold uppercase tracking-widest">Total do extrato</span>
            <strong>{formatarCentavos(totalFiltrado)}</strong>
          </div>
        </footer>
      </section>

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
                  {acao.tipo === "baixa" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Data do pagamento: {formatarData(hoje())}
                    </p>
                  )}
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
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>(
    [],
  );
  const [cotistaEmprestimo, setCotistaEmprestimo] = useState("");
  const [voosEmprestimos, setVoosEmprestimos] = useState<VooEmprestimo[]>([]);
  const [carregandoEmprestimos, setCarregandoEmprestimos] = useState(false);
  const mesAtual = mesAtualLocal();
  const anoMeses = mesAtual.slice(0, 4);
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

  const carregarAeronaves = useCallback(async () => {
    try {
      const resp = await buscarOpcoesEnvioPagamento();
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
  useEffect(() => {
    const primeira = cotistasAeronave.find(
      (cotista) => cotista.cliente_id || cotista.socio_id,
    );
    if (!primeira) {
      setCotistaEmprestimo("");
      setVoosEmprestimos([]);
      return;
    }
    const disponiveis = new Set(
      cotistasAeronave
        .filter((cotista) => cotista.cliente_id || cotista.socio_id)
        .map(
          (cotista) =>
            `${cotista.socio_id ? "socio" : "cliente"}:${cotista.socio_id || cotista.cliente_id}`,
        ),
    );
    if (!cotistaEmprestimo || !disponiveis.has(cotistaEmprestimo))
      setCotistaEmprestimo(
        `${primeira.socio_id ? "socio" : "cliente"}:${primeira.socio_id || primeira.cliente_id}`,
      );
  }, [cotistasAeronave, cotistaEmprestimo]);
  useEffect(() => {
    if (!cotistaEmprestimo || !aeronaveSelecionada) {
      setVoosEmprestimos([]);
      setCarregandoEmprestimos(false);
      return;
    }
    const [tipo, id] = cotistaEmprestimo.split(":");
    if (!id || (tipo !== "cliente" && tipo !== "socio")) {
      setVoosEmprestimos([]);
      setCarregandoEmprestimos(false);
      return;
    }
    let cancelada = false;
    setCarregandoEmprestimos(true);
    void buscarVoosEmprestimos(
      id,
      tipo,
      aeronaveSelecionada,
      periodoAplicado.inicio,
      periodoAplicado.fim,
      mesesAplicados,
    )
      .then((resultado) => {
        if (!cancelada) setVoosEmprestimos(resultado);
      })
      .catch(() => {
        if (!cancelada) setVoosEmprestimos([]);
      })
      .finally(() => {
        if (!cancelada) setCarregandoEmprestimos(false);
      });
    return () => {
      cancelada = true;
    };
  }, [cotistaEmprestimo, aeronaveSelecionada, periodoAplicado, mesesAplicados]);

  const lancamentosFiltrados = useMemo(() => {
    if (!aeronaveSelecionada || !dashboard?.lancamentos) return [];
    return dashboard.lancamentos.filter((lancamento) => {
      const data = String(lancamento.data ?? "").slice(0, 10);
      return (
        lancamento.aeronaveId === aeronaveSelecionada &&
        data >= periodoAplicado.inicio &&
        data <= periodoAplicado.fim
      );
    });
  }, [dashboard, aeronaveSelecionada, periodoAplicado]);

  const possuiHolding = cotistasAeronave.some((cotista) =>
    Boolean(cotista.eh_holding),
  );
  const [abaAtiva, setAbaAtiva] = useState<
    | "resumo"
    | "medias"
    | "relatorio"
    | "lancamentos"
    | "graficos"
    | "ranking"
    | "emprestimos"
    | "extrato"
  >("lancamentos");

  const periodoDosMeses = (meses: string[]): PeriodoCotista => {
    const periodos = meses
      .map((mes) => periodoDoMes(mes))
      .filter((periodo): periodo is PeriodoCotista => Boolean(periodo));
    return periodos.length
      ? { inicio: periodos[0].inicio, fim: periodos[periodos.length - 1].fim }
      : (periodoDoMes(mesAtual) ?? { inicio: hoje(), fim: hoje() });
  };
  const atualizarMeses = (proximos: string[]) => {
    const ordenados = [...proximos].sort();
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
  const limparMeses = () => atualizarMeses([]);

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
  const gruposVoosEmprestimos = useMemo(
    () => agruparPorMes(voosEmprestimos),
    [voosEmprestimos],
  );
  const custoFixo = despesas
    .filter((lancamento) =>
      /fix|hangar|seguro|assinatura|mensal/i.test(
        `${lancamento.grupoCategoria} ${lancamento.categoria} ${lancamento.descricao}`,
      ),
    )
    .reduce((total, lancamento) => total + lancamento.valorCentavos, 0);
  const custoVariavel =
    despesas.reduce(
      (total, lancamento) => total + lancamento.valorCentavos,
      0,
    ) - custoFixo;
  // O dashboard já entrega ranking_gastos e fechamento_mensal em reais; os lançamentos brutos acima continuam em centavos.
  const dadosCategorias = (dashboard?.ranking_gastos ?? []).map((item) => ({
    nome: item.categoria,
    valor: item.valor,
    quantidade: item.quantidade,
    grupo: item.grupo,
  }));
  const dadosMensais = (dashboard?.fechamento_mensal ?? []).map((item) => ({
    mes: item.mes.slice(5),
    entradas: item.entradas,
    saidas: item.saidas,
    saldo: item.saldo,
  }));

  const cotistasParaDialog: CotistaAeronave[] = useMemo(
    () => (aeronaveSelecionada ? cotistasAeronave : []),
    [aeronaveSelecionada, cotistasAeronave],
  );

  const formatarValorGrafico = (valor: number) =>
    formatarMoeda(valor).replace(",00", "");
  const coresCategorias = [
    "#22d3ee",
    "#60a5fa",
    "#a78bfa",
    "#fbbf24",
    "#34d399",
    "#94a3b8",
  ];

  return (
    <div className="financeiro-shell route-enter min-w-0 max-w-full space-y-5">
      <div className="financeiro-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="financeiro-eyebrow">CLIENTE / AERONAVE</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em] md:text-2xl">
            Financeiro do Cotista
          </h2>
          <p className="text-xs text-muted-foreground">
            Visão econômica consolidada de cotistas e holdings.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={aeronaveSelecionada || "selecionar"}
            onValueChange={(valor) =>
              setAeronaveSelecionada(valor === "selecionar" ? "" : valor)
            }
          >
            <SelectTrigger className="h-11 w-full gap-2 rounded-xl text-sm sm:w-[260px]">
              <Plane size={14} className="text-muted-foreground" />
              <SelectValue placeholder="Selecione uma aeronave" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="selecionar">Selecione uma aeronave</SelectItem>
              {aeronaves.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.matricula_registro} · {a.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!aeronaveSelecionada ? (
        <div className="financeiro-panel rounded-xl border-dashed px-5 py-14 text-center">
          <Plane className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold">Selecione uma aeronave</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Os dados financeiros do cotista serão exibidos depois da seleção.
          </p>
        </div>
      ) : (
        <>
          {aeronaveSelecionada && cotistasAeronave.length > 0 && (
            <div className="financeiro-panel p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                Cotistas desta aeronave
              </p>
              <div className="flex flex-wrap gap-2">
                {cotistasAeronave.map((c) => (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium ${c.eh_holding ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                  >
                    {c.eh_holding ? (
                      <Building2 size={11} />
                    ) : (
                      <User size={11} />
                    )}
                    {c.nome}
                    <span className="font-mono text-[10px] opacity-60">
                      {c.percentual_sociedade}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="financeiro-tabs flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setAbaAtiva("resumo")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "resumo" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutDashboard size={14} />
              Resumo geral
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("medias")}
              className={`flex min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "medias" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Gauge size={14} />
              MÉDIAS
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("relatorio")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "relatorio" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText size={14} />
              Fechamento Balanço
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("lancamentos")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "lancamentos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ReceiptText size={14} />
              Lançamento de despesas
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("graficos")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "graficos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BarChart3 size={14} />
              Gráficos
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("ranking")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "ranking" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListOrdered size={14} />
              Ranking de gastos
            </button>{" "}
            <button
              type="button"
              onClick={() => setAbaAtiva("emprestimos")}
              className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "emprestimos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Fuel size={14} />
              Voos empréstimos
            </button>
            {possuiHolding && (
              <button
                type="button"
                onClick={() => setAbaAtiva("extrato")}
                className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "extrato" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Landmark size={14} />
                Extrato Holding
              </button>
            )}
          </div>

          {abaAtiva !== "relatorio" && (
            <section className="financeiro-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold">Período dos dados</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Selecione um ou mais meses para somar os dados da aeronave.
                </p>
              </div>
              <span className="text-[9px] text-muted-foreground">
                {mesesRascunho.length} de {mesesDisponiveis.length}{" "}
                selecionado(s)
              </span>
            </div>
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Selecionar meses"
            >
              <button
                type="button"
                onClick={selecionarTodosOsMeses}
                aria-pressed={mesesRascunho.length === mesesDisponiveis.length}
                className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Todos
              </button>
              {MESES_CURTOS.map((mes, indice) => {
                const competencia = mesesDisponiveis[indice];
                const selecionado = mesesRascunho.includes(competencia);
                return (
                  <button
                    key={competencia}
                    type="button"
                    onClick={() => alternarMes(competencia)}
                    aria-pressed={selecionado}
                    aria-label={`${selecionado ? "Remover" : "Selecionar"} ${mes} ${anoMeses}`}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors ${selecionado ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                  >
                    {mes}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={limparMeses}
                className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Limpar
              </button>
            </div>
            </section>
          )}

          {carregando ? (
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
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="financeiro-panel xl:col-span-2">
                      <div className="mb-5 flex items-center gap-2 ml-[18px] mt-[11px]">
                        <div>
                          <p className="text-sm font-bold">
                            Composição dos custos
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Custos fixos e variáveis das despesas lançadas
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2.5 p-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Custos fixos
                          </p>
                          <p className="mt-1 font-mono text-base font-bold text-foreground">
                            {formatarCentavos(custoFixo)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Hangar, seguro e recorrências
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Custos variáveis
                          </p>
                          <p className="mt-1 font-mono text-base font-bold text-foreground">
                            {formatarCentavos(custoVariavel)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Operação, combustível e demais despesas
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="financeiro-panel p-3.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Indicadores</p>
                      <div className="mt-2.5 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[10px] text-muted-foreground">
                            Média mensal
                          </p>
                          <p className="font-mono text-xs font-bold">
                            {formatarMoeda(
                              dashboard?.resumo?.media_mensal ?? 0,
                            )}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 border-t border-border/40 pt-2">
                          <p className="text-[10px] text-muted-foreground">
                            Média por lançamento
                          </p>
                          <p className="font-mono text-xs font-bold">
                            {formatarMoeda(
                              dashboard?.resumo?.media_lancamento ?? 0,
                            )}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 border-t border-border/40 pt-2">
                          <p className="text-[10px] text-muted-foreground">
                            Pendências
                          </p>
                          <p className="font-mono text-xs font-bold text-amber-400">
                            {dashboard?.resumo?.pendentes ?? 0} lançamento(s)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {Array.isArray(dashboard?.saldos) &&
                  dashboard.saldos.length > 0 ? (
                    <div className="financeiro-panel overflow-hidden">
                      <div className="financeiro-panel-header">
                        <p className="text-xs font-bold">Saldos por cotista</p>
                      </div>
                      <div className="divide-y divide-border">
                        {dashboard.saldos.map((s, i) => (
                          <div
                            key={`${s.cotista}-${i}`}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
                          >
                            <span className="font-medium">{s.cotista}</span>
                            <div className="flex gap-4 text-[10px]">
                              <span className="text-muted-foreground">
                                Pago: {formatarCentavos(s.totalPagoCentavos)}
                              </span>
                              <span className="text-muted-foreground">
                                Devido:{" "}
                                {formatarCentavos(s.totalDevidoCentavos)}
                              </span>
                              <span
                                className={
                                  s.saldoCentavos >= 0
                                    ? "font-mono font-bold text-emerald-400"
                                    : "font-mono font-bold text-red-400"
                                }
                              >
                                {formatarCentavos(s.saldoCentavos)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {possuiHolding && (dashboard?.holdings ?? []).length > 0 && (
                    <div className="space-y-3">
                      {dashboard!.holdings.map((holding) => (
                        <section
                          key={holding.id}
                          className="financeiro-panel overflow-hidden"
                        >
                          <div className="financeiro-panel-header">
                            <div className="flex items-center gap-2">
                              <Landmark size={15} className="text-primary" />
                              <div>
                                <p className="text-xs font-bold">
                                  Saldo bancário · {holding.nome}
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {holding.contaBancaria ||
                                    "Conta bancária não identificada"}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-sm font-bold">
                              {formatarCentavos(holding.saldoContaCentavos)}
                            </span>
                          </div>
                          <div className="divide-y divide-border">
                            {holding.socios.map((socio) => (
                              <div
                                key={socio.cotistaId}
                                className="grid gap-2 px-4 py-3 text-[10px] sm:grid-cols-[minmax(120px,1.2fr)_repeat(4,minmax(90px,1fr))] sm:items-center"
                              >
                                <div>
                                  <p className="font-semibold">
                                    {socio.nome ||
                                      cotistasAeronave.find(
                                        (cotista) =>
                                          cotista.socio_id === socio.cotistaId,
                                      )?.nome ||
                                      socio.cotistaId}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Participação:{" "}
                                    {Number(
                                      socio.percentual || 0,
                                    ).toLocaleString("pt-BR", {
                                      maximumFractionDigits: 4,
                                    })}
                                    %
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Depositado{" "}
                                  </span>
                                  <strong className="font-mono">
                                    {formatarCentavos(
                                      socio.totalDepositadoCentavos,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Consumido da conta{" "}
                                  </span>
                                  <strong className="font-mono">
                                    {formatarCentavos(
                                      socio.totalConsumidoCentavos,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Pago diretamente{" "}
                                  </span>
                                  <strong className="font-mono">
                                    {formatarCentavos(
                                      socio.despesasPagasDiretamenteCentavos,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Saldo atribuído{" "}
                                  </span>
                                  <strong
                                    className={`font-mono ${socio.saldoCentavos >= 0 ? "text-emerald-400" : "text-red-400"}`}
                                  >
                                    {formatarCentavos(socio.saldoCentavos)}
                                  </strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === "relatorio" && (
                <RelatorioGeralCotista aeronaveId={aeronaveSelecionada} />
              )}
              {abaAtiva === "medias" && (
                <MediasCotista
                  medias={dashboard?.medias ?? null}
                  mediasMensais={dashboard?.medias_mensais ?? []}
                />
              )}
              {abaAtiva === "lancamentos" && (
                <LancamentosDespesa
                  lancamentos={lancamentosFiltrados}
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
                      <p className="text-sm font-bold">Voos empréstimos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Abastecimentos em nome deste cotista realizados em
                        outras aeronaves.
                      </p>
                    </div>
                    <Select
                      value={cotistaEmprestimo}
                      onValueChange={setCotistaEmprestimo}
                    >
                      <SelectTrigger className="h-8 w-full text-[10px] sm:w-[240px]">
                        <SelectValue placeholder="Selecione o cotista" />
                      </SelectTrigger>
                      <SelectContent>
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
                  {carregandoEmprestimos ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : gruposVoosEmprestimos.length ? (
                    <div className="divide-y divide-border">
                      {gruposVoosEmprestimos.map(({ mes, itens }) => (
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
                  <div className="financeiro-panel p-5">
                    <div className="mb-5">
                      <p className="text-sm font-bold">Evolução mensal</p>
                      <p className="text-[10px] text-muted-foreground">
                        Entradas e saídas por competência
                      </p>
                    </div>
                    <div className="h-52 sm:h-64">
                      {dadosMensais.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dadosMensais}>
                            <defs>
                              <linearGradient
                                id="areaSaidas"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#22d3ee"
                                  stopOpacity={0.4}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#22d3ee"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="mes"
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) => formatarValorGrafico(v)}
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={60}
                            />
                            <Tooltip
                              formatter={(v: number) => formatarMoeda(v)}
                            />
                            <Area
                              type="monotone"
                              dataKey="saidas"
                              name="Saídas"
                              stroke="#22d3ee"
                              fill="url(#areaSaidas)"
                              strokeWidth={2}
                            />
                            <Area
                              type="monotone"
                              dataKey="entradas"
                              name="Entradas"
                              stroke="#34d399"
                              fill="transparent"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Dados insuficientes para o período.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="financeiro-panel p-5">
                    <div className="mb-5">
                      <p className="text-sm font-bold">Custos por categoria</p>
                      <p className="text-[10px] text-muted-foreground">
                        Distribuição das despesas registradas
                      </p>
                    </div>
                    <div className="h-52 sm:h-64">
                      {dadosCategorias.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={dadosCategorias}
                            layout="vertical"
                            margin={{ left: 8 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="nome"
                              width={90}
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(v: number) => formatarMoeda(v)}
                            />
                            <Bar
                              dataKey="valor"
                              name="Custo"
                              radius={[0, 4, 4, 0]}
                              fill="#22d3ee"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Dados insuficientes para o período.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="financeiro-panel p-5 xl:col-span-2">
                    <div className="mb-5 flex items-center gap-2">
                      <PieChart size={15} className="text-primary" />
                      <div>
                        <p className="text-sm font-bold">
                          Participação por categoria
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Percentual de cada despesa sobre o total
                        </p>
                      </div>
                    </div>
                    <div className="h-52 sm:h-64">
                      {dadosCategorias.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={dadosCategorias}
                              dataKey="valor"
                              nameKey="nome"
                              innerRadius={60}
                              outerRadius={95}
                              paddingAngle={3}
                            >
                              {dadosCategorias.map((item, i) => (
                                <Cell
                                  key={item.nome}
                                  fill={
                                    coresCategorias[i % coresCategorias.length]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => formatarMoeda(v)}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Dados insuficientes para o período.
                        </div>
                      )}
                    </div>
                  </div>
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
    </div>
  );
}
