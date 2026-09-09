import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  trilha: string[];
  titulo: string;
  subtitulo: string;
  acoes?: React.ReactNode;
}

export function PageHeader({ trilha, titulo, subtitulo, acoes }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <nav aria-label="Trilha de navegação">
          <ol className="flex items-center gap-1 text-xs text-muted-foreground">
            {trilha.map((item, i) =>
            <li key={item} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                <span className={i === trilha.length - 1 ? 'text-foreground' : undefined}>
                  {item}
                </span>
              </li>
            )}
          </ol>
        </nav>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>);

}