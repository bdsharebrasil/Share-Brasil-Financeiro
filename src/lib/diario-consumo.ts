type Registro = {
  tempo_total: number; tempo_voo: number;
  consumo_combustivel_total?: number | null; consumo_combustivel_voo?: number | null;
  litros_combustivel_abastecido: number; abastecimento_id?: string | null;
  abastecimento_litros?: number | null; abastecimento_valor_total?: number | null;
  abastecimento_litros_precificados?: number | null; abastecimento_valor_precificado?: number | null;
};
const positivo = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
export function resumoConsumo(registros: Registro[], modo: "celula" | "tvoo") {
  let horas = 0, horasComConsumo = 0, consumo = 0, abastecido = 0, gasto = 0, litrosPrecificados = 0, valorPrecificado = 0, semConsumo = 0;
  let temGasto = false;
  for (const r of registros) {
    const h = positivo(modo === "celula" ? r.tempo_total : r.tempo_voo);
    const litros = positivo(modo === "celula" ? r.consumo_combustivel_total : r.consumo_combustivel_voo);
    horas += h;
    if (h > 0 && litros > 0) { horasComConsumo += h; consumo += litros; }
    else if (h > 0) semConsumo++;
    abastecido += positivo(r.abastecimento_id ? r.abastecimento_litros : r.litros_combustivel_abastecido);
    if (positivo(r.abastecimento_valor_total)) { temGasto = true; gasto += positivo(r.abastecimento_valor_total); }
    litrosPrecificados += positivo(r.abastecimento_litros_precificados);
    valorPrecificado += positivo(r.abastecimento_valor_precificado);
  }
  const media = horasComConsumo > 0 ? consumo / horasComConsumo : null;
  const preco = litrosPrecificados > 0 && valorPrecificado > 0 ? valorPrecificado / litrosPrecificados : null;
  return { horas, consumo: horasComConsumo > 0 ? consumo : null, abastecido, gasto: temGasto ? gasto : null, media, preco, custoHora: media !== null && preco !== null ? media * preco : null, litrosPrecificados, semConsumo };
}
