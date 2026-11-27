import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "@/components/agendamento/agendamentoCardFlow";
import { CLASSE_TOM_STATUS, podeExcluirAgendamento, rotuloStatusAgenda, urgenciaVoo } from "@/components/agendamento/agendamentoFluxo";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { Check, ChevronLeft, ChevronRight, FileText, MoreVertical, Plane, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export type FiltroStatusCronograma = "todos" | "pendente" | "aprovada" | "em_voo" | "encerrada";
export type VisaoCronograma = "grid" | "lista";

type PropsCronograma = {
  titulo: string;
  detalhe: string;
  mostrarFiltros: boolean;
  selecionada: SolicitacaoVooInterna | null;
  progressoChecklistPorId: Record<string, number>;
  checklistAberto: boolean;
  solicitacoes: SolicitacaoVooInterna[];
  nomesTripulantes: Map<string, string>;
  busca: string;
  filtroStatus: FiltroStatusCronograma;
  visao?: VisaoCronograma;
  aoMudarBusca: (busca: string) => void;
  aoMudarFiltroStatus: (filtro: FiltroStatusCronograma) => void;
  aoMudarVisao?: (visao: VisaoCronograma) => void;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
  aoHistorico: (item: SolicitacaoVooInterna) => void;
  aoConfirmar: (item: SolicitacaoVooInterna) => void;
  aoRecusar: (item: SolicitacaoVooInterna) => void;
  aoVoltar: () => void;
  aoChecklist: (item: SolicitacaoVooInterna) => void;
  aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
  aoExcluir: (item: SolicitacaoVooInterna) => void;
};

function formatarDataCurta(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

function formatarHora(valor: string | null | undefined) {
  if (!valor) return "--:--";
  const texto = String(valor).trim();
  const parte = texto.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : texto.slice(0, 5);
}

export function Cronograma({
  titulo,
  detalhe,
  mostrarFiltros,
  selecionada,
  progressoChecklistPorId,
  checklistAberto,
  solicitacoes,
  nomesTripulantes,
  busca,
  filtroStatus,
  visao,
  aoMudarBusca,
  aoMudarFiltroStatus,
  aoAbrir,
  aoHistorico,
  aoConfirmar,
  aoRecusar,
  aoVoltar,
  aoChecklist,
  aoJornada,
  aoFinalizar,
  aoExcluir,
}: PropsCronograma) {
  const [pagina, setPagina] = useState(1);
  const porPagina = 8;
  const totalPaginas = Math.max(1, Math.ceil(solicitacoes.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const solicitacoesVisiveis = selecionada ? [selecionada] : solicitacoes.slice(inicio, inicio + porPagina);

  useEffect(() => setPagina(1), [busca, filtroStatus, visao]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold tracking-tight text-foreground">{titulo}</h2>
            <span className="rounded-full bg-[#f1b950]/15 px-2.5 py-0.5 text-xs font-bold text-[#b47b1c]">
              {solicitacoes.length} {solicitacoes.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{selecionada ? "Agendamento selecionado" : detalhe}</p>
        </div>

        {selecionada ? (
          <Button
            type="button"
            variant="outline"
            onClick={aoVoltar}
            className="h-8 gap-1.5 border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <ChevronLeft size={14} /> Voltar à lista
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {mostrarFiltros && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-0.5 text-xs font-semibold text-muted-foreground">
                {(
                  [
                    ["todos", "Todas"],
                    ["pendente", "Pendentes"],
                    ["aprovada", "Aprovadas"],
                    ["encerrada", "Encerradas"],
                  ] as const
                ).map(([chave, label]) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => aoMudarFiltroStatus(chave)}
                    className={`h-7 rounded-md px-2.5 transition-all ${
                      filtroStatus === chave ? "bg-card font-bold text-foreground shadow-2xs" : "hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative min-w-[210px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => aoMudarBusca(e.target.value)}
                placeholder="Buscar cliente, rota ou voo..."
                className="h-9 w-full rounded-lg border-border bg-secondary/40 pl-9 text-xs focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {solicitacoesVisiveis.length ? (
        <div className="divide-y divide-border">
          {solicitacoesVisiveis.map((item) => (
            <LinhaSolicitacao
              key={item.id}
              item={item}
              nomesTripulantes={nomesTripulantes}
              progressoChecklist={progressoChecklistPorId[item.id] ?? calcularProgressoChecklist(item)}
              checklistAberto={checklistAberto && selecionada?.id === item.id}
              aoAbrir={aoAbrir}
              aoHistorico={aoHistorico}
              aoConfirmar={aoConfirmar}
              aoRecusar={aoRecusar}
              aoChecklist={aoChecklist}
              aoJornada={aoJornada}
              aoFinalizar={aoFinalizar}
              aoExcluir={aoExcluir}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <ShieldCheck size={28} className="text-muted-foreground/40" />
          <strong className="mt-2.5 block text-sm font-bold text-foreground">Nenhuma solicitação encontrada</strong>
          <span className="mt-0.5 text-xs text-muted-foreground">Ajuste a busca ou filtros para visualizar os agendamentos.</span>
        </div>
      )}

      {!selecionada && solicitacoes.length > porPagina && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {inicio + 1}–{Math.min(inicio + porPagina, solicitacoes.length)} de {solicitacoes.length} voos
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={paginaAtual === 1}
              onClick={() => setPagina(paginaAtual - 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono font-bold text-foreground">
              {paginaAtual} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual === totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function LinhaSolicitacao({
  item,
  nomesTripulantes,
  aoAbrir,
  aoHistorico,
  aoConfirmar,
  aoRecusar,
  aoExcluir,
}: {
  item: SolicitacaoVooInterna;
  nomesTripulantes: Map<string, string>;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
  aoHistorico: (item: SolicitacaoVooInterna) => void;
  aoConfirmar: (item: SolicitacaoVooInterna) => void;
  aoRecusar: (item: SolicitacaoVooInterna) => void;
  aoChecklist: (item: SolicitacaoVooInterna) => void;
  aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
  aoExcluir: (item: SolicitacaoVooInterna) => void;
  progressoChecklist: number;
  checklistAberto: boolean;
}) {
  const cliente =
    item.voo_emprestado !== "nao" && item.socio_emprestimo_nome
      ? item.socio_emprestimo_nome
      : item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Cliente não informado";

  const pendente = String(item.status || "").trim().toLowerCase() === "pendente";
  const pilotoNome = item.piloto_nome || (item.piloto_id ? nomesTripulantes.get(item.piloto_id) : null);
  const copilotoNome = item.copiloto_nome || (item.copiloto_id ? nomesTripulantes.get(item.copiloto_id) : null);
  const { rotulo: rotuloStatus, tom } = rotuloStatusAgenda(item.status);
  const urgencia = pendente ? urgenciaVoo(item.data_agendada.slice(0, 10), hojeBrasilia()) : null;
  const dataCompleta = formatarDataCurta(item.data_agendada);

  return (
    <article
      className={`flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-secondary/50 lg:flex-row lg:items-center lg:justify-between ${
        pendente ? "bg-amber-500/[.03]" : ""
      }`}
    >
      {/* 1) QUEM e QUANDO */}
      <div className="min-w-0 flex-1 lg:max-w-[290px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {item.numero_voo || (pendente ? `SOL-${item.id.slice(0, 4).toUpperCase()}` : "Voo a definir")} · {dataCompleta}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${CLASSE_TOM_STATUS[tom]}`}>{rotuloStatus}</span>
        </div>
        <strong className="mt-0.5 block truncate text-sm font-bold leading-snug text-foreground" title={cliente}>
          {cliente}
        </strong>
        <p className="text-xs text-muted-foreground">
          {item.matricula_registro || "Aeronave a definir"} · {item.numero_passageiros || 1} pax
          {item.solicitacao_origem_id && <span className="ml-1.5 font-semibold text-primary">· Mesma operação</span>}
        </p>
      </div>

      {/* 2) ONDE */}
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-center">
        <div className="text-center">
          <strong className="block font-mono text-sm font-bold leading-tight text-foreground">
            {formatarHora(item.horario_previsto_agendamento)}
            <small className="ml-1 text-[10px] font-semibold text-muted-foreground">UTC</small>
          </strong>
          <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
            {item.perna_atual_origem || item.origem}
          </span>
        </div>

        <div className="relative flex w-20 items-center justify-center border-t border-dashed border-border sm:w-28">
          <div className="rounded-full bg-card px-1.5 text-muted-foreground">
            <Plane size={14} className="rotate-45 text-muted-foreground" />
          </div>
        </div>

        <div className="text-center">
          <strong className="block font-mono text-sm font-bold leading-tight text-foreground">
            {item.perna_atual_horario_pouso ? formatarHora(item.perna_atual_horario_pouso) : "--:--"}
          </strong>
          <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
            {item.perna_atual_destino || item.destino}
          </span>
          {(item.perna_atual_horario_corte || item.horario_corte) && (
            <span className="block font-mono text-[10px] text-muted-foreground">
              COR {formatarHora(item.perna_atual_horario_corte || item.horario_corte)}
            </span>
          )}
        </div>
      </div>

      {/* 3) O QUE FAZER */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pendente ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {urgencia && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                  urgencia.urgente ? CLASSE_TOM_STATUS.vermelho : CLASSE_TOM_STATUS.neutro
                }`}
              >
                {urgencia.rotulo}
              </span>
            )}
            <button
              type="button"
              onClick={() => aoRecusar(item)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/35 bg-card px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300"
            >
              <X size={13} /> Recusar
            </button>
            <button
              type="button"
              onClick={() => aoConfirmar(item)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-2xs transition-all hover:bg-primary/90"
            >
              <Check size={13} /> Analisar e aprovar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => aoAbrir(item)}
            aria-label={`Abrir detalhes do voo ${item.numero_voo || ""}`.trim()}
            className="flex min-h-[38px] items-center gap-2.5 rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1 text-left transition-colors hover:border-border hover:bg-secondary"
          >
            <div className="min-w-0 max-w-[220px]">
              <span className="block truncate text-[11px] font-bold leading-tight text-foreground" title={pilotoNome || "Comandante a definir"}>
                CMTE · {pilotoNome || "A definir"}
              </span>
              <span
                className="block truncate text-[11px] leading-tight text-muted-foreground"
                title={copilotoNome || "Copiloto não escalado"}
              >
                COPI · {copilotoNome || "Não escalado"}
              </span>
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
              Abrir
              <ChevronRight size={14} />
            </span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais ações"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MoreVertical size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => aoAbrir(item)}>Abrir detalhes</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => aoHistorico(item)}>Histórico operacional</DropdownMenuItem>
            {podeExcluirAgendamento(item) && (
              <DropdownMenuItem onSelect={() => aoExcluir(item)} className="text-red-600 focus:text-red-700">
                <Trash2 size={14} className="mr-2" /> Excluir agendamento
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export function AcoesDetalhe({
  item,
  aoChecklist,
  aoJornada,
  aoFinalizar,
  progressoChecklist,
  checklistAberto,
}: {
  item: SolicitacaoVooInterna;
  aoChecklist: (item: SolicitacaoVooInterna) => void;
  aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
  progressoChecklist: number;
  checklistAberto: boolean;
}) {
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const jornadaConcluida = Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0;
  const status = String(item.status || "").trim().toLowerCase();
  const rotuloJornada =
    status === "em_solo" && !jornadaConcluida
      ? "Nova perna ou encerrar"
      : ["decolado", "em_rota", "em_voo"].includes(status)
        ? "Atualizar horários / pouso"
        : acoes.jornadaLabel.charAt(0) + acoes.jornadaLabel.slice(1).toLowerCase();
  const rotuloCheck = acoes.checklistLabel.charAt(0) + acoes.checklistLabel.slice(1).toLowerCase();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {acoes.mostrarChecklist && (
        <Button type="button" onClick={() => aoChecklist(item)} className="h-9 gap-1.5 rounded-lg text-xs font-bold">
          {rotuloCheck}
        </Button>
      )}

      {acoes.mostrarJornada && (
        <Button
          type="button"
          variant="outline"
          onClick={() => (jornadaConcluida ? aoFinalizar(item) : aoJornada(item))}
          className="h-9 gap-1.5 rounded-lg border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
        >
          {rotuloJornada}
        </Button>
      )}

      {acoes.historico && (
        <Button type="button" variant="outline" onClick={() => aoJornada(item)} className="h-9 gap-1.5 rounded-lg text-xs">
          <FileText size={14} /> Ver histórico de voo
        </Button>
      )}
    </div>
  );
}