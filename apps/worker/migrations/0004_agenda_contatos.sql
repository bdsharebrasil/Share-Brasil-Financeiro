CREATE TABLE IF NOT EXISTS agenda_contatos (
  id TEXT PRIMARY KEY NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  empresa TEXT,
  cargo TEXT,
  observacoes TEXT,
  endereco TEXT,
  uf TEXT,
  cidade TEXT,
  categoria TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS agenda_contatos_nome_idx
  ON agenda_contatos(nome COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS agenda_contatos_empresa_idx
  ON agenda_contatos(empresa COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS agenda_contatos_cidade_idx
  ON agenda_contatos(cidade COLLATE NOCASE);
