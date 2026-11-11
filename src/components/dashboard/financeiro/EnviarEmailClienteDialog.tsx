import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Building2, Check, ChevronDown, Eye, Mail, Paperclip, Pencil, Search, Send, X } from "lucide-react";
import {
  buscarCentralEmail, buscarContasBancariasEmail, enviarEmailCliente,
  type ContaBancariaEmail, type ContatoEmail,
} from "@/lib/colaborador-api";
import { gerarEmailClienteHtml } from "@/lib/email-cliente-template";

export type RascunhoEmailCliente = { destinatario: string; assunto: string; mensagem: string };

export type AnexoEmail = { id?: string; url?: string; label?: string; filename?: string };

type SendStatus = "idle" | "sending" | "sent";
type Tema = "light" | "dark";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (emailId: string) => void;
  destinatarioInicial?: string | null;
  assuntoSugerido?: string;
  mensagemSugerida?: string;
  anexos?: AnexoEmail[];
  referencias?: string[];
  anexosDisponiveis?: AnexoEmail[];
  onAnexosChange?: (ids: string[]) => void;
  exigirAnexo?: boolean;
  onDraftChange?: (rascunho: RascunhoEmailCliente) => void;
  envioExtra?: Partial<Pick<Parameters<typeof enviarEmailCliente>[0], "rascunho_id" | "cotista_id" | "idempotency_key" | "nome_destinatario" | "arquivos_persistidos">>;
  /** Usado apenas na prévia. A identidade do envio é definida pelo backend. */
  nomeEmpresa?: string;
};

