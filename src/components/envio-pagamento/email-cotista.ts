type DocumentoCotista = { id: string; cotista_id?: string | null };

/** A seleção de um documento compartilhado pertence ao e-mail de cada cotista. */
export function anexosSelecionadosDoCotista<T extends DocumentoCotista>(
  anexos: T[], cotistaId: string, selecaoInicial: string[], selecoes: Record<string, string[]>,
): T[] {
  const selecionados = new Set(selecoes[cotistaId] ?? selecaoInicial);
  return anexos.filter((anexo) => (!anexo.cotista_id || anexo.cotista_id === cotistaId) && selecionados.has(anexo.id));
}
