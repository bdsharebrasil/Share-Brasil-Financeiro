import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { hojeBrasilia, operacaoNaData } from '../src/lib/agendamentos-hoje.ts';

function agendamento(status, data_agendada = '2026-11-19', data_fim = data_agendada) {
  return { status, data_agendada, data_fim };
}

test('data do painel é a data civil de Brasília e não a UTC', () => {
  assert.equal(hojeBrasilia(new Date('2026-11-20T01:30:00Z')), '2026-11-19');
  assert.equal(hojeBrasilia(new Date('2026-11-20T04:00:00Z')), '2026-11-20');
});

test('voos de hoje exibem aprovados, operando e encerrados do dia, não pendentes ou históricos de outros dias', () => {
  for (const status of ['aprovada', 'acionado', 'decolado', 'em_rota', 'em_voo', 'em_solo', 'encerrada', 'concluida']) {
    assert.equal(operacaoNaData(agendamento(status), '2026-11-19'), true, status);
  }
  for (const status of ['pendente', 'cancelada', 'reprovada']) {
    assert.equal(operacaoNaData(agendamento(status), '2026-11-19'), false, status);
  }
  assert.equal(operacaoNaData(agendamento('aprovada', '2026-11-18'), '2026-11-19'), false);
  assert.equal(operacaoNaData(agendamento('encerrada', '2026-11-20'), '2026-11-19'), false);
  assert.equal(operacaoNaData(agendamento('em_solo', '2026-11-18', '2026-11-20'), '2026-11-19'), true, 'voo de vários dias ainda em andamento');
});

test('a tela inicial não renderiza filtros repetidos e mantém aprovação somente para pendentes', async () => {
  const pagina = await readFile(new URL('../src/pages/Agendamentos.tsx', import.meta.url), 'utf8');
  const detalhes = await readFile(new URL('../src/components/agendamento/AgendamentoDetalhes.tsx', import.meta.url), 'utf8');
  const cronograma = await readFile(new URL('../src/components/agendamento/AgendamentoCronograma.tsx', import.meta.url), 'utf8');
  const lista = await readFile(new URL("../src/components/agendamento/ListaAgendaOperacional.tsx", import.meta.url), "utf8");
  const modelo = await readFile(new URL("../src/components/agendamento/agendaOperacionalModel.ts", import.meta.url), "utf8");
  assert.match(pagina, /<AgendamentoShell/);
  assert.match(pagina, /<ListaAgenda itens=\{agendaCompleta\}/);
  assert.doesNotMatch(pagina, /<CalendarioAgendamento|<Cronograma/);
  assert.match(lista, /filtrarAgenda\(itens, filtro, hojeBrasilia\(\)\)/);
  assert.match(modelo, /operacaoNaData\(item, hoje\)/);
  assert.match(detalhes, /const podeConfirmar = statusPendente && !selecionada\.numero_voo/);
  assert.match(detalhes, /\{podeConfirmar \? \(/);
  assert.match(detalhes, /Resumo da operação/);
  assert.match(cronograma, /CMTE · \{pilotoNome/);
  assert.match(cronograma, /COPI · \{copilotoNome/);
  assert.match(cronograma, /item\.perna_atual_horario_corte \|\| item\.horario_corte/);
  assert.match(cronograma, /item\.perna_atual_horario_pouso \? formatarHora\(item\.perna_atual_horario_pouso\)/);
});
