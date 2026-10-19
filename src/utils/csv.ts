/** Converte "R$ 1.234,56", "1.234,56", "-" ou "" em número. */
export function numeroBR(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (!valor) return 0;
  const texto = String(valor).
  replace(/\u00a0/g, ' ').
  replace(/R\$/gi, '').
  replace(/%/g, '').
  trim();
  if (!texto || texto === '-' || texto === '—') return 0;
  const negativo = /^\(.*\)$/.test(texto);
  const limpo = texto.
  replace(/[()]/g, '').
  replace(/\s/g, '').
  replace(/\./g, '').
  replace(',', '.').
  replace(/[^0-9.-]/g, '');
  const n = Number(limpo);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
}

export const MESES = [
'JANEIRO',
'FEVEREIRO',
'MARÇO',
'ABRIL',
'MAIO',
'JUNHO',
'JULHO',
'AGOSTO',
'SETEMBRO',
'OUTUBRO',
'NOVEMBRO',
'DEZEMBRO'];


const SEM_ACENTO = (t: string) =>
t.
normalize('NFD').
replace(/[\u0300-\u036f]/g, '').
toUpperCase().
trim();

export function ehMes(celula: unknown): boolean {
  const t = SEM_ACENTO(String(celula ?? ''));
  return MESES.some((m) => SEM_ACENTO(m) === t);
}

export function rotuloMes(celula: unknown): string {
  const t = SEM_ACENTO(String(celula ?? ''));
  const idx = MESES.findIndex((m) => SEM_ACENTO(m) === t);
  const nome = idx >= 0 ? MESES[idx] : t;
  return nome.charAt(0) + nome.slice(1).toLowerCase();
}

/** Procura o índice da coluna cujo cabeçalho contém todos os termos informados. */
export function acharColuna(
linhas: string[][],
linhasCabecalho: number[],
termos: string[])
: number {
  for (const idxLinha of linhasCabecalho) {
    const linha = linhas[idxLinha] ?? [];
    for (let c = 0; c < linha.length; c++) {
      const celula = SEM_ACENTO(linha[c] ?? '');
      if (celula && termos.every((t) => celula.includes(SEM_ACENTO(t)))) return c;
    }
  }
  return -1;
}

/** Pega o valor de uma coluna, com fallback para a próxima célula preenchida. */
export function celula(linha: string[], indice: number): number {
  if (indice < 0) return 0;
  const direto = numeroBR(linha[indice]);
  if (direto !== 0) return direto;
  // Planilhas exportadas costumam ter o "R$" numa coluna e o número na seguinte.
  const proximo = numeroBR(linha[indice + 1]);
  return proximo;
}