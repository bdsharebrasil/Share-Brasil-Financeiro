import "@/components/agendamento/agendamento-layout.css";
import { visualStatusAgendamento } from "@/components/agendamento/agendamentoVisual";
import { CabecalhoSecao, EtiquetaStatus, EstadoVazio } from "@/components/dashboard/ComponentesDashboard";
import PesoBalanceamentoFicha from "@/components/agendamento/PesoBalanceamentoFicha";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "@/components/agendamento/agendamentoCardFlow";
import { cn } from "@/lib/utils";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { Check, ChevronLeft, ChevronRight, ClipboardList, List, MoreVertical, Search, Trash2 } from "lucide-react";
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

/* Estilos isolados das ações dos cards do cronograma. */
const estiloCartao = {
  base: "inline-flex min-h-12 min-w-0 w-full items-center justify-center whitespace-normal rounded-xl border px-2 py-2 text-center text-[10px] font-semibold leading-tight [overflow-wrap:anywhere] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
  abrir: "border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700",
  confirmar: "border-emerald-600 bg-emerald-300/50 text-emerald-950 hover:bg-emerald-300/70 dark:border-emerald-500 dark:bg-emerald-600/25 dark:text-emerald-100 dark:hover:bg-emerald-600/40",
  checklistIniciar: "border-sky-600 bg-sky-100 text-sky-900 hover:bg-sky-200 dark:border-sky-500/50 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900/60",
  checklistAndamento: "border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60",
  concluido: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800",
  jornada: "border-amber-600 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-[#b8893c] dark:bg-[#332a18] dark:text-[#f6d38a] dark:shadow-none dark:hover:border-[#d3a653] dark:hover:bg-[#40331d]",
  finalizar: "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
  menu: "inline-flex h-full min-h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
  operacaoConcluida: "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap text-[11px] font-semibold text-emerald-700 dark:text-[#86c23e]",
  lixeira: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:text-red-400",
} as const;

const estiloDetalhe = {
  base: "inline-flex h-11 min-w-[180px] flex-1 items-center justify-center whitespace-nowrap rounded-lg border px-4 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
  checklistIniciar: "border-sky-600 bg-sky-100 text-sky-900 hover:bg-sky-200 dark:border-sky-500/50 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900/60",
  checklistAndamento: "border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60",
  concluido: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800",
  jornada: "border-amber-600 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-[#b8893c] dark:bg-[#332a18] dark:text-[#f6d38a] dark:shadow-none dark:hover:border-[#d3a653] dark:hover:bg-[#40331d]",
  finalizar: "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
  verChecklist: "border-primary/40 bg-transparent text-foreground hover:bg-primary/15",
  operacaoConcluida: "inline-flex h-11 min-w-[180px] flex-1 items-center justify-center gap-2 whitespace-nowrap text-xs font-semibold text-emerald-700 dark:text-[#86c23e]",
  pesoWrapper: "min-w-[180px] flex-1 [&>button]:h-11 [&>button]:w-full",
} as const;

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function tomStatus(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "aprovada") return "green";
  if (status === "acionado") return "amber";
  if (status === "decolado" || status === "em_voo" || status === "em_rota") return "blue";
  if (status === "em_solo") return "green";
  if (status === "reprovada" || status === "cancelada") return "red";
  if (status === "pendente") return "amber";
  return "neutral";
}

function statusLabel(status: string) {
  return ({ folga: "Folga", atestado_medico: "Atestado médico", treinamento: "Treinamento", acompanhando_manutencao: "Acompanhando manutenção", pendente: "Pendente", aprovada: "Aprovada", acionado: "Acionado", decolado: "Decolado", em_rota: "Decolado", em_voo: "Decolado", em_solo: "Em solo · pousado", encerrada: "Encerrada", reprovada: "Reprovada", cancelada: "Cancelada" } as Record<string, string>)[status] || status;
}

