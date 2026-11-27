import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { operacaoNaData } from "@/lib/agendamentos-hoje";

export type FiltroAgenda = "todos" | "dia" | "confirmados" | "pendentes";
export const statusNormalizado = (status: string) => String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
export const historicoAgenda = (item: SolicitacaoVooInterna) => ["encerrada", "concluida", "cancelada", "reprovada"].includes(statusNormalizado(item.status));
export const emVooAgenda = (item: SolicitacaoVooInterna) => ["decolado", "em_rota", "em_voo"].includes(statusNormalizado(item.perna_atual_status || item.status));
export const dataAgenda = (valor?: string | null) => /^\d{4}-\d{2}-\d{2}/.test(valor || "") ? String(valor).slice(0, 10).split("-").reverse().join("/") : "—";
export function horaAgenda(valor?: string | null) {
  if (!valor) return "—";
  const m = valor.match(/(?:^|T|\s)(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, "0") + ":" + m[2] + "Z" : "—";
}
export function instanteAgenda(data?: string | null, hora?: string | null): number | null {
  if (!hora) return null;
  const texto = /^\d{4}-\d{2}-\d{2}/.test(hora) ? hora.replace(" ", "T") : data ? data.slice(0,10) + "T" + hora : "";
  if (!texto) return null;
  const ms = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : texto + "Z");
  return Number.isFinite(ms) ? ms : null;
}
export function duracaoAgenda(minutos?: number | null) {
  if (minutos == null || !Number.isFinite(minutos) || minutos < 0) return "—";
  const m = Math.round(minutos);
  return Math.floor(m / 60) + "h " + String(m % 60).padStart(2,"0") + "min";
}
export function filtrarAgenda(itens: SolicitacaoVooInterna[], filtro: FiltroAgenda, hoje: string) {
  return itens.filter(item => !historicoAgenda(item) && (filtro === "todos" ||
    (filtro === "dia" && operacaoNaData(item, hoje)) ||
    (filtro === "confirmados" && statusNormalizado(item.status) === "aprovada") ||
    (filtro === "pendentes" && statusNormalizado(item.status) === "pendente")))
    .sort((a,b) => a.data_agendada.localeCompare(b.data_agendada) || (horaAgenda(a.horario_previsto_agendamento) === "—" ? "99:99" : horaAgenda(a.horario_previsto_agendamento)).localeCompare(horaAgenda(b.horario_previsto_agendamento) === "—" ? "99:99" : horaAgenda(b.horario_previsto_agendamento)) || a.id.localeCompare(b.id));
}
export function proximoAgenda(item: SolicitacaoVooInterna, itens: SolicitacaoVooInterna[]) {
  const inicio = instanteAgenda(item.data_agendada, item.horario_previsto_agendamento);
  if (inicio == null || !item.aeronave_id) return null;
  const candidatos = itens.filter(v => v.id !== item.id && v.aeronave_id === item.aeronave_id && statusNormalizado(v.status) === "aprovada")
    .map(v => ({ voo: v, inicio: instanteAgenda(v.data_agendada, v.horario_previsto_agendamento) }))
    .filter(v => v.inicio != null && v.inicio > inicio)
    .sort((a,b) => a.inicio! - b.inicio!);
  return candidatos[0]?.voo ?? null;
}
export function agruparHistoricoAgenda(itens: SolicitacaoVooInterna[]) {
  const grupos = new Map<string, { nome: string; voos: SolicitacaoVooInterna[] }>();
  for (const item of itens.filter(historicoAgenda).sort((a,b) => b.data_agendada.localeCompare(a.data_agendada))) {
    const chave = item.cliente_id ? "cliente:" + item.cliente_id : item.socio_id ? "socio:" + item.socio_id : "sem-cliente";
    const grupo = grupos.get(chave) || { nome: item.cliente_razao_social || item.socio_nome || "Cliente não informado", voos: [] };
    grupo.voos.push(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.entries()].sort((a,b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
}
