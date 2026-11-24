import type { PernaPlanejada, SolicitacaoVooInterna } from "@/lib/colaborador-api";

/** Associa os agendamentos confirmados à operação para listar suas próximas pernas. */
export function vincularPlanejamentos(agendamentos: SolicitacaoVooInterna[]): SolicitacaoVooInterna[] {
  const porSolicitacao = new Map<string, PernaPlanejada[]>();
  for (const item of agendamentos) {
    if (!item.solicitacao_origem_id || item.status !== "aprovada") continue;
    const pernas = porSolicitacao.get(item.solicitacao_origem_id) || [];
    pernas.push({
      id: item.id,
      solicitacao_id: item.solicitacao_origem_id,
      data_prevista: item.data_agendada,
      origem: item.origem,
      destino: item.destino,
      horario_previsto: item.horario_previsto_agendamento || null,
      numero_passageiros: item.numero_passageiros ?? 0,
      status: "PLANEJADA",
      criado_em: item.criado_em || "",
      atualizado_em: item.atualizado_em || "",
    });
    porSolicitacao.set(item.solicitacao_origem_id, pernas);
  }
  return agendamentos.map(item => {
    const pernas = porSolicitacao.get(item.id);
    return pernas ? { ...item, pernas_planejadas: pernas } : item;
  });
}
