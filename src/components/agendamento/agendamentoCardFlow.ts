import { TOTAL_ITENS_CHECKLIST } from "./checklistStructure";

type AgendamentoOperacional = {
  status: string;
  checklist_status?: string | null;
  checklist_itens_respondidos?: number | string | null;
  jornadas_abertas?: number | string | null;
  jornadas_encerradas?: number | string | null;
};

export function correspondeFiltroStatusAgendamento(status: string, filtro: string): boolean {
  const statusNormalizado = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (filtro === "todos") return true;
  if (filtro === "em_voo") return ["em_rota", "em_voo", "em_solo"].includes(statusNormalizado);
  return statusNormalizado === filtro;
}

export function calcularProgressoChecklist(item: AgendamentoOperacional, progressoLocal?: number): number {
  if (String(item.checklist_status || "").trim().toLowerCase() === "concluido") return 100;
  const respondidos = progressoLocal ?? Number(item.checklist_itens_respondidos || 0);
  if (!Number.isFinite(respondidos) || TOTAL_ITENS_CHECKLIST <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((respondidos / TOTAL_ITENS_CHECKLIST) * 100)));
}

export function obterAcoesAgendamento(item: AgendamentoOperacional, progressoChecklist: number, checklistAberto = false) {
  const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
  const historico = status === "encerrada" || status === "concluida";
  const operacional = ["aprovada", "em_rota", "em_voo", "em_solo"].includes(status);
  const checklistStatus = String(item.checklist_status || "").trim().toLowerCase();
  const checklistConcluido = checklistStatus === "concluido";
  const checklistIniciado = Boolean(checklistStatus) || checklistAberto || progressoChecklist > 0;
  const jornadaExistente = Number(item.jornadas_abertas || 0) > 0 || Number(item.jornadas_encerradas || 0) > 0;
  const corChecklist = checklistConcluido || progressoChecklist === 100
    ? "green"
    : progressoChecklist === 0
      ? "yellow"
      : "red";

  return {
    historico,
    mostrarChecklist: !historico && operacional,
    checklistConcluido,
    checklistLabel: checklistConcluido ? "VER CHECKLIST" : checklistIniciado ? "CONCLUIR CHECKLIST" : "INICIAR VOO",
    corChecklist,
    mostrarJornada: !historico && operacional && (jornadaExistente || checklistConcluido),
    jornadaLabel: jornadaExistente ? "VER JORNADA" : "INICIAR JORNADA",
    podeFinalizar: !historico && Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0,
  } as const;
}
