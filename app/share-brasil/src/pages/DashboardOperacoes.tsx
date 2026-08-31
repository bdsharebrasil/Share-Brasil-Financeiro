import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, FileText, Fuel, NotebookPen, Plane, RefreshCw, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecadosPanel } from "@/components/dashboard/Recados";
import { AcaoRapida, CabecalhoSecao, CartaoKpi, EtiquetaStatus, EstadoVazio } from "@/components/dashboard/PrimitivosDashboard";
import { buscarPainelOperacoes, buscarPerfilColaborador, type PainelOperacoesResponse, type SolicitacaoVooInterna } from "@/lib/colaborador-api";

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

function saudacaoAtual() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string) {
  return nome.split(" ").filter(Boolean)[0] || "Colaborador";
}

function HeroOperacoes({ nome }: { nome: string }) {
  return (
    <section className="relative mb-6 min-h-[195px] overflow-hidden rounded-2xl border border-white/10 bg-[#111b29] shadow-[0_18px_55px_rgba(0,0,0,.22)] md:min-h-[205px]">
      <img src="/aviation-hero1.jpg" alt="Aeronaves da Share Brasil no pátio" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,22,.94)_0%,rgba(5,12,22,.68)_38%,rgba(5,12,22,.22)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,12,22,.55)_0%,transparent_58%)]" />
      <div className="relative flex min-h-[195px] flex-col justify-between p-6 md:min-h-[205px] md:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4aa3f0]">Dashboard Operações</p>
        </div>
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-.045em] text-white md:text-[38px]">{saudacaoAtual()}, {primeiroNome(nome)}</h1>
        </div>
      </div>
    </section>
  );
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
      setDados(await buscarPainelOperacoes());
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

  const resumo = dados?.resumo;

  return (
    <div className="route-enter">
      <HeroOperacoes nome={nomeColaborador} />

      {erro && <div className="mb-5 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">{erro}<button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar novamente</button></div>}

      <div className="mx-auto mb-6 grid max-w-[770px] gap-3 sm:grid-cols-3">
        <CartaoKpi label="Voos hoje" value={carregando ? "—" : String(resumo?.voos_hoje ?? 0)} detail="Operações previstas para hoje" icon={<Plane size={16} />} />
        <CartaoKpi label="Agendamentos" value={carregando ? "—" : String(resumo?.reservas_abertas ?? 0)} detail="Reservas a partir de hoje" tone="blue" icon={<CalendarDays size={16} />} />
        <CartaoKpi label="Pendências" value={carregando ? "—" : String(resumo?.pendencias ?? 0)} detail="Aguardando decisão operacional" tone="amber" icon={<Activity size={16} />} />
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <AcaoRapida icon={<CalendarDays size={17} />} label="Agendamentos" detail={`${resumo?.pendencias ?? 0} pendentes`} onClick={() => aoNavegar("agendamentos")} color="blue" />
        <AcaoRapida icon={<FileText size={17} />} label="Plano de Voo" detail="Abrir módulo" onClick={() => aoNavegar("plano-de-voo")} color="violet" />
        <AcaoRapida icon={<NotebookPen size={17} />} label="Diário de Bordo" detail="Abrir módulo" onClick={() => aoNavegar("diario-de-bordo")} color="green" />
        <AcaoRapida icon={<Users size={17} />} label="Tripulação" detail="Escalas do dia" onClick={() => aoNavegar("tripulacao")} color="violet" />
        <AcaoRapida icon={<Fuel size={17} />} label="Abastecimento" detail="Abrir módulo" onClick={() => aoNavegar("abastecimentos")} color="amber" />
        <AcaoRapida icon={<Wrench size={17} />} label="CTM" detail="Abrir módulo" onClick={() => aoNavegar("ctm")} color="green" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Activity size={15} />} title="Solicitações e voos programados" detail="Atualização direta do endpoint interno" action={<Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-8 gap-1.5 border-border bg-card px-2.5 text-[10px]"><RefreshCw size={12} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button>} />
        {carregando ? <div className="space-y-3 p-5"><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /></div> : dados?.solicitacoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[730px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Passageiros</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{dados.solicitacoes.slice(0, 12).map((item) => <LinhaVoo key={item.id} item={item} onOpen={() => aoNavegar("agendamentos")} />)}</tbody></table></div> : <EstadoVazio label="Nenhuma solicitação futura encontrada" />}
      </section>

      <div className="mt-5"><RecadosPanel compact aoAbrir={() => aoNavegar("recados")} /></div>

    </div>
  );
}

function LinhaVoo({ item, onOpen }: { item: SolicitacaoVooInterna; onOpen: () => void }) {
  return <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3"><p className="max-w-[180px] truncate text-[10px] font-bold">{item.cliente_razao_social || item.codigo_cliente || "Cliente não informado"}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.codigo_cliente || item.id.slice(0, 8)}</p></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.origem} → {item.destino}</td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{formatarData(item.data_agendada)}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.horario_previsto_agendamento || "A definir"}</p></td><td className="px-4 py-3 font-mono text-[10px] font-bold">{item.matricula_registro || "A definir"}</td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{item.numero_passageiros}</td><td className="px-4 py-3"><EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus></td><td className="px-4 py-3 text-right"><button type="button" onClick={onOpen} className="text-[10px] font-bold text-primary hover:underline">Abrir</button></td></tr>;
}
