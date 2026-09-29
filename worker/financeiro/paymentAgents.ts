type Row = Record<string, unknown>

export type PaymentRequest = {
  tipo: 'share' | 'cliente' | 'reembolso'
  descricao: string
  valor_centavos: number
  data_despesa: string
  data_vencimento: string | null
  aeronave_id: string | null
  rateio_linhas: Array<{ cotista_id: string; percentual: number; percentual_sociedade: number; valor_centavos: number }>
  cotista_responsavel_id: string | null
  valor_externo_centavos: number
  destino_externo_tipo: 'CLIENTE' | 'HOLDING' | null
  destino_externo_id: string | null
  anexos: Array<{ id: string; tipo: string; numero: string; url: string | null; cotista_id?: string }>
  periodicidade: string | null
  tipo_rateio: string | null
  categoria_id: string
  categoria_cliente_id: string | null
  colaborador_id: string | null
  fornecedor_id: string | null
  observacoes: string | null
  abastecimento: Row | null
  idempotency_key: string
}

export function validatePaymentRequest(body: Row): PaymentRequest {
  const tipo = String(body.tipo ?? '').trim()
  const valor = Number(body.valor_centavos)
  const linhas = Array.isArray(body.rateio_linhas) ? body.rateio_linhas : []
  const anexos = Array.isArray(body.anexos) ? body.anexos : []
  const categoriaClienteId = body.categoria_cliente_id ? String(body.categoria_cliente_id) : null
  const abastecimento = body.abastecimento && typeof body.abastecimento === 'object' ? body.abastecimento as Row : null
  const valorExternoCentavos = body.valor_externo_centavos == null ? 0 : Number(body.valor_externo_centavos)
  const destinoExternoTipo = String(body.destino_externo_tipo ?? body.valor_externo_destino_tipo ?? '').trim().toUpperCase()
  const destinoExternoId = String(body.destino_externo_id ?? body.valor_externo_destino_id ?? '').trim() || null
  const cotistaResponsavelId = String(body.cotista_responsavel_id ?? body.responsavel_cotista_id ?? '').trim() || null
  if (!['share', 'cliente', 'reembolso'].includes(tipo)) throw new Error('tipo de solicitação inválido')
  if (!String(body.descricao ?? '').trim() || !Number.isInteger(valor) || valor <= 0) throw new Error('descrição e valor_centavos são obrigatórios')
  if (!String(body.data_despesa ?? '').match(/^\d{4}-\d{2}-\d{2}/)) throw new Error('data_despesa inválida')
  if (!String(body.categoria_id ?? '').trim()) throw new Error('categoria_id é obrigatório')
  const rateioLinhas = linhas.map((linha) => ({ cotista_id: String(linha.cotista_id ?? ''), percentual: Number(linha.percentual), valor_centavos: Number(linha.valor_centavos), percentual_sociedade: Number(linha.percentual_sociedade ?? linha.percentual) }))
  if (!Number.isInteger(valorExternoCentavos) || valorExternoCentavos < 0 || valorExternoCentavos > valor) throw new Error('valor_externo_centavos inválido')
  if (valorExternoCentavos > 0 && (!['CLIENTE', 'HOLDING'].includes(destinoExternoTipo) || !destinoExternoId)) throw new Error('destino_externo_tipo e destino_externo_id são obrigatórios para valor externo')
  if (valorExternoCentavos === 0 && (destinoExternoTipo || destinoExternoId)) throw new Error('destino externo informado sem valor externo')
  if (tipo === 'share' && (rateioLinhas.length || valorExternoCentavos)) throw new Error('solicitação share não aceita rateio ou valor externo')
  if (tipo !== 'share') {
    const percentualTotal = rateioLinhas.reduce((total, linha) => total + linha.percentual, 0)
    const valorTotal = rateioLinhas.reduce((total, linha) => total + linha.valor_centavos, 0)
    const linhasInvalidas = rateioLinhas.some((linha) =>
      !linha.cotista_id ||
      !Number.isFinite(linha.percentual) ||
      linha.percentual <= 0 ||
      !Number.isInteger(linha.valor_centavos) ||
      linha.valor_centavos <= 0,
    )
    if (linhasInvalidas || (rateioLinhas.length && Math.abs(percentualTotal - 100) > 0.01) || valorTotal + valorExternoCentavos !== valor) {
      throw new Error('rateio_linhas + valor_externo_centavos devem corresponder ao total')
    }
    if (tipo === 'reembolso' && valorTotal > 0 && cotistaResponsavelId && rateioLinhas.every((linha) => linha.cotista_id !== cotistaResponsavelId)) {
      // O responsável pode ser outro cotista da mesma aeronave; a validação de vínculo ocorre ao persistir.
    }
  }
  return {
    tipo: tipo as PaymentRequest['tipo'], descricao: String(body.descricao).trim(), valor_centavos: valor,
    data_despesa: String(body.data_despesa), data_vencimento: body.data_vencimento ? String(body.data_vencimento) : null,
    aeronave_id: body.aeronave_id ? String(body.aeronave_id) : null, rateio_linhas: rateioLinhas,
    cotista_responsavel_id: cotistaResponsavelId, valor_externo_centavos: valorExternoCentavos,
    destino_externo_tipo: valorExternoCentavos ? destinoExternoTipo as PaymentRequest['destino_externo_tipo'] : null,
    destino_externo_id: valorExternoCentavos ? destinoExternoId : null,
    anexos: anexos.map((anexo) => ({ id: String(anexo.id ?? ''), tipo: String(anexo.tipo ?? 'outro'), numero: String(anexo.numero ?? ''), url: anexo.url ? String(anexo.url) : null, ...(anexo.cotista_id ? { cotista_id: String(anexo.cotista_id) } : {}) })),
    periodicidade: body.periodicidade ? String(body.periodicidade) : null, tipo_rateio: body.tipo_rateio ? String(body.tipo_rateio) : null,
    categoria_id: String(body.categoria_id), categoria_cliente_id: categoriaClienteId, colaborador_id: body.colaborador_id ? String(body.colaborador_id) : null, fornecedor_id: body.fornecedor_id ? String(body.fornecedor_id) : null,
    observacoes: body.observacoes ? String(body.observacoes) : null,
    abastecimento,
    idempotency_key: String(body.idempotency_key ?? '').trim() || crypto.randomUUID(),
  }
}

