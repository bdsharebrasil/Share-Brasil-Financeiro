-- Corrige a relação de hold_socios:
--   cotista_id -> cotista_aeronave(id)
--   holding_id -> holdings(id)
-- Os registros existentes são remapeados pelo socio_id.

CREATE TABLE IF NOT EXISTS holdings (
    id TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    conta_bancaria TEXT,
    ativo INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO holdings (id, nome, conta_bancaria, ativo)
VALUES ('738850b2-d19c-496b-b2d3-35ecc64bd862', 'DGA ADMINISTRADORA DE BENS SPE LTDA', 'DGA BRADESCO', 1);

-- O D1 mantém foreign keys ativas; a tabela antiga é preservada para não
-- invalidar as tabelas legadas que ainda a referenciam.
ALTER TABLE hold_socios RENAME TO hold_socios_legacy;

CREATE TABLE hold_socios (
    id TEXT PRIMARY KEY NOT NULL,
    cotista_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    email_principal TEXT NULL,
    emails TEXT NOT NULL DEFAULT '[]',
    endereco TEXT NULL,
    cidade TEXT NULL,
    uf TEXT NULL,
    contato_financeiro TEXT NULL,
    telefone_financeiro TEXT NULL,
    telefone TEXT NULL,
    observacoes TEXT NULL,
    criado_em TEXT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NULL DEFAULT CURRENT_TIMESTAMP,
    holding_id TEXT NOT NULL,
    FOREIGN KEY (cotista_id) REFERENCES cotista_aeronave(id),
    FOREIGN KEY (holding_id) REFERENCES holdings(id)
);

INSERT INTO hold_socios (
    id, cotista_id, nome, cpf, email_principal, emails, endereco, cidade, uf,
    contato_financeiro, telefone_financeiro, telefone, observacoes, criado_em,
    atualizado_em, holding_id
)
SELECT
    hs.id,
    ca.id,
    hs.nome,
    hs.cpf,
    hs.email_principal,
    hs.emails,
    hs.endereco,
    hs.cidade,
    hs.uf,
    hs.contato_financeiro,
    hs.telefone_financeiro,
    hs.telefone,
    hs.observacoes,
    hs.criado_em,
    hs.atualizado_em,
    COALESCE(hs.holding_id, '738850b2-d19c-496b-b2d3-35ecc64bd862')
FROM hold_socios_legacy hs
JOIN cotista_aeronave ca ON ca.socio_id = hs.id;
