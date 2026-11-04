import {
  Fragment,
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
  ChevronsUpDown,
  Columns2,
  Filter,
  List,
  Loader2,
  MoreVertical,
  Plus,
  Printer,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api";
import { IconeAnexo } from "./IconeAnexo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  buscarOpcoesFinanceiroShare,
  carregarDocumentoFinanceiro,
  darBaixaContaAPagar,
  darBaixaContaAReceber,
  darBaixaLancamento,
  excluirLancamento,
  formatarData,
  formatarMoeda,
  type CategoriaCaixaShare,
  type ContaBancaria,
} from "@/lib/financeiro-share-api";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import type { ContaAPagar, ContaAReceber } from "./tipos";
import {
  linhasDeContasAPagar,
  linhasDeContasAReceber,
  type FluxoLinha,
  type LinhaConta,
  type SituacaoLinha,
} from "./linhas-contas";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";

/** Campos opcionais: conecte aos nomes reais do seu backend via obterDetalhes. */
export type DetalhesLancamento = {
  observacoes?: string;
  anexos?: Array<{ nome: string; url: string }>;
};

const CAMPOS_ANEXO: Array<{ campo: string; rotulo: string }> = [
  { campo: "url_recibo", rotulo: "Recibo" },
  { campo: "url_demonstrativo", rotulo: "Demonstrativo" },
  { campo: "url_nf", rotulo: "Nota fiscal" },
  { campo: "url_boleto", rotulo: "Boleto" },
  { campo: "url_doc", rotulo: "Documento" },
  { campo: "comprovanteRecebimentoUrl", rotulo: "Comprovante de recebimento" },
  { campo: "comprovantePagamentoUrl", rotulo: "Comprovante de pagamento" },
  { campo: "documentoUrl", rotulo: "Documento principal" },
];

type AnexoLancamento = { nome: string; href: string };

type Props = {
  fluxo: FluxoLinha;
  filtroInicial?: { situacao?: SituacaoLinha; inicio?: string; fim?: string };
  obterDetalhes?: (linha: LinhaConta) => DetalhesLancamento;
};

type ChaveColuna =
  | "documento" | "descricao" | "favorecido" | "favorecidoPessoa"
  | "fornecedor" | "contaBancaria" | "data" | "situacao" | "valor";
type Coluna = { chave: ChaveColuna; rotulo: string; largura?: number };
type FiltroSituacao = "TODAS" | "EM_ABERTO" | "PAGO" | "EM_ATRASO" | "RECEBIDO" | "AGUARDANDO_REEMBOLSO" | "REEMBOLSADO" | "CANCELADO";

const STATUS_FILTRO: Array<{ valor: Exclude<FiltroSituacao, "TODAS">; rotulo: string }> = [
  { valor: "EM_ABERTO", rotulo: "EM ABERTO" },
  { valor: "PAGO", rotulo: "PAGO" },
  { valor: "EM_ATRASO", rotulo: "EM ATRASO" },
  { valor: "RECEBIDO", rotulo: "RECEBIDO" },
  { valor: "AGUARDANDO_REEMBOLSO", rotulo: "AGUARDANDO REEMBOLSO" },
  { valor: "REEMBOLSADO", rotulo: "REEMBOLSADO" },
  { valor: "CANCELADO", rotulo: "CANCELADO" },
];

