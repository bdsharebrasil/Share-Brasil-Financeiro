/**
 * Comprovantes do relatório devem pertencer a uma despesa concreta.
 * Registros legados sem índice ou com índice inválido são ignorados no PDF
 * em vez de serem exibidos como "Item não identificado".
 */
export function anexosComDespesa<T extends { indice_despesa?: number | string | null }>(
  anexos: T[],
  totalDespesas: number,
): Array<{ anexo: T; indiceOriginal: number }> {
  if (!Number.isInteger(totalDespesas) || totalDespesas <= 0) return [];

  return anexos.flatMap((anexo) => {
    const valor = anexo.indice_despesa;
    if (valor === null || valor === undefined || valor === "") return [];

    const indiceOriginal = Number(valor);
    if (!Number.isInteger(indiceOriginal) || indiceOriginal < 0 || indiceOriginal >= totalDespesas) {
      return [];
    }

    return [{ anexo, indiceOriginal }];
  });
}
