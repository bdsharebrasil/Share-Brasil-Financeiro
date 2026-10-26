import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarLancamentoUnificado } from '../src/lib/lancamentos-unificados.ts'

test('normaliza resposta canônica em centavos e conserva caixa, fluxo e vínculos', () => {
  const result = normalizarLancamentoUnificado({
    id: 'lancamento-12345678', fluxo: 'ENTRADA', caixa: 'CLIENTE', descricao: 'Aporte',
    natureza: 'APORTE', categoria: 'Cotista', favorecido: 'Cotista A',
    data_lancamento: '2026-10-26T00:00:00.000Z', data_vencimento: '2026-10-30',
    status: 'PENDENTE', situacao: 'PENDENTE', valor_centavos: 12345,
    reembolsavel: 0, cotista_id: 'cotista-1', origem_tipo: 'lancamentos',
    origem_id: 'lancamento-12345678', lancamento_id: 'lancamento-12345678',
  })
  assert.equal(result.fluxo, 'ENTRADA')
  assert.equal(result.caixa, 'CLIENTE')
  assert.equal(result.valor, 123.45)
  assert.equal(result.dataLancamento, '2026-10-26')
  assert.equal(result.cotistaId, 'cotista-1')
  assert.equal(result.origem, 'lancamentos')
})

test('usa a situação derivada recebida pelo backend e mantém linhas sem valor monetário inválido', () => {
  const result = normalizarLancamentoUnificado({
    id: 'atrasado-1', fluxo: 'SAIDA', caixa: 'SHARE', data_vencimento: '2026-10-01',
    status: 'PENDENTE', situacao: 'ATRASADO', valor_centavos: 500,
  })
  assert.equal(result.situacao, 'ATRASADO')
  assert.equal(result.valor, 5)
})
