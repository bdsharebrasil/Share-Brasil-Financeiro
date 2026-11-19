import type { SolicitacaoVooInterna } from "./colaborador-api";

/** Data de referência do painel de operações no fuso de Brasília. */
export function hojeBrasilia(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** O quadro "Voos de hoje" reúne apenas operações do dia; KPIs preservam os outros filtros. */
export function operacaoNaData(
  item: Pick<SolicitacaoVooInterna, "status" | "data_agendada" | "data_fim">,
  data: string,
): boolean {
  const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
  const operacionais = ["aprovada", "acionado", "decolado", "em_rota", "em_voo", "em_solo", "encerrada", "concluida"];
  if (!operacionais.includes(status)) return false;
  const inicio = String(item.data_agendada || "").slice(0, 10);
  const fim = String(item.data_fim || item.data_agendada || "").slice(0, 10);
  return Boolean(inicio && inicio <= data && fim >= data);
}
