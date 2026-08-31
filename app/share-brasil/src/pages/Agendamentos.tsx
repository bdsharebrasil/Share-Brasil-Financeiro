import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, Plane, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AcaoRapida, CabecalhoSecao, CartaoKpi, EtiquetaStatus, EstadoVazio, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import {
  aprovarSolicitacaoVoo,
  buscarOpcoesAgendamento,
  buscarPainelAgendamento,
  criarAgendamento,
  definirDisponibilidadeTripulacao,
  reprovarSolicitacaoVoo,
  type AeronaveAgendamento,
  type DisponibilidadeTripulacao,
  type EscalaAgendamento,
  type NovoAgendamento,
  type OpcoesAgendamentoResponse,
  type PainelAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";

const abas = [
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "escala", label: "Escala", icon: Users },
  { id: "cronograma", label: "Cronograma de Voos", icon: ClipboardList },
] as const;
type AbaAgendamento = (typeof abas)[number]["id"];
type VisaoEscala = "semanal" | "mensal";

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
function primeiroDiaMes(data: Date) { return new Date(data.getFullYear(), data.getMonth(), 1); }
function ultimoDiaMes(data: Date) { return new Date(data.getFullYear(), data.getMonth() + 1, 0); }
function inicioSemana(data: Date) { return new Date(data.getFullYear(), data.getMonth(), data.getDate() - ((data.getDay() + 6) % 7)); }
function diasCalendario(data: Date) {
  const inicio = primeiroDiaMes(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  const total = Math.ceil((deslocamento + ultimoDiaMes(data).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, indice) => new Date(data.getFullYear(), data.getMonth(), indice - deslocamento + 1));
}
function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}
function tomStatus(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "aprovada") return "green";
  if (status === "reprovada" || status === "cancelada") return "red";
  if (status === "pendente") return "amber";
  return "neutral";
}
function statusLabel(status: string) {
  return ({ pendente: "Pendente", aprovada: "Aprovada", reprovada: "Reprovada", cancelada: "Cancelada" } as Record<string, string>)[status] || status;
}
function itensTitulares(opcoes: OpcoesAgendamentoResponse) {
  return [
    ...opcoes.clientes.map((item) => ({ id: `cliente:${item.id}`, label: `Cliente · ${item.nome}${item.codigo_cliente ? ` · ${item.codigo_cliente}` : ""}` })),
    ...opcoes.socios.map((item) => ({ id: `socio:${item.id}`, label: `Sócio · ${item.nome}` })),
  ];
}

