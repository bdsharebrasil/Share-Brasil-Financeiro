export function mensagemFinanceiraStatements(
  db: D1Database,
  destinatarioId: string | null,
  remetenteId: string | null,
  assunto: string,
  conteudo: string,
): D1PreparedStatement[] {
  if (!destinatarioId || !remetenteId || destinatarioId === remetenteId) return []
  const id = crypto.randomUUID()
  return [
    db.prepare('INSERT INTO mensagens (id, remetente_id, destinatario_id, assunto, conteudo, anexos_mensagens) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, remetenteId || destinatarioId, destinatarioId, assunto, conteudo, '[]'),
    db.prepare("INSERT INTO mensagens_usuario (mensagem_id, usuario_id, papel, lida) VALUES (?, ?, 'remetente', 1)")
      .bind(id, remetenteId || destinatarioId),
    db.prepare("INSERT INTO mensagens_usuario (mensagem_id, usuario_id, papel, lida) VALUES (?, ?, 'destinatario', 0)")
      .bind(id, destinatarioId),
  ]
}
