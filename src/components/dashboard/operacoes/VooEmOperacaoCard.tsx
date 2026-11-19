import { lazy, Suspense, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Plane, Radio, Satellite } from "lucide-react";
import { CabecalhoSecao, EtiquetaStatus } from "@/components/dashboard/ComponentesDashboard";
import { distanciaNM } from "@/lib/navegacao";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";
import HistoricoRastreioVoo from './HistoricoRastreioVoo';
import { vooComSinalNoAr } from '@/lib/rastreio';
import type { StatusRastreio, VooEmOperacao } from "@/lib/colaborador-api";

const MapaRastreio = lazy(() => import("./VooEmOperacaoMapa"));
const tons: Record<StatusRastreio, "green" | "amber" | "red" | "blue" | "neutral"> = { ao_vivo: "green", atrasado: "amber", sem_sinal: "red", sem_identificador: "neutral", indisponivel: "amber" };
const rotulos: Record<StatusRastreio, string> = { ao_vivo: "Ao vivo", atrasado: "Atrasado", sem_sinal: "Sem sinal", sem_identificador: "Sem identificador", indisponivel: "Indisponível" };

function horario(valor: string | null) {
  if (!valor) return { utc: "—", brasilia: "—" };
  const texto = String(valor).trim();
  const data = /^\d{4}-\d{2}-\d{2}T/.test(texto) ? new Date(texto) : (() => {
    const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return partes ? new Date(Date.UTC(1970, 0, 1, Number(partes[1]), Number(partes[2]), Number(partes[3] || 0))) : new Date(NaN);
  })();
  if (Number.isNaN(data.getTime())) return { utc: "—", brasilia: "—" };
  return {
    utc: data.toISOString().slice(11, 16),
    brasilia: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(data),
  };
}
function desde(valor: number | null | undefined) { if (valor == null) return "—"; return `${Math.max(0, Math.round(valor))}s`; }
function valor(valor: number | null | undefined, sufixo = "") { return valor == null ? "—" : `${Math.round(valor).toLocaleString("pt-BR")}${sufixo}`; }
function emVoo(status: VooEmOperacao["status"]) { return status === "decolado" || status === "em_voo"; }
function textoStatus(status: VooEmOperacao["status"]) {
  if (status === "aguardando") return "Agendado";
  if (status === "encerrada") return "Encerrado";
  if (status === "acionado") return "Acionado";
  if (status === "em_solo") return "Em solo";
  return "Decolado";
}
function tomStatus(status: VooEmOperacao["status"]): "green" | "amber" | "blue" {
  return status === "acionado" ? "amber" : status === "em_solo" ? "green" : "blue";
}

