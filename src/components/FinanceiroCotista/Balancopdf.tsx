import React from 'react';
import { Document, Page, Text, View, Svg, Rect, StyleSheet, pdf } from '@react-pdf/renderer';
import type { Balanco } from '../../types/balanco';
import { COR_GRUPO, NOME_GRUPO, brl, destaques, hhmm, montarResumo, type Grupo, type Resumo } from './BalancoResumo';

// Anexos opcionais: vêm do mesmo dashboard (lançamentos e voos do período).
export type LancamentoPdf = { data: string; doc?: string; fornecedor: string; descricao: string; categoria: string; valor: number };
export type VooPdf = { data: string; origem: string; destino: string; horas: number; pousos?: number; comandante?: string };
export type Anexos = { lancamentos?: LancamentoPdf[]; voos?: VooPdf[] };

const C = { ink: '#14202e', mut: '#5d6b7b', line: '#e0e6ed', soft: '#eef3f9', navy: '#0f3d6e' };
const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontFamily: 'Helvetica', fontSize: 10, color: C.ink },
  band: { backgroundColor: C.navy, color: '#fff', padding: 18, borderRadius: 6, marginBottom: 14 },
  bandSub: { fontSize: 10, opacity: 0.8, marginTop: 3 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 4 },
  sub: { fontSize: 9, color: C.mut, marginBottom: 8 },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: C.soft, borderRadius: 6, padding: 10 },
  kpiL: { fontSize: 8.5, color: C.mut },
  kpiV: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  li: { flexDirection: 'row', marginBottom: 5, gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.navy, marginTop: 4 },
  track: { height: 7, backgroundColor: C.soft, borderRadius: 4, marginTop: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.mut, backgroundColor: C.soft },
  foot: { position: 'absolute', bottom: 22, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.mut },
  box: { backgroundColor: C.soft, borderRadius: 6, padding: 10, marginTop: 8, fontSize: 9, lineHeight: 1.5 },
});

const GRUPOS: Grupo[] = ['fixo', 'variavel', 'extra'];

function Kpi({ l, v }: { l: string; v: string }) {
  return <View style={s.kpi}><Text style={s.kpiL}>{l}</Text><Text style={s.kpiV}>{v}</Text></View>;
}

function Tabela({ cols, rows, total }: { cols: { t: string; f: number; r?: boolean }[]; rows: string[][]; total?: string[] }) {
  const linha = (cells: string[], extra: object = {}, key?: number) => (
    <View key={key} style={[s.tr, extra]} wrap={false}>
      {cells.map((c, i) => <Text key={i} style={{ flex: cols[i].f, textAlign: cols[i].r ? 'right' : 'left', paddingHorizontal: 4 }}>{c}</Text>)}
    </View>
  );
  return (
    <View>
      <View fixed>{linha(cols.map((c) => c.t), s.th)}</View>
      {rows.map((r, i) => linha(r, {}, i))}
      {total && linha(total, { backgroundColor: C.soft, fontFamily: 'Helvetica-Bold' })}
    </View>
  );
}

function GraficoMensal({ r }: { r: Resumo }) {
  const W = 523, H = 120, n = r.mensal.length, slot = W / n, bw = slot * 0.6;
  const max = Math.max(...r.mensal.map((m) => m.total), 1);
  return (
    <View>
      <Svg width={W} height={H}>
        {r.mensal.map((m, i) => {
          let y = H;
          return (['fixos', 'variaveis', 'extras'] as const).map((k, j) => {
            const h = (m[k] / max) * (H - 4); y -= h;
            return h > 0 ? <Rect key={`${i}${k}`} x={i * slot + (slot - bw) / 2} y={y} width={bw} height={h} fill={COR_GRUPO[GRUPOS[j]]} /> : null;
          });
        })}
      </Svg>
      <View style={{ flexDirection: 'row' }}>
        {r.mensal.map((m) => <Text key={m.mes} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.mut, marginTop: 3 }}>{m.mes.slice(0, 3)}</Text>)}
      </View>
    </View>
  );
}

