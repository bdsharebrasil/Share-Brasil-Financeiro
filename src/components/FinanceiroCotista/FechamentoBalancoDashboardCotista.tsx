import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, BookOpen, CheckCircle2,
  ClipboardList, Printer, Scale, Wallet,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardCotista, LancamentoEconomico } from "@/lib/financeiro-share-api";
import { formatarCentavos, formatarData } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";
import { formatNumero } from "@/utils/format";

/**
 * Substituição direta do componente existente; mantém as cinco props do pai.
 * Origem: buscarDashboardCotista -> GET /api/financeiro/cotista/dashboard -> SHARE_DB (D1).
 * O pai continua responsável por autenticação, carregamento e atualização.
 * Valores monetários internos são centavos. Não consulta tabelas Supabase nem D1 diretamente.
 * A biblioteca financeiro-share-api mantém a autenticação Supabase já existente.
 * Instalação: substituir src/components/FinanceiroCotista/FechamentoBalancoDashboardCotista.tsx.
 * Não exige mudanças no componente pai nem novas dependências.
 *
 * Compatibilidade com o backend fornecido:
 * - O endpoint ignora `meses`: filtramos os detalhes e as médias mensais localmente.
 * - `saldos`, `matrizCompensacao` e `holdings` são históricos até `fim`, não saldos mensais.
 * - Não há diário completo nesta resposta. Não inventamos voos ou empréstimos.
 * - A apuração usa emissão/status, não o filtro `conferido` do exemplo antigo.
 */
type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  mesesSelecionados: string[];
};

