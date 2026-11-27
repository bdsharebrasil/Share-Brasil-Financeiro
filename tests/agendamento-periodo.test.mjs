import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ajustarPeriodoAoAlterarDataSaida } from '../src/lib/agendamento-periodo.ts';

test('ao mover voo de um dia, move também a data final', () => {
  assert.deepEqual(
    ajustarPeriodoAoAlterarDataSaida('2026-11-26', '2026-11-26', '2026-12-02'),
    { data_agendada: '2026-12-02', data_fim: '2026-12-02' },
  );
});

test('ao mover viagem de vários dias, preserva duração e permite antecipar', () => {
  assert.deepEqual(
    ajustarPeriodoAoAlterarDataSaida('2026-11-26', '2026-11-29', '2026-11-20'),
    { data_agendada: '2026-11-20', data_fim: '2026-11-23' },
  );
});

test('corrige um período legado inconsistente usando a nova saída como data final', () => {
  assert.deepEqual(
    ajustarPeriodoAoAlterarDataSaida('2026-11-26', '2026-11-25', '2026-11-27'),
    { data_agendada: '2026-11-27', data_fim: '2026-11-27' },
  );
});

test('o editor e a agenda aplicam a atualização otimista após salvar datas', async () => {
  const detalhe = await readFile(new URL('../src/components/agendamento/AgendamentoDetalhes.tsx', import.meta.url), 'utf8');
  const pagina = await readFile(new URL('../src/pages/Agendamentos.tsx', import.meta.url), 'utf8');
  assert.match(detalhe, /ajustarPeriodoAoAlterarDataSaida/);
  assert.match(detalhe, /campo === "data_agendada"/);
  assert.match(pagina, /setSelecionada\(\(atual\) => \(atual\?\.id === alvo\.id/);
  assert.match(pagina, /setPainel\(\(atual\) =>\s*atual\s*\?\s*\{\s*\.\.\.atual,\s*agendamentos: atual\.agendamentos\.map/);
});
