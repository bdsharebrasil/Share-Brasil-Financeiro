import { useRef } from "react";
import { Check, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import type { AnexoEmail } from "@/lib/colaborador-api";

type Props = {
  anexos: AnexoEmail[];
  selecionados: string[];
  onAlternar: (id: string) => void;
  arquivosNovos?: File[];
  onAdicionarArquivos?: (arquivos: File[]) => void;
  onRemoverArquivo?: (index: number) => void;
};

export function AnexosEmail({ anexos, selecionados, onAlternar, arquivosNovos = [], onAdicionarArquivos, onRemoverArquivo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length && onAdicionarArquivos) onAdicionarArquivos(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  return <div className="space-y-3">
    {anexos.length === 0 && arquivosNovos.length === 0 ? <div className="border border-dashed border-border p-5 text-center"><Paperclip size={18} className="mx-auto text-muted-foreground" /><p className="mt-2 text-[11px] text-muted-foreground">Nenhum documento disponível para vincular.</p></div> : null}

    {anexos.length > 0 && (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Documentos existentes</p>
        {anexos.map((anexo) => {
          const marcado = selecionados.includes(anexo.id);
          return <button key={anexo.id} type="button" onClick={() => onAlternar(anexo.id)} className={`flex w-full items-center gap-3 border p-3 text-left transition-colors ${marcado ? "border-primary/60 bg-primary/[.08]" : "border-border bg-secondary/[.12] hover:border-primary/35"}`} aria-pressed={marcado}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${marcado ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground"}`}>{marcado ? <Check size={15} /> : <FileText size={15} />}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{anexo.nome}</strong><span className="mt-0.5 block truncate text-[9px] text-muted-foreground">{anexo.origem} · {anexo.tipo_arquivo || "Documento"}</span></span>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{marcado ? "Incluído" : "Adicionar"}</span>
          </button>;
        })}
      </div>
    )}

    {arquivosNovos.length > 0 && (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Novos arquivos</p>
        {arquivosNovos.map((arquivo, index) => (
          <div key={`${arquivo.name}-${index}`} className="flex w-full items-center gap-3 border border-primary/40 bg-primary/[.06] p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/50 bg-primary/15 text-primary"><FileText size={15} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{arquivo.name}</strong><span className="mt-0.5 block truncate text-[9px] text-muted-foreground">{(arquivo.size / 1024).toFixed(0)} KB</span></span>
            {onRemoverArquivo && <button type="button" onClick={() => onRemoverArquivo(index)} className="shrink-0 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
    )}

    {onAdicionarArquivos && (
      <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 border border-dashed border-border p-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
        <Plus size={14} /> Anexar novo arquivo
      </button>
    )}
    <input ref={inputRef} type="file" multiple onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt" />
  </div>;
}
