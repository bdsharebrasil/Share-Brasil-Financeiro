import "@/pages/agendamentos-screen.css";
import { AgendamentoShell, cardAgenda, type AreaAgendamento } from "@/components/agendamento/AgendamentoShell";
import { ListaAgenda, HistoricoAgenda, AoVivoAgenda } from "@/components/agendamento/ListaAgendaOperacional";
import FichaAgendaOperacional from "@/components/agendamento/FichaAgendaOperacional";
import { historicoAgenda, type FiltroAgenda } from "@/components/agendamento/agendaOperacionalModel";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { conflitosDoTripulante, DIA, montarBlocos } from "@/lib/escala-tempo";
import {
  calcularProgressoChecklist,
  obterAcoesAgendamento,
} from "@/components/agendamento/agendamentoCardFlow";
import { AGENDAMENTO_ABRIR_SESSAO_KEY } from "@/lib/agendamento-navigation";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";
import { vincularPlanejamentos } from "@/components/agendamento/planejamentoAgendamento";
import { useVoosEmOperacao } from "@/hooks/useVoosEmOperacao";
import type { AbaAgendamento } from "@/components/agendamento/AgendamentoNavigation";
import EscalaCalendario from "@/components/agendamento/EscalaCalendario";
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

function horarioUtc(data: string, hora?: string) {
  if (!hora) return undefined;
  const instante = new Date(`${data}T${hora}:00Z`);
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : undefined;
}
function itensTitulares(opcoes: OpcoesAgendamentoResponse) {
  return [
    ...opcoes.clientes.map((item) => ({ id: `cliente:${item.id}`, label: `${item.nome}${item.codigo_cliente ? ` · ${item.codigo_cliente}` : ""}` })),
    ...opcoes.socios.map((item) => ({ id: `socio:${item.id}`, label: item.nome })),
  ];
}

