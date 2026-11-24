import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { operacaoNaData } from "@/lib/agendamentos-hoje";

export type FiltroOperacoes = "confirmados" | "operacao";

export function statusOperacao(status: string): string {
  return String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function operacaoIniciada(voo: SolicitacaoVooInterna): boolean {
  if (voo.solicitacao_origem_id) return false;
  const status = statusOperacao(voo.status);
  if (["encerrada", "concluida", "cancelada", "reprovada", "pendente"].includes(status)) return false;
  return ["acionado", "decolado", "em_solo", "em_voo", "em_rota"].includes(status)
    || Number(voo.jornadas_abertas || 0) > 0
    || Number(voo.jornadas_encerradas || 0) > 0
    || Boolean(voo.jornada_id);
}

/** Confirmados do dia; operações iniciadas continuam visíveis até o encerramento. */
export function filtrarOperacoes(voos: SolicitacaoVooInterna[], filtro: FiltroOperacoes, data: string): SolicitacaoVooInterna[] {
  return voos.filter((voo) => filtro === "operacao"
    ? operacaoIniciada(voo)
    : statusOperacao(voo.status) === "aprovada" && !operacaoIniciada(voo) && operacaoNaData(voo, data));
}

export function selecionarOperacao(voos: SolicitacaoVooInterna[], selecionadoId: string | null): SolicitacaoVooInterna | null {
  return voos.find((voo) => voo.id === selecionadoId) || voos[0] || null;
}

export function rotuloOperacao(status: string): string {
  return ({ aprovada: "CONFIRMADO", acionado: "ACIONADO", decolado: "DECOLADO", em_solo: "EM SOLO", em_voo: "EM VOO", em_rota: "EM ROTA" })[statusOperacao(status)] || status.toUpperCase();
}
