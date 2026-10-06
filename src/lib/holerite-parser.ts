export type HoleriteLido = {
  nomeColaborador: string | null
  ano: number
  mes: number
  totalVencimentosCentavos: number | null
  totalDescontosCentavos: number | null
  totalLiquidoCentavos: number
  salarioBaseCentavos: number | null
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const VALOR_BR = String.raw`(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}`

function paraCentavos(valor: string | undefined): number | null {
  if (!valor) return null
  const normalizado = valor.replace(/^R\$\s*/i, '').replace(/\./g, '').replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? Math.round(numero * 100) : null
}

function localizarValor(texto: string, expressao: RegExp): number | null {
  const correspondencia = expressao.exec(texto)
  return paraCentavos(correspondencia?.[1])
}

export function analisarTextoHolerite(textoOriginal: string): HoleriteLido | null {
  const texto = textoOriginal.replace(/\s+/g, ' ').trim()
  if (!/valor\s+l[ií]quido/i.test(texto) || !/total\s+de\s+vencimentos/i.test(texto)) return null

  const competencia = new RegExp(`\\b(${MESES.join('|')})\\s+de\\s+(20\\d{2})\\b`, 'i').exec(texto)
  const nome = /Nome\s+do\s+Funcion[aá]rio\s+CBO\s+Departamento\s+Filial\s+\d{1,6}\s+(.+?)\s+\d{6}\b/i.exec(texto)
  const nomeAlternativo = /\b\d{1,6}\s+([A-ZÀ-Ý][A-ZÀ-Ý' -]{4,}?)\s+\d{6}\s+\d{1,3}\s+\d{1,3}\b/i.exec(texto)
  const indiceMes = competencia ? MESES.indexOf(competencia[1].toLocaleLowerCase('pt-BR')) : -1
  const totalLiquidoCentavos = localizarValor(texto, new RegExp(`Valor\\s+L[ií]quido[\\s\\S]{0,120}?(${VALOR_BR})`, 'i'))
  const totais = new RegExp(`Total\\s+de\\s+Vencimentos\\s+Total\\s+de\\s+Descontos[\\s\\S]{0,240}?(${VALOR_BR})\\s+(${VALOR_BR})`, 'i').exec(texto)
  const salarioBaseCentavos = localizarValor(texto, new RegExp(`Sal[aá]rio\\s+Base[\\s\\S]{0,160}?(${VALOR_BR})`, 'i'))

  if (indiceMes < 0 || !competencia || !totalLiquidoCentavos || totalLiquidoCentavos <= 0) return null

  return {
    nomeColaborador: (nome?.[1] ?? nomeAlternativo?.[1] ?? null)?.trim().replace(/\s+/g, ' ') ?? null,
    ano: Number(competencia[2]),
    mes: indiceMes + 1,
    totalVencimentosCentavos: paraCentavos(totais?.[1]),
    totalDescontosCentavos: paraCentavos(totais?.[2]),
    totalLiquidoCentavos,
    salarioBaseCentavos,
  }
}
