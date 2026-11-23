import { useMemo, useState } from "react";
import { MapPin, Plane, Radio } from "lucide-react";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";
import VooEmOperacaoMapa from "@/components/dashboard/operacoes/VooEmOperacaoMapa";
import HistoricoRastreioVoo from "@/components/dashboard/operacoes/HistoricoRastreioVoo";
import { horarioRastreio } from "@/lib/rastreio";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";

type Props = {
  voos: SolicitacaoVooInterna[];
  vooSelecionado: SolicitacaoVooInterna | null;
  voosEmOperacao: VooEmOperacao[];
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
  visaoInicial?: "ao-vivo" | "prontos";
  aoSelecionar: (id: string) => void;
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

export default function VoosDeHoje({
  voos, voosEmOperacao, carregandoAoVivo, erroAoVivo, atualizadoAoVivo,
}: Props) {
  const [vooSelecionadoId, setVooSelecionadoId] = useState("");
  const [pernaSelecionadaId, setPernaSelecionadaId] = useState("todas");
  const hoje = hojeBrasilia();
  const agendamentosHoje = useMemo(() => voos.filter((v) => {
    const inicio = String(v.data_agendada || "").slice(0, 10);
    const fim = String(v.data_fim || v.data_agendada || "").slice(0, 10);
    return inicio <= hoje && fim >= hoje;
  }), [voos, hoje]);
  const voosReais = useMemo(
    () => voosEmOperacao.filter((voo) => voo.status === "em_voo" && agendamentosHoje.some((item) => item.id === voo.id)),
    [agendamentosHoje, voosEmOperacao],
  );
  const vooSelecionado = voosReais.find((v) => v.id === vooSelecionadoId) || voosReais[0] || null;
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
  const statusVoo = (status: string) => ({ em_voo: "Em voo", decolado: "Decolado", em_solo: "Em solo", acionado: "Acionado", aguardando: "Aguardando", encerrada: "Encerrado", concluida: "Encerrado" }[status] || status);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Monitoramento ao vivo</h2>
          <p className="mt-1 text-xs text-muted-foreground">Posições e rotas recebidas do rastreio ADS-B · {atualizadoAoVivo ? `atualizado ${new Date(atualizadoAoVivo).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "aguardando atualização"}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17885f]/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-[#17885f]">
          <Radio size={13} /> {carregandoAoVivo ? "Consultando" : `${voosReais.length} ${voosReais.length === 1 ? "operação real" : "operações reais"}`}
        </span>
      </div>
      {erroAoVivo && <p role="status" className="border-b border-border px-5 py-3 text-xs text-amber-700">Não foi possível atualizar o rastreio: {erroAoVivo}</p>}
      <div className="grid min-h-[400px] grid-cols-1 lg:grid-cols-12">
        <div className="min-h-[320px] border-b border-border p-4 lg:col-span-7 lg:border-b-0 lg:border-r">
          {vooSelecionado ? <div className="space-y-2">
            {pernasSelecionadas.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Selecionar trecho no mapa">
              <button type="button" onClick={() => setPernaSelecionadaId("todas")} aria-pressed={pernaSelecionadaId === "todas"} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${pernaSelecionadaId === "todas" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Todas as pernas ({pernasSelecionadas.length})</button>
              {pernasSelecionadas.map((perna, index) => <button key={perna.id} type="button" onClick={() => setPernaSelecionadaId(perna.id)} aria-pressed={pernaSelecionadaId === perna.id} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${pernaSelecionadaId === perna.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{index + 1} · {perna.origem} → {perna.destino}</button>)}
            </div>}
            <VooEmOperacaoMapa key={vooSelecionado.id} voo={vooSelecionado} pernaId={pernaSelecionadaId === "todas" ? undefined : pernaSelecionadaId} historico={!vooSelecionado.rastreio || vooSelecionado.rastreio_status !== "ao_vivo"} />
          </div> : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <MapPin size={24} />
              <strong className="text-foreground">Sem posição de voo real disponível</strong>
              <span>O mapa aparecerá quando houver voo monitorado. A rota prevista pode ser exibida mesmo sem posição ADS-B.</span>
            </div>
          )}
        </div>
        <div className="space-y-3 p-4 lg:col-span-5">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Voos monitorados</h3><span className="text-xs text-muted-foreground">{voosReais.length}</span></div>
          {voosReais.length ? voosReais.map((flight) => (
            <button key={flight.id} type="button" onClick={() => { setVooSelecionadoId(flight.id); setPernaSelecionadaId("todas"); }} className={`w-full rounded-lg border px-2.5 py-2 text-left ${vooSelecionado?.id === flight.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}>
              <span className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{flight.numero_voo || "Voo sem número"}</strong><span className="text-[9px] text-emerald-700">{statusVoo(flight.status)}</span></span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{flight.matricula_registro || "Matrícula indisponível"} · {flight.modelo || "Aeronave"} · {dataBR(flight.horario_previsto_agendamento)}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-tight"><Plane size={11} /> {flight.origem || "—"} → {flight.destino || "—"} <span className="ml-auto text-muted-foreground">{flight.rastreio_status === "ao_vivo" ? "Sinal ao vivo" : "Em voo"}</span></span>
            </button>
          )) : <p className="rounded-lg bg-secondary/40 p-4 text-xs text-muted-foreground">Nenhum voo com rastreio ou histórico disponível neste momento.</p>}
          {vooSelecionado && (pernasSelecionadas.length > 0 || trechosSistema.length > 0) && (
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <h3 className="mb-2 text-xs font-bold text-foreground">Trechos e horários registrados · UTC</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-[10px]">
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
        </div>
      </div>
    </section>
  );
}
