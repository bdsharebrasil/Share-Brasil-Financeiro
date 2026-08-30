-- Solicitações de férias vinculadas ao cadastro existente em user_profiles.
CREATE TABLE IF NOT EXISTS solicitacoes_ferias (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  quantidade_dias INTEGER NOT NULL CHECK (quantidade_dias > 0),
  status TEXT NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'aprovada', 'reprovada', 'cancelada')),
  observacoes TEXT,
  motivo_reprovacao TEXT,
  aprovado_por TEXT,
  aprovado_em TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (aprovado_por) REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS solicitacoes_ferias_user_idx
  ON solicitacoes_ferias(user_id, data_inicio DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS solicitacoes_ferias_status_idx
  ON solicitacoes_ferias(status, data_inicio);
