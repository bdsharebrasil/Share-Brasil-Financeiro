import { useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronRight, ClipboardCheck, Clock3, FileText, Flag, Gauge, Navigation, Pencil, Plane, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PernaPlanejada, SolicitacaoVooInterna, TripulanteAgendamento, VooEmOperacao } from "@/lib/colaborador-api";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";
import { cn } from "@/lib/utils";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "./agendamentoCardFlow";
import { diasEntre, etapasOperacao, type ProximaAcao } from "./agendamentoFluxo";
import { operacaoIniciada, rotuloOperacao } from "./operacoesPainelModel";
import ChecklistPreVoo from "./ChecklistPreVoo";
import JornadaVoo from "./JornadaVoo";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";
import VoosDeHoje from "./VoosDeHoje";

type AbaOperacao = "checklist" | "jornada" | "mapa" | "dados";

type Props = {
  item: SolicitacaoVooInterna;
  operacao: SolicitacaoVooInterna;
  aoAbrirAgendamento: (id: string) => void;
  aoAbrirPlano?: (id: string) => void;
  processando: boolean;
  aoAtualizar: (status?: string) => Promise<void>;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
  voosAoVivo?: VooEmOperacao[];
  carregandoAoVivo?: boolean;
  erroAoVivo?: string | null;
  atualizadoAoVivo?: string | null;
  detalhesVoo?: ReactNode;
  somenteLeituraMapa?: boolean;
  aoAlternarMonitoramento?: (ativo: boolean) => void;
  tripulacao?: TripulanteAgendamento[];
  semContainerExterno?: boolean;
};

const AJUDA: Record<Exclude<ProximaAcao, null>, string> = {
  checklist: "Conclua o check pré-voo para liberar o acionamento.",
  iniciar: "Check concluído. Registre o acionamento ao iniciar o voo.",
  horarios: "Lance decolagem, pouso e corte em UTC conforme ocorrerem.",
  encerrar: "Jornadas encerradas. Finalize a operação para arquivar.",
};

function horaCurtaUtc(valor?: string | null) {
  const m = String(valor || "").match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function iniciaisNome(nome?: string | null) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "—";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function formatarDataDestaque(dataInicio?: string | null, dataFim?: string | null) {
  const inicio = String(dataInicio || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return { principal: "Data não informada", contexto: "" };
  }
  const fim = String(dataFim || "").slice(0, 10);
  const dtInicio = new Date(`${inicio}T12:00:00Z`);
  const dataCurta = dtInicio.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).replace(/\./g, "");

  const hoje = hojeBrasilia();
  const delta = diasEntre(hoje, inicio);
  const rel = delta === 0 ? "Hoje" : delta === 1 ? "Amanhã" : delta === -1 ? "Ontem" : "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(fim) && fim > inicio) {
    const dtFim = new Date(`${fim}T12:00:00Z`);
    const inicioCurto = dtInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    const fimCurto = dtFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    return {
      principal: `${inicioCurto} a ${fimCurto}`,
      contexto: rel,
    };
  }

  return {
    principal: dataCurta,
    contexto: rel,
  };
}

