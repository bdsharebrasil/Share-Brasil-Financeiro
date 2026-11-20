/**
 * Indicadores financeiros por categoria econômica dos lançamentos atribuídos.
 *
 * Ticket médio = soma do custo rateado / número de lançamentos distintos
 * com parte positiva no período, e NÃO número de pernas ou litros de voo.
 * A mesma fonte é usada no balanço da tela e no PDF.
 */
export type LancamentoDespesaAtribuida = {
  id: string;
  categoria: string;
  suaParteCentavos: number;
};

export type IndicadorDespesa = {
  totalCentavos: number;
  quantidade: number;
  ticketMedioCentavos: number | null;
};

export type IndicadoresViagemCombustivel = {
  viagens: IndicadorDespesa;
  combustivel: IndicadorDespesa;
};

type GrupoDespesa = keyof IndicadoresViagemCombustivel;

const normalizarCategoria = (nome: string) =>
  String(nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const categoriasViagem = new Set([
  "DESPESAS DE VIAGEM", "DESPESA DE VIAGEM", "RELATORIO DE VIAGEM",
]);
const categoriasCombustivel = new Set([
  "COMBUSTIVEIS", "COMBUSTIVEL", "ABASTECIMENTO", "ABASTECIMENTOS",
]);

export function categoriaIndicadorDespesa(nome: string): GrupoDespesa | null {
  const categoria = normalizarCategoria(nome);
  if (categoriasViagem.has(categoria)) return "viagens";
  if (categoriasCombustivel.has(categoria)) return "combustivel";
  return null;
}

export function calcularIndicadoresViagemCombustivel(
  lancamentos: readonly LancamentoDespesaAtribuida[],
): IndicadoresViagemCombustivel {
  const totais: Record<GrupoDespesa, number> = { viagens: 0, combustivel: 0 };
  const ids: Record<GrupoDespesa, Set<string>> = {
    viagens: new Set<string>(),
    combustivel: new Set<string>(),
  };

  for (const lancamento of lancamentos) {
    const grupo = categoriaIndicadorDespesa(lancamento.categoria);
    if (!grupo) continue;
    const valor = Number(lancamento.suaParteCentavos);
    if (!Number.isFinite(valor) || valor === 0) continue;
    totais[grupo] += valor;
    if (valor > 0 && lancamento.id) ids[grupo].add(String(lancamento.id));
  }

  const resumo = (grupo: GrupoDespesa): IndicadorDespesa => {
    const quantidade = ids[grupo].size;
    const totalCentavos = Math.round(totais[grupo]);
    return {
      totalCentavos,
      quantidade,
      ticketMedioCentavos: quantidade ? Math.round(totalCentavos / quantidade) : null,
    };
  };
  return { viagens: resumo("viagens"), combustivel: resumo("combustivel") };
}
