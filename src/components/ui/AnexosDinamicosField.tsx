import { useCallback, useEffect, useRef } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export type AnexoTipoId = "comprovante" | "recibo" | "nf" | "boleto" | "demonstrativo" | "outro" | "comanda";
export interface AnexoLinha { id: string; tipo: AnexoTipoId; numero: string; url: string | null; file: File | null; uploading?: boolean; }
const TIPOS: { id: AnexoTipoId; label: string }[] = [
  { id: "comprovante", label: "COMPROVANTE" }, { id: "recibo", label: "RECIBO" }, { id: "nf", label: "NOTA FISCAL" },
  { id: "boleto", label: "BOLETO" }, { id: "comanda", label: "COMANDA" }, { id: "demonstrativo", label: "DEMONSTRATIVO" }, { id: "outro", label: "OUTRO DOCUMENTO" },
];
export function anexoTipoLabel(id: AnexoTipoId) { return TIPOS.find((t) => t.id === id)?.label || id; }
function humanSize(bytes: number) { if (!bytes) return ""; const kb = bytes / 1024; return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`; }
interface Props { anexos: AnexoLinha[]; onChange: (next: AnexoLinha[]) => void; storagePrefix: string; bucket?: string; className?: string; onView?: (url: string, name?: string, type?: "pdf" | "image") => void; }

export default function AnexosDinamicosField({ anexos, onChange, storagePrefix, bucket = "client-documents", className, onView }: Props) {
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const anexosRef = useRef(anexos);
  useEffect(() => { anexosRef.current = anexos; }, [anexos]);
  const updateLinha = useCallback((id: string, patch: Partial<AnexoLinha>) => { const next = anexosRef.current.map((a) => a.id === id ? { ...a, ...patch } : a); anexosRef.current = next; onChange(next); }, [onChange]);
  const removeLinha = (id: string) => { const next = anexosRef.current.filter((a) => a.id !== id); anexosRef.current = next; onChange(next); };
  const addLinha = () => { const next = [...anexosRef.current, { id: crypto.randomUUID(), tipo: "comprovante" as AnexoTipoId, numero: "", url: null, file: null, uploading: false }]; anexosRef.current = next; onChange(next); };
  const handleFile = async (id: string, file: File) => {
    updateLinha(id, { file, uploading: true });
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${storagePrefix}/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      updateLinha(id, { url, uploading: false });
    } catch (error: any) { toast.error(`Erro no upload: ${error?.message || error}`); updateLinha(id, { uploading: false, file: null }); }
  };
  return <div className={cn("space-y-3", className)}>
    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Documentos anexos</span><Button type="button" variant="outline" size="sm" onClick={addLinha} className="h-8 gap-1.5 rounded-lg text-xs"><Plus className="h-3.5 w-3.5" /> Adicionar anexo</Button></div>
    {!anexos.length && <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">Nenhum anexo adicionado.</div>}
    <div className="space-y-2">{anexos.map((a) => <div key={a.id} className="rounded-xl border border-border/60 bg-card/40 p-3"><div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[160px_1fr_auto_auto]">
      <SearchableCombobox items={TIPOS} value={a.tipo} onChange={(id) => updateLinha(a.id, { tipo: (id as AnexoTipoId) || "outro" })} placeholder="Tipo..." searchPlaceholder="Buscar tipo..." />
      <Input value={a.numero} inputMode="numeric" onChange={(e) => updateLinha(a.id, { numero: e.target.value })} placeholder="Número do documento" className="h-9 rounded-lg text-sm" />
      <div className="flex min-w-[160px] items-center gap-2"><input ref={(el) => { inputsRef.current[a.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(a.id, file); e.currentTarget.value = ""; }} />{a.uploading ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</span> : a.url ? <button type="button" onClick={() => onView?.(a.url!, a.file?.name, a.url!.toLowerCase().split(".").pop() === "pdf" ? "pdf" : "image")} className="flex max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.file?.name || "Ver arquivo"}</span><ExternalLink className="h-3 w-3 shrink-0" /></button> : <Button type="button" variant="outline" size="sm" onClick={() => inputsRef.current[a.id]?.click()} className="h-9 w-full gap-1.5 rounded-lg text-xs"><Upload className="h-3.5 w-3.5" /> Enviar arquivo</Button>}</div>
      <Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(a.id)} className="h-9 w-9 rounded-lg text-rose-500" title="Remover linha"><Trash2 className="h-4 w-4" /></Button>
    </div>{a.file && !a.uploading && <div className="mt-1.5 flex items-center gap-1.5 pl-1 text-[10px] text-muted-foreground"><FileText className="h-3 w-3" /><span className="truncate">{a.file.name}</span><span>· {humanSize(a.file.size)}</span></div>}</div>)}</div>
  </div>;
}
