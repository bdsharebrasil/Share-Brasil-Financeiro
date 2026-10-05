export type PeriodoCotista = { inicio: string; fim: string }

export function mesAtualLocal(data = new Date()): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

export function periodoDoMes(competencia: string): PeriodoCotista | null {
  const correspondencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(competencia)
  if (!correspondencia) return null
  const ano = Number(correspondencia[1])
  const mes = Number(correspondencia[2])
  const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)
  return { inicio: `${competencia}-01`, fim }
}

export function periodoPersonalizadoValido(inicio: string, fim: string): boolean {
  const formatoValido = (data: string) => {
    const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
    if (!correspondencia) return false
    const [, ano, mes, dia] = correspondencia
    const date = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)))
    return date.toISOString().slice(0, 10) === data
  }
  return formatoValido(inicio) && formatoValido(fim) && inicio <= fim
}

export function rotuloMesCotista(competencia: string): string {
  const periodo = periodoDoMes(competencia)
  if (!periodo) return competencia
  return new Date(`${periodo.inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function agruparPorMes<T extends { data?: string | null }>(itens: readonly T[]): Array<{ mes: string; itens: T[] }> {
  const grupos = new Map<string, T[]>()
  for (const item of itens) {
    const data = String(item.data ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue
    const mes = data.slice(0, 7)
    const grupo = grupos.get(mes) ?? []
    grupo.push(item)
    grupos.set(mes, grupo)
  }
  return [...grupos.entries()].sort(([mesA], [mesB]) => mesB.localeCompare(mesA)).map(([mes, itensDoMes]) => ({ mes, itens: itensDoMes }))
}
