import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colaboradorRequest } from "@/lib/colaborador-api";
import { formatarCentavos } from "@/lib/financeiro-share-api";

type Bucket = "adm_trip" | "hangaragem" | "manut_fixa" | "combustivel" | "manut_hora" | "taxas_voo" | "hoteis_alim" | "extras";
type Op = { abastecido_l: number; distancia_nm: number; pousos: number; h_voo: number; h_ttl: number; dias_voo: number };
type Linha = { mes: string; ativo: boolean; custos: Record<Bucket, number>; fixos: number; variaveis: number; extras: number; total: number; operacional: Op;
  medias: { por_hora: Record<Bucket, number>; litros_por_hora: number; valor_litro_centavos: number; velocidade_kt: number; custo_hora_centavos: number; custo_km_centavos: number; custo_dia_centavos: number } };
type Relatorio = {
  ano: number; n_cotas: number; meses_ativos: number; linhas: Linha[];
  total: { custos: Record<Bucket, number>; fixos: number; variaveis: number; extras: number; total: number; operacional: Op };
  media_mes: { custos: Record<Bucket, number>; fixos: number; variaveis: number; extras: number; total: number };
  medias: { por_hora: Record<Bucket, number>; fixos_hora: number; variaveis_hora: number; extras_hora: number; custo_hora_centavos: number; custo_km_centavos: number; litros_por_hora: number; litros_por_nm: number; valor_litro_centavos: number; velocidade_kt: number; horas_por_ciclo: number; diarias_por_hora: number; custo_dia_centavos: number };
  projecao: Array<{ h_voadas: number; custo_fixo: number; custo_variavel: number; custo_extra: number; custo_hora_tt: number; custo_comb: number; custo_total: number; indice: number; fixo_por_cota: number }>;
  taxa_projecao_centavos: number;
};

const GRUPOS: Array<{ titulo: string; cols: Array<[Bucket, string]> }> = [
  { titulo: "Custos fixos", cols: [["adm_trip", "Adm / Trip."], ["hangaragem", "Hangaragem"], ["manut_fixa", "Manut. fixa"]] },
  { titulo: "Variáveis por hora", cols: [["combustivel", "Combustível"], ["manut_hora", "Manut. p/ hora"]] },
  { titulo: "Variáveis por voo", cols: [["taxas_voo", "Taxas voo"], ["hoteis_alim", "Hotéis / alim."]] },
  { titulo: "Extras", cols: [["extras", "Extras"]] },
];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const num = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const th = "whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const td = "whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums";

