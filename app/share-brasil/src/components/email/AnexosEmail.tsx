import { Check, FileText, Paperclip } from "lucide-react";
import type { AnexoEmail } from "@/lib/colaborador-api";

type Props = { anexos: AnexoEmail[]; selecionados: string[]; onAlternar: (id: string) => void };

export function AnexosEmail({ anexos, selecionados, onAlternar }: Props) {
  return <div className="space-y-2">
    {anexos.length === 0 ? <div className="border border-dashed border-border p-5 text-center"><Paperclip size={18} className="mx-auto text-muted-foreground" /><p className="mt-2 text-[11px] text-muted-foreground">Nenhum documento disponível para vincular.</p></div> : anexos.map((anexo) => {
      const marcado = selecionados.includes(anexo.id);
      return <button key={anexo.id} type="button" onClick={() => onAlternar(anexo.id)} className={`flex w-full items-center gap-3 border p-3 text-left transition-colors ${marcado ? "border-primary/60 bg-primary/[.08]" : "border-border bg-secondary/[.12] hover:border-primary/35"}`} aria-pressed={marcado}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${marcado ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground"}`}>{marcado ? <Check size={15} /> : <FileText size={15} />}</span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{anexo.nome}</strong><span className="mt-0.5 block truncate text-[9px] text-muted-foreground">{anexo.origem} · {anexo.tipo_arquivo || "Documento"}</span></span>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{marcado ? "Incluído" : "Adicionar"}</span>
      </button>;
    })}
  </div>;
}
