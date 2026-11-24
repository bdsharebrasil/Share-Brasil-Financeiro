import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";

/** Ocorrências de calendário: todas mantêm a solicitação e o número do voo. */
export function agendamentosComPernasPlanejadas(agendamentos: SolicitacaoVooInterna[]): SolicitacaoVooInterna[] {
  return agendamentos.flatMap(item => [item, ...(item.pernas_planejadas || [])
    .filter(perna => perna.status === "PLANEJADA")
    .map(perna => ({
      ...item, id: `${item.id}:planejada:${perna.id}`, solicitacao_id: item.id,
      perna_planejada_id: perna.id, origem: perna.origem, destino: perna.destino,
      data_agendada: perna.data_prevista, data_fim: perna.data_prevista, dias_duracao: 1,
      horario_previsto_agendamento: perna.horario_previsto, numero_passageiros: perna.numero_passageiros,
      status: "aprovada",
    }))]);
}
