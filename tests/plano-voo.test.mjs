import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function modulo(path, substituir = {}) {
  let codigo = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(codigo, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 } });
  for (const [de, para] of Object.entries(substituir)) outputText = outputText.replaceAll(de, para);
  return 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64');
}
const format = await modulo('src/lib/format.ts');
const { codigoAerodromoValido, ordenarPernas, pernaInicial, formularioDaPerna, localizarAgendamento, horarioFpl, lerRascunho, guardarRascunho } = await import(await modulo('src/lib/plano-voo.ts', {'"./format"': JSON.stringify(format)}));
const { distanciaNM, proaVerdadeira, arcoCirculoMaximo, interpretarCoordenadas } = await import(await modulo('src/lib/navegacao.ts'));
const { provedorContingencia, aeronauticoDisponivel } = await import(await modulo('src/components/plano/provedor.ts', { 'import.meta.env': '{}' }));

test('localiza por ID e normaliza o número sem escolher um agendamento ambíguo', () => {
  const voo = { id: 'a', numero_voo: 'EBL-0003/26' };
  assert.equal(localizarAgendamento([voo], 'ebl 0003 26'), voo);
  const outro = { ...voo, id: 'b' };
  assert.equal(localizarAgendamento([voo, outro], 'b'), outro);
  assert.throws(() => localizarAgendamento([voo, outro], voo.numero_voo), /mais de um/);
  assert.throws(() => localizarAgendamento([voo], 'EBL-99'), /não encontrado/);
});
test('EOBT aceita HH:MM e converte ISO para UTC, incluindo a virada de data', () => {
  assert.deepEqual(horarioFpl('15:40', '2026-11-18'), { data: '2026-11-18', hora: '15:40' });
  assert.deepEqual(horarioFpl('2026-11-18T23:30:00-03:00', '2026-11-18'), { data: '2026-11-19', hora: '02:30' });
  assert.equal(horarioFpl('2026-11-18T13:20:00Z', '2026-11-18').hora, '13:20');
  assert.equal(horarioFpl('inválido', '').hora, '');
});
test('preserva formulário e aeródromo por usuário; ignora registro corrompido ou vencido', () => {
  const valores = new Map();
  const storage = { getItem: k => valores.get(k) ?? null, setItem: (k, v) => valores.set(k, v) };
  const dados = { formulario: { adep: 'SBGR', ades: 'SBRJ', alternado1: 'SBCF' }, aerodromoAtivo: 'SBCF', consultaAerodromo: 'SBCY' };
  assert.equal(guardarRascunho(storage, 'usuario-a', dados), true);
  assert.deepEqual(lerRascunho(storage, 'usuario-a'), dados);
  assert.equal(lerRascunho(storage, 'usuario-b'), null);
  assert.equal(lerRascunho({ getItem: () => '{quebrado' }, 'usuario-a'), null);
  assert.equal(lerRascunho({ getItem: () => JSON.stringify({ versao: 1, salvoEm: 0, dados }) }, 'usuario-a'), null);
  assert.equal(guardarRascunho({ setItem: () => { throw Error('Quota'); } }, 'usuario-a', dados), false);
});
test('régua mede também pontos no mesmo meridiano e mantém os extremos do traçado', () => {
  const a = { lat: 0, lon: -50 }, b = { lat: 1, lon: -50 };
  assert.ok(distanciaNM(a, b) > 59 && distanciaNM(a, b) < 61);
  assert.equal(proaVerdadeira(a, b), 0);
  const arco = arcoCirculoMaximo(a, b);
  assert.ok(Math.abs(arco[0][0] + 50) < 1e-10 && Math.abs(arco[0][1]) < 1e-10);
  assert.ok(Math.abs(arco.at(-1)[1] - 1) < 1e-10);
  assert.equal(distanciaNM(a, a), 0);
  assert.deepEqual(interpretarCoordenadas('-23.4356, -46.4731'), { lat: -23.4356, lon: -46.4731 });
  const gms = interpretarCoordenadas(`23°26'12"S / 046°28'24"W`);
  assert.ok(gms.lat < 0 && gms.lon < 0);
  assert.ok(Math.abs(gms.lat + (23 + 26 / 60 + 12 / 3600)) < 1e-10);
  assert.equal(interpretarCoordenadas('91 00 S / 046 28 W'), null);
  assert.equal(interpretarCoordenadas('23 99 S / 046 28 W'), null);
});
test('mapa, terreno e satélite usam bases distintas mesmo sem chave; não simula carta aeronáutica', () => {
  const tiles = ['padrao', 'terreno', 'satelite'].map(estilo => provedorContingencia.estilo(estilo).sources.base.tiles[0]);
  assert.equal(new Set(tiles).size, 3);
  assert.ok(tiles[1].includes('opentopomap'));
  assert.ok(tiles[2].includes('World_Imagery'));
  assert.equal(aeronauticoDisponivel, false);
  assert.throws(() => provedorContingencia.estilo('aeronautico'), /indisponíveis/);
});

