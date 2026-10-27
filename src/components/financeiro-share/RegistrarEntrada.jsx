import { useMemo, useRef, useState } from 'react';
import DataGrid, { CellText } from './DataGrid';
import styles from './RegistrarEntrada.module.css';

// ---------- helpers ----------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents) => brl.format(cents / 100);
const signedMoney = (cents) => `${cents < 0 ? '−' : '+'} ${money(Math.abs(cents))}`;
const dateBR = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

function safeUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

const STATUS = {
  PENDENTE: { label: 'Pendente', cls: styles.pending },
  ATRASADO: { label: 'Atrasado', cls: styles.overdue },
  RECEBIDO: { label: 'Recebido', cls: styles.received },
  CONCILIADO: { label: 'Conciliado', cls: styles.received },
};

// ---------- colunas (fora do componente = referência estável) ----------
const columns = [
  { key: 'documento', label: 'DOC', width: 130, render: (r) => <CellText variant="mono">{r.documento}</CellText> },
  {
    key: 'descricao', label: 'Descrição', width: 320,
    render: (r) => (
      <>
        <CellText variant="strong">{r.descricao}</CellText>
        <CellText variant="sub">{r.categoria}</CellText>
      </>
    ),
  },
  { key: 'favorecido', label: 'Favorecido', width: 240, render: (r) => <CellText>{r.favorecido}</CellText> },
  {
    key: 'contaBancaria', label: 'Conta', width: 110,
    render: (r) => <CellText variant="mono">{r.contaBancaria}</CellText>,
  },
  {
    key: 'dataLancamento', label: 'Data', width: 110,
    render: (r) => (
      <>
        <CellText>{dateBR(r.dataLancamento)}</CellText>
        <CellText variant="sub">{`Venc. ${dateBR(r.dataVencimento)}`}</CellText>
      </>
    ),
  },
  {
    key: 'situacao', label: 'Situação', width: 110,
    sortValue: (r) => STATUS[r.situacao]?.label ?? r.situacao,
    render: (r) => {
      const s = STATUS[r.situacao] ?? { label: r.situacao, cls: '' };
      return <span data-fit className={`${styles.badge} ${s.cls}`} title={s.label}>{s.label}</span>;
    },
  },
  {
    key: 'valorCentavos', label: 'Valor', width: 130, align: 'right',
    render: (r) => (
      <CellText variant="mono" className={r.valorCentavos < 0 ? styles.negative : styles.positive}>
        {signedMoney(r.valorCentavos)}
      </CellText>
    ),
  },
];

const getRowId = (r) => r.id;

// ---------- painel de detalhe ----------
function Detail({ row }) {
  const fields = [
    ['Categoria', row.categoria],
    ['Centro de custo', row.centroCusto],
    ['Forma de pagamento', row.formaPagamento],
    ['Data de competência', dateBR(row.dataCompetencia)],
    ['Data de emissão', dateBR(row.dataEmissao)],
    ['Nº do documento', row.documento],
    ['Criado por/em', `${row.criadoPor || '—'} · ${dateBR(row.criadoEm)}`],
    ['Última alteração', dateBR(row.ultimaAlteracao)],
  ];
  return (
    <dl className={styles.detail}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd title={value}>{value || '—'}</dd>
        </div>
      ))}
      <div className={styles.wide}>
        <dt>Observações</dt>
        <dd title={row.observacoes}>{row.observacoes || '—'}</dd>
      </div>
      <div className={styles.wide}>
        <dt>Anexos</dt>
        <dd>
          {row.anexos?.length
            ? row.anexos.map((a, i) => {
                const href = safeUrl(a.url);
                return href
                  ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{a.nome || 'Anexo'}</a>
                  : <span key={i}>{a.nome || 'Anexo'}</span>;
              })
            : 'Nenhum anexo'}
        </dd>
      </div>
    </dl>
  );
}

// ---------- ícones (SVG inline, 16px) ----------
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
    <path d={d} />
  </svg>
);
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  print: 'M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z',
  filter: 'M3 4h18l-7 8v7l-4 2v-9z',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
};