export const normalizarEmails = (valor: string): string[] => Array.from(new Set(
  valor.split(/[;,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
));

// Validação prática para endereços simples; a validação definitiva pertence ao servidor.
const emailValido = (email: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";

/* ------------------------------------------------------------------ */
/* Tema: segue a classe/atributo do app (.dark, data-theme) e, na      */
/* ausência deles, a preferência do sistema operacional.               */
/* ------------------------------------------------------------------ */
function lerTema(): Tema {
  if (typeof document === "undefined") return "light";
  for (const el of [document.documentElement, document.body]) {
    if (el.classList.contains("dark") || el.dataset.theme === "dark") return "dark";
    if (el.classList.contains("light") || el.dataset.theme === "light") return "light";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTema(): Tema {
  const [tema, setTema] = useState<Tema>(lerTema);
  useEffect(() => {
    const atualizar = () => setTema(lerTema());
    const observador = new MutationObserver(atualizar);
    const opcoes = { attributes: true, attributeFilter: ["class", "data-theme"] };
    observador.observe(document.documentElement, opcoes);
    observador.observe(document.body, opcoes);
    const midia = window.matchMedia?.("(prefers-color-scheme: dark)");
    midia?.addEventListener("change", atualizar);
    atualizar();
    return () => { observador.disconnect(); midia?.removeEventListener("change", atualizar); };
  }, []);
  return tema;
}

/* ------------------------------------------------------------------ */
/* Estilos (escopados em .ec-root). Tokens por tema + responsividade.  */
/* ------------------------------------------------------------------ */
const CSS = `
/* Tokens ligados às variáveis do tema do app (index.css): mudam sozinhos com .dark */
.ec-root{
  --ec-overlay:rgba(8,14,22,.55);
  --ec-surface:hsl(var(--card)); --ec-canvas:hsl(var(--muted)); --ec-field:hsl(var(--secondary) / .4);
  --ec-border:hsl(var(--border)); --ec-border-strong:hsl(var(--input));
  --ec-text:hsl(var(--foreground)); --ec-muted:hsl(var(--muted-foreground)); --ec-faint:hsl(var(--muted-foreground) / .8);
  --ec-primary:hsl(var(--primary)); --ec-primary-hover:hsl(var(--primary) / .88); --ec-on-primary:hsl(var(--primary-foreground));
  --ec-primary-soft:hsl(var(--primary) / .12); --ec-ring:hsl(var(--ring) / .3);
  --ec-danger:hsl(var(--destructive)); --ec-danger-soft:hsl(var(--destructive) / .1); --ec-danger-border:hsl(var(--destructive) / .35);
  --ec-warn:#7a5a14; --ec-warn-soft:hsl(var(--chart-3) / .14); --ec-warn-border:hsl(var(--chart-3) / .4);
  --ec-ok:hsl(var(--accent)); --ec-on-ok:hsl(var(--accent-foreground)); --ec-hover:hsl(var(--secondary));
  --ec-shadow:0 24px 64px rgba(16,28,44,.22), 0 2px 6px rgba(16,28,44,.08);
}
.ec-root[data-tema="dark"]{
  --ec-overlay:rgba(2,6,12,.66);
  --ec-warn:hsl(var(--chart-3));
  --ec-shadow:0 24px 64px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02);
}
.ec-root, .ec-root *{box-sizing:border-box}
.ec-root{
  position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center;
  padding:20px; background:var(--ec-overlay); color:var(--ec-text);
  font-family:Inter,"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
  font-size:14px; line-height:22px; -webkit-font-smoothing:antialiased;
  color-scheme:light;
}
.ec-root[data-tema="dark"]{color-scheme:dark}
.ec-dialog{
  display:flex; flex-direction:column; width:100%; max-width:760px; min-width:0;
  max-height:calc(100dvh - 40px); background:var(--ec-surface);
  border:1px solid var(--ec-border); border-radius:10px; box-shadow:var(--ec-shadow); overflow:hidden;
}
.ec-dialog:focus{outline:none}
.ec-form{display:flex; flex-direction:column; min-height:0; margin:0}

.ec-header{
  display:flex; align-items:center; gap:14px; padding:18px 28px;
  border-bottom:1px solid var(--ec-border); flex-shrink:0;
}
.ec-header-icon{
  display:grid; place-items:center; width:40px; height:40px; flex-shrink:0;
  border-radius:8px; background:var(--ec-primary-soft); color:var(--ec-primary);
}
.ec-header-text{min-width:0; flex:1}
.ec-title{margin:0; font-size:18px; line-height:26px; font-weight:650; letter-spacing:-.01em}
.ec-subtitle{margin:0; font-size:13px; line-height:20px; color:var(--ec-muted)}

.ec-btn{
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  min-height:42px; padding:9px 18px; border-radius:6px; border:1px solid var(--ec-border-strong);
  background:var(--ec-surface); color:var(--ec-text); font:inherit; font-size:14px; font-weight:600;
  cursor:pointer; text-decoration:none; transition:background-color .15s, border-color .15s, box-shadow .15s;
}
.ec-btn:hover:not(:disabled){background:var(--ec-hover)}
.ec-btn:disabled{opacity:.5; cursor:default}
.ec-btn-primary{background:var(--ec-primary); border-color:var(--ec-primary); color:var(--ec-on-primary); min-width:148px}
.ec-btn-primary:hover:not(:disabled){background:var(--ec-primary-hover); border-color:var(--ec-primary-hover)}
.ec-btn-primary[data-sent="true"]{background:var(--ec-ok); border-color:var(--ec-ok); color:var(--ec-on-ok); opacity:1}
.ec-btn-icon{min-height:36px; width:36px; padding:0; border-color:transparent; background:transparent; color:var(--ec-muted)}
.ec-root :is(.ec-btn,.ec-input,.ec-chip-x,.ec-tab,.ec-option):focus-visible{
  outline:none; box-shadow:0 0 0 3px var(--ec-ring); border-color:var(--ec-primary);
}

.ec-body{
  flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain;
  padding:24px 28px 28px; background:var(--ec-surface);
}
.ec-tabs{
  display:inline-flex; gap:2px; padding:3px; margin-bottom:24px;
  background:var(--ec-canvas); border:1px solid var(--ec-border); border-radius:8px;
}
.ec-tab{
  display:inline-flex; align-items:center; gap:8px; min-height:34px; padding:6px 16px;
  border:1px solid transparent; border-radius:6px; background:transparent; color:var(--ec-muted);
  font:inherit; font-size:13px; font-weight:600; cursor:pointer;
}
.ec-tab[aria-pressed="true"]{background:var(--ec-surface); color:var(--ec-text); border-color:var(--ec-border); box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ec-tab:hover:not([aria-pressed="true"]){color:var(--ec-text)}

.ec-fields{display:grid; gap:24px; min-width:0}
.ec-label{display:block; margin-bottom:8px; font-size:13px; line-height:20px; font-weight:600; color:var(--ec-text)}
.ec-help{margin:8px 0 0; font-size:12px; line-height:18px; color:var(--ec-muted)}
.ec-input{
  display:block; width:100%; min-width:0; min-height:46px; padding:11px 14px;
  background:var(--ec-field); color:var(--ec-text); border:1px solid var(--ec-border-strong); border-radius:6px;
  font:inherit; font-size:15px; line-height:24px; transition:border-color .15s, box-shadow .15s;
}
.ec-input::placeholder{color:var(--ec-faint)}
.ec-input:hover:not(:disabled):not(:focus){border-color:var(--ec-muted)}
.ec-input:disabled{opacity:.6; cursor:not-allowed}
textarea.ec-input{min-height:220px; padding:14px 16px; line-height:26px; resize:vertical}
.ec-input-icon{padding-left:42px}
.ec-search{position:relative; margin-top:12px}
.ec-search > svg{position:absolute; left:14px; top:14px; color:var(--ec-faint); pointer-events:none}
.ec-sr{position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap}

.ec-chips{display:flex; flex-wrap:wrap; gap:8px; margin-top:12px}
.ec-chip{
  display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:3px 4px 3px 12px;
  border:1px solid var(--ec-border); border-radius:6px; background:var(--ec-canvas);
  font-size:13px; line-height:20px; overflow-wrap:anywhere;
}
.ec-chip[data-invalido="true"]{border-color:var(--ec-danger-border); background:var(--ec-danger-soft); color:var(--ec-danger)}
.ec-chip-x{
  display:grid; place-items:center; width:24px; height:24px; flex-shrink:0; padding:0;
  border:1px solid transparent; border-radius:4px; background:transparent; color:inherit; cursor:pointer; opacity:.7;
}
.ec-chip-x:hover:not(:disabled){opacity:1; background:var(--ec-hover)}
.ec-chip-x:disabled{cursor:default; opacity:.35}

.ec-list{
  margin-top:8px; max-height:256px; overflow-y:auto; border:1px solid var(--ec-border-strong);
  border-radius:6px; background:var(--ec-surface); box-shadow:0 8px 24px rgba(0,0,0,.12);
}
.ec-option{
  display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; overflow-wrap:anywhere;
  border-bottom:1px solid var(--ec-border);
}
.ec-option:last-child{border-bottom:0}
.ec-option[aria-selected="true"]{background:var(--ec-hover)}
.ec-avatar{
  display:grid; place-items:center; width:34px; height:34px; flex-shrink:0; border-radius:50%;
  background:var(--ec-primary-soft); color:var(--ec-primary); font-size:12px; font-weight:700;
}
.ec-option-main{min-width:0; flex:1}
.ec-option-nome{display:block; font-size:14px; line-height:20px; font-weight:600}
.ec-option-email{display:block; font-size:13px; line-height:19px; color:var(--ec-muted)}
.ec-tag{
  flex-shrink:0; padding:1px 8px; border:1px solid var(--ec-border); border-radius:999px;
  font-size:11px; line-height:18px; color:var(--ec-muted); background:var(--ec-canvas);
}
.ec-empty{margin:0; padding:14px; font-size:13px; color:var(--ec-muted)}

.ec-bank{border:1px solid var(--ec-border); border-radius:8px; background:var(--ec-canvas); overflow:hidden}
.ec-bank-toggle{
  display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:48px;
  padding:12px 16px; border:0; background:transparent; color:var(--ec-text); font:inherit; font-size:14px; font-weight:600;
  text-align:left; cursor:pointer;
}
.ec-bank-toggle:hover:not(:disabled){background:var(--ec-hover)}
.ec-bank-toggle:focus-visible{outline:none; box-shadow:inset 0 0 0 3px var(--ec-ring)}
.ec-bank-toggle > span{display:flex; align-items:center; gap:10px}
.ec-bank-items{display:flex; flex-wrap:wrap; gap:8px; padding:4px 16px 16px}
.ec-bank-items .ec-btn{font-weight:500; min-height:38px; max-width:100%; overflow-wrap:anywhere; text-align:left}

.ec-notice{
  display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:6px;
  border:1px solid var(--ec-warn-border); background:var(--ec-warn-soft); color:var(--ec-warn);
  font-size:13px; line-height:20px; overflow-wrap:anywhere;
}
.ec-notice > svg{flex-shrink:0; margin-top:2px}
.ec-notice[data-tipo="erro"]{border-color:var(--ec-danger-border); background:var(--ec-danger-soft); color:var(--ec-danger)}

.ec-preview-frame{
  display:block; width:100%; height:460px; border:1px solid var(--ec-border); border-radius:8px; background:#f8f9fa;
}

.ec-attach{margin-top:28px; padding-top:22px; border-top:1px solid var(--ec-border)}
.ec-attach h3{margin:0 0 12px; font-size:13px; line-height:20px; font-weight:600}
.ec-attach-list{display:grid; gap:8px}
.ec-attach-item{
  display:flex; align-items:center; gap:12px; padding:11px 14px; border:1px solid var(--ec-border);
  border-radius:6px; background:var(--ec-canvas);
}
.ec-attach-item > svg{flex-shrink:0; color:var(--ec-muted)}
.ec-attach-item .ec-attach-nome{margin:0; font-size:13px; line-height:20px; font-weight:600; overflow-wrap:anywhere}
.ec-attach-item .ec-help{margin:0}
.ec-attach-item[data-ok="false"]{border-color:var(--ec-warn-border); background:var(--ec-warn-soft)}
.ec-attach-item[data-ok="false"] .ec-help{color:var(--ec-warn)}

.ec-footer{
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px 16px;
  padding:16px 28px; border-top:1px solid var(--ec-border); background:var(--ec-canvas); flex-shrink:0;
}
.ec-status{display:flex; align-items:center; gap:8px; margin:0; font-size:13px; line-height:20px; color:var(--ec-muted)}
.ec-status[data-sent="true"]{color:var(--ec-ok); font-weight:600}
.ec-actions{display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; margin-left:auto}

@media (max-width:640px){
  .ec-root{padding:0; align-items:flex-end}
  .ec-dialog{max-width:none; max-height:100dvh; border-radius:12px 12px 0 0; border-left:0; border-right:0; border-bottom:0}
  .ec-header{padding:14px 18px}
  .ec-body{padding:18px 18px 24px}
  .ec-footer{padding:12px 18px calc(12px + env(safe-area-inset-bottom, 0px)); flex-direction:column; align-items:stretch}
  .ec-status{justify-content:center}
  .ec-actions{flex-direction:column-reverse; margin-left:0}
  .ec-actions .ec-btn{width:100%; min-height:46px}
  .ec-input{font-size:16px}
  .ec-tabs{display:flex}
  .ec-tab{flex:1; justify-content:center}
  .ec-preview-frame{height:360px}
  textarea.ec-input{min-height:200px}
}
@media (prefers-reduced-motion:reduce){
  .ec-root *{transition:none !important}
}
`;

export function EnviarEmailClienteDialog({
  open, onOpenChange, onSent, destinatarioInicial = "", assuntoSugerido = "",
  mensagemSugerida = "", anexos = [], referencias = [], envioExtra = {}, nomeEmpresa = "Share Brasil",
  anexosDisponiveis, onAnexosChange, exigirAnexo = false, onDraftChange,
}: Props) {
  const id = useId();
  const tema = useTema();
  const dialogRef = useRef<HTMLDivElement>(null);
  const destinatarioRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const envioEmCurso = useRef(false);
  const sessao = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentes = useRef({ onOpenChange, onSent, destinatarioInicial, assuntoSugerido, mensagemSugerida, onDraftChange });
  const rascunhoAtual = useRef<RascunhoEmailCliente>({ destinatario: "", assunto: "", mensagem: "" });
  recentes.current = { onOpenChange, onSent, destinatarioInicial, assuntoSugerido, mensagemSugerida, onDraftChange };

  const [destinatario, setDestinatario] = useState("");
  const [paraFocado, setParaFocado] = useState(false);
  const [buscaContato, setBuscaContato] = useState("");
  const [indiceContato, setIndiceContato] = useState(0);
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [contas, setContas] = useState<ContaBancariaEmail[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [avisoCarga, setAvisoCarga] = useState("");
  const [bancosAbertos, setBancosAbertos] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [erro, setErro] = useState("");
  const [visualizacao, setVisualizacao] = useState<"editar" | "previa">("editar");
  const bloqueado = status !== "idle";
  rascunhoAtual.current = { destinatario, assunto, mensagem };

  // Inicializa uma vez por abertura. Mudanças de props não apagam o texto em edição.
  useEffect(() => {
    if (!open) return;
    const atual = ++sessao.current;
    const iniciaisProps = recentes.current;
    setDestinatario(iniciaisProps.destinatarioInicial || "");
    setAssunto(iniciaisProps.assuntoSugerido);
    setMensagem(iniciaisProps.mensagemSugerida);
    setBuscaContato("");
    setIndiceContato(0);
    setStatus("idle");
    envioEmCurso.current = false;
    setErro("");
    setAvisoCarga("");
    setContatos([]);
    setContas([]);
    setCarregando(true);
    setVisualizacao("editar");
    setBancosAbertos(false);

    void Promise.allSettled([buscarCentralEmail(), buscarContasBancariasEmail()]).then(([central, bancos]) => {
      if (atual !== sessao.current) return;
      setContatos(central.status === "fulfilled" ? central.value.contatos || [] : []);
      setContas(bancos.status === "fulfilled" ? bancos.value.contas || [] : []);
      const indisponiveis = [
        central.status === "rejected" ? "os contatos" : "",
        bancos.status === "rejected" ? "as contas bancárias" : "",
      ].filter(Boolean);
      setAvisoCarga(indisponiveis.length
        ? `Não foi possível carregar ${indisponiveis.join(" e ")}. Você pode preencher a mensagem manualmente.` : "");
      setCarregando(false);
    });

    return () => {
      ++sessao.current;
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    };
  }, [open]);

  // Portal + trava de rolagem + armadilha de foco.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = requestAnimationFrame(() => destinatarioRef.current?.focus());
    const teclado = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        if (envioEmCurso.current) return;
        recentes.current.onDraftChange?.(rascunhoAtual.current);
        recentes.current.onOpenChange(false);
      }
      if (evento.key !== "Tab" || !dialogRef.current) return;
      const elementos = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
      )).filter((elemento) => elemento.getClientRects().length > 0);
      const primeiro = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (!primeiro) {
        evento.preventDefault();
        dialogRef.current.focus();
      } else if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === dialogRef.current)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !dialogRef.current.contains(document.activeElement))) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", teclado);
    return () => {
      cancelAnimationFrame(foco);
      document.removeEventListener("keydown", teclado);
      document.body.style.overflow = overflowAnterior;
      if (anterior?.isConnected) anterior.focus();
    };
  }, [open]);

  const listaDestinatarios = useMemo(() => normalizarEmails(destinatario), [destinatario]);

  const contatosFiltrados = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo) return [];
    return contatos.filter((contato) => `${contato.nome} ${contato.email} ${contato.tipo}`.toLowerCase().includes(termo)).slice(0, 8);
  }, [buscaContato, contatos]);

  const htmlPrevia = useMemo(() => gerarEmailClienteHtml({
    empresa: nomeEmpresa, assunto: assunto.trim() || "Assunto da mensagem",
    mensagem: mensagem.trim() || "O conteúdo da mensagem aparecerá aqui.",
  }), [nomeEmpresa, assunto, mensagem]);

  useEffect(() => {
    if (erro) corpoRef.current?.scrollTo({ top: corpoRef.current.scrollHeight, behavior: "smooth" });
  }, [erro]);

  const anexosSemId = anexos.filter((anexo) => !anexo.id?.trim());
  const podeEnviar = Boolean(destinatario.trim() && assunto.trim() && mensagem.trim() && !bloqueado && !anexosSemId.length && (!exigirAnexo || anexos.length > 0));

  const fechar = () => {
    if (!envioEmCurso.current) {
      recentes.current.onDraftChange?.(rascunhoAtual.current);
      recentes.current.onOpenChange(false);
    }
  };

  const selecionarContato = (contato: ContatoEmail) => {
    if (bloqueado) return;
    setDestinatario((atual) => normalizarEmails(`${atual};${contato.email}`).join("; "));
    setBuscaContato("");
    setIndiceContato(0);
    destinatarioRef.current?.focus();
  };

  const removerDestinatario = (email: string) => {
    if (bloqueado) return;
    setDestinatario(listaDestinatarios.filter((item) => item !== email).join("; "));
    setErro("");
  };

  const navegarContatos = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape" && buscaContato) {
      evento.preventDefault();
      evento.stopPropagation();
      setBuscaContato("");
      return;
    }
    if (!contatosFiltrados.length) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const direcao = evento.key === "ArrowDown" ? 1 : -1;
      const proximo = (indiceContato + direcao + contatosFiltrados.length) % contatosFiltrados.length;
      setIndiceContato(proximo);
      document.getElementById(`${id}-contato-${proximo}`)?.scrollIntoView({ block: "nearest" });
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      selecionarContato(contatosFiltrados[Math.min(indiceContato, contatosFiltrados.length - 1)]);
    }
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (envioEmCurso.current) return;
    const destinatarios = normalizarEmails(destinatario);
    if (!destinatarios.length || !assunto.trim() || !mensagem.trim()) {
      setErro("Preencha os destinatários, o assunto e a mensagem.");
      return;
    }
    const invalidos = destinatarios.filter((email) => !emailValido(email));
    if (invalidos.length) {
      setErro(`Revise os endereços de e-mail: ${invalidos.join(", ")}.`);
      setVisualizacao("editar");
      destinatarioRef.current?.focus();
      return;
    }
    if (anexosSemId.length) {
      setErro("Existem documentos sem identificador de anexo. Corrija os anexos antes de enviar.");
      return;
    }

    if (exigirAnexo && !anexos.length) {
      setErro("Selecione ao menos um documento deste cotista para enviar.");
      return;
    }
    recentes.current.onDraftChange?.(rascunhoAtual.current);
    envioEmCurso.current = true;
    setStatus("sending");
    setErro("");
    const atual = sessao.current;
    let emailId: string;
    try {
      // Contrato original preservado: mensagem continua sendo texto simples.
      const enviado = await enviarEmailCliente({
        destinatarios, cc: [], assunto: assunto.trim(), mensagem: mensagem.trim(),
        anexos: Array.from(new Set(anexos.flatMap((anexo) => anexo.id ? [anexo.id] : []))),
        referencias,
        ...envioExtra,
      });
      emailId = enviado.id;
    } catch (causa) {
      if (atual !== sessao.current) return;
      envioEmCurso.current = false;
      setStatus("idle");
      setErro(causa instanceof Error ? causa.message : "Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    if (atual !== sessao.current) return;
    setStatus("sent");
    // Falha no callback da tela pai não transforma um envio confirmado em erro.
    temporizador.current = setTimeout(() => {
      if (atual !== sessao.current) return;
      envioEmCurso.current = false;
      recentes.current.onOpenChange(false);
    }, 1600);
    try { recentes.current.onSent?.(emailId); } catch { /* O e-mail já foi enviado. */ }
  };

  if (!open || typeof document === "undefined") return null;

  const listaAberta = Boolean(buscaContato.trim() && contatosFiltrados.length);

  return createPortal(
    <div className="ec-root" data-tema={tema}>
      <style>{CSS}</style>
      <div ref={dialogRef} className="ec-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} tabIndex={-1}>
        <form className="ec-form" onSubmit={(evento) => void enviar(evento)} aria-busy={status === "sending"}>
          <header className="ec-header">
            <span className="ec-header-icon"><Mail size={20} aria-hidden="true" /></span>
            <div className="ec-header-text">
              <h2 id={`${id}-titulo`} className="ec-title">Enviar por e-mail</h2>
              <p className="ec-subtitle">{envioExtra.nome_destinatario ? `Documentos para ${envioExtra.nome_destinatario}` : "Comunicação com o cliente"}</p>
            </div>
            <button type="button" className="ec-btn ec-btn-icon" onClick={fechar} disabled={bloqueado} aria-label="Fechar janela">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div ref={corpoRef} className="ec-body">
            <div className="ec-tabs" role="group" aria-label="Modo de visualização">
              <button type="button" className="ec-tab" aria-pressed={visualizacao === "editar"} onClick={() => setVisualizacao("editar")}>
                <Pencil size={15} aria-hidden="true" /> Escrever
              </button>
              <button type="button" className="ec-tab" aria-pressed={visualizacao === "previa"} onClick={() => setVisualizacao("previa")}>
                <Eye size={15} aria-hidden="true" /> Prévia
              </button>
            </div>

            {visualizacao === "editar" ? <div className="ec-fields">
              <div>
                <label htmlFor={`${id}-para`} className="ec-label">Para</label>
                <input ref={destinatarioRef} id={`${id}-para`} name="destinatarios" className="ec-input" type="text"
                  inputMode="email" autoComplete="off" spellCheck={false} value={destinatario}
                  onChange={(evento) => { setDestinatario(evento.target.value); setErro(""); }}
                  onFocus={() => setParaFocado(true)} onBlur={() => setParaFocado(false)}
                  placeholder="nome@empresa.com" disabled={bloqueado} aria-describedby={`${id}-para-ajuda`} />
                <p id={`${id}-para-ajuda`} className="ec-help">Separe vários endereços por ponto e vírgula.</p>

                {listaDestinatarios.length > 0 && <div className="ec-chips" aria-label="Destinatários">
                  {listaDestinatarios.map((email) => <span key={email} className="ec-chip"
                    data-invalido={!paraFocado && !emailValido(email)}>
                    {email}
                    <button type="button" className="ec-chip-x" disabled={bloqueado} onClick={() => removerDestinatario(email)}
                      aria-label={`Remover ${email}`}><X size={14} aria-hidden="true" /></button>
                  </span>)}
                </div>}

                <div className="ec-search">
                  <Search size={17} aria-hidden="true" />
                  <label htmlFor={`${id}-busca`} className="ec-sr">Buscar cliente ou sócio holding</label>
                  <input id={`${id}-busca`} className="ec-input ec-input-icon" role="combobox" aria-autocomplete="list"
                    aria-expanded={listaAberta} aria-controls={`${id}-contatos`}
                    aria-activedescendant={listaAberta ? `${id}-contato-${Math.min(indiceContato, contatosFiltrados.length - 1)}` : undefined}
                    value={buscaContato} onChange={(evento) => { setBuscaContato(evento.target.value); setIndiceContato(0); }}
                    onKeyDown={navegarContatos} autoComplete="off" disabled={bloqueado || carregando}
                    placeholder={carregando ? "Carregando contatos…" : "Buscar cliente ou sócio holding"} />
                  {buscaContato.trim() && !carregando && <div id={`${id}-contatos`} className="ec-list" role="listbox" aria-label="Contatos encontrados">
                    {contatosFiltrados.length ? contatosFiltrados.map((contato, indice) => <div key={`${contato.id}:${contato.email}`}
                      id={`${id}-contato-${indice}`} className="ec-option" role="option" aria-selected={indiceContato === indice}
                      onMouseDown={(evento) => evento.preventDefault()} onMouseEnter={() => setIndiceContato(indice)}
                      onClick={() => selecionarContato(contato)}>
                      <span className="ec-avatar" aria-hidden="true">{iniciais(contato.nome)}</span>
                      <span className="ec-option-main">
                        <span className="ec-option-nome">{contato.nome}</span>
                        <span className="ec-option-email">{contato.email}</span>
                      </span>
                      <span className="ec-tag">{contato.tipo === "socio" ? "Sócio holding" : "Cliente"}</span>
                    </div>) : <p className="ec-empty">Nenhum contato encontrado.</p>}
                  </div>}
                </div>
              </div>

              <div>
                <label htmlFor={`${id}-assunto`} className="ec-label">Assunto</label>
                <input id={`${id}-assunto`} name="assunto" className="ec-input" value={assunto}
                  onChange={(evento) => { setAssunto(evento.target.value); setErro(""); }}
                  placeholder="Informe o assunto da mensagem" disabled={bloqueado} />
              </div>

              <div>
                <label htmlFor={`${id}-mensagem`} className="ec-label">Mensagem</label>
                <textarea id={`${id}-mensagem`} name="mensagem" className="ec-input" rows={8} value={mensagem}
                  onChange={(evento) => { setMensagem(evento.target.value); setErro(""); }}
                  placeholder="Escreva sua mensagem…" disabled={bloqueado} />
              </div>

              {contas.length > 0 && <section className="ec-bank" aria-label="Dados bancários">
                <button type="button" className="ec-bank-toggle" disabled={bloqueado} aria-expanded={bancosAbertos}
                  aria-controls={`${id}-bancos`} onClick={() => setBancosAbertos((atual) => !atual)}>
                  <span><Building2 size={17} aria-hidden="true" /> Inserir dados bancários</span>
                  <ChevronDown size={16} aria-hidden="true" style={{ transform: bancosAbertos ? "rotate(180deg)" : undefined, flexShrink: 0, transition: "transform .15s" }} />
                </button>
                {bancosAbertos && <div id={`${id}-bancos`} className="ec-bank-items">
                  {contas.map((conta) => <button key={conta.id} type="button" className="ec-btn" disabled={bloqueado}
                    onClick={() => setMensagem((atual) => atual.trim() ? `${atual.trim()}\n\n${conta.texto}` : conta.texto)}>
                    <Building2 size={15} aria-hidden="true" style={{ flexShrink: 0 }} />{conta.banco}
                  </button>)}
                </div>}
              </section>}

              {avisoCarga && <div role="status" className="ec-notice"><AlertCircle size={17} aria-hidden="true" /><span>{avisoCarga}</span></div>}
            </div> : <section aria-label="Prévia do corpo do e-mail">
              <p className="ec-help" style={{ margin: "0 0 14px" }}>
                Prévia de formatação do conteúdo. A apresentação final depende do modelo configurado no sistema. Assinatura e documentos são adicionados no envio.
              </p>
              <iframe className="ec-preview-frame" title="Prévia do conteúdo do e-mail" srcDoc={htmlPrevia} sandbox="" tabIndex={-1} />
            </section>}

            {(anexosDisponiveis ?? anexos).length > 0 && <section className="ec-attach" aria-labelledby={`${id}-anexos`}>
              <h3 id={`${id}-anexos`}>Documentos anexados ({anexos.length})</h3>
              <div className="ec-attach-list">
                {(anexosDisponiveis ?? anexos).map((anexo, indice) => {
                  const ok = Boolean(anexo.id?.trim());
                  const selecionado = anexos.some((item) => item.id === anexo.id);
                  return <div key={`${anexo.id || anexo.url || "anexo"}-${indice}`} className="ec-attach-item" data-ok={ok}>
                    {onAnexosChange ? <input type="checkbox" aria-label={`Anexar ${anexo.label || anexo.filename || `Documento ${indice + 1}`}`} checked={selecionado} disabled={bloqueado || !ok}
                      onChange={() => onAnexosChange(selecionado ? anexos.flatMap((item) => item.id && item.id !== anexo.id ? [item.id] : []) : [...anexos.flatMap((item) => item.id ? [item.id] : []), anexo.id!])} /> : <Paperclip size={17} aria-hidden="true" />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="ec-attach-nome">{anexo.label || anexo.filename || `Documento ${indice + 1}`}</p>
                      <p className="ec-help">{!ok ? "Documento indisponível para envio" : selecionado ? "Incluído no envio deste cotista" : "Não incluído neste e-mail"}</p>
                    </div>
                  </div>;
                })}
              </div>
              {exigirAnexo && !anexos.length && <p className="ec-help" style={{ color: "var(--ec-warn)" }}>Selecione ao menos um documento para este cotista.</p>}
              {anexosSemId.length > 0 && <p className="ec-help" style={{ color: "var(--ec-warn)" }}>
                Feche esta janela e selecione novamente os documentos indisponíveis para continuar.
              </p>}
            </section>}
            {Boolean(envioExtra.arquivos_persistidos?.length) && <section className="ec-attach" aria-label="Arquivos adicionais salvos">
              <h3>Arquivos adicionais salvos</h3><div className="ec-attach-list">{envioExtra.arquivos_persistidos!.map((arquivo) => <div className="ec-attach-item" key={arquivo.key}><Paperclip size={17} /><p className="ec-attach-nome">{arquivo.filename}</p></div>)}</div>
            </section>}

            {erro && <div role="alert" className="ec-notice" data-tipo="erro" style={{ marginTop: 24 }}>
              <AlertCircle size={17} aria-hidden="true" /><span>{erro}</span>
            </div>}
          </div>

          <footer className="ec-footer">
            <p role="status" aria-live="polite" className="ec-status" data-sent={status === "sent"}>
              {status === "sent" && <Check size={16} aria-hidden="true" />}
              {status === "sent" ? "E-mail enviado com sucesso." : status === "sending" ? "Enviando mensagem. Aguarde…" : "Revise os dados antes de enviar."}
            </p>
            <div className="ec-actions">
              <button type="button" className="ec-btn" onClick={fechar} disabled={bloqueado}>Cancelar</button>
              <button type="submit" className="ec-btn ec-btn-primary" data-sent={status === "sent"} disabled={!podeEnviar}
                style={status === "sent" ? { opacity: 1 } : undefined}>
                {status === "sent" ? <Check size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {status === "sending" ? "Enviando…" : status === "sent" ? "Enviado" : "Enviar e-mail"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
