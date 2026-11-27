import test from 'node:test';
import assert from 'node:assert/strict';
import { anexosFinanceiros, rotaProxyDocumentoPublico, tipificarBlobDocumento } from '../src/lib/documentos-financeiros.ts';

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

test('aceita chaves R2 conhecidas e restringe comprovantes a rotas financeiras suportadas', () => {
  const chaveDespesa = 'financeiro/reembolsos/conta-1/comprovante/550e8400-e29b-41d4-a716-446655440000.pdf';
  const chaveRecebimento = 'financeiro/contas-areceber/conta-2/comprovante/550e8400-e29b-41d4-a716-446655440001.png';
  assert.deepEqual(rotaProxyDocumentoPublico(chaveDespesa), { key: chaveDespesa });
  assert.deepEqual(rotaProxyDocumentoPublico(`https://arquivos.test/${chaveRecebimento}`), { key: chaveRecebimento });
  assert.equal(rotaProxyDocumentoPublico('financeiro/contas-apagar/conta-1/comprovante/documento.pdf'), null);
  assert.equal(rotaProxyDocumentoPublico('/api/financeiro/contas-apagar/conta-1/comprovante/arquivo'), null);
  assert.equal(anexosFinanceiros({ anexos_json: JSON.stringify([{ nome: 'Comprovante', url: chaveDespesa }]) }).length, 1);
});

test('identifica PDF servido como binário e rejeita HTML mesmo com extensão ou tipo PDF', async () => {
  const pdf = await tipificarBlobDocumento(new Blob(['%PDF-1.7 exemplo'], { type: 'application/octet-stream' }));
  assert.equal(pdf.type, 'application/pdf');
  for (const tipo of ['text/html', 'application/pdf']) {
    await assert.rejects(tipificarBlobDocumento(new Blob(['<!DOCTYPE html><html>Dashboard</html>'], { type: tipo }), 'https://site.test/relatorio.pdf'), /não retornou um PDF/);
  }
});

test('identifica imagens aceitas pelo formulário, incluindo APNG, BMP, ICO e SVG', async () => {
  const casos = [
    [new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg', 'image/jpeg'],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/apng', 'image/apng'],
    [new Uint8Array([0x42, 0x4d, 0, 0]), 'image/bmp', 'image/bmp'],
    [new Uint8Array([0, 0, 1, 0]), 'image/x-icon', 'image/x-icon'],
    [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml', 'image/svg+xml'],
  ];
  for (const [conteudo, declarado, esperado] of casos) {
    const blob = await tipificarBlobDocumento(new Blob([conteudo], { type: declarado }));
    assert.equal(blob.type, esperado);
  }
});
