export type AnexoFinanceiro = { nome: string; url: string; numero?: string | null };

export const TIPOS_IMAGEM_ANEXO_VISUALIZAVEIS = [
  'image/jpeg', 'image/png', 'image/apng', 'image/gif', 'image/webp',
  'image/avif', 'image/bmp', 'image/svg+xml', 'image/x-icon',
] as const;

export function tipoAnexoLancamentoPermitido(arquivo: Pick<File, 'type'>) {
  const tipo = arquivo.type.toLowerCase().split(';')[0].trim();
  return tipo === 'application/pdf' || TIPOS_IMAGEM_ANEXO_VISUALIZAVEIS.includes(tipo as typeof TIPOS_IMAGEM_ANEXO_VISUALIZAVEIS[number]);
}

const CAMPOS: Array<[string, string, string?]> = [
  ['url_demonstrativo', 'Demonstrativo', 'numero_demonstrativo'], ['url_nf', 'Nota fiscal', 'numero_nf'],
  ['url_recibo', 'Recibo', 'numero_recibo'], ['url_boleto', 'Boleto', 'numero_boleto'],
  ['relatorio_pdf_url', 'Relatório de despesas de viagem'], ['documentoUrl', 'Documento principal'],
  ['url_doc', 'Documento', 'numero_doc'], ['boletoUrl', 'Boleto'], ['nfUrl', 'Nota fiscal'],
  ['comprovante_url', 'Comprovante'], ['comprovantePagamentoUrl', 'Comprovante de pagamento'],
  ['comprovanteRecebimentoUrl', 'Comprovante de recebimento'],
];

export function anexosFinanceiros(campos: object): AnexoFinanceiro[] {
  const raw = campos as Record<string, unknown>;
  let extras = raw.anexos ?? raw.anexos_json;
  if (typeof extras === 'string') { try { extras = JSON.parse(extras); } catch { extras = []; } }
  const candidatos = [
    ...CAMPOS.map(([campo, nome, numero]) => ({ nome, url: raw[campo], numero: numero ? raw[numero] : null })),
    ...(Array.isArray(extras) ? extras : []),
  ];
  const vistas = new Set<string>();
  return candidatos.flatMap(anexo => {
    if (!anexo || typeof anexo.url !== 'string' || !anexo.url.trim()) return [];
    const url = anexo.url.trim();
    if (vistas.has(url) || !/^(https?:\/\/|\/api\/)/i.test(url)) return [];
    vistas.add(url);
    return [{ nome: String(anexo.nome || 'Anexo'), url, numero: anexo.numero == null ? null : String(anexo.numero) }];
  });
}

/** Não confia na extensão: uma página HTML retornada pelo SPA não é um PDF. */
export async function tipificarBlobDocumento(blob: Blob, _urlOrigem = ''): Promise<Blob> {
  const declarado = blob.type.split(';')[0].trim().toLowerCase();
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (inicio: number, fim: number) => String.fromCharCode(...b.slice(inicio, fim));
  let tipo = '';
  if (ascii(0, 5) === '%PDF-') tipo = 'application/pdf';
  else if (b[0] === 0xff && b[1] === 0xd8) tipo = 'image/jpeg';
  else if (ascii(1, 4) === 'PNG') tipo = declarado === 'image/apng' ? 'image/apng' : 'image/png';
  else if (ascii(0, 3) === 'GIF') tipo = 'image/gif';
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') tipo = 'image/webp';
  else if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) tipo = 'image/avif';
  else if (ascii(0, 2) === 'BM') tipo = 'image/bmp';
  else if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) tipo = 'image/x-icon';
  else if (declarado === 'image/svg+xml') {
    const textoSvg = (await blob.slice(0, 1024).text()).replace(/^\uFEFF/, '').trimStart();
    if (/^<svg(?:\s|>)/i.test(textoSvg) || /^<\?xml[\s\S]*?<svg(?:\s|>)/i.test(textoSvg)) tipo = 'image/svg+xml';
  }
  if (!tipo) throw new Error('O endereço não retornou um PDF ou imagem válido. Verifique o anexo vinculado.');
  return tipo === declarado ? blob : new Blob([blob], { type: tipo });
}
