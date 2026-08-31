import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, Plane, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AcaoRapida, CabecalhoSecao, CartaoKpi, EtiquetaStatus, EstadoVazio, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import {
  aprovarSolicitacaoVoo,
  buscarPainelAgendamento,
  criarAgendamento,
  definirDisponibilidadeTripulacao,
  reprovarSolicitacaoVoo,
  type AeronaveAgendamento,
  type DisponibilidadeTripulacao,
  type EscalaAgendamento,
  type NovoAgendamento,
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
function diasCalendario(data: Date) {
  const inicio = primeiroDiaMes(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  const total = Math.ceil((deslocamento + ultimoDiaMes(data).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, indice) => new Date(data.getFullYear(), data.getMonth(), indice - deslocamento + 1));
}
function nomeTripulante(tripulacao: TripulanteAgendamento[], id: string | null | undefined) {
  return tripulacao.find((item) => item.id === id)?.nome_completo || "Não escalado";
}

export default function Agendamentos() {
  const { toast } = useToast();
  const [aba, setAba] = useState<AbaAgendamento>("calendario");
  const [mes, setMes] = useState(() => primeiroDiaMes(new Date()));
  const [visaoEscala, setVisaoEscala] = useState<VisaoEscala>("semanal");
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
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
  const [novo, setNovo] = useState<NovoAgendamento>({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), horario_previsto_agendamento: "", dias_duracao: 1, numero_passageiros: 1, codigo_cliente: "", piloto_id: "", copiloto_id: "", observacoes: "" });
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({ tripulante_id: "", data_inicio: dataIso(new Date()), data_fim: dataIso(new Date()), status: "aviso" as "aviso" | "ferias" | "disponivel", observacoes: "" });

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const inicio = dataIso(primeiroDiaMes(mes));
      const fim = dataIso(ultimoDiaMes(mes));
      setPainel(await buscarPainelAgendamento(inicio, fim));
    } catch {
      setErro("Não foi possível carregar o calendário de agendamentos.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [mes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const agendamentos = painel?.agendamentos || [];
  const confirmados = useMemo(() => agendamentos.filter((item) => item.status === "aprovada"), [agendamentos]);
  const pendentes = useMemo(() => agendamentos.filter((item) => item.status === "pendente"), [agendamentos]);
  const dias = useMemo(() => diasCalendario(mes), [mes]);
  const solicitacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return agendamentos;
    return agendamentos.filter((item) => [item.cliente_razao_social, item.codigo_cliente, item.origem, item.destino, item.matricula_registro, item.numero_voo].filter(Boolean).join(" ").toLowerCase().includes(termo));
  }, [agendamentos, busca]);

  const abrirSolicitacao = (item: SolicitacaoVooInterna) => {
    setSelecionada(item);
    setPilotoId(item.piloto_id || "");
    setCopilotoId(item.copiloto_id || "");
    setMotivo("");
  };

  const aprovar = async () => {
    if (!selecionada || !pilotoId) {
      toast({ title: "Piloto comandante obrigatório", description: "Selecione o comandante para gerar o número do voo.", variant: "destructive" });
      return;
    }
    setProcessando(true);
    try {
      const resposta = await aprovarSolicitacaoVoo(selecionada.id, pilotoId, copilotoId || undefined);
      toast({ title: "Solicitação aprovada", description: `Número de voo gerado: ${resposta.numero_voo}.` });
      setSelecionada(null);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível aprovar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setProcessando(false); }
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
    } finally { setProcessando(false); }
  };

  const atualizarNovo = <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => setNovo((atual) => ({ ...atual, [campo]: valor }));
  const criarNovo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessando(true);
    try {
      const resposta = await criarAgendamento({ ...novo, piloto_id: novo.piloto_id || undefined, copiloto_id: novo.copiloto_id || undefined, codigo_cliente: novo.codigo_cliente || undefined });
      toast({ title: resposta.status === "aprovada" ? "Agendamento criado e aprovado" : "Agendamento criado", description: resposta.numero_voo ? `Número de voo: ${resposta.numero_voo}.` : "A solicitação ficará pendente de aprovação." });
      setMostrarNovo(false);
      setNovo({ aeronave_id: "", origem: "", destino: "", data_agendada: dataIso(new Date()), horario_previsto_agendamento: "", dias_duracao: 1, numero_passageiros: 1, codigo_cliente: "", piloto_id: "", copiloto_id: "", observacoes: "" });
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível criar o agendamento", description: error instanceof Error ? error.message : "Confira os campos e tente novamente.", variant: "destructive" });
    } finally { setProcessando(false); }
  };

  const mudarMes = (delta: number) => setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  const salvarDisponibilidade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!novaDisponibilidade.tripulante_id) {
      toast({ title: "Tripulante obrigatório", description: "Selecione o piloto ou copiloto.", variant: "destructive" });
      return;
    }
    setProcessando(true);
    try {
      await definirDisponibilidadeTripulacao(novaDisponibilidade);
      toast({ title: "Disponibilidade registrada", description: "A informação foi salva na escala da tripulação." });
      setMostrarDisponibilidade(false);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setProcessando(false); }
  };

  return (
    <div className="route-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <IndicadorPagina>Operações / agendamento de voo</IndicadorPagina>
          <h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Agendamento de Voo</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">Organize os agendamentos confirmados, a escala da tripulação e o cronograma operacional em uma única central.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setMostrarNovo((atual) => !atual)} className="gap-2 bg-primary text-primary-foreground"><Plus size={14} /> Novo agendamento</Button><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="gap-2 border-border bg-card text-xs"><RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><CartaoKpi label="Voos confirmados" value={carregando ? "—" : String(confirmados.length)} detail="No período exibido" icon={<Plane size={16} />} /><CartaoKpi label="Solicitações pendentes" value={carregando ? "—" : String(pendentes.length)} detail="Aguardando coordenação" tone="amber" icon={<Clock3 size={16} />} /><CartaoKpi label="Aeronaves disponíveis" value={carregando ? "—" : String(painel?.aeronaves.length || 0)} detail="Cadastro ativo da frota" tone="green" icon={<CalendarDays size={16} />} /></div>

      {mostrarNovo && <FormularioAgendamento novo={novo} aeronaves={painel?.aeronaves || []} tripulacao={painel?.tripulacao || []} atualizando={processando} atualizar={atualizarNovo} aoCancelar={() => setMostrarNovo(false)} aoEnviar={criarNovo} />}
      {erro && <div className="rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">{abas.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setAba(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold transition-colors ${aba === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={14} />{item.label}</button>; })}</nav>

      {aba === "calendario" && <CalendarioAgendamento mes={mes} dias={dias} confirmados={confirmados} pendentes={pendentes} aeronaves={painel?.aeronaves || []} aoMudarMes={mudarMes} aoAbrir={abrirSolicitacao} />}
      {aba === "escala" && <Escala tripulacao={painel?.tripulacao || []} escala={painel?.escala || []} disponibilidades={painel?.disponibilidades || []} visao={visaoEscala} aoMudarVisao={setVisaoEscala} aoMarcar={() => setMostrarDisponibilidade((atual) => !atual)} />}
      {aba === "cronograma" && <Cronograma solicitacoes={solicitacoesFiltradas} busca={busca} aoMudarBusca={setBusca} aoAbrir={abrirSolicitacao} />}
      {aba === "escala" && mostrarDisponibilidade && <FormularioDisponibilidade dados={novaDisponibilidade} tripulacao={painel?.tripulacao || []} atualizando={processando} aoCancelar={() => setMostrarDisponibilidade(false)} aoEnviar={salvarDisponibilidade} aoAlterar={(campo, valor) => setNovaDisponibilidade((atual) => ({ ...atual, [campo]: valor }))} />}

      {selecionada && <DetalhesSolicitacao selecionada={selecionada} tripulacao={painel?.tripulacao || []} pilotoId={pilotoId} copilotoId={copilotoId} motivo={motivo} processando={processando} aoFechar={() => setSelecionada(null)} aoPiloto={setPilotoId} aoCopiloto={setCopilotoId} aoMotivo={setMotivo} aoAprovar={() => void aprovar()} aoReprovar={() => void reprovar()} />}
    </div>
  );
}

