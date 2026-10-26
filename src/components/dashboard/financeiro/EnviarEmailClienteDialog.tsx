import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Building2, Check, ChevronDown, Eye, Mail, Paperclip, Pencil, Search, Send, X } from "lucide-react";
import {
  buscarCentralEmail, buscarContasBancariasEmail, enviarEmailCliente,
  type ContaBancariaEmail, type ContatoEmail,
} from "@/lib/colaborador-api";
import { gerarEmailClienteHtml } from "@/lib/email-cliente-template";

export type AnexoEmail = { id?: string; url?: string; label?: string; filename?: string };

type SendStatus = "idle" | "sending" | "sent";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (emailId: string) => void;
  destinatarioInicial?: string | null;
  assuntoSugerido?: string;
  mensagemSugerida?: string;
  anexos?: AnexoEmail[];
  referencias?: string[];
  /** Usado apenas na prévia. A identidade do envio é definida pelo backend. */
  nomeEmpresa?: string;
};

const FONT = 'Arial, Helvetica, "Segoe UI", sans-serif';
const COR = { tinta: "#202a37", secundario: "#596575", borda: "#dce2e8", fundo: "#f8f9fa", azul: "#24364b" };
const espacamento = "clamp(20px, 5vw, 32px)";
const campo: CSSProperties = {
  boxSizing: "border-box", display: "block", width: "100%", minWidth: 0,
  border: `1px solid ${COR.borda}`, borderRadius: 6, backgroundColor: "#ffffff",
  padding: "12px 14px", color: COR.tinta, fontFamily: FONT, fontSize: 16,
  lineHeight: "24px", outlineOffset: 3, accentColor: COR.azul,
};
const rotulo: CSSProperties = {
  display: "block", marginBottom: 8, color: COR.tinta, fontSize: 13, lineHeight: "20px", fontWeight: 700,
};
const ajuda: CSSProperties = { margin: "8px 0 0", color: COR.secundario, fontSize: 12, lineHeight: "19px" };
const botao: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  boxSizing: "border-box", minHeight: 44, padding: "11px 18px", borderRadius: 6,
  border: `1px solid ${COR.borda}`, backgroundColor: "#ffffff", color: COR.tinta,
  fontFamily: FONT, fontSize: 13, lineHeight: "20px", fontWeight: 700,
  cursor: "pointer", outlineOffset: 3, textDecoration: "none",
};
const aviso: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px",
  border: "1px solid #e5d8bd", borderRadius: 6, backgroundColor: "#fffcf5",
  color: "#765622", fontSize: 13, lineHeight: "21px", overflowWrap: "anywhere",
};

