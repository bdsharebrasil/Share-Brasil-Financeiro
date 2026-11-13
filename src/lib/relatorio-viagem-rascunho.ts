type EstadoRelatorio = {
  status?: unknown;
  status_aprovacao_tripulante?: unknown;
  status_aprovacao_tripulante_2?: unknown;
  token_aprovacao_tripulante_1?: unknown;
  token_aprovacao_tripulante_2?: unknown;
  aprovado_tripulante_em?: unknown;
  aprovado_tripulante_1_em?: unknown;
  aprovado_tripulante_2_em?: unknown;
};
const normalizar = (valor: unknown) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

export function podeRetornarRelatorioRascunho(
  relatorio: EstadoRelatorio | null | undefined,
): boolean {
  if (!relatorio || normalizar(relatorio.status) === 'rascunho') return false;
  if (normalizar(relatorio.status_aprovacao_tripulante) === 'pendente')
    return true;
  return (
    normalizar(relatorio.status) === 'finalizado' &&
    !normalizar(relatorio.status_aprovacao_tripulante) &&
    ['', 'pendente', 'nao_aplicavel'].includes(
      normalizar(relatorio.status_aprovacao_tripulante_2),
    ) &&
    !normalizar(relatorio.token_aprovacao_tripulante_1) &&
    !normalizar(relatorio.token_aprovacao_tripulante_2) &&
    !relatorio.aprovado_tripulante_em &&
    !relatorio.aprovado_tripulante_1_em &&
    !relatorio.aprovado_tripulante_2_em
  );
}
