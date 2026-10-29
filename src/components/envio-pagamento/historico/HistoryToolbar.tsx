import { Search, X } from "lucide-react";

export type OpcaoFiltroStatus = { value: string; label: string; count: number };

type HistoryToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  opcoesStatus: OpcaoFiltroStatus[];
  resultLabel: string;
};

export function HistoryToolbar({ query, onQueryChange, status, onStatusChange, opcoesStatus, resultLabel }: HistoryToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar por descrição, fornecedor, categoria, voo ou responsável"
          aria-label="Buscar programações de pagamento"
          className="h-9 w-full rounded-sm border border-border bg-card/60 pl-9 pr-9 text-[11px] text-foreground placeholder:text-muted-foreground transition-colors duration-150 ease-out hover:border-primary/40 focus:border-primary/60 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden text-[10px] text-muted-foreground xl:inline">{resultLabel}</span>
        {opcoesStatus.map((opcao) => {
          const ativo = opcao.value === status;
          return (
            <button
              key={opcao.value}
              type="button"
              onClick={() => onStatusChange(opcao.value)}
              aria-pressed={ativo}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1.5 text-[10px] font-bold transition-colors duration-150 ease-out ${
                ativo
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {opcao.label}
              <span className={ativo ? "text-primary/70" : "text-muted-foreground/70"}>{opcao.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
