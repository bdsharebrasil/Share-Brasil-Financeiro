import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function moeda(v: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
}

function dataBr(v: unknown) {
  const [a, m, d] = String(v || "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

export default function AprovacaoRelatorioViagem() {
  const token = new URLSearchParams(window.location.search).get("token") || window.location.pathname.split("/").pop() || "";
  const [data, setData] = useState<any>(null);
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState("Carregando relatório...");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void fetch(`${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error);
        setData(json);
        setMensagem("");
      })
      .catch((error) => setMensagem(error.message || "Link inválido ou expirado."));
  }, [token]);

  const statusAtual = useMemo(() => {
    if (!data?.relatorio) return "";
    return data.tripulante_pos === 1
      ? String(data.relatorio.status_aprovacao_tripulante || "").toLowerCase()
      : String(data.relatorio.status_aprovacao_tripulante_2 || "").toLowerCase();
  }, [data]);
  const decisaoRegistrada = statusAtual === "aprovado" || statusAtual === "reprovado" || statusAtual === "rejeitado";
  const rejeitado = statusAtual === "reprovado" || statusAtual === "rejeitado";
  const motivoRejeicao = data?.tripulante_pos === 1
    ? data?.relatorio?.motivo_reprovacao_tripulante_1
    : data?.relatorio?.motivo_reprovacao_tripulante_2;

  const decidir = async (aprovado: boolean) => {
    if (decisaoRegistrada) return;
    if (!aprovado && !motivo.trim()) {
      setMensagem("Informe o motivo da rejeição.");
      return;
    }
    setEnviando(true);
    try {
      const response = await fetch(`${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprovado, motivo }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setData((atual: any) => ({ ...atual, relatorio: json.relatorio }));
      setMensagem(aprovado ? "Sua despesa foi aprovada." : "Sua rejeição foi registrada.");
      setMotivo("");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setEnviando(false);
    }
  };

  if (!data) {
    return <main className="min-h-screen bg-[#030814] p-4 text-white sm:p-6"><div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">{mensagem}</div></main>;
  }

  const r = data.relatorio;
  const despesas = (r.despesas || []).filter((d: any) => String(d.pago_por || "").includes(`tripulante_${data.tripulante_pos}`));

  return <main className="min-h-screen bg-[#030814] p-4 text-white sm:p-8"><div className="mx-auto max-w-3xl space-y-5">
    <header className="min-w-0"><p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Share Brasil · Aprovação de despesas</p><h1 className="mt-2 break-words text-2xl font-bold">Relatório {r.numero_relatorio}</h1><p className="break-words text-sm text-white/60">Voo {r.numero_voo || "—"} · Aeronave {r.aeronave_matricula || "—"} · {dataBr(r.data_inicio)} a {dataBr(r.data_fim)}</p></header>
    {decisaoRegistrada && <section className={`rounded-xl border p-5 ${rejeitado ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/30 bg-emerald-400/10"}`}>
      <p className={`text-sm font-bold uppercase tracking-[0.12em] ${rejeitado ? "text-rose-200" : "text-emerald-200"}`}>{rejeitado ? "Relatório já rejeitado" : "Relatório já aprovado"}</p>
      <p className="mt-2 text-sm text-white/80">Sua decisão já foi registrada. Não é possível alterar a decisão por este link.</p>
      {rejeitado && motivoRejeicao && <p className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3 text-sm text-white/80"><strong>Motivo informado:</strong> {motivoRejeicao}</p>}
    </section>}
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5"><h2 className="font-semibold">Dados da viagem</h2><p className="mt-2 break-words text-sm text-white/70">Rota: {r.rota || "—"}</p><p className="break-words text-sm text-white/70">Tripulante {data.tripulante_pos}: {data.tripulante_pos === 1 ? r.nome_tripulante : r.nome_tripulante_2}</p></section>
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5"><div className="border-b border-white/10 p-5"><h2 className="font-semibold">Suas despesas</h2></div><div className="divide-y divide-white/10">{despesas.map((d: any, i: number) => <div className="flex min-w-0 items-start justify-between gap-4 p-4 sm:p-5" key={i}><div className="min-w-0"><p className="break-words font-medium">{d.descricao || d.categoria || "Despesa"}</p><p className="break-words text-xs text-white/50">{dataBr(d.data)} · {d.categoria || "Outros"}</p></div><strong className="shrink-0 whitespace-nowrap text-right">{moeda(d.valor)}</strong></div>)}{!despesas.length && <p className="p-5 text-sm text-white/60">Nenhuma despesa atribuída a você.</p>}</div></section>
    {!decisaoRegistrada && <><Textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo (obrigatório se rejeitar)" className="min-h-24 resize-y bg-white/5 text-white" /><div className="flex flex-col gap-3 sm:flex-row"><Button disabled={enviando} onClick={() => void decidir(true)} className="w-full justify-center whitespace-normal text-center bg-emerald-600 hover:bg-emerald-500 sm:w-auto">Aprovar minhas despesas</Button><Button disabled={enviando} variant="outline" onClick={() => void decidir(false)} className="w-full justify-center whitespace-normal text-center border-rose-400/50 text-rose-200 sm:w-auto">Rejeitar e informar motivo</Button></div></>}
    {mensagem && <p className="text-sm text-cyan-200">{mensagem}</p>}
  </div></main>;
}
