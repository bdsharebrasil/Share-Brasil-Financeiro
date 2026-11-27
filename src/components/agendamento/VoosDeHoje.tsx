import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarHistoricoRastreio, type SolicitacaoVooInterna, type VooEmOperacao } from "@/lib/colaborador-api";
import HistoricoRastreioVoo from "@/components/dashboard/operacoes/HistoricoRastreioVoo";
import { horarioRastreio, vooComSinalNoAr } from "@/lib/rastreio";

const MapaVoo = lazy(() => import("@/components/dashboard/operacoes/VooEmOperacaoMapa"));

type Props = {
  item: SolicitacaoVooInterna;
  voosEmOperacao: VooEmOperacao[];
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
};

function dataBR(data?: string | null) {
  if (!data) return "Data não informada";
  const d = new Date(`${data.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? data : d.toLocaleDateString("pt-BR");
}

function diaUTC(valor?: string | null) {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const texto = valor.trim().replace(" ", "T");
  const data = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`);
  return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
}

function diaCurto(data: string) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

export default function VoosDeHoje({ item, voosEmOperacao, carregandoAoVivo, erroAoVivo, atualizadoAoVivo }: Props) {
  const [modo, setModo] = useState<"ao-vivo" | "historico">("ao-vivo");
  const [pernaSelecionadaId, setPernaSelecionadaId] = useState("todas");
  const [historico, setHistorico] = useState<VooEmOperacao | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState("");
  const vooAoVivo = voosEmOperacao.find((voo) => voo.id === item.id);

  useEffect(() => {
    let ativo = true;
    setCarregandoHistorico(true);
    setErroHistorico("");
    setHistorico(null);
    void buscarHistoricoRastreio(item.id).then((voo) => { if (ativo) setHistorico(voo); })
      .catch(() => { if (ativo) setErroHistorico("Não foi possível carregar o histórico deste voo."); })
      .finally(() => { if (ativo) setCarregandoHistorico(false); });
    return () => { ativo = false; };
  }, [item.id, item.status, item.atualizado_em]);

  const vooSelecionado = useMemo(() => {
    if (!vooAoVivo) return historico;
    if (!historico) return vooAoVivo;
    const pernas = new Map(historico.pernas.map((perna) => [perna.id, perna]));
    vooAoVivo.pernas.forEach((perna) => pernas.set(perna.id, perna));
    const trilha = new Map((historico.trilha || []).map((ponto) => [`${ponto.trilha_id}:${ponto.registrado_em}:${ponto.lat}:${ponto.lon}`, ponto]));
    (vooAoVivo.trilha || []).forEach((ponto) => trilha.set(`${ponto.trilha_id}:${ponto.registrado_em}:${ponto.lat}:${ponto.lon}`, ponto));
    return { ...historico, ...vooAoVivo, pernas: [...pernas.values()], trilha: [...trilha.values()].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)), eventos_rastreio: vooAoVivo.eventos_rastreio?.length ? vooAoVivo.eventos_rastreio : historico.eventos_rastreio };
  }, [historico, vooAoVivo]);
  const pernasSelecionadas = useMemo(() => {
    if (!vooSelecionado) return [];
    const pernas = [...vooSelecionado.pernas];
    if (vooSelecionado.perna_atual && !pernas.some((perna) => perna.id === vooSelecionado.perna_atual?.id)) pernas.push(vooSelecionado.perna_atual);
    return pernas;
  }, [vooSelecionado]);
  const pernaAtualDetectada = Boolean(vooSelecionado?.perna_atual && !vooSelecionado.pernas.some((perna) => perna.id === vooSelecionado.perna_atual?.id));
  const dataPerna = (perna: (typeof pernasSelecionadas)[number]) => {
    const sinal = vooSelecionado?.trilha?.filter((ponto) => ponto.trilha_id === perna.id).at(-1)?.registrado_em;
    return dataBR(perna.horario_dep || perna.horario_ac || perna.horario_pouso || sinal || vooSelecionado?.horario_previsto_agendamento);
  };
  const trechosSistema = useMemo(() => {
    if (!vooSelecionado) return [];
    const diasRegistrados = new Set(pernasSelecionadas.map((perna) => diaUTC(perna.horario_dep || perna.horario_ac || perna.horario_pouso || perna.horario_corte)).filter((dia): dia is string => Boolean(dia)));
    const porDia = new Map<string, { horarios: Set<string>; sinais: number; pontos: number }>();
    const adicionar = (valor: string | null | undefined, tipo?: string) => {
      const dia = diaUTC(valor);
      if (!dia || !valor) return;
      const atual = porDia.get(dia) || { horarios: new Set<string>(), sinais: 0, pontos: 0 };
      atual.horarios.add(valor);
      if (tipo === "SINAL_RECEBIDO") atual.sinais += 1;
      if (tipo === "PONTO") atual.pontos += 1;
      porDia.set(dia, atual);
    };
    for (const evento of vooSelecionado.eventos_rastreio || []) adicionar(evento.ocorrido_em, evento.tipo);
    for (const ponto of vooSelecionado.trilha || []) adicionar(ponto.registrado_em, "PONTO");
    return [...porDia.entries()].filter(([dia, dados]) => !diasRegistrados.has(dia) && (dados.sinais >= 2 || dados.pontos >= 2))
      .map(([dia, dados]) => {
        const horarios = [...dados.horarios].map((horario) => {
          const texto = horario.trim().replace(" ", "T");
          return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`);
        }).filter((data) => !Number.isNaN(data.getTime())).sort((a, b) => a.getTime() - b.getTime());
        return { dia, inicio: horarios[0]?.toISOString(), fim: horarios.at(-1)?.toISOString() };
      }).filter((trecho) => Boolean(trecho.inicio && trecho.fim)).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [vooSelecionado, pernasSelecionadas]);

  const aoVivo = Boolean(vooAoVivo && vooComSinalNoAr(vooAoVivo));
  const vooMapa = modo === "ao-vivo" ? vooAoVivo || vooSelecionado : vooSelecionado;
  const pernaMapa = modo === "ao-vivo" ? vooMapa?.perna_atual?.id : pernaSelecionadaId === "todas" ? undefined : pernaSelecionadaId;

  return <div className="space-y-4">
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4" aria-label="Mapa do voo selecionado">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">Monitoramento de voo</h3>
        <div role="group" aria-label="Visualização do mapa" className="flex gap-1.5 rounded-lg border border-border bg-secondary/40 p-1">
          <button type="button" aria-pressed={modo === "ao-vivo"} onClick={() => setModo("ao-vivo")} className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${modo === "ao-vivo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Radio size={13} />Ao vivo</button>
          <button type="button" aria-pressed={modo === "historico"} onClick={() => setModo("historico")} className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${modo === "historico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Histórico da rota</button>
        </div>
      </header>
      {modo === "historico" && (
        <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs font-semibold text-muted-foreground">Perna do voo</span>
          <Select value={pernaSelecionadaId} onValueChange={setPernaSelecionadaId}>
            <SelectTrigger aria-label="Perna do voo" className="h-10 max-w-md rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Percurso completo · todas as pernas</SelectItem>
              {pernasSelecionadas.map((perna, indice) => (
                <SelectItem key={perna.id} value={perna.id}>
                  {indice + 1} · {perna.origem} → {perna.destino} · {dataPerna(perna)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {vooMapa ? <Suspense fallback={<p className="py-12 text-center text-xs text-muted-foreground">Carregando mapa...</p>}><MapaVoo key={`${item.id}-${modo}-${pernaMapa || "todas"}`} voo={vooMapa} pernaId={pernaMapa} historico={modo === "historico" || !aoVivo} altura={460} /></Suspense>
        : <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-muted-foreground"><MapPin size={28} /><strong className="text-sm text-foreground">{carregandoHistorico || carregandoAoVivo ? "Carregando percurso..." : "Aguardando posições do voo"}</strong><p className="max-w-md text-xs">O mapa será exibido quando houver coordenadas ou posições registradas para esta operação.</p></div>}
    </section>

    <section className="rounded-xl border border-border bg-secondary/20 p-4" aria-label="Informações de monitoramento">
      <h4 className="text-sm font-bold text-foreground">{item.numero_voo || "Voo selecionado"} · {item.matricula_registro || "Aeronave a definir"}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{aoVivo ? "Sinal ao vivo disponível" : "Sem sinal ADS-B ao vivo neste momento"} · {atualizadoAoVivo ? `Última consulta ${new Date(atualizadoAoVivo).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Aguardando atualização"}</p>
      {erroAoVivo && <p role="status" className="mt-1 text-xs text-red-700 dark:text-red-300">Não foi possível atualizar o rastreio: {erroAoVivo}</p>}
      {erroHistorico && <p role="status" className="mt-1 text-xs text-red-700 dark:text-red-300">{erroHistorico}</p>}
    </section>

    {vooSelecionado && (
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Trechos e horários registrados · UTC</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="text-muted-foreground"><tr>
              {["Trecho", "AC", "DEP", "POU", "COR"].map((titulo) => (
                <th key={titulo} className="px-2 py-1.5 font-semibold">{titulo}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...pernasSelecionadas].sort((a, b) => (diaUTC(a.horario_dep || a.horario_ac || a.horario_pouso || a.horario_corte) || "").localeCompare(diaUTC(b.horario_dep || b.horario_ac || b.horario_pouso || b.horario_corte) || "")).map((perna) => (
                <tr key={perna.id} className="border-t border-border/70">
                  <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold"><span className="mr-1.5 text-muted-foreground">{dataPerna(perna)}</span>{perna.origem} → {perna.destino}{pernaAtualDetectada && perna.id === vooSelecionado.perna_atual?.id && <span className="mt-0.5 block font-sans text-[11px] font-normal text-primary">Trecho detectado pelo sistema · {dataPerna(perna)}</span>}</td>
                  {[perna.horario_ac, perna.horario_dep, perna.horario_pouso, perna.horario_corte].map((horario, idx) => (
                    <td key={idx} className="whitespace-nowrap px-2 py-2 font-mono">{horarioRastreio(horario).replace(" UTC", "")}</td>
                  ))}
                </tr>
              ))}
              {trechosSistema.map((trecho) => (
                <tr key={`sistema-${trecho.dia}`} className="border-t border-primary/20 bg-primary/[.04]">
                  <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold text-primary">{diaCurto(trecho.dia)} · Trecho detectado pelo sistema</td>
                  <td colSpan={4} className="px-2 py-2 text-[11px] text-muted-foreground">
                    {horarioRastreio(trecho.inicio)} – {horarioRastreio(trecho.fim)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!vooSelecionado.rastreio && (
          <p className="mt-2.5 text-xs text-muted-foreground">
            Os horários acima foram informados pela tripulação. A rota tracejada no mapa é prevista, não um percurso confirmado.
          </p>
        )}
        <div className="mt-4 border-t border-border/70 pt-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico de sinais ADS-B</h4>
          <HistoricoRastreioVoo voo={vooSelecionado} />
        </div>
      </div>
    )}
  </div>;
}
