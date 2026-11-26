const DIA_MS = 24 * 60 * 60 * 1000;

function dataIsoMs(valor: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const ms = Date.parse(`${valor}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === valor ? ms : null;
}

/** Move a data final pelo mesmo número de dias da nova data de saída. */
export function ajustarPeriodoAoAlterarDataSaida(
  dataSaidaAtual: string,
  dataFinalAtual: string,
  novaDataSaida: string,
): { data_agendada: string; data_fim: string } {
  const novaSaidaMs = dataIsoMs(novaDataSaida);
  if (novaSaidaMs === null) {
    return { data_agendada: novaDataSaida, data_fim: dataFinalAtual };
  }

  const saidaAtualMs = dataIsoMs(dataSaidaAtual);
  const finalAtualMs = dataIsoMs(dataFinalAtual);
  if (saidaAtualMs === null || finalAtualMs === null || finalAtualMs < saidaAtualMs) {
    return { data_agendada: novaDataSaida, data_fim: novaDataSaida };
  }

  const duracaoDias = Math.round((finalAtualMs - saidaAtualMs) / DIA_MS);
  const novaDataFinal = new Date(novaSaidaMs + duracaoDias * DIA_MS).toISOString().slice(0, 10);
  return { data_agendada: novaDataSaida, data_fim: novaDataFinal };
}
