import { useState, type ReactNode } from "react";

interface Props {
  titulo: string;
  descricao?: string;
  acessorio?: ReactNode;
  children: ReactNode;
  abertaInicialmente?: boolean;
}

export function Secao({ titulo, descricao, acessorio, children, abertaInicialmente = true }: Props) {
  const [aberta, setAberta] = useState(abertaInicialmente);
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span
            className={`shrink-0 text-xs text-muted-foreground transition-transform ${aberta ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold uppercase tracking-wide text-foreground">
              {titulo}
            </span>
            {descricao && <span className="block truncate text-xs text-muted-foreground">{descricao}</span>}
          </span>
        </button>
        {acessorio && <div className="shrink-0">{acessorio}</div>}
      </header>
      {aberta && <div className="p-2.5 sm:p-3">{children}</div>}
    </section>
  );
}

export function Campo({
  rotulo,
  ajuda,
  extra,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  extra?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${extra ?? ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      {children}
      {ajuda && <span className="mt-1 block text-[11px] text-muted-foreground">{ajuda}</span>}
    </label>
  );
}

export function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="truncate font-mono text-xs font-semibold text-foreground">{valor ?? "—"}</p>
    </div>
  );
}
