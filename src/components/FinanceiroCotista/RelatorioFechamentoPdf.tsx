import { Document, Line, Page, Path, Rect, Svg, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import type { LancamentoEconomico } from "@/lib/financeiro-share-api";
import { documentoDoLancamento, nomeFornecedorLancamento, nomePagadoresDoLancamento, rateioDoCotista, tipoRateioLancamento, valorPagoLancamento, type OpcaoFornecedorLancamento } from "@/lib/financeiro-cotista-lancamentos";
import { fmt, horas, money, norm, projetarCustos, type Balanco, type DashboardBalanco, type ParticipanteBalanco } from "@/lib/balanco-cotista";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";

const C = { navy: "#12365a", navy2: "#1c4b77", gold: "#d9ad59", ink: "#192b3d", muted: "#627386", line: "#dce4ec", soft: "#f2f6fa", blue: "#3475ae", green: "#4e8761", amber: "#d7a848", slate: "#8392a2", white: "#ffffff" };
const STYLE = StyleSheet.create({
  page: { padding: 34, paddingBottom: 55, fontFamily: "Helvetica", fontSize: 9, color: C.ink, backgroundColor: C.white },
  cover: { padding: 42, paddingBottom: 50, backgroundColor: C.navy, color: C.white, justifyContent: "space-between" },
  brand: { fontSize: 10, letterSpacing: 2.2, color: "#c4d7e8", fontFamily: "Helvetica-Bold" },
  coverLabel: { color: C.gold, fontSize: 9, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 12 },
  coverTitle: { fontSize: 31, lineHeight: 1.12, fontFamily: "Helvetica-Bold", maxWidth: 430 },
  coverRule: { width: 58, height: 3, backgroundColor: C.gold, marginTop: 22, marginBottom: 20 },
  coverAircraft: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverPeriod: { fontSize: 12, color: "#d4e1ed" },
  coverBottom: { borderTopWidth: 1, borderTopColor: "#49647f", paddingTop: 14, color: "#c4d7e8", fontSize: 8, lineHeight: 1.5 },
  sectionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8, marginBottom: 16 },
  sectionName: { color: C.navy, fontSize: 8, letterSpacing: 1.4, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  period: { color: C.muted, fontSize: 8 },
  title: { color: C.navy, fontSize: 21, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  subtitle: { color: C.muted, fontSize: 9, marginBottom: 14 },
  band: { backgroundColor: C.navy, color: C.white, padding: 16, borderRadius: 6, marginBottom: 13 },
  bandEyebrow: { fontSize: 8, color: "#c4d7e8", letterSpacing: 1, marginBottom: 5 },
  bandValue: { fontSize: 25, fontFamily: "Helvetica-Bold" },
  bandCaption: { fontSize: 8, color: "#d4e1ed", marginTop: 4 },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 13 },
  kpi: { flex: 1, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 6, backgroundColor: C.soft },
  kpiLabel: { color: C.muted, fontSize: 7.5 },
  kpiValue: { color: C.ink, fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sectionTitle: { color: C.navy, fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 7 },
  paragraph: { color: C.muted, fontSize: 8, lineHeight: 1.45, marginBottom: 5 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 11, marginBottom: 10 },
  cardTitle: { color: C.navy, fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5 },
  headRow: { flexDirection: "row", alignItems: "stretch", backgroundColor: C.soft, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 },
  cell: { fontSize: 7.2, color: C.ink, paddingHorizontal: 3, lineHeight: 1.25 },
  headCell: { fontSize: 7, color: C.muted, fontFamily: "Helvetica-Bold", paddingHorizontal: 3, lineHeight: 1.25 },
  totalRow: { flexDirection: "row", backgroundColor: C.soft, paddingVertical: 6, marginTop: 2 },
  foot: { position: "absolute", left: 34, right: 34, bottom: 22, borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 7 },
  note: { backgroundColor: C.soft, borderLeftWidth: 3, borderLeftColor: C.gold, padding: 9, marginTop: 8, color: C.muted, fontSize: 8, lineHeight: 1.45 },
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 7, marginBottom: 5 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4, fontSize: 7, color: C.muted },
  dot: { width: 7, height: 7, borderRadius: 4 },
  barTrack: { height: 7, backgroundColor: C.soft, borderRadius: 4, marginTop: 5, marginBottom: 6, overflow: "hidden" },
  footerSpace: { height: 2 },
});

const GROUPS = [
  { key: "fixos", label: "Fixos", color: C.blue },
  { key: "variaveis", label: "Variáveis", color: C.green },
  { key: "extras", label: "Extras", color: C.amber },
  { key: "naoClassificados", label: "Não classificados", color: C.slate },
] as const;
type GroupKey = typeof GROUPS[number]["key"];

type Props = {
  balanco: Balanco;
  dashboard: DashboardBalanco;
  participantes: ParticipanteBalanco[];
  aeronave: string;
  cotistas: CotistaAeronave[];
  fornecedores: OpcaoFornecedorLancamento[];
  horasProjetadas: number;
};

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <View style={STYLE.kpi}><Text style={STYLE.kpiLabel}>{label}</Text><Text style={STYLE.kpiValue}>{value}</Text>{detail ? <Text style={[STYLE.paragraph, { marginTop: 3, marginBottom: 0 }]}>{detail}</Text> : null}</View>;
}

