import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { trechosPlanejados, pontosParaEnquadrar } from '../src/lib/rastreio-mapa.ts'
import { coordenadaReferenciaAerodromo } from '../src/lib/aerodromos-referencia.ts'

const trecho = (id, origem, destino, a, b) => ({
  id, numero: 1, jornada_numero: 1, origem, destino, status: 'em_voo',
  origem_coord: a, destino_coord: b,
  horario_ac: '2026-11-19T16:20:00Z',
  horario_dep: '2026-11-19T16:30:00Z',
  horario_pouso: null, horario_corte: null,
})

test('PT-WSR: rota da perna existe sem nenhum ADS-B; nunca cria avião ou trilha falsa', () => {
  const voo = {
    id: 'voo-ptwsr', origem: 'SIAQ', destino: 'SWJN',
    origem_coord: { lat: -15.6, lon: -56.3 },
    destino_coord: { lat: -14.8, lon: -57.0 },
    pernas: [trecho('p1', 'SIAQ', 'SWJN', { lat: -15.6, lon: -56.3 }, { lat: -14.8, lon: -57.0 })],
    trilha: [], rastreio: null, rastreio_status: 'sem_sinal',
  }
  const planejadas = trechosPlanejados(voo)
  assert.equal(planejadas.length, 1)
  assert.deepEqual(planejadas[0].coordenadas, [[-56.3, -15.6], [-57, -14.8]])
  assert.equal(pontosParaEnquadrar(voo).length >= 2, true)
  assert.equal(voo.trilha.length, 0, 'não fabrica percurso ADS-B')
  assert.equal(voo.rastreio, null, 'não fabrica posição do avião')
})

test('rota é desenhada usando origem/destino mesmo se as pernas ainda não tiverem coordenadas', () => {
  const voo = {
    id: 'voo-ptwsr', origem: 'SIAQ', destino: 'SWJN',
    origem_coord: { lat: -15.6, lon: -56.3 }, destino_coord: { lat: -14.8, lon: -57 },
    pernas: [trecho('p1', 'SIAQ', 'SWJN', null, null)], trilha: [], rastreio: null,
  }
  assert.equal(trechosPlanejados(voo).length, 1)
  assert.deepEqual(trechosPlanejados(voo)[0].coordenadas, [[-56.3, -15.6], [-57, -14.8]])
})

test('pernas distintas são separadas, sem ligar lacunas como se fossem ADS-B', () => {
  const voo = {
    id: 'voo-1', origem: 'A', destino: 'C',
    origem_coord: null, destino_coord: null, trilha: [], rastreio: null,
    pernas: [
      trecho('p1', 'A', 'B', { lat: -14, lon: -55 }, { lat: -15, lon: -56 }),
      trecho('p2', 'B', 'C', { lat: -15, lon: -56 }, { lat: -16, lon: -57 }),
    ],
  }
  assert.equal(trechosPlanejados(voo).length, 2)
  assert.equal(trechosPlanejados(voo)[0].id, 'p1')
  assert.equal(trechosPlanejados(voo)[1].id, 'p2')
})

