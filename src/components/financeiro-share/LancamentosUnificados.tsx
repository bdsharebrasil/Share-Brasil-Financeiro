import { Fragment, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Filter, List, Loader2, PanelLeft, Paperclip, Plus, Printer, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarOpcoesFinanceiroShare, darBaixaContaAPagar, darBaixaContaAReceber, formatarData, formatarMoeda, type CategoriaCaixaShare, type ContaBancaria } from "@/lib/financeiro-share-api";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import type { ContaAPagar, ContaAReceber } from "./tipos";
import { linhasDeContasAPagar, linhasDeContasAReceber, type FluxoLinha, type LinhaConta, type SituacaoLinha } from "./linhas-contas";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";

/* ───────────────────────── helpers ───────────────────────── */

const mesAtualIso = () => new Date().toISOString().slice(0, 7);
const nomeMes = (m: string, formato: "long" | "short") => new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: formato });
const podeBaixar = (l: LinhaConta) => l.situacao !== "PAGO" && l.situacao !== "CANCELADO";
const data = (v?: string | null) => (v ? formatarData(v) : "—");

type ChaveOrdenacao = "documento" | "descricao" | "favorecido" | "favorecidoPessoa" | "fornecedor" | "contaBancaria" | "data" | "situacao" | "valor";
type Coluna = { key: ChaveOrdenacao; label: string; largura?: number; minimo: number };

/** Situação exibida no badge. "BAIXADO" = baixa dada, ainda sem conciliação (Recebido / Pago). */
type SituacaoExibida = "PENDENTE" | "ATRASADO" | "CANCELADO" | "BAIXADO" | "CONCILIADO";

/**
 * ATENÇÃO: se o seu `raw` tiver outro campo para indicar conciliação, ajuste aqui.
 * Sem o campo, todo lançamento PAGO continua aparecendo como "Conciliado" (comportamento antigo).
 */
function situacaoExibida(l: LinhaConta): SituacaoExibida {
  if (l.situacao !== "PAGO") return l.situacao as SituacaoExibida;
  const raw = (l.raw ?? {}) as Record<string, any>;
  return raw.conciliado === false || raw.conciliada === false ? "BAIXADO" : "CONCILIADO";
}

const rotuloSituacao = (s: SituacaoExibida, ehEntrada: boolean) =>
  ({ PENDENTE: "Pendente", ATRASADO: "Atrasado", CANCELADO: "Cancelado", CONCILIADO: "Conciliado", BAIXADO: ehEntrada ? "Recebido" : "Pago" })[s];

/** Badges sólidos, como na referência. */
const COR_SITUACAO: Record<SituacaoExibida, string> = {
  PENDENTE: "bg-amber-400 text-amber-950",
  ATRASADO: "bg-red-500 text-white",
  CANCELADO: "bg-slate-500 text-white",
  BAIXADO: "bg-emerald-500 text-emerald-950",
  CONCILIADO: "bg-emerald-500 text-emerald-950",
};

const COLUNAS_ENTRADA: Coluna[] = [
  { key: "documento", label: "DOC", largura: 165, minimo: 110 },
  { key: "descricao", label: "Descrição", largura: 370, minimo: 200 },
  { key: "favorecido", label: "Favorecido", largura: 280, minimo: 160 },
  { key: "contaBancaria", label: "Conta", largura: 150, minimo: 110 },
  { key: "data", label: "Data", largura: 170, minimo: 120 },
  { key: "situacao", label: "Situação", largura: 160, minimo: 120 },
  { key: "valor", label: "Valor", minimo: 120 }, // sem largura = ocupa o espaço que sobrar
];

const COLUNAS_SAIDA: Coluna[] = [
  { key: "documento", label: "DOC", largura: 165, minimo: 110 },
  { key: "descricao", label: "Descrição", largura: 320, minimo: 200 },
  { key: "favorecidoPessoa", label: "Favorecido", largura: 220, minimo: 140 },
  { key: "fornecedor", label: "Fornecedor", largura: 220, minimo: 140 },
  { key: "contaBancaria", label: "Conta", largura: 150, minimo: 110 },
  { key: "data", label: "Data", largura: 170, minimo: 120 },
  { key: "situacao", label: "Situação", largura: 160, minimo: 120 },
  { key: "valor", label: "Valor", minimo: 120 },
];