export function RelatorioGeralCotista({ aeronaveId }: { aeronaveId: string }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(String(anoAtual));
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesesPdf, setMesesPdf] = useState<number[]>(Array.from({ length: 12 }, (_, i) => i));

  useEffect(() => {
    let cancelado = false;
    setCarregando(true); setErro(null);
    colaboradorRequest<Relatorio>(`/api/financeiro/cotista/relatorio-geral?aeronave_id=${encodeURIComponent(aeronaveId)}&ano=${ano}`)
      .then((r) => { if (!cancelado) setDados(r); })
      .catch((e) => { if (!cancelado) { setDados(null); setErro(e instanceof Error ? e.message : "Falha ao carregar o relatório."); } })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [aeronaveId, ano]);

  const graficoMensal = useMemo(() => (dados?.linhas ?? []).map((l, i) => ({ mes: MESES[i], Fixos: l.fixos / 100, Variáveis: l.variaveis / 100, Extras: l.extras / 100 })), [dados]);
  const graficoProjecao = useMemo(() => (dados?.projecao ?? []).map((p) => ({ h: p.h_voadas, "Custo hora": p.custo_hora_tt / 100, "Custo fixo": p.custo_fixo / 100 })), [dados]);
  const anos = Array.from({ length: 6 }, (_, i) => String(anoAtual - i));

  const gerarPdf = () => {
    if (!dados || mesesPdf.length === 0) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const margem = 12;
    const largura = 297 - margem * 2;
    const monetario = (centavos: number) => (Number(centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const linha = (texto: string, y: number, tamanho = 8, cor: [number, number, number] = [60, 72, 88]) => { pdf.setFontSize(tamanho); pdf.setTextColor(...cor); pdf.text(texto, margem, y); };
    pdf.setFillColor(14, 29, 52); pdf.rect(0, 0, 297, 36, "F");
    pdf.setTextColor(232, 241, 252); pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.text("FECHAMENTO DE BALANÇO", margem, 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`Aeronave · relatório geral ${dados.ano}`, margem, 24);
    pdf.text(`Meses: ${mesesPdf.map((i) => MESES[i]).join(" · ")}`, margem, 30);
    let y = 48;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(14, 29, 52); pdf.text("Resumo geral", margem, y); y += 7;
    const colunas = [["Mês", 16], ["Fixos", 42], ["Variáveis", 42], ["Extras", 42], ["Total", 42], ["L", 24], ["NM", 24], ["H voo", 24], ["H TTL", 24], ["Dias", 20]] as const;
    pdf.setFillColor(227, 235, 245); pdf.rect(margem, y - 5, largura, 8, "F");
    let x = margem; pdf.setFontSize(7); pdf.setTextColor(52, 67, 86);
    for (const [titulo, w] of colunas) { pdf.text(titulo, x + 1, y); x += w; } y += 8;
    pdf.setFont("helvetica", "normal");
    for (const i of mesesPdf) {
      const l = dados.linhas[i]; if (!l) continue;
      x = margem; const valores = [MESES[i], monetario(l.fixos), monetario(l.variaveis), monetario(l.extras), monetario(l.total), num(l.operacional.abastecido_l, 1), num(l.operacional.distancia_nm, 1), num(l.operacional.h_voo), num(l.operacional.h_ttl), String(l.operacional.dias_voo)];
      for (const [j, valor] of valores.entries()) { pdf.text(valor, x + 1, y); x += colunas[j][1]; } y += 6;
    }
    y += 5; pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Resumo das médias", margem, y); y += 7;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    const medias = [`Custo/h: ${monetario(dados.medias.custo_hora_centavos)}`, `Custo/km: ${monetario(dados.medias.custo_km_centavos)}`, `Custo/dia: ${monetario(dados.medias.custo_dia_centavos)}`, `L/h: ${num(dados.medias.litros_por_hora)}`, `R$/L: ${monetario(dados.medias.valor_litro_centavos)}`, `Velocidade: ${num(dados.medias.velocidade_kt, 0)} kt`];
    pdf.text(medias.join("    ·    "), margem, y); y += 12;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Custos mensais selecionados", margem, y); y += 7;
    const max = Math.max(...mesesPdf.map((i) => dados.linhas[i]?.total || 0), 1);
    for (const i of mesesPdf) { const l = dados.linhas[i]; if (!l) continue; const w = Math.max(1, (l.total / max) * (largura - 45)); pdf.setFillColor(96, 165, 250); pdf.roundedRect(margem + 28, y - 4, w, 5, 2, 2, "F"); pdf.setTextColor(52, 67, 86); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(MESES[i], margem, y); pdf.text(monetario(l.total), margem + 30 + w, y); y += 8; }
    pdf.setTextColor(120, 132, 148); pdf.setFontSize(7); pdf.text("Documento gerado pelo Financeiro Cotista · valores monetários em reais", margem, 202);
    pdf.save(`fechamento-balanco-${dados.ano}.pdf`);
  };

  if (carregando) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 size={20} className="animate-spin" /></div>;
  if (erro || !dados) return (
    <div role="alert" className="financeiro-panel flex items-center gap-3 border border-red-500/30 bg-red-500/5 px-4 py-4 text-sm text-red-300">
      <CircleAlert className="h-4 w-4 shrink-0" /> {erro || "Sem dados."}
    </div>
  );

  const m = dados.medias, t = dados.total;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Relatório geral {dados.ano}</p>
          <p className="text-[10px] text-muted-foreground">Custos da aeronave (todos os cotistas) por tipo, com operação, médias e projeção. Média mês considera {dados.meses_ativos} mês(es) com movimento.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-9 gap-1.5 text-xs" onClick={gerarPdf} disabled={!mesesPdf.length}>
            <Download className="h-3.5 w-3.5" /> Gerar PDF
          </Button>
        </div>
      </div>

      <div className="financeiro-panel flex flex-wrap items-center gap-1.5 p-3">
        <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meses no PDF</span>
        {MESES.map((mes, i) => (
          <button key={mes} type="button" onClick={() => setMesesPdf((atual) => atual.includes(i) ? atual.filter((item) => item !== i) : [...atual, i].sort((a, b) => a - b))} className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${mesesPdf.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{mes}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[["Média mensal · fixos", dados.media_mes.fixos], ["Média mensal · variáveis", dados.media_mes.variaveis], ["Média mensal · extras", dados.media_mes.extras], ["Custo por hora (total)", m.custo_hora_centavos]].map(([titulo, valor]) => (
          <div key={String(titulo)} className="financeiro-panel p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
            <p className="mt-1 font-mono text-base font-bold">{formatarCentavos(Number(valor))}</p>
          </div>
        ))}
      </div>

      <section className="financeiro-panel overflow-hidden">
        <div className="financeiro-panel-header"><p className="text-sm font-bold">Resumo geral</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className={`${th} text-left`} rowSpan={2}>{dados.ano}</th>
                {GRUPOS.map((g) => <th key={g.titulo} colSpan={g.cols.length} className={`${th} text-center`}>{g.titulo}</th>)}
                <th colSpan={6} className={`${th} text-center`}>Operacional</th>
              </tr>
              <tr className="border-b border-border">
                {GRUPOS.flatMap((g) => g.cols).map(([k, rot]) => <th key={k} className={th}>{rot}</th>)}
                {["Abast. L", "Dist. NM", "Pousos", "H voo", "H TTL", "Dias voo"].map((r) => <th key={r} className={th}>{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dados.linhas.map((l, i) => (
                <tr key={l.mes} className={l.ativo === false ? "opacity-50" : ""}>
                  <td className={`${td} text-left font-sans font-semibold`}>{MESES[i]}</td>
                  {GRUPOS.flatMap((g) => g.cols).map(([k]) => <td key={k} className={td}>{l.custos[k] ? formatarCentavos(l.custos[k]) : "—"}</td>)}
                  <td className={td}>{num(l.operacional.abastecido_l, 1)}</td><td className={td}>{num(l.operacional.distancia_nm, 1)}</td>
                  <td className={td}>{l.operacional.pousos}</td><td className={td}>{num(l.operacional.h_voo)}</td>
                  <td className={td}>{num(l.operacional.h_ttl)}</td><td className={td}>{l.operacional.dias_voo}</td>
                </tr>
              ))}
              <tr className="bg-primary/[.06] font-bold">
                <td className={`${td} text-left font-sans`}>TOTAL</td>
                {GRUPOS.flatMap((g) => g.cols).map(([k]) => <td key={k} className={td}>{formatarCentavos(t.custos[k])}</td>)}
                <td className={td}>{num(t.operacional.abastecido_l, 1)}</td><td className={td}>{num(t.operacional.distancia_nm, 1)}</td>
                <td className={td}>{t.operacional.pousos}</td><td className={td}>{num(t.operacional.h_voo)}</td>
                <td className={td}>{num(t.operacional.h_ttl)}</td><td className={td}>{t.operacional.dias_voo}</td>
              </tr>
              <tr className="bg-muted/30 font-semibold">
                <td className={`${td} text-left font-sans`}>MÉDIA MÊS</td>
                {GRUPOS.flatMap((g) => g.cols).map(([k]) => <td key={k} className={td}>{formatarCentavos(dados.media_mes.custos[k])}</td>)}
                <td className={td} colSpan={6}>Total do ano {formatarCentavos(t.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="financeiro-panel overflow-hidden">
        <div className="financeiro-panel-header"><p className="text-sm font-bold">Resumo das médias</p><p className="text-[10px] text-muted-foreground">Custos por hora de voo (H TTL) e indicadores operacionais</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className={`${th} text-left`}>{dados.ano}</th>
                {GRUPOS.flatMap((g) => g.cols).map(([k, rot]) => <th key={k} className={th}>{rot}</th>)}
                {["L/h", "R$/L", "Vel. kt", "Custo hora", "Custo km", "Custo dia"].map((r) => <th key={r} className={th}>{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dados.linhas.map((l, i) => (
                <tr key={l.mes}>
                  <td className={`${td} text-left font-sans font-semibold`}>{MESES[i]}</td>
                  {GRUPOS.flatMap((g) => g.cols).map(([k]) => <td key={k} className={td}>{l.medias.por_hora[k] ? formatarCentavos(l.medias.por_hora[k]) : "—"}</td>)}
                  <td className={td}>{num(l.medias.litros_por_hora)}</td><td className={td}>{formatarCentavos(l.medias.valor_litro_centavos)}</td>
                  <td className={td}>{Math.round(l.medias.velocidade_kt)}</td><td className={td}>{formatarCentavos(l.medias.custo_hora_centavos)}</td>
                  <td className={td}>{formatarCentavos(l.medias.custo_km_centavos)}</td><td className={td}>{formatarCentavos(l.medias.custo_dia_centavos)}</td>
                </tr>
              ))}
              <tr className="bg-primary/[.06] font-bold">
                <td className={`${td} text-left font-sans`}>MÉDIA</td>
                {GRUPOS.flatMap((g) => g.cols).map(([k]) => <td key={k} className={td}>{formatarCentavos(m.por_hora[k])}</td>)}
                <td className={td}>{num(m.litros_por_hora)}</td><td className={td}>{formatarCentavos(m.valor_litro_centavos)}</td>
                <td className={td}>{Math.round(m.velocidade_kt)}</td><td className={td}>{formatarCentavos(m.custo_hora_centavos)}</td>
                <td className={td}>{formatarCentavos(m.custo_km_centavos)}</td><td className={td}>{formatarCentavos(m.custo_dia_centavos)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 border-t border-border p-3 text-[11px] text-muted-foreground sm:grid-cols-3 xl:grid-cols-6">
          <span>Fixos/h: <strong className="text-foreground">{formatarCentavos(m.fixos_hora)}</strong></span>
          <span>Variáveis/h: <strong className="text-foreground">{formatarCentavos(m.variaveis_hora)}</strong></span>
          <span>Extras/h: <strong className="text-foreground">{formatarCentavos(m.extras_hora)}</strong></span>
          <span>Litros/NM: <strong className="text-foreground">{num(m.litros_por_nm)}</strong></span>
          <span>Horas por ciclo: <strong className="text-foreground">{num(m.horas_por_ciclo)}</strong></span>
          <span>Diárias por hora: <strong className="text-foreground">{num(m.diarias_por_hora)}</strong></span>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="financeiro-panel p-5">
          <p className="mb-4 text-sm font-bold">Custos mensais gerais</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoMensal}>
                <CartesianGrid strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Fixos" stackId="a" fill="#60a5fa" /><Bar dataKey="Variáveis" stackId="a" fill="#fb923c" /><Bar dataKey="Extras" stackId="a" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="financeiro-panel p-5">
          <p className="mb-1 text-sm font-bold">Custo hora por horas voadas no mês</p>
          <p className="mb-3 text-[10px] text-muted-foreground">Taxa de projeção: {formatarCentavos(dados.taxa_projecao_centavos)} por hora adicional · {dados.n_cotas} cota(s)</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graficoProjecao}>
                <CartesianGrid strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="h" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} labelFormatter={(h) => `${h} h/mês`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Custo hora" stroke="#fbbf24" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Custo fixo" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="financeiro-panel overflow-hidden">
        <div className="financeiro-panel-header"><p className="text-sm font-bold">Tabelas de projeção e índice de custo</p></div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {["H. voadas", "Custo fixo", "Fixo / cota", "Custo variável", "Custo extra", "Custo hora TT", "Custo total", "Índice"].map((r) => <th key={r} className={th}>{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dados.projecao.map((p) => (
                <tr key={p.h_voadas}>
                  <td className={td}>{p.h_voadas}</td><td className={td}>{formatarCentavos(p.custo_fixo)}</td><td className={td}>{formatarCentavos(p.fixo_por_cota)}</td>
                  <td className={td}>{formatarCentavos(p.custo_variavel)}</td><td className={td}>{formatarCentavos(p.custo_extra)}</td>
                  <td className={`${td} font-bold`}>{formatarCentavos(p.custo_hora_tt)}</td><td className={td}>{formatarCentavos(p.custo_total)}</td><td className={td}>{num(p.indice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
