import test from 'node:test';
import assert from 'node:assert/strict';
import { anexosFinanceiros, tipificarBlobDocumento } from '../src/lib/documentos-financeiros.ts';

test('reúne relatório, boleto, comprovante e anexos JSON, eliminando duplicatas', () => {
  const anexos = anexosFinanceiros({
    documentoUrl: '/api/financeiro/relatorios-despesa-viagem/rel-1/pdf',
    url_doc: '/api/financeiro/relatorios-despesa-viagem/rel-1/pdf',
    boletoUrl: 'https://anexos.test/boleto.pdf',
    comprovantePagamentoUrl: '/api/financeiro/contas-apagar/cp-1/comprovante/arquivo',
    anexos_json: JSON.stringify([{ nome: 'Hotel', url: 'https://anexos.test/hotel.jpg' }, { nome: 'Cópia', url: 'https://anexos.test/boleto.pdf' }]),
  });
  assert.equal(anexos.length, 4);
  assert.deepEqual(anexos.map(a => a.nome), ['Documento principal', 'Boleto', 'Comprovante de pagamento', 'Hotel']);
});

test('JSON inválido e protocolos impróprios não impedem a expansão', () => {
  assert.deepEqual(anexosFinanceiros({ anexos_json: '{', url_doc: 'javascript:alert(1)' }), []);
});

test('identifica PDF servido como binário e rejeita HTML mesmo com extensão ou tipo PDF', async () => {
  const pdf = await tipificarBlobDocumento(new Blob(['%PDF-1.7 exemplo'], { type: 'application/octet-stream' }));
  assert.equal(pdf.type, 'application/pdf');
  for (const tipo of ['text/html', 'application/pdf']) {
    await assert.rejects(tipificarBlobDocumento(new Blob(['<!DOCTYPE html><html>Dashboard</html>'], { type: tipo }), 'https://site.test/relatorio.pdf'), /não retornou um PDF/);
  }
});
