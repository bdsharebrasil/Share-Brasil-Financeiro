export function formatBRL(valor: number, compacto = false): string {
  if (compacto && Math.abs(valor) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(valor);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(valor);
}

export function formatNumero(valor: number, casas = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  }).format(valor);
}

export function formatPercentual(valor: number, casas = 1): string {
  return `${formatNumero(valor, casas)}%`;
}

export function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatHoras(horas: number): string {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}