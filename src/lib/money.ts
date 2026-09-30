export function parseReaisToCentavos(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : 0;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3},)/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function formatReais(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export function formatCentavos(value: number | null | undefined): string {
  return formatReais(Number(value || 0) / 100);
}

export function allocateCentavos(totalCentavos: number, percentages: number[]): number[] {
  const total = Math.round(totalCentavos);
  if (!percentages.length) return [];
  const denominator = percentages.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (!denominator) return percentages.map(() => 0);
  const result: number[] = [];
  let allocated = 0;
  percentages.forEach((percentage, index) => {
    const value = index === percentages.length - 1
      ? total - allocated
      : Math.round(total * Math.max(0, Number(percentage) || 0) / denominator);
    result.push(value);
    allocated += value;
  });
  return result;
}
