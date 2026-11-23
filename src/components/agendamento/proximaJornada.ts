import type { JornadaVoo, SolicitacaoVooInterna } from "@/lib/colaborador-api";

/** Usa somente pousos efetivamente registrados na última jornada encerrada. */
export function prepararProximaJornada(
  jornada: JornadaVoo,
  item: Pick<SolicitacaoVooInterna, "numero_passageiros">,
  dataAtual: string,
) {
  const encerradas = [jornada, ...(jornada.historico || [])]
    .filter((registro) => String(registro.status || "").trim().toLowerCase() === "encerrada")
    .sort((a, b) => b.data.localeCompare(a.data)
      || b.numero_jornada - a.numero_jornada
      || String(b.horario_encerramento || b.horario_corte || "").localeCompare(String(a.horario_encerramento || a.horario_corte || "")));
  const ultima = encerradas[0];
  if (!ultima) return null;

  const pouso = [...(ultima.pernas || [])]
    .filter((perna) => perna.horario_pouso && perna.destino?.trim())
    .sort((a, b) => String(b.horario_pouso).localeCompare(String(a.horario_pouso)) || b.numero - a.numero)[0];
  if (!pouso) return null;

  const base = [ultima.data, pouso.horario_corte?.slice(0, 10), pouso.horario_pouso?.slice(0, 10)]
    .filter((data): data is string => Boolean(data && /^\d{4}-\d{2}-\d{2}$/.test(data)))
    .sort().at(-1);
  if (!base) return null;
  const proximaData = new Date(`${base}T12:00:00Z`);
  proximaData.setUTCDate(proximaData.getUTCDate() + 1);

  return {
    origem: pouso.destino.trim().toUpperCase(),
    destino: "",
    numero_passageiros: String(pouso.numero_passageiros ?? item.numero_passageiros ?? 0),
    data: [dataAtual, proximaData.toISOString().slice(0, 10)].sort().at(-1)!,
  };
}
