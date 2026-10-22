/**
 * CAIXA EMPRESA — substitua o componente original por este arquivo.
 * Mantenha-o ao lado de ./tipos e preserve os aliases @/ do projeto.
 * Dependências: React, lucide-react, sonner e os componentes shadcn/ui
 * Button, Badge, Checkbox, Dialog, Popover e Select já usados no original.
 *
 * Integração: usa useCaixaEmpresa({}) e as mesmas três funções de API do
 * original. O hook deve retornar TODOS os lançamentos da empresa autorizada,
 * sem paginação de servidor, para os totais locais serem completos.
 * Não substitui autenticação, autorização nem validações do backend.
 * Exclusão = CANCELADO, preservando histórico. Pagos/recebidos não são
 * cancelados por esta tela, conforme a regra do componente original.
 * Cancelados não participam das somas. Valores são inteiros em centavos.
 * A seleção abrange filtros atuais e persiste ao mudar de página;
 * alterar qualquer filtro limpa a seleção. Selecionar todos abrange todas
 * as páginas filtradas. O checkbox do cabeçalho seleciona só a página.
 * O lote usa requisições sequenciais, sem atomicidade: sucessos e falhas
 * são informados separadamente; falhas permanecem selecionadas.
 * Reembolso é enviado uma única vez por abertura de confirmação; o servidor
 * deve garantir idempotência entre sessões/usuários.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, FileText, Loader2, Pencil, Plus,
  RefreshCw, Search, SlidersHorizontal, Trash2, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { alterarStatusLancamento, editarLancamento, gerarReembolso } from "@/lib/financeiro-share-api";
import type { FluxoLancamento, Lancamento, StatusLancamento } from "./tipos";

type Documento = Lancamento["anexos"][number];
type FluxoFiltro = FluxoLancamento | "TODOS";
type StatusFiltro = StatusLancamento | "ATIVOS" | "TODOS";
type Ordem = "RECENTES" | "ANTIGOS" | "MAIOR" | "MENOR";
type Confirmacao = { tipo: "EXCLUIR"; ids: string[] }
  | { tipo: "BAIXA" | "REEMBOLSO"; id: string };
type Falha = { id: string; descricao: string; mensagem: string };

const STATUS: StatusLancamento[] = ["EM_ABERTO", "PENDENTE", "ATRASADO", "EM_ATRASO", "PAGO", "RECEBIDO", "CANCELADO"];
const FINALIZADOS = new Set<StatusLancamento>(["PAGO", "RECEBIDO", "CANCELADO"]);
const INPUT = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarMoeda(centavos: number) { return moeda.format(centavos / 100); }
function normalizar(texto: string) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function formatarData(iso: string | null) {
  if (!iso) return "—";
  const data = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}
function mesDoLancamento(item: Lancamento) { return item.data?.slice(0, 7) || "sem-data"; }
function rotuloMes(mes: string) {
  if (mes === "sem-data") return "Sem data";
  const data = new Date(`${mes}-01T12:00:00`);
  return Number.isNaN(data.getTime()) ? "Sem data" : data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function valorValido(item: Lancamento) {
  return Number.isSafeInteger(item.valorCentavos) && item.valorCentavos >= 0;
}
function podeExcluir(item: Lancamento) { return !FINALIZADOS.has(item.status); }
function resumir(itens: Lancamento[]) {
  let entradas = 0, saidas = 0, realizados = 0;
  for (const item of itens) {
    if (item.status === "CANCELADO" || !valorValido(item)) continue;
    const valor = item.valorCentavos;
    if (item.fluxo === "ENTRADA") entradas += valor; else saidas += valor;
    if (item.status === "PAGO" || item.status === "RECEBIDO") {
      realizados += item.fluxo === "ENTRADA" ? valor : -valor;
    }
  }
  const saldo = entradas - saidas;
  const soma = entradas + saidas;
  const valido = [entradas, saidas, saldo, soma, realizados].every(Number.isSafeInteger);
  return { entradas, saidas, saldo, soma, realizados, valido };
}
function exibirTotal(valor: number, valido: boolean) { return valido ? formatarMoeda(valor) : "Fora do limite"; }
function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação. Tente novamente.";
}
function urlSegura(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
function StatusBadge({ status }: { status: StatusLancamento }) {
  const classe = status === "CANCELADO" ? "border-border bg-muted text-muted-foreground"
    : ["PAGO", "RECEBIDO"].includes(status) ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : ["ATRASADO", "EM_ATRASO"].includes(status) ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${classe}`}>{status.replace(/_/g, " ")}</Badge>;
}

function DocumentoPreview({ documento, onClose }: { documento: Documento; onClose: () => void }) {
  const url = urlSegura(documento.url);
  const imagem = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(documento.url) || documento.tipo?.startsWith("image/");
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="break-all pr-6">{documento.nome}</DialogTitle>
        <DialogDescription>Documento vinculado ao lançamento.</DialogDescription>
      </DialogHeader>
      {!url ? <p role="alert" className="text-sm text-destructive">Endereço do documento inválido.</p>
        : <>
          {imagem ? <img src={url} alt={documento.nome} className="mx-auto max-h-[65vh] max-w-full rounded-xl object-contain" />
            : <iframe sandbox="" referrerPolicy="no-referrer" title={documento.nome} src={url} className="h-[65vh] w-full rounded-xl border border-border" />}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">Abrir documento em nova aba</a>
        </>}
    </DialogContent>
  </Dialog>;
}

function Detalhes({ item, ocupado, onDocumento, onEditar, onAcao }: {
  item: Lancamento; ocupado: boolean; onDocumento: (documento: Documento) => void;
  onEditar: () => void; onAcao: (acao: Confirmacao) => void;
}) {
  return <div className="border-b border-border bg-muted/20 p-5 sm:p-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Documentos vinculados">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documentos vinculados</h3>
        <div className="flex flex-wrap gap-2">
          {item.anexos.length ? item.anexos.map((doc) => <Button key={doc.id} variant="outline" size="sm" onClick={() => onDocumento(doc)} className="max-w-full gap-2 rounded-lg">
            <FileText size={14} className="shrink-0" /><span className="truncate">{doc.nome}</span>
          </Button>) : <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>}
        </div>
      </section>
      <section aria-label="Detalhes do lançamento">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações do lançamento</h3>
        <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
          {[["Vencimento", formatarData(item.prazo)], ["Categoria", item.categoria], ["Caixa", item.caixa],
            ["Pagador", item.pagoPor || "—"], ["Reembolsável", item.reembolsavel ? "Sim" : "Não"],
            ["Criado em", formatarData(item.criadoEm)]].map(([titulo, valor]) => <div key={titulo}>
            <dt className="text-muted-foreground">{titulo}</dt><dd className="mt-1 break-words font-medium">{valor}</dd>
          </div>)}
        </dl>
        {item.observacoes && <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">{item.observacoes}</p>}
      </section>
    </div>
    <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      {item.reembolsavel && item.cotistaId && item.status !== "CANCELADO" && <Button disabled={ocupado || !valorValido(item)} size="sm" variant="outline" onClick={() => onAcao({ tipo: "REEMBOLSO", id: item.id })}>Gerar reembolso</Button>}
      <Button disabled={ocupado} size="sm" variant="outline" onClick={onEditar} className="gap-2"><Pencil size={14} />Editar descrição</Button>
      {!FINALIZADOS.has(item.status) && <Button disabled={ocupado || !valorValido(item)} size="sm" variant="outline" onClick={() => onAcao({ tipo: "BAIXA", id: item.id })} className="gap-2"><CheckCircle2 size={14} />Dar baixa</Button>}
      {podeExcluir(item) && <Button disabled={ocupado} size="sm" variant="ghost" onClick={() => onAcao({ tipo: "EXCLUIR", ids: [item.id] })} className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} />Excluir</Button>}
    </div>
  </div>;
}

export function AbaCaixaEmpresa({ onNovoLancamento }: { onNovoLancamento?: () => void }) {
  // Filtros locais mantêm os contadores e a seleção consistentes entre as abas.
  const { lancamentos, carregando, erro, recarregar } = useCaixaEmpresa({});
  const [fluxo, setFluxo] = useState<FluxoFiltro>("TODOS");
  const [status, setStatus] = useState<StatusFiltro>("ATIVOS");
  const [busca, setBusca] = useState("");
  const [meses, setMeses] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<Ordem>("RECENTES");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [edicao, setEdicao] = useState<{ id: string; descricao: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [falhas, setFalhas] = useState<Falha[]>([]);
  // Guarda síncrona: bloqueia duplo clique antes do próximo render.
  const trava = useRef(false);
  const bloqueado = ocupado || carregando || Boolean(erro);

  const mesesDisponiveis = useMemo(() => Array.from(new Set(lancamentos.map(mesDoLancamento))).sort().reverse(), [lancamentos]);
  const baseFiltrada = useMemo(() => {
    const termo = normalizar(busca.trim());
    return lancamentos.filter((item) =>
      (status === "TODOS" || (status === "ATIVOS" ? item.status !== "CANCELADO" : item.status === status)) &&
      (!meses.length || meses.includes(mesDoLancamento(item))) &&
      (!termo || normalizar([item.descricao, item.documento, item.fornecedor, item.categoria, item.pagoPor, item.observacoes].filter(Boolean).join(" ")).includes(termo)),
    );
  }, [lancamentos, busca, meses, status]);
  const filtrados = useMemo(() => baseFiltrada.filter((item) => fluxo === "TODOS" || item.fluxo === fluxo).sort((a, b) => {
    const porData = (b.data || "").localeCompare(a.data || "");
    if (ordem === "MAIOR") return b.valorCentavos - a.valorCentavos || porData || a.id.localeCompare(b.id);
    if (ordem === "MENOR") return a.valorCentavos - b.valorCentavos || porData || a.id.localeCompare(b.id);
    return (ordem === "ANTIGOS" ? -porData : porData) || a.id.localeCompare(b.id);
  }), [baseFiltrada, fluxo, ordem]);
  const idsFiltrados = useMemo(() => new Set(filtrados.map((item) => item.id)), [filtrados]);
  const itensSelecionados = useMemo(() => filtrados.filter((item) => selecionados.has(item.id)), [filtrados, selecionados]);
  const resumo = useMemo(() => resumir(filtrados), [filtrados]);
  const resumoSelecao = useMemo(() => resumir(itensSelecionados), [itensSelecionados]);
  const excluiveis = itensSelecionados.filter(podeExcluir);
  const invalidos = filtrados.filter((item) => !valorValido(item)).length;
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const itensPagina = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const todosPagina = itensPagina.length > 0 && itensPagina.every((item) => selecionados.has(item.id));
  const algunsPagina = itensPagina.some((item) => selecionados.has(item.id));
  const alvo = confirmacao && confirmacao.tipo !== "EXCLUIR" ? lancamentos.find((item) => item.id === confirmacao.id) : undefined;
  const alvosExclusao = confirmacao?.tipo === "EXCLUIR" ? lancamentos.filter((item) => confirmacao.ids.includes(item.id) && podeExcluir(item)) : [];
  const resumoExclusao = resumir(alvosExclusao);
  const contagens = {
    TODOS: baseFiltrada.length,
    ENTRADA: baseFiltrada.filter((item) => item.fluxo === "ENTRADA").length,
    SAIDA: baseFiltrada.filter((item) => item.fluxo === "SAIDA").length,
  };

  useEffect(() => {
    // Remove IDs que desapareceram após recarregar ou cancelar.
    setSelecionados((anteriores) => {
      const proximos = new Set([...anteriores].filter((id) => idsFiltrados.has(id)));
      return proximos.size === anteriores.size ? anteriores : proximos;
    });
  }, [idsFiltrados]);

  function prepararFiltro() {
    setPagina(1); setSelecionados(new Set()); setExpandido(null);
  }
  function limparFiltros() {
    prepararFiltro(); setFluxo("TODOS"); setStatus("ATIVOS"); setBusca(""); setMeses([]); setOrdem("RECENTES");
  }
  function marcar(ids: string[], checked: boolean) {
    setSelecionados((anteriores) => {
      const proximos = new Set(anteriores);
      ids.forEach((id) => { if (checked) proximos.add(id); else proximos.delete(id); });
      return proximos;
    });
  }
  function iniciar() {
    if (trava.current) return false;
    trava.current = true; setOcupado(true); return true;
  }
  function terminar() { trava.current = false; setOcupado(false); }
  async function atualizarAposGravacao() {
    try { await recarregar(); }
    catch { toast.warning("A operação foi salva, mas a lista não atualizou. Clique em Atualizar."); }
  }
  async function atualizar() {
    if (!iniciar()) return;
    try { await recarregar(); } catch (error) { toast.error(mensagemErro(error)); } finally { terminar(); }
  }
  async function salvarEdicao() {
    if (!edicao || !edicao.descricao.trim() || edicao.descricao.trim().length > 240 || bloqueado || !iniciar()) return;
    try {
      await editarLancamento(edicao.id, { descricao: edicao.descricao.trim() });
      setEdicao(null); toast.success("Descrição atualizada."); await atualizarAposGravacao();
    } catch (error) { toast.error(mensagemErro(error)); } finally { terminar(); }
  }
  async function executarConfirmacao() {
    if (!confirmacao || bloqueado || !iniciar()) return;
    const acao = confirmacao;
    try {
      if (acao.tipo === "EXCLUIR") {
        const itens = lancamentos.filter((item) => acao.ids.includes(item.id) && podeExcluir(item));
        if (!itens.length) { toast.info("Não há lançamentos elegíveis para exclusão."); setConfirmacao(null); return; }
        const erros: Falha[] = [];
        const concluidos = new Set<string>();
        setFalhas([]); setProgresso({ atual: 0, total: itens.length });
        for (const [indice, item] of itens.entries()) {
          try { await alterarStatusLancamento(item.id, "CANCELADO"); concluidos.add(item.id); }
          catch (error) { erros.push({ id: item.id, descricao: item.descricao, mensagem: mensagemErro(error) }); }
          setProgresso({ atual: indice + 1, total: itens.length });
        }
        setSelecionados((anteriores) => {
          const proximos = new Set([...anteriores].filter((id) => !concluidos.has(id)));
          erros.forEach((item) => proximos.add(item.id)); return proximos;
        });
        setFalhas(erros); setConfirmacao(null); setExpandido(null);
        if (concluidos.size) toast.success(`${concluidos.size} lançamento(s) cancelado(s). Histórico preservado.`);
        if (erros.length) toast.error(`${erros.length} lançamento(s) não foram cancelados. Consulte os detalhes na tela.`);
        await atualizarAposGravacao();
      } else {
        const item = lancamentos.find((registro) => registro.id === acao.id);
        if (!item || !valorValido(item)) { toast.error("Lançamento indisponível ou valor inválido. Atualize a lista."); return; }
        if (acao.tipo === "BAIXA") {
          if (FINALIZADOS.has(item.status)) { toast.info("Este lançamento já está finalizado."); setConfirmacao(null); return; }
          await alterarStatusLancamento(item.id, item.fluxo === "ENTRADA" ? "RECEBIDO" : "PAGO");
          toast.success("Baixa registrada.");
        } else {
          if (!item.cotistaId || !item.reembolsavel || item.status === "CANCELADO") { toast.error("Lançamento não elegível para reembolso."); return; }
          await gerarReembolso({ lancamento_origem_id: item.id, cotista_aeronave_id: item.cotistaId,
            valor_centavos: item.valorCentavos, descricao: item.descricao, data: item.data,
            data_emissao: item.data, data_vencimento: item.prazo });
          toast.success("Reembolso gerado e salvo.");
        }
        setConfirmacao(null); await atualizarAposGravacao();
      }
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { setProgresso({ atual: 0, total: 0 }); terminar(); }
  }

  return <div className="space-y-5 text-foreground" aria-busy={ocupado || carregando}>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Financeiro / Gestão interna</p>
        <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><span className="rounded-xl border border-primary/15 bg-primary/10 p-2.5 text-primary"><Wallet size={22} /></span>Caixa Empresa</h2>
        <p className="mt-2 text-sm text-muted-foreground">Controle as movimentações, acompanhe valores e organize seu caixa.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" disabled={ocupado || carregando} onClick={() => void atualizar()} className="gap-2 rounded-xl"><RefreshCw size={15} className={ocupado || carregando ? "animate-spin" : ""} />Atualizar</Button>
        {onNovoLancamento && <Button disabled={ocupado} onClick={onNovoLancamento} className="gap-2 rounded-xl"><Plus size={16} />Novo lançamento</Button>}
      </div>
    </header>

    <section aria-label="Resumo dos lançamentos filtrados" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { titulo: "Entradas", valor: resumo.entradas, detalhe: "Recebidas + a receber", cor: "text-emerald-600 dark:text-emerald-400", Icone: ArrowDownLeft },
        { titulo: "Saídas", valor: resumo.saidas, detalhe: "Pagas + a pagar", cor: "text-rose-600 dark:text-rose-400", Icone: ArrowUpRight },
        { titulo: "Saldo dos lançamentos", valor: resumo.saldo, detalhe: "Entradas menos saídas", cor: resumo.saldo >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400", Icone: Wallet },
        { titulo: "Saldo realizado", valor: resumo.realizados, detalhe: "Apenas recebidos e pagos", cor: resumo.realizados >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400", Icone: CheckCircle2 },
      ].map(({ titulo, valor, detalhe, cor, Icone }) => <div key={titulo} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{titulo}</p><Icone size={18} className={cor} /></div>
        <p className={`mt-3 break-words text-2xl font-semibold tabular-nums tracking-tight ${cor}`}>{carregando || erro ? "—" : exibirTotal(valor, resumo.valido)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>
      </div>)}
    </section>
    <p className="text-xs text-muted-foreground">Totais dos filtros atuais. Cancelados não entram nas somas. O saldo realizado não inclui saldo inicial. A seleção permanece entre páginas e é limpa ao alterar os filtros.</p>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Movimentações">
      <div className="space-y-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div role="group" aria-label="Filtrar fluxo" className="inline-flex w-full gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
            {([['TODOS', 'Todos'], ['ENTRADA', 'Entradas'], ['SAIDA', 'Saídas']] as const).map(([valor, titulo]) => <button
              key={valor} type="button" aria-pressed={fluxo === valor} disabled={ocupado}
              onClick={() => { prepararFiltro(); setFluxo(valor); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:flex-none ${fluxo === valor ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {titulo}<span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${fluxo === valor ? "bg-primary/10 text-primary" : "bg-background/60"}`}>{contagens[valor]}</span>
            </button>)}
          </div>
          <div className="relative w-full lg:max-w-sm"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-muted-foreground" />
            <input aria-label="Buscar lançamentos" placeholder="Buscar descrição, fornecedor, documento…" value={busca} disabled={ocupado} onChange={(e) => { prepararFiltro(); setBusca(e.target.value); }} className={`${INPUT} pl-9 pr-9`} />
            {busca && <button type="button" disabled={ocupado} onClick={() => { prepararFiltro(); setBusca(""); }} aria-label="Limpar busca" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground"><X size={16} /></button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Mês e ano</span>
            <Popover><PopoverTrigger asChild><Button variant="outline" disabled={ocupado} className="w-full justify-between rounded-xl">
              <span className="flex items-center gap-2"><CalendarDays size={15} />{meses.length ? `${meses.length} mês(es) selecionado(s)` : "Todos os meses"}</span><ChevronDown size={14} />
            </Button></PopoverTrigger><PopoverContent align="start" className="w-72 rounded-xl p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Período</span><Button size="sm" variant="ghost" disabled={ocupado || !meses.length} onClick={() => { prepararFiltro(); setMeses([]); }}>Limpar</Button></div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {mesesDisponiveis.length ? mesesDisponiveis.map((mes) => <label key={mes} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm capitalize hover:bg-muted">
                  <Checkbox disabled={ocupado} checked={meses.includes(mes)} onCheckedChange={(marcado) => { prepararFiltro(); setMeses((atuais) => marcado === true ? [...new Set([...atuais, mes])] : atuais.filter((item) => item !== mes)); }} />{rotuloMes(mes)}
                </label>) : <p className="p-2 text-sm text-muted-foreground">Nenhum período disponível.</p>}
              </div>
            </PopoverContent></Popover>
          </div>
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Status</span>
            <Select value={status} disabled={ocupado} onValueChange={(valor) => { prepararFiltro(); setStatus(valor as StatusFiltro); }}>
              <SelectTrigger aria-label="Filtrar status" className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ATIVOS">Ativos (sem cancelados)</SelectItem><SelectItem value="TODOS">Todos os status</SelectItem>{STATUS.map((item) => <SelectItem key={item} value={item}>{item.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Ordenação</span>
            <Select value={ordem} disabled={ocupado} onValueChange={(valor) => { setPagina(1); setOrdem(valor as Ordem); }}>
              <SelectTrigger aria-label="Ordenar lançamentos" className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="RECENTES">Mais recentes</SelectItem><SelectItem value="ANTIGOS">Mais antigos</SelectItem><SelectItem value="MAIOR">Maior valor</SelectItem><SelectItem value="MENOR">Menor valor</SelectItem></SelectContent>
            </Select>
          </div>
          <Button variant="ghost" disabled={ocupado} onClick={limparFiltros} className="gap-2 self-end rounded-xl"><SlidersHorizontal size={15} />Limpar filtros</Button>
        </div>
      </div>

      {itensSelecionados.length > 0 && <div role="region" aria-label="Resumo da seleção" className="space-y-3 border-b border-primary/20 bg-primary/5 p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm font-semibold">{itensSelecionados.length} lançamento(s) selecionado(s)</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={bloqueado || itensSelecionados.length === filtrados.length} onClick={() => marcar(filtrados.map((item) => item.id), true)}>Selecionar todos os {filtrados.length} filtrados</Button>
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
            <Button variant="destructive" size="sm" disabled={bloqueado || !excluiveis.length} onClick={() => setConfirmacao({ tipo: "EXCLUIR", ids: excluiveis.map((item) => item.id) })} className="gap-2"><Trash2 size={14} />Excluir ({excluiveis.length})</Button>
          </div>
        </div>
        <dl aria-live="polite" className="grid grid-cols-2 gap-3 text-xs xl:grid-cols-4">
          {[["Entradas selecionadas", resumoSelecao.entradas], ["Saídas selecionadas", resumoSelecao.saidas], ["Soma dos valores", resumoSelecao.soma], ["Saldo da seleção", resumoSelecao.saldo]].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-border/60 bg-background/70 p-3">
            <dt className="text-muted-foreground">{titulo}</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums">{exibirTotal(Number(valor), resumoSelecao.valido)}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-muted-foreground">Soma = entradas + saídas. Saldo = entradas − saídas. Cancelados não são somados. Pagos, recebidos e cancelados não podem ser excluídos nesta tela.</p>
      </div>}

      {erro && <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{String(erro)}</span><Button variant="outline" size="sm" disabled={ocupado || carregando} onClick={() => void atualizar()}>Tentar novamente</Button></div>}
      {!erro && invalidos > 0 && <p role="alert" className="m-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{invalidos} lançamento(s) com valor inválido não foram somados. Corrija os dados de origem.</p>}
      {!resumo.valido && <p role="alert" className="m-4 text-sm text-destructive">O total excede o limite de precisão suportado. Reduza o período.</p>}
      {falhas.length > 0 && <div role="alert" className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-center justify-between gap-3"><p className="font-semibold text-destructive">Exclusão não concluída para {falhas.length} lançamento(s)</p><Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setFalhas([])} aria-label="Fechar relatório de falhas"><X size={14} /></Button></div>
        <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-auto">{falhas.map((falha) => <li key={falha.id} className="break-words">{falha.descricao}: {falha.mensagem}</li>)}</ul>
        <p className="mt-2 text-xs text-muted-foreground">As falhas continuam selecionadas quando estão nos filtros atuais. Atualize a lista antes de tentar novamente.</p>
      </div>}

      {carregando ? <div role="status" className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" />Carregando movimentações…</div>
        : !erro && <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <caption className="sr-only">Movimentações filtradas do caixa. Use as caixas de seleção para somar valores ou excluir em lote.</caption>
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>
              <th scope="col" className="w-12 px-4 py-3"><Checkbox aria-label="Selecionar lançamentos desta página" disabled={bloqueado || !itensPagina.length} checked={todosPagina ? true : algunsPagina ? "indeterminate" : false} onCheckedChange={(checked) => marcar(itensPagina.map((item) => item.id), checked === true)} /></th>
              {["Documento / emissão", "Fluxo", "Descrição", "Fornecedor", "Valor", "Status", "Detalhes"].map((titulo) => <th key={titulo} scope="col" className={`px-4 py-3 font-semibold ${titulo === "Valor" || titulo === "Detalhes" ? "text-right" : ""}`}>{titulo}</th>)}
            </tr></thead>
            <tbody>
              {!itensPagina.length ? <tr><td colSpan={8} className="px-6 py-16 text-center"><div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted"><Search size={21} className="text-muted-foreground" /></div><p className="font-semibold">Nenhum lançamento encontrado</p><p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou cadastre uma nova movimentação.</p><Button variant="ghost" onClick={limparFiltros} className="mt-3" disabled={ocupado}>Limpar filtros</Button></td></tr>
                : itensPagina.map((item, indice) => {
                  const aberto = expandido === item.id;
                  const marcado = selecionados.has(item.id);
                  const entrada = item.fluxo === "ENTRADA";
                  const mes = mesDoLancamento(item);
                  const grupoMes = (ordem === "RECENTES" || ordem === "ANTIGOS") && (indice === 0 || mesDoLancamento(itensPagina[indice - 1]) !== mes);
                  return <Fragment key={item.id}>
                    {grupoMes && <tr className="border-b border-border/60 bg-muted/20"><th scope="rowgroup" colSpan={8} className="px-4 py-2 text-[11px] font-semibold capitalize tracking-wide text-muted-foreground">{rotuloMes(mes)}</th></tr>}
                    <tr className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${marcado ? "bg-primary/5" : ""} ${item.status === "CANCELADO" ? "text-muted-foreground" : ""}`}>
                      <td className="px-4 py-4 align-top"><Checkbox aria-label={`Selecionar ${item.descricao}`} disabled={bloqueado} checked={marcado} onCheckedChange={(checked) => marcar([item.id], checked === true)} /></td>
                      <td className="px-4 py-4 align-top"><p className="font-mono text-xs font-semibold">{item.documento || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{formatarData(item.data)}</p></td>
                      <td className="px-4 py-4 align-top"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${entrada ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>{entrada ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{entrada ? "Entrada" : "Saída"}</span></td>
                      <td className="min-w-[220px] max-w-[340px] px-4 py-4 align-top"><p className={`break-words font-medium ${item.status === "CANCELADO" ? "line-through" : ""}`}>{item.descricao}</p><p className="mt-1 text-xs text-muted-foreground">{item.categoria || "Sem categoria"}</p></td>
                      <td className="max-w-[200px] break-words px-4 py-4 align-top text-xs text-muted-foreground">{item.fornecedor || "—"}</td>
                      <td className={`whitespace-nowrap px-4 py-4 text-right align-top font-semibold tabular-nums ${item.status === "CANCELADO" ? "line-through text-muted-foreground" : entrada ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{valorValido(item) ? `${entrada ? "+" : "−"}${formatarMoeda(item.valorCentavos)}` : "Valor inválido"}</td>
                      <td className="px-4 py-4 align-top"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-right align-top"><Button variant="ghost" size="sm" aria-label={`${aberto ? "Fechar" : "Abrir"} detalhes de ${item.descricao}`} aria-expanded={aberto} onClick={() => setExpandido(aberto ? null : item.id)} className="gap-1.5">{aberto ? "Fechar" : "Ações"}{aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</Button></td>
                    </tr>
                    {aberto && <tr><td colSpan={8} className="p-0"><Detalhes item={item} ocupado={bloqueado} onDocumento={setDocumento} onEditar={() => setEdicao({ id: item.id, descricao: item.descricao })} onAcao={setConfirmacao} /></td></tr>}
                  </Fragment>;
                })}
            </tbody>
          </table>
        </div>}
      <footer className="flex flex-col justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <span>{filtrados.length ? `${(paginaAtual - 1) * porPagina + 1}–${Math.min(paginaAtual * porPagina, filtrados.length)} de ${filtrados.length} lançamentos` : "0 lançamentos"}</span>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(porPagina)} disabled={ocupado} onValueChange={(valor) => { setPagina(1); setPorPagina(Number(valor)); }}><SelectTrigger aria-label="Lançamentos por página" className="h-8 w-28 rounded-lg text-xs"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}</SelectContent></Select>
          <span>Página {paginaAtual} de {paginas}</span>
          <Button variant="outline" size="icon" className="size-8 rounded-lg" aria-label="Página anterior" disabled={ocupado || paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft size={15} /></Button>
          <Button variant="outline" size="icon" className="size-8 rounded-lg" aria-label="Próxima página" disabled={ocupado || paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight size={15} /></Button>
        </div>
      </footer>
    </section>

    {documento && <DocumentoPreview documento={documento} onClose={() => setDocumento(null)} />}
    <Dialog open={Boolean(edicao)} onOpenChange={(open) => { if (!open && !trava.current) setEdicao(null); }}>
      <DialogContent className="max-w-lg rounded-2xl" onEscapeKeyDown={(e) => { if (ocupado) e.preventDefault(); }} onInteractOutside={(e) => { if (ocupado) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Editar descrição</DialogTitle><DialogDescription>Atualize a identificação do lançamento.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void salvarEdicao(); }} className="space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium">Descrição</span><input autoFocus required maxLength={240} disabled={ocupado} value={edicao?.descricao || ""} onChange={(e) => setEdicao((atual) => atual ? { ...atual, descricao: e.target.value } : null)} className={INPUT} /></label>
          <p className="text-right text-xs text-muted-foreground">{edicao?.descricao.length || 0}/240</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={ocupado} onClick={() => setEdicao(null)}>Cancelar</Button><Button type="submit" disabled={bloqueado || !edicao?.descricao.trim()} className="gap-2">{ocupado && <Loader2 size={15} className="animate-spin" />}Salvar alteração</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(confirmacao)} onOpenChange={(open) => { if (!open && !trava.current) setConfirmacao(null); }}>
      <DialogContent className="max-w-lg rounded-2xl" onEscapeKeyDown={(e) => { if (ocupado) e.preventDefault(); }} onInteractOutside={(e) => { if (ocupado) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{confirmacao?.tipo === "EXCLUIR" ? `Excluir ${alvosExclusao.length} lançamento(s)?` : confirmacao?.tipo === "BAIXA" ? "Confirmar baixa" : "Gerar reembolso"}</DialogTitle>
          <DialogDescription>{confirmacao?.tipo === "EXCLUIR" ? "Os lançamentos serão cancelados e sairão dos totais ativos. O histórico e os documentos serão preservados." : confirmacao?.tipo === "BAIXA" ? `O lançamento será marcado como ${alvo?.fluxo === "ENTRADA" ? "recebido" : "pago"}.` : "Será criado um reembolso vinculado ao lançamento e ao cotista informado."}</DialogDescription>
        </DialogHeader>
        {confirmacao?.tipo === "EXCLUIR" ? <div className="space-y-3">
          <div className="rounded-xl bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Soma dos valores a cancelar</span><p className="mt-1 text-xl font-semibold tabular-nums">{exibirTotal(resumoExclusao.soma, resumoExclusao.valido)}</p></div>
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">{alvosExclusao.map((item) => <li key={item.id} className="flex justify-between gap-4 border-b border-border/60 pb-2"><span className="min-w-0 break-words">{item.descricao}</span><span className="shrink-0 tabular-nums">{valorValido(item) ? formatarMoeda(item.valorCentavos) : "Valor inválido"}</span></li>)}</ul>
        </div> : alvo && <div className="rounded-xl bg-muted/50 p-4"><p className="break-words text-sm">{alvo.descricao}</p><p className="mt-1 text-xl font-semibold tabular-nums">{valorValido(alvo) ? formatarMoeda(alvo.valorCentavos) : "Valor inválido"}</p></div>}
        {ocupado && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{progresso.total ? `Processando ${progresso.atual} de ${progresso.total}…` : "Salvando…"}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={ocupado} onClick={() => setConfirmacao(null)}>Voltar</Button><Button variant={confirmacao?.tipo === "EXCLUIR" ? "destructive" : "default"} disabled={bloqueado || (confirmacao?.tipo === "EXCLUIR" ? !alvosExclusao.length : !alvo)} onClick={() => void executarConfirmacao()}>{confirmacao?.tipo === "EXCLUIR" ? "Confirmar exclusão" : "Confirmar"}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
