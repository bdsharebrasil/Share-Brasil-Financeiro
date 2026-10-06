import type { ReactNode } from "react";
import { Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TomStatusFinanceiro = "amber" | "emerald" | "red" | "blue" | "muted";

export interface FiltroTabelaFinanceira {
  id: string;
  label: string;
  quantidade?: number;
}

export interface LinhaTabelaFinanceira {
  id: string;
  principal: string;
  secundaria?: string | null;
  categoria: string;
  vencimento: string;
  valor: ReactNode;
  status: string;
  statusLabel: string;
  tomStatus: TomStatusFinanceiro;
  acoes?: ReactNode;
  detalhe?: ReactNode;
  expandida?: boolean;
  aoAlternarDetalhe?: () => void;
}

interface TabelaFinanceiraPremiumProps {
  titulo: string;
  descricao: string;
  linhas: LinhaTabelaFinanceira[];
  filtros: FiltroTabelaFinanceira[];
  filtroAtivo: string;
  aoFiltrar: (id: string) => void;
  busca: string;
  aoBuscar: (valor: string) => void;
  placeholderBusca?: string;
  carregando?: boolean;
  mensagemVazia?: string;
  acaoCabecalho?: ReactNode;
}

const CORES_STATUS: Record<TomStatusFinanceiro, string> = {
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  blue: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  muted: "border-border bg-muted/60 text-muted-foreground",
};

function EtiquetaStatus({ label, tone }: { label: string; tone: TomStatusFinanceiro }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold leading-none ${CORES_STATUS[tone]}`}>{label}</span>;
}

function CelulaStatus({ linha }: { linha: LinhaTabelaFinanceira }) {
  return <EtiquetaStatus label={linha.statusLabel} tone={linha.tomStatus} />;
}

export function TabelaFinanceiraPremium({
  titulo,
  descricao,
  linhas,
  filtros,
  filtroAtivo,
  aoFiltrar,
  busca,
  aoBuscar,
  placeholderBusca = "Buscar por descrição ou fornecedor",
  carregando = false,
  mensagemVazia = "Nenhum registro encontrado.",
  acaoCabecalho,
}: TabelaFinanceiraPremiumProps) {
  const semResultados = !carregando && linhas.length === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-[-.01em] text-card-foreground">{titulo}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{descricao}</p>
        </div>
        {acaoCabecalho && <div className="shrink-0">{acaoCabecalho}</div>}
      </header>

      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar registros por status">
          {filtros.map((filtro) => {
            const ativo = filtroAtivo === filtro.id;
            return (
              <Button
                key={filtro.id}
                type="button"
                size="sm"
                variant={ativo ? "secondary" : "ghost"}
                aria-pressed={ativo}
                onClick={() => aoFiltrar(filtro.id)}
                className={`h-8 shrink-0 gap-1.5 rounded-lg px-3 text-[11px] ${ativo ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"}`}
              >
                {filtro.label}
                {filtro.quantidade !== undefined && <span className={`text-[10px] ${ativo ? "text-primary-foreground/75" : "text-muted-foreground/70"}`}>{filtro.quantidade}</span>}
              </Button>
            );
          })}
        </div>
        <label className="relative block w-full shrink-0 sm:max-w-[250px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busca}
            onChange={(event) => aoBuscar(event.target.value)}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca}
            className="h-9 rounded-lg bg-background pl-9 text-xs"
          />
        </label>
      </div>

      {carregando ? (
        <div className="px-4 py-12 text-center text-xs text-muted-foreground" role="status">Carregando registros…</div>
      ) : semResultados ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <Inbox className="h-7 w-7 text-muted-foreground/70" aria-hidden="true" />
          <p className="text-sm font-medium text-card-foreground">{mensagemVazia}</p>
          <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-muted/30">
                <tr className="border-b border-border/70 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                  <th className="px-4 py-3">Fornecedor / descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <FragmentLinha key={linha.id} linha={linha} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border/60 md:hidden">
            {linhas.map((linha) => (
              <article key={linha.id} className={`space-y-3 px-4 py-4 ${linha.expandida ? "bg-primary/[.025]" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-semibold text-card-foreground">{linha.principal}</p>
                    {linha.secundaria && <p className="mt-1 break-words text-[10px] text-muted-foreground">{linha.secundaria}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-bold tabular-nums text-card-foreground">{linha.valor}</div>
                    <div className="mt-1"><CelulaStatus linha={linha} /></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/25 px-3 py-2.5 text-[10px]">
                  <div className="min-w-0"><p className="uppercase tracking-wide text-muted-foreground">Categoria</p><p className="mt-1 truncate font-medium text-card-foreground">{linha.categoria || "—"}</p></div>
                  <div><p className="uppercase tracking-wide text-muted-foreground">Vencimento</p><p className="mt-1 font-mono text-card-foreground">{linha.vencimento}</p></div>
                </div>
                {linha.acoes && <div className="flex justify-end">{linha.acoes}</div>}
                {linha.expandida && linha.detalhe && <div className="border-t border-border/60 pt-3">{linha.detalhe}</div>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FragmentLinha({ linha }: { linha: LinhaTabelaFinanceira }) {
  return (
    <>
      <tr className={`border-b border-border/60 transition-colors hover:bg-primary/[.035] ${linha.expandida ? "bg-primary/[.025]" : ""}`}>
        <td className="max-w-[300px] px-4 py-3.5">
          <p className="break-words text-xs font-semibold text-card-foreground">{linha.principal}</p>
          {linha.secundaria && <p className="mt-1 break-words text-[10px] text-muted-foreground">{linha.secundaria}</p>}
        </td>
        <td className="max-w-[190px] px-4 py-3.5"><span className="inline-flex max-w-full truncate rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">{linha.categoria || "—"}</span></td>
        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-muted-foreground">{linha.vencimento}</td>
        <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs font-bold tabular-nums text-card-foreground">{linha.valor}</td>
        <td className="px-4 py-3.5"><CelulaStatus linha={linha} /></td>
        <td className="px-4 py-3.5 text-right">{linha.acoes}</td>
      </tr>
      {linha.expandida && linha.detalhe && (
        <tr className="border-b border-border/60 bg-muted/20">
          <td colSpan={6} className="px-5 py-4">{linha.detalhe}</td>
        </tr>
      )}
    </>
  );
}
