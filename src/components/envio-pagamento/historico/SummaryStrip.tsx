import { formatarMoeda } from "./status";

type SummaryStripProps = {
  valor: number;
  valorEmAberto: number;
  registros: number;
  tipos: number;
  share: number;
  emails: number;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function SummaryStrip({ valor, valorEmAberto, registros, tipos, share, emails }: SummaryStripProps) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-border bg-card/60 px-5 py-4 lg:flex-row lg:items-center lg:gap-8">
      <div className="lg:min-w-[220px]">
        <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Valor programado</p>
        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">{formatarMoeda(valor)}</p>
        <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-300">{formatarMoeda(valorEmAberto)} em aberto</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 border-t border-border/60 pt-4 sm:grid-cols-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <Metric label="Tipos" value={String(tipos)} />
        <Metric label="Programações" value={String(registros)} />
        <Metric label="Caixa Share" value={String(share)} />
        <Metric label="Com e-mail" value={String(emails)} />
      </div>
    </div>
  );
}
