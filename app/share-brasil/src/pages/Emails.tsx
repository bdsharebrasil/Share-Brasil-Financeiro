import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Folder,
  History,
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
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import ConfiguracaoContasBancarias from "@/components/email/ConfiguracaoContasBancarias";
import MinhaAssinaturaEmail from "@/pages/MinhaAssinaturaEmail";
import {
  buscarCentralEmail,
  buscarContasBancariasEmail,
  buscarPerfilColaborador,
  buscarInboxMensagens,
  buscarUsuariosMensagem,
  enviarEmailCliente,
  enviarMensagemInterna,
  type AnexoEmail,
  type ContatoEmail,
  type EmailEnviado,
  type ContaBancariaEmail,
  type MensagemInterna,
  type UsuarioMensagem,
} from "@/lib/colaborador-api";

const dataBr = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
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
  const [mensagensInbox, setMensagensInbox] = useState<MensagemInterna[]>([]);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
  const [historico, setHistorico] = useState<EmailEnviado[]>([]);
  const [remetente, setRemetente] = useState<{ nome: string; email: string } | null>(null);

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
  const [pastaAtiva, setPastaAtiva] = useState<"inbox" | "nao-lidas" | "favoritas" | "enviadas" | "arquivo">("inbox");
  const [modoCriacao, setModoCriacao] = useState(false);
  const [emailSelecionadoLeitura, setEmailSelecionadoLeitura] = useState<EmailEnviado | null>(null);
  const [mensagemInternaSelecionada, setMensagemInternaSelecionada] = useState<MensagemInterna | null>(null);
  const [configAberta, setConfigAberta] = useState<"assinatura" | "bancarios" | null>(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaEmail[]>([]);

  const carregar = async () => {
    setCarregando(true);
    setErro("");

    try {
      const [dados, perfil, inbox, usuariosResponse] = await Promise.all([buscarCentralEmail(), buscarPerfilColaborador(), buscarInboxMensagens(), buscarUsuariosMensagem()]);
      setRemetente({ nome: perfil.perfil.nome_exibicao || perfil.perfil.nome_completo, email: perfil.perfil.email });
      setContatos(Array.isArray(dados?.contatos) ? dados.contatos : []);
      setAnexos(Array.isArray(dados?.anexos) ? dados.anexos : []);
      setHistorico(Array.isArray(dados?.historico) ? dados.historico : []);
      setMensagensInbox(Array.isArray(inbox) ? inbox : []);
      setUsuarios(Array.isArray(usuariosResponse?.usuarios) ? usuariosResponse.usuarios : []);
      if (Array.isArray(dados?.historico) && dados.historico.length > 0 && !emailSelecionadoLeitura) {
        setEmailSelecionadoLeitura(dados.historico[0]);
      }
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
  }, []);

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
        await enviarMensagemInterna({ destinatario_id: destinatarioUsuarioId, assunto: assunto.trim(), conteudo: mensagem.trim() });
      } else await enviarEmailCliente({ destinatarios, assunto: assunto.trim(), mensagem: mensagem.trim(), anexos: anexosSelecionados.map(({ id }) => id), arquivos: arquivosNovos, nome_destinatario: nomeDestinatario || undefined });

      setSucesso(tipoEnvio === "interno" ? "Mensagem interna enviada para o inbox do usuário." : `E-mail enviado com sucesso para ${destinatarios.join(", ")}.`);
      limparFormulario();
      setModoCriacao(false);
      await carregar();
    } catch (cause) {
      setErro(
        cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const itensFiltradosPasta = useMemo(() => {
    return historico.filter((item) => {
      const matchBusca =
        !buscaGeral ||
        item.assunto.toLowerCase().includes(buscaGeral.toLowerCase()) ||
        item.destinatarios.some((d) => d.toLowerCase().includes(buscaGeral.toLowerCase()));

      if (!matchBusca) return false;

      if (pastaAtiva === "enviadas") return item.status === "enviado";
      if (pastaAtiva === "nao-lidas") return item.status !== "enviado";
      return true;
    });
  }, [historico, pastaAtiva, buscaGeral]);

  return (
    <div className="route-enter relative mx-auto max-w-7xl pb-10 space-y-6">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Mensagens
              </h1>
              <p className="text-xs text-muted-foreground">
                Comunicação interna privada entre os usuários do sistema
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void carregar()}
            disabled={carregando}
            className="h-9 gap-2 rounded-xl"
          >
            <RefreshCw size={14} className={carregando ? "animate-spin text-primary" : ""} />
            Sincronizar
          </Button>

          <Button
            type="button"
            onClick={() => {
              setModoCriacao(true);
              setConfigAberta(null);
              limparFormulario();
            }}
            className="h-9 gap-2 rounded-xl font-semibold shadow-md"
          >
            <Plus size={15} />
            Nova mensagem
          </Button>
        </div>
      </header>

      {/* STATUS */}
      {(erro || sucesso) && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${erro ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
          {erro ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{erro || sucesso}</span>
        </div>
      )}

      {/* LAYOUT PRINCIPAL EM DUAS COLUNAS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* SIDEBAR DE PASTAS E LISTA */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaGeral}
              onChange={(e) => setBuscaGeral(e.target.value)}
              placeholder="Buscar..."
              className="h-10 rounded-xl bg-muted/40 pl-9 text-xs border-border/60"
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40 p-3 space-y-1">
            <div className="px-3 py-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Inbox</span>
              <span className="text-[10px]">0 não lidas</span>
            </div>

            <button
              onClick={() => { setPastaAtiva("inbox"); setModoCriacao(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${pastaAtiva === "inbox" && !modoCriacao ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <Mail size={15} /> Inbox
            </button>

            <button
              onClick={() => { setPastaAtiva("nao-lidas"); setModoCriacao(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${pastaAtiva === "nao-lidas" && !modoCriacao ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <Clock3 size={15} /> Não lidas
            </button>

            <button
              onClick={() => { setPastaAtiva("favoritas"); setModoCriacao(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${pastaAtiva === "favoritas" && !modoCriacao ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <Star size={15} /> Favoritas
            </button>

            <button
              onClick={() => { setPastaAtiva("enviadas"); setModoCriacao(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${pastaAtiva === "enviadas" && !modoCriacao ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <Send size={15} /> Enviadas
            </button>

            <button
              onClick={() => { setPastaAtiva("arquivo"); setModoCriacao(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${pastaAtiva === "arquivo" && !modoCriacao ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <Folder size={15} /> Arquivo
            </button>

            <button
              onClick={() => { setModoCriacao(false); setConfigAberta((atual) => atual ? null : "assinatura"); }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${configAberta ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            >
              <span className="flex items-center gap-3"><Settings size={15} /> Configurações</span><ChevronDown size={14} className={`transition-transform ${configAberta ? "rotate-180" : ""}`} />
            </button>
            {configAberta && <div className="ml-4 space-y-1 border-l border-border/60 pl-2">
              <button type="button" onClick={() => setConfigAberta("assinatura")} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs ${configAberta === "assinatura" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}><ShieldCheck size={14} /> Assinatura</button>
              <button type="button" onClick={() => setConfigAberta("bancarios")} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs ${configAberta === "bancarios" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}><Landmark size={14} /> Dados bancários</button>
            </div>}
          </div>

            {pastaAtiva === "inbox" && mensagensInbox.length > 0 && <div className="space-y-2">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Mensagens internas</div>
              {mensagensInbox.map((item) => <button type="button" key={item.id} onClick={() => { setMensagemInternaSelecionada(item); setModoCriacao(false); }} className={`w-full rounded-xl border p-3 text-left transition-all ${mensagemInternaSelecionada?.id === item.id && !modoCriacao ? "border-primary/50 bg-primary/10" : "border-border/50 bg-card/30 hover:bg-muted/40"}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold">{item.assunto || "(Sem assunto)"}</span><span className="shrink-0 text-[10px] text-muted-foreground">{dataBr(item.criado_em)}</span></div>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">Mensagem interna recebida</p>
              </button>)}
            </div>}

            {/* LISTA DE MENSAGENS DA PASTA */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {itensFiltradosPasta.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border/60 rounded-2xl text-xs text-muted-foreground">
                Nenhuma mensagem nesta pasta.
              </div>
            ) : (
              itensFiltradosPasta.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setEmailSelecionadoLeitura(item);
                    setModoCriacao(false);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${emailSelecionadoLeitura?.id === item.id && !modoCriacao ? "border-primary/50 bg-primary/10" : "border-border/50 bg-card/30 hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="truncate">{item.destinatarios.join(", ")}</span>
                    <span className="text-[10px] text-muted-foreground">{dataBr(item.criado_em)}</span>
                  </div>
                  <p className="mt-1 text-xs truncate font-medium">{item.assunto || "(Sem assunto)"}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PAINEL DIREITO: LEITURA OU COMPOSIÇÃO */}
        <div className="lg:col-span-8">
          {mensagemInternaSelecionada && !modoCriacao && !configAberta ? (
            <div className="space-y-5 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between border-b border-border/50 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Mensagem interna</p><h2 className="mt-1 text-lg font-bold">{mensagemInternaSelecionada.assunto || "(Sem assunto)"}</h2><p className="mt-1 text-[10px] text-muted-foreground">Recebida em {dataBr(mensagemInternaSelecionada.criado_em)} às {horaBr(mensagemInternaSelecionada.criado_em)}</p></div><Button variant="ghost" size="sm" onClick={() => setMensagemInternaSelecionada(null)}>Fechar</Button></div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{mensagemInternaSelecionada.conteudo}</p>
            </div>
          ) : configAberta ? (
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 space-y-5 backdrop-blur-xl">
              {configAberta === "assinatura" ? <MinhaAssinaturaEmail embedded /> : <ConfiguracaoContasBancarias contas={contasBancarias} onSaved={() => { void buscarContasBancariasEmail().then((dados) => setContasBancarias(dados.contas)); }} />}
            </div>
          ) : modoCriacao ? (
            /* COMPOSITOR DE NOVA MENSAGEM */
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 space-y-5 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div><h2 className="text-sm font-bold">Nova mensagem</h2><p className="mt-1 text-[10px] text-muted-foreground">Enviando como {remetente?.nome || "seu usuário"} · resposta para {remetente?.email || "seu e-mail de cadastro"}</p></div>
                <Button variant="ghost" size="sm" onClick={() => setModoCriacao(false)}>Cancelar</Button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-muted/20 p-1">
                  <button type="button" onClick={() => { setTipoEnvio("email"); setDestinatarioUsuarioId(""); setDestinatario(""); }} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tipoEnvio === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Mail size={13} className="mr-1.5 inline" /> E-mail comum</button>
                  <button type="button" onClick={() => { setTipoEnvio("interno"); setDestinatario(""); setNomeDestinatario(""); }} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tipoEnvio === "interno" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><UserRound size={13} className="mr-1.5 inline" /> Mensagem interna</button>
                </div>
                <div>
                  <label className="text-xs font-semibold">Destinatário</label>
                  {tipoEnvio === "interno" ? <><SearchableCombobox items={usuarios.map((usuario) => ({ id: usuario.id, label: `${usuario.nome} · ${usuario.email}`, search: `${usuario.nome} ${usuario.email} ${usuario.departamento || ""}` }))} value={destinatarioUsuarioId} onChange={(id, label) => { const usuario = usuarios.find((item) => item.id === id); setDestinatarioUsuarioId(id); setDestinatario(usuario?.email || label); }} placeholder="Busque pelo nome do usuário" searchPlaceholder="Digite nome ou e-mail" emptyMessage="Nenhum usuário encontrado." /><p className="mt-1.5 text-[10px] text-muted-foreground">A mensagem será entregue diretamente no Inbox / Mensagens do usuário.</p></> : <><SeletorContatoEmail contatos={contatosFiltrados} busca={busca} emailSelecionado={destinatario} onBusca={setBusca} onSelecionar={selecionarContato} /><Input value={destinatario} onChange={(e) => { setDestinatario(e.target.value); setNomeDestinatario(""); }} placeholder="E-mail do destinatário" className="mt-2 h-10 rounded-xl text-xs" /></>}
                </div>

                <div>
                  <label className="text-xs font-semibold">Assunto</label>
                  <Input
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    placeholder="Assunto da mensagem"
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold">Mensagem</label>
                  <Textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Escreva sua mensagem..."
                    className="mt-1 min-h-[140px] rounded-xl text-xs"
                  />
                </div>

                {tipoEnvio === "email" && <div className="rounded-xl border border-primary/20 bg-primary/[.04] p-4">
                  <div className="mb-2 flex items-center gap-2"><Landmark size={15} className="text-primary" /><p className="text-xs font-semibold">Inserir dados bancários</p></div>
                  <p className="mb-3 text-[11px] text-muted-foreground">Clique em uma conta para adicionar o texto ao final da mensagem.</p>
                  <div className="grid gap-2 sm:grid-cols-2">{contasBancarias.map((conta) => <button type="button" key={conta.id} onClick={() => inserirDadosBancarios(conta)} className="rounded-lg border border-border/60 bg-card/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/[.06]"><span className="block text-xs font-semibold">{conta.banco}</span><span className="mt-1 block text-[10px] text-muted-foreground">{conta.tipo_conta || "Conta"} {conta.numero_conta || ""} · inserir na mensagem</span></button>)}</div>
                </div>}

                <div className="border border-border/50 rounded-xl p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">Anexos e Documentos</p>
                  <AnexosEmail
                    anexos={anexos}
                    selecionados={selecionados}
                    onAlternar={alternarAnexo}
                    arquivosNovos={arquivosNovos}
                    onAdicionarArquivos={(novos) => setArquivosNovos((prev) => [...prev, ...novos])}
                    onRemoverArquivo={(idx) => setArquivosNovos((prev) => prev.filter((_, i) => i !== idx))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    onClick={() => void enviar()}
                    disabled={enviando}
                    className="h-10 px-6 rounded-xl font-semibold gap-2"
                  >
                    <Send size={15} />
                    {enviando ? "Enviando..." : "Enviar mensagem"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO DE LEITURA */
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 min-h-[500px] flex flex-col justify-between">
              {emailSelecionadoLeitura ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <div>
                      <h2 className="text-base font-bold">{emailSelecionadoLeitura.assunto || "Sem assunto"}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Para: {emailSelecionadoLeitura.destinatarios.join(", ")}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{dataBr(emailSelecionadoLeitura.criado_em)} às {horaBr(emailSelecionadoLeitura.criado_em)}</span>
                  </div>

                  <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {emailSelecionadoLeitura.status} - Mensagem registrada no histórico do sistema.
                  </div>
                </div>
              ) : (
                <div className="m-auto flex flex-col items-center justify-center p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    <Mail size={22} />
                  </div>
                  <p className="text-xs text-muted-foreground">Selecione uma mensagem para ler</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
