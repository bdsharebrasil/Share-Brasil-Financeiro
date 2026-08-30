-- Estrutura complementar para o fluxo Portal Cliente → Coordenação → Sistema Interno.
-- As tabelas de negócio principais já existem no banco D1.

ALTER TABLE empresa ADD COLUMN telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS user_cliente_login_idx
  ON user_cliente(login);

CREATE INDEX IF NOT EXISTS solicitacoes_reserva_voo_status_data_idx
  ON solicitacoes_reserva_voo(status, data_agendada);

CREATE INDEX IF NOT EXISTS solicitacoes_reserva_voo_cliente_idx
  ON solicitacoes_reserva_voo(cliente_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS voo_sequencia (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO voo_sequencia (id, ultimo_numero) VALUES (1, 0);
