import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, FileText, Fuel, NotebookPen, Plane, RefreshCw, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecadosPanel } from "@/components/dashboard/Recados";
import VooEmOperacaoCard from "@/components/dashboard/operacoes/VooEmOperacaoCard";
import { AcaoRapida, CabecalhoSecao, CartaoKpi, EtiquetaStatus, EstadoVazio, HeroDashboard } from "@/components/dashboard/ComponentesDashboard";
import { buscarPainelOperacoes, buscarPerfilColaborador, type PainelOperacoesResponse, type SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { AGENDAMENTO_ABRIR_SESSAO_KEY } from "@/lib/agendamento-navigation";

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatarHorario(valor: string | null | undefined) {
  if (!valor) return "A definir";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return `${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

function tomStatus(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "aprovada" || status === "em_solo") return "green";
  if (status === "decolado" || status === "em_voo" || status === "em_rota") return "blue";
  if (status === "acionado") return "amber";
  if (status === "reprovada" || status === "cancelada") return "red";
  if (status === "pendente") return "amber";
  return "neutral";
}

function statusLabel(status: string) {
  return ({ pendente: "Pendente", aprovada: "Aprovada", acionado: "Acionado", decolado: "Decolado", em_voo: "Decolado", em_rota: "Decolado", em_solo: "Em solo · pousado", reprovada: "Reprovada", cancelada: "Cancelada" } as Record<string, string>)[status] || status;
}

function saudacaoAtual() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string) {
  return nome.split(" ").filter(Boolean)[0] || "Colaborador";
}

export default function DashboardOperacoes({ aoNavegar }: { aoNavegar: (menu: string) => void }) {
  const [dados, setDados] = useState<PainelOperacoesResponse | null>(null);
  const [nomeColaborador, setNomeColaborador] = useState("Colaborador");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setErro(null);
    try {
      const resposta = await buscarPainelOperacoes();
      setDados({ ...resposta, solicitacoes: Array.isArray(resposta?.solicitacoes) ? resposta.solicitacoes : [] });
    } catch {
      setErro("Não foi possível carregar os dados reais da operação.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    void buscarPerfilColaborador().then((response) => setNomeColaborador(response.perfil.nome_exibicao || response.perfil.nome_completo)).catch(() => undefined);
  }, [carregar]);

  useEffect(() => {
    const atualizarAoRetornar = () => {
      if (document.visibilityState === "visible") void carregar(true);
    };
    const timer = window.setInterval(() => void carregar(true), 15_000);
    window.addEventListener("focus", atualizarAoRetornar);
    document.addEventListener("visibilitychange", atualizarAoRetornar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", atualizarAoRetornar);
      document.removeEventListener("visibilitychange", atualizarAoRetornar);
    };
  }, [carregar]);

  const resumo = dados?.resumo;
  const abrirVoo = (item: SolicitacaoVooInterna) => {
    window.sessionStorage.setItem(AGENDAMENTO_ABRIR_SESSAO_KEY, item.id);
    aoNavegar("agendamentos");
  };

  return (
    <div className="route-enter">
      <HeroDashboard ambiente="operacoes" title={`${saudacaoAtual()}, ${primeiroNome(nomeColaborador)}`} />

      {erro && <div className="mb-5 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}

      <div className="mx-auto mb-6 grid max-w-[770px] gap-3 sm:grid-cols-3">
        <CartaoKpi label="Voos hoje" value={carregando ? "—" : String(resumo?.voos_hoje ?? 0)} detail="Operações previstas para hoje" icon={<Plane size={16} />} className="!p-2.5 sm:!p-3 border-[rgba(3,6,8,0.48)] bg-[rgba(213,224,226,1)] text-[rgba(17,20,25,1)] shadow-[0_1px_4px_1px_rgba(0,0,0,0.33)]" />
        <CartaoKpi label="Agendamentos" value={carregando ? "—" : String(resumo?.reservas_abertas ?? 0)} detail="Reservas a partir de hoje" tone="blue" icon={<CalendarDays size={16} />} className="!p-2.5 sm:!p-3 border-[rgba(3,6,8,0.48)] bg-[rgba(213,224,226,1)] text-[rgba(17,20,25,1)] shadow-[0_1px_4px_1px_rgba(0,0,0,0.33)]" />
        <CartaoKpi label="Pendências" value={carregando ? "—" : String(resumo?.pendencias ?? 0)} detail="Aguardando decisão operacional" tone="amber" icon={<Activity size={16} />} className="!p-2.5 sm:!p-3 border-[rgba(3,6,8,0.48)] bg-[rgba(213,224,226,1)] text-[rgba(17,20,25,1)] shadow-[0_1px_4px_1px_rgba(0,0,0,0.33)]" />
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <AcaoRapida icon={<CalendarDays size={17} />} label="Agendamentos" detail={`${resumo?.pendencias ?? 0} pendentes`} onClick={() => aoNavegar("agendamentos")} color="blue" />
        <AcaoRapida icon={<FileText size={17} />} label="Plano de Voo" detail="Abrir módulo" onClick={() => aoNavegar("plano-de-voo")} color="violet" />
        <AcaoRapida icon={<NotebookPen size={17} />} label="Diário de Bordo" detail="Abrir módulo" onClick={() => aoNavegar("diario-de-bordo")} color="green" />
        <AcaoRapida icon={<Users size={17} />} label="Tripulação" detail="Escalas do dia" onClick={() => aoNavegar("tripulacao")} color="violet" />
        <AcaoRapida icon={<Fuel size={17} />} label="Abastecimento" detail="Abrir módulo" onClick={() => aoNavegar("abastecimentos")} color="amber" />
        <AcaoRapida icon={<Wrench size={17} />} label="CTM" detail="Abrir módulo" onClick={() => aoNavegar("ctm")} color="green" />
      </section>

      <VooEmOperacaoCard aoNavegar={() => aoNavegar("agendamentos")} />

      <section className="overflow-hidden rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Activity size={15} />} title="Solicitações e voos programados"action={<Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-8 gap-1.5 border-border bg-card px-2.5 text-[10px]"><RefreshCw size={12} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button>} />
        {carregando ? <div className="space-y-3 p-5"><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /></div> : (Array.isArray(dados?.solicitacoes) && dados.solicitacoes.length > 0) ? <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[730px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3">Número do voo</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Horário programado</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{dados.solicitacoes.slice(0, 12).map((item) => <LinhaVoo key={item.id} item={item} onOpen={() => abrirVoo(item)} />)}</tbody></table></div>
          <div className="space-y-2 p-3 md:hidden">{dados.solicitacoes.slice(0, 12).map((item) => <CartaoVoo key={item.id} item={item} onOpen={() => abrirVoo(item)} />)}</div>
        </> : <EstadoVazio label="Nenhuma solicitação futura encontrada" />}
      </section>

      <div className="mt-5"><RecadosPanel compact aoAbrir={() => aoNavegar("recados")} /></div>

    </div>
  );
}

function LinhaVoo({ item, onOpen }: { item: SolicitacaoVooInterna; onOpen: () => void }) {
  return <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3"><p className="max-w-[180px] truncate text-[10px] font-bold">{item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Cotista não informado"}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.codigo_cliente || item.id.slice(0, 8)}</p></td><td className="px-4 py-3 font-mono text-[10px] font-bold text-primary">{item.numero_voo || "A definir"}</td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.origem} → {item.destino}</td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{formatarData(item.data_agendada)}</p></td><td className="px-4 py-3 font-mono text-[10px] font-bold">{item.matricula_registro || "A definir"}</td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{formatarHorario(item.horario_previsto_agendamento)}<AvisoDecolagem item={item} /></td><td className="px-4 py-3"><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></td><td className="px-4 py-3 text-right"><button type="button" onClick={onOpen} className="text-[10px] font-bold text-primary hover:underline">Abrir</button></td></tr>;
}

function CartaoVoo({ item, onOpen }: { item: SolicitacaoVooInterna; onOpen: () => void }) {
  return <article className="rounded-xl border border-border/70 bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold">{item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Cotista não informado"}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.codigo_cliente || item.id.slice(0, 8)}</p></div><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]"><div><span className="block text-[9px] text-muted-foreground">Rota</span><strong className="font-mono">{item.origem} → {item.destino}</strong></div><div><span className="block text-[9px] text-muted-foreground">Data</span><strong>{formatarData(item.data_agendada)}</strong></div><div><span className="block text-[9px] text-muted-foreground">Voo / horário</span><strong className="font-mono text-primary">{item.numero_voo || "A definir"} · {formatarHorario(item.horario_previsto_agendamento)}<AvisoDecolagem item={item} /></strong></div><div><span className="block text-[9px] text-muted-foreground">Aeronave / passageiros</span><strong className="font-mono">{item.matricula_registro || "A definir"} · {item.numero_passageiros ?? 0}</strong></div></div><button type="button" onClick={onOpen} className="mt-3 w-full rounded-lg border border-primary/30 px-3 py-2 text-[10px] font-bold text-primary hover:bg-primary/10">Abrir agendamento</button></article>;
}

function AvisoDecolagem({ item }: { item: SolicitacaoVooInterna }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (item.status !== "aprovada" || !item.horario_previsto_agendamento) return null;
  const horarioUtc = item.horario_previsto_agendamento.replace(" ", "T");
  const decolagem = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(horarioUtc) ? horarioUtc : `${horarioUtc}Z`).getTime();
  if (!Number.isFinite(decolagem)) return null;
  const minutos = Math.ceil((decolagem - agora) / 60_000);
  if (minutos < 0) return <span className="mt-1 block font-sans text-[9px] font-semibold text-amber-300">Horário previsto passou; aguardando confirmação ADS-B da decolagem.</span>;
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;
  const contagem = horas ? `${horas}h ${restantes}min` : `${restantes}min`;
  return <span className="mt-1 block font-sans text-[9px] font-semibold text-sky-300">Decolagem prevista em {contagem}</span>;
}
