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
const { localizarAgendamento, horarioFpl, lerRascunho, guardarRascunho } = await import(await modulo('src/lib/plano-voo.ts', {'"./format"': JSON.stringify(format)}));
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