export default function Agendamentos() {
  const { toast } = useToast();
  const [aba, setAba] = useState<AbaAgendamento>("calendario");
  const [mes, setMes] = useState(() => primeiroDiaMes(new Date()));
  const [semanaCalendario, setSemanaCalendario] = useState(() => inicioSemana(new Date()));
  const [visaoCalendario, setVisaoCalendario] = useState<VisaoEscala>("semanal");
  const [visaoEscala, setVisaoEscala] = useState<VisaoEscala>("semanal");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesAgendamentoResponse>({ clientes: [], socios: [], aeronaves: [], vinculos: [] });
  const [selecionada, setSelecionada] = useState<SolicitacaoVooInterna | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [mostrarDisponibilidade, setMostrarDisponibilidade] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), horario_previsto_agendamento: "", dias_duracao: 1, numero_passageiros: 1, voo_emprestado: "nao", piloto_id: "", copiloto_id: "", observacoes: "" });
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({ tripulante_id: "", data_inicio: dataIso(new Date()), data_fim: dataIso(new Date()), status: "aviso" as "aviso" | "ferias" | "disponivel", observacoes: "" });

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [painelAtual, opcoesAtuais] = await Promise.all([buscarPainelAgendamento("2000-01-01", "2099-12-31"), buscarOpcoesAgendamento()]);
      setPainel(painelAtual);
      setOpcoes(opcoesAtuais);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o módulo de agendamento.");
    } finally { setCarregando(false); setAtualizando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const agendamentos = painel?.agendamentos || [];
  const confirmados = useMemo(() => agendamentos.filter((item) => item.status === "aprovada"), [agendamentos]);
  const pendentes = useMemo(() => agendamentos.filter((item) => item.status === "pendente"), [agendamentos]);
  const dias = useMemo(() => diasCalendario(mes), [mes]);
  const titulares = useMemo(() => itensTitulares(opcoes), [opcoes]);
  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return agendamentos;
    return agendamentos.filter((item) => [item.cliente_razao_social, item.socio_nome, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo));
  }, [agendamentos, busca]);

  const abrirSolicitacao = (item: SolicitacaoVooInterna) => {
    setSelecionada(item);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  };
  const aprovar = async () => {
    if (!selecionada || !pilotoId) { toast({ title: "Piloto comandante obrigatório", description: "Selecione o comandante para gerar o número do voo.", variant: "destructive" }); return; }
    setProcessando(true);
    try {
      const resposta = await aprovarSolicitacaoVoo(selecionada.id, pilotoId, copilotoId || undefined);
      toast({ title: "Solicitação aprovada", description: `Número de voo gerado: ${resposta.numero_voo}.` });
      setSelecionada(null);
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível aprovar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const reprovar = async () => {
    if (!selecionada || !motivo.trim()) { toast({ title: "Motivo obrigatório", description: "Informe o motivo da reprovação.", variant: "destructive" }); return; }
    setProcessando(true);
    try {
      await reprovarSolicitacaoVoo(selecionada.id, motivo.trim());
      toast({ title: "Solicitação reprovada", description: "O motivo foi registrado no histórico." });
      setSelecionada(null);
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível reprovar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const atualizarNovo = <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => setNovo((atual) => ({ ...atual, [campo]: valor }));
  const criarNovo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!novo.cliente_id && !novo.socio_id) { toast({ title: "Cliente ou sócio obrigatório", description: "Selecione o titular do agendamento.", variant: "destructive" }); return; }
    setProcessando(true);
    try {
      const resposta = await criarAgendamento({ ...novo, piloto_id: novo.piloto_id || undefined, copiloto_id: novo.copiloto_id || undefined });
      toast({ title: "Agendamento criado", description: resposta.numero_voo ? `Número de voo: ${resposta.numero_voo}.` : "A solicitação ficará pendente de confirmação." });
      setMostrarNovo(false);
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), horario_previsto_agendamento: "", dias_duracao: 1, numero_passageiros: 1, voo_emprestado: "nao", piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const salvarDisponibilidade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!novaDisponibilidade.tripulante_id) { toast({ title: "Tripulante obrigatório", description: "Selecione o piloto ou copiloto.", variant: "destructive" }); return; }
    setProcessando(true);
    try {
      await definirDisponibilidadeTripulacao(novaDisponibilidade);
      toast({ title: "Disponibilidade registrada", description: "A informação foi salva na escala da tripulação." });
      setMostrarDisponibilidade(false);
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const mudarMes = (delta: number) => setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  const mudarSemana = (delta: number) => setSemanaCalendario((atual) => new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + delta * 7));
  const mudarVisaoCalendario = (visao: VisaoEscala) => {
    setVisaoCalendario(visao);
    if (visao === "mensal") setMes(primeiroDiaMes(semanaCalendario));
    else setSemanaCalendario(inicioSemana(mes));
  };

  return <div className="route-enter space-y-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><IndicadorPagina>Operações / agendamento de voo</IndicadorPagina><h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Agendamento de Voo</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">Organize solicitações, aeronaves, confirmação de voos e escala da tripulação em uma única central.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setMostrarNovo((atual) => !atual)} className="gap-2 bg-primary text-primary-foreground"><Plus size={14} /> Novo agendamento</Button><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="gap-2 border-border bg-card text-xs"><RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><CartaoKpi label="Voos confirmados" value={carregando ? "—" : String(confirmados.length)} detail="Todos os registros carregados" icon={<Plane size={16} />} /><CartaoKpi label="Solicitações pendentes" value={carregando ? "—" : String(pendentes.length)} detail="Aguardando coordenação" tone="amber" icon={<Clock3 size={16} />} /><CartaoKpi label="Aeronaves disponíveis" value={carregando ? "—" : String(painel?.aeronaves.length || 0)} detail="Frota ativa do D1" tone="green" icon={<CalendarDays size={16} />} /></div>
    {mostrarNovo && <FormularioAgendamento novo={novo} opcoes={opcoes} titulares={titulares} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />}
    {erro && <div className="rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">{abas.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setAba(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold transition-colors ${aba === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={14} />{item.label}</button>; })}</nav>
    {aba === "calendario" && <CalendarioAgendamento mes={mes} semana={semanaCalendario} dias={dias} visao={visaoCalendario} confirmados={confirmados} pendentes={pendentes} aeronaves={painel?.aeronaves || []} aoMudarMes={mudarMes} aoMudarSemana={mudarSemana} aoMudarVisao={mudarVisaoCalendario} aoAbrir={abrirSolicitacao} />}
    {aba === "escala" && <Escala tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} visao={visaoEscala} aoMudarVisao={setVisaoEscala} aoMarcar={() => setMostrarDisponibilidade((atual) => !atual)} />}
    {aba === "cronograma" && <Cronograma solicitacoes={solicitacoesFiltradas} busca={busca} aoMudarBusca={setBusca} aoAbrir={abrirSolicitacao} />}
    {aba === "escala" && mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />}
    {selecionada && <DetalhesSolicitacao selecionada={selecionada} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando} aoFechar={() => setSelecionada(null)} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={() => void aprovar()} aoReprovar={() => void reprovar()} />}
  </div>;
}