const ABAS = [
  { id: "graficos", nome: "Gráficos e custos", Icon: BarChart3 },
  { id: "lancamentos", nome: "Lançamentos", Icon: ClipboardList },
  { id: "acerto", nome: "Acerto de contas", Icon: Scale },
  { id: "holding", nome: "Conta comum", Icon: Wallet },
  { id: "metodologia", nome: "Como ler o balanço", Icon: BookOpen },
] as const;
type Aba = (typeof ABAS)[number]["id"];
const CORES = ["#0284c7", "#d97706", "#059669", "#7c3aed", "#db2777", "#dc2626", "#0891b2"];
const numero = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const centavos = (value: unknown) => Math.round(numero(value));
const chaveMes = (data: string | null | undefined) => String(data ?? "").slice(0, 7);
const mesValido = (mes: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
const normalizar = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
const dinheiro = (value: unknown) => formatarCentavos(centavos(value));
const compacto = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
}).format(value / 100);
function horasMinutos(horas: number) {
  const minutos = Math.round(Math.max(0, horas) * 60);
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, "0")}min`;
}
function rotulo(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Não informado";
}

type Pagamento = { pagador: string; valor: number };
/** O pai consolidado tem pagoPor vazio; os pagamentos reais estão nas linhas filhas. */
function pagamentos(lancamento: LancamentoEconomico): Pagamento[] {
  if (lancamento.rateios.length) {
    return lancamento.rateios.map((r) => ({
      pagador: r.pagoPor || "Pagador não informado",
      valor: centavos(r.valorPagoRealCentavos),
    }));
  }
  return [{ pagador: lancamento.pagoPor || "Pagador não informado", valor: centavos(lancamento.valorPagoRealCentavos) }];
}

/** Agregação apenas de apresentação: não recalcula rateios nem compensações contábeis. */
function montarPeriodo(dashboard: DashboardCotista, mesesSelecionados: string[]) {
  const meses = [...new Set(mesesSelecionados.filter(mesValido))].sort();
  const selecionados = new Set(meses);
  const lancamentos = dashboard.lancamentos.filter((l) =>
    selecionados.has(chaveMes(l.data)) && l.status?.toUpperCase() !== "CANCELADO",
  ).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const despesas = lancamentos.filter((l) => l.fluxo === "SAIDA");
  const medias = new Map(dashboard.medias_mensais.map((m) => [m.mes, m]));
  const mensais = meses.map((mes) => {
    const registros = lancamentos.filter((l) => chaveMes(l.data) === mes);
    const entradas = registros.filter((l) => l.fluxo === "ENTRADA").reduce((s, l) => s + centavos(l.valorCentavos), 0);
    const saidas = registros.filter((l) => l.fluxo === "SAIDA").reduce((s, l) => s + centavos(l.valorCentavos), 0);
    const custoRateado = registros.filter((l) => l.fluxo === "SAIDA").reduce((s, l) => s + centavos(l.valorRateadoCentavos ?? l.valorCentavos), 0);
    const m = medias.get(mes);
    const horas = numero(m?.horas_voadas);
    const voos = numero(m?.total_voos);
    return { mes, nome: rotuloMesCotista(mes), entradas, saidas, custoRateado,
      saldo: entradas - saidas, quantidade: registros.length, horas, voos,
      pousos: numero(m?.total_pousos), custoHora: horas > 0 ? Math.round(saidas / horas) : null };
  });
  const entradas = mensais.reduce((s, m) => s + m.entradas, 0);
  const saidas = mensais.reduce((s, m) => s + m.saidas, 0);
  const horas = mensais.reduce((s, m) => s + m.horas, 0);
  const voos = mensais.reduce((s, m) => s + m.voos, 0);
  const categoriasMap = new Map<string, { categoria: string; total: number; pago: number; quantidade: number }>();
  despesas.forEach((l) => {
    const categoria = l.categoria || "Sem categoria";
    const item = categoriasMap.get(categoria) ?? { categoria, total: 0, pago: 0, quantidade: 0 };
    item.total += centavos(l.valorCentavos);
    item.pago += pagamentos(l).reduce((s, p) => s + p.valor, 0);
    item.quantidade += 1;
    categoriasMap.set(categoria, item);
  });
  return { meses, lancamentos, despesas, mensais, entradas, saidas, horas, voos,
    saldo: entradas - saidas,
    pousos: mensais.reduce((s, m) => s + m.pousos, 0),
    custoRateado: mensais.reduce((s, m) => s + m.custoRateado, 0),
    custoHora: horas > 0 ? Math.round(saidas / horas) : null,
    custoVoo: voos > 0 ? Math.round(saidas / voos) : null,
    pendentes: lancamentos.filter((l) => ["EM_ABERTO", "EM_ATRASO"].includes(l.status.toUpperCase())).length,
    categorias: [...categoriasMap.values()].sort((a, b) => b.total - a.total),
    movimentos: dashboard.movimentos_holding.filter((m) => selecionados.has(chaveMes(m.data))),
  };
}

export function FechamentoBalancoDashboardCotista({
  dashboard, carregando, erro, cotistas, mesesSelecionados,
}: Props) {
  const [aba, setAba] = useState<Aba>("lancamentos");
  const [busca, setBusca] = useState("");
  const [fluxo, setFluxo] = useState("TODOS");
  const possuiHolding = cotistas.some((cotista) => Boolean(cotista.eh_holding));
  const abaVisivel = aba === "holding" && !possuiHolding ? "lancamentos" : aba;
  const uid = useId();
  const dados = useMemo(() => dashboard ? montarPeriodo(dashboard, mesesSelecionados) : null, [dashboard, mesesSelecionados]);
  const nomes = useMemo(() => {
    const map = new Map<string, string>();
    cotistas.forEach((c) => {
      [c.id, c.cliente_id, c.socio_id, ...(c.cotista_ids ?? [])].forEach((id) => {
        if (id) map.set(normalizar(id), c.nome?.trim() || id);
      });
    });
    return map;
  }, [cotistas]);
  const nome = (id: string | null | undefined) => id ? nomes.get(normalizar(id)) ?? id : "Não informado";
  const { colunasCotistas, aliasesCotistas } = useMemo(() => {
    const aliases = new Map<string, string>();
    const participantes = new Map<string, string>();
    cotistas.forEach((cotista) => {
      const ids = [cotista.id, cotista.cliente_id, cotista.socio_id, ...(cotista.cotista_ids ?? [])].filter((id): id is string => Boolean(id));
      const chave = normalizar(cotista.id || ids[0] || cotista.nome);
      const label = cotista.nome?.trim() || cotista.id;
      participantes.set(chave, label);
      [...ids, cotista.nome].filter(Boolean).forEach((id) => aliases.set(normalizar(id), chave));
    });
    dados?.lancamentos.forEach((lancamento) => lancamento.rateios.forEach((rateio) => {
      const id = rateio.cotistaId || rateio.cotista;
      const alias = normalizar(id);
      const chave = aliases.get(alias) ?? alias;
      aliases.set(alias, chave);
      if (!participantes.has(chave)) participantes.set(chave, nomes.get(alias) ?? id);
    }));
    const colunas = [...participantes].map(([chave, label]) => ({ chave, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return { colunasCotistas: colunas, aliasesCotistas: aliases };
  }, [cotistas, dados?.lancamentos, nomes]);

  if (carregando) return <div role="status" aria-live="polite" className="space-y-4">
    <span className="sr-only">Carregando fechamento financeiro…</span>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
    <div className="h-80 animate-pulse rounded-2xl bg-muted" />
  </div>;
  if (erro) return <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
    <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
    <h2 className="font-semibold">Não foi possível carregar o fechamento</h2>
    <p className="mt-2 text-sm text-muted-foreground">{erro}</p>
  </div>;
  if (!dashboard || !dados) return <Vazio>Selecione uma aeronave para consultar o fechamento.</Vazio>;
  if (!dados.meses.length) return <Vazio>Selecione pelo menos um mês para consultar o fechamento.</Vazio>;

  const periodo = dados.meses.map(rotuloMesCotista).join(" · ");
  const aeronaves = [...new Set(dados.lancamentos.map((l) => l.aeronaveNome).filter(Boolean))].join(" / ");
  const registrosVisiveis = dados.lancamentos.filter((l) => {
    const texto = [l.descricao, l.fornecedor, l.categoria, l.documento, l.numeroNf, l.numeroRecibo, l.pagoPor,
      ...l.rateios.map((r) => `${r.cotista} ${r.pagoPor ?? ""}`)].join(" ");
    return (fluxo === "TODOS" || l.fluxo === fluxo) && normalizar(texto).includes(normalizar(busca));
  });
  const totalPago = dashboard.saldos.reduce((s, c) => s + centavos(c.totalPagoCentavos), 0);
  const totalDevido = dashboard.saldos.reduce((s, c) => s + centavos(c.totalDevidoCentavos), 0);
  const diferenca = totalPago - totalDevido;
  const transferencias = Object.entries(dashboard.matrizCompensacao).flatMap(([credor, devedores]) =>
    Object.entries(devedores).filter(([, valor]) => numero(valor) > 0).map(([devedor, valor]) => ({ credor, devedor, valor: centavos(valor) })),
  );
  const painel = (id: Aba) => `${abaVisivel === id ? "block" : "hidden"} space-y-5 print:block print:break-before-page`;
  const tooltipStyle = { borderRadius: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };

  return <div className="fechamento-d1 space-y-5 text-foreground">
    <style>{`
      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        body * { visibility: hidden; }
        .fechamento-d1, .fechamento-d1 * { visibility: visible; }
        .fechamento-d1 { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: white; }
        .fechamento-d1 * { color: #111 !important; background-color: transparent !important; box-shadow: none !important; }
        .fechamento-d1 .overflow-x-auto { overflow: visible !important; }
        .fechamento-d1 table { width: 100%; min-width: 0 !important; font-size: 9px; }
        .fechamento-d1 th, .fechamento-d1 td { padding: 5px; overflow-wrap: anywhere; white-space: normal; }
        .fechamento-d1 thead { display: table-header-group; }
        .fechamento-d1 tr { break-inside: avoid; }
      }
    `}</style>
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="mt-2 text-sm capitalize text-muted-foreground">{periodo}</p>
      </div>
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted print:hidden">
        <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / salvar PDF
      </button>
    </header>
    <nav aria-label="Seções do fechamento" className="flex gap-1 overflow-x-auto border-b border-border print:hidden">
      {ABAS.filter(({ id }) => id !== "holding" || possuiHolding).map(({ id, nome: label, Icon }) => <button key={id} type="button" aria-pressed={abaVisivel === id} aria-controls={`${uid}-${id}`} onClick={() => setAba(id)}
        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${aba === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
      </button>)}
    </nav>

    <div id={`${uid}-graficos`} className={painel("graficos")}>
      <div className="grid gap-5 xl:grid-cols-2 print:hidden">
        <Painel titulo="Evolução financeira" descricao="Valores dos meses selecionados.">
          <div className="h-72 p-3"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados.mensais} margin={{ left: 12, right: 12, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => dinheiro(v)} contentStyle={tooltipStyle} /><Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#059669" fill="#059669" fillOpacity={0.12} isAnimationActive={false} />
              <Area type="monotone" dataKey="saidas" name="Despesas" stroke="#0284c7" fill="#0284c7" fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer></div>
        </Painel>
        <Painel titulo="Distribuição das despesas" descricao="Até oito categorias; as demais são agrupadas em Outras.">
          {dados.categorias.some((c) => c.total > 0) ? <div className="h-72 p-3"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={[
              ...dados.categorias.filter((c) => c.total > 0).slice(0, 8),
              ...(dados.categorias.filter((c) => c.total > 0).length > 8 ? [{ categoria: "Outras", total: dados.categorias.filter((c) => c.total > 0).slice(8).reduce((s, c) => s + c.total, 0) }] : []),
            ]} dataKey="total" nameKey="categoria" innerRadius={52} outerRadius={85} isAnimationActive={false}>
              {Array.from({ length: 9 }, (_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
            </Pie><Tooltip formatter={(v) => dinheiro(v)} contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
          </ResponsiveContainer></div> : <Vazio>Não há despesas positivas para o gráfico.</Vazio>}
        </Painel>
        <Painel titulo="Utilização da aeronave" descricao="Horas em formato decimal no gráfico.">
          <div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados.mensais}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis />
            <Tooltip formatter={(v) => `${formatNumero(numero(v), 2)} h`} contentStyle={tooltipStyle} />
            <Bar dataKey="horas" name="Horas voadas" fill="#0284c7" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer></div>
        </Painel>
        <Painel titulo="Custo por hora" descricao="Meses sem horas voadas ficam sem indicador de custo por hora.">
          <div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados.mensais}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compacto} width={80} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => dinheiro(v)} contentStyle={tooltipStyle} /><Bar dataKey="custoHora" name="Custo/h" fill="#d97706" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer></div>
        </Painel>
      </div>
      <Painel titulo="Despesas por categoria" descricao="Pagamento informado corresponde ao campo de valor pago real dos rateios. Zero pode significar que a origem não informa esse valor.">
        {dados.categorias.length ? <Tabela cabecalhos={["Categoria", "Lançamentos", "Participação", "Valor lançado", "Pagamento informado"]}>
          {dados.categorias.map((c) => <tr key={c.categoria}><Celula titulo>{c.categoria}</Celula><Celula>{c.quantidade}</Celula>
            <Celula>{dados.saidas !== 0 ? `${formatNumero(c.total / dados.saidas * 100, 1)}%` : "—"}</Celula><Celula>{dinheiro(c.total)}</Celula><Celula>{dinheiro(c.pago)}</Celula></tr>)}
        </Tabela> : <Vazio>Nenhuma despesa no período.</Vazio>}
      </Painel>
    </div>

    <div id={`${uid}-lancamentos`} className={painel("lancamentos")}>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="min-w-60 flex-1 text-xs font-semibold">Buscar lançamento
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, fornecedor, documento ou cotista" className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold">Fluxo
          <select value={fluxo} onChange={(e) => setFluxo(e.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="TODOS">Todos</option><option value="ENTRADA">Entradas</option><option value="SAIDA">Saídas</option>
          </select>
        </label>
        <p className="py-2 text-xs text-muted-foreground">{registrosVisiveis.length} de {dados.lancamentos.length} lançamento(s)</p>
      </div>
      <Painel titulo="Lançamentos e rateios" descricao="Despesas consolidadas pela API. Os detalhes mostram as parcelas sem somá-las novamente ao total. A impressão respeita a busca e o fluxo acima.">
        {registrosVisiveis.length ? <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[10px] leading-tight" style={{ minWidth: `${Math.max(960, 720 + colunasCotistas.length * 150)}px` }}>
            <colgroup>
              {[12, 8, 12, 16, 10, 8, 10, 10, 14].map((peso, i) => <col key={i} style={{ width: `${(colunasCotistas.length ? Math.max(50, 100 - Math.max(20, Math.min(50, colunasCotistas.length * 13.333))) : 100) * peso / 100}%` }} />)}
              {colunasCotistas.map(({ chave }) => <Fragment key={chave}><col style={{ width: `${Math.max(20, Math.min(50, colunasCotistas.length * 13.333)) / colunasCotistas.length / 2}%` }} /><col style={{ width: `${Math.max(20, Math.min(50, colunasCotistas.length * 13.333)) / colunasCotistas.length / 2}%` }} /></Fragment>)}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[9px] font-semibold uppercase text-muted-foreground">
            <th colSpan={9} className="px-2 py-3 text-left">Qualificação da despesa</th>
                {colunasCotistas.map(({ chave, label }) => <th key={chave} colSpan={2} className="border-l border-border px-1 py-3 text-center text-primary">{label}</th>)}
              </tr>
              <tr className="border-b border-border bg-muted/20 text-[9px] font-semibold uppercase text-muted-foreground">
                {["Data", "Doc", "Fornecedor", "Descrição", "Categoria", "Tipo", "Prazo", "Pago por", "Total"].map((coluna) => <th key={coluna} className="px-2 py-2 text-left">{coluna}</th>)}
                {colunasCotistas.map(({ chave }) => <Fragment key={chave}><th className="border-l border-border px-1 py-2 text-right">%</th><th className="px-1 py-2 text-right">R$</th></Fragment>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {registrosVisiveis.map((l) => {
                const rateiosPorCotista = new Map<string, { percentual: number; valor: number }>();
                l.rateios.forEach((rateio) => {
                  const id = rateio.cotistaId || rateio.cotista;
                  const chave = aliasesCotistas.get(normalizar(id)) ?? normalizar(id);
                  const atual = rateiosPorCotista.get(chave) ?? { percentual: 0, valor: 0 };
                  atual.percentual += numero(rateio.percentual);
                  atual.valor += centavos(rateio.valorCentavos);
                  rateiosPorCotista.set(chave, atual);
                });
                const pagadores = [...new Set(l.rateios.map((rateio) => rateio.pagoPor).filter((id): id is string => Boolean(id)))];
                return <tr key={`${l.tipo}:${l.id}`} className="align-top hover:bg-muted/20">
                  <td className="px-2 py-3 font-semibold">{formatarData(l.data)}</td>
                  <td className="px-2 py-3 font-semibold">{l.documento || l.numeroNf || l.numeroRecibo || l.numeroDemonstrativo || "—"}</td>
                  <td className="break-words px-2 py-3 font-semibold">{l.fornecedor || "—"}</td>
                  <td className="break-words px-2 py-3">{l.descricao}</td>
                  <td className="break-words px-2 py-3">{l.categoria}</td>
                  <td className="break-words px-2 py-3 text-muted-foreground">{rotulo(l.tipo)}</td>
                  <td className="px-2 py-3">{l.prazo ? formatarData(l.prazo) : "—"}</td>
                  <td className="break-words px-2 py-3 font-semibold">{l.pagoPor ? nome(l.pagoPor) : pagadores.map(nome).join(", ") || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono font-semibold">{dinheiro(l.valorCentavos)}</td>
                  {colunasCotistas.map(({ chave }) => {
                    const rateio = rateiosPorCotista.get(chave);
                    return <Fragment key={chave}>
                      <td className="border-l border-border px-1 py-3 text-right font-mono">{rateio ? `${formatNumero(rateio.percentual, 4)}%` : "—"}</td>
                      <td className="whitespace-nowrap px-1 py-3 text-right font-mono font-semibold">{rateio ? dinheiro(rateio.valor) : "—"}</td>
                    </Fragment>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <Vazio>Nenhum lançamento corresponde aos filtros.</Vazio>}
      </Painel>
    </div>

    <div id={`${uid}-acerto`} className={painel("acerto")}>
      <Nota titulo="Posição acumulada do fechamento">
        Os saldos e as compensações abaixo incluem o histórico até a data final da consulta. Eles não são limitados aos meses marcados no relatório.
      </Nota>
      <div className="grid gap-4 sm:grid-cols-3"><Resumo titulo="Pagamento informado acumulado" valor={dinheiro(totalPago)} /><Resumo titulo="Devido acumulado" valor={dinheiro(totalDevido)} /><Resumo titulo="Pago − devido" valor={dinheiro(diferenca)} /></div>
      {diferenca !== 0 && <Nota titulo="Diferença na base de compensação" alerta>Há uma diferença de {dinheiro(diferenca)} entre pagamentos informados e valores devidos. </Nota>}
      <Painel titulo="Posição por cotista" descricao="Saldo positivo: crédito na apuração. Saldo negativo: valor devido na apuração.">
        {dashboard.saldos.length ? <Tabela cabecalhos={["Cotista", "Pago informado", "Devido", "Saldo", "Posição"]}>
          {dashboard.saldos.map((s, i) => <tr key={`${s.cotista}:${i}`}><Celula titulo>{nome(s.cotista)}</Celula><Celula>{dinheiro(s.totalPagoCentavos)}</Celula><Celula>{dinheiro(s.totalDevidoCentavos)}</Celula><Celula>{dinheiro(s.saldoCentavos)}</Celula><Celula>{s.saldoCentavos > 0 ? "Crédito" : s.saldoCentavos < 0 ? "Débito" : "Equilibrado"}</Celula></tr>)}
        </Tabela> : <Vazio>Nenhum saldo informado pela API.</Vazio>}
      </Painel>
      <Painel titulo="Compensações sugeridas pela API" descricao="Cada linha indica quem paga, quem recebe e o valor sugerido.">
        {transferencias.length ? <div className="grid gap-3 p-4 md:grid-cols-2">{transferencias.map((t) => <div key={`${t.devedor}:${t.credor}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
          <span className="font-semibold">{nome(t.devedor)}</span><ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="paga a" /><span>{nome(t.credor)}</span><strong className="ml-auto font-mono text-primary">{dinheiro(t.valor)}</strong>
        </div>)}</div> : <Vazio>Nenhuma transferência sugerida pela API.</Vazio>}
      </Painel>
    </div>

    {possuiHolding && <div id={`${uid}-holding`} className={painel("holding")}>
      <Nota titulo="Conta comum da holding">
        Os saldos são acumulados até a data final da consulta e restritos à aeronave consultada. O extrato abaixo usa somente os meses selecionados. Saldo do sócio = depósitos − consumo; despesas diretas são exibidas separadamente, conforme a regra do backend.
      </Nota>
      {dashboard.holdings.length ? dashboard.holdings.map((h) => <Painel key={h.id} titulo={h.nome} descricao={`${h.contaBancaria || "Conta não informada"} · Saldo acumulado da aeronave: ${dinheiro(h.saldoContaCentavos)}`}>
        <Tabela cabecalhos={["Sócio", "Participação", "Depositado", "Consumido", "Despesas diretas", "Saldo"]}>
          {h.socios.map((s) => <tr key={s.cotistaId}><Celula titulo>{s.nome}</Celula><Celula>{formatNumero(numero(s.percentual), 2)}%</Celula><Celula>{dinheiro(s.totalDepositadoCentavos)}</Celula><Celula>{dinheiro(s.totalConsumidoCentavos)}</Celula><Celula>{dinheiro(s.despesasPagasDiretamenteCentavos)}</Celula><Celula>{dinheiro(s.saldoCentavos)}</Celula></tr>)}
        </Tabela>
      </Painel>) : <Vazio>Nenhuma holding vinculada retornada para esta aeronave.</Vazio>}
      <Painel titulo="Extrato da conta comum no período" descricao="Valores exibidos com seu status; lançamentos em aberto não significam movimentação bancária efetiva.">
        {dados.movimentos.length ? <Tabela cabecalhos={["Emissão", "Holding / sócio", "Descrição", "Fluxo", "Situação", "Direto", "Valor"]}>
          {dados.movimentos.map((m) => <tr key={m.id}><Celula titulo>{formatarData(m.data)}</Celula><Celula esquerda>{m.holdingNome || "—"}<small className="block text-muted-foreground">{m.socioNome || "—"}</small></Celula><Celula esquerda>{m.descricao}</Celula><Celula>{rotulo(m.fluxo)}</Celula><Celula>{rotulo(m.status)}</Celula><Celula>{m.diretamentePago ? "Sim" : "Não"}</Celula><Celula>{dinheiro(m.valorCentavos)}</Celula></tr>)}
        </Tabela> : <Vazio>Nenhum movimento de holding nos meses selecionados.</Vazio>}
      </Painel>
    </div>}

    <div id={`${uid}-metodologia`} className={painel("metodologia")}>
      <div className="grid gap-4 md:grid-cols-2">
        <Nota titulo="Período e competência">O relatório usa a data de emissão devolvida pela API. Meses não selecionados são excluídos de lançamentos, categorias, médias e gráficos. As despesas podem estar abertas, pagas ou atrasadas; o total lançado não equivale ao total pago.</Nota>
        <Nota titulo="Rateios já calculados">O dashboard apresenta os valores e percentuais persistidos pelo backend. Não refaz o rateio por horas ou sociedade. O tipo de rateio vem das parcelas; a origem técnica do lançamento não é utilizada como critério de divisão.</Nota>
        <Nota titulo="Custo de operação">Custo/h = despesas dos meses selecionados ÷ horas desses mesmos meses. Custo/voo = despesas ÷ quantidade de voos. Sem horas ou voos, o indicador fica sem valor. As horas vêm do tempo total apurado pelo backend.</Nota>
        <Nota titulo="Pagamentos e conta comum">Os pagamentos reais vêm dos rateios, inclusive quando o lançamento principal não tem pagador. Algumas origens retornam zero para pagamento real; consulte o status e o registro de origem. Saldos de holding e compensações são posições acumuladas da API.</Nota>
        <Nota titulo="Diário de bordo e empréstimos">Esta resposta da API fornece médias mensais de voo, mas não o diário completo nem o detalhamento de empréstimos. Esses dados não são inferidos a partir de custos. Os totais exibidos seguem a apuração de voos da rota atual.</Nota>
        <Nota titulo="Conferência">O endpoint atual exclui registros cancelados, mas não aplica o filtro “conferido” do exemplo em Supabase. Compare a emissão, situação, parcelas e pagamentos antes de concluir o fechamento.</Nota>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Os valores monetários são somados em centavos e formatados em reais apenas na exibição.</p>
    </div>
    <footer className="border-t border-border pt-4 text-center text-xs text-muted-foreground">Share Brasil · Fechamento e balanço · {periodo}</footer>
  </div>;
}

