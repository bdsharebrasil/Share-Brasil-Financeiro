import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'node:url';
import { PropostaGerenciamentoPdf } from '../src/components/dashboard/gestor/contratos/PropostaGerenciamentoPdf.tsx';
import {
  novaEdicao,
  payloadContrato,
  LAYOUT_PDF_PROPOSTA,
} from '../src/components/dashboard/gestor/contratos/modelo.ts';

const raiz = fileURLToPath(new URL('../public/propostas/', import.meta.url));
const recursos = {
  fonteRegular: raiz + 'fontes/OpenSans-Regular.ttf',
  fonteSemibold: raiz + 'fontes/OpenSans-Semibold.ttf',
  fonteSerifada: raiz + 'fontes/NotoSerif-Regular.ttf',
  logo: raiz + 'logo-share.png',
  logoCapa: fileURLToPath(
    new URL('../public/logoshare.branco.png', import.meta.url),
  ),
};
function edicao() {
  const e = novaEdicao();
  e.numero = 'PROP-2026-TESTE';
  e.proposta.emissao = '2026-11-12';
  e.proposta.aeronave_descricao = 'PILATUS PT-TEST';
  e.contratante.nome = 'Cliente de demonstração';
  e.contratante.documento = '00.000.000/0001-00';
  e.contratada.nome = 'Share Brasil Gestão de Aeronaves Ltda.';
  e.contratada.documento = '00.000.000/0001-00';
  e.contratada.endereco = 'Avenida de demonstração, 100, Cuiabá/MT';
  e.contratada.email = 'demonstracao@example.com';
  e.contratada.telefone = '(00) 00000-0000';
  return e;
}
const normalizar = (t) => t.replace(/\s+/g, ' ').trim();
async function lerPDF(e) {
  const buffer = await renderToBuffer(
    React.createElement(PropostaGerenciamentoPdf, { edicao: e, recursos }),
  );
  const documento = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: fileURLToPath(
      new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url),
    ),
  }).promise;
  try {
    const paginas = [];
    for (let i = 1; i <= documento.numPages; i++) {
      const pagina = await documento.getPage(i);
      const texto = await pagina.getTextContent();
      paginas.push(
        normalizar(texto.items.map((item) => item.str || '').join(' ')),
      );
    }
    return paginas;
  } finally {
    await documento.destroy();
  }
}

test('modelo premium tem capa sem preço e mantém cliente, aeronave, conteúdo, condições e paginação', async () => {
  const e = edicao();
  const paginas = await lerPDF(e);
  assert.equal(paginas.length, 4);
  assert.match(paginas[0], /PILATUS PT-TEST/);
  assert.match(paginas[0], /Cliente de demonstração/);
  assert.doesNotMatch(paginas[0], /R\$|1\.750|100,00|desconto/i);
  assert.match(paginas[1], /NOTECHS/);
  assert.match(paginas[2], /Controle de vencimentos dos componentes/);
  assert.match(paginas[3], /1\.750,00/);
  assert.match(paginas[3], /100,00/);
  assert.match(paginas[3], /27\/11\/2026/);
  assert.ok(
    paginas.every((p, i) =>
      p.includes(`${String(i + 1).padStart(2, '0')} / 04`),
    ),
  );
  assert.equal(
    payloadContrato(e).dados_adicionais.layout_pdf,
    LAYOUT_PDF_PROPOSTA,
  );
});

test('aeronave e cobrança são dinâmicas e grupos excluídos não aparecem no PDF', async () => {
  const e = edicao();
  e.proposta.aeronave_descricao = 'OUTRA AERONAVE PT-OUT';
  e.proposta.modo_cobranca = 'SERVICOS';
  e.proposta.quantidade_cotistas = 2;
  e.proposta.servicos[2] = {
    ...e.proposta.servicos[2],
    titulo: 'Grupo não contratado',
    itens: ['SERVIÇO EXCLUÍDO DA PROPOSTA'],
    incluido: false,
  };
  const paginas = await lerPDF(e);
  const texto = paginas.join(' ');
  assert.match(paginas[0], /OUTRA AERONAVE PT-OUT/);
  assert.doesNotMatch(
    texto,
    /PILATUS|SERVIÇO EXCLUÍDO DA PROPOSTA|Grupo não contratado/,
  );
  assert.doesNotMatch(paginas[0], /R\$/);
  assert.match(texto, /1\.700,00/);
  assert.match(texto, /1\.500,00/);
  assert.match(texto, /3\.200,00/);
  assert.match(texto, /6\.400,00/);
});

test('textos e listas longas continuam em novas páginas sem perder o encerramento nem a numeração', async () => {
  const e = edicao();
  e.proposta.apresentacao =
    Array(3).fill(e.proposta.apresentacao).join('\n\n') +
    '\n\nApresentação final conferida.';
  e.proposta.servicos[0].itens = Array(3)
    .fill(e.proposta.servicos[0].itens)
    .flat();
  e.proposta.servicos[0].itens.push('Serviço final conferido.');
  e.proposta.encerramento = 'Encerramento final conferido.';
  const paginas = await lerPDF(e);
  assert.ok(paginas.length > 4);
  const texto = paginas.join(' ');
  assert.match(texto, /Apresentação final conferida/);
  assert.match(texto, /Serviço final conferido/);
  assert.match(paginas.at(-1), /Encerramento final conferido/);
  assert.ok(
    paginas.every((p, i) =>
      p.includes(
        `${String(i + 1).padStart(2, '0')} / ${String(paginas.length).padStart(2, '0')}`,
      ),
    ),
  );
  assert.ok(
    paginas.every((p) => p.length > 180),
    JSON.stringify(
      paginas.map((p, i) => ({
        pagina: i + 1,
        tamanho: p.length,
        texto: p.length <= 180 ? p : '',
      })),
    ),
  );
});