export function Cronograma({ titulo, detalhe, mostrarFiltros, selecionada, progressoChecklistPorId, checklistAberto, solicitacoes, nomesTripulantes, busca, filtroStatus, visao, aoMudarBusca, aoMudarFiltroStatus, aoMudarVisao, aoAbrir, aoHistorico, aoConfirmar, aoVoltar, aoChecklist, aoJornada, aoFinalizar, aoExcluir }: PropsCronograma) {
  const [pagina, setPagina] = useState(1);
  const calcularLimite = () => ({ grade: (window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1) * (window.innerHeight >= 760 ? 2 : 1), lista: Math.max(2, Math.min(6, Math.floor((window.innerHeight - 340) / 78))) });
  const [limite, setLimite] = useState(calcularLimite);
  useEffect(() => { const atualizar = () => setLimite(calcularLimite()); window.addEventListener("resize", atualizar); return () => window.removeEventListener("resize", atualizar); }, []);
  useEffect(() => setPagina(1), [busca, filtroStatus, visao, limite.grade, limite.lista]);
  const porPagina = visao === "grid" ? limite.grade : limite.lista;
  const totalPaginas = Math.max(1, Math.ceil(solicitacoes.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const solicitacoesVisiveis = selecionada ? [selecionada] : solicitacoes.slice(inicio, inicio + porPagina);
  const classeFiltro = (ativo: boolean) => `overflow-hidden rounded-[6px] px-2 py-1 text-[9px] font-bold ${ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`;

  return <section className="agendamento-cronograma overflow-hidden rounded-xl border border-border bg-card/75">
    <CabecalhoSecao icon={<ClipboardList size={15} />} title={titulo} detail={selecionada ? "Agendamento selecionado" : detalhe} action={selecionada ? <Button type="button" variant="outline" onClick={aoVoltar} className="h-8 gap-1.5 border-border bg-card px-3 text-[10px]"><ChevronLeft size={13} /> Voltar</Button> : <div className="flex flex-wrap items-center justify-end gap-2">
      {mostrarFiltros && <div className="agendamento-status-filters flex overflow-hidden rounded-[7px] border border-border p-0.5" role="group" aria-label="Filtrar solicitações por status">
        <button type="button" onClick={() => aoMudarFiltroStatus("pendente")} aria-pressed={filtroStatus === "pendente"} className={classeFiltro(filtroStatus === "pendente")}>Pendente</button>
        <button type="button" onClick={() => aoMudarFiltroStatus("aprovada")} aria-pressed={filtroStatus === "aprovada"} className={classeFiltro(filtroStatus === "aprovada")}>Aprovada</button>
        <button type="button" onClick={() => aoMudarFiltroStatus("em_voo")} aria-pressed={filtroStatus === "em_voo"} className={classeFiltro(filtroStatus === "em_voo")}>Em Voo / Em Solo</button>
        <button type="button" onClick={() => aoMudarFiltroStatus("encerrada")} aria-pressed={filtroStatus === "encerrada"} className={classeFiltro(filtroStatus === "encerrada")}>Encerrado</button>
        <button type="button" onClick={() => aoMudarFiltroStatus("todos")} aria-pressed={filtroStatus === "todos"} className={classeFiltro(filtroStatus === "todos")}>Todas</button>
      </div>}
      <div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => aoMudarBusca(event.target.value)} placeholder="Buscar cliente, rota ou voo" className="h-8 w-full pl-8 text-[10px] sm:w-56" /></div>
      <div className="flex overflow-hidden rounded-[5px] border border-border p-0.5" role="group" aria-label="Alternar visualização">
        <button type="button" onClick={() => aoMudarVisao("grid")} aria-label="Visualizar em grade" aria-pressed={visao === "grid"} className={`rounded p-1.5 ${visao === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /></svg></button>
        <button type="button" onClick={() => aoMudarVisao("lista")} aria-label="Visualizar em lista" aria-pressed={visao === "lista"} className={`rounded p-1.5 ${visao === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><List size={14} /></button>
      </div>
    </div>} />
    {solicitacoesVisiveis.length ? <div className={visao === "grid" ? "agenda-voos agenda-voos-grade" : "agenda-voos agenda-voos-lista"}>{solicitacoesVisiveis.map((item) => <CartaoCronograma key={item.id} item={item} nomesTripulantes={nomesTripulantes} progressoChecklist={progressoChecklistPorId[item.id] ?? calcularProgressoChecklist(item)} checklistAberto={checklistAberto && selecionada?.id === item.id} aoAbrir={aoAbrir} aoHistorico={aoHistorico} aoConfirmar={aoConfirmar} aoChecklist={aoChecklist} aoJornada={aoJornada} aoFinalizar={aoFinalizar} aoExcluir={aoExcluir} />)}</div> : <EstadoVazio label="Nenhuma solicitação encontrada" />}
    {!selecionada && solicitacoes.length > 0 && <footer className="agenda-paginacao" aria-label="Paginação dos voos"><span>{inicio + 1}–{Math.min(inicio + porPagina, solicitacoes.length)} de {solicitacoes.length} voos</span><div><button type="button" aria-label="Página anterior de voos" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft size={14} /></button><span aria-live="polite">{paginaAtual} / {totalPaginas}</span><button type="button" aria-label="Próxima página de voos" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight size={14} /></button></div></footer>}
  </section>;
}

type PropsCartao = {
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
};

function CaixaInfo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="flex min-h-[68px] min-w-0 flex-col rounded-xl border border-[rgba(79,84,92,0.5)] bg-background/25 p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{rotulo}</span>{children}</div>;
}

function CartaoCronograma({ item, nomesTripulantes, aoAbrir, aoHistorico, aoConfirmar, aoChecklist, aoJornada, aoFinalizar, aoExcluir, progressoChecklist, checklistAberto }: PropsCartao) {
  const cliente = item.voo_emprestado !== "nao" && item.socio_emprestimo_nome ? item.socio_emprestimo_nome : item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Cliente não informado";
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const tripulacao = [item.piloto_nome || (item.piloto_id ? nomesTripulantes.get(item.piloto_id) : null), item.copiloto_nome || (item.copiloto_id ? nomesTripulantes.get(item.copiloto_id) : null)].filter(Boolean).join(" / ") || "A definir";
  const statusCartao = String(item.status || "").trim().toLowerCase();
  const bordaStatus = statusCartao === "aprovada" ? "border-[rgba(14,153,12,0.89)]" : statusCartao === "encerrada" ? "border-slate-500 dark:border-slate-400" : visualStatusAgendamento(item.status).borda;
  return <article className={`agendamento-card group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border ${bordaStatus} bg-card p-4 transition-all duration-200 hover:-translate-y-0.5`}>
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3"><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">Agendamento de voo</p><p className="mt-1 truncate font-mono text-sm font-bold tracking-tight text-primary">{item.numero_voo || "A gerar na confirmação"}</p><p className="mt-1 truncate text-[11px] font-semibold text-foreground">{cliente}</p></div><div className="flex shrink-0 items-center gap-1.5"><EtiquetaStatus tone={tomStatus(item.status)} className="text-[8px]">{acoes.historico ? "Encerrada" : statusLabel(item.status)}</EtiquetaStatus><button type="button" onClick={() => aoExcluir(item)} aria-label="Excluir agendamento" title="Excluir agendamento" className={estiloCartao.lixeira}><Trash2 size={15} /></button></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2.5 max-[379px]:grid-cols-1"><CaixaInfo rotulo="Rota"><strong className="mt-1 block truncate font-mono text-xs text-foreground">{item.origem} <span className="text-primary">→</span> {item.destino}</strong></CaixaInfo><CaixaInfo rotulo="Período"><strong className="mt-1 block text-xs leading-snug text-foreground">{formatarData(item.data_agendada)}{item.data_fim && item.data_fim !== item.data_agendada ? ` a ${formatarData(item.data_fim)}` : ""}</strong></CaixaInfo><CaixaInfo rotulo="Aeronave"><strong className="mt-1 block truncate font-mono text-xs text-foreground">{item.matricula_registro || "A definir"}</strong></CaixaInfo><CaixaInfo rotulo="Tripulação"><strong className="mt-1 line-clamp-2 break-words text-xs leading-snug text-foreground">{tripulacao}</strong></CaixaInfo></div>
    <AcoesCartao item={item} aoAbrir={aoAbrir} aoHistorico={aoHistorico} aoConfirmar={aoConfirmar} aoChecklist={aoChecklist} aoJornada={aoJornada} aoFinalizar={aoFinalizar} progressoChecklist={progressoChecklist} checklistAberto={checklistAberto} />
  </article>;
}

function AcoesCartao({ item, aoAbrir, aoHistorico, aoConfirmar, aoChecklist, aoJornada, aoFinalizar, progressoChecklist, checklistAberto }: {
  item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void; aoHistorico: (item: SolicitacaoVooInterna) => void; aoConfirmar: (item: SolicitacaoVooInterna) => void;
  aoChecklist: (item: SolicitacaoVooInterna) => void; aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void; progressoChecklist: number; checklistAberto: boolean;
}) {
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const [pesoAberto, setPesoAberto] = useState(false);
  const pendente = String(item.status || "").trim().toLowerCase() === "pendente";
  const jornadaConcluida = Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0;
  const checklistInicial = acoes.checklistLabel === "INICIAR CHECKLIST";
  const e = estiloCartao;
  const temPrincipal = !pendente && (acoes.mostrarJornada || acoes.mostrarChecklist);
  const temMenu = !pendente && (acoes.mostrarChecklist || acoes.checklistConcluido);
  const colunas = pendente ? "minmax(0, 0.8fr) minmax(0, 1.2fr)" : temPrincipal && temMenu ? "minmax(0, 0.8fr) minmax(0, 1.5fr) 2.5rem" : temPrincipal ? "minmax(0, 0.8fr) minmax(0, 1.5fr)" : temMenu ? "minmax(0, 1fr) 2.5rem" : "minmax(0, 1fr)";

  return <div className="mt-auto min-w-0 pt-4"><div className="grid min-w-0 items-stretch gap-2" style={{ gridTemplateColumns: colunas }}>
    <button type="button" onClick={() => (acoes.jornadaIniciada ? aoHistorico(item) : aoAbrir(item))} className={cn(e.base, e.abrir)}>{acoes.abrirLabel}</button>
    {pendente && <button type="button" onClick={() => aoConfirmar(item)} title="Confirmar agendamento" className={cn(e.base, e.confirmar)}>CONFIRMAR</button>}
    {!pendente && acoes.mostrarJornada && <button type="button" onClick={() => (jornadaConcluida ? aoFinalizar(item) : aoJornada(item))} className={cn(e.base, jornadaConcluida ? e.concluido : e.jornada)}>{acoes.jornadaLabel}</button>}
    {!pendente && acoes.mostrarChecklist && !acoes.mostrarJornada && <button type="button" onClick={() => aoChecklist(item)} className={cn(e.base, acoes.checklistConcluido ? acoes.preparacaoPendencias ? "border-amber-400/60 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100" : e.concluido : checklistInicial ? e.checklistIniciar : e.checklistAndamento)}>{acoes.checklistLabel}</button>}
    {temMenu && <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Ações do voo" title="Ações do voo" className={e.menu}><MoreVertical size={16} /></button></DropdownMenuTrigger><DropdownMenuContent align="end">{acoes.mostrarChecklist && <DropdownMenuItem onSelect={() => aoChecklist(item)}>Ver preparação / briefing</DropdownMenuItem>}{acoes.checklistConcluido && <DropdownMenuItem onSelect={() => setPesoAberto(true)}>Gerar peso e balanceamento</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>}
  </div>
  {/* O diálogo controlado continua montado; seu acionador fica no menu. */}
  {acoes.checklistConcluido && <div className="[&>button]:hidden"><PesoBalanceamentoFicha item={item} aberto={pesoAberto} aoAlterarAberto={setPesoAberto} /></div>}
  {acoes.historico && <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"><Check size={13} /> Operação concluída</p>}
  </div>;
}

export function AcoesDetalhe({ item, aoChecklist, aoJornada, aoFinalizar, progressoChecklist, checklistAberto }: {
  item: SolicitacaoVooInterna;
  aoChecklist: (item: SolicitacaoVooInterna) => void; aoJornada: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void; progressoChecklist: number; checklistAberto: boolean;
}) {
  const acoes = obterAcoesAgendamento(item, progressoChecklist, checklistAberto);
  const jornadaConcluida = Number(item.jornadas_encerradas || 0) > 0 && Number(item.jornadas_abertas || 0) === 0;
  const checklistInicial = acoes.checklistLabel === "INICIAR CHECKLIST";
  const e = estiloDetalhe;

  return <div className="mt-3 flex flex-wrap items-stretch gap-3">
    {acoes.mostrarChecklist && <button type="button" onClick={() => aoChecklist(item)} className={cn(e.base, acoes.checklistConcluido ? acoes.preparacaoPendencias ? "border-amber-400/60 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100" : e.concluido : checklistInicial ? e.checklistIniciar : e.checklistAndamento)}>{acoes.checklistLabel}</button>}
    {acoes.mostrarJornada && <button type="button" onClick={() => (jornadaConcluida ? aoFinalizar(item) : aoJornada(item))} className={cn(e.base, jornadaConcluida ? e.concluido : e.jornada)}>{acoes.jornadaLabel}</button>}
    {acoes.historico && acoes.checklistConcluido && <button type="button" onClick={() => aoChecklist(item)} className={cn(e.base, e.verChecklist)}>Ver checklist</button>}
    {acoes.checklistConcluido && <div className={e.pesoWrapper}><PesoBalanceamentoFicha item={item} /></div>}
    {acoes.historico && <span className={e.operacaoConcluida}><Check size={14} /> Operação concluída</span>}
  </div>;
}