const FLUXOS_FILTRO: FluxoLinha[] = [
  "ESTORNO", "RECEITA", "DESPESA", "SAIDA REEMBOLSO",
  "ENTRADA REEMBOLSO", "SAIDA", "ENTRADA",
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
  return linha.situacao !== "PAGO" && linha.situacao !== "CANCELADO";
}
function dataOuTraco(valor?: string) {
  return valor ? formatarData(valor.slice(0, 10)) : "—";
}
function urlSegura(valor: string) {
  // Resolve caminhos internos pela API configurada e bloqueia protocolos executáveis.
  try {
    const valorLimpo = valor.trim();
    const resolvido = valorLimpo.startsWith("/") ? `${API_BASE}${valorLimpo}` : valorLimpo;
    const url = new URL(resolvido, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function reunirAnexos(linha: LinhaConta, dados: DetalhesLancamento = {}): AnexoLancamento[] {
  const raw = linha.raw as unknown as Record<string, unknown>;
  const candidatos = [
    ...CAMPOS_ANEXO.map(({ campo, rotulo }) => ({ nome: rotulo, url: raw[campo] })),
    ...(dados.anexos ?? []).map((anexo) => ({ nome: anexo.nome, url: anexo.url })),
  ];
  const urlsVistas = new Set<string>();
  return candidatos.flatMap(({ nome, url }) => {
    if (typeof url !== "string") return [];
    const href = urlSegura(url);
    if (!href || urlsVistas.has(href)) return [];
    urlsVistas.add(href);
    return [{ nome: nome || "Anexo", href }];
  });
}

function urlDeApiPrivada(href: string) {
  try {
    const alvo = new URL(href, window.location.origin);
    const api = new URL(API_BASE || "/", window.location.origin);
    return alvo.origin === api.origin && alvo.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function mimePelaUrl(href: string) {
  const caminho = new URL(href, window.location.origin).pathname.toLowerCase();
  if (/\.pdf$/.test(caminho)) return "application/pdf";
  if (/\.svg$/.test(caminho)) return "image/svg+xml";
  if (/\.(apng|avif|bmp|gif|jpe?g|png|webp)$/.test(caminho)) return "image/*";
  return "";
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
      <span aria-hidden="true">{parcial ? <span className="erp-checkbox-traco" /> : <Check size={12} strokeWidth={3} />}</span>
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
  const privado = urlDeApiPrivada(anexo.href);
  const [recurso, setRecurso] = useState<{ url: string; mime: string } | null>(null);
  const [carregando, setCarregando] = useState(privado);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [visualizando, setVisualizando] = useState(false);

  useEffect(() => {
    if (!privado) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setCarregando(true);
    setFalha(false);
    setRecurso(null);
    void carregarDocumentoFinanceiro(anexo.href, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      const mimeBlob = blob.type.toLowerCase().split(";")[0];
      const mime = !mimeBlob || mimeBlob === "application/octet-stream" ? mimePelaUrl(anexo.href) || mimeBlob : mimeBlob;
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
  }, [anexo.href, privado, tentativa]);

  const href = privado ? recurso?.url : anexo.href;
  const titulo = anexo.nome || "Anexo";

  const mime = privado ? (recurso?.mime ?? "") : mimePelaUrl(anexo.href);

  return (
    <article className="erp-anexo-card">
      {href ? <button type="button" className="erp-anexo-link" aria-label={`Abrir ${titulo}`} title={titulo} onClick={() => setVisualizando(true)}>
        <IconeAnexo nome={titulo} />
        <span className="erp-anexo-nome">{titulo}</span>
      </button> : <div className="erp-anexo-indisponivel" aria-live="polite" title={titulo}>
        <IconeAnexo nome={titulo} />
        <span className="erp-anexo-nome">{titulo}</span>
        {falha
          ? <button type="button" className="erp-anexo-tentar" aria-label={`Tentar novamente: ${titulo}`} title="Tentar novamente" onClick={() => setTentativa((valor) => valor + 1)}><RotateCw size={18} aria-hidden="true" /></button>
          : <Loader2 size={18} className="animate-spin" aria-label={carregando ? "Carregando anexo" : "Preparando anexo"} />}
      </div>}
      {visualizando && href && <VisualizadorAnexo titulo={titulo} href={href} mime={mime} aoFechar={() => setVisualizando(false)} />}
    </article>
  );
}

function Detalhes({ linha, dados }: { linha: LinhaConta; dados: DetalhesLancamento }) {
  const anexos = reunirAnexos(linha, dados);
  return (
    <div className="erp-detalhes">
      <dl className="erp-detalhes-campos">
        <div><dt>Categoria</dt><dd>{linha.categoria || "—"}</dd></div>
        <div><dt>Favorecido</dt><dd>{linha.favorecido || "—"}</dd></div>
        <div><dt>Nº do documento</dt><dd>{linha.documento || "—"}</dd></div>
        <div><dt>Observações</dt><dd className="erp-observacoes">{dados.observacoes || "—"}</dd></div>
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
    case "data":
      return <td key={chave} className="erp-td-data"><span>{dataOuTraco(linha.dataLancamento)}</span>{linha.dataVencimento && <span className="erp-texto-secundario">Venc. {dataOuTraco(linha.dataVencimento)}</span>}</td>;
    case "documento":
      return <td key={chave} className="erp-documento" title={linha.documento || undefined}>{linha.documento || "—"}</td>;
    case "descricao":
      return <td key={chave}><div className="erp-descricao-cabecalho"><strong className="erp-descricao" title={linha.descricao}>{linha.descricao}</strong></div><span className="erp-texto-secundario" title={linha.categoria}>{linha.categoria || "—"}</span></td>;
    case "favorecido":
      return <td key={chave} title={linha.favorecido}>{linha.favorecido || "—"}</td>;
    case "favorecidoPessoa":
      return <td key={chave} title={linha.favorecidoPessoa || undefined}>{linha.favorecidoPessoa || "—"}</td>;
    case "fornecedor":
      return <td key={chave} title={linha.fornecedor || undefined}>{linha.fornecedor || "—"}</td>;
    case "contaBancaria":
      return <td key={chave} title={linha.contaBancaria}>{linha.contaBancaria || "—"}</td>;
    case "situacao":
      return <td key={chave}><span className={`erp-status erp-status-${TONS[statusParaFiltro(linha)] ?? "cancelado"}`}>{ROTULOS[statusParaFiltro(linha)] ?? rotuloStatus(statusParaFiltro(linha))}</span></td>;
    case "valor":
      return <td key={chave} className="erp-valor">{formatarMoeda(linha.valor)}</td>;
  }
}

export function LancamentosUnificados({ fluxo, filtroInicial, obterDetalhes }: Props) {
  const pagar = useContasAPagar({ incluirLancamentos: fluxo === "SAIDA" });
  const receber = useContasAReceber();
  const ehEntrada = fluxo === "ENTRADA";
  const titulo = ehEntrada ? "Registrar Entrada" : "Registrar Saída";
  const carregando = ehEntrada ? receber.carregando : pagar.carregando;
  const erro = ehEntrada ? receber.erro : pagar.erro;
  const recarregar = ehEntrada ? receber.recarregar : pagar.recarregar;
  const id = useId().replace(/:/g, "");
  const periodoRef = useRef<HTMLDivElement>(null);
  const botaoPeriodoRef = useRef<HTMLButtonElement>(null);
  const dialogoPeriodoRef = useRef<HTMLDivElement>(null);
  const statusFiltroRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; scrollLeft: number; dragged: boolean } | null>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const pararResizeRef = useRef<(() => void) | null>(null);
  const [arrastandoTabela, setArrastandoTabela] = useState(false);

  const lancamentos = useMemo(() => (
    ehEntrada ? linhasDeContasAReceber(receber.contas) : linhasDeContasAPagar(pagar.contas)
  ), [ehEntrada, receber.contas, pagar.contas]);

  const [busca, setBusca] = useState("");
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
  const [ordenacao, setOrdenacao] = useState<{ chave: ChaveColuna; crescente: boolean }>({ chave: "data", crescente: false });
  const [larguras, setLarguras] = useState<Partial<Record<ChaveColuna, number>>>({});
  const [ordemColunas, setOrdemColunas] = useState<ChaveColuna[]>([]);
  const [colunaArrastada, setColunaArrastada] = useState<ChaveColuna | null>(null);
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [expandidos, setExpandidos] = useState<string[]>([]);
  const [contaBaixa, setContaBaixa] = useState<LinhaConta | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [menuLinhaId, setMenuLinhaId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuLinhaId) return;
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Element && evento.target.closest(".erp-menu-linha")) return;
      setMenuLinhaId(null);
    };
    document.addEventListener("pointerdown", fecharFora);
    return () => document.removeEventListener("pointerdown", fecharFora);
  }, [menuLinhaId]);

  useEffect(() => {
    let ativo = true;
    void buscarOpcoesFinanceiroShare().then((opcoes) => {
      if (ativo) { setCategorias(opcoes.categorias); setContasBancarias(opcoes.contas_bancarias); }
    }).catch(() => {
      if (ativo) toast.error("Não foi possível carregar as opções financeiras. Tente novamente.");
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    setSelecionados([]);
    setExpandidos([]);
    setContaBaixa(null);
    setNovo(false);
    setLarguras({});
    setOrdemColunas([]);
  }, [fluxo]);

  useEffect(() => { setSituacaoFiltro(situacaoFiltroInicial(filtroInicial?.situacao)); }, [filtroInicial?.situacao]);
  useEffect(() => {
    setPagina(1);
  }, [busca, situacaoFiltro, caixaFiltro, fluxoFiltro, mesesSelecionados,
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

  const colunas = useMemo<Coluna[]>(() => [
    { chave: "data", rotulo: "Data", largura: 172 },
    { chave: "documento", rotulo: "DOC", largura: 162 },
    { chave: "descricao", rotulo: "Descrição", largura: 320 },
    ...(ehEntrada
      ? [{ chave: "favorecido" as const, rotulo: "Favorecido", largura: 280 }]
      : [{ chave: "favorecidoPessoa" as const, rotulo: "Favorecido", largura: 200 },
        { chave: "fornecedor" as const, rotulo: "Fornecedor", largura: 200 }]),
    { chave: "contaBancaria", rotulo: "Conta", largura: 153 },
    { chave: "situacao", rotulo: "Status", largura: 190 },
    { chave: "valor", rotulo: "Valor", largura: 180 },
  ], [ehEntrada]);

  const colunasExibidas = useMemo<Coluna[]>(() => {
    const porChave = new Map<ChaveColuna, Coluna>(colunas.map((coluna) => [coluna.chave, coluna]));
    const ordenadas = ordemColunas.flatMap((chave) => porChave.get(chave) ?? []);
    return [...ordenadas, ...colunas.filter((coluna) => !ordemColunas.includes(coluna.chave))];
  }, [colunas, ordemColunas]);

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
      const vencimento = (linha.dataVencimento || "").slice(0, 10);
      if (filtroInicial?.inicio && vencimento < filtroInicial.inicio.slice(0, 10)) return false;
      if (filtroInicial?.fim && (!vencimento || vencimento > filtroInicial.fim.slice(0, 10))) return false;
      if (!temPeriodoInicial && !mesesSelecionados.includes((linha.dataLancamento || "").slice(0, 7))) return false;
      if (situacaoFiltro !== "TODAS" && statusParaFiltro(linha) !== situacaoFiltro) return false;
      if (caixaFiltro !== "TODOS" && linha.caixa !== caixaFiltro) return false;
      if (fluxoFiltro !== "TODOS" && linha.fluxo !== fluxoFiltro) return false;
      const texto = [linha.documento, linha.descricao, linha.categoria, linha.favorecido,
        linha.favorecidoPessoa, linha.fornecedor, linha.contaBancaria, linha.fluxo].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return texto.includes(textoBusca);
    }).sort((a, b) => {
      const chave = ordenacao.chave;
      const comparacao = chave === "valor" ? a.valor - b.valor
        : String(chave === "data" ? a.dataLancamento ?? "" : a[chave] ?? "").localeCompare(
          String(chave === "data" ? b.dataLancamento ?? "" : b[chave] ?? ""), "pt-BR", { numeric: true });
      return ordenacao.crescente ? comparacao : -comparacao;
    });
  }, [lancamentos, busca, situacaoFiltro, caixaFiltro, fluxoFiltro, mesesSelecionados,
    filtroInicial?.inicio, filtroInicial?.fim, temPeriodoInicial, ordenacao]);

  const selecao = useMemo(() => new Set(selecionados), [selecionados]);
  const expansao = useMemo(() => new Set(expandidos), [expandidos]);
  const selecionadosVisiveis = filtrados.filter((linha) => selecao.has(linha.id));
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
  const filtrosAtivos = Number(Boolean(busca.trim())) + Number(situacaoFiltro !== "TODAS")
    + Number(caixaFiltro !== "TODOS") + Number(fluxoFiltro !== "TODOS");

  // Se uma atualização reduzir o número de páginas, mantém a página válida.
  useEffect(() => { setPagina((atual) => Math.min(atual, paginas)); }, [paginas]);

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

  function iniciarResize(evento: ReactPointerEvent<HTMLSpanElement>, chave: ChaveColuna) {
    evento.preventDefault(); evento.stopPropagation();
    const cabecalho = evento.currentTarget.closest("th");
    if (!cabecalho) return;
    pararResizeRef.current?.();
    const inicio = evento.clientX;
    const larguraInicial = cabecalho.getBoundingClientRect().width;
    const mover = (e: PointerEvent) => setLarguras((atuais) => ({ ...atuais, [chave]: Math.max(110, larguraInicial + e.clientX - inicio) }));
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
      <div className="erp-tela">
        <header className="erp-cabecalho">
          <div className="erp-titulo"><h2 id={`${id}-titulo`}>{titulo}</h2></div>
          <div className="erp-cabecalho-acoes">
            <div className="erp-resumo"><span>{selecionadosVisiveis.length ? "Total selecionado" : "Total listado"}</span><strong>{carregando ? "—" : formatarMoeda(totalRelatorio)}</strong></div>
            <button type="button" className="erp-btn" disabled={carregando || !filtrados.length} onClick={() => window.print()}><Printer size={17} aria-hidden="true" />Imprimir</button>
          </div>
        </header>

        <div className="erp-toolbar" role="group" aria-label="Ações dos lançamentos">
          <div className="erp-acoes">
            <button type="button" className="erp-btn erp-btn-primario" onClick={() => setNovo(true)}><Plus size={17} aria-hidden="true" />Novo</button>
            <button type="button" className={`erp-btn ${mostrarFiltros ? "erp-btn-ativo" : ""}`} aria-expanded={mostrarFiltros}
              aria-controls={`${id}-filtros`} onClick={() => setMostrarFiltros((atual) => !atual)}>
              <Filter size={17} aria-hidden="true" />Filtrar{filtrosAtivos > 0 && <span className="erp-contador">{filtrosAtivos}</span>}
            </button>
            <span className="erp-divisor" aria-hidden="true" />
            <button type="button" className="erp-btn erp-btn-texto" disabled={carregando || !linhas.length} onClick={alternarTodas}>
              <List size={18} aria-hidden="true" />{todasExpandidas ? "Recolher todas" : "Expandir todas"}
            </button>
            <span className="erp-divisor" aria-hidden="true" />
            <button type="button" className="erp-btn erp-btn-texto" onClick={() => { setLarguras({}); setOrdemColunas([]); }}><Columns2 size={17} aria-hidden="true" />Restaurar colunas</button>
          </div>

          <div className="erp-periodo" ref={periodoRef}>
            {!temPeriodoInicial && <button type="button" ref={botaoPeriodoRef} className="erp-btn" aria-expanded={seletorMesAberto}
              aria-haspopup="dialog" aria-controls={`${id}-meses`} onClick={() => setSeletorMesAberto((atual) => !atual)}>
              Mês Atual<ChevronDown size={12} aria-hidden="true" />
            </button>}
            <div className="erp-navegacao-mes">
              {!temPeriodoInicial && <button type="button" className="erp-btn erp-btn-icone" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={18} /></button>}
              <span className="erp-rotulo-periodo">{periodo}</span>
              {!temPeriodoInicial && <button type="button" className="erp-btn erp-btn-icone" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={18} /></button>}
            </div>
            {seletorMesAberto && !temPeriodoInicial && (
              <div id={`${id}-meses`} ref={dialogoPeriodoRef} className="erp-seletor-mes" role="dialog" aria-label="Selecionar meses">
                <div className="erp-seletor-cabecalho">
                  <button type="button" className="erp-btn erp-btn-icone" aria-label="Ano anterior" onClick={() => setMes(`${anoSeletor - 1}-${mes.slice(5)}`)}><ChevronLeft size={16} /></button>
                  <strong>{anoSeletor}</strong>
                  <button type="button" className="erp-btn erp-btn-icone" aria-label="Próximo ano" onClick={() => setMes(`${anoSeletor + 1}-${mes.slice(5)}`)}><ChevronRight size={16} /></button>
                </div>
                <div className="erp-meses">{mesesDoAno.map((valor) => (
                  <button type="button" key={valor} aria-pressed={mesesSelecionados.includes(valor)} onClick={() => alternarMes(valor)}>{nomeMes(valor, "short").replace(".", "")}</button>
                ))}</div>
                <div className="erp-seletor-rodape"><span>Selecione um ou mais meses.</span><button type="button" className="erp-btn" onClick={irParaMesAtual}>Mês atual</button></div>
              </div>
            )}
          </div>
        </div>

        {mostrarFiltros && <div className="erp-filtros" id={`${id}-filtros`}>
          <label className="erp-busca"><span className="erp-sr-only">Buscar lançamento</span><Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Buscar lançamento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <label><span className="erp-sr-only">Caixa</span><select value={caixaFiltro} onChange={(e) => setCaixaFiltro(e.target.value)}>
            <option value="TODOS">Todos os caixas</option><option value="SHARE">Share</option><option value="CLIENTE">Cliente</option>
          </select></label>
          <label><span className="erp-sr-only">Fluxo</span><select value={fluxoFiltro} onChange={(e) => setFluxoFiltro(e.target.value as "TODOS" | FluxoLinha)}>
            <option value="TODOS">Todos os fluxos</option>{FLUXOS_FILTRO.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <button type="button" className="erp-btn erp-btn-texto" onClick={limparFiltros}><X size={15} aria-hidden="true" />Limpar</button>
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
          <table className={`erp-tabela ${!ehEntrada ? "erp-tabela-saidas" : ""}`}>
            <caption className="erp-sr-only">{titulo} — {periodo}</caption>
            <colgroup><col style={{ width: 120 }} />{colunasExibidas.map((coluna) => (
              <col key={coluna.chave} style={{ width: larguras[coluna.chave] ?? coluna.largura }} />
            ))}</colgroup>
            <thead><tr>
              <th scope="col"><div className="erp-celula-selecao erp-selecao-cabecalho">
                <Checkbox marcado={todasSelecionadas} parcial={algumasSelecionadas && !todasSelecionadas}
                  desabilitado={carregando || !linhas.length} rotulo="Selecionar todos desta página" aoMudar={alternarPagina} />
              </div></th>
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
                        <Filter size={13} aria-hidden="true" />
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
                      {coluna.rotulo}<ChevronsUpDown size={12} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button type="button" {...arrastoColuna(coluna.chave)} className="erp-ordenar" onClick={() => setOrdenacao((atual) => ({ chave: coluna.chave, crescente: atual.chave === coluna.chave ? !atual.crescente : true }))}>
                    {coluna.rotulo}<ChevronsUpDown size={12} aria-hidden="true" />
                  </button>
                )}
                <span className="erp-redimensionar" onPointerDown={(e) => iniciarResize(e, coluna.chave)} aria-hidden="true" title="Arraste para ajustar a coluna" />
              </th>)}
            </tr></thead>
            <tbody>
              {carregando ? <tr><td colSpan={colunas.length + 1} className="erp-estado"><Loader2 size={18} className="erp-girando" aria-hidden="true" />Carregando lançamentos...</td></tr>
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
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                        <Checkbox marcado={selecao.has(linha.id)} rotulo={`Selecionar ${linha.descricao}`} aoMudar={() => alternarSelecao(linha.id)} />
                        <div className="erp-menu-linha">
                          <button type="button" className="erp-botao-menu" aria-label={`Ações de ${linha.descricao}`} aria-haspopup="menu"
                            aria-expanded={menuLinhaId === linha.id} onClick={() => setMenuLinhaId((atual) => atual === linha.id ? null : linha.id)}>
                            <MoreVertical size={16} aria-hidden="true" />
                          </button>
                          {menuLinhaId === linha.id && <div className="erp-menu-acoes" role="menu">
                            <button type="button" role="menuitem" disabled={!podeBaixar(linha)} onClick={() => { setMenuLinhaId(null); setContaBaixa(linha); }}>Baixar</button>
                            <button type="button" role="menuitem" className="erp-menu-excluir" disabled={!linha.raw.lancamentoId} onClick={() => void excluirLinha(linha)}>Excluir</button>
                          </div>}
                        </div>
                      </div></td>
                      {colunasExibidas.map((coluna) => celulaLancamento(coluna.chave, linha))}
                    </tr>
                    {aberta && <tr className="erp-linha-detalhes"><td colSpan={colunas.length + 1}>
                      <div id={detalheId}><Detalhes linha={linha} dados={dadosDetalhe} /></div>
                    </td></tr>}
                  </Fragment>;
                }) : <tr><td colSpan={colunas.length + 1} className="erp-estado">Nenhum lançamento encontrado para os filtros.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={colunas.length}>TOTAL LISTADO ({filtrados.length} {filtrados.length === 1 ? "item" : "itens"})</td>
              <td className="erp-total-rodape">{carregando ? "—" : formatarMoeda(totalListado)}</td></tr></tfoot>
          </table>
        </div>

        <footer className="erp-rodape">
          <div className="erp-rodape-info"><span>{selecionadosVisiveis.length} {selecionadosVisiveis.length === 1 ? "selecionado" : "selecionados"}</span>
            <span className="erp-barra" aria-hidden="true">|</span><span>{filtrados.length} registros</span><span className="erp-barra" aria-hidden="true">|</span>
            <label className="erp-por-pagina"><span className="erp-sr-only">Linhas por página</span><select value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))}>
              {[10, 25, 50, 100].map((quantidade) => <option key={quantidade} value={quantidade}>{quantidade} linhas por página</option>)}
            </select><ChevronDown size={12} aria-hidden="true" /></label>
          </div>
          <div className="erp-paginacao"><span>{filtrados.length ? `${(paginaAtual - 1) * porPagina + 1}–${Math.min(paginaAtual * porPagina, filtrados.length)} de ${filtrados.length}` : "0 itens"}</span>
            <button type="button" className="erp-pagina-btn" aria-label="Página anterior" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft size={16} /></button>
            <span aria-live="polite">{paginaAtual} / {paginas}</span>
            <button type="button" className="erp-pagina-btn" aria-label="Próxima página" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight size={16} /></button>
          </div>
        </footer>
      </div>

      <div className="erp-relatorio-impressao">
        <h1>{titulo}</h1><p>Período: {periodoImpressao}</p><p>Emitido em {new Date().toLocaleString("pt-BR")}</p>
        <table><thead><tr>{colunas.map((coluna) => <th key={coluna.chave}>{coluna.rotulo}</th>)}</tr></thead>
          <tbody>{itensRelatorio.map((linha) => <tr key={linha.id}>
            <td>{dataOuTraco(linha.dataLancamento)}</td><td>{linha.documento || "—"}</td><td>{linha.descricao}</td>
            {ehEntrada ? <td>{linha.favorecido || "—"}</td> : <><td>{linha.favorecidoPessoa || "—"}</td><td>{linha.fornecedor || "—"}</td></>}
            <td>{linha.contaBancaria}</td>
            <td>{ROTULOS[statusParaFiltro(linha)] ?? rotuloStatus(statusParaFiltro(linha))}</td><td className="erp-direita">{formatarMoeda(linha.valor)}</td>
          </tr>)}</tbody>
          <tfoot><tr><td colSpan={colunas.length - 1}>{selecionadosVisiveis.length ? "Total selecionado" : "Total listado"} ({itensRelatorio.length} {itensRelatorio.length === 1 ? "item" : "itens"})</td><td className="erp-direita">{formatarMoeda(totalRelatorio)}</td></tr></tfoot>
        </table>
      </div>

      <NovoLancamentoShareDialog aberto={novo} aoFechar={() => setNovo(false)} categorias={categorias}
        aoCriar={() => void recarregar()} somenteDespesa={!ehEntrada} somenteEntrada={ehEntrada} />
      {contaBaixa && ehEntrada && <ModalContaAReceber conta={contaBaixa.raw as ContaAReceber} aberto onFechar={() => setContaBaixa(null)} contasBancarias={contasBancarias}
        onConfirmar={async (dados) => {
          await darBaixaContaAReceber(contaBaixa.id, dados);
          setContaBaixa(null); setSelecionados((atuais) => atuais.filter((item) => item !== contaBaixa.id));
          await recarregar(); toast.success("Baixa registrada.");
        }} />}
      {contaBaixa && !ehEntrada && <ModalContaAPagar conta={contaBaixa.raw as ContaAPagar} aberto onFechar={() => setContaBaixa(null)}
        onConfirmar={async (dados) => {
          const conta = contaBaixa.raw as ContaAPagar;
          if (conta.fonteLancamento) {
            await darBaixaLancamento(contaBaixa.id, {
              dataPagamento: dados.dataPagamento,
              pagoPor: dados.bancoPagamento,
              contaBancariaId: conta.contaBancariaId,
              comprovanteUrl: dados.comprovantePagamentoUrl,
            });
          } else {
            await darBaixaContaAPagar(contaBaixa.id, dados);
          }
          setContaBaixa(null); setSelecionados((atuais) => atuais.filter((item) => item !== contaBaixa.id));
          await recarregar(); toast.success("Baixa registrada.");
        }} />}
    </section>
  );
}

