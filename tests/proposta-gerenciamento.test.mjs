import test from 'node:test';
import assert from 'node:assert/strict';
import {
  novaEdicao,
  calcularProposta,
  validarEdicao,
  payloadContrato,
  edicaoDoContrato,
  validadeProposta,
  centavos,
} from '../src/components/dashboard/gestor/contratos/modelo.ts';
test('pacote por cotista não soma valores de referência dos grupos', () => {
  const e = novaEdicao();
  e.proposta.quantidade_cotistas = 2;
  assert.deepEqual(calcularProposta(e.proposta), {
    unitario: 175000,
    quantidade: 2,
    total: 350000,
  });
  e.proposta.unidade = 'POR_AERONAVE';
  assert.equal(calcularProposta(e.proposta).total, 175000);
  e.proposta.modo_cobranca = 'SERVICOS';
  e.proposta.servicos[2].incluido = false;
  assert.equal(calcularProposta(e.proposta).total, 320000);
});
test('rascunho parcial é salvo e retomado com dados, partes e condição comercial', () => {
  const e = novaEdicao();
  assert.equal(validarEdicao(e), '');
  assert.match(validarEdicao(e, true), /partes/);
  e.contratante.nome = 'Cliente';
  e.proposta.aeronave_descricao = 'Aeronave escolhida';
  assert.equal(validarEdicao(e, true), '');
  const c = {
    ...payloadContrato(e),
    id: 'c',
    numero: 'PROP-1',
    anexos: [],
    partes: [e.contratante, e.contratada],
  };
  const volta = edicaoDoContrato(c);
  assert.equal(volta.contratante.nome, 'Cliente');
  assert.equal(volta.proposta.aeronave_descricao, 'Aeronave escolhida');
  assert.equal(volta.proposta.condicoes, e.proposta.condicoes);
  assert.equal(
    payloadContrato(volta, { ...c, revisao: 4 }).revisao_esperada,
    4,
  );
});
test('datas reais, vigência, valores negativos e overflow são validados', () => {
  const e = novaEdicao();
  e.proposta.emissao = '2026-02-31';
  assert.match(validarEdicao(e), /emissão/);
  e.proposta.emissao = '2026-11-12';
  assert.equal(validadeProposta(e.proposta), '2026-11-27');
  e.data_inicio = '2026-12-01';
  e.data_fim = '2026-11-30';
  assert.match(validarEdicao(e), /término/);
  e.data_fim = '';
  e.proposta.servicos[0].valor_centavos = -1;
  assert.match(validarEdicao(e), /valores/);
  e.proposta.valor_pacote_centavos = Number.MAX_SAFE_INTEGER;
  e.proposta.quantidade_cotistas = 2;
  assert.throws(() => calcularProposta(e.proposta));
  assert.equal(centavos('1.750,50'), 175050);
  assert.equal(centavos('1.750,555'), null);
});
