import { useMemo, useState } from "react";
import { Clock3, MapPin, Plane, Radio, Users } from "lucide-react";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";
import VooEmOperacaoMapa from "@/components/dashboard/operacoes/VooEmOperacaoMapa";
import HistoricoRastreioVoo from "@/components/dashboard/operacoes/HistoricoRastreioVoo";
import { horarioRastreio } from "@/lib/rastreio";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";

type Props = {
  voos: SolicitacaoVooInterna[];
  vooSelecionado: SolicitacaoVooInterna | null;
  nomesTripulantes: Map<string, string>;
  voosEmOperacao: VooEmOperacao[];
  carregando: boolean;
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
  visaoInicial?: "ao-vivo" | "prontos";
  aoSelecionar: (id: string) => void;
  aoIniciar: (item: SolicitacaoVooInterna) => void;
};

function dataBR(data?: string | null) {
  if (!data) return "Data não informada";
  const d = new Date(`${data.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? data : d.toLocaleDateString("pt-BR");
}

export default function VoosDeHoje({
  voos, voosEmOperacao, carregando, carregandoAoVivo, erroAoVivo,
  atualizadoAoVivo, aoIniciar,
}: Props) {
  const [vooSelecionadoId, setVooSelecionadoId] = useState("");
  const hoje = hojeBrasilia();
  const agendamentosHoje = useMemo(() => voos.filter((v) => {
    const inicio = String(v.data_agendada || "").slice(0, 10);
    const fim = String(v.data_fim || v.data_agendada || "").slice(0, 10);
    return inicio <= hoje && fim >= hoje;
  }), [voos, hoje]);
  const voosReais = useMemo(
    () => voosEmOperacao.filter((voo) => agendamentosHoje.some((item) => item.id === voo.id)),
    [agendamentosHoje, voosEmOperacao],
  );
  const vooSelecionado = voosReais.find((v) => v.id === vooSelecionadoId) || voosReais[0] || null;
  const porId = new Map(voosReais.map((v) => [v.id, v]));
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
          {vooSelecionado ? <VooEmOperacaoMapa key={vooSelecionado.id} voo={vooSelecionado} historico={!vooSelecionado.rastreio || vooSelecionado.rastreio_status !== "ao_vivo"} /> : (
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
            <button key={flight.id} type="button" onClick={() => setVooSelecionadoId(flight.id)} className={`w-full rounded-xl border p-3 text-left ${vooSelecionado?.id === flight.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}>
              <span className="flex items-center justify-between gap-2"><strong className="font-mono text-sm">{flight.numero_voo || "Voo sem número"}</strong><span className="text-[10px] text-emerald-700">{statusVoo(flight.status)}</span></span>
              <span className="mt-1 block text-xs text-muted-foreground">{flight.matricula_registro || "Matrícula indisponível"} · {flight.modelo || "Aeronave"} · {dataBR(flight.horario_previsto_agendamento)}</span>
              <span className="mt-2 flex items-center gap-1.5 text-xs"><Plane size={12} /> {flight.origem || "—"} → {flight.destino || "—"} <span className="ml-auto text-muted-foreground">{flight.rastreio_status === "ao_vivo" ? "Sinal ao vivo" : flight.pernas.some((perna) => perna.horario_dep && !perna.horario_pouso) ? "Em voo · ADS-B indisponível" : flight.rastreio_status.replace(/_/g, " ")}</span></span>
            </button>
          )) : <p className="rounded-lg bg-secondary/40 p-4 text-xs text-muted-foreground">Nenhum voo com rastreio ou histórico disponível neste momento.</p>}
          {vooSelecionado && vooSelecionado.pernas.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <h3 className="mb-2 text-xs font-bold text-foreground">Horários registrados pela tripulação · UTC</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-[10px]">
                  <thead className="text-muted-foreground"><tr>
                    {["Trecho", "AC", "DEP", "POU", "COR"].map((titulo) => (
                      <th key={titulo} className="px-1 py-1 font-semibold">{titulo}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {vooSelecionado.pernas.map((perna) => (
                      <tr key={perna.id} className="border-t border-border/70">
                        <td className="whitespace-nowrap px-1 py-2 font-mono font-semibold">{perna.origem} → {perna.destino}</td>
                        {[perna.horario_ac, perna.horario_dep, perna.horario_pouso, perna.horario_corte].map((horario, indice) => (
                          <td key={indice} className="whitespace-nowrap px-1 py-2 font-mono">{horarioRastreio(horario).replace(" UTC", "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!vooSelecionado.rastreio && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Os horários acima foram informados pela tripulação. A rota tracejada no mapa é prevista, não um percurso ADS-B confirmado.
                </p>
              )}
              <div className="mt-3 border-t border-border/70 pt-3">
                <h3 className="mb-2 text-xs font-bold text-foreground">Histórico de sinais ADS-B</h3>
                <HistoricoRastreioVoo voo={vooSelecionado} />
              </div>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Agendamentos de hoje</h3><span className="text-xs text-muted-foreground">{agendamentosHoje.length}</span></div>
            {carregando ? <p className="text-xs text-muted-foreground">Carregando agendamentos…</p> : agendamentosHoje.length ? agendamentosHoje.map((item) => {
              const monitorado = porId.get(item.id);
              return <article key={item.id} className="mb-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{item.numero_voo || "Solicitação sem número"}</strong><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${["encerrada", "concluida"].includes(String(monitorado?.status || item.status).toLowerCase()) ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-secondary/30 text-muted-foreground"}`}>{statusVoo(monitorado?.status || item.status)}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{dataBR(item.data_agendada)} · {item.origem} → {item.destino} · {item.matricula_registro || "Aeronave a definir"}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Users size={11}/>{item.piloto_nome || "Piloto não definido"}{item.copiloto_nome ? ` · ${item.copiloto_nome}` : ""}</p>
                {item.status === "aprovada" && item.checklist_status === "concluido" && <button type="button" onClick={() => aoIniciar(item)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Clock3 size={12}/>Abrir operação</button>}
              </article>;
            }) : <p className="text-xs text-muted-foreground">Nenhum agendamento encontrado para hoje.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
