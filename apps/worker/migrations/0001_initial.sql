CREATE TABLE IF NOT EXISTS dashboard_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  departamento TEXT NOT NULL CHECK (departamento IN ('operacoes', 'financeiro', 'gestor', 'portal')),
  greeting TEXT NOT NULL,
  period TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  alerts_json TEXT NOT NULL,
  UNIQUE(user_id, departamento)
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  account TEXT NOT NULL,
  paid_by TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pago', 'pendente', 'agendado')),
  caixa TEXT NOT NULL CHECK (caixa IN ('share', 'cliente')),
  reimbursable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS movements_user_created_idx ON movements(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shareholders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  aircraft TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  utilization REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('regular', 'atencao', 'inadimplente'))
);

CREATE INDEX IF NOT EXISTS shareholders_user_idx ON shareholders(user_id);