type FormularioAgendamentoProps = { novo: NovoAgendamento; opcoes: OpcoesAgendamentoResponse; titulares: { id: string; label: string }[]; tripulacao: TripulanteAgendamento[]; atualizando: boolean; atualizar: <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => void; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void };
function FormularioAgendamento({ novo, opcoes, titulares, tripulacao, atualizando, atualizar, aoCancelar, aoEnviar }: FormularioAgendamentoProps) {
  const aeronavesVinculadas = opcoes.aeronaves.filter((aeronave) => {
    if (!novo.cliente_id && !novo.socio_id) return true;
    return opcoes.vinculos.some((vinculo) => vinculo.aeronave_id === aeronave.id && (novo.cliente_id ? vinculo.cliente_id === novo.cliente_id : vinculo.socio_id === novo.socio_id));
  });
  const mudarTitular = (valor: string) => {
    const [tipo, id] = valor.split(":");
    atualizar("cliente_id", tipo === "cliente" ? id : undefined);
    atualizar("socio_id", tipo === "socio" ? id : undefined);
    atualizar("aeronave_id", "");
  };
  const titularSelecionado = novo.cliente_id ? `cliente:${novo.cliente_id}` : novo.socio_id ? `socio:${novo.socio_id}` : "";
  return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Plus size={15} />} title="Novo agendamento" detail="O número do voo será gerado somente após a confirmação" action={<button type="button" onClick={aoCancelar} aria-label="Fechar novo agendamento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-1.5 md:col-span-2"><Label className="text-[10px]">Cliente / sócio</Label><SearchableCombobox items={titulares} value={titularSelecionado} onChange={mudarTitular} placeholder="Selecione o cliente ou sócio" searchPlaceholder="Digite para buscar cliente ou sócio" emptyMessage="Nenhum cliente ou sócio encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 md:col-span-2"><Label className="text-[10px]">Aeronave</Label><SearchableCombobox items={aeronavesVinculadas.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${item.fabricante || ""} ${item.modelo}` }))} value={novo.aeronave_id} onChange={(value) => atualizar("aeronave_id", value)} placeholder="Selecione a aeronave do cliente" searchPlaceholder="Digite matrícula ou modelo" emptyMessage="Nenhuma aeronave vinculada encontrada." icon={<Plane size={14} />} disabled={!titularSelecionado} /></div><div className="space-y-1.5"><Label htmlFor="origem-agendamento" className="text-[10px]">Origem</Label><Input id="origem-agendamento" value={novo.origem} onChange={(event) => atualizar("origem", event.target.value.toUpperCase())} placeholder="SBSP" required className="h-10 text-xs uppercase" /></div><div className="space-y-1.5"><Label htmlFor="destino-agendamento" className="text-[10px]">Destino</Label><Input id="destino-agendamento" value={novo.destino} onChange={(event) => atualizar("destino", event.target.value.toUpperCase())} placeholder="SBRJ" required className="h-10 text-xs uppercase" /></div><DataAgendamento valor={novo.data_agendada} aoAlterar={(valor) => atualizar("data_agendada", valor)} /><div className="space-y-1.5"><Label htmlFor="hora-agendamento" className="text-[10px]">Horário previsto (UTC)</Label><Input id="hora-agendamento" type="time" value={novo.horario_previsto_agendamento || ""} onChange={(event) => atualizar("horario_previsto_agendamento", event.target.value)} required className="h-10 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="duracao-agendamento" className="text-[10px]">Duração (dias)</Label><Input id="duracao-agendamento" type="number" min={1} value={novo.dias_duracao || 1} onChange={(event) => atualizar("dias_duracao", Number(event.target.value))} className="h-10 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="passageiros-agendamento" className="text-[10px]">Passageiros</Label><Input id="passageiros-agendamento" type="number" min={1} value={novo.numero_passageiros || 1} onChange={(event) => atualizar("numero_passageiros", Number(event.target.value))} className="h-10 text-xs" /></div><div className="space-y-1.5 md:col-span-2"><Label className="text-[10px]">Comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={novo.piloto_id || ""} onChange={(value) => atualizar("piloto_id", value)} placeholder="Definir depois" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 md:col-span-2"><Label className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac}` }))} value={novo.copiloto_id || ""} onChange={(value) => atualizar("copiloto_id", value)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5 md:col-span-2"><input id="voo-emprestado" type="checkbox" checked={novo.voo_emprestado === "sim"} onChange={(event) => atualizar("voo_emprestado", event.target.checked ? "sim" : "nao")} className="h-4 w-4 accent-primary" /><div><Label htmlFor="voo-emprestado" className="cursor-pointer text-[10px] font-semibold">Voo de empréstimo</Label><p className="text-[9px] text-muted-foreground">Marque quando a operação utilizar horas ou aeronave emprestada.</p></div></div><div className="space-y-1.5 md:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-agendamento" className="text-[10px]">Observações</Label><Textarea id="observacoes-agendamento" value={novo.observacoes || ""} onChange={(event) => atualizar("observacoes", event.target.value)} placeholder="Informações da trip, passageiros ou operação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="gap-2 text-xs">{atualizando ? "Salvando..." : "Salvar agendamento"}<Check size={14} /></Button></div></form></section>;
}

