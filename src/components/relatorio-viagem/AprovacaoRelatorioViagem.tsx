import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, FileImage, FileText, ReceiptText } from "lucide-react";
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

function dataHoraBr(v: unknown) {
  const valor = String(v || "").trim().replace("T", " ");
  const [data, hora] = valor.split(" ");
  const [a, m, d] = data.slice(0, 10).split("-");
  return a && m && d && hora ? `${d}/${m}/${a} ${hora.slice(0, 5)}` : "—";
}

function normalizarPagador(valor: unknown) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function nomePagador(valor: unknown) {
  const pagador = normalizarPagador(valor);
  if (pagador === "cliente" || pagador === "client") return "Cliente";
  if (["share", "sharebrasil", "share_brasil"].includes(pagador)) return "Share Brasil";
  if (pagador === "tripulante_1" || pagador === "tripulante1") return "Tripulante 1";
  if (pagador === "tripulante_2" || pagador === "tripulante2") return "Tripulante 2";
  return "Não informado";
}

function pertenceAoPagador(valor: unknown, pagador: "cliente" | "sharebrasil") {
  const normalizado = normalizarPagador(valor);
  return pagador === "cliente"
    ? normalizado === "cliente" || normalizado === "client"
    : ["share", "sharebrasil", "share_brasil"].includes(normalizado);
}

