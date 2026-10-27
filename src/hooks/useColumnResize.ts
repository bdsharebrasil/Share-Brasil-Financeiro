import { useCallback, useMemo, useRef, useState } from 'react';

// Largura fixa da coluna de controles (chevron + checkbox).
export const CTRL_WIDTH = 60;
const MAX_WIDTH = 2000;

const clamp = (value, min) => Math.max(min, Math.min(MAX_WIDTH, Math.round(value)));

/**
 * Resize de colunas estilo Excel.
 * - Durante o arraste só o DOM é alterado (<col> e <table>), sem re-render.
 * - No pointerup o valor vai para o state e para o localStorage.
 */
export default function useColumnResize(columns, storageKey) {
  const defaults = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.width])),
    [columns]
  );

  const [widths, setWidths] = useState(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      /* localStorage indisponível: usa os padrões */
    }
    return Object.fromEntries(
      columns.map((c) => [
        c.key,
        Number.isFinite(saved[c.key]) ? clamp(saved[c.key], c.min ?? 60) : c.width,
      ])
    );
  });

  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const tableRef = useRef(null);
  const colEls = useRef({});
  const drag = useRef(null);

  const colRef = useCallback((key) => (el) => { colEls.current[key] = el; }, []);

  const minOf = (key) => columns.find((c) => c.key === key)?.min ?? 60;

  const paintTable = (next) => {
    if (!tableRef.current) return;
    const sum = columns.reduce((n, c) => n + next[c.key], CTRL_WIDTH);
    tableRef.current.style.width = `${sum}px`;
  };

  const persist = (next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* a grid funciona sem persistência */
    }
  };

  const commit = (next) => {
    widthsRef.current = next;
    setWidths(next);
    persist(next);
  };

  const setOne = (key, value) =>
    commit({ ...widthsRef.current, [key]: clamp(value, minOf(key)) });

  // Duplo clique: mede o conteúdo real (elementos com data-fit) e ajusta.
  const autoFit = (key) => {
    const table = tableRef.current;
    if (!table) return;
    let needed = 0;
    table.querySelectorAll(`[data-col="${key}"] [data-fit]`).forEach((el) => {
      const extra = el.dataset.fit === 'header' ? 22 : 0; // ícone de ordenação
      needed = Math.max(needed, el.scrollWidth + 24 + extra); // 24 = padding da célula
    });
    if (needed) setOne(key, needed);
  };

  const handleProps = (key) => {
    const end = (e) => {
      const d = drag.current;
      if (!d || d.key !== key) return;
      drag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      commit({ ...widthsRef.current, [key]: d.current });
    };

    return {
      onPointerDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const start = widthsRef.current[key];
        drag.current = { key, x: e.clientX, start, current: start };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      },
      onPointerMove(e) {
        const d = drag.current;
        if (!d || d.key !== key) return;
        d.current = clamp(d.start + e.clientX - d.x, minOf(key));
        const el = colEls.current[key];
        if (el) el.style.width = `${d.current}px`;
        paintTable({ ...widthsRef.current, [key]: d.current });
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
      onClick: (e) => e.stopPropagation(),
      onDoubleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        autoFit(key);
      },
      onKeyDown(e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'Enter'].includes(e.key)) return;
        e.preventDefault();
        if (e.key === 'Enter') autoFit(key);
        else if (e.key === 'Home') setOne(key, defaults[key]);
        else setOne(key, widthsRef.current[key] + (e.key === 'ArrowRight' ? 10 : -10));
      },
    };
  };

  const restore = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignora */
    }
    widthsRef.current = defaults;
    setWidths(defaults);
  };

  return { widths, tableRef, colRef, handleProps, restore };
}