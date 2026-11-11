import test from 'node:test';
import assert from 'node:assert/strict';
import { documentoDoLancamento, documentosDoLancamento, numerosDocumentosDoLancamento } from '../src/lib/financeiro-cotista-lancamentos.ts';

const nota = (numero, extra = {}) => ({ nome: 'Nota fiscal', tipo: 'nota_fiscal', numero, url: `https://documentos.test/${numero}.pdf`, ...extra });
const lancamento = () => ({
  id: 'hangaragem-julho', numeroNf: '21599', documentoNumero: '21599',
  urlNf: nota('21599').url,
  // A API também repete os anexos dos rateios na coleção geral.
  documentos: [nota('21599'), nota('21598')],
  rateios: [
    { cotistaId: 'c1', cotista: 'Cotista A', documentos: [nota('21599')] },
    { cotistaId: 'c2', cotista: 'Cotista B', documentos: [nota('21598')] },
  ],
});

test('hangaragem agrupada exibe as duas notas e preserva os titulares', () => {
  const item = lancamento();
  const original = structuredClone(item);
  assert.equal(numerosDocumentosDoLancamento(item), '21599 / 21598');
  const docs = documentosDoLancamento(item);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map(d => [d.numero, d.responsaveis]), [['21599', ['Cotista A']], ['21598', ['Cotista B']]]);
  assert.deepEqual(item, original);
  // A edição individual não deve salvar o resumo "21599 / 21598" na origem.
  assert.equal(documentoDoLancamento(item), '21599');
});

test('documento comum preserva todos os titulares sem duplicar o arquivo', () => {
  const item = lancamento();
  item.rateios[1].documentos = [nota('21599')];
  const docs = documentosDoLancamento(item);
  assert.deepEqual(docs.find(d => d.numero === '21599').responsaveis, ['Cotista A', 'Cotista B']);
  assert.deepEqual(docs.find(d => d.numero === '21598').responsaveis, []);
});

test('resolve titular pelo ID e aliases, sem trocar cotistas com nomes iguais', () => {
  const item = lancamento();
  const docs = documentosDoLancamento(item, [
    { id: 'novo1', cotista_ids: ['c1'], nome: 'Nome completo A' },
    { id: 'c2', nome: 'Nome completo B' },
  ]);
  assert.deepEqual(docs.map(d => d.responsaveis), [['Nome completo A'], ['Nome completo B']]);
});

test('número sem anexo, lançamento legado e ausência de documentos', () => {
  assert.equal(numerosDocumentosDoLancamento({ numeroNf: '21598', rateios: [] }), '21598');
  assert.equal(numerosDocumentosDoLancamento({ documento: 'DOC-7' }), 'DOC-7');
  assert.equal(numerosDocumentosDoLancamento({ rateios: [] }), null);
  assert.deepEqual(documentosDoLancamento({ rateios: [] }), []);
  const semArquivo = { rateios: [{ cotista: 'A', documentos: [nota('00012', { url: '' })] }] };
  assert.equal(numerosDocumentosDoLancamento(semArquivo), '00012');
});

test('documentos diferentes com o mesmo número continuam associados aos seus cotistas', () => {
  const item = lancamento();
  item.documentos = [];
  item.rateios[1].documentos = [nota('21599', { url: 'https://documentos.test/outro.pdf' })];
  const docs = documentosDoLancamento(item);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map(d => d.responsaveis), [['Cotista A'], ['Cotista B']]);
  assert.equal(numerosDocumentosDoLancamento(item), '21599');
});

test('anexo sem titular não herda cotista de outro documento ou de seu número', () => {
  const item = { documentos: [nota('77')], rateios: [{ cotista: 'A', documentos: [nota('77', { url: 'https://documentos.test/outra.pdf' })] }] };
  assert.deepEqual(documentosDoLancamento(item).map(d => d.responsaveis), [[], ['A']]);
});
