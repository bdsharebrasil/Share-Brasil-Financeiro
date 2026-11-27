import { colaboradorRequest } from "@/lib/colaborador-api";

export type EstadoPlanoPreparacao = { dados?: { itens?: { plano_voo?: { estado?: string } } } };
export function planoConferidoNaPreparacao(registro?: EstadoPlanoPreparacao | null) {
  return registro?.dados?.itens?.plano_voo?.estado === "CONCLUIDO";
}
export function buscarEstadoPlanoPreparacao(id: string) {
  return colaboradorRequest<EstadoPlanoPreparacao>(`/api/interno/agendamento/${encodeURIComponent(id)}/preparacao`);
}
