import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, RefreshCw, Timer, Users } from "lucide-react";
import { buscarResumoJornadaOperacao, type PeriodoResumo, type ResumoJornadaOperacao } from "@/lib/colaborador-api";

function horas(minutos: number | null) {
  if (minutos === null || !Number.isFinite(minutos)) return "Não disponível";
  const total = Math.round(Math.abs(minutos));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}
function instante(valor: string | null) {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return "Não informado";
  return `${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(data)} UTC`;
}
function dataCurta(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(valor));
}
function PeriodoCard({ periodo }: { periodo: PeriodoResumo }) {
  const excesso = periodo.total_minutos > periodo.referencia_minutos;
  const igual = periodo.nivel === "referencia_atingida";
  const perto = periodo.nivel === "abaixo_referencia" && periodo.total_minutos >= periodo.referencia_minutos * 0.9;
  const cor = excesso ? "border-red-500/35 bg-red-500/[.06] text-red-700 dark:text-red-300"
    : igual || perto ? "border-yellow-500/40 bg-yellow-500/[.06] text-yellow-800 dark:text-yellow-200"
      : "border-border bg-background/30 text-muted-foreground";
  const rotulo = excesso ? "Acima da referência" : periodo.registros_incompletos ? "Registros incompletos" : igual ? "Referência atingida" : perto ? "Próximo da referência" : "Abaixo da referência";
  const percentual = Math.min(100, Math.max(0, periodo.total_minutos / periodo.referencia_minutos * 100));
  return <article className={`min-w-0 rounded-xl border p-4 ${cor}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-foreground">{periodo.tipo === "semana" ? "Janela semanal do sistema" : "Trabalho registrado no mês"}</h4><span className="rounded-full border border-current px-2 py-1 text-[9px] font-semibold">{rotulo}</span></div>
    <p className="mt-2 text-[10px] text-muted-foreground">{dataCurta(periodo.inicio)} a {dataCurta(new Date(new Date(periodo.fim).getTime() - 1).toISOString())} · UTC</p>
    <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{periodo.criterio}</p>
    <dl className="mt-4 space-y-2 text-xs">
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Desta operação neste período</dt><dd className="font-semibold text-foreground">{horas(periodo.operacao_minutos)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Todas as jornadas do tripulante</dt><dd className="font-semibold text-foreground">{periodo.registros_incompletos ? "Pelo menos " : ""}{horas(periodo.total_minutos)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Referência geral da lei</dt><dd className="font-semibold text-foreground">{horas(periodo.referencia_minutos)}</dd></div>
    </dl>
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Consumo da referência nos registros disponíveis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}><div className={`h-full rounded-full ${excesso ? "bg-red-500" : igual || perto ? "bg-yellow-400" : "bg-slate-400"}`} style={{ width: `${percentual}%` }} /></div>
    <p className="mt-3 text-[11px] font-semibold leading-relaxed">{excesso
      ? `Excesso ${periodo.registros_incompletos ? "mínimo registrado" : "registrado"}: ${horas(periodo.total_minutos - periodo.referencia_minutos)}.`
      : periodo.diferenca_minutos !== null
        ? `Diferença para a referência: ${horas(periodo.diferenca_minutos)}.`
        : "Não há saldo confiável enquanto existirem registros incompletos."}</p>
    {periodo.registros_incompletos > 0 && <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{periodo.registros_incompletos} registro(s) sem dados suficientes para completar a apuração.</p>}
  </article>;
}

export default function ResumoJornadaOperacaoCard({ solicitacaoId }: { solicitacaoId: string }) {
  const [resumo, setResumo] = useState<ResumoJornadaOperacao | null>(null);
  const [tripulanteId, setTripulanteId] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(""); setResumo(null);
    void buscarResumoJornadaOperacao(solicitacaoId).then((dados) => {
      if (!ativo) return;
      if (!dados || dados.solicitacao_id !== solicitacaoId || !Array.isArray(dados.tripulantes)) throw new Error("O resumo retornado não corresponde à operação selecionada.");
      setResumo(dados);
      setTripulanteId((atual) => dados.tripulantes.some((tripulante) => tripulante.id === atual) ? atual : dados.tripulantes[0]?.id || "");
    }).catch((falha) => { if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o resumo da jornada."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [solicitacaoId, revisao]);
  const tripulante = useMemo(() => resumo?.tripulantes.find((item) => item.id === tripulanteId), [resumo, tripulanteId]);

  return <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
      <div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-primary">Operação concluída · histórico</p><h3 className="mt-1 text-lg font-bold tracking-tight">Jornada realizada</h3><p className="mt-1 text-xs text-muted-foreground">{resumo?.numero_voo || "Resumo da operação"} · duração por tripulante e comparação dos registros</p></div>
      <button type="button" disabled={carregando} onClick={() => setRevisao((atual) => atual + 1)} aria-label="Atualizar resumo da operação" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-50"><RefreshCw size={14} className={carregando ? "animate-spin" : ""} /></button>
    </div>
    <div className="space-y-5 p-4 sm:p-5">
      {carregando ? <p role="status" className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><RefreshCw size={14} className="animate-spin" /> Carregando jornadas da operação...</p>
        : erro ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-700 dark:text-red-300">{erro}</p>
          : !resumo?.tripulantes.length ? <p className="text-xs text-muted-foreground">Não há jornadas vinculadas a tripulantes nesta operação.</p>
            : <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tripulante do resumo">{resumo.tripulantes.map((item) => <button key={item.id} type="button" onClick={() => setTripulanteId(item.id)} aria-pressed={tripulanteId === item.id} className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${tripulanteId === item.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}><Users size={13} className="shrink-0" /><span className="[overflow-wrap:anywhere]">{item.nome} · {item.funcoes.join(" / ")}</span></button>)}</div>
              {tripulante && <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="rounded-xl border border-primary/25 bg-primary/[.05] p-4"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Clock3 size={13} /> Duração real desta operação</p><p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{horas(tripulante.minutos_reais_operacao)}</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Soma das jornadas entre apresentação e encerramento, considerando o pós-corte registrado. Intervalos entre jornadas ficam fora da soma.</p></article>
                  <article className="rounded-xl border border-border bg-muted/20 p-4"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Timer size={13} /> Tempo computado no sistema</p><p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{horas(tripulante.minutos_registrados_operacao)}</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Soma dos tempos computados e salvos para este tripulante nesta operação. As jornadas do PIC e do SIC são apuradas separadamente.</p></article>
                </div>
                <p className="text-[11px] text-muted-foreground">Posição histórica: {instante(tripulante.referencia_em)}. Os acumulados consideram outras operações até esse momento.</p>
                <div><h4 className="mb-3 text-xs font-bold">Janelas semanais e meses da operação</h4>{tripulante.periodos.length ? <div className="grid gap-3 sm:grid-cols-2">{tripulante.periodos.map((periodo) => <PeriodoCard key={periodo.id} periodo={periodo} />)}</div> : <p className="text-xs text-muted-foreground">Datas insuficientes para identificar os períodos.</p>}</div>
                <div className="rounded-xl border border-border bg-background/30 p-4"><h4 className="text-xs font-bold">Trabalho consecutivo fora da base</h4><dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div><dt className="text-muted-foreground">Realizado nesta operação</dt><dd className="mt-1 font-semibold">Não aferido</dd></div><div><dt className="text-muted-foreground">Referência geral fora da base</dt><dd className="mt-1 font-semibold">{resumo.fora_base.referencia_dias} dias</dd></div><div><dt className="text-muted-foreground">Referência no local de operação</dt><dd className="mt-1 font-semibold">{resumo.fora_base.local_operacao_referencia_dias} dias</dd></div></dl><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{resumo.fora_base.motivo} As referências dependem do enquadramento aplicável.</p></div>
                <div><h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold"><CalendarDays size={14} /> Jornadas que compõem esta operação</h4><div className="space-y-3">{tripulante.jornadas.map((jornada) => <article key={jornada.id} className="rounded-xl border border-border bg-background/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Jornada {jornada.numero_jornada} · {jornada.funcao}</p><div className="text-right"><p className="font-mono text-base font-bold tabular-nums">{horas(jornada.minutos_reais)}</p><p className="mt-0.5 text-[9px] text-muted-foreground">Tempo real · registrado no sistema: {horas(jornada.minutos_registrados)}</p></div></div><dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2"><div><dt className="text-muted-foreground">Apresentação</dt><dd className="mt-1 font-medium">{instante(jornada.apresentacao)}</dd></div><div><dt className="text-muted-foreground">Corte dos motores</dt><dd className="mt-1 font-medium">{instante(jornada.corte)}</dd></div><div><dt className="text-muted-foreground">Pós-corte registrado</dt><dd className="mt-1 font-medium">{horas(jornada.minutos_pos_corte)}</dd></div><div><dt className="text-muted-foreground">Encerramento da jornada</dt><dd className="mt-1 font-medium">{instante(jornada.encerramento)}</dd></div></dl><p className={`mt-3 text-[10px] font-semibold ${jornada.diferenca_sistema_minutos !== null && jornada.diferenca_sistema_minutos < 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>Limite diário configurado: {horas(jornada.limite_sistema_minutos)} · {jornada.diferenca_sistema_minutos === null ? "Dados incompletos" : jornada.diferenca_sistema_minutos < 0 ? `Excesso no controle: ${horas(jornada.diferenca_sistema_minutos)}` : jornada.diferenca_sistema_minutos === 0 ? "No limite do controle" : `Saldo no controle: ${horas(jornada.diferenca_sistema_minutos)}`}</p>{jornada.avisos.length > 0 && <p className="mt-3 text-[10px] leading-relaxed text-yellow-800 dark:text-yellow-200">{jornada.avisos.join(" ")}</p>}</article>)}</div></div>
              </>}
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4"><p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200">Comparação dos registros, com validação legal pendente</p><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">{resumo.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">As janelas semanais podem se sobrepor e não devem ser somadas. As diferenças exibidas não autorizam nova escala. A confirmação exige o regime aplicável e todas as atividades computáveis do tripulante.</p></div>
            </>}
    </div>
  </section>;
}
