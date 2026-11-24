import "@/pages/agendamentos-screen.css";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, Clock3, Plane, Radio, ShieldCheck, Users, Search, ArrowRight, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  aprovarSolicitacaoVoo,
  atualizarAgendamento,
  buscarOpcoesAgendamento,
  buscarPainelAgendamento,
  buscarHorasVoadasOperacionais,
  criarAgendamento,
  definirDisponibilidadeTripulacao,
  reprovarSolicitacaoVoo,
  excluirAgendamento,
  finalizarAgendamento,
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type EscalaAgendamento,
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
import VoosDeHoje from "@/components/agendamento/VoosDeHoje";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";
import type { AbaAgendamento } from "@/components/agendamento/AgendamentoNavigation";
import { abaExibeLista, obterFiltroDaAba } from "@/components/agendamento/agendamentoNavigationModel";
import { Cronograma, AcoesDetalhe, type FiltroStatusCronograma, type VisaoCronograma } from "@/components/agendamento/AgendamentoCronograma";
import { CalendarioAgendamento, Escala, type VisaoEscala } from "@/components/agendamento/AgendamentoCalendario";
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
function hojeUtc() {
  return new Date().toISOString().slice(0, 10);
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
  const [dadosVooAbertoId, setDadosVooAbertoId] = useState<string | null>(null);
  const [abaAnterior, setAbaAnterior] = useState<AbaAgendamento | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroOperacoes, setFiltroOperacoes] = useState<FiltroOperacoes>("operacao");
  const [visaoAndamento, setVisaoAndamento] = useState<"monitoramento" | "hoje">("hoje");
  
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCronograma>("todos");
  const [visaoCronograma, setVisaoCronograma] = useState<VisaoCronograma>("grid");
  const [buscaCalendario, setBuscaCalendario] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
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
  const confirmados = useMemo(() => agendamentos.filter((item) => ["aprovada", "acionado", "decolado", "em_rota", "em_voo", "em_solo"].includes(String(item.status || "").trim().toLowerCase())), [agendamentos]);
  const encerrados = useMemo(() => agendamentos.filter((item) => ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())), [agendamentos]);
  const pendentes = useMemo(() => agendamentos.filter((item) => item.status === "pendente"), [agendamentos]);

  // Card e modal consomem o MESMO consolidado dos lançamentos reais do diário.
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
    // A visão inicial não duplica os filtros dos KPIs: mostra somente operações
    // programadas/realizadas hoje, incluindo voos de múltiplos dias.
    const hoje = hojeBrasilia();
    const ativos = (aba === "historico" ? agendamentos : agendaCompleta).filter((item) => aba === "cronograma"
      ? operacaoNaData(item, hoje)
      : filtroCronograma === "encerrada"
        ? ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())
        : correspondeFiltroStatusAgendamento(item.status, filtroCronograma));
    const encontrados = termo
      ? ativos.filter((item) => [item.id, item.data_agendada, item.cliente_razao_social, item.socio_nome, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo))
      : ativos;
    return ordenarPorAeronave(encontrados);
  }, [agendamentos, agendaCompleta, aba, busca, filtroCronograma]);

  const selecionarAba = (proxima: AbaAgendamento) => {
    setMensagensConfirmacaoId(null);
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
      }
      return;
    }
    setMensagensConfirmacaoId(null);
    if (!["cronograma", "pendentes", "aprovados", "historico", "voos-hoje"].includes(aba)) {
      setAba("cronograma");
      setFiltroStatus("todos");
    }
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  }, [aba, agendamentos]);

  const confirmarSolicitacao = (item: SolicitacaoVooInterna) => {
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
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, passageiros: [""], piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" });
    } finally {
      setProcessando(false);
    }
  };

  const finalizar = async (item: SolicitacaoVooInterna) => {
    if (obterAcoesAgendamento(item, calcularProgressoChecklist(item)).historico) {
      toast({ title: "Operação já concluída", description: "Agendamentos encerrados são somente leitura.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Finalizar o agendamento ${item.numero_voo || 'sem número'}? Ele sairá do cronograma, mas o número do voo será preservado no histórico.`)) return;
    setProcessando(true);
    try {
      await finalizarAgendamento(item.id);
      if (selecionada?.id === item.id) setSelecionada(null);
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

  const atualizarSelecionada = async (dados: AtualizacaoAgendamento) => {
    if (!selecionada) return;
    setProcessando(true);
    try {
      await atualizarAgendamento(selecionada.id, dados);
      toast({ title: "Agendamento atualizado", description: "As alterações foram disponibilizadas para toda a equipe." });
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
    "voos-hoje": "Voos em andamento",
    historico: "Histórico de voos",
    "horas-voadas": "Horas Voadas",
  };
  const descricaoAba: Record<AbaAgendamento, string> = {
    cronograma: "Operações previstas ou realizadas no dia de hoje, no horário de Brasília.",
    pendentes: "Pedidos de clientes aguardando análise e confirmação de escala.",
    aprovados: "Voos confirmados com tripulação definida e plano de voo.",
    calendario: "Visualização por período (hoje, amanhã, semana) e calendário mensal.",
    escala: "Disponibilidade, escalas e limites RBAC 117 da tripulação.",
    "voos-hoje": visaoAndamento === "hoje" ? "Voos e pernas planejadas na data selecionada, além das operações ativas. Selecione um voo para gerenciar a operação." : "Selecione uma operação à esquerda para acompanhar o mapa ao vivo ou o histórico da rota.",
    historico: "Operações concluídas e registros de voo para consulta.",
    "horas-voadas": "Tempo de voo registrado no diário de bordo, por aeronave, mês, dia e ano.",
  };

  const hojeOperacoes = dataOperacoes;
  const voosEmAndamento = ordenarPorAeronave(filtrarOperacoes(agendamentos, "operacao", hojeOperacoes));
  const voosConfirmadosHoje = ordenarPorAeronave(filtrarOperacoes(agendaCompleta, "confirmados", hojeOperacoes));
  const baseLateral = visaoAndamento === "monitoramento" || filtroOperacoes === "operacao" ? voosEmAndamento : voosConfirmadosHoje;
  const voosLateral = baseLateral.filter((voo) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const tripulantes = [voo.piloto_nome || nomesTripulantes.get(voo.piloto_id || ""), voo.copiloto_nome || nomesTripulantes.get(voo.copiloto_id || "")];
    const texto = [voo.numero_voo, voo.matricula_registro, voo.origem, voo.destino, voo.cliente_razao_social, voo.socio_nome, ...tripulantes].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return !termo || texto.includes(termo);
  });
  const vooOperacional = selecionarOperacao(voosLateral, vooHojeSelecionadoId);
  const operacaoSelecionada = vooOperacional?.solicitacao_origem_id ? agendamentos.find(item => item.id === vooOperacional.solicitacao_origem_id) || null : vooOperacional;
  const selecionarVooLateral = (item: SolicitacaoVooInterna) => {
    setVooHojeSelecionadoId(item.id);
    abrirSolicitacao(item);
  };
  // A mesma seleção governa a lista, os controles, os detalhes e o mapa.
  useEffect(() => {
    if (aba !== "voos-hoje") return;
    setSelecionada(vooOperacional);
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(vooOperacional?.piloto_id || "");
    setCopilotoId(vooOperacional?.copiloto_id || "");
    setMotivo("");
  }, [aba, vooOperacional]);

  const tabsPainel: { id: AbaAgendamento; label: string; icon: typeof Plane }[] = [
    { id: "voos-hoje", label: "Voos em andamento", icon: Plane },
    { id: "calendario", label: "Agenda de voo", icon: CalendarDays },
    { id: "escala", label: "Escala tripulação", icon: Users },
    { id: "historico", label: "Histórico de voos", icon: History },
    { id: "horas-voadas", label: "Horas Voadas", icon: Clock3 },
  ];
  const selecionarArea = (proxima: AbaAgendamento) => {
    setMostrarNovo(false);
    selecionarAba(proxima);
  };
  const voltarTelaAnterior = () => {
    if (abaAnterior && abaAnterior !== aba) {
      selecionarArea(abaAnterior);
      return;
    }
    setSelecionada(null);
    setChecklistAberto(false);
    setJornadaAberta(false);
    if (aba === "voos-hoje") setVooHojeSelecionadoId(null);
  };
  const dentroDoAgendamento = aba === "voos-hoje" ? vooHojeSelecionadoId !== null : Boolean(abaLista && selecionada);
  const renderizarDetalhes = (item: SolicitacaoVooInterna, somenteLeitura = false, incorporado = false) => <DetalhesSolicitacao
    key={item.id} incorporado={incorporado} somenteLeitura={somenteLeitura}
    mostrarMensagensConfirmacao={mensagensConfirmacaoId === item.id}
    acoes={incorporado ? null : <AcoesDetalhe item={item} aoChecklist={(voo) => { setSelecionada(voo); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={(voo) => abrirJornada(voo, ["encerrada", "concluida"].includes(voo.status) ? "historico" : "atualizar")} aoFinalizar={(voo) => void finalizar(voo)} progressoChecklist={progressoChecklistPorId[item.id] ?? calcularProgressoChecklist(item)} checklistAberto={checklistAberto} />}
    selecionada={item} opcoes={opcoes} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando}
    aoAtualizar={atualizarSelecionada} aoFechar={() => { setSelecionada(null); setChecklistAberto(false); }} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={(alteracoes) => void aprovar(alteracoes)} aoReprovar={() => void reprovar()} />;

  return (
    <div className="sb-ops">
      <header className="sb-pillbar">
        <div className="sb-pillbar-brand"><Plane size={15}/>Agendamentos</div>
        <nav className="sb-tabs" aria-label="Áreas de operações">{tabsPainel.map(({id, label, icon: Icon}) => <button type="button" key={id} className={`${(aba === id || (id === "calendario" && ["cronograma", "aprovados", "pendentes"].includes(aba))) ? "active" : ""}${id === "calendario" ? " sb-tab-destaque" : ""}`} onClick={() => selecionarArea(id)}><Icon size={16}/>{label}{id === "horas-voadas" && <strong className="font-mono text-[10px] opacity-80">{horasVoadasMes}</strong>}</button>)}</nav>
      </header>
      <div className={`sb-layout${aba === "voos-hoje" ? " sb-stage" : ""}`}>
        {aba === "voos-hoje" && <aside className="sb-sidebar">
          <div className="sb-sidebar-heading"><h2><Plane size={21}/> Operações ativas</h2><span className="sb-total-tag">{baseLateral.length} voos</span></div>
          <label className="sb-search"><Search size={17}/><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar voo, rota, matrícula ou tripulante" /></label>
          {visaoAndamento === "hoje" && filtroOperacoes === "confirmados" && <label className="sb-sidebar-caption">Data dos voos<input type="date" aria-label="Data dos voos" value={dataOperacoes} onChange={event => { setDataOperacoes(event.target.value); setVooHojeSelecionadoId(null); }} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs" /></label>}
          {visaoAndamento === "hoje" ? <div className="sb-filters" role="group" aria-label="Filtrar voos da operação">
            {([['operacao', 'Voos em Operação', voosEmAndamento.length], ['confirmados', 'Voos Confirmados', voosConfirmadosHoje.length]] as const).map(([valor, rotulo, quantidade]) => <button key={valor} type="button" aria-pressed={filtroOperacoes === valor} className={filtroOperacoes === valor ? "active" : ""} onClick={() => { setFiltroOperacoes(valor); setVooHojeSelecionadoId(null); }}>{rotulo} ({quantidade})</button>)}
          </div> : <p className="sb-sidebar-caption">Todas as operações ativas, inclusive sem sinal ao vivo.</p>}
          <div className="sb-flight-list">
            {carregando && !painel ? <p className="sb-empty">Carregando operações...</p> : voosLateral.length === 0 ? <p className="sb-empty">Nenhum voo encontrado para esta visualização.</p> : voosLateral.map((voo) => {
              const status = statusOperacao(voo.status);
              const rotulo = voo.solicitacao_origem_id ? "CONFIRMADO" : operacaoIniciada(voo) && status === "aprovada" ? "EM OPERAÇÃO" : rotuloOperacao(status);
              return <button type="button" key={voo.id} aria-pressed={vooOperacional?.id === voo.id} className={`sb-flight-card ${vooOperacional?.id === voo.id ? "selected" : ""}`} onClick={() => selecionarVooLateral(voo)}>
                <div className="sb-flight-heading"><span><Plane size={17}/><b>{voo.numero_voo || "Voo sem número"}</b></span><span className={`sb-pill ${status === "aprovada" && !operacaoIniciada(voo) ? "confirmed" : status === "em_solo" ? "pending" : "live"}`}>{rotulo}</span></div>
                <div className="sb-flight-route"><div><strong>{voo.origem || "—"}</strong><small>Origem</small></div><ArrowRight size={18}/><div><strong>{voo.destino || "—"}</strong><small>Destino</small></div></div>
                <div className="sb-flight-meta"><span><CalendarDays size={13}/>{voo.data_agendada?.slice(0,10).split("-").reverse().join("/") || "—"}</span><span><Plane size={13}/>{voo.matricula_registro || "Aeronave a definir"}</span></div>
                <div className="sb-flight-crew"><Users size={13}/><span>{[voo.piloto_nome || nomesTripulantes.get(voo.piloto_id || ""), voo.copiloto_nome || nomesTripulantes.get(voo.copiloto_id || "")].filter(Boolean).join(" · ") || "Tripulação a definir"}</span></div>
              </button>;
            })}
          </div>
        </aside>}
        <main className="sb-main">
          <div className="sb-main-heading"><div><h1>{tituloAba[aba]}</h1><p>{descricaoAba[aba]}</p></div><div className="sb-main-actions">
            {dentroDoAgendamento && <button type="button" className="sb-back" onClick={voltarTelaAnterior}><ChevronLeft size={16}/>Voltar</button>}
          </div></div>
          {aba === "calendario" && <div className="sb-subtabs"><button type="button" onClick={() => selecionarAba("calendario")} className={aba === "calendario" ? "active" : ""}>Calendário</button><button type="button" onClick={() => selecionarAba("cronograma")}>Voos de hoje</button><button type="button" onClick={() => selecionarAba("aprovados")}>Confirmados ({confirmados.length})</button><button type="button" onClick={() => selecionarAba("pendentes")}>Pendentes ({pendentes.length})</button></div>}
          {["cronograma", "aprovados", "pendentes"].includes(aba) && <div className="sb-subtabs"><button type="button" onClick={() => selecionarAba("calendario")}>Calendário</button><button type="button" onClick={() => selecionarAba("cronograma")} className={aba === "cronograma" ? "active" : ""}>Voos de hoje</button><button type="button" onClick={() => selecionarAba("aprovados")} className={aba === "aprovados" ? "active" : ""}>Confirmados ({confirmados.length})</button><button type="button" onClick={() => selecionarAba("pendentes")} className={aba === "pendentes" ? "active" : ""}>Pendentes ({pendentes.length})</button></div>}
          {erro && <div className="sb-error">{erro}<button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}
          {aba === "calendario" && mostrarNovo && <section className="sb-form-expanded"><div className="sb-section-heading"><h3>Novo agendamento — informações completas</h3><button type="button" onClick={() => setMostrarNovo(false)} aria-label="Fechar formulário"><X size={18}/></button></div><FormularioAgendamento novo={novo} opcoes={opcoes} titulares={titulares} aerodromos={aerodromos} aerodromosCarregando={aerodromosCarregando} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo}/></section>}
          {aba === "voos-hoje" && <>
            <div className="sb-subtabs sb-monitor-tabs" role="group" aria-label="Visualização dos voos">
              <button type="button" aria-pressed={visaoAndamento === "hoje"} className={visaoAndamento === "hoje" ? "active" : ""} onClick={() => setVisaoAndamento("hoje")}><Plane size={14} />VOOS EM ANDAMENTO</button>
              <button type="button" aria-pressed={visaoAndamento === "monitoramento"} className={visaoAndamento === "monitoramento" ? "active" : ""} onClick={() => setVisaoAndamento("monitoramento")}><Radio size={14} />Monitoramento Voos</button>
            </div>
            {vooOperacional && operacaoSelecionada ? <>
              {visaoAndamento === "hoje" ? <OperacaoVooSelecionado key={vooOperacional.id} item={vooOperacional} operacao={operacaoSelecionada} processando={processando} dadosVooAbertos={dadosVooAbertoId === vooOperacional.id}
                aoAbrirAgendamento={(id) => { const agendamento = agendaCompleta.find(item => item.id === id); if (agendamento) abrirSolicitacao(agendamento); }}
                aoAbrirPlano={aoAbrirPlano}
                aoNovoAgendamento={() => { selecionarArea("calendario"); setMostrarNovo(true); }}
                aoAtualizar={async (status) => { await carregar(true); if (status && status !== "aprovada") { setVooHojeSelecionadoId(operacaoSelecionada.id); setFiltroOperacoes("operacao"); } }}
                aoFinalizar={(item) => void finalizar(item)} />
                : <VoosDeHoje key={operacaoSelecionada.id} item={operacaoSelecionada} voosEmOperacao={voosAoVivo} carregandoAoVivo={carregandoAoVivo} erroAoVivo={erroAoVivo} atualizadoAoVivo={atualizadoAoVivo} />}
              <details key={`dados-${vooOperacional.id}`} className="sb-flight-details" aria-label="Detalhes do voo selecionado" open={dadosVooAbertoId === vooOperacional.id} onToggle={(evento) => setDadosVooAbertoId(evento.currentTarget.open ? vooOperacional.id : null)}><summary>Dados do voo <span>{visaoAndamento === "monitoramento" ? "Expandir para consultar" : "Expandir para consultar e editar"}</span><ChevronDown size={16} /></summary><div className="sb-flight-details-body">{renderizarDetalhes(vooOperacional, visaoAndamento === "monitoramento", true)}</div></details>
            </> : <section className="sb-empty">{carregando ? "Carregando voos..." : visaoAndamento === "monitoramento" ? "Nenhuma operação ativa para monitorar." : "Selecione um dos filtros à esquerda para consultar os voos."}</section>}
          </>}
          {abaLista && aba !== "voos-hoje" && !selecionada && <section className="sb-content-card"><Cronograma titulo={tituloAba[aba]} detalhe={descricaoAba[aba]} mostrarFiltros={false} selecionada={null} progressoChecklistPorId={progressoChecklistPorId} checklistAberto={checklistAberto} solicitacoes={solicitacoesFiltradas} nomesTripulantes={nomesTripulantes} busca={busca} filtroStatus={filtroCronograma} visao={visaoCronograma} aoMudarBusca={setBusca} aoMudarFiltroStatus={setFiltroStatus} aoMudarVisao={setVisaoCronograma} aoAbrir={abrirSolicitacao} aoHistorico={(item) => abrirJornada(item, "historico")} aoConfirmar={confirmarSolicitacao} aoVoltar={() => setSelecionada(null)} aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={abrirJornada} aoFinalizar={(item) => void finalizar(item)} aoExcluir={(item) => excluir(item)}/></section>}
          {abaLista && selecionada && !checklistAberto && !jornadaAberta && <section className="sb-content-card" id="detalhes-solicitacao">{renderizarDetalhes(selecionada)}</section>}
          {abaLista && selecionada && checklistAberto && (statusPermiteChecklist(selecionada.status) || selecionada.checklist_status === "concluido") && <section className="sb-content-card"><button type="button" className="sb-back" onClick={() => setChecklistAberto(false)}><ChevronLeft size={16}/> Voltar aos detalhes</button><ChecklistPreVoo key={selecionada.id} item={selecionada} aoConcluir={() => carregar(true)} aoAtualizarProgresso={notificarProgressoChecklist}/></section>}
          {aba === "calendario" && <section className="sb-content-card"><CalendarioAgendamento mes={mes} semana={semanaCalendario} dias={dias} visao={visaoCalendario} confirmados={agendaCompleta.filter(item => item.status !== "pendente" && !["cancelada", "reprovada"].includes(item.status))} pendentes={pendentes} aeronaves={painel?.aeronaves || []} buscaVoo={buscaCalendario} aoMudarBuscaVoo={setBuscaCalendario} aoNavegarParaData={navegarParaDataCalendario} aoMudarMes={mudarMes} aoMudarSemana={mudarSemana} aoMudarVisao={mudarVisaoCalendario} aoAbrir={abrirSolicitacao}/></section>}
          {aba === "horas-voadas" && <section className="sb-content-card"><DetalhamentoHorasVoadas dados={dadosHoras} carregando={carregandoHoras} erro={erroHoras} ano={anoHoras} mes={mesHoras}/></section>}
          {aba === "escala" && <section className="sb-content-card"><Escala tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} aoMarcar={abrirCriacaoEscala} aoAbrirVoo={(id) => { const item = agendaCompleta.find((a) => a.id === id); if (item) abrirSolicitacao(item); }}/>{mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))}/>}</section>}
        </main>
      </div>
      {/* Modal Jornada */}
      {selecionada && statusPermiteAbrirJornada(selecionada.status) && jornadaAberta && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6">
          <div className="agenda-jornada-modal max-h-[92dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_10px_30px_rgb(0_0_0_/_0.28)] sm:max-h-[92dvh] sm:rounded-2xl">
            <JornadaVoo
              item={selecionada}
              modo={jornadaModo}
              permitirMapa={false}
              voosEmOperacao={voosAoVivo}
              aoAtualizarAgendamento={async (status) => {
                await carregar(true);
                if (status) setSelecionada((atual) => atual ? { ...atual, status } : atual);
              }}
              aoFechar={() => {
                setJornadaAberta(false);
                setSelecionada(null);
                void carregar(true);
              }}
            />
          </div>
        </div>,
        document.body
      )}

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