export default function OperacaoVooSelecionado({
  item,
  operacao,
  aoAbrirAgendamento,
  aoAbrirPlano,
  processando,
  aoAtualizar,
  aoFinalizar,
  voosAoVivo = [],
  carregandoAoVivo = false,
  erroAoVivo = null,
  atualizadoAoVivo = null,
  detalhesVoo,
  aoAlternarMonitoramento,
  tripulacao = [],
  semContainerExterno = false,
}: Props) {
  const iniciada = operacaoIniciada(item);
  const [etapa, setEtapa] = useState<AbaOperacao>(iniciada ? "jornada" : "checklist");
  const [progressoLocal, setProgressoLocal] = useState<number | undefined>();

  const progresso = progressoLocal ?? calcularProgressoChecklist(item);
  const acoes = obterAcoesAgendamento(item, progresso, etapa === "checklist");
  const agendamento: PernaPlanejada | undefined = item.solicitacao_origem_id
    ? operacao.pernas_planejadas?.find((perna) => perna.id === item.id)
    : undefined;
  const podeAbrirJornada = acoes.mostrarJornada || iniciada;
  const { etapas, proxima } = etapasOperacao({
    checklistConcluido: acoes.checklistConcluido,
    operacaoIniciada: iniciada,
    jornadaEncerrada: Number(item.jornadas_encerradas || 0) > 0,
    podeEncerrar: acoes.podeFinalizar,
  });

  const vooAoVivo = voosAoVivo.find((v) => v.id === operacao.id || v.id === item.id);
  const rastreio = vooAoVivo?.rastreio || null;

  const comandanteReg = tripulacao.find((t) => t.id === item.piloto_id);
  const copilotoReg = tripulacao.find((t) => t.id === item.copiloto_id);
  const nomeComandante = item.piloto_nome || comandanteReg?.nome_completo || null;
  const nomeCopiloto = item.copiloto_nome || copilotoReg?.nome_completo || null;

  const previstoUtc = horaCurtaUtc(item.horario_previsto_agendamento);
  const acUtc = horaCurtaUtc(item.perna_atual_horario_ac || vooAoVivo?.perna_atual?.horario_acionamento);
  const depUtc = horaCurtaUtc(item.perna_atual_horario_dep || vooAoVivo?.perna_atual?.horario_decolagem);
  const pouUtc = horaCurtaUtc(item.perna_atual_horario_pouso || vooAoVivo?.perna_atual?.horario_pouso);
  const dataVoo = formatarDataDestaque(item.data_agendada, item.data_fim);

  const trocarEtapa = (nova: AbaOperacao) => {
    setEtapa(nova);
    aoAlternarMonitoramento?.(nova === "mapa");
  };

  const rotuloChecklist = acoes.checklistConcluido
    ? "Ver checklist"
    : progresso > 0
      ? "Continuar checklist"
      : "Checklist pré-voo";

  const principal: {
    id: Exclude<ProximaAcao, null>;
    rotulo: string;
    icone: typeof Plane;
    aoClicar: () => void;
    desabilitado?: boolean;
  } | null =
    agendamento || !proxima
      ? null
      : ({
          checklist: {
            id: "checklist",
            rotulo: rotuloChecklist,
            icone: ClipboardCheck,
            aoClicar: () => trocarEtapa("checklist"),
          },
          iniciar: {
            id: "iniciar",
            rotulo: "Iniciar operação",
            icone: Plane,
            aoClicar: () => trocarEtapa("jornada"),
            desabilitado: !podeAbrirJornada,
          },
          horarios: {
            id: "horarios",
            rotulo: "Registrar horários",
            icone: Clock3,
            aoClicar: () => trocarEtapa("jornada"),
          },
          encerrar: {
            id: "encerrar",
            rotulo: "Encerrar operação",
            icone: Flag,
            aoClicar: () => aoFinalizar(item),
            desabilitado: processando || !acoes.podeFinalizar,
          },
        } as const)[proxima];
  const IconePrincipal = principal?.icone;

  const navAbas: Array<{ id: AbaOperacao; label: string; icone: typeof Plane; visivel: boolean }> = [
    { id: "checklist", label: "Checklist", icone: ClipboardCheck, visivel: true },
    { id: "jornada", label: "Horários e jornada", icone: Clock3, visivel: podeAbrirJornada },
    { id: "mapa", label: "Mapa ao vivo", icone: Radio, visivel: true },
    { id: "dados", label: "Dados do voo", icone: Pencil, visivel: Boolean(detalhesVoo) },
  ];

  const Container = semContainerExterno ? "div" : "section";

  return (
    <Container
      className={cn(
        "overflow-hidden",
        !semContainerExterno && "rounded-2xl border border-border bg-card shadow-sm",
      )}
      aria-label="Painel do voo selecionado"
    >
      {/* Cabeçalho compacto em 2 linhas */}
      <header className="space-y-3 border-b border-border p-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  iniciada
                    ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {rotuloOperacao(item.status)}
              </span>

              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-bold text-foreground tabular-nums">
                <CalendarDays size={12} className="text-primary" />
                {dataVoo.principal}
                {dataVoo.contexto ? ` · ${dataVoo.contexto}` : ""}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {item.socio_nome || item.cliente_razao_social || "Titular não informado"}
                {item.numero_passageiros ? ` · ${item.numero_passageiros} pax` : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground tabular-nums sm:text-xl">
                {item.numero_voo || "Voo sem número"}
              </h2>
              <span className="font-mono text-sm font-bold text-primary">
                {item.matricula_registro || "Matrícula a definir"}
              </span>
              {item.modelo && (
                <span className="text-xs text-muted-foreground">· {item.modelo}</span>
              )}
            </div>
          </div>

          {/* Ações rápidas + Ação principal */}
          <div className="flex flex-wrap items-center gap-1.5">
            {aoAbrirPlano && (
              <Button type="button" variant="outline" size="sm" onClick={() => aoAbrirPlano(item.id)} className="h-8 gap-1.5 rounded-lg text-xs font-semibold">
                <FileText size={13} />
                Plano de voo
              </Button>
            )}
            {acoes.checklistConcluido && (
              <PesoBalanceamentoFicha key={item.id} item={item} rotuloBotao="Peso e balanceamento" />
            )}
            {principal && IconePrincipal && (
              <Button
                type="button"
                size="sm"
                disabled={principal.desabilitado}
                onClick={principal.aoClicar}
                className="h-8 gap-1.5 rounded-lg text-xs font-bold"
              >
                <IconePrincipal size={14} />
                {principal.rotulo}
              </Button>
            )}
          </div>
        </div>

        {/* Faixa telemétrica unificada (Rota + Tempos UTC + Tripulação + ADS-B) */}
        <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-secondary/25 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Rota */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 lg:col-span-4">
            <div>
              <span className="block font-mono text-base font-black tracking-tight text-foreground">
                {item.origem || "—"}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Origem
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-primary bg-card" />
              <span className="h-0 flex-1 border-t border-dashed border-primary/50" />
              <Plane size={13} className="shrink-0 text-primary" />
              <span className="h-0 flex-1 border-t border-dashed border-primary/50" />
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            </div>

            <div className="text-right">
              <span className="block font-mono text-base font-black tracking-tight text-foreground">
                {item.destino || "—"}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Destino
              </span>
            </div>
          </div>

          {/* Tempos UTC */}
          <div className="grid grid-cols-4 items-center gap-1 px-3 py-2 text-center tabular-nums lg:col-span-4">
            {[
              { label: "Prev", val: previstoUtc ? `${previstoUtc}Z` : "—" },
              { label: "AC", val: acUtc ? `${acUtc}Z` : "--:--" },
              { label: "DEP", val: depUtc ? `${depUtc}Z` : "--:--" },
              { label: "POU", val: pouUtc ? `${pouUtc}Z` : "--:--" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg bg-card/80 px-1.5 py-1">
                <span className="block text-[10px] font-medium text-muted-foreground">{t.label}</span>
                <strong className="block font-mono text-xs font-bold text-foreground">{t.val}</strong>
              </div>
            ))}
          </div>

          {/* Tripulação */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 lg:col-span-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-[10px] font-bold text-primary">
                {iniciaisNome(nomeComandante)}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-bold text-foreground" title={nomeComandante || undefined}>
                  {nomeComandante || "CMD a definir"}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  CMD{comandanteReg?.canac ? ` · ${comandanteReg.canac}` : ""}
                  {nomeCopiloto ? ` · COP: ${nomeCopiloto.split(" ")[0]}` : ""}
                </span>
              </div>
            </div>

            {rastreio ? (
              <div className="flex shrink-0 items-center gap-2 text-right tabular-nums">
                <div className="hidden sm:block">
                  <span className="block font-mono text-[11px] font-bold text-foreground">
                    {rastreio.alt_ft != null ? `${rastreio.alt_ft.toLocaleString("pt-BR")}ft` : "—"} · {rastreio.gs_kt != null ? `${rastreio.gs_kt}kt` : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <Radio size={10} />
                    {rastreio.no_solo ? "ADS-B solo" : `ADS-B ${rastreio.rumo_graus != null ? `${rastreio.rumo_graus}°` : "voo"}`}
                  </span>
                </div>
              </div>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <Users size={12} />
                Escala
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Barra unificada: Abas internas + Stepper compacto */}
      <div className="flex flex-col gap-2 border-b border-border bg-secondary/35 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Seções do voo selecionado">
          {navAbas
            .filter((a) => a.visivel)
            .map(({ id, label, icone: Icone }) => {
              const ativo = etapa === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => trocarEtapa(id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                    ativo
                      ? "border-[#10263a]/20 bg-[#10263a] text-white shadow-sm dark:border-primary/40 dark:bg-primary dark:text-primary-foreground"
                      : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icone size={13} />
                  {label}
                </button>
              );
            })}
        </nav>

        {!agendamento ? (
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="Etapas da operação">
            {etapas.map((passo, indice) => (
              <li key={passo.id} className="flex items-center gap-1" aria-current={passo.estado === "atual" ? "step" : undefined}>
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold",
                    passo.estado === "feita"
                      ? "bg-emerald-600 text-white"
                      : passo.estado === "atual"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground",
                  )}
                >
                  {passo.estado === "feita" ? <Check size={10} /> : indice + 1}
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    passo.estado === "atual"
                      ? "font-bold text-foreground"
                      : passo.estado === "feita"
                        ? "font-semibold text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground",
                  )}
                >
                  {passo.rotulo}
                </span>
                {indice < etapas.length - 1 && <ChevronRight size={11} className="text-muted-foreground/50" />}
              </li>
            ))}
          </ol>
        ) : !podeAbrirJornada ? (
          <span className="text-[11px] text-muted-foreground">Conclua o check pré-voo para lançar horários.</span>
        ) : null}
      </div>

      {/* Conteúdo da aba selecionada */}
      <div className="p-4">
        {proxima && !agendamento && (
          <p className="mb-3 rounded-lg border border-border/70 bg-secondary/25 px-3 py-1.5 text-xs text-muted-foreground" role="status">
            {AJUDA[proxima]}
          </p>
        )}

        {etapa === "checklist" && (
          <ChecklistPreVoo
            item={item}
            aoAtualizarProgresso={setProgressoLocal}
            aoConcluir={async () => {
              await aoAtualizar();
            }}
          />
        )}

        {etapa === "jornada" && podeAbrirJornada && (
          <JornadaVoo
            item={operacao}
            agendamentoSelecionado={agendamento}
            aoAbrirAgendamento={aoAbrirAgendamento}
            modo="atualizar"
            permitirMapa={false}
            aoAtualizarAgendamento={aoAtualizar}
            aoFechar={() => trocarEtapa("checklist")}
          />
        )}

        {etapa === "mapa" && (
          <VoosDeHoje
            key={operacao.id}
            item={operacao}
            voosEmOperacao={voosAoVivo}
            carregandoAoVivo={carregandoAoVivo}
            erroAoVivo={erroAoVivo}
            atualizadoAoVivo={atualizadoAoVivo}
          />
        )}

        {etapa === "dados" && detalhesVoo}
      </div>
    </Container>
  );
}