type DespesaComData = { data: string };

function avancarUmDia(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const proxima = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return Number.isFinite(proxima.getTime()) ? proxima.toISOString().slice(0, 10) : data;
}

export function dataProximaDespesa(
  despesas: DespesaComData[],
  dataInicio: string,
  dataFim: string,
) {
  if (despesas.length === 0) return dataInicio || undefined;

  const ultimaData = despesas[despesas.length - 1]?.data || dataInicio;
  if (!ultimaData) return undefined;

  const base = dataInicio && ultimaData < dataInicio ? dataInicio : ultimaData;
  const proxima = avancarUmDia(base);
  return dataFim && base <= dataFim && proxima > dataFim ? dataFim : proxima;
}
