import "@/pages/agendamentos-screen.css";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, Clock3, History, Inbox, Plane, Plus, Radio, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  aprovarSolicitacaoVoo,
  atualizarAgendamento,
  buscarOpcoesAgendamento,
  buscarPainelAgendamento,
  buscarHorasVoadasOperacionais,
  buscarExtratoJornadaTripulante,
  criarAgendamento,
  definirDisponibilidadeTripulacao,
  reprovarSolicitacaoVoo,
  excluirAgendamento,
  finalizarAgendamento,
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type EscalaAgendamento,
  type JornadaVoo as JornadaRegistro,
  type TripulanteAgendamento,
  type NovoAgendamento,
  type OpcoesAgendamentoResponse,
  type PainelAgendamentoResponse,
  type SolicitacaoVooInterna,
  type HorasVoadasOperacionaisResponse,
} from "@/lib/colaborador-api";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import ChecklistPreVoo from "@/components/agendamento/ChecklistPreVoo";
import JornadaVoo from "@/components/agendamento/JornadaVoo";
import { conflitosDoTripulante, DIA, montarBlocos } from "@/lib/escala-tempo";
import {
  calcularProgressoChecklist,
  correspondeFiltroStatusAgendamento,
  obterAcoesAgendamento,
  statusPermiteAbrirJornada,
  statusPermiteChecklist,
} from "@/components/agendamento/agendamentoCardFlow";
import { AGENDAMENTO_ABRIR_SESSAO_KEY } from "@/lib/agendamento-navigation";
import { hojeBrasilia, operacaoNaData } from "@/lib/agendamentos-hoje";
import { consolidarHorasVoadas, formatarHorasVoadas } from "@/lib/horas-voadas-operacionais";
import { vincularPlanejamentos } from "@/components/agendamento/planejamentoAgendamento";
import OperacaoVooSelecionado from "@/components/agendamento/OperacaoVooSelecionado";
import { filtrarOperacoes, operacaoIniciada, rotuloOperacao, selecionarOperacao, statusOperacao, type FiltroOperacoes } from "@/components/agendamento/operacoesPainelModel";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";
import type { AbaAgendamento } from "@/components/agendamento/AgendamentoNavigation";
import { abaExibeLista, obterFiltroDaAba } from "@/components/agendamento/agendamentoNavigationModel";
import { Cronograma, AcoesDetalhe, type FiltroStatusCronograma, type VisaoCronograma } from "@/components/agendamento/AgendamentoCronograma";
import { CalendarioAgendamento, type VisaoEscala } from "@/components/agendamento/AgendamentoCalendario";
import EscalaCalendario from "@/components/agendamento/EscalaCalendario";
import { abaParaAgendamento, ordenarPorDataHorario, urgenciaVoo } from "@/components/agendamento/agendamentoFluxo";
import { DetalhesSolicitacao } from "@/components/agendamento/AgendamentoDetalhes";
import { FormularioAgendamento, FormularioDisponibilidade } from "@/components/agendamento/AgendamentoFormularios";
import PesoBalanceamentoFicha from "@/components/agendamento/PesoBalanceamentoFicha";
import { DetalhamentoHorasVoadas } from "@/components/agendamento/DetalhamentoHorasVoadas";

function normalizarAgendamentos(itens: SolicitacaoVooInterna[] | null | undefined) {
  const porId = new Map<string, SolicitacaoVooInterna>();
  for (const item of Array.isArray(itens) ? itens : []) {
    if (!item?.id) continue;
    const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    const normalizado = { ...item, status };
    const existente = porId.get(normalizado.id);
    if (!existente || String(normalizado.atualizado_em || normalizado.criado_em) >= String(existente.atualizado_em || existente.criado_em)) {
      porId.set(normalizado.id, normalizado);
    }
  }
  return [...porId.values()];
}

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
const hojeUtc = () => hojeBrasilia();

function horaUtcCurta(valor?: string | null) {
  const parte = String(valor || "").match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : "";
}

function formatarDataCompletaBr(data?: string | null, dataFim?: string | null) {
  const inicio = String(data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return "Sem data";
  const fim = String(dataFim || "").slice(0, 10);
  const dtInicio = new Date(`${inicio}T12:00:00Z`);
  const inicioFmt = dtInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/\./g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(fim) && fim > inicio) {
    const dtFim = new Date(`${fim}T12:00:00Z`);
    const iniC = dtInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    const fimC = dtFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    return `${iniC} a ${fimC}`;
  }
  return inicioFmt;
}

