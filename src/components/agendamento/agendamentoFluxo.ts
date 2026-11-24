import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";

/**
 * Regras de fluxo da tela de Agendamentos, em um só lugar e sem React,
 * para que lista, calendário, detalhes e painel de operação falem a mesma língua.
 *
 * Ciclo de vida de um voo:
 *   pendente → aprovada (confirmado) → acionado → decolado/em_voo/em_rota → em_solo → encerrada
 *   (reprovada e cancelada são saídas laterais)
 */

export type AbaDestino = "pendentes" | "aprovados" | "historico";
export type TomStatus = "amarelo" | "verde" | "azul" | "vermelho" | "neutro";

export const normalizarStatusAgenda = (status: string | null | undefined) =>
  String(status || "").trim().toLowerCase().replace(/\s+/g, "_");

const EM_VOO = ["decolado", "em_voo", "em_rota"];
const ENCERRADOS = ["encerrada", "concluida"];
const INICIADOS = ["acionado", ...EM_VOO, "em_solo"];

/** Em qual aba um agendamento "mora", para que Detalhes sempre abra no lugar certo. */
export function abaParaAgendamento(status: string): AbaDestino {
  const normalizado = normalizarStatusAgenda(status);
  if (normalizado === "pendente") return "pendentes";
  if (ENCERRADOS.includes(normalizado)) return "historico";
  return "aprovados";
}

/** Rótulo único de status, usado na lista, no calendário e nos detalhes. */
export function rotuloStatusAgenda(status: string): { rotulo: string; tom: TomStatus } {
  const normalizado = normalizarStatusAgenda(status);
  if (normalizado === "pendente") return { rotulo: "Aguardando aprovação", tom: "amarelo" };
  if (normalizado === "aprovada") return { rotulo: "Confirmado", tom: "verde" };
  if (normalizado === "acionado") return { rotulo: "Acionado", tom: "azul" };
  if (EM_VOO.includes(normalizado)) return { rotulo: "Em voo", tom: "azul" };
  if (normalizado === "em_solo") return { rotulo: "Em solo", tom: "azul" };
  if (ENCERRADOS.includes(normalizado)) return { rotulo: "Encerrado", tom: "neutro" };
  if (normalizado === "reprovada") return { rotulo: "Reprovado", tom: "vermelho" };
  if (normalizado === "cancelada") return { rotulo: "Cancelado", tom: "vermelho" };
  return { rotulo: status || "Registrado", tom: "neutro" };
}

export const CLASSE_TOM_STATUS: Record<TomStatus, string> = {
  amarelo: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  verde: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  azul: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  vermelho: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
  neutro: "border-border bg-secondary text-muted-foreground",
};

