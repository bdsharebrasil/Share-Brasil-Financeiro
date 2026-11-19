import { visualStatusAgendamento } from "@/components/agendamento/agendamentoVisual";
import PesoBalanceamentoFicha from "@/components/agendamento/PesoBalanceamentoFicha";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "@/components/agendamento/agendamentoCardFlow";
import { cn } from "@/lib/utils";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Grid,
  List,
  MoreVertical,
  Plane,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
  visao: VisaoCronograma;
  aoMudarBusca: (busca: string) => void;
  aoMudarFiltroStatus: (filtro: FiltroStatusCronograma) => void;
  aoMudarVisao: (visao: VisaoCronograma) => void;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
  aoHistorico: (item: SolicitacaoVooInterna) => void;
  aoConfirmar: (item: SolicitacaoVooInterna) => void;
  aoVoltar: () => void;
  aoChecklist: (item: SolicitacaoVooInterna) => void;
  aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
  aoExcluir: (item: SolicitacaoVooInterna) => void;
};

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatarHora(valor: string | null | undefined) {
  if (!valor) return "--:--";
  const texto = String(valor).trim();
  const parte = texto.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : texto.slice(0, 5);
}

function extrairIniciais(nome: string | null | undefined): string {
  if (!nome) return "TR";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
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
  aoMudarVisao,
  aoAbrir,
  aoHistorico,
  aoConfirmar,
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
    <section className="overflow-hidden rounded-2xl border border-[#e4e8ef] bg-white shadow-sm">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col gap-4 border-b border-[#e4e8ef] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold tracking-tight text-[#172033]">{titulo}</h2>
            <span className="rounded-full bg-[#f1b950]/15 px-3 py-0.5 text-xs font-bold text-[#b47b1c]">
              {solicitacoes.length} {solicitacoes.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#778195]">{selecionada ? "Agendamento selecionado" : detalhe}</p>
        </div>

        {selecionada ? (
          <Button
            type="button"
            variant="outline"
            onClick={aoVoltar}
            className="h-9 gap-1.5 border-[#e4e8ef] bg-white text-xs font-semibold text-[#172033] hover:bg-[#f3f5f8]"
          >
            <ChevronLeft size={15} /> Voltar à lista
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            {mostrarFiltros && (
              <div className="flex items-center gap-1 rounded-lg border border-[#e4e8ef] bg-[#f8f9fb] p-1 text-[11px] font-semibold text-[#778195]">
                <button
                  type="button"
                  onClick={() => aoMudarFiltroStatus("todos")}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    filtroStatus === "todos" ? "bg-white text-[#172033] shadow-sm" : "hover:text-[#172033]"
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => aoMudarFiltroStatus("pendente")}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    filtroStatus === "pendente" ? "bg-white text-[#172033] shadow-sm" : "hover:text-[#172033]"
                  }`}
                >
                  Pendentes
                </button>
                <button
                  type="button"
                  onClick={() => aoMudarFiltroStatus("aprovada")}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    filtroStatus === "aprovada" ? "bg-white text-[#172033] shadow-sm" : "hover:text-[#172033]"
                  }`}
                >
                  Aprovadas
                </button>
                <button
                  type="button"
                  onClick={() => aoMudarFiltroStatus("encerrada")}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    filtroStatus === "encerrada" ? "bg-white text-[#172033] shadow-sm" : "hover:text-[#172033]"
                  }`}
                >
                  Encerradas
                </button>
              </div>
            )}

            <div className="relative min-w-[220px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#778195]" />
              <Input
                value={busca}
                onChange={(e) => aoMudarBusca(e.target.value)}
                placeholder="Buscar cliente, rota ou voo..."
                className="h-9 w-full rounded-lg border-[#e4e8ef] bg-[#f8f9fb] pl-9 text-xs focus-visible:ring-1 focus-visible:ring-[#3867ed]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Lista de Solicitações / Voos */}
      {solicitacoesVisiveis.length ? (
        <div className="divide-y divide-[#e4e8ef]">
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
              aoChecklist={aoChecklist}
              aoJornada={aoJornada}
              aoFinalizar={aoFinalizar}
              aoExcluir={aoExcluir}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <ShieldCheck size={32} className="text-[#778195]/40" />
          <strong className="mt-3 block text-sm font-bold text-[#172033]">Nenhuma solicitação encontrada</strong>
          <span className="text-xs text-[#778195]">Ajuste a busca ou filtros para visualizar os agendamentos.</span>
        </div>
      )}

      {/* Rodapé com Paginação */}
      {!selecionada && solicitacoes.length > porPagina && (
        <div className="flex items-center justify-between border-t border-[#e4e8ef] p-4 text-xs text-[#778195]">
          <span>
            {inicio + 1}–{Math.min(inicio + porPagina, solicitacoes.length)} de {solicitacoes.length} voos
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaAtual === 1}
              onClick={() => setPagina(paginaAtual - 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[#e4e8ef] bg-white text-[#172033] hover:bg-[#f3f5f8] disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono font-bold text-[#172033]">
              {paginaAtual} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual === totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[#e4e8ef] bg-white text-[#172033] hover:bg-[#f3f5f8] disabled:opacity-40"
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
  aoChecklist,
  aoJornada,
  aoFinalizar,
  aoExcluir,
  progressoChecklist,
  checklistAberto,
}: {
  item: SolicitacaoVooInterna;
  nomesTripulantes: Map<string, string>;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
  aoHistorico: (item: SolicitacaoVooInterna) => void;
  aoConfirmar: (item: SolicitacaoVooInterna) => void;
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
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const pilotoNome = item.piloto_nome || (item.piloto_id ? nomesTripulantes.get(item.piloto_id) : null);
  const copilotoNome = item.copiloto_nome || (item.copiloto_id ? nomesTripulantes.get(item.copiloto_id) : null);
  const tripulacaoFormatada = [pilotoNome, copilotoNome].filter(Boolean).join(" · ") || "Tripulação a definir";

  return (
    <article className="flex flex-col gap-4 p-5 transition-colors hover:bg-[#f8f9fb]/80 sm:flex-row sm:items-center sm:justify-between">
      {/* Coluna Esquerda: Identificação e Cliente */}
      <div className="min-w-[190px]">
        <span className="font-mono text-[11px] font-bold tracking-wider text-[#778195] uppercase">
          {item.numero_voo || (pendente ? `SOL-${item.id.slice(0, 4).toUpperCase()}` : item.matricula_registro || "Voo a definir")}
        </span>
        <strong className="mt-0.5 block text-sm font-bold text-[#172033]">{cliente}</strong>
        {pendente ? (
          <p className="mt-0.5 text-xs text-[#778195]">
            {formatarData(item.data_agendada)} · {item.numero_passageiros || 1} pax · {item.matricula_registro || "Aeronave a definir"}
          </p>
        ) : (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#17885f]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#17885f]">
            <Check size={11} /> Tripulação escalada
          </span>
        )}
      </div>

      {/* Coluna Central: Trajeto com Avião */}
      <div className="flex items-center justify-center gap-4 py-2 sm:py-0">
        <div className="text-center">
          <strong className="block font-mono text-sm font-bold text-[#172033]">
            {formatarHora(item.horario_previsto_agendamento)}
          </strong>
          <span className="font-mono text-[11px] font-semibold text-[#778195] uppercase">{item.origem}</span>
        </div>

        <div className="relative flex w-28 items-center justify-center border-t-2 border-dashed border-[#cbd5e1] sm:w-36">
          <div className="rounded-full bg-white px-2 text-[#778195]">
            <Plane size={15} className="rotate-90 text-[#778195]" />
          </div>
        </div>

        <div className="text-center">
          <strong className="block font-mono text-sm font-bold text-[#172033]">
            {item.perna_atual_horario_pouso ? formatarHora(item.perna_atual_horario_pouso) : "--:--"}
          </strong>
          <span className="font-mono text-[11px] font-semibold text-[#778195] uppercase">{item.destino}</span>
        </div>
      </div>

      {/* Coluna Direita: Ações ou Tripulação */}
      <div className="flex items-center justify-end gap-3">
        {pendente ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#778195]">
              <Clock3 size={13} />
              <span>
                Prazo <strong className="text-[#172033]">{formatarData(item.data_agendada)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => aoConfirmar(item)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#bf5260]/30 bg-white px-3.5 text-xs font-semibold text-[#bf5260] transition-colors hover:bg-[#fff1f2]"
            >
              <X size={14} /> Recusar
            </button>
            <button
              type="button"
              onClick={() => aoConfirmar(item)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3867ed] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#2959df]"
            >
              <Check size={14} /> Aprovar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#405274] font-mono text-[10px] font-bold text-white shadow-sm">
                {extrairIniciais(pilotoNome)}
              </span>
              {copilotoNome && (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#63728f] font-mono text-[10px] font-bold text-white shadow-sm">
                  {extrairIniciais(copilotoNome)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => aoAbrir(item)}
              className="flex items-center gap-1.5 text-left text-xs transition-colors hover:text-[#3867ed]"
            >
              <div>
                <span className="block text-[10px] text-[#778195]">Tripulação</span>
                <strong className="block font-bold text-[#172033]">{tripulacaoFormatada}</strong>
              </div>
              <ChevronRight size={16} className="text-[#778195]" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => aoExcluir(item)}
          title="Excluir agendamento"
          className="grid h-8 w-8 place-items-center rounded-lg text-[#778195] transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
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

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {acoes.mostrarChecklist && (
        <Button
          type="button"
          onClick={() => aoChecklist(item)}
          className="h-10 gap-2 rounded-lg border border-[#3867ed]/30 bg-[#3867ed]/10 text-xs font-bold text-[#3867ed] hover:bg-[#3867ed]/20"
        >
          {acoes.checklistLabel}
        </Button>
      )}

      {acoes.mostrarJornada && (
        <Button
          type="button"
          onClick={() => (jornadaConcluida ? aoFinalizar(item) : aoJornada(item))}
          className="h-10 gap-2 rounded-lg border border-[#f1b950] bg-[#f1b950]/15 text-xs font-bold text-[#935a0d] hover:bg-[#f1b950]/25"
        >
          {acoes.jornadaLabel}
        </Button>
      )}

      {acoes.checklistConcluido && (
        <div className="[&>button]:h-10 [&>button]:rounded-lg [&>button]:border-[#e4e8ef] [&>button]:text-xs [&>button]:font-semibold">
          <PesoBalanceamentoFicha item={item} />
        </div>
      )}

      {acoes.historico && (
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17885f]/10 px-4 text-xs font-bold text-[#17885f]">
          <Check size={15} /> Operação concluída
        </span>
      )}
    </div>
  );
}