// CSS isolado por prefixo. O componente não depende das cores do tema Tailwind.
const ESTILOS_FINANCEIRO = `
.erp-financeiro {
  --erp-bg: #06080f; --erp-panel: #13191f; --erp-border: #27313b;
  --erp-text: #e7edf6; --erp-muted: #a6b5c9; --erp-blue: #0798ff; --erp-total: #2ed48d;
  --erp-accent: #1f8fd6; --erp-accent-bg: rgba(31, 143, 214, 0.12); --erp-accent-border: rgba(31, 143, 214, 0.25);
  --erp-success: #3fb27f; --erp-success-bg: rgba(63, 178, 127, 0.12); --erp-success-border: rgba(63, 178, 127, 0.25);
  --erp-danger: #f53228e0; --erp-danger-bg: rgba(245, 50, 40, 0.12); --erp-danger-border: rgba(245, 50, 40, 0.25);
  --erp-warning: #eab54b; --erp-warning-bg: rgba(234, 181, 75, 0.12); --erp-warning-border: rgba(234, 181, 75, 0.25);
  --erp-neutral: #9aa8b9; --erp-neutral-bg: rgba(101, 115, 134, 0.14); --erp-neutral-border: rgba(101, 115, 134, 0.3);
  width: 100%; min-width: 0; margin: 12px -11px; padding: 10px 17px 5px 12px; color: var(--erp-text); color-scheme: dark;
  background: radial-gradient(ellipse at 38% 20%, #17202955, transparent 70%), var(--erp-bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px; line-height: 8.2px; border: 1px solid #202a34; border-radius: 14px; -webkit-font-smoothing: antialiased;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}
.erp-financeiro.erp-saida { --erp-total: #fb7185; }
.erp-financeiro *, .erp-financeiro *::before, .erp-financeiro *::after { box-sizing: border-box; }
.erp-financeiro button, .erp-financeiro input, .erp-financeiro select { font: inherit; }
.erp-financeiro button { cursor: pointer; }
.erp-financeiro button:disabled { opacity: .42; cursor: not-allowed; }
.erp-financeiro button:focus-visible, .erp-financeiro a:focus-visible, .erp-financeiro input:focus-visible,
.erp-financeiro select:focus-visible, .erp-financeiro [tabindex]:focus-visible { outline: 2px solid #39aaff; outline-offset: 3px; }
.erp-financeiro .erp-tela { margin: -1px -9px; padding-top: 11px; padding-bottom: 11px; }
.erp-financeiro .erp-cabecalho { display: flex; justify-content: space-between; align-items: flex-end; gap: 4px; margin-top: -15px; padding: 1px 8px 4px; margin-bottom: 5px; }
.erp-financeiro .erp-titulo { margin: 18px 0; padding: 0; }
.erp-financeiro .erp-cabecalho h2 { padding: 0; font-size: 21px; font-weight: 500; }
.erp-financeiro h2 { color: #f5f7fc; margin: 0; font-size: 22px; line-height: 1.25; font-weight: 700; letter-spacing: -.25px; }
.erp-financeiro .erp-cabecalho-acoes { display: flex; align-items: center; gap: 9px; margin: 2px 0; padding-top: 0; padding-bottom: 0; }
.erp-financeiro .erp-resumo { min-width: 116px; margin: 3px; padding: 5px 23px; font-size: 11px; line-height: 16.2px; text-align: right; white-space: nowrap; border: 1px solid #263744; border-radius: 10px; background: linear-gradient(135deg, #11202a, #111820); }
.erp-financeiro .erp-resumo > span { display: block; color: var(--erp-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .55px; margin-bottom: 2px; }
.erp-financeiro .erp-resumo strong { color: var(--erp-total); font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.erp-financeiro .erp-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 9px; margin: -5px auto 9px; padding: 10px 7px; font-size: 12px; line-height: 14.2px; font-weight: 300; border: 1px solid var(--erp-border); border-radius: 11px; background: linear-gradient(145deg, #0d141c, #090d14); }
.erp-financeiro .erp-acoes { display: flex; align-items: center; flex-wrap: wrap; gap: 15px; margin: -7px 0; padding: 1px 5px; line-height: 12.2px; }
.erp-financeiro .erp-btn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 9px; height: 35px; padding: 0 13px; color: var(--erp-text); background: linear-gradient(#17202844, #0c111655); border: 1px solid #34414e; border-radius: 4px; white-space: nowrap; box-shadow: inset 0 1px #ffffff03; transition: background .15s, border-color .15s; }
.erp-financeiro .erp-btn:hover:not(:disabled) { background: #202c37; border-color: #53667a; }
.erp-financeiro .erp-btn > svg { flex-shrink: 0; }
.erp-financeiro .erp-btn-primario { margin: 0 2px; padding: 0 17px; background: rgba(7, 46, 97, 1); border-color: rgba(3, 85, 139, 1); border-width: 1px; box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 0.133); color: #fff; }
.erp-financeiro .erp-btn-primario:hover:not(:disabled) { background: #1aa8ff; border-color: #4dbaff; }
.erp-financeiro .erp-btn-texto { border-color: transparent; background: transparent; box-shadow: none; padding: 0 10px; }
.erp-financeiro .erp-btn-ativo { border-color: #078fe6; background: #078fe61a; }
.erp-financeiro .erp-btn-icone { width: 38px; padding: 0; }
.erp-financeiro .erp-divisor { width: 1px; height: 34px; background: var(--erp-border); margin: 0 2px; }
.erp-financeiro .erp-contador { background: #078fe6; border-radius: 9px; padding: 0 5px; color: white; font-size: 10px; }
.erp-financeiro .erp-periodo { position: relative; display: flex; align-items: center; gap: 10px; margin: 4px 1px; padding: 3px 0; line-height: 11.2px; font-weight: 200; }
.erp-financeiro .erp-periodo > .erp-btn { border-radius: 12px; overflow: hidden; }
.erp-financeiro .erp-navegacao-mes { display: flex; align-items: center; gap: 7px; }
.erp-financeiro .erp-rotulo-periodo { display: block; min-width: 108px; text-align: center; white-space: nowrap; padding: 0 4px; }
.erp-financeiro .erp-seletor-mes { position: absolute; z-index: 30; top: calc(100% + 10px); right: 0; width: 290px; padding: 12px; border: 1px solid #394856; border-radius: 7px; background: #171f28; box-shadow: 0 16px 40px #0008; }
.erp-financeiro .erp-seletor-cabecalho { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.erp-financeiro .erp-meses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.erp-financeiro .erp-meses button { height: 34px; color: var(--erp-muted); border: 1px solid #33404e; border-radius: 4px; background: #10171e; text-transform: capitalize; }
.erp-financeiro .erp-meses button:hover { background: #253344; }
.erp-financeiro .erp-meses button[aria-pressed="true"] { color: #fff; border-color: #169efd; background: #078fe644; }
.erp-financeiro .erp-seletor-rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.erp-financeiro .erp-seletor-rodape > span { color: var(--erp-muted); font-size: 11px; }
.erp-financeiro .erp-seletor-rodape .erp-btn { height: 30px; padding: 0 9px; font-size: 11px; }
.erp-financeiro .erp-filtros { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(2, minmax(140px, 1fr)) auto; gap: 9px; padding: 10px; margin: 7px 0; background: var(--erp-panel); border: 1px solid var(--erp-border); border-radius: 4px; }
.erp-financeiro .erp-filtros label { min-width: 0; }
.erp-financeiro .erp-filtros input, .erp-financeiro .erp-filtros select { width: 100%; height: 35px; background: #0f151c; color: var(--erp-text); border: 1px solid #34414e; border-radius: 4px; padding: 0 10px; }
.erp-financeiro .erp-filtros input::placeholder { color: #8c9bae; }
.erp-financeiro .erp-busca { position: relative; }
.erp-financeiro .erp-busca > svg { position: absolute; top: 10px; left: 11px; color: var(--erp-muted); }
.erp-financeiro .erp-busca input { padding-left: 35px; }
.erp-financeiro .erp-erro { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0; padding: 10px 12px; border: 1px solid #a83b4b; border-radius: 4px; color: #ffb7bf; background: #7b263322; }
.erp-financeiro .erp-tabela-container { overflow-x: auto; border: 1px solid #2b3743; border-radius: 12px; background: #0d131a; box-shadow: 0 8px 24px #0002; scrollbar-color: #3c4b5d #10151a; cursor: grab; }
.erp-financeiro .erp-tabela-container.erp-arrastando, .erp-financeiro .erp-tabela-container.erp-arrastando * { cursor: grabbing !important; user-select: none; }
.erp-financeiro .erp-tabela { width: 100%; min-width: 1260px; border-collapse: separate; border-spacing: 0; table-layout: fixed; text-align: left; color: var(--erp-text); }
.erp-financeiro .erp-tabela-saidas { min-width: 1550px; }
.erp-financeiro .erp-tabela thead { background: linear-gradient(#1a2732, #131c25); }
.erp-financeiro .erp-tabela th { position: relative; height: 42px; padding: 0 16px; border-bottom: 1px solid #344352; border-right: 1px solid #27313b66; font-weight: 600; }
.erp-financeiro .erp-tabela th.erp-th-status { height: 42px; padding: 0 8px; }
.erp-financeiro .erp-tabela th:first-child { padding: 0; }
.erp-financeiro .erp-ordenar { display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%; height: 40px; padding: 0; border: 0; background: transparent; color: #c5d5ea; font-size: 10px; font-weight: 700; letter-spacing: .9px; text-transform: uppercase; text-align: left; }
.erp-financeiro .erp-status-th-conteudo { display: flex; align-items: center; gap: 5px; }
.erp-financeiro .erp-status-th-conteudo .erp-ordenar { flex: 1; }
.erp-financeiro .erp-status-filtro-anchor { position: relative; z-index: 20; flex: 0 0 auto; }
.erp-financeiro .erp-status-filtro-trigger { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: #159dff; cursor: pointer; }
.erp-financeiro .erp-status-filtro-trigger:hover, .erp-financeiro .erp-status-filtro-trigger.erp-status-filtro-ativo { background: #159dff22; color: #49b3ff; }
.erp-financeiro .erp-status-filtro-menu { position: absolute; top: calc(100% + 5px); left: 0; z-index: 50; width: 190px; max-height: 250px; overflow-y: auto; padding: 4px; border: 1px solid #394856; border-radius: 5px; background: #171f28; box-shadow: 0 12px 30px #0009; }
.erp-financeiro .erp-status-filtro-menu button { display: block; width: 100%; min-height: 28px; padding: 5px 8px; border: 0; border-radius: 3px; background: transparent; color: #b7c5d5; font-size: 10px; text-align: left; cursor: pointer; }
.erp-financeiro .erp-status-filtro-menu button:hover, .erp-financeiro .erp-status-filtro-menu button[aria-pressed="true"] { background: #159dff22; color: #61bbff; }
.erp-financeiro .erp-ordenar > svg { color: #a6bbd4; }
.erp-financeiro .erp-redimensionar { position: absolute; right: -3px; top: 0; bottom: 0; z-index: 1; width: 7px; cursor: col-resize; touch-action: none; }
.erp-financeiro .erp-redimensionar:hover { background: #159cff66; }
.erp-financeiro .erp-tabela td { padding: 7px 16px; border-bottom: 1px solid #27313b99; border-right: 1px solid #27313b55; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.erp-financeiro .erp-tabela th:last-child, .erp-financeiro .erp-tabela td:last-child { border-right: 0; }
.erp-financeiro .erp-linha { height: 48px; cursor: pointer; background: #10171e; transition: background .15s ease; }
.erp-financeiro .erp-linha:nth-child(even) { background: #131b23; }
.erp-financeiro .erp-linha:hover { background: #1b2935; }
.erp-financeiro .erp-linha.erp-linha-selecionada, .erp-financeiro .erp-linha.erp-linha-aberta { background: #27313c88; }
.erp-financeiro .erp-descricao-cabecalho { display: flex; align-items: center; min-width: 0; gap: 8px; }
.erp-financeiro .erp-descricao { display: block; min-width: 0; flex: 1; font-size: 13px; line-height: 17px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; }
.erp-financeiro .erp-texto-secundario { display: block; margin-top: 7px; margin-bottom: 7px; color: var(--erp-muted); font-size: 12px; line-height: 15px; overflow: hidden; text-overflow: ellipsis; }
.erp-financeiro .erp-tabela .erp-documento { color: #b3c2d8; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.erp-financeiro .erp-celula-selecao { display: flex; align-items: center; justify-content: space-between; gap: 13px; }
.erp-financeiro .erp-tabela td:first-child { padding-left: 8px; padding-right: 16px; }
.erp-financeiro .erp-tabela td.erp-td-data { padding-top: 13px; padding-bottom: 13px; }
.erp-financeiro .erp-selecao-cabecalho { justify-content: flex-end; padding-right: 16px; margin-left: 40px; margin-right: 40px; }
.erp-financeiro .erp-tabela thead th { margin-left: 0; margin-right: 0; }
.erp-financeiro .erp-tabela col:first-child { margin-left: -5px; margin-right: -5px; padding-left: 0; padding-right: 0; min-height: 0; font-size: 11px; line-height: 8.2px; font-weight: 300; }
.erp-financeiro .erp-expandir { display: flex; align-items: center; justify-content: center; width: 20px; height: 27px; flex-shrink: 0; padding: 0; border: 0; color: #d6e2ee; background: transparent; }
.erp-financeiro .erp-expandir svg { transition: transform .15s; }
.erp-financeiro .erp-expandir[aria-expanded="true"] svg { transform: rotate(90deg); }
.erp-financeiro .erp-checkbox { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; flex-shrink: 0; cursor: pointer; }
.erp-financeiro .erp-checkbox input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.erp-financeiro .erp-checkbox > span { display: flex; align-items: center; justify-content: center; width: 17px; height: 17px; border: 1px solid #9cafc5; border-radius: 3px; color: transparent; background: #10151a; box-shadow: 0 1px 2px #0009, inset 0 0 0 2px #ffffff04; }
.erp-financeiro .erp-checkbox input:checked + span, .erp-financeiro .erp-checkbox input:indeterminate + span { color: #fff; border-color: #0798ff; background: linear-gradient(#06a4ff, #0787e8); }
.erp-financeiro .erp-checkbox input:focus-visible + span { outline: 2px solid #5ebdff; outline-offset: 3px; }
.erp-financeiro .erp-checkbox input:disabled + span { opacity: .4; }
.erp-financeiro .erp-checkbox-traco { width: 9px; height: 2px; background: currentColor; }
.erp-financeiro .erp-status { display: inline-flex; justify-content: center; align-items: center; min-width: 71px; max-width: 100%; min-height: 24px; border: 1px solid transparent; border-radius: 4px; padding: 2px 9px; font-size: 11px; font-weight: 700; line-height: 16px; }
.erp-financeiro .erp-status-sucesso { color: var(--erp-success); background: var(--erp-success-bg); border-color: var(--erp-success-border); }
.erp-financeiro .erp-status-pendente { color: var(--erp-warning); background: var(--erp-warning-bg); border-color: var(--erp-warning-border); }
.erp-financeiro .erp-status-atrasado { color: var(--erp-danger); background: var(--erp-danger-bg); border-color: var(--erp-danger-border); }
.erp-financeiro .erp-status-aguardando { color: var(--erp-accent); background: var(--erp-accent-bg); border-color: var(--erp-accent-border); }
.erp-financeiro .erp-status-cancelado { color: var(--erp-neutral); background: var(--erp-neutral-bg); border-color: var(--erp-neutral-border); }
.erp-financeiro .erp-valor { text-align: right; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.erp-financeiro .erp-linha-detalhes > td { padding: 0 !important; white-space: normal; background: #0e151c; }
.erp-financeiro .erp-detalhes { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(360px, 1.6fr); gap: 12px; margin: -10px -14px; padding: 14px 18px 19px 6px; border-top: 1px solid #263542; }
.erp-financeiro .erp-detalhes-campos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 12px; min-width: 0; margin: 0 22px; padding: 14px 31px; border: 1px solid #273744; border-radius: 10px; background: #121b24; }
.erp-financeiro .erp-detalhes-campos > div { min-width: 0; }
.erp-financeiro .erp-detalhes dt { margin-bottom: 3px; color: var(--erp-muted); font-size: 11px; line-height: 16px; }
.erp-financeiro .erp-detalhes dd { margin: 0; color: var(--erp-text); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.erp-financeiro .erp-observacoes { white-space: pre-wrap; }
.erp-financeiro .erp-anexos { min-width: 0; margin: 0 -17px; padding: 10px 22px; border: 1px solid #273744; border-radius: 10px; background: #121b24; }
.erp-financeiro .erp-anexos-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: #e7edf6; font-size: 12px; }
.erp-financeiro .erp-anexos-cabecalho span { color: var(--erp-muted); font-size: 10px; }
.erp-financeiro .erp-anexos-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 9px; }
.erp-financeiro .erp-anexo-card { min-width: 0; overflow: hidden; border: 1px solid #2a3946; border-radius: 9px; background: #0d151d; transition: border-color .15s, transform .15s; }
.erp-financeiro .erp-anexo-card:hover { border-color: #2787bc; transform: translateY(-1px); }
.erp-financeiro .erp-anexo-link, .erp-financeiro .erp-anexo-indisponivel { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; height: 54px; margin: 2px 0; padding: 5px 12px; border: 0; background: transparent; color: #7acaff; font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.erp-financeiro .erp-anexo-link svg, .erp-financeiro .erp-anexo-indisponivel svg { flex: 0 0 auto; }
.erp-financeiro .erp-anexo-indisponivel { color: #91a4b8; cursor: default; }
.erp-financeiro .erp-anexo-nome { min-width: 0; overflow: hidden; color: #e7edf6; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.erp-financeiro .erp-th-arrastada { opacity: .45; }
.erp-financeiro .erp-ordenar[draggable="true"] { cursor: grab; }
.erp-financeiro .erp-anexo-tentar { display: inline-flex; padding: 0; border: 0; color: #80cfff; background: transparent; }
.erp-financeiro .erp-anexos-vazio { margin: 0; padding: 10px 2px 2px; color: var(--erp-muted); font-size: 11px; }
.erp-financeiro .erp-tabela td.erp-td-acoes { overflow: visible; }
.erp-financeiro .erp-menu-linha { position: relative; display: flex; align-items: center; }
.erp-financeiro .erp-botao-menu { display: flex; align-items: center; justify-content: center; width: 24px; height: 27px; padding: 0; border: 0; border-radius: 3px; color: #d6e2ee; background: transparent; }
.erp-financeiro .erp-botao-menu:hover { background: #27313c; }
.erp-financeiro .erp-menu-acoes { position: absolute; top: calc(100% + 4px); left: 0; z-index: 40; min-width: 140px; padding: 4px; border: 1px solid #394856; border-radius: 5px; background: #171f28; box-shadow: 0 12px 30px #0009; }
.erp-financeiro .erp-menu-acoes button { display: block; width: 100%; padding: 6px 10px; border: 0; border-radius: 3px; background: transparent; color: #d6e2ee; font-size: 12px; text-align: left; white-space: nowrap; }
.erp-financeiro .erp-menu-acoes button:hover:not(:disabled) { background: #159dff22; color: #61bbff; }
.erp-financeiro .erp-menu-acoes button.erp-menu-excluir:hover:not(:disabled) { background: #ff535922; color: #ff7b84; }
.erp-financeiro .erp-tabela tfoot { background: #18202988; }
.erp-financeiro .erp-tabela tfoot td { height: 25px; padding: 3px 10px; border-bottom: 0; border-top: 1px solid var(--erp-border); font-size: 11px; font-weight: 700; letter-spacing: .2px; }
.erp-financeiro .erp-tabela tfoot .erp-total-rodape { color: var(--erp-total); text-align: right; padding-right: 16px; font-size: 14px; font-variant-numeric: tabular-nums; }
.erp-financeiro .erp-tabela .erp-estado { text-align: center; padding: 45px 16px; color: var(--erp-muted); }
.erp-financeiro .erp-estado > svg { display: inline-block; vertical-align: middle; margin-right: 8px; }
.erp-financeiro .erp-rodape { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 8px 9px; padding-top: 9px; color: #b5c3d8; font-size: 11px; font-weight: 300; }
.erp-financeiro .erp-rodape-info, .erp-financeiro .erp-paginacao { display: flex; align-items: center; gap: 12px; }
.erp-financeiro .erp-rodape-info { margin: 5px -3px; padding: 2px 11px; font-size: 11px; font-weight: 300; line-height: 16px; }
.erp-financeiro .erp-barra { color: #7c8b9d; }
.erp-financeiro .erp-por-pagina { position: relative; display: inline-flex; align-items: center; padding-top: 0; padding-bottom: 0; font-size: 9px; font-weight: 300; }
.erp-financeiro .erp-por-pagina select { appearance: none; border: 0; border-radius: 3px; padding: 3px 17px 3px 0; background: transparent; color: #b5c3d8; cursor: pointer; }
.erp-financeiro select option { color: var(--erp-text); background: #16202a; }
.erp-financeiro .erp-por-pagina > svg { position: absolute; right: 0; pointer-events: none; }
.erp-financeiro .erp-paginacao { gap: 9px; }
.erp-financeiro .erp-paginacao > span:first-child { color: #91a3ba; font-size: 11px; margin-right: 5px; }
.erp-financeiro .erp-pagina-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 23px; padding: 0; border: 0; background: transparent; color: #b7c8dc; }
.erp-financeiro .erp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.erp-financeiro .erp-relatorio-impressao { display: none; }
.erp-financeiro .erp-girando { animation: erp-girar 1s linear infinite; }
@keyframes erp-girar { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .erp-financeiro *, .erp-financeiro *::before, .erp-financeiro *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition: none !important; } }
@media (max-width: 1100px) {
  .erp-financeiro .erp-toolbar { gap: 8px; }
  .erp-financeiro .erp-periodo { margin-left: 0; }
  .erp-financeiro .erp-filtros { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .erp-financeiro .erp-detalhes { grid-template-columns: minmax(180px, .8fr) minmax(0, 1.4fr); padding-left: 6px; }
}
@media (max-width: 600px) {
  .erp-financeiro { padding: 10px 8px; }
  .erp-financeiro .erp-cabecalho { padding: 0; align-items: center; }
  .erp-financeiro h2 { font-size: 19px; }
  .erp-financeiro .erp-resumo strong { font-size: 16px; }
  .erp-financeiro .erp-acoes { gap: 7px; }
  .erp-financeiro .erp-divisor { display: none; }
  .erp-financeiro .erp-btn { padding: 0 10px; font-size: 12px; gap: 6px; }
  .erp-financeiro .erp-btn-icone { width: 32px; padding: 0; }
  .erp-financeiro .erp-periodo { width: 100%; justify-content: space-between; gap: 5px; }
  .erp-financeiro .erp-navegacao-mes { gap: 3px; }
  .erp-financeiro .erp-rotulo-periodo { min-width: 105px; font-size: 12px; }
  .erp-financeiro .erp-filtros { grid-template-columns: minmax(0, 1fr); }
  .erp-financeiro .erp-detalhes { grid-template-columns: minmax(0, 1fr); padding: 12px; }
  .erp-financeiro .erp-detalhes-campos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .erp-financeiro .erp-rodape { font-size: 11px; }
  .erp-financeiro .erp-rodape-info { gap: 7px; flex-wrap: wrap; }
  .erp-financeiro .erp-paginacao { margin-left: auto; }
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
