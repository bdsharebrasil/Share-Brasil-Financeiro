import { useEffect, useMemo, useState } from "react";
import { Bell, Building2, CalendarDays, ChevronLeft, ChevronRight, Clipboard, Clock3, Columns3, Copy, FilePlus2, Folder, FolderPlus, GraduationCap, Grid2X2, KeyRound, List, ListTodo, LogIn, LogOut, MessageSquare, Pause, Play, Plus, Upload, Users, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CabecalhoSecao, EstadoVazio, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { carregarArquivoColaborador, buscarPonto, buscarPastasDocumentos, buscarDocumentosInternos, criarPastaDocumento, enviarDocumentoInterno, marcarPonto, enviarJustificativaAusencia, buscarSenhas, revelarSenha, criarSenha, excluirSenha, buscarContatosShare, criarContatoShare, excluirContatoShare, buscarClientesShare, criarClienteShare, atualizarClienteShare, vincularAeronaveCliente, enviarLogoCliente, enviarDocumentoCliente, buscarTarefas, buscarUsuariosTarefas, criarTarefaShare, atualizarTarefaShare, comentarTarefaShare, marcarNotificacaoTarefaLida, buscarCategoriasCalendario, criarCategoriaCalendario, buscarLembretesCalendario, criarLembreteCalendario, type PontoLancamento, type PastaDocumento, type DocumentoInterno, type SenhaEmpresa, type ContatoAgenda, type ClienteShare } from "@/lib/colaborador-api";
import { PONTO_ATIVO_EVENTO, PONTO_ATIVO_STORAGE } from "@/types/navegacao";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";

function Shell({ title, detail, children, action }: { title: string; detail: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="route-enter space-y-5"><div className="flex items-end justify-between gap-4"><div><IndicadorPagina>Share Brasil / módulo</IndicadorPagina><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">{title}</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{detail}</p></div>{action}</div>{children}</div>;
}

function Feedback({ error, ok }: { error: string | null; ok: string | null }) { return <>{error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">{error}</p>}{ok && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-300">{ok}</p>}</>; }

export function DashboardShareBrasil({ aoNavegar }: { aoNavegar: (menu: string) => void }) {
  const atalhos: Array<{ menu: string; label: string; detail: string; icon: import("lucide-react").LucideIcon; tone: string }> = [
    { menu: "documentos", label: "DOCUMENTOS", detail: "Pastas internas", icon: Folder, tone: "text-sky-300 bg-sky-400/10 border-sky-300/20" },
    { menu: "senhas", label: "SENHAS", detail: "Cofre corporativo", icon: KeyRound, tone: "text-violet-300 bg-violet-400/10 border-violet-300/20" },
    { menu: "tarefas", label: "TAREFAS", detail: "Kanban e agenda", icon: ListTodo, tone: "text-amber-300 bg-amber-400/10 border-amber-300/20" },
    { menu: "contatos-clientes", label: "CONTATOS\nCLIENTES", detail: "Relacionamento", icon: Users, tone: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20" },
    { menu: "centro-treinamento", label: "CENTRO\nTREINAMENTO", detail: "Salas e materiais", icon: GraduationCap, tone: "text-sky-300 bg-sky-400/10 border-sky-300/20" },
    { menu: "hoteis", label: "HOTÉIS", detail: "Reservas e contatos", icon: Building2, tone: "text-amber-300 bg-amber-400/10 border-amber-300/20" },
  ];

  return (
    <div className="route-enter space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#263446] bg-[#0e1622] shadow-[0_18px_55px_rgba(0,0,0,.22)]">
        <div className="px-5 py-6 md:px-7">
          <h1 className="text-2xl font-extrabold tracking-[-.045em] text-white md:text-[32px]">Central de trabalho</h1>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {atalhos.map((item) => (
          <button
            type="button"
            key={item.menu + "-" + item.label}
            onClick={() => aoNavegar(item.menu)}
            className="group flex min-h-[132px] flex-col items-center justify-between rounded-xl border border-[#202d3d] bg-[#101925] px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-[#39cdbd]/55 hover:bg-[#142333] hover:shadow-[0_8px_25px_rgba(0,0,0,.25)]"
          >
            <span className={"flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 " + item.tone}>
              <item.icon size={23} strokeWidth={1.8} />
            </span>
            <span className="whitespace-pre-line text-[11px] font-extrabold leading-[1.15] tracking-[.03em] text-slate-100">{item.label}</span>
            <span className="text-[9px] text-slate-500">{item.detail}</span>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-[#202d3d] bg-[#101925] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#38d1bd]">Minha jornada</p>
            <h2 className="mt-1 text-lg font-extrabold text-white">Ponto de hoje</h2>
          </div>
          <Clock3 size={19} className="text-[#38d1bd]" />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#263446] bg-[#0b131e] p-4">
          <div>
            <p className="font-mono text-2xl font-bold text-white">{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[.1em] text-slate-500">Registro de entrada</p>
          </div>
          <Button type="button" onClick={() => aoNavegar("ponto")} className="h-10 gap-2 rounded-lg bg-emerald-500 px-4 text-[10px] font-extrabold uppercase text-[#06251c] hover:bg-emerald-400">
            <Play size={13} /> Abrir ponto
          </Button>
        </div>
      </section>
    </div>
  );
}
export function PontoShareBrasil() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(currentMonth); const [data, setData] = useState<{ lancamentos: PontoLancamento[]; justificativas: Array<Record<string, any>>; correcoes: Array<Record<string, any>> } | null>(null); const [file, setFile] = useState<File>(); const [absenceDate, setAbsenceDate] = useState(today); const [justification, setJustification] = useState(""); const [error, setError] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); void buscarPonto(month).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }; useEffect(load, [month]);
  const todayEntry = data?.lancamentos.find((item) => item.data_entrada === today); const action = async (name: "entrada" | "inicio_almoco" | "fim_almoco" | "saida" | "encerrar") => { setError(null); setOk(null); try { await marcarPonto(name, today); const ativo = name !== "saida" && name !== "encerrar"; window.localStorage.setItem(PONTO_ATIVO_STORAGE, ativo ? "1" : "0"); window.dispatchEvent(new CustomEvent(PONTO_ATIVO_EVENTO, { detail: { ativo, acao: name } })); setOk("Registro de ponto salvo."); load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível registrar o ponto."); } };
  const submitAbsence = async () => { if (!justification.trim()) return setError("Informe a justificativa da ausência."); try { await enviarJustificativaAusencia(absenceDate, justification, file); setJustification(""); setFile(undefined); setOk("Justificativa enviada para análise."); load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível anexar a justificativa."); } };
  return <Shell title="Ponto e jornada" detail="Seu ponto e seu histórico mensal são privados e vinculados ao seu usuário."><Feedback error={error} ok={ok} /><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><section className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Hoje · {today}</p><h2 className="mt-1 text-3xl font-extrabold tracking-tight">{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</h2></div><Clock3 className="text-primary" /></div><p className="mt-2 text-xs text-muted-foreground">{todayEntry?.status === "finished" ? "Dia encerrado" : todayEntry?.entrada_hora ? `Entrada registrada às ${todayEntry.entrada_hora}` : "Nenhuma entrada registrada"}</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{!todayEntry?.entrada_hora && <Button type="button" onClick={() => void action("entrada")} className="h-10 gap-2 text-xs"><LogIn size={14} /> Iniciar dia</Button>}{todayEntry?.entrada_hora && !todayEntry.inicio_almoco && <Button type="button" variant="outline" onClick={() => void action("inicio_almoco")} className="h-10 gap-2 text-xs"><Pause size={14} /> Saída almoço</Button>}{todayEntry?.inicio_almoco && !todayEntry.fim_almoco && <Button type="button" variant="outline" onClick={() => void action("fim_almoco")} className="h-10 gap-2 text-xs"><Play size={14} /> Volta almoço</Button>}{todayEntry?.entrada_hora && !todayEntry?.saida_hora && <Button type="button" variant="outline" onClick={() => void action("saida")} className="h-10 gap-2 text-xs"><LogOut size={14} /> Encerrar dia</Button>}</div></section><section className={`${card} p-5`}><CabecalhoSecao icon={<FilePlus2 size={15} />} title="Atestado e ausência" detail="Anexe imagem ou PDF para justificar uma falta." /><div className="mt-4 space-y-3"><Input type="date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} className={field} /><Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Descreva a justificativa" className="min-h-[82px] bg-background/70 text-sm" /><Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0])} className="h-10 text-xs" /><Button type="button" onClick={() => void submitAbsence()} className="h-10 gap-2 text-xs"><Upload size={14} /> Enviar justificativa</Button></div></section></div><section className={`${card} overflow-hidden`}><CabecalhoSecao icon={<Clipboard size={15} />} title="Histórico mensal" detail="Somente os seus lançamentos aparecem nesta tela." action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-[145px] text-[10px]" />} />{loading ? <p className="p-5 text-xs text-muted-foreground">Carregando histórico...</p> : data?.lancamentos.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[10px]"><thead><tr className="border-b border-border text-[9px] uppercase tracking-[.1em] text-muted-foreground"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Almoço</th><th className="px-4 py-3">Saída</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data.lancamentos.map((item) => <tr key={item.id} className="border-b border-border/50 last:border-0"><td className="px-4 py-3 font-mono">{item.data_entrada}</td><td className="px-4 py-3">{item.entrada_hora || "—"}</td><td className="px-4 py-3">{item.inicio_almoco || "—"} {item.fim_almoco ? `→ ${item.fim_almoco}` : ""}</td><td className="px-4 py-3">{item.saida_hora || "—"}</td><td className="px-4 py-3">{item.horas_totais ? `${item.horas_totais} h` : "—"}</td><td className="px-4 py-3 text-primary">{item.status}</td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhum lançamento neste mês" />}</section></Shell>;
}

export function DocumentosShareBrasil() {
  const [folders, setFolders] = useState<PastaDocumento[]>([]); const [docs, setDocs] = useState<DocumentoInterno[]>([]); const [folder, setFolder] = useState(""); const [selected, setSelected] = useState<string>(); const [file, setFile] = useState<File>(); const [error, setError] = useState<string | null>(null); const refresh = () => { void Promise.all([buscarPastasDocumentos(), buscarDocumentosInternos(selected)]).then(([p, d]) => { setFolders(p); setDocs(d); }).catch((e) => setError(e.message)); }; useEffect(refresh, [selected]); const addFolder = async () => { if (!folder.trim()) return; await criarPastaDocumento(folder, selected); setFolder(""); refresh(); }; const addDoc = async () => { if (!file) return; await enviarDocumentoInterno(file, selected); setFile(undefined); refresh(); };
  const download = async (item: DocumentoInterno) => { try { const blob = await carregarArquivoColaborador(item.arquivo_url); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = item.nome; anchor.click(); URL.revokeObjectURL(url); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir o documento."); } };
  return <Shell title="Documentos" detail="Crie pastas como no computador e armazene arquivos internos no bucket seguro da empresa."><Feedback error={error} ok={null} /><div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><section className={`${card} p-5 shadow-md lg:sticky lg:top-24 lg:self-start`}><CabecalhoSecao icon={<Folder size={15} />} title="Pastas" detail="Todos podem criar e organizar." /><div className="mt-5 flex gap-2"><Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Nova pasta" className={field} /><Button type="button" size="icon" onClick={() => void addFolder()}><FolderPlus size={15} /></Button></div><div className="mt-4 space-y-1"><button type="button" onClick={() => setSelected(undefined)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${!selected ? "border-primary/30 bg-primary/10 font-bold text-primary shadow-sm" : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/70 hover:text-foreground"}`}><Folder size={14} /> <span>Todos os documentos</span></button>{folders.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${selected === item.id ? "border-primary/30 bg-primary/10 font-bold text-primary shadow-sm" : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/70 hover:text-foreground"}`}><Folder size={14} /> <span className="truncate">{item.nome}</span></button>)}</div></section><section className={`${card} overflow-hidden shadow-md`}><CabecalhoSecao icon={<Upload size={15} />} title={selected ? folders.find((item) => item.id === selected)?.nome || "Documentos" : "Todos os documentos"} detail="PDF, imagens, planilhas e outros arquivos." action={<div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/[.04] p-2"><span className="hidden text-[10px] text-muted-foreground sm:inline">Solte ou selecione</span><Input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="h-8 max-w-[180px] text-[10px]" /><Button type="button" onClick={() => void addDoc()} disabled={!file} className="h-8 gap-1.5 text-[10px]"><Upload size={12} /> Anexar</Button></div>} />{docs.length ? <div className="divide-y divide-border/60">{docs.map((item) => <button type="button" key={item.id} onClick={() => void download(item)} className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-primary/[.04]"><span className="min-w-0"><span className="block truncate text-xs font-bold">{item.nome}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.tipo_arquivo} · {Math.round(item.tamanho_arquivo / 1024)} KB</span></span><FilePlus2 size={15} className="shrink-0 text-primary" /></button>)}</div> : <div className="mx-4 my-4 rounded-xl border border-dashed border-border/80 bg-secondary/20"><EstadoVazio label="Nenhum documento nesta pasta" /></div>}</section></div></Shell>;
}

export function SenhasShareBrasil() {
  const [items, setItems] = useState<SenhaEmpresa[]>([]); const [visible, setVisible] = useState<Record<string, string>>({}); const [form, setForm] = useState({ titulo: "", site: "", login: "", senha: "", setor: "" }); const [error, setError] = useState<string | null>(null); const refresh = () => { void buscarSenhas().then(setItems).catch((e) => setError(e.message)); }; useEffect(refresh, []); const reveal = async (id: string) => { if (visible[id]) return setVisible((v) => { const n = { ...v }; delete n[id]; return n; }); const data = await revelarSenha(id); setVisible((v) => ({ ...v, [id]: data.senha || "" })); }; const add = async () => { if (!form.titulo || !form.site || !form.login || !form.senha) return setError("Preencha título, site, login e senha."); await criarSenha(form); setForm({ titulo: "", site: "", login: "", senha: "", setor: "" }); refresh(); }; const copy = (value: string) => { void navigator.clipboard?.writeText(value); };
  return <Shell title="Senhas" detail="Credenciais corporativas organizadas por setor, com senha oculta e cópia rápida."><Feedback error={error} ok={null} /><section className={`${card} p-4`}><CabecalhoSecao icon={<Plus size={15} />} title="Nova credencial" detail="A senha fica oculta até ser revelada." /><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Input placeholder="Nome" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={field} /><Input placeholder="Site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className={field} /><Input placeholder="Login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className={field} /><Input placeholder="Senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className={field} /><Button type="button" onClick={() => void add()} className="h-10 gap-2 text-xs"><Plus size={14} /> Salvar</Button></div></section><section className={`${card} overflow-hidden`}><CabecalhoSecao icon={<KeyRound size={15} />} title="Cofre corporativo" detail={`${items.length} credencial(is) cadastrada(s)`} />{items.length ? <div className="divide-y divide-border/60">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-[170px] flex-1"><p className="text-xs font-bold">{item.titulo}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.site} {item.setor ? `· ${item.setor}` : ""}</p></div><span className="font-mono text-[11px] text-muted-foreground">{item.login}</span><span className="min-w-[120px] font-mono text-[11px]">{visible[item.id] || "••••••••"}</span><Button type="button" variant="outline" onClick={() => void reveal(item.id)} className="h-8 text-[10px]">{visible[item.id] ? "Ocultar" : "Visualizar"}</Button>{visible[item.id] && <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(visible[item.id])}><Copy size={13} /></Button>}<Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-300" onClick={() => void excluirSenha(item.id).then(refresh)}><X size={14} /></Button></div>)}</div> : <EstadoVazio label="Nenhuma senha cadastrada" />}</section></Shell>;
}

export function ContatosClientesShareBrasil() {
  const [tab, setTab] = useState<"contatos" | "clientes">("contatos");
  const [contactView, setContactView] = useState<"lista" | "grade">("grade");
  const [clientView, setClientView] = useState<"lista" | "grade">("grade");
  const [contacts, setContacts] = useState<ContatoAgenda[]>([]);
  const [clients, setClients] = useState<ClienteShare[]>([]);
  const [links, setLinks] = useState<ClienteShare[]>([]);
  const [aircraft, setAircraft] = useState<ClienteShare[]>([]);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", empresa: "", cargo: "" });
  const [clientForm, setClientForm] = useState<Record<string, any>>({ razao_social: "", codigo_cliente: "", cnpj: "", proprietario: "", telefone_cliente: "", email_principal: "", endereco: "", cidade: "", uf: "", observacoes: "" });
  const [aircraftId, setAircraftId] = useState("");
  const [aircraftPercent, setAircraftPercent] = useState("100");
  const [selectedClient, setSelectedClient] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = () => {
    void Promise.all([buscarContatosShare(), buscarClientesShare()])
      .then(([c, data]) => {
        setContacts(c);
        setClients(data.clientes);
        setLinks(data.vinculos);
        setAircraft(data.aeronaves);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(refresh, []);

  const selected = clients.find((item) => item.id === selectedClient);
  useEffect(() => {
    if (selected) {
      setClientForm({
        razao_social: selected.razao_social || "",
        codigo_cliente: selected.codigo_cliente || "",
        cnpj: selected.cnpj || "",
        proprietario: selected.proprietario || "",
        telefone_cliente: selected.telefone_cliente || "",
        email_principal: selected.email_principal || "",
        endereco: selected.endereco || "",
        cidade: selected.cidade || "",
        uf: selected.uf || "",
        observacoes: selected.observacoes || "",
      });
    }
  }, [selected]);

  const addContact = async () => {
    if (!form.nome) return;
    try {
      await criarContatoShare(form);
      setForm({ nome: "", telefone: "", email: "", empresa: "", cargo: "" });
      setOk("Contato salvo.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o contato.");
    }
  };
  const removeContact = async (id: string) => {
    try {
      await excluirContatoShare(id);
      setOk("Contato removido.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível remover o contato.");
    }
  };
  const addClient = async () => {
    if (!clientForm.razao_social) return;
    try {
      const result = await criarClienteShare(clientForm);
      setSelectedClient(result.id);
      setOk("Cliente criado.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o cliente.");
    }
  };
  const saveClient = async () => {
    if (!selectedClient) return;
    try {
      await atualizarClienteShare(selectedClient, clientForm);
      setOk("Cadastro atualizado.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o cliente.");
    }
  };
  const linkAircraft = async () => {
    if (!selectedClient || !aircraftId) return;
    try {
      await vincularAeronaveCliente(selectedClient, {
        aeronave_id: aircraftId,
        percentual_sociedade: Number(aircraftPercent) || 100,
        codigo_cliente: clientForm.codigo_cliente || null,
      });
      setOk("Aeronave vinculada ao cliente.");
      setAircraftId("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível vincular a aeronave.");
    }
  };
  const upload = async (kind: "logo" | "doc", file?: File) => {
    if (!selectedClient || !file) return;
    try {
      if (kind === "logo") await enviarLogoCliente(selectedClient, file);
      else await enviarDocumentoCliente(selectedClient, file);
      setOk(kind === "logo" ? "Logo salva." : "Documento salvo.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    }
  };
  const input = (name: string, placeholder: string) => (
    <Input
      placeholder={placeholder}
      value={String(clientForm[name] || "")}
      onChange={(e) => setClientForm({ ...clientForm, [name]: e.target.value })}
      className={field}
    />
  );
  const viewToggle = (view: "lista" | "grade", setView: (view: "lista" | "grade") => void, label: string) => (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/60 p-1" role="group" aria-label={`Visualização ${label}`}>
      <button
        type="button"
        onClick={() => setView("lista")}
        aria-label={`Visualizar ${label} em lista`}
        aria-pressed={view === "lista"}
        title="Visualização em lista"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${view === "lista" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
      >
        <List size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setView("grade")}
        aria-label={`Visualizar ${label} em grade`}
        aria-pressed={view === "grade"}
        title="Visualização em grade"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${view === "grade" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
      >
        <Grid2X2 size={14} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <Shell title="Contatos e Clientes" detail="Agenda de relacionamento e cadastro completo de clientes cotistas, com vínculos, documentos e logo.">
      <Feedback error={error} ok={ok} />
      <div className="flex flex-wrap gap-2 border-b border-border">
        <Button type="button" variant={tab === "contatos" ? "default" : "ghost"} onClick={() => setTab("contatos")} className="gap-2 text-xs">
          <UserRound size={14} /> Agenda de contatos
        </Button>
        <Button type="button" variant={tab === "clientes" ? "default" : "ghost"} onClick={() => setTab("clientes")} className="gap-2 text-xs">
          <Users size={14} /> Clientes cotistas
        </Button>
      </div>

      {tab === "contatos" ? (
        <div className="space-y-4">
          <section className={`${card} p-4 md:p-5`}>
            <CabecalhoSecao icon={<Plus size={15} />} title="Novo contato" detail="Adicione pessoas e parceiros à agenda." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={field} />
              <Input placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={field} />
              <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
              <Input placeholder="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className={field} />
              <Input placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className={field} />
              <Button type="button" onClick={() => void addContact()} className="h-10 gap-2 text-xs">
                <Plus size={14} /> Salvar
              </Button>
            </div>
          </section>

          <section className={`${card} overflow-hidden`}>
            <CabecalhoSecao
              icon={<UserRound size={15} />}
              title="Agenda de contatos"
              detail={`${contacts.length} contato(s) cadastrado(s)`}
              action={viewToggle(contactView, setContactView, "a agenda de contatos")}
            />
            {contacts.length ? (
              <div className={`p-4 ${contactView === "lista" ? "space-y-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}`}>
                {contacts.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-border/70 bg-background/35 transition-colors hover:border-primary/35 hover:bg-primary/[.03] ${contactView === "lista" ? "flex items-center justify-between gap-3 px-4 py-3" : "flex min-h-[142px] flex-col justify-between gap-5 p-4"}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {item.nome?.charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{item.nome}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{[item.cargo, item.empresa, item.email, item.telefone].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => void removeContact(item.id)} aria-label={`Remover contato ${item.nome}`} title="Remover contato" className="shrink-0 self-end text-muted-foreground hover:bg-red-400/10 hover:text-red-300">
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EstadoVazio label="Nenhum contato cadastrado" />
            )}
          </section>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <section className={`${card} overflow-hidden`}>
            <CabecalhoSecao
              icon={<Users size={15} />}
              title="Clientes cotistas"
              detail="Selecione um cliente para editar o perfil."
              action={viewToggle(clientView, setClientView, "os clientes")}
            />
            {clients.length ? (
              <div className={`p-3 ${clientView === "lista" ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}`}>
                {clients.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedClient(item.id)}
                    aria-pressed={selectedClient === item.id}
                    className={`w-full rounded-xl border text-left transition-all ${selectedClient === item.id ? "border-primary/45 bg-primary/[.08] shadow-sm" : "border-border/70 bg-background/35 hover:border-primary/35 hover:bg-primary/[.03]"} ${clientView === "lista" ? "flex items-center gap-3 px-3 py-3" : "flex min-h-[128px] flex-col justify-between gap-4 p-4"}`}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selectedClient === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {(item.razao_social || "?").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{item.razao_social || "Cliente sem razão social"}</span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{item.codigo_cliente || "Sem código"} · {item.cnpj || "CNPJ não informado"}</span>
                      </span>
                    </span>
                    {selectedClient === item.id && <span className="shrink-0 text-[9px] font-bold uppercase tracking-[.08em] text-primary">Selecionado</span>}
                  </button>
                ))}
              </div>
            ) : (
              <EstadoVazio label="Nenhum cliente cadastrado" />
            )}
          </section>

          <section className={`${card} p-4 md:p-5`}>
            <CabecalhoSecao icon={<Plus size={15} />} title={selectedClient ? "Perfil do cliente" : "Novo cliente cotista"} detail="Todos os dados cadastrais podem ser editados." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {input("razao_social", "Razão social")}
              {input("codigo_cliente", "Código do cliente")}
              {input("cnpj", "CNPJ")}
              {input("proprietario", "Proprietário")}
              {input("telefone_cliente", "Telefone")}
              {input("email_principal", "E-mail")}
              {input("endereco", "Endereço")}
              {input("cidade", "Cidade")}
              {input("uf", "UF")}
              {input("observacoes", "Observações")}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void (selectedClient ? saveClient() : addClient())} className="h-9 gap-2 text-xs">
                <Plus size={14} /> {selectedClient ? "Salvar alterações" : "Criar cliente"}
              </Button>
              {selectedClient && (
                <>
                  <Input type="file" accept="image/*" aria-label="Enviar logo do cliente" onChange={(e) => void upload("logo", e.target.files?.[0])} className="h-9 max-w-[190px] text-[10px]" />
                  <Input type="file" aria-label="Enviar documento do cliente" onChange={(e) => void upload("doc", e.target.files?.[0])} className="h-9 max-w-[190px] text-[10px]" />
                </>
              )}
            </div>
            {selectedClient && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Vincular aeronave</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select aria-label="Selecionar aeronave" value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className={`${field} min-w-[230px]`}>
                    <option value="">Selecionar aeronave</option>
                    {aircraft.map((item) => <option key={item.id} value={item.id}>{item.matricula_registro} · {item.fabricante} {item.modelo}</option>)}
                  </select>
                  <Input value={aircraftPercent} onChange={(e) => setAircraftPercent(e.target.value)} type="number" min="0" max="100" placeholder="%" aria-label="Percentual de sociedade" className="h-10 w-24" />
                  <Button type="button" onClick={() => void linkAircraft()} className="h-10 text-xs">Vincular</Button>
                </div>
                <div className="mt-3 space-y-1">
                  {links.filter((item) => item.cliente_id === selectedClient).map((item) => <p key={item.id} className="text-[10px] text-muted-foreground">{item.matricula_registro || "Aeronave"} · {item.fabricante} {item.modelo} · {item.percentual_sociedade}%</p>)}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}


function tarefaLabel(status: string) { return status === "CONCLUIDA" ? "Concluída" : status === "EM_ANDAMENTO" ? "Em andamento" : "Aberta"; }
function tarefaDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function diasDoMes(month: string) { const [year, monthNumber] = month.split("-").map(Number); const first = new Date(year, monthNumber - 1, 1); const offset = (first.getDay() + 6) % 7; return Array.from({ length: 42 }, (_, index) => { const date = new Date(year, monthNumber - 1, index - offset + 1); return { date, key: tarefaDateKey(date), current: date.getMonth() === monthNumber - 1 }; }); }

export function TarefasShareBrasil() {
  const [view, setView] = useState<"kanban" | "lista" | "calendario">("kanban");
  const [tasks, setTasks] = useState<import("@/lib/colaborador-api").TarefaShare[]>([]);
  const [notifications, setNotifications] = useState<import("@/lib/colaborador-api").NotificacaoTarefa[]>([]);
  const [users, setUsers] = useState<import("@/lib/colaborador-api").UsuariosTarefas>([]);
  const [events, setEvents] = useState<import("@/lib/colaborador-api").LembreteCalendario[]>([]);
  const [categories, setCategories] = useState<import("@/lib/colaborador-api").CategoriaCalendario[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [taskForm, setTaskForm] = useState({ titulo: "", descricao: "", prazo: "", prioridade: "MEDIA", publico: false, atribuido_para: "" });
  const [eventForm, setEventForm] = useState({ titulo: "", descricao: "", data: tarefaDateKey(new Date()), hora: "", visibilidade: "PRIVADO", cor_categoria_id: "" });
  const [categoryName, setCategoryName] = useState(""); const [categoryColor, setCategoryColor] = useState("#2fb9a7");
  const [error, setError] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const manager = users.length > 0;
  const days = useMemo(() => diasDoMes(month), [month]);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const refreshTasks = async () => { try { const data = await buscarTarefas(); setTasks(data.tarefas); setNotifications(data.notificacoes); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar as tarefas."); } };
  const refreshCalendar = async () => { try { const [cats, reminders] = await Promise.all([buscarCategoriasCalendario(), buscarLembretesCalendario(`${month}-01`, `${month}-31`)]); setCategories(cats); setEvents(reminders); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar o calendário."); } };
  useEffect(() => { void refreshTasks(); void buscarUsuariosTarefas().then(setUsers).catch(() => setUsers([])); }, []);
  useEffect(() => { void refreshCalendar(); }, [month]);
  const createTask = async () => { if (!taskForm.titulo.trim()) return setError("Informe o título da tarefa."); setBusy(true); try { await criarTarefaShare({ ...taskForm, atribuido_para: taskForm.atribuido_para ? [taskForm.atribuido_para] : [] }); setTaskForm({ titulo: "", descricao: "", prazo: "", prioridade: "MEDIA", publico: false, atribuido_para: "" }); setOk("Tarefa criada e as notificações foram enviadas."); await refreshTasks(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a tarefa."); } finally { setBusy(false); } };
  const moveTask = async (task: import("@/lib/colaborador-api").TarefaShare, status: string) => { try { await atualizarTarefaShare(task.id, { status, progresso: status === "CONCLUIDA" ? 100 : status === "EM_ANDAMENTO" ? 50 : 0 }); setOk(status === "CONCLUIDA" ? "Tarefa concluída; o solicitante foi notificado." : "Status atualizado."); await refreshTasks(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa."); } };
  const addComment = async () => { if (!selectedTask || !comment.trim()) return; try { await comentarTarefaShare(selectedTask, comment); setComment(""); setOk("Comentário adicionado e os envolvidos foram notificados."); await refreshTasks(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível adicionar o comentário."); } };
  const markRead = async (notificationId: string) => { try { await marcarNotificacaoTarefaLida(notificationId); setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, lido: 1 } : item)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a notificação."); } };
  const createCategory = async () => { if (!categoryName.trim()) return; try { const category = await criarCategoriaCalendario(categoryName, categoryColor); setCategories((items) => [...items, category]); setCategoryName(""); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a categoria."); } };
  const createEvent = async () => { if (!eventForm.titulo.trim() || !eventForm.data) return setError("Informe título e data do lembrete."); try { await criarLembreteCalendario({ ...eventForm, cor_categoria_id: eventForm.cor_categoria_id || null }); setOk(eventForm.visibilidade === "TODOS" ? "Evento criado; todos os usuários foram notificados." : "Evento privado criado."); await refreshCalendar(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o evento."); } };
  const columns = [{ status: "ABERTO", title: "Aberto" }, { status: "EM_ANDAMENTO", title: "Em andamento" }, { status: "CONCLUIDA", title: "Concluída" }];
  return <Shell title="Tarefas" detail="Organize suas tarefas em Kanban, lista ou calendário. Tarefas pessoais são privadas; apenas admin e gestor master podem atribuir tarefas a outros usuários."><Feedback error={error} ok={ok} /><section className={`${card} p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">Nova tarefa</p><p className="mt-1 text-[10px] text-muted-foreground">{manager ? "Você pode criar e atribuir tarefas para outros usuários." : "Você pode criar tarefas individuais que somente você verá."}</p></div><div className="flex items-center gap-1 rounded-lg border border-border bg-background/50 p-1"><button type="button" onClick={() => setView("kanban")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Columns3 size={13} className="mr-1 inline" /> Kanban</button><button type="button" onClick={() => setView("lista")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><ListTodo size={13} className="mr-1 inline" /> Lista</button><button type="button" onClick={() => setView("calendario")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${view === "calendario" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarDays size={13} className="mr-1 inline" /> Calendário</button></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-5"><Input placeholder="Título da tarefa" value={taskForm.titulo} onChange={(e) => setTaskForm({ ...taskForm, titulo: e.target.value })} className={field} /><Input placeholder="Prazo" type="date" value={taskForm.prazo} onChange={(e) => setTaskForm({ ...taskForm, prazo: e.target.value })} className={field} /><select value={taskForm.prioridade} onChange={(e) => setTaskForm({ ...taskForm, prioridade: e.target.value })} className={field}><option value="BAIXA">Prioridade baixa</option><option value="MEDIA">Prioridade média</option><option value="ALTA">Prioridade alta</option></select>{manager ? <select value={taskForm.atribuido_para} onChange={(e) => setTaskForm({ ...taskForm, atribuido_para: e.target.value })} className={field}><option value="">Tarefa pessoal</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nome_exibicao || user.nome_completo}</option>)}</select> : <label className="flex h-10 items-center gap-2 rounded-lg border border-border/70 px-3 text-[11px] text-muted-foreground"><LockIcon /> Tarefa privada</label>}<Button type="button" disabled={busy} onClick={() => void createTask()} className="h-10 gap-2 text-xs"><Plus size={14} /> Criar tarefa</Button></div><Textarea value={taskForm.descricao} onChange={(e) => setTaskForm({ ...taskForm, descricao: e.target.value })} placeholder="Descrição opcional" className="mt-2 min-h-[68px] bg-background/70 text-sm" />{manager && <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"><input type="checkbox" checked={taskForm.publico} onChange={(e) => setTaskForm({ ...taskForm, publico: e.target.checked })} /> Tornar visível para todos</label>}</section>{view !== "calendario" && <section className={`${card} p-4`}><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold">{view === "kanban" ? "Quadro Kanban" : "Lista de tarefas"}</p><p className="mt-1 text-[10px] text-muted-foreground">{tasks.length} tarefa(s) visível(is) para você.</p></div><span className="text-[10px] text-muted-foreground"><Bell size={13} className="mr-1 inline text-primary" /> {notifications.filter((item) => !item.lido).length} não lida(s)</span></div>{view === "kanban" ? <div className="grid gap-3 lg:grid-cols-3">{columns.map((column) => <div key={column.status} className="min-h-[230px] rounded-lg border border-border/70 bg-background/30 p-3"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.12em]">{column.title}</p><span className="rounded-full bg-secondary px-2 py-1 text-[9px]">{tasks.filter((task) => task.status === column.status).length}</span></div><div className="space-y-2">{tasks.filter((task) => task.status === column.status).map((task) => <TaskCard key={task.id} task={task} selected={selectedTask === task.id} onSelect={() => setSelectedTask(task.id)} onMove={(status) => void moveTask(task, status)} />)}</div></div>)}</div> : tasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-[10px]"><thead><tr className="border-b border-border text-[9px] uppercase tracking-[.1em] text-muted-foreground"><th className="px-3 py-2">Tarefa</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Prioridade</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b border-border/50"><td className="px-3 py-3"><p className="font-bold">{task.titulo}</p><p className="mt-1 text-muted-foreground">{task.descricao || "Sem descrição"}</p></td><td className="px-3 py-3">{task.prazo || "—"}</td><td className="px-3 py-3">{task.prioridade}</td><td className="px-3 py-3 text-primary">{tarefaLabel(task.status)}</td><td className="px-3 py-3"><Button type="button" variant="outline" onClick={() => void moveTask(task, task.status === "ABERTO" ? "EM_ANDAMENTO" : "CONCLUIDA")} className="h-7 text-[10px]">{task.status === "CONCLUIDA" ? "Concluída" : "Avançar"}</Button></td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhuma tarefa visível" />}</section>}{selectedTask && <section className={`${card} p-4`}><div className="flex items-center justify-between"><CabecalhoSecao icon={<MessageSquare size={15} />} title="Comentários da tarefa" detail="Os envolvidos recebem uma notificação a cada comentário." /><button type="button" onClick={() => setSelectedTask(null)} className="text-muted-foreground"><X size={15} /></button></div><div className="mt-3 space-y-2">{tasks.find((task) => task.id === selectedTask)?.comentarios?.map((item) => <div key={item.id} className="rounded-lg bg-background/50 p-3 text-[11px]"><p>{item.comentario}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.usuario_nome || "Usuário"} · {item.criado_em}</p></div>)}</div><div className="mt-3 flex gap-2"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário" className={field} /><Button type="button" onClick={() => void addComment()} className="h-10 text-xs">Comentar</Button></div></section>}{view === "calendario" && <CalendarPanel month={month} monthLabel={monthLabel} days={days} events={events} categories={categories} form={eventForm} setForm={setEventForm} onPrevious={() => setMonth((value) => { const date = new Date(`${value}-01T12:00:00`); date.setMonth(date.getMonth() - 1); return date.toISOString().slice(0, 7); })} onNext={() => setMonth((value) => { const date = new Date(`${value}-01T12:00:00`); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 7); })} onCreate={createEvent} categoryName={categoryName} categoryColor={categoryColor} setCategoryName={setCategoryName} setCategoryColor={setCategoryColor} onCreateCategory={createCategory} />}<section className={`${card} p-4`}><CabecalhoSecao icon={<Bell size={15} />} title="Notificações" detail="Atribuições, conclusões, comentários e eventos públicos." />{notifications.length ? <div className="divide-y divide-border/60">{notifications.slice(0, 8).map((item) => <button type="button" key={item.id} onClick={() => void markRead(item.id)} className={`flex w-full items-start gap-3 px-3 py-3 text-left ${item.lido ? "opacity-60" : "bg-primary/[.04]"}`}><Bell size={14} className="mt-0.5 shrink-0 text-primary" /><span><span className="block text-xs">{item.mensagem}</span><span className="mt-1 block text-[9px] text-muted-foreground">{item.criado_em}{item.lido ? " · lida" : " · clique para marcar como lida"}</span></span></button>)}</div> : <EstadoVazio label="Nenhuma notificação" />}</section></Shell>;
}

function LockIcon() { return <span className="text-primary">●</span>; }
function TaskCard({ task, selected, onSelect, onMove }: { task: import("@/lib/colaborador-api").TarefaShare; selected: boolean; onSelect: () => void; onMove: (status: string) => void }) { return <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/[.08]" : "border-border/70 bg-card/60 hover:border-primary/40"}`}><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold">{task.titulo}</p>{task.publico ? <span className="text-[9px] text-primary">Público</span> : <span className="text-[9px] text-muted-foreground">Privado</span>}</div>{task.descricao && <p className="mt-2 line-clamp-2 text-[10px] text-muted-foreground">{task.descricao}</p>}<div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-muted-foreground"><span>{task.prazo || "Sem prazo"} · {task.prioridade}</span>{task.status !== "CONCLUIDA" && <span onClick={(event) => { event.stopPropagation(); onMove(task.status === "ABERTO" ? "EM_ANDAMENTO" : "CONCLUIDA"); }} className="font-bold text-primary">{task.status === "ABERTO" ? "Iniciar" : "Concluir"}</span>}</div></button>; }

function CalendarPanel({ month, monthLabel, days, events, categories, form, setForm, onPrevious, onNext, onCreate, categoryName, categoryColor, setCategoryName, setCategoryColor, onCreateCategory }: { month: string; monthLabel: string; days: Array<{ date: Date; key: string; current: boolean }>; events: import("@/lib/colaborador-api").LembreteCalendario[]; categories: import("@/lib/colaborador-api").CategoriaCalendario[]; form: { titulo: string; descricao: string; data: string; hora: string; visibilidade: string; cor_categoria_id: string }; setForm: (form: any) => void; onPrevious: () => void; onNext: () => void; onCreate: () => void; categoryName: string; categoryColor: string; setCategoryName: (value: string) => void; setCategoryColor: (value: string) => void; onCreateCategory: () => void }) { return <section className={`${card} p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold capitalize">Calendário · {monthLabel}</p><p className="mt-1 text-[10px] text-muted-foreground">Privado aparece só para você; público envia alerta para todos.</p></div><div className="flex gap-1"><Button type="button" variant="outline" size="icon" onClick={onPrevious} className="h-8 w-8"><ChevronLeft size={14} /></Button><Button type="button" variant="outline" size="icon" onClick={onNext} className="h-8 w-8"><ChevronRight size={14} /></Button></div></div><div className="mt-4 grid gap-4 xl:grid-cols-[1fr_300px]"><div><div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-muted-foreground">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day} className="py-2">{day}</span>)}</div><div className="grid grid-cols-7 gap-1">{days.map((day) => { const dayEvents = events.filter((event) => event.data === day.key); return <div key={day.key} className={`min-h-[84px] rounded-lg border p-2 ${day.current ? "border-border/70 bg-background/30" : "border-border/30 bg-background/10 opacity-50"}`}><p className="text-[10px] font-bold">{day.date.getDate()}</p><div className="mt-2 space-y-1">{dayEvents.map((event) => <div key={event.id} className="truncate rounded px-1.5 py-1 text-[9px] font-semibold" style={{ backgroundColor: `${event.categoria_cor || "#2fb9a7"}22`, color: event.categoria_cor || "#2fb9a7" }} title={event.descricao || event.titulo}>{event.hora ? `${event.hora} ` : ""}{event.titulo}</div>)}</div></div>; })}</div></div><div className="rounded-lg border border-border/70 bg-background/30 p-3"><p className="text-xs font-bold">Novo agendamento</p><div className="mt-3 space-y-2"><Input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={field} /><Textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="min-h-[58px] bg-background/70 text-xs" /><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={field} /><Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className={field} /><select value={form.visibilidade} onChange={(e) => setForm({ ...form, visibilidade: e.target.value })} className={field}><option value="PRIVADO">Privado · só eu</option><option value="TODOS">Público · todos os usuários</option></select><select value={form.cor_categoria_id} onChange={(e) => setForm({ ...form, cor_categoria_id: e.target.value })} className={field}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select><Button type="button" onClick={onCreate} className="h-9 w-full text-xs"><CalendarDays size={14} className="mr-1.5" /> Salvar lembrete</Button></div><div className="mt-4 border-t border-border pt-3"><p className="text-[10px] font-bold">Nova categoria</p><div className="mt-2 flex gap-2"><Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Pessoal, reunião..." className="h-9 text-xs" /><Input type="color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} className="h-9 w-12 p-1" /><Button type="button" size="icon" onClick={onCreateCategory} className="h-9 w-9"><Plus size={14} /></Button></div></div></div></div></section>; }
