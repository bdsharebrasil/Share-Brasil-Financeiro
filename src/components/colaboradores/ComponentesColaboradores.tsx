import { useEffect, useState, type ReactNode } from "react";
import { carregarFotoGestao } from "@/lib/colaborador-api";
import { AlertCircle, CheckCircle2, Users, X } from "lucide-react";
import { iniciais } from "@/lib/gestao-colaboradores";

export function AvatarColaborador({
  nome,
  url,
  colaboradorId,
  grande = false,
}: {
  nome: string;
  url?: string | null;
  colaboradorId?: string;
  grande?: boolean;
}) {
  const [foto, setFoto] = useState("");
  useEffect(() => {
    let ativo = true;
    let objectUrl = "";
    setFoto("");
    if (!url || !colaboradorId) return;
    void carregarFotoGestao(colaboradorId)
      .then((blob) => {
        if (!ativo) return;
        objectUrl = URL.createObjectURL(blob);
        setFoto(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, colaboradorId]);
  return (
    <span
      className={`rh-avatar ${grande ? "rh-avatar-lg" : ""}`}
      aria-hidden="true"
    >
      {foto ? <img src={foto} alt="" onError={() => setFoto("")} /> : null}
      <span>{iniciais(nome)}</span>
    </span>
  );
}
export function StatusColaborador({
  children,
  tom = "verde",
}: {
  children: ReactNode;
  tom?: "verde" | "ambar" | "neutro" | "vermelho" | "azul";
}) {
  return (
    <span className={`rh-status rh-status-${tom}`}>
      <span />
      {children}
    </span>
  );
}
export function AvisoGestao({
  children,
  erro = false,
  onClose,
}: {
  children: ReactNode;
  erro?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={`rh-aviso ${erro ? "rh-aviso-erro" : ""}`}
      role={erro ? "alert" : "status"}
    >
      {erro ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Fechar mensagem">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function VazioColaboradores({
  titulo,
  detalhe,
  acao,
}: {
  titulo: string;
  detalhe?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="rh-vazio">
      <span className="rh-vazio-icon">
        <Users size={25} />
      </span>
      <h3>{titulo}</h3>
      {detalhe && <p>{detalhe}</p>}
      {acao}
    </div>
  );
}
export function DadoFicha({
  titulo,
  valor,
}: {
  titulo: string;
  valor?: ReactNode;
}) {
  return (
    <div className="rh-dado">
      <dt>{titulo}</dt>
      <dd>{valor || "—"}</dd>
    </div>
  );
}