// ---------- página ----------
export default function RegistrarEntrada() {
  // TROQUE AQUI pelo retorno do seu backend (ex.: const { data: rows = [] } = useQuery(...)).
  // Formato: ver mockData.js (valorCentavos inteiro, datas ISO).
  const rows = mockRows;

  const gridRef = useRef(null);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return rows.filter(
      (r) =>
        (r.dataLancamento || '').slice(0, 7) === month &&
        (!status || r.situacao === status) &&
        `${r.documento} ${r.descricao} ${r.categoria} ${r.favorecido}`.toLocaleLowerCase('pt-BR').includes(q)
    );
  }, [rows, month, query, status]);

  const total = useMemo(() => filtered.reduce((n, r) => n + r.valorCentavos, 0), [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;

  const resetView = () => {
    setPage(1);
    setSelected(new Set());
  };

  const stepMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
    resetView();
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const canReconcile =
    selectedRows.length === 1 && ['PENDENTE', 'ATRASADO'].includes(selectedRows[0].situacao);

  // Ligue estes handlers aos seus modais/API.
  const handleNew = () => {};
  const handleReconcile = () => {};

  const footer = (
    <div className={styles.summary}>
      <span>{`TOTAL LISTADO (${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'})`}</span>
      <strong>{money(total)}</strong>
    </div>
  );

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <a href="/dashboard">Voltar ao Dashboard</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Registrar entrada</span>
      </nav>

      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Módulo financeiro</p>
          <h1>Registrar Entrada</h1>
        </div>
        <div className={styles.headingTotal}>
          <p className={styles.eyebrow}>Total listado</p>
          <strong>{money(total)}</strong>
        </div>
      </header>

      <div className={styles.toolbar} role="toolbar" aria-label="Ações financeiras">
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNew}>
          <Icon d={PATHS.plus} /> Novo
        </button>
        <button
          type="button" className={styles.btn} disabled={!canReconcile} onClick={handleReconcile}
          title="Selecione um lançamento pendente ou atrasado"
        >
          <Icon d={PATHS.check} /> Conciliar
        </button>
        <button type="button" className={styles.btn} onClick={() => window.print()}>
          <Icon d={PATHS.print} /> Imprimir
        </button>
        <button
          type="button" className={styles.btn} aria-expanded={filtersOpen} aria-controls="filtros"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Icon d={PATHS.filter} /> Filtrar
        </button>
        <span className={styles.separator} aria-hidden="true" />
        <button type="button" className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => gridRef.current?.restoreColumns()}>
          Restaurar colunas
        </button>

        <div className={styles.period}>
          <button
            type="button" className={styles.btn}
            onClick={() => { setMonth(monthKey(new Date())); resetView(); }}
          >
            Mês Atual
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnIcon}`} aria-label="Mês anterior" onClick={() => stepMonth(-1)}>
            <Icon d={PATHS.left} />
          </button>
          <span className={styles.month} aria-live="polite">{monthLabel(month)}</span>
          <button type="button" className={`${styles.btn} ${styles.btnIcon}`} aria-label="Próximo mês" onClick={() => stepMonth(1)}>
            <Icon d={PATHS.right} />
          </button>
        </div>
      </div>

      {filtersOpen && (
        <section id="filtros" className={styles.filters} aria-label="Filtros">
          <label>
            Buscar lançamento
            <input
              type="search" value={query} placeholder="Documento, descrição ou favorecido" autoFocus
              onChange={(e) => { setQuery(e.target.value); resetView(); }}
            />
          </label>
          <label>
            Situação
            <select value={status} onChange={(e) => { setStatus(e.target.value); resetView(); }}>
              <option value="">Todas as situações</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      <DataGrid
        ref={gridRef}
        storageKey="financeiro.registrar-entrada.colunas.v1"
        columns={columns}
        rows={filtered}
        getRowId={getRowId}
        renderExpanded={(row) => <Detail row={row} />}
        selected={selected}
        onSelectedChange={setSelected}
        page={safePage}
        pageSize={pageSize}
        initialSort={{ key: 'dataLancamento', dir: -1 }}
        footer={footer}
      />

      <footer className={styles.pagination}>
        <span aria-live="polite">{`${selected.size} selecionado${selected.size === 1 ? '' : 's'}`}</span>
        <span aria-hidden="true">·</span>
        <span>
          {filtered.length
            ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${filtered.length} registros`
            : '0 registros'}
        </span>
        <div className={styles.pages}>
          <label htmlFor="linhas">Linhas por página</label>
          <select id="linhas" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" className={styles.btn} disabled={safePage === 1} aria-label="Página anterior" onClick={() => setPage(safePage - 1)}>‹</button>
          <span>{`${safePage} / ${pages}`}</span>
          <button type="button" className={styles.btn} disabled={safePage === pages} aria-label="Próxima página" onClick={() => setPage(safePage + 1)}>›</button>
        </div>
      </footer>
    </main>
  );
}
