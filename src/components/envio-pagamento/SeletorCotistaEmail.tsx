import { ArrowRight, CheckCircle2, Loader2, Mail, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DestinatarioEnvio = {
  id: string;
  nome: string;
  email: string;
  anexos: number;
  enviado: boolean;
  indisponivel: boolean;
};

export function SeletorCotistaEmail({ open, onOpenChange, destinatarios, preparandoId, carregando, erro, sucesso, onSelecionar }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinatarios: DestinatarioEnvio[];
  preparandoId: string | null;
  carregando: boolean;
  erro: string;
  sucesso: string;
  onSelecionar: (id: string) => void;
}) {
  const pendentes = destinatarios.filter((item) => !item.enviado && !item.indisponivel).length;
  return <Dialog open={open} onOpenChange={(aberto) => { if (!preparandoId) onOpenChange(aberto); }}>
    <DialogContent className="despesas-theme envio-cotista-selector">
      <DialogHeader>
        <span className="envio-seletor-kicker"><Mail size={14} /> ENVIO DE DOCUMENTOS</span>
        <DialogTitle>Para qual cotista deseja enviar?</DialogTitle>
        <DialogDescription>Escolha o cotista para revisar a mensagem, os documentos e a prévia do e-mail.</DialogDescription>
      </DialogHeader>
      {erro && <p role="alert" className="envio-aviso envio-aviso-erro">{erro}</p>}
      {sucesso && <p role="status" className="envio-aviso envio-aviso-sucesso">{sucesso}</p>}
      <div className="envio-destinatarios" aria-busy={carregando || Boolean(preparandoId)}>
        {carregando ? <p className="envio-seletor-vazio"><Loader2 size={18} className="animate-spin" /> Carregando destinatários…</p> : destinatarios.map((item) => <button
          type="button" key={item.id} className="envio-destinatario" disabled={Boolean(preparandoId) || item.enviado || item.indisponivel}
          onClick={() => onSelecionar(item.id)} aria-label={`Revisar e-mail para ${item.nome}`} data-enviado={item.enviado}
        >
          <span className="envio-destinatario-avatar" aria-hidden="true">{item.nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("")}</span>
          <span className="envio-destinatario-dados"><strong>{item.nome}</strong><span>{item.email || "Informe o e-mail na próxima tela"}</span><small><Paperclip size={12} /> {item.anexos} documento(s){item.indisponivel && " · Sem documentos para este cotista"}</small></span>
          <span className="envio-destinatario-estado">{preparandoId === item.id ? <Loader2 size={16} className="animate-spin" /> : item.enviado ? <><CheckCircle2 size={15} /> Enviado</> : <ArrowRight size={17} />}</span>
        </button>)}
        {!carregando && !destinatarios.length && <p className="envio-seletor-vazio">Nenhum cotista disponível. Retome a solicitação e confira os vínculos da aeronave.</p>}
      </div>
      <footer className="envio-seletor-footer"><span>{pendentes} cotista(s) pendente(s)</span><button type="button" onClick={() => onOpenChange(false)} disabled={Boolean(preparandoId)}>Continuar depois</button></footer>
    </DialogContent>
  </Dialog>;
}
