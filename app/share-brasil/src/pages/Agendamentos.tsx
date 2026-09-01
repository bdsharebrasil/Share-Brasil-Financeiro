import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, Plane, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
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
  salvarChecklistPreVoo,
  type AeronaveAgendamento,
  type DisponibilidadeTripulacao,
  excluirAgendamento,
  type EscalaAgendamento,
  type NovoAgendamento,
  type OpcoesAgendamentoResponse,
  type PainelAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import ChecklistPreVoo from "@/components/agendamento/ChecklistPreVoo";

const abas = [
  { id: "cronograma", label: "Cronograma de Voos", icon: ClipboardList },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "escala", label: "Escala", icon: Users },
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
    ...opcoes.clientes.map((item) => ({ id: `cliente:${item.id}`, label: `${item.nome}${item.codigo_cliente ? ` · ${item.codigo_cliente}` : ""}` })),
    ...opcoes.socios.map((item) => ({ id: `socio:${item.id}`, label: item.nome })),
  ];
}

export default function Agendamentos() {
  const { toast } = useToast();
  const [aba, setAba] = useState<AbaAgendamento>("cronograma");
  const [mes, setMes] = useState(() => primeiroDiaMes(new Date()));
  const [semanaCalendario, setSemanaCalendario] = useState(() => inicioSemana(new Date()));
  const [visaoCalendario, setVisaoCalendario] = useState<VisaoEscala>("semanal");
  const [visaoEscala, setVisaoEscala] = useState<VisaoEscala>("semanal");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesAgendamentoResponse>({ clientes: [], socios: [], aeronaves: [], vinculos: [] });
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
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
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), data_fim: dataIso(new Date()), horario_previsto_agendamento: "", numero_passageiros: 1, piloto_id: "", copiloto_id: "", observacoes: "" });
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

  useEffect(() => {
    let ativo = true;
    setAerodromosCarregando(true);
    void buscarAerodromos()
      .then((resposta) => { if (ativo) setAerodromos(resposta.aerodromos || []); })
      .catch(() => { if (ativo) setAerodromos([]); })
      .finally(() => { if (ativo) setAerodromosCarregando(false); });
    return () => { ativo = false; };
  }, []);

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
    const clienteTitularId = novo.cliente_id || opcoes.socios.find((socio) => socio.id === novo.socio_id)?.cliente_id;
    const aeronaveDoTitular = Boolean(novo.aeronave_id && (novo.cliente_id || novo.socio_id) && opcoes.vinculos.some((vinculo) => vinculo.aeronave_id === novo.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (novo.socio_id && vinculo.socio_id === novo.socio_id))));
    const temCedente = Boolean(novo.cliente_emprestimo_id || novo.socio_emprestimo_id);
    if (novo.aeronave_id && !aeronaveDoTitular && (!novo.voo_emprestimo_confirmado || !temCedente)) { toast({ title: "Informe o empréstimo da aeronave", description: "Confirme que o voo é emprestado e selecione o cliente ou sócio cedente.", variant: "destructive" }); return; }
    setProcessando(true);
    try {
      const resposta = await criarAgendamento({ ...novo, piloto_id: novo.piloto_id || undefined, copiloto_id: novo.copiloto_id || undefined });
      toast({ title: "Agendamento criado", description: resposta.numero_voo ? `Número de voo: ${resposta.numero_voo}.` : "A solicitação ficará pendente de confirmação." });
      setMostrarNovo(false);
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), data_fim: dataIso(new Date()), horario_previsto_agendamento: "", numero_passageiros: 1, piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const excluir = async (item: SolicitacaoVooInterna) => {
    if (!window.confirm(`Excluir o agendamento ${item.numero_voo || "sem número"}? Esta ação não pode ser desfeita.`)) return;
    setProcessando(true);
    try {
      await excluirAgendamento(item.id);
      if (selecionada?.id === item.id) setSelecionada(null);
      toast({ title: "Agendamento excluído", description: "O registro foi removido do cronograma de voos." });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setProcessando(false); }
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
    <div className="mt-3.5 -ml-1.5 grid gap-9 sm:grid-cols-3"><CartaoKpi label="Voos confirmados" value={carregando ? "—" : String(confirmados.length)} detail="Todos os registros carregados" icon={<Plane size={16} />} /><CartaoKpi label="Solicitações pendentes" value={carregando ? "—" : String(pendentes.length)} detail="Aguardando coordenação" tone="amber" icon={<Clock3 size={16} />} /><CartaoKpi label="Aeronaves disponíveis" value={carregando ? "—" : String(painel?.aeronaves.length || 0)} detail="Frota ativa do D1" tone="green" icon={<CalendarDays size={16} />} /></div>
    {mostrarNovo && <FormularioAgendamento novo={novo} opcoes={opcoes} titulares={titulares} aerodromos={aerodromos} aerodromosCarregando={aerodromosCarregando} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />}
    {erro && <div className="rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">{abas.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setAba(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold transition-colors ${aba === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={14} />{item.label}</button>; })}</nav>
    {aba === "calendario" && <CalendarioAgendamento mes={mes} semana={semanaCalendario} dias={dias} visao={visaoCalendario} confirmados={confirmados} pendentes={pendentes} aeronaves={painel?.aeronaves || []} aoMudarMes={mudarMes} aoMudarSemana={mudarSemana} aoMudarVisao={mudarVisaoCalendario} aoAbrir={abrirSolicitacao} />}
    {aba === "escala" && <Escala tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} visao={visaoEscala} aoMudarVisao={setVisaoEscala} aoMarcar={() => setMostrarDisponibilidade((atual) => !atual)} />}
    {aba === "cronograma" && <Cronograma solicitacoes={solicitacoesFiltradas} busca={busca} aoMudarBusca={setBusca} aoAbrir={abrirSolicitacao} aoExcluir={(item) => void excluir(item)} />}
    {aba === "escala" && mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />}
    {selecionada && <DetalhesSolicitacao selecionada={selecionada} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando} aoFechar={() => setSelecionada(null)} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={() => void aprovar()} aoReprovar={() => void reprovar()} />}
    {selecionada?.status === "aprovada" && <ChecklistPreVoo item={selecionada} />}
  </div>;
}