function comparar(a: LinhaConta, b: LinhaConta, chave: ChaveOrdenacao): number {
  const txt = (x?: string, y?: string) => (x || "").localeCompare(y || "", "pt-BR", { numeric: true });
  switch (chave) {
    case "valor": return a.valor - b.valor;
    case "data": return (a.dataLancamento || "").localeCompare(b.dataLancamento || "");
    case "situacao": return a.situacao.localeCompare(b.situacao);
    case "documento": return txt(a.documento, b.documento);
    case "descricao": return txt(a.descricao, b.descricao);
    case "favorecido": return txt(a.favorecido, b.favorecido);
    case "favorecidoPessoa": return txt(a.favorecidoPessoa, b.favorecidoPessoa);
    case "fornecedor": return txt(a.fornecedor, b.fornecedor);
    case "contaBancaria": return txt(a.contaBancaria, b.contaBancaria);
  }
}

/**
 * Lê os dados do detalhe expandido a partir de `l.raw`.
 * Os nomes dos campos abaixo são tentativas (snake_case e camelCase) — ajuste para os campos reais dos seus tipos.
 */
function lerDetalhes(l: LinhaConta) {
  const r = (l.raw ?? {}) as Record<string, any>;
  const txt = (...chaves: string[]) => {
    for (const k of chaves) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v;
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const anexosBrutos: any[] = Array.isArray(r.anexos) ? r.anexos : r.anexo_url ? [r.anexo_url] : [];
  const anexos = anexosBrutos.map((a) => typeof a === "string"
    ? { nome: decodeURIComponent(a.split("/").pop() || "anexo"), url: a }
    : { nome: String(a?.nome ?? a?.name ?? a?.arquivo ?? "anexo"), url: a?.url ?? a?.link ?? "" });
  return {
    categoria: l.categoria,
    centroCusto: txt("centro_custo", "centroCusto", "centro_de_custo"),
    formaPagamento: txt("forma_pagamento", "formaPagamento", "meio_pagamento"),
    competencia: txt("competencia", "data_competencia", "competencia_data"),
    emissao: txt("data_emissao", "dataEmissao", "emissao"),
    documento: l.documento || "",
    observacoes: txt("observacoes", "observacao", "obs"),
    anexos,
    criadoPor: txt("criado_por_nome", "criado_por", "criadoPor", "usuario_nome"),
    criadoEm: txt("criado_em", "criadoEm", "created_at"),
    atualizadoEm: txt("atualizado_em", "atualizadoEm", "updated_at"),
  };
}

function Campo({ rotulo, children }: { rotulo: string; children?: ReactNode }) {
  return <div>
    <p className="text-xs text-muted-foreground">{rotulo}</p>
    <div className="mt-0.5 text-sm font-medium">{children || "—"}</div>
  </div>;
}

/* ───────────────────────── componente ───────────────────────── */

export function LancamentosUnificados({ fluxo, filtroInicial, aoVoltar }: {
  fluxo: FluxoLinha;
  filtroInicial?: { situacao?: SituacaoLinha; inicio?: string; fim?: string };
  /** Ação do breadcrumb "Voltar ao Dashboard". Se omitido, o link não aparece. */
  aoVoltar?: () => void;
}) {
  const pagar = useContasAPagar();
  const receber = useContasAReceber();
  const ehEntrada = fluxo === "ENTRADA";
  const lancamentos = useMemo(
    () => (ehEntrada ? linhasDeContasAReceber(receber.contas) : linhasDeContasAPagar(pagar.contas)),
    [ehEntrada, pagar.contas, receber.contas]
  );
  const carregando = ehEntrada ? receber.carregando : pagar.carregando;
  const erro = ehEntrada ? receber.erro : pagar.erro;
  const recarregar = ehEntrada ? receber.recarregar : pagar.recarregar;
  const colunas = ehEntrada ? COLUNAS_ENTRADA : COLUNAS_SAIDA;

  const [busca, setBusca] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>(filtroInicial?.situacao || "TODAS");
  const [caixaFiltro, setCaixaFiltro] = useState("TODOS");
  const [naturezaFiltro, setNaturezaFiltro] = useState("TODAS");
  const [mes, setMes] = useState(mesAtualIso);
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>(() => [mesAtualIso()]);
  const [seletorMesAberto, setSeletorMesAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordenacao, setOrdenacao] = useState<{ chave: ChaveOrdenacao; crescente: boolean }>({ chave: "data", crescente: false });
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [expandidas, setExpandidas] = useState<string[]>([]);
  const [larguras, setLarguras] = useState<Record<string, number>>({});
  const [contaBaixa, setContaBaixa] = useState<LinhaConta | null>(null);

  useEffect(() => {
    void buscarOpcoesFinanceiroShare()
      .then((o) => { setCategorias(o.categorias); setContasBancarias(o.contas_bancarias); })
      .catch(() => { setCategorias([]); setContasBancarias([]); });
  }, []);

  const titulo = ehEntrada ? "Registrar Entrada" : "Registrar Saída";

  const filtrados = useMemo(() => lancamentos.filter((l) => {
    if (filtroInicial?.inicio && (l.dataVencimento || "") < filtroInicial.inicio) return false;
    if (filtroInicial?.fim && (l.dataVencimento || "") > filtroInicial.fim) return false;
    if (!filtroInicial?.inicio && !filtroInicial?.fim && !mesesSelecionados.includes((l.dataLancamento || "").slice(0, 7))) return false;
    if (situacaoFiltro === "PAGO") { if (l.situacao !== "PAGO") return false; } // legado: todos os baixados
    else if (situacaoFiltro !== "TODAS" && situacaoExibida(l) !== situacaoFiltro) return false;
    if (caixaFiltro !== "TODOS" && l.caixa !== caixaFiltro) return false;
    if (naturezaFiltro !== "TODAS" && l.natureza !== naturezaFiltro) return false;
    const texto = `${l.documento || ""} ${l.descricao} ${l.categoria} ${l.favorecido} ${l.natureza}`.toLocaleLowerCase("pt-BR");
    return texto.includes(busca.toLocaleLowerCase("pt-BR"));
  }).sort((a, b) => {
    const v = comparar(a, b, ordenacao.chave);
    return ordenacao.crescente ? v : -v;
  }), [lancamentos, mesesSelecionados, situacaoFiltro, caixaFiltro, naturezaFiltro, busca, filtroInicial, ordenacao]);

  const total = filtrados.reduce((s, l) => s + l.valor, 0);
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const linhas = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  const selecionadosVisiveis = filtrados.filter((l) => selecionados.includes(l.id));
  const usaSelecao = selecionadosVisiveis.length > 0;
  const unicoSelecionado = selecionadosVisiveis.length === 1 ? selecionadosVisiveis[0] : null;
  const todasDaPaginaSelecionadas = linhas.length > 0 && linhas.every((l) => selecionados.includes(l.id));
  const todasExpandidas = linhas.length > 0 && linhas.every((l) => expandidas.includes(l.id));

  const rotuloMes = mesesSelecionados.length === 1
    ? `${nomeMes(mesesSelecionados[0], "long").replace(/^./, (c) => c.toUpperCase())} ${mesesSelecionados[0].slice(0, 4)}`
    : `${mesesSelecionados.length} meses selecionados`;
  const periodoImpressao = filtroInicial?.inicio || filtroInicial?.fim
    ? `${filtroInicial?.inicio ? formatarData(filtroInicial.inicio) : "início"} a ${filtroInicial?.fim ? formatarData(filtroInicial.fim) : "hoje"}`
    : [...mesesSelecionados].sort().map((m) => `${nomeMes(m, "long")} ${m.slice(0, 4)}`).join(", ");
  const itensRelatorio = usaSelecao ? selecionadosVisiveis : filtrados;
  const totalRelatorio = itensRelatorio.reduce((s, l) => s + l.valor, 0);

  const anoSeletor = mes.slice(0, 4);
  const mesesDoAno = Array.from({ length: 12 }, (_, i) => `${anoSeletor}-${String(i + 1).padStart(2, "0")}`);
  const mudarMes = (delta: number) => {
    const d = new Date(`${mes}-01T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    const proximo = d.toISOString().slice(0, 7);
    setMes(proximo); setMesesSelecionados([proximo]); setPagina(1);
  };
  const mudarAno = (delta: number) => setMes(`${Number(anoSeletor) + delta}-${mes.slice(5)}`);
  const irParaMesAtual = () => { const atual = mesAtualIso(); setMes(atual); setMesesSelecionados([atual]); setPagina(1); };
  const alternarMes = (m: string) => {
    setMes(m); setPagina(1);
    setMesesSelecionados((atual) => atual.includes(m) ? (atual.length > 1 ? atual.filter((x) => x !== m) : atual) : [...atual, m]);
  };

  const alternarSelecao = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const alternarPagina = () => setSelecionados((atual) => todasDaPaginaSelecionadas
    ? atual.filter((id) => !linhas.some((l) => l.id === id))
    : [...new Set([...atual, ...linhas.map((l) => l.id)])]);

  const alternarExpansao = (id: string) => setExpandidas((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const alternarTodas = () => setExpandidas((atual) => todasExpandidas
    ? atual.filter((id) => !linhas.some((l) => l.id === id))
    : [...new Set([...atual, ...linhas.map((l) => l.id)])]);

  const larguraDe = (c: Coluna) => larguras[c.key] ?? c.largura;
  const larguraMinimaTabela = 84 + colunas.reduce((s, c) => s + (larguraDe(c) ?? c.minimo), 0);
  const restaurarColunas = () => { setLarguras({}); setOrdenacao({ chave: "data", crescente: false }); };

  function iniciarRedimensionar(e: ReactPointerEvent, c: Coluna) {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = (e.currentTarget.closest("th") as HTMLElement | null)?.offsetWidth ?? larguraDe(c) ?? c.minimo;
    const mover = (ev: PointerEvent) => setLarguras((a) => ({ ...a, [c.key]: Math.max(c.minimo, Math.round(w0 + ev.clientX - x0)) }));
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  function abrirBaixa(l: LinhaConta) {
    if (podeBaixar(l)) setContaBaixa(l);
  }

  const TD = "overflow-hidden border-r border-border/50 px-3 py-1.5 align-middle last:border-r-0";

  function celula(l: LinhaConta, c: Coluna) {
    switch (c.key) {
      case "documento":
        return <td key={c.key} className={`${TD} font-mono text-xs text-muted-foreground`}><div className="truncate">{l.documento || "—"}</div></td>;
      case "descricao":
        return <td key={c.key} className={TD}>
          <div className="truncate font-medium">{l.descricao}</div>
          <div className="truncate text-xs text-muted-foreground">{l.categoria}</div>
        </td>;
      case "favorecido":
        return <td key={c.key} className={TD}><div className="truncate" title={l.favorecido}>{l.favorecido}</div></td>;
      case "favorecidoPessoa":
        return <td key={c.key} className={TD}><div className="truncate">{l.favorecidoPessoa || "—"}</div></td>;
      case "fornecedor":
        return <td key={c.key} className={TD}><div className="truncate">{l.fornecedor || "—"}</div></td>;
      case "contaBancaria":
        return <td key={c.key} className={TD}><div className="truncate">{l.contaBancaria}</div></td>;
      case "data":
        return <td key={c.key} className={TD}>
          <div>{data(l.dataLancamento)}</div>
          {l.dataVencimento && <div className="text-xs text-muted-foreground">Venc. {formatarData(l.dataVencimento)}</div>}
        </td>;
      case "situacao": {
        const s = situacaoExibida(l);
        return <td key={c.key} className={TD}>
          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold leading-4 ${COR_SITUACAO[s] ?? COR_SITUACAO.PENDENTE}`}>{rotuloSituacao(s, ehEntrada) ?? l.situacao}</span>
        </td>;
      }
      case "valor":
        return <td key={c.key} className={`${TD} text-right font-semibold tabular-nums`}>{formatarMoeda(l.valor)}</td>;
    }
  }

  return <section className="space-y-4">
    {aoVoltar && <nav aria-label="Navegação" className="flex items-center gap-2 text-xs text-muted-foreground">
      <button type="button" onClick={aoVoltar} className="inline-flex items-center gap-1 text-primary hover:underline"><ChevronLeft size={13}/>Voltar ao Dashboard</button>
      <span>/</span>
      <span>{ehEntrada ? "Registrar entrada" : "Registrar saída"}</span>
    </nav>}

    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Módulo financeiro</p>
        <h2 className="mt-0.5 text-2xl font-bold tracking-tight">{titulo}</h2>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total listado</p>
        <strong className={`text-2xl font-bold tabular-nums ${ehEntrada ? "text-emerald-400" : "text-red-400"}`}>{formatarMoeda(total)}</strong>
      </div>
    </header>

    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setNovo(true)} className="gap-2"><Plus size={16}/>Novo</Button>
      <Button variant="outline" className="gap-2" title="Dar baixa / conciliar o lançamento selecionado" disabled={!unicoSelecionado || !podeBaixar(unicoSelecionado)} onClick={() => unicoSelecionado && abrirBaixa(unicoSelecionado)}><ScanLine size={16}/>Conciliar</Button>
      <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer size={16}/>Imprimir</Button>
      <Button variant="outline" className="gap-2" aria-expanded={mostrarFiltros} onClick={() => setMostrarFiltros((v) => !v)}><Filter size={16}/>Filtrar</Button>
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
      <Button variant="ghost" className="gap-2" disabled={!linhas.length} onClick={alternarTodas}><List size={16}/>{todasExpandidas ? "Recolher todas" : "Expandir todas"}</Button>
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
      <Button variant="ghost" className="gap-2" onClick={restaurarColunas}><PanelLeft size={16}/>Restaurar colunas</Button>

      <span className="relative ml-auto flex items-center gap-2">
        <Button variant="outline" className="gap-2" aria-expanded={seletorMesAberto} onClick={() => setSeletorMesAberto((v) => !v)}>Mês Atual<ChevronDown size={14}/></Button>
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16}/></Button>
        <span className="min-w-[8.5rem] text-center text-sm font-medium">{rotuloMes}</span>
        <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={16}/></Button>
        {seletorMesAberto && <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Ano anterior" onClick={() => mudarAno(-1)}><ChevronLeft size={16}/></Button>
            <strong className="text-sm">{anoSeletor}</strong>
            <Button variant="ghost" size="icon" aria-label="Próximo ano" onClick={() => mudarAno(1)}><ChevronRight size={16}/></Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {mesesDoAno.map((m) => <button key={m} type="button" aria-pressed={mesesSelecionados.includes(m)} onClick={() => alternarMes(m)} className={`rounded-lg border px-2 py-2 text-xs capitalize ${mesesSelecionados.includes(m) ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}>{nomeMes(m, "short")}</button>)}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Clique em mais de um mês para somar.</span>
            <Button variant="outline" size="sm" onClick={irParaMesAtual}>Mês atual</Button>
          </div>
        </div>}
      </span>
    </div>

    {mostrarFiltros && <div className="grid gap-2 rounded-xl border border-border bg-card/60 p-3 md:grid-cols-4">
      <label className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar lançamento" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }}/></label>
      <Select value={situacaoFiltro} onValueChange={(v) => { setSituacaoFiltro(v); setPagina(1); }}>
        <SelectTrigger><SelectValue placeholder="Situação"/></SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todas as situações</SelectItem>
          <SelectItem value="PENDENTE">Pendente</SelectItem>
          <SelectItem value="ATRASADO">Atrasado</SelectItem>
          <SelectItem value="BAIXADO">{ehEntrada ? "Recebido" : "Pago"}</SelectItem>
          <SelectItem value="CONCILIADO">Conciliado</SelectItem>
          <SelectItem value="PAGO">{ehEntrada ? "Recebidos + conciliados" : "Pagos + conciliados"}</SelectItem>
          <SelectItem value="CANCELADO">Cancelado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={caixaFiltro} onValueChange={(v) => { setCaixaFiltro(v); setPagina(1); }}><SelectTrigger><SelectValue placeholder="Caixa"/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os caixas</SelectItem><SelectItem value="SHARE">Share</SelectItem><SelectItem value="CLIENTE">Cliente</SelectItem></SelectContent></Select>
      <Select value={naturezaFiltro} onValueChange={(v) => { setNaturezaFiltro(v); setPagina(1); }}><SelectTrigger><SelectValue placeholder="Natureza"/></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as naturezas</SelectItem>{[...new Set(lancamentos.map((l) => l.natureza).filter(Boolean))].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
    </div>}

    {erro && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}

    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-[13px]" style={{ minWidth: larguraMinimaTabela }}>
          <colgroup>
            <col style={{ width: 40 }}/>
            <col style={{ width: 44 }}/>
            {colunas.map((c) => <col key={c.key} style={{ width: larguraDe(c) }}/>)}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2.5" aria-label="Expandir"/>
              <th className="px-2 py-2.5"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todasDaPaginaSelecionadas} disabled={!linhas.length} onChange={alternarPagina} className="accent-primary"/></th>
              {colunas.map((c) => <th key={c.key} className="relative border-l border-border/50 px-3 py-2.5 font-bold" aria-sort={ordenacao.chave === c.key ? (ordenacao.crescente ? "ascending" : "descending") : "none"}>
                <button type="button" className={`inline-flex items-center gap-1.5 uppercase ${ordenacao.chave === c.key ? "text-foreground" : ""}`} onClick={() => setOrdenacao((atual) => ({ chave: c.key, crescente: atual.chave === c.key ? !atual.crescente : true }))}>
                  {c.label}<ArrowUpDown size={12}/>
                </button>
                {/* alça de redimensionar (ícone à direita do cabeçalho, como na referência) */}
                <span role="separator" aria-orientation="vertical" aria-label={`Redimensionar coluna ${c.label}`} onPointerDown={(e) => iniciarRedimensionar(e, c)} className="absolute right-0 top-0 flex h-full w-8 cursor-col-resize touch-none items-center justify-end pr-3 opacity-60 hover:opacity-100"><ArrowUpDown size={12}/></span>
              </th>)}
            </tr>
          </thead>
          <tbody>
            {carregando
              ? <tr><td colSpan={colunas.length + 2} className="p-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline animate-spin" size={16}/>Carregando lançamentos…</td></tr>
              : linhas.length ? linhas.map((l) => {
                const aberta = expandidas.includes(l.id);
                const marcada = selecionados.includes(l.id);
                const d = aberta ? lerDetalhes(l) : null;
                return <Fragment key={l.id}>
                  <tr onClick={() => alternarExpansao(l.id)} className={`cursor-pointer border-b border-border/60 hover:bg-muted/20 ${marcada ? "bg-primary/10" : ""}`}>
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" aria-label={aberta ? "Recolher detalhes" : "Expandir detalhes"} aria-expanded={aberta} onClick={(e) => { e.stopPropagation(); alternarExpansao(l.id); }} className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                        {aberta ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      </button>
                    </td>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={marcada} onChange={() => alternarSelecao(l.id)} className="accent-primary"/>
                    </td>
                    {colunas.map((c) => celula(l, c))}
                  </tr>
                  {d && <tr className={`border-b border-border/60 ${marcada ? "bg-primary/10" : "bg-muted/20"}`}>
                    <td colSpan={colunas.length + 2} className="p-0">
                      <div className="grid gap-y-5 py-4 md:grid-cols-2 xl:grid-cols-[1.05fr_1fr_1.1fr_.9fr] xl:divide-x xl:divide-border/60">
                        <div className="space-y-3 pl-12 pr-6">
                          <Campo rotulo="Categoria">{d.categoria}</Campo>
                          <Campo rotulo="Centro de custo">{d.centroCusto}</Campo>
                          <Campo rotulo="Forma de pagamento">{d.formaPagamento}</Campo>
                        </div>
                        <div className="space-y-3 px-6">
                          <Campo rotulo="Competência">{data(d.competencia)}</Campo>
                          <Campo rotulo="Emissão">{data(d.emissao)}</Campo>
                          <Campo rotulo="Nº do documento">{d.documento}</Campo>
                        </div>
                        <div className="space-y-3 px-6">
                          <Campo rotulo="Observações">{d.observacoes}</Campo>
                          <Campo rotulo="Anexos">{d.anexos.length ? <div className="space-y-1">{d.anexos.map((a, i) => a.url
                            ? <a key={i} href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 font-normal text-primary hover:underline"><Paperclip size={14}/>{a.nome}</a>
                            : <span key={i} className="flex items-center gap-1.5 font-normal"><Paperclip size={14}/>{a.nome}</span>)}</div> : null}</Campo>
                        </div>
                        <div className="space-y-3 px-6">
                          <Campo rotulo="Criado por/em">{d.criadoPor || d.criadoEm ? `${d.criadoPor || "—"} • ${data(d.criadoEm)}` : null}</Campo>
                          <Campo rotulo="Última alteração">{d.atualizadoEm ? data(d.atualizadoEm) : null}</Campo>
                        </div>
                      </div>
                    </td>
                  </tr>}
                </Fragment>;
              })
              : <tr><td colSpan={colunas.length + 2} className="p-10 text-center text-muted-foreground">Nenhum lançamento encontrado para os filtros.</td></tr>}
          </tbody>
          {linhas.length > 0 && <tfoot>
            <tr className="border-t border-border bg-muted/20 text-xs font-bold">
              <td colSpan={colunas.length + 1} className="px-4 py-2.5 uppercase">Total listado ({filtrados.length} {filtrados.length === 1 ? "item" : "itens"})</td>
              <td className={`px-3 py-2.5 text-right text-[13px] tabular-nums ${ehEntrada ? "text-emerald-400" : "text-red-400"}`}>{formatarMoeda(total)}</td>
            </tr>
          </tfoot>}
        </table>
      </div>
    </div>

    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex items-center">
        <span className="pr-3">{selecionadosVisiveis.length === 0 ? "Nenhum selecionado" : `${selecionadosVisiveis.length} ${selecionadosVisiveis.length === 1 ? "selecionado" : "selecionados"}`}</span>
        <span className="border-l border-border px-3">{filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}</span>
        <div className="border-l border-border pl-2">
          <Select value={String(porPagina)} onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}>
            <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0"><SelectValue>{porPagina} linhas por página</SelectValue></SelectTrigger>
            <SelectContent>{[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} linhas por página</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="inline-flex items-center overflow-hidden rounded-md border border-border">
        <Button variant="ghost" size="icon" aria-label="Página anterior" className="h-8 w-9 rounded-none" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft size={16}/></Button>
        <span className="min-w-16 border-x border-border px-3 text-center text-sm text-foreground">{paginaAtual} / {paginas}</span>
        <Button variant="ghost" size="icon" aria-label="Próxima página" className="h-8 w-9 rounded-none" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight size={16}/></Button>
      </div>
    </footer>

    {/* ───────── impressão ───────── */}
    <style>{`
      .relatorio-impressao { display: none; }
      @media print {
        body * { visibility: hidden !important; }
        .relatorio-impressao, .relatorio-impressao * { visibility: visible !important; }
        .relatorio-impressao { display: block !important; position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; font-size: 11px; }
        .relatorio-impressao table { width: 100%; border-collapse: collapse; }
        .relatorio-impressao th, .relatorio-impressao td { border-bottom: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        .relatorio-impressao .direita { text-align: right; }
        .relatorio-impressao tfoot td { font-weight: 700; }
        @page { margin: 12mm; }
      }
    `}</style>
    <div className="relatorio-impressao">
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{titulo}</h1>
      <p>Período: {periodoImpressao}</p>
      <p>Emitido em {new Date().toLocaleString("pt-BR")}</p>
      <table>
        <thead><tr><th>DOC</th><th>Descrição</th><th>Favorecido</th><th>Conta</th><th>Data</th><th>Situação</th><th className="direita">Valor</th></tr></thead>
        <tbody>{itensRelatorio.map((l) => <tr key={l.id}>
          <td>{l.documento || "—"}</td><td>{l.descricao}</td><td>{l.favorecido}</td><td>{l.contaBancaria}</td><td>{formatarData(l.dataLancamento)}</td><td>{rotuloSituacao(situacaoExibida(l), ehEntrada) ?? l.situacao}</td><td className="direita">{l.fluxo === "ENTRADA" ? "+ " : "− "}{formatarMoeda(l.valor)}</td>
        </tr>)}</tbody>
        <tfoot><tr><td colSpan={6}>{usaSelecao ? `Total dos selecionados (${itensRelatorio.length} itens)` : `Total listado (${itensRelatorio.length} itens)`}</td><td className="direita">{formatarMoeda(totalRelatorio)}</td></tr></tfoot>
      </table>
    </div>

    <NovoLancamentoShareDialog aberto={novo} aoFechar={() => setNovo(false)} categorias={categorias} aoCriar={() => void recarregar()} somenteDespesa={!ehEntrada} somenteEntrada={ehEntrada}/>
    {contaBaixa && ehEntrada && <ModalContaAReceber conta={contaBaixa.raw as ContaAReceber} aberto onFechar={() => setContaBaixa(null)} contasBancarias={contasBancarias} onConfirmar={async (dados) => { await darBaixaContaAReceber(contaBaixa.id, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
    {contaBaixa && !ehEntrada && <ModalContaAPagar conta={contaBaixa.raw as ContaAPagar} aberto onFechar={() => setContaBaixa(null)} onConfirmar={async (dados) => { await darBaixaContaAPagar(contaBaixa.id, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
  </section>;
}