export const normalizarEmails = (valor: string): string[] => Array.from(new Set(
  valor.split(/[;,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
));

// Validação prática para endereços simples; a validação definitiva pertence ao servidor.
const emailValido = (email: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);

export function EnviarEmailClienteDialog({
  open, onOpenChange, onSent, destinatarioInicial = "", assuntoSugerido = "",
  mensagemSugerida = "", anexos = [], referencias = [], nomeEmpresa = "Share Brasil",
}: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const destinatarioRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const envioEmCurso = useRef(false);
  const sessao = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentes = useRef({ onOpenChange, onSent, destinatarioInicial, assuntoSugerido, mensagemSugerida });
  recentes.current = { onOpenChange, onSent, destinatarioInicial, assuntoSugerido, mensagemSugerida };

  const [destinatario, setDestinatario] = useState("");
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

  // Inicializa uma vez por abertura. Mudanças de props não apagam o texto em edição.
  useEffect(() => {
    if (!open) return;
    const atual = ++sessao.current;
    const iniciais = recentes.current;
    setDestinatario(iniciais.destinatarioInicial || "");
    setAssunto(iniciais.assuntoSugerido);
    setMensagem(iniciais.mensagemSugerida);
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

  // Portal + limite de altura + rolagem interna evitam cortes dentro do layout pai.
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
  const podeEnviar = Boolean(destinatario.trim() && assunto.trim() && mensagem.trim() && !bloqueado && !anexosSemId.length);

  const fechar = () => {
    if (!envioEmCurso.current) recentes.current.onOpenChange(false);
  };

  const selecionarContato = (contato: ContatoEmail) => {
    if (bloqueado) return;
    setDestinatario((atual) => normalizarEmails(`${atual};${contato.email}`).join("; "));
    setBuscaContato("");
    setIndiceContato(0);
    destinatarioRef.current?.focus();
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

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, boxSizing: "border-box", backgroundColor: "rgba(24, 34, 47, 0.48)", fontFamily: FONT, color: COR.tinta }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-descricao`} tabIndex={-1}
        style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", width: "100%", maxWidth: 640, maxHeight: "calc(100dvh - 24px)", minWidth: 0, border: "1px solid #0c2f5a", borderRadius: 10, backgroundColor: "#034377", boxShadow: "0 24px 80px rgba(18,32,49,0.18)", overflow: "hidden" }}>
        <form onSubmit={(evento) => void enviar(evento)} aria-busy={status === "sending"}
          style={{ display: "flex", flexDirection: "column", minHeight: 0, width: "100%", margin: 0 }}>
          <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: `24px ${espacamento}`, borderBottom: `1px solid ${COR.borda}`, flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 9px", color: COR.secundario, fontSize: 11, lineHeight: "16px", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}><Mail size={15} aria-hidden="true" /> Comunicação com o cliente</p>
              <h2 id={`${id}-titulo`} style={{ margin: 0, fontSize: 22, lineHeight: "29px", fontWeight: 700, letterSpacing: "-0.4px" }}>Enviar por e-mail</h2>
              <p id={`${id}-descricao`} style={{ ...ajuda, marginTop: 7 }}>Revise a mensagem e os documentos antes de enviar.</p>
            </div>
            <button type="button" onClick={fechar} disabled={bloqueado} aria-label="Fechar janela"
              style={{ ...botao, minWidth: 44, padding: 10, flexShrink: 0, opacity: bloqueado ? 0.45 : 1, cursor: bloqueado ? "default" : "pointer" }}><X size={18} aria-hidden="true" /></button>
          </header>

          <div ref={corpoRef} style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", padding: `24px ${espacamento} 28px` }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 24 }} role="group" aria-label="Modo de visualização">
              <button type="button" aria-pressed={visualizacao === "editar"} onClick={() => setVisualizacao("editar")}
                style={{ ...botao, backgroundColor: visualizacao === "editar" ? "#edf1f5" : "#ffffff", borderColor: visualizacao === "editar" ? "#c3cdd8" : COR.borda }}><Pencil size={15} aria-hidden="true" /> Escrever</button>
              <button type="button" aria-pressed={visualizacao === "previa"} onClick={() => setVisualizacao("previa")}
                style={{ ...botao, backgroundColor: visualizacao === "previa" ? "#edf1f5" : "#ffffff", borderColor: visualizacao === "previa" ? "#c3cdd8" : COR.borda }}><Eye size={16} aria-hidden="true" /> Prévia do conteúdo</button>
            </div>

            {visualizacao === "editar" ? <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
              <div>
                <label htmlFor={`${id}-para`} style={rotulo}>Para</label>
                <input ref={destinatarioRef} id={`${id}-para`} name="destinatarios" type="text" inputMode="email" autoComplete="off" spellCheck={false}
                  value={destinatario} onChange={(evento) => { setDestinatario(evento.target.value); setErro(""); }}
                  placeholder="nome@empresa.com" disabled={bloqueado} aria-describedby={`${id}-para-ajuda`} style={campo} />
                <p id={`${id}-para-ajuda`} style={ajuda}>Separe vários endereços por ponto e vírgula.</p>
                <div style={{ position: "relative", marginTop: 14 }}>
                  <Search size={17} aria-hidden="true" style={{ position: "absolute", left: 14, top: 15, color: "#637083", pointerEvents: "none" }} />
                  <label htmlFor={`${id}-busca`} style={{ ...rotulo, position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}>Buscar cliente ou sócio holding</label>
                  <input id={`${id}-busca`} role="combobox" aria-autocomplete="list" aria-expanded={Boolean(buscaContato.trim() && contatosFiltrados.length)}
                    aria-controls={`${id}-contatos`} aria-activedescendant={buscaContato.trim() && contatosFiltrados.length ? `${id}-contato-${Math.min(indiceContato, contatosFiltrados.length - 1)}` : undefined}
                    value={buscaContato} onChange={(evento) => { setBuscaContato(evento.target.value); setIndiceContato(0); }} onKeyDown={navegarContatos}
                    placeholder={carregando ? "Carregando contatos…" : "Buscar cliente ou sócio holding"} disabled={bloqueado || carregando}
                    autoComplete="off" style={{ ...campo, paddingLeft: 40, backgroundColor: COR.fundo }} />
                  {buscaContato.trim() && !carregando && <div id={`${id}-contatos`} role="listbox" aria-label="Contatos encontrados"
                    style={{ marginTop: 8, maxHeight: 224, overflowY: "auto", border: `1px solid ${COR.borda}`, borderRadius: 6, backgroundColor: "#ffffff" }}>
                    {contatosFiltrados.length ? contatosFiltrados.map((contato, indice) => <div key={`${contato.id}:${contato.email}`} id={`${id}-contato-${indice}`} role="option" aria-selected={indiceContato === indice}
                      onMouseDown={(evento) => evento.preventDefault()} onClick={() => selecionarContato(contato)}
                      style={{ padding: "12px 14px", backgroundColor: indiceContato === indice ? "#edf1f5" : "#ffffff", cursor: "pointer", borderBottom: indice < contatosFiltrados.length - 1 ? `1px solid ${COR.borda}` : undefined, overflowWrap: "anywhere" }}>
                      <span style={{ display: "block", color: COR.tinta, fontSize: 13, lineHeight: "20px", fontWeight: 700 }}>{contato.nome}</span>
                      <span style={{ display: "block", color: COR.secundario, fontSize: 13, lineHeight: "21px" }}>{contato.email}</span>
                      <span style={{ display: "block", marginTop: 3, color: COR.secundario, fontSize: 11, lineHeight: "17px" }}>{contato.tipo === "socio" ? "Sócio holding" : "Cliente"}</span>
                    </div>) : <p style={{ ...ajuda, padding: "12px 14px", margin: 0 }}>Nenhum contato encontrado.</p>}
                  </div>}
                </div>
              </div>

              <div>
                <label htmlFor={`${id}-assunto`} style={rotulo}>Assunto</label>
                <input id={`${id}-assunto`} name="assunto" value={assunto} onChange={(evento) => { setAssunto(evento.target.value); setErro(""); }} placeholder="Informe o assunto da mensagem" disabled={bloqueado} style={campo} />
              </div>
              <div>
                <label htmlFor={`${id}-mensagem`} style={rotulo}>Mensagem</label>
                <textarea id={`${id}-mensagem`} name="mensagem" value={mensagem} onChange={(evento) => { setMensagem(evento.target.value); setErro(""); }} placeholder="Escreva sua mensagem…"
                  disabled={bloqueado} rows={8} aria-describedby={`${id}-mensagem-ajuda`} style={{ ...campo, minHeight: 208, resize: "vertical", lineHeight: "26px", padding: "14px 16px" }} />
                <p id={`${id}-mensagem-ajuda`} style={ajuda}>A assinatura configurada no sistema é adicionada no envio.</p>
              </div>

              {contas.length > 0 && <section aria-label="Dados bancários" style={{ border: `1px solid ${COR.borda}`, borderRadius: 6, backgroundColor: COR.fundo }}>
                <button type="button" disabled={bloqueado} aria-expanded={bancosAbertos} aria-controls={`${id}-bancos`} onClick={() => setBancosAbertos((atual) => !atual)}
                  style={{ ...botao, width: "100%", justifyContent: "space-between", padding: "14px 16px", border: 0, backgroundColor: "transparent", textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Building2 size={17} aria-hidden="true" /> Inserir dados bancários</span><ChevronDown size={16} aria-hidden="true" style={{ transform: bancosAbertos ? "rotate(180deg)" : undefined, flexShrink: 0 }} />
                </button>
                {bancosAbertos && <div id={`${id}-bancos`} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 16px" }}>
                  {contas.map((conta) => <button key={conta.id} type="button" disabled={bloqueado}
                    onClick={() => setMensagem((atual) => atual.trim() ? `${atual.trim()}\n\n${conta.texto}` : conta.texto)}
                    style={{ ...botao, fontWeight: 400, overflowWrap: "anywhere", maxWidth: "100%" }}><Building2 size={15} aria-hidden="true" style={{ flexShrink: 0 }} />{conta.banco}</button>)}
                </div>}
              </section>}
              {avisoCarga && <div role="status" style={aviso}><AlertCircle size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span>{avisoCarga}</span></div>}
            </div> : <section aria-label="Prévia do corpo do e-mail">
              <p style={{ ...ajuda, margin: "0 0 14px" }}>Prévia de formatação do conteúdo. A apresentação final depende do modelo configurado no sistema. Assinatura e documentos são adicionados no envio.</p>
              <iframe title="Prévia do conteúdo do e-mail" srcDoc={htmlPrevia} sandbox="" tabIndex={-1}
                style={{ boxSizing: "border-box", display: "block", width: "100%", height: 420, border: `1px solid ${COR.borda}`, borderRadius: 6, backgroundColor: COR.fundo }} />
            </section>}

            {anexos.length > 0 && <section aria-labelledby={`${id}-anexos`} style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${COR.borda}` }}>
              <h3 id={`${id}-anexos`} style={{ ...rotulo, display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}><Paperclip size={16} aria-hidden="true" />Documentos anexados ({anexos.length})</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {anexos.map((anexo, indice) => <div key={`${anexo.id || anexo.url || "anexo"}-${indice}`}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 14px", backgroundColor: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: 6 }}>
                  <Paperclip size={17} aria-hidden="true" style={{ flexShrink: 0, color: COR.secundario, marginTop: 2 }} />
                  <div style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}><p style={{ margin: 0, fontSize: 13, lineHeight: "21px", fontWeight: 700 }}>{anexo.label || anexo.filename || `Documento ${indice + 1}`}</p>
                    <p style={{ ...ajuda, marginTop: 3, color: anexo.id?.trim() ? COR.secundario : "#765622" }}>{anexo.id?.trim() ? "Incluído automaticamente no envio" : "Documento indisponível para envio"}</p></div>
                </div>)}
              </div>
              {anexosSemId.length > 0 && <p style={{ ...ajuda, color: "#765622" }}>Feche esta janela e selecione novamente os documentos indisponíveis para continuar.</p>}
            </section>}

            {erro && <div role="alert" style={{ ...aviso, marginTop: 24, borderColor: "#edcaca", backgroundColor: "#fff7f7", color: "#9b3030" }}><AlertCircle size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span>{erro}</span></div>}
          </div>

          <footer style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, padding: `20px ${espacamento}`, borderTop: `1px solid ${COR.borda}`, backgroundColor: COR.fundo }}>
            <p role="status" aria-live="polite" style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: 12, lineHeight: "20px", color: status === "sent" ? "#276045" : COR.secundario }}>
              {status === "sent" && <Check size={16} aria-hidden="true" />}
              {status === "sent" ? "E-mail enviado com sucesso." : status === "sending" ? "Enviando mensagem. Aguarde…" : "Revise os dados antes de enviar."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginLeft: "auto" }}>
              <button type="button" onClick={fechar} disabled={bloqueado} style={{ ...botao, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? "default" : "pointer" }}>Cancelar</button>
              <button type="submit" disabled={!podeEnviar}
                style={{ ...botao, borderColor: status === "sent" ? "#276045" : COR.azul, backgroundColor: status === "sent" ? "#276045" : COR.azul, color: "#ffffff", opacity: podeEnviar || status === "sent" ? 1 : 0.55, cursor: podeEnviar ? "pointer" : "default" }}>
                {status === "sent" ? <Check size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {status === "sending" ? "Enviando…" : status === "sent" ? "Enviado" : "Enviar e-mail"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>, document.body,
  );
}