export function BalancoPdf({ balanco, lancamentos, voos }: { balanco: Balanco } & Anexos) {
  const r = montarResumo(balanco);
  const rodape = (
    <View style={s.foot} fixed>
      <Text>Share Brasil · {r.cabecalho.aeronave} · {r.cabecalho.cotista}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
  return (
    <Document title={`Balanço ${r.cabecalho.aeronave} ${r.cabecalho.exercicio}`} author="Share Brasil">
      {/* Página 1 — o que o cliente precisa ver primeiro */}
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Text style={s.h1}>Balanço de custos {r.cabecalho.exercicio}</Text>
          <Text style={s.bandSub}>{r.cabecalho.aeronave} · {r.cabecalho.cotista} · {r.periodo}</Text>
        </View>
        <View style={s.kpis}>
          <Kpi l="Total no período" v={brl(r.total)} />
          <Kpi l="Média por mês" v={brl(r.mediaMes)} />
          <Kpi l="Horas voadas" v={hhmm(r.horas)} />
          <Kpi l="Custo médio por hora" v={r.custoHoraReal ? brl(r.custoHoraReal) : '—'} />
        </View>

        <Text style={s.h2}>O que você precisa saber</Text>
        {destaques(r).map((t) => <View key={t} style={s.li}><View style={s.dot} /><Text style={{ flex: 1 }}>{t}</Text></View>)}

        <Text style={s.h2}>Para onde foi o dinheiro</Text>
        <Text style={s.sub}>Do maior para o menor gasto</Text>
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
          {GRUPOS.map((g) => <View key={g} style={{ width: `${(r.grupos[g] / r.total) * 100}%`, backgroundColor: COR_GRUPO[g] }} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10, fontSize: 8.5, color: C.mut }}>
          {GRUPOS.map((g) => <Text key={g}>{NOME_GRUPO[g]}: {brl(r.grupos[g])} ({((r.grupos[g] / r.total) * 100).toFixed(0)}%)</Text>)}
        </View>
        {r.categorias.map((c) => (
          <View key={c.chave} style={{ marginBottom: 7 }} wrap={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.nome}</Text>
              <Text>{brl(c.total)}  ({c.pct.toFixed(1)}%)</Text>
            </View>
            <View style={s.track}><View style={{ height: 7, borderRadius: 4, width: `${c.pct}%`, backgroundColor: COR_GRUPO[c.grupo] }} /></View>
            <Text style={{ fontSize: 8, color: C.mut, marginTop: 2 }}>Média de {brl(c.mediaMes)} por mês</Text>
          </View>
        ))}
        {rodape}
      </Page>

      {/* Página 2 — mês a mês e operação */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Mês a mês</Text>
        <Text style={s.sub}>Azul: fixos · Verde: variáveis · Amarelo: extras</Text>
        <GraficoMensal r={r} />
        <View style={{ height: 10 }} />
        <Tabela
          cols={[{ t: 'Mês', f: 1.2 }, { t: 'Fixos', f: 1, r: true }, { t: 'Variáveis', f: 1, r: true }, { t: 'Extras', f: 1, r: true }, { t: 'Total', f: 1.1, r: true }, { t: 'Horas', f: 0.7, r: true }]}
          rows={r.mensal.map((m) => [m.mes, brl(m.fixos), brl(m.variaveis), brl(m.extras), brl(m.total), m.horas ? hhmm(m.horas) : '—'])}
          total={['Total', brl(r.grupos.fixo), brl(r.grupos.variavel), brl(r.grupos.extra), brl(r.total), hhmm(r.horas)]}
        />
        <Text style={s.h2}>Como a aeronave foi usada</Text>
        <View style={s.kpis}>
          <Kpi l="Horas voadas" v={hhmm(r.horas)} />
          <Kpi l="Pousos" v={String(r.pousos)} />
          <Kpi l="Distância" v={`${r.distanciaNM.toLocaleString('pt-BR')} NM`} />
          <Kpi l="Abastecido" v={`${r.litros.toLocaleString('pt-BR')} L`} />
        </View>
        <Text style={s.box}>
          Dias de voo: {r.diasVoo}. {r.litrosPorNM ? `Consumo médio: ${r.litrosPorNM.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} litros por milha náutica. ` : ''}
          Meses sem voo continuam com custos fixos (tripulação, hangaragem, seguro).
        </Text>
        {rodape}
      </Page>

      {/* Página 3 — projeção */}
      {r.projecao.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Projeção: quanto custa cada hora voada</Text>
          <Text style={s.sub}>Com base no histórico de {r.periodo}</Text>
          <Tabela
            cols={[{ t: 'Horas por mês', f: 1 }, { t: 'Fixo por hora', f: 1, r: true }, { t: 'Variável por hora', f: 1.1, r: true }, { t: 'Custo por hora', f: 1.1, r: true }, { t: 'Custo no mês', f: 1.1, r: true }]}
            rows={r.projecao.map((p) => [`${p.horas} h`, brl(p.fixoHora), brl(p.variavelHora + p.extraHora), brl(p.custoHora), brl(p.custoMes)])}
          />
          <Text style={s.box}>
            Como ler: o custo fixo mensal ({brl(r.fixoMes)}) é dividido pelas horas que você voa; por isso a hora fica mais barata quanto mais se voa. O custo variável e os extras (somados, {brl((r.variavelHora ?? 0) + (r.extraHora ?? 0))} por hora) acompanham cada hora voada.
            Trata-se de estimativa pela média histórica, não de cobrança.
          </Text>
          <Text style={s.h2}>Glossário</Text>
          <Text style={{ lineHeight: 1.6 }}>
            Fixos: pagos todo mês, voando ou não (tripulação e administração, hangaragem, seguro).{'\n'}
            Variáveis: crescem com o uso (combustível, manutenção por hora, taxas de voo, hotéis e alimentação).{'\n'}
            Extras: eventos fora do previsto (ex.: troca de pneu, reparo corretivo).
          </Text>
          {rodape}
        </Page>
      )}

      {/* Anexos — só aparecem se o dashboard enviar os dados */}
      {lancamentos && lancamentos.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Anexo A — Lançamentos do período</Text>
          <Tabela
            cols={[{ t: 'Data', f: 0.9 }, { t: 'Fornecedor', f: 1.4 }, { t: 'Descrição', f: 1.6 }, { t: 'Categoria', f: 1.4 }, { t: 'Valor', f: 1, r: true }]}
            rows={lancamentos.map((l) => [l.data, l.fornecedor, l.descricao, l.categoria, brl(l.valor)])}
            total={['', '', '', 'Total', brl(lancamentos.reduce((a, l) => a + l.valor, 0))]}
          />
          {rodape}
        </Page>
      )}
      {voos && voos.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Anexo B — Diário de bordo</Text>
          <Tabela
            cols={[{ t: 'Data', f: 1 }, { t: 'Origem', f: 1.6 }, { t: 'Destino', f: 1.6 }, { t: 'Tempo', f: 0.8, r: true }, { t: 'Comandante', f: 1.3 }]}
            rows={voos.map((v) => [v.data, v.origem, v.destino, hhmm(v.horas), v.comandante ?? '—'])}
          />
          {rodape}
        </Page>
      )}
    </Document>
  );
}

export async function baixarPdfBalanco(balanco: Balanco, anexos: Anexos = {}) {
  const blob = await pdf(<BalancoPdf balanco={balanco} {...anexos} />).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `balanco-${balanco.aeronave}-${balanco.exercicio}.pdf`.replace(/\s+/g, '-');
  a.click();
  URL.revokeObjectURL(a.href);
}
