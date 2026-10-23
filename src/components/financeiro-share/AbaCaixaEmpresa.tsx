import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, FileText, Loader2, Pencil, Plus,
  RefreshCw, Search, SlidersHorizontal, Trash2, X, Download, Columns3, ChevronsUpDown, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { alterarStatusLancamento, editarLancamento, gerarReembolso } from "@/lib/financeiro-share-api";
import type { FluxoLancamento, Lancamento, StatusLancamento } from "./tipos";
import "./caixa-empresa.css";
type Documento = Lancamento["anexos"][number];
type FluxoFiltro = FluxoLancamento | "TODOS";
type StatusFiltro = StatusLancamento | "ATIVOS" | "TODOS";
type Ordem = "RECENTES" | "ANTIGOS" | "MAIOR" | "MENOR";
type Confirmacao = { tipo: "EXCLUIR"; ids: string[] }
  | { tipo: "BAIXA" | "REEMBOLSO"; id: string };
type Falha = { id: string; descricao: string; mensagem: string };
type ColunaCaixa = "data" | "descricao" | "favorecido" | "categoria" | "conta" | "fluxo" | "valor" | "status";
const COLUNAS_OCULTAVEIS: { chave: ColunaCaixa; rotulo: string }[] = [
  { chave: "data", rotulo: "Data / ID" },
  { chave: "descricao", rotulo: "Descrição" },
  { chave: "favorecido", rotulo: "Favorecido" },
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "conta", rotulo: "Conta" },
  { chave: "fluxo", rotulo: "Fluxo" },
  { chave: "valor", rotulo: "Valor" },
  { chave: "status", rotulo: "Status" },
];
const COLUNAS_ESQUERDA: ColunaCaixa[] = ["data", "descricao", "favorecido", "categoria", "conta"];
const TOTAL_COLUNAS = COLUNAS_OCULTAVEIS.length + 2;
const STATUS: StatusLancamento[] = ["EM_ABERTO", "PAGO", "RECEITA", "EM_ATRASO", "ESTORNO", "RECEBIDO", "SAIDA", "ENTRADA", "AGUARDANDO_REEMBOLSO", "REEMBOLSADO", "CANCELADO"];
const FINALIZADOS = new Set<StatusLancamento>(["PAGO", "RECEBIDO", "CANCELADO"]);
const INPUT = "cash-input";
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
export type ContaCaixaEmpresa = {
  id: string;
  nome: string;
  identificacao?: string;
  saldoCentavos: number;
};
export type PosicaoCaixaEmpresa = {
  saldoDisponivelCentavos: number;
  saldoProjetadoCentavos?: number;
  atualizadoEm?: string;
  contas?: ContaCaixaEmpresa[];
};
export type DadosBancariosLancamento = {
  contaId?: string;
  contaNome?: string;
  formaPagamento?: string;
  centroCusto?: string;
  conciliado?: boolean;
};
export type AbaCaixaEmpresaProps = {
  onNovoLancamento?: () => void;
  posicaoCaixa?: PosicaoCaixaEmpresa | null;
  obterDadosBancarios?: (item: Lancamento) => DadosBancariosLancamento;
  onAtualizarPosicao?: () => Promise<void>;
};
type EdicaoLote = { id: string; original: string; descricao: string };
const STATUS_ROTULOS: Record<string, string> = {
  EM_ABERTO: "Em aberto", PAGO: "Pago", RECEITA: "Receita", EM_ATRASO: "Em atraso",
  ESTORNO: "Estorno", RECEBIDO: "Recebido", SAIDA: "Saída", ENTRADA: "Entrada",
  AGUARDANDO_REEMBOLSO: "Aguardando reembolso", REEMBOLSADO: "Reembolsado", CANCELADO: "Cancelado",
};
function mesAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function podeSelecionar(item: Lancamento) { return item.fluxo === "SAIDA" && item.status !== "CANCELADO"; }
function chaveConta(dados?: DadosBancariosLancamento) {
  return dados?.contaId ? `id:${dados.contaId}` : dados?.contaNome ? `nome:${dados.contaNome}` : "SEM_CONTA";
}
function resumirRealizados(itens: Lancamento[]) {
  const realizados = itens.filter(item => item.status === "PAGO" || item.status === "RECEBIDO");
  return { ...resumir(realizados), creditos: realizados.filter(item => item.fluxo === "ENTRADA" && valorValido(item)).length,
    pagamentos: realizados.filter(item => item.fluxo === "SAIDA" && valorValido(item)).length };
}
function celulaCsv(valor: unknown) {
  let texto = String(valor ?? "");
  // Neutraliza fórmulas ao abrir descrições/documentos em planilhas.
  if (/^[\s]*[=+@-]/.test(texto) || /^[\t\r\n]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}
function montarCsv(itens: Lancamento[], dados: Map<string, DadosBancariosLancamento>) {
  const linhas = [["Data", "ID", "Documento", "Descrição", "Favorecido", "Categoria", "Conta", "Fluxo", "Valor (R$)", "Status"]];
  for (const item of itens) linhas.push([formatarData(item.data), item.id, item.documento || "", item.descricao,
    item.fornecedor || "", item.categoria || "", dados.get(item.id)?.contaNome || "", item.fluxo === "ENTRADA" ? "Entrada" : "Saída",
    valorValido(item) ? (item.valorCentavos / 100).toFixed(2).replace(".", ",") : "Valor inválido", STATUS_ROTULOS[item.status] || item.status]);
  return "\uFEFF" + linhas.map(linha => linha.map(celulaCsv).join(";")).join("\r\n");
}
function StatusBadge({ status }: { status: StatusLancamento }) {
  const tom = ["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(status) ? "success" : status === "EM_ATRASO" ? "danger" : status === "CANCELADO" ? "neutral" : "warning";
  return <span className={`cash-status cash-status-${tom}`}><i aria-hidden="true" />{STATUS_ROTULOS[status] || status}</span>;
}
function DocumentoPreview({ documento, onClose }: { documento: Documento; onClose: () => void }) {
  const url = urlSegura(documento.url);
  const imagem = /\.(png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(documento.url) || documento.tipo?.startsWith("image/");
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="cash-dialog max-h-[92dvh] max-w-5xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="break-all pr-6">{documento.nome}</DialogTitle>
        <DialogDescription>Documento vinculado ao lançamento.</DialogDescription>
      </DialogHeader>
      {!url ? <p role="alert" className="text-sm text-destructive">Endereço do documento inválido.</p>
        : <>
          {imagem ? <img src={url} alt={documento.nome} className="mx-auto max-h-[65vh] max-w-full object-contain" />
            : <iframe sandbox="" referrerPolicy="no-referrer" title={documento.nome} src={url} className="h-[65vh] w-full border border-border" />}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">Abrir documento em nova aba</a>
        </>}
    </DialogContent>
  </Dialog>;
}
function Detalhes({ item, dados, ocupado, onDocumento, onEditar, onAcao }: {
  item: Lancamento; dados?: DadosBancariosLancamento; ocupado: boolean;
  onDocumento: (documento: Documento) => void; onEditar: () => void; onAcao: (acao: Confirmacao) => void;
}) {
  return <div className="cash-entry-detail">
    <section className="cash-detail-block"><h3>Anexos</h3><div className="cash-document-list">
      {item.anexos.length ? item.anexos.map(doc => <button key={doc.id} type="button" onClick={() => onDocumento(doc)}><FileText size={15} aria-hidden="true" /><span>{doc.nome}</span></button>) : <p className="cash-muted">Nenhum anexo.</p>}
    </div></section>
    <section className="cash-detail-block"><h3>Dados do pagamento</h3><dl>
      <div><dt>Forma</dt><dd>{dados?.formaPagamento || "—"}</dd></div>
      <div><dt>Conta</dt><dd>{dados?.contaNome || "—"}</dd></div>
      <div><dt>Favorecido</dt><dd>{item.fornecedor || "—"}</dd></div>
      <div><dt>Pagador</dt><dd>{item.pagoPor || "—"}</dd></div>
      <div><dt>Vencimento</dt><dd>{formatarData(item.prazo)}</dd></div>
    </dl></section>
    <section className="cash-detail-block"><h3>Conciliação</h3><dl>
      <div><dt>Situação</dt><dd>{dados?.conciliado === true ? "Conciliado" : dados?.conciliado === false ? "Não conciliado" : "—"}</dd></div>
      <div><dt>Status</dt><dd>{STATUS_ROTULOS[item.status] || item.status}</dd></div>
      <div><dt>Competência</dt><dd>{rotuloMes(mesDoLancamento(item))}</dd></div>
      <div><dt>Centro de custo</dt><dd>{dados?.centroCusto || "—"}</dd></div>
      <div><dt>Reembolsável</dt><dd>{item.reembolsavel ? "Sim" : "Não"}</dd></div>
    </dl></section>
    {item.observacoes && <p className="cash-observations">{item.observacoes}</p>}
    <div className="cash-entry-actions">
      {item.reembolsavel && item.cotistaId && item.status !== "CANCELADO" && <Button disabled={ocupado || !valorValido(item)} size="sm" variant="outline" onClick={() => onAcao({ tipo: "REEMBOLSO", id: item.id })}>Gerar reembolso</Button>}
      <Button disabled={ocupado} size="sm" variant="outline" onClick={onEditar}><Pencil size={14} />Editar descrição</Button>
      {!FINALIZADOS.has(item.status) && <Button disabled={ocupado || !valorValido(item)} size="sm" variant="outline" onClick={() => onAcao({ tipo: "BAIXA", id: item.id })}><CheckCircle2 size={14} />Dar baixa</Button>}
      {podeExcluir(item) && <Button disabled={ocupado} size="sm" variant="outline" className="cash-danger" onClick={() => onAcao({ tipo: "EXCLUIR", ids: [item.id] })}><Trash2 size={14} />Excluir</Button>}
    </div>
  </div>;
}
export function AbaCaixaEmpresa({ onNovoLancamento, posicaoCaixa, obterDadosBancarios, onAtualizarPosicao }: AbaCaixaEmpresaProps) {
  // Filtros locais mantêm os contadores e a seleção consistentes entre as abas.
  const { lancamentos, carregando, erro, recarregar } = useCaixaEmpresa({});
  const [fluxo, setFluxo] = useState<FluxoFiltro>("TODOS");
  const [status, setStatus] = useState<StatusFiltro>("ATIVOS");
  const [busca, setBusca] = useState("");
  const [meses, setMeses] = useState<string[]>(() => [mesAtual()]);
  const [ordem, setOrdem] = useState<Ordem>("RECENTES");
  const [colunasOcultas, setColunasOcultas] = useState<Set<ColunaCaixa>>(() => new Set());
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
  const [contaFiltro, setContaFiltro] = useState("TODAS");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [edicoesLote, setEdicoesLote] = useState<EdicaoLote[] | null>(null);
  // Guarda síncrona: bloqueia duplo clique antes do próximo render.
  const trava = useRef(false);
  const bloqueado = ocupado || carregando || Boolean(erro);
  const mesesDisponiveis = useMemo(() => [...new Set([mesAtual(), ...lancamentos.map(mesDoLancamento)])].sort().reverse(), [lancamentos]);
  const dadosPorLancamento = useMemo(() => new Map<string, DadosBancariosLancamento>(lancamentos.map(item => {
    const dados = obterDadosBancarios?.(item) || {};
    const conta = posicaoCaixa?.contas?.find(conta => conta.id === dados.contaId);
    return [item.id, { ...dados, contaNome: dados.contaNome || (conta ? [conta.nome, conta.identificacao].filter(Boolean).join(" · ") : undefined) }];
  })), [lancamentos, obterDadosBancarios, posicaoCaixa?.contas]);
  const contasFiltro = useMemo(() => {
    const contas = new Map<string, string>();
    for (const dados of dadosPorLancamento.values()) contas.set(chaveConta(dados), dados.contaNome || "Sem conta informada");
    return [...contas].map(([id, nome]) => ({ id, nome })).sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [dadosPorLancamento]);
  const periodoConta = useMemo(() => lancamentos.filter(item =>
    (!meses.length || meses.includes(mesDoLancamento(item))) &&
    (contaFiltro === "TODAS" || chaveConta(dadosPorLancamento.get(item.id)) === contaFiltro)
  ), [lancamentos, meses, contaFiltro, dadosPorLancamento]);
  // Indicadores realizados seguem período e conta; busca/status/fluxo filtram apenas o extrato.
  const indicadores = useMemo(() => resumirRealizados(periodoConta), [periodoConta]);
  const baseFiltrada = useMemo(() => {
    const termo = normalizar(busca.trim());
    return periodoConta.filter(item =>
      (status === "TODOS" || (status === "ATIVOS" ? item.status !== "CANCELADO" : item.status === status)) &&
      (!termo || normalizar([item.id, item.descricao, item.documento, item.fornecedor, item.categoria, item.pagoPor, item.observacoes, dadosPorLancamento.get(item.id)?.contaNome].filter(Boolean).join(" ")).includes(termo))
    );
  }, [periodoConta, busca, status, dadosPorLancamento]);
  const filtrados = useMemo(() => baseFiltrada.filter((item) => fluxo === "TODOS" || item.fluxo === fluxo).sort((a, b) => {
    const porData = (b.data || "").localeCompare(a.data || "");
    if (ordem === "MAIOR") return b.valorCentavos - a.valorCentavos || porData || a.id.localeCompare(b.id);
    if (ordem === "MENOR") return a.valorCentavos - b.valorCentavos || porData || a.id.localeCompare(b.id);
    return (ordem === "ANTIGOS" ? -porData : porData) || a.id.localeCompare(b.id);
  }), [baseFiltrada, fluxo, ordem]);
  const idsFiltrados = useMemo(() => new Set(filtrados.filter(podeSelecionar).map((item) => item.id)), [filtrados]);
  const itensSelecionados = useMemo(() => filtrados.filter((item) => podeSelecionar(item) && selecionados.has(item.id)), [filtrados, selecionados]);
  const resumo = useMemo(() => resumir(filtrados), [filtrados]);
  const resumoSelecao = useMemo(() => resumir(itensSelecionados), [itensSelecionados]);
  const excluiveis = itensSelecionados.filter(podeExcluir);
  const invalidos = periodoConta.filter(item => item.status !== "CANCELADO" && !valorValido(item)).length;
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const itensPagina = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const despesasFiltradas = filtrados.filter(podeSelecionar);
  const despesasPagina = itensPagina.filter(podeSelecionar);
  const todosPagina = despesasPagina.length > 0 && despesasPagina.every(item => selecionados.has(item.id));
  const algunsPagina = despesasPagina.some(item => selecionados.has(item.id));
  const alvo = confirmacao && confirmacao.tipo !== "EXCLUIR" ? lancamentos.find((item) => item.id === confirmacao.id) : undefined;
  const alvosExclusao = confirmacao?.tipo === "EXCLUIR" ? lancamentos.filter((item) => confirmacao.ids.includes(item.id) && podeExcluir(item)) : [];
  const resumoExclusao = resumir(alvosExclusao);
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
    prepararFiltro(); setFluxo("TODOS"); setStatus("ATIVOS"); setBusca(""); setMeses([]); setOrdem("RECENTES"); setContaFiltro("TODAS");
  }
  function marcar(ids: string[], checked: boolean) {
    setSelecionados((anteriores) => {
      const proximos = new Set(anteriores);
      ids.forEach((id) => { if (checked && idsFiltrados.has(id)) proximos.add(id); else proximos.delete(id); });
      return proximos;
    });
  }
  function iniciar() {
    if (trava.current) return false;
    trava.current = true; setOcupado(true); return true;
  }
  function terminar() { trava.current = false; setOcupado(false); }
  async function atualizarAposGravacao() {
    try { await recarregar(); await onAtualizarPosicao?.(); }
    catch { toast.warning("A operação foi salva, mas a lista não atualizou. Clique em Atualizar."); }
  }
  async function atualizar() {
    if (!iniciar()) return;
    try { await recarregar(); await onAtualizarPosicao?.(); } catch (error) { toast.error(mensagemErro(error)); } finally { terminar(); }
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
  function abrirEdicaoLote() {
    if (bloqueado) return;
    setEdicoesLote(itensSelecionados.map(item => ({ id: item.id, original: item.descricao, descricao: item.descricao })));
  }
  async function salvarLote() {
    const alteradas = (edicoesLote || []).filter(item => item.descricao.trim() !== item.original);
    if (!alteradas.length || alteradas.some(item => !item.descricao.trim() || item.descricao.trim().length > 240) || bloqueado || !iniciar()) return;
    const erros: Falha[] = [], concluidos = new Set<string>();
    setFalhas([]); setProgresso({ atual: 0, total: alteradas.length });
    try {
      for (const [indice, edicao] of alteradas.entries()) {
        const atual = lancamentos.find(item => item.id === edicao.id);
        if (!atual || !podeSelecionar(atual)) {
          erros.push({ id: edicao.id, descricao: edicao.original, mensagem: "Despesa indisponível. Atualize a lista." });
        } else if (atual.descricao !== edicao.original) {
          erros.push({ id: edicao.id, descricao: edicao.original, mensagem: "Descrição alterada. Reabra a edição." });
        } else {
          try { await editarLancamento(edicao.id, { descricao: edicao.descricao.trim() }); concluidos.add(edicao.id); }
          catch (error) { erros.push({ id: edicao.id, descricao: edicao.original, mensagem: mensagemErro(error) }); }
        }
        setProgresso({ atual: indice + 1, total: alteradas.length });
      }
      setSelecionados(anteriores => new Set([...anteriores].filter(id => !concluidos.has(id))));
      setFalhas(erros); setEdicoesLote(null);
      if (concluidos.size) toast.success(`${concluidos.size} descrição(ões) atualizada(s).`);
      if (erros.length) toast.error(`${erros.length} alteração(ões) não concluída(s).`);
      await atualizarAposGravacao();
    } finally { setProgresso({ atual: 0, total: 0 }); terminar(); }
  }
  function exportarExtrato() {
    if (bloqueado || !filtrados.length) return;
    const url = URL.createObjectURL(new Blob([montarCsv(filtrados, dadosPorLancamento)], { type: "text/csv;charset=utf-8;" }));
    const link = window.document.createElement("a");
    link.href = url; link.download = `extrato-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
    window.document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const mudancasLote = (edicoesLote || []).filter(item => item.descricao.trim() !== item.original);
  const ocultar = (coluna: ColunaCaixa) => colunasOcultas.has(coluna);
  const colunasEsquerdaVisiveis = COLUNAS_ESQUERDA.filter(coluna => !ocultar(coluna)).length;
  const totalColunasVisiveis = TOTAL_COLUNAS - colunasOcultas.size;
  function alternarColuna(coluna: ColunaCaixa) {
    setColunasOcultas(atuais => {
      const proximas = new Set(atuais);
      if (proximas.has(coluna)) proximas.delete(coluna); else proximas.add(coluna);
      return proximas;
    });
  }
  return <div className="company-cash" aria-busy={ocupado || carregando}>
    <header className="cash-header">
      <div className="cash-page-title"><h2>Caixa da empresa</h2></div>
      <div className="cash-header-actions">
        <Popover><PopoverTrigger asChild><Button variant="outline" disabled={ocupado} className="cash-period" aria-label="Selecionar período"><CalendarDays size={15} /><span>{meses.length === 1 ? rotuloMes(meses[0]) : meses.length ? `${meses.length} meses` : "Todos os períodos"}</span><ChevronDown size={14} /></Button></PopoverTrigger>
          <PopoverContent align="end" className="cash-popover">
            <div className="cash-popover-heading"><strong>Período</strong><Button variant="ghost" size="sm" onClick={() => { prepararFiltro(); setMeses([]); }} disabled={ocupado}>Todos</Button></div>
            <div className="cash-month-list">{mesesDisponiveis.map(mes => <label key={mes}><Checkbox disabled={ocupado} checked={meses.includes(mes)} onCheckedChange={checked => { prepararFiltro(); setMeses(atuais => checked === true ? [...new Set([...atuais, mes])] : atuais.filter(m => m !== mes)); }} /><span>{rotuloMes(mes)}</span></label>)}</div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" disabled={ocupado || carregando} onClick={() => void atualizar()} aria-label="Atualizar movimentações"><RefreshCw size={15} className={ocupado || carregando ? "animate-spin" : ""} /><span>Atualizar</span></Button>
        <Button variant="outline" disabled={bloqueado || !filtrados.length} onClick={exportarExtrato}><Download size={15} />Exportar extrato</Button>
        {onNovoLancamento && <Button className="cash-primary" disabled={ocupado} onClick={onNovoLancamento}><Plus size={16} />Nova movimentação</Button>}
      </div>
    </header>

    <section className="cash-ledger-panel" aria-label="Extrato consolidado">
      <div className="cash-toolbar">
        <div className="cash-ledger-title"><div><span className="cash-kicker">Movimentação financeira</span><h3>Extrato consolidado</h3></div><span className="cash-count">{carregando || erro ? "—" : `${filtrados.length} movimentações`}</span></div>
        <div className="cash-filters">
          <label className="cash-search"><Search size={15} aria-hidden="true" /><input aria-label="Buscar movimentações" type="search" placeholder="Buscar descrição…" value={busca} disabled={ocupado} onChange={e => { prepararFiltro(); setBusca(e.target.value); }} /></label>
          <select aria-label="Fluxo da movimentação" value={fluxo} disabled={ocupado} onChange={e => { prepararFiltro(); setFluxo(e.target.value as FluxoFiltro); }}><option value="TODOS">Todos os fluxos</option><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select>
          <select aria-label="Conta bancária" value={contaFiltro} disabled={ocupado} onChange={e => { prepararFiltro(); setContaFiltro(e.target.value); }}><option value="TODAS">Todas as contas</option>{contasFiltro.map(conta => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select>
          <Button variant="outline" aria-expanded={filtrosAbertos} aria-controls="cash-extra-filters" disabled={ocupado} onClick={() => setFiltrosAbertos(v => !v)}><SlidersHorizontal size={15} />Filtros{status !== "ATIVOS" && <span className="cash-filter-dot" />}</Button>
          <Popover><PopoverTrigger asChild><Button variant="outline" disabled={ocupado} aria-label="Mostrar ou ocultar colunas"><Columns3 size={15} />Colunas</Button></PopoverTrigger>
            <PopoverContent align="end" className="cash-popover">
              <div className="cash-popover-heading"><strong>Mostrar ou ocultar colunas</strong><Button variant="ghost" size="sm" onClick={() => setColunasOcultas(new Set())} disabled={!colunasOcultas.size}>Mostrar todas</Button></div>
              <ul className="cash-column-list">{COLUNAS_OCULTAVEIS.map(({ chave, rotulo }) => { const visivel = !ocultar(chave); return <li key={chave} data-hidden={!visivel}><span>{rotulo}</span><button type="button" aria-pressed={visivel} aria-label={`${visivel ? "Ocultar" : "Mostrar"} coluna ${rotulo}`} onClick={() => alternarColuna(chave)}>{visivel ? <Eye size={15} /> : <EyeOff size={15} />}</button></li>; })}</ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {filtrosAbertos && <div id="cash-extra-filters" className="cash-extra-filters">
        <label>Status<select value={status} disabled={ocupado} onChange={e => { prepararFiltro(); setStatus(e.target.value as StatusFiltro); }}><option value="ATIVOS">Ativos</option><option value="TODOS">Todos os status</option>{STATUS.map(s => <option key={s} value={s}>{STATUS_ROTULOS[s] || s}</option>)}</select></label>
        <label>Ordenação<select value={ordem} disabled={ocupado} onChange={e => { setPagina(1); setExpandido(null); setOrdem(e.target.value as Ordem); }}><option value="RECENTES">Mais recentes</option><option value="ANTIGOS">Mais antigos</option><option value="MAIOR">Maior valor</option><option value="MENOR">Menor valor</option></select></label>
        <Button variant="ghost" disabled={ocupado} onClick={limparFiltros}><X size={14} />Limpar filtros</Button>
      </div>}
      {itensSelecionados.length > 0 && <div className="cash-selection-bar" role="region" aria-label="Despesas selecionadas">
        <span aria-live="polite"><b>{itensSelecionados.length}</b> {itensSelecionados.length === 1 ? "despesa selecionada" : "despesas selecionadas"}<strong>{exibirTotal(resumoSelecao.saidas, resumoSelecao.valido)}</strong></span>
        <div><Button size="sm" variant="outline" disabled={bloqueado} onClick={abrirEdicaoLote}><Pencil size={14} />Editar em lote</Button><Button size="sm" variant="outline" className="cash-danger" disabled={bloqueado || !excluiveis.length} onClick={() => setConfirmacao({ tipo: "EXCLUIR", ids: excluiveis.map(item => item.id) })}><Trash2 size={14} />Excluir ({excluiveis.length})</Button>
          {despesasFiltradas.length > itensSelecionados.length && <button type="button" disabled={bloqueado} onClick={() => marcar(despesasFiltradas.map(item => item.id), true)}>Selecionar {despesasFiltradas.length} despesas</button>}
          <button type="button" disabled={ocupado} onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
        </div>
      </div>}

      {erro && <div role="alert" className="cash-message cash-message-error"><span>Não foi possível carregar as movimentações.</span><Button variant="outline" size="sm" disabled={ocupado || carregando} onClick={() => void atualizar()}>Tentar novamente</Button></div>}
      {!erro && invalidos > 0 && <p role="alert" className="cash-message">{invalidos} lançamento(s) com valor inválido, fora dos totais.</p>}
      {(!resumo.valido || !indicadores.valido) && <p role="alert" className="cash-message cash-message-error">Total fora do limite de precisão. Reduza o período.</p>}
      {falhas.length > 0 && <div role="alert" className="cash-message cash-message-error"><div><strong>{falhas.length} operação(ões) não concluída(s)</strong><ul>{falhas.map(falha => <li key={falha.id}>{falha.descricao}: {falha.mensagem}</li>)}</ul></div><button type="button" disabled={ocupado} onClick={() => setFalhas([])} aria-label="Fechar relatório de falhas"><X size={16} /></button></div>}

      {carregando ? <div role="status" className="cash-empty"><Loader2 size={20} className="animate-spin" />Carregando movimentações…</div> : !erro && <div className="cash-table-scroll" role="region" aria-label="Movimentações do caixa" tabIndex={0}>
        <table className="cash-table"><caption className="sr-only">Extrato consolidado. Totais de todos os registros filtrados, excluindo cancelados.</caption>
          <colgroup><col style={{ width: 42 }} />{!ocultar("data") && <col style={{ width: 122 }} />}{!ocultar("descricao") && <col />}{!ocultar("favorecido") && <col style={{ width: 170 }} />}{!ocultar("categoria") && <col style={{ width: 150 }} />}{!ocultar("conta") && <col style={{ width: 160 }} />}{!ocultar("fluxo") && <col style={{ width: 108 }} />}{!ocultar("valor") && <col style={{ width: 172 }} />}{!ocultar("status") && <col style={{ width: 160 }} />}<col style={{ width: 52 }} /></colgroup>
          <thead><tr>
            <th scope="col" className="cash-selection-cell"><Checkbox aria-label="Selecionar despesas desta página" disabled={bloqueado || !despesasPagina.length} checked={todosPagina ? true : algunsPagina ? "indeterminate" : false} onCheckedChange={checked => marcar(despesasPagina.map(item => item.id), checked === true)} /></th>
            {!ocultar("data") && <th scope="col" className="cash-col-data" aria-sort={ordem === "RECENTES" ? "descending" : ordem === "ANTIGOS" ? "ascending" : "none"}><button type="button" className="cash-sort" disabled={ocupado} onClick={() => { setPagina(1); setOrdem(ordem === "RECENTES" ? "ANTIGOS" : "RECENTES"); }}>Data / ID{ordem === "ANTIGOS" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button></th>}
            {!ocultar("descricao") && <th scope="col">Descrição</th>}{!ocultar("favorecido") && <th scope="col">Favorecido</th>}{!ocultar("categoria") && <th scope="col">Categoria</th>}{!ocultar("conta") && <th scope="col">Conta</th>}{!ocultar("fluxo") && <th scope="col">Fluxo</th>}
            {!ocultar("valor") && <th scope="col" className="cash-num" aria-sort={ordem === "MAIOR" ? "descending" : ordem === "MENOR" ? "ascending" : "none"}><button type="button" className="cash-sort" disabled={ocupado} onClick={() => { setPagina(1); setOrdem(ordem === "MAIOR" ? "MENOR" : "MAIOR"); }}>Valor{ordem === "MENOR" ? <ChevronUp size={12} /> : ordem === "MAIOR" ? <ChevronDown size={12} /> : <ChevronsUpDown size={12} />}</button></th>}
            {!ocultar("status") && <th scope="col">Status</th>}<th scope="col"><span className="sr-only">Detalhes</span></th>
          </tr></thead>
          <tbody>{!itensPagina.length ? <tr><td colSpan={totalColunasVisiveis}><div className="cash-empty"><Search size={22} /><strong>Nenhuma movimentação encontrada</strong><Button variant="ghost" onClick={limparFiltros}>Limpar filtros</Button></div></td></tr> : itensPagina.map(item => {
            const aberto = expandido === item.id, entrada = item.fluxo === "ENTRADA", dados = dadosPorLancamento.get(item.id);
            return <Fragment key={item.id}><tr className="cash-entry-row" data-expanded={aberto} data-selected={selecionados.has(item.id)} data-cancelled={item.status === "CANCELADO"}>
              <td className="cash-selection-cell"><Checkbox aria-label={`Selecionar despesa ${item.descricao}`} disabled={bloqueado || !podeSelecionar(item)} checked={selecionados.has(item.id)} onCheckedChange={checked => marcar([item.id], checked === true)} /></td>
              {!ocultar("data") && <td className="cash-col-data"><b className="cash-date">{formatarData(item.data)}</b><small className="cash-reference">{item.documento || item.id}</small></td>}
              {!ocultar("descricao") && <td><b className="cash-description">{item.descricao}</b></td>}{!ocultar("favorecido") && <td>{item.fornecedor || "—"}</td>}
              {!ocultar("categoria") && <td><span className="cash-category">{item.categoria || "Sem categoria"}</span></td>}
              {!ocultar("conta") && <td>{dados?.contaNome || "—"}</td>}
              {!ocultar("fluxo") && <td><span className={`cash-flow ${entrada ? "cash-flow-income" : "cash-flow-expense"}`}>{entrada ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{entrada ? "Entrada" : "Saída"}</span></td>}
              {!ocultar("valor") && <td className="cash-num"><strong className={entrada ? "cash-amount-income" : "cash-amount-expense"}>{valorValido(item) ? `${entrada ? "+" : "−"} ${formatarMoeda(item.valorCentavos)}` : "Valor inválido"}</strong></td>}
              {!ocultar("status") && <td><StatusBadge status={item.status} /></td>}
              <td><button type="button" className="cash-expand" aria-expanded={aberto} aria-controls={`cash-detail-${item.id}`} aria-label={`${aberto ? "Fechar" : "Abrir"} detalhes de ${item.descricao}`} onClick={() => setExpandido(aberto ? null : item.id)}>{aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
            </tr>{aberto && <tr className="cash-detail-row" id={`cash-detail-${item.id}`}><td colSpan={totalColunasVisiveis}><Detalhes item={item} dados={dados} ocupado={bloqueado} onDocumento={setDocumento} onEditar={() => setEdicao({ id: item.id, descricao: item.descricao })} onAcao={setConfirmacao} /></td></tr>}</Fragment>;
          })}</tbody>
          <tfoot><tr><td />{colunasEsquerdaVisiveis > 0 && <td colSpan={colunasEsquerdaVisiveis}>Total dos registros filtrados</td>}{!ocultar("fluxo") && <td>Resultado</td>}{!ocultar("valor") && <td className="cash-num"><strong className={resumo.saldo < 0 ? "cash-amount-expense" : "cash-amount-income"}>{exibirTotal(resumo.saldo, resumo.valido)}</strong></td>}<td colSpan={ocultar("status") ? 1 : 2} /></tr></tfoot>
        </table>
      </div>}
      {!erro && !carregando && <footer className="cash-pagination"><span role="status" aria-live="polite">{filtrados.length ? `${(paginaAtual - 1) * porPagina + 1}–${Math.min(paginaAtual * porPagina, filtrados.length)} de ${filtrados.length} movimentações` : "0 movimentações"}</span><div>
        <select aria-label="Movimentações por página" value={porPagina} disabled={ocupado} onChange={e => { setPagina(1); setExpandido(null); setPorPagina(Number(e.target.value)); }}>{[10,20,50,100].map(n => <option key={n} value={n}>{n} por página</option>)}</select><span>Página {paginaAtual} de {paginas}</span>
        <button type="button" disabled={ocupado || paginaAtual <= 1} aria-label="Página anterior" onClick={() => { setPagina(paginaAtual - 1); setExpandido(null); }}><ChevronLeft size={16} /></button>
        <button type="button" disabled={ocupado || paginaAtual >= paginas} aria-label="Próxima página" onClick={() => { setPagina(paginaAtual + 1); setExpandido(null); }}><ChevronRight size={16} /></button>
      </div></footer>}
    </section>

    <Dialog open={Boolean(edicoesLote)} onOpenChange={open => { if (!open && !trava.current) setEdicoesLote(null); }}>
      <DialogContent className="cash-dialog max-w-2xl" onEscapeKeyDown={e => { if (ocupado) e.preventDefault(); }} onInteractOutside={e => { if (ocupado) e.preventDefault(); }}><DialogHeader><DialogTitle>Editar descrições em lote</DialogTitle><DialogDescription>{edicoesLote?.length || 0} despesas selecionadas. Apenas as descrições alteradas serão salvas.</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void salvarLote(); }}><div className="cash-batch-fields">{edicoesLote?.map((item, index) => <label key={item.id}><span>{item.id}</span><input aria-label={`Descrição da despesa ${item.id}`} required maxLength={240} disabled={ocupado} value={item.descricao} onChange={e => setEdicoesLote(atuais => atuais?.map((linha,i) => i === index ? { ...linha, descricao: e.target.value } : linha) || null)} /></label>)}</div>
          {ocupado && <p role="status">Salvando {progresso.atual} de {progresso.total}…</p>}
          <div className="cash-dialog-actions"><Button type="button" variant="outline" disabled={ocupado} onClick={() => setEdicoesLote(null)}>Cancelar</Button><Button type="submit" disabled={bloqueado || !mudancasLote.length || mudancasLote.some(item => !item.descricao.trim() || item.descricao.trim().length > 240)}>Salvar alterações</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    {documento && <DocumentoPreview documento={documento} onClose={() => setDocumento(null)} />}
    <Dialog open={Boolean(edicao)} onOpenChange={(open) => { if (!open && !trava.current) setEdicao(null); }}>
      <DialogContent className="cash-dialog max-w-lg" onEscapeKeyDown={(e) => { if (ocupado) e.preventDefault(); }} onInteractOutside={(e) => { if (ocupado) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Editar descrição</DialogTitle><DialogDescription>Atualize a identificação do lançamento.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void salvarEdicao(); }} className="space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium">Descrição</span><input autoFocus required maxLength={240} disabled={ocupado} value={edicao?.descricao || ""} onChange={(e) => setEdicao((atual) => atual ? { ...atual, descricao: e.target.value } : null)} className={INPUT} /></label>
          <p className="text-right text-xs text-muted-foreground">{edicao?.descricao.length || 0}/240</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={ocupado} onClick={() => setEdicao(null)}>Cancelar</Button><Button type="submit" disabled={bloqueado || !edicao?.descricao.trim()} className="gap-2">{ocupado && <Loader2 size={15} className="animate-spin" />}Salvar alteração</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(confirmacao)} onOpenChange={(open) => { if (!open && !trava.current) setConfirmacao(null); }}>
      <DialogContent className="cash-dialog max-w-lg" onEscapeKeyDown={(e) => { if (ocupado) e.preventDefault(); }} onInteractOutside={(e) => { if (ocupado) e.preventDefault(); }}>
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
