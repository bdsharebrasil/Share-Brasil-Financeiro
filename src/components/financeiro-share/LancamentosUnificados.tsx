import { useMemo, useState, useEffect } from "react";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, CirclePlus, Filter, Loader2, Printer, Search } from "lucide-react";
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

const mesAtualIso = () => new Date().toISOString().slice(0, 7);
const nomeMes = (m: string, formato: "long" | "short") => new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: formato });
const podeBaixar = (l: LinhaConta) => l.situacao !== "PAGO" && l.situacao !== "CANCELADO";
const CORES_SITUACAO: Record<string, string> = {
  PAGO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  ATRASADO: "border-red-500/30 bg-red-500/10 text-red-400",
  CANCELADO: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  PENDENTE: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
const ROTULO_SITUACAO: Record<string, string> = { PAGO: "Conciliado", PENDENTE: "Pendente", ATRASADO: "Atrasado", CANCELADO: "Cancelado" };

export function LancamentosUnificados({ fluxo, filtroInicial }: { fluxo: FluxoLinha; filtroInicial?: { situacao?: SituacaoLinha; inicio?: string; fim?: string } }) {
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

  const [busca, setBusca] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [situacaoFiltro, setSituacaoFiltro] = useState(filtroInicial?.situacao || "TODAS");
  const [caixaFiltro, setCaixaFiltro] = useState("TODOS");
  const [naturezaFiltro, setNaturezaFiltro] = useState("TODAS");
  const [mes, setMes] = useState(mesAtualIso);
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>(() => [mesAtualIso()]);
  const [seletorMesAberto, setSeletorMesAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordenacao, setOrdenacao] = useState<{ chave: "documento" | "descricao" | "favorecido" | "favorecidoPessoa" | "fornecedor" | "contaBancaria" | "data" | "situacao" | "valor"; crescente: boolean }>({ chave: "data", crescente: false });
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
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
    if (situacaoFiltro !== "TODAS" && l.situacao !== situacaoFiltro) return false;
    if (caixaFiltro !== "TODOS" && l.caixa !== caixaFiltro) return false;
    if (naturezaFiltro !== "TODAS" && l.natureza !== naturezaFiltro) return false;
    const texto = `${l.documento || ""} ${l.descricao} ${l.categoria} ${l.favorecido} ${l.natureza}`.toLocaleLowerCase("pt-BR");
    return texto.includes(busca.toLocaleLowerCase("pt-BR"));
  }).sort((a, b) => {
    const valor = ordenacao.chave === "documento" ? (a.documento || "").localeCompare(b.documento || "")
      : ordenacao.chave === "descricao" ? a.descricao.localeCompare(b.descricao, "pt-BR")
      : ordenacao.chave === "favorecido" ? a.favorecido.localeCompare(b.favorecido, "pt-BR")
      : ordenacao.chave === "favorecidoPessoa" ? (a.favorecidoPessoa || "").localeCompare(b.favorecidoPessoa || "", "pt-BR")
      : ordenacao.chave === "fornecedor" ? (a.fornecedor || "").localeCompare(b.fornecedor || "", "pt-BR")
      : ordenacao.chave === "contaBancaria" ? a.contaBancaria.localeCompare(b.contaBancaria, "pt-BR")
      : ordenacao.chave === "situacao" ? a.situacao.localeCompare(b.situacao)
      : ordenacao.chave === "valor" ? a.valor - b.valor
      : a.dataLancamento.localeCompare(b.dataLancamento);
    return ordenacao.crescente ? valor : -valor;
  }), [lancamentos, mesesSelecionados, situacaoFiltro, caixaFiltro, naturezaFiltro, busca, filtroInicial, ordenacao]);
  const selecionadosVisiveis = filtrados.filter((l) => selecionados.includes(l.id));
  const usaSelecao = selecionadosVisiveis.length > 0;
  const total = (usaSelecao ? selecionadosVisiveis : filtrados).reduce((s, l) => s + l.valor, 0);
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const linhas = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);
  const todasDaPaginaSelecionadas = linhas.length > 0 && linhas.every((l) => selecionados.includes(l.id));
  const itensSelecionados = lancamentos.filter((l) => selecionados.includes(l.id));
  const unicoSelecionado = itensSelecionados.length === 1 ? itensSelecionados[0] : null;
  const rotuloMes = mesesSelecionados.length === 1 ? `${nomeMes(mesesSelecionados[0], "long").replace(/^./, (c) => c.toUpperCase())} ${mesesSelecionados[0].slice(0, 4)}` : `${mesesSelecionados.length} meses selecionados`;
  const periodoImpressao = filtroInicial?.inicio || filtroInicial?.fim
    ? `${filtroInicial?.inicio ? formatarData(filtroInicial.inicio) : "início"} a ${filtroInicial?.fim ? formatarData(filtroInicial.fim) : "hoje"}`
    : [...mesesSelecionados].sort().map((m) => `${nomeMes(m, "long")} ${m.slice(0, 4)}`).join(", ");
  const itensRelatorio = usaSelecao ? selecionadosVisiveis : filtrados;
  const anoSeletor = mes.slice(0, 4);
  const mesesDoAno = Array.from({ length: 12 }, (_, i) => `${anoSeletor}-${String(i + 1).padStart(2, "0")}`);
  const mudarMes = (delta: number) => { const d = new Date(`${mes}-01T12:00:00`); d.setMonth(d.getMonth() + delta); const novo = d.toISOString().slice(0, 7); setMes(novo); setMesesSelecionados([novo]); setPagina(1); };
  const mudarAno = (delta: number) => setMes(`${Number(anoSeletor) + delta}-${mes.slice(5)}`);
  const irParaMesAtual = () => { const atual = mesAtualIso(); setMes(atual); setMesesSelecionados([atual]); setPagina(1); };
  const alternarMes = (m: string) => { setMes(m); setPagina(1); setMesesSelecionados((atual) => atual.includes(m) ? (atual.length > 1 ? atual.filter((x) => x !== m) : atual) : [...atual, m]); };
  const alternarSelecao = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const alternarPagina = () => setSelecionados((atual) => todasDaPaginaSelecionadas
    ? atual.filter((id) => !linhas.some((l) => l.id === id))
    : [...new Set([...atual, ...linhas.map((l) => l.id)])]);

  function abrirBaixa(l: LinhaConta) {
    if (podeBaixar(l)) setContaBaixa(l);
  }

  const colunas: { label: string; key: typeof ordenacao.chave }[] = ehEntrada ? [
    { label: "DOC", key: "documento" },
    { label: "Descrição", key: "descricao" },
    { label: "Favorecido", key: "favorecido" },
    { label: "Conta", key: "contaBancaria" },
    { label: "Data", key: "data" },
    { label: "Situação", key: "situacao" },
    { label: "Valor", key: "valor" },
  ] : [
    { label: "DOC", key: "documento" },
    { label: "Descrição", key: "descricao" },
    { label: "Favorecido", key: "favorecidoPessoa" },
    { label: "Fornecedor", key: "fornecedor" },
    { label: "Conta", key: "contaBancaria" },
    { label: "Data", key: "data" },
    { label: "Situação", key: "situacao" },
    { label: "Valor", key: "valor" },
  ];

  return <section className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Módulo financeiro</p><h2 className="mt-1 text-xl font-semibold">{titulo}</h2></div>
      <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{usaSelecao ? `Total selecionado (${selecionadosVisiveis.length})` : "Total listado"}</p><strong className="font-mono text-lg">{formatarMoeda(total)}</strong></div>
    </header>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setNovo(true)} className="gap-2"><CirclePlus size={15}/> Novo</Button>
      <Button variant="outline" size="icon" aria-label="Dar baixa no selecionado" title="Dar baixa no lançamento selecionado" disabled={!unicoSelecionado || !podeBaixar(unicoSelecionado)} onClick={() => unicoSelecionado && abrirBaixa(unicoSelecionado)}><Check size={15}/></Button>
      <Button variant="outline" size="icon" aria-label="Imprimir" title="Imprimir" onClick={() => window.print()}><Printer size={15}/></Button>
      <Button variant="outline" size="icon" aria-label="Mostrar filtros" title="Filtros" onClick={() => setMostrarFiltros((v) => !v)}><Filter size={15}/></Button>
      <span className="relative ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" aria-expanded={seletorMesAberto} onClick={() => setSeletorMesAberto((v) => !v)}>Mês Atual</Button>
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16}/></Button>
          <span className="min-w-[9rem] border-b-2 border-primary px-2 pb-1 text-center text-sm font-semibold">{rotuloMes}</span>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={16}/></Button>
        </span>
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
      <label className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar lançamento" value={busca} onChange={(e) => {setBusca(e.target.value);setPagina(1);}}/></label>
      <Select value={situacaoFiltro} onValueChange={(v) => {setSituacaoFiltro(v);setPagina(1);}}><SelectTrigger><SelectValue placeholder="Situação"/></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as situações</SelectItem><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="ATRASADO">Atrasado</SelectItem><SelectItem value="PAGO">Conciliado</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={caixaFiltro} onValueChange={setCaixaFiltro}><SelectTrigger><SelectValue placeholder="Caixa"/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os caixas</SelectItem><SelectItem value="SHARE">Share</SelectItem><SelectItem value="CLIENTE">Cliente</SelectItem></SelectContent></Select>
      <Select value={naturezaFiltro} onValueChange={setNaturezaFiltro}><SelectTrigger><SelectValue placeholder="Natureza"/></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as naturezas</SelectItem>{[...new Set(lancamentos.map((l) => l.natureza).filter(Boolean))].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
    </div>}
    {erro && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
      <table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>
        <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todasDaPaginaSelecionadas} disabled={!linhas.length} onChange={alternarPagina} className="accent-primary"/></th>
        {colunas.map(({label,key}) => <th key={label} className={`px-4 py-3 ${key === "valor" ? "text-right" : ""}`}><button type="button" className="inline-flex items-center gap-1" onClick={() => setOrdenacao((atual) => ({ chave: key, crescente: atual.chave === key ? !atual.crescente : true }))}>{label}<ArrowUpDown size={11}/></button></th>)}
      </tr></thead>
        <tbody>{carregando ? <tr><td colSpan={colunas.length + 1} className="p-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline animate-spin" size={16}/>Carregando lançamentos…</td></tr> : linhas.length ? linhas.map((l) => <tr key={l.id} onClick={() => abrirBaixa(l)} className={`cursor-pointer border-b border-border/60 hover:bg-muted/20 ${selecionados.includes(l.id) ? "bg-primary/5" : ""}`}>
          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={selecionados.includes(l.id)} onChange={() => alternarSelecao(l.id)} className="accent-primary"/></td>
          <td className="px-4 py-3 font-mono text-primary">{l.documento || "—"}</td>
          <td className="px-4 py-3"><strong>{l.descricao}</strong><div className="mt-1 text-[10px] text-muted-foreground">{l.categoria}</div></td>
          {ehEntrada ? <td className="px-4 py-3">{l.favorecido}</td> : <><td className="px-4 py-3">{l.favorecidoPessoa || "—"}</td><td className="px-4 py-3">{l.fornecedor || "—"}</td></>}
          <td className="px-4 py-3 font-mono">{l.contaBancaria}</td>
          <td className="px-4 py-3">{formatarData(l.dataLancamento)}{l.dataVencimento && <div className="mt-1 text-[10px] text-muted-foreground">Venc. {formatarData(l.dataVencimento)}</div>}</td>
          <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${CORES_SITUACAO[l.situacao] ?? CORES_SITUACAO.PENDENTE}`}>{ROTULO_SITUACAO[l.situacao] ?? l.situacao}</span></td>
          <td className={`px-4 py-3 text-right font-mono font-bold ${l.fluxo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>{l.fluxo === "ENTRADA" ? "+ " : "− "}{formatarMoeda(l.valor)}</td>
        </tr>) : <tr><td colSpan={colunas.length + 1} className="p-10 text-center text-muted-foreground">Nenhum lançamento encontrado para os filtros.</td></tr>}</tbody>
        {linhas.length > 0 && <tfoot className="border-t border-border bg-muted/20 font-bold"><tr><td colSpan={colunas.length} className="px-4 py-3">{usaSelecao ? `TOTAL SELECIONADO (${selecionadosVisiveis.length} itens)` : `TOTAL LISTADO (${filtrados.length} itens)`}</td><td className="px-4 py-3 text-right font-mono">{formatarMoeda(total)}</td></tr></tfoot>}
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtrados.length ? `${(pagina-1)*porPagina+1}–${Math.min(pagina*porPagina,filtrados.length)} de ${filtrados.length}` : "0 itens"}</span><div className="flex items-center gap-2"><Select value={String(porPagina)} onValueChange={(v) => {setPorPagina(Number(v));setPagina(1);}}><SelectTrigger className="h-8 w-24"><SelectValue/></SelectTrigger><SelectContent>{[10,25,50,100].map((n)=><SelectItem key={n} value={String(n)}>{n} / pág.</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" disabled={pagina<=1} onClick={()=>setPagina(pagina-1)}>Anterior</Button><Button variant="outline" size="sm" disabled={pagina>=paginas} onClick={()=>setPagina(pagina+1)}>Próxima</Button></div></footer>
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
          <td>{l.documento || "—"}</td><td>{l.descricao}</td><td>{l.favorecido}</td><td>{l.contaBancaria}</td><td>{formatarData(l.dataLancamento)}</td><td>{ROTULO_SITUACAO[l.situacao] ?? l.situacao}</td><td className="direita">{l.fluxo === "ENTRADA" ? "+ " : "− "}{formatarMoeda(l.valor)}</td>
        </tr>)}</tbody>
        <tfoot><tr><td colSpan={6}>{usaSelecao ? `Total dos selecionados (${itensRelatorio.length} itens)` : `Total listado (${itensRelatorio.length} itens)`}</td><td className="direita">{formatarMoeda(total)}</td></tr></tfoot>
      </table>
    </div>
    <NovoLancamentoShareDialog aberto={novo} aoFechar={()=>setNovo(false)} categorias={categorias} aoCriar={()=>void recarregar()} somenteDespesa={!ehEntrada} somenteEntrada={ehEntrada}/>
    {contaBaixa && ehEntrada && <ModalContaAReceber conta={contaBaixa.raw as ContaAReceber} aberto onFechar={() => setContaBaixa(null)} contasBancarias={contasBancarias} onConfirmar={async (dados) => { await darBaixaContaAReceber(contaBaixa.id, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
    {contaBaixa && !ehEntrada && <ModalContaAPagar conta={contaBaixa.raw as ContaAPagar} aberto onFechar={() => setContaBaixa(null)} onConfirmar={async (dados) => { await darBaixaContaAPagar(contaBaixa.id, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
  </section>;
}
