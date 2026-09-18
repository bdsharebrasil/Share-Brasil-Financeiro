import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoSecao, EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { buscarGestaoTripulacao, type AeronaveTripulacao, type FreelancerTripulacao, type HabilitacaoTripulante, type TripulanteGestao } from "@/lib/colaborador-api";
import { CrewCard, CrewProfile, situacaoHabilitacoes } from "@/pages/GestaoTripulacaoCards";
import GestaoTripulacaoExternos from "@/components/GestaoTripulacaoExternos";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";

function isActive(status: string | null) { return (status || "ativo").toLowerCase() === "ativo"; }

export default function GestaoTripulacao({ aoVoltar }: { aoVoltar?: () => void; aoNavegar?: (menu: string) => void }) {
  const [tab, setTab] = useState<"share" | "externos">("share");
  const [data, setData] = useState<{ tripulantes: TripulanteGestao[]; habilitacoes: HabilitacaoTripulante[]; freelancers: FreelancerTripulacao[]; aeronaves: AeronaveTripulacao[] }>({ tripulantes: [], habilitacoes: [], freelancers: [], aeronaves: [] });
  const [selected, setSelected] = useState<TripulanteGestao | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);
  const load = () => { setLoading(true); void buscarGestaoTripulacao().then((result) => { setData({ tripulantes: Array.isArray(result?.tripulantes) ? result.tripulantes : [], habilitacoes: Array.isArray(result?.habilitacoes) ? result.habilitacoes : [], freelancers: Array.isArray(result?.freelancers) ? result.freelancers : [], aeronaves: Array.isArray(result?.aeronaves) ? result.aeronaves : [] }); }).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar a tripulação.")).finally(() => setLoading(false)); };
  useEffect(load, []);
  const ativos = useMemo(() => (data?.tripulantes || []).filter((crew) => isActive(crew.status)), [data]);
  const habsPorTripulante = useMemo(() => { const map = new Map<string, HabilitacaoTripulante[]>(); for (const item of data?.habilitacoes || []) { const list = map.get(item.tripulacao_id) || []; list.push(item); map.set(item.tripulacao_id, list); } return map; }, [data]);
  const selectedHabs = useMemo(() => (selected ? habsPorTripulante.get(selected.id) : []) || [], [habsPorTripulante, selected]);
  return <div className="route-enter space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><IndicadorPagina>Operações / Tripulação</IndicadorPagina><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Gestão Tripulação</h1><p className="mt-1.5 text-xs text-muted-foreground">Controle de tripulantes Share Brasil, externos, habilitações e horas voadas.</p></div>{aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 text-xs">Voltar</Button>}</div>{(error || ok) && <div className={error ? "rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" : "rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-200"}>{error || ok}</div>}<div className="flex flex-wrap gap-2 border-b border-border"><Tab active={tab === "share"} onClick={() => { setTab("share"); setSelected(null); }} icon={<UserRound size={14} />} label="Tripulantes Share Brasil" /><Tab active={tab === "externos"} onClick={() => setTab("externos")} icon={<UserRound size={14} />} label="Tripulantes externos" /></div>{loading ? <div className={`${card} p-6 text-xs text-muted-foreground`}>Carregando gestão de tripulação...</div> : tab === "share" ? (!selected ? <div className="space-y-4"><p className="text-sm font-extrabold">{ativos.length} tripulantes encontrados</p>{ativos.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{ativos.map((crew) => <CrewCard key={crew.id} crew={crew} situacao={situacaoHabilitacoes(habsPorTripulante.get(crew.id) || [])} onClick={() => { setSelected(crew); setOk(null); setError(null); }} />)}</div> : <EstadoVazio label="Nenhum tripulante Share Brasil ativo" />}</div> : <CrewProfile key={selected.id} crew={selected} habilitations={selectedHabs} onBack={() => { setSelected(null); setError(null); }} onChanged={load} />) : tab === "externos" ? <GestaoTripulacaoExternos freelancers={data?.freelancers ?? []} aeronaves={data?.aeronaves ?? []} onChanged={load} onError={setError} onOk={setOk} /> : null}</div>;
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onClick} className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-[10px] font-bold transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{icon}{label}</button>; }
