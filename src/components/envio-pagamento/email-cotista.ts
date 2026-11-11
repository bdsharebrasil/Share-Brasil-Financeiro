type DocumentoCotista = { id: string; cotista_id?: string | null };

/** A seleção de um documento compartilhado pertence ao e-mail de cada cotista. */
export function anexosSelecionadosDoCotista<T extends DocumentoCotista>(
  anexos: T[], cotistaId: string, selecaoInicial: string[], selecoes: Record<string, string[]>,
): T[] {
  const selecionados = new Set(selecoes[cotistaId] ?? selecaoInicial);
  return anexos.filter((anexo) => (!anexo.cotista_id || anexo.cotista_id === cotistaId) && selecionados.has(anexo.id));
}

/** Compartilhar um documento não muda os destinatários escolhidos no formulário. */
export function cotistasDoEnvio<T extends { id: string }>(cotistas: T[], idsSelecionados: readonly string[]): T[] {
  const ids = new Set(idsSelecionados);
  return cotistas.filter(cotista => ids.has(cotista.id));
}