export default function AprovacaoRelatorioViagem() {
  const token = new URLSearchParams(window.location.search).get("token") || window.location.pathname.split("/").pop() || "";
  const [data, setData] = useState<any>(null);
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState("Carregando relatório...");
  const [enviando, setEnviando] = useState(false);
  const [mostrarComprovantes, setMostrarComprovantes] = useState(false);
  const [pagadorSelecionado, setPagadorSelecionado] = useState<"cliente" | "sharebrasil" | null>(null);

  useEffect(() => {
    setData(null);
    setMensagem("Carregando relatório...");
    setPagadorSelecionado(null);
    setMostrarComprovantes(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
  const aprovadoEm = data?.tripulante_pos === 1
    ? data?.relatorio?.aprovado_tripulante_1_em || data?.relatorio?.aprovado_tripulante_em
    : data?.relatorio?.aprovado_tripulante_2_em;

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
    return <main className="min-h-svh w-full overflow-x-hidden bg-[#030814] p-4 text-white sm:p-6"><div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">{mensagem}</div></main>;
  }

  const r = data.relatorio;
  const todasDespesas = Array.isArray(r.despesas) ? r.despesas : [];
  const despesas = todasDespesas.filter((d: any) => {
    const pagador = normalizarPagador(d.pago_por);
    return pagador === `tripulante_${data.tripulante_pos}` || pagador === `tripulante${data.tripulante_pos}`;
  });
  const despesasSelecionadas = pagadorSelecionado
    ? todasDespesas.filter((d: any) => pertenceAoPagador(d.pago_por, pagadorSelecionado))
    : [];
  const resumo = data.resumo || {};
  const comprovantes = r.anexos || [];
  const detalheLabel = pagadorSelecionado === "cliente" ? "Cliente" : "Share Brasil";

  return <main className="min-h-svh w-full overflow-x-hidden overscroll-y-auto bg-[#030814] p-3 text-white sm:p-6 md:p-8"><div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
    <header className="min-w-0 px-1 sm:px-0"><p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 sm:text-xs sm:tracking-[0.2em]">Share Brasil · Aprovação de despesas</p><h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">Relatório {r.numero_relatorio}</h1><p className="break-words text-xs leading-relaxed text-white/60 sm:text-sm">Voo {r.numero_voo || "—"} · Aeronave {r.aeronave_matricula || "—"} · {dataBr(r.data_inicio)} a {dataBr(r.data_fim)}</p></header>
    {decisaoRegistrada && <section className={`rounded-xl border p-4 sm:p-5 ${rejeitado ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/30 bg-emerald-400/10"}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.12em] sm:text-sm ${rejeitado ? "text-rose-200" : "text-emerald-200"}`}>{rejeitado ? "Relatório já rejeitado" : "Relatório já aprovado"}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/80">Sua decisão já foi registrada. Não é possível alterar a decisão por este link.</p>
      {statusAtual === "aprovado" && aprovadoEm && <p className="mt-3 text-sm text-emerald-100">Aprovado pelo tripulante em {dataHoraBr(aprovadoEm)}</p>}
      {rejeitado && motivoRejeicao && <p className="mt-3 break-words rounded-lg border border-white/10 bg-black/10 p-3 text-sm text-white/80"><strong>Motivo informado:</strong> {motivoRejeicao}</p>}
    </section>}
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5"><h2 className="font-semibold">Dados da viagem</h2><p className="mt-2 break-words text-sm leading-relaxed text-white/70">Rota: {r.rota || "—"}</p><p className="break-words text-sm leading-relaxed text-white/70">Tripulante {data.tripulante_pos}: {data.tripulante_pos === 1 ? r.nome_tripulante : r.nome_tripulante_2}</p></section>
    <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] p-4 sm:p-5"><h2 className="font-semibold text-cyan-100">Resumo financeiro</h2><p className="mt-1 text-xs leading-relaxed text-white/55">Toque em Cliente ou Share Brasil para ver somente os gastos pagos por essa categoria.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.08] p-3"><span className="block text-xs text-white/60">Total a receber</span><strong className="mt-1 block text-lg text-emerald-200">{moeda(resumo.total_a_receber)}</strong></div>
      {(["cliente", "sharebrasil"] as const).map((pagador) => { const selecionado = pagadorSelecionado === pagador; const label = pagador === "cliente" ? "Cliente pagou" : "Share Brasil pagou"; const valor = pagador === "cliente" ? resumo.cliente_pagou : resumo.share_brasil_pagou; return <button key={pagador} type="button" aria-expanded={selecionado} onClick={() => setPagadorSelecionado((atual) => atual === pagador ? null : pagador)} className={`group min-w-0 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selecionado ? "border-cyan-300/70 bg-cyan-300/[.14]" : "border-white/10 bg-white/[.04] hover:border-cyan-300/40 hover:bg-white/[.08]"}`}><span className="flex items-center justify-between gap-2 text-xs text-white/60"><span>{label}</span><ChevronDown size={16} className={`shrink-0 text-cyan-200 transition-transform ${selecionado ? "rotate-180" : ""}`} /></span><strong className="mt-1 block text-lg">{moeda(valor)}</strong><span className="mt-1 block text-[11px] text-cyan-100/70">{selecionado ? "Ocultar gastos" : "Ver gastos"}</span></button>; })}
    </div></section>
    {pagadorSelecionado && <section className="overflow-hidden rounded-xl border border-cyan-300/25 bg-cyan-300/[.05]" aria-live="polite"><div className="border-b border-cyan-300/15 p-4 sm:p-5"><div className="flex items-start gap-3"><ReceiptText className="mt-0.5 shrink-0 text-cyan-200" size={18} /><div className="min-w-0"><h2 className="font-semibold">Gastos pagos por {detalheLabel}</h2><p className="mt-1 text-xs leading-relaxed text-white/55">Confira cada gasto e o responsável pelo pagamento.</p></div></div></div><div className="divide-y divide-white/10">{despesasSelecionadas.map((d: any, i: number) => <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5" key={d.id || i}><div className="min-w-0"><p className="break-words font-medium">{d.descricao || d.categoria || "Despesa"}</p><p className="break-words text-xs leading-relaxed text-white/50">{dataBr(d.data)} · {d.categoria || "Outros"}</p><p className="mt-1 text-xs text-cyan-100/75">Pago por: {nomePagador(d.pago_por)}</p></div><strong className="shrink-0 text-left text-base sm:text-right">{moeda(d.valor)}</strong></div>)}{!despesasSelecionadas.length && <p className="p-4 text-sm text-white/60 sm:p-5">Nenhum gasto encontrado para esta categoria.</p>}</div></section>}
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5"><div className="border-b border-white/10 p-4 sm:p-5"><h2 className="font-semibold">Suas despesas</h2></div><div className="divide-y divide-white/10">{despesas.map((d: any, i: number) => <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5" key={d.id || i}><div className="min-w-0"><p className="break-words font-medium">{d.descricao || d.categoria || "Despesa"}</p><p className="break-words text-xs leading-relaxed text-white/50">{dataBr(d.data)} · {d.categoria || "Outros"}</p></div><strong className="shrink-0 text-left sm:text-right">{moeda(d.valor)}</strong></div>)}{!despesas.length && <p className="p-4 text-sm text-white/60 sm:p-5">Nenhuma despesa atribuída a você.</p>}</div></section>
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5"><button type="button" onClick={() => setMostrarComprovantes((aberto) => !aberto)} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/[.04] sm:p-5"><span className="min-w-0"><strong className="block">Ver comprovantes</strong><span className="block break-words text-xs text-white/55">{comprovantes.length ? `${comprovantes.length} arquivo(s) anexado(s)` : "Nenhum comprovante anexado"}</span></span><span className="shrink-0 text-sm text-cyan-200">{mostrarComprovantes ? "Fechar" : "Abrir"}</span></button>{mostrarComprovantes && <div className="border-t border-white/10 p-3 sm:p-4">{comprovantes.length ? <div className="grid gap-2">{comprovantes.map((anexo: any) => <a key={anexo.id} href={`${API_BASE}${anexo.url_arquivo}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3 text-sm hover:border-cyan-300/40"><span className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-cyan-200">{anexo.tipo_arquivo?.startsWith("image/") ? <FileImage size={16} /> : <FileText size={16} />}</span><span className="min-w-0 break-words">{anexo.nome_arquivo || "Comprovante"}</span></span><ExternalLink className="shrink-0 text-white/60" size={15} /></a>)}</div> : <p className="p-1 text-sm text-white/60">Nenhum comprovante disponível para este relatório.</p>}</div>}</section>
    {!decisaoRegistrada && <><Textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo (obrigatório se rejeitar)" className="min-h-24 resize-y bg-white/5 text-white" /><div className="flex flex-col gap-3 sm:flex-row"><Button disabled={enviando} onClick={() => void decidir(true)} className="w-full justify-center whitespace-normal text-center bg-emerald-600 hover:bg-emerald-500 sm:w-auto">Aprovar minhas despesas</Button><Button disabled={enviando} variant="outline" onClick={() => void decidir(false)} className="w-full justify-center whitespace-normal text-center border-rose-400/50 text-rose-200 sm:w-auto">Rejeitar e informar motivo</Button></div></>}
    {mensagem && <p className="break-words pb-2 text-sm text-cyan-200">{mensagem}</p>}
  </div></main>;
}