export default function Agendamentos({ aoAbrirPlano, aoFechar }: { aoAbrirPlano?: (id: string) => void; aoFechar?: () => void } = {}) {
  const { toast } = useToast();
  const { voos: voosAoVivo, carregando: carregandoAoVivo, erro: erroAoVivo, atualizadoEm: atualizadoAoVivo } = useVoosEmOperacao();
  const [aba, setAba] = useState<AbaAgendamento>("cronograma");
  const [filtroAgenda, setFiltroAgenda] = useState<FiltroAgenda>("todos");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesAgendamentoResponse>({ clientes: [], socios: [], aeronaves: [], vinculos: [] });
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoVooInterna | null>(null);

  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [extrato, setExtrato] = useState<{ tripulante: TripulanteAgendamento; inicio: string; fim: string; carregando: boolean; erro: string | null; jornadas: JornadaRegistro[] } | null>(null);
  const [mostrarDisponibilidade, setMostrarDisponibilidade] = useState(false);
  const [dadosHoras, setDadosHoras] = useState<HorasVoadasOperacionaisResponse | null>(null);
  const [carregandoHoras, setCarregandoHoras] = useState(true);
  const [erroHoras, setErroHoras] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [agendamentoParaExcluir, setAgendamentoParaExcluir] = useState<SolicitacaoVooInterna | null>(null);
  const [agendamentoParaFinalizar, setAgendamentoParaFinalizar] = useState<SolicitacaoVooInterna | null>(null);
  const [mensagensConfirmacaoId, setMensagensConfirmacaoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: hojeUtc(), data_fim: hojeUtc(), horario_previsto_agendamento: "", numero_passageiros: 1, passageiros: [""], piloto_id: "", copiloto_id: "", observacoes: "" });
  const [fichaAutoItem, setFichaAutoItem] = useState<SolicitacaoVooInterna | null>(null);
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({ tripulante_id: "", data_inicio: dataIso(new Date()), data_fim: dataIso(new Date()), status: "aviso" as "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel", observacoes: "" });
  const carregamentoAtual = useRef(0);
  const carregar = useCallback(async (silencioso = false) => {
    const idCarregamento = ++carregamentoAtual.current;
    if (!silencioso) setCarregando(true);
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
      setOpcoes({
        ...opcoesAtuais,
        clientes: Array.isArray(opcoesAtuais?.clientes) ? opcoesAtuais.clientes : [],
        socios: Array.isArray(opcoesAtuais?.socios) ? opcoesAtuais.socios : [],
        aeronaves: Array.isArray(opcoesAtuais?.aeronaves) ? opcoesAtuais.aeronaves : [],
        vinculos: Array.isArray(opcoesAtuais?.vinculos) ? opcoesAtuais.vinculos : [],
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o módulo de agendamento.");
    } finally { if (idCarregamento === carregamentoAtual.current) setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (aba !== "voos-hoje") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [aba, carregar]);

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

  const titulares = useMemo(() => itensTitulares(opcoes), [opcoes]);

  const selecionarAba = (proxima: AbaAgendamento) => {
    setMensagensConfirmacaoId(null);
    setAba(proxima);
    setSelecionada(null);
  };

  const abrirSolicitacao = useCallback((item: SolicitacaoVooInterna) => {
    setMensagensConfirmacaoId(null);
    setSelecionada(item);
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
    setAba(historicoAgenda(item) ? "historico" : "cronograma");
    abrirSolicitacao(item);
  }, [abrirSolicitacao, carregando, painel?.agendamentos]);

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

  const areaAtual: AreaAgendamento = aba === "escala" ? "escala" : aba === "historico" ? "historico" : aba === "horas-voadas" ? "horas" : aba === "voos-hoje" ? "ao-vivo" : "agenda";
  const selecionarArea = (proxima: AbaAgendamento) => {
    setMostrarNovo(false);
    const destino = proxima === "calendario" ? "cronograma" : proxima;
    selecionarAba(destino);
    setFiltroAgenda(destino === "pendentes" ? "pendentes" : destino === "aprovados" ? "confirmados" : "todos");
  };
  const selecionarAreaShell = (area: AreaAgendamento) => selecionarArea(({ agenda: "cronograma", escala: "escala", historico: "historico", horas: "horas-voadas", "ao-vivo": "voos-hoje" } as const)[area]);
  const voltarTelaAnterior = () => {
    setSelecionada(null);
    setMensagensConfirmacaoId(null);
  };
  const renderizarDetalhes = (item: SolicitacaoVooInterna, somenteLeitura = false) => (
    <DetalhesSolicitacao
      key={item.id}
      incorporado
      acoes={null}
      somenteLeitura={somenteLeitura}
      mostrarMensagensConfirmacao={mensagensConfirmacaoId === item.id}
      selecionada={item}
      escala={painel?.escala || []}
      disponibilidades={painel?.disponibilidades || []}
      opcoes={opcoes}
      tripulacao={painel?.tripulacao || []}
      pilotoId={pilotoId}
      copilotoId={copilotoId}
      motivo={motivo}
      processando={processando}
      aoAtualizar={(dados) => atualizarSelecionada(item, dados)}
      aoFechar={voltarTelaAnterior}
      aoPiloto={setPilotoId}
      aoCopiloto={setCopilotoId}
      aoMotivo={setMotivo}
      aoAprovar={(alteracoes) => void aprovar(alteracoes)}
      aoReprovar={() => void reprovar()}
    />
  );

  const operacaoSelecionada = selecionada ? agendamentos.find(item => item.id === (selecionada.solicitacao_origem_id || selecionada.id)) || selecionada : null;
  return (
    <div className="min-w-0">
      <AgendamentoShell area={areaAtual} title={selecionada ? "Voo " + (selecionada.numero_voo || "sem número") : undefined} detalhe={Boolean(selecionada)} aoSelecionar={selecionarAreaShell} aoVoltar={voltarTelaAnterior} aoFechar={() => { if (aoFechar) aoFechar(); else selecionarArea("cronograma"); }}>
        {erro && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{erro}<button type="button" className="underline" onClick={() => void carregar()}>Tentar novamente</button></div>}
        {selecionada && operacaoSelecionada ? (
          <FichaAgendaOperacional key={selecionada.id} item={selecionada} operacao={operacaoSelecionada} aeronave={painel?.aeronaves.find(a => a.id === selecionada.aeronave_id)} itens={agendaCompleta} voosAoVivo={voosAoVivo} erroAoVivo={erroAoVivo}
            detalhes={renderizarDetalhes(selecionada, historicoAgenda(selecionada))} processando={processando} aoAbrir={abrirSolicitacao} aoAbrirPlano={aoAbrirPlano} aoAtualizar={() => carregar(true)} aoFinalizar={finalizar} aoExcluir={excluir} />
        ) : areaAtual === "agenda" ? (
          <ListaAgenda itens={agendaCompleta} filtro={filtroAgenda} aoFiltro={setFiltroAgenda} aoAbrir={abrirSolicitacao} aoNovo={() => abrirNovoAgendamento()} carregando={carregando} />
        ) : areaAtual === "historico" ? (
          <HistoricoAgenda itens={agendaCompleta} clientes={opcoes.clientes} socios={opcoes.socios} aoAbrir={abrirSolicitacao} carregando={carregando} />
        ) : areaAtual === "ao-vivo" ? (
          <AoVivoAgenda voos={voosAoVivo} carregando={carregandoAoVivo} erro={erroAoVivo} atualizado={atualizadoAoVivo} itens={agendaCompleta} aoAbrir={abrirSolicitacao} />
        ) : areaAtual === "horas" ? (
          <section className={cardAgenda + " p-3 sm:p-4"}><DetalhamentoHorasVoadas dados={dadosHoras} carregando={carregandoHoras} erro={erroHoras} ano={anoHoras} mes={mesHoras} /></section>
        ) : (
          <section className={cardAgenda + " p-3 sm:p-4"}><EscalaCalendario tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} aoCriarEscala={abrirCriacaoEscala} aoAbrirVoo={(id) => { const item = agendaCompleta.find(a => a.id === id); if (item) abrirSolicitacao(item); }} aoAbrirExtrato={abrirExtrato} /></section>
        )}
      </AgendamentoShell>

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