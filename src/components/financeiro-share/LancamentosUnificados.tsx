import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns2,
  Eye,
  EyeOff,
  FileDown,
  Filter,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoShare from "@/assets/share-signature-logo.png";
import { anexosFinanceiros, rotaProxyDocumentoPublico } from "@/lib/documentos-financeiros";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { API_BASE } from "@/lib/api";
import { buscarAeronavesShare } from "@/lib/colaborador-api";
import { IconeAnexo } from "./IconeAnexo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  buscarCaixaEmpresa,
  buscarMovimentosHolding,
  buscarOpcoesFinanceiroShare,
  carregarDocumentoFinanceiro,
  darBaixaContaAPagar,
  darBaixaContaAReceber,
  darBaixaPagamentoShare,
  excluirLancamento,
  formatarData,
  formatarMoeda,
  type CategoriaCaixaShare,
  type ContaBancaria,
  type MovimentoHoldingPendente,
} from "@/lib/financeiro-share-api";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import type { ContaAPagar, ContaAReceber, Lancamento, TipoDocumento } from "./tipos";
import {
  linhasDeContasAPagar,
  linhasDeContasAReceber,
  linhasDeLancamentosHolding,
  linhasDeMovimentosHolding,
  type FluxoLinha,
  type LinhaConta,
  type SituacaoLinha,
} from "./linhas-contas";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { NovoLancamentoShareDialog, type LancamentoEdicao } from "./NovoLancamentoShareDialog";
import { AbaSolicitacoesPagamento } from "./AbaSolicitacoesPagamento";
import { ControleZoomTabela, useZoomTabela } from "./ControleZoomTabela";
import { opcoesPeriodicidade } from "@/data/opcoes";

/** Campos opcionais: conecte aos nomes reais do seu backend via obterDetalhes. */
export type DetalhesLancamento = {
  observacoes?: string;
  anexos?: Array<{ nome: string; url: string; numero?: string | null }>;
};

type AnexoLancamento = { nome: string; href: string; numero?: string | null };

type Props = {
  fluxo: FluxoLinha | "TODOS";
  caixa?: "HOLDING";
  filtroInicial?: { situacao?: SituacaoLinha; inicio?: string; fim?: string };
  obterDetalhes?: (linha: LinhaConta) => DetalhesLancamento;
};

type ChaveColuna =
  | "documento" | "aeronave" | "descricao" | "fluxo" | "periodicidade" | "favorecido"
  | "fornecedor" | "contaBancaria" | "data" | "situacao" | "valor";
type Coluna = { chave: ChaveColuna; rotulo: string; largura?: number };
type FiltroSituacao = "TODAS" | "EM_ABERTO" | "PAGO" | "EM_ATRASO" | "RECEBIDO" | "AGUARDANDO_REEMBOLSO" | "REEMBOLSADO" | "CANCELADO";
type FiltroColuna = "contaBancaria" | "documento" | "data";
type ModoData = "EMISSAO" | "VENCIMENTO" | "PAGAMENTO" | "AMBAS";
type CampoRelatorioMensal = "data" | "descricao" | "tipoCaixa" | "entrada" | "saida";

const TIPOS_DOCUMENTO: TipoDocumento[] = ["RECIBO", "RELATORIO VIAGEM", "DEMONSTRATIVO", "NOTA FISCAL", "COMANDA", "BOLETO"];
const ROTULOS_MODO_DATA: Record<ModoData, string> = { EMISSAO: "DATA EMISSÃO", VENCIMENTO: "VENCIMENTO", PAGAMENTO: "PAGAMENTO", AMBAS: "EMISSÃO + VENCIMENTO" };
const CAMPOS_RELATORIO_MENSAL: Array<{ chave: CampoRelatorioMensal; rotulo: string }> = [
  { chave: "data", rotulo: "Data" }, { chave: "descricao", rotulo: "Descrição" },
  { chave: "tipoCaixa", rotulo: "Tipo de caixa" }, { chave: "entrada", rotulo: "Entrada" },
  { chave: "saida", rotulo: "Saída" },
];

function tipoDocumento(linha: LinhaConta): TipoDocumento | null {
  return linha.raw.tipoDocumento ?? null;
}

function ehColunaFiltravel(chave: ChaveColuna): chave is FiltroColuna {
  return chave === "contaBancaria" || chave === "documento" || chave === "data";
}

const TITULOS_FILTRO_COLUNA: Record<FiltroColuna, string> = {
  contaBancaria: "conta", documento: "tipo de documento", data: "data",
};

const STATUS_FILTRO: Array<{ valor: Exclude<FiltroSituacao, "TODAS">; rotulo: string }> = [
  { valor: "EM_ABERTO", rotulo: "EM ABERTO" },
  { valor: "PAGO", rotulo: "PAGO" },
  { valor: "EM_ATRASO", rotulo: "EM ATRASO" },
  { valor: "RECEBIDO", rotulo: "RECEBIDO" },
  { valor: "AGUARDANDO_REEMBOLSO", rotulo: "AGUARDANDO REEMBOLSO" },
  { valor: "REEMBOLSADO", rotulo: "REEMBOLSADO" },
  { valor: "CANCELADO", rotulo: "CANCELADO" },
];

const rotuloStatus = (status: Exclude<FiltroSituacao, "TODAS">) =>
  status.replace(/_/g, " ");

function situacaoFiltroInicial(situacao?: SituacaoLinha): FiltroSituacao {
  if (situacao === "PENDENTE") return "EM_ABERTO";
  if (situacao === "ATRASADO") return "EM_ATRASO";
  return situacao ?? "TODAS";
}

function statusParaFiltro(linha: LinhaConta): Exclude<FiltroSituacao, "TODAS"> {
  if (linha.situacao === "ATRASADO") return "EM_ATRASO";
  if (linha.statusOriginal === "PENDENTE") return "EM_ABERTO";
  return linha.statusOriginal as Exclude<FiltroSituacao, "TODAS">;
}

const ROTULOS: Record<string, string> = {
  EM_ABERTO: "EM ABERTO",
  PENDENTE: "EM ABERTO",
  PAGO: "PAGO",
  ATRASADO: "EM ATRASO",
  EM_ATRASO: "EM ATRASO",
  RECEBIDO: "RECEBIDO",
  AGUARDANDO_REEMBOLSO: "AGUARDANDO REEMBOLSO",
  REEMBOLSADO: "REEMBOLSADO",
  CANCELADO: "CANCELADO",
};
const TONS: Record<string, string> = {
  PAGO: "sucesso", RECEBIDO: "sucesso", REEMBOLSADO: "sucesso",
  EM_ABERTO: "pendente", EM_ATRASO: "atrasado",
  AGUARDANDO_REEMBOLSO: "aguardando", CANCELADO: "cancelado",
};

// Usa o calendário local para não avançar o mês por causa do fuso UTC.
function mesAtualIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}
function nomeMes(mes: string, formato: "long" | "short" = "long") {
  return new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: formato });
}
function rotuloMes(mes: string) {
  const nome = nomeMes(mes);
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${mes.slice(0, 4)}`;
}
function podeBaixar(linha: LinhaConta) {
  return linha.caixa !== "HOLDING" && linha.situacao !== "PAGO" && linha.situacao !== "CANCELADO";
}
function ehLancamentoDireto(conta: ContaAPagar) {
  return conta.fonteLancamento === true && (conta.lancamentoId ?? conta.id) === conta.id;
}
function ehReembolso(linha: LinhaConta) {
  const raw = linha.raw as unknown as Record<string, unknown>;
  const origem = String(raw.origemTipo ?? raw.origem_tipo ?? "").trim().toUpperCase();
  const categoria = String(raw.categoriaNome ?? raw.categoria_nome ?? linha.categoria ?? "").trim().toUpperCase();
  const grupo = String(raw.grupoCategoria ?? raw.grupo_categoria ?? "").trim().toUpperCase();
  return raw.reembolsavel === true || raw.reembolsavel === 1 || raw.reembolsavel === "1"
    || origem.includes("REEMBOLSO") || categoria.includes("REEMBOLSO") || grupo.includes("REEMBOLS");
}
function tipoCaixaRelatorio(linha: LinhaConta) {
  const raw = linha.raw as unknown as Record<string, unknown>;
  const valor = raw.tipoCaixa ?? raw.tipo_caixa ?? raw.conta_tipo_caixa ?? linha.caixa;
  return String(valor ?? linha.caixa).trim().toUpperCase() || linha.caixa;
}
function fluxoRelatorio(linha: LinhaConta): "ENTRADA" | "SAIDA" {
  return linha.fluxo === "ENTRADA" || linha.fluxo === "ENTRADA REEMBOLSO" || linha.fluxo === "RECEITA" ? "ENTRADA" : "SAIDA";
}
function correspondeAoSegmentoCaixa(linha: LinhaConta, filtro: string) {
  if (filtro === "TODOS") return true;
  const raw = linha.raw as unknown as Record<string, unknown>;
  const grupo = String(raw.grupoCategoria ?? raw.grupo_categoria ?? "").trim().toUpperCase();
  if (filtro === "EMPRESA") return grupo === "DESPESAS EMPRESA";
  if (filtro === "PARTICULAR") return grupo === "PARTICULAR";
  if (filtro === "SHARE") return linha.caixa === "SHARE" || (linha.fluxo === "SAIDA" && ehReembolso(linha));
  return linha.caixa === filtro;
}
function correspondeAoFluxo(linha: LinhaConta, filtro: "TODOS" | FluxoLinha) {
  if (filtro === "TODOS") return true;
  if (filtro === "SAIDA REEMBOLSO") return linha.fluxo === "SAIDA" && ehReembolso(linha);
  if (filtro === "ENTRADA REEMBOLSO") return linha.fluxo === "ENTRADA" && ehReembolso(linha);
  return linha.fluxo === filtro;
}
function contaAPagarDaLinha(linha: LinhaConta, contas: ContaAPagar[]) {
  const raw = linha.raw as ContaAPagar;
  const lancamentoId = raw.lancamentoId || linha.id;
  const exata = contas.find((conta) => conta.id === linha.id);
  if (exata && !ehLancamentoDireto(exata)) return exata;
  return contas.find((conta) => conta.id !== lancamentoId && conta.lancamentoId === lancamentoId)
    ?? exata
    ?? raw;
}
function dataOuTraco(valor?: string) {
  return valor ? formatarData(valor.slice(0, 10)) : "—";
}
function lerTexto(raw: Record<string, unknown>, ...chaves: string[]) {
  const valor = chaves.map((chave) => raw[chave]).find((item) => item !== undefined && item !== null && item !== "");
  return typeof valor === "string" || typeof valor === "number" ? String(valor).trim() || null : null;
}
function dataBaixaLinha(linha: LinhaConta) {
  const raw = linha.raw as unknown as Record<string, unknown>;
  const pagamento = lerTexto(raw, "dataPagamento", "data_pagamento");
  const recebimento = lerTexto(raw, "dataRecebimento", "data_recebimento");
  return (fluxoRelatorio(linha) === "ENTRADA" ? recebimento || pagamento : pagamento || recebimento) ?? "";
}
function urlSegura(valor: string) {
  try {
    const valorLimpo = valor.trim();
    const chaveConhecida = Boolean(rotaProxyDocumentoPublico(valorLimpo));
    const resolvido = valorLimpo.startsWith("/") ? `${API_BASE}${valorLimpo}`
      : chaveConhecida && !/^https?:\/\//i.test(valorLimpo) ? `${API_BASE}/${valorLimpo.replace(/^\/+/, "")}` : valorLimpo;
    const url = new URL(resolvido, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function reunirAnexos(linha: LinhaConta, dados: DetalhesLancamento = {}): AnexoLancamento[] {
  const raw = linha.raw as unknown as Record<string, unknown>;
  const candidatos = [...anexosFinanceiros(raw), ...(dados.anexos ?? [])];
  const urlsVistas = new Set<string>();
  return candidatos.flatMap(({ nome, url, numero }) => {
    if (typeof url !== "string") return [];
    const href = urlSegura(url);
    if (!href || urlsVistas.has(href)) return [];
    urlsVistas.add(href);
    return [{ nome: nome || "Anexo", href, numero }];
  });
}

function Checkbox({
  marcado, parcial = false, desabilitado = false, rotulo, aoMudar,
}: {
  marcado: boolean;
  parcial?: boolean;
  desabilitado?: boolean;
  rotulo: string;
  aoMudar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = parcial; }, [parcial]);
  return (
    <label className="erp-checkbox">
      <input ref={ref} type="checkbox" checked={marcado} disabled={desabilitado}
        aria-label={rotulo} onChange={aoMudar} />
      <span aria-hidden="true">{parcial ? <span className="erp-checkbox-traco" /> : <Check size={11} strokeWidth={3} />}</span>
    </label>
  );
}

function VisualizadorAnexo({ titulo, href, mime, aoFechar }: { titulo: string; href: string; mime: string; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent
        className="flex h-[88vh] max-w-5xl flex-col gap-3 p-4"
        onPointerDown={(evento) => evento.stopPropagation()}
        onClick={(evento) => evento.stopPropagation()}
      >
        <DialogTitle className="truncate text-base">{titulo}</DialogTitle>
        <DialogDescription className="sr-only">Visualização do anexo do lançamento</DialogDescription>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md bg-muted">
          {mime.startsWith("image/") ? <img src={href} alt={titulo} className="mx-auto h-full object-contain" />
            : mime === "application/pdf" ? <iframe src={href} title={titulo} className="h-full w-full border-0" />
            : <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              Este arquivo não pode ser exibido aqui.
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">Abrir em nova aba</a>
            </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CartaoAnexo({ anexo }: { anexo: AnexoLancamento }) {
  const [recurso, setRecurso] = useState<{ url: string; mime: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [visualizando, setVisualizando] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setCarregando(true);
    setFalha(false);
    setRecurso(null);
    void carregarDocumentoFinanceiro(anexo.href, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      const mime = blob.type.toLowerCase().split(";")[0];
      setRecurso({ url: objectUrl, mime });
    }).catch(() => {
      if (!controller.signal.aborted) setFalha(true);
    }).finally(() => {
      if (!controller.signal.aborted) setCarregando(false);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [anexo.href, tentativa]);

  const href = recurso?.url;
  const titulo = anexo.nome || "Anexo";
  const nomeCompleto = `${titulo}${anexo.numero ? ` · ${anexo.numero}` : ""}`;
  const mime = recurso?.mime ?? "";

  return (
    <article className="erp-anexo-card">
      {href ? <button type="button" className="erp-anexo-link" aria-label={`Abrir ${nomeCompleto}`} title={nomeCompleto} onClick={() => setVisualizando(true)}>
        <IconeAnexo nome={titulo} />
        <span className="erp-anexo-nome">{nomeCompleto}</span>
      </button> : <div className="erp-anexo-indisponivel" aria-live="polite" title={nomeCompleto}>
        <IconeAnexo nome={titulo} />
        <span className="erp-anexo-nome">{nomeCompleto}</span>
        {falha
          ? <button type="button" className="erp-anexo-tentar" aria-label={`Tentar novamente: ${titulo}`} title="Tentar novamente" onClick={() => setTentativa((valor) => valor + 1)}><RotateCw size={16} aria-hidden="true" /></button>
          : <Loader2 size={16} className="animate-spin" aria-label={carregando ? "Carregando anexo" : "Preparando anexo"} />}
      </div>}
      {visualizando && href && <VisualizadorAnexo titulo={titulo} href={href} mime={mime} aoFechar={() => setVisualizando(false)} />}
    </article>
  );
}

function Detalhes({ linha, dados }: { linha: LinhaConta; dados: DetalhesLancamento }) {
  const anexos = reunirAnexos(linha, dados);
  const raw = linha.raw as unknown as Record<string, unknown>;
  const numeroRecibo = lerTexto(raw, "numeroRecibo", "numero_recibo") ?? anexos.find((anexo) => anexo.nome === "Recibo")?.numero ?? null;
  const numeroDemonstrativo = lerTexto(raw, "numeroDemonstrativo", "numero_demonstrativo") ?? anexos.find((anexo) => anexo.nome === "Demonstrativo")?.numero ?? null;
  const numeroDocumento = lerTexto(raw, "numeroDoc", "numero_doc", "numeroNf", "numero_nf") ?? linha.documento;
  return (
    <div className="erp-detalhes">
      <dl className="erp-detalhes-campos">
        <div><dt>Categoria</dt><dd>{linha.categoria || "—"}</dd></div>
        <div><dt>Vencimento</dt><dd>{dataOuTraco(linha.dataVencimento)}</dd></div>
        <div><dt>{fluxoRelatorio(linha) === "ENTRADA" ? "Data de recebimento" : "Data de pagamento"}</dt><dd>{dataOuTraco(dataBaixaLinha(linha))}</dd></div>
        <div><dt>Favorecido</dt><dd>{linha.favorecidoPessoa || linha.favorecido || "—"}</dd></div>
        <div><dt>Nº do documento</dt><dd>{numeroDocumento || "—"}</dd></div>
        <div><dt>Nº do recibo</dt><dd>{numeroRecibo || "—"}</dd></div>
        <div><dt>Nº do demonstrativo</dt><dd>{numeroDemonstrativo || "—"}</dd></div>
        <div className="erp-detalhes-obs-wrap"><dt>Observações</dt><dd className="erp-observacoes">{dados.observacoes || "—"}</dd></div>
      </dl>
      <section className="erp-anexos" aria-label="Anexos do lançamento">
        <header className="erp-anexos-cabecalho"><strong>Anexos e documentos</strong><span>{anexos.length} {anexos.length === 1 ? "arquivo" : "arquivos"}</span></header>
        {anexos.length ? <div className="erp-anexos-grade">{anexos.map((anexo) => <CartaoAnexo key={anexo.href} anexo={anexo} />)}</div>
          : <p className="erp-anexos-vazio">Nenhum anexo vinculado a este lançamento.</p>}
      </section>
    </div>
  );
}

function celulaLancamento(chave: ChaveColuna, linha: LinhaConta) {
  switch (chave) {
    case "data": {
      const tituloData = linha.dataVencimento
        ? `Emissão: ${dataOuTraco(linha.dataLancamento)} · Venc.: ${dataOuTraco(linha.dataVencimento)}`
        : dataOuTraco(linha.dataLancamento);
      return <td key={chave} className="erp-td-data" title={tituloData}>{dataOuTraco(linha.dataLancamento)}</td>;
    }
    case "documento":
      return <td key={chave} className="erp-documento" title={linha.documento || undefined}>{linha.documento || "—"}</td>;
    case "aeronave":
      return <td key={chave} className="erp-aeronave" title={linha.aeronave || undefined}>{linha.aeronave || "—"}</td>;
    case "descricao": {
      const tituloDesc = linha.categoria ? `${linha.descricao} (${linha.categoria})` : linha.descricao;
      return <td key={chave} title={tituloDesc}><span className="erp-descricao">{linha.descricao}</span></td>;
    }
    case "fluxo":
      return <td key={chave}><span className={`erp-status erp-status-${linha.fluxo === "ENTRADA" ? "sucesso" : "atrasado"}`}>{linha.fluxo === "ENTRADA" ? "ENTRADA" : "SAÍDA"}</span></td>;
    case "periodicidade": {
      const rotulo = opcoesPeriodicidade.find((opcao) => opcao.id === linha.periodicidade)?.label ?? linha.periodicidade ?? "—";
      return <td key={chave}>{rotulo.toLocaleUpperCase("pt-BR")}</td>;
    }
    case "favorecido":
      return <td key={chave} title={linha.favorecido || undefined}>{linha.favorecido || "—"}</td>;
    case "fornecedor":
      return <td key={chave} title={linha.fornecedor || undefined}>{linha.fornecedor || "—"}</td>;
    case "contaBancaria":
      return <td key={chave} title={linha.contaBancaria || undefined}>{linha.contaBancaria || "—"}</td>;
    case "situacao":
      return <td key={chave}><span className={`erp-status erp-status-${TONS[statusParaFiltro(linha)] ?? "cancelado"}`}>{ROTULOS[statusParaFiltro(linha)] ?? rotuloStatus(statusParaFiltro(linha))}</span></td>;
    case "valor":
      return <td key={chave} className="erp-valor">{formatarMoeda(linha.valor)}</td>;
  }
}

export function LancamentosUnificados({ fluxo, caixa, filtroInicial, obterDetalhes }: Props) {
  const pagar = useContasAPagar({ incluirLancamentos: true, incluirReembolsos: true });
  const receber = useContasAReceber();
  const ehEntrada = fluxo === "ENTRADA";
  const ehHolding = caixa === "HOLDING";
  const fluxosFiltro: FluxoLinha[] = fluxo === "TODOS" ? ["ENTRADA", "SAIDA"] : ehEntrada ? ["ENTRADA", "ENTRADA REEMBOLSO"] : ["SAIDA", "SAIDA REEMBOLSO"];
  const titulo = ehHolding ? "Lançamentos · Holding" : `${ehEntrada ? "Registrar Entrada" : "Registrar Saída"}`;
  const [lancamentosHolding, setLancamentosHolding] = useState<Lancamento[]>([]);
  const [movimentosHolding, setMovimentosHolding] = useState<MovimentoHoldingPendente[]>([]);
  const [movimentosHoldingShare, setMovimentosHoldingShare] = useState<MovimentoHoldingPendente[]>([]);
  const [carregandoHolding, setCarregandoHolding] = useState(ehHolding);
  const [erroHolding, setErroHolding] = useState<string | null>(null);
  const recarregarHolding = useCallback(async () => {
    setCarregandoHolding(true);
    setErroHolding(null);
    try {
      const [lancamentos, movimentos] = await Promise.all([
        buscarCaixaEmpresa({ caixa: "HOLDING" }),
        buscarMovimentosHolding(),
      ]);
      setLancamentosHolding(lancamentos);
      setMovimentosHolding(movimentos);
    } catch (causa) {
      setErroHolding(causa instanceof Error ? causa.message : "Não foi possível carregar os lançamentos da holding.");
    } finally {
      setCarregandoHolding(false);
    }
  }, []);
  useEffect(() => { if (ehHolding) void recarregarHolding(); }, [ehHolding, recarregarHolding]);
  useEffect(() => {
    if (ehHolding) return;
    let ativo = true;
    void buscarMovimentosHolding().then((movimentos) => { if (ativo) setMovimentosHoldingShare(movimentos); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [ehHolding]);
  const carregando = ehHolding ? carregandoHolding : ehEntrada ? receber.carregando : pagar.carregando;
  const erro = ehHolding ? erroHolding : ehEntrada ? receber.erro : pagar.erro;
  const recarregar = ehHolding ? recarregarHolding : ehEntrada ? receber.recarregar : pagar.recarregar;
  const id = useId().replace(/:/g, "");
  const periodoRef = useRef<HTMLDivElement>(null);
  const botaoPeriodoRef = useRef<HTMLButtonElement>(null);
  const dialogoPeriodoRef = useRef<HTMLDivElement>(null);
  const statusFiltroRef = useRef<HTMLDivElement>(null);
  const colunasMenuRef = useRef<HTMLDivElement>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const pararResizeRef = useRef<(() => void) | null>(null);
  const [arrastandoTabela, setArrastandoTabela] = useState(false);
  const { zoom, alterar: alterarZoom, definir: definirZoom } = useZoomTabela("erp-lancamentos-zoom");

  const [matriculasAeronaves, setMatriculasAeronaves] = useState<Record<string, string>>({});
  const lancamentos = useMemo(() => {
    const linhas = ehHolding ? linhasDeLancamentosHolding(lancamentosHolding, movimentosHolding)
      : ehEntrada ? linhasDeContasAReceber(receber.contas) : [
        ...linhasDeContasAPagar(pagar.contas),
        ...linhasDeMovimentosHolding(movimentosHoldingShare.filter((movimento) =>
          String(movimento.status).toUpperCase() === "PAGO" && String(movimento.conta_tipo_caixa).toUpperCase() === "SHARE"
          && !pagar.contas.some((conta) => conta.movimentoHoldingId === movimento.id)), "SHARE"),
      ];
    return linhas.map((linha) => ({
      ...linha,
      aeronave: linha.aeronave || (linha.aeronaveId ? matriculasAeronaves[linha.aeronaveId] : null) || null,
    }));
  }, [ehHolding, ehEntrada, lancamentosHolding, movimentosHolding, movimentosHoldingShare, receber.contas, pagar.contas, matriculasAeronaves]);

  const [busca, setBusca] = useState("");
  const [relatorioMensalAberto, setRelatorioMensalAberto] = useState(false);
  const [mesRelatorio, setMesRelatorio] = useState(mesAtualIso);
  const [camposRelatorio, setCamposRelatorio] = useState<CampoRelatorioMensal[]>(CAMPOS_RELATORIO_MENSAL.map((campo) => campo.chave));
  const linhasRelatorioMensal = useMemo(() => {
    const base = ehHolding
      ? linhasDeLancamentosHolding(lancamentosHolding, movimentosHolding)
      : [...linhasDeContasAPagar(pagar.contas), ...linhasDeContasAReceber(receber.contas)];
    const unicas = new Map<string, LinhaConta>();
    for (const linha of base) {
      const chave = `${linha.caixa}:${linha.id}:${linha.fluxo}`;
      if (!unicas.has(chave) && (linha.dataLancamento || "").slice(0, 7) === mesRelatorio) unicas.set(chave, linha);
    }
    return [...unicas.values()].sort((a, b) => a.dataLancamento.localeCompare(b.dataLancamento, "pt-BR") || a.descricao.localeCompare(b.descricao, "pt-BR"));
  }, [ehHolding, lancamentosHolding, movimentosHolding, pagar.contas, receber.contas, mesRelatorio]);
  const totaisRelatorioMensal = useMemo(() => linhasRelatorioMensal.reduce((totais, linha) => {
    if (linha.fluxo === "ENTRADA" || linha.fluxo === "ENTRADA REEMBOLSO" || linha.fluxo === "RECEITA") totais.entrada += linha.valor;
    else totais.saida += linha.valor;
    return totais;
  }, { entrada: 0, saida: 0 }), [linhasRelatorioMensal]);
  const carregandoRelatorioMensal = ehHolding ? carregandoHolding : pagar.carregando || receber.carregando;
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [situacaoFiltro, setSituacaoFiltro] = useState<FiltroSituacao>(situacaoFiltroInicial(filtroInicial?.situacao));
  const [statusFiltroAberto, setStatusFiltroAberto] = useState(false);
  const [caixaFiltro, setCaixaFiltro] = useState("TODOS");
  const [fluxoFiltro, setFluxoFiltro] = useState<"TODOS" | FluxoLinha>("TODOS");
  const [mes, setMes] = useState(mesAtualIso);
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>(() => [mesAtualIso()]);
  const [seletorMesAberto, setSeletorMesAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordenacao, setOrdenacao] = useState<{ chave: ChaveColuna; crescente: boolean }>({ chave: "data", crescente: true });
  const [larguras, setLarguras] = useState<Partial<Record<ChaveColuna, number>>>({});
  const [ordemColunas, setOrdemColunas] = useState<ChaveColuna[]>([]);
  const [colunaArrastada, setColunaArrastada] = useState<ChaveColuna | null>(null);
  const [colunasOcultas, setColunasOcultas] = useState<ChaveColuna[]>([]);
  const [menuColunasAberto, setMenuColunasAberto] = useState(false);
  const [colunaFiltroAberta, setColunaFiltroAberta] = useState<ChaveColuna | null>(null);
  const [contaFiltro, setContaFiltro] = useState<string | null>(null);
  const [docFiltro, setDocFiltro] = useState<TipoDocumento | null>(null);
  const [modoData, setModoData] = useState<ModoData>(() => filtroInicial?.inicio || filtroInicial?.fim ? "VENCIMENTO" : "EMISSAO");
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string; cidade?: string | null; origem: string }>>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [expandidos, setExpandidos] = useState<string[]>([]);
  const [contaBaixa, setContaBaixa] = useState<LinhaConta | null>(null);
  const [loteBaixa, setLoteBaixa] = useState<{ total: number; fila: LinhaConta[] } | null>(null);
  const [lancamentoEditando, setLancamentoEditando] = useState<LancamentoEdicao | null>(null);
  const contaBaixaReal = useMemo(
    () => contaBaixa ? contaAPagarDaLinha(contaBaixa, pagar.contas) : null,
    [contaBaixa, pagar.contas],
  );
  const [menuLinhaId, setMenuLinhaId] = useState<string | null>(null);
  const [abaSaida, setAbaSaida] = useState<"lancamentos" | "solicitacoes">("lancamentos");
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);

  const atualizarSolicitacoesPendentes = useCallback((quantidade: number) => {
    setSolicitacoesPendentes(quantidade);
    if (quantidade === 0) setAbaSaida("lancamentos");
  }, []);

  useEffect(() => {
    let ativo = true;
    void buscarOpcoesFinanceiroShare().then((opcoes) => {
      if (ativo) { setCategorias(opcoes.categorias); setContasBancarias(opcoes.contas_bancarias); setFornecedores(opcoes.fornecedores ?? []); }
    }).catch(() => {
      if (ativo) toast.error("Não foi possível carregar as opções financeiras. Tente novamente.");
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      buscarAeronavesShare("ativa").catch(() => ({ aeronaves: [] })),
      buscarAeronavesShare("inativa").catch(() => ({ aeronaves: [] })),
    ]).then(([ativas, inativas]) => {
      if (!ativo) return;
      setMatriculasAeronaves(Object.fromEntries(
        [...ativas.aeronaves, ...inativas.aeronaves].map((aeronave) => [aeronave.id, aeronave.matricula_registro]),
      ));
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    setSelecionados([]);
    setExpandidos([]);
    setContaBaixa(null);
    setLoteBaixa(null);
    setNovo(false);
    setLarguras({});
    setOrdemColunas([]);
    setColunasOcultas([]);
  }, [fluxo]);

  useEffect(() => { setSituacaoFiltro(situacaoFiltroInicial(filtroInicial?.situacao)); }, [filtroInicial?.situacao]);
  useEffect(() => {
    setPagina(1);
  }, [busca, situacaoFiltro, caixaFiltro, fluxoFiltro, mesesSelecionados, modoData,
    porPagina, fluxo, filtroInicial?.inicio, filtroInicial?.fim]);
  useEffect(() => () => { pararResizeRef.current?.(); stopDragRef.current?.(); }, []);

  useEffect(() => {
    if (!seletorMesAberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !periodoRef.current?.contains(evento.target)) setSeletorMesAberto(false);
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") { setSeletorMesAberto(false); botaoPeriodoRef.current?.focus(); }
    };
    dialogoPeriodoRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [seletorMesAberto]);

  useEffect(() => {
    if (!menuColunasAberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !colunasMenuRef.current?.contains(evento.target)) setMenuColunasAberto(false);
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuColunasAberto(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [menuColunasAberto]);

  useEffect(() => {
    if (!statusFiltroAberto) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !statusFiltroRef.current?.contains(evento.target)) {
        setStatusFiltroAberto(false);
      }
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setStatusFiltroAberto(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [statusFiltroAberto]);

  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Element && evento.target.closest(".erp-coluna-filtro-anchor")) return;
      setColunaFiltroAberta(null);
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setColunaFiltroAberta(null);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [colunaFiltroAberta]);

  const contasDisponiveis = useMemo(
    () => [...new Set(lancamentos.map((linha) => linha.contaBancaria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lancamentos],
  );

  function filtroColunaAtivo(chave: FiltroColuna) {
    if (chave === "contaBancaria") return contaFiltro !== null;
    if (chave === "documento") return docFiltro !== null;
    return modoData !== "EMISSAO";
  }

  function opcoesFiltroColuna(chave: FiltroColuna): Array<{ rotulo: string; ativo: boolean; aplicar: () => void }> {
    if (chave === "contaBancaria") return [
      { rotulo: "Todas as contas", ativo: contaFiltro === null, aplicar: () => setContaFiltro(null) },
      ...contasDisponiveis.map((conta) => ({ rotulo: conta, ativo: contaFiltro === conta, aplicar: () => setContaFiltro(conta) })),
    ];
    if (chave === "documento") return [
      { rotulo: "Todos os tipos", ativo: docFiltro === null, aplicar: () => setDocFiltro(null) },
      ...TIPOS_DOCUMENTO.map((tipo) => ({ rotulo: tipo, ativo: docFiltro === tipo, aplicar: () => setDocFiltro(tipo) })),
    ];
    return (Object.keys(ROTULOS_MODO_DATA) as ModoData[]).map((modo) => ({
      rotulo: ROTULOS_MODO_DATA[modo], ativo: modoData === modo, aplicar: () => setModoData(modo),
    }));
  }

  const colunas = useMemo<Coluna[]>(() => [
    { chave: "data", rotulo: "Data", largura: 96 },
    { chave: "periodicidade", rotulo: "Periodicidade", largura: 120 },
    { chave: "documento", rotulo: "DOC", largura: 106 },
    { chave: "aeronave", rotulo: "Aeronave", largura: 94 },
    { chave: "descricao", rotulo: "Descrição", largura: 220 },
    ...(ehHolding ? [{ chave: "fluxo" as const, rotulo: "Fluxo", largura: 92 }] : []),
    ...(ehEntrada
      ? [{ chave: "favorecido" as const, rotulo: "Favorecido", largura: 170 }]
      : ehHolding
        ? [{ chave: "favorecido" as const, rotulo: "Favorecido / fornecedor", largura: 170 }]
        : [{ chave: "fornecedor" as const, rotulo: "Fornecedor", largura: 165 }]),
    { chave: "contaBancaria", rotulo: "Conta", largura: 118 },
    { chave: "situacao", rotulo: "Status", largura: 112 },
    { chave: "valor", rotulo: "Valor", largura: 114 },
  ], [ehEntrada, ehHolding]);

  const colunasExibidas = useMemo<Coluna[]>(() => {
    const porChave = new Map<ChaveColuna, Coluna>(colunas.map((coluna) => [coluna.chave, coluna]));
    const ordenadas = ordemColunas.flatMap((chave) => porChave.get(chave) ?? []);
    return [...ordenadas, ...colunas.filter((coluna) => !ordemColunas.includes(coluna.chave))]
      .filter((coluna) => !colunasOcultas.includes(coluna.chave));
  }, [colunas, ordemColunas, colunasOcultas]);

  function moverColuna(origem: ChaveColuna, destino: ChaveColuna) {
    if (origem === destino) return;
    const chaves = colunasExibidas.map((coluna) => coluna.chave);
    const restantes = chaves.filter((chave) => chave !== origem);
    const indiceDestino = restantes.indexOf(destino);
    const inserirDepois = chaves.indexOf(origem) < chaves.indexOf(destino);
    restantes.splice(inserirDepois ? indiceDestino + 1 : indiceDestino, 0, origem);
    setOrdemColunas(restantes);
  }

  function arrastoColuna(chave: ChaveColuna) {
    return {
      draggable: true,
      title: "Arraste para reordenar",
      onDragStart: (evento: ReactDragEvent<HTMLButtonElement>) => {
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", chave);
        setColunaArrastada(chave);
      },
      onDragEnd: () => setColunaArrastada(null),
    };
  }

  function destinoColuna(chave: ChaveColuna) {
    return {
      onDragOver: (evento: ReactDragEvent<HTMLTableCellElement>) => {
        if (colunaArrastada) evento.preventDefault();
      },
      onDrop: (evento: ReactDragEvent<HTMLTableCellElement>) => {
        evento.preventDefault();
        if (colunaArrastada) moverColuna(colunaArrastada, chave);
        setColunaArrastada(null);
      },
    };
  }

  const temPeriodoInicial = Boolean(filtroInicial?.inicio || filtroInicial?.fim);
  const filtrados = useMemo(() => {
    const textoBusca = busca.trim().toLocaleLowerCase("pt-BR");
    return lancamentos.filter((linha) => {
      const datasDoModo = modoData === "EMISSAO" ? [linha.dataLancamento]
        : modoData === "VENCIMENTO" ? [linha.dataVencimento]
          : modoData === "PAGAMENTO" ? [dataBaixaLinha(linha)]
            : [linha.dataLancamento, linha.dataVencimento];
      if (temPeriodoInicial) {
        const inicio = filtroInicial?.inicio?.slice(0, 10);
        const fim = filtroInicial?.fim?.slice(0, 10);
        const dentro = datasDoModo.some((data) => {
          const valor = (data || "").slice(0, 10);
          return Boolean(valor) && (!inicio || valor >= inicio) && (!fim || valor <= fim);
        });
        if (!dentro) return false;
      } else {
        const dentro = datasDoModo.some((data) => mesesSelecionados.includes((data || "").slice(0, 7)));
        if (!dentro) return false;
      }
      if (situacaoFiltro !== "TODAS" && statusParaFiltro(linha) !== situacaoFiltro) return false;
      if (!correspondeAoSegmentoCaixa(linha, caixaFiltro)) return false;
      if (!correspondeAoFluxo(linha, fluxoFiltro)) return false;
      if (contaFiltro !== null && linha.contaBancaria !== contaFiltro) return false;
      if (docFiltro !== null && tipoDocumento(linha) !== docFiltro) return false;
      const texto = [linha.documento, ...(linha.raw.numerosDocumento ?? []), linha.descricao, linha.categoria, linha.favorecido,
        linha.favorecidoPessoa, linha.fornecedor, linha.aeronave, linha.contaBancaria, linha.fluxo].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return texto.includes(textoBusca);
    }).sort((a, b) => {
      const chave = ordenacao.chave;
      const comparacao = chave === "valor" ? a.valor - b.valor
        : String(chave === "data" ? a.dataLancamento ?? "" : a[chave] ?? "").localeCompare(
          String(chave === "data" ? b.dataLancamento ?? "" : b[chave] ?? ""), "pt-BR", { numeric: true });
      return ordenacao.crescente ? comparacao : -comparacao;
    });
  }, [lancamentos, busca, situacaoFiltro, caixaFiltro, fluxoFiltro, mesesSelecionados,
    filtroInicial?.inicio, filtroInicial?.fim, temPeriodoInicial, ordenacao, modoData, contaFiltro, docFiltro]);

  const selecao = useMemo(() => new Set(selecionados), [selecionados]);
  const expansao = useMemo(() => new Set(expandidos), [expandidos]);
  const selecionadosVisiveis = filtrados.filter((linha) => selecao.has(linha.id));
  const baixaveisSelecionados = selecionadosVisiveis.filter(podeBaixar);
  const excluiveisSelecionados = selecionadosVisiveis.flatMap((linha) => linha.raw.lancamentoId && linha.caixa !== "HOLDING" ? [{ linha, lancamentoId: linha.raw.lancamentoId }] : []);
  const progressoBaixa = loteBaixa && loteBaixa.total > 1 ? `Lançamento ${loteBaixa.total - loteBaixa.fila.length} de ${loteBaixa.total}` : undefined;
  const totalListado = filtrados.reduce((soma, linha) => soma + linha.valor, 0);
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.max(1, Math.min(pagina, paginas));
  const linhas = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const todasSelecionadas = linhas.length > 0 && linhas.every((linha) => selecao.has(linha.id));
  const algumasSelecionadas = linhas.some((linha) => selecao.has(linha.id));
  const todasExpandidas = linhas.length > 0 && linhas.every((linha) => expansao.has(linha.id));
  const itensRelatorio = selecionadosVisiveis.length ? selecionadosVisiveis : filtrados;
  const totalRelatorio = itensRelatorio.reduce((soma, linha) => soma + linha.valor, 0);
  const anoSeletor = Number(mes.slice(0, 4));
  const mesesDoAno = Array.from({ length: 12 }, (_, indice) => `${anoSeletor}-${String(indice + 1).padStart(2, "0")}`);
  const periodo = temPeriodoInicial
    ? `${filtroInicial?.inicio ? dataOuTraco(filtroInicial.inicio) : "Início"} a ${filtroInicial?.fim ? dataOuTraco(filtroInicial.fim) : "hoje"}`
    : mesesSelecionados.length === 1 ? rotuloMes(mesesSelecionados[0]) : `${mesesSelecionados.length} meses selecionados`;
  const periodoImpressao = temPeriodoInicial ? periodo : [...mesesSelecionados].sort().map(rotuloMes).join(", ");
  const filtrosAtivos = Number(situacaoFiltro !== "TODAS")
    + Number(caixaFiltro !== "TODOS") + Number(fluxoFiltro !== "TODOS")
    + Number(contaFiltro !== null) + Number(docFiltro !== null) + Number(modoData !== "EMISSAO");

  useEffect(() => { setPagina((atual) => Math.min(atual, paginas)); }, [paginas]);

  function alternarColuna(chave: ChaveColuna) {
    setColunasOcultas((atuais) => atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]);
  }

  function alternarSelecao(idLinha: string) {
    setSelecionados((atuais) => atuais.includes(idLinha) ? atuais.filter((item) => item !== idLinha) : [...atuais, idLinha]);
  }
  function alternarPagina() {
    const ids = new Set(linhas.map((linha) => linha.id));
    setSelecionados((atuais) => todasSelecionadas ? atuais.filter((item) => !ids.has(item)) : [...new Set([...atuais, ...ids])]);
  }
  function alternarExpansao(idLinha: string) {
    setExpandidos((atuais) => atuais.includes(idLinha) ? atuais.filter((item) => item !== idLinha) : [...atuais, idLinha]);
  }
  function alternarTodas() {
    const ids = new Set(linhas.map((linha) => linha.id));
    setExpandidos((atuais) => todasExpandidas ? atuais.filter((item) => !ids.has(item)) : [...new Set([...atuais, ...ids])]);
  }
  function mudarMes(delta: number) {
    const data = new Date(`${mes}-01T12:00:00`);
    data.setMonth(data.getMonth() + delta);
    const proximo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    setMes(proximo); setMesesSelecionados([proximo]); setPagina(1);
  }
  function alternarMes(valor: string) {
    setMes(valor);
    setMesesSelecionados((atuais) => atuais.includes(valor)
      ? atuais.length > 1 ? atuais.filter((item) => item !== valor) : atuais
      : [...atuais, valor]);
  }
  function irParaMesAtual() {
    const atual = mesAtualIso();
    setMes(atual); setMesesSelecionados([atual]); setSeletorMesAberto(false); setPagina(1);
    botaoPeriodoRef.current?.focus();
  }
  function limparFiltros() {
    setBusca(""); setSituacaoFiltro("TODAS"); setCaixaFiltro("TODOS"); setFluxoFiltro("TODOS");
    setContaFiltro(null); setDocFiltro(null); setModoData("EMISSAO");
  }
  function alternarCampoRelatorio(campo: CampoRelatorioMensal) {
    setCamposRelatorio((atuais) => atuais.includes(campo) ? atuais.filter((item) => item !== campo) : [...atuais, campo]);
  }
  async function exportarRelatorioMensalPdf() {
    if (camposRelatorio.length === 0) {
      toast.error("Marque ao menos um campo para exportar o relatório.");
      return;
    }
    const campos = CAMPOS_RELATORIO_MENSAL.filter(({ chave }) => camposRelatorio.includes(chave));
    try {
      const respostaLogo = await fetch(logoShare);
      if (!respostaLogo.ok) throw new Error("Não foi possível carregar a logo da Share.");
      const blobLogo = await respostaLogo.blob();
      const logoData = await new Promise<string>((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result));
        leitor.onerror = () => reject(new Error("Não foi possível preparar a logo da Share para o PDF."));
        leitor.readAsDataURL(blobLogo);
      });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const emitirCabecalho = () => {
        doc.addImage(logoData, "PNG", 14, 6, 34, 18);
        doc.setTextColor(23, 61, 96);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("FINANCEIRO SHARE", 55, 13);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Relatório mensal · ${rotuloMes(mesRelatorio)}`, 55, 19);
        doc.setTextColor(95, 108, 122);
        doc.setFontSize(8);
        doc.text(`Movimentações do mês completo · Emitido em ${new Date().toLocaleDateString("pt-BR")}`, 55, 24);
        doc.setDrawColor(34, 91, 132);
        doc.setLineWidth(0.6);
        doc.line(14, 29, doc.internal.pageSize.getWidth() - 14, 29);
      };
      const body = linhasRelatorioMensal.map((linha) => campos.map(({ chave }) => {
        switch (chave) {
          case "data": return dataOuTraco(linha.dataLancamento);
          case "descricao": return linha.descricao || "—";
          case "tipoCaixa": return tipoCaixaRelatorio(linha);
          case "entrada": return fluxoRelatorio(linha) === "ENTRADA" ? formatarMoeda(linha.valor) : "";
          case "saida": return fluxoRelatorio(linha) === "SAIDA" ? formatarMoeda(linha.valor) : "";
        }
      }));
      const rodape = campos.map(({ chave }, indice) => {
        if (indice === 0) return "TOTAL DO MÊS";
        if (chave === "entrada") return formatarMoeda(totaisRelatorioMensal.entrada);
        if (chave === "saida") return formatarMoeda(totaisRelatorioMensal.saida);
        return "";
      });
      autoTable(doc, {
        head: [campos.map(({ rotulo }) => rotulo)], body, foot: [rodape], startY: 34,
        margin: { top: 34, bottom: 16, left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [31, 64, 104] },
        footStyles: { fillColor: [235, 240, 246], textColor: [20, 35, 55], fontStyle: "bold" },
        didDrawPage: emitirCabecalho,
      });
      const totalPaginas = doc.getNumberOfPages();
      for (let paginaPdf = 1; paginaPdf <= totalPaginas; paginaPdf += 1) {
        doc.setPage(paginaPdf);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(95, 108, 122);
        doc.text(`Entradas: ${formatarMoeda(totaisRelatorioMensal.entrada)}   ·   Saídas: ${formatarMoeda(totaisRelatorioMensal.saida)}`, 14, doc.internal.pageSize.getHeight() - 7);
        doc.text(`Página ${paginaPdf} de ${totalPaginas}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 7, { align: "right" });
      }
      doc.save(`financeiro-share-${mesRelatorio}.pdf`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o PDF.");
    }
  }
  async function excluirLinha(linha: LinhaConta) {
    const lancamentoId = linha.raw.lancamentoId;
    if (!lancamentoId) return;
    setMenuLinhaId(null);
    if (!window.confirm(`Excluir o lançamento "${linha.descricao}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluirLancamento(lancamentoId);
      setSelecionados((atuais) => atuais.filter((item) => item !== linha.id));
      await recarregar();
      toast.success("Lançamento excluído.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir o lançamento.");
    }
  }

  async function excluirSelecionados() {
    const alvos = excluiveisSelecionados;
    const rotulo = alvos.length === 1 ? "lançamento selecionado" : "lançamentos selecionados";
    if (!window.confirm(`Excluir ${alvos.length} ${rotulo}? Esta ação não pode ser desfeita.`)) return;
    let excluidos = 0;
    try {
      for (const { linha, lancamentoId } of alvos) {
        await excluirLancamento(lancamentoId);
        excluidos += 1;
        setSelecionados((atuais) => atuais.filter((item) => item !== linha.id));
      }
      toast.success(`${excluidos} ${excluidos === 1 ? "lançamento excluído" : "lançamentos excluídos"}.`);
    } catch (erro) {
      toast.error(`${excluidos} de ${alvos.length} excluídos. ${erro instanceof Error ? erro.message : "Não foi possível excluir o restante."}`);
    } finally {
      await recarregar();
    }
  }

  function iniciarBaixaEmLote() {
    const [primeiro, ...restante] = baixaveisSelecionados;
    if (!primeiro) return;
    setLoteBaixa({ total: baixaveisSelecionados.length, fila: restante });
    setContaBaixa(primeiro);
  }
  function fecharBaixa() {
    setContaBaixa(null);
    setLoteBaixa(null);
  }
  function concluirBaixa() {
    const [proximo, ...restante] = loteBaixa?.fila ?? [];
    if (proximo && loteBaixa) {
      setLoteBaixa({ total: loteBaixa.total, fila: restante });
      setContaBaixa(proximo);
    } else {
      fecharBaixa();
    }
  }

  function editarLinha(linha: LinhaConta) {
    const raw = linha.raw as unknown as Record<string, unknown>;
    const id = String(raw.lancamentoId ?? linha.id ?? "");
    if (!id) return;
    setMenuLinhaId(null);
    setLancamentoEditando({
      id, descricao: linha.descricao, fluxo: linha.fluxo,
      categoriaId: String(raw.categoriaId ?? raw.categoria_share_id ?? raw.categoria_id ?? "") || null,
      categoria: linha.categoria, grupoCategoria: String(raw.grupoCategoria ?? raw.grupo_categoria ?? "") || null,
      valorCentavos: Math.round(linha.valor * 100), data: linha.dataLancamento, prazo: linha.dataVencimento, periodicidade: linha.periodicidade as LancamentoEdicao["periodicidade"],
      fornecedorId: String(raw.fornecedorId ?? raw.fornecedor_id ?? raw.fornecedores_favoritos_id ?? "") || null,
      fornecedor: linha.fornecedor ?? linha.favorecido, numeroDoc: String(raw.numeroDoc ?? raw.numero_doc ?? raw.numero_nf ?? linha.documento ?? "") || null,
      observacoes: String(raw.observacoes ?? "") || null,
      categoriaClienteId: String(raw.categoriaClienteId ?? raw.categoria_cliente_id ?? "") || null,
      dataPagamento: String(raw.dataPagamento ?? raw.data_pagamento ?? raw.dataRecebimento ?? raw.data_recebimento ?? "") || null,
      contaBancariaId: String(raw.contaBancariaId ?? raw.conta_bancaria_id ?? raw.bancoPagamento ?? raw.banco_pagamento ?? raw.bancoRecebimento ?? raw.banco_recebimento ?? "") || null,
      contaBancariaRotulo: String(raw.bancoPagamento ?? raw.banco_pagamento ?? raw.bancoRecebimento ?? raw.banco_recebimento ?? "") || null,
      formaPagamento: String(raw.formaPagamento ?? raw.forma_pagamento ?? "") || null,
      comprovanteUrl: String(raw.comprovantePagamentoUrl ?? raw.comprovante_url ?? raw.comprovanteRecebimentoUrl ?? raw.comprovante_recebimento_url ?? "") || null,
      pagoPor: String(raw.pagoPor ?? raw.pago_por ?? "") || null,
      status: linha.statusOriginal,
      anexos: (() => { const valor = raw.anexos ?? raw.anexos_json; try { const itens = Array.isArray(valor) ? valor : valor ? JSON.parse(String(valor)) : []; return Array.isArray(itens) ? itens.filter((item) => item && item.url).map((item) => ({ id: item.id, nome: String(item.nome ?? "Documento"), url: String(item.url), tipo: item.tipo ?? null })) : []; } catch { return []; } })(),
    });
  }

  function iniciarResize(evento: ReactPointerEvent<HTMLSpanElement>, chave: ChaveColuna) {
    evento.preventDefault(); evento.stopPropagation();
    const cabecalho = evento.currentTarget.closest("th");
    if (!cabecalho) return;
    pararResizeRef.current?.();
    const inicio = evento.clientX;
    const escala = zoom / 100;
    const larguraInicial = cabecalho.getBoundingClientRect().width / escala;
    const mover = (e: PointerEvent) => setLarguras((atuais) => ({ ...atuais, [chave]: Math.max(84, larguraInicial + (e.clientX - inicio) / escala) }));
    const parar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", parar);
      window.removeEventListener("pointercancel", parar);
      pararResizeRef.current = null;
    };
    pararResizeRef.current = parar;
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", parar);
    window.addEventListener("pointercancel", parar);
  }

  function iniciarArrasteTabela(evento: ReactPointerEvent<HTMLDivElement>) {
    if (!evento.isPrimary || evento.button !== 0 || evento.pointerType === "touch") return;
    if (evento.target instanceof Element && evento.target.closest("button, a, input, select, textarea, .erp-redimensionar")) return;

    stopDragRef.current?.();
    const container = evento.currentTarget;
    const inicioX = evento.clientX;
    const scrollInicial = container.scrollLeft;
    const ponteiroId = evento.pointerId;
    let arrastou = false;

    const mover = (movimento: PointerEvent) => {
      if (movimento.pointerId !== ponteiroId) return;
      const deslocamento = movimento.clientX - inicioX;
      if (!arrastou && Math.abs(deslocamento) > 5) {
        arrastou = true;
        setArrastandoTabela(true);
      }
      if (arrastou) {
        movimento.preventDefault();
        container.scrollLeft = scrollInicial - deslocamento;
      }
    };
    const parar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", parar);
      window.removeEventListener("pointercancel", parar);
      if (arrastou) {
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
      setArrastandoTabela(false);
      stopDragRef.current = null;
    };

    stopDragRef.current = parar;
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", parar);
    window.addEventListener("pointercancel", parar);
  }

  return (
    <section className={`erp-financeiro ${ehEntrada ? "erp-entrada" : "erp-saida"}`} aria-labelledby={`${id}-titulo`}>
      <style>{ESTILOS_FINANCEIRO}</style>
      {!ehEntrada && !ehHolding && <nav className="erp-abas" aria-label="Registro de saída">
        <button type="button" className={abaSaida === "lancamentos" ? "ativo" : ""} onClick={() => setAbaSaida("lancamentos")}>Lançamentos</button>
        {solicitacoesPendentes > 0 && <button type="button" className={abaSaida === "solicitacoes" ? "ativo" : ""} onClick={() => setAbaSaida("solicitacoes")}>Solicitações de pagamento <span>{solicitacoesPendentes}</span></button>}
      </nav>}
      {!ehEntrada && !ehHolding && <div style={{ display: abaSaida === "solicitacoes" ? "block" : "none" }}>
        <AbaSolicitacoesPagamento contasBancarias={contasBancarias} aoAlterarQuantidade={atualizarSolicitacoesPendentes} />
      </div>}
      {(ehEntrada || abaSaida === "lancamentos") && <div className="erp-tela">
        <header className="erp-cabecalho">
          <div className="erp-titulo">
            <h2 id={`${id}-titulo`}>{titulo}</h2>
          </div>
          <div className="erp-cabecalho-acoes">
            <div className="erp-periodo" ref={periodoRef}>
              {!temPeriodoInicial && <button type="button" ref={botaoPeriodoRef} className="erp-btn erp-btn-periodo" aria-expanded={seletorMesAberto}
                aria-haspopup="dialog" aria-controls={`${id}-meses`} onClick={() => setSeletorMesAberto((atual) => !atual)}>
                Mês Atual<ChevronDown size={12} aria-hidden="true" />
              </button>}
              <div className="erp-navegacao-mes">
                {!temPeriodoInicial && <button type="button" className="erp-btn erp-btn-icone" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={15} /></button>}
                <span className="erp-rotulo-periodo">{periodo}</span>
                {!temPeriodoInicial && <button type="button" className="erp-btn erp-btn-icone" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={15} /></button>}
              </div>
              {seletorMesAberto && !temPeriodoInicial && (
                <div id={`${id}-meses`} ref={dialogoPeriodoRef} className="erp-seletor-mes" role="dialog" aria-label="Selecionar meses">
                  <div className="erp-seletor-cabecalho">
                    <button type="button" className="erp-btn erp-btn-icone" aria-label="Ano anterior" onClick={() => setMes(`${anoSeletor - 1}-${mes.slice(5)}`)}><ChevronLeft size={15} /></button>
                    <strong>{anoSeletor}</strong>
                    <button type="button" className="erp-btn erp-btn-icone" aria-label="Próximo ano" onClick={() => setMes(`${anoSeletor + 1}-${mes.slice(5)}`)}><ChevronRight size={15} /></button>
                  </div>
                  <div className="erp-meses">{mesesDoAno.map((valor) => (
                    <button type="button" key={valor} aria-pressed={mesesSelecionados.includes(valor)} onClick={() => alternarMes(valor)}>{nomeMes(valor, "short").replace(".", "")}</button>
                  ))}</div>
                  <div className="erp-seletor-rodape"><span>Selecione um ou mais meses.</span><button type="button" className="erp-btn" onClick={irParaMesAtual}>Mês atual</button></div>
                </div>
              )}
            </div>
            <div className="erp-resumo">
              <span>{selecionadosVisiveis.length ? "Total selecionado" : "Total listado"}</span>
              <strong>{carregando ? "—" : formatarMoeda(totalRelatorio)}</strong>
            </div>
          </div>
        </header>

        <div className="erp-toolbar" role="group" aria-label="Ações dos lançamentos">
          <div className="erp-acoes">
            <label className="erp-busca-inline">
              <span className="erp-sr-only">Buscar lançamento</span>
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar lançamento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button type="button" className="erp-busca-limpar" aria-label="Limpar busca" onClick={() => setBusca("")}>
                  <X size={12} />
                </button>
              )}
            </label>
            {!ehHolding && (
              <button type="button" className="erp-btn erp-btn-primario" onClick={() => setNovo(true)}>
                <Plus size={15} aria-hidden="true" />Novo
              </button>
            )}
            <button type="button" className={`erp-btn ${mostrarFiltros ? "erp-btn-ativo" : ""}`} aria-expanded={mostrarFiltros}
              aria-controls={`${id}-filtros`} onClick={() => setMostrarFiltros((atual) => !atual)}>
              <Filter size={14} aria-hidden="true" />Filtrar{filtrosAtivos > 0 && <span className="erp-contador">{filtrosAtivos}</span>}
            </button>
            <button type="button" className="erp-btn erp-btn-sutis" disabled={carregando || !linhas.length} onClick={alternarTodas} title={todasExpandidas ? "Recolher todas" : "Expandir todas"}>
              <List size={14} aria-hidden="true" />{todasExpandidas ? "Recolher" : "Expandir"}
            </button>
            <button type="button" className="erp-btn erp-btn-sutis" onClick={() => { setLarguras({}); setOrdemColunas([]); setColunasOcultas([]); }} title="Restaurar colunas">
              <Columns2 size={14} aria-hidden="true" />Restaurar
            </button>
            <button type="button" className="erp-btn" onClick={() => { setMesRelatorio(mes); setRelatorioMensalAberto(true); }}>
              <FileDown size={14} aria-hidden="true" />Ver mês / PDF
            </button>
            <div className="erp-controles-tabela">
              <ControleZoomTabela zoom={zoom} alterar={alterarZoom} restaurar={() => definirZoom(100)} />
              <div className="erp-colunas-ancora" ref={colunasMenuRef}>
                <button type="button" className={`erp-btn ${menuColunasAberto ? "erp-btn-ativo" : ""}`} aria-expanded={menuColunasAberto} aria-controls={`${id}-colunas`}
                  onClick={() => setMenuColunasAberto((atual) => !atual)}>
                  <List size={14} aria-hidden="true" />Colunas
                </button>
                {menuColunasAberto && (
                  <div className="erp-colunas-lista" id={`${id}-colunas`} role="listbox" aria-multiselectable="true" aria-label="Exibir/ocultar colunas">
                    {colunas.map((coluna) => {
                      const visivel = !colunasOcultas.includes(coluna.chave);
                      return (
                        <button
                          type="button"
                          key={coluna.chave}
                          role="option"
                          aria-selected={visivel}
                          disabled={visivel && colunasExibidas.length === 1}
                          onClick={() => alternarColuna(coluna.chave)}
                        >
                          <span className="erp-coluna-rotulo">{coluna.rotulo}</span>
                          <span className="erp-coluna-olho" aria-hidden="true">
                            {visivel ? <Eye size={14} /> : <EyeOff size={14} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button type="button" className="erp-btn" disabled={carregando || !filtrados.length} onClick={() => window.print()}>
                <Printer size={14} aria-hidden="true" />Imprimir
              </button>
            </div>
          </div>

          <div className="erp-toolbar-direita">
            <div className="erp-paginacao-topo" aria-label="Paginação">
              <span className="erp-paginacao-resumo">
                {filtrados.length ? `Exibindo ${(paginaAtual - 1) * porPagina + 1} a ${Math.min(paginaAtual * porPagina, filtrados.length)} de ${filtrados.length}` : "0 registros"}
              </span>
              <div className="erp-paginacao-controles">
                <button type="button" className="erp-pagina-btn" aria-label="Primeira página" disabled={paginaAtual <= 1} onClick={() => setPagina(1)}>
                  <ChevronsLeft size={14} />
                </button>
                <button type="button" className="erp-pagina-btn" aria-label="Página anterior" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" className="erp-pagina-btn" aria-label="Próxima página" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}>
                  <ChevronRight size={14} />
                </button>
                <button type="button" className="erp-pagina-btn" aria-label="Última página" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginas)}>
                  <ChevronsRight size={14} />
                </button>
                <label className="erp-por-pagina">
                  <span className="erp-sr-only">Linhas por página</span>
                  <select value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))}>
                    {[10, 25, 50, 100].map((quantidade) => <option key={quantidade} value={quantidade}>{quantidade}</option>)}
                  </select>
                  <ChevronDown size={11} aria-hidden="true" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {selecionadosVisiveis.length > 1 && (
          <div className="erp-barra-selecao" role="region" aria-label="Ações para os lançamentos selecionados">
            <span>{selecionadosVisiveis.length} selecionados</span>
            <button type="button" className="erp-btn erp-btn-primario" disabled={!baixaveisSelecionados.length} onClick={iniciarBaixaEmLote}>
              DAR BAIXA ({baixaveisSelecionados.length})
            </button>
            <button type="button" className="erp-btn erp-btn-perigo" disabled={!excluiveisSelecionados.length} onClick={() => void excluirSelecionados()}>
              <Trash2 size={14} aria-hidden="true" />EXCLUIR ({excluiveisSelecionados.length})
            </button>
          </div>
        )}
        {mostrarFiltros && <div className="erp-filtros" id={`${id}-filtros`}>
          <label><span className="erp-sr-only">Caixa</span><select value={caixaFiltro} onChange={(e) => setCaixaFiltro(e.target.value)}>
            <option value="TODOS">Todos os caixas</option><option value="EMPRESA">Despesas empresa</option><option value="PARTICULAR">Particular</option><option value="SHARE">Share</option>{ehHolding && <option value="HOLDING">Holding</option>}
          </select></label>
          <label><span className="erp-sr-only">Fluxo</span><select value={fluxoFiltro} onChange={(e) => setFluxoFiltro(e.target.value as "TODOS" | FluxoLinha)}>
            <option value="TODOS">Todos os fluxos</option>{fluxosFiltro.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <button type="button" className="erp-btn erp-btn-sutis" onClick={limparFiltros}><X size={14} aria-hidden="true" />Limpar filtros</button>
        </div>}

        {erro && <div className="erp-erro" role="alert"><span>{String(erro)}</span><button type="button" className="erp-btn" onClick={() => void recarregar()}>Tentar novamente</button></div>}

        <div
          className={`erp-tabela-container ${arrastandoTabela ? "erp-arrastando" : ""}`}
          role="region"
          aria-label="Tabela de lançamentos; arraste para rolar horizontalmente"
          tabIndex={0}
          aria-busy={carregando}
          onPointerDown={iniciarArrasteTabela}
          onClickCapture={(evento) => {
            if (suppressClickRef.current) {
              evento.preventDefault();
              evento.stopPropagation();
              suppressClickRef.current = false;
            }
          }}
        >
          <table className="erp-tabela" style={{ zoom: zoom / 100 }}>
            <caption className="erp-sr-only">{titulo} — {periodo}</caption>
            <colgroup>
              <col style={{ width: 82 }} />
              {colunasExibidas.map((coluna) => (
                <col key={coluna.chave} style={{ width: larguras[coluna.chave] ?? coluna.largura }} />
              ))}
            </colgroup>
            <thead><tr>
              <th scope="col" className="erp-th-acoes">
                <div className="erp-celula-selecao">
                  <Checkbox marcado={todasSelecionadas} parcial={algumasSelecionadas && !todasSelecionadas}
                    desabilitado={carregando || !linhas.length} rotulo="Selecionar todos desta página" aoMudar={alternarPagina} />
                </div>
              </th>
              {colunasExibidas.map((coluna) => <th scope="col" key={coluna.chave} {...destinoColuna(coluna.chave)}
                className={[coluna.chave === "situacao" ? "erp-th-status" : "", colunaArrastada === coluna.chave ? "erp-th-arrastada" : ""].filter(Boolean).join(" ") || undefined}
                aria-sort={ordenacao.chave === coluna.chave ? ordenacao.crescente ? "ascending" : "descending" : "none"}>
                {coluna.chave === "situacao" ? (
                  <div className="erp-status-th-conteudo">
                    <div className="erp-status-filtro-anchor" ref={statusFiltroRef}>
                      <button
                        type="button"
                        className={`erp-status-filtro-trigger ${situacaoFiltro !== "TODAS" ? "erp-status-filtro-ativo" : ""}`}
                        aria-label="Filtrar por status"
                        title="Filtrar por status"
                        aria-haspopup="dialog"
                        aria-expanded={statusFiltroAberto}
                        onClick={() => setStatusFiltroAberto((aberto) => !aberto)}
                      >
                        <Filter size={12} aria-hidden="true" />
                      </button>
                      {statusFiltroAberto && (
                        <div className="erp-status-filtro-menu" role="dialog" aria-label="Filtrar por status">
                          <button type="button" aria-pressed={situacaoFiltro === "TODAS"} onClick={() => { setSituacaoFiltro("TODAS"); setStatusFiltroAberto(false); }}>Todos os status</button>
                          {STATUS_FILTRO.filter(({ valor }) => !ehEntrada || valor !== "PAGO").map(({ valor, rotulo }) => (
                            <button key={valor} type="button" aria-pressed={situacaoFiltro === valor} onClick={() => { setSituacaoFiltro(valor); setStatusFiltroAberto(false); }}>
                              {rotulo}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" {...arrastoColuna(coluna.chave)} className="erp-ordenar" onClick={() => setOrdenacao((atual) => ({ chave: coluna.chave, crescente: atual.chave === coluna.chave ? !atual.crescente : true }))}>
                      <span>{coluna.rotulo}</span><ChevronsUpDown size={11} aria-hidden="true" />
                    </button>
                  </div>
                ) : ehColunaFiltravel(coluna.chave) ? (
                  <div className="erp-status-th-conteudo">
                    <div className="erp-status-filtro-anchor erp-coluna-filtro-anchor">
                      <button
                        type="button"
                        className={`erp-status-filtro-trigger ${filtroColunaAtivo(coluna.chave) ? "erp-status-filtro-ativo" : ""}`}
                        aria-label={`Filtrar por ${TITULOS_FILTRO_COLUNA[coluna.chave]}`}
                        title={`Filtrar por ${TITULOS_FILTRO_COLUNA[coluna.chave]}`}
                        aria-haspopup="dialog"
                        aria-expanded={colunaFiltroAberta === coluna.chave}
                        onClick={() => setColunaFiltroAberta((atual) => (atual === coluna.chave ? null : coluna.chave))}
                      >
                        <Filter size={12} aria-hidden="true" />
                      </button>
                      {colunaFiltroAberta === coluna.chave && (
                        <div className="erp-status-filtro-menu" role="dialog" aria-label={`Filtrar por ${TITULOS_FILTRO_COLUNA[coluna.chave]}`}>
                          {opcoesFiltroColuna(coluna.chave).map((opcao) => (
                            <button key={opcao.rotulo} type="button" aria-pressed={opcao.ativo} onClick={() => { opcao.aplicar(); setColunaFiltroAberta(null); }}>
                              {opcao.rotulo}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" {...arrastoColuna(coluna.chave)} className="erp-ordenar" onClick={() => setOrdenacao((atual) => ({ chave: coluna.chave, crescente: atual.chave === coluna.chave ? !atual.crescente : true }))}>
                      <span>{coluna.rotulo}</span><ChevronsUpDown size={11} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button type="button" {...arrastoColuna(coluna.chave)} className={`erp-ordenar ${coluna.chave === "valor" ? "erp-ordenar-direita" : ""}`} onClick={() => setOrdenacao((atual) => ({ chave: coluna.chave, crescente: atual.chave === coluna.chave ? !atual.crescente : true }))}>
                    <span>{coluna.rotulo}</span><ChevronsUpDown size={11} aria-hidden="true" />
                  </button>
                )}
                <span className="erp-redimensionar" onPointerDown={(e) => iniciarResize(e, coluna.chave)} aria-hidden="true" title="Arraste para ajustar a coluna" />
              </th>)}
            </tr></thead>
            <tbody>
              {carregando ? <tr><td colSpan={colunasExibidas.length + 1} className="erp-estado"><Loader2 size={16} className="erp-girando" aria-hidden="true" />Carregando lançamentos...</td></tr>
                : linhas.length ? linhas.map((linha) => {
                  const aberta = expansao.has(linha.id);
                  const indiceLinha = lancamentos.findIndex((item) => item.id === linha.id);
                  const detalheId = `${id}-detalhes-${indiceLinha}`;
                  const dadosDetalhe = aberta ? obterDetalhes?.(linha) ?? {} : {};
                  return <Fragment key={linha.id}>
                    <tr className={`erp-linha ${selecao.has(linha.id) ? "erp-linha-selecionada" : ""} ${aberta ? "erp-linha-aberta" : ""}`}
                      onClick={() => alternarExpansao(linha.id)}>
                      <td className="erp-td-acoes" onClick={(e) => e.stopPropagation()}><div className="erp-celula-selecao">
                        <button type="button" className="erp-expandir" aria-label={`${aberta ? "Recolher" : "Expandir"} ${linha.descricao}`}
                          aria-expanded={aberta} aria-controls={aberta ? detalheId : undefined} onClick={() => alternarExpansao(linha.id)}>
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                        <Checkbox marcado={selecao.has(linha.id)} rotulo={`Selecionar ${linha.descricao}`} aoMudar={() => alternarSelecao(linha.id)} />
                        <DropdownMenu open={menuLinhaId === linha.id} onOpenChange={(aberto) => setMenuLinhaId(aberto ? linha.id : null)} modal={false}>
                          <DropdownMenuTrigger asChild><button type="button" className="erp-botao-menu" aria-label={`Ações de ${linha.descricao}`}><MoreVertical size={14} aria-hidden="true" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem disabled={ehHolding} onSelect={() => editarLinha(linha)}><Pencil size={14} /> Editar</DropdownMenuItem>
                            <DropdownMenuItem disabled={!podeBaixar(linha)} onSelect={() => setContaBaixa(linha)}>Dar baixa</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" disabled={ehHolding || !linha.raw.lancamentoId} onSelect={() => void excluirLinha(linha)}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div></td>
                      {colunasExibidas.map((coluna) => celulaLancamento(coluna.chave, linha))}
                    </tr>
                    {aberta && <tr className="erp-linha-detalhes"><td colSpan={colunasExibidas.length + 1}>
                      <div id={detalheId}><Detalhes linha={linha} dados={dadosDetalhe} /></div>
                    </td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={colunasExibidas.length + 1} className="erp-estado">Nenhum lançamento encontrado para os filtros.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={colunasExibidas.length}>TOTAL LISTADO ({filtrados.length} {filtrados.length === 1 ? "item" : "itens"})</td>
              <td className="erp-total-rodape">{carregando ? "—" : formatarMoeda(totalListado)}</td></tr></tfoot>
          </table>
        </div>

        <footer className="erp-rodape">
          <div className="erp-rodape-info">
            <span>{selecionadosVisiveis.length} {selecionadosVisiveis.length === 1 ? "selecionado" : "selecionados"}</span>
            <span className="erp-barra" aria-hidden="true">|</span>
            <span>{filtrados.length} registros</span>
          </div>
          <div className="erp-paginacao">
            <span>Página {paginaAtual} de {paginas}</span>
            <button type="button" className="erp-pagina-btn" aria-label="Página anterior" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft size={14} /></button>
            <button type="button" className="erp-pagina-btn" aria-label="Próxima página" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight size={14} /></button>
          </div>
        </footer>
      </div>}

      <div className="erp-relatorio-impressao">
        <h1>{titulo}</h1><p>Período: {periodoImpressao}</p><p>Emitido em {new Date().toLocaleString("pt-BR")}</p>
        <table><thead><tr>{colunas.map((coluna) => <th key={coluna.chave}>{coluna.rotulo}</th>)}</tr></thead>
          <tbody>{itensRelatorio.map((linha) => <tr key={linha.id}>
            <td>{dataOuTraco(linha.dataLancamento)}</td><td>{linha.documento || "—"}</td><td>{linha.aeronave || "—"}</td><td>{linha.descricao}</td>
            {ehEntrada ? <td>{linha.favorecido || "—"}</td> : <td>{linha.fornecedor || "—"}</td>}
            <td>{linha.contaBancaria}</td>
            <td>{ROTULOS[statusParaFiltro(linha)] ?? rotuloStatus(statusParaFiltro(linha))}</td><td className="erp-direita">{formatarMoeda(linha.valor)}</td>
          </tr>)}</tbody>
          <tfoot><tr><td colSpan={colunas.length - 1}>{selecionadosVisiveis.length ? "Total selecionado" : "Total listado"} ({itensRelatorio.length} {itensRelatorio.length === 1 ? "item" : "itens"})</td><td className="erp-direita">{formatarMoeda(totalRelatorio)}</td></tr></tfoot>
        </table>
      </div>

      <Dialog open={relatorioMensalAberto} onOpenChange={setRelatorioMensalAberto}>
        <DialogContent className="flex max-h-[92dvh] max-w-6xl flex-col gap-4 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
            <div><DialogTitle>Movimentação mensal</DialogTitle><DialogDescription>Entradas e saídas do mês completo, com o tipo de caixa de cada lançamento.</DialogDescription></div>
            <label className="flex items-center gap-2 text-sm font-medium">Mês
              <input aria-label="Mês do relatório" type="month" value={mesRelatorio} onChange={(evento) => setMesRelatorio(evento.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border px-3 py-2"><div className="text-xs text-muted-foreground">Lançamentos</div><strong>{linhasRelatorioMensal.length}</strong></div>
            <div className="rounded-lg border border-border px-3 py-2"><div className="text-xs text-muted-foreground">Total de entradas</div><strong>{formatarMoeda(totaisRelatorioMensal.entrada)}</strong></div>
            <div className="rounded-lg border border-border px-3 py-2"><div className="text-xs text-muted-foreground">Total de saídas</div><strong>{formatarMoeda(totaisRelatorioMensal.saida)}</strong></div>
          </div>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold">Marque os campos para exibir e exportar</legend>
            {CAMPOS_RELATORIO_MENSAL.map(({ chave, rotulo }) => <label key={chave} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={camposRelatorio.includes(chave)} onChange={() => alternarCampoRelatorio(chave)} />{rotulo}
            </label>)}
          </fieldset>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            {carregandoRelatorioMensal ? <p className="p-6 text-center text-sm text-muted-foreground">Carregando entradas e saídas do mês…</p>
              : camposRelatorio.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Marque ao menos um campo para exibir o relatório.</p>
              : <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 bg-muted"><tr>{CAMPOS_RELATORIO_MENSAL.filter(({ chave }) => camposRelatorio.includes(chave)).map(({ chave, rotulo }) => <th key={chave} className="border-b border-border px-3 py-2 text-left">{rotulo}</th>)}</tr></thead>
                <tbody>{linhasRelatorioMensal.map((linha) => <tr key={`${linha.caixa}:${linha.id}:${linha.fluxo}`} className="odd:bg-muted/30">
                  {camposRelatorio.includes("data") && <td className="border-b border-border/60 px-3 py-2 whitespace-nowrap">{dataOuTraco(linha.dataLancamento)}</td>}
                  {camposRelatorio.includes("descricao") && <td className="border-b border-border/60 px-3 py-2">{linha.descricao}</td>}
                  {camposRelatorio.includes("tipoCaixa") && <td className="border-b border-border/60 px-3 py-2">{tipoCaixaRelatorio(linha)}</td>}
                  {camposRelatorio.includes("entrada") && <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">{fluxoRelatorio(linha) === "ENTRADA" ? formatarMoeda(linha.valor) : "—"}</td>}
                  {camposRelatorio.includes("saida") && <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">{fluxoRelatorio(linha) === "SAIDA" ? formatarMoeda(linha.valor) : "—"}</td>}
                </tr>)}
                {!linhasRelatorioMensal.length && <tr><td colSpan={camposRelatorio.length} className="px-3 py-8 text-center text-muted-foreground">Nenhum lançamento encontrado neste mês.</td></tr>}
                </tbody>
              </table>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="erp-btn" onClick={() => setRelatorioMensalAberto(false)}>Fechar</button>
            <button type="button" className="erp-btn erp-btn-primario" disabled={carregandoRelatorioMensal || !linhasRelatorioMensal.length || !camposRelatorio.length} onClick={exportarRelatorioMensalPdf}>
              <FileDown size={14} aria-hidden="true" />Exportar PDF
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <NovoLancamentoShareDialog aberto={novo || Boolean(lancamentoEditando)} aoFechar={() => { setNovo(false); setLancamentoEditando(null); }} categorias={categorias}
        fornecedores={fornecedores} contasBancarias={contasBancarias} lancamentoInicial={lancamentoEditando ?? undefined}
        aoCriar={() => void recarregar()} somenteDespesa={!ehEntrada} somenteEntrada={ehEntrada} />
      {contaBaixa && ehEntrada && <ModalContaAReceber conta={contaBaixa.raw as ContaAReceber} aberto onFechar={fecharBaixa} contasBancarias={contasBancarias}
        progresso={progressoBaixa}
        onConfirmar={async (dados) => {
          await darBaixaContaAReceber(contaBaixa.id, dados);
          setSelecionados((atuais) => atuais.filter((item) => item !== contaBaixa.id));
          concluirBaixa();
          await recarregar(); toast.success("Baixa registrada.");
        }} />}
      {contaBaixa && contaBaixaReal && !ehEntrada && <ModalContaAPagar key={contaBaixaReal.id} conta={contaBaixaReal} aberto onFechar={fecharBaixa} contasBancarias={contasBancarias}
        progresso={progressoBaixa}
        onConfirmar={async (dados) => {
          const conta = contaBaixaReal;
          if (ehLancamentoDireto(conta)) {
            await darBaixaPagamentoShare(conta.lancamentoId || conta.id, dados);
          } else {
            await darBaixaContaAPagar(conta.id, dados);
          }
          setSelecionados((atuais) => atuais.filter((item) => item !== contaBaixa.id));
          concluirBaixa();
          await recarregar(); toast.success("Baixa registrada.");
        }} />}
    </section>
  );
}

// CSS isolado por prefixo com estética dark slate compacta e padronizada.
export const ESTILOS_FINANCEIRO = `
.erp-financeiro {
  --erp-bg: var(--light-canvas, #111827);
  --erp-panel: var(--light-surface, #161f30);
  --erp-head: var(--light-soft, #0d131f);
  --erp-row-odd: var(--light-surface, #141c2b);
  --erp-row-even: var(--light-surface, #182132);
  --erp-row-hover: var(--light-soft, #1f2b40);
  --erp-border: var(--light-line, rgba(148, 163, 184, 0.14));
  --erp-border-strong: var(--light-line, rgba(148, 163, 184, 0.24));
  --erp-text: var(--light-text, #e2e8f0);
  --erp-muted: var(--light-muted, #94a3b8);
  --erp-blue: var(--light-info, #1d9bf0);
  --erp-total: var(--light-success, #34d399);
  --erp-accent: var(--light-info, #38bdf8);
  --erp-accent-bg: var(--light-info-soft, rgba(56, 189, 248, 0.12));
  --erp-accent-border: var(--light-line, rgba(56, 189, 248, 0.28));
  --erp-success: var(--light-success, #34d399);
  --erp-success-bg: var(--light-success-soft, rgba(52, 211, 153, 0.12));
  --erp-success-border: var(--light-success-line, rgba(52, 211, 153, 0.26));
  --erp-danger: var(--light-danger, #f87171);
  --erp-danger-bg: var(--light-danger-soft, rgba(248, 113, 113, 0.12));
  --erp-danger-border: var(--light-danger-line, rgba(248, 113, 113, 0.26));
  --erp-warning: var(--light-warning, #fbbf24);
  --erp-warning-bg: var(--light-warning-soft, rgba(251, 191, 36, 0.12));
  --erp-warning-border: var(--light-warning-line, rgba(251, 191, 36, 0.26));
  --erp-neutral: var(--light-muted, #94a3b8);
  --erp-neutral-bg: var(--light-surface, rgba(148, 163, 184, 0.12));
  --erp-neutral-border: var(--light-line, rgba(148, 163, 184, 0.22));
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 14px 16px 10px;
  color: var(--erp-text);
  color-scheme: var(--app-color-scheme, dark);
  background: var(--erp-bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12.5px;
  line-height: 1.35;
  border: 1px solid var(--erp-border);
  border-radius: 10px;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
}
.erp-financeiro.erp-saida { --erp-total: var(--light-danger, #fb7185); }
.erp-financeiro *, .erp-financeiro *::before, .erp-financeiro *::after { box-sizing: border-box; }
.erp-financeiro button, .erp-financeiro input, .erp-financeiro select { font: inherit; }
.erp-financeiro button { cursor: pointer; }
.erp-financeiro button:disabled { opacity: .42; cursor: not-allowed; }
.erp-financeiro button:focus-visible, .erp-financeiro a:focus-visible, .erp-financeiro input:focus-visible,
.erp-financeiro select:focus-visible, .erp-financeiro [tabindex]:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
.erp-financeiro .erp-tela { margin: 0; padding: 0; }

/* Abas */
.erp-financeiro .erp-abas { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 10px; padding: 4px; border: 1px solid var(--erp-border); border-radius: 7px; background: var(--erp-head); }
.erp-financeiro .erp-abas button { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 12px; border: 1px solid transparent; border-radius: 5px; color: var(--erp-muted); background: transparent; font-size: 11.5px; font-weight: 600; }
.erp-financeiro .erp-abas button:hover, .erp-financeiro .erp-abas button.ativo { color: var(--erp-text); border-color: var(--erp-accent-border); background: var(--erp-accent-bg); }
.erp-financeiro .erp-abas button span { min-width: 18px; padding: 1px 5px; border-radius: 9px; color: #fff; background: #e11d48; font-size: 10px; text-align: center; }

/* Cabeçalho */
.erp-financeiro .erp-cabecalho { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; margin: 0 0 10px; }
.erp-financeiro .erp-titulo { grid-column: 1; min-width: 0; }
.erp-financeiro .erp-titulo h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.erp-financeiro .erp-titulo h2 { color: var(--light-text, #f8fafc); margin: 0; font-size: 18px; line-height: 1.25; font-weight: 700; letter-spacing: -.01em; border: 0; padding: 0; }
.erp-financeiro .erp-cabecalho-acoes { grid-column: 2; justify-self: center; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.erp-financeiro .erp-resumo { display: flex; align-items: baseline; gap: 8px; padding: 5px 12px; border: 1px solid var(--erp-border); border-radius: 6px; background: var(--erp-panel); white-space: nowrap; }
.erp-financeiro .erp-resumo > span { color: var(--erp-muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }
.erp-financeiro .erp-resumo strong { color: var(--erp-total); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }

/* Toolbar principal estilo referência */
.erp-financeiro .erp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  padding: 0;
  background: transparent;
  border: 0;
}
.erp-financeiro .erp-acoes,
.erp-financeiro .erp-toolbar-direita {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.erp-financeiro .erp-toolbar-direita { justify-content: flex-end; margin-left: auto; }
.erp-financeiro .erp-controles-tabela { display: flex; flex-wrap: nowrap; align-items: center; gap: 7px; }

/* Busca inline na toolbar */
.erp-financeiro .erp-busca-inline {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 210px;
}
.erp-financeiro .erp-busca-inline > svg {
  position: absolute;
  left: 10px;
  color: var(--erp-muted);
  pointer-events: none;
}
.erp-financeiro .erp-busca-inline input {
  width: 100%;
  height: 32px;
  padding: 0 26px 0 30px;
  color: var(--erp-text);
  background: var(--erp-panel);
  border: 1px solid var(--erp-border-strong);
  border-radius: 5px;
  font-size: 12px;
  transition: border-color .15s, background .15s;
}
.erp-financeiro .erp-busca-inline input::placeholder { color: var(--erp-muted); }
.erp-financeiro .erp-busca-inline input:focus { border-color: var(--erp-blue); background: var(--erp-panel); outline: none; }
.erp-financeiro .erp-busca-limpar {
  position: absolute;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  color: var(--erp-muted);
  background: transparent;
}
.erp-financeiro .erp-busca-limpar:hover { color: var(--erp-text); background: var(--erp-row-hover); }

/* Botões compactos padronizados */
.erp-financeiro .erp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  color: var(--erp-text);
  background: var(--erp-panel);
  border: 1px solid var(--erp-border-strong);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: background .15s, border-color .15s;
}
.erp-financeiro .erp-btn:hover:not(:disabled) {
  background: var(--erp-row-hover);
  border-color: rgba(148, 163, 184, 0.42);
}
.erp-financeiro .erp-btn > svg { flex-shrink: 0; }
.erp-financeiro .erp-btn-primario {
  padding: 0 13px;
  background: #1d9bf0;
  border-color: #1d9bf0;
  color: #ffffff;
  font-weight: 600;
}
.erp-financeiro .erp-btn-primario:hover:not(:disabled) {
  background: #0ea5e9;
  border-color: #38bdf8;
}
.erp-financeiro .erp-btn-sutis {
  background: transparent;
  border-color: var(--erp-border);
  color: var(--erp-muted);
  padding: 0 9px;
}
.erp-financeiro .erp-btn-sutis:hover:not(:disabled) {
  color: var(--erp-text);
  background: var(--erp-panel);
}
.erp-financeiro .erp-btn-perigo {
  color: var(--erp-danger);
  border-color: var(--erp-danger-border);
  background: var(--erp-danger-bg);
}
.erp-financeiro .erp-btn-ativo {
  border-color: var(--erp-blue);
  background: var(--erp-accent-bg);
  color: var(--erp-blue);
}
.erp-financeiro .erp-btn-icone { width: 30px; padding: 0; }
.erp-financeiro .erp-contador {
  background: var(--erp-blue);
  border-radius: 9px;
  padding: 0 5px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

/* Dropdown de Colunas igual à imagem de referência */
.erp-financeiro .erp-colunas-ancora { position: relative; display: inline-flex; }
.erp-financeiro .erp-colunas-lista {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 45;
  display: flex;
  flex-direction: column;
  width: 215px;
  max-height: 310px;
  overflow-y: auto;
  padding: 2px 0;
  border: 1px solid var(--erp-border-strong);
  border-radius: 6px;
  background: var(--erp-panel);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
}
.erp-financeiro .erp-colunas-lista button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 32px;
  padding: 6px 12px;
  border: 0;
  border-bottom: 1px solid var(--erp-border);
  background: transparent;
  color: var(--erp-text);
  font-size: 12px;
  text-align: left;
  transition: background .12s;
}
.erp-financeiro .erp-colunas-lista button:last-child { border-bottom: 0; }
.erp-financeiro .erp-colunas-lista button:hover:not(:disabled) {
  background: var(--erp-accent-bg);
}
.erp-financeiro .erp-colunas-lista button[aria-selected="false"] {
  color: var(--erp-muted);
}
.erp-financeiro .erp-coluna-rotulo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.erp-financeiro .erp-coluna-olho {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #1d9bf0;
}
.erp-financeiro .erp-colunas-lista button[aria-selected="false"] .erp-coluna-olho {
  color: #64748b;
}

/* Paginação superior compacta igual à imagem de referência */
.erp-financeiro .erp-paginacao-topo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
  color: var(--erp-muted);
  font-size: 11.5px;
}
.erp-financeiro .erp-paginacao-resumo { white-space: nowrap; }
.erp-financeiro .erp-paginacao-controles {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.erp-financeiro .erp-pagina-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--erp-text);
}
.erp-financeiro .erp-pagina-btn:hover:not(:disabled) {
  background: var(--erp-row-hover);
}
.erp-financeiro .erp-por-pagina {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
}
.erp-financeiro .erp-por-pagina select {
  appearance: none;
  height: 26px;
  border: 1px solid var(--erp-border);
  border-radius: 4px;
  padding: 0 20px 0 8px;
  background: var(--erp-panel);
  color: var(--erp-text);
  font-size: 11.5px;
  cursor: pointer;
}
.erp-financeiro select option { color: var(--erp-text); background: var(--erp-panel); }
.erp-financeiro .erp-por-pagina > svg {
  position: absolute;
  right: 6px;
  color: var(--erp-muted);
  pointer-events: none;
}

/* Seletor de Período */
.erp-financeiro .erp-periodo { position: relative; display: flex; align-items: center; gap: 6px; }
.erp-financeiro .erp-navegacao-mes { display: flex; align-items: center; gap: 4px; }
.erp-financeiro .erp-rotulo-periodo { display: block; min-width: 104px; text-align: center; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--erp-text); }
.erp-financeiro .erp-seletor-mes { position: absolute; z-index: 40; top: calc(100% + 8px); right: 0; width: 276px; padding: 12px; border: 1px solid var(--erp-border-strong); border-radius: 7px; background: var(--erp-panel); box-shadow: 0 16px 38px rgba(0,0,0,.28); }
.erp-financeiro .erp-seletor-cabecalho { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.erp-financeiro .erp-meses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.erp-financeiro .erp-meses button { height: 32px; color: var(--erp-muted); border: 1px solid var(--erp-border); border-radius: 4px; background: var(--erp-row-odd); text-transform: capitalize; font-size: 12px; }
.erp-financeiro .erp-meses button:hover { background: var(--erp-row-hover); color: var(--erp-text); }
.erp-financeiro .erp-meses button[aria-pressed="true"] { color: var(--erp-blue); border-color: var(--erp-blue); background: var(--erp-accent-bg); font-weight: 600; }
.erp-financeiro .erp-seletor-rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
.erp-financeiro .erp-seletor-rodape > span { color: var(--erp-muted); font-size: 11px; }
.erp-financeiro .erp-seletor-rodape .erp-btn { height: 28px; padding: 0 9px; font-size: 11px; }

/* Barra de seleção múltipla e filtros extras */
.erp-financeiro .erp-barra-selecao { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 8px; padding: 6px 10px; border: 1px solid var(--erp-accent-border); border-radius: 6px; background: var(--erp-accent-bg); }
.erp-financeiro .erp-barra-selecao > span { margin-right: auto; color: var(--erp-text); font-size: 12px; font-weight: 600; }
.erp-financeiro .erp-filtros { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; margin: 0 0 8px; background: var(--erp-panel); border: 1px solid var(--erp-border); border-radius: 6px; }
.erp-financeiro .erp-filtros label { min-width: 170px; }
.erp-financeiro .erp-filtros select { width: 100%; height: 32px; background: var(--erp-head); color: var(--erp-text); border: 1px solid var(--erp-border-strong); border-radius: 5px; padding: 0 10px; font-size: 12px; }
.erp-financeiro .erp-erro { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0; padding: 9px 12px; border: 1px solid var(--erp-danger-border); border-radius: 6px; color: var(--erp-danger); background: var(--erp-danger-bg); }

/* Tabela compacta estilo referência */
.erp-financeiro .erp-tabela-container {
  overflow-x: auto;
  border: 1px solid var(--erp-border);
  border-radius: 7px;
  background: var(--erp-row-odd);
  scrollbar-color: var(--erp-border-strong) transparent;
  cursor: grab;
}
.erp-financeiro .erp-tabela-container.erp-arrastando,
.erp-financeiro .erp-tabela-container.erp-arrastando * { cursor: grabbing !important; user-select: none; }
.erp-financeiro .erp-tabela {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  text-align: left;
  color: var(--erp-text);
}
.erp-financeiro .erp-tabela thead { background: var(--erp-head); }
.erp-financeiro .erp-tabela th {
  position: relative;
  height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--erp-border-strong);
  border-right: 1px solid rgba(148, 163, 184, 0.08);
  font-weight: 600;
  vertical-align: middle;
}
.erp-financeiro .erp-tabela th.erp-th-acoes { padding: 0 8px; text-align: center; }
.erp-financeiro .erp-tabela th:last-child,
.erp-financeiro .erp-tabela td:last-child { border-right: 0; }

.erp-financeiro .erp-ordenar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--erp-text);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .01em;
  text-align: left;
}
.erp-financeiro .erp-ordenar > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.erp-financeiro .erp-ordenar > svg { color: var(--erp-muted); flex-shrink: 0; }
.erp-financeiro .erp-status-th-conteudo { display: flex; align-items: center; gap: 4px; }
.erp-financeiro .erp-status-th-conteudo .erp-ordenar { flex: 1; min-width: 0; }
.erp-financeiro .erp-status-filtro-anchor { position: relative; z-index: 20; flex: 0 0 auto; }
.erp-financeiro .erp-status-filtro-trigger { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--erp-muted); }
.erp-financeiro .erp-status-filtro-trigger:hover, .erp-financeiro .erp-status-filtro-trigger.erp-status-filtro-ativo { background: var(--erp-accent-bg); color: var(--erp-blue); }
.erp-financeiro .erp-status-filtro-menu { position: absolute; top: calc(100% + 5px); left: 0; z-index: 50; width: 185px; max-height: 240px; overflow-y: auto; padding: 4px; border: 1px solid var(--erp-border-strong); border-radius: 6px; background: var(--erp-panel); box-shadow: 0 12px 28px rgba(0,0,0,.28); }
.erp-financeiro .erp-status-filtro-menu button { display: block; width: 100%; min-height: 27px; padding: 4px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--erp-muted); font-size: 11px; text-align: left; }
.erp-financeiro .erp-status-filtro-menu button:hover, .erp-financeiro .erp-status-filtro-menu button[aria-pressed="true"] { background: var(--erp-accent-bg); color: var(--erp-blue); }

.erp-financeiro .erp-redimensionar { position: absolute; right: -3px; top: 0; bottom: 0; z-index: 1; width: 6px; cursor: col-resize; touch-action: none; }
.erp-financeiro .erp-redimensionar:hover { background: rgba(56, 189, 248, 0.45); }

/* Células compactas de 1 linha */
.erp-financeiro .erp-tabela td {
  height: 36px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--erp-border);
  border-right: 1px solid var(--erp-border);
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.erp-financeiro .erp-linha {
  height: 36px;
  cursor: pointer;
  background: var(--erp-row-odd);
  transition: background .12s ease;
}
.erp-financeiro .erp-linha:nth-child(even) { background: var(--erp-row-even); }
.erp-financeiro .erp-linha:hover { background: var(--erp-row-hover); }
.erp-financeiro .erp-linha.erp-linha-selecionada { background: var(--erp-accent-bg); }
.erp-financeiro .erp-linha.erp-linha-aberta { background: var(--erp-row-hover); }
.erp-financeiro .erp-linha.erp-linha-aberta > td { background: var(--erp-row-hover); }

.erp-financeiro .erp-descricao {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--erp-text);
}
.erp-financeiro .erp-td-data {
  color: var(--erp-muted);
  font-variant-numeric: tabular-nums;
}
.erp-financeiro .erp-tabela .erp-documento {
  color: var(--erp-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
.erp-financeiro .erp-aeronave {
  font-weight: 600;
  color: var(--erp-text);
}

/* Coluna de ações / checkbox alinhada */
.erp-financeiro .erp-tabela td.erp-td-acoes {
  padding: 0 6px;
  overflow: visible;
}
.erp-financeiro .erp-celula-selecao {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.erp-financeiro .erp-expandir {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  color: var(--erp-muted);
  background: transparent;
}
.erp-financeiro .erp-expandir:hover { color: var(--erp-text); }
.erp-financeiro .erp-expandir svg { transition: transform .15s; }
.erp-financeiro .erp-expandir[aria-expanded="true"] svg { transform: rotate(90deg); }

.erp-financeiro .erp-checkbox { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; flex-shrink: 0; cursor: pointer; }
.erp-financeiro .erp-checkbox input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.erp-financeiro .erp-checkbox > span { display: flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid var(--erp-border-strong); border-radius: 3px; color: transparent; background: var(--erp-panel); }
.erp-financeiro .erp-checkbox input:checked + span, .erp-financeiro .erp-checkbox input:indeterminate + span { color: #fff; border-color: var(--erp-blue); background: var(--erp-blue); }
.erp-financeiro .erp-checkbox-traco { width: 8px; height: 2px; background: currentColor; }

.erp-financeiro .erp-botao-menu { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 24px; padding: 0; border: 0; border-radius: 4px; color: var(--erp-muted); background: transparent; }
.erp-financeiro .erp-botao-menu:hover { color: var(--erp-text); background: var(--erp-row-hover); }

/* Badges de status compactos */
.erp-financeiro .erp-status {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  max-width: 100%;
  height: 21px;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 0 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.erp-financeiro .erp-status-sucesso { color: var(--erp-success); background: var(--erp-success-bg); border-color: var(--erp-success-border); }
.erp-financeiro .erp-status-pendente { color: var(--erp-warning); background: var(--erp-warning-bg); border-color: var(--erp-warning-border); }
.erp-financeiro .erp-status-atrasado { color: var(--erp-danger); background: var(--erp-danger-bg); border-color: var(--erp-danger-border); }
.erp-financeiro .erp-status-aguardando { color: var(--erp-accent); background: var(--erp-accent-bg); border-color: var(--erp-accent-border); }
.erp-financeiro .erp-status-cancelado { color: var(--erp-neutral); background: var(--erp-neutral-bg); border-color: var(--erp-neutral-border); }

.erp-financeiro .erp-valor {
  text-align: right;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--erp-text);
}

/* Linha expandida (Detalhes e Anexos) sem margens negativas */
.erp-financeiro .erp-linha-detalhes > td { padding: 0 !important; white-space: normal; background: var(--erp-head); height: auto; }
.erp-financeiro .erp-detalhes {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(320px, 1.4fr);
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid var(--erp-border);
}
.erp-financeiro .erp-detalhes-campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 10px 14px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--erp-border);
  border-radius: 7px;
  background: var(--erp-panel);
}
.erp-financeiro .erp-detalhes-campos > div { min-width: 0; }
.erp-financeiro .erp-detalhes-obs-wrap { grid-column: 1 / -1; }
.erp-financeiro .erp-detalhes dt { margin-bottom: 2px; color: var(--erp-muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }
.erp-financeiro .erp-detalhes dd { margin: 0; color: var(--erp-text); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.erp-financeiro .erp-observacoes { white-space: pre-wrap; }
.erp-financeiro .erp-anexos {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--erp-border);
  border-radius: 7px;
  background: var(--erp-panel);
}
.erp-financeiro .erp-anexos-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: var(--erp-text); font-size: 12px; }
.erp-financeiro .erp-anexos-cabecalho span { color: var(--erp-muted); font-size: 11px; }
.erp-financeiro .erp-anexos-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.erp-financeiro .erp-anexo-card { min-width: 0; overflow: hidden; border: 1px solid var(--erp-border-strong); border-radius: 6px; background: var(--erp-head); transition: border-color .15s; }
.erp-financeiro .erp-anexo-card:hover { border-color: var(--erp-blue); }
.erp-financeiro .erp-anexo-link, .erp-financeiro .erp-anexo-indisponivel { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; height: 42px; padding: 4px 10px; border: 0; background: transparent; color: var(--erp-blue); font: inherit; text-align: left; text-decoration: none; }
.erp-financeiro .erp-anexo-link svg, .erp-financeiro .erp-anexo-indisponivel svg { flex: 0 0 auto; }
.erp-financeiro .erp-anexo-indisponivel { color: var(--erp-muted); cursor: default; }
.erp-financeiro .erp-anexo-nome { min-width: 0; overflow: hidden; color: var(--erp-text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.erp-financeiro .erp-th-arrastada { opacity: .45; }
.erp-financeiro .erp-ordenar[draggable="true"] { cursor: grab; }
.erp-financeiro .erp-anexo-tentar { display: inline-flex; padding: 0; border: 0; color: var(--erp-blue); background: transparent; }
.erp-financeiro .erp-anexos-vazio { margin: 0; padding: 6px 0; color: var(--erp-muted); font-size: 11.5px; }

/* Rodapé da tabela */
.erp-financeiro .erp-tabela tfoot { background: var(--erp-head); }
.erp-financeiro .erp-tabela tfoot td {
  height: 32px;
  padding: 4px 10px;
  border-bottom: 0;
  border-top: 1px solid var(--erp-border-strong);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .03em;
  color: var(--erp-muted);
}
.erp-financeiro .erp-tabela tfoot .erp-total-rodape {
  color: var(--erp-total);
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.erp-financeiro .erp-tabela .erp-estado { text-align: center; padding: 36px 16px; color: var(--erp-muted); height: auto; }
.erp-financeiro .erp-estado > svg { display: inline-block; vertical-align: middle; margin-right: 8px; }

/* Rodapé inferior */
.erp-financeiro .erp-rodape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 2px 4px;
  color: var(--erp-muted);
  font-size: 11.5px;
}
.erp-financeiro .erp-rodape-info, .erp-financeiro .erp-paginacao { display: flex; align-items: center; gap: 8px; }
.erp-financeiro .erp-barra { color: rgba(148, 163, 184, 0.35); }
.erp-financeiro .erp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.erp-financeiro .erp-relatorio-impressao { display: none; }
.erp-financeiro .erp-girando { animation: erp-girar 1s linear infinite; }
@keyframes erp-girar { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .erp-financeiro *, .erp-financeiro *::before, .erp-financeiro *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition: none !important; }
}
@media (max-width: 1100px) {
  .erp-financeiro .erp-detalhes { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .erp-financeiro .erp-cabecalho { grid-template-columns: minmax(0, 1fr); }
  .erp-financeiro .erp-cabecalho-acoes { grid-column: 1; justify-self: center; }
  .erp-financeiro { padding: 10px; }
  .erp-financeiro .erp-busca-inline { width: 100%; }
  .erp-financeiro .erp-acoes, .erp-financeiro .erp-toolbar-direita { width: 100%; justify-content: flex-end; }
  .erp-financeiro .erp-controles-tabela { flex-wrap: wrap; }
  .erp-financeiro .erp-detalhes-campos { grid-template-columns: minmax(0, 1fr); }
}
@media print {
  body:has(.erp-financeiro) * { visibility: hidden !important; }
  .erp-financeiro .erp-tela { display: none !important; }
  .erp-financeiro .erp-relatorio-impressao, .erp-financeiro .erp-relatorio-impressao * { visibility: visible !important; }
  .erp-financeiro .erp-relatorio-impressao { display: block !important; position: absolute; inset: 0 auto auto 0; width: 100%; color: #000; background: #fff; font: 11px Arial, sans-serif; }
  .erp-financeiro .erp-relatorio-impressao h1 { margin: 0 0 12px; font-size: 18px; }
  .erp-financeiro .erp-relatorio-impressao p { margin: 4px 0; }
  .erp-financeiro .erp-relatorio-impressao table { width: 100%; margin-top: 14px; border-collapse: collapse; }
  .erp-financeiro .erp-relatorio-impressao th, .erp-financeiro .erp-relatorio-impressao td { padding: 5px 6px; border-bottom: 1px solid #ccc; text-align: left; }
  .erp-financeiro .erp-relatorio-impressao .erp-direita { text-align: right; white-space: nowrap; }
  .erp-financeiro .erp-relatorio-impressao tfoot { font-weight: 700; }
  .erp-financeiro .erp-relatorio-impressao tr { break-inside: avoid; }
  @page { size: A4 landscape; margin: 12mm; }
}
`;