function Table({ headers, rows, widths, total }: { headers: string[]; rows: string[][]; widths?: number[]; total?: string[] }) {
  const flex = widths ?? headers.map(() => 1);
  const renderRow = (cells: string[], header = false, isTotal = false, key?: string | number) => (
    <View key={key} style={isTotal ? STYLE.totalRow : header ? STYLE.headRow : STYLE.row} wrap={false}>
      {headers.map((_, index) => <Text key={index} style={[header ? STYLE.headCell : STYLE.cell, { flex: flex[index] ?? 1, textAlign: index > 0 ? "right" : "left" }]}>{cells[index] ?? "—"}</Text>)}
    </View>
  );
  return <View><View fixed>{renderRow(headers, true)}</View>{rows.length ? rows.map((row, index) => renderRow(row, false, false, index)) : <Text style={STYLE.paragraph}>Não há registros para o período selecionado.</Text>}{total ? renderRow(total, false, true, "total") : null}</View>;
}

function PageFooter({ aeronave, participante }: { aeronave: string; participante?: string }) {
  return <View style={STYLE.foot} fixed><Text>SHARE BRASIL  ·  {aeronave}{participante ? `  ·  ${participante}` : ""}</Text><Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} /></View>;
}

function CategoryBars({ participante }: { participante: ParticipanteBalanco }) {
  const total = participante.custo.total;
  const groups = GROUPS.map((group) => ({ ...group, value: participante.custo[group.key] })).filter((group) => group.value > 0);
  return <View>
    <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 7 }}>
      {groups.map((group) => <View key={group.key} style={{ width: `${total > 0 ? group.value / total * 100 : 0}%`, backgroundColor: group.color }} />)}
    </View>
    <View style={STYLE.legend}>{groups.map((group) => <View key={group.key} style={STYLE.legendItem}><View style={[STYLE.dot, { backgroundColor: group.color }]} /><Text>{group.label}: {money(group.value)} ({fmt(total ? group.value / total * 100 : 0, 1)}%)</Text></View>)}</View>
  </View>;
}

function MonthlyChart({ participante }: { participante: ParticipanteBalanco }) {
  const monthly = participante.mensal;
  const width = 510;
  const height = 92;
  const slot = width / Math.max(monthly.length, 1);
  const barWidth = Math.min(slot * 0.56, 42);
  const max = Math.max(...monthly.map((item) => item.total), 1);
  return <View>
    <Svg width={width} height={height}>
      <Line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={C.line} strokeWidth={1} />
      {monthly.map((month, index) => {
        let y = height - 1;
        return GROUPS.map((group) => {
          const part = (month[group.key] / max) * (height - 12);
          y -= part;
          return part > 0 ? <Rect key={`${month.mes}-${group.key}`} x={index * slot + (slot - barWidth) / 2} y={y} width={barWidth} height={part} fill={group.color} /> : null;
        });
      })}
    </Svg>
    <View style={{ flexDirection: "row" }}>{monthly.map((month) => <Text key={month.mes} style={{ flex: 1, textAlign: "center", fontSize: 6.5, color: C.muted, marginTop: 3 }}>{month.nome}</Text>)}</View>
  </View>;
}