function Telemetria({ voo }: { voo: VooEmOperacao }) {
  const destino = voo.destino_coord && voo.rastreio ? distanciaNM(voo.rastreio, voo.destino_coord) : null;
  const etaMin = destino != null && (voo.rastreio?.gs_kt || 0) >= 40 ? (destino / voo.rastreio!.gs_kt!) * 60 : null;
  const eta = etaMin == null ? null : new Date(Date.now() + etaMin * 60_000).toISOString();
  const campos = [["ALT", valor(voo.rastreio?.alt_ft, " ft")], ["GS", valor(voo.rastreio?.gs_kt, " kt")], ["RUMO", valor(voo.rastreio?.rumo_graus, "°")], ["VS", valor(voo.rastreio?.vs_fpm, " fpm")], ["DIST.", destino == null ? "—" : `${destino.toFixed(1)} NM`]];
  return <div className="grid grid-cols-2 gap-2 border-t border-border/70 p-3 sm:grid-cols-5">{campos.map(([label, item]) => <div key={label}><p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xs font-bold">{item}</p></div>)}<div className="col-span-2 sm:col-span-5"><p className="text-[9px] font-bold uppercase text-muted-foreground">ETA estimativa em linha reta</p><p className="mt-1 font-mono text-[10px]">{eta ? `${horario(eta).utc} UTC · ${horario(eta).brasilia} Brasília` : "—"}</p></div></div>;
}

function VooCard({ voo, aoAbrir }: { voo: VooEmOperacao; aoAbrir: () => void }) {
  const [aberto, setAberto] = useState(true);
  const sinal = voo.rastreio_status;
  const planejado = horario(voo.horario_previsto_agendamento);
  const decolou = emVoo(voo.status);
  const aoVivo = vooComSinalNoAr(voo);
  return <article className="overflow-hidden rounded-2xl border border-border bg-card">
    <header className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2"><Plane size={15} className="shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-bold">{voo.matricula_registro || "Aeronave"} · {voo.origem || "—"} → {voo.destino || "—"}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{voo.numero_voo || "Voo sem número"} · {voo.modelo || "Modelo não informado"}</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><EtiquetaStatus tone={tomStatus(voo.status)}>{textoStatus(voo.status)}</EtiquetaStatus><EtiquetaStatus tone={tons[sinal]}>{rotulos[sinal]}</EtiquetaStatus><button type="button" aria-label={aberto ? "Recolher voo" : "Expandir voo"} onClick={() => setAberto((valorAtual) => !valorAtual)} className="rounded p-1 text-muted-foreground hover:bg-secondary">{aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></div>
    </header>
    {aberto && <>
      <div className="grid items-start gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,400px)]">
        <div className="min-w-0 space-y-3">
          <p className="text-[10px] text-muted-foreground">Programado: {planejado.utc} UTC · {planejado.brasilia} Brasília</p>
          <HistoricoRastreioVoo voo={voo} />
          {decolou && !aoVivo && <p className="text-[10px] text-muted-foreground">Sem posição recente nas fontes ADS-B consultadas. A cobertura pode ser diferente da exibida no Flightradar24; consulte o histórico de sinais.</p>}
          {aoVivo && <Telemetria voo={voo} />}
        </div>
        <aside className="min-w-0 overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border px-3 py-2 text-[10px] font-semibold">{aoVivo ? "Rastreio ao vivo" : "Histórico · trajeto percorrido"}</p>
          {aoVivo || Boolean(voo.trilha?.length) ? <Suspense fallback={<div className="h-[220px] animate-pulse bg-secondary/40" />}><MapaRastreio key={`${voo.id}-${aoVivo}`} voo={voo} historico={!aoVivo} compacto={!aoVivo} /></Suspense> : <p className="p-4 text-[10px] text-muted-foreground">Nenhum percurso ADS-B registrado para este agendamento.</p>}
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5 text-[10px] text-muted-foreground"><span><Radio size={11} className="mr-1 inline" />{voo.cotista_nome || "Cotista não informado"} · {voo.piloto_nome || "Piloto não informado"}{voo.copiloto_nome ? ` / ${voo.copiloto_nome}` : ""}</span><span>{voo.fonte_rastreio ? `Fonte: ${voo.fonte_rastreio === "airplanes_live" ? "airplanes.live" : voo.fonte_rastreio === "adsb_lol" ? "adsb.lol" : voo.fonte_rastreio} · ` : ""}Idade da posição: {desde(voo.rastreio?.visto_ha_s)} <button type="button" onClick={aoAbrir} className="ml-2 inline-flex items-center gap-1 font-bold text-primary hover:underline">Abrir agendamento <ExternalLink size={11} /></button></span></div>
    </>}
  </article>;
}

export default function VooEmOperacaoCard({ aoNavegar }: { aoNavegar: () => void }) {
  const { voos } = useVoosEmOperacao();
  if (!voos.length) return null;
  const temVooAoVivo = voos.some(vooComSinalNoAr);
  return <section className="mb-6 space-y-3"><CabecalhoSecao icon={<span className="relative block"><Satellite size={15} />{temVooAoVivo && <span className="absolute -right-1 -top-1 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />}</span>} title="Voo em operação" detail={`${voos.length} operação(ões) em acompanhamento`} /><div className="space-y-3">{voos.map((voo) => <VooCard key={voo.id} voo={voo} aoAbrir={aoNavegar} />)}</div></section>;
}
