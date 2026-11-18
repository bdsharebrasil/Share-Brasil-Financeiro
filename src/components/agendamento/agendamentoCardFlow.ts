import { TOTAL_ITENS_CHECKLIST } from "./checklistStructure";

type AgendamentoOperacional = {
  status: string;
  preparacao_pendencias?: number | null;
  checklist_status?: string | null;
  checklist_itens_respondidos?: number | string | null;
  jornadas_abertas?: number | string | null;
  jornadas_encerradas?: number | string | null;
};

const STATUS_FASE_VOO = new Set(["acionado", "decolado", "em_rota", "em_voo", "em_solo"]);
const STATUS_OPERACIONAIS = new Set(["aprovada", ...STATUS_FASE_VOO]);
const normalizarStatus = (status: string) => String(status || "").trim().toLowerCase().replace(/\s+/g, "_");

export function statusPermiteChecklist(status: string): boolean {
  return STATUS_OPERACIONAIS.has(normalizarStatus(status));
}

export function statusPermiteAbrirJornada(status: string): boolean {
  const normalizado = normalizarStatus(status);
  return STATUS_OPERACIONAIS.has(normalizado) || normalizado === "encerrada";
}

export function correspondeFiltroStatusAgendamento(status: string, filtro: string): boolean {
  const statusNormalizado = normalizarStatus(status);
  if (filtro === "todos") return true;
  if (filtro === "em_voo") return STATUS_FASE_VOO.has(statusNormalizado);
  return statusNormalizado === filtro;
}

export function calcularProgressoChecklist(item: AgendamentoOperacional, progressoLocal?: number): number {
  if (String(item.checklist_status || "").trim().toLowerCase() === "concluido") return 100;
  const respondidos = progressoLocal ?? Number(item.checklist_itens_respondidos || 0);
  if (!Number.isFinite(respondidos) || TOTAL_ITENS_CHECKLIST <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((respondidos / TOTAL_ITENS_CHECKLIST) * 100)));
}

export function obterAcoesAgendamento(item: AgendamentoOperacional, progressoChecklist: number, checklistAberto = false) {
  const status = normalizarStatus(item.status);
  const historico = status === "encerrada" || status === "concluida";
  const operacional = STATUS_OPERACIONAIS.has(status);
  const checklistStatus = String(item.checklist_status || "").trim().toLowerCase();
  const checklistConcluido = checklistStatus === "concluido";
  const checklistIniciado = Boolean(checklistStatus) || checklistAberto || progressoChecklist > 0;
  const jornadaExistente = Number(item.jornadas_abertas || 0) > 0 || Number(item.jornadas_encerradas || 0) > 0;
  const corChecklist = Number(item.preparacao_pendencias || 0)>0 ? "yellow" : checklistConcluido || progressoChecklist === 100
    ? "green"
    : progressoChecklist === 0
      ? "yellow"
      : "red";

  const podeFinalizar = !historico && Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0;

  return {
    historico,
    jornadaIniciada: jornadaExistente,
    abrirLabel: jornadaExistente ? "VER HISTORICO" : "ABRIR",
    mostrarChecklist: !historico && operacional,
    checklistConcluido,
    preparacaoPendencias: Number(item.preparacao_pendencias || 0),
    checklistLabel: checklistConcluido ? Number(item.preparacao_pendencias || 0)>0 ? `VER PREPARAÇÃO · ${item.preparacao_pendencias} PENDÊNCIA(S)` : "VER CHECKLIST" : checklistIniciado ? "CONCLUIR CHECKLIST" : "INICIAR CHECKLIST",
    corChecklist,
    mostrarJornada: !historico && operacional && (jornadaExistente || checklistConcluido),
    jornadaLabel: podeFinalizar ? "ENCERRAR OPERAÇÃO" : jornadaExistente ? "ATUALIZAR HORARIOS" : "INICIAR JORNADA",
    podeFinalizar,
  } as const;
}