function ProjectionChart({ participante, meses, horasProjetadas }: { participante: ParticipanteBalanco; meses: number; horasProjetadas: number }) {
  if (participante.custo.naoClassificados > 0 || participante.horas == null || participante.horas <= 0) return <Text style={STYLE.paragraph}>A projeção não está disponível para este cotista porque faltam horas voadas ou existem custos não classificados.</Text>;
  const data = Array.from({ length: 45 }, (_, index) => projetarCustos(participante.custo, participante.horas, meses, index + 1)).filter((item) => item !== null);
  const values = data.map((item) => item.custoHora);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values.map((value, index) => {
    const x = 6 + index * (498 / Math.max(values.length - 1, 1));
    const y = 78 - ((value - min) / Math.max(max - min, 1)) * 62;
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const current = data[Math.max(0, Math.min(data.length - 1, horasProjetadas - 1))]?.custoHora;
  return <View>
    <Svg width={510} height={88}><Line x1="6" y1="78" x2="504" y2="78" stroke={C.line} strokeWidth={1} /><Path d={path} fill="none" stroke={C.blue} strokeWidth={2.5} /></Svg>
    <Text style={STYLE.paragraph}>Custo por hora estimado para {horasProjetadas} h/mês: {money(current)}. Cenário calculado a partir dos custos classificados do período.</Text>
  </View>;
}

function SectionHeading({ section, period }: { section: string; period: string }) {
  return <View style={STYLE.sectionTop}><Text style={STYLE.sectionName}>{section}</Text><Text style={STYLE.period}>{period}</Text></View>;
}

function participantLaunchRows(participant: ParticipanteBalanco, balanco: Balanco, dashboard: DashboardBalanco, cotistas: CotistaAeronave[], fornecedores: OpcaoFornecedorLancamento[]) {
  const cotista = cotistas.find((item) => [item.id, item.cliente_id, item.socio_id, ...(item.cotista_ids ?? [])].includes(participant.id))
    ?? cotistas.find((item) => item.nome.trim().toLocaleLowerCase("pt-BR") === participant.nome.trim().toLocaleLowerCase("pt-BR"));
  const originals = new Map((dashboard.lancamentos ?? []).map((item) => [String(item.id), item]));
  const fallback = new Map(participant.lancamentos.map((line) => [line.id, line]));
  let totalParte = 0;
  let totalBruto = 0;
  const rows = (dashboard.lancamentos ?? [])
    .filter((item) => balanco.meses.includes((item.dataEmissao || item.data).slice(0, 7)) && norm(item.fluxo) === "SAIDA" && !["CANCELADO", "CANCELADA"].includes(norm(item.status)))
    .flatMap((item) => {
      const original = originals.get(String(item.id)) as LancamentoEconomico | undefined;
      const line = fallback.get(String(item.id));
      const rateio = cotista && original ? rateioDoCotista(original, cotista, cotistas) : null;
      if (!rateio && !line) return [];
      const parteCentavos = rateio?.valorCentavos ?? line?.suaParteCentavos ?? 0;
      totalParte += parteCentavos;
      totalBruto += original ? valorPagoLancamento(original) : line?.totalCentavos ?? 0;
      return [[
        (item.dataEmissao || item.data).slice(0, 10).split("-").reverse().join("/"),
        original ? documentoDoLancamento(original) || "—" : "—",
        item.descricao || "—",
        original ? nomeFornecedorLancamento(original, fornecedores) || line?.fornecedor || "—" : line?.fornecedor || "—",
        item.categoria || "Sem categoria",
        original ? tipoRateioLancamento(original) : "—",
        original ? nomePagadoresDoLancamento(original, cotistas) : "—",
        money(original ? valorPagoLancamento(original) : line?.totalCentavos),
        money(parteCentavos),
      ]];
    });
  return {
    rows,
    totalParte,
    totalBruto,
  };
}

function monthlyRows(participante: ParticipanteBalanco) {
  return participante.mensal.map((month) => [month.nome, money(month.fixos), money(month.variaveis), money(month.extras), money(month.naoClassificados), money(month.total), horas(month.horas), money(month.custoHora)]);
}

function reportTitle(period: string) {
  return period.includes(" · ") ? `${period.split(" · ").length} meses selecionados` : period;
}

export function RelatorioFechamentoPdf({ balanco, dashboard, participantes, aeronave, cotistas, fornecedores, horasProjetadas }: Props) {
  const periodo = balanco.meses.map(rotuloMesCotista).join(" · ");
  const periodoCurto = reportTitle(periodo);
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());
  const lancamentosDoPeriodo = (dashboard.lancamentos ?? []).filter((item) => balanco.meses.includes((item.dataEmissao || item.data || "").slice(0, 7)) && norm(item.fluxo) === "SAIDA" && !["CANCELADO", "CANCELADA"].includes(norm(item.status)));

  return <Document title={`Fechamento financeiro · ${aeronave} · ${periodo}`} author="Share Brasil" subject="Relatório completo do fechamento financeiro por cotista">
    <Page size="A4" style={STYLE.cover}>
      <View><Text style={STYLE.brand}>SHARE BRASIL</Text><View style={{ height: 1, backgroundColor: "#49647f", marginTop: 14 }} /></View>
      <View>
        <Text style={STYLE.coverLabel}>Relatório financeiro · fechamento completo</Text>
        <Text style={STYLE.coverTitle}>Balanço financeiro</Text>
        <View style={STYLE.coverRule} />
        <Text style={STYLE.coverAircraft}>{aeronave}</Text>
        <Text style={STYLE.coverPeriod}>{periodo}</Text>
      </View>
      <View style={STYLE.coverBottom}>
        <Text>Cotistas incluídos: {participantes.map((item) => item.nome).join(" · ") || "Nenhum cotista selecionado"}</Text>
        <Text style={{ marginTop: 4 }}>Gerado em {geradoEm} · Dados do período selecionado no fechamento</Text>
      </View>
    </Page>

    {participantes.map((participante) => {
      const launchReport = participantLaunchRows(participante, balanco, dashboard, cotistas, fornecedores);
      const launchRows = launchReport.rows;
      const totalParte = launchReport.totalParte;
      const vooRows = participante.voos.map((voo) => [
        voo.data ? voo.data.slice(0, 10).split("-").reverse().join("/") : "—",
        voo.numero || (voo.numeroSequencial == null ? "—" : String(voo.numeroSequencial)),
        voo.trecho || `${voo.origem || "—"} × ${voo.destino || "—"}`,
        voo.tempoDep?.slice(0, 5) || "—",
        voo.tempoPou?.slice(0, 5) || "—",
        horas(voo.horas),
        fmt(voo.pousos, 0),
        voo.natureza || (voo.emprestado ? "Voo emprestado" : "Operação da aeronave"),
      ]);
      const compensacoes = balanco.compensacoes.filter((item) => item.credorId === participante.id || item.devedorId === participante.id);
      const custoCategorias = GROUPS.map((group) => [group.label, money(participante.custo[group.key]), `${fmt(participante.custo.total ? participante.custo[group.key] / participante.custo.total * 100 : 0, 1)}%`]);
      const projecaoRows = [1, 2, 3, 5, 10, 15, 20, 30, 45].flatMap((hours) => {
        const estimate = participante.custo.naoClassificados === 0 && participante.horas != null ? projetarCustos(participante.custo, participante.horas, balanco.meses.length, hours) : null;
        return estimate ? [[`${hours} h`, money(estimate.fixoHora), money(estimate.variavelHora), money(estimate.extraHora), money(estimate.custoHora), money(estimate.custoMensal)]] : [];
      });
      const mesesCotista = participante.mensal;
      const todosMesesCotista = mesesCotista.reduce((sum, month) => sum + month.total, 0);

      return [
        <Page key={`${participante.id}-balanco`} size="A4" style={STYLE.page}>
          <SectionHeading section="01 · Balanço" period={periodoCurto} />
          <Text style={STYLE.title}>{participante.nome}</Text>
          <Text style={STYLE.subtitle}>{participante.holding ? "Sócio de holding" : "Cotista"} · {aeronave} · Cota contratual {participante.quota == null ? "não informada" : `${fmt(participante.quota, 1)}%`}</Text>
          <View style={STYLE.band}><Text style={STYLE.bandEyebrow}>CUSTO ATRIBUÍDO NO PERÍODO</Text><Text style={STYLE.bandValue}>{money(participante.custo.total)}</Text><Text style={STYLE.bandCaption}>{periodo}</Text></View>
          <View style={STYLE.kpis}>
            <Kpi label="Média mensal" value={money(balanco.meses.length ? participante.custo.total / balanco.meses.length : 0)} detail={`${balanco.meses.length} mês(es)`} />
            <Kpi label="Horas voadas" value={horas(participante.horas)} detail={`${participante.voos.length} voo(s)`} />
            <Kpi label="Custo por hora" value={money(participante.custoHora)} detail="Com base nas horas registradas" />
          </View>
          <Text style={STYLE.sectionTitle}>Composição do custo</Text>
          <View style={STYLE.card}><CategoryBars participante={participante} /><Table headers={["Grupo", "Valor", "% do total"]} widths={[2, 1, 1]} rows={custoCategorias} total={["Total atribuído", money(participante.custo.total), "100%"]} /></View>
          <Text style={STYLE.sectionTitle}>Resumo mês a mês</Text>
          <View style={STYLE.card}><MonthlyChart participante={participante} /><Table headers={["Mês", "Fixos", "Variáveis", "Extras", "Não classif.", "Total", "Horas", "Custo/h"]} widths={[1.2, 1, 1, 1, 1, 1, .75, 1]} rows={monthlyRows(participante)} total={["Total", money(participante.custo.fixos), money(participante.custo.variaveis), money(participante.custo.extras), money(participante.custo.naoClassificados), money(todosMesesCotista), horas(participante.horas), money(participante.custoHora)]} /></View>
          <Text style={STYLE.sectionTitle}>Acerto de contas</Text>
          <View style={STYLE.card}>
            <Table headers={["Pagamento informado", "Devido acumulado", "Saldo informado"]} widths={[1, 1, 1]} rows={[[money(participante.acerto?.pagoCentavos), money(participante.acerto?.devidoCentavos), money(participante.acerto?.saldoCentavos)]]} />
            <Text style={[STYLE.paragraph, { marginTop: 6 }]}>A posição reflete os dados de acerto recebidos pelo sistema. Compensações sugeridas não confirmam a realização de uma transferência.</Text>
            {compensacoes.length ? <Table headers={["Devedor", "Credor", "Valor"]} widths={[1.2, 1.2, 1]} rows={compensacoes.map((item) => [item.devedor, item.credor, money(item.valorCentavos)])} /> : null}
          </View>
          <PageFooter aeronave={aeronave} participante={participante.nome} />
        </Page>,

        <Page key={`${participante.id}-lancamentos`} size="A4" orientation="landscape" style={STYLE.page}>
          <SectionHeading section="02 · Lançamentos" period={periodoCurto} />
          <Text style={STYLE.title}>Despesas atribuídas a {participante.nome}</Text>
          <Text style={STYLE.subtitle}>{lancamentosDoPeriodo.length} lançamento(s) da aeronave · {launchRows.length} com valor atribuído ao cotista</Text>
          <View style={STYLE.card}>
            <Table headers={["Emissão", "Documento", "Descrição", "Fornecedor", "Categoria", "Tipo de rateio", "Pago por", "Valor pago", "Parte do cotista"]}
              widths={[.8, .9, 1.5, 1.15, 1.05, 1.1, .9, .85, .95]} rows={launchRows}
              total={["", "", "", "", "", "", "Total atribuído", money(launchReport.totalBruto), money(totalParte)]} />
          </View>
          <Text style={STYLE.note}>Os valores da coluna “Parte do cotista” seguem os rateios registrados. O valor pago é informado separadamente e não substitui o valor rateado.</Text>
          <PageFooter aeronave={aeronave} participante={participante.nome} />
        </Page>,

        <Page key={`${participante.id}-custo-hora`} size="A4" style={STYLE.page}>
          <SectionHeading section="03 · Custo por hora" period={periodoCurto} />
          <Text style={STYLE.title}>Utilização e projeção</Text>
          <Text style={STYLE.subtitle}>{participante.nome} · valores calculados para o período selecionado</Text>
          <View style={STYLE.kpis}>
            <Kpi label="Custo/hora do cotista" value={money(participante.custoHora)} detail={`${horas(participante.horas)} registradas`} />
            <Kpi label="Custo/hora da aeronave" value={money(balanco.custoHora)} detail={`${horas(balanco.totalHoras)} totais`} />
            <Kpi label="Cota contratual" value={participante.quota == null ? "—" : `${fmt(participante.quota, 1)}%`} detail="Participação societária atual" />
          </View>
          <View style={STYLE.card}>
            <Text style={STYLE.cardTitle}>Composição mensal do custo</Text>
            <MonthlyChart participante={participante} />
            <View style={STYLE.legend}>{GROUPS.map((group) => <View key={group.key} style={STYLE.legendItem}><View style={[STYLE.dot, { backgroundColor: group.color }]} /><Text>{group.label}</Text></View>)}</View>
          </View>
          <View style={STYLE.card}>
            <Text style={STYLE.cardTitle}>Projeção do custo por hora · {horasProjetadas} h/mês</Text>
            <ProjectionChart participante={participante} meses={balanco.meses.length} horasProjetadas={horasProjetadas} />
            <Table headers={["Horas/mês", "Fixo/h", "Variável/h", "Extra/h", "Custo/h", "Custo mensal"]} widths={[.85, 1, 1, 1, 1, 1.15]} rows={projecaoRows} />
            <Text style={[STYLE.paragraph, { marginTop: 7 }]}>Projeção estimada com base nos custos registrados e classificados; não é previsão de manutenção nem compromisso de custo.</Text>
          </View>
          <View style={STYLE.card}>
            <Text style={STYLE.cardTitle}>Utilização frente à cota</Text>
            <Text style={STYLE.paragraph}>Participação nas horas voadas: {participante.uso == null ? "—" : `${fmt(participante.uso, 1)}%`} · Referência proporcional: {horas(participante.referencia)} · Diferença: {horas(participante.saldoHoras)}.</Text>
          </View>
          <PageFooter aeronave={aeronave} participante={participante.nome} />
        </Page>,

        <Page key={`${participante.id}-diario`} size="A4" orientation="landscape" style={STYLE.page}>
          <SectionHeading section="04 · Diário de bordo" period={periodoCurto} />
          <Text style={STYLE.title}>Histórico de voos · {participante.nome}</Text>
          <Text style={STYLE.subtitle}>{participante.voos.length} etapa(s) vinculada(s) ao cotista no período selecionado</Text>
          {participante.voos.length ? <View style={STYLE.card}><Table headers={["Data", "Voo", "Trecho", "Decolagem", "Pouso", "Duração", "Pousos", "Natureza"]} widths={[.8, .6, 1.8, .75, .75, .7, .65, 1.3]} rows={vooRows} /></View> : <View style={STYLE.card}><Text style={STYLE.paragraph}>Nenhum voo operacional vinculado a este cotista no período selecionado.</Text></View>}
          <Text style={STYLE.note}>Voos emprestados são atribuídos ao tomador identificado. Traslados, voos de teste e registros sem titular podem não compor a utilização individual do cotista.</Text>
          <PageFooter aeronave={aeronave} participante={participante.nome} />
        </Page>
      ];
    })}
  </Document>;
}
