const HEMISFERIOS_NEGATIVOS = new Set(["S", "W"]);

/**
 * Converte uma coordenada decimal ou DMS para graus decimais.
 * S (Sul) e W (Oeste) sempre resultam em valor negativo.
 * Exemplos: "20 36 14 S" -> -20.60388889 e "54 35 43 W" -> -54.59527778.
 */
export function coordenadaDMSParaDecimal(valor: string): string {
  const original = valor.trim();
  if (!original) return original;

  const normalizado = original
    .replace(/[º°]/g, " ")
    .replace(/[′']/g, " ")
    .replace(/[″\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const partes = normalizado.split(" ").filter(Boolean);
  const hemisferio = partes.find((parte) => /^[NSEW]$/.test(parte));
  const numeros = partes.filter((parte) => !/^[NSEW]$/.test(parte));
  if (!hemisferio || numeros.length < 1 || numeros.length > 3 || numeros.some((parte) => Number.isNaN(Number(parte)))) return original;

  const graus = Math.abs(Number(numeros[0]));
  const minutos = numeros.length > 1 ? Number(numeros[1]) : 0;
  const segundos = numeros.length > 2 ? Number(numeros[2]) : 0;
  if (minutos < 0 || minutos >= 60 || segundos < 0 || segundos >= 60) return original;

  const decimal = graus + minutos / 60 + segundos / 3600;
  const sinal = HEMISFERIOS_NEGATIVOS.has(hemisferio) ? -1 : 1;
  return (sinal * decimal).toFixed(8);
}

/** Normaliza um par latitude,longitude separado por vírgula. */
export function normalizarCoordenadas(valor: string): string {
  const partes = valor.split(",");
  return partes.length === 2 ? partes.map(coordenadaDMSParaDecimal).join(",") : coordenadaDMSParaDecimal(valor);
}