test('card sempre monta mapa, monitor mostra AC/DEP e o hook resolve origem e destino', async () => {
  const arquivos = await Promise.all([
    readFile(new URL('../src/components/dashboard/operacoes/VooEmOperacaoCard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/dashboard/operacoes/VooEmOperacaoMapa.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/dashboard/operacoes/HistoricoRastreioVoo.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/agendamento/VoosDeHoje.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/useVoosEmOperacao.ts', import.meta.url), 'utf8'),
  ])
  const [card, mapa, historico, monitor, hook] = arquivos
  assert.match(card, /<MapaRastreio key=\{voo\.id\}/)
  assert.doesNotMatch(card, /aoVivo \|\| Boolean\(voo\.trilha\?\.length\) \?/)
  assert.match(mapa, /World_Imagery/)
  assert.match(mapa, /rota-prevista/)
  assert.match(mapa, /Linha tracejada: rota prevista/)
  assert.match(historico, /function dataHoraRastreio/)
  assert.match(historico, /Sinal recebido no mapa/)
  assert.match(monitor, /horarioRastreio\(horario\)/)
  assert.match(monitor, /Trechos e horários registrados/)
  assert.match(monitor, /voosEmOperacao\.filter\(\(voo\) => voo\.status === "em_voo" && agendamentosHoje\.some\(\(item\) => item\.id === voo\.id\)\)/)
  assert.match(monitor, /<HistoricoRastreioVoo voo=\{vooSelecionado\} \/>/)
  assert.match(monitor, /Trecho detectado pelo sistema/)
  assert.match(monitor, /Sinais ADS-B; pouso não confirmado/)
  assert.match(monitor, /agendamentosEmVoo = agendamentosHoje\.filter\(\(item\) => porId\.has\(item\.id\)\)/)
  assert.match(monitor, /Voos em voo hoje/)
  assert.match(historico, /const ultimaPerda = todosEventos\.filter/)
  assert.match(historico, /evento\.id === ultimaPerda\?\.id/)
  assert.match(mapa, /pernaId\?: string/)
  assert.match(hook, /voo\.origem, voo\.destino/)
  assert.match(hook, /voo\.perna_atual\?\.origem, voo\.perna_atual\?\.destino/)
  assert.match(hook, /origem_coord: coord\(voo\.perna_atual\.origem, voo\.perna_atual\.origem_coord\)/)
  assert.match(hook, /resolverAerodromo\(icao\)/)
})

test('coordenadas AISWEB SIAQ e SWJN garantem o traçado planejado se D1/ROTAER não resolverem', () => {
  const origem = coordenadaReferenciaAerodromo('SIAQ')
  const destino = coordenadaReferenciaAerodromo('swjn')
  assert.ok(origem && destino, 'dois aeródromos possuem referência oficial')
  assert.ok(origem.lat < -15 && origem.lat > -16)
  assert.ok(destino.lat < -11 && destino.lat > -12)
  const voo = { id: 'voo', origem: 'SIAQ', destino: 'SWJN',
    origem_coord: origem, destino_coord: destino, pernas: [], trilha: [], rastreio: null }
  assert.equal(trechosPlanejados(voo).length, 1)
  assert.equal(pontosParaEnquadrar(voo).length >= 2, true)
  assert.equal(coordenadaReferenciaAerodromo('SXXX'), null, 'não inventa aeródromos sem coordenadas')
})

test('perna atual detectada pelo sistema também vira rota individual no mapa', () => {
  const detectada = trecho('p-detectada', 'SIAQ', 'SWJN', { lat: -15.6, lon: -56.3 }, { lat: -14.8, lon: -57 })
  const voo = {
    id: 'voo-1', origem: 'SIAQ', destino: 'SWJN', origem_coord: null, destino_coord: null,
    pernas: [], perna_atual: detectada, trilha: [], rastreio: null,
  }
  assert.deepEqual(trechosPlanejados(voo), [{
    id: 'p-detectada', origem: 'SIAQ', destino: 'SWJN', coordenadas: [[-56.3, -15.6], [-57, -14.8]],
  }])
})

test('perna atual mantém rota própria mesmo quando já existem pernas anteriores cadastradas', () => {
  const anterior = trecho('p-anterior', 'SIAQ', 'SWJN', { lat: -15.5, lon: -56.1 }, { lat: -11.4, lon: -58.7 })
  const atual = trecho('p-atual', 'SWJN', 'SIAQ', { lat: -11.4, lon: -58.7 }, { lat: -15.5, lon: -56.1 })
  const voo = {
    id: 'voo-1', origem: 'SIAQ', destino: 'SWJN', origem_coord: atual.origem_coord, destino_coord: atual.destino_coord,
    pernas: [anterior], perna_atual: atual, trilha: [], rastreio: null,
  }
  const rotas = trechosPlanejados(voo)
  assert.deepEqual(rotas.map(({ id }) => id), ['p-anterior', 'p-atual'])
  assert.deepEqual(rotas[1].coordenadas, [[-58.7, -11.4], [-56.1, -15.5]])
})
