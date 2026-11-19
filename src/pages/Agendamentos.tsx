import "@/components/agendamento/agendamento-layout.css";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, Clock3, Plane, Plus, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CartaoKpi, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import {
  aprovarSolicitacaoVoo,
  atualizarAgendamento,
  buscarOpcoesAgendamento,
  buscarPainelAgendamento,
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
} from "@/lib/colaborador-api";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import ChecklistPreVoo from "@/components/agendamento/ChecklistPreVoo";
import JornadaVoo from "@/components/agendamento/JornadaVoo";
import { conflitosDoTripulante, DIA, montarBlocos } from "@/lib/escala-tempo";
import { calcularProgressoChecklist, correspondeFiltroStatusAgendamento, obterAcoesAgendamento, statusPermiteAbrirJornada, statusPermiteChecklist } from "@/components/agendamento/agendamentoCardFlow";
import { AGENDAMENTO_ABRIR_SESSAO_KEY } from "@/lib/agendamento-navigation";
import VoosDeHoje from "@/components/agendamento/VoosDeHoje";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";
import AgendamentoNavigation, { type AbaAgendamento } from "@/components/agendamento/AgendamentoNavigation";
import { abaExibeLista, obterFiltroDaAba } from "@/components/agendamento/agendamentoNavigationModel";
import { Cronograma, AcoesDetalhe, type FiltroStatusCronograma, type VisaoCronograma } from "@/components/agendamento/AgendamentoCronograma";
import { AgendaHojeResumo, CalendarioAgendamento, Escala, type VisaoEscala } from "@/components/agendamento/AgendamentoCalendario";
import { DetalhesSolicitacao } from "@/components/agendamento/AgendamentoDetalhes";
import { FormularioAgendamento, FormularioDisponibilidade, type DadosDisponibilidade } from "@/components/agendamento/AgendamentoFormularios";

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
  const { voos: voosAoVivo, carregando: carregandoAoVivo, erro: erroAoVivo, atualizadoEm: atualizadoAoVivo } = useVoosEmOperacao();
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
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCronograma>("todos");
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
  const [jornadaModo, setJornadaModo] = useState<"historico" | "atualizar">("atualizar");
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
  const confirmados = useMemo(() => agendamentos.filter((item) => ["aprovada", "acionado", "decolado", "em_rota", "em_voo", "em_solo"].includes(String(item.status || "").trim().toLowerCase())), [agendamentos]);
  const aprovados = useMemo(() => agendamentos.filter((item) => String(item.status || "").trim().toLowerCase() === "aprovada"), [agendamentos]);
  const encerrados = useMemo(() => agendamentos.filter((item) => ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())), [agendamentos]);
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
  const filtroCronograma = obterFiltroDaAba(aba, filtroStatus);
  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ativos = agendamentos.filter((item) => filtroCronograma === "encerrada"
      ? ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase())
      : correspondeFiltroStatusAgendamento(item.status, filtroCronograma));
    const encontrados = termo
      ? ativos.filter((item) => [item.id, item.data_agendada, item.cliente_razao_social, item.socio_nome, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo))
      : ativos;
    return ordenarPorAeronave(encontrados);
  }, [agendamentos, busca, filtroCronograma]);

  const selecionarAba = (proxima: AbaAgendamento) => {
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
    if (!["cronograma", "pendentes", "aprovados", "historico"].includes(aba)) {
      setAba("cronograma");
      setFiltroStatus("todos");
    }
    setSelecionada(item);
    setChecklistAberto(false);
    setJornadaAberta(false);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  }, [aba]);
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
      toast({ title: "Agendamento excluído", description: "O registro foi excluído definitivamente do sistema e do banco de dados." });
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

  const abaLista = abaExibeLista(aba);
  const tituloAba: Record<AbaAgendamento, string> = {
    cronograma: "Visão geral",
    pendentes: "Solicitações pendentes",
    aprovados: "Aprovados e escalados",
    calendario: "Agenda de voos",
    escala: "Escala da tripulação",
    "voos-hoje": "Monitoramento ao vivo",
    historico: "Histórico operacional",
  };
  const descricaoAba: Record<AbaAgendamento, string> = {
    cronograma: "Acompanhe as solicitações, os voos confirmados e as próximas atividades.",
    pendentes: "Pedidos que aguardam análise e confirmação da equipe de operações.",
    aprovados: "Voos confirmados, com tripulação e informações operacionais.",
    calendario: "Visualize os voos e solicitações organizados por data.",
    escala: "Disponibilidade, compromissos e jornadas da tripulação.",
    "voos-hoje": "Rastreio operacional e voos prontos para iniciar a jornada.",
    historico: "Operações concluídas e registros de jornada para consulta.",
  };

  return (
    <div className="agendamentos-page route-enter min-w-0" data-painel={aba} data-ajustar-tela={!mostrarNovo && !selecionada && (aba !== "escala" || !mostrarDisponibilidade) && !erro && aba !== "voos-hoje"}>
      <header className="agendamento-heading">
        <div className="agendamento-heading-copy">
          <IndicadorPagina>Operações / Agendamento de voo</IndicadorPagina>
          <h1>{selecionada ? `${selecionada.numero_voo || "Voo a gerar"} · ${selecionada.matricula_registro || "Aeronave a definir"}` : tituloAba[aba]}</h1>
          <p>{selecionada ? `${selecionada.origem || "—"} → ${selecionada.destino || "—"} · ${selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Titular não informado"}` : descricaoAba[aba]}</p>
        </div>
        <div className="agendamento-heading-actions">
          {aba === "voos-hoje" && <span className="agendamento-sync-state" role="status"><span className={carregandoAoVivo ? "agendamento-sync-dot is-loading" : voosAoVivo.length ? "agendamento-sync-dot is-live" : "agendamento-sync-dot"} />{carregandoAoVivo ? "Atualizando rastreio" : atualizadoAoVivo ? `Atualizado ${new Date(atualizadoAoVivo).toISOString().slice(11, 16)} UTC` : "Aguardando rastreio"}</span>}
          {aba !== "voos-hoje" && <Button type="button" onClick={() => setMostrarNovo((atual) => !atual)} className="agendamento-primary-action gap-2"><Plus size={15} /> Novo agendamento</Button>}
        </div>
      </header>

      <section className="agendamento-kpis" aria-label="Indicadores operacionais">
        <CartaoKpi label="Solicitações pendentes" value={carregando ? "—" : String(pendentes.length).padStart(2, "0")} detail="Aguardando coordenação" tone="amber" icon={<Clock3 size={16} />} />
        <CartaoKpi label="Voos confirmados" value={carregando ? "—" : String(confirmados.length)} detail="Aprovados e em operação" icon={<Plane size={16} />} />
        <CartaoKpi label="Em operação agora" value={carregandoAoVivo ? "—" : String(voosAoVivo.length)} detail="Rastreio de voo ativo" tone="green" icon={<Radio size={16} />} />
        <CartaoKpi label="Aeronaves cadastradas" value={carregando ? "—" : String(painel?.aeronaves?.length ?? 0)} detail="Frota da operação" tone="violet" icon={<CalendarDays size={16} />} />
        <CartaoKpi label="Tripulantes cadastrados" value={carregando ? "—" : String(painel?.tripulacao?.length ?? 0)} detail="Equipe operacional" tone="blue" icon={<Users size={16} />} />
      </section>

      {erro && <div className="agendamento-error" role="alert"><span>{erro}</span><button type="button" onClick={() => void carregar()} className="font-semibold underline underline-offset-2">Tentar novamente</button></div>}

      <AgendamentoNavigation
        abaAtiva={aba}
        contagens={{ pendentes: pendentes.length, aprovados: aprovados.length, historico: encerrados.length, "voos-hoje": voosAoVivo.length }}
        aoSelecionar={selecionarAba}
      />

      {aba !== "voos-hoje" && mostrarNovo && <FormularioAgendamento novo={novo} opcoes={opcoes} titulares={titulares} aerodromos={aerodromos} aerodromosCarregando={aerodromosCarregando} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />}

      {abaLista && !selecionada && <section id={`agendamento-panel-${aba}`} role="tabpanel" aria-labelledby={`agendamento-tab-${aba}`} tabIndex={0} className="agendamento-tabpanel">
        <div className={aba === "cronograma" ? "agendamento-workspace" : "agendamento-workspace is-single"}>
          <Cronograma
            titulo={tituloAba[aba]}
            detalhe={aba === "cronograma" ? "Solicitações, voos aprovados e operações em andamento" : descricaoAba[aba]}
            mostrarFiltros={aba === "cronograma"}
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
            aoVoltar={() => setSelecionada(null)}
            aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }}
            aoJornada={abrirJornada}
            aoFinalizar={(item) => void finalizar(item)}
            aoExcluir={(item) => void excluir(item)}
          />
          {aba === "cronograma" && <AgendaHojeResumo voos={voosDeHoje} pendentes={pendentes} carregando={carregando} aoAbrir={abrirSolicitacao} />}
        </div>
      </section>}

      {abaLista && selecionada && !checklistAberto && !jornadaAberta && <section id={`agendamento-panel-${aba}`} role="tabpanel" aria-labelledby={`agendamento-tab-${aba}`} tabIndex={0} className="agendamento-tabpanel"><DetalhesSolicitacao voosEmOperacao={voosAoVivo} acoes={<AcoesDetalhe item={selecionada} aoChecklist={(item) => { setSelecionada(item); setChecklistAberto(true); setJornadaAberta(false); }} aoJornada={abrirJornada} aoFinalizar={(item) => void finalizar(item)} progressoChecklist={progressoChecklistPorId[selecionada.id] ?? calcularProgressoChecklist(selecionada)} checklistAberto={checklistAberto} />} aoExcluir={() => void excluir(selecionada)} selecionada={selecionada} opcoes={opcoes} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando} aoAtualizar={atualizarSelecionada} aoFechar={() => { setSelecionada(null); setChecklistAberto(false); }} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={(alteracoes) => void aprovar(alteracoes)} aoReprovar={() => void reprovar()} /></section>}

      {abaLista && selecionada && checklistAberto && (statusPermiteChecklist(selecionada.status) || selecionada.checklist_status === "concluido") && <section id={`agendamento-panel-${aba}`} role="tabpanel" aria-labelledby={`agendamento-tab-${aba}`} tabIndex={0} className="agendamento-tabpanel agendamento-checklist-panel"><Button type="button" variant="outline" onClick={() => setChecklistAberto(false)} className="mb-3 gap-2"><ChevronLeft size={14} /> Voltar aos detalhes do voo</Button><ChecklistPreVoo key={selecionada.id} item={selecionada} aoConcluir={() => carregar(true)} aoAtualizarProgresso={notificarProgressoChecklist} /></section>}

      {aba === "calendario" && <section id="agendamento-panel-calendario" role="tabpanel" aria-labelledby="agendamento-tab-calendario" tabIndex={0} className="agendamento-tabpanel"><CalendarioAgendamento mes={mes} semana={semanaCalendario} dias={dias} visao={visaoCalendario} confirmados={[...confirmados, ...encerrados]} pendentes={pendentes} aeronaves={painel?.aeronaves || []} buscaVoo={buscaCalendario} aoMudarBuscaVoo={setBuscaCalendario} aoNavegarParaData={navegarParaDataCalendario} aoMudarMes={mudarMes} aoMudarSemana={mudarSemana} aoMudarVisao={mudarVisaoCalendario} aoAbrir={abrirSolicitacao} /></section>}

      {aba === "escala" && <section id="agendamento-panel-escala" role="tabpanel" aria-labelledby="agendamento-tab-escala" tabIndex={0} className="agendamento-tabpanel"><Escala tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} aoMarcar={abrirCriacaoEscala} aoAbrirVoo={(id) => { const item = agendamentos.find((a) => a.id === id); if (item) abrirSolicitacao(item); }} />{mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />}</section>}

      {aba === "voos-hoje" && <section id="agendamento-panel-voos-hoje" role="tabpanel" aria-labelledby="agendamento-tab-voos-hoje" tabIndex={0} className="agendamento-tabpanel"><VoosDeHoje voos={voosDeHoje} vooSelecionado={vooHojeSelecionado} nomesTripulantes={nomesTripulantes} voosEmOperacao={voosAoVivo} carregando={carregando} carregandoAoVivo={carregandoAoVivo} erroAoVivo={erroAoVivo} atualizadoAoVivo={atualizadoAoVivo} visaoInicial={vooHojeSelecionado ? "prontos" : "ao-vivo"} aoSelecionar={setVooHojeSelecionadoId} aoIniciar={abrirJornada} /></section>}

      {selecionada && statusPermiteAbrirJornada(selecionada.status) && jornadaAberta && createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"><div className="agenda-jornada-modal max-h-[92dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_10px_30px_rgb(0_0_0_/_0.28)] sm:max-h-[92dvh] sm:rounded-2xl"><JornadaVoo item={selecionada} modo={jornadaModo} voosEmOperacao={voosAoVivo} aoAtualizarAgendamento={async (status) => { await carregar(true); if (status) setSelecionada((atual) => atual ? { ...atual, status } : atual); }} aoFechar={() => { setJornadaAberta(false); setSelecionada(null); void carregar(true); }} /></div></div>, document.body)}

      <Dialog open={Boolean(agendamentoParaExcluir)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setAgendamentoParaExcluir(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-red-400/20 bg-card sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base font-bold text-red-300">Excluir agendamento definitivamente?</DialogTitle><DialogDescription className="pt-2 text-xs leading-relaxed">Deseja realmente excluir definitivo esse agendamento?</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setAgendamentoParaExcluir(null)} disabled={excluindo} className="w-full sm:w-auto">Cancelar</Button><Button type="button" onClick={() => void confirmarExclusao()} disabled={excluindo} className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto">{excluindo ? "Excluindo..." : "Sim, excluir definitivamente"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
