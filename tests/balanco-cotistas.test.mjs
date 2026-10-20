import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularBalancoMensal, simularProximaDespesa } from '../src/lib/balanco-cotistas.ts'

const participantes = [
  { id: 'a', nome: 'A', dominio: 'CLIENTES' },
  { id: 'b', nome: 'B', dominio: 'CLIENTES' },
]
const rateio = (id, participanteId, pagoReal = 0) => ({
  id, participanteId, dominio: 'CLIENTES', origemChave: 'despesa-1', competencia: '2026-10-01',
  categoria: 'Seguro', descricao: 'Seguro', tipo: 'FIXO', devido: 50000, pagoReal, pagadorId: null,
  direto: false, dataPagamento: '2026-10-04', status: 'EM_ABERTO',
})
const calcular = (pagadorTipo, pagadorId = null) => calcularBalancoMensal(
  participantes,
  [rateio('r1', 'a', 50000), rateio('r2', 'b')],
  [{ id: 'p1', rateioId: 'r1', pagadorId, tipoPagador: pagadorTipo, valor: 50000, data: '2026-10-04', status: 'CONFIRMADO' }],
  [], '2026-10-01', '2026-10-31',
)

test('pagamento Share não é desembolso pessoal nem bloqueio de simulação', () => {
  const balanco = calcular('SHARE')
  assert.equal(balanco.pagoPessoalCentavos, 0)
  assert.ok(!balanco.avisos.some((aviso) => aviso.includes('Pagamento sem cotista identificável')))
  assert.doesNotThrow(() => simularProximaDespesa(balanco, 10000, [{ id: 'a', peso: 50 }, { id: 'b', peso: 50 }]))
})

test('pagamento legado não direto é caixa comum e não gera falso alerta', () => {
  const rateios = [rateio('r1', 'a', 50000), rateio('r2', 'b')]
  rateios[0].direto = false
  const balanco = calcularBalancoMensal(participantes, rateios, [], [], '2026-10-01', '2026-10-31')
  assert.equal(balanco.pagoPessoalCentavos, 0)
  assert.ok(!balanco.avisos.some((aviso) => aviso.includes('Pagamento sem cotista identificável')))
  assert.doesNotThrow(() => simularProximaDespesa(balanco, 10000, [{ id: 'a', peso: 50 }, { id: 'b', peso: 50 }]))
})

test('pagamento de cotista sem associação continua bloqueando a simulação', () => {
  const balanco = calcular('COTISTA')
  assert.ok(balanco.avisos.some((aviso) => aviso.includes('Pagamento sem cotista identificável')))
  assert.throws(() => simularProximaDespesa(balanco, 10000, [{ id: 'a', peso: 50 }, { id: 'b', peso: 50 }]), /Concilie os avisos/)
})
