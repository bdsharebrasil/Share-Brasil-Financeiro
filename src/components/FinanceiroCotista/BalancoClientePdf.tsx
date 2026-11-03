import { Document, Page, Text, View, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import { formatarCentavos } from "@/lib/financeiro-share-api";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";
import { categoriasDoParticipante, destaques, type Balanco, type LinhaLancamento, type ParticipanteBalanco } from "@/lib/balanco-cotista";

type Props = { b: Balanco; p: ParticipanteBalanco; aeronave: string; lancamentos: LinhaLancamento[] };

const C = { ink: "#14202e", mut: "#5d6b7b", line: "#e0e6ed", soft: "#eef3f9", navy: "#0f3d6e" };
const COR = { fixos: "#2f6db5", variaveis: "#52794a", extras: "#e8b94a", naoClassificados: "#8291a4" } as const;
const NOME = { fixos: "Fixos", variaveis: "Variáveis", extras: "Extras", naoClassificados: "Não classificados" } as const;
const GRUPOS = ["fixos", "variaveis", "extras", "naoClassificados"] as const;

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  band: { backgroundColor: C.navy, color: "#fff", padding: 18, borderRadius: 6, marginBottom: 14 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  bandSub: { fontSize: 10, marginTop: 3, opacity: 0.85 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 4 },
  sub: { fontSize: 9, color: C.mut, marginBottom: 8 },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: C.soft, borderRadius: 6, padding: 10 },
  kpiL: { fontSize: 8.5, color: C.mut },
  kpiV: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 3 },
  li: { flexDirection: "row", gap: 6, marginBottom: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.navy, marginTop: 4 },
  track: { height: 7, backgroundColor: C.soft, borderRadius: 4, marginTop: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: C.mut, backgroundColor: C.soft },
  box: { backgroundColor: C.soft, borderRadius: 6, padding: 10, marginTop: 8, fontSize: 9, lineHeight: 1.5 },
  foot: { position: "absolute", bottom: 22, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.mut },
});

