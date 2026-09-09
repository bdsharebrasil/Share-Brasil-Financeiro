import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Folder,
  Landmark,
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

export default function Emails() {
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioMensagem[]>([]);
  const [mensagensPasta, setMensagensPasta] = useState<MensagemInterna[]>([]);
  const [contagemNaoLidas, setContagemNaoLidas] = useState(0);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
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

  const assinaturaComoTexto = assinatura
    ? `\n\n--\n${assinatura.nome || ""}${assinatura.cargo ? `\n${assinatura.cargo}` : ""}${assinatura.telefone ? `\n${assinatura.telefone}` : ""}${assinatura.email ? `\n${assinatura.email}` : ""}${assinatura.endereco ? `\n${assinatura.endereco}` : ""}`
    : "";

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

    try {
      const destinatarios = destinatario.split(";").map((email) => email.trim()).filter(Boolean);
      if (tipoEnvio === "interno") {
        if (!destinatarioUsuarioId) { setErro("Selecione um usuário destinatário."); return; }
        await enviarMensagemInterna({ destinatario_id: destinatarioUsuarioId, assunto: assunto.trim(), conteudo: mensagem.trim(), arquivos: arquivosNovos });
      } else await enviarEmailCliente({ destinatarios, assunto: assunto.trim(), mensagem: `${mensagem.trim()}${assinaturaComoTexto}`, anexos: anexosSelecionados.map(({ id }) => id), arquivos: arquivosNovos, nome_destinatario: nomeDestinatario || undefined });

      setSucesso(tipoEnvio === "interno" ? "Mensagem interna enviada para o inbox do usuário." : `E-mail enviado com sucesso para ${destinatarios.join(", ")}.`);
      limparFormulario();
      setModoCriacao(false);
      await carregar();
    } catch (cause) {
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
    <div className="route-enter relative mx-auto max-w-[1400px] h-[calc(100vh-6rem)] flex flex-col pb-4 space-y-4">
      {anexoVisualizado && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label={`Visualização de ${anexoVisualizado.nome}`}>
        <div className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><Eye size={16} className="text-primary" /><span className="truncate text-sm font-bold">{anexoVisualizado.nome}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => { URL.revokeObjectURL(anexoVisualizado.url); setAnexoVisualizado(null); }}><X size={17} /></Button></div>
          <div className="min-h-0 flex-1 bg-muted/20 p-3">{anexoVisualizado.tipo.includes("pdf") ? <iframe title={anexoVisualizado.nome} src={anexoVisualizado.url} className="h-full w-full rounded-xl bg-white" /> : anexoVisualizado.tipo.startsWith("image/") ? <img src={anexoVisualizado.url} alt={anexoVisualizado.nome} className="mx-auto h-full max-w-full rounded-xl object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Este tipo de arquivo não possui pré-visualização. Use o download para abrir no aplicativo compatível.</div>}</div>
        </div>
      </div>}
      {/* HEADER DE AÇÕES GLOBAIS */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void carregar()}
            disabled={carregando}
            className="h-9 gap-2 rounded-xl border-border/60 bg-card/40"
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

      {/* LAYOUT PRINCIPAL EM 3 COLUNAS */}
      <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-12 ml-[-19px]">
        
        {/* COLUNA 1: MENU LATERAL */}
        <aside className="hidden lg:flex flex-col col-span-2 space-y-6 overflow-y-auto ml-2 mr-2 pl-[2px] pr-4 pb-4">
          <Button
            type="button"
            onClick={() => {
              setModoCriacao(true);
              setConfigAberta(null);
              setMensagemInternaSelecionada(null);
              limparFormulario();
            }}
            className="w-full h-11 min-h-5 mx-[3px] px-2 gap-2 rounded-xl font-normal leading-4 text-[17px] text-[rgba(1,10,20,1)] shadow-md bg-[rgba(110,191,228,0.9)] hover:bg-[rgba(110,191,228,0.9)]"
          >
            <Plus size={18} />
            Novo Email
          </Button>

          <nav className="space-y-1 text-sm font-medium">
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("inbox"); setModoCriacao(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${pastaAtiva === "inbox" && !modoCriacao ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted/50"}`}>
              <span className="flex items-center gap-3"><Inbox size={18} /> Caixa de Entrada</span>
              {contagemNaoLidas > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{contagemNaoLidas}</span>}
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("enviadas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${pastaAtiva === "enviadas" && !modoCriacao ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted/50"}`}>
              <Send size={18} /> Enviados
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("arquivo"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${pastaAtiva === "arquivo" && !modoCriacao ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted/50"}`}>
              <FileEdit size={18} /> Rascunhos
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("nao-lidas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${pastaAtiva === "nao-lidas" && !modoCriacao ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted/50"}`}>
              <AlertCircle size={18} /> Spam
            </button>
            <button onClick={() => { setMensagemInternaSelecionada(null); setConfigAberta(null); setPastaAtiva("favoritas"); setModoCriacao(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${pastaAtiva === "favoritas" && !modoCriacao ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted/50"}`}>
              <Trash2 size={18} /> Lixeira
            </button>
          </nav>

          <div className="pt-4 border-t border-border/50">
            <h3 className="px-3 mb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Categorias</h3>
            <div className="space-y-1">
              {[['Financeiro', 'bg-emerald-500'], ['Operacional', 'bg-blue-500'], ['Urgente', 'bg-destructive']].map(([categoria, cor]) => <button key={categoria} onClick={() => setCategoriaAtiva(categoriaAtiva === categoria ? null : categoria)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50 ${categoriaAtiva === categoria ? "bg-primary/10 font-bold text-primary" : ""}`}><div className={`h-2 w-2 rounded-full ${cor}`}></div> {categoria}</button>)}
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 space-y-1">
            <h3 className="px-3 mb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Configurações rápidas</h3>
            <button onClick={() => { setConfigAberta("assinatura"); setModoCriacao(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50"><Settings size={17} /> Assinatura fixa</button>
            <button onClick={() => { setConfigAberta("bancarios"); setModoCriacao(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50"><Landmark size={17} /> Contas bancárias</button>
          </div>

          <div className="pt-4 mt-auto">
            <div className="flex justify-between items-end px-3 mb-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Armazenamento</h3>
              <span className="text-xs font-bold text-foreground">82%</span>
            </div>
            <div className="mx-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary/70 w-[82%] rounded-full"></div>
            </div>
          </div>
        </aside>

        {/* COLUNA 2: LISTA DE E-MAILS */}
        {!modoCriacao && <div className="flex flex-col col-span-1 lg:col-span-4 ml-[-15px] mr-[-15px] pl-[3px] pr-[3px] rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden shadow-sm">
          <div className="p-3 border-b border-border/50 bg-card/50">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaGeral}
                onChange={(e) => setBuscaGeral(e.target.value)}
                placeholder="Buscar mensagens..."
                className="h-10 rounded-xl bg-background/50 pl-10 text-sm border-border/60 shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mensagensFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center text-xs text-muted-foreground">
                <Mail className="h-8 w-8 mb-2 opacity-20" />
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
                className={`w-full flex flex-col gap-1 rounded-xl p-3 text-left transition-all ${mensagemInternaSelecionada?.id === item.id && !modoCriacao ? "bg-primary/10 border border-primary/20 shadow-sm" : "border border-transparent hover:bg-muted/60"}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`truncate text-sm ${item.lida ? "font-semibold text-foreground/90" : "font-bold text-foreground"}`}>
                    {item.papel === "remetente" ? item.destinatario_nome || item.destinatario_id : item.remetente_nome || item.remetente_id}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground font-medium">
                    {horaBr(item.criado_em)}
                  </span>
                </div>
                <span className={`truncate text-xs ${item.lida ? "text-foreground/70" : "font-semibold text-foreground"}`}>
                  {item.assunto || "(Sem assunto)"}
                </span>
                <p className="truncate text-xs text-muted-foreground">
                  {item.conteudo?.substring(0, 50)}...
                </p>
              </button>
            ))}
          </div>
        </div>}

        {/* COLUNA 3: ÁREA DE LEITURA OU NOVA MENSAGEM */}
        <div className="flex flex-col col-span-1 lg:col-span-6 ml-[13px] mr-[13px] rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
          {mensagemInternaSelecionada && !modoCriacao && !configAberta ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Cabeçalho da Mensagem */}
              <div className="p-6 border-b border-border/50 bg-card/40 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                      {mensagemInternaSelecionada.papel === "remetente" ? mensagemInternaSelecionada.destinatario_nome || mensagemInternaSelecionada.destinatario_id : mensagemInternaSelecionada.remetente_nome || mensagemInternaSelecionada.remetente_id}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                      Para: {mensagemInternaSelecionada.papel === "remetente" ? "Você" : mensagemInternaSelecionada.destinatario_id}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void atualizarMensagem(mensagemInternaSelecionada.id, { excluida: 1 }, "Mensagem movida para a lixeira.")} className="h-8 gap-1.5 text-xs font-semibold text-destructive hover:text-destructive"><Trash2 size={14} /> Excluir</Button>
                      <select value={categoriasMensagem[mensagemInternaSelecionada.id] || ""} onChange={(event) => classificarMensagem(mensagemInternaSelecionada.id, event.target.value)} className="h-8 rounded-lg border border-border/60 bg-background px-2 text-[11px] font-semibold"><option value="">Categoria</option><option value="Financeiro">Financeiro</option><option value="Operacional">Operacional</option><option value="Urgente">Urgente</option></select>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {dataBr(mensagemInternaSelecionada.criado_em)} <span className="mx-1">•</span> {horaBr(mensagemInternaSelecionada.criado_em)}
                  </div>
                </div>
              </div>

              {/* Assunto e Corpo */}
              <div className="p-8 flex-1 overflow-y-auto">
                <h1 className="text-2xl font-bold text-foreground mb-6">
                  {mensagemInternaSelecionada.assunto || "(Sem assunto)"}
                </h1>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-medium">
                  {mensagemInternaSelecionada.conteudo}
                </div>

                {/* Anexos */}
                {!!mensagemInternaSelecionada.anexos?.length && (
                  <div className="mt-10 pt-6 border-t border-border/40">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
                      Anexos ({mensagemInternaSelecionada.anexos.length} Arquivo{mensagemInternaSelecionada.anexos.length > 1 ? "s" : ""})
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {mensagemInternaSelecionada.anexos.map((anexo) => (
                        <button 
                          type="button" 
                          key={anexo.id} 
                          onClick={() => void abrirAnexoMensagem(mensagemInternaSelecionada.id, anexo.id, anexo.nome_arquivo)} 
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-left hover:border-primary/50 hover:bg-primary/[.02] hover:shadow-sm transition-all"
                        >
                          <div className="h-10 w-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                            <Eye size={20} />
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-foreground max-w-[200px] truncate">{anexo.nome_arquivo}</span>
                            <span className="block text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Abrir na tela</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé interativo simulando clique rápido */}
              <div className="p-4 bg-muted/20 border-t border-border/50">
                <div className="rounded-xl border border-border/50 bg-background/50 p-3 text-sm text-muted-foreground flex items-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors">
                  <Reply size={16} />
                  Clique aqui para <strong>Responder</strong> ou <strong>Encaminhar</strong> esta mensagem.
                </div>
              </div>
            </div>
          ) : configAberta ? (
            <div className="p-6 overflow-y-auto h-full space-y-5">
              {configAberta === "assinatura" ? <MinhaAssinaturaEmail embedded /> : <ConfiguracaoContasBancarias contas={contasBancarias} onSaved={() => { void buscarContasBancariasEmail().then((dados) => setContasBancarias(dados.contas)); }} />}
            </div>
          ) : modoCriacao ? (
            /* COMPOSITOR DE NOVA MENSAGEM */
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/40">
                <div>
                  <h2 className="text-lg font-bold">Nova Mensagem</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">De: {remetente?.email || "seu e-mail"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setModoCriacao(false)} className="rounded-xl">Descartar</Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="flex gap-2 p-1.5 rounded-xl border border-border/60 bg-muted/30 w-fit">
                  <button type="button" onClick={() => { setTipoEnvio("email"); setDestinatarioUsuarioId(""); setDestinatario(""); }} className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${tipoEnvio === "email" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><Mail size={14} className="mr-2 inline" /> E-mail Externo</button>
                  <button type="button" onClick={() => { setTipoEnvio("interno"); setDestinatario(""); setNomeDestinatario(""); }} className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${tipoEnvio === "interno" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><UserRound size={14} className="mr-2 inline" /> Interno</button>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-border/40 pb-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Para</label>
                    {tipoEnvio === "interno" ? (
                      <SearchableCombobox items={usuarios.map((usuario) => ({ id: usuario.id, label: `${usuario.nome} · ${usuario.email}`, search: `${usuario.nome} ${usuario.email} ${usuario.departamento || ""}` }))} value={destinatarioUsuarioId} onChange={(id, label) => { const usuario = usuarios.find((item) => item.id === id); setDestinatarioUsuarioId(id); setDestinatario(usuario?.email || label); }} placeholder="Busque usuário corporativo..." searchPlaceholder="Digite nome..." emptyMessage="Usuário não encontrado." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <SeletorContatoEmail contatos={contatosFiltrados} busca={busca} emailSelecionado={destinatario} onBusca={setBusca} onSelecionar={selecionarContato} />
                        <Input value={destinatario} onChange={(e) => { setDestinatario(e.target.value); setNomeDestinatario(""); }} placeholder="E-mail do destinatário..." className="h-11 rounded-xl text-sm font-medium border-border/60 bg-background" />
                      </div>
                    )}
                  </div>

                  <div className="border-b border-border/40 pb-2">
                    <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto" className="h-10 rounded-none border-0 px-0 text-sm font-bold shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground" />
                  </div>

                  <div>
                    <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escreva sua mensagem aqui..." className="min-h-[250px] resize-none rounded-none border-0 px-0 text-sm font-medium leading-relaxed shadow-none focus-visible:ring-0 bg-transparent" />
                    
                    {tipoEnvio === "email" && assinatura && (
                      <div className="mt-8 pt-4 border-t border-border/20">
                        <div className="flex items-center gap-4 opacity-80">
                          <img src={assinatura.logo_url || logoShare} alt="Logo" className="h-10 w-auto object-contain grayscale" />
                          <div className="text-[11px] leading-tight text-muted-foreground">
                            <strong className="block text-sm text-foreground">{assinatura.nome || "Nome"}</strong>
                            {assinatura.cargo && <span className="block mt-0.5">{assinatura.cargo}</span>}
                            {assinatura.telefone && <span className="block mt-0.5">{assinatura.telefone}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                    {tipoEnvio === "email" && contasBancarias.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] text-muted-foreground">Inserir banco:</span>{contasBancarias.map((conta) => <Button key={conta.id} type="button" variant="outline" size="sm" onClick={() => inserirDadosBancarios(conta)} className="h-7 gap-1 rounded-lg text-[10px]"><Building2 size={12} /> {conta.banco}</Button>)}</div>}
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-border/50 bg-card/40 flex items-center justify-between">
                <div className="flex items-center ml-[-7px] mr-[-7px] gap-[-2px] pl-0 pr-0">
                  <AnexosEmail anexos={anexos} selecionados={selecionados} onAlternar={alternarAnexo} arquivosNovos={arquivosNovos} onAdicionarArquivos={(novos) => setArquivosNovos((prev) => [...prev, ...novos])} onRemoverArquivo={(idx) => setArquivosNovos((prev) => prev.filter((_, i) => i !== idx))} />
                </div>
                <Button onClick={() => void enviar()} disabled={enviando} className="h-11 mx-[-4px] my-[3px] px-[17px] py-[11px] rounded-xl font-bold gap-[3px] text-sm text-[rgba(205,219,248,1)] shadow-md bg-[rgba(15,162,230,0.2)]">
                  <Send size={16} />
                  {enviando ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          ) : (
            /* TELA VAZIA (NENHUM SELECIONADO) */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card/20 h-full">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 border border-primary/10">
                <Inbox size={32} className="text-primary/40" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Caixa de Mensagens</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">
                Selecione um e-mail na lista lateral para visualizar o conteúdo completo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
