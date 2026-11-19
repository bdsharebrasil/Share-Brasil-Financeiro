import type { AbaAgendamento } from "@/components/agendamento/AgendamentoNavigation";
import type { FiltroStatusCronograma } from "@/components/agendamento/AgendamentoCronograma";

const filtrosPorAba: Partial<Record<AbaAgendamento, FiltroStatusCronograma>> = {
  pendentes: "pendente",
  aprovados: "aprovada",
  historico: "encerrada",
};

const abasComLista = new Set<AbaAgendamento>(["cronograma", "pendentes", "aprovados", "historico"]);

export function obterFiltroDaAba(aba: AbaAgendamento, filtroGeral: FiltroStatusCronograma): FiltroStatusCronograma {
  return filtrosPorAba[aba] ?? filtroGeral;
}

export function abaExibeLista(aba: AbaAgendamento): boolean {
  return abasComLista.has(aba);
}
