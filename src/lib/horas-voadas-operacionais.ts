import type { HorasVoadasOperacionaisResponse } from "./colaborador-api";

export function formatarHorasVoadas(minutos: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutos) ? minutos : 0));
  const horas = Math.floor(total / 60);
  const restante = total % 60;
  return restante ? `${horas}h ${restante}m` : `${horas}h`;
}

type Total = { minutos: number; trechos: number };

function somar(total: Total, linha: Total) {
  total.minutos += linha.minutos;
  total.trechos += linha.trechos;
  return total;
}

export function consolidarHorasVoadas(
  dados: HorasVoadasOperacionaisResponse | null,
  ano: number,
  mes: number,
) {
  const chaveMes = `${ano}-${String(mes).padStart(2, "0")}`;
  const aeronaves = dados?.aeronaves || [];
  const idsAtivos = new Set(aeronaves.map((aeronave) => aeronave.id));

  // Descartar linhas de aeronaves fora do cadastro ativo, inclusive respostas legadas.
  const registros = (dados?.dias || [])
    .filter((item) => idsAtivos.has(item.aeronave_id) && /^\d{4}-\d{2}-\d{2}$/.test(item.data))
    .map((item) => ({
      ...item,
      minutos: Math.max(0, Math.round(Number(item.minutos) || 0)),
      trechos: Math.max(0, Math.round(Number(item.trechos) || 0)),
    }));

  const registrosMes = registros.filter((item) => item.data.startsWith(chaveMes));
  const porAeronave = aeronaves.map((aeronave) => {
    const total = registrosMes
      .filter((item) => item.aeronave_id === aeronave.id)
      .reduce(somar, { minutos: 0, trechos: 0 });
    return {
      ...aeronave,
      ...total,
      modeloExibicao: [aeronave.fabricante, aeronave.modelo].filter(Boolean).join(" ") || "Modelo não informado",
    };
  }).sort((a, b) => a.matricula_registro.localeCompare(b.matricula_registro, "pt-BR"));

  // Total e cartões da frota derivam da mesma agregação exibida no modal.
  const totalMes = porAeronave.reduce(somar, { minutos: 0, trechos: 0 });

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const porMes = meses.map((nome, indice) => {
    const chave = `${ano}-${String(indice + 1).padStart(2, "0")}`;
    return { mes: nome, ...registros.filter((item) => item.data.startsWith(chave)).reduce(somar, { minutos: 0, trechos: 0 }) };
  });

  const mapaDias = new Map<string, Total>();
  for (const item of registrosMes) {
    const atual = mapaDias.get(item.data) || { minutos: 0, trechos: 0 };
    mapaDias.set(item.data, somar(atual, item));
  }
  const porDia = [...mapaDias].sort(([a], [b]) => b.localeCompare(a))
    .map(([data, total]) => ({ data, ...total }));

  const porAno = [ano - 1, ano].map((referencia) => ({
    ano: referencia,
    ...registros.filter((item) => item.data.startsWith(`${referencia}-`))
      .reduce(somar, { minutos: 0, trechos: 0 }),
  }));

  return { porAeronave, totalMes, porMes, porDia, porAno };
}
