import {
  forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle,
  useMemo, useRef, useState,
} from 'react';
import useColumnResize, { CTRL_WIDTH } from './useColumnResize';
import styles from './DataGrid.module.css';

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Texto de célula: nunca quebra linha, mostra reticências e title com o texto completo.
 * variant: 'strong' | 'mono' | 'sub'. O atributo data-fit é usado pelo autoajuste.
 */
export function CellText({ children, variant, className = '', title }) {
  const text = title ?? (typeof children === 'string' ? children : undefined);
  const cls = [styles.cellText, variant && styles[variant], className].filter(Boolean).join(' ');
  return (
    <span data-fit className={cls} title={text}>
      {children}
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

// Linha memoizada: resize, ordenação de outras linhas e seleção não re-renderizam tudo.
const Row = memo(function Row({
  row, id, columns, selected, expanded, focusable, detailId,
  renderExpanded, expandOnRowClick, onToggle, onSelect,
}) {
  // Detalhe fica montado por 150ms após fechar para animar a saída.
  const [mounted, setMounted] = useState(expanded);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (expanded) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(t);
  }, [expanded]);

  const handleClick = (e) => {
    if (!expandOnRowClick || e.target.closest('button,input,a,label')) return;
    onToggle(id);
  };

  const handleKeyDown = (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onToggle(id);
    }
  };

  return (
    <>
      <tr
        data-row
        data-id={id}
        tabIndex={focusable ? 0 : -1}
        className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <td className={styles.ctrlCell}>
          <div className={styles.ctrl}>
            <button
              type="button"
              className={styles.expander}
              aria-expanded={expanded}
              aria-controls={detailId}
              aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
              onClick={() => onToggle(id)}
            >
              <Chevron />
            </button>
            <input
              type="checkbox"
              className={styles.check}
              checked={selected}
              onChange={() => onSelect(id)}
              aria-label="Selecionar lançamento"
            />
          </div>
        </td>
        {columns.map((c) => (
          <td key={c.key} data-col={c.key} className={c.align === 'right' ? styles.right : undefined}>
            {c.render(row)}
          </td>
        ))}
        <td className={styles.filler} aria-hidden="true" />
      </tr>
      {mounted && (
        <tr id={detailId} className={styles.detailRow}>
          <td colSpan={columns.length + 2}>
            <div className={`${styles.reveal} ${shown ? styles.open : ''}`}>
              <div className={styles.revealInner}>{renderExpanded(row)}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

/**
 * Grid genérico.
 * columns: [{ key, label, width, min?, align?, resizable?, sortValue?(row), render(row) }]
 * selected: Set de ids | onSelectedChange: setter do useState (aceita função)
 * Ordena internamente e pagina (page/pageSize) depois de ordenar.
 */
const DataGrid = forwardRef(function DataGrid(
  {
    columns, rows, getRowId, renderExpanded, storageKey,
    selected, onSelectedChange,
    page = 1, pageSize, initialSort = null,
    expandOnRowClick = true, footer,
    emptyMessage = 'Nenhum lançamento encontrado para este período e filtros.',
  },
  ref
) {
  const uid = useId();
  const { widths, tableRef, colRef, handleProps, restore } = useColumnResize(columns, storageKey);
  const [sort, setSort] = useState(initialSort); // { key, dir: 1 | -1 }
  const [expanded, setExpanded] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);
  const selectAllRef = useRef(null);

  useImperativeHandle(ref, () => ({ restoreColumns: restore }));

  // Ordenação (valores numéricos comparados como número, texto com Intl.Collator).
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = col.sortValue ?? ((r) => r[col.key]);
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const r = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : collator.compare(String(x ?? ''), String(y ?? ''));
      return r * sort.dir;
    });
  }, [rows, sort, columns]);

  const pageRows = useMemo(
    () => (pageSize ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted),
    [sorted, page, pageSize]
  );
  const pageIds = useMemo(() => pageRows.map(getRowId), [pageRows, getRowId]);

  const activeFocus = pageIds.includes(focusId) ? focusId : pageIds[0];

  const toggleExpanded = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id) => {
    onSelectedChange((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [onSelectedChange]);

  // "Selecionar todos" afeta SOMENTE as linhas da página atual.
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage > 0 && !allSelected;
    }
  }, [selectedOnPage, allSelected]);

  const toggleSelectAll = () =>
    onSelectedChange((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });

  // Expandir/recolher todas as linhas da página.
  const allExpanded = pageIds.length > 0 && pageIds.every((id) => expanded.has(id));
  const toggleExpandAll = () =>
    setExpanded((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (allExpanded ? next.delete(id) : next.add(id)));
      return next;
    });

  const toggleSort = (key) =>
    setSort((s) => (s?.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  // ↑ ↓ navegam entre linhas (roving tabindex).
  const handleBodyKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const tr = e.target.closest('tr[data-row]');
    if (!tr) return;
    e.preventDefault();
    const list = [...e.currentTarget.querySelectorAll('tr[data-row]')];
    const next = list[list.indexOf(tr) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      setFocusId(next.dataset.id);
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleBodyFocus = (e) => {
    const tr = e.target.closest('tr[data-row]');
    if (tr) setFocusId(tr.dataset.id);
  };

  const tableWidth = columns.reduce((n, c) => n + widths[c.key], CTRL_WIDTH);

  return (
    <section className={styles.shell} aria-label="Lançamentos financeiros">
      <div className={styles.scroll}>
        <table ref={tableRef} className={styles.table} style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: CTRL_WIDTH }} />
            {columns.map((c) => (
              <col key={c.key} ref={colRef(c.key)} style={{ width: widths[c.key] }} />
            ))}
            {/* coluna "filler": absorve o espaço sobrando e a tabela ocupa 100% */}
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.ctrlHead}>
                <div className={styles.ctrl}>
                  <button
                    type="button"
                    className={styles.expander}
                    aria-expanded={allExpanded}
                    aria-label={allExpanded ? 'Recolher todas' : 'Expandir todas'}
                    title={allExpanded ? 'Recolher todas' : 'Expandir todas'}
                    onClick={toggleExpandAll}
                    disabled={!pageIds.length}
                  >
                    <Chevron />
                  </button>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className={styles.check}
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={!pageIds.length}
                    aria-label="Selecionar todos desta página"
                    title="Selecionar todos desta página"
                  />
                </div>
              </th>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    data-col={c.key}
                    className={c.align === 'right' ? styles.right : undefined}
                    aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className={styles.sortBtn} onClick={() => toggleSort(c.key)}>
                      <span data-fit="header" className={styles.label}>{c.label}</span>
                      <span className={`${styles.sortIcon} ${active ? styles.sortActive : ''}`} aria-hidden="true">
                        {active ? (sort.dir === 1 ? '▲' : '▼') : '▲▼'}
                      </span>
                    </button>
                    {c.resizable !== false && (
                      <span
                        className={styles.resizer}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Largura da coluna ${c.label}`}
                        aria-valuenow={Math.round(widths[c.key])}
                        aria-valuemin={c.min ?? 60}
                        aria-valuemax={2000}
                        tabIndex={0}
                        title="Arraste para redimensionar; duplo clique para autoajustar"
                        {...handleProps(c.key)}
                      />
                    )}
                  </th>
                );
              })}
              <th className={styles.filler} aria-hidden="true" />
            </tr>
          </thead>
          <tbody onKeyDown={handleBodyKeyDown} onFocus={handleBodyFocus}>
            {pageRows.map((row) => {
              const id = getRowId(row);
              return (
                <Row
                  key={id}
                  row={row}
                  id={id}
                  columns={columns}
                  selected={selected.has(id)}
                  expanded={expanded.has(id)}
                  focusable={activeFocus === id}
                  detailId={`${uid}-detail-${id}`}
                  renderExpanded={renderExpanded}
                  expandOnRowClick={expandOnRowClick}
                  onToggle={toggleExpanded}
                  onSelect={toggleSelected}
                />
              );
            })}
            {!pageRows.length && (
              <tr>
                <td colSpan={columns.length + 2} className={styles.empty}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  );
});

export default DataGrid;