const money = (v: number | null | undefined) => (v == null ? "—" : formatarCentavos(Math.round(v)));
const pct = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const hhmm = (v: number | null) => {
  if (v == null) return "—";
  const m = Math.round(Math.abs(v) * 60);
  return `${v < 0 ? "-" : ""}${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

function Kpi({ l, v }: { l: string; v: string }) {
  return <View style={s.kpi}><Text style={s.kpiL}>{l}</Text><Text style={s.kpiV}>{v}</Text></View>;
}

function Tabela({ cols, rows, total }: { cols: { t: string; f: number; r?: boolean }[]; rows: string[][]; total?: string[] }) {
  const linha = (cells: string[], estilo: object = {}, key?: number) => (
    <View key={key} style={[s.tr, estilo]} wrap={false}>
      {cells.map((c, i) => (
        <Text key={i} style={{ flex: cols[i].f, textAlign: cols[i].r ? "right" : "left", paddingHorizontal: 4 }}>{c}</Text>
      ))}
    </View>
  );
  return (
    <View>
      <View fixed>{linha(cols.map((c) => c.t), s.th)}</View>
      {rows.map((r, i) => linha(r, {}, i))}
      {total && linha(total, { backgroundColor: C.soft, fontFamily: "Helvetica-Bold" })}
    </View>
  );
}

function GraficoMensal({ mensal }: { mensal: Participante["mensal"] }) {
  const W = 523, H = 110, n = Math.max(mensal.length, 1), slot = W / n, bw = Math.min(slot * 0.6, 48);
  const max = Math.max(...mensal.map((m) => m.total), 1);
  return (
    <View>
      <Svg width={W} height={H}>
        {mensal.map((m, i) => {
          let y = H;
          return GRUPOS.map((g) => {
            const h = (m[g] / max) * (H - 4);
            y -= h;
            return h > 0 ? <Rect key={`${i}${g}`} x={i * slot + (slot - bw) / 2} y={y} width={bw} height={h} fill={COR[g]} /> : null;
          });
        })}
      </Svg>
      <View style={{ flexDirection: "row" }}>
        {mensal.map((m) => (
          <Text key={m.mes} style={{ flex: 1, textAlign: "center", fontSize: 8, color: C.mut, marginTop: 3 }}>{m.nome}</Text>
        ))}
      </View>
    </View>
  );
}

export function BalancoClientePdf({ b, p, aeronave, lancamentos }: Props) {
  const nMeses = Math.max(b.meses.length, 1);
  const periodo = b.meses.length > 1
    ? `${rotuloMesCotista(b.meses[0])} a ${rotuloMesCotista(b.meses[b.meses.length - 1])}`
    : rotuloMesCotista(b.meses[0]);
  const cats = categoriasDoParticipante(b, p);
  const total = p.custo.total;
  const rodape = (
    <View style={s.foot} fixed>
      <Text>Share Brasil · {aeronave} · {p.nome}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`Balanço ${aeronave} · ${p.nome}`} author="Share Brasil">
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Text style={s.h1}>Balanço de custos · {p.nome}</Text>
          <Text style={s.bandSub}>{aeronave} · {periodo}</Text>
        </View>
        <View style={s.kpis}>
          <Kpi l="Seu custo no período" v={money(total)} />
          <Kpi l="Média por mês" v={money(total / nMeses)} />
          <Kpi l="Suas horas voadas" v={hhmm(p.horas)} />
          <Kpi l="Seu custo por hora" v={money(p.custoHora)} />
        </View>

        <Text style={s.h2}>O que você precisa saber</Text>
        {destaques(b, p).map((t) => (
          <View key={t} style={s.li}><View style={s.dot} /><Text style={{ flex: 1 }}>{t}</Text></View>
        ))}

        <Text style={s.h2}>Para onde foi o seu dinheiro</Text>
        <Text style={s.sub}>Do maior para o menor gasto</Text>
        {total > 0 && (
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
            {GRUPOS.map((g) => p.custo[g] > 0 && <View key={g} style={{ width: `${(p.custo[g] / total) * 100}%`, backgroundColor: COR[g] }} />)}
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10, fontSize: 8.5, color: C.mut }}>
          {GRUPOS.filter((g) => p.custo[g] > 0).map((g) => (
            <Text key={g}>{NOME[g]}: {money(p.custo[g])} ({pct((p.custo[g] / total) * 100)})</Text>
          ))}
        </View>
        {cats.map((c) => (
          <View key={c.nome} style={{ marginBottom: 7 }} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{c.nome}</Text>
              <Text>{money(c.valor)}  ({pct((c.valor / total) * 100)})</Text>
            </View>
            <View style={s.track}>
              <View style={{ height: 7, borderRadius: 4, width: `${(c.valor / total) * 100}%`, backgroundColor: COR.fixos }} />
            </View>
            <Text style={{ fontSize: 8, color: C.mut, marginTop: 2 }}>Média de {money(c.valor / nMeses)} por mês</Text>
          </View>
        ))}
        {rodape}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Mês a mês</Text>
        <Text style={s.sub}>Azul: fixos · Verde: variáveis · Amarelo: extras</Text>
        <GraficoMensal mensal={p.mensal} />
        <View style={{ height: 10 }} />
        <Tabela
          cols={[{ t: "Mês", f: 1.2 }, { t: "Fixos", f: 1, r: true }, { t: "Variáveis", f: 1, r: true }, { t: "Extras", f: 1, r: true }, { t: "Total", f: 1.1, r: true }, { t: "Horas", f: 0.7, r: true }, { t: "Custo/h", f: 1, r: true }]}
          rows={p.mensal.map((m) => [m.nome, money(m.fixos), money(m.variaveis), money(m.extras), money(m.total), hhmm(m.horas), money(m.custoHora)])}
          total={["Total", money(p.custo.fixos), money(p.custo.variaveis), money(p.custo.extras), money(total), hhmm(p.horas), money(p.custoHora)]}
        />

        <Text style={s.h2}>Sua utilização frente à sua cota</Text>
        {[["Sua participação na aeronave", p.quota], ["Sua participação nas horas voadas", p.uso]].map(([label, v]) => (
          <View key={label as string} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>{label as string}</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{pct(v as number | null)}</Text>
            </View>
            <View style={s.track}>
              <View style={{ height: 7, borderRadius: 4, width: `${Math.max(0, Math.min(100, (v as number | null) ?? 0))}%`, backgroundColor: COR.fixos }} />
            </View>
          </View>
        ))}
        <Text style={s.box}>
          {p.diferenca == null
            ? "Sem base para comparar utilização e cota."
            : Math.abs(p.diferenca) < 0.005
              ? "Sua utilização é proporcional à sua cota."
              : `Sua utilização está ${pct(Math.abs(p.diferenca))} ${p.diferenca > 0 ? "acima" : "abaixo"} da sua cota.`}
          {" "}Referência proporcional: {hhmm(p.referencia)}. Comparativo informativo, sem crédito de horas ou cobrança.
        </Text>

        {p.destinos.length > 0 && (
          <>
            <Text style={s.h2}>Destinos mais visitados</Text>
            {p.destinos.slice(0, 5).map((d) => (
              <Text key={d.nome} style={{ marginBottom: 3 }}>{d.nome}: {d.visitas} {d.visitas === 1 ? "chegada" : "chegadas"}</Text>
            ))}
          </>
        )}
        {rodape}
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>A aeronave no período</Text>
        <Text style={s.sub}>Totais de todos os cotistas, para você comparar</Text>
        <View style={s.kpis}>
          <Kpi l="Custo total" v={money(b.total.total)} />
          <Kpi l="Média por mês" v={money(b.total.total / nMeses)} />
          <Kpi l="Horas voadas" v={hhmm(b.totalHoras)} />
          <Kpi l="Custo por hora" v={money(b.custoHora)} />
        </View>
        <Text style={s.box}>
          Pousos: {b.totalPousos ?? "—"} · Etapas de voo: {b.totalVoos ?? "—"} · Consumo estimado: {b.consumoHora == null ? "—" : `${b.consumoHora.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L/h`}
        </Text>

        <Text style={s.h2}>Projeção: quanto custa cada hora voada</Text>
        <Text style={s.sub}>Valores da aeronave inteira, pela média do período</Text>
        {b.projecao.length ? (
          <>
            <Tabela
              cols={[{ t: "Horas/mês", f: 0.9 }, { t: "Fixo/h", f: 1, r: true }, { t: "Variável + extra/h", f: 1.2, r: true }, { t: "Custo/h", f: 1, r: true }, { t: "Custo no mês", f: 1.1, r: true }]}
              rows={b.projecao.map((x) => [`${x.horas} h`, money(x.fixoHora), money(x.variavelHora + x.extraHora), money(x.custoHora), money(x.custoMensal)])}
            />
            <Text style={s.box}>
              Como ler: o custo fixo mensal é dividido pelas horas voadas, por isso a hora fica mais barata quanto mais se voa. Variáveis e extras acompanham cada hora. É uma estimativa pela média histórica, não uma cobrança.
            </Text>
          </>
        ) : (
          <Text style={s.box}>A projeção exige horas registradas e todos os custos classificados.</Text>
        )}

        <Text style={s.h2}>Glossário</Text>
        <Text style={{ lineHeight: 1.6 }}>
          Fixos: pagos todo mês, voando ou não (tripulação, hangaragem, seguro).{"\n"}
          Variáveis: crescem com o uso (combustível, manutenção por hora, taxas, hotéis).{"\n"}
          Extras: eventos fora do previsto, como reparos corretivos.
        </Text>
        {rodape}
      </Page>

      {lancamentos.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Anexo A · Lançamentos do período</Text>
          <Text style={s.sub}>Sua parte é o valor rateado a você em cada despesa</Text>
          <Tabela
            cols={[{ t: "Data", f: 0.9 }, { t: "Favorecido", f: 1.3 }, { t: "Descrição", f: 1.7 }, { t: "Categoria", f: 1.2 }, { t: "Total", f: 1, r: true }, { t: "Sua parte", f: 1, r: true }]}
            rows={lancamentos.map((l) => [l.data, l.fornecedor, l.descricao, l.categoria, money(l.totalCentavos), money(l.suaParteCentavos)])}
            total={["", "", "", "Total", money(lancamentos.reduce((t, l) => t + l.totalCentavos, 0)), money(lancamentos.reduce((t, l) => t + l.suaParteCentavos, 0))]}
          />
          {rodape}
        </Page>
      )}

      {p.voos.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Anexo B · Histórico de utilização</Text>
          <Tabela
            cols={[{ t: "Data", f: 0.9 }, { t: "Voo", f: 0.8 }, { t: "Origem", f: 1.3 }, { t: "Destino", f: 1.3 }, { t: "Horas", f: 0.7, r: true }, { t: "Pousos", f: 0.7, r: true }]}
            rows={p.voos.map((v) => [v.data.slice(0, 10).split("-").reverse().join("/"), v.numero ?? "—", v.origem ?? "—", v.destino ?? "—", hhmm(v.horas), v.pousos == null ? "—" : String(v.pousos)])}
          />
          {rodape}
        </Page>
      )}
    </Document>
  );
}