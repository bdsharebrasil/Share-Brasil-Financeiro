-- Perfil e autosserviço do portal do colaborador.
CREATE TABLE IF NOT EXISTS colaboradores (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  departamento TEXT,
  telefone TEXT,
  data_admissao TEXT,
  foto_url TEXT,
  dias_ferias_direito INTEGER NOT NULL DEFAULT 30,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS colaboradores_email_idx ON colaboradores(email);

CREATE TABLE IF NOT EXISTS pagamentos_colaborador (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  competencia TEXT,
  data_pagamento TEXT,
  valor REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado')),
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pagamentos_colaborador_data_idx
  ON pagamentos_colaborador(colaborador_id, data_pagamento DESC, criado_em DESC);

CREATE TABLE IF NOT EXISTS documentos_pessoais (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  chave_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'aprovado', 'reprovado')),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS documentos_pessoais_colaborador_idx
  ON documentos_pessoais(colaborador_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS solicitacoes_ferias (
  id TEXT PRIMARY KEY,
  colaborador_id TEXT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  quantidade_dias INTEGER NOT NULL CHECK (quantidade_dias > 0),
  status TEXT NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'aprovada', 'reprovada', 'cancelada')),
  observacoes TEXT,
  motivo_reprovacao TEXT,
  aprovado_por TEXT,
  aprovado_em TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS solicitacoes_ferias_colaborador_idx
  ON solicitacoes_ferias(colaborador_id, data_inicio DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS solicitacoes_ferias_status_idx
  ON solicitacoes_ferias(status, data_inicio);