type FormularioAgendamentoProps = {
  novo: NovoAgendamento;
  opcoes: OpcoesAgendamentoResponse;
  titulares: { id: string; label: string }[];
  aerodromos: AerodromoOption[];
  aerodromosCarregando: boolean;
  tripulacao: TripulanteAgendamento[];
  atualizando: boolean;
  atualizar: <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => void;
  aoCancelar: () => void;
  aoEnviar: (event: FormEvent<HTMLFormElement>) => void;
};

function FormularioAgendamento({ novo, opcoes, titulares, aerodromos, aerodromosCarregando, tripulacao, atualizando, atualizar, aoCancelar, aoEnviar }: FormularioAgendamentoProps) {
  const aeronaveSelecionada = opcoes.aeronaves.find((aeronave) => aeronave.id === novo.aeronave_id);
  const titularSelecionado = novo.cliente_id ? `cliente:${novo.cliente_id}` : novo.socio_id ? `socio:${novo.socio_id}` : '';
  const clienteTitularId = novo.cliente_id || opcoes.socios.find((socio) => socio.id === novo.socio_id)?.cliente_id;
  const aeronaveDoTitular = Boolean(novo.aeronave_id && (novo.cliente_id || novo.socio_id) && opcoes.vinculos.some((vinculo) => vinculo.aeronave_id === novo.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (novo.socio_id && vinculo.socio_id === novo.socio_id))));
  const aeronaveEmprestada = Boolean(aeronaveSelecionada && titularSelecionado && !aeronaveDoTitular);
  const cedentes = (() => {
    const ids = new Set<string>();
    return opcoes.vinculos
      .filter((vinculo) => vinculo.aeronave_id === novo.aeronave_id)
      .flatMap((vinculo) => {
        const itens: { id: string; label: string }[] = [];
        if (vinculo.cliente_id) {
          const cliente = opcoes.clientes.find((item) => item.id === vinculo.cliente_id);
          const id = `cliente:${vinculo.cliente_id}`;
          if (cliente && !ids.has(id)) { ids.add(id); itens.push({ id, label: `${cliente.nome}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ''}` }); }
        }
        if (vinculo.socio_id) {
          const socio = opcoes.socios.find((item) => item.id === vinculo.socio_id);
          const id = `socio:${vinculo.socio_id}`;
          if (socio && !ids.has(id)) { ids.add(id); itens.push({ id, label: socio.nome }); }
        }
        return itens;
      });
  })();
  const mudarTitular = (valor: string) => {
    const [tipo, id] = valor.split(':');
    atualizar('cliente_id', tipo === 'cliente' ? id : undefined);
    atualizar('socio_id', tipo === 'socio' ? id : undefined);
    atualizar('aeronave_id', '');
    atualizar('cliente_emprestimo_id', undefined);
    atualizar('socio_emprestimo_id', undefined);
    atualizar('voo_emprestimo_confirmado', undefined);
  };
  const selecionarAeronave = (valor: string) => {
    atualizar('aeronave_id', valor);
    atualizar('cliente_emprestimo_id', undefined);
    atualizar('socio_emprestimo_id', undefined);
    atualizar('voo_emprestimo_confirmado', undefined);
  };
  const selecionarCedente = (valor: string) => {
    const [tipo, id] = valor.split(':');
    atualizar('cliente_emprestimo_id', tipo === 'cliente' ? id : undefined);
    atualizar('socio_emprestimo_id', tipo === 'socio' ? id : undefined);
    atualizar('voo_emprestimo_confirmado', true);
  };
  const aerodromoItems = aerodromos.map((item) => ({ id: item.id, label: item.label }));
  const aeronaveItems = opcoes.aeronaves.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${[item.fabricante, item.modelo].filter(Boolean).join(' ')}${item.status && item.status.toLowerCase() !== 'ativa' ? ` · ${item.status}` : ''}` }));
  return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Plus size={15} />} title="Novo agendamento" detail="O número do voo será gerado somente após a confirmação" action={<button type="button" onClick={aoCancelar} aria-label="Fechar novo agendamento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4"><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Cliente / sócio</Label><SearchableCombobox items={titulares} value={titularSelecionado} onChange={mudarTitular} placeholder="Selecione o cliente ou sócio" searchPlaceholder="Digite para buscar cliente ou sócio" emptyMessage="Nenhum cliente ou sócio encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Aeronave</Label><SearchableCombobox items={aeronaveItems} value={novo.aeronave_id} onChange={selecionarAeronave} placeholder="Selecione a aeronave" searchPlaceholder="Digite matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave cadastrada encontrada." icon={<Plane size={14} />} disabled={!titularSelecionado} /></div>{aeronaveEmprestada && <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 sm:col-span-2 xl:col-span-4"><div><p className="text-[10px] font-bold">Essa aeronave não está vinculada ao titular selecionado. Esse voo é emprestado?</p><p className="mt-1 text-[9px] text-muted-foreground">Confirme para registrar quem está cedendo a aeronave neste agendamento.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant={novo.voo_emprestimo_confirmado === true ? 'default' : 'outline'} onClick={() => atualizar('voo_emprestimo_confirmado', true)} className="h-8 text-[10px]">Sim, é emprestado</Button><Button type="button" variant={novo.voo_emprestimo_confirmado === false ? 'default' : 'outline'} onClick={() => { atualizar('voo_emprestimo_confirmado', false); atualizar('cliente_emprestimo_id', undefined); atualizar('socio_emprestimo_id', undefined); }} className="h-8 text-[10px]">Não</Button></div>{novo.voo_emprestimo_confirmado === true && <div className="space-y-1.5"><Label className="text-[10px]">Cliente ou sócio que está emprestando</Label><SearchableCombobox items={cedentes.filter((item) => item.id !== titularSelecionado)} value={novo.cliente_emprestimo_id ? `cliente:${novo.cliente_emprestimo_id}` : novo.socio_emprestimo_id ? `socio:${novo.socio_emprestimo_id}` : ''} onChange={selecionarCedente} placeholder="Selecione quem está emprestando" searchPlaceholder="Digite o nome do cedente" emptyMessage="Nenhum cotista vinculado a esta aeronave." icon={<Users size={14} />} /></div>}</div>}<div className="space-y-1.5"><Label className="text-[10px]">Origem</Label><SearchableCombobox items={aerodromoItems} value={novo.origem} onChange={(value) => atualizar('origem', value)} placeholder={aerodromosCarregando ? 'Carregando aeródromos...' : 'Selecione o aeródromo'} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div><div className="space-y-1.5"><Label className="text-[10px]">Destino</Label><SearchableCombobox items={aerodromoItems} value={novo.destino} onChange={(value) => atualizar('destino', value)} placeholder={aerodromosCarregando ? 'Carregando aeródromos...' : 'Selecione o aeródromo'} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div><PeriodoAgendamento inicio={novo.data_agendada} fim={novo.data_fim} aoAlterarInicio={(valor) => atualizar('data_agendada', valor)} aoAlterarFim={(valor) => atualizar('data_fim', valor)} /><div className="space-y-1.5"><Label htmlFor="hora-agendamento" className="text-[10px]">Horário previsto (UTC)</Label><Input id="hora-agendamento" type="time" value={novo.horario_previsto_agendamento || ''} onChange={(event) => atualizar('horario_previsto_agendamento', event.target.value)} required className="h-10 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="passageiros-agendamento" className="text-[10px]">Passageiros</Label><Input id="passageiros-agendamento" type="number" min={1} value={novo.numero_passageiros || 1} onChange={(event) => atualizar('numero_passageiros', Number(event.target.value))} className="h-10 text-xs" /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === 'freelancer' ? 'Freelancer' : 'Tripulação'}` }))} value={novo.piloto_id || ''} onChange={(value) => atualizar('piloto_id', value)} placeholder="Definir depois" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac}` }))} value={novo.copiloto_id || ''} onChange={(value) => atualizar('copiloto_id', value)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-agendamento" className="text-[10px]">Observações</Label><Textarea id="observacoes-agendamento" value={novo.observacoes || ''} onChange={(event) => atualizar('observacoes', event.target.value)} placeholder="Informações da trip, passageiros ou operação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="gap-2 text-xs">{atualizando ? 'Salvando...' : 'Salvar agendamento'}<Check size={14} /></Button></div></form></section>;
}

function PeriodoAgendamento({ inicio, fim, aoAlterarInicio, aoAlterarFim }: { inicio: string; fim: string; aoAlterarInicio: (valor: string) => void; aoAlterarFim: (valor: string) => void }) {
  const inicioSelecionado = inicio ? new Date(`${inicio}T00:00:00`) : undefined;
  const fimSelecionado = fim ? new Date(`${fim}T00:00:00`) : undefined;
  const intervalo: DateRange | undefined = inicioSelecionado ? { from: inicioSelecionado, to: fimSelecionado || inicioSelecionado } : undefined;
  const selecionarIntervalo = (range: DateRange | undefined) => {
    const novoInicio = range?.from ? dataIso(range.from) : '';
    const novoFim = range?.to ? dataIso(range.to) : novoInicio;
    aoAlterarInicio(novoInicio);
    aoAlterarFim(novoFim);
  };
  return <div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Período do voo</Label><div className="flex items-center gap-2"><Input aria-label="Data de início do voo" type="date" value={inicio} onChange={(event) => aoAlterarInicio(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><span className="text-[10px] text-muted-foreground">até</span><Input aria-label="Data de fim do voo" type="date" value={fim} min={inicio} onChange={(event) => aoAlterarFim(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário do período"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><DateCalendar mode="range" selected={intervalo} onSelect={selecionarIntervalo} numberOfMonths={1} initialFocus /></PopoverContent></Popover></div></div>;
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


function Escala({ tripulacao, escala, disponibilidades, visao, aoMudarVisao, aoMarcar }: { tripulacao: TripulanteAgendamento[]; escala: EscalaAgendamento[]; disponibilidades: DisponibilidadeTripulacao[]; visao: VisaoEscala; aoMudarVisao: (visao: VisaoEscala) => void; aoMarcar: () => void }) {
  const hoje = new Date();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const diasVisao = visao === "mensal" ? diasCalendario(hoje) : Array.from({ length: 7 }, (_, indice) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7) + indice));
  const periodo = visao === "mensal" ? `${nomesMeses[hoje.getMonth()]} ${hoje.getFullYear()}` : `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()]} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()]}`;
  const statusDoDia = (dia: Date, tripulanteId?: string) => disponibilidades.filter((item) => { const chave = dataIso(dia); return (!tripulanteId || item.tripulante_id === tripulanteId) && chave >= item.data_inicio && chave <= item.data_fim; }).at(-1);
  const statusLabel = (status?: string) => status === "ferias" ? "Férias" : status === "aviso" ? "Aviso" : status === "disponivel" ? "Disponível" : "Sem status";
  const statusTone = (status?: string) => status === "ferias" ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : status === "aviso" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : status === "disponivel" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-white/[.08] bg-white/[.04] text-slate-500";
  const voosDoTripulante = (tripulanteId: string, dia: Date) => escala.filter((item) => { const chave = dataIso(dia); return chave >= item.data_agendada && chave <= (item.data_fim || item.data_agendada) && (item.piloto_id === tripulanteId || item.copiloto_id === tripulanteId); });
  const tripulacaoVisivel = tripulacao.filter((item) => { const nome = item.nome_completo.toLowerCase(); const status = statusDoDia(hoje, item.id)?.status || "sem-status"; return nome.includes(busca.toLowerCase()) && (filtroStatus === "todos" || status === filtroStatus); });
  const gridStyle = { display: "grid", gridTemplateColumns: `minmax(215px, 1.4fr) repeat(${diasVisao.length}, minmax(${visao === "mensal" ? 84 : 112}px, 1fr))` };
  const nomesDiasCalendario = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0d1521] shadow-[0_20px_60px_rgba(0,0,0,.16)]">
    <div className="border-b border-white/[.08] bg-[#101a28] p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-300"><Users size={16} /></span><div><h2 className="text-sm font-extrabold text-white">Escala da Tripulação</h2><p className="mt-1 text-[10px] text-slate-500">{periodo} · planejamento de voos e disponibilidade</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-2.5 py-1.5 text-[9px] font-bold text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{tripulacao.filter((item) => statusDoDia(hoje, item.id)?.status === "disponivel").length} Disponíveis</span></div><div className="mt-5 flex flex-wrap items-center gap-2"><div className="flex rounded-lg border border-white/[.1] bg-[#0b121d] p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors ${visao === "semanal" ? "bg-white/[.1] text-white" : "text-slate-500 hover:text-slate-200"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors ${visao === "mensal" ? "bg-white/[.1] text-white" : "text-slate-500 hover:text-slate-200"}`}>Mensal</button></div><label className="relative flex h-8 min-w-[180px] flex-1 items-center rounded-lg border border-white/[.1] bg-[#0b121d] px-2.5 sm:max-w-[230px]"><Search size={12} className="mr-2 text-slate-500" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar piloto..." className="w-full bg-transparent text-[10px] text-white outline-none placeholder:text-slate-600" /></label><select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)} className="h-8 rounded-lg border border-white/[.1] bg-[#0b121d] px-2.5 text-[10px] text-slate-300 outline-none"><option value="todos">Todos status</option><option value="disponivel">Disponível</option><option value="aviso">Aviso</option><option value="ferias">Férias</option></select><button type="button" onClick={aoMarcar} className="h-8 rounded-lg bg-cyan-400 px-3 text-[10px] font-extrabold text-slate-950 transition-colors hover:bg-cyan-300">+ Marcar status</button></div></div>
    <div className="overflow-x-auto"><div className="min-w-fit" style={gridStyle}><div className="sticky left-0 z-20 flex min-h-[58px] items-end border-b border-r border-white/[.08] bg-[#101a28] px-4 pb-3 text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Tripulação</div>{diasVisao.map((dia) => <div key={`header-${dataIso(dia)}`} className={`flex min-h-[58px] flex-col justify-end border-b border-r border-white/[.08] px-2 pb-2 text-center ${dataIso(dia) === dataIso(hoje) ? "bg-cyan-300/[.06]" : "bg-[#101a28]"}`}><span className="text-[8px] font-bold uppercase tracking-[.1em] text-slate-500">{nomesDiasCalendario[dia.getDay()]}</span><strong className={`mt-1 font-mono text-sm ${dataIso(dia) === dataIso(hoje) ? "text-cyan-300" : "text-white"}`}>{String(dia.getDate()).padStart(2, "0")}</strong></div>)}{tripulacaoVisivel.map((item) => <Fragment key={item.id}><div className="sticky left-0 z-10 flex min-h-[86px] items-center gap-2.5 border-b border-r border-white/[.06] bg-[#0f1825] px-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[.1] bg-white/[.06] text-[10px] font-bold text-slate-300"><img src={item.url_avatar || "/icon.pilot.png"} alt={`Avatar de ${item.nome_completo}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/icon.pilot.png"; }} /></div><div className="min-w-0"><p className="truncate text-[10px] font-bold text-slate-100">{item.nome_completo}</p><p className="mt-1 truncate text-[9px] text-slate-500">{item.origem === "freelancer" ? "Freelancer" : "Tripulação"} · {item.canac}</p><span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.06em] ${statusTone(statusDoDia(hoje, item.id)?.status)}`}>{statusLabel(statusDoDia(hoje, item.id)?.status)}</span></div></div>{diasVisao.map((dia) => { const status = statusDoDia(dia, item.id); const voos = voosDoTripulante(item.id, dia); return <div key={`${item.id}-${dataIso(dia)}`} className={`min-h-[86px] border-b border-r border-white/[.06] p-1.5 ${dataIso(dia) === dataIso(hoje) ? "bg-cyan-300/[.035]" : "bg-[#0b131f]"}`}>{status && <div className={`mb-1 truncate rounded border px-1.5 py-1 text-[8px] font-bold ${statusTone(status.status)}`}>{statusLabel(status.status)}</div>}{voos.slice(0, 2).map((voo) => <div key={voo.id} className={`mb-1 w-full rounded border px-1.5 py-1.5 text-left transition-colors hover:brightness-125 ${voo.piloto_id === item.id ? "border-cyan-300/25 bg-cyan-300/[.08]" : "border-violet-300/25 bg-violet-300/[.08]"}`}><p className={`truncate text-[9px] font-bold ${voo.piloto_id === item.id ? "text-cyan-200" : "text-violet-200"}`}>{voo.numero_voo || "Sem nº"}</p><p className="mt-0.5 truncate text-[8px] text-slate-400">{voo.origem} → {voo.destino}</p><p className="mt-0.5 text-[8px] font-bold text-slate-500">{voo.piloto_id === item.id ? "PIC" : "SIC"}</p></div>)}</div>; })}</Fragment>)}</div></div>
    {!tripulacaoVisivel.length && <div className="border-t border-white/[.08] px-4 py-12 text-center text-[11px] text-slate-500">Nenhum tripulante corresponde aos filtros selecionados.</div>}
  </section>;
}

function Cronograma({ solicitacoes, busca, aoMudarBusca, aoAbrir, aoExcluir }: { solicitacoes: SolicitacaoVooInterna[]; busca: string; aoMudarBusca: (busca: string) => void; aoAbrir: (item: SolicitacaoVooInterna) => void; aoExcluir: (item: SolicitacaoVooInterna) => void }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Cronograma de Voos" detail="Todas as solicitações de voo" action={<div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar cliente, rota ou voo" className="h-8 w-56 pl-8 text-[10px]" /></div>} />{solicitacoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Número do voo</th><th className="px-4 py-3">Cliente / sócio</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Período / horários</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Tripulação</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{solicitacoes.map((item) => <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3 font-mono text-[10px] font-bold text-primary">{item.numero_voo || "A gerar na confirmação"}</td><td className="px-4 py-3"><p className="max-w-[180px] truncate text-[10px] font-bold">{item.voo_emprestado !== "nao" && item.socio_emprestimo_nome ? item.socio_emprestimo_nome : item.socio_nome || item.cliente_razao_social || "Titular não informado"}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.codigo_cliente || "Código pela cotista"}</p></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.origem} → {item.destino}</td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{formatarData(item.data_agendada)}{item.data_fim && item.data_fim !== item.data_agendada ? ` até ${formatarData(item.data_fim)}` : ""}</p><p className="mt-1 text-[9px] text-muted-foreground">UTC: {formatarHorarioAgendamento(item.horario_previsto_agendamento).utc}</p><p className="text-[9px] text-muted-foreground">Brasília: {formatarHorarioAgendamento(item.horario_previsto_agendamento).brasilia}</p></td><td className="px-4 py-3 font-mono text-[10px]">{item.matricula_registro || "A definir"}</td><td className="px-4 py-3 text-[10px] text-muted-foreground">{item.piloto_id ? "Escalada" : "Pendente"}</td><td className="px-4 py-3"><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></td><td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-3"><button type="button" onClick={() => aoAbrir(item)} className="text-[10px] font-bold text-primary hover:underline">Detalhes</button><button type="button" onClick={() => aoExcluir(item)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[#e77b80]/10 hover:text-[#ed8c90]" title="Excluir agendamento" aria-label={`Excluir agendamento ${item.numero_voo || item.id}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhuma solicitação encontrada" />}</section>;
}

function DetalhesSolicitacao({ selecionada, tripulacao, pilotoId, copilotoId, motivo, processando, aoFechar, aoPiloto, aoCopiloto, aoMotivo, aoAprovar, aoReprovar }: { selecionada: SolicitacaoVooInterna; tripulacao: TripulanteAgendamento[]; pilotoId: string; copilotoId: string; motivo: string; processando: boolean; aoFechar: () => void; aoPiloto: (valor: string) => void; aoCopiloto: (valor: string) => void; aoMotivo: (valor: string) => void; aoAprovar: () => void; aoReprovar: () => void }) { return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Detalhes da solicitação" detail={`${selecionada.origem} → ${selecionada.destino} · ${formatarData(selecionada.data_agendada)}`} action={<button type="button" onClick={aoFechar} aria-label="Fechar detalhes" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><div className="grid gap-5 p-5 lg:grid-cols-[1fr_.9fr]"><div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4"><Detalhe label="Cliente / sócio" valor={selecionada.cliente_razao_social || selecionada.socio_nome || selecionada.codigo_cliente || "Não informado"} /><Detalhe label="Aeronave" valor={`${selecionada.matricula_registro || "A definir"} · ${selecionada.modelo || "—"}`} /><Detalhe label="Horário" valor={(() => { const horario = formatarHorarioAgendamento(selecionada.horario_previsto_agendamento); return `UTC: ${horario.utc} · Brasília: ${horario.brasilia}`; })()} /><Detalhe label="Período" valor={`${formatarData(selecionada.data_agendada)}${selecionada.data_fim && selecionada.data_fim !== selecionada.data_agendada ? ` até ${formatarData(selecionada.data_fim)}` : ""}`} /><Detalhe label="Passageiros" valor={String(selecionada.numero_passageiros || 1)} /><Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} /><Detalhe label="Status" valor={statusLabel(selecionada.status)} /><Detalhe label="Horário UTC" valor={selecionada.horario_previsto_agendamento || "A definir"} /><Detalhe label="Empréstimo" valor={selecionada.voo_emprestado === "sim" ? `Sim · ${selecionada.cliente_emprestimo_nome || selecionada.socio_emprestimo_nome || "Cedente não informado"}` : "Não"} /></div>{selecionada.status === "pendente" ? <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Confirmar solicitação</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">A aprovação gera o número com o código de cotista e escala o comandante selecionado.</p><div className="mt-4 space-y-3"><div className="space-y-1.5"><Label className="text-[10px]">Piloto comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={pilotoId} onChange={(valor) => aoPiloto(valor)} placeholder="Selecione o comandante" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.filter((item) => item.id !== pilotoId).map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={copilotoId} onChange={(valor) => aoCopiloto(valor)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label htmlFor="motivo-reprovacao" className="text-[10px]">Motivo da reprovação</Label><Textarea id="motivo-reprovacao" value={motivo} onChange={(event) => aoMotivo(event.target.value)} placeholder="Preencha apenas se for reprovar" className="min-h-16 text-[11px]" /></div><div className="flex flex-wrap gap-2 pt-1"><Button type="button" onClick={aoAprovar} disabled={processando} className="gap-2 bg-[#2bbf8a] text-[#03150e] hover:bg-[#45d5a5]"><Check size={14} /> Aprovar e gerar voo</Button><Button type="button" onClick={aoReprovar} disabled={processando} variant="outline" className="gap-2 border-[#e77b80]/40 bg-transparent text-[#ed8c90] hover:bg-[#e77b80]/10"><X size={14} /> Reprovar</Button></div></div></div> : <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Solicitação encerrada</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Status atual: <strong className="text-foreground">{statusLabel(selecionada.status)}</strong>{selecionada.motivo_rejeicao ? ` · ${selecionada.motivo_rejeicao}` : ""}.</p></div>}</div></section>; }
function Detalhe({ label, valor }: { label: string; valor: string }) { return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1.5 truncate text-[10px] font-semibold">{valor}</p></div>; }

type DadosDisponibilidade = { tripulante_id: string; data_inicio: string; data_fim: string; status: "aviso" | "ferias" | "disponivel"; observacoes: string };
function FormularioDisponibilidade({ dados, tripulacao, atualizando, aoCancelar, aoEnviar, aoAlterar }: { dados: DadosDisponibilidade; tripulacao: TripulanteAgendamento[]; atualizando: boolean; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void; aoAlterar: (campo: keyof DadosDisponibilidade, valor: string) => void }) { return <section className="overflow-visible rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Users size={15} />} title="Registrar disponibilidade" detail="Defina o período de aviso, férias ou disponibilidade operacional" action={<button type="button" onClick={aoCancelar} aria-label="Fechar formulário de disponibilidade" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4"><div className="space-y-1.5 xl:col-span-2"><Label className="text-[10px]">Tripulante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={dados.tripulante_id} onChange={(valor) => aoAlterar("tripulante_id", valor)} placeholder="Selecione o piloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label htmlFor="status-disponibilidade" className="text-[10px]">Status</Label><select id="status-disponibilidade" value={dados.status} onChange={(event) => aoAlterar("status", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="aviso">De aviso</option><option value="ferias">Férias</option><option value="disponivel">Disponível</option></select></div><DataAgendamento valor={dados.data_inicio} aoAlterar={(valor) => aoAlterar("data_inicio", valor)} /><DataAgendamento valor={dados.data_fim} aoAlterar={(valor) => aoAlterar("data_fim", valor)} /><div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-disponibilidade" className="text-[10px]">Observações</Label><Textarea id="observacoes-disponibilidade" value={dados.observacoes} onChange={(event) => aoAlterar("observacoes", event.target.value)} placeholder="Observações da coordenação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="text-xs">{atualizando ? "Salvando..." : "Salvar status"}</Button></div></form></section>; }
