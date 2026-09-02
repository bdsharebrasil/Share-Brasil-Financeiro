import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, History, Mail, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { buscarCentralEmail, enviarEmailCliente, type AnexoEmail, type ContatoEmail, type EmailEnviado } from "@/lib/colaborador-api";

const dataBr = (valor: string | null) => valor ? new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function Emails() {
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
  const [historico, setHistorico] = useState<EmailEnviado[]>([]);
  const [busca, setBusca] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nomeDestinatario, setNomeDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const carregar = async () => {
    setCarregando(true); setErro("");
    try { const dados = await buscarCentralEmail(); setContatos(dados.contatos); setAnexos(dados.anexos); setHistorico(dados.historico); }
    catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar a central de e-mail."); }
    finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); }, []);
  const contatosFiltrados = useMemo(() => { const termo = busca.trim().toLowerCase(); return !termo ? contatos : contatos.filter((item) => `${item.nome} ${item.email} ${item.tipo}`.toLowerCase().includes(termo)); }, [busca, contatos]);
  const anexosSelecionados = anexos.filter((item) => selecionados.includes(item.id));
  const selecionarContato = (contato: ContatoEmail) => { setDestinatario(contato.email); setNomeDestinatario(contato.nome); };
  const alternarAnexo = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]);
  const enviar = async () => {
    if (!destinatario.trim() || !assunto.trim() || !mensagem.trim()) { setErro("Informe destinatário, assunto e mensagem."); return; }
    setEnviando(true); setErro(""); setSucesso("");
    try {
      await enviarEmailCliente({ destinatarios: [destinatario.trim()], assunto: assunto.trim(), mensagem: mensagem.trim(), anexos: anexosSelecionados.map(({ id }) => id), nome_destinatario: nomeDestinatario || undefined });
      setSucesso(`E-mail enviado para ${destinatario.trim()}.`); setAssunto(""); setMensagem(""); setDestinatario(""); setNomeDestinatario(""); setSelecionados([]); await carregar();
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail."); }
    finally { setEnviando(false); }
  };

  return <div className="route-enter mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><IndicadorPagina>Financeiro / E-mail</IndicadorPagina><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em]"><Mail className="text-primary" size={23} /> Central de e-mail</h1><p className="mt-1.5 text-[11px] text-muted-foreground">Envie documentos financeiros com contatos e links seguros do Share Brasil.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando} className="gap-2 border-border bg-card"> <RefreshCw size={13} className={carregando ? "animate-spin" : ""} /> Atualizar</Button></header>
    {(erro || sucesso) && <div className={`flex items-center gap-2 border p-3 text-[11px] ${erro ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>{erro ? <XCircle size={15} /> : <CheckCircle2 size={15} />}{erro || sucesso}</div>}
    <div className="grid gap-5 lg:grid-cols-[1.03fr_.97fr]">
      <section className="border border-border bg-card/60 shadow-xl"><div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Nova mensagem</p><p className="mt-1 text-xs text-muted-foreground">Selecione um contato ou use qualquer endereço.</p></div><ShieldCheck size={18} className="text-primary/70" /></div><div className="space-y-5 p-5">
        <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Destinatário</label><SeletorContatoEmail contatos={contatosFiltrados} busca={busca} emailSelecionado={destinatario} onBusca={setBusca} onSelecionar={selecionarContato} /><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={destinatario} onChange={(event) => { setDestinatario(event.target.value); setNomeDestinatario(""); }} placeholder="ou digite um e-mail" type="email" className="campo h-10" aria-label="E-mail do destinatário" /><span className="flex items-center border border-border bg-secondary/20 px-3 text-[10px] text-muted-foreground">{nomeDestinatario || "Contato manual"}</span></div></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Assunto</span><Input value={assunto} onChange={(event) => setAssunto(event.target.value)} placeholder="Ex.: Documentos financeiros" className="campo h-10" /></label><div className="hidden items-end sm:flex"><span className="mb-2 flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 size={12} /> envio imediato</span></div></div>
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Mensagem</span><Textarea value={mensagem} onChange={(event) => setMensagem(event.target.value)} placeholder="Escreva uma mensagem para o destinatário..." className="campo min-h-36 resize-y" /></label>
        <div><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Documentos para vincular</span><span className="font-mono text-[10px] text-primary">{selecionados.length} selecionado(s)</span></div><AnexosEmail anexos={anexos} selecionados={selecionados} onAlternar={alternarAnexo} /></div>
        <Button type="button" onClick={() => void enviar()} disabled={enviando || carregando} className="h-11 w-full gap-2 text-xs font-bold uppercase tracking-[.1em]"><Send size={15} /> {enviando ? "Enviando..." : "Enviar e-mail"}</Button>
      </div></section>
      <section className="space-y-5"><div className="border border-border bg-card/60 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Prévia do envio</p><h2 className="mt-2 truncate text-lg font-bold">{assunto || "Sem assunto"}</h2><p className="mt-1 break-all text-[10px] text-muted-foreground">Para: {destinatario || "Nenhum destinatário selecionado"}</p></div><Mail size={19} className="text-primary/60" /></div><div className="mt-5 min-h-28 border-l-2 border-primary/50 bg-secondary/15 p-4 text-[11px] leading-6 text-muted-foreground">{mensagem || "A mensagem aparecerá aqui antes do envio."}</div>{anexosSelecionados.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{anexosSelecionados.map((item) => <span key={item.id} className="inline-flex items-center gap-1.5 border border-border bg-secondary/30 px-2 py-1 text-[9px]"><FileText size={11} className="text-primary" />{item.nome}</span>)}</div>}</div>
        <div className="border border-border bg-card/60"><button type="button" onClick={() => setMostrarHistorico((atual) => !atual)} className="flex w-full items-center justify-between border-b border-border px-5 py-4 text-left"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em]"><History size={15} className="text-primary" /> Histórico de envios</span><span className="font-mono text-[10px] text-muted-foreground">{historico.length}</span></button>{mostrarHistorico && <div className="max-h-[470px] divide-y divide-border overflow-y-auto">{historico.length === 0 ? <p className="p-5 text-[11px] text-muted-foreground">Nenhum envio registrado.</p> : historico.map((item) => <div key={item.id} className="p-4"><div className="flex items-start gap-2"><span className={`mt-0.5 ${item.status === "enviado" ? "text-emerald-400" : "text-destructive"}`}>{item.status === "enviado" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{item.assunto}</p><p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{item.destinatarios.join(", ")}</p><p className="mt-2 text-[9px] text-muted-foreground">{dataBr(item.criado_em)} · {item.quantidade_anexos} documento(s)</p></div><span className="text-[9px] font-bold uppercase text-muted-foreground">{item.status}</span></div></div>)}</div>}</div>
      </section>
    </div>
  </div>;
}
