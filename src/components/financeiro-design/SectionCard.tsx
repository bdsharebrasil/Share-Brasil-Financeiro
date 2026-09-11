import type React from "react";

interface SectionCardProps {
  titulo: string;
  descricao?: string;
  Icon?: React.ElementType;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  semPadding?: boolean;
}

export function SectionCard({
  titulo,
  descricao,
  Icon,
  acoes,
  children,
  semPadding = false,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-2.5">
          {Icon ? <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" /> : null}
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">{titulo}</h2>
            {descricao ? <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p> : null}
          </div>
        </div>
        {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
      </header>
      <div className={semPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}
