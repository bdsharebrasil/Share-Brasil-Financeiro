import { useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { formatarData } from "@/lib/financeiro-share-api";
import type { DashboardCotista } from "@/lib/financeiro-share-api";
import {
  fmt,
  horas,
  money,
  montarBalanco,
  norm,
  projetarCustos,
  type DashboardBalanco,
} from "@/lib/balanco-cotista";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";

type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  mesesSelecionados: string[];
  cotistaId?: string;
};

type Aba = "balanco" | "lancamentos" | "custo-hora" | "diario";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "balanco", nome: "Balanço" },
  { id: "lancamentos", nome: "Lançamentos" },
  { id: "custo-hora", nome: "Custo por hora" },
  { id: "diario", nome: "Diário de bordo" },
];
const MESES_PROJECAO = [1, 2, 3, 5, 10, 15, 20, 30, 45];
const CORES = { fixos: "#2f6db5", variaveis: "#52794a", extras: "#e8b94a", naoClassificados: "#8291a4" };

export function FechamentoBalancoReferencia({
  dashboard,
  carregando,
  erro,
  cotistas,
  mesesSelecionados,
  cotistaId,
}: Props) {
  const [aba, setAba] = useState<Aba>("balanco");
  const [horasProjetadas, setHorasProjetadas] = useState(10);
  const [categoria, setCategoria] = useState("Todas");
  const [busca, setBusca] = useState("");

  const d = dashboard as DashboardBalanco | null;
  const b = useMemo(
    () => (d ? montarBalanco(d, cotistas, mesesSelecionados) : null),
    [d, cotistas, mesesSelecionados],
  );
  const participante = b?.participantes.find((item) => item.id === cotistaId);
  const total = participante?.custo ?? b?.total;
  const meses = participante?.mensal ?? b?.mensais ?? [];
  const totalHoras = participante?.horas ?? b?.totalHoras ?? null;
  const periodo = b?.meses.map(rotuloMesCotista).join(" · ") ?? "";
  const aeronave = b?.aeronave || "Aeronave selecionada";
  const lancamentosPorId = new Map((participante?.lancamentos ?? []).map((item) => [item.id, item]));
  const lancamentos = (d?.lancamentos ?? [])
    .filter((item) => lancamentosPorId.has(item.id) && norm(item.fluxo) === "SAIDA" && !["CANCELADO", "CANCELADA"].includes(norm(item.status)))
    .map((item) => ({ origem: item, parte: lancamentosPorId.get(item.id)! }))
    .sort((a, z) => a.parte.data.localeCompare(z.parte.data));
  const categorias = [...new Set(lancamentos.map(({ origem }) => origem.categoria || "Sem categoria"))].sort((a, z) => a.localeCompare(z, "pt-BR"));
  const lancamentosFiltrados = lancamentos.filter(({ origem, parte }) =>
    (categoria === "Todas" || (origem.categoria || "Sem categoria") === categoria)
    && `${origem.fornecedor ?? ""} ${origem.descricao}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const projecao = total && b && total.naoClassificados === 0
    ? projetarCustos(total, totalHoras, b.meses.length, horasProjetadas)
    : null;
  const serieProjecao = total && b && total.naoClassificados === 0
    ? Array.from({ length: 45 }, (_, index) => {
        const horasMes = index + 1;
        const ponto = projetarCustos(total, totalHoras, b.meses.length, horasMes);
        return ponto ? { horas: horasMes, ...ponto } : null;
      }).filter((item): item is { horas: number; fixoHora: number; variavelHora: number; extraHora: number; custoHora: number; custoMensal: number } => item !== null)
    : [];
  const voosOperacionais = d?.balanco_operacional?.voos ?? [];
  const voos = (participante?.voos ?? voosOperacionais.filter((voo) => b?.meses.includes(voo.data.slice(0, 7))))
    .slice()
    .sort((a, z) => a.data.localeCompare(z.data));
  const abastecimentos = (d?.balanco_operacional?.abastecimentos ?? [])
    .filter((item) => b?.meses.includes(item.data.slice(0, 7)));
  const litrosAbastecidos = abastecimentos.some((item) => item.litros === null)
    ? null
    : abastecimentos.reduce((soma, item) => soma + (item.litros ?? 0), 0);
  const tooltipEstilo = { background: "var(--fb-card)", color: "var(--fb-text)", border: "1px solid var(--fb-border)", borderRadius: 8, fontSize: 12 };

  if (carregando) return <div className="fb" role="status"><style>{CSS}</style><div className="fb-empty">Carregando fechamento…</div></div>;
  if (erro) return <div className="fb" role="alert"><style>{CSS}</style><div className="fb-empty">Não foi possível carregar o balanço: {erro}</div></div>;
  if (!d || !b || !total || !b.meses.length) return <div className="fb"><style>{CSS}</style><div className="fb-empty">Selecione a aeronave e os meses do fechamento.</div></div>;
  if (d.balanco_escopo && d.balanco_escopo !== "aeronave") return <div className="fb"><style>{CSS}</style><div className="fb-empty">O fechamento precisa dos dados consolidados da aeronave.</div></div>;

  const custoPorCategoria = b.categorias
    .map((item) => ({ nome: item.nome, valor: participante ? (item.cotistas.get(participante.id) ?? 0) : item.total }))
    .filter((item) => item.valor > 0)
    .sort((a, z) => z.valor - a.valor);
  const quota = participante?.quota;
  const proporcaoDoCusto = b.total.total > 0 ? (total.total / b.total.total) * 100 : null;
  const saldo = participante?.acerto?.saldoCentavos;
  const quantidadeVoos = participante ? voos.length : (b.totalVoos ?? voos.length);
  const pousos = voos.reduce((soma, voo) => soma + (voo.pousos ?? 0), 0);
  const custoMensalMedio = b.meses.length ? total.total / b.meses.length : 0;
  const custoFixos = total.fixos;
  const custoVariavel = total.variaveis;
  const custoExtra = total.extras;
  const custoNaoClassificado = total.naoClassificados;
  const seriesCusto = meses.map((mes) => ({ ...mes, nome: mes.nome }));

  return (
    <div className="fb">
      <style>{CSS}</style>
      <div className="fb-page-actions">
        <span>{aeronave} · {periodo}</span>
        <button type="button" className="fb-button" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
      </div>
      <nav className="fb-tabs" role="tablist" aria-label="Seções do fechamento">
        {ABAS.map((item) => <button
          type="button"
          role="tab"
          key={item.id}
          id={`fb-tab-${item.id}`}
          aria-selected={aba === item.id}
          aria-controls={`fb-panel-${item.id}`}
          onClick={() => setAba(item.id)}
        >{item.nome}</button>)}
      </nav>

      {aba === "balanco" && <section id="fb-panel-balanco" role="tabpanel" aria-labelledby="fb-tab-balanco">
        <div className="fb-hero">
          <div><small>Custo atribuído no período · {periodo}</small><div className="fb-big">{money(total.total)}</div></div>
          <div className="fb-hero-stats">
            <div>Cota contratual<strong>{quota == null ? "—" : fmt(quota, 1) + "%"}</strong></div>
            <div>Participação no custo<strong>{proporcaoDoCusto == null ? "—" : fmt(proporcaoDoCusto, 1) + "%"}</strong></div>
            <div>Saldo informado<strong>{saldo == null ? "—" : money(saldo)}</strong></div>
          </div>
        </div>
        <div className="fb-grid fb-g3">
          <Kpi titulo="Média mensal" valor={money(custoMensalMedio)} detalhe={`${b.meses.length} ${b.meses.length === 1 ? "mês" : "meses"} selecionados`} />
          <Kpi titulo="Horas voadas" valor={horas(totalHoras)} detalhe={`${quantidadeVoos} voos · ${fmt(participante ? pousos : b.totalPousos ?? pousos, 0)} pousos`} />
          <Kpi titulo="Lançamentos" valor={fmt(lancamentos.length, 0)} detalhe="Despesas atribuídas ao cotista no período" />
        </div>
        <div className="fb-grid fb-g2">
          <section className="fb-card"><h2>Gastos por categoria</h2>
            {custoPorCategoria.length ? <div className="fb-scroll"><table>
              <thead><tr><th>Categoria</th><th className="fb-num">Valor atribuído</th><th className="fb-num">%</th><th aria-label="Participação"></th></tr></thead>
              <tbody>{custoPorCategoria.map((item) => <tr key={item.nome}>
                <td>{item.nome}</td><td className="fb-num">{money(item.valor)}</td>
                <td className="fb-num">{fmt(total.total ? item.valor / total.total * 100 : 0, 1)}%</td>
                <td><div className="fb-bar"><i style={{ width: `${Math.min(100, total.total ? item.valor / total.total * 100 : 0)}%` }} /></div></td>
              </tr>)}</tbody>
              <tfoot><tr><td>Total geral</td><td className="fb-num">{money(total.total)}</td><td className="fb-num">100%</td><td /></tr></tfoot>
            </table></div> : <Vazio>Não há despesas classificadas no período.</Vazio>}
          </section>
          <section className="fb-card"><h2>Custo mensal</h2>
            <div className="fb-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={seriesCusto} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--fb-muted)" }} />
              <YAxis tickFormatter={(value) => fmt(value / 100, 0)} width={58} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} />
              <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipEstilo} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fixos" name="Fixos" stackId="custo" fill={CORES.fixos} isAnimationActive={false} />
              <Bar dataKey="variaveis" name="Variáveis" stackId="custo" fill={CORES.variaveis} isAnimationActive={false} />
              <Bar dataKey="extras" name="Extras" stackId="custo" fill={CORES.extras} isAnimationActive={false} />
              <Bar dataKey="naoClassificados" name="Não classificados" stackId="custo" fill={CORES.naoClassificados} isAnimationActive={false} />
            </BarChart></ResponsiveContainer></div>
            <div className="fb-legend">
              <span><i style={{ background: CORES.fixos }} />Fixos {money(custoFixos)}</span>
              <span><i style={{ background: CORES.variaveis }} />Variáveis {money(custoVariavel)}</span>
              <span><i style={{ background: CORES.extras }} />Extras {money(custoExtra)}</span>
              {custoNaoClassificado > 0 && <span><i style={{ background: CORES.naoClassificados }} />Não classificados {money(custoNaoClassificado)}</span>}
            </div>
          </section>
        </div>
        <section className="fb-card fb-spaced"><h2>Resumo mês a mês</h2><div className="fb-scroll"><table>
          <thead><tr><th>Mês</th><th className="fb-num">Fixos</th><th className="fb-num">Variáveis</th><th className="fb-num">Extras</th><th className="fb-num">Não classificados</th><th className="fb-num">Total</th></tr></thead>
          <tbody>{meses.map((mes) => <tr key={mes.mes}><td>{mes.nome}</td><td className="fb-num">{money(mes.fixos)}</td><td className="fb-num">{money(mes.variaveis)}</td><td className="fb-num">{money(mes.extras)}</td><td className="fb-num">{money(mes.naoClassificados)}</td><td className="fb-num"><b>{money(mes.total)}</b></td></tr>)}</tbody>
          <tfoot><tr><td>Total</td><td className="fb-num">{money(total.fixos)}</td><td className="fb-num">{money(total.variaveis)}</td><td className="fb-num">{money(total.extras)}</td><td className="fb-num">{money(total.naoClassificados)}</td><td className="fb-num">{money(total.total)}</td></tr></tfoot>
        </table></div></section>
        <p className="fb-note">Os valores são calculados com os lançamentos e rateios disponíveis para o período selecionado. “Saldo informado” reflete os dados de acerto retornados pelo sistema; não representa uma nova cobrança.</p>
      </section>}

      {aba === "lancamentos" && <section id="fb-panel-lancamentos" role="tabpanel" aria-labelledby="fb-tab-lancamentos">
        <div className="fb-tools">
          <select value={categoria} onChange={(event) => setCategoria(event.target.value)} aria-label="Filtrar por categoria"><option>Todas</option>{categorias.map((item) => <option key={item}>{item}</option>)}</select>
          <input type="search" placeholder="Buscar fornecedor ou descrição" value={busca} onChange={(event) => setBusca(event.target.value)} aria-label="Buscar lançamentos" />
        </div>
        <section className="fb-card"><div className="fb-scroll"><table>
          <thead><tr><th>Data</th><th>Documento</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Pago por</th><th className="fb-num">Valor atribuído</th></tr></thead>
          <tbody>{lancamentosFiltrados.map(({ origem, parte }) => <tr key={origem.id}>
            <td>{formatarData(parte.data)}</td><td>{origem.numeroDemonstrativo || origem.documentoNumero || origem.numeroNf || origem.numeroRecibo || origem.documento || "—"}</td>
            <td>{origem.fornecedor || "—"}</td><td>{origem.descricao || "—"}</td><td>{origem.categoria || "Sem categoria"}</td>
            <td><span className="fb-tag">{origem.tipoRateio || origem.grupoCategoria || origem.tipo || "Não classificado"}</span></td>
            <td>{origem.pagoPor || "—"}</td><td className="fb-num">{money(parte.suaParteCentavos)}</td>
          </tr>)}</tbody>
          <tfoot><tr><td colSpan={7}>{lancamentosFiltrados.length} lançamentos · valor atribuído</td><td className="fb-num">{money(lancamentosFiltrados.reduce((soma, item) => soma + item.parte.suaParteCentavos, 0))}</td></tr></tfoot>
        </table></div>
          {!lancamentosFiltrados.length && <Vazio>Nenhum lançamento encontrado com esses filtros.</Vazio>}
        </section>
      </section>}

      {aba === "custo-hora" && <section id="fb-panel-custo-hora" role="tabpanel" aria-labelledby="fb-tab-custo-hora">
        <div className="fb-grid fb-g3 fb-no-top">
          <Kpi titulo={`Custo por hora com ${horasProjetadas} h/mês`} valor={projecao ? money(projecao.custoHora) : "—"} detalhe="Cenário calculado a partir do histórico selecionado" />
          <Kpi titulo="Parte fixa por hora" valor={projecao ? money(projecao.fixoHora) : "—"} />
          <Kpi titulo="Variável + extras por hora" valor={projecao ? money(projecao.variavelHora + projecao.extraHora) : "—"} />
        </div>
        <section className="fb-card fb-spaced"><h2>Quanto mais voa, menor o custo da hora</h2>
          <label className="fb-range-label" htmlFor="fb-horas">Horas voadas no mês: <b>{horasProjetadas}</b></label>
          <input className="fb-range" id="fb-horas" type="range" min="1" max="45" value={horasProjetadas} onChange={(event) => setHorasProjetadas(Number(event.target.value))} disabled={!projecao} />
          {projecao ? <div className="fb-chart fb-chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={serieProjecao} margin={{ top: 14, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="horas" tickFormatter={(value) => String(value)} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} label={{ value: "horas voadas por mês", position: "insideBottom", offset: -4, fontSize: 10, fill: "var(--fb-muted)" }} />
            <YAxis tickFormatter={(value) => fmt(value / 100, 0)} width={62} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} />
            <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(value) => `${value} horas/mês`} contentStyle={tooltipEstilo} />
            <Line dataKey="custoHora" name="Custo por hora" stroke="#e8b94a" strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer></div> : <Vazio>A projeção exige custos classificados, horas registradas e meses selecionados.</Vazio>}
        </section>
        {projecao && <section className="fb-card fb-spaced"><h2>Tabela de projeção</h2><div className="fb-scroll"><table>
          <thead><tr><th>H. voadas</th><th className="fb-num">Custo fixo</th><th className="fb-num">Custo variável</th><th className="fb-num">Custo extra</th><th className="fb-num">Custo por hora</th><th className="fb-num">Custo mensal</th></tr></thead>
          <tbody>{MESES_PROJECAO.map((h) => {
            const item = projetarCustos(total, totalHoras, b.meses.length, h);
            return item && <tr key={h} className={h === horasProjetadas ? "fb-highlight" : undefined}>
              <td>{h}</td><td className="fb-num">{money(item.fixoHora)}</td><td className="fb-num">{money(item.variavelHora)}</td><td className="fb-num">{money(item.extraHora)}</td><td className="fb-num"><b>{money(item.custoHora)}</b></td><td className="fb-num">{money(item.custoMensal)}</td>
            </tr>;
          })}</tbody>
        </table></div><p className="fb-note">Projeção estimada com custos fixos médios por mês e custos variáveis e extras proporcionais às horas registradas no período. Não é previsão de manutenção nem compromisso de custo.</p></section>}
      </section>}

      {aba === "diario" && <section id="fb-panel-diario" role="tabpanel" aria-labelledby="fb-tab-diario">
        <section className="fb-card"><h2>Diário de bordo · {aeronave}</h2>
          {b.fonteVoos ? <><div className="fb-scroll"><table>
            <thead><tr><th>Data</th><th>Voo</th><th>De</th><th>Para</th><th className="fb-num">Tempo</th><th className="fb-num">Pousos</th><th>Natureza</th><th>Cotista</th></tr></thead>
            <tbody>{voos.map((voo) => <tr key={voo.id}><td>{formatarData(voo.data)}</td><td>{voo.numero || "—"}</td><td>{voo.origem || "—"}</td><td>{voo.destino || "—"}</td><td className="fb-num">{horas(voo.horas)}</td><td className="fb-num">{voo.pousos == null ? "—" : fmt(voo.pousos, 0)}</td><td>{voo.natureza || "—"}{voo.emprestado ? " · empréstimo" : ""}</td><td>{participante?.nome || "Aeronave"}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={4}>Total · abastecido na aeronave {litrosAbastecidos == null ? "—" : `${fmt(litrosAbastecidos, 1)} L`}</td><td className="fb-num">{horas(totalHoras)}</td><td className="fb-num">{participante ? fmt(pousos, 0) : fmt(b.totalPousos, 0)}</td><td colSpan={2}>{voos.length} voos</td></tr></tfoot>
          </table></div>{!voos.length && <Vazio>Nenhum voo registrado no período selecionado.</Vazio>}</>
            : <Vazio>O diário de bordo não está disponível para esta consulta.</Vazio>}
        </section>
      </section>}
    </div>
  );
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return <div className="fb-kpi"><span>{titulo}</span><strong>{valor}</strong>{detalhe && <small>{detalhe}</small>}</div>;
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="fb-empty">{children}</div>;
}

const CSS = `
.fb{--fb-bg:#f3f5f8;--fb-card:#fff;--fb-text:#14202e;--fb-muted:#5d6b7b;--fb-border:#e0e6ed;--fb-navy:#0f3d6e;--fb-blue:#2f6db5;--fb-soft:#eef3f9;max-width:1040px;margin:0 auto;padding:20px 0 42px;color:var(--fb-text);font:14px/1.5 "Segoe UI",system-ui,-apple-system,Roboto,sans-serif;color-scheme:light}
.fb *{box-sizing:border-box}.fb button,.fb input,.fb select{font:inherit;color:inherit}.fb button{cursor:pointer}.fb :is(button,input,select):focus-visible{outline:2px solid var(--fb-blue);outline-offset:2px}.fb-page-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:var(--fb-muted);font-size:12px}.fb-button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--fb-border);border-radius:6px;background:var(--fb-card);padding:7px 10px}.fb-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--fb-border);margin-bottom:18px}.fb-tabs button{flex-shrink:0;white-space:nowrap;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--fb-muted);padding:10px 14px}.fb-tabs button[aria-selected=true]{border-bottom-color:#e8b94a;color:var(--fb-text);font-weight:650}
.fb-hero{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:24px;background:var(--fb-navy);color:#fff;border-radius:10px;padding:22px 24px}.fb-hero small{font-size:13px;opacity:.8}.fb-big{font-size:clamp(28px,5vw,38px);font-weight:700;letter-spacing:-.02em;line-height:1.2;font-variant-numeric:tabular-nums}.fb-hero-stats{display:flex;gap:26px;flex-wrap:wrap}.fb-hero-stats div{font-size:12px;opacity:.95}.fb-hero-stats strong{display:block;font-size:16px}.fb-grid{display:grid;gap:14px;margin-top:14px}.fb-g3{grid-template-columns:repeat(3,minmax(0,1fr))}.fb-g2{grid-template-columns:repeat(2,minmax(0,1fr))}.fb-no-top{margin-top:0}.fb-kpi,.fb-card{background:var(--fb-card);border:1px solid var(--fb-border);border-radius:8px}.fb-kpi{padding:15px 17px;min-width:0}.fb-kpi>span{display:block;color:var(--fb-muted);font-size:12px}.fb-kpi>strong{display:block;margin:6px 0;font-size:21px;font-weight:650;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.fb-kpi>small{display:block;color:var(--fb-muted);font-size:11px}.fb-card{min-width:0;padding:16px 18px}.fb-card h2{margin:0 0 12px;font-size:15px;font-weight:650}.fb-spaced{margin-top:14px}.fb-scroll{width:100%;overflow-x:auto}.fb table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}.fb th,.fb td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--fb-border);vertical-align:top}.fb th{color:var(--fb-muted);font-size:11px;font-weight:600}.fb .fb-num{text-align:right;white-space:nowrap}.fb tfoot td{font-weight:700;border-bottom:0;background:var(--fb-soft)}.fb .fb-bar{height:8px;min-width:80px;border-radius:4px;background:var(--fb-soft);overflow:hidden}.fb .fb-bar i{display:block;height:100%;border-radius:4px;background:var(--fb-blue)}.fb-chart{height:240px;width:100%;min-width:0}.fb-chart-tall{height:280px}.fb-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;color:var(--fb-muted);font-size:11px}.fb-legend span{white-space:nowrap}.fb-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}.fb-note{margin:16px 0 0;color:var(--fb-muted);font-size:11px;line-height:1.65}.fb-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.fb-tools select,.fb-tools input{min-width:210px;border:1px solid var(--fb-border);border-radius:6px;background:var(--fb-card);padding:7px 10px}.fb-tag{display:inline-block;border-radius:10px;background:var(--fb-soft);padding:1px 8px;font-size:11px}.fb-range-label{display:block;color:var(--fb-muted);font-size:12px}.fb-range{width:100%;accent-color:var(--fb-blue)}.fb-highlight{background:var(--fb-soft)}.fb-empty{padding:24px 12px;text-align:center;color:var(--fb-muted)}
@media(prefers-color-scheme:dark){.fb{--fb-bg:#0d141c;--fb-card:#152130;--fb-text:#e8eef5;--fb-muted:#93a3b5;--fb-border:#25364a;--fb-navy:#10325a;--fb-blue:#4f8fd6;--fb-soft:#1b2b3f;color-scheme:dark}}
:root[data-theme="dark"] .fb{--fb-bg:#0d141c;--fb-card:#152130;--fb-text:#e8eef5;--fb-muted:#93a3b5;--fb-border:#25364a;--fb-navy:#10325a;--fb-blue:#4f8fd6;--fb-soft:#1b2b3f;color-scheme:dark}
.dark .fb{--fb-bg:#0d141c;--fb-card:#152130;--fb-text:#e8eef5;--fb-muted:#93a3b5;--fb-border:#25364a;--fb-navy:#10325a;--fb-blue:#4f8fd6;--fb-soft:#1b2b3f;color-scheme:dark}
@media(max-width:780px){.fb-g3{grid-template-columns:repeat(2,minmax(0,1fr))}.fb-g2{grid-template-columns:1fr}.fb{padding:14px 0 30px}.fb-hero{padding:18px}.fb-hero-stats{gap:16px}.fb-card{padding:14px}}
@media(max-width:480px){.fb-g3{grid-template-columns:1fr 1fr}.fb-kpi{padding:12px}.fb-kpi>strong{font-size:17px}.fb-tabs button{padding:10px}.fb-page-actions{align-items:flex-start;flex-direction:column}.fb-tools{flex-direction:column}.fb-tools select,.fb-tools input{width:100%;min-width:0}}
@media print{.fb{--fb-bg:#fff;--fb-card:#fff;--fb-text:#14202e;--fb-muted:#5d6b7b;--fb-border:#d9dfe5;--fb-navy:#0f3d6e;background:#fff;max-width:none;padding:0}.fb-tabs,.fb-page-actions button,.fb-tools,.fb-range{display:none}.fb-card,.fb-kpi{break-inside:avoid}.fb-scroll{overflow:visible}.fb table{font-size:9px}.fb th,.fb td{padding:5px}.fb-chart{height:190px}}
`;
