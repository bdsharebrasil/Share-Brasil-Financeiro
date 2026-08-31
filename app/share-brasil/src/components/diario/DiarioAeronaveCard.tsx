import { Activity, ChevronRight, Gauge, Plane } from "lucide-react";
import type { DiarioAeronaveResumo } from "@/lib/colaborador-api";
import { EtiquetaStatus } from "@/components/dashboard/PrimitivosDashboard";

function horas(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function DiarioAeronaveCard({ aeronave, ano, onOpen }: { aeronave: DiarioAeronaveResumo; ano: number; onOpen: () => void }) {
  const atual = Math.max(Number(aeronave.celula_atual_ttotal || 0), Number(aeronave.horas_ano || 0));
  const revisao = Number(aeronave.celula_prox_revisao_ttotal || 0);
  const restante = revisao > 0 ? revisao - atual : null;
  const percentual = revisao > 0 ? Math.min(100, Math.max(0, (atual / revisao) * 100)) : 0;
  const urgente = restante !== null && restante <= 10;
  const statusAtivo = (aeronave.status || "").toLowerCase().startsWith("ativ");

  return (
    <button type="button" onClick={onOpen} className="group relative w-full overflow-hidden rounded-2xl border border-border bg-card/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[.06] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Plane size={19} /></span>
            <div className="min-w-0"><h3 className="truncate text-base font-extrabold tracking-[-.02em]">{aeronave.matricula_registro}</h3><p className="truncate text-[11px] text-muted-foreground">{[aeronave.fabricante, aeronave.modelo].filter(Boolean).join(" ") || "Modelo não informado"}</p></div>
          </div>
          <EtiquetaStatus tone={statusAtivo ? "green" : "neutral"}>{statusAtivo ? "Ativa" : aeronave.status || "Inativa"}</EtiquetaStatus>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-secondary/35 p-3">
          <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">Diário</p><p className="mt-1 font-mono text-sm font-bold">{ano}</p></div>
          <div><p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground"><Gauge size={11} /> Célula atual</p><p className="mt-1 font-mono text-sm font-bold">{horas(atual)}h</p></div>
        </div>
        {revisao > 0 ? <div className="mb-4"><div className="mb-1.5 flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Activity size={12} className={urgente ? "text-[#f4cc64]" : "text-primary"} /> Próxima revisão</span><span className={`font-mono text-[10px] font-bold ${urgente ? "text-[#f4cc64]" : "text-primary"}`}>{horas(restante)}h restantes</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full transition-all ${urgente ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"}`} style={{ width: `${percentual}%` }} /></div></div> : <p className="mb-4 text-[10px] text-muted-foreground">Próxima revisão não informada</p>}
        <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px] text-muted-foreground"><span>Consumo: {aeronave.consumo_combustivel ? `${horas(aeronave.consumo_combustivel)} L/H` : "—"}</span><span className="flex items-center gap-1 font-bold text-primary">Abrir <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span></div>
      </div>
    </button>
  );
}
