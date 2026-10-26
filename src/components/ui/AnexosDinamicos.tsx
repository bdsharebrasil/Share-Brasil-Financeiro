import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AnexosDinamicosProps {
  file?: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  uploading?: boolean;
  existingName?: string | null;
  existingUrl?: string | null;
  onView?: (url: string, name?: string, type?: "pdf" | "image") => void;
  className?: string;
  name?: string;
  compact?: boolean;
  maxSizeMb?: number;
}

const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

function humanSize(bytes: number) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function fileType(url: string) {
  return url.toLowerCase().split("?")[0].endsWith(".pdf") ? "pdf" as const : "image" as const;
}

export default function AnexosDinamicos({
  file = null,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  label = "Anexo",
  description = "PDF, JPG, PNG ou WEBP",
  disabled = false,
  uploading = false,
  existingName,
  existingUrl,
  onView,
  className,
  name,
  compact = false,
  maxSizeMb = 10,
}: AnexosDinamicosProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFile = (candidate?: File | null) => {
    if (!candidate) return;
    if (candidate.size > maxSizeMb * 1024 * 1024) {
      setError(`O arquivo deve ter no máximo ${maxSizeMb} MB.`);
      return;
    }
    setError(null);
    onFileChange(candidate);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
    event.currentTarget.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled && !uploading) selectFile(event.dataTransfer.files?.[0]);
  };

  const shownName = file?.name || existingName;
  const hasExisting = !file && Boolean(existingUrl);

  return (
    <div className={cn("w-full min-w-0 space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">
            <Paperclip size={12} className="text-primary" /> {label}
          </p>
          {!compact && <p className="mt-0.5 text-[10px] text-muted-foreground">{description} · até {maxSizeMb} MB</p>}
        </div>
        {(file || hasExisting) && !uploading && !disabled && (
          <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); onFileChange(null); }} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remover ${label}`}>
            <X size={14} />
          </Button>
        )}
      </div>

      <input ref={inputRef} name={name} type="file" accept={accept} disabled={disabled || uploading} onChange={onInputChange} className="sr-only" />
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !disabled && !uploading) inputRef.current?.click(); }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled && !uploading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 transition-all",
          dragging ? "border-primary bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/.12)]" : "border-border/70 bg-background/35 hover:border-primary/60 hover:bg-primary/[.04]",
          (disabled || uploading) && "cursor-not-allowed opacity-60",
          compact && "min-h-[54px] w-full min-w-0 px-3",
        )}
      >
        {uploading ? <Loader2 className="shrink-0 animate-spin text-primary" size={20} /> : hasExisting ? <CheckCircle2 className="shrink-0 text-emerald-400" size={20} /> : file ? <FileText className="shrink-0 text-primary" size={20} /> : <UploadCloud className="shrink-0 text-primary" size={22} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{uploading ? "Enviando arquivo..." : shownName || "Arraste o arquivo aqui ou clique para selecionar"}</p>
          {!uploading && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{file ? `${humanSize(file.size)} · clique para substituir` : hasExisting ? "Arquivo já anexado · clique para substituir" : description}</p>}
        </div>
        {!uploading && !shownName && <span className="hidden rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-primary sm:inline-flex">Selecionar</span>}
        {hasExisting && existingUrl && onView && <Button type="button" variant="ghost" onClick={(event) => { event.stopPropagation(); onView(existingUrl, existingName || undefined, fileType(existingUrl)); }} className="h-8 shrink-0 px-2 text-[10px] text-primary">Visualizar</Button>}
        {file && <ImageIcon size={14} className="shrink-0 text-muted-foreground" />}
      </div>
      {error && <p className="text-[10px] font-medium text-destructive">{error}</p>}
    </div>
  );
}
