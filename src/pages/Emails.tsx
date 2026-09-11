import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Folder,
  Landmark,
  Loader2,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  MapPin,
  Smartphone,
  XCircle,
  Inbox,
  AlertCircle,
  FileEdit,
  Reply,
  Eye,
  X,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import ConfiguracaoContasBancarias from "@/components/email/ConfiguracaoContasBancarias";
import MinhaAssinaturaEmail from "@/pages/MinhaAssinaturaEmail";
import logoShare from "@/assets/share-signature-logo.png";
import {
  buscarCentralEmail,
  buscarContasBancariasEmail,
  buscarPerfilColaborador,
  buscarMinhaAssinatura,
  alterarEstadoMensagem,
  buscarContagemMensagensNaoLidas,
  buscarMensagensPasta,
  buscarUsuariosMensagem,
  enviarEmailCliente,
  enviarMensagemInterna,
  baixarAnexoMensagem,
  type AnexoEmail,
  type ContatoEmail,
  type ContaBancariaEmail,
  type PastaMensagem,
  type MensagemInterna,
  type UsuarioMensagem,
  type AssinaturaEmail,
  type EmailEnviado,
} from "@/lib/colaborador-api";

const dataBr = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const horaBr = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const rotuloReferenciaEmail = (tipo?: string | null) => ({
  recibo: "Recibo",
  recibo_saida: "Recibo de saída",
  nf_saida: "NF de saída",
  relatorio: "Relatório de viagem",
  relatorio_pdf: "Relatório de viagem",
  envio_despesa: "Envio de despesa",
}[String(tipo || "").toLowerCase()] || (tipo ? String(tipo).replace(/_/g, " ") : "Sem vínculo"));

const rotuloStatusEmail = (status?: string | null) => ({
  enviado: "Enviado",
  erro: "Erro",
  pendente: "Pendente",
  processando: "Processando",
  enviado_parcial: "Enviado parcialmente",
  cancelado: "Cancelado",
}[String(status || "").toLowerCase()] || status || "Desconhecido");

const normalizarEmailEnviado = (item: EmailEnviado): EmailEnviado => ({
  ...item,
  destinatarios: Array.isArray(item.destinatarios)
    ? item.destinatarios
    : (() => { try { const parsed = JSON.parse(String(item.destinatarios || "[]")); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } })(),
});

  type ToastData = { status: "sending" | "sent"; message: string };

