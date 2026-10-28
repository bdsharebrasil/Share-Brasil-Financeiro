import { useEffect, useId, useRef, type ReactNode } from "react";
import { FileText, Upload, X } from "lucide-react";
import "./agenda-contatos.css";

export type CategoriaAnexo = { value: string; label: string };

type Props = {
  arquivo: File | undefined;
  aoSelecionar: (arquivo: File | undefined) => void;
  aoEnviar: () => void | Promise<void>;
  enviando?: boolean;
  desabilitado?: boolean;
  accept?: string;
  label?: string;
  categorias?: readonly CategoriaAnexo[];
  categoria?: string;
  aoMudarCategoria?: (categoria: string) => void;
  erro?: string | null;
  dica?: ReactNode;
};

/** Não faz requisições: utiliza os callbacks e as regras do backend existente. */
export function LinhaAnexo({
  arquivo, aoSelecionar, aoEnviar, enviando = false, desabilitado = false,
  accept, label = "Arquivo", categorias, categoria, aoMudarCategoria, erro, dica,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const bloqueado = enviando || desabilitado;
  const temCategoria = Boolean(categorias?.length);

  useEffect(() => {
    if (!arquivo && inputRef.current) inputRef.current.value = "";
  }, [arquivo]);

  async function enviar() {
    if (!arquivo || bloqueado || lock.current) return;
    lock.current = true;
    try { await aoEnviar(); } finally { lock.current = false; }
  }

  return (
    <div className="ac-upload" aria-busy={enviando}>
      <div className="ac-upload-row" data-category={temCategoria}>
        {temCategoria && (
          <label className="ac-field" htmlFor={`${id}-categoria`}>
            <span>Categoria do documento</span>
            <select id={`${id}-categoria`} className="ac-control" value={categoria ?? ""}
              disabled={bloqueado} onChange={(e) => aoMudarCategoria?.(e.target.value)}>
              {categorias?.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        )}
        <div className="ac-field">
          <span id={`${id}-label`}>{label}</span>
          <label className="ac-file" data-disabled={bloqueado} htmlFor={`${id}-arquivo`}>
            <FileText size={17} aria-hidden="true" />
            <span className="ac-file-name" title={arquivo?.name} aria-live="polite">
              {arquivo?.name || "Selecionar arquivo"}
            </span>
            <input ref={inputRef} id={`${id}-arquivo`} className="ac-sr-only" type="file"
              accept={accept} disabled={bloqueado} aria-labelledby={`${id}-label`}
              aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
              aria-invalid={Boolean(erro)}
              onClick={(e) => { e.currentTarget.value = ""; }}
              onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) aoSelecionar(file); }} />
          </label>
        </div>
        <div className="ac-upload-actions">
          <button type="button" className="ac-btn ac-btn--primary" disabled={!arquivo || bloqueado}
            onClick={() => void enviar()}><Upload size={16} aria-hidden="true" />{enviando ? "Enviando…" : "Anexar arquivo"}</button>
          {arquivo && <button type="button" className="ac-btn" disabled={bloqueado}
            onClick={() => aoSelecionar(undefined)}><X size={15} aria-hidden="true" />Limpar</button>}
        </div>
        {dica && <div id={`${id}-dica`} className="ac-upload-hint">{dica}</div>}
        {erro && <div id={`${id}-erro`} className="ac-upload-hint ac-notice ac-notice--error" role="alert">{erro}</div>}
      </div>
    </div>
  );
}
