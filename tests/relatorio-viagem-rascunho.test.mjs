import test from 'node:test';
import assert from 'node:assert/strict';
import { podeRetornarRelatorioRascunho } from '../src/lib/relatorio-viagem-rascunho.ts';
test('pendência principal libera o botão independentemente do status e dos links', () => {
  for (const status of [
    'finalizado',
    'aguardando_aprovacao',
    'ajuste_necessario',
    'ajuste_concluido',
    'aprovado',
    'enviado_cliente',
    'outro',
  ])
    assert.equal(
      podeRetornarRelatorioRascunho({
        status,
        status_aprovacao_tripulante: ' PENDENTE ',
        status_aprovacao_tripulante_2: 'aprovado',
        aprovado_tripulante_2_em: '2026-11-13',
        token_aprovacao_tripulante_1: 'link1',
        token_aprovacao_tripulante_2: 'link2',
      }),
      true,
      status,
    );
});
test('aprovação principal concluída e relatório já em rascunho não oferecem novo retorno', () => {
  for (const status_aprovacao_tripulante of [
    'aprovado',
    'reprovado',
    'nao_aplicavel',
  ])
    assert.equal(
      podeRetornarRelatorioRascunho({
        status: 'finalizado',
        status_aprovacao_tripulante,
      }),
      false,
    );
  assert.equal(
    podeRetornarRelatorioRascunho({
      status: 'rascunho',
      status_aprovacao_tripulante: 'pendente',
    }),
    false,
  );
  assert.equal(podeRetornarRelatorioRascunho(null), false);
});
test('finalizado antigo sem aprovação permanece compatível', () => {
  assert.equal(podeRetornarRelatorioRascunho({ status: 'finalizado' }), true);
  assert.equal(
    podeRetornarRelatorioRascunho({
      status: 'finalizado',
      aprovado_tripulante_em: '2026-11-13',
    }),
    false,
  );
  assert.equal(
    podeRetornarRelatorioRascunho({
      status: 'aguardando_aprovacao',
      status_aprovacao_tripulante: null,
      token_aprovacao_tripulante_1: 'link',
    }),
    false,
  );
});
