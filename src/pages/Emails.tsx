import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  PenLine,
  Check,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  UserRound,
  XCircle,
  Inbox,
  AlertCircle,
  Eye,
  X,
  Building2,
  Download,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import "@/components/email/email-layout.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import ConfiguracaoContasBancarias from "@/components/email/ConfiguracaoContasBancarias";
import MinhaAssinaturaEmail from "@/components/email/MinhaAssinaturaEmail";
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
  baixarAnexoEmailEnviado,
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

const rotuloStatusEmail = (status?: string | null) =>
  ({
    enviado: "Enviado",
    erro: "Erro",
    pendente: "Pendente",
    processando: "Processando",
    enviado_parcial: "Enviado parcialmente",
    cancelado: "Cancelado",
  })[String(status || "").toLowerCase()] ||
  status ||
  "Desconhecido";

const normalizarEmailEnviado = (item: EmailEnviado): EmailEnviado => ({
  ...item,
  destinatarios: Array.isArray(item.destinatarios)
    ? item.destinatarios
    : (() => {
        try {
          const parsed = JSON.parse(String(item.destinatarios || "[]"));
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      })(),
});

type ToastData = { status: "sending" | "sent"; message: string };

export default function Emails({
  aoNavegar,
}: {
  aoNavegar: (menu: string) => void;
}) {
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioMensagem[]>([]);
  const [mensagensPasta, setMensagensPasta] = useState<MensagemInterna[]>([]);
  const [contagemNaoLidas, setContagemNaoLidas] = useState(0);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
  const [historicoEmails, setHistoricoEmails] = useState<EmailEnviado[]>([]);
  const [remetente, setRemetente] = useState<{
    nome: string;
    email: string;
  } | null>(null);
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
  const [mensagemInternaSelecionada, setMensagemInternaSelecionada] =
    useState<MensagemInterna | null>(null);
  const [emailEnviadoSelecionado, setEmailEnviadoSelecionado] =
    useState<EmailEnviado | null>(null);
  const [configAberta, setConfigAberta] = useState<
    "assinatura" | "bancarios" | null
  >(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaEmail[]>(
    [],
  );
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [categoriasMensagem, setCategoriasMensagem] = useState<
    Record<string, string>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("share-email-categorias") || "{}");
    } catch {
      return {};
    }
  });
  const [anexoVisualizado, setAnexoVisualizado] = useState<{
    nome: string;
    tipo: string;
    url: string;
  } | null>(null);

  const carregarPasta = async (pasta: PastaMensagem = pastaAtiva) => {
    try {
      const mensagens = await buscarMensagensPasta(pasta);
      setMensagensPasta(Array.isArray(mensagens) ? mensagens : []);
      if (
        mensagemInternaSelecionada &&
        !mensagens.some((item) => item.id === mensagemInternaSelecionada.id)
      )
        setMensagemInternaSelecionada(null);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as mensagens.",
      );
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const [
        dados,
        perfil,
        assinaturaAtual,
        mensagens,
        usuariosResponse,
        naoLidas,
      ] = await Promise.all([
        buscarCentralEmail(),
        buscarPerfilColaborador(),
        buscarMinhaAssinatura(),
        buscarMensagensPasta(pastaAtiva),
        buscarUsuariosMensagem(),
        buscarContagemMensagensNaoLidas(),
      ]);
      setRemetente({
        nome: perfil.perfil.nome_exibicao || perfil.perfil.nome_completo,
        email: perfil.perfil.email,
      });
      setAssinatura(assinaturaAtual);
      setContatos(Array.isArray(dados?.contatos) ? dados.contatos : []);
      setAnexos(Array.isArray(dados?.anexos) ? dados.anexos : []);
      setHistoricoEmails(
        Array.isArray(dados?.historico)
          ? dados.historico.map(normalizarEmailEnviado)
          : [],
      );
      setMensagensPasta(Array.isArray(mensagens) ? mensagens : []);
      setUsuarios(
        Array.isArray(usuariosResponse?.usuarios)
          ? usuariosResponse.usuarios
          : [],
      );
      setContagemNaoLidas(Number(naoLidas?.unread || 0));
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a central de e-mail.",
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [pastaAtiva]);

  useEffect(() => {
    if (configAberta !== "bancarios" && !modoCriacao) return;
    void buscarContasBancariasEmail()
      .then((dados) => setContasBancarias(dados.contas))
      .catch(() => setErro("Não foi possível carregar as contas bancárias."));
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
    const atuais = destinatario
      .split(";")
      .map((email) => email.trim())
      .filter(Boolean);
    if (
      !atuais.some(
        (email) => email.toLowerCase() === contato.email.toLowerCase(),
      )
    ) {
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
    setMensagem((atual) =>
      atual.trim() ? `${atual.trim()}\n\n${conta.texto}` : conta.texto,
    );
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
    setToast({
      status: "sending",
      message:
        tipoEnvio === "email" ? "Enviando e-mail..." : "Enviando mensagem...",
    });

    try {
      const destinatarios = destinatario
        .split(";")
        .map((email) => email.trim())
        .filter(Boolean);
      if (tipoEnvio === "interno") {
        if (!destinatarioUsuarioId) {
          setToast(null);
          setErro("Selecione um usuário destinatário.");
          return;
        }
        await enviarMensagemInterna({
          destinatario_id: destinatarioUsuarioId,
          assunto: assunto.trim(),
          conteudo: mensagem.trim(),
          arquivos: arquivosNovos,
        });
      } else
        await enviarEmailCliente({
          destinatarios,
          assunto: assunto.trim(),
          mensagem: mensagem.trim(),
          anexos: anexosSelecionados.map(({ id }) => id),
          arquivos: arquivosNovos,
          nome_destinatario: nomeDestinatario || undefined,
        });

      setSucesso(
        tipoEnvio === "interno"
          ? "Mensagem interna enviada para o inbox do usuário."
          : `E-mail enviado com sucesso para ${destinatarios.join(", ")}.`,
      );
      setToast({
        status: "sent",
        message: tipoEnvio === "email" ? "Enviado" : "Mensagem enviada",
      });
      window.setTimeout(() => setToast(null), 1400);
      limparFormulario();
      setModoCriacao(false);
      await carregar();
    } catch (cause) {
      setToast(null);
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar o e-mail.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const mensagensFiltradas = useMemo(() => {
    const termo = buscaGeral.trim().toLowerCase();
    if (!termo) return mensagensPasta;
    return mensagensPasta.filter((item) =>
      `${item.assunto || ""} ${item.conteudo} ${item.remetente_nome} ${item.destinatario_nome}`
        .toLowerCase()
        .includes(termo),
    );
  }, [mensagensPasta, buscaGeral]);
  const mensagensVisiveis = useMemo(
    () =>
      categoriaAtiva
        ? mensagensFiltradas.filter(
            (item) => categoriasMensagem[item.id] === categoriaAtiva,
          )
        : mensagensFiltradas,
    [mensagensFiltradas, categoriaAtiva, categoriasMensagem],
  );

  const atualizarMensagem = async (
    id: string,
    estado: Parameters<typeof alterarEstadoMensagem>[1],
    mensagemSucesso: string,
  ) => {
    try {
      await alterarEstadoMensagem(id, estado);
      setMensagemInternaSelecionada((atual) =>
        atual?.id === id ? { ...atual, ...estado } : atual,
      );
      setSucesso(mensagemSucesso);
      await Promise.all([
        carregarPasta(),
        buscarContagemMensagensNaoLidas().then(({ unread }) =>
          setContagemNaoLidas(unread),
        ),
      ]);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar a mensagem.",
      );
    }
  };

  const abrirAnexoMensagem = async (
    mensagemId: string,
    anexoId: string,
    nomeArquivo: string,
  ) => {
    try {
      const blob = await baixarAnexoMensagem(mensagemId, anexoId);
      const url = URL.createObjectURL(blob);
      setAnexoVisualizado({
        nome: nomeArquivo,
        tipo: blob.type || "application/pdf",
        url,
      });
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o anexo.",
      );
    }
  };

  const abrirAnexoEmail = async (
    email: EmailEnviado,
    indice: number,
    nomeArquivo: string,
  ) => {
    try {
      const blob = await baixarAnexoEmailEnviado(email.id, indice);
      const url = URL.createObjectURL(blob);
      setAnexoVisualizado({
        nome: nomeArquivo,
        tipo: blob.type || "application/octet-stream",
        url,
      });
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o anexo do e-mail.",
      );
    }
  };

  const pastasMenu: Array<{
    id: PastaMensagem;
    label: string;
    icon: typeof Inbox;
  }> = [
    { id: "inbox", label: "Caixa de entrada", icon: Inbox },
    { id: "favoritas", label: "Favoritas", icon: Star },
    { id: "enviadas", label: "Enviados", icon: Send },
    { id: "nao-lidas", label: "Não lidas", icon: AlertCircle },
    { id: "arquivo", label: "Arquivo", icon: Archive },
  ];
  const pastaAtual = pastasMenu.find((item) => item.id === pastaAtiva)!;
  const historicoFiltrado = historicoEmails.filter((email) =>
    `${email.assunto || ""} ${email.destinatarios.join(" ")} ${email.mensagem || ""}`
      .toLowerCase()
      .includes(buscaGeral.trim().toLowerCase()),
  );
  const temSelecionada = Boolean(
    mensagemInternaSelecionada || emailEnviadoSelecionado,
  );
  const abrirPasta = (pasta: PastaMensagem) => {
    setPastaAtiva(pasta);
    setConfigAberta(null);
    setMensagemInternaSelecionada(null);
    setEmailEnviadoSelecionado(null);
  };
  const escrever = () => {
    limparFormulario();
    setModoCriacao(true);
    void buscarMinhaAssinatura()
      .then(setAssinatura)
      .catch(() => undefined);
  };

  return (
    <div className="email-central">
      {toast && <EmailToast toast={toast} onDone={() => setToast(null)} />}
      <header className="email-cabecalho">
        <div className="flex min-w-0 items-center gap-3">
          <span className="email-icone">
            <Mail size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">E-mail</h1>
          </div>
        </div>
      </header>
      {!modoCriacao && (erro || sucesso) && (
        <div
          role={erro ? "alert" : "status"}
          className={`email-aviso ${erro ? "email-aviso--erro" : "email-aviso--sucesso"}`}
        >
          {erro ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{erro || sucesso}</span>
        </div>
      )}

      <div className="email-corpo">
        <aside
          className="email-menu"
          aria-label="Pastas e configurações de e-mail"
        >
          <Button type="button" onClick={escrever} className="email-escrever">
            <PenLine size={17} /> Escrever
          </Button>
          <nav aria-label="Pastas de mensagens" className="space-y-1">
            {pastasMenu.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => abrirPasta(id)}
                aria-current={
                  !configAberta && pastaAtiva === id ? "page" : undefined
                }
                className={`email-item-menu ${!configAberta && pastaAtiva === id ? "is-active" : ""}`}
              >
                <Icon size={17} />
                <span className="flex-1 text-left">{label}</span>
                {id === "inbox" && contagemNaoLidas > 0 && (
                  <span className="email-contador">{contagemNaoLidas}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="email-menu-secao">
            <p className="email-legenda">Categorias</p>
            {[
              ["Financeiro", "bg-emerald-600"],
              ["Operacional", "bg-blue-600"],
              ["Urgente", "bg-destructive"],
            ].map(([categoria, cor]) => (
              <button
                key={categoria}
                type="button"
                onClick={() =>
                  setCategoriaAtiva(
                    categoriaAtiva === categoria ? null : categoria,
                  )
                }
                aria-pressed={categoriaAtiva === categoria}
                className={`email-item-menu ${categoriaAtiva === categoria ? "is-active" : ""}`}
              >
                <span className={`h-2 w-2 rounded-full ${cor}`} />
                {categoria}
              </button>
            ))}
          </div>
          <div className="email-menu-config">
            <p className="email-legenda">Configurações</p>
            <button
              type="button"
              onClick={() => setConfigAberta("assinatura")}
              className={`email-item-menu ${configAberta === "assinatura" ? "is-active" : ""}`}
            >
              <Settings size={17} /> Minha assinatura
            </button>
            <button
              type="button"
              onClick={() => setConfigAberta("bancarios")}
              className={`email-item-menu ${configAberta === "bancarios" ? "is-active" : ""}`}
            >
              <Landmark size={17} /> Contas bancárias
            </button>
          </div>
          <button
            type="button"
            onClick={() => aoNavegar("recados")}
            className="email-item-menu"
          >
            <MessageSquare size={17} /> Recados
          </button>
        </aside>

        <section
          className={`email-painel ${temSelecionada ? "tem-selecao" : ""} ${configAberta ? "tem-configuracao" : ""}`}
          aria-label="Central de mensagens"
        >
          {!configAberta && (
            <div className="email-lista">
              <div className="email-lista-toolbar">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Pesquisar mensagens</span>
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={buscaGeral}
                    onChange={(e) => setBuscaGeral(e.target.value)}
                    placeholder="Pesquisar assunto, destinatário..."
                    className="h-10 pl-9 text-xs"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void carregar()}
                  disabled={carregando}
                  aria-label="Atualizar mensagens"
                  title="Atualizar mensagens"
                >
                  <RefreshCw
                    size={16}
                    className={carregando ? "animate-spin" : ""}
                  />
                </Button>
              </div>
              <div className="email-lista-contexto">
                <h2 className="text-sm font-semibold">{pastaAtual.label}</h2>
                <span className="text-xs text-muted-foreground">
                  {pastaAtiva === "enviadas"
                    ? historicoFiltrado.length
                    : mensagensVisiveis.length}
                </span>
              </div>
              <div className="email-navegacao-mobile">
                <label className="sr-only" htmlFor="email-pasta-mobile">
                  Pasta de mensagens
                </label>
                <select
                  id="email-pasta-mobile"
                  className="campo"
                  value={pastaAtiva}
                  onChange={(e) => abrirPasta(e.target.value as PastaMensagem)}
                >
                  {pastasMenu.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="email-categoria-mobile">
                  Categoria
                </label>
                <select
                  id="email-categoria-mobile"
                  className="campo"
                  value={categoriaAtiva || ""}
                  onChange={(e) => setCategoriaAtiva(e.target.value || null)}
                >
                  <option value="">Todas as categorias</option>
                  <option>Financeiro</option>
                  <option>Operacional</option>
                  <option>Urgente</option>
                </select>
              </div>
              {categoriaAtiva && (
                <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2 text-xs text-primary">
                  <span>{categoriaAtiva}</span>
                  <button
                    type="button"
                    aria-label="Limpar filtro de categoria"
                    onClick={() => setCategoriaAtiva(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="email-lista-scroll" aria-busy={carregando}>
                {carregando ? (
                  <div className="email-vazio" role="status">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <p>Carregando mensagens...</p>
                  </div>
                ) : pastaAtiva === "enviadas" ? (
                  historicoFiltrado.length === 0 ? (
                    <div className="email-vazio">
                      <Send size={28} />
                      <p>Nenhum e-mail enviado encontrado.</p>
                    </div>
                  ) : (
                    historicoFiltrado.map((email) => (
                      <button
                        type="button"
                        key={email.id}
                        onClick={() => {
                          setEmailEnviadoSelecionado(email);
                          setMensagemInternaSelecionada(null);
                        }}
                        aria-pressed={emailEnviadoSelecionado?.id === email.id}
                        className={`email-mensagem ${emailEnviadoSelecionado?.id === email.id ? "is-selected" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="truncate text-xs">
                            {email.assunto || "(Sem assunto)"}
                          </strong>
                          <time className="shrink-0 text-[11px] text-muted-foreground">
                            {horaBr(email.email_enviado_em || email.criado_em)}
                          </time>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Para:{" "}
                          {email.destinatarios.join(", ") ||
                            "Destinatário não informado"}
                        </p>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          {email.mensagem || "Sem texto"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>
                            {dataBr(email.email_enviado_em || email.criado_em)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Paperclip size={11} />
                            {email.quantidade_anexos || 0}
                          </span>
                          <span
                            className={
                              String(email.status).toLowerCase() === "enviado"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-destructive"
                            }
                          >
                            {rotuloStatusEmail(email.status)}
                          </span>
                        </div>
                      </button>
                    ))
                  )
                ) : mensagensVisiveis.length === 0 ? (
                  <div className="email-vazio">
                    <Inbox size={28} />
                    <p>Nenhuma mensagem encontrada.</p>
                    <span className="text-xs">
                      {buscaGeral || categoriaAtiva
                        ? "Tente outra busca ou categoria."
                        : "As mensagens desta pasta aparecerão aqui."}
                    </span>
                  </div>
                ) : (
                  mensagensVisiveis.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setMensagemInternaSelecionada(item);
                        setEmailEnviadoSelecionado(null);
                        if (!item.lida && item.papel === "destinatario")
                          void atualizarMensagem(item.id, { lida: 1 }, "");
                      }}
                      aria-pressed={mensagemInternaSelecionada?.id === item.id}
                      className={`email-mensagem ${mensagemInternaSelecionada?.id === item.id ? "is-selected" : ""} ${!item.lida ? "nao-lida" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold">
                          {item.papel === "remetente"
                            ? item.destinatario_nome || item.destinatario_id
                            : item.remetente_nome || item.remetente_id}
                        </span>
                        <time className="shrink-0 text-[11px] text-muted-foreground">
                          {horaBr(item.criado_em)}
                        </time>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {item.assunto || "(Sem assunto)"}
                      </p>
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {item.conteudo?.substring(0, 100)}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{dataBr(item.criado_em)}</span>
                        {Boolean(item.favorita) && (
                          <Star
                            size={12}
                            className="fill-amber-500 text-amber-500"
                          />
                        )}
                        {Boolean(item.anexos?.length) && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip size={11} />
                            {item.anexos?.length}
                          </span>
                        )}
                        {categoriasMensagem[item.id] && (
                          <span className="email-etiqueta">
                            {categoriasMensagem[item.id]}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="email-leitura">
            {configAberta ? (
              <div className="email-configuracao">
                <header className="email-leitura-cabecalho">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfigAberta(null)}
                    className="w-fit gap-2"
                  >
                    <ArrowLeft size={15} /> Voltar às mensagens
                  </Button>
                  <h2 className="mt-3 text-lg font-semibold">
                    {configAberta === "assinatura"
                      ? "Minha assinatura"
                      : "Contas bancárias"}
                  </h2>
                </header>
                <div className="email-leitura-scroll">
                  {configAberta === "assinatura" ? (
                    <MinhaAssinaturaEmail embedded />
                  ) : (
                    <ConfiguracaoContasBancarias
                      contas={contasBancarias}
                      onSaved={() => {
                        void buscarContasBancariasEmail().then((dados) =>
                          setContasBancarias(dados.contas),
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            ) : emailEnviadoSelecionado && pastaAtiva === "enviadas" ? (
              <>
                <header className="email-leitura-cabecalho">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="email-voltar gap-2"
                    onClick={() => setEmailEnviadoSelecionado(null)}
                  >
                    <ArrowLeft size={15} /> Voltar
                  </Button>
                  <span className="email-etiqueta">E-mail enviado</span>
                  <h2 className="mt-4 break-words text-xl font-semibold">
                    {emailEnviadoSelecionado.assunto || "(Sem assunto)"}
                  </h2>
                  <p className="mt-3 break-words text-xs text-muted-foreground">
                    Para:{" "}
                    {emailEnviadoSelecionado.destinatarios.join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dataBr(
                      emailEnviadoSelecionado.email_enviado_em ||
                        emailEnviadoSelecionado.criado_em,
                    )}{" "}
                    ·{" "}
                    {horaBr(
                      emailEnviadoSelecionado.email_enviado_em ||
                        emailEnviadoSelecionado.criado_em,
                    )}
                  </p>
                  <span className="mt-3 inline-block text-xs text-muted-foreground">
                    {rotuloStatusEmail(emailEnviadoSelecionado.status)}
                  </span>
                </header>
                <div className="email-leitura-scroll">
                  <div className="whitespace-pre-wrap break-words text-sm leading-7">
                    {emailEnviadoSelecionado.mensagem ||
                      "(Este e-mail não possui texto registrado.)"}
                  </div>
                  {!!emailEnviadoSelecionado.anexos_detalhes?.length && (
                    <section className="email-anexos-leitura">
                      <h3 className="email-legenda">
                        Anexos ({emailEnviadoSelecionado.anexos_detalhes.length}
                        )
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {emailEnviadoSelecionado.anexos_detalhes.map(
                          (anexo, indice) => (
                            <button
                              key={`${anexo.nome_arquivo}-${indice}`}
                              type="button"
                              onClick={() =>
                                void abrirAnexoEmail(
                                  emailEnviadoSelecionado,
                                  indice,
                                  anexo.nome_arquivo,
                                )
                              }
                              className="email-arquivo"
                            >
                              <FileText size={19} />
                              <span>{anexo.nome_arquivo}</span>
                              <Download size={14} />
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : mensagemInternaSelecionada ? (
              <>
                <header className="email-leitura-cabecalho">
                  <div className="email-acoes-leitura flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="email-voltar gap-2"
                      onClick={() => setMensagemInternaSelecionada(null)}
                    >
                      <ArrowLeft size={15} /> Voltar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void atualizarMensagem(
                          mensagemInternaSelecionada.id,
                          {
                            favorita: mensagemInternaSelecionada.favorita
                              ? 0
                              : 1,
                          },
                          "Favorito atualizado.",
                        )
                      }
                      className="gap-2"
                    >
                      <Star
                        size={14}
                        className={
                          mensagemInternaSelecionada.favorita
                            ? "fill-amber-500 text-amber-500"
                            : ""
                        }
                      />{" "}
                      Favorita
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void atualizarMensagem(
                          mensagemInternaSelecionada.id,
                          {
                            arquivada: mensagemInternaSelecionada.arquivada
                              ? 0
                              : 1,
                          },
                          "Arquivo atualizado.",
                        )
                      }
                      className="gap-2"
                    >
                      <Archive size={14} />
                      {mensagemInternaSelecionada.arquivada
                        ? "Desarquivar"
                        : "Arquivar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void atualizarMensagem(
                          mensagemInternaSelecionada.id,
                          { lida: mensagemInternaSelecionada.lida ? 0 : 1 },
                          "Estado de leitura atualizado.",
                        )
                      }
                      className="gap-2"
                    >
                      <Eye size={14} />
                      {mensagemInternaSelecionada.lida
                        ? "Não lida"
                        : "Marcar como lida"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void atualizarMensagem(
                          mensagemInternaSelecionada.id,
                          { excluida: 1 },
                          "Mensagem movida para o arquivo.",
                        )
                      }
                      className="gap-2 text-destructive"
                    >
                      <Trash2 size={14} /> Excluir
                    </Button>
                  </div>
                  <h2 className="mt-5 break-words text-xl font-semibold">
                    {mensagemInternaSelecionada.assunto || "(Sem assunto)"}
                  </h2>
                  <p className="mt-3 text-xs font-medium">
                    {mensagemInternaSelecionada.papel === "remetente"
                      ? mensagemInternaSelecionada.destinatario_nome ||
                        mensagemInternaSelecionada.destinatario_id
                      : mensagemInternaSelecionada.remetente_nome ||
                        mensagemInternaSelecionada.remetente_id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Para:{" "}
                    {mensagemInternaSelecionada.destinatario_nome ||
                      mensagemInternaSelecionada.destinatario_id}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {dataBr(mensagemInternaSelecionada.criado_em)} ·{" "}
                      {horaBr(mensagemInternaSelecionada.criado_em)}
                    </p>
                    <select
                      aria-label="Classificar mensagem"
                      value={
                        categoriasMensagem[mensagemInternaSelecionada.id] || ""
                      }
                      onChange={(e) =>
                        classificarMensagem(
                          mensagemInternaSelecionada.id,
                          e.target.value,
                        )
                      }
                      className="campo !w-auto"
                    >
                      <option value="">Categoria</option>
                      <option>Financeiro</option>
                      <option>Operacional</option>
                      <option>Urgente</option>
                    </select>
                  </div>
                </header>
                <div className="email-leitura-scroll">
                  <div className="whitespace-pre-wrap break-words text-sm leading-7">
                    {mensagemInternaSelecionada.conteudo}
                  </div>
                  {!!mensagemInternaSelecionada.anexos?.length && (
                    <section className="email-anexos-leitura">
                      <h3 className="email-legenda">
                        Anexos ({mensagemInternaSelecionada.anexos.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {mensagemInternaSelecionada.anexos.map((anexo) => (
                          <button
                            key={anexo.id}
                            type="button"
                            onClick={() =>
                              void abrirAnexoMensagem(
                                mensagemInternaSelecionada.id,
                                anexo.id,
                                anexo.nome_arquivo,
                              )
                            }
                            className="email-arquivo"
                          >
                            <FileText size={19} />
                            <span>{anexo.nome_arquivo}</span>
                            <Eye size={14} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <div className="email-vazio email-vazio-leitura">
                <p className="max-w-xs text-sm leading-6">
                  Selecione uma mensagem para ler ou escreva um novo e-mail.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={escrever}
                  className="mt-2 gap-2"
                >
                  <PenLine size={15} /> Escrever mensagem
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={modoCriacao} onOpenChange={setModoCriacao}>
        <DialogContent
          className="email-compositor !flex !max-w-3xl !flex-col !gap-0 !overflow-hidden !rounded-2xl !p-0"
          aria-describedby="email-compositor-descricao"
        >
          <DialogHeader className="email-compositor-cabecalho !space-y-1 !text-left">
            <DialogTitle className="text-lg font-semibold">
              Nova mensagem
            </DialogTitle>
            <p
              id="email-compositor-descricao"
              className="text-xs text-muted-foreground"
            >
              De: {remetente?.email || "seu e-mail"}
            </p>
          </DialogHeader>
          <div className="email-compositor-scroll">
            {erro && (
              <div role="alert" className="email-aviso email-aviso--erro mb-4">
                <XCircle size={16} />
                <span>{erro}</span>
              </div>
            )}
            <div
              role="group"
              aria-label="Tipo de mensagem"
              className="email-tipo-envio"
            >
              <button
                type="button"
                aria-pressed={tipoEnvio === "email"}
                onClick={() => {
                  setTipoEnvio("email");
                  setDestinatarioUsuarioId("");
                  setDestinatario("");
                }}
                className={tipoEnvio === "email" ? "is-active" : ""}
              >
                <Mail size={14} /> E-mail externo
              </button>
              <button
                type="button"
                aria-pressed={tipoEnvio === "interno"}
                onClick={() => {
                  setTipoEnvio("interno");
                  setDestinatario("");
                  setNomeDestinatario("");
                }}
                className={tipoEnvio === "interno" ? "is-active" : ""}
              >
                <UserRound size={14} /> Mensagem interna
              </button>
            </div>
            <div className="email-campo">
              <label
                className="email-rotulo"
                htmlFor={
                  tipoEnvio === "email" ? "email-destinatario" : undefined
                }
              >
                Para
              </label>
              {tipoEnvio === "interno" ? (
                <SearchableCombobox
                  items={usuarios.map((usuario) => ({
                    id: usuario.id,
                    label: `${usuario.nome} · ${usuario.email}`,
                    search: `${usuario.nome} ${usuario.email} ${usuario.departamento || ""}`,
                  }))}
                  value={destinatarioUsuarioId}
                  onChange={(id, label) => {
                    const usuario = usuarios.find((item) => item.id === id);
                    setDestinatarioUsuarioId(id);
                    setDestinatario(usuario?.email || label);
                  }}
                  placeholder="Busque usuário corporativo..."
                  searchPlaceholder="Digite nome..."
                  emptyMessage="Usuário não encontrado."
                />
              ) : (
                <>
                  <Input
                    id="email-destinatario"
                    value={destinatario}
                    onChange={(e) => {
                      setDestinatario(e.target.value);
                      setNomeDestinatario("");
                    }}
                    placeholder="nome@empresa.com; outro@empresa.com"
                    className="h-11 text-sm"
                  />
                  <SeletorContatoEmail
                    contatos={contatosFiltrados}
                    busca={busca}
                    emailSelecionado={destinatario}
                    onBusca={setBusca}
                    onSelecionar={selecionarContato}
                  />
                </>
              )}
            </div>
            <div className="email-campo">
              <label className="email-rotulo" htmlFor="email-assunto">
                Assunto
              </label>
              <Input
                id="email-assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Assunto da mensagem"
                className="h-11 text-sm"
              />
            </div>
            <div className="email-campo">
              <label className="email-rotulo" htmlFor="email-conteudo">
                Mensagem
              </label>
              <Textarea
                id="email-conteudo"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva sua mensagem..."
                rows={8}
                className="min-h-[200px] resize-y text-sm leading-7"
              />
            </div>
            {tipoEnvio === "email" && contasBancarias.length > 0 && (
              <section className="email-bancos">
                <p className="email-rotulo">
                  <Landmark size={14} /> Inserir dados bancários
                </p>
                <div className="flex flex-wrap gap-2">
                  {contasBancarias.map((conta) => (
                    <Button
                      key={conta.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inserirDadosBancarios(conta)}
                      className="gap-2 text-xs"
                    >
                      <Building2 size={13} />
                      {conta.banco}
                    </Button>
                  ))}
                </div>
              </section>
            )}
            {tipoEnvio === "email" && assinatura && (
              <section className="email-assinatura">
                <p className="email-legenda">Assinatura automática</p>
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={assinatura.logo_url || logoShare}
                    alt="Share Brasil"
                    className="h-auto max-h-14 w-28 object-contain"
                  />
                  <div className="min-w-0 text-xs leading-5 text-muted-foreground">
                    <strong className="block text-sm font-semibold text-foreground">
                      {assinatura.nome || "Nome"}
                    </strong>
                    {assinatura.cargo && <p>{assinatura.cargo}</p>}
                    {assinatura.telefone && <p>{assinatura.telefone}</p>}
                    {assinatura.email && <p>{assinatura.email}</p>}
                    {assinatura.endereco && <p>{assinatura.endereco}</p>}
                  </div>
                </div>
              </section>
            )}
          </div>
          <DialogFooter className="email-compositor-rodape !flex-col !items-stretch !gap-3 !space-x-0">
            <AnexosEmail
              anexos={anexos}
              selecionados={selecionados}
              onAlternar={alternarAnexo}
              arquivosNovos={arquivosNovos}
              onAdicionarArquivos={(novos) =>
                setArquivosNovos((prev) => [...prev, ...novos])
              }
              onRemoverArquivo={(idx) =>
                setArquivosNovos((prev) => prev.filter((_, i) => i !== idx))
              }
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  limparFormulario();
                  setModoCriacao(false);
                }}
                disabled={enviando}
                className="gap-2 text-muted-foreground"
              >
                <Trash2 size={15} /> Descartar
              </Button>
              <Button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando}
                className="min-w-28 gap-2"
              >
                {enviando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {enviando ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {anexoVisualizado && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              URL.revokeObjectURL(anexoVisualizado.url);
              setAnexoVisualizado(null);
            }
          }}
        >
          <DialogContent
            className="!flex h-[min(90dvh,900px)] !max-w-5xl !flex-col !gap-0 !overflow-hidden !p-0"
            aria-describedby={undefined}
          >
            <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
              <DialogTitle className="truncate text-sm font-semibold">
                {anexoVisualizado.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 bg-muted/30 p-3">
              {anexoVisualizado.tipo.includes("pdf") ? (
                <iframe
                  title={anexoVisualizado.nome}
                  src={anexoVisualizado.url}
                  className="h-full w-full rounded-lg bg-white"
                />
              ) : anexoVisualizado.tipo.startsWith("image/") ? (
                <img
                  src={anexoVisualizado.url}
                  alt={anexoVisualizado.nome}
                  className="mx-auto h-full max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-5 text-sm text-muted-foreground">
                  Este tipo de arquivo não possui pré-visualização. Use o
                  download para abrir no aplicativo compatível.
                </div>
              )}
            </div>
            <DialogFooter className="border-t border-border p-3">
              <a
                href={anexoVisualizado.url}
                download={anexoVisualizado.nome}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Download size={14} /> Baixar arquivo
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EmailToast({
  toast,
  onDone,
}: {
  toast: ToastData;
  onDone: () => void;
}) {
  const isSent = toast.status === "sent";
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl ${isSent ? "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-200" : "border-sky-600/40 bg-sky-50 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950 dark:text-sky-200"}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={() => {
        if (isSent) onDone();
      }}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full ${isSent ? "bg-emerald-500 text-white" : "bg-sky-500 text-white"}`}
      >
        {isSent ? (
          <Check size={12} />
        ) : (
          <Loader2 size={11} className="animate-spin" />
        )}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}
