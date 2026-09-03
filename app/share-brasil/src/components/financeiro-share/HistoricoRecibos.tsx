import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, ExternalLink, FileText, FolderOpen, Paperclip, Search, SlidersHorizontal, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus } from "@/components/dashboard/PrimitivosDashboard";
import type { Recibo as ReciboFinanceiro } from "@/lib/colaborador-api";

export type FiltrosHistoricoRecibos = {
  q?: string;
  data_inicial?: string;
  data_final?: string;
};

type Props = {
  recibos: ReciboFinanceiro[];
  carregando: boolean;
  onBuscar: (filtros: FiltrosHistoricoRecibos) => Promise<void>;
  onConfirmarReembolso: (id: string) => void | Promise<void>;
  onCancelar: (id: string) => void | Promise<void>;
};

type PastaMes = {
  chave: string;
  titulo: string;
  total: number;
  valorTotal: number;
  recibos: ReciboFinanceiro[];
};

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function dataBr(valor: string | null) {
  return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

function chaveMes(recibo: ReciboFinanceiro) {
  return String(recibo.data_emissao || recibo.criado_em || "").slice(0, 7) || "sem-data";
}

function tituloMes(chave: string) {
  if (chave === "sem-data") return "Sem data";
  const data = new Date(`${chave}-01T00:00:00`);
  const titulo = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return titulo.charAt(0).toUpperCase() + titulo.slice(1);
}

function tomStatus(status: ReciboFinanceiro["status"]) {
  if (status === "emitido" || status === "reembolsado") return "green" as const;
  if (status === "aguardando_reembolso") return "amber" as const;
  if (status === "cancelado") return "red" as const;
  return "neutral" as const;
}

function rotuloStatus(status: ReciboFinanceiro["status"]) {
  return ({ emitido: "Emitido", aguardando_reembolso: "Aguardando reembolso", reembolsado: "Reembolsado", cancelado: "Cancelado" } as Record<string, string>)[status] || status;
}

function rotuloTipo(tipo: ReciboFinanceiro["tipo_recibo"]) {
  return ({ cliente_reembolsavel: "Reembolso", colaborador: "Colaborador", pagamento: "Pagamento", cliente_direto: "Cliente" } as Record<string, string>)[tipo] || tipo.replace(/_/g, " ");
}

export default function HistoricoRecibos({ recibos, carregando, onBuscar, onConfirmarReembolso, onCancelar }: Props) {
  const [filtros, setFiltros] = useState<FiltrosHistoricoRecibos>({ q: "", data_inicial: "", data_final: "" });
  const [mesAberto, setMesAberto] = useState<string | null>(null);

  const pastas = useMemo<PastaMes[]>(() => {
    const grupos = new Map<string, ReciboFinanceiro[]>();
    recibos.forEach((recibo) => {
      const chave = chaveMes(recibo);
      const grupo = grupos.get(chave) || [];
      grupo.push(recibo);
      grupos.set(chave, grupo);
    });
    return Array.from(grupos.entries())
      .map(([chave, itens]) => ({
        chave,
        titulo: tituloMes(chave),
        total: itens.length,
        valorTotal: itens.reduce((total, item) => total + Number(item.valor || 0), 0),
        recibos: itens,
      }))
      .sort((a, b) => b.chave.localeCompare(a.chave));
  }, [recibos]);

  useEffect(() => {
    if (mesAberto && !pastas.some((pasta) => pasta.chave === mesAberto)) setMesAberto(null);
  }, [mesAberto, pastas]);

  const pastaSelecionada = pastas.find((pasta) => pasta.chave === mesAberto);
  const totalValor = recibos.reduce((total, recibo) => total + Number(recibo.valor || 0), 0);
  const temFiltro = Boolean(filtros.q?.trim() || filtros.data_inicial || filtros.data_final);

  const aplicarFiltros = async () => {
    if (filtros.data_inicial && filtros.data_final && filtros.data_inicial > filtros.data_final) return;
    await onBuscar({
      q: filtros.q?.trim() || undefined,
      data_inicial: filtros.data_inicial || undefined,
      data_final: filtros.data_final || undefined,
    });
    setMesAberto(null);
  };

  const limparFiltros = async () => {
    const limpos = { q: "", data_inicial: "", data_final: "" };
    setFiltros(limpos);
    setMesAberto(null);
    await onBuscar({});
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-border/80 bg-card/65 shadow-xl shadow-black/5">
      <div className="border-b border-border/70 bg-gradient-to-br from-secondary/45 via-card/50 to-primary/[.04] px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary"><FolderOpen size={16} /><span className="text-[10px] font-black uppercase tracking-[.2em]">Arquivo financeiro</span></div>
            <h2 className="mt-1 text-lg font-extrabold tracking-[-.035em] md:text-xl">Pastas de recibos</h2>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">Todos os recibos emitidos organizados por mês. Abra uma pasta para consultar documentos, status e ações.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[.07] px-3.5 py-2.5">
            <FileText size={16} className="text-primary" />
            <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Total arquivado</p><p className="font-mono text-sm font-black">{recibos.length} <span className="font-sans text-[10px] font-semibold text-muted-foreground">recibo(s)</span></p></div>
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 rounded-2xl border border-border/80 bg-background/35 p-2.5 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto] md:items-end">
          <label className="block md:col-span-1"><span className="mb-1.5 block px-1 text-[9px] font-black uppercase tracking-[.13em] text-muted-foreground">Buscar</span><span className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={filtros.q || ""} onChange={(event) => setFiltros((atual) => ({ ...atual, q: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void aplicarFiltros(); }} placeholder="Nome ou Nº do recibo..." className="h-10 w-full rounded-xl border border-border bg-card/80 pl-9 pr-3 text-[11px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/70" /></span></label>
          <label className="block"><span className="mb-1.5 block px-1 text-[9px] font-black uppercase tracking-[.13em] text-muted-foreground">Data inicial</span><span className="relative block"><CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" value={filtros.data_inicial || ""} onChange={(event) => setFiltros((atual) => ({ ...atual, data_inicial: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card/80 pl-9 pr-3 text-[11px] outline-none transition-colors focus:border-primary/70" /></span></label>
          <label className="block"><span className="mb-1.5 block px-1 text-[9px] font-black uppercase tracking-[.13em] text-muted-foreground">Data final</span><span className="relative block"><CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" value={filtros.data_final || ""} onChange={(event) => setFiltros((atual) => ({ ...atual, data_final: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card/80 pl-9 pr-3 text-[11px] outline-none transition-colors focus:border-primary/70" /></span></label>
          <Button type="button" onClick={() => void aplicarFiltros()} disabled={carregando || Boolean(filtros.data_inicial && filtros.data_final && filtros.data_inicial > filtros.data_final)} className="h-10 gap-2 rounded-xl px-4 text-[10px] font-bold"><SlidersHorizontal size={14} /> Filtrar</Button>
          {temFiltro && <Button type="button" variant="ghost" onClick={() => void limparFiltros()} disabled={carregando} className="h-10 gap-1.5 rounded-xl px-3 text-[10px] text-muted-foreground hover:text-foreground"><X size={13} /> Limpar</Button>}
        </div>
        {filtros.data_inicial && filtros.data_final && filtros.data_inicial > filtros.data_final && <p className="mt-2 px-1 text-[10px] font-semibold text-red-400">A data inicial precisa ser anterior à data final.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5 md:px-7">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">{temFiltro ? "Resultado da busca" : "Organização mensal"}</p><p className="mt-1 text-[11px] text-muted-foreground">{pastas.length} {pastas.length === 1 ? "pasta" : "pastas"} · <strong className="font-mono text-foreground">{moeda(totalValor)}</strong></p></div>
        {pastaSelecionada && <button type="button" onClick={() => setMesAberto(null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/10">Ver todas as pastas <ChevronRight size={13} /></button>}
      </div>

      {carregando && !recibos.length ? <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3"><div className="skeleton h-44 rounded-2xl" /><div className="skeleton h-44 rounded-2xl" /><div className="skeleton h-44 rounded-2xl" /></div> : !pastas.length ? <div className="p-7"><EstadoVazio label={temFiltro ? "Nenhum recibo encontrado para os filtros informados" : "Nenhum recibo emitido"} /></div> : !pastaSelecionada ? <div className="grid gap-x-5 gap-y-8 p-6 sm:grid-cols-2 lg:grid-cols-3 md:p-8">{pastas.map((pasta, indice) => <button key={pasta.chave} type="button" onClick={() => setMesAberto(pasta.chave)} aria-label={`Abrir pasta ${pasta.titulo}`} className="group rounded-2xl p-2 text-center transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><div className="relative mx-auto h-[130px] w-[174px] transition-transform duration-300 group-hover:scale-[1.04]"><span className="absolute left-2 top-0 z-0 h-6 w-20 rounded-t-[16px] bg-gradient-to-r from-orange-600 to-amber-500 shadow-sm" /><span className="absolute left-3 top-4 z-10 h-4 w-[154px] rounded-t-lg border border-white/30 bg-gradient-to-r from-amber-100 to-white/80 shadow-sm dark:from-white/85 dark:to-slate-200/80" /><span className="absolute inset-x-0 top-5 bottom-0 z-20 overflow-hidden rounded-[15px] border border-amber-300/70 bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 shadow-[0_14px_24px_-12px_rgba(245,158,11,.7)]"><span className="absolute inset-x-3 top-2 h-1.5 rounded-full bg-white/25" /><span className="absolute inset-x-0 bottom-0 h-9 bg-orange-500/10" /><span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border border-white/30 bg-white/25 font-mono text-sm font-black text-amber-950 shadow-inner">{pasta.total}</span></span></div><strong className={`mt-2 block text-[13px] font-extrabold tracking-[-.02em] ${indice === 0 ? "text-primary" : "text-foreground"}`}>{pasta.titulo}</strong><span className="mt-1 block text-[10px] font-medium text-muted-foreground">{moeda(pasta.valorTotal)} · clique para abrir</span></button>)}</div> : <div className="p-5 md:p-7"><div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[.06] px-4 py-3"><div className="grid h-10 w-10 place-content-center rounded-xl bg-gradient-to-br from-yellow-300 to-orange-500 text-amber-950 shadow-md"><FolderOpen size={20} /></div><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">Pasta aberta</p><h3 className="text-base font-extrabold">{pastaSelecionada.titulo}</h3></div><span className="ml-auto rounded-full border border-primary/20 bg-card/70 px-2.5 py-1 font-mono text-[10px] font-bold">{pastaSelecionada.total} recibo(s)</span></div><div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70">{pastaSelecionada.recibos.map((recibo) => <article key={recibo.id} className="flex flex-wrap items-center justify-between gap-4 bg-card/35 px-4 py-4 transition-colors hover:bg-secondary/20 md:px-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-[11px]">{recibo.numero_recibo}</strong><EtiquetaStatus tone={tomStatus(recibo.status)}>{rotuloStatus(recibo.status)}</EtiquetaStatus><span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{rotuloTipo(recibo.tipo_recibo)}</span></div><p className="mt-1 truncate text-[11px] font-bold">{recibo.nome_pagador} {recibo.recebedor_nome ? `→ ${recibo.recebedor_nome}` : ""} · {recibo.descricao_servico}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{dataBr(recibo.data_emissao)}{recibo.forma_pagamento ? ` · ${recibo.forma_pagamento}` : ""}{recibo.numero_documento_anexo ? ` · Doc. ${recibo.numero_documento_anexo}` : ""}</p>{recibo.pdf_url && <a href={recibo.pdf_url} target="_blank" rel="noreferrer" className="mt-1 mr-3 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"><FileText size={12} /> Abrir PDF <ExternalLink size={10} /></a>}{recibo.anexo_id && <a href={`/api/financeiro/recibos/anexos/${encodeURIComponent(recibo.anexo_id)}/arquivo`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"><Paperclip size={12} /> Visualizar anexo <ExternalLink size={10} /></a>}</div><div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end"><strong className="font-mono text-[11px]">{moeda(recibo.valor)}</strong><div className="flex items-center gap-1.5">{recibo.status === "aguardando_reembolso" && <Button type="button" variant="outline" onClick={() => void onConfirmarReembolso(recibo.id)} className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px]"><CheckCircle2 size={13} /> Confirmar</Button>}{recibo.status !== "cancelado" && recibo.status !== "reembolsado" && <Button type="button" variant="ghost" onClick={() => void onCancelar(recibo.id)} className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] text-red-600 hover:text-red-700 dark:text-red-300"><XCircle size={13} /> Cancelar</Button>}</div></div></article>)}</div></div>}
    </section>
  );
}