function Painel({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card shadow-sm"><header className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">{titulo}</h2>{descricao && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descricao}</p>}</header>{children}</section>;
}
function Tabela({ cabecalhos, children, compacta = false, larguras }: { cabecalhos: string[]; children: ReactNode; compacta?: boolean; larguras?: string[] }) {
  const classesTabela = compacta ? "table-fixed [&_th]:!px-2 [&_th]:!py-2 [&_th]:!text-[11px] [&_th]:break-words [&_td]:!px-2 [&_td]:!py-2 [&_td]:!text-[11px] [&_td]:break-words" : "";
  return <div className={compacta ? "overflow-hidden" : "overflow-x-auto"}><table className={`w-full text-sm ${classesTabela}`}>
    {larguras && <colgroup>{larguras.map((largura, i) => <col key={i} style={{ width: largura }} />)}</colgroup>}
    <thead><tr className="bg-muted/40">{cabecalhos.map((c, i) => <th key={c} scope="col" className={`px-4 py-3 text-xs font-semibold text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>;
}
function Celula({ children, titulo, esquerda }: { children: ReactNode; titulo?: boolean; esquerda?: boolean }) {
  const classes = `px-4 py-3 align-top text-xs ${titulo || esquerda ? "text-left" : "text-right font-mono tabular-nums"}`;
  return titulo ? <th scope="row" className={`${classes} font-semibold`}>{children}</th> : <td className={classes}>{children}</td>;
}
function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 font-mono text-base font-semibold tabular-nums">{valor}</p></div>;
}
function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
function Nota({ titulo, children, alerta }: { titulo: string; children: ReactNode; alerta?: boolean }) {
  return <aside className={`rounded-xl border p-4 ${alerta ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20"}`}><h3 className="mb-2 text-sm font-semibold">{titulo}</h3><p className="text-xs leading-relaxed text-muted-foreground">{children}</p></aside>;
}