function horarioUtc(data: string, hora?: string) {
  if (!hora) return undefined;
  const instante = new Date(`${data}T${hora}:00Z`);
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : undefined;
}
function primeiroDiaMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}
function ultimoDiaMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0);
}
function inicioSemana(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() - ((data.getDay() + 6) % 7));
}
function diasCalendario(data: Date) {
  const inicio = primeiroDiaMes(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  const total = Math.ceil((deslocamento + ultimoDiaMes(data).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, indice) => new Date(data.getFullYear(), data.getMonth(), indice - deslocamento + 1));
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

export default function Agendamentos({ aoAbrirPlano }: { aoAbrirPlano?: (id: string) => void } = {}) {
  const { toast } = useToast();
  const { voos: voosAoVivo, carregando: carregandoAoVivo, erro: erroAoVivo, atualizadoEm: atualizadoAoVivo } = useVoosEmOperacao();
  const [aba, setAba] = useState<AbaAgendamento>("voos-hoje");
  const [mes, setMes] = useState(() => primeiroDiaMes(new Date()));
  const [semanaCalendario, setSemanaCalendario] = useState(() => inicioSemana(new Date()));
  const [visaoCalendario, setVisaoCalendario] = useState<VisaoEscala>("semanal");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesAgendamentoResponse>({ clientes: [], socios: [], aeronaves: [], vinculos: [] });
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoVooInterna | null>(null);
  const [dataOperacoes, setDataOperacoes] = useState(hojeBrasilia());
  const [vooHojeSelecionadoId, setVooHojeSelecionadoId] = useState<string | null>(null);
  const [abaAnterior, setAbaAnterior] = useState<AbaAgendamento | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroOperacoes, setFiltroOperacoes] = useState<FiltroOperacoes>("operacao");
  const [semVooSelecionado, setSemVooSelecionado] = useState(false);
  const [visaoAndamento, setVisaoAndamento] = useState<"monitoramento" | "hoje">("hoje");

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCronograma>("todos");
  const [visaoCronograma, setVisaoCronograma] = useState<VisaoCronograma>("grid");
  const [buscaCalendario, setBuscaCalendario] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [extrato, setExtrato] = useState<{ tripulante: TripulanteAgendamento; inicio: string; fim: string; carregando: boolean; erro: string | null; jornadas: JornadaRegistro[] } | null>(null);
  const filtroOperacoesAjustado = useRef(false);
  const [mostrarDisponibilidade, setMostrarDisponibilidade] = useState(false);
  const [dadosHoras, setDadosHoras] = useState<HorasVoadasOperacionaisResponse | null>(null);
  const [carregandoHoras, setCarregandoHoras] = useState(true);
  const [erroHoras, setErroHoras] = useState<string | null>(null);
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
  const [jornadaModo, setJornadaModo] = useState<"historico" | "atualizar">("atualizar");
  const [agendamentoParaExcluir, setAgendamentoParaExcluir] = useState<SolicitacaoVooInterna | null>(null);
  const [agendamentoParaFinalizar, setAgendamentoParaFinalizar] = useState<SolicitacaoVooInterna | null>(null);
  const [mensagensConfirmacaoId, setMensagensConfirmacaoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, passageiros: [""], piloto_id: "", copiloto_id: "", observacoes: "" });
  const [fichaAutoItem, setFichaAutoItem] = useState<SolicitacaoVooInterna | null>(null);
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({ tripulante_id: "", data_inicio: dataIso(new Date()), data_fim: dataIso(new Date()), status: "aviso" as "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel", observacoes: "" });
  const carregamentoAtual = useRef(0);
  const solicitacaoSelecionadaId = selecionada?.id;

  const notificarProgressoChecklist = useCallback((progresso: number) => {
    if (!solicitacaoSelecionadaId) return;
    setProgressoChecklistPorId((atual) => atual[solicitacaoSelecionadaId] === progresso ? atual : { ...atual, [solicitacaoSelecionadaId]: progresso });
  }, [solicitacaoSelecionadaId]);

  useEffect(() => {
    if (!solicitacaoSelecionadaId || !["cronograma", "pendentes", "aprovados", "historico"].includes(aba)) return;
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
      const agendamentosAtualizados = vincularPlanejamentos(normalizarAgendamentos(painelAtual?.agendamentos));
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
    if (aba !== "voos-hoje" || visaoAndamento !== "monitoramento") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [aba, visaoAndamento, carregar]);

  useEffect(() => {
    let ativo = true;
    setAerodromosCarregando(true);
    void buscarAerodromos()
      .then((resposta) => { if (ativo) setAerodromos(resposta.aerodromos || []); })
      .catch(() => { if (ativo) setAerodromos([]); })
      .finally(() => { if (ativo) setAerodromosCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const agendaCompleta = useMemo(() => normalizarAgendamentos(painel?.agendamentos), [painel?.agendamentos]);
  const agendamentos = useMemo(() => agendaCompleta.filter(item => !item.solicitacao_origem_id), [agendaCompleta]);
  const confirmados = useMemo(() => agendaCompleta.filter((item) => String(item.status || "").trim().toLowerCase() === "aprovada"), [agendaCompleta]);
  const encerrados = useMemo(() => agendamentos.filter((item) => ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())), [agendamentos]);
  const pendentes = useMemo(() => agendamentos.filter((item) => item.status === "pendente"), [agendamentos]);

  const referenciaHoras = hojeBrasilia();
  const anoHoras = Number(referenciaHoras.slice(0, 4));
  const mesHoras = Number(referenciaHoras.slice(5, 7));
  const carregarHorasOperacionais = useCallback(async () => {
    setCarregandoHoras(true);
    setErroHoras(null);
    try {
      const resposta = await buscarHorasVoadasOperacionais(anoHoras);
      setDadosHoras(resposta);
    } catch (erro) {
      setDadosHoras(null);
      setErroHoras(erro instanceof Error ? erro.message : "Falha ao carregar horas voadas.");
    } finally {
      setCarregandoHoras(false);
    }
  }, [anoHoras]);

  useEffect(() => { void carregarHorasOperacionais(); }, [carregarHorasOperacionais]);

  const resumoHorasVoadas = useMemo(
    () => consolidarHorasVoadas(dadosHoras, anoHoras, mesHoras),
    [dadosHoras, anoHoras, mesHoras],
  );
  const horasVoadasMes = carregandoHoras || erroHoras
    ? "—"
    : formatarHorasVoadas(resumoHorasVoadas.totalMes.minutos);

  const dias = useMemo(() => diasCalendario(mes), [mes]);
  const titulares = useMemo(() => itensTitulares(opcoes), [opcoes]);
  const nomesTripulantes = useMemo(() => new Map((painel?.tripulacao || []).map((tripulante) => [tripulante.id, tripulante.nome_completo])), [painel?.tripulacao]);
  const filtroCronograma = obterFiltroDaAba(aba, filtroStatus);

  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const hoje = hojeBrasilia();
    const ativos = (aba === "historico" ? agendamentos : agendaCompleta).filter((item) => aba === "cronograma"
      ? operacaoNaData(item, hoje)
      : filtroCronograma === "encerrada"
        ? ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())
        : correspondeFiltroStatusAgendamento(item.status, filtroCronograma));
    const encontrados = termo
      ? ativos.filter((item) => [item.id, item.data_agendada, item.cliente_razao_social, item.socio_nome, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo))
      : ativos;
    const ordenados = ordenarPorDataHorario(encontrados);
    return aba === "historico" ? ordenados.reverse() : ordenados;
  }, [agendamentos, agendaCompleta, aba, busca, filtroCronograma]);

  const selecionarAba = (proxima: AbaAgendamento) => {
    setMensagensConfirmacaoId(null);
    setRecusandoId(null);
    setAbaAnterior(null);
    setAba(proxima);
    setSelecionada(null);
    setChecklistAberto(false);
    setJornadaAberta(false);
    if (proxima === "cronograma") setFiltroStatus("todos");
    if (proxima === "pendentes") setFiltroStatus("pendente");
    if (proxima === "aprovados") setFiltroStatus("aprovada");
    if (proxima === "historico") setFiltroStatus("encerrada");
    if (proxima === "voos-hoje") setVooHojeSelecionadoId(null);
  };

  const abrirSolicitacao = useCallback((item: SolicitacaoVooInterna) => {
    if (aba !== "voos-hoje") setAbaAnterior(aba);
    if (item.solicitacao_origem_id) {
      const original = agendamentos.find(voo => voo.id === item.solicitacao_origem_id);
      if (!original) return;
      if (["encerrada", "concluida"].includes(original.status)) {
        setSelecionada(original);
        setAba("historico");
      } else {
        const planejada = item.status === "aprovada";
        setSelecionada(planejada ? item : original);
        setAba("voos-hoje");
        setVisaoAndamento("hoje");
        setFiltroOperacoes(planejada ? "confirmados" : "operacao");
        setDataOperacoes(item.data_agendada);
        setVooHojeSelecionadoId(planejada ? item.id : original.id);
        setSemVooSelecionado(false);
      }
      return;
    }
    setMensagensConfirmacaoId(null);
    if (!["cronograma", "pendentes", "aprovados", "historico", "voos-hoje"].includes(aba)) {
      const destino = abaParaAgendamento(item.status);
      setAba(destino);
      setFiltroStatus(destino === "pendentes" ? "pendente" : destino === "historico" ? "encerrada" : "aprovada");
    }
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  }, [aba, agendamentos]);

  const confirmarSolicitacao = (item: SolicitacaoVooInterna) => {
    setRecusandoId(null);
    abrirSolicitacao(item);
    setTimeout(() => document.getElementById("confirmacao-voo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const recusarSolicitacao = (item: SolicitacaoVooInterna) => {
    setRecusandoId(item.id);
    abrirSolicitacao(item);
    setTimeout(() => document.getElementById("confirmacao-voo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const abrirJornada = useCallback((item: SolicitacaoVooInterna, modo: "historico" | "atualizar" = "atualizar") => {
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaModo(modo);
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
    if (item.solicitacao_origem_id) {
      abrirSolicitacao(item);
      return;
    }
    const status = String(item.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (["encerrada", "concluida"].includes(status)) {
      setAba("historico");
      setSelecionada(item);
      return;
    }
    if (!operacaoIniciada(item) && !operacaoNaData(item, hojeBrasilia())) {
      setAba("aprovados");
      setSelecionada(item);
      return;
    }
    setAba("voos-hoje");
    setVisaoAndamento("hoje");
    setFiltroOperacoes(operacaoIniciada(item) ? "operacao" : "confirmados");
    setDataOperacoes(hojeBrasilia());
    setVooHojeSelecionadoId(item.id);
    setSemVooSelecionado(false);
  }, [abrirSolicitacao, carregando, painel?.agendamentos]);

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
    if (!selecionada || !pilotoId) {
      toast({ title: "Piloto comandante obrigatório", description: "Selecione o comandante para gerar o número do voo.", variant: "destructive" });
      return;
    }
    avisarConflitoComandante(pilotoId, {
      id: selecionada.id,
      data_agendada: selecionada.data_agendada,
      data_fim: selecionada.data_fim || selecionada.data_agendada,
      numero_voo: selecionada.numero_voo ?? null,
      origem: selecionada.origem,
      destino: selecionada.destino,
      horario_previsto_agendamento: selecionada.horario_previsto_agendamento,
      piloto_id: pilotoId,
      piloto_nome: null,
      copiloto_id: copilotoId || null,
      copiloto_nome: null,
      status: "aprovada",
    });
    setProcessando(true);
    try {
      const resposta = await aprovarSolicitacaoVoo(selecionada.id, pilotoId, copilotoId || undefined, alteracoes);
      toast({ title: "Solicitação aprovada", description: `Número de voo gerado: ${resposta.numero_voo}.` });
      setMensagensConfirmacaoId(selecionada.id);
      setSelecionada((atual) => atual ? { ...atual, status: "aprovada", numero_voo: resposta.numero_voo } : atual);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível aprovar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const reprovar = async () => {
    if (!selecionada || !motivo.trim()) {
      toast({ title: "Motivo obrigatório", description: "Informe o motivo da reprovação.", variant: "destructive" });
      return;
    }
    setProcessando(true);
    try {
      await reprovarSolicitacaoVoo(selecionada.id, motivo.trim());
      toast({ title: "Solicitação reprovada", description: "O motivo foi registrado no histórico." });
      setSelecionada(null);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível reprovar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const atualizarNovo = <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => setNovo((atual) => ({ ...atual, [campo]: valor }));

  const criarNovo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantidadePassageiros = Number(novo.numero_passageiros);
    if (!Number.isInteger(quantidadePassageiros) || quantidadePassageiros < 1 || quantidadePassageiros > 50) {
      toast({ title: "Quantidade de passageiros inválida", description: "Informe um número inteiro entre 1 e 50.", variant: "destructive" });
      return;
    }
    const passageiros = Array.from({ length: quantidadePassageiros }, (_, indice) => (novo.passageiros?.[indice] || "").trim());
    const passageiroInvalido = passageiros.findIndex((nome) => nome.length < 3 || nome.length > 120 || nome.split(/\s+/).filter(Boolean).length < 2);
    if (passageiroInvalido !== -1) {
      toast({ title: "Nome completo obrigatório", description: `Informe nome e sobrenome do passageiro ${passageiroInvalido + 1}.`, variant: "destructive" });
      return;
    }
    if (!novo.cliente_id && !novo.socio_id) {
      toast({ title: "Cliente ou sócio obrigatório", description: "Selecione o titular do agendamento.", variant: "destructive" });
      return;
    }
    const clienteTitularId = novo.cliente_id || opcoes.socios.find((socio) => socio.id === novo.socio_id)?.cliente_id;
    const aeronaveDoTitular = Boolean(
      novo.aeronave_id &&
      (novo.cliente_id || novo.socio_id) &&
      opcoes.vinculos.some((vinculo) => vinculo.aeronave_id === novo.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (novo.socio_id && vinculo.socio_id === novo.socio_id)))
    );
    const temCedente = Boolean(novo.cliente_emprestimo_id || novo.socio_emprestimo_id);
    if (novo.aeronave_id && !aeronaveDoTitular && (!novo.voo_emprestimo_confirmado || !temCedente)) {
      toast({ title: "Informe o empréstimo da aeronave", description: "Confirme que o voo é emprestado e selecione o cliente ou sócio cedente.", variant: "destructive" });
      return;
    }
    if (!novo.aeronave_id) {
      toast({ title: "Aeronave obrigatória", description: "Selecione a aeronave do voo.", variant: "destructive" });
      return;
    }
    if (!novo.origem || !novo.destino) {
      toast({ title: "Informe origem e destino", description: "Selecione os dois aeródromos da rota.", variant: "destructive" });
      return;
    }
    if (novo.origem === novo.destino) {
      toast({ title: "Origem e destino iguais", description: "Escolha aeródromos diferentes para a rota.", variant: "destructive" });
      return;
    }
    if (!novo.data_agendada || !novo.data_fim || novo.data_fim < novo.data_agendada) {
      toast({ title: "Período inválido", description: "A data final não pode ser anterior à data de saída.", variant: "destructive" });
      return;
    }
    if (!novo.horario_previsto_agendamento) {
      toast({ title: "Horário previsto obrigatório", description: "Informe o horário previsto de saída (UTC).", variant: "destructive" });
      return;
    }
    const horarioPrevisto = horarioUtc(novo.data_agendada, novo.horario_previsto_agendamento);
    if (novo.piloto_id) {
      avisarConflitoComandante(novo.piloto_id, {
        id: "novo",
        data_agendada: novo.data_agendada,
        data_fim: novo.data_fim,
        numero_voo: null,
        origem: novo.origem,
        destino: novo.destino,
        horario_previsto_agendamento: horarioPrevisto ?? null,
        piloto_id: novo.piloto_id,
        piloto_nome: null,
        copiloto_id: novo.copiloto_id || null,
        copiloto_nome: null,
        status: "aprovada",
      });
    }
    setProcessando(true);
    try {
      const resposta = await criarAgendamento({
        ...novo,
        passageiros,
        horario_previsto_agendamento: horarioPrevisto,
        piloto_id: novo.piloto_id || undefined,
        copiloto_id: novo.copiloto_id || undefined,
      });
      const idCriado = resposta.id || resposta.solicitacao_id;
      if (!idCriado) throw new Error("O servidor não retornou o ID da solicitação; não foi possível abrir a ficha.");
      toast({ title: "Agendamento criado", description: resposta.numero_voo ? `Número de voo: ${resposta.numero_voo}.` : "A solicitação ficará pendente de confirmação." });
      const aeronaveCriada = opcoes.aeronaves.find((aeronave) => aeronave.id === novo.aeronave_id);
      const clienteCriado = opcoes.clientes.find((cliente) => cliente.id === novo.cliente_id);
      const socioCriado = opcoes.socios.find((socio) => socio.id === novo.socio_id);
      setFichaAutoItem({
        id: idCriado,
        cliente_id: novo.cliente_id || null,
        socio_id: novo.socio_id || null,
        aeronave_id: novo.aeronave_id || null,
        origem: novo.origem,
        destino: novo.destino,
        data_agendada: novo.data_agendada,
        data_fim: novo.data_fim,
        horario_previsto_agendamento: horarioPrevisto || null,
        dias_duracao: Math.max(1, Math.floor((Date.parse(`${novo.data_fim}T00:00:00Z`) - Date.parse(`${novo.data_agendada}T00:00:00Z`)) / 86400000) + 1),
        numero_passageiros: quantidadePassageiros,
        passageiros,
        voo_emprestado: novo.voo_emprestimo_confirmado ? "sim" : "nao",
        status: resposta.status,
        motivo_rejeicao: null,
        numero_voo: resposta.numero_voo,
        criado_em: new Date().toISOString(),
        atualizado_em: null,
        cliente_razao_social: clienteCriado?.nome || null,
        socio_nome: socioCriado?.nome || null,
        codigo_cliente: clienteCriado?.codigo_cliente || null,
        matricula_registro: aeronaveCriada?.matricula_registro || null,
        modelo: aeronaveCriada?.modelo || null,
        observacoes: novo.observacoes || null,
        piloto_id: novo.piloto_id || null,
        copiloto_id: novo.copiloto_id || null,
      });
      setMostrarNovo(false);
      selecionarArea(resposta.status === "pendente" ? "pendentes" : "calendario");
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, passageiros: [""], piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const finalizar = (item: SolicitacaoVooInterna) => {
    if (obterAcoesAgendamento(item, calcularProgressoChecklist(item)).historico) {
      toast({ title: "Operação já concluída", description: "Agendamentos encerrados são somente leitura.", variant: "destructive" });
      return;
    }
    setAgendamentoParaFinalizar(item);
  };

  const executarFinalizacao = async () => {
    const item = agendamentoParaFinalizar;
    if (!item || processando) return;
    setProcessando(true);
    try {
      await finalizarAgendamento(item.id);
      if (selecionada?.id === item.id) setSelecionada(null);
      setAgendamentoParaFinalizar(null);
      toast({ title: 'Agendamento finalizado', description: 'A operação foi concluída e saiu do cronograma.' });
      await carregar(true);
    } catch (error) {
      toast({ title: 'Não foi possível finalizar', description: error instanceof Error ? error.message : 'Encerre todas as jornadas antes de finalizar.', variant: 'destructive' });
    } finally {
      setProcessando(false);
    }
  };

  const excluir = (item: SolicitacaoVooInterna) => setAgendamentoParaExcluir(item);

  const confirmarExclusao = async () => {
    if (!agendamentoParaExcluir || excluindo) return;
    setExcluindo(true);
    try {
      await excluirAgendamento(agendamentoParaExcluir.id);
      if (selecionada?.id === agendamentoParaExcluir.id) setSelecionada(null);
      setAgendamentoParaExcluir(null);
      toast({ title: "Solicitação removida", description: "Ela saiu da lista; os registros operacionais vinculados foram preservados." });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setExcluindo(false);
    }
  };

  const atualizarSelecionada = async (alvo: SolicitacaoVooInterna, dados: AtualizacaoAgendamento): Promise<boolean> => {
    if (!alvo?.id) return false;
    const dataAnterior = String(alvo.data_agendada || "").slice(0, 10);
    if (dados.piloto_id && dados.piloto_id !== alvo.piloto_id) {
      avisarConflitoComandante(dados.piloto_id, {
        id: alvo.id,
        data_agendada: dados.data_agendada || alvo.data_agendada,
        data_fim: dados.data_fim || alvo.data_fim || alvo.data_agendada,
        numero_voo: alvo.numero_voo ?? null,
        origem: dados.origem || alvo.origem,
        destino: dados.destino || alvo.destino,
        horario_previsto_agendamento: dados.horario_previsto_agendamento ?? alvo.horario_previsto_agendamento ?? null,
        piloto_id: dados.piloto_id,
        piloto_nome: null,
        copiloto_id: dados.copiloto_id || null,
        copiloto_nome: null,
        status: "aprovada",
      });
    }
    setProcessando(true);
    try {
      const resposta = await atualizarAgendamento(alvo.id, dados);
      const atualizadoEm = new Date().toISOString();
      const patchConfirmado: Partial<SolicitacaoVooInterna> = {
        ...dados,
        ...(resposta.data_agendada ? { data_agendada: resposta.data_agendada } : {}),
        ...(resposta.data_fim ? { data_fim: resposta.data_fim } : {}),
        ...(resposta.dias_duracao != null ? { dias_duracao: resposta.dias_duracao } : {}),
        ...(resposta.horario_previsto_agendamento !== undefined ? { horario_previsto_agendamento: resposta.horario_previsto_agendamento } : {}),
        ...(resposta.numero_passageiros != null ? { numero_passageiros: resposta.numero_passageiros } : {}),
        ...(resposta.aeronave_id !== undefined ? { aeronave_id: resposta.aeronave_id } : {}),
        ...(resposta.piloto_id !== undefined ? { piloto_id: resposta.piloto_id } : {}),
        ...(resposta.copiloto_id !== undefined ? { copiloto_id: resposta.copiloto_id } : {}),
        atualizado_em: atualizadoEm,
      };
      setSelecionada((atual) => (atual?.id === alvo.id ? { ...atual, ...patchConfirmado } : atual));
      setPainel((atual) =>
        atual
          ? {
              ...atual,
              agendamentos: atual.agendamentos.map((item) => (item.id === alvo.id ? { ...item, ...patchConfirmado } : item)),
            }
          : atual,
      );
      const novaData = String(resposta.data_agendada || dados.data_agendada || "").slice(0, 10);
      if (aba === "voos-hoje" && filtroOperacoes === "confirmados" && novaData && novaData !== dataAnterior) {
        setDataOperacoes(novaData);
        setVooHojeSelecionadoId(alvo.id);
      }
      toast({ title: "Agendamento atualizado", description: "As alterações foram salvas e disponibilizadas para toda a equipe." });
      await carregar(true);
      return true;
    } catch (error) {
      toast({ title: "Não foi possível atualizar", description: error instanceof Error ? error.message : "Confira os dados e tente novamente.", variant: "destructive" });
      return false;
    } finally {
      setProcessando(false);
    }
  };

  const salvarDisponibilidade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dataInicio = novaDisponibilidade.data_inicio.trim();
    const dataFim = (novaDisponibilidade.data_fim || dataInicio).trim();
    const tripulante = painel?.tripulacao.find((item) => item.id === novaDisponibilidade.tripulante_id);
    if (!tripulante) {
      toast({ title: "Tripulante obrigatório", description: "Selecione um tripulante ativo da lista.", variant: "destructive" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim) || dataFim < dataInicio) {
      toast({ title: "Período inválido", description: "Informe datas válidas e com o fim igual ou posterior ao início.", variant: "destructive" });
      return;
    }
    const blocosVoo = montarBlocos(painel?.escala || [], [], painel?.tripulacao || []);
    const voosNoPeriodo = conflitosDoTripulante(
      blocosVoo,
      tripulante.id,
      Date.parse(`${dataInicio}T00:00:00Z`),
      Date.parse(`${dataFim}T00:00:00Z`) + DIA
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
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const abrirNovoAgendamento = (data?: string) => {
    setNovo((atual) => ({ ...atual, ...(data ? { data_agendada: data, data_fim: data } : {}) }));
    setMostrarNovo(true);
  };

  const abrirExtrato = (tripulante: TripulanteAgendamento, inicio: string, fim: string) => {
    setExtrato({ tripulante, inicio, fim, carregando: true, erro: null, jornadas: [] });
    void buscarExtratoJornadaTripulante(tripulante.id, inicio, fim)
      .then((resposta) => setExtrato((atual) => atual && atual.tripulante.id === tripulante.id ? { ...atual, carregando: false, jornadas: resposta.jornadas || [] } : atual))
      .catch((falha) => setExtrato((atual) => atual ? { ...atual, carregando: false, erro: falha instanceof Error ? falha.message : "Não foi possível carregar o extrato." } : atual));
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

  const abaLista = abaExibeLista(aba);
  const tituloAba: Record<AbaAgendamento, string> = {
    cronograma: "Voos de hoje",
    pendentes: "Solicitações pendentes",
    aprovados: "Aprovados e escalados",
    calendario: "Agenda de voos",
    escala: "Escala da tripulação",
    "voos-hoje": "Operação de voo",
    historico: "Histórico de voos",
    "horas-voadas": "Horas Voadas",
  };
  const descricaoAba: Record<AbaAgendamento, string> = {
    cronograma: "Operações previstas ou realizadas no dia de hoje, no horário de Brasília.",
    pendentes: "Pedidos de clientes aguardando análise e confirmação de escala.",
    aprovados: "Voos confirmados com tripulação definida e plano de voo.",
    calendario: "Visualização por período (hoje, amanhã, semana) e calendário mensal.",
    escala: "Disponibilidade, escalas e limites RBAC 117 da tripulação.",
    "voos-hoje": "Selecione um voo na lista para acompanhar checklist, horários em UTC e telemetria.",
    historico: "Operações concluídas e registros de voo para consulta.",
    "horas-voadas": "Tempo de voo registrado no diário de bordo, por aeronave, mês, dia e ano.",
  };

  const hojeOperacoes = dataOperacoes;
  const voosEmAndamento = ordenarPorAeronave(filtrarOperacoes(agendamentos, "operacao", hojeOperacoes));
  const voosConfirmadosHoje = ordenarPorDataHorario(filtrarOperacoes(agendaCompleta, "confirmados", hojeOperacoes));

  useEffect(() => {
    if (carregando || !painel || filtroOperacoesAjustado.current) return;
    filtroOperacoesAjustado.current = true;
    if (voosEmAndamento.length === 0 && voosConfirmadosHoje.length > 0) setFiltroOperacoes("confirmados");
  }, [carregando, painel, voosEmAndamento.length, voosConfirmadosHoje.length]);

  const baseLateral = visaoAndamento === "monitoramento" || filtroOperacoes === "operacao" ? voosEmAndamento : voosConfirmadosHoje;
  const voosLateral = baseLateral.filter((voo) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const tripulantes = [voo.piloto_nome || nomesTripulantes.get(voo.piloto_id || ""), voo.copiloto_nome || nomesTripulantes.get(voo.copiloto_id || "")];
    const texto = [voo.numero_voo, voo.matricula_registro, voo.origem, voo.destino, voo.cliente_razao_social, voo.socio_nome, ...tripulantes].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return !termo || texto.includes(termo);
  });
  const vooOperacional = semVooSelecionado ? null : selecionarOperacao(voosLateral, vooHojeSelecionadoId);
  const operacaoSelecionada = vooOperacional?.solicitacao_origem_id ? agendamentos.find(item => item.id === vooOperacional.solicitacao_origem_id) || null : vooOperacional;
  const selecionarVooLateral = (item: SolicitacaoVooInterna) => {
    setVooHojeSelecionadoId(item.id);
    setSemVooSelecionado(false);
    abrirSolicitacao(item);
  };

  useEffect(() => {
    if (aba !== "voos-hoje") return;
    setSelecionada(vooOperacional);
  }, [aba, vooOperacional]);

  const idVooOperacional = vooOperacional?.id ?? null;
  useEffect(() => {
    if (aba !== "voos-hoje") return;
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(vooOperacional?.piloto_id || "");
    setCopilotoId(vooOperacional?.copiloto_id || "");
    setMotivo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, idVooOperacional]);

  const tabsPainel: { id: AbaAgendamento; label: string; icon: typeof Plane; badge?: number }[] = [
    { id: "voos-hoje", label: "Operação", icon: Plane },
    { id: "calendario", label: "Agenda", icon: CalendarDays, badge: pendentes.length },
    { id: "escala", label: "Escala", icon: Users },
    { id: "historico", label: "Histórico", icon: History },
    { id: "horas-voadas", label: "Horas voadas", icon: Clock3 },
  ];
  const selecionarArea = (proxima: AbaAgendamento) => {
    setMostrarNovo(false);
    selecionarAba(proxima);
  };
  const voltarTelaAnterior = () => {
    if (aba === "voos-hoje") {
      setAbaAnterior(null);
      setFiltroOperacoes("operacao");
      setSemVooSelecionado(true);
      setVooHojeSelecionadoId(null);
      setSelecionada(null);
      setChecklistAberto(false);
      setJornadaAberta(false);
      return;
    }
    if (abaAnterior && abaAnterior !== aba) {
      selecionarArea(abaAnterior);
      return;
    }
    setSelecionada(null);
    setChecklistAberto(false);
    setJornadaAberta(false);
  };
  const dentroDoAgendamento = aba === "voos-hoje" ? vooHojeSelecionadoId !== null : Boolean(abaLista && selecionada);
  const renderizarDetalhes = (item: SolicitacaoVooInterna, somenteLeitura = false, incorporado = false) => (
    <DetalhesSolicitacao
      key={item.id}
      incorporado={incorporado}
      somenteLeitura={somenteLeitura}
      mostrarMensagensConfirmacao={mensagensConfirmacaoId === item.id}
      acoes={incorporado ? null : <AcoesDetalhe item={item} aoChecklist={(voo) => { setSelecionada(voo); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={(voo) => abrirJornada(voo, ["encerrada", "concluida"].includes(voo.status) ? "historico" : "atualizar")} aoFinalizar={(voo) => void finalizar(voo)} progressoChecklist={progressoChecklistPorId[item.id] ?? calcularProgressoChecklist(item)} checklistAberto={checklistAberto} />}
      selecionada={item}
      escala={painel?.escala || []}
      disponibilidades={painel?.disponibilidades || []}
      iniciarRecusa={recusandoId === item.id}
      opcoes={opcoes}
      tripulacao={painel?.tripulacao || []}
      pilotoId={pilotoId}
      copilotoId={copilotoId}
      motivo={motivo}
      processando={processando}
      aoAtualizar={(dados) => atualizarSelecionada(item, dados)}
      aoFechar={() => { setSelecionada(null); setChecklistAberto(false); }}
      aoPiloto={setPilotoId}
      aoCopiloto={setCopilotoId}
      aoMotivo={setMotivo}
      aoAprovar={(alteracoes) => void aprovar(alteracoes)}
      aoReprovar={() => void reprovar()}
    />
  );

  const vooDestaque = vooOperacional || voosEmAndamento[0] || voosConfirmadosHoje[0] || ordenarPorDataHorario(confirmados)[0] || null;
  const comandanteDestaque = vooDestaque
    ? vooDestaque.piloto_nome || nomesTripulantes.get(vooDestaque.piloto_id || "") || "A definir"
    : "—";
  const statusDestaque = vooDestaque ? rotuloOperacao(statusOperacao(vooDestaque.status)) : "Sem voos";
  const urgentesPendentes = pendentes.filter((item) => urgenciaVoo(item.data_agendada, hojeBrasilia()).urgente).length;

  return (
    <div className="sb-ops">
      {/* ───────── CABEÇALHO DE COMANDO EM NAVY (ESTILO WIREFRAME) ───────── */}
      <header className="sb-command-header">
        {/* Linha 1: Pílulas de navegação + Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <nav className="sb-top-nav" aria-label="Áreas de operações">
            {tabsPainel.map(({ id, label, icon: Icon, badge }) => {
              const ativo = aba === id || (id === "calendario" && ["cronograma", "pendentes", "aprovados"].includes(aba));
              return (
                <button
                  type="button"
                  key={id}
                  aria-current={ativo ? "page" : undefined}
                  className={ativo ? "active" : ""}
                  onClick={() => selecionarArea(id)}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                  {id === "horas-voadas" && <strong className="font-mono text-[11px] opacity-80">{horasVoadasMes}</strong>}
                  {badge ? <strong className="sb-badge" aria-label={`${badge} pendentes`}>{badge}</strong> : null}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {dentroDoAgendamento && aba !== "voos-hoje" && (
              <button type="button" className="sb-cta-ghost" onClick={voltarTelaAnterior}>
                <ChevronLeft size={14} />
                Voltar
              </button>
            )}
            <button type="button" className="sb-cta-gold" onClick={() => abrirNovoAgendamento()}>
              <Plus size={14} strokeWidth={2.6} />
              Novo agendamento
            </button>
          </div>
        </div>

        {/* Linha 2: Título limpo (sem inputs espremidos) */}
        <div className="mt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#efbd45]">
            <Plane size={11} />
            Coordenação operacional{atualizando ? " · sincronizando..." : ""}
          </span>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {tituloAba[aba]}
          </h1>
        </div>

        {/* Linha 3: Bento Deck compacto (exibido na visão Operação) */}
        {aba === "voos-hoje" && (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="sb-bento-card flex flex-col justify-between p-3.5 sm:p-4 lg:col-span-8">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => {
                    selecionarArea("voos-hoje");
                    setFiltroOperacoes("operacao");
                  }}
                  className={`sb-kpi-item${aba === "voos-hoje" && filtroOperacoes === "operacao" ? " active" : ""}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Em operação
                  </span>
                  <strong className="mt-1 text-2xl font-extrabold leading-none tabular-nums">
                    {String(voosEmAndamento.length).padStart(2, "0")}
                  </strong>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Ativos agora</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    selecionarArea("voos-hoje");
                    setFiltroOperacoes("confirmados");
                    setDataOperacoes(hojeBrasilia());
                  }}
                  className={`sb-kpi-item${aba === "voos-hoje" && filtroOperacoes === "confirmados" ? " active" : ""}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Confirmados
                  </span>
                  <strong className="mt-1 text-2xl font-extrabold leading-none tabular-nums">
                    {String(voosConfirmadosHoje.length).padStart(2, "0")}
                  </strong>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {dataOperacoes === hojeBrasilia() ? "Previstos hoje" : `Em ${dataOperacoes.slice(5).split("-").reverse().join("/")}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => selecionarArea("pendentes")}
                  className="sb-kpi-item"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Pendentes
                  </span>
                  <strong className="mt-1 text-2xl font-extrabold leading-none tabular-nums">
                    {String(pendentes.length).padStart(2, "0")}
                  </strong>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {pendentes.length > 0 ? "Para analisar" : "Fila limpa"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => selecionarArea("horas-voadas")}
                  className="sb-kpi-item"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Horas no mês
                  </span>
                  <strong className="mt-1 text-xl font-extrabold leading-none tabular-nums sm:text-2xl">
                    {horasVoadasMes}
                  </strong>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Diário de bordo</span>
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs dark:border-slate-700/70">
                {pendentes.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 text-amber-800 dark:text-amber-300">
                    <Inbox size={14} className="shrink-0" />
                    <span className="font-semibold">
                      {pendentes.length} {pendentes.length === 1 ? "solicitação pendente" : "solicitações pendentes"}
                      {urgentesPendentes > 0 ? ` · ${urgentesPendentes} urgente${urgentesPendentes === 1 ? "" : "s"}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => selecionarArea("pendentes")}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-amber-700"
                    >
                      Analisar
                      <ArrowRight size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">
                      {confirmados.length} {confirmados.length === 1 ? "voo confirmado" : "voos confirmados"} · {encerrados.length} encerrados
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => selecionarArea("calendario")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0969a8] hover:underline dark:text-sky-400"
                >
                  <CalendarDays size={13} />
                  Agenda completa
                </button>
              </div>
            </div>

            <div className="sb-bento-spotlight flex flex-col justify-between p-3.5 sm:p-4 lg:col-span-4">
              {vooDestaque ? (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        {operacaoIniciada(vooDestaque) ? "Em operação agora" : "Próximo voo"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0969a8] dark:text-sky-400">
                        <CalendarDays size={12} />
                        {formatarDataCompletaBr(vooDestaque.data_agendada, vooDestaque.data_fim)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-lg font-extrabold tracking-tight tabular-nums">
                          {vooDestaque.numero_voo || "Sem número"}
                        </h2>
                        <span className="font-mono text-xs font-bold text-[#0969a8] dark:text-sky-400">
                          {vooDestaque.matricula_registro || "—"}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                        {vooDestaque.origem || "—"} → {vooDestaque.destino || "—"}
                        {horaUtcCurta(vooDestaque.horario_previsto_agendamento) ? ` · ${horaUtcCurta(vooDestaque.horario_previsto_agendamento)}Z` : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-100/90 px-2.5 py-1.5 text-[11px] dark:bg-slate-800/70">
                      <span className="truncate font-semibold" title={comandanteDestaque}>
                        CMD: {comandanteDestaque}
                      </span>
                      <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300">{statusDestaque}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      selecionarArea("voos-hoje");
                      setFiltroOperacoes(operacaoIniciada(vooDestaque) ? "operacao" : "confirmados");
                      if (!operacaoIniciada(vooDestaque) && vooDestaque.data_agendada) {
                        setDataOperacoes(String(vooDestaque.data_agendada).slice(0, 10));
                      }
                      setVooHojeSelecionadoId(vooDestaque.id);
                      setSemVooSelecionado(false);
                    }}
                    className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#10263a] px-3 text-xs font-bold text-white transition-colors hover:bg-[#163653] dark:bg-[#efbd45] dark:text-[#10263a] dark:hover:bg-[#f5ca5c]"
                  >
                    <Radio size={13} />
                    Focar no painel
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      Próximo voo
                    </span>
                    <p className="mt-1 text-xs font-bold">Nenhum voo ativo ou confirmado</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirNovoAgendamento()}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#10263a] px-3 text-xs font-bold text-white hover:bg-[#163653] dark:bg-[#efbd45] dark:text-[#10263a]"
                  >
                    <Plus size={13} />
                    Agendar voo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ───────── WORKSPACE PRINCIPAL ───────── */}
      <section className="sb-workspace-shell">
        {erro && (
          <div className="sb-error">
            {erro}
            <button type="button" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </div>
        )}

        <main className="sb-main">
          {/* Sub-abas da Agenda */}
          {["calendario", "cronograma", "pendentes", "aprovados"].includes(aba) && !selecionada && (
            <div className="sb-subtabs" role="navigation" aria-label="Visões da agenda">
              <button type="button" onClick={() => selecionarAba("calendario")} className={aba === "calendario" || aba === "cronograma" ? "active" : ""}>
                Calendário
              </button>
              <button type="button" onClick={() => selecionarAba("pendentes")} className={aba === "pendentes" ? "active" : ""}>
                <span>Solicitações</span>
                {pendentes.length > 0 && <strong className="sb-badge">{pendentes.length}</strong>}
              </button>
              <button type="button" onClick={() => selecionarAba("aprovados")} className={aba === "aprovados" ? "active" : ""}>
                Confirmados ({confirmados.length})
              </button>
            </div>
          )}

          {/* Visão Operação: Filtros dedicados + Container 100% largura com abas centralizadas */}
          {aba === "voos-hoje" && (
            <div className="space-y-3">
              {/* Barra dedicada de busca e data (fora do container claro, sem estourar bordas) */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <label className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-foreground shadow-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary sm:max-w-xs">
                  <Search size={14} className="shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar voo, matrícula, rota ou piloto..."
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  {busca && (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => setBusca("")}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>

                {visaoAndamento === "hoje" && filtroOperacoes === "confirmados" && (
                  <div className="flex items-center gap-2">
                    <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-foreground shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                      <CalendarDays size={14} className="shrink-0 text-primary" />
                      <input
                        type="date"
                        aria-label="Data dos voos confirmados"
                        value={dataOperacoes}
                        onChange={(event) => {
                          setDataOperacoes(event.target.value);
                          setVooHojeSelecionadoId(null);
                          setSemVooSelecionado(false);
                        }}
                        className="h-full bg-transparent font-mono text-xs font-semibold text-foreground focus:outline-none"
                      />
                    </label>
                    {dataOperacoes !== hojeBrasilia() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl px-3 text-xs font-semibold"
                        onClick={() => {
                          setDataOperacoes(hojeBrasilia());
                          setVooHojeSelecionadoId(null);
                        }}
                      >
                        Hoje
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Container claro unificado ocupando 100% da largura */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* Encaixe superior com abas centralizadas (igual ao wireframe) */}
                <div className="flex items-center justify-center border-b border-border bg-secondary/35 px-3 py-2.5">
                  <div
                    className="inline-flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border/80 bg-background/80 p-1 shadow-xs"
                    role="group"
                    aria-label="Filtrar voos da operação"
                  >
                    {(
                      [
                        ["operacao", "Em operação", voosEmAndamento.length],
                        ["confirmados", "Confirmados", voosConfirmadosHoje.length],
                      ] as const
                    ).map(([valor, rotulo, quantidade]) => {
                      const ativo = filtroOperacoes === valor;
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => {
                            setFiltroOperacoes(valor);
                            setVooHojeSelecionadoId(null);
                            setSemVooSelecionado(false);
                          }}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition-all ${
                            ativo
                              ? "bg-[#10263a] text-white shadow-sm dark:bg-primary dark:text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <span>{rotulo}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                              ativo ? "bg-white/20 text-white" : "bg-secondary text-foreground"
                            }`}
                          >
                            {quantidade}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => selecionarArea("pendentes")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold whitespace-nowrap text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                    >
                      <span>Pendentes</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground tabular-nums">
                        {pendentes.length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Seletor horizontal compacto: aparece SOMENTE se houver mais de 1 voo */}
                {voosLateral.length > 1 && (
                  <div
                    className="flex items-center gap-2 overflow-x-auto border-b border-border bg-secondary/15 px-4 py-2.5"
                    role="listbox"
                    aria-label="Alternar entre os voos disponíveis"
                  >
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Voos ({voosLateral.length}):
                    </span>
                    <div className="flex items-center gap-2">
                      {voosLateral.map((voo) => {
                        const selecionado = vooOperacional?.id === voo.id;
                        const status = statusOperacao(voo.status);
                        const rotulo = voo.solicitacao_origem_id
                          ? "Confirmado"
                          : operacaoIniciada(voo) && status === "aprovada"
                            ? "Em operação"
                            : rotuloOperacao(status);
                        const horaPrevista = horaUtcCurta(voo.horario_previsto_agendamento);

                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={selecionado}
                            key={voo.id}
                            onClick={() => selecionarVooLateral(voo)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition-all ${
                              selecionado
                                ? "border-[#10263a] bg-[#10263a] text-white shadow-sm dark:border-primary dark:bg-primary dark:text-primary-foreground"
                                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-secondary/40"
                            }`}
                          >
                            <strong className="font-extrabold tabular-nums">
                              {voo.numero_voo || "Sem nº"}
                            </strong>
                            <span
                              className={`font-mono text-[11px] font-bold ${
                                selecionado ? "text-[#efbd45]" : "text-primary"
                              }`}
                            >
                              {voo.matricula_registro || "—"}
                            </span>
                            <span className="font-mono text-[11px] font-semibold opacity-90">
                              {voo.origem || "—"} → {voo.destino || "—"}
                            </span>
                            {horaPrevista && (
                              <span className="font-mono text-[10px] opacity-75">
                                {horaPrevista}Z
                              </span>
                            )}
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                selecionado
                                  ? "bg-white/15 text-emerald-300"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {rotulo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {vooOperacional && operacaoSelecionada ? (
                  <OperacaoVooSelecionado
                    key={vooOperacional.id}
                    semContainerExterno
                    item={vooOperacional}
                    operacao={operacaoSelecionada}
                    processando={processando}
                    voosAoVivo={voosAoVivo}
                    carregandoAoVivo={carregandoAoVivo}
                    erroAoVivo={erroAoVivo}
                    atualizadoAoVivo={atualizadoAoVivo}
                    tripulacao={painel?.tripulacao || []}
                    detalhesVoo={renderizarDetalhes(vooOperacional, visaoAndamento === "monitoramento", true)}
                    aoAlternarMonitoramento={(ativo) => setVisaoAndamento(ativo ? "monitoramento" : "hoje")}
                    aoAbrirAgendamento={(id) => {
                      const agendamento = agendaCompleta.find((item) => item.id === id);
                      if (agendamento) abrirSolicitacao(agendamento);
                    }}
                    aoAbrirPlano={aoAbrirPlano}
                    aoAtualizar={async (status) => {
                      await carregar(true);
                      if (status && status !== "aprovada") {
                        setVooHojeSelecionadoId(operacaoSelecionada.id);
                        setFiltroOperacoes("operacao");
                      }
                    }}
                    aoFinalizar={(item) => finalizar(item)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                    {carregando ? (
                      <p className="text-xs text-muted-foreground">Carregando voos...</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">
                          Nenhum voo {filtroOperacoes === "operacao" ? "em operação" : "confirmado para esta data"}.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {filtroOperacoes === "operacao" && confirmados.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFiltroOperacoes("confirmados");
                                setVooHojeSelecionadoId(null);
                              }}
                            >
                              Ver confirmados ({voosConfirmadosHoje.length})
                            </Button>
                          )}
                          <Button type="button" size="sm" onClick={() => selecionarArea("calendario")}>
                            Abrir agenda completa
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {abaLista && aba !== "voos-hoje" && !selecionada && (
            <section className="sb-content-card">
              <Cronograma
                titulo={tituloAba[aba]}
                detalhe={descricaoAba[aba]}
                mostrarFiltros={false}
                selecionada={null}
                progressoChecklistPorId={progressoChecklistPorId}
                checklistAberto={checklistAberto}
                solicitacoes={solicitacoesFiltradas}
                nomesTripulantes={nomesTripulantes}
                busca={busca}
                filtroStatus={filtroCronograma}
                visao={visaoCronograma}
                aoMudarBusca={setBusca}
                aoMudarFiltroStatus={setFiltroStatus}
                aoMudarVisao={setVisaoCronograma}
                aoAbrir={abrirSolicitacao}
                aoHistorico={(item) => abrirJornada(item, "historico")}
                aoConfirmar={confirmarSolicitacao}
                aoRecusar={recusarSolicitacao}
                aoVoltar={() => setSelecionada(null)}
                aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }}
                aoJornada={abrirJornada}
                aoFinalizar={(item) => finalizar(item)}
                aoExcluir={(item) => excluir(item)}
              />
            </section>
          )}

          {abaLista && selecionada && !checklistAberto && !jornadaAberta && (
            <section className="sb-content-card" id="detalhes-solicitacao">{renderizarDetalhes(selecionada)}</section>
          )}

          {abaLista && selecionada && checklistAberto && (statusPermiteChecklist(selecionada.status) || selecionada.checklist_status === "concluido") && (
            <section className="sb-content-card space-y-3">
              <button type="button" className="sb-back" onClick={() => setChecklistAberto(false)}>
                <ChevronLeft size={16} /> Voltar aos detalhes
              </button>
              <ChecklistPreVoo key={selecionada.id} item={selecionada} aoConcluir={() => carregar(true)} aoAtualizarProgresso={notificarProgressoChecklist} />
            </section>
          )}

          {aba === "calendario" && (
            <section className="sb-content-card">
              <CalendarioAgendamento
                mes={mes}
                semana={semanaCalendario}
                dias={dias}
                visao={visaoCalendario}
                confirmados={agendaCompleta.filter((item) => item.status !== "pendente" && !["cancelada", "reprovada"].includes(item.status))}
                pendentes={pendentes}
                aeronaves={painel?.aeronaves || []}
                buscaVoo={buscaCalendario}
                aoMudarBuscaVoo={setBuscaCalendario}
                aoNavegarParaData={navegarParaDataCalendario}
                aoMudarMes={mudarMes}
                aoMudarSemana={mudarSemana}
                aoMudarVisao={mudarVisaoCalendario}
                aoAbrir={abrirSolicitacao}
                aoNovoAgendamento={abrirNovoAgendamento}
              />
            </section>
          )}

          {aba === "horas-voadas" && (
            <section className="sb-content-card">
              <DetalhamentoHorasVoadas dados={dadosHoras} carregando={carregandoHoras} erro={erroHoras} ano={anoHoras} mes={mesHoras} />
            </section>
          )}

          {aba === "escala" && (
            <section className="sb-content-card">
              <EscalaCalendario
                tripulacao={painel?.tripulacao || []}
                escala={painel?.escala || []}
                disponibilidades={painel?.disponibilidades || []}
                aoCriarEscala={abrirCriacaoEscala}
                aoAbrirVoo={(id) => { const item = agendaCompleta.find((a) => a.id === id); if (item) abrirSolicitacao(item); }}
                aoAbrirExtrato={abrirExtrato}
              />
            </section>
          )}
        </main>
      </section>

      {/* Novo Agendamento */}
      <Dialog open={mostrarNovo} onOpenChange={(aberto) => { if (!aberto && !processando) setMostrarNovo(false); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto p-0">
          <DialogTitle className="sr-only">Novo agendamento</DialogTitle>
          <DialogDescription className="sr-only">Cadastre um novo agendamento de voo</DialogDescription>
          <FormularioAgendamento emDialogo novo={novo} opcoes={opcoes} titulares={titulares} aerodromos={aerodromos} aerodromosCarregando={aerodromosCarregando} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />
        </DialogContent>
      </Dialog>

      {/* Disponibilidade na Escala */}
      <Dialog open={mostrarDisponibilidade} onOpenChange={(aberto) => { if (!aberto && !processando) setMostrarDisponibilidade(false); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto p-0">
          <DialogTitle className="sr-only">Criar escala</DialogTitle>
          <DialogDescription className="sr-only">Marque a disponibilidade de um tripulante</DialogDescription>
          <FormularioDisponibilidade emDialogo dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />
        </DialogContent>
      </Dialog>

      {/* Extrato de Jornadas */}
      <Dialog open={!!extrato} onOpenChange={(aberto) => { if (!aberto) setExtrato(null); }}>
        <DialogContent className="max-h-[88dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extrato de jornadas: {extrato?.tripulante.nome_completo}</DialogTitle>
            <DialogDescription>{extrato ? `${extrato.inicio.split("-").reverse().join("/")} a ${extrato.fim.split("-").reverse().join("/")} · horários em UTC` : ""}</DialogDescription>
          </DialogHeader>
          {extrato?.carregando && <p className="py-6 text-center text-xs text-muted-foreground">Carregando extrato...</p>}
          {extrato?.erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{extrato.erro}</p>}
          {extrato && !extrato.carregando && !extrato.erro && (extrato.jornadas.length ? (
            <div className="overflow-x-auto"><table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Voo</th><th className="p-2">Rota</th><th className="p-2">Função</th><th className="p-2">AC</th><th className="p-2">POU</th><th className="p-2">COR</th><th className="p-2">Jornada</th></tr></thead>
              <tbody>{extrato.jornadas.map((j) => <tr key={j.id} className="border-t border-border">
                <td className="p-2 font-mono">{j.data?.slice(0, 10).split("-").reverse().join("/")}</td><td className="p-2 font-mono">{j.numero_voo || "—"}</td><td className="p-2 font-mono">{j.origem || "—"} → {j.destino || "—"}</td><td className="p-2">{j.funcao_tripulante}</td>
                <td className="p-2 font-mono">{horaUtcCurta(j.horario_acionamento) || "--:--"}</td><td className="p-2 font-mono">{horaUtcCurta(j.horario_pouso) || "--:--"}</td><td className="p-2 font-mono">{horaUtcCurta(j.horario_corte) || "--:--"}</td>
                <td className="p-2 font-mono">{j.minutos_reais != null ? `${Math.floor(j.minutos_reais / 60)}h${String(j.minutos_reais % 60).padStart(2, "0")}` : "—"}</td>
              </tr>)}</tbody>
            </table></div>
          ) : <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma jornada registrada neste período.</p>)}
        </DialogContent>
      </Dialog>

      {/* Modal Jornada via Dialog */}
      <Dialog
        open={Boolean(selecionada && statusPermiteAbrirJornada(selecionada.status) && jornadaAberta)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setJornadaAberta(false);
            setSelecionada(null);
            void carregar(true);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto p-0">
          <DialogTitle className="sr-only">Jornada e histórico do voo</DialogTitle>
          <DialogDescription className="sr-only">Acompanhamento de horários, pernas e jornada da tripulação em UTC</DialogDescription>
          {selecionada && (
            <JornadaVoo
              item={selecionada}
              modo={jornadaModo}
              permitirMapa={false}
              voosEmOperacao={voosAoVivo}
              aoAtualizarAgendamento={async (status) => {
                await carregar(true);
                if (status) setSelecionada((atual) => (atual ? { ...atual, status } : atual));
              }}
              aoFechar={() => {
                setJornadaAberta(false);
                setSelecionada(null);
                void carregar(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação Finalizar Operação */}
      <Dialog
        open={Boolean(agendamentoParaFinalizar)}
        onOpenChange={(aberto) => {
          if (!aberto && !processando) setAgendamentoParaFinalizar(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Finalizar agendamento {agendamentoParaFinalizar?.numero_voo || "sem número"}?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A operação sairá do cronograma ativo, mas todo o histórico e o número do voo serão preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAgendamentoParaFinalizar(null)} disabled={processando} className="w-full rounded-xl text-xs font-semibold sm:w-auto">
              Cancelar
            </Button>
            <Button type="button" onClick={() => void executarFinalizacao()} disabled={processando} className="w-full rounded-xl text-xs font-semibold sm:w-auto">
              {processando ? "Finalizando..." : "Finalizar operação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Diálogo Exclusão */}
      <Dialog
        open={Boolean(agendamentoParaExcluir)}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setAgendamentoParaExcluir(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Remover solicitação da lista?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Os registros operacionais vinculados serão preservados. A solicitação deixará de aparecer no agendamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAgendamentoParaExcluir(null)}
              disabled={excluindo}
              className="w-full rounded-xl border-border text-xs font-semibold sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmarExclusao()}
              disabled={excluindo}
              className="w-full rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 sm:w-auto"
            >
              {excluindo ? "Removendo..." : "Remover solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fichaAutoItem && <PesoBalanceamentoFicha key={fichaAutoItem.id} item={fichaAutoItem} aberto aoAlterarAberto={(aberto) => { if (!aberto) setFichaAutoItem(null); }} />}
    </div>
  );
}