import { useCallback, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { cn } from "@/lib/utils";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";

export type AnexoTipoId = "comprovante" | "recibo" | "nf" | "boleto" | "demonstrativo" | "outro" | "comanda";
export interface AnexoLinha { id: string; tipo: AnexoTipoId; numero: string; url: string | null; file: File | null; cotista_id?: string; uploading?: boolean; }
const TIPOS: { id: AnexoTipoId; label: string }[] = [
  { id: "comprovante", label: "COMPROVANTE" }, { id: "recibo", label: "RECIBO" }, { id: "nf", label: "NOTA FISCAL" },
  { id: "boleto", label: "BOLETO" }, { id: "comanda", label: "COMANDA" }, { id: "demonstrativo", label: "DEMONSTRATIVO" }, { id: "outro", label: "OUTRO DOCUMENTO" },
];
export function anexoTipoLabel(id: AnexoTipoId) { return TIPOS.find((t) => t.id === id)?.label || id; }
interface Props { anexos: AnexoLinha[]; onChange: (next: AnexoLinha[]) => void; storagePrefix: string; bucket?: string; cotistas?: Array<{ id: string; label: string }>; uploadFile?: (file: File, id: string) => Promise<string>; className?: string; onView?: (url: string, name?: string, type?: "pdf" | "image") => void; }

export default function AnexosDinamicosField({ anexos, onChange, storagePrefix, bucket = "client-documents", cotistas = [], uploadFile, className, onView }: Props) {
  const anexosRef = useRef(anexos);
  useEffect(() => { anexosRef.current = anexos; }, [anexos]);
  const updateLinha = useCallback((id: string, patch: Partial<AnexoLinha>) => { const next = anexosRef.current.map((a) => a.id === id ? { ...a, ...patch } : a); anexosRef.current = next; onChange(next); }, [onChange]);
  const removeLinha = (id: string) => { const next = anexosRef.current.filter((a) => a.id !== id); anexosRef.current = next; onChange(next); };
  const addLinha = () => { const next = [...anexosRef.current, { id: crypto.randomUUID(), tipo: "comprovante" as AnexoTipoId, numero: "", url: null, file: null, uploading: false }]; anexosRef.current = next; onChange(next); };
  const handleFile = async (id: string, file: File | null) => {
    if (!file) { updateLinha(id, { file: null, url: null }); return; }
    updateLinha(id, { file, uploading: true });
    try {
      let url: string;
      if (uploadFile) url = await uploadFile(file, id);
      else {
        const { supabase } = await import("@/lib/supabase");
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${storagePrefix}/${id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw error;
        url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
      updateLinha(id, { url, uploading: false });
    } catch (error: any) { toast.error(`Erro no upload: ${error?.message || error}`); updateLinha(id, { uploading: false, file: null }); }
  };
  return <div className={cn("space-y-3", className)}>
    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Documentos anexos</span><Button type="button" variant="outline" size="sm" onClick={addLinha} className="h-8 gap-1.5 rounded-lg text-xs"><Plus className="h-3.5 w-3.5" /> Adicionar anexo</Button></div>
    {!anexos.length && <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">Nenhum anexo adicionado.</div>}
    <div className="space-y-2">{anexos.map((a) => <div key={a.id} className="rounded-xl border border-border/60 bg-card/40 p-3"><div className={cn("grid grid-cols-1 items-start gap-3", cotistas.length ? "lg:grid-cols-[160px_1fr_190px_minmax(250px,1.3fr)_auto]" : "lg:grid-cols-[160px_1fr_minmax(250px,1.3fr)_auto")}>
      <SearchableCombobox items={TIPOS} value={a.tipo} onChange={(id) => updateLinha(a.id, { tipo: (id as AnexoTipoId) || "outro" })} placeholder="Tipo..." searchPlaceholder="Buscar tipo..." />
      <input value={a.numero} inputMode="numeric" onChange={(e) => updateLinha(a.id, { numero: e.target.value })} placeholder="Número do documento" className="h-9 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/60" />
      {cotistas.length > 0 && <SearchableCombobox items={cotistas} value={a.cotista_id || ""} onChange={(id) => updateLinha(a.id, { cotista_id: id })} placeholder="Cotista do anexo..." searchPlaceholder="Buscar cotista..." />}
      <AnexosDinamicos file={a.file} onFileChange={(file) => void handleFile(a.id, file)} uploading={Boolean(a.uploading)} existingUrl={a.url} onView={onView} label="Arquivo" />
      <Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(a.id)} className="h-9 w-9 text-rose-500" title="Remover linha"><Trash2 className="h-4 w-4" /></Button>
    </div></div>)}</div>
  </div>;
}
