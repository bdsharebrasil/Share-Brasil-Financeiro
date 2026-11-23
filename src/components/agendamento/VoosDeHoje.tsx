import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MapPin, Radio } from "lucide-react";
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

  return <div className="sb-monitor-selected">
    <section className="sb-monitor-map" aria-label="Mapa do voo selecionado">
      <header className="sb-monitor-map-heading">
        <h2>Monitoramento Voos</h2>
        <div role="group" aria-label="Visualização do mapa">
          <button type="button" aria-pressed={modo === "ao-vivo"} onClick={() => setModo("ao-vivo")}><Radio size={13} />Ao vivo</button>
          <button type="button" aria-pressed={modo === "historico"} onClick={() => setModo("historico")}>Histórico da rota</button>
        </div>
      </header>
      {modo === "historico" && <label className="sb-leg-select">Perna do voo
        <select value={pernaSelecionadaId} onChange={(event) => setPernaSelecionadaId(event.target.value)}>
          <option value="todas">Percurso completo · todas as pernas</option>
          {pernasSelecionadas.map((perna, indice) => <option key={perna.id} value={perna.id}>{indice + 1} · {perna.origem} → {perna.destino} · {dataPerna(perna)}</option>)}
        </select>
      </label>}
      {vooMapa ? <Suspense fallback={<p className="sb-empty">Carregando mapa...</p>}><MapaVoo key={`${item.id}-${modo}-${pernaMapa || "todas"}`} voo={vooMapa} pernaId={pernaMapa} historico={modo === "historico" || !aoVivo} altura={480} /></Suspense>
        : <div className="sb-map-empty"><MapPin size={28} /><strong>{carregandoHistorico || carregandoAoVivo ? "Carregando percurso..." : "Aguardando posições do voo"}</strong><p>O mapa será exibido quando houver coordenadas ou posições registradas para esta operação.</p></div>}
    </section>
    <section className="sb-monitor-history sb-monitor-status" aria-label="Informações de monitoramento">
      <h3>{item.numero_voo || "Voo selecionado"} · {item.matricula_registro || "Aeronave a definir"}</h3>
      <p>{aoVivo ? "Sinal ao vivo disponível" : "Sem sinal ADS-B ao vivo neste momento"} · {atualizadoAoVivo ? `Última consulta ${new Date(atualizadoAoVivo).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Aguardando atualização"}</p>
      {erroAoVivo && <p role="status">Não foi possível atualizar o rastreio: {erroAoVivo}</p>}
      {erroHistorico && <p role="status">{erroHistorico}</p>}
    </section>
          {vooSelecionado && (
            <div className="sb-monitor-history">
              <h3 className="mb-2 text-xs font-bold text-foreground">Trechos e horários registrados · UTC</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[10px]">
                  <thead className="text-muted-foreground"><tr>
                    {["Trecho", "AC", "DEP", "POU", "COR"].map((titulo) => (
                      <th key={titulo} className="px-1 py-1 font-semibold">{titulo}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...pernasSelecionadas].sort((a, b) => (diaUTC(a.horario_dep || a.horario_ac || a.horario_pouso || a.horario_corte) || "").localeCompare(diaUTC(b.horario_dep || b.horario_ac || b.horario_pouso || b.horario_corte) || "")).map((perna, indice) => (
                      <tr key={perna.id} className="border-t border-border/70">
                        <td className="whitespace-nowrap px-1 py-2 font-mono font-semibold"><span className="mr-1 text-muted-foreground">{dataPerna(perna)}</span>{perna.origem} → {perna.destino}{pernaAtualDetectada && perna.id === vooSelecionado.perna_atual?.id && <span className="mt-1 block font-sans text-[9px] font-normal text-primary">Trecho detectado pelo sistema · {dataPerna(perna)}</span>}</td>
                        {[perna.horario_ac, perna.horario_dep, perna.horario_pouso, perna.horario_corte].map((horario, indice) => (
                          <td key={indice} className="whitespace-nowrap px-1 py-2 font-mono">{horarioRastreio(horario).replace(" UTC", "")}</td>
                        ))}
                      </tr>
                    ))}
                    {trechosSistema.map((trecho) => (
                      <tr key={`sistema-${trecho.dia}`} className="border-t border-primary/20 bg-primary/[.04]">
                        <td className="whitespace-nowrap px-1 py-2 font-mono font-semibold text-primary">{diaCurto(trecho.dia)} · Trecho detectado pelo sistema</td>
                        <td colSpan={4} className="px-1 py-2 text-[9px] text-muted-foreground">
                          {horarioRastreio(trecho.inicio)} – {horarioRastreio(trecho.fim)} ·
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!vooSelecionado.rastreio && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Os horários acima foram informados pela tripulação. A rota tracejada no mapa é prevista, não um percurso confirmado.
                </p>
              )}
              <div className="mt-3 border-t border-border/70 pt-3">
                <h3 className="mb-2 text-xs font-bold text-foreground">Histórico de sinais ADS-B</h3>
                <HistoricoRastreioVoo voo={vooSelecionado} />
              </div>
            </div>
          )}
  </div>;
}