export async function findPaymentRequestByKey(db: D1Database, key: string): Promise<Row | null> {
  return db.prepare(`SELECT v.destino_id AS id FROM financeiro_vinculos v WHERE v.origem_tipo = 'IDEMPOTENCY_KEY' AND v.origem_id = ? AND v.destino_tipo = 'ENVIO_DESPESA' LIMIT 1`).bind(key).first<Row>()
}

async function deterministicUuid(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  digest[6] = (digest[6] & 0x0f) | 0x50
  digest[8] = (digest[8] & 0x3f) | 0x80
  const hex = [...digest.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function decodeRateioMetadata(raw: unknown): { linhas: PaymentRequest['rateio_linhas']; metadata: Row } {
  let parsed: unknown = []
  try { parsed = JSON.parse(String(raw || '[]')) } catch { throw new Error('rateio_linhas_json inválido') }
  if (Array.isArray(parsed)) return { linhas: parsed as PaymentRequest['rateio_linhas'], metadata: {} }
  if (parsed && typeof parsed === 'object') {
    const envelope = parsed as Row
    if (envelope.version === 2 && Array.isArray(envelope.rateio_linhas) && envelope.metadata && typeof envelope.metadata === 'object') {
      return { linhas: envelope.rateio_linhas as PaymentRequest['rateio_linhas'], metadata: envelope.metadata as Row }
    }
  }
  throw new Error('rateio_linhas_json inválido')
}

export async function createPaymentRequest(db: D1Database, input: PaymentRequest, userId: string | null): Promise<Row> {
  const existing = await findPaymentRequestByKey(db, input.idempotency_key)
  if (existing?.id) {
    const request = await db.prepare('SELECT * FROM envio_despesas WHERE id = ?').bind(existing.id).first<Row>()
    if (!request) throw new Error('solicitacao_pagamento_nao_encontrada')
    return { ...request, idempotent: true }
  }
  const cotistaId = input.rateio_linhas[0]?.cotista_id || input.cotista_responsavel_id || null
  const titular = cotistaId
    ? await db.prepare(`
        SELECT ca.aeronave_id, ca.cliente_id, ca.socio_id, hs.holding_id
          FROM cotista_aeronave ca
          LEFT JOIN hold_socios hs ON hs.id = ca.socio_id
         WHERE ca.id = ?
         LIMIT 1
      `).bind(cotistaId).first<{ aeronave_id: string; cliente_id: string | null; socio_id: string | null; holding_id: string | null }>()
    : null
  if (input.tipo !== 'share' && input.rateio_linhas.length && !titular) throw new Error('cotista_da_aeronave_nao_encontrado')
  const aeronaveId = input.aeronave_id || titular?.aeronave_id || null
  if (input.tipo !== 'share' && input.rateio_linhas.length && !aeronaveId) throw new Error('aeronave_obrigatoria_para_rateio')
  if (input.tipo === 'reembolso' && input.rateio_linhas.length) {
    const responsavelId = input.cotista_responsavel_id || input.rateio_linhas[0].cotista_id
    const responsavel = await db.prepare('SELECT id, aeronave_id FROM cotista_aeronave WHERE id = ?').bind(responsavelId).first<{ id: string; aeronave_id: string }>()
    if (!responsavel || responsavel.aeronave_id !== aeronaveId) throw new Error('cotista_responsavel_invalido')
  }
  if (input.valor_externo_centavos > 0) {
    const destination = input.destino_externo_tipo === 'HOLDING'
      ? await db.prepare('SELECT id FROM holdings WHERE id = ?').bind(input.destino_externo_id).first<{ id: string }>()
      : await db.prepare('SELECT id FROM cliente WHERE id = ?').bind(input.destino_externo_id).first<{ id: string }>()
    if (!destination) throw new Error('destino_externo_nao_encontrado')
  }
  const ehHolding = input.tipo === 'cliente' && Boolean(titular?.socio_id)
  const id = await deterministicUuid(`envio:${input.idempotency_key}`)
  const solicitacaoCompraId = input.tipo === 'share' && userId ? await deterministicUuid(`solicitacao-compra:${input.idempotency_key}`) : null
  const rateioMetadata = JSON.stringify({ version: 2, rateio_linhas: input.rateio_linhas, metadata: {
    cotista_responsavel_id: input.cotista_responsavel_id || (input.tipo === 'reembolso' ? input.rateio_linhas[0]?.cotista_id || null : null),
    valor_externo_centavos: input.valor_externo_centavos,
    destino_externo_tipo: input.destino_externo_tipo,
    destino_externo_id: input.destino_externo_id,
  } })
  const statements = [
    db.prepare(`INSERT OR IGNORE INTO envio_despesas (id, tipo, descricao, valor, data_despesa, vencimento, aeronave_id, observacoes, status, criado_por, grupo_categoria, tipo_caixa, pago_diretamente, fornecedor_id, categoria_id, categoria_cliente_id, rateio_linhas_json, anexos_json, periodicidade, tipo_rateio, colaborador_id, abastecimento_json, solicitacao_compra_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(id, input.tipo, input.descricao, input.valor_centavos / 100, input.data_despesa, input.data_vencimento, aeronaveId, input.observacoes, userId, ehHolding ? 'CAIXA HOLDING' : input.tipo === 'cliente' ? 'CAIXA CLIENTE' : input.tipo === 'reembolso' ? 'DESPESAS REEMBOLSÁVEIS' : 'DESPESAS EMPRESA', ehHolding ? 'HOLDING' : input.tipo === 'cliente' ? 'CLIENTE' : 'SHARE', input.tipo === 'cliente' ? 1 : 0, input.fornecedor_id, input.categoria_id, input.categoria_cliente_id, rateioMetadata, JSON.stringify(input.anexos), input.periodicidade, input.tipo_rateio, input.colaborador_id, input.abastecimento ? JSON.stringify(input.abastecimento) : null, solicitacaoCompraId),
    db.prepare(`INSERT OR IGNORE INTO financeiro_vinculos (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo_vinculo) VALUES (?, 'IDEMPOTENCY_KEY', ?, 'ENVIO_DESPESA', ?, 'SOLICITACAO')`).bind(crypto.randomUUID(), input.idempotency_key, id),
  ]
  if (solicitacaoCompraId) {
    statements.unshift(db.prepare(`INSERT OR IGNORE INTO solicitacoes_compra (id, numero_solicitacao, tipo, descricao, observacoes, user_id, data_solicitacao, data_necessaria, status, solicitante_nome) VALUES (?, ?, 'DESPESA', ?, ?, ?, ?, ?, 'RASCUNHO', ?)`)
      .bind(solicitacaoCompraId, `ENV-${id.slice(0, 8).toUpperCase()}`, input.descricao, input.observacoes, userId, input.data_despesa, input.data_vencimento, userId))
  }
  const results = await db.batch(statements)
  const request = await db.prepare('SELECT * FROM envio_despesas WHERE id = ?').bind(id).first<Row>()
  if (!request) throw new Error('solicitacao_pagamento_nao_encontrada')
  return { ...request, idempotent: !results[statements.length - (solicitacaoCompraId ? 3 : 2)]?.meta?.changes }
}

export async function convertPaymentRequest(
  db: D1Database,
  request: Row,
  createExpense: (db: D1Database, body: Row, userId: string | null, options?: { internal?: boolean }) => Promise<Row>,
  userId: string | null,
  createReimbursement?: (db: D1Database, body: Row, userId: string | null) => Promise<Row>,
  createExternalReceivable?: (db: D1Database, body: Row, userId: string | null) => Promise<Row>,
  createDirectExternalExpense?: (db: D1Database, body: Row, userId: string | null) => Promise<Row>,
): Promise<Row> {
  const existing = await db.prepare('SELECT lancamento_id, movimentacao_id FROM envio_despesas WHERE id = ?').bind(request.id).first<Row>()
  if (existing?.lancamento_id || existing?.movimentacao_id) return { ...existing, idempotent: true }
  const { linhas, metadata } = decodeRateioMetadata(request.rateio_linhas_json)
  const anexos = JSON.parse(String(request.anexos_json || '[]'))
  const shareCents = linhas.reduce((sum, line) => sum + Number(line.valor_centavos || 0), 0)
  const externalCents = Number(metadata.valor_externo_centavos || 0)
  const cotistaResponsavelId = String(metadata.cotista_responsavel_id || linhas[0]?.cotista_id || '').trim() || null
  const cotistaAeronaveId = String(linhas[0]?.cotista_id || cotistaResponsavelId || request.cotista_id || '').trim() || null
  const titular = cotistaAeronaveId
    ? await db.prepare(`
        SELECT ca.aeronave_id, ca.cliente_id, ca.socio_id, hs.holding_id
          FROM cotista_aeronave ca
          LEFT JOIN hold_socios hs ON hs.id = ca.socio_id
         WHERE ca.id = ?
         LIMIT 1
      `).bind(cotistaAeronaveId).first<{ aeronave_id: string; cliente_id: string | null; socio_id: string | null; holding_id: string | null }>()
    : null
  const ehHolding = Boolean(titular?.socio_id || String(request.tipo_caixa || '').toUpperCase() === 'HOLDING')
  if (shareCents + externalCents !== Math.round(Number(request.valor || 0) * 100) && request.tipo !== 'share') throw new Error('rateio_e_valor_externo_nao_correspondem_ao_total')
  let abastecimentoId: string | null = null
  if (request.tipo !== 'share' && request.abastecimento_json) {
    const abastecimento = JSON.parse(String(request.abastecimento_json)) as Row
    abastecimentoId = String(abastecimento.id || await deterministicUuid(`abastecimento:${request.id}`))
    await db.prepare(`INSERT OR IGNORE INTO abastecimentos (id, cliente_id, socio_id, aeronave_id, data, tipo_combustivel, trecho, local, numero_comanda, numero_nf, litros, valor_unitario, valor_total, fornecedor_id, status, observacao, forma_pagamento, data_vencimento_boleto, criado_por, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(abastecimentoId, titular?.socio_id ? null : titular?.cliente_id, titular?.socio_id || null, request.aeronave_id || titular?.aeronave_id, request.data_despesa, abastecimento.tipo_combustivel || null, abastecimento.trecho || null, abastecimento.local || null, abastecimento.numero_comanda || null, abastecimento.numero_nf || null, abastecimento.litros ?? null, abastecimento.valor_unitario ?? null, Number(request.valor || 0), request.fornecedor_id || null, 'PAGO', abastecimento.observacao || request.descricao, abastecimento.forma_pagamento || null, request.vencimento || null, userId, request.data_despesa).run()
  }
  if (request.tipo === 'cliente' && shareCents > 0) {
    const classes = await Promise.all(linhas.map(async (line) => Boolean((await db.prepare('SELECT socio_id FROM cotista_aeronave WHERE id = ?').bind(line.cotista_id).first<{ socio_id: string | null }>())?.socio_id)))
    if (classes.some(Boolean) && classes.some((isHolding) => !isHolding)) throw new Error('rateio_misto_cliente_holding_nao_suportado')
  }
  const sourceCents = request.tipo === 'cliente' ? shareCents : Math.round(Number(request.valor || 0) * 100)
  const lancamento = sourceCents > 0 || request.tipo !== 'cliente'
    ? await createExpense(db, { idempotency_key: `envio:${request.id}`, tipo: request.tipo, descricao: request.descricao, valor_centavos: sourceCents, data: request.data_despesa, data_vencimento: request.vencimento, aeronave_id: request.aeronave_id || titular?.aeronave_id, cotista_aeronave_id: cotistaAeronaveId, socio_id: request.tipo === 'cliente' ? titular?.socio_id || null : null, holding_id: request.tipo === 'cliente' ? titular?.holding_id || null : null, categoria_id: request.categoria_id, categoria_cliente_id: request.categoria_cliente_id, colaborador_id: request.colaborador_id, fornecedor_id: request.fornecedor_id, observacoes: request.observacoes, abastecimentos_id: abastecimentoId, rateio_linhas: linhas, sem_rateio: request.tipo === 'reembolso' || request.tipo === 'share', anexos_json: anexos, periodicidade: request.periodicidade, tipo_rateio: request.tipo_rateio, pago_diretamente: request.tipo === 'cliente', tipo_caixa: request.tipo === 'cliente' ? (ehHolding ? 'HOLDING' : 'CLIENTE') : 'SHARE', reembolsavel: request.tipo === 'reembolso' }, userId, { internal: true })
    : null
  const sourceLancamentoId = String(lancamento?.lancamento_id ?? lancamento?.id ?? '') || null
  let reimbursement: Row | null = null
  if (request.tipo === 'reembolso' && shareCents > 0 && createReimbursement) {
    if (!sourceLancamentoId) throw new Error('lancamento_origem_obrigatorio')
    const responsible = cotistaResponsavelId ? await db.prepare(`SELECT ca.id, ca.aeronave_id, ca.cliente_id, ca.socio_id, hs.holding_id
      FROM cotista_aeronave ca LEFT JOIN hold_socios hs ON hs.id = ca.socio_id WHERE ca.id = ? LIMIT 1`).bind(cotistaResponsavelId).first<Row>() : null
    if (!responsible || responsible.aeronave_id !== (request.aeronave_id || titular?.aeronave_id)) throw new Error('cotista_responsavel_invalido')
    reimbursement = await createReimbursement(db, {
      idempotency_key: `reembolso:${request.id}`,
      lancamento_origem_id: sourceLancamentoId,
      lancamento_id: sourceLancamentoId,
      descricao: request.descricao,
      valor_centavos: shareCents,
      rateio_linhas: linhas,
      data: request.data_despesa,
      data_vencimento: request.vencimento,
      aeronave_id: request.aeronave_id || titular?.aeronave_id,
      cotista_aeronave_id: cotistaResponsavelId,
      socio_id: responsible.socio_id || null,
      holding_id: responsible.holding_id || null,
      categoria_id: request.categoria_id,
      categoria_cliente_id: request.categoria_cliente_id,
      categoria_cliente_nome: request.categoria_cliente_nome,
      colaborador_id: request.colaborador_id,
    }, userId)
  }
  let external: Row | null = null
  if (externalCents > 0) {
    const externalBody = {
      idempotency_key: `envio:${request.id}:externo`, tipo: metadata.destino_externo_tipo,
      destino_id: metadata.destino_externo_id, valor_centavos: externalCents, descricao: request.descricao,
      data: request.data_despesa, data_vencimento: request.vencimento, aeronave_id: request.aeronave_id || titular?.aeronave_id,
      categoria_id: request.categoria_id, categoria_cliente_id: request.categoria_cliente_id,
      cotista_aeronave_id: cotistaResponsavelId, origem_tipo: 'ENVIO_DESPESA_EXTERNO', origem_id: request.id,
    }
    if (request.tipo === 'cliente') {
      if (!createDirectExternalExpense) throw new Error('registro_externo_direto_indisponivel')
      external = await createDirectExternalExpense(db, externalBody, userId)
    } else {
      if (!createExternalReceivable) throw new Error('registro_externo_reembolsavel_indisponivel')
      external = await createExternalReceivable(db, externalBody, userId)
    }
  }
  const lancamentoId = String(lancamento?.lancamento_id ?? lancamento?.id ?? '') || null
  const movimentacaoId = String(lancamento?.movimentacao_id ?? lancamento?.movimento_holding_id ?? external?.movimentacao_id ?? external?.movimento_holding_id ?? lancamentoId ?? '') || null
  const holdingMovement = Boolean(lancamento?.movimento_holding_id || external?.movimento_holding_id || (lancamento && ehHolding))
  const destinoTipo = holdingMovement ? 'MOVIMENTO_HOLDING' : 'LANCAMENTO'
  if (lancamentoId || movimentacaoId) await db.batch([
    db.prepare('UPDATE envio_despesas SET lancamento_id = ?, movimentacao_id = ?, movimentos_holding_id = ?, status = ? WHERE id = ? AND lancamento_id IS NULL AND movimentacao_id IS NULL')
      .bind(holdingMovement ? null : lancamentoId, movimentacaoId, holdingMovement ? movimentacaoId : null, 'CONVERTIDO', request.id),
    db.prepare(`INSERT OR IGNORE INTO financeiro_vinculos (id, origem_tipo, origem_id, destino_tipo, destino_id, tipo_vinculo) VALUES (?, 'ENVIO_DESPESA', ?, ?, ?, 'CONVERSAO')`)
      .bind(crypto.randomUUID(), request.id, destinoTipo, movimentacaoId || lancamentoId),
  ])
  const updated = await db.prepare('SELECT lancamento_id, movimentacao_id FROM envio_despesas WHERE id = ?').bind(request.id).first<Row>()
  return { id: request.id, ...updated, reimbursement, external, idempotent: Boolean(lancamento?.idempotent && (!reimbursement || reimbursement.idempotent) && (!external || external.idempotent)) }
}