const trecho = (id, numero, extra = {}) => ({ id, jornada_id: 'j1', numero_jornada: 1, data: '2026-11-18', numero, origem: 'SBGR', destino: 'SN9T', numero_passageiros: 3, status: 'programada', horario_ac: null, horario_dep: null, horario_pouso: null, horario_corte: null, ...extra });
test('designativos de aeródromo aceitam quatro letras ou números, sem pontuação', () => {
  for (const codigo of ['SN9T', ' sn9t ', 'SBGR', 'SS9A']) assert.equal(codigoAerodromoValido(codigo), true);
  for (const codigo of ['', 'SN9', 'SN9TT', 'SN-T', 'S N9T', 'SN/T']) assert.equal(codigoAerodromoValido(codigo), false);
});
test('ordena pernas de todas as jornadas, elimina ID repetido e preserva trechos iguais distintos', () => {
  const primeira = trecho('a', 1), retorno = trecho('b', 2), outraJornada = trecho('c', 1, { data: '2026-11-19', numero_jornada: 2 });
  assert.deepEqual(ordenarPernas([outraJornada, retorno, primeira, primeira]).map(p => p.id), ['a', 'b', 'c']);
});
test('carrega a perna em operação ou a próxima, sem escolher uma cancelada', () => {
  const finalizada = trecho('a', 1, { horario_corte: '2026-11-18T14:00Z', status: 'cortado' });
  const proxima = trecho('b', 2), futura = trecho('c', 3);
  assert.equal(pernaInicial([finalizada, proxima, futura]).id, 'b');
  assert.equal(pernaInicial([finalizada, proxima, trecho('c', 3, { horario_ac: '2026-11-18T17:00Z' })]).id, 'c');
  assert.equal(pernaInicial([trecho('a', 1, { status: 'cancelada' })]), undefined);
  assert.equal(pernaInicial([finalizada]).id, 'a');
});
test('campos da perna substituem os da solicitação, sem inventar horário nem reutilizar rota anterior', () => {
  const base = { adep: 'SBGR', ades: 'SBRJ', dataVoo: '2026-11-18', eobt: '12:00', pessoasABordo: '8', rota: 'ROTA ANTIGA', alternado1: 'SBCF', alternado2: 'SBSP', eet: '0100', equipamento: 'SDFG/LB1', piloto: 'Piloto', nivel: 'F250' };
  const nova = formularioDaPerna(base, trecho('b', 2, { origem: 'SN9T', destino: 'SBCY', numero_passageiros: 0, data: '2026-11-19' }));
  assert.equal(nova.adep, 'SN9T'); assert.equal(nova.ades, 'SBCY'); assert.equal(nova.dataVoo, '2026-11-19');
  assert.equal(nova.eobt, ''); assert.equal(nova.pessoasABordo, '0'); assert.equal(nova.rota, ''); assert.equal(nova.alternado1, '');
  assert.equal(nova.equipamento, base.equipamento); assert.equal(nova.piloto, base.piloto);
  const comHorario = formularioDaPerna(base, trecho('b', 2, { horario_dep: '2026-11-18T23:30:00-03:00' }));
  assert.equal(comHorario.dataVoo, '2026-11-19'); assert.equal(comHorario.eobt, '02:30');
});
