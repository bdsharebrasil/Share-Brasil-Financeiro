import { ACAO_CONCLUIDA, ACAO_A_REALIZAR, ACAO_HOVER_MOVIMENTO, visualStatusAgendamento } from "@/components/agendamento/agendamentoVisual";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Calendar as CalendarIcon, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, List, MoreVertical, Pencil, Plane, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AcaoRapida, CabecalhoSecao, CartaoKpi, EtiquetaStatus, EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import {
  aprovarSolicitacaoVoo,
  atualizarAgendamento,
  buscarExtratoJornadaTripulante,
  buscarOpcoesAgendamento,
  buscarPainelAgendamento,
  criarAgendamento,
  definirDisponibilidadeTripulacao,
  reprovarSolicitacaoVoo,
  type AeronaveAgendamento,
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type DisponibilidadeTripulacao,
  excluirAgendamento,
  finalizarAgendamento,
  type EscalaAgendamento,
  type JornadaVoo as JornadaVooRegistro,
  type NovoAgendamento,
  type OpcoesAgendamentoResponse,
  type PainelAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import ChecklistPreVoo from "@/components/agendamento/ChecklistPreVoo";
import JornadaVoo from "@/components/agendamento/JornadaVoo";
import EscalaCalendario from "@/components/agendamento/EscalaCalendario";
import { conflitosDoTripulante, DIA, montarBlocos } from "@/lib/escala-tempo";
import PesoBalanceamentoFicha from "@/components/agendamento/PesoBalanceamentoFicha";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { calcularProgressoChecklist, correspondeFiltroStatusAgendamento, obterAcoesAgendamento, statusPermiteAbrirJornada, statusPermiteChecklist } from "@/components/agendamento/agendamentoCardFlow";
import { AGENDAMENTO_ABRIR_SESSAO_KEY } from "@/lib/agendamento-navigation";
import VoosDeHoje from "@/components/agendamento/VoosDeHoje";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";

const abas = [
  { id: "voos-hoje", label: "Voos de Hoje", icon: Plane },
  { id: "cronograma", label: "Cronograma de Voos", icon: ClipboardList },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "escala", label: "Escala", icon: Users },
] as const;
type AbaAgendamento = (typeof abas)[number]["id"];
type VisaoEscala = "semanal" | "mensal";
type FiltroStatusCronograma = "todos" | "pendente" | "aprovada" | "em_voo" | "encerrada";
type VisaoCronograma = "grid" | "lista";

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function normalizarAgendamentos(itens: SolicitacaoVooInterna[] | null | undefined) {
  const porId = new Map<string, SolicitacaoVooInterna>();
  for (const item of Array.isArray(itens) ? itens : []) {
    if (!item?.id) continue;
    const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    const normalizado = status === "em_rota" || status === "em_voo" ? { ...item, status: "decolado" } : item;
    const existente = porId.get(normalizado.id);
    if (!existente || String(normalizado.atualizado_em || normalizado.criado_em) >= String(existente.atualizado_em || existente.criado_em)) porId.set(normalizado.id, normalizado);
  }
  return [...porId.values()];
}

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
function hojeUtc() {
  return new Date().toISOString().slice(0, 10);
}
function horarioUtc(data: string, hora?: string) {
  if (!hora) return undefined;
  const instante = new Date(`${data}T${hora}:00Z`);
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : undefined;
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
function tomStatus(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "aprovada") return "green";
  if (status === "acionado") return "amber";
  if (status === "decolado" || status === "em_voo" || status === "em_rota") return "blue";
  if (status === "em_solo") return "green";
  if (status === "reprovada" || status === "cancelada") return "red";
  if (status === "pendente") return "amber";
  return "neutral";
}
function statusLabel(status: string) {
  return ({ folga: "Folga", atestado_medico: "Atestado médico", treinamento: "Treinamento", acompanhando_manutencao: "Acompanhando manutenção", pendente: "Pendente", aprovada: "Aprovada", acionado: "Acionado", decolado: "Decolado", em_rota: "Decolado", em_voo: "Decolado", em_solo: "Em solo · pousado", encerrada: "Encerrada", reprovada: "Reprovada", cancelada: "Cancelada" } as Record<string, string>)[status] || status;
}
function ordenarPorAeronave(itens: SolicitacaoVooInterna[]) {
  const prioridadeStatus: Record<string, number> = { decolado: 0, em_voo: 0, em_rota: 0, acionado: 1, aprovada: 2, pendente: 3 };
  return [...itens].sort((a, b) => {
    const prioridadeA = prioridadeStatus[a.status] ?? 3;
    const prioridadeB = prioridadeStatus[b.status] ?? 3;
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

    const aeronaveA = a.matricula_registro?.trim() || "";
    const aeronaveB = b.matricula_registro?.trim() || "";
    if (!aeronaveA && aeronaveB) return 1;
    if (aeronaveA && !aeronaveB) return -1;
    return aeronaveA.localeCompare(aeronaveB, "pt-BR", { numeric: true, sensitivity: "base" })
      || String(a.data_agendada || "").localeCompare(String(b.data_agendada || ""))
      || String(a.numero_voo || "").localeCompare(String(b.numero_voo || ""), "pt-BR", { numeric: true, sensitivity: "base" });
  });
}
function itensTitulares(opcoes: OpcoesAgendamentoResponse) {
  return [
    ...opcoes.clientes.map((item) => ({ id: `cliente:${item.id}`, label: `${item.nome}${item.codigo_cliente ? ` · ${item.codigo_cliente}` : ""}` })),
        ...opcoes.socios.map((item) => ({ id: `socio:${item.id}`, label: item.nome })),
  ];
}

