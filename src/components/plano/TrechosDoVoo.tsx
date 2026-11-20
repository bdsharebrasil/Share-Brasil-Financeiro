import { formatarData } from "@/lib/format";
import { pernaPodePlanejar } from "@/lib/plano-voo";
import type { PernaPlanoVoo } from "@/lib/tipos";

const rotulos: Record<string, string> = { programada: "Programada", acionado: "Acionado", em_voo: "Em voo", em_rota: "Em voo", em_solo: "Em solo", pousado: "Pousado", cortado: "Finalizada", encerrada: "Finalizada", encerrado: "Finalizada", cancelada: "Cancelada", cancelado: "Cancelada" };

export function TrechosDoVoo({ pernas, selecionada, aoSelecionar }: { pernas: PernaPlanoVoo[]; selecionada: string; aoSelecionar: (id: string) => void }) {
  if (!pernas.length) return null;
  return <section className="rounded-lg border border-border bg-card p-2.5" aria-label="Trechos do voo">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">Trechos do voo</h2>
      <p className="text-xs text-muted-foreground">Selecione o trecho para preencher o plano.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {pernas.map((perna, indice) => <button key={perna.id} type="button" aria-pressed={perna.id === selecionada} disabled={!pernaPodePlanejar(perna)} onClick={() => aoSelecionar(perna.id)}
        className={`min-w-0 rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${perna.id === selecionada ? "border-primary/50 bg-accent text-accent-foreground" : "border-border bg-background text-foreground hover:bg-secondary"}`}>
        <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Trecho {indice + 1}</span><span>{formatarData(perna.data)}</span></span>
        <span className="mt-1 block font-mono text-sm font-semibold">{perna.origem} → {perna.destino}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{rotulos[perna.status?.toLowerCase()] || "Cadastrada"} · {perna.numero_passageiros ?? 0} passageiros</span>
      </button>)}
    </div>
  </section>;
}
