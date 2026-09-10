import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Check, Loader2, Mail, Paperclip, Search, Send, X } from "lucide-react";
import { buscarCentralEmail, buscarContasBancariasEmail, enviarEmailCliente, type ContaBancariaEmail, type ContatoEmail } from "@/lib/colaborador-api";

export type AnexoEmail = { id?: string; url?: string; label?: string; filename?: string };

type SendStatus = "idle" | "sending" | "sent";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  destinatarioInicial?: string | null;
  assuntoSugerido?: string;
  mensagemSugerida?: string;
  anexos?: AnexoEmail[];
};

const normalizarEmails = (valor: string) =>
  valor
    .split(/[;,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export function EnviarEmailClienteDialog({
  open,
  onOpenChange,
  onSent,
  destinatarioInicial = "",
  assuntoSugerido = "",
  mensagemSugerida = "",
  anexos = [],
}: Props) {
  const [destinatario, setDestinatario] = useState("");
  const [buscaContato, setBuscaContato] = useState("");
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [contas, setContas] = useState<ContaBancariaEmail[]>([]);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState<{ status: "sending" | "sent"; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setDestinatario(destinatarioInicial || "");
    setBuscaContato("");
    setAssunto(assuntoSugerido);
    setMensagem(mensagemSugerida);
    setStatus("idle");
    setErro("");
    setToast(null);
    void Promise.all([buscarCentralEmail(), buscarContasBancariasEmail()])
      .then(([central, bancos]) => {
        setContatos(central.contatos || []);
        setContas(bancos.contas || []);
      })
      .catch(() => setErro("Não foi possível carregar contatos e dados bancários."));
  }, [open, destinatarioInicial, assuntoSugerido, mensagemSugerida]);

  const contatosFiltrados = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo) return [];
    return contatos
      .filter((contato) => `${contato.nome} ${contato.email} ${contato.tipo}`.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [buscaContato, contatos]);

  const selecionarContato = (contato: ContatoEmail) => {
    const atuais = destinatario.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean);
    if (!atuais.some((email) => email.toLowerCase() === contato.email.toLowerCase())) {
      setDestinatario([...atuais, contato.email].join("; "));
    }
    setBuscaContato("");
  };

  const inserirBanco = (conta: ContaBancariaEmail) => {
    setMensagem((atual) => atual.trim() ? `${atual.trim()}\n\n${conta.texto}` : conta.texto);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status === "idle") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, status, onOpenChange]);

  const handleSend = async () => {
    if (status !== "idle") return;
    const destinatarios = normalizarEmails(destinatario);
    if (!destinatarios.length || !assunto.trim() || !mensagem.trim()) {
      setErro("Informe o destinatário, o assunto e a mensagem.");
      return;
    }
    setErro("");
    setStatus("sending");
    setToast({ status: "sending", message: "Enviando e-mail..." });
    try {
      await enviarEmailCliente({
        destinatarios,
        cc: [],
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
        anexos: anexos.filter((item) => item.id).map((item) => item.id!),
      });
      setStatus("sent");
      setToast({ status: "sent", message: "Enviado" });
      onSent?.();
      window.setTimeout(() => {
        setToast(null);
        setStatus("idle");
        onOpenChange(false);
      }, 1400);
    } catch (cause) {
      setStatus("idle");
      setToast(null);
      setErro(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.");
    }
  };

  if (!open) return null;

  const canSend = destinatario.trim() && assunto.trim() && mensagem.trim() && status === "idle";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true">
        <div className="modal-enter flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-[#0d1625] shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[.06] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                <Mail size={15} />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.16em] text-sky-400">Nova mensagem</p>
                <h2 className="text-sm font-bold text-white">Enviar por e-mail</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => status === "idle" && onOpenChange(false)}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">Para</label>
              <input
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="nome@empresa.com"
                disabled={status !== "idle"}
                className="h-10 w-full rounded-lg border border-white/[.06] bg-[#080f1d] px-3 text-xs text-white outline-none transition-colors placeholder:text-slate-700 focus:border-sky-500/40 disabled:opacity-50"
              />
              <div className="relative mt-2">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={buscaContato}
                  onChange={(e) => setBuscaContato(e.target.value)}
                  placeholder="Buscar cliente ou sócio holding..."
                  disabled={status !== "idle"}
                  className="h-8 w-full rounded-lg border border-white/[.06] bg-[#080f1d] pl-8 pr-3 text-[10px] text-slate-300 outline-none placeholder:text-slate-700 focus:border-sky-500/40 disabled:opacity-50"
                />
                {contatosFiltrados.length > 0 && <div className="absolute inset-x-0 top-9 z-10 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-white/[.08] bg-[#0d1625] p-1.5 shadow-xl">
                  {contatosFiltrados.map((contato) => <button key={`${contato.id}:${contato.email}`} type="button" onClick={() => selecionarContato(contato)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-sky-500/10">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-400"><Mail size={12} /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-slate-200">{contato.nome}</strong><span className="block truncate text-[9px] text-slate-500">{contato.email}</span></span>
                    <span className="shrink-0 text-[8px] uppercase text-slate-600">{contato.tipo === "socio" ? "Sócio holding" : "Cliente"}</span>
                  </button>)}
                </div>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">Assunto</label>
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Assunto da mensagem"
                disabled={status !== "idle"}
                className="h-10 w-full rounded-lg border border-white/[.06] bg-[#080f1d] px-3 text-xs text-white outline-none transition-colors placeholder:text-slate-700 focus:border-sky-500/40 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva sua mensagem..."
                disabled={status !== "idle"}
                className="min-h-[160px] w-full resize-y rounded-lg border border-white/[.06] bg-[#080f1d] px-3 py-2.5 text-xs leading-relaxed text-slate-300 outline-none transition-colors placeholder:text-slate-700 focus:border-sky-500/40 disabled:opacity-50 sm:min-h-[220px]"
              />
              <p className="mt-1 text-[10px] text-slate-600">A assinatura é adicionada no envio. Use os bancos abaixo para inserir os dados na mensagem.</p>
            </div>

            {contas.length > 0 && <div className="border-t border-white/[.06] pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500"><Building2 size={12} className="text-sky-400" /> Inserir banco</p>
              <div className="flex flex-wrap gap-2">
                {contas.map((conta) => <button key={conta.id} type="button" onClick={() => inserirBanco(conta)} disabled={status !== "idle"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.1] bg-[#0b1422] px-3 py-2 text-[10px] font-bold text-slate-300 transition-colors hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-white disabled:opacity-50"><Building2 size={12} className="text-sky-400" /> {conta.banco}</button>)}
              </div>
            </div>}

            {anexos.length > 0 && (
              <div className="space-y-1.5">
                {anexos.map((anexo) => (
                  <div
                    key={anexo.id || anexo.url}
                    className="flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/[.06] px-3 py-2.5"
                  >
                    <Paperclip size={14} className="shrink-0 text-sky-400" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">
                      {anexo.label || anexo.filename || "Documento"}
                    </span>
                    <span className="shrink-0 text-[9px] font-bold text-emerald-400">Anexo automático</span>
                  </div>
                ))}
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[.08] px-3 py-2.5 text-[11px] text-red-300">
                <AlertCircle size={14} className="mt-px shrink-0" />
                {erro}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/[.06] px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => status === "idle" && onOpenChange(false)}
              disabled={status !== "idle"}
              className="rounded-lg border border-white/[.08] px-4 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-[11px] font-bold text-white transition-all ${
                status === "sent"
                  ? "bg-emerald-600"
                  : status === "sending"
                  ? "bg-slate-600"
                  : canSend
                  ? "bg-[#22629d] hover:bg-[#2d79bb]"
                  : "cursor-not-allowed bg-slate-700 opacity-50"
              }`}
            >
              {status === "sending" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : status === "sent" ? (
                <Check size={13} />
              ) : (
                <Send size={13} />
              )}
              {status === "sending" ? "Enviando..." : status === "sent" ? "Enviado" : "Enviar"}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`toast-enter fixed bottom-4 left-4 right-4 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md ${
            toast.status === "sent"
              ? "toast-flash border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
              : "border-sky-400/20 bg-sky-500/15 text-sky-300"
          }`}
          role="status"
          onAnimationEnd={() => {
            if (toast.status === "sent") setToast(null);
          }}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full ${
              toast.status === "sent" ? "bg-emerald-500 text-white" : "bg-sky-500 text-white"
            }`}
          >
            {toast.status === "sent" ? <Check size={12} /> : <Loader2 size={11} className="animate-spin" />}
          </span>
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}
    </>
  );
}
