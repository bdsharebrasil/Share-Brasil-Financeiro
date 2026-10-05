import test from 'node:test'
import assert from 'node:assert/strict'
import { agruparPorMes, mesAtualLocal, periodoDoMes, periodoPersonalizadoValido, rotuloMesCotista } from '../src/lib/financeiro-cotista-periodo.ts'

test('resolve começo e fim de meses com duração variável e ano bissexto', () => {
  assert.deepEqual(periodoDoMes('2024-02'), { inicio: '2024-02-01', fim: '2024-02-29' })
  assert.deepEqual(periodoDoMes('2026-02'), { inicio: '2026-02-01', fim: '2026-02-28' })
  assert.deepEqual(periodoDoMes('2026-13'), null)
})

test('valida intervalo de datas completo e rejeita data inexistente ou invertida', () => {
  assert.equal(periodoPersonalizadoValido('2026-05-01', '2026-05-31'), true)
  assert.equal(periodoPersonalizadoValido('2026-02-29', '2026-03-01'), false)
  assert.equal(periodoPersonalizadoValido('2026-06-02', '2026-06-01'), false)
  assert.equal(periodoPersonalizadoValido('', '2026-06-01'), false)
})

test('agrupa registros em ordem decrescente de competência e ignora registros sem data válida', () => {
  const grupos = agruparPorMes([
    { data: '2026-01-31', id: 'jan-1' },
    { data: '2026-02-01', id: 'fev-1' },
    { data: '2026-01-08', id: 'jan-2' },
    { data: null, id: 'sem-data' },
  ])
  assert.deepEqual(grupos, [
    { mes: '2026-02', itens: [{ data: '2026-02-01', id: 'fev-1' }] },
    { mes: '2026-01', itens: [{ data: '2026-01-31', id: 'jan-1' }, { data: '2026-01-08', id: 'jan-2' }] },
  ])
})

test('usa data local para competência atual e nome em português para exibição', () => {
  assert.equal(mesAtualLocal(new Date(2026, 8, 30)), '2026-09')
  assert.match(rotuloMesCotista('2026-01'), /janeiro.*2026/i)
})
