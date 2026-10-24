import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Plane, Radio } from "lucide-react";
import { buscarRotaerOperacao, type SolicitacaoVooInterna, type VooEmOperacao } from "@/lib/colaborador-api";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";

const MapaVoo = lazy(() => import("@/components/dashboard/operacoes/VooEmOperacaoMapa"));
type Coordenada = { lat: number; lon: number };

function coordenadaHorario(valor: string | null) {
  if (!valor) return "A definir";
  const texto = valor.replace(" ", "T");
  const instante = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`);
  return Number.isNaN(instante.getTime()) ? "A definir" : `${instante.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`;
}

function buscarCoordenada(codigo: string | null | undefined): Promise<Coordenada | null> {
  if (!codigo) return Promise.resolve(null);
  return buscarRotaerOperacao(codigo)
    .then((resposta) => {
      const coordenadas = resposta.airport?.coordinates;
      return coordenadas && Number.isFinite(coordenadas.lat) && Number.isFinite(coordenadas.lng)
        ? { lat: coordenadas.lat!, lon: coordenadas.lng! }
        : null;
    })
    .catch(() => null);
}

export default function AcompanhamentoVooAgendado({ item }: { item: SolicitacaoVooInterna }) {
  const { voos } = useVoosEmOperacao();
  const [origemCoord, setOrigemCoord] = useState<Coordenada | null>(null);
  const [destinoCoord, setDestinoCoord] = useState<Coordenada | null>(null);
  const vooAoVivo = voos.find((voo) => voo.id === item.id) || null;

  useEffect(() => {
    let ativo = true;
    void Promise.all([buscarCoordenada(item.origem), buscarCoordenada(item.destino)]).then(([origem, destino]) => {
      if (!ativo) return;
      setOrigemCoord(origem);
      setDestinoCoord(destino);
    });
    return () => { ativo = false; };
  }, [item.origem, item.destino]);

  const dadosMapa = useMemo<VooEmOperacao>(() => ({
    id: item.id,
    numero_voo: item.numero_voo,
    status: vooAoVivo?.status || "em_solo",
    aeronave_id: item.aeronave_id,
    matricula_registro: item.matricula_registro,
    modelo: item.modelo,
    icao_hex: vooAoVivo?.icao_hex || null,
    origem: item.origem,
    destino: item.destino,
    origem_coord: vooAoVivo?.origem_coord || origemCoord,
    destino_coord: vooAoVivo?.destino_coord || destinoCoord,
    horario_previsto_agendamento: item.horario_previsto_agendamento,
    cotista_nome: item.socio_nome || item.cliente_razao_social || null,
    piloto_nome: item.piloto_nome || null,
    copiloto_nome: item.copiloto_nome || null,
    rastreio: vooAoVivo?.rastreio || null,
    rastreio_status: vooAoVivo?.rastreio_status || "indisponivel",
    trilha: vooAoVivo?.trilha || [],
  }), [destinoCoord, item, origemCoord, vooAoVivo]);

  const sinalAoVivo = vooAoVivo?.rastreio_status === "ao_vivo" && Boolean(vooAoVivo.rastreio);
  const vooRegistradoEmOperacao = vooAoVivo?.status === "em_voo";
  const temRota = Boolean(dadosMapa.origem_coord || dadosMapa.destino_coord);

  return <section className="overflow-hidden rounded-xl border border-sky-400/25 bg-sky-400/[.04]" aria-label="Acompanhamento do voo selecionado">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
      <div className="flex items-center gap-2"><Plane size={15} className="text-sky-300" /><div><h3 className="text-xs font-bold">Acompanhamento do voo {item.numero_voo || "programado"}</h3><p className="mt-0.5 text-[9px] text-muted-foreground">{sinalAoVivo ? "Posição ADS-B ao vivo" : vooRegistradoEmOperacao ? "Rastreamento sem sinal recente" : "Prévia da rota prevista"}</p></div></div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold ${sinalAoVivo ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-sky-400/25 bg-sky-400/10 text-sky-200"}`}><Radio size={11} />{sinalAoVivo ? "Ao vivo" : vooRegistradoEmOperacao ? "Sem sinal" : "Aguardando decolagem"}</span>
    </header>
    <div className="grid gap-2 border-b border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-border/60 bg-background/30 p-2.5"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><MapPin size={11} />Rota</span><strong className="mt-1 block font-mono text-[11px]">{item.origem} → {item.destino}</strong></div>
      <div className="rounded-lg border border-border/60 bg-background/30 p-2.5"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><CalendarDays size={11} />Data</span><strong className="mt-1 block text-[11px]">{new Date(`${item.data_agendada.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}</strong></div>
      <div className="rounded-lg border border-border/60 bg-background/30 p-2.5"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 size={11} />Decolagem programada</span><strong className="mt-1 block font-mono text-[11px]">{coordenadaHorario(item.horario_previsto_agendamento)}</strong></div>
      <div className="rounded-lg border border-border/60 bg-background/30 p-2.5"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Plane size={11} />Aeronave</span><strong className="mt-1 block truncate font-mono text-[11px]">{item.matricula_registro || "A definir"}{item.modelo ? ` · ${item.modelo}` : ""}</strong></div>
    </div>
    {temRota ? <Suspense fallback={<div className="h-[240px] animate-pulse bg-secondary/40" />}><MapaVoo voo={dadosMapa} /></Suspense> : <div className="flex h-32 items-center justify-center px-4 text-center text-[10px] text-muted-foreground">Coordenadas dos aeródromos ainda não disponíveis para desenhar a rota.</div>}
    <p className="border-t border-border/60 px-3 py-2 text-[9px] text-muted-foreground">{sinalAoVivo ? `Aeronave ${item.matricula_registro || "identificada"} · sinal atualizado há ${Math.max(0, Math.round(vooAoVivo?.rastreio?.visto_ha_s || 0))} s.` : vooRegistradoEmOperacao ? "A linha tracejada indica a rota planejada. Sem posição recente; cobertura ADS-B e identificação da aeronave podem afetar o rastreamento." : "A linha tracejada indica a rota planejada. A posição da aeronave aparecerá quando o ADS-B confirmar a decolagem; mapa depende de cobertura e identificação válidas."}</p>
  </section>;
}