function DataAgendamento({ valor, aoAlterar }: { valor: string; aoAlterar: (valor: string) => void }) {
  const selecionada = valor ? new Date(`${valor}T00:00:00`) : undefined;
  return <div className="space-y-1.5"><Label htmlFor="data-agendamento" className="text-[10px]">Data do voo</Label><div className="flex gap-2"><Input id="data-agendamento" type="date" value={valor} onChange={(event) => aoAlterar(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><DateCalendar mode="single" selected={selecionada} onSelect={(data) => data && aoAlterar(dataIso(data))} initialFocus /></PopoverContent></Popover></div></div>;
}

function formatarHorarioAgendamento(valor: string | null | undefined) {
  if (!valor) return { utc: "—", brasilia: "—" };
  const partes = valor.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!partes) return { utc: valor, brasilia: "—" };
  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  const segundos = Number(partes[3] || 0);
  if (horas > 23 || minutos > 59 || segundos > 59) return { utc: valor, brasilia: "—" };
  const utc = `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  const brasilia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Date.UTC(1970, 0, 1, horas, minutos, segundos)));
  return { utc, brasilia };
}

type CalendarioAgendamentoProps = {
  mes: Date;
  semana: Date;
  dias: Date[];
  visao: VisaoEscala;
  confirmados: SolicitacaoVooInterna[];
  pendentes: SolicitacaoVooInterna[];
  aeronaves: AeronaveAgendamento[];
  aoMudarMes: (delta: number) => void;
  aoMudarSemana: (delta: number) => void;
  aoMudarVisao: (visao: VisaoEscala) => void;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
};

function CalendarioAgendamento({ mes, semana, dias, visao, confirmados, pendentes, aeronaves, aoMudarMes, aoMudarSemana, aoMudarVisao, aoAbrir }: CalendarioAgendamentoProps) {
  const eventosPorDia = new Map<string, SolicitacaoVooInterna[]>();
  [...confirmados, ...pendentes].forEach((item) => eventosPorDia.set(item.data_agendada, [...(eventosPorDia.get(item.data_agendada) || []), item]));
  const diasVisao = visao === "semanal" ? Array.from({ length: 7 }, (_, indice) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + indice)) : dias;
  const periodo = visao === "semanal"
    ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()]} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()]} ${diasVisao[6].getFullYear()}`
    : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;
  const mudarPeriodo = visao === "semanal" ? aoMudarSemana : aoMudarMes;
  const descricao = visao === "semanal" ? "Visão semanal dos voos e solicitações" : "Visão mensal dos voos e solicitações";
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Calendário de agendamento" detail={descricao} action={<div className="flex flex-wrap items-center justify-end gap-2"><div className="flex rounded-md border border-border p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "semanal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Mensal</button></div><div className="flex items-center gap-1"><button type="button" onClick={() => mudarPeriodo(-1)} aria-label={visao === "semanal" ? "Semana anterior" : "Mês anterior"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronLeft size={15} /></button><span className="min-w-[150px] text-center text-[10px] font-bold">{periodo}</span><button type="button" onClick={() => mudarPeriodo(1)} aria-label={visao === "semanal" ? "Próxima semana" : "Próximo mês"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} /></button></div></div>} /><div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{diasVisao.map((dia) => { const chave = dataIso(dia); const eventos = eventosPorDia.get(chave) || []; const noMes = visao === "semanal" || dia.getMonth() === mes.getMonth(); const hoje = chave === dataIso(new Date()); return <div key={chave} className={`min-h-[150px] border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${hoje ? "bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground"}`}>{dia.getDate()}</div><div className="space-y-1.5">{eventos.map((item) => <ResumoVooCalendario key={item.id} item={item} aeronave={item.matricula_registro || aeronaves.find((aeronave) => aeronave.id === item.aeronave_id)?.matricula_registro || "Aeronave a definir"} aoAbrir={aoAbrir} />)}</div></div>; })}</div></section></div>;
}

function ResumoVooCalendario({ item, aeronave, aoAbrir }: { item: SolicitacaoVooInterna; aeronave: string; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  const horario = formatarHorarioAgendamento(item.horario_previsto_agendamento);
  return <button type="button" onClick={() => aoAbrir(item)} className={`w-full rounded-md border p-2 text-left transition-colors hover:bg-secondary/40 ${item.status === "aprovada" ? "border-[#2bbf8a]/25 bg-[#2bbf8a]/5" : "border-[#f1c348]/25 bg-[#f1c348]/5"}`}><div className="flex items-start gap-1.5"><Plane size={12} className={`mt-0.5 shrink-0 ${item.status === "aprovada" ? "text-[#6bd188]" : "text-[#f4cc64]"}`} /><div className="min-w-0"><p className="truncate text-[10px] font-bold">{item.numero_voo || "Solicitação sem número"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino}</p><p className="truncate text-[9px] text-muted-foreground">{aeronave}</p><p className="mt-1 text-[9px] font-semibold leading-tight text-foreground">UTC: {horario.utc}</p><p className="text-[9px] font-semibold leading-tight text-foreground">Brasília: {horario.brasilia}</p></div></div></button>;
}

function CalendarioAgendamentoLegado({ mes, dias, confirmados, pendentes, aeronaves, aoMudarMes, aoAbrir }: { mes: Date; dias: Date[]; confirmados: SolicitacaoVooInterna[]; pendentes: SolicitacaoVooInterna[]; aeronaves: AeronaveAgendamento[]; aoMudarMes: (delta: number) => void; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  const eventosPorDia = new Map<string, SolicitacaoVooInterna[]>();
  [...confirmados, ...pendentes].forEach((item) => eventosPorDia.set(item.data_agendada, [...(eventosPorDia.get(item.data_agendada) || []), item]));
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Calendário de agendamento" detail="Visualização mensal dos voos e solicitações" action={<div className="flex items-center gap-1"><button type="button" onClick={() => aoMudarMes(-1)} aria-label="Mês anterior" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronLeft size={15} /></button><span className="min-w-[112px] text-center text-[10px] font-bold">{nomesMeses[mes.getMonth()]} {mes.getFullYear()}</span><button type="button" onClick={() => aoMudarMes(1)} aria-label="Próximo mês" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} /></button></div>} /><div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{dias.map((dia) => { const chave = dataIso(dia); const eventos = eventosPorDia.get(chave) || []; const noMes = dia.getMonth() === mes.getMonth(); const hoje = chave === dataIso(new Date()); return <div key={chave} className={`min-h-[86px] border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${hoje ? "bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground/40"}`}>{dia.getDate()}</div><div className="space-y-1">{eventos.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => aoAbrir(item)} className={`flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[9px] ${item.status === "aprovada" ? "border-[#2bbf8a]/20 bg-[#2bbf8a]/10 text-[#6bd188]" : "border-[#f1c348]/20 bg-[#f1c348]/10 text-[#f4cc64]"}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /><span className="truncate">{item.numero_voo || `${item.origem} → ${item.destino}`}</span></button>)}{eventos.length > 3 && <p className="px-1 text-[9px] text-muted-foreground">+{eventos.length - 3} registros</p>}</div></div>; })}</div></section><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Plane size={15} />} title="Agendamentos confirmados" detail="Voos aprovados no período" />{confirmados.length ? <div className="divide-y divide-border/60">{confirmados.slice(0, 8).map((item) => <ResumoVoo key={item.id} item={item} aoAbrir={aoAbrir} />)}</div> : <EstadoVazio label="Nenhum voo confirmado neste período" />}</section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Aeronaves disponíveis" detail="Frota ativa retornada pelo D1" />{aeronaves.length ? <div className="grid gap-2 p-4 sm:grid-cols-2">{aeronaves.slice(0, 6).map((item) => <div key={item.id} className="overflow-hidden rounded-lg border border-border/70 bg-secondary/20"><div className="relative h-20 bg-secondary/40">{item.url_imagem ? <img src={item.url_imagem} alt={`${item.matricula_registro} ${item.modelo}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-primary/70"><Plane size={24} /></div>}<span className="absolute right-2 top-2"><EtiquetaStatus tone="green">Disponível</EtiquetaStatus></span></div><div className="p-3"><p className="font-mono text-[10px] font-bold">{item.matricula_registro}</p><p className="mt-2 text-[10px] text-muted-foreground">{item.fabricante} {item.modelo}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.base || "Base não informada"} · {item.tipo_aeronave || "Aeronave"}</p></div></div>)}</div> : <EstadoVazio label="Nenhuma aeronave ativa encontrada" />}</section></div><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Clock3 size={15} />} title="Solicitações aguardando confirmação" detail="Selecione uma solicitação para escalar a tripulação e gerar o voo" />{pendentes.length ? <div className="divide-y divide-border/60">{pendentes.map((item) => <ResumoVoo key={item.id} item={item} aoAbrir={aoAbrir} />)}</div> : <EstadoVazio label="Nenhuma solicitação pendente" />}</section></div>;
}

function ResumoVoo({ item, aoAbrir }: { item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void }) { return <button type="button" onClick={() => aoAbrir(item)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/20"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === "aprovada" ? "bg-[#2bbf8a]/10 text-[#6bd188]" : "bg-[#f1c348]/10 text-[#f4cc64]"}`}><Plane size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold">{item.numero_voo || "Solicitação sem número"}</p><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></div><p className="mt-1 text-[10px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)} · {item.cliente_razao_social || item.socio_nome || item.codigo_cliente || "Titular não informado"}</p></div><ChevronRight size={15} className="text-muted-foreground" /></button>; }

function Escala({ tripulacao, escala, disponibilidades, visao, aoMudarVisao, aoMarcar }: { tripulacao: TripulanteAgendamento[]; escala: EscalaAgendamento[]; disponibilidades: DisponibilidadeTripulacao[]; visao: VisaoEscala; aoMudarVisao: (visao: VisaoEscala) => void; aoMarcar: () => void }) {
  const hoje = new Date();
  const diasVisao = visao === "mensal" ? diasCalendario(hoje) : Array.from({ length: 7 }, (_, indice) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7) + indice));
  const eventosDoDia = (dia: Date) => escala.filter((item) => { const chave = dataIso(dia); return chave >= item.data_agendada && chave <= (item.data_fim || item.data_agendada); });
  const statusDoDia = (dia: Date) => disponibilidades.filter((item) => { const chave = dataIso(dia); return chave >= item.data_inicio && chave <= item.data_fim; });
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Users size={15} />} title="Escala da tripulação" detail={visao === "mensal" ? "Visão mensal de voos e disponibilidade" : "Visão semanal de voos e disponibilidade"} action={<div className="flex items-center gap-2"><button type="button" onClick={aoMarcar} className="rounded-md border border-primary/30 px-2 py-1 text-[9px] font-bold text-primary hover:bg-primary/10">Marcar status</button><div className="flex rounded-md border border-border p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "semanal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Mensal</button></div></div>} /><div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{diasVisao.map((dia) => { const chave = dataIso(dia); const eventos = eventosDoDia(dia); const status = statusDoDia(dia); const noMes = visao === "semanal" || dia.getMonth() === hoje.getMonth(); return <div key={chave} className={`${visao === "mensal" ? "min-h-[92px]" : "min-h-[165px]"} border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className="mb-2 flex items-center justify-between"><span className={`font-mono text-[10px] ${chave === dataIso(hoje) ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground/40"}`}>{dia.getDate()}</span>{status[0] && <span title={status[0].status === "ferias" ? "Férias" : status[0].status === "aviso" ? "De aviso" : "Disponível"} className={`h-1.5 w-1.5 rounded-full ${status[0].status === "ferias" ? "bg-[#f4cc64]" : status[0].status === "aviso" ? "bg-muted-foreground" : "bg-[#6bd188]"}`} />}</div><div className="space-y-1">{eventos.slice(0, visao === "mensal" ? 2 : 4).map((item) => <div key={item.id} className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-1"><p className="truncate font-mono text-[9px] font-bold text-primary">{item.numero_voo || "Sem número"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino}</p></div>)}{eventos.length > (visao === "mensal" ? 2 : 4) && <p className="px-1 text-[9px] text-muted-foreground">+{eventos.length - (visao === "mensal" ? 2 : 4)} voos</p>}</div></div>; })}</div></section><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Plane size={15} />} title="Voos na escala" detail="Escala derivada dos agendamentos aprovados" />{escala.length ? <div className="divide-y divide-border/60">{escala.map((item) => <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-mono text-xs font-bold text-primary">{item.numero_voo || "Sem número"}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)}{item.data_fim !== item.data_agendada ? ` até ${formatarData(item.data_fim)}` : ""}</p></div><div><p className="text-[10px] font-semibold">Comandante: {item.piloto_nome || "Não escalado"}</p><p className="mt-1 text-[10px] text-muted-foreground">Copiloto: {item.copiloto_nome || "Não escalado"}</p></div><EtiquetaStatus tone="green">Confirmado</EtiquetaStatus></div>)}</div> : <EstadoVazio label="Nenhum voo aprovado com tripulação escalada" />}</section><section className="rounded-xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center gap-2"><Users size={16} className="text-primary" /><div><h2 className="text-xs font-bold">Tripulação e disponibilidade</h2><p className="text-[10px] text-muted-foreground">Pilotos das tabelas tripulacao e tripulacao_freelancer.</p></div></div>{tripulacao.length ? <div className="space-y-2">{tripulacao.map((item) => { const disponibilidade = disponibilidades.filter((registro) => registro.tripulante_id === item.id).at(-1); const statusDisponibilidade = disponibilidade?.status === "ferias" ? "Férias" : disponibilidade?.status === "aviso" ? "De aviso" : "Disponível"; const tomDisponibilidade = disponibilidade?.status === "ferias" ? "amber" : disponibilidade?.status === "aviso" ? "neutral" : "green"; return <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary"><img src={item.url_avatar || "/icon.pilot.png"} alt={`Avatar de ${item.nome_completo}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/icon.pilot.png"; }} /></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{item.nome_completo}</p><p className="mt-1 text-[9px] text-muted-foreground">CANAC {item.canac} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}{disponibilidade ? ` · ${formatarData(disponibilidade.data_inicio)} a ${formatarData(disponibilidade.data_fim)}` : ""}</p></div><EtiquetaStatus tone={tomDisponibilidade}>{statusDisponibilidade}</EtiquetaStatus></div>; })}</div> : <EstadoVazio label="Nenhum tripulante ativo encontrado" />}</section></div></div>;
}

function Cronograma({ solicitacoes, busca, aoMudarBusca, aoAbrir }: { solicitacoes: SolicitacaoVooInterna[]; busca: string; aoMudarBusca: (busca: string) => void; aoAbrir: (item: SolicitacaoVooInterna) => void }) { return <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Cronograma de Voos" detail="Todas as solicitações de voo" action={<div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar cliente, rota ou voo" className="h-8 w-56 pl-8 text-[10px]" /></div>} />{solicitacoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Número do voo</th><th className="px-4 py-3">Cliente / sócio</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Data / UTC</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Tripulação</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{solicitacoes.map((item) => <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3 font-mono text-[10px] font-bold text-primary">{item.numero_voo || "A gerar na confirmação"}</td><td className="px-4 py-3"><p className="max-w-[180px] truncate text-[10px] font-bold">{item.cliente_razao_social || item.socio_nome || "Titular não informado"}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.codigo_cliente || "Código pela cotista"}</p></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.origem} → {item.destino}</td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{formatarData(item.data_agendada)}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.horario_previsto_agendamento || "A definir"} UTC</p></td><td className="px-4 py-3 font-mono text-[10px]">{item.matricula_registro || "A definir"}</td><td className="px-4 py-3 text-[10px] text-muted-foreground">{item.piloto_id ? "Escalada" : "Pendente"}</td><td className="px-4 py-3"><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => aoAbrir(item)} className="text-[10px] font-bold text-primary hover:underline">Detalhes</button></td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhuma solicitação encontrada" />}</section>; }

function DetalhesSolicitacao({ selecionada, tripulacao, pilotoId, copilotoId, motivo, processando, aoFechar, aoPiloto, aoCopiloto, aoMotivo, aoAprovar, aoReprovar }: { selecionada: SolicitacaoVooInterna; tripulacao: TripulanteAgendamento[]; pilotoId: string; copilotoId: string; motivo: string; processando: boolean; aoFechar: () => void; aoPiloto: (valor: string) => void; aoCopiloto: (valor: string) => void; aoMotivo: (valor: string) => void; aoAprovar: () => void; aoReprovar: () => void }) { return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Detalhes da solicitação" detail={`${selecionada.origem} → ${selecionada.destino} · ${formatarData(selecionada.data_agendada)}`} action={<button type="button" onClick={aoFechar} aria-label="Fechar detalhes" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><div className="grid gap-5 p-5 lg:grid-cols-[1fr_.9fr]"><div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4"><Detalhe label="Cliente / sócio" valor={selecionada.cliente_razao_social || selecionada.socio_nome || selecionada.codigo_cliente || "Não informado"} /><Detalhe label="Aeronave" valor={`${selecionada.matricula_registro || "A definir"} · ${selecionada.modelo || "—"}`} /><Detalhe label="Duração" valor={`${selecionada.dias_duracao || 1} dia(s)`} /><Detalhe label="Passageiros" valor={String(selecionada.numero_passageiros || 1)} /><Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} /><Detalhe label="Status" valor={statusLabel(selecionada.status)} /><Detalhe label="Horário UTC" valor={selecionada.horario_previsto_agendamento || "A definir"} /><Detalhe label="Empréstimo" valor={selecionada.voo_emprestado === "sim" ? "Sim" : "Não"} /></div>{selecionada.status === "pendente" ? <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Confirmar solicitação</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">A aprovação gera o número com o código de cotista e escala o comandante selecionado.</p><div className="mt-4 space-y-3"><div className="space-y-1.5"><Label className="text-[10px]">Piloto comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={pilotoId} onChange={(valor) => aoPiloto(valor)} placeholder="Selecione o comandante" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.filter((item) => item.id !== pilotoId).map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={copilotoId} onChange={(valor) => aoCopiloto(valor)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label htmlFor="motivo-reprovacao" className="text-[10px]">Motivo da reprovação</Label><Textarea id="motivo-reprovacao" value={motivo} onChange={(event) => aoMotivo(event.target.value)} placeholder="Preencha apenas se for reprovar" className="min-h-16 text-[11px]" /></div><div className="flex flex-wrap gap-2 pt-1"><Button type="button" onClick={aoAprovar} disabled={processando} className="gap-2 bg-[#2bbf8a] text-[#03150e] hover:bg-[#45d5a5]"><Check size={14} /> Aprovar e gerar voo</Button><Button type="button" onClick={aoReprovar} disabled={processando} variant="outline" className="gap-2 border-[#e77b80]/40 bg-transparent text-[#ed8c90] hover:bg-[#e77b80]/10"><X size={14} /> Reprovar</Button></div></div></div> : <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Solicitação encerrada</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Status atual: <strong className="text-foreground">{statusLabel(selecionada.status)}</strong>{selecionada.motivo_rejeicao ? ` · ${selecionada.motivo_rejeicao}` : ""}.</p></div>}</div></section>; }
function Detalhe({ label, valor }: { label: string; valor: string }) { return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1.5 truncate text-[10px] font-semibold">{valor}</p></div>; }

type DadosDisponibilidade = { tripulante_id: string; data_inicio: string; data_fim: string; status: "aviso" | "ferias" | "disponivel"; observacoes: string };
function FormularioDisponibilidade({ dados, tripulacao, atualizando, aoCancelar, aoEnviar, aoAlterar }: { dados: DadosDisponibilidade; tripulacao: TripulanteAgendamento[]; atualizando: boolean; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void; aoAlterar: (campo: keyof DadosDisponibilidade, valor: string) => void }) { return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Users size={15} />} title="Registrar disponibilidade" detail="Defina o período de aviso, férias ou disponibilidade operacional" action={<button type="button" onClick={aoCancelar} aria-label="Fechar formulário de disponibilidade" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-1.5 xl:col-span-2"><Label className="text-[10px]">Tripulante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={dados.tripulante_id} onChange={(valor) => aoAlterar("tripulante_id", valor)} placeholder="Selecione o piloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label htmlFor="status-disponibilidade" className="text-[10px]">Status</Label><select id="status-disponibilidade" value={dados.status} onChange={(event) => aoAlterar("status", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="aviso">De aviso</option><option value="ferias">Férias</option><option value="disponivel">Disponível</option></select></div><DataAgendamento valor={dados.data_inicio} aoAlterar={(valor) => aoAlterar("data_inicio", valor)} /><DataAgendamento valor={dados.data_fim} aoAlterar={(valor) => aoAlterar("data_fim", valor)} /><div className="space-y-1.5 md:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-disponibilidade" className="text-[10px]">Observações</Label><Textarea id="observacoes-disponibilidade" value={dados.observacoes} onChange={(event) => aoAlterar("observacoes", event.target.value)} placeholder="Observações da coordenação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="text-xs">{atualizando ? "Salvando..." : "Salvar status"}</Button></div></form></section>; }
