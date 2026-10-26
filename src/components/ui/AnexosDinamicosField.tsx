import { useCallback, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { cn } from "@/lib/utils";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";

export type AnexoTipoId = "comprovante" | "recibo" | "nf" | "boleto" | "demonstrativo" | "outro" | "comanda";
export interface AnexoLinha { id: string; tipo: AnexoTipoId; numero: string; url: string | null; file: File | null; storage_key?: string; cotista_id?: string; uploading?: boolean; }
const TIPOS: { id: AnexoTipoId; label: string }[] = [
  { id: "comprovante", label: "COMPROVANTE" }, { id: "recibo", label: "RECIBO" }, { id: "nf", label: "NOTA FISCAL" },
  { id: "boleto", label: "BOLETO" }, { id: "comanda", label: "COMANDA" }, { id: "demonstrativo", label: "DEMONSTRATIVO" }, { id: "outro", label: "OUTRO DOCUMENTO" },
];
export function anexoTipoLabel(id: AnexoTipoId) { return TIPOS.find((t) => t.id === id)?.label || id; }
interface Props { anexos: AnexoLinha[]; onChange: (next: AnexoLinha[]) => void; storagePrefix: string; bucket?: string; cotistas?: Array<{ id: string; label: string }>; uploadFile?: (file: File, id: string) => Promise<string | { url: string; key: string }>; className?: string; onView?: (url: string, name?: string, type?: "pdf" | "image") => void; }

export default function AnexosDinamicosField({ anexos, onChange, storagePrefix, bucket = "client-documents", cotistas = [], uploadFile, className, onView }: Props) {
  const anexosRef = useRef(anexos);
  useEffect(() => { anexosRef.current = anexos; }, [anexos]);
  const updateLinha = useCallback((id: string, patch: Partial<AnexoLinha>) => { const next = anexosRef.current.map((a) => a.id === id ? { ...a, ...patch } : a); anexosRef.current = next; onChange(next); }, [onChange]);
  const removeLinha = (id: string) => { const next = anexosRef.current.filter((a) => a.id !== id); anexosRef.current = next; onChange(next); };
  const addLinha = () => { const next = [...anexosRef.current, { id: crypto.randomUUID(), tipo: "comprovante" as AnexoTipoId, numero: "", url: null, file: null, uploading: false }]; anexosRef.current = next; onChange(next); };
  const handleFile = async (id: string, file: File | null) => {
    if (!file) { updateLinha(id, { file: null, url: null, storage_key: undefined }); return; }
    updateLinha(id, { file, uploading: true });
    try {
      let url: string;
      let storageKey: string | undefined;
      if (uploadFile) {
        const uploaded = await uploadFile(file, id);
        if (typeof uploaded === "string") url = uploaded;
        else { url = uploaded.url; storageKey = uploaded.key; }
      }
      else {
        const { supabase } = await import("@/lib/supabase");
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${storagePrefix}/${id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw error;
        url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
      updateLinha(id, { url, storage_key: storageKey, uploading: false });
    } catch (error: any) { toast.error(`Erro no upload: ${error?.message || error}`); updateLinha(id, { uploading: false, file: null }); }
  };
  return <div className={cn("w-full min-w-0 space-y-2", className)}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Documentos e anexos</span></div><Button type="button" variant="outline" size="sm" onClick={addLinha} className="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs"><Plus className="h-3.5 w-3.5" /> Adicionar arquivo</Button></div>
    {!anexos.length && <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">Nenhum anexo adicionado.</div>}
    <div className="w-full min-w-0 space-y-2">{anexos.map((a) => <div key={a.id} className="w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/50 p-3 shadow-sm sm:p-3"><div className={cn("grid w-full min-w-0 grid-cols-1 items-stretch gap-3", cotistas.length > 0 ? "sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto]" : "sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]")}>
      <div className="min-w-0 w-full"><SearchableCombobox items={TIPOS} value={a.tipo} onChange={(id) => updateLinha(a.id, { tipo: (id as AnexoTipoId) || "outro" })} placeholder="Tipo..." searchPlaceholder="Buscar tipo..." className="h-10 w-full text-sm lg:h-9" /></div>
      {cotistas.length > 0 && <div className="w-full min-w-0"><SearchableCombobox items={cotistas} value={a.cotista_id || ""} onChange={(id) => updateLinha(a.id, { cotista_id: id || undefined })} placeholder="Cotista..." searchPlaceholder="Buscar cotista..." className="h-10 w-full text-sm lg:h-9" /></div>}
      <input value={a.numero} onChange={(e) => updateLinha(a.id, { numero: e.target.value })} placeholder="Nº do documento (opcional)" className="h-10 w-full min-w-0 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/60 lg:h-9" />
      <div className="w-full min-w-0"><AnexosDinamicos file={a.file} onFileChange={(file) => void handleFile(a.id, file)} uploading={Boolean(a.uploading)} existingUrl={a.url} onView={onView} label="Arquivo" compact className="w-full min-w-0" /></div>
      <div className="flex min-w-0 items-end justify-end sm:pb-0.5"><Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(a.id)} className="h-8 w-8 shrink-0 text-rose-500" title="Remover linha" aria-label="Remover anexo"><Trash2 className="h-4 w-4" /></Button></div>
    </div></div>)}</div>
  </div>;
}