export default function Agendamentos() {
  const { toast } = useToast();
  const { voos: voosAoVivo } = useVoosEmOperacao();
  const [aba, setAba] = useState<AbaAgendamento>("cronograma");
  const [mes, setMes] = useState(() => primeiroDiaMes(new Date()));
  const [semanaCalendario, setSemanaCalendario] = useState(() => inicioSemana(new Date()));
  const [visaoCalendario, setVisaoCalendario] = useState<VisaoEscala>("semanal");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesAgendamentoResponse>({ clientes: [], socios: [], aeronaves: [], vinculos: [] });
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoVooInterna | null>(null);
  const [vooHojeSelecionadoId, setVooHojeSelecionadoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCronograma>("pendente");
  const [visaoCronograma, setVisaoCronograma] = useState<VisaoCronograma>("grid");
  const [buscaCalendario, setBuscaCalendario] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [mostrarDisponibilidade, setMostrarDisponibilidade] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [checklistAberto, setChecklistAberto] = useState(false);
  const [progressoChecklistPorId, setProgressoChecklistPorId] = useState<Record<string, number>>({});
  const [jornadaAberta, setJornadaAberta] = useState(false);
  const [agendamentoParaExcluir, setAgendamentoParaExcluir] = useState<SolicitacaoVooInterna | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, piloto_id: "", copiloto_id: "", observacoes: "" });
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({ tripulante_id: "", data_inicio: dataIso(new Date()), data_fim: dataIso(new Date()), status: "aviso" as "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel", observacoes: "" });
  const carregamentoAtual = useRef(0);
  const solicitacaoSelecionadaId = selecionada?.id;
  const notificarProgressoChecklist = useCallback((progresso: number) => {
    if (!solicitacaoSelecionadaId) return;
    setProgressoChecklistPorId((atual) => atual[solicitacaoSelecionadaId] === progresso ? atual : { ...atual, [solicitacaoSelecionadaId]: progresso });
  }, [solicitacaoSelecionadaId]);

  useEffect(() => {
    if (!solicitacaoSelecionadaId || aba !== "cronograma") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("detalhes-solicitacao")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [aba, solicitacaoSelecionadaId]);

  const carregar = useCallback(async (silencioso = false) => {
    const idCarregamento = ++carregamentoAtual.current;
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [painelAtual, opcoesAtuais] = await Promise.all([buscarPainelAgendamento("2000-01-01", "2099-12-31"), buscarOpcoesAgendamento()]);
      if (idCarregamento !== carregamentoAtual.current) return;
      const agendamentosAtualizados = normalizarAgendamentos(painelAtual?.agendamentos);
      setPainel({
        ...painelAtual,
        agendamentos: agendamentosAtualizados,
        aeronaves: Array.isArray(painelAtual?.aeronaves) ? painelAtual.aeronaves : [],
        tripulacao: Array.isArray(painelAtual?.tripulacao) ? painelAtual.tripulacao : [],
        escala: Array.isArray(painelAtual?.escala) ? painelAtual.escala : [],
        disponibilidades: Array.isArray(painelAtual?.disponibilidades) ? painelAtual.disponibilidades : [],
      });
      setSelecionada((atual) => {
        if (!atual) return atual;
        const atualizado = agendamentosAtualizados.find((item) => item.id === atual.id);
        return atualizado || atual;
      });
      setProgressoChecklistPorId(Object.fromEntries(agendamentosAtualizados.map((item) => [item.id, calcularProgressoChecklist(item)])));
      setOpcoes({
        ...opcoesAtuais,
        clientes: Array.isArray(opcoesAtuais?.clientes) ? opcoesAtuais.clientes : [],
        socios: Array.isArray(opcoesAtuais?.socios) ? opcoesAtuais.socios : [],
        aeronaves: Array.isArray(opcoesAtuais?.aeronaves) ? opcoesAtuais.aeronaves : [],
        vinculos: Array.isArray(opcoesAtuais?.vinculos) ? opcoesAtuais.vinculos : [],
      });
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

  const agendamentos = useMemo(() => normalizarAgendamentos(painel?.agendamentos), [painel?.agendamentos]);
  const confirmados = useMemo(() => agendamentos.filter((item) => ["aprovada", "em_voo", "em_solo"].includes(item.status)), [agendamentos]);
  const encerrados = useMemo(() => agendamentos.filter((item) => item.status === "encerrada"), [agendamentos]);
  const pendentes = useMemo(() => agendamentos.filter((item) => item.status === "pendente"), [agendamentos]);
  const voosDeHoje = useMemo(() => agendamentos.filter((item) => {
    const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    const confirmado = status === "aprovada";
    const checklistConcluido = String(item.checklist_status || "").trim().toLowerCase() === "concluido";
    return item.data_agendada === hojeUtc() && confirmado && checklistConcluido;
  }), [agendamentos]);
  const vooHojeSelecionado = voosDeHoje.find((item) => item.id === vooHojeSelecionadoId) || voosDeHoje[0] || null;
  const dias = useMemo(() => diasCalendario(mes), [mes]);
  const titulares = useMemo(() => itensTitulares(opcoes), [opcoes]);
  const nomesTripulantes = useMemo(() => new Map((painel?.tripulacao || []).map((tripulante) => [tripulante.id, tripulante.nome_completo])), [painel?.tripulacao]);
  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ativos = agendamentos.filter((item) => correspondeFiltroStatusAgendamento(item.status, filtroStatus));
    const encontrados = termo
      ? ativos.filter((item) => [item.id, item.data_agendada, item.cliente_razao_social, item.socio_nome, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo))
      : ativos;
    return ordenarPorAeronave(encontrados);
  }, [agendamentos, busca, filtroStatus]);

  const abrirSolicitacao = useCallback((item: SolicitacaoVooInterna) => {
    setAba("cronograma");
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  }, []);
  const confirmarSolicitacao = (item: SolicitacaoVooInterna) => {
    abrirSolicitacao(item);
    setTimeout(() => document.getElementById("confirmacao-voo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const abrirJornada = useCallback((item: SolicitacaoVooInterna) => {
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaAberta(true);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  }, []);

  useEffect(() => {
    const idSolicitacao = window.sessionStorage.getItem(AGENDAMENTO_ABRIR_SESSAO_KEY);
    if (!idSolicitacao || !painel?.agendamentos) return;
    const item = painel.agendamentos.find((agendamento) => agendamento.id === idSolicitacao);
    if (!item) {
      if (!carregando) window.sessionStorage.removeItem(AGENDAMENTO_ABRIR_SESSAO_KEY);
      return;
    }
    window.sessionStorage.removeItem(AGENDAMENTO_ABRIR_SESSAO_KEY);
    const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    const vooHojeElegivel = item.data_agendada === hojeUtc()
      && String(item.checklist_status || "").trim().toLowerCase() === "concluido"
      && status === "aprovada";
    setAba("voos-hoje");
    setVooHojeSelecionadoId(vooHojeElegivel ? item.id : null);
  }, [carregando, painel?.agendamentos]);
  const navegarParaDataCalendario = useCallback((data: string) => {
    const dataVoo = new Date(`${data}T00:00:00`);
    if (Number.isNaN(dataVoo.getTime())) return;
    setMes(primeiroDiaMes(dataVoo));
    setSemanaCalendario(inicioSemana(dataVoo));
  }, []);
  const avisarConflitoComandante = (pilotoId: string, voo: EscalaAgendamento) => {
    const existentes = montarBlocos((painel?.escala || []).filter((item) => item.id !== voo.id), [], painel?.tripulacao || []);
    const [candidato] = montarBlocos([voo], [], []);
    const conflitos = candidato ? conflitosDoTripulante(existentes, pilotoId, candidato.inicio, candidato.fim) : [];
    if (!conflitos.length) return;
    const nome = painel?.tripulacao.find((item) => item.id === pilotoId)?.nome_completo || "O comandante";
    toast({ title: "Possível conflito de escala", description: `${nome} já tem ${conflitos.length} compromisso(s) sobreposto(s) neste horário.` });
  };
  const aprovar = async (alteracoes: AlteracoesAgendamentoConfirmacao) => {
    if (!selecionada || !pilotoId) { toast({ title: "Piloto comandante obrigatório", description: "Selecione o comandante para gerar o número do voo.", variant: "destructive" }); return; }
    avisarConflitoComandante(pilotoId, { id: selecionada.id, data_agendada: selecionada.data_agendada, data_fim: selecionada.data_fim || selecionada.data_agendada, numero_voo: selecionada.numero_voo ?? null, origem: selecionada.origem, destino: selecionada.destino, horario_previsto_agendamento: selecionada.horario_previsto_agendamento, piloto_id: pilotoId, piloto_nome: null, copiloto_id: copilotoId || null, copiloto_nome: null, status: "aprovada" });
    setProcessando(true);
    try {
      const resposta = await aprovarSolicitacaoVoo(selecionada.id, pilotoId, copilotoId || undefined, alteracoes);
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
    const horarioPrevisto = horarioUtc(novo.data_agendada, novo.horario_previsto_agendamento);
    if (novo.piloto_id) avisarConflitoComandante(novo.piloto_id, { id: "novo", data_agendada: novo.data_agendada, data_fim: novo.data_fim, numero_voo: null, origem: novo.origem, destino: novo.destino, horario_previsto_agendamento: horarioPrevisto ?? null, piloto_id: novo.piloto_id, piloto_nome: null, copiloto_id: novo.copiloto_id || null, copiloto_nome: null, status: "aprovada" });
    setProcessando(true);
    try {
      const resposta = await criarAgendamento({ ...novo, horario_previsto_agendamento: horarioPrevisto, piloto_id: novo.piloto_id || undefined, copiloto_id: novo.copiloto_id || undefined });
      toast({ title: "Agendamento criado", description: resposta.numero_voo ? `Número de voo: ${resposta.numero_voo}.` : "A solicitação ficará pendente de confirmação." });
      setMostrarNovo(false);
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const finalizar = async (item: SolicitacaoVooInterna) => {
    if (obterAcoesAgendamento(item, calcularProgressoChecklist(item)).historico) { toast({ title: "Operação já concluída", description: "Agendamentos encerrados são somente leitura.", variant: "destructive" }); return; }
    if (!window.confirm(`Finalizar o agendamento ${item.numero_voo || 'sem número'}? Ele sairá do cronograma, mas o número do voo será preservado no histórico.`)) return;
    setProcessando(true);
    try {
      await finalizarAgendamento(item.id);
      if (selecionada?.id === item.id) setSelecionada(null);
      toast({ title: 'Agendamento finalizado', description: 'A operação foi concluída e saiu do cronograma.' });
      await carregar(true);
    } catch (error) { toast({ title: 'Não foi possível finalizar', description: error instanceof Error ? error.message : 'Encerre todas as jornadas antes de finalizar.', variant: 'destructive' }); }
    finally { setProcessando(false); }
  };
  const excluir = (item: SolicitacaoVooInterna) => setAgendamentoParaExcluir(item);
  const confirmarExclusao = async () => {
    if (!agendamentoParaExcluir || excluindo) return;
    setExcluindo(true);
    try {
      await excluirAgendamento(agendamentoParaExcluir.id);
      if (selecionada?.id === agendamentoParaExcluir.id) setSelecionada(null);
      setAgendamentoParaExcluir(null);
      toast({ title: "Agendamento excluído", description: "O registro foi removido do cronograma de voos." });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setExcluindo(false); }
  };
  const atualizarSelecionada = async (dados: AtualizacaoAgendamento) => {
    if (!selecionada) return;
    setProcessando(true);
    try {
      await atualizarAgendamento(selecionada.id, dados);
      toast({ title: "Agendamento atualizado", description: "As alterações foram disponibilizadas para toda a equipe." });
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível atualizar", description: error instanceof Error ? error.message : "Confira os dados e tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const salvarDisponibilidade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dataInicio = novaDisponibilidade.data_inicio.trim();
    const dataFim = (novaDisponibilidade.data_fim || dataInicio).trim();
    const tripulante = painel?.tripulacao.find((item) => item.id === novaDisponibilidade.tripulante_id);
    if (!tripulante) { toast({ title: "Tripulante obrigatório", description: "Selecione um tripulante ativo da lista.", variant: "destructive" }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim) || dataFim < dataInicio) { toast({ title: "Período inválido", description: "Informe datas válidas e com o fim igual ou posterior ao início.", variant: "destructive" }); return; }
    const blocosVoo = montarBlocos(painel?.escala || [], [], painel?.tripulacao || []);
    const voosNoPeriodo = conflitosDoTripulante(
      blocosVoo, tripulante.id,
      Date.parse(`${dataInicio}T00:00:00Z`), Date.parse(`${dataFim}T00:00:00Z`) + DIA,
    );
    if (novaDisponibilidade.status !== "disponivel" && voosNoPeriodo.length) {
      toast({ title: "Conflito com agendamento", description: `${tripulante.nome_completo} já está escalado em ${voosNoPeriodo.length} voo(s) aprovado(s) no período informado.`, variant: "destructive" });
      return;
    }
    setProcessando(true);
    try {
      await definirDisponibilidadeTripulacao({ ...novaDisponibilidade, data_inicio: dataInicio, data_fim: dataFim });
      toast({ title: "Disponibilidade registrada", description: "A informação foi salva na escala da tripulação." });
      setMostrarDisponibilidade(false);
      await carregar(true);
    } catch (error) { toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setProcessando(false); }
  };
  const abrirCriacaoEscala = () => {
    const hoje = dataIso(new Date());
    setNovaDisponibilidade({ tripulante_id: "", data_inicio: hoje, data_fim: hoje, status: "aviso", observacoes: "" });
    setMostrarDisponibilidade(true);
  };
  const mudarMes = (delta: number) => setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  const mudarSemana = (delta: number) => setSemanaCalendario((atual) => new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + delta * 7));
  const mudarVisaoCalendario = (visao: VisaoEscala) => {
    setVisaoCalendario(visao);
    if (visao === "mensal") setMes(primeiroDiaMes(semanaCalendario));
    else setSemanaCalendario(inicioSemana(mes));
  };

  return <div className="route-enter min-w-0 space-y-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><IndicadorPagina>{aba === "voos-hoje" ? "Operações / acompanhamento" : "Operações / agendamento de voo"}</IndicadorPagina><h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">{aba === "voos-hoje" ? "Voos de Hoje" : "Agendamento de Voo"}</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{aba === "voos-hoje" ? "Voos confirmados com checklist pré-voo concluído. Acompanhe a rota e inicie a jornada." : "Organize solicitações, aeronaves, confirmação de voos e escala da tripulação."}</p></div><div className="flex w-full flex-wrap gap-2 pl-[6px] pr-[6px] -ml-[3px] -mr-[3px] md:w-auto">{aba !== "voos-hoje" && <Button type="button" onClick={() => setMostrarNovo((atual) => !atual)} className="flex-1 gap-2 bg-[rgba(13,131,185,1)] text-primary-foreground dark:bg-[#0D83B9] sm:flex-none"><Plus size={14} /> Novo agendamento</Button>}</div></div>
    {aba !== "voos-hoje" && <div className="mt-3.5 -ml-1.5 grid grid-cols-3 gap-3 sm:gap-9"><CartaoKpi label="Voos confirmados" value={carregando ? "—" : String(confirmados.length)} detail="Todos os registros carregados" icon={<Plane size={16} />} /><CartaoKpi label="Solicitações pendentes" value={carregando ? "—" : String(pendentes.length)} detail="Aguardando coordenação" tone="amber" icon={<Clock3 size={16} />} /><CartaoKpi label="Aeronaves disponíveis" value={carregando ? "—" : String(painel?.aeronaves?.length ?? 0)} detail="Frota ativa do D1" tone="green" icon={<CalendarDays size={16} />} /></div>}
    {aba !== "voos-hoje" && mostrarNovo && <FormularioAgendamento novo={novo} opcoes={opcoes} titulares={titulares} aerodromos={aerodromos} aerodromosCarregando={aerodromosCarregando} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />}
    {erro && <div className="rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">{abas.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setAba(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold transition-colors ${aba === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={14} />{item.label}</button>; })}</nav>
    {aba === "voos-hoje" && <VoosDeHoje voos={voosDeHoje} vooSelecionado={vooHojeSelecionado} nomesTripulantes={nomesTripulantes} voosEmOperacao={voosAoVivo} carregando={carregando} aoSelecionar={setVooHojeSelecionadoId} aoIniciar={abrirJornada} />}
    {aba === "calendario" && <CalendarioAgendamento mes={mes} semana={semanaCalendario} dias={dias} visao={visaoCalendario} confirmados={[...confirmados, ...encerrados]} pendentes={pendentes} aeronaves={painel?.aeronaves || []} buscaVoo={buscaCalendario} aoMudarBuscaVoo={setBuscaCalendario} aoNavegarParaData={navegarParaDataCalendario} aoMudarMes={mudarMes} aoMudarSemana={mudarSemana} aoMudarVisao={mudarVisaoCalendario} aoAbrir={abrirSolicitacao} />}
    {aba === "escala" && <Escala
      tripulacao={painel?.tripulacao || []}
      escala={painel?.escala || []}
      disponibilidades={painel?.disponibilidades || []}
      aoMarcar={abrirCriacaoEscala}
      aoAbrirVoo={(id) => { const item = agendamentos.find((a) => a.id === id); if (item) abrirSolicitacao(item); }}
    />}
    {aba === "cronograma" && !selecionada && <Cronograma selecionada={selecionada} progressoChecklistPorId={progressoChecklistPorId} checklistAberto={checklistAberto} solicitacoes={solicitacoesFiltradas} nomesTripulantes={nomesTripulantes} busca={busca} filtroStatus={filtroStatus} visao={visaoCronograma} aoMudarBusca={setBusca} aoMudarFiltroStatus={setFiltroStatus} aoMudarVisao={setVisaoCronograma} aoAbrir={abrirSolicitacao} aoConfirmar={confirmarSolicitacao} aoVoltar={() => setSelecionada(null)} aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={(item) => { setAba("cronograma"); abrirJornada(item); }} aoFinalizar={(item) => void finalizar(item)} aoExcluir={(item) => void excluir(item)} />}
    {aba === "escala" && mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />}
    {selecionada && !checklistAberto && !jornadaAberta && <DetalhesSolicitacao acoes={<><AcoesCronograma item={selecionada} aoAbrir={abrirSolicitacao} aoConfirmar={confirmarSolicitacao} aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={abrirJornada} aoFinalizar={(item) => void finalizar(item)} progressoChecklist={progressoChecklistPorId[selecionada.id] ?? calcularProgressoChecklist(selecionada)} checklistAberto={checklistAberto} emVisualizacao /></>} aoExcluir={() => void excluir(selecionada)} selecionada={selecionada} opcoes={opcoes} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando} aoAtualizar={atualizarSelecionada} aoFechar={() => { setSelecionada(null); setChecklistAberto(false); }} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={(alteracoes) => void aprovar(alteracoes)} aoReprovar={() => void reprovar()} />}
    {selecionada && checklistAberto && <Button type="button" variant="outline" onClick={() => setChecklistAberto(false)} className="gap-2"><ChevronLeft size={14} /> Voltar aos detalhes do voo</Button>}
    {selecionada && (statusPermiteChecklist(selecionada.status) || selecionada.checklist_status === "concluido") && checklistAberto && <ChecklistPreVoo key={selecionada.id} item={selecionada} aoConcluir={() => carregar(true)} aoAtualizarProgresso={notificarProgressoChecklist} />}
    {selecionada && statusPermiteAbrirJornada(selecionada.status) && jornadaAberta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"><div className="max-h-[100dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl rounded-b-none pb-[env(safe-area-inset-bottom)] sm:max-h-[92dvh] sm:rounded-2xl"><JornadaVoo item={selecionada} voosEmOperacao={voosAoVivo} aoAtualizarAgendamento={async (status) => { await carregar(true); if (status) setSelecionada((atual) => atual ? { ...atual, status } : atual); }} aoFechar={() => { setJornadaAberta(false); setSelecionada(null); void carregar(true); }} /></div></div>}
    <Dialog open={Boolean(agendamentoParaExcluir)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setAgendamentoParaExcluir(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-red-400/20 bg-card sm:max-w-md">
        <DialogHeader><DialogTitle className="text-base font-bold text-red-300">Excluir agendamento definitivamente?</DialogTitle><DialogDescription className="pt-2 text-xs leading-relaxed">Deseja realmente excluir definitivo esse agendamento?</DialogDescription></DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setAgendamentoParaExcluir(null)} disabled={excluindo} className="w-full sm:w-auto">Cancelar</Button><Button type="button" onClick={() => void confirmarExclusao()} disabled={excluindo} className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto">{excluindo ? "Excluindo..." : "Sim, excluir definitivamente"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
  return <section className="overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5"><CabecalhoSecao icon={<Plus size={15} />} title="Novo agendamento" detail="O número do voo será gerado somente após a confirmação" action={<button type="button" onClick={aoCancelar} aria-label="Fechar novo agendamento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6 xl:grid-cols-4"><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Cliente / sócio</Label><SearchableCombobox items={titulares} value={titularSelecionado} onChange={mudarTitular} placeholder="Selecione o cliente ou sócio" searchPlaceholder="Digite para buscar cliente ou sócio" emptyMessage="Nenhum cliente ou sócio encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Aeronave</Label><SearchableCombobox items={aeronaveItems} value={novo.aeronave_id} onChange={selecionarAeronave} placeholder="Selecione a aeronave" searchPlaceholder="Digite matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave cadastrada encontrada." icon={<Plane size={14} />} disabled={!titularSelecionado} /></div>{aeronaveEmprestada && <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 sm:col-span-2 xl:col-span-4"><div><p className="text-[10px] font-bold">Essa aeronave não está vinculada ao titular selecionado. Esse voo é emprestado?</p><p className="mt-1 text-[9px] text-muted-foreground">Confirme para registrar quem está cedendo a aeronave neste agendamento.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant={novo.voo_emprestimo_confirmado === true ? 'default' : 'outline'} onClick={() => atualizar('voo_emprestimo_confirmado', true)} className="h-8 text-[10px]">Sim, é emprestado</Button><Button type="button" variant={novo.voo_emprestimo_confirmado === false ? 'default' : 'outline'} onClick={() => { atualizar('voo_emprestimo_confirmado', false); atualizar('cliente_emprestimo_id', undefined); atualizar('socio_emprestimo_id', undefined); atualizar('aeronave_id', ''); }} className="h-8 text-[10px]">Não</Button></div>{novo.voo_emprestimo_confirmado === true && <div className="space-y-1.5"><Label className="text-[10px]">Cliente ou sócio que está emprestando</Label><SearchableCombobox items={cedentes.filter((item) => item.id !== titularSelecionado)} value={novo.cliente_emprestimo_id ? `cliente:${novo.cliente_emprestimo_id}` : novo.socio_emprestimo_id ? `socio:${novo.socio_emprestimo_id}` : ''} onChange={selecionarCedente} placeholder="Selecione quem está emprestando" searchPlaceholder="Digite o nome do cedente" emptyMessage="Nenhum cotista vinculado a esta aeronave." icon={<Users size={14} />} /></div>}</div>}<div className="space-y-1.5"><Label className="text-[10px]">Origem</Label><SearchableCombobox items={aerodromoItems} value={novo.origem} onChange={(value) => atualizar('origem', value)} placeholder={aerodromosCarregando ? 'Carregando aeródromos...' : 'Selecione o aeródromo'} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div><div className="space-y-1.5"><Label className="text-[10px]">Destino</Label><SearchableCombobox items={aerodromoItems} value={novo.destino} onChange={(value) => atualizar('destino', value)} placeholder={aerodromosCarregando ? 'Carregando aeródromos...' : 'Selecione o aeródromo'} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div><PeriodoAgendamento inicio={novo.data_agendada} fim={novo.data_fim} aoAlterarInicio={(valor) => atualizar('data_agendada', valor)} aoAlterarFim={(valor) => atualizar('data_fim', valor)} /><div className="space-y-1.5"><Label htmlFor="hora-agendamento" className="text-[10px]">Horário previsto (UTC)</Label><Input id="hora-agendamento" type="time" value={novo.horario_previsto_agendamento || ''} onChange={(event) => atualizar('horario_previsto_agendamento', event.target.value)} required className="h-10 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="passageiros-agendamento" className="text-[10px]">Passageiros</Label><Input id="passageiros-agendamento" type="number" min={1} value={novo.numero_passageiros || 1} onChange={(event) => atualizar('numero_passageiros', Number(event.target.value))} className="h-10 text-xs" /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === 'freelancer' ? 'Freelancer' : 'Tripulação'}` }))} value={novo.piloto_id || ''} onChange={(value) => atualizar('piloto_id', value)} placeholder="Definir depois" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">SIC (segundo em comando) <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac}` }))} value={novo.copiloto_id || ''} onChange={(value) => atualizar('copiloto_id', value)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-agendamento" className="text-[10px]">Observações</Label><Textarea id="observacoes-agendamento" value={novo.observacoes || ''} onChange={(event) => atualizar('observacoes', event.target.value)} placeholder="Informações da trip, passageiros ou operação" className="min-h-16 text-xs" /></div><div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="h-11 w-full rounded-xl text-xs sm:w-auto">Cancelar</Button><Button type="submit" disabled={atualizando} className="h-11 w-full gap-2 rounded-xl text-xs sm:w-auto">{atualizando ? 'Salvando...' : 'Salvar agendamento'}<Check size={14} /></Button></div></form></section>;
}

function PeriodoAgendamento({ inicio, fim, aoAlterarInicio, aoAlterarFim }: { inicio: string; fim: string; aoAlterarInicio: (valor: string) => void; aoAlterarFim: (valor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [aguardandoFim, setAguardandoFim] = useState(false);
  const [inicioTemporario, setInicioTemporario] = useState<Date>();
  const [mesVisivel, setMesVisivel] = useState(() => inicio ? new Date(`${inicio}T00:00:00`) : new Date());

  const aoAbrir = (novoEstado: boolean) => {
    setAberto(novoEstado);
    if (novoEstado) {
      setAguardandoFim(false);
      setInicioTemporario(undefined);
      setMesVisivel(inicio ? new Date(`${inicio}T00:00:00`) : new Date());
    }
  };

  const selecionarIntervalo = (intervalo: DateRange | undefined) => {
    if (!intervalo?.from) return;
    if (!aguardandoFim) {
      setInicioTemporario(intervalo.from);
      setAguardandoFim(true);
      return;
    }
    if (!intervalo.to) {
      setInicioTemporario(intervalo.from);
      return;
    }
    aoAlterarInicio(dataIso(intervalo.from));
    aoAlterarFim(dataIso(intervalo.to));
    aoAbrir(false);
  };

  return <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Período do voo</Label><div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><Input aria-label="Data de início do voo" type="date" value={inicio} onChange={(event) => aoAlterarInicio(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><span className="text-[10px] text-muted-foreground">até</span><Input aria-label="Data de fim do voo" type="date" value={fim} min={inicio} onChange={(event) => aoAlterarFim(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover open={aberto} onOpenChange={aoAbrir}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário do período"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[70] w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(24rem,calc(100dvh-1.5rem))] overflow-y-auto p-3"><p className="mb-2 text-center text-xs font-semibold text-foreground">{aguardandoFim ? "Selecione a data de fim" : "Selecione a data de início"}</p><DayPicker locale={ptBR} mode="range" month={mesVisivel} onMonthChange={setMesVisivel} selected={aguardandoFim && inicioTemporario ? { from: inicioTemporario } : undefined} onSelect={selecionarIntervalo} showOutsideDays className="mx-auto" classNames={{ months: "flex justify-center", month: "space-y-3", caption: "relative flex items-center justify-center pt-1", caption_label: "text-xs font-semibold", nav: "flex items-center justify-between", nav_button: "h-7 w-7 rounded-md border border-border bg-background p-1 text-foreground hover:bg-accent", nav_button_previous: "absolute left-0", nav_button_next: "absolute right-0", table: "w-full border-collapse", head_row: "flex", head_cell: "w-9 rounded-md text-[0.65rem] font-normal text-muted-foreground", row: "mt-1 flex w-full", cell: "relative h-9 w-9 p-0 text-center text-xs focus-within:relative focus-within:z-20", day: "h-9 w-9 rounded-md p-0 text-xs font-normal text-foreground hover:bg-accent", day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", day_range_start: "rounded-l-md bg-primary text-primary-foreground", day_range_end: "rounded-r-md bg-primary text-primary-foreground", day_range_middle: "rounded-none bg-primary/15 text-foreground", day_today: "border border-primary/50", day_outside: "text-muted-foreground opacity-40", day_disabled: "text-muted-foreground opacity-30", day_hidden: "invisible" }} /></PopoverContent></Popover></div></div>;
}

function DataAgendamento({ valor, aoAlterar }: { valor: string; aoAlterar: (valor: string) => void }) {
  const selecionada = valor ? new Date(`${valor}T00:00:00`) : undefined;
  return <div className="space-y-1.5"><Label htmlFor="data-agendamento" className="text-[10px]">Data do voo</Label><div className="flex gap-2"><Input id="data-agendamento" type="date" value={valor} onChange={(event) => aoAlterar(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><DateCalendar value={selecionada ?? null} onChange={(data) => aoAlterar(dataIso(data))} /></PopoverContent></Popover></div></div>;
}

function formatarHorarioAgendamento(valor: string | null | undefined) {
  if (!valor) return { utc: "—", brasilia: "—" };
  const texto = String(valor).trim();
  const instante = /^\d{4}-\d{2}-\d{2}T/.test(texto) ? new Date(texto) : (() => {
    const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!partes) return new Date(NaN);
    return new Date(Date.UTC(1970, 0, 1, Number(partes[1]), Number(partes[2]), Number(partes[3] || 0)));
  })();
  if (!Number.isFinite(instante.getTime())) return { utc: "—", brasilia: "—" };
  const utc = instante.toISOString().slice(11, 16);
  const brasilia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(instante);
  return { utc, brasilia };
}

function horaParaCampo(valor: string | null | undefined) {
  if (!valor) return "";
  const parte = String(valor).trim().match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : "";
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
  buscaVoo: string;
  aoMudarBuscaVoo: (busca: string) => void;
  aoNavegarParaData: (data: string) => void;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
};

function CalendarioAgendamento({ mes, semana, dias, visao, confirmados, pendentes, aeronaves, buscaVoo, aoMudarBuscaVoo, aoNavegarParaData, aoMudarMes, aoMudarSemana, aoMudarVisao, aoAbrir }: CalendarioAgendamentoProps) {
  const termoVoo = buscaVoo.trim().toLowerCase();
  const todosEventos = useMemo(() => [...confirmados, ...pendentes], [confirmados, pendentes]);
  const resultadosBusca = useMemo(() => {
    if (!termoVoo) return [];
    return todosEventos.filter((item) => [item.numero_voo, item.codigo_cliente, item.cliente_razao_social, item.socio_nome, item.origem, item.destino].filter(Boolean).join(" ").toLowerCase().includes(termoVoo)).slice(0, 8);
  }, [todosEventos, termoVoo]);
  const resultadoPrincipal = resultadosBusca[0];
  useEffect(() => {
    if (termoVoo.length >= 2 && resultadoPrincipal?.data_agendada) aoNavegarParaData(resultadoPrincipal.data_agendada);
  }, [termoVoo, resultadoPrincipal?.data_agendada, aoNavegarParaData]);
  const eventosPorDia = new Map<string, SolicitacaoVooInterna[]>();
  todosEventos
    .filter((item) => !termoVoo || [item.numero_voo, item.codigo_cliente, item.cliente_razao_social, item.socio_nome, item.origem, item.destino].filter(Boolean).join(" ").toLowerCase().includes(termoVoo))
    .forEach((item) => eventosPorDia.set(item.data_agendada, [...(eventosPorDia.get(item.data_agendada) || []), item]));
  const diasVisao = visao === "semanal" ? Array.from({ length: 7 }, (_, indice) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + indice)) : dias;
  const periodo = visao === "semanal"
    ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()]} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()]} ${diasVisao[6].getFullYear()}`
    : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;
  const mudarPeriodo = visao === "semanal" ? aoMudarSemana : aoMudarMes;
  const descricao = visao === "semanal" ? "Visão semanal dos voos e solicitações" : "Visão mensal dos voos e solicitações";
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Calendário de agendamento" detail={descricao} action={<div className="flex flex-wrap items-center justify-end gap-2"><div className="relative"><Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar voo agendado por número" value={buscaVoo} onChange={(event) => aoMudarBuscaVoo(event.target.value)} placeholder="Buscar nº do voo..." className="h-8 w-full pl-8 text-[10px] sm:w-44" /></div><div className="flex rounded-md border border-border p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "semanal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Mensal</button></div><div className="flex items-center gap-1"><button type="button" onClick={() => mudarPeriodo(-1)} aria-label={visao === "semanal" ? "Semana anterior" : "Mês anterior"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronLeft size={15} /></button><span className="min-w-[110px] text-center text-[10px] font-bold sm:min-w-[150px]">{periodo}</span><button type="button" onClick={() => mudarPeriodo(1)} aria-label={visao === "semanal" ? "Próxima semana" : "Próximo mês"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} /></button></div></div>} />{termoVoo && <div className="border-b border-border bg-secondary/10 px-3 py-2"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">Resultados relacionados</p>{resultadosBusca.length ? <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">{resultadosBusca.map((item) => <button key={item.id} type="button" onClick={() => { aoNavegarParaData(item.data_agendada); aoAbrir(item); }} className="rounded-md border border-border/70 bg-card/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40"><p className="truncate text-[10px] font-bold text-primary">{item.numero_voo || "Sem número de voo"}</p><p className="truncate text-[9px] text-foreground">{item.codigo_cliente || item.cliente_razao_social || item.socio_nome || "Cliente não informado"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)}</p></button>)}</div> : <p className="text-[10px] text-muted-foreground">Nenhum voo encontrado para “{buscaVoo}”.</p>}</div>}<div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{diasVisao.map((dia) => { const chave = dataIso(dia); const eventos = eventosPorDia.get(chave) || []; const noMes = visao === "semanal" || dia.getMonth() === mes.getMonth(); const hoje = chave === dataIso(new Date()); return <div key={chave} className={`min-h-[150px] border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${hoje ? "bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground"}`}>{dia.getDate()}</div><div className="space-y-1.5">{eventos.map((item) => <ResumoVooCalendario key={item.id} item={item} aeronave={item.matricula_registro || aeronaves.find((aeronave) => aeronave.id === item.aeronave_id)?.matricula_registro || "Aeronave a definir"} aoAbrir={aoAbrir} />)}</div></div>; })}</div></section></div>;
}

function ResumoVooCalendario({ item, aeronave, aoAbrir }: { item: SolicitacaoVooInterna; aeronave: string; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  const visual = visualStatusAgendamento(item.status);
  const horario = formatarHorarioAgendamento(item.horario_previsto_agendamento);
  return <button type="button" onClick={() => aoAbrir(item)} className={`w-full rounded-md border-2 p-2 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${visual.evento}`}><div className="flex items-start gap-1.5"><Plane size={12} className={`mt-0.5 shrink-0 ${visual.icone}`} /><div className="min-w-0"><p className="truncate text-[10px] font-bold">{item.numero_voo || "Solicitação sem número"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino}</p><p className="truncate text-[9px] text-muted-foreground">{aeronave}</p><p className="mt-1 text-[9px] font-semibold leading-tight text-foreground">UTC: {horario.utc}</p><p className="text-[9px] font-semibold leading-tight text-foreground">Brasília: {horario.brasilia}</p></div></div></button>;
}


function Escala({ tripulacao, escala, disponibilidades, aoMarcar, aoAbrirVoo }: { tripulacao: TripulanteAgendamento[]; escala: EscalaAgendamento[]; disponibilidades: DisponibilidadeTripulacao[]; aoMarcar: () => void; aoAbrirVoo: (id: string) => void }) {
  const [extratoTripulante, setExtratoTripulante] = useState<TripulanteAgendamento | null>(null);
  const [extratoPeriodo, setExtratoPeriodo] = useState("");
  const [extratoJornadas, setExtratoJornadas] = useState<JornadaVooRegistro[]>([]);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [erroExtrato, setErroExtrato] = useState("");

  const abrirExtrato = async (item: TripulanteAgendamento, inicio: string, fim: string) => {
    setExtratoTripulante(item); setExtratoPeriodo(`${formatarData(inicio)} – ${formatarData(fim)}`);
    setExtratoJornadas([]); setErroExtrato(""); setCarregandoExtrato(true);
    try {
      const resposta = await buscarExtratoJornadaTripulante(item.id, inicio, fim);
      setExtratoJornadas(Array.isArray(resposta?.jornadas) ? resposta.jornadas : []);
    } catch (error) { setErroExtrato(error instanceof Error ? error.message : "Não foi possível carregar o extrato de jornada."); }
    finally { setCarregandoExtrato(false); }
  };

  return <>
    <EscalaCalendario tripulacao={tripulacao} escala={escala} disponibilidades={disponibilidades} aoCriarEscala={aoMarcar} aoAbrirVoo={aoAbrirVoo} aoAbrirExtrato={abrirExtrato} />
    <Dialog open={Boolean(extratoTripulante)} onOpenChange={(aberto) => { if (!aberto && !carregandoExtrato) setExtratoTripulante(null); }}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border-cyan-300/20 bg-card dark:bg-[#0d1521] sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-base text-white">Extrato de jornada</DialogTitle><DialogDescription className="text-xs text-muted-foreground dark:text-slate-400">{extratoTripulante?.nome_completo} · {extratoTripulante?.canac} · {extratoPeriodo}</DialogDescription></DialogHeader>
        {carregandoExtrato && <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground dark:text-slate-400"><RefreshCw size={14} className="animate-spin" /> Carregando jornadas do tripulante...</div>}
        {!carregandoExtrato && erroExtrato && <div className="rounded-lg border border-red-300/20 bg-red-300/10 p-3 text-xs text-red-200">{erroExtrato}</div>}
        {!carregandoExtrato && !erroExtrato && !extratoJornadas.length && <div className="rounded-lg border border-border dark:border-white/[.08] bg-white/[.03] p-6 text-center text-xs text-muted-foreground dark:text-slate-400">Nenhuma jornada registrada para este tripulante no período selecionado.</div>}
        {!carregandoExtrato && !erroExtrato && extratoJornadas.length > 0 && <div className="space-y-2">{extratoJornadas.map((jornada) => <div key={jornada.id} className="rounded-xl border border-border dark:border-white/[.08] bg-white/[.03] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-white">{jornada.numero_voo || "Jornada operacional"} · Jornada {jornada.numero_jornada}</p><p className="mt-1 text-[10px] text-muted-foreground dark:text-slate-400">{formatarData(jornada.data)} · {jornada.origem || "—"} → {jornada.destino || "—"} · {jornada.matricula_registro || "Aeronave não informada"}</p><p className="mt-1 text-[10px] font-semibold text-cyan-200">{jornada.tripulante_nome || extratoTripulante?.nome_completo} · {jornada.funcao_tripulante}</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-bold text-emerald-200">{jornada.status === "encerrada" ? "Encerrada" : "Em andamento"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div><span className="block text-[9px] text-slate-500">Apresentação</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_apresentacao ? jornada.horario_apresentacao.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Acionamento</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_acionamento ? jornada.horario_acionamento.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Pouso</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_pouso ? jornada.horario_pouso.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Corte</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_corte ? jornada.horario_corte.slice(11, 16) : "—"}</strong></div></div>{jornada.pernas?.length > 0 && <div className="mt-3 space-y-1.5">{jornada.pernas.map((perna) => <div key={perna.id} className="rounded-lg border border-border dark:border-white/[.06] px-2.5 py-2 text-[10px] text-muted-foreground dark:text-slate-300">Perna {perna.numero}: {perna.origem} → {perna.destino} · AC {perna.horario_ac?.slice(11, 16) || "—"} · COR {perna.horario_corte?.slice(11, 16) || "—"}</div>)}</div>}</div>)}</div>}
      </DialogContent>
    </Dialog>
  </>;
}

function Cronograma({ selecionada, progressoChecklistPorId, checklistAberto, solicitacoes, nomesTripulantes, busca, filtroStatus, visao, aoMudarBusca, aoMudarFiltroStatus, aoMudarVisao, aoAbrir, aoConfirmar, aoVoltar, aoChecklist, aoJornada, aoFinalizar, aoExcluir }: { selecionada: SolicitacaoVooInterna | null; progressoChecklistPorId: Record<string, number>; checklistAberto: boolean; solicitacoes: SolicitacaoVooInterna[]; nomesTripulantes: Map<string, string>; busca: string; filtroStatus: FiltroStatusCronograma; visao: VisaoCronograma; aoMudarBusca: (busca: string) => void; aoMudarFiltroStatus: (filtro: FiltroStatusCronograma) => void; aoMudarVisao: (visao: VisaoCronograma) => void; aoAbrir: (item: SolicitacaoVooInterna) => void; aoConfirmar: (item: SolicitacaoVooInterna) => void; aoVoltar: () => void; aoChecklist: (item: SolicitacaoVooInterna) => void; aoJornada: (item: SolicitacaoVooInterna) => void; aoFinalizar: (item: SolicitacaoVooInterna) => void; aoExcluir: (item: SolicitacaoVooInterna) => void }) {
  const solicitacoesVisiveis = selecionada ? [selecionada] : solicitacoes;
  return <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Cronograma de Voos" detail={selecionada ? "Agendamento selecionado" : "Todas as solicitações de voo"} action={selecionada ? <Button type="button" variant="outline" onClick={aoVoltar} className="h-8 gap-1.5 border-border bg-card px-3 text-[10px]"><ChevronLeft size={13} /> Voltar</Button> : <div className="flex flex-wrap items-center justify-end gap-2"><div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Filtrar solicitações por status"><button type="button" onClick={() => aoMudarFiltroStatus("pendente")} aria-pressed={filtroStatus === "pendente"} className={`rounded px-2 py-1 text-[9px] font-bold ${filtroStatus === "pendente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Pendente</button><button type="button" onClick={() => aoMudarFiltroStatus("aprovada")} aria-pressed={filtroStatus === "aprovada"} className={`rounded px-2 py-1 text-[9px] font-bold ${filtroStatus === "aprovada" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Aprovada</button><button type="button" onClick={() => aoMudarFiltroStatus("em_voo")} aria-pressed={filtroStatus === "em_voo"} className={`rounded px-2 py-1 text-[9px] font-bold ${filtroStatus === "em_voo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Em Voo / Em Solo</button><button type="button" onClick={() => aoMudarFiltroStatus("encerrada")} aria-pressed={filtroStatus === "encerrada"} className={`rounded px-2 py-1 text-[9px] font-bold ${filtroStatus === "encerrada" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Encerrado</button><button type="button" onClick={() => aoMudarFiltroStatus("todos")} aria-pressed={filtroStatus === "todos"} className={`px-2 py-1 text-[9px] font-bold ${filtroStatus === "todos" ? "rounded-[16px] overflow-hidden bg-primary text-primary-foreground" : "rounded text-muted-foreground hover:bg-secondary"}`}>Todas</button></div><div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar cliente, rota ou voo" className="h-8 w-full pl-8 text-[10px] sm:w-56" /></div><div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Alternar visualização"><button type="button" onClick={() => aoMudarVisao("grid")} aria-label="Visualizar em grade" aria-pressed={visao === "grid"} className={`rounded p-1.5 ${visao === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="6" ry="6" /><rect width="7" height="7" x="3" y="14" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /></svg></button><button type="button" onClick={() => aoMudarVisao("lista")} aria-label="Visualizar em lista" aria-pressed={visao === "lista"} className={`rounded p-1.5 ${visao === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><List size={14} /></button></div></div>} />{solicitacoesVisiveis.length ? <><div className={visao === "grid" ? "grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2 p-3"}>{solicitacoesVisiveis.map((item) => <CartaoCronograma key={item.id} item={item} nomesTripulantes={nomesTripulantes} progressoChecklist={progressoChecklistPorId[item.id] ?? calcularProgressoChecklist(item)} checklistAberto={checklistAberto && selecionada?.id === item.id} emVisualizacao={Boolean(selecionada)} aoAbrir={aoAbrir} aoConfirmar={aoConfirmar} aoChecklist={aoChecklist} aoJornada={aoJornada} aoFinalizar={aoFinalizar} aoExcluir={aoExcluir} />)}</div></> : <EstadoVazio label="Nenhuma solicitação encontrada" />}</section>;
}

function CartaoCronograma({ item, nomesTripulantes, aoAbrir, aoConfirmar, aoChecklist, aoJornada, aoFinalizar, aoExcluir, progressoChecklist, checklistAberto, emVisualizacao }: { item: SolicitacaoVooInterna; nomesTripulantes: Map<string, string>; aoAbrir: (item: SolicitacaoVooInterna) => void; aoConfirmar: (item: SolicitacaoVooInterna) => void; aoChecklist: (item: SolicitacaoVooInterna) => void; aoJornada: (item: SolicitacaoVooInterna) => void; aoFinalizar: (item: SolicitacaoVooInterna) => void; aoExcluir: (item: SolicitacaoVooInterna) => void; progressoChecklist: number; checklistAberto: boolean; emVisualizacao: boolean }) {
  const cliente = item.voo_emprestado !== "nao" && item.socio_emprestimo_nome ? item.socio_emprestimo_nome : item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Cliente não informado";
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const tripulacao = [item.piloto_nome || (item.piloto_id ? nomesTripulantes.get(item.piloto_id) : null), item.copiloto_nome || (item.copiloto_id ? nomesTripulantes.get(item.copiloto_id) : null)].filter(Boolean).join(" / ") || "A definir";
  const statusCartao = String(item.status || "").trim().toLowerCase();
  const bordaStatus = statusCartao === "aprovada" ? "border-[rgba(14,153,12,0.89)]" : statusCartao === "encerrada" ? "border-slate-500 dark:border-slate-400" : visualStatusAgendamento(item.status).borda;
  return <article className={`group flex min-h-full flex-col overflow-hidden rounded-2xl border ${bordaStatus} bg-[rgba(202,235,177,0.21)] dark:bg-none dark:bg-card p-4 transition-all duration-200 hover:-translate-y-0.5`}>
    <div className="flex items-start justify-between gap-[11px] border-b border-border/60 pb-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">Agendamento de voo</p><p className="mt-1 truncate font-mono text-sm font-bold tracking-tight text-primary">{item.numero_voo || "A gerar na confirmação"}</p><p className="mt-1 truncate text-[11px] font-semibold text-foreground">{cliente}</p></div><div className="flex shrink-0 items-center gap-[-1px]"><EtiquetaStatus tone={tomStatus(item.status)} className="text-[8px]">{acoes.historico ? "Encerrada" : statusLabel(item.status)}</EtiquetaStatus><button type="button" onClick={() => aoExcluir(item)} aria-label="Excluir agendamento" title="Excluir agendamento" className="mx-[1px] my-[-4px] min-h-9 overflow-hidden rounded-[5px] border-0 bg-transparent px-[5px] py-0 text-[10px] font-light leading-[16.5px] text-[#ec0000] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card hover:bg-red-400/15"><Trash2 size={15} /></button></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="min-w-0 rounded-xl border border-[rgba(79,84,92,0.5)] bg-background/25 p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Rota</span><strong className="mt-1 block truncate font-mono text-xs text-foreground">{item.origem} <span className="text-primary">→</span> {item.destino}</strong></div><div className="min-w-0 rounded-xl border border-[rgba(79,84,92,0.5)] bg-background/25 p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Período</span><strong className="mt-1 block text-xs text-foreground">{formatarData(item.data_agendada)}{item.data_fim && item.data_fim !== item.data_agendada ? ` a ${formatarData(item.data_fim)}` : ""}</strong></div><div className="min-w-0 rounded-xl border border-[rgba(79,84,92,0.5)] bg-background/25 p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Aeronave</span><strong className="mt-1 block truncate font-mono text-xs text-foreground">{item.matricula_registro || "A definir"}</strong></div><div className="min-w-0 rounded-xl border border-[rgba(79,84,92,0.5)] bg-background/25 p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Tripulação</span><strong className="mt-1 block break-words text-xs text-foreground">{tripulacao}</strong></div></div>
    <AcoesCronograma item={item} aoAbrir={aoAbrir} aoConfirmar={aoConfirmar} aoChecklist={aoChecklist} aoJornada={aoJornada} aoFinalizar={aoFinalizar} progressoChecklist={progressoChecklist} checklistAberto={checklistAberto} emVisualizacao={emVisualizacao} />
  </article>;
}

function AcoesCronograma({ item, aoAbrir, aoConfirmar, aoChecklist, aoJornada, aoFinalizar, progressoChecklist, checklistAberto, emVisualizacao }: {
  item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void; aoConfirmar: (item: SolicitacaoVooInterna) => void;
  aoChecklist: (item: SolicitacaoVooInterna) => void; aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void; progressoChecklist: number; checklistAberto: boolean; emVisualizacao: boolean;
}) {
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const [pesoAberto, setPesoAberto] = useState(false);
  return (<div className="mt-auto flex flex-wrap items-center gap-3 sm:gap-[42px] mx-0 sm:mx-9 px-3 sm:px-0 sm:pl-[14px] sm:pr-[50px] pt-4">
      {!emVisualizacao && <button type="button" onClick={() => aoAbrir(item)} className="min-h-[34px] min-w-[120px] flex-1 overflow-hidden rounded-[9px] border border-[rgba(37,107,62,0.84)] [border-style:solid] dark:border-[rgba(37,107,62,0.84)] dark:[border-style:outset] bg-[rgba(10,48,49,0.184)] dark:bg-[rgba(10,48,49,0.45)] mx-0 px-3 py-2 text-[11px] font-semibold text-[rgba(6,7,5,1)] dark:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card hover:bg-primary/15">ABRIR</button>}{!emVisualizacao && String(item.status || "").trim().toLowerCase() === "pendente" && <button type="button" onClick={() => aoConfirmar(item)} className="min-h-[34px] min-w-[120px] flex-1 overflow-hidden rounded-[9px] border border-[rgba(6,172,63,0.84)] [border-style:double] dark:border-[rgba(6,172,63,0.84)] dark:[border-style:outset] bg-[rgba(58,209,120,0.36)] dark:bg-[rgba(16,120,60,0.45)] mx-0 px-3 py-2 text-[11px] font-semibold text-[rgba(18,70,4,1)] dark:text-[rgba(220,252,231,1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card hover:bg-primary/15">CONFIRMAR AGENDAMENTO</button>}
      {acoes.mostrarChecklist && (!acoes.mostrarJornada || emVisualizacao) && <button type="button" onClick={() => aoChecklist(item)} className={cn("min-h-9 min-w-[120px] flex-1 overflow-hidden rounded-[8px] border mx-[1px] px-[9px] py-2 text-[9px] font-semibold leading-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card", acoes.checklistConcluido ? ACAO_CONCLUIDA : [ACAO_HOVER_MOVIMENTO, acoes.checklistLabel === "INICIAR CHECKLIST" ? "bg-[rgba(198,233,255,1)] border-[rgba(24,97,131,1)] text-sky-900 hover:bg-sky-200 dark:bg-[rgba(2,42,65,0.57)] dark:border-[rgba(56,159,230,0.37)] dark:text-[rgba(216,246,231,1)] px-[5px] text-[10px] font-semibold [border-style:double]" : "bg-emerald-100 border-emerald-500 text-emerald-900 hover:bg-emerald-200 dark:bg-[rgba(3,36,23,0.94)] dark:border-[rgba(11,128,59,1)] dark:text-[rgba(205,240,224,1)] [border-style:ridge]"])}>{acoes.checklistLabel}</button>}
      {acoes.mostrarJornada && <button type="button" onClick={() => aoJornada(item)} className={cn("min-h-[32px] min-w-[120px] flex-1 overflow-hidden rounded-[8px] border px-[13px] py-2 text-[10px] font-semibold leading-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card", Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0 ? ACAO_CONCLUIDA : ["bg-amber-100 border-amber-500 text-amber-950 hover:bg-amber-200 dark:bg-amber-400/10 dark:border-amber-300/40 dark:text-amber-200", acoes.jornadaLabel === "INICIAR JORNADA" && `${ACAO_HOVER_MOVIMENTO} bg-[rgba(254,241,199,1)] border-[rgba(245,166,35,1)] text-[rgba(146,94,6,1)] hover:bg-amber-200 dark:bg-[rgba(39,39,10,0.5)] dark:border-[rgba(219,255,55,0.48)] dark:text-[rgba(212,246,181,1)] [border-style:solid]`])}>{acoes.jornadaLabel}</button>}
      {emVisualizacao && acoes.historico && acoes.checklistConcluido && <button type="button" onClick={() => aoChecklist(item)} className="min-h-9 flex-1 rounded-lg border border-primary/35 px-3 py-2 text-[11px] font-bold transition-colors hover:bg-primary/15">Ver checklist</button>}
      {emVisualizacao && acoes.checklistConcluido && <PesoBalanceamentoFicha item={item} />}
      {!emVisualizacao && acoes.checklistConcluido && <PesoBalanceamentoFicha item={item} aberto={pesoAberto} aoAlterarAberto={setPesoAberto} />}
      {!emVisualizacao && (acoes.mostrarChecklist || acoes.checklistConcluido) && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Mais opções do voo" title="Mais opções" className="min-h-9 rounded-lg border-0 bg-card/60 px-2.5 text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"><MoreVertical size={15} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {acoes.mostrarChecklist && <DropdownMenuItem onSelect={() => aoChecklist(item)}>Ver checklist</DropdownMenuItem>}
          {acoes.checklistConcluido && <DropdownMenuItem onSelect={() => setPesoAberto(true)}>Gerar peso e balanceamento</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>}
      {acoes.podeFinalizar ? <button type="button" onClick={() => aoFinalizar(item)} className={`min-h-9 flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${ACAO_A_REALIZAR}`}>Concluir operação</button> : acoes.historico && <span className="inline-flex min-h-9 flex-1 items-center justify-center gap-[13px] rounded-lg border-0 border-emerald-700/35 bg-transparent mx-[7px] px-[18px] py-2 text-center text-[9px] leading-[15.5px] font-semibold text-[#86c23e]"><Check size={13} /> Operação concluída</span>}
    </div>);
}

type EdicaoConfirmacao = {
  aeronave_id: string;
  data_agendada: string;
  data_fim: string;
  horario: string;
  numero_passageiros: number;
  emprestimo: boolean;
  cliente_emprestimo_id: string;
  socio_emprestimo_id: string;
};

function criarEdicaoConfirmacao(selecionada: SolicitacaoVooInterna): EdicaoConfirmacao {
  return {
    aeronave_id: selecionada.aeronave_id || "",
    data_agendada: selecionada.data_agendada,
    data_fim: selecionada.data_fim || selecionada.data_agendada,
    horario: horaParaCampo(selecionada.horario_previsto_agendamento),
    numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    emprestimo: selecionada.voo_emprestado === "sim" || Boolean(selecionada.cliente_emprestimo_id || selecionada.socio_emprestimo_id),
    cliente_emprestimo_id: selecionada.cliente_emprestimo_id || "",
    socio_emprestimo_id: selecionada.socio_emprestimo_id || "",
  };
}

function DetalhesSolicitacao({ acoes, aoExcluir, selecionada, opcoes, tripulacao, pilotoId, copilotoId, motivo, processando, aoAtualizar, aoFechar, aoPiloto, aoCopiloto, aoMotivo, aoAprovar, aoReprovar }: {
  acoes: ReactNode;
  aoExcluir: () => void;
  selecionada: SolicitacaoVooInterna;
  opcoes: OpcoesAgendamentoResponse;
  tripulacao: TripulanteAgendamento[];
  pilotoId: string;
  copilotoId: string;
  motivo: string;
  processando: boolean;
  aoAtualizar: (dados: AtualizacaoAgendamento) => void;
  aoFechar: () => void;
  aoPiloto: (valor: string) => void;
  aoCopiloto: (valor: string) => void;
  aoMotivo: (valor: string) => void;
  aoAprovar: (alteracoes: AlteracoesAgendamentoConfirmacao) => void;
  aoReprovar: () => void;
}) {
  const [edicao, setEdicao] = useState<EdicaoConfirmacao>(() => criarEdicaoConfirmacao(selecionada));
  const [editandoAgendamento, setEditandoAgendamento] = useState(false);
  const [dadosAgendamento, setDadosAgendamento] = useState<AtualizacaoAgendamento>(() => ({
    aeronave_id: selecionada.aeronave_id || "", origem: selecionada.origem, destino: selecionada.destino,
    data_agendada: selecionada.data_agendada, data_fim: selecionada.data_fim || selecionada.data_agendada,
    horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento), numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    piloto_id: selecionada.piloto_id || "", copiloto_id: selecionada.copiloto_id || "",
  }));

  useEffect(() => {
    setEdicao(criarEdicaoConfirmacao(selecionada));
    setEditandoAgendamento(false);
    setDadosAgendamento({ aeronave_id: selecionada.aeronave_id || "", origem: selecionada.origem, destino: selecionada.destino, data_agendada: selecionada.data_agendada, data_fim: selecionada.data_fim || selecionada.data_agendada, horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento), numero_passageiros: Number(selecionada.numero_passageiros) || 1, piloto_id: selecionada.piloto_id || "", copiloto_id: selecionada.copiloto_id || "" });
  }, [selecionada]);

  const salvarEdicaoAgendamento = () => {
    if (!dadosAgendamento.origem || !dadosAgendamento.destino || !dadosAgendamento.data_agendada || !dadosAgendamento.data_fim || dadosAgendamento.data_fim < dadosAgendamento.data_agendada || !dadosAgendamento.aeronave_id) return;
    aoAtualizar({ ...dadosAgendamento, horario_previsto_agendamento: dadosAgendamento.horario_previsto_agendamento ? horarioUtc(dadosAgendamento.data_agendada, dadosAgendamento.horario_previsto_agendamento) : null });
    setEditandoAgendamento(false);
  };

  const clienteTitularId = selecionada.cliente_id || opcoes.socios.find((socio) => socio.id === selecionada.socio_id)?.cliente_id;
  const aeronaveDoTitular = Boolean(edicao.aeronave_id && opcoes.vinculos.some((vinculo) =>
    vinculo.aeronave_id === edicao.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
  ));
  
  const cedentes = (() => {
    const ids = new Set<string>();
    return opcoes.vinculos.filter((vinculo) => vinculo.aeronave_id === edicao.aeronave_id).flatMap((vinculo) => {
      const itens: { id: string; label: string }[] = [];
      if (vinculo.cliente_id) {
        const cliente = opcoes.clientes.find((item) => item.id === vinculo.cliente_id);
        const id = `cliente:${vinculo.cliente_id}`;
        if (cliente && id !== (selecionada.cliente_id ? `cliente:${selecionada.cliente_id}` : "") && !ids.has(id)) {
          ids.add(id);
          itens.push({ id, label: `${cliente.nome}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}` });
        }
      }
      if (vinculo.socio_id) {
        const socio = opcoes.socios.find((item) => item.id === vinculo.socio_id);
        const id = `socio:${vinculo.socio_id}`;
        if (socio && id !== (selecionada.socio_id ? `socio:${selecionada.socio_id}` : "") && !ids.has(id)) {
          ids.add(id);
          itens.push({ id, label: socio.nome });
        }
      }
      return itens;
    });
  })();
  
  const aeronaves = opcoes.aeronaves.map((aeronave) => ({
    id: aeronave.id,
    label: `${aeronave.matricula_registro} · ${[aeronave.fabricante, aeronave.modelo].filter(Boolean).join(" ")}`,
  }));
  
  const editarAeronave = (aeronaveId: string) => {
    const vinculadaAoTitular = opcoes.vinculos.some((vinculo) =>
      vinculo.aeronave_id === aeronaveId && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
    );
    setEdicao((atual) => ({ ...atual, aeronave_id: aeronaveId, emprestimo: !vinculadaAoTitular, cliente_emprestimo_id: "", socio_emprestimo_id: "" }));
  };
  
  const editarCedente = (valor: string) => {
    const [tipo, id] = valor.split(":");
    setEdicao((atual) => ({ ...atual, cliente_emprestimo_id: tipo === "cliente" ? id : "", socio_emprestimo_id: tipo === "socio" ? id : "" }));
  };
  
  const cedenteSelecionado = edicao.cliente_emprestimo_id ? `cliente:${edicao.cliente_emprestimo_id}` : edicao.socio_emprestimo_id ? `socio:${edicao.socio_emprestimo_id}` : "";
  const horarioFormatado = formatarHorarioAgendamento(edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null);
  const emprestimoValido = !edicao.emprestimo || Boolean(cedenteSelecionado);
  const formularioValido = Boolean(edicao.aeronave_id && /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_agendada) && /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_fim) && edicao.data_fim >= edicao.data_agendada && Number.isInteger(edicao.numero_passageiros) && edicao.numero_passageiros >= 1 && emprestimoValido && (aeronaveDoTitular || edicao.emprestimo));
  
  const confirmar = () => aoAprovar({
    aeronave_id: edicao.aeronave_id,
    data_agendada: edicao.data_agendada,
    data_fim: edicao.data_fim,
    horario_previsto_agendamento: edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null,
    numero_passageiros: edicao.numero_passageiros,
    cliente_emprestimo_id: edicao.emprestimo ? edicao.cliente_emprestimo_id || null : null,
    socio_emprestimo_id: edicao.emprestimo ? edicao.socio_emprestimo_id || null : null,
  });
  
  const horarioAtual = formatarHorarioAgendamento(selecionada.horario_previsto_agendamento);
  const emprestimoAtual = selecionada.voo_emprestado === "sim" ? `Sim · ${selecionada.cliente_emprestimo_nome || selecionada.socio_emprestimo_nome || "Cedente não informado"}` : "Não";

  return (
    <section id="detalhes-solicitacao" className="overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5">
      <CabecalhoSecao 
        icon={<ClipboardList size={15} />} 
        title={`Voo ${selecionada.numero_voo || "aguardando confirmação"}`}
        tituloClassName="font-normal"
        detail={`${selecionada.origem} → ${selecionada.destino} · ${formatarData(selecionada.data_agendada)}`} 
        action={<button type="button" onClick={aoFechar} aria-label="Voltar ao cronograma" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs text-[rgba(199,207,221,1)] hover:bg-secondary"><ChevronLeft size={16} /> Voltar ao cronograma</button>}
      />
      <div className="space-y-6 mt-[13px] px-4 py-0 sm:px-6">
        <div className="flex flex-wrap items-center gap-8 border-b border-border pb-5"><span className="rounded-lg border border-[rgba(0,44,105,1)] bg-[rgba(2,82,121,0.1)] px-3 py-2 font-mono text-lg font-bold text-[rgba(142,188,212,1)]">{selecionada.origem} → {selecionada.destino}</span><EtiquetaStatus tone={tomStatus(selecionada.status)}>{statusLabel(selecionada.status)}</EtiquetaStatus><div className="ml-auto flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => setEditandoAgendamento((atual) => !atual)} className="gap-2 py-[6px] text-xs"><Pencil size={13} /> {editandoAgendamento ? "Cancelar edição" : "Editar agendamento"}</Button><button type="button" onClick={aoExcluir} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Excluir agendamento</button></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><Detalhe label="Comandante (PIC)" valor={selecionada.piloto_nome || tripulacao.find((t) => t.id === selecionada.piloto_id)?.nome_completo || "A definir"} /><Detalhe label="Segundo em comando (SIC)" valor={selecionada.copiloto_nome || tripulacao.find((t) => t.id === selecionada.copiloto_id)?.nome_completo || "Não escalado"} /></div>
        {selecionada.observacoes && <div className="rounded-xl border border-border bg-muted/20 p-4"><h3 className="text-xs font-semibold">Observações da operação</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{selecionada.observacoes}</p></div>}
        {selecionada.status === "pendente" ? (
          // === VISÃO UNIFICADA DE CONFIRMAÇÃO ===
          <div className="space-y-6">
            {/* Informações fixas não editáveis nesta etapa */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detalhe label="Cliente / sócio" valor={selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Não informado"} />
              <Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} />
              <Detalhe label="Status da solicitação" valor={statusLabel(selecionada.status)} />
              <Detalhe label="Rota" valor={`${selecionada.origem} → ${selecionada.destino}`} />
            </div>

            {/* Formulário de edição/confirmação */}
            <div id="confirmacao-voo" className="rounded-xl border border-border bg-secondary/15 p-5">
              <div className="mb-5">
                <p className="text-sm font-bold text-foreground">Confirmar dados operacionais</p>
                <p className="mt-1 text-xs text-muted-foreground">Revise ou altere os dados do voo antes de aprovar. As mudanças serão salvas ao confirmar.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Aeronave</Label>
                  <SearchableCombobox items={aeronaves} value={edicao.aeronave_id} onChange={editarAeronave} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave cadastrada." icon={<Plane size={14} />} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emprestimo-agendamento" className="text-xs">ESSE VOO É UM EMPRESTIMO DA AERONAVE?</Label>
                  <select id="emprestimo-agendamento" value={edicao.emprestimo ? "sim" : "nao"} onChange={(event) => setEdicao((atual) => ({ ...atual, emprestimo: event.target.value === "sim", cliente_emprestimo_id: "", socio_emprestimo_id: "" }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs">
                    <option value="nao" disabled={!aeronaveDoTitular}>NÃO</option>
                    <option value="sim">SIM</option>
                  </select>
                </div>

                {edicao.emprestimo && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cedente</Label>
                    <SearchableCombobox items={cedentes} value={cedenteSelecionado} onChange={editarCedente} placeholder="Selecione quem empresta" searchPlaceholder="Buscar cliente ou sócio" emptyMessage="Nenhum cotista vinculado a esta aeronave." icon={<Users size={14} />} />
                  </div>
                )}

                <PeriodoAgendamento inicio={edicao.data_agendada} fim={edicao.data_fim} aoAlterarInicio={(valor) => setEdicao((atual) => ({ ...atual, data_agendada: valor }))} aoAlterarFim={(valor) => setEdicao((atual) => ({ ...atual, data_fim: valor }))} />

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="horario-confirmacao" className="text-xs">Horário Previsto (UTC)</Label>
                  <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3">
                    <Input id="horario-confirmacao" type="time" value={edicao.horario} onChange={(event) => setEdicao((atual) => ({ ...atual, horario: event.target.value }))} className="h-10 w-auto border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
                    <span className="border-l border-border pl-3 text-[10px] font-medium text-muted-foreground">
                      Brasília {horarioFormatado.brasilia}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="passageiros-confirmacao" className="text-xs">Passageiros</Label>
                  <Input id="passageiros-confirmacao" type="number" min={1} step={1} value={edicao.numero_passageiros} onChange={(event) => setEdicao((atual) => ({ ...atual, numero_passageiros: Number(event.target.value) }))} className="h-10 text-xs" />
                </div>
              </div>

              <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
                <p className="text-xs font-bold text-foreground">Definição da Tripulação</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">PIC (Piloto em comando)</Label>
                    <SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={pilotoId} onChange={aoPiloto} placeholder="Selecione o comandante" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SIC (Segundo em comando) <span className="font-normal text-muted-foreground">(Opcional)</span></Label>
                    <SearchableCombobox items={tripulacao.filter((item) => item.id !== pilotoId).map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={copilotoId} onChange={aoCopiloto} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} />
                  </div>
                </div>
                
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="motivo-reprovacao" className="text-xs">Motivo (apenas se for reprovar)</Label>
                  <Textarea id="motivo-reprovacao" value={motivo} onChange={(event) => aoMotivo(event.target.value)} placeholder="Justificativa para rejeição..." className="min-h-16 text-xs" />
                </div>

                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:justify-end">
                  <Button type="button" onClick={aoReprovar} disabled={processando} variant="outline" className="w-full gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10 sm:w-auto">
                    <X size={14} /> Reprovar Solicitação
                  </Button>
                  <Button type="button" onClick={confirmar} disabled={processando || !pilotoId || !formularioValido} className="w-full gap-2 bg-[#2bbf8a] text-[#03150e] hover:bg-[#45d5a5] sm:w-auto">
                    <Check size={14} /> {processando ? "Salvando..." : "Salvar e Aprovar Voo"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // === VISÃO DE LEITURA (APROVADO / ENCERRADO) ===
          <div className="space-y-6 mt-[13px] py-0">
            <div className="grid grid-cols-2 gap-3 mx-1 px-0 sm:grid-cols-4 lg:grid-cols-4">
              <Detalhe label="Cliente / sócio" valor={selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Não informado"} />
              <Detalhe label="Aeronave" valor={`${selecionada.matricula_registro || "A definir"} · ${selecionada.modelo || "—"}`} />
              <Detalhe label="Horário / UTC" valor={`Brasília ${horarioAtual.brasilia} · UTC ${horarioAtual.utc}`} />
              <Detalhe label="Período" valor={`${formatarData(selecionada.data_agendada)}${selecionada.data_fim && selecionada.data_fim !== selecionada.data_agendada ? ` até ${formatarData(selecionada.data_fim)}` : ""}`} />
              <Detalhe label="Passageiros" valor={String(selecionada.numero_passageiros || 1)} />
              <Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} />
              <Detalhe label="Status" valor={statusLabel(selecionada.status)} />
              <Detalhe label="Empréstimo" valor={emprestimoAtual} />
            </div>
            
            <div className="mt-[13px] rounded-xl border border-border bg-secondary/15 p-5">
              <p className="text-sm font-bold text-foreground">{selecionada.status === "encerrada" ? "Voo encerrado" : "Solicitação processada"}</p>
              {editandoAgendamento && <div className="mt-4 grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label className="text-[10px]">Origem</Label><Input value={dadosAgendamento.origem || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, origem: event.target.value.toUpperCase() }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Destino</Label><Input value={dadosAgendamento.destino || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, destino: event.target.value.toUpperCase() }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Data início</Label><Input type="date" value={dadosAgendamento.data_agendada || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, data_agendada: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Data fim</Label><Input type="date" value={dadosAgendamento.data_fim || ""} min={dadosAgendamento.data_agendada} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, data_fim: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Horário UTC</Label><Input type="time" value={typeof dadosAgendamento.horario_previsto_agendamento === "string" && dadosAgendamento.horario_previsto_agendamento.includes("T") ? horaParaCampo(dadosAgendamento.horario_previsto_agendamento) : dadosAgendamento.horario_previsto_agendamento || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, horario_previsto_agendamento: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Passageiros</Label><Input type="number" min={1} value={dadosAgendamento.numero_passageiros || 1} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, numero_passageiros: Number(event.target.value) }))} className="mt-1 h-9 text-xs" /></div>
                <div className="lg:col-span-2"><Label className="text-[10px]">Aeronave</Label><SearchableCombobox items={opcoes.aeronaves.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${item.modelo || ""}` }))} value={dadosAgendamento.aeronave_id || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, aeronave_id: valor }))} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave" emptyMessage="Nenhuma aeronave encontrada." icon={<Plane size={14} />} /></div>
                <div className="lg:col-span-2"><Label className="text-[10px]">PIC</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · ${item.canac}` }))} value={dadosAgendamento.piloto_id || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, piloto_id: valor }))} placeholder="Selecione o comandante" searchPlaceholder="Buscar tripulante" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button type="button" onClick={salvarEdicaoAgendamento} disabled={processando} className="gap-2 text-xs"><Check size={13} /> Salvar alterações</Button><Button type="button" variant="outline" onClick={() => setEditandoAgendamento(false)} className="text-xs">Cancelar</Button></div>
              </div>}
              
              {selecionada.status === "aprovada" && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Mensagem para o cliente</p>
                    <textarea readOnly value={`Olá ${selecionada.socio_nome || selecionada.cliente_razao_social || "Cotista"}, seu voo ${selecionada.numero_voo || ""} foi confirmado para o dia ${formatarData(selecionada.data_agendada)} com o tripulante ${tripulacao.find((tripulante) => tripulante.id === selecionada.piloto_id)?.nome_completo || "escalado"}.`} className="mt-3 min-h-24 w-full resize-none rounded-md border border-border bg-background/50 p-3 text-xs leading-relaxed" />
                  </div>
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-sky-500">Mensagem para o tripulante</p>
                    <textarea readOnly value={`Olá ${tripulacao.find((tripulante) => tripulante.id === selecionada.piloto_id)?.nome_completo || "tripulante escalado"}, você foi escalado para o voo - ${selecionada.numero_voo || ""}, no dia ${formatarData(selecionada.data_agendada)} na aeronave ${selecionada.matricula_registro || "a definir"} com o cotista ${selecionada.socio_nome || selecionada.cliente_razao_social || "não informado"} às ${horarioAtual.utc} UTC.`} className="mt-3 min-h-24 w-full resize-none rounded-md border border-border bg-background/50 p-3 text-xs leading-relaxed" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="-mt-[11px] -mb-[11px] border-t border-border bg-muted/20 p-4 sm:p-6"><h3 className="text-xs font-semibold">Ações do voo</h3>{acoes}</div>
      {selecionada.status === "encerrada" && <div className="border-t border-border p-5"><JornadaVoo item={selecionada} /></div>}
    </section>
  );
}

// O componente Detalhe ajustado para um visual mais limpo dentro do Grid
function Detalhe({ label, valor }: { label: string; valor: string }) { 
  return (
    <div className="flex flex-col justify-center rounded-lg border border-border/70 bg-secondary/25 p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold text-foreground break-words">{valor}</p>
    </div>
  ); 
}

type DadosDisponibilidade = { tripulante_id: string; data_inicio: string; data_fim: string; status: "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel"; observacoes: string };
function FormularioDisponibilidade({ dados, tripulacao, atualizando, aoCancelar, aoEnviar, aoAlterar }: { dados: DadosDisponibilidade; tripulacao: TripulanteAgendamento[]; atualizando: boolean; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void; aoAlterar: (campo: keyof DadosDisponibilidade, valor: string) => void }) { return <section className="overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5"><CabecalhoSecao icon={<Users size={15} />} title="Criar escala" detail="Selecione o tripulante, período e status da escala" action={<button type="button" onClick={aoCancelar} aria-label="Fechar formulário de disponibilidade" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6 xl:grid-cols-4"><div className="space-y-1.5 xl:col-span-2"><Label className="text-[10px]">Tripulante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={dados.tripulante_id} onChange={(valor) => aoAlterar("tripulante_id", valor)} placeholder="Selecione o piloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div><div className="space-y-1.5"><Label htmlFor="status-disponibilidade" className="text-[10px]">Status</Label><select id="status-disponibilidade" value={dados.status} onChange={(event) => aoAlterar("status", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="aviso">Sob aviso</option><option value="ferias">Férias</option><option value="folga">Folga</option><option value="atestado_medico">Atestado médico</option><option value="treinamento">Treinamento</option><option value="acompanhando_manutencao">Acompanhando manutenção</option><option value="disponivel">Disponível</option></select></div><DataAgendamento valor={dados.data_inicio} aoAlterar={(valor) => aoAlterar("data_inicio", valor)} /><DataAgendamento valor={dados.data_fim} aoAlterar={(valor) => aoAlterar("data_fim", valor)} /><div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-disponibilidade" className="text-[10px]">Observações</Label><Textarea id="observacoes-disponibilidade" value={dados.observacoes} onChange={(event) => aoAlterar("observacoes", event.target.value)} placeholder="Observações da coordenação" className="min-h-16 text-xs" /></div><div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="text-xs">{atualizando ? "Salvando..." : "Salvar status"}</Button></div></form></section>; }
