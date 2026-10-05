import { carregarArquivoColaborador, colaboradorRequest } from '@/lib/colaborador-api'

export type TipoPagamentoFolha = 'SALARIO' | 'FERIAS' | 'DECIMO_TERCEIRO' | 'RESCISAO' | 'ADIANTAMENTO' | 'OUTRO'
export type StatusPagamentoFolha = 'PENDENTE' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'AGENDADO' | 'PAGO' | 'REJEITADO' | 'CANCELADO'
export type RotuloPagamento = 'SALARIO' | 'BENEFICIO' | 'HORAS_VOO' | 'EXTRA' | 'FERIAS' | '13_P1' | '13_P2'

export type PagamentoFolha = {
  id: string
  user_id: string
  folha_id: string | null
  tipo_pagamento: TipoPagamentoFolha
  rotulo: RotuloPagamento | null
  competencia_ano: number | null
  competencia_mes: number | null
  valor_centavos: number
  data_prevista: string
  data_pagamento: string | null
  status: StatusPagamentoFolha
  comprovante_url: string | null
  holerite_url: string | null
  conta_pagamento_id: string | null
  observacoes: string | null
  idempotency_key?: string | null
  lancamento_rh_id?: string | null
}

export type ItemPagamentoPayload = {
  rotulo: RotuloPagamento
  tipo_pagamento: TipoPagamentoFolha
  valor_centavos: number
}

export type RegistrarPagamentoPayload = {
  user_id: string
  ano: number
  mes: number
  /** Data programada; o Worker persiste em data_prevista até a baixa efetiva. */
  data_pagamento: string | null
  conta_pagamento_id: string | null
  observacoes: string | null
  comprovante_url: string | null
  holerite_url: string | null
  itens: ItemPagamentoPayload[]
  idempotency_key: string
}

export function buscarPagamentosFolha(ano: number, mes: number) {
  const query = new URLSearchParams({ ano: String(ano), mes: String(mes) })
  return colaboradorRequest<{ pagamentos: PagamentoFolha[] }>(`/api/financeiro/pagamentos-folha?${query}`)
}

export function registrarPagamentoFolha(payload: RegistrarPagamentoPayload) {
  return colaboradorRequest<{ ok: boolean; pagamentos: PagamentoFolha[] }>(
    '/api/financeiro/pagamentos-folha',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function excluirPagamentosFolhaColaborador(userId: string, ano: number, mes: number) {
  const query = new URLSearchParams({ user_id: userId, ano: String(ano), mes: String(mes) })
  return colaboradorRequest<{ ok: boolean }>(`/api/financeiro/pagamentos-folha?${query}`, { method: 'DELETE' })
}

export function enviarAnexoPagamentoFolha(
  arquivo: File,
  tipo: 'holerite' | 'comprovante',
  userId: string,
  ano: number,
  mes: number,
) {
  const body = new FormData()
  body.append('arquivo', arquivo, arquivo.name)
  body.append('tipo', tipo)
  body.append('user_id', userId)
  body.append('ano', String(ano))
  body.append('mes', String(mes))
  return colaboradorRequest<{ url: string }>('/api/financeiro/pagamentos-folha/anexos', { method: 'POST', body })
}

export function carregarAnexoPagamentoFolha(url: string) {
  return carregarArquivoColaborador(url)
}
