import test from 'node:test'
import assert from 'node:assert/strict'
import { analisarTextoHolerite } from '../src/lib/holerite-parser.ts'

const textoHolerite = `
SHARE BRASIL SERVICOS AEROPORT LTDA
Folha Mensal Mensalista Dezembro de 2025
Código Nome do Funcionário CBO Departamento Filial
16 PESSOA TESTE DA SILVA 411010 1 1
Código Descrição Referência Vencimentos Descontos
8781 DIAS NORMAIS 21,00 3.000,00
937 ADIANTAMENTO 0,00 200,00
998 INSS 7,50 10,00
Total de Vencimentos Total de Descontos
3.000,00 210,00
Valor Líquido 2.790,00
Salário Base Sal. Contr. INSS Base Cálc. FGTS
1.800,00 3.000,00 3.000,00
`

test('lê colaborador, competência e valores do holerite', () => {
  assert.deepEqual(analisarTextoHolerite(textoHolerite), {
    nomeColaborador: 'PESSOA TESTE DA SILVA',
    ano: 2025,
    mes: 12,
    totalVencimentosCentavos: 300000,
    totalDescontosCentavos: 21000,
    totalLiquidoCentavos: 279000,
    salarioBaseCentavos: 180000,
  })
})

test('rejeita recibos sem competência completa ou campos essenciais', () => {
  assert.equal(analisarTextoHolerite(textoHolerite.replace('Dezembro de 2025', 'Dezembro/2025')), null)
  assert.equal(analisarTextoHolerite('Documento financeiro. Valor Líquido 100,00'), null)
})