export default function Emails() {
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioMensagem[]>([]);
  const [mensagensPasta, setMensagensPasta] = useState<MensagemInterna[]>([]);
  const [contagemNaoLidas, setContagemNaoLidas] = useState(0);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
  const [historicoEmails, setHistoricoEmails] = useState<EmailEnviado[]>([]);
  const [remetente, setRemetente] = useState<{ nome: string; email: string } | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaEmail | null>(null);

  const [busca, setBusca] = useState("");
  const [buscaGeral, setBuscaGeral] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nomeDestinatario, setNomeDestinatario] = useState("");
  const [tipoEnvio, setTipoEnvio] = useState<"email" | "interno">("email");
  const [destinatarioUsuarioId, setDestinatarioUsuarioId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [arquivosNovos, setArquivosNovos] = useState<File[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [pastaAtiva, setPastaAtiva] = useState<PastaMensagem>("inbox");
  const [modoCriacao, setModoCriacao] = useState(false);
  const [mensagemInternaSelecionada, setMensagemInternaSelecionada] = useState<MensagemInterna | null>(null);
  const [configAberta, setConfigAberta] = useState<"assinatura" | "bancarios" | null>(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaEmail[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [categoriasMensagem, setCategoriasMensagem] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("share-email-categorias") || "{}"); } catch { return {}; }
  });
  const [anexoVisualizado, setAnexoVisualizado] = useState<{ nome: string; tipo: string; url: string } | null>(null);

  const carregarPasta = async (pasta: PastaMensagem = pastaAtiva) => {
    try {
      const mensagens = await buscarMensagensPasta(pasta);
      setMensagensPasta(Array.isArray(mensagens) ? mensagens : []);
      if (mensagemInternaSelecionada && !mensagens.some((item) => item.id === mensagemInternaSelecionada.id)) setMensagemInternaSelecionada(null);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as mensagens.");
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const [dados, perfil, assinaturaAtual, mensagens, usuariosResponse, naoLidas] = await Promise.all([buscarCentralEmail(), buscarPerfilColaborador(), buscarMinhaAssinatura(), buscarMensagensPasta(pastaAtiva), buscarUsuariosMensagem(), buscarContagemMensagensNaoLidas()]);
      setRemetente({ nome: perfil.perfil.nome_exibicao || perfil.perfil.nome_completo, email: perfil.perfil.email });
      setAssinatura(assinaturaAtual);
      setContatos(Array.isArray(dados?.contatos) ? dados.contatos : []);
      setAnexos(Array.isArray(dados?.anexos) ? dados.anexos : []);
      setHistoricoEmails(Array.isArray(dados?.historico) ? dados.historico.map(normalizarEmailEnviado) : []);
      setMensagensPasta(Array.isArray(mensagens) ? mensagens : []);
      setUsuarios(Array.isArray(usuariosResponse?.usuarios) ? usuariosResponse.usuarios : []);
      setContagemNaoLidas(Number(naoLidas?.unread || 0));
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar a central de e-mail.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [pastaAtiva]);

  useEffect(() => {
    if (configAberta !== "bancarios" && !modoCriacao) return;
    void buscarContasBancariasEmail().then((dados) => setContasBancarias(dados.contas)).catch(() => setErro("Não foi possível carregar as contas bancárias."));
  }, [configAberta, modoCriacao]);

  useEffect(() => {
    if (!erro && !sucesso) return;
    const timer = window.setTimeout(() => {
      setErro("");
      setSucesso("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [erro, sucesso]);

  const contatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contatos;
    return contatos.filter((item) =>
      `${item.nome} ${item.email} ${item.tipo}`.toLowerCase().includes(termo),
    );
  }, [busca, contatos]);

  const anexosSelecionados = useMemo(
    () => anexos.filter((item) => selecionados.includes(item.id)),
    [anexos, selecionados],
  );

  const selecionarContato = (contato: ContatoEmail) => {
    const atuais = destinatario.split(";").map((email) => email.trim()).filter(Boolean);
    if (!atuais.some((email) => email.toLowerCase() === contato.email.toLowerCase())) {
      setDestinatario([...atuais, contato.email].join("; "));
    }
    setNomeDestinatario(atuais.length === 0 ? contato.nome : "");
  };

  const alternarAnexo = (id: string) => {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  };

  const inserirDadosBancarios = (conta: ContaBancariaEmail) => {
    setMensagem((atual) => atual.trim() ? `${atual.trim()}\n\n${conta.texto}` : conta.texto);
  };

  const classificarMensagem = (id: string, categoria: string) => {
    const atual = { ...categoriasMensagem, [id]: categoria };
    setCategoriasMensagem(atual);
    localStorage.setItem("share-email-categorias", JSON.stringify(atual));
    setSucesso(`Mensagem classificada como ${categoria}.`);
  };

  const limparFormulario = () => {
    setAssunto("");
    setMensagem("");
    setDestinatario("");
    setNomeDestinatario("");
    setDestinatarioUsuarioId("");
    setTipoEnvio("email");
    setSelecionados([]);
    setArquivosNovos([]);
    setBusca("");
  };

  const enviar = async () => {
    if (!destinatario.trim() || !assunto.trim() || !mensagem.trim()) {
      setErro("Informe destinatário, assunto e mensagem.");
      setSucesso("");
      return;
    }

    setEnviando(true);
    setErro("");
    setSucesso("");
    setToast({ status: "sending", message: tipoEnvio === "email" ? "Enviando e-mail..." : "Enviando mensagem..." });

    try {
      const destinatarios = destinatario.split(";").map((email) => email.trim()).filter(Boolean);
      if (tipoEnvio === "interno") {
        if (!destinatarioUsuarioId) { setToast(null); setErro("Selecione um usuário destinatário."); return; }
        await enviarMensagemInterna({ destinatario_id: destinatarioUsuarioId, assunto: assunto.trim(), conteudo: mensagem.trim(), arquivos: arquivosNovos });
      } else await enviarEmailCliente({ destinatarios, assunto: assunto.trim(), mensagem: mensagem.trim(), anexos: anexosSelecionados.map(({ id }) => id), arquivos: arquivosNovos, nome_destinatario: nomeDestinatario || undefined });

      setSucesso(tipoEnvio === "interno" ? "Mensagem interna enviada para o inbox do usuário." : `E-mail enviado com sucesso para ${destinatarios.join(", ")}.`);
      setToast({ status: "sent", message: tipoEnvio === "email" ? "Enviado" : "Mensagem enviada" });
      window.setTimeout(() => setToast(null), 1400);
      limparFormulario();
      setModoCriacao(false);
      await carregar();
    } catch (cause) {
      setToast(null);
      setErro(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.");
    } finally {
      setEnviando(false);
    }
  };

  const mensagensFiltradas = useMemo(() => {
    const termo = buscaGeral.trim().toLowerCase();
    if (!termo) return mensagensPasta;
    return mensagensPasta.filter((item) => `${item.assunto || ""} ${item.conteudo} ${item.remetente_nome} ${item.destinatario_nome}`.toLowerCase().includes(termo));
  }, [mensagensPasta, buscaGeral]);
  const mensagensVisiveis = useMemo(() => categoriaAtiva ? mensagensFiltradas.filter((item) => categoriasMensagem[item.id] === categoriaAtiva) : mensagensFiltradas, [mensagensFiltradas, categoriaAtiva, categoriasMensagem]);

  const atualizarMensagem = async (id: string, estado: Parameters<typeof alterarEstadoMensagem>[1], mensagemSucesso: string) => {
    try {
      await alterarEstadoMensagem(id, estado);
      setMensagemInternaSelecionada((atual) => atual?.id === id ? { ...atual, ...estado } : atual);
      setSucesso(mensagemSucesso);
      await Promise.all([carregarPasta(), buscarContagemMensagensNaoLidas().then(({ unread }) => setContagemNaoLidas(unread))]);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível atualizar a mensagem.");
    }
  };

  const abrirAnexoMensagem = async (mensagemId: string, anexoId: string, nomeArquivo: string) => {
    try {
      const blob = await baixarAnexoMensagem(mensagemId, anexoId);
      const url = URL.createObjectURL(blob);
      setAnexoVisualizado({ nome: nomeArquivo, tipo: blob.type || "application/pdf", url });
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível abrir o anexo.");
    }
  };

  return (
    <div className="route-enter relative mx-auto -m-[22px] flex h-[calc(100vh-6rem)] max-w-[1500px] flex-col space-y-3 overflow-hidden rounded-[9px] border border-[#0e141f] bg-[#060e16] pb-3 text-slate-100">
      {toast && <EmailToast toast={toast} onDone={() => setToast(null)} />}
      {anexoVisualizado && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label={`Visualização de ${anexoVisualizado.nome}`}>
        <div className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><Eye size={16} className="text-primary" /><span className="truncate text-sm font-bold">{anexoVisualizado.nome}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => { URL.revokeObjectURL(anexoVisualizado.url); setAnexoVisualizado(null); }}><X size={17} /></Button></div>
          <div className="min-h-0 flex-1 bg-muted/20 p-3">{anexoVisualizado.tipo.includes("pdf") ? <iframe title={anexoVisualizado.nome} src={anexoVisualizado.url} className="h-full w-full rounded-xl bg-white" /> : anexoVisualizado.tipo.startsWith("image/") ? <img src={anexoVisualizado.url} alt={anexoVisualizado.nome} className="mx-auto h-full max-w-full rounded-xl object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Este tipo de arquivo não possui pré-visualização. Use o download para abrir no aplicativo compatível.</div>}</div>
        </div>
      </div>}
      {/* HEADER DE AÇÕES GLOBAIS */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/[.06] bg-[#080b16] px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1e5b94] text-sky-300 shadow-lg shadow-sky-950/30">
            <Mail className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void carregar()}
            disabled={carregando}
            className="h-8 gap-2 rounded-md border-white/[.08] bg-[#0d1525] text-[10px] text-slate-300 hover:bg-white/[.06]"
          >
            <RefreshCw size={14} className={carregando ? "animate-spin text-primary" : "text-muted-foreground"} />
            Atualizar
          </Button>
        </div>
      </header>

      {/* STATUS */}
      {(erro || sucesso) && (
        <div className={`flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-sm ${erro ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
          {erro ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{erro || sucesso}</span>
        </div>
      )}

      {/* LAYOUT PRINCIPAL EM 3 COLUNAS (empilha em telas menores que lg) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">

        {/* COLUNA 1: MENU LATERAL */}
        <aside className="hidden min-h-0 flex-col gap-6 overflow-y-auto -my-[6px] rounded-[12px] border-r border-white/[.06] bg-[#080b16] px-3 pb-4 lg:col-span-2 lg:flex">
          <Button
            type="button"
            onClick={() => {
              setModoCriacao(true);
              setConfigAberta(null);
              setMensagemInternaSelecionada(null);
              limparFormulario();
            }}
            className="mt-3 h-10 w-full gap-2 overflow-hidden rounded-[31px] border-[#058dcc] bg-[#075461] px-2 text-[12px] font-semibold text-white shadow-md shadow-sky-950/30 hover:bg-[#2d79bb]"
          >
            <Plus size={18} />
            Novo Email
          </Button>

          <nav className="space-y-1 text-[11px] font-medium">
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("inbox"); setModoCriacao(false); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 transition-colors ${pastaAtiva === "inbox" && !modoCriacao ? "bg-[#102b4e] text-sky-300 shadow-[inset_2px_0_0_#34a9ed]" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`}>
              <span className="flex items-center gap-3"><Inbox size={15} /> Caixa de Entrada</span>
              {contagemNaoLidas > 0 && <span className="rounded bg-[#1d639f] px-1.5 py-0.5 text-[9px] font-bold text-white">{contagemNaoLidas}</span>}
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("enviadas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${pastaAtiva === "enviadas" && !modoCriacao ? "bg-[#102b4e] text-sky-300 shadow-[inset_2px_0_0_#34a9ed]" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`}>
              <Send size={15} /> Enviados
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("arquivo"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${pastaAtiva === "arquivo" && !modoCriacao ? "bg-[#102b4e] text-sky-300 shadow-[inset_2px_0_0_#34a9ed]" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`}>
              <Archive size={15} /> Arquivo
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("nao-lidas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${pastaAtiva === "nao-lidas" && !modoCriacao ? "bg-[#102b4e] text-sky-300 shadow-[inset_2px_0_0_#34a9ed]" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`}>
              <AlertCircle size={15} /> Não lidas
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("favoritas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${pastaAtiva === "favoritas" && !modoCriacao ? "bg-[#102b4e] text-sky-300 shadow-[inset_2px_0_0_#34a9ed]" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-200"}`}>
              <Star size={15} /> Favoritas
            </button>
          </nav>

          <div className="border-t border-border/50 pt-4">
            <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categorias</h3>
            <div className="space-y-1">
              {[['Financeiro', 'bg-emerald-500'], ['Operacional', 'bg-blue-500'], ['Urgente', 'bg-destructive']].map(([categoria, cor]) => <button key={categoria} onClick={() => setCategoriaAtiva(categoriaAtiva === categoria ? null : categoria)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50 ${categoriaAtiva === categoria ? "bg-primary/10 font-bold text-primary" : ""}`}><div className={`h-2 w-2 rounded-full ${cor}`}></div> {categoria}</button>)}
            </div>
          </div>

          <div className="space-y-1 border-t border-border/50 pt-4">
            <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Configurações rápidas</h3>
            <button onClick={() => { setConfigAberta("assinatura"); setModoCriacao(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50"><Settings size={17} /> Assinatura fixa</button>
            <button onClick={() => { setConfigAberta("bancarios"); setModoCriacao(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50"><Landmark size={17} /> Contas bancárias</button>
          </div>

          <div className="mt-auto pt-4">
            <div className="mb-2 flex items-end justify-between px-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Armazenamento</h3>
              <span className="text-xs font-bold text-foreground">82%</span>
            </div>
            <div className="mx-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[82%] rounded-full bg-primary/70"></div>
            </div>
          </div>
        </aside>

        {/* COLUNA 2: LISTA DE E-MAILS */}
        {!modoCriacao && <div className="col-span-1 flex min-h-0 min-w-0 flex-col overflow-hidden border border-white/[.06] bg-[#09111f] shadow-sm lg:col-span-4">
          <div className="border-b border-white/[.06] bg-[#080f1d] p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaGeral}
                onChange={(e) => setBuscaGeral(e.target.value)}
                placeholder="Buscar mensagens..."
                className="h-8 rounded-md border-white/[.06] bg-[#080f1d] pl-9 text-[10px] text-slate-300 shadow-none placeholder:text-slate-600 focus:border-sky-500/40"
              />
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {mensagensFiltradas.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Mail className="mb-2 h-8 w-8 opacity-20" />
                Nenhuma mensagem encontrada.
              </div>
            ) : mensagensVisiveis.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setMensagemInternaSelecionada(item);
                  setModoCriacao(false);
                  if (!item.lida && item.papel === "destinatario") void atualizarMensagem(item.id, { lida: 1 }, "");
                }}
                className={`flex w-full flex-col gap-1 rounded-md p-3 text-left transition-all ${mensagemInternaSelecionada?.id === item.id && !modoCriacao ? "border-l-2 border-l-sky-400 bg-[#0d1a31]" : "border-l-2 border-l-transparent hover:bg-white/[.025]"}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`truncate text-[10px] ${item.lida ? "font-medium text-slate-300" : "font-bold text-white"}`}>
                    {item.papel === "remetente" ? item.destinatario_nome || item.destinatario_id : item.remetente_nome || item.remetente_id}
                  </span>
                  <span className="shrink-0 text-[9px] text-slate-600">
                    {horaBr(item.criado_em)}
                  </span>
                </div>
                <span className={`truncate text-[10px] ${item.lida ? "text-slate-400" : "font-semibold text-sky-300"}`}>
                  {item.assunto || "(Sem assunto)"}
                </span>
                <p className="truncate text-[9px] text-slate-600">
                  {item.conteudo?.substring(0, 50)}...
                </p>
              </button>
            ))}
            <div className="mt-3 border-t border-white/[.08] pt-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <h3 className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Histórico de e-mails</h3>
                <span className="text-[9px] font-semibold text-slate-600">{historicoEmails.length}</span>
              </div>
              {historicoEmails.length === 0 ? (
                <p className="px-2 py-3 text-[10px] text-slate-600">Nenhum e-mail enviado por esta conta.</p>
              ) : historicoEmails.map((email) => {
                const status = String(email.status || "").toLowerCase();
                const sucessoEnvio = status === "enviado";
                const falhaEnvio = status === "erro" || status === "cancelado";
                return (
                  <div key={email.id} className="rounded-md border border-white/[.06] bg-[#0b1525] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-slate-200" title={email.assunto}>{email.assunto || "(Sem assunto)"}</p>
                        <p className="mt-0.5 truncate text-[9px] text-slate-500" title={email.destinatarios.join(", ")}>{email.destinatarios.join(", ") || "Destinatário não informado"}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${sucessoEnvio ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : falhaEnvio ? "border-red-400/25 bg-red-400/10 text-red-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}`}>
                        {sucessoEnvio ? <CheckCircle2 size={10} /> : falhaEnvio ? <XCircle size={10} /> : <Clock3 size={10} />}
                        {rotuloStatusEmail(email.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-600">
                      <span>{dataBr(email.criado_em)}</span>
                      <span>•</span>
                      <span>{email.quantidade_anexos || 0} anexo{email.quantidade_anexos === 1 ? "" : "s"}</span>
                      {email.referencia_tipo && <><span>•</span><span className="text-sky-400/80">{rotuloReferenciaEmail(email.referencia_tipo)}: {email.referencia_id || "—"}</span></>}
                    </div>
                    {email.erro && <p className="mt-1 truncate text-[9px] text-red-300/80" title={email.erro}>Erro: {email.erro}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>}

        {/* COLUNA 3: ÁREA DE LEITURA OU NOVA MENSAGEM */}
        <div className={`col-span-1 flex min-h-0 min-w-0 flex-col overflow-hidden border border-white/[.06] bg-[#080f1d] shadow-sm ${modoCriacao ? "-m-[7px] rounded-[8px] py-[2px] lg:col-span-10" : "lg:col-span-6"}`}>
          {mensagemInternaSelecionada && !modoCriacao && !configAberta ? (
            <div className="flex h-full min-h-0 flex-col">
              {/* Cabeçalho da Mensagem */}
              <div className="flex shrink-0 flex-col gap-3 border-b border-white/[.06] bg-[#080e1a] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold tracking-tight text-white">
                      {mensagemInternaSelecionada.papel === "remetente" ? mensagemInternaSelecionada.destinatario_nome || mensagemInternaSelecionada.destinatario_id : mensagemInternaSelecionada.remetente_nome || mensagemInternaSelecionada.remetente_id}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-sky-400">
                      Para: <span className="text-sky-500">{mensagemInternaSelecionada.papel === "remetente" ? "Você" : mensagemInternaSelecionada.destinatario_id}</span>
                    </p>
                </div>
                <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void atualizarMensagem(mensagemInternaSelecionada.id, { excluida: 1 }, "Mensagem movida para o arquivo.")} className="h-8 gap-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white/[.05] hover:text-red-300"><Trash2 size={14} /> Excluir</Button>
                    <select value={categoriasMensagem[mensagemInternaSelecionada.id] || ""} onChange={(event) => classificarMensagem(mensagemInternaSelecionada.id, event.target.value)} className="h-8 rounded-md border border-white/[.08] bg-[#0d1525] px-2 text-[10px] font-semibold text-slate-400"><option value="">Categoria</option><option value="Financeiro">Financeiro</option><option value="Operacional">Operacional</option><option value="Urgente">Urgente</option></select>
                  </div>
                  <div className="text-[9px] font-medium text-slate-600">
                    {dataBr(mensagemInternaSelecionada.criado_em)} <span className="mx-1">•</span> {horaBr(mensagemInternaSelecionada.criado_em)}
                  </div>
                </div>
              </div>

              {/* Assunto e Corpo */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                <h1 className="mb-6 text-lg font-bold tracking-tight text-white sm:text-xl">
                  {mensagemInternaSelecionada.assunto || "(Sem assunto)"}
                </h1>
                <div className="max-w-3xl whitespace-pre-wrap text-xs font-medium leading-6 text-slate-400">
                  {mensagemInternaSelecionada.conteudo}
                </div>

                {/* Anexos */}
                {!!mensagemInternaSelecionada.anexos?.length && (
                  <div className="mt-10 border-t border-border/40 pt-6">
                    <p className="mb-4 text-[9px] font-bold uppercase tracking-[.14em] text-slate-600">
                      Anexos ({mensagemInternaSelecionada.anexos.length} Arquivo{mensagemInternaSelecionada.anexos.length > 1 ? "s" : ""})
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {mensagemInternaSelecionada.anexos.map((anexo) => (
                        <button
                          type="button"
                          key={anexo.id}
                          onClick={() => void abrirAnexoMensagem(mensagemInternaSelecionada.id, anexo.id, anexo.nome_arquivo)}
                          className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-[#111b2b] px-4 py-3 text-left transition-colors hover:border-sky-500/30 hover:bg-[#14243a]"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/15 text-red-400">
                            <Eye size={20} />
                          </div>
                          <div>
                            <span className="block max-w-[200px] truncate text-[10px] font-semibold text-slate-200">{anexo.nome_arquivo}</span>
                              <span className="mt-0.5 block text-[9px] font-medium uppercase text-slate-600">Abrir na tela</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé interativo simulando clique rápido */}
              <div className="shrink-0 border-t border-white/[.06] bg-[#080e1a] p-4">
                <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[.1] bg-[#111a29] p-3 text-[10px] text-slate-600 transition-colors hover:border-sky-500/30 hover:text-slate-400">
                  <Reply size={16} />
                  Clique aqui para <strong>Responder</strong> ou <strong>Encaminhar</strong> esta mensagem.
                </div>
              </div>
            </div>
          ) : configAberta ? (
            <div className="h-full space-y-5 overflow-y-auto p-4 sm:p-6">
              {configAberta === "assinatura" ? <MinhaAssinaturaEmail embedded /> : <ConfiguracaoContasBancarias contas={contasBancarias} onSaved={() => { void buscarContasBancariasEmail().then((dados) => setContasBancarias(dados.contas)); }} />}
            </div>
          ) : modoCriacao ? (
            /* COMPOSITOR DE NOVA MENSAGEM */
            <div className="flex h-full min-h-0 -mx-px flex-col overflow-hidden rounded-[31px]">
              <div className="flex shrink-0 items-center justify-between -my-[11px] overflow-hidden rounded-[26px] border-b border-white/[.06] bg-[#080e1a] p-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Nova Mensagem</h2>
                  <p className="mt-0.5 text-[9px] font-medium text-slate-600">De: {remetente?.email || "seu e-mail"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setModoCriacao(false)} className="rounded-xl">Descartar</Button>
              </div>

              {/* Campos + corpo da mensagem: rola junto, mas o textarea tem prioridade de espaço */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[17px] bg-[#040a16] p-4 sm:p-6">
                <div className="shrink-0 space-y-4 py-[10px]">
                  <div className="flex w-fit -mx-[8px] gap-[15px] rounded-md border border-white/[.08] bg-[#0d1525] px-[13px] py-1">
                    <button type="button" onClick={() => { setTipoEnvio("email"); setDestinatarioUsuarioId(""); setDestinatario(""); }} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors ${tipoEnvio === "email" ? "bg-[#1e5b94] text-white" : "text-slate-500 hover:bg-white/[.05]"}`}><Mail size={12} className="mr-1.5 inline" /> E-mail externo</button>
                    <button type="button" onClick={() => { setTipoEnvio("interno"); setDestinatario(""); setNomeDestinatario(""); }} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors ${tipoEnvio === "interno" ? "bg-[#1e5b94] text-white" : "text-slate-500 hover:bg-white/[.05]"}`}><UserRound size={12} className="mr-1.5 inline" /> Interno</button>
                  </div>

                  <div className="border-b border-white/[.06] pb-3">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Para</label>
                    {tipoEnvio === "interno" ? (
                      <SearchableCombobox items={usuarios.map((usuario) => ({ id: usuario.id, label: `${usuario.nome} · ${usuario.email}`, search: `${usuario.nome} ${usuario.email} ${usuario.departamento || ""}` }))} value={destinatarioUsuarioId} onChange={(id, label) => { const usuario = usuarios.find((item) => item.id === id); setDestinatarioUsuarioId(id); setDestinatario(usuario?.email || label); }} placeholder="Busque usuário corporativo..." searchPlaceholder="Digite nome..." emptyMessage="Usuário não encontrado." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <SeletorContatoEmail contatos={contatosFiltrados} busca={busca} emailSelecionado={destinatario} onBusca={setBusca} onSelecionar={selecionarContato} />
                        <Input value={destinatario} onChange={(e) => { setDestinatario(e.target.value); setNomeDestinatario(""); }} placeholder="E-mail do destinatário..." className="h-11 -mx-[3px] rounded-xl border-white/[.08] bg-[#0d1525] px-[22px] py-[2px] text-sm font-medium text-slate-200" />
                      </div>
                    )}
                  </div>

                  <div className="border-b border-white/[.06] pb-1">
                    <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto" className="h-10 rounded-none border-0 bg-transparent px-0 text-sm font-bold text-white shadow-none placeholder:text-slate-600 focus-visible:ring-0" />
                  </div>
                </div>

                <div className="mt-3 flex min-h-[220px] flex-1 flex-col">
                  <Textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Escreva sua mensagem aqui..."
                    className="min-h-[220px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 text-sm font-medium leading-relaxed text-slate-200 shadow-none focus-visible:ring-0"
                  />

                  {tipoEnvio === "email" && assinatura && (
                    <div className="mt-6 shrink-0 border-t border-white/[.06] pt-4">
                      <div className="flex items-center gap-4 opacity-80">
                        <img src={assinatura.logo_url || logoShare} alt="Logo" className="h-10 w-auto object-contain grayscale" />
                        <div className="text-[11px] leading-tight text-slate-500">
                          <strong className="block text-sm text-slate-200">{assinatura.nome || "Nome"}</strong>
                          {assinatura.cargo && <span className="mt-0.5 block">{assinatura.cargo}</span>}
                          {assinatura.telefone && <span className="mt-0.5 block">{assinatura.telefone}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {tipoEnvio === "email" && contasBancarias.length > 0 && (
                    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500">Inserir banco:</span>
                      {contasBancarias.map((conta) => (
                        <Button key={conta.id} type="button" variant="outline" size="sm" onClick={() => inserirDadosBancarios(conta)} className="h-7 gap-1 rounded-lg border-white/[.08] bg-[#0d1525] text-[10px] text-slate-300">
                          <Building2 size={12} /> {conta.banco}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé: anexos agora abrem em um Command (⌘K) por cima do conteúdo, não ocupam espaço fixo */}
              <div className="flex shrink-0 flex-col gap-3 -my-[43px] border-t border-white/[.06] bg-[#080e1a] px-3 py-[39px] sm:px-4 sm:py-[39px]">
                <AnexosEmail
                  anexos={anexos}
                  selecionados={selecionados}
                  onAlternar={alternarAnexo}
                  arquivosNovos={arquivosNovos}
                  onAdicionarArquivos={(novos) => setArquivosNovos((prev) => [...prev, ...novos])}
                  onRemoverArquivo={(idx) => setArquivosNovos((prev) => prev.filter((_, i) => i !== idx))}
                />
                <div className="flex -my-[7px] items-center justify-end py-0">
                  <Button onClick={() => void enviar()} disabled={enviando} className="m-[32px] h-9 justify-end gap-2 rounded-md bg-[#22629d] px-4 py-0 text-[10px] font-bold text-white shadow-md shadow-sky-950/30 hover:bg-[#2d79bb]">
                    <Send size={16} />
                    {enviando ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* TELA VAZIA (NENHUM SELECIONADO) */
            <div className="flex h-full flex-1 flex-col items-center justify-center bg-card/20 p-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-primary/10 bg-primary/5">
                <Inbox size={32} className="text-primary/40" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Caixa de Mensagens</h3>
              <p className="mt-2 max-w-[250px] text-sm text-muted-foreground">
                Selecione um e-mail na lista lateral para visualizar o conteúdo completo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailToast({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  const isSent = toast.status === "sent";
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl ${isSent ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-sky-400/20 bg-sky-500/15 text-sky-300"}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={() => { if (isSent) onDone(); }}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${isSent ? "bg-emerald-500 text-white" : "bg-sky-500 text-white"}`}>
        {isSent ? <Check size={12} /> : <Loader2 size={11} className="animate-spin" />}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}