/** Dias entre duas datas ISO (yyyy-mm-dd), sem depender do fuso do navegador. */
export function diasEntre(deIso: string, ateIso: string): number {
  const de = Date.parse(`${deIso.slice(0, 10)}T00:00:00Z`);
  const ate = Date.parse(`${ateIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(de) || !Number.isFinite(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

/** Quanto tempo falta para o voo. É o que o coordenador precisa ver numa solicitação pendente. */
export function urgenciaVoo(dataAgendada: string, hoje: string): { rotulo: string; urgente: boolean; atrasado: boolean } {
  const dias = diasEntre(hoje, dataAgendada);
  if (dias < 0) return { rotulo: `Data vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`, urgente: true, atrasado: true };
  if (dias === 0) return { rotulo: "Voo hoje", urgente: true, atrasado: false };
  if (dias === 1) return { rotulo: "Voo amanhã", urgente: true, atrasado: false };
  return { rotulo: `Voo em ${dias} dias`, urgente: false, atrasado: false };
}

const chaveHorario = (item: Pick<SolicitacaoVooInterna, "data_agendada" | "horario_previsto_agendamento">) => {
  const texto = String(item.horario_previsto_agendamento || "");
  const hora = texto.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  const hhmm = hora ? `${hora[1].padStart(2, "0")}:${hora[2]}` : "99:99"; // sem horário vai para o fim
  return `${String(item.data_agendada || "").slice(0, 10)} ${hhmm}`;
};

/** O que vence primeiro aparece primeiro. Usado na fila de solicitações e no plano do dia. */
export function ordenarPorDataHorario<T extends Pick<SolicitacaoVooInterna, "data_agendada" | "horario_previsto_agendamento" | "numero_voo">>(itens: T[]): T[] {
  return [...itens].sort((a, b) => chaveHorario(a).localeCompare(chaveHorario(b))
    || String(a.numero_voo || "").localeCompare(String(b.numero_voo || ""), "pt-BR", { numeric: true }));
}

/** O voo toca esta data? Considera viagens de vários dias (data_agendada → data_fim). */
export function vooTocaData(item: Pick<SolicitacaoVooInterna, "data_agendada" | "data_fim">, data: string): boolean {
  const inicio = String(item.data_agendada || "").slice(0, 10);
  const fim = String(item.data_fim || item.data_agendada || "").slice(0, 10);
  return Boolean(inicio && inicio <= data && fim >= data);
}

/** O voo toca o intervalo [de, ate]? */
export function vooTocaIntervalo(item: Pick<SolicitacaoVooInterna, "data_agendada" | "data_fim">, de: string, ate: string): boolean {
  const inicio = String(item.data_agendada || "").slice(0, 10);
  const fim = String(item.data_fim || item.data_agendada || "").slice(0, 10);
  return Boolean(inicio && inicio <= ate && fim >= de);
}

/** Excluir só faz sentido antes de a operação começar; depois disso, o caminho é encerrar. */
export function podeExcluirAgendamento(item: Pick<SolicitacaoVooInterna, "status" | "jornadas_abertas" | "jornadas_encerradas" | "jornada_id" | "solicitacao_origem_id">): boolean {
  const status = normalizarStatusAgenda(item.status);
  if (ENCERRADOS.includes(status) || INICIADOS.includes(status)) return false;
  if (Number(item.jornadas_abertas || 0) > 0 || Number(item.jornadas_encerradas || 0) > 0 || item.jornada_id) return false;
  return !item.solicitacao_origem_id;
}

/** Em voo: dados estruturais (aeronave, rota, datas) deixam de ser editáveis; tripulação e observações continuam. */
export function edicaoEstruturalPermitida(status: string): boolean {
  const normalizado = normalizarStatusAgenda(status);
  return normalizado === "aprovada";
}

export type EtapaOperacao = {
  id: "checklist" | "iniciar" | "horarios" | "encerrar";
  rotulo: string;
  estado: "feita" | "atual" | "futura";
};

export type ProximaAcao = EtapaOperacao["id"] | null;

/**
 * A "linha do tempo" do painel de operação. Em vez de uma fileira de botões soltos,
 * o operador vê em que passo está e qual é o único botão principal agora.
 */
export function etapasOperacao(estado: {
  checklistConcluido: boolean;
  operacaoIniciada: boolean;
  jornadaEncerrada: boolean;
  podeEncerrar: boolean;
}): { etapas: EtapaOperacao[]; proxima: ProximaAcao } {
  const proxima: ProximaAcao = !estado.checklistConcluido && !estado.operacaoIniciada
    ? "checklist"
    : !estado.operacaoIniciada
      ? "iniciar"
      : estado.podeEncerrar
        ? "encerrar"
        : "horarios";

  const feita = {
    checklist: estado.checklistConcluido || estado.operacaoIniciada,
    iniciar: estado.operacaoIniciada,
    horarios: estado.jornadaEncerrada,
    encerrar: false,
  };
  const etapas = ([
    ["checklist", "Checklist pré-voo"],
    ["iniciar", "Iniciar operação"],
    ["horarios", "Registrar horários"],
    ["encerrar", "Encerrar operação"],
  ] as const).map(([id, rotulo]) => ({
    id,
    rotulo,
    estado: feita[id] ? "feita" : id === proxima ? "atual" : "futura",
  } satisfies EtapaOperacao));
  return { etapas, proxima };
}

/** Por que o botão de aprovar está desabilitado? Texto direto, em vez de um botão cinza sem explicação. */
export function pendenciasParaAprovar(estado: {
  pilotoId: string;
  aeronaveId: string;
  datasValidas: boolean;
  passageirosValidos: boolean;
  emprestimoInformado: boolean;
}): string[] {
  const pendencias: string[] = [];
  if (!estado.aeronaveId) pendencias.push("Selecione a aeronave");
  if (!estado.datasValidas) pendencias.push("Confira as datas (a final não pode ser anterior à saída)");
  if (!estado.passageirosValidos) pendencias.push("Informe ao menos 1 passageiro");
  if (!estado.emprestimoInformado) pendencias.push("Aeronave de outro cotista: informe quem está cedendo");
  if (!estado.pilotoId) pendencias.push("Escolha o comandante");
  return pendencias;
}