function FormularioAgendamento({ novo, aeronaves, tripulacao, atualizando, atualizar, aoCancelar, aoEnviar }: { novo: NovoAgendamento; aeronaves: AeronaveAgendamento[]; tripulacao: TripulanteAgendamento[]; atualizando: boolean; atualizar: <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => void; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="overflow-hidden rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Plus size={15} />} title="Novo agendamento" detail="Crie uma solicitação ou já deixe a tripulação escalada" action={<button type="button" onClick={aoCancelar} aria-label="Fechar novo agendamento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-1.5"><Label htmlFor="codigo-cliente" className="text-[10px]">Código do cliente</Label><Input id="codigo-cliente" value={novo.codigo_cliente || ""} onChange={(event) => atualizar("codigo_cliente", event.target.value)} placeholder="Ex.: COT-001" required className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="aeronave-agendamento" className="text-[10px]">Aeronave</Label><select id="aeronave-agendamento" value={novo.aeronave_id} onChange={(event) => atualizar("aeronave_id", event.target.value)} required className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Selecione uma aeronave</option>{aeronaves.map((item) => <option key={item.id} value={item.id}>{item.matricula_registro} · {item.modelo}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="origem-agendamento" className="text-[10px]">Origem</Label><Input id="origem-agendamento" value={novo.origem} onChange={(event) => atualizar("origem", event.target.value)} placeholder="SBSP" required className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="destino-agendamento" className="text-[10px]">Destino</Label><Input id="destino-agendamento" value={novo.destino} onChange={(event) => atualizar("destino", event.target.value)} placeholder="SBRJ" required className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="data-agendamento" className="text-[10px]">Data do voo</Label><Input id="data-agendamento" type="date" value={novo.data_agendada} onChange={(event) => atualizar("data_agendada", event.target.value)} required className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="hora-agendamento" className="text-[10px]">Horário previsto</Label><Input id="hora-agendamento" type="time" value={novo.horario_previsto_agendamento || ""} onChange={(event) => atualizar("horario_previsto_agendamento", event.target.value)} className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="duracao-agendamento" className="text-[10px]">Duração (dias)</Label><Input id="duracao-agendamento" type="number" min={1} value={novo.dias_duracao || 1} onChange={(event) => atualizar("dias_duracao", Number(event.target.value))} className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="passageiros-agendamento" className="text-[10px]">Passageiros</Label><Input id="passageiros-agendamento" type="number" min={1} value={novo.numero_passageiros || 1} onChange={(event) => atualizar("numero_passageiros", Number(event.target.value))} className="h-9 text-xs" /></div><div className="space-y-1.5 xl:col-span-2"><Label htmlFor="piloto-agendamento" className="text-[10px]">Piloto comandante <span className="text-muted-foreground">(opcional para deixar pendente)</span></Label><select id="piloto-agendamento" value={novo.piloto_id || ""} onChange={(event) => atualizar("piloto_id", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Definir depois</option>{tripulacao.map((item) => <option key={item.id} value={item.id}>{item.nome_completo} · CANAC {item.canac} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}</option>)}</select></div><div className="space-y-1.5 xl:col-span-2"><Label htmlFor="copiloto-agendamento" className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><select id="copiloto-agendamento" value={novo.copiloto_id || ""} onChange={(event) => atualizar("copiloto_id", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Sem copiloto</option>{tripulacao.map((item) => <option key={item.id} value={item.id}>{item.nome_completo} · CANAC {item.canac}</option>)}</select></div><div className="space-y-1.5 md:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-agendamento" className="text-[10px]">Observações</Label><Textarea id="observacoes-agendamento" value={novo.observacoes || ""} onChange={(event) => atualizar("observacoes", event.target.value)} placeholder="Informações da trip, passageiros ou operação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="gap-2 text-xs">{atualizando ? "Salvando..." : "Salvar agendamento"}<Check size={14} /></Button></div></form></section>;
}

function CalendarioAgendamento({ mes, dias, confirmados, pendentes, aeronaves, aoMudarMes, aoAbrir }: { mes: Date; dias: Date[]; confirmados: SolicitacaoVooInterna[]; pendentes: SolicitacaoVooInterna[]; aeronaves: AeronaveAgendamento[]; aoMudarMes: (delta: number) => void; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  const eventosPorDia = new Map<string, SolicitacaoVooInterna[]>();
  [...confirmados, ...pendentes].forEach((item) => eventosPorDia.set(item.data_agendada, [...(eventosPorDia.get(item.data_agendada) || []), item]));
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Calendário de agendamento" detail="Visualização mensal dos voos e solicitações" action={<div className="flex items-center gap-1"><button type="button" onClick={() => aoMudarMes(-1)} aria-label="Mês anterior" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronLeft size={15} /></button><span className="min-w-[112px] text-center text-[10px] font-bold">{nomesMeses[mes.getMonth()]} {mes.getFullYear()}</span><button type="button" onClick={() => aoMudarMes(1)} aria-label="Próximo mês" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} /></button></div>} /><div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{dias.map((dia) => { const chave = dataIso(dia); const eventos = eventosPorDia.get(chave) || []; const noMes = dia.getMonth() === mes.getMonth(); const hoje = chave === dataIso(new Date()); return <div key={chave} className={`min-h-[112px] border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${hoje ? "bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground/40"}`}>{dia.getDate()}</div><div className="space-y-1">{eventos.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => aoAbrir(item)} className={`flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[9px] ${item.status === "aprovada" ? "border-[#2bbf8a]/20 bg-[#2bbf8a]/10 text-[#6bd188]" : "border-[#f1c348]/20 bg-[#f1c348]/10 text-[#f4cc64]"}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /><span className="truncate">{item.numero_voo || `${item.origem} → ${item.destino}`}</span></button>)}{eventos.length > 3 && <p className="px-1 text-[9px] text-muted-foreground">+{eventos.length - 3} registros</p>}</div></div>; })}</div></section><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Plane size={15} />} title="Agendamentos confirmados" detail="Voos aprovados no período" />{confirmados.length ? <div className="divide-y divide-border/60">{confirmados.slice(0, 8).map((item) => <ResumoVoo key={item.id} item={item} aoAbrir={aoAbrir} />)}</div> : <EstadoVazio label="Nenhum voo confirmado neste período" />}</section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Aeronaves disponíveis" detail="Frota ativa retornada pelo D1" />{aeronaves.length ? <div className="grid gap-2 p-4 sm:grid-cols-2">{aeronaves.slice(0, 6).map((item) => <div key={item.id} className="rounded-lg border border-border/70 bg-secondary/20 p-3"><div className="flex items-center justify-between gap-2"><p className="font-mono text-[10px] font-bold">{item.matricula_registro}</p><EtiquetaStatus tone="green">Disponível</EtiquetaStatus></div><p className="mt-2 text-[10px] text-muted-foreground">{item.fabricante} {item.modelo}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.base || "Base não informada"} · {item.tipo_aeronave || "Aeronave"}</p></div>)}</div> : <EstadoVazio label="Nenhuma aeronave ativa encontrada" />}</section></div><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Clock3 size={15} />} title="Solicitações aguardando confirmação" detail="Selecione uma solicitação para escalar a tripulação e gerar o voo" />{pendentes.length ? <div className="divide-y divide-border/60">{pendentes.map((item) => <ResumoVoo key={item.id} item={item} aoAbrir={aoAbrir} />)}</div> : <EstadoVazio label="Nenhuma solicitação pendente" />}</section></div>;
}

function ResumoVoo({ item, aoAbrir }: { item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void }) { return <button type="button" onClick={() => aoAbrir(item)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/20"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === "aprovada" ? "bg-[#2bbf8a]/10 text-[#6bd188]" : "bg-[#f1c348]/10 text-[#f4cc64]"}`}><Plane size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold">{item.numero_voo || "Solicitação sem número"}</p><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></div><p className="mt-1 text-[10px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)} · {item.cliente_razao_social || item.codigo_cliente || "Cliente não informado"}</p></div><ChevronRight size={15} className="text-muted-foreground" /></button>; }

function Escala({ tripulacao, escala, disponibilidades, visao, aoMudarVisao, aoMarcar }: { tripulacao: TripulanteAgendamento[]; escala: EscalaAgendamento[]; disponibilidades: DisponibilidadeTripulacao[]; visao: VisaoEscala; aoMudarVisao: (visao: VisaoEscala) => void; aoMarcar: () => void }) {
  const hoje = new Date();
  const diasVisao = visao === "mensal" ? diasCalendario(hoje) : Array.from({ length: 7 }, (_, indice) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7) + indice));
  const eventosDoDia = (dia: Date) => escala.filter((item) => { const inicio = item.data_agendada; const fim = item.data_fim || item.data_agendada; const chave = dataIso(dia); return chave >= inicio && chave <= fim; });
  const statusDoDia = (dia: Date) => disponibilidades.filter((item) => { const chave = dataIso(dia); return chave >= item.data_inicio && chave <= item.data_fim; });
  return <div className="space-y-5"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Users size={15} />} title="Escala da tripulação" detail={visao === "mensal" ? "Visão mensal de voos e disponibilidade" : "Visão semanal de voos e disponibilidade"} action={<div className="flex items-center gap-2"><button type="button" onClick={aoMarcar} className="rounded-md border border-primary/30 px-2 py-1 text-[9px] font-bold text-primary hover:bg-primary/10">Marcar status</button><div className="flex rounded-md border border-border p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "semanal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Mensal</button></div></div>} /><div className="grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div><div className="grid grid-cols-7">{diasVisao.map((dia) => { const chave = dataIso(dia); const eventos = eventosDoDia(dia); const status = statusDoDia(dia); const noMes = visao === "semanal" || dia.getMonth() === hoje.getMonth(); return <div key={chave} className={`${visao === "mensal" ? "min-h-[92px]" : "min-h-[165px]"} border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}><div className="mb-2 flex items-center justify-between"><span className={`font-mono text-[10px] ${chave === dataIso(hoje) ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground/40"}`}>{dia.getDate()}</span>{status[0] && <span className={`h-1.5 w-1.5 rounded-full ${status[0].status === "ferias" ? "bg-[#f4cc64]" : status[0].status === "aviso" ? "bg-muted-foreground" : "bg-[#6bd188]"}`} />}</div><div className="space-y-1">{eventos.slice(0, visao === "mensal" ? 2 : 4).map((item) => <div key={item.id} className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-1"><p className="truncate font-mono text-[9px] font-bold text-primary">{item.numero_voo || "Sem número"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino}</p></div>)}{eventos.length > (visao === "mensal" ? 2 : 4) && <p className="px-1 text-[9px] text-muted-foreground">+{eventos.length - (visao === "mensal" ? 2 : 4)} voos</p>}</div></div>; })}</div></section><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Plane size={15} />} title="Voos na escala" detail="Escala derivada dos agendamentos aprovados" />{escala.length ? <div className="divide-y divide-border/60">{escala.map((item) => <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-mono text-xs font-bold text-primary">{item.numero_voo || "Sem número"}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)}{item.data_fim !== item.data_agendada ? ` até ${formatarData(item.data_fim)}` : ""}</p></div><div><p className="text-[10px] font-semibold">Comandante: {item.piloto_nome || "Não escalado"}</p><p className="mt-1 text-[10px] text-muted-foreground">Copiloto: {item.copiloto_nome || "Não escalado"}</p></div><EtiquetaStatus tone="green">Confirmado</EtiquetaStatus></div>)}</div> : <EstadoVazio label="Nenhum voo aprovado com tripulação escalada" />}</section><section className="rounded-xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center gap-2"><Users size={16} className="text-primary" /><div><h2 className="text-xs font-bold">Tripulação e disponibilidade</h2><p className="text-[10px] text-muted-foreground">Pilotos das tabelas tripulacao e tripulacao_freelancer.</p></div></div>{tripulacao.length ? <div className="space-y-2">{tripulacao.map((item) => { const registros = disponibilidades.filter((registro) => registro.tripulante_id === item.id); const disponibilidade = registros[registros.length - 1]; const statusDisponibilidade = disponibilidade?.status === "ferias" ? "Férias" : disponibilidade?.status === "aviso" ? "De aviso" : "Disponível"; const tomDisponibilidade = disponibilidade?.status === "ferias" ? "amber" : disponibilidade?.status === "aviso" ? "neutral" : "green"; return <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Users size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{item.nome_completo}</p><p className="mt-1 text-[9px] text-muted-foreground">CANAC {item.canac} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}{disponibilidade ? ` · ${formatarData(disponibilidade.data_inicio)} a ${formatarData(disponibilidade.data_fim)}` : ""}</p></div><EtiquetaStatus tone={tomDisponibilidade}>{statusDisponibilidade}</EtiquetaStatus></div>; })}</div> : <EstadoVazio label="Nenhum tripulante ativo encontrado" />}</section></div></div>;
}
function Cronograma({ solicitacoes, busca, aoMudarBusca, aoAbrir }: { solicitacoes: SolicitacaoVooInterna[]; busca: string; aoMudarBusca: (busca: string) => void; aoAbrir: (item: SolicitacaoVooInterna) => void }) { return <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Cronograma de Voos" detail="Todas as solicitações de voo do período" action={<div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar cliente, rota ou voo" className="h-8 w-56 pl-8 text-[10px]" /></div>} />{solicitacoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Número do voo</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Data / horário</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Tripulação</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{solicitacoes.map((item) => <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3 font-mono text-[10px] font-bold text-primary">{item.numero_voo || "A gerar"}</td><td className="px-4 py-3"><p className="max-w-[150px] truncate text-[10px] font-bold">{item.cliente_razao_social || item.codigo_cliente || "Cliente não informado"}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.codigo_cliente || "Código não informado"}</p></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.origem} → {item.destino}</td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{formatarData(item.data_agendada)}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.horario_previsto_agendamento || "A definir"}</p></td><td className="px-4 py-3 font-mono text-[10px]">{item.matricula_registro || "A definir"}</td><td className="px-4 py-3 text-[10px] text-muted-foreground">{item.piloto_id ? "Escalada" : "Pendente"}</td><td className="px-4 py-3"><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => aoAbrir(item)} className="text-[10px] font-bold text-primary hover:underline">Detalhes</button></td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhuma solicitação encontrada" />}</section>; }

function DetalhesSolicitacao({ selecionada, tripulacao, pilotoId, copilotoId, motivo, processando, aoFechar, aoPiloto, aoCopiloto, aoMotivo, aoAprovar, aoReprovar }: { selecionada: SolicitacaoVooInterna; tripulacao: TripulanteAgendamento[]; pilotoId: string; copilotoId: string; motivo: string; processando: boolean; aoFechar: () => void; aoPiloto: (valor: string) => void; aoCopiloto: (valor: string) => void; aoMotivo: (valor: string) => void; aoAprovar: () => void; aoReprovar: () => void }) { return <section className="overflow-hidden rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<ClipboardList size={15} />} title="Detalhes da solicitação" detail={`${selecionada.origem} → ${selecionada.destino} · ${formatarData(selecionada.data_agendada)}`} action={<button type="button" onClick={aoFechar} aria-label="Fechar detalhes" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><div className="grid gap-5 p-5 lg:grid-cols-[1fr_.9fr]"><div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4"><Detalhe label="Cliente" valor={selecionada.cliente_razao_social || selecionada.codigo_cliente || "Não informado"} /><Detalhe label="Aeronave" valor={`${selecionada.matricula_registro || "A definir"} · ${selecionada.modelo || "—"}`} /><Detalhe label="Duração" valor={`${selecionada.dias_duracao || 1} dia(s)`} /><Detalhe label="Passageiros" valor={String(selecionada.numero_passageiros || 1)} /><Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na aprovação"} /><Detalhe label="Status" valor={statusLabel(selecionada.status)} /><Detalhe label="Criado em" valor={formatarData(selecionada.criado_em)} /><Detalhe label="Empréstimo" valor={selecionada.voo_emprestado === "sim" ? "Sim" : "Não"} /></div>{selecionada.status === "pendente" ? <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Confirmar solicitação</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Ao aprovar, o backend gera o número usando o código do cliente e escala a tripulação escolhida.</p><div className="mt-4 space-y-3"><div className="space-y-1.5"><Label htmlFor="piloto-aprovacao" className="text-[10px]">Piloto comandante</Label><select id="piloto-aprovacao" value={pilotoId} onChange={(event) => aoPiloto(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[11px]"><option value="">Selecione o comandante</option>{tripulacao.map((item) => <option key={item.id} value={item.id}>{item.nome_completo} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="copiloto-aprovacao" className="text-[10px]">Copiloto <span className="text-muted-foreground">(opcional)</span></Label><select id="copiloto-aprovacao" value={copilotoId} onChange={(event) => aoCopiloto(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[11px]"><option value="">Sem copiloto</option>{tripulacao.map((item) => <option key={item.id} value={item.id}>{item.nome_completo} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="motivo-reprovacao" className="text-[10px">Motivo da reprovação</Label><Textarea id="motivo-reprovacao" value={motivo} onChange={(event) => aoMotivo(event.target.value)} placeholder="Preencha apenas se for reprovar" className="min-h-16 text-[11px]" /></div><div className="flex flex-wrap gap-2 pt-1"><Button type="button" onClick={aoAprovar} disabled={processando} className="gap-2 bg-[#2bbf8a] text-[#03150e] hover:bg-[#45d5a5]"><Check size={14} /> Aprovar e gerar voo</Button><Button type="button" onClick={aoReprovar} disabled={processando} variant="outline" className="gap-2 border-[#e77b80]/40 bg-transparent text-[#ed8c90] hover:bg-[#e77b80]/10"><X size={14} /> Reprovar</Button></div></div></div> : <div className="rounded-xl border border-border bg-secondary/20 p-4"><p className="text-[11px] font-bold">Solicitação encerrada</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Status atual: <strong className="text-foreground">{statusLabel(selecionada.status)}</strong>{selecionada.motivo_rejeicao ? ` · ${selecionada.motivo_rejeicao}` : ""}.</p></div>}</div></section>; }

function Detalhe({ label, valor }: { label: string; valor: string }) { return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1.5 truncate text-[10px] font-semibold">{valor}</p></div>; }


type DadosDisponibilidade = { tripulante_id: string; data_inicio: string; data_fim: string; status: "aviso" | "ferias" | "disponivel"; observacoes: string };

function FormularioDisponibilidade({ dados, tripulacao, atualizando, aoCancelar, aoEnviar, aoAlterar }: { dados: DadosDisponibilidade; tripulacao: TripulanteAgendamento[]; atualizando: boolean; aoCancelar: () => void; aoEnviar: (event: FormEvent<HTMLFormElement>) => void; aoAlterar: (campo: keyof DadosDisponibilidade, valor: string) => void }) {
  return <section className="overflow-hidden rounded-xl border border-primary/25 bg-card"><CabecalhoSecao icon={<Users size={15} />} title="Registrar disponibilidade" detail="Defina o período de aviso, férias ou disponibilidade operacional" action={<button type="button" onClick={aoCancelar} aria-label="Fechar formulário de disponibilidade" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} /><form onSubmit={aoEnviar} className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-1.5 xl:col-span-2"><Label htmlFor="tripulante-disponibilidade" className="text-[10px]">Tripulante</Label><select id="tripulante-disponibilidade" value={dados.tripulante_id} onChange={(event) => aoAlterar("tripulante_id", event.target.value)} required className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Selecione o piloto</option>{tripulacao.map((item) => <option key={item.id} value={item.id}>{item.nome_completo} · CANAC {item.canac} · {item.origem === "freelancer" ? "Freelancer" : "Tripulação"}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="status-disponibilidade" className="text-[10px">Status</Label><select id="status-disponibilidade" value={dados.status} onChange={(event) => aoAlterar("status", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="aviso">De aviso</option><option value="ferias">Férias</option><option value="disponivel">Disponível</option></select></div><div className="space-y-1.5"><Label htmlFor="inicio-disponibilidade" className="text-[10px">Início</Label><Input id="inicio-disponibilidade" type="date" value={dados.data_inicio} onChange={(event) => aoAlterar("data_inicio", event.target.value)} required className="h-9 text-xs" /></div><div className="space-y-1.5"><Label htmlFor="fim-disponibilidade" className="text-[10px">Fim</Label><Input id="fim-disponibilidade" type="date" value={dados.data_fim} onChange={(event) => aoAlterar("data_fim", event.target.value)} required className="h-9 text-xs" /></div><div className="space-y-1.5 md:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-disponibilidade" className="text-[10px">Observações</Label><Textarea id="observacoes-disponibilidade" value={dados.observacoes} onChange={(event) => aoAlterar("observacoes", event.target.value)} placeholder="Observações da coordenação" className="min-h-16 text-xs" /></div><div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="text-xs">{atualizando ? "Salvando..." : "Salvar status"}</Button></div></form></section>;
}
