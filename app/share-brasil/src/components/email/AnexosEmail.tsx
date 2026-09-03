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

export function AnexosEmail({
  anexos,
  selecionados,
  onAlternar,
  arquivosNovos = [],
  onAdicionarArquivos,
  onRemoverArquivo,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length && onAdicionarArquivos) onAdicionarArquivos(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {anexos.length === 0 && arquivosNovos.length === 0 && (
        <div className="border border-dashed border-border/60 p-4 text-center rounded-xl">
          <Paperclip size={16} className="mx-auto text-muted-foreground/60" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Nenhum documento disponível.
          </p>
        </div>
      )}

      {anexos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Documentos existentes
          </p>
          {anexos.map((anexo) => {
            const marcado = selecionados.includes(anexo.id);
            return (
              <button
                key={anexo.id}
                type="button"
                onClick={() => onAlternar(anexo.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  marcado
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-card/30 hover:bg-muted/50"
                }`}
                aria-pressed={marcado}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background">
                  {marcado ? <Check size={13} /> : <FileText size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold">
                    {anexo.nome}
                  </strong>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {anexo.origem} · {anexo.tipo_arquivo || "Documento"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {arquivosNovos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Novos arquivos
          </p>
          {arquivosNovos.map((arquivo, index) => (
            <div
              key={`${arquivo.name}-${index}`}
              className="flex w-full items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/5 p-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <FileText size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">
                  {arquivo.name}
                </strong>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {(arquivo.size / 1024).toFixed(0)} KB
                </span>
              </span>
              {onRemoverArquivo && (
                <button
                  type="button"
                  onClick={() => onRemoverArquivo(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onAdicionarArquivos && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus size={14} /> Anexar novo arquivo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
      />
    </div>
  );
}