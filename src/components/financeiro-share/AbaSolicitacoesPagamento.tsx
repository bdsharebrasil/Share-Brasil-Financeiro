import { Fragment, useCallback, useEffect, useMemo, useState, useRef, useId, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, FileText, MoreVertical, Pencil, RefreshCw, Search, TriangleAlert, X, Download } from "lucide-react";
import { toast } from "sonner";
import { anexosFinanceiros } from "@/lib/documentos-financeiros";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  buscarContasBancariasHolding,
  buscarSolicitacoesPagamento,
  darBaixaContaAPagar,
  darBaixaPagamentoShare,
  carregarDocumentoFinanceiro,
  formatarData,
  formatarMoeda,
  buscarOpcoesFinanceiroShare,
  type CamposLancamento,
  type ContaBancaria,
  type ReembolsoColaborador,
  type SolicitacaoPagamento,
} from "@/lib/financeiro-share-api";
import { buscarAeronavesShare } from "@/lib/colaborador-api";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { ControleZoomTabela, useZoomTabela } from "./ControleZoomTabela";
import { NovoLancamentoShareDialog, type LancamentoEdicao } from "./NovoLancamentoShareDialog";
import type { ContaAPagar, StatusContaFinanceira } from "./tipos";
import { createPortal } from "react-dom";

const POR_PAGINA = 12;
const LARGURAS_COLUNAS = [100, 124, 210, 260, 118, 124, 128];
const LARGURA_MINIMA_COLUNA = 60;

type AbaSolicitacao = "cotista" | "colaborador";
type FiltroLista = { id: string; label: string; quantidade?: number };
type AcaoLinha = { rotulo: ReactNode; aoClicar: () => void; desabilitada?: boolean; titulo?: string };
type LinhaExibida = {
  chave: string;
  expandida: boolean;
  documento: string;
  dataEmissao: string;
  vencimento: string;
  cliente?: string;
  colaborador?: string;
  principal: string;
  secundaria: string;
  valor: string;
  status: string;
  acoes: AcaoLinha[];
  detalhe: ReactNode;
};

function statusLegivel(valor: string): string {
  const estado = valor.toUpperCase();
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    EMAIL_ENVIADO: "Enviado",
    CONVERTIDO: "Em aberto",
    PAGO: "Pago",
    RECEBIDO: "Recebido",
    REEMBOLSADO: "Reembolsado",
    ATRASADO: "Atrasado",
    EM_ATRASO: "Em atraso",
    CANCELADO: "Cancelado",
    EM_ABERTO: "Em aberto",
    AGUARDANDO_REEMBOLSO: "Aguardando reembolso",
  };
  return labels[estado] ?? estado.replace(/_/g, " ");
}

function tomStatus(valor: string): string {
  const estado = valor.toUpperCase();
  if (["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(estado)) return "sucesso";
  if (["ATRASADO", "EM_ATRASO"].includes(estado)) return "atrasado";
  if (["CANCELADO", "REJEITADO"].includes(estado)) return "cancelado";
  if (["EM_ABERTO", "CONVERTIDO", "AGUARDANDO_REEMBOLSO", "APROVADO", "EMAIL_ENVIADO"].includes(estado)) return "aguardando";
  return "pendente";
}

function atendeFiltroCaixaCliente(filtro: string, status: string): boolean {
  const estado = status.toUpperCase();
  if (filtro === "TODOS") return true;
  if (filtro === "ABERTOS") return ["EM_ABERTO", "PENDENTE", "ATRASADO", "EM_ATRASO", "AGUARDANDO_REEMBOLSO"].includes(estado);
  if (filtro === "PAGOS") return ["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(estado);
  return estado === "CANCELADO";
}

function StatusSolicitacao({ status }: { status: string }) {
  return <span className={`erp-status erp-status-${tomStatus(status)}`}>{statusLegivel(status)}</span>;
}

function dataLegivel(valor: string | null): string {
  return valor ? formatarData(valor) : "—";
}

function textoBusca(...valores: Array<string | null | undefined>): string {
  return valores.filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}

function naoPago(status: string): boolean {
  return status.toUpperCase() !== "PAGO";
}

function pendentePagamento(item: SolicitacaoPagamento | ReembolsoColaborador): boolean {
  const status = item.status.toUpperCase();
  if (["PAGO", "RECEBIDO", "REEMBOLSADO", "CANCELADO", "REJEITADO", "CONCLUIDO"].includes(status)) return false;
  const contaStatus = "conta_a_pagar_status" in item ? (item.conta_a_pagar_status ?? "").toUpperCase() : "";
  return !["PAGO", "RECEBIDO", "REEMBOLSADO", "CANCELADO", "CONCLUIDO"].includes(contaStatus);
}

function primeiroTexto(...valores: Array<string | null | undefined>): string | null {
  return valores.find((valor) => valor && valor.trim() !== "") ?? null;
}

function detalheLancamento(campos: CamposLancamento, abrirDocumento: (documento: DocumentoAberto) => void, acao?: ReactNode): ReactNode {
  const anexos = anexosFinanceiros(campos);
  const fornecedor = campos.lancamento_fornecedor_nome ?? campos.fornecedor_nome ?? campos.fornecedor;
  const categoria = campos.lancamento_categoria_nome ?? campos.categoria_nome;
  return <div className="nf-detail">
    <section>
      <h3>Documentos anexos</h3>
      {anexos.length > 0
        ? anexos.map(({ nome: rotulo, url }) => <button type="button" className="nf-attachment" key={url} onClick={() => abrirDocumento({ titulo: rotulo, url })}><FileText size={16} />{rotulo}<ChevronRight size={14} /></button>)
        : <p><FileText size={13} /> Nenhum documento anexado.</p>}
    </section>
    <section>
      <h3>Mais informações</h3>
      <dl>
        {campos.descricao && <div><dt>Descrição</dt><dd>{campos.descricao}</dd></div>}
        {campos.cliente_razao_social && <div><dt>Cliente</dt><dd>{campos.cliente_razao_social}</dd></div>}
        {campos.aeronave_matricula && <div><dt>Aeronave</dt><dd>{campos.aeronave_matricula}</dd></div>}
        {categoria && <div><dt>Categoria</dt><dd>{categoria}</dd></div>}
        {campos.grupo_categoria && <div><dt>Grupo</dt><dd>{campos.grupo_categoria}</dd></div>}
        {fornecedor && <div><dt>Fornecedor</dt><dd>{fornecedor}</dd></div>}
        {campos.data_emissao && <div><dt>Emissão</dt><dd>{dataLegivel(campos.data_emissao)}</dd></div>}
        {campos.data_vencimento && <div><dt>Vencimento</dt><dd>{dataLegivel(campos.data_vencimento)}</dd></div>}
        {campos.data_pagamento && <div><dt>Pagamento</dt><dd>{dataLegivel(campos.data_pagamento)}</dd></div>}
        {campos.pago_por && <div><dt>Pago por</dt><dd>{campos.pago_por}</dd></div>}
        {campos.reembolso_quitado != null && <div><dt>Reembolso quitado</dt><dd>{Number(campos.reembolso_quitado) === 1 ? "Sim" : "Não"}</dd></div>}
        {campos.observacoes && <div><dt>Observações</dt><dd>{campos.observacoes}</dd></div>}
        {campos.numero_boleto && <div><dt>Número do boleto</dt><dd>{campos.numero_boleto}</dd></div>}
        <div><dt>E-mail enviado em</dt><dd>{dataLegivel(campos.email_enviado_em ?? null)}</dd></div>
        <div><dt>Número do voo</dt><dd>{campos.numero_voo_exibicao || campos.numero_voo || "—"}</dd></div>
      </dl>
    </section>
    {acao && <div className="nf-detail-actions">{acao}</div>}
  </div>;
}

const FILTROS_CAIXA_CLIENTE: FiltroLista[] = [
  { id: "TODOS", label: "Todos" },
  { id: "ABERTOS", label: "Em aberto" },
  { id: "PAGOS", label: "Pagos / reembolsados" },
  { id: "CANCELADOS", label: "Cancelados" },
];

function contaDoReembolso(item: ReembolsoColaborador): ContaAPagar {
  return {
    id: item.id,
    dataEmissao: item.dataEmissao ?? null,
    dataVencimento: item.dataVencimento,
    valor: item.valor,
    categoriaId: null,
    categoriaNome: item.categoriaNome ?? null,
    descricao: item.descricao,
    criadoPor: null,
    aeronaveId: item.aeronaveId,
    fornecedor: item.fornecedor ?? null,
    fornecedorId: item.fornecedorId,
    cotistaId: null,
    cotistaNome: item.cotistaNome,
    boletoUrl: null,
    nfUrl: null,
    dataPagamento: null,
    bancoPagamento: null,
    comprovantePagamentoUrl: null,
    documento: item.documento ?? null,
    documentoUrl: item.documentoUrl ?? null,
    lancamentoId: item.lancamentoId,
    status: item.status as StatusContaFinanceira,
    criadoEm: item.dataVencimento,
    atualizadoEm: item.dataVencimento,
  };
}

function contaDaSolicitacao(item: SolicitacaoPagamento, id: string): ContaAPagar {
  return {
    id,
    dataEmissao: item.data_emissao ?? item.data_despesa,
    dataVencimento: item.data_vencimento ?? item.vencimento ?? "",
    valor: item.valor_centavos != null ? item.valor_centavos / 100 : Number(item.valor ?? 0),
    categoriaId: null,
    categoriaNome: item.lancamento_categoria_nome ?? item.categoria_nome ?? null,
    descricao: item.descricao,
    criadoPor: item.criado_por,
    aeronaveId: item.aeronave_id ?? null,
    fornecedor: item.lancamento_fornecedor_nome ?? item.fornecedor_nome ?? item.fornecedor ?? null,
    fornecedorId: item.fornecedor_id ?? null,
    cotistaId: item.cotista_aeronave_id ?? null,
    boletoUrl: item.url_boleto ?? null,
    nfUrl: item.url_nf ?? null,
    dataPagamento: item.data_pagamento ?? null,
    bancoPagamento: null,
    comprovantePagamentoUrl: item.comprovante_url ?? null,
    documento: null,
    documentoUrl: item.documentoUrl ?? item.url_doc ?? null,
    fonteLancamento: !item.conta_a_pagar_id,
    lancamentoId: item.lancamento_id ?? null,
    status: (item.conta_a_pagar_status ?? item.status) as StatusContaFinanceira,
    criadoEm: item.criado_em,
    atualizadoEm: item.criado_em,
  };
}

export function AbaSolicitacoesPagamento({ contasBancarias, aoAlterarQuantidade }: { contasBancarias: ContaBancaria[]; aoAlterarQuantidade?: (quantidade: number) => void }) {
  const [documentoAberto, setDocumentoAberto] = useState<DocumentoAberto | null>(null);
  const [envios, setEnvios] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaSolicitacao>("cotista");
  const [alvo, setAlvo] = useState<ReembolsoColaborador | null>(null);
  const [contaBaixa, setContaBaixa] = useState<ContaAPagar | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroEnvio, setFiltroEnvio] = useState("TODOS");
  const [filtroReembolso, setFiltroReembolso] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [contasParaPagamento, setContasParaPagamento] = useState<ContaBancaria[]>(contasBancarias);
  const [matriculasAeronaves, setMatriculasAeronaves] = useState<Record<string, string>>({});
  const [opcoes, setOpcoes] = useState<{ categorias: any[]; fornecedores: Array<{ id: string; nome: string; cidade?: string | null; origem: string }> }>({ categorias: [], fornecedores: [] });
  const [lancamentoEditando, setLancamentoEditando] = useState<LancamentoEdicao | null>(null);
  const tabelaRef = useRef<HTMLDivElement>(null);
  const { zoom, alterar: alterarZoom, definir: definirZoom } = useZoomTabela("nf-solicitacoes-zoom");
  const [larguras, setLarguras] = useState<number[]>(LARGURAS_COLUNAS);
  const pararResizeRef = useRef<(() => void) | null>(null);
  useEffect(() => () => pararResizeRef.current?.(), []);
  const arrasteRef = useRef<{ x: number; scrollLeft: number; id: number } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [dados, aeronavesAtivas, aeronavesInativas] = await Promise.all([
        buscarSolicitacoesPagamento(),
        buscarAeronavesShare("ativa").catch(() => ({ aeronaves: [] })),
        buscarAeronavesShare("inativa").catch(() => ({ aeronaves: [] })),
      ]);
      const enviosPendentes = dados.envios.filter((item) => naoPago(item.status));
      const reembolsosPendentes = dados.reembolsos.filter((item) => naoPago(item.status));
      setEnvios(enviosPendentes);
      setReembolsos(reembolsosPendentes);
      aoAlterarQuantidade?.([
        ...enviosPendentes.filter(pendentePagamento),
        ...reembolsosPendentes.filter(pendentePagamento),
      ].length);
      setMatriculasAeronaves(
        Object.fromEntries(
          [...aeronavesAtivas.aeronaves, ...aeronavesInativas.aeronaves].map((aeronave) => [
            aeronave.id,
            aeronave.matricula_registro,
          ]),
        ),
      );
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as solicitações de pagamento.");
    } finally {
      setCarregando(false);
    }
  }, [aoAlterarQuantidade]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { void buscarOpcoesFinanceiroShare().then((dados) => setOpcoes({ categorias: dados.categorias, fornecedores: dados.fornecedores ?? [] })).catch(() => undefined); }, []);

  function iniciarArraste(evento: React.PointerEvent<HTMLDivElement>) {
    if (!evento.isPrimary || evento.button !== 0 || evento.pointerType === "touch") return;
    if (evento.target instanceof Element && evento.target.closest("button, a, input, select, textarea")) return;
    const container = evento.currentTarget;
    arrasteRef.current = { x: evento.clientX, scrollLeft: container.scrollLeft, id: evento.pointerId };
    const mover = (movimento: PointerEvent) => { if (arrasteRef.current?.id === movimento.pointerId) container.scrollLeft = arrasteRef.current.scrollLeft - (movimento.clientX - arrasteRef.current.x); };
    const parar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", parar); arrasteRef.current = null; };
    window.addEventListener("pointermove", mover); window.addEventListener("pointerup", parar);
  }

  function iniciarResize(evento: React.PointerEvent<HTMLSpanElement>, indice: number) {
    evento.preventDefault();
    evento.stopPropagation();
    pararResizeRef.current?.();
    const inicioX = evento.clientX;
    const larguraInicial = larguras[indice];
    const escala = zoom / 100;
    const mover = (movimento: PointerEvent) => {
      const nova = Math.max(LARGURA_MINIMA_COLUNA, larguraInicial + (movimento.clientX - inicioX) / escala);
      setLarguras((atuais) => atuais.map((largura, i) => (i === indice ? Math.round(nova) : largura)));
    };
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

  function editarSolicitacao(item: SolicitacaoPagamento | ReembolsoColaborador) {
    const raw = item as unknown as Record<string, unknown>;
    const texto = (...chaves: string[]) => chaves.map((chave) => raw[chave]).find((valor) => valor != null && String(valor).trim() !== "") as string | undefined;
    const id = String(texto("lancamento_id", "lancamentoId", "id") ?? "");
    if (!id) return toast.error("Este registro não possui lançamento editável.");
    const valorCentavos = raw.valor_centavos != null ? Number(raw.valor_centavos) : Math.round(Number(raw.valor ?? 0) * 100);
    setLancamentoEditando({ id, descricao: texto("descricao"), fluxo: "SAIDA", categoriaId: texto("categoria_id"), categoria: texto("categoria_nome", "lancamento_categoria_nome"), grupoCategoria: texto("grupo_categoria"), valorCentavos, data: texto("data_emissao", "dataEmissao", "data_despesa"), prazo: texto("data_vencimento", "dataVencimento", "vencimento"), fornecedorId: texto("fornecedor_id", "fornecedorId"), fornecedor: texto("lancamento_fornecedor_nome", "fornecedor_nome", "fornecedor"), numeroDoc: texto("numero_doc", "documento"), observacoes: texto("observacoes") });
  }

  useEffect(() => {
    let ativo = true;
    if (!alvo || String(alvo.tipoCaixa).toUpperCase() !== "HOLDING") {
      setContasParaPagamento(contasBancarias);
      return () => { ativo = false; };
    }
    void buscarContasBancariasHolding()
      .then((contas) => {
        if (ativo) setContasParaPagamento(contas.filter((conta) => !alvo.holdingId || conta.holding_id === alvo.holdingId));
      })
      .catch(() => { if (ativo) setContasParaPagamento([]); });
    return () => { ativo = false; };
  }, [alvo, contasBancarias]);

  function abrirBaixa(item: ReembolsoColaborador) {
    setAlvo(item);
    setContaBaixa(contaDoReembolso(item));
  }

  function abrirBaixaCliente(item: SolicitacaoPagamento) {
    setAlvo(null);
    setContasParaPagamento(contasBancarias);
    setContaBaixa(contaDaSolicitacao(item, item.conta_a_pagar_id || item.lancamento_id || item.id));
  }

  function fecharBaixa() {
    setAlvo(null);
    setContaBaixa(null);
  }

  function trocarAba(novaAba: AbaSolicitacao) {
    setAba(novaAba);
    setBusca("");
    setExpandido(null);
    setPagina(1);
  }

  function alterarBusca(valor: string) {
    setBusca(valor);
    setPagina(1);
  }

  function alterarFiltro(valor: string) {
    if (aba === "cotista") setFiltroEnvio(valor);
    else setFiltroReembolso(valor);
    setPagina(1);
  }

  function limparFiltros() {
    setBusca("");
    alterarFiltro("TODOS");
  }

  function alternarDetalhe(chave: string) {
    setExpandido(expandido === chave ? null : chave);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const rotuloAeronave = useCallback(
    (id?: string | null, matricula?: string | null) =>
      (id ? matriculasAeronaves[id]?.trim() : null) || matricula?.trim() || null,
    [matriculasAeronaves],
  );

  const enviosFiltrados = useMemo(() => envios.filter((item) => {
    const atendeFiltro = atendeFiltroCaixaCliente(filtroEnvio, item.status);
    return atendeFiltro && (!busca || textoBusca(item.id, item.descricao, item.cliente_razao_social, item.lancamento_categoria_nome, item.grupo_categoria, item.lancamento_fornecedor_nome, item.fornecedor_nome, item.fornecedor, item.solicitante_nome, rotuloAeronave(item.aeronave_id, item.matricula_registro ?? item.aeronave_matricula)).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [envios, filtroEnvio, busca, rotuloAeronave]);

  const reembolsosFiltrados = useMemo(() => reembolsos.filter((item) => {
    const vencido = item.dataVencimento.slice(0, 10) < hoje;
    const atendeFiltro = filtroReembolso === "TODOS" || (filtroReembolso === "VENCIDOS" && vencido);
    return atendeFiltro && (!busca || textoBusca(item.id, item.documento, item.descricao, item.fornecedor, item.numeroVoo, item.cotistaNome, item.solicitanteNome, item.aeronaveId, rotuloAeronave(item.aeronaveId, item.matricula_registro ?? item.aeronave_matricula)).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [reembolsos, filtroReembolso, busca, hoje, rotuloAeronave]);

  const opcoesEnvio: FiltroLista[] = useMemo(() => FILTROS_CAIXA_CLIENTE.map((filtro) => ({
    ...filtro,
    quantidade: envios.filter((item) => atendeFiltroCaixaCliente(filtro.id, item.status)).length,
  })), [envios]);

  const reembolsosVencidos = reembolsos.filter((item) => item.dataVencimento.slice(0, 10) < hoje);
  const opcoesReembolso: FiltroLista[] = [
    { id: "TODOS", label: "Todos", quantidade: reembolsos.length },
    { id: "VENCIDOS", label: "Vencidos", quantidade: reembolsosVencidos.length },
  ];

  const filtrosAtuais = aba === "cotista" ? opcoesEnvio : opcoesReembolso;
  const filtroAtual = aba === "cotista" ? filtroEnvio : filtroReembolso;
  const placeholderBusca = aba === "cotista" ? "Buscar lançamento, cliente ou fornecedor" : "Buscar documento, descrição, fornecedor, voo ou cotista";
  const temFiltro = busca !== "" || filtroAtual !== "TODOS";
  const totalItens = aba === "cotista" ? enviosFiltrados.length : reembolsosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;

  const enviosVisiveis = enviosFiltrados.slice(inicio, inicio + POR_PAGINA);
  const reembolsosVisiveis = reembolsosFiltrados.slice(inicio, inicio + POR_PAGINA);

  const linhasEnvio: LinhaExibida[] = enviosVisiveis.map((item) => {
    const chave = `envio:${item.id}`;
    const expandida = expandido === chave;
    const aeronave = rotuloAeronave(item.aeronave_id, item.matricula_registro ?? item.aeronave_matricula);
    const baixaDisponivel = !["PAGO", "CANCELADO"].includes(item.status.toUpperCase())
      && !["PAGO", "CANCELADO"].includes((item.conta_a_pagar_status ?? "").toUpperCase());
    return {
      chave,
      expandida,
      documento: primeiroTexto(item.numero_nf, item.numero_recibo, item.numero_doc, item.numero_demonstrativo) ?? "—",
      dataEmissao: dataLegivel(item.data_emissao ?? item.data_despesa),
      vencimento: dataLegivel(item.data_vencimento ?? item.vencimento ?? null),
      cliente: primeiroTexto(item.cliente_razao_social, item.cliente_nome, item.razao_social, item.socio_nome, item.hold_socios_nome, item.hold_socios?.nome, item.cotista_nome, item.holding_nome) ?? "—",
      principal: aeronave ?? "—",
      secundaria: item.descricao ?? "",
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : Number(item.valor ?? 0))}`,
      status: item.status,
      acoes: [
        { rotulo: <><Pencil size={14} /> Editar</>, aoClicar: () => editarSolicitacao(item) },
        ...(baixaDisponivel ? [{ rotulo: "Dar baixa", aoClicar: () => abrirBaixaCliente(item) }] : []),
      ],
      detalhe: expandida ? detalheLancamento(item, setDocumentoAberto) : null,
    };
  });

  const linhasReembolso: LinhaExibida[] = reembolsosVisiveis.map((item) => {
    const chave = `reembolso:${item.id}`;
    const expandida = expandido === chave;
    return {
      chave,
      expandida,
      documento: primeiroTexto(item.numero_nf, item.numero_recibo, item.numero_doc, item.numero_demonstrativo, item.documento) ?? "—",
      dataEmissao: dataLegivel(item.data_emissao ?? item.dataEmissao ?? null),
      vencimento: dataLegivel(item.dataVencimento),
      colaborador: primeiroTexto(item.user_profiles?.nome_completo, item.nome_completo, item.solicitanteNome) ?? "—",
      principal: rotuloAeronave(item.aeronave_id ?? item.aeronaveId, item.matricula_registro ?? item.aeronave_matricula) ?? "—",
      secundaria: item.descricao ?? "",
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : item.valor)}`,
      status: item.status,
      acoes: [
        { rotulo: <><Pencil size={14} /> Editar</>, aoClicar: () => editarSolicitacao(item) },
        { rotulo: "Dar baixa", aoClicar: () => abrirBaixa(item) },
      ],
      detalhe: expandida ? detalheLancamento(item, setDocumentoAberto) : null,
    };
  });

  const linhas = aba === "cotista" ? linhasEnvio : linhasReembolso;

  function celulaAcoes(linha: LinhaExibida, apresentacao: "tabela" | "mobile") {
    const chaveMenu = `${apresentacao}:${linha.chave}`;
    return <DropdownMenu open={menuAberto === chaveMenu} onOpenChange={(aberto) => setMenuAberto(aberto ? chaveMenu : null)} modal={false}>
      <DropdownMenuTrigger asChild><button type="button" className="nf-icon" aria-label={`Ações de ${linha.secundaria || linha.principal}`}><MoreVertical /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {linha.acoes.map((acao, indice) => <DropdownMenuItem key={indice} disabled={acao.desabilitada} title={acao.titulo} onSelect={acao.aoClicar}>{acao.rotulo}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>;
  }

  return (
    <div className="nf-workspace nf-payment-requests">
      <style>{STYLES}</style>
      <header className="nf-header">
        <div><h1>Solicitações de pagamento</h1><p className="nf-subtitle">Gestão de despesas e reembolsos</p></div>
        <div className="nf-header-actions">
          <button className="nf-btn" disabled={carregando} onClick={() => void carregar()}><RefreshCw className={carregando ? "nf-spin" : ""} /> Atualizar</button>
        </div>
      </header>
      <section className="nf-panel" aria-label="Solicitações de pagamento">
        <div className="nf-panel-top">
          <div className="nf-segment" aria-label="Tipo de solicitação">
            {([["cotista", "Caixa cliente", envios.length], ["colaborador", "Reembolso colaborador", reembolsos.length]] as const).map(([valor, rotulo, quantidade]) => <button key={valor} aria-pressed={aba === valor} className={aba === valor ? "active" : ""} onClick={() => trocarAba(valor)}>{rotulo}<span>{quantidade}</span></button>)}
          </div>
        </div>
        <div className="nf-toolbar">
          <label className="nf-search"><Search /><span className="nf-sr">{placeholderBusca}</span><input type="search" value={busca} onChange={(e) => alterarBusca(e.target.value)} placeholder={placeholderBusca} /></label>
          <select aria-label="Filtrar solicitações" value={filtroAtual} onChange={(e) => alterarFiltro(e.target.value)}>{filtrosAtuais.map((filtro) => <option key={filtro.id} value={filtro.id}>{filtro.label}{filtro.quantidade !== undefined ? ` (${filtro.quantidade})` : ""}</option>)}</select>
        </div>
        <div className="nf-list-heading" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2>{aba === "cotista" ? "Caixa cliente" : "Reembolsos de colaboradores"}</h2>
            <p>{carregando ? "Carregando…" : `${totalItens} ${aba === "cotista" ? (totalItens === 1 ? "lançamento" : "lançamentos") : (totalItens === 1 ? "título" : "títulos")} encontrados`}{temFiltro && <button className="nf-text-btn" onClick={limparFiltros}>Limpar filtros</button>}</p>
          </div>
          <ControleZoomTabela zoom={zoom} alterar={alterarZoom} restaurar={() => definirZoom(100)} />
        </div>
        {carregando ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><h3>Carregando solicitações</h3><p>Organizando as informações de pagamento.</p></div>
          : erro ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível carregar</h3><p>{erro}</p><button className="nf-btn" onClick={() => void carregar()}>Tentar novamente</button></div>
          : totalItens === 0 ? <div className="nf-empty"><Search /><h3>{temFiltro ? "Nenhum resultado encontrado" : "Nada por aqui"}</h3><p>{temFiltro ? "Ajuste a busca ou o filtro para encontrar o registro." : aba === "cotista" ? "Não há despesas reembolsáveis no caixa cliente." : "Não há reembolsos pendentes de colaboradores."}</p>{temFiltro && <button className="nf-btn" onClick={limparFiltros}>Limpar filtros</button>}</div>
          : <>
            <div ref={tabelaRef} onPointerDown={iniciarArraste} className="erp-tabela-container nf-table-wrap" role="region" aria-label={aba === "cotista" ? "Lançamentos reembolsáveis de caixa cliente" : "Reembolsos de colaboradores"} tabIndex={0}>
              <table className="erp-tabela" style={{ zoom: zoom / 100 }}>
                <caption className="erp-sr-only">{aba === "cotista" ? "Lançamentos reembolsáveis de caixa cliente" : "Reembolsos de colaboradores"}</caption>
                <colgroup>
                  {larguras.map((largura, indice) => <col key={indice} style={{ width: largura }} />)}
                </colgroup>
                <thead><tr>
                  <th scope="col"><span className="nf-sr">Expandir e ações</span></th>
                  <th scope="col"><span className="erp-ordenar">Doc / emissão</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 1)} /></th>
                  <th scope="col"><span className="erp-ordenar">{aba === "cotista" ? "Cliente" : "Colaborador"}</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 2)} /></th>
                  <th scope="col"><span className="erp-ordenar">Descrição</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 3)} /></th>
                  <th scope="col"><span className="erp-ordenar">Vencimento</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 4)} /></th>
                  <th scope="col"><span className="erp-ordenar">Valor</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 5)} /></th>
                  <th scope="col" className="erp-th-status"><span className="erp-ordenar">Status</span><span className="erp-redimensionar" aria-hidden="true" title="Arraste para ajustar a coluna" onPointerDown={(evento) => iniciarResize(evento, 6)} /></th>
                </tr></thead>
                <tbody>
                  {linhas.map((linha) => <Fragment key={linha.chave}>
                    <tr className={`erp-linha${linha.expandida ? " erp-linha-aberta" : ""}`}>
                      <td className="erp-td-acoes"><div className="erp-celula-selecao"><button type="button" className="erp-expandir" aria-expanded={linha.expandida} aria-label={`${linha.expandida ? "Recolher" : "Expandir"} ${linha.secundaria || linha.principal}`} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}</button>{celulaAcoes(linha, "tabela")}</div></td>
                      <td><span className="erp-documento">{linha.documento}</span><span className="erp-texto-secundario">Emissão {linha.dataEmissao}</span></td>
                      <td>{aba === "cotista" ? linha.cliente : linha.colaborador}</td>
                      <td><div className="erp-descricao-cabecalho"><strong className="erp-descricao" title={linha.secundaria || linha.principal}>{linha.secundaria || linha.principal}</strong></div>{linha.secundaria && <span className="erp-texto-secundario">{linha.principal}</span>}</td>
                      <td className="erp-td-data"><span>{linha.vencimento}</span></td>
                      <td className="erp-valor">{linha.valor}</td>
                      <td><StatusSolicitacao status={linha.status} /></td>
                    </tr>
                    {linha.expandida && <tr className="erp-linha-detalhes"><td colSpan={7}>{linha.detalhe}</td></tr>}
                  </Fragment>)}
                </tbody>
              </table>
            </div>
            <div className="nf-mobile-docs">
              {linhas.map((linha) => <article className={`nf-mobile-doc${linha.expandida ? " expanded" : ""}`} key={linha.chave}>
                <header><span className="nf-doc-icon"><FileText /></span><div><strong>{linha.documento}</strong><small>{linha.dataEmissao}</small></div><StatusSolicitacao status={linha.status} /></header>
                <dl><div><dt>{aba === "cotista" ? "Cliente" : "Colaborador"}</dt><dd>{aba === "cotista" ? linha.cliente : linha.colaborador}</dd></div><div><dt>Descrição</dt><dd>{linha.secundaria || linha.principal}{linha.secundaria && <small>{linha.principal}</small>}</dd></div><div><dt>Vencimento</dt><dd>{linha.vencimento}</dd></div><div><dt>Valor</dt><dd className="nf-amount">{linha.valor}</dd></div></dl>
                <footer>{celulaAcoes(linha, "mobile")}<button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></footer>
                {linha.detalhe}
              </article>)}
            </div>
            <footer className="nf-pagination">
              <span>Exibindo {inicio + 1}–{Math.min(inicio + POR_PAGINA, totalItens)} de {totalItens}</span>
              <div>
                <button className="nf-icon" aria-label="Página anterior" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}><ArrowLeft /></button>
                <span>{paginaAtual} / {totalPaginas}</span>
                <button className="nf-icon" aria-label="Próxima página" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight /></button>
              </div>
            </footer>
          </>}
      </section>

      {documentoAberto && <VisualizadorDocumento documento={documentoAberto} onClose={() => setDocumentoAberto(null)} />}

      {contaBaixa && <ModalContaAPagar
        key={contaBaixa.id}
        conta={contaBaixa}
        aberto
        onFechar={fecharBaixa}
        contasBancarias={contasParaPagamento}
        onConfirmar={async (dados) => {
          if (contaBaixa.fonteLancamento) await darBaixaPagamentoShare(contaBaixa.lancamentoId || contaBaixa.id, dados);
          else await darBaixaContaAPagar(contaBaixa.id, dados);
          toast.success("Baixa registrada.");
          fecharBaixa();
          await carregar();
        }}
      />}
      <NovoLancamentoShareDialog aberto={Boolean(lancamentoEditando)} aoFechar={() => setLancamentoEditando(null)} categorias={opcoes.categorias} fornecedores={opcoes.fornecedores} lancamentoInicial={lancamentoEditando ?? undefined} aoCriar={() => { setLancamentoEditando(null); void carregar(); }} somenteDespesa />
    </div>
  );
}

// Diálogo nativo: foco contido, Escape, retorno do foco e sobreposição à tela.
function Modal({ title, onClose, busy = false, wide = false, children }: {
  title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} className={`nf-payment-dialog${wide ? " wide" : ""}`} aria-labelledby={titleId}
    aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="nf-dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="nf-icon" aria-label="Fechar" disabled={busy} onClick={onClose}><X /></button></header>
    <div className="nf-dialog-content">{children}</div>
  </dialog>, document.body);
}

type DocumentoAberto = { titulo: string; url: string };

function VisualizadorDocumento({ documento, onClose }: { documento: DocumentoAberto; onClose: () => void }) {
  const [arquivo, setArquivo] = useState<{ url: string; tipo: string } | null>(null);
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | null = null;
    let ativo = true;
    setArquivo(null);
    setErroDocumento(null);
    void carregarDocumentoFinanceiro(documento.url, controller.signal).then((blob) => {
      if (!ativo) return;
      const tipo = blob.type.split(";")[0].toLowerCase();
      // HTML/SVG nunca são executados dentro da aplicação.
      if (!["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(tipo)) {
        throw new Error("Formato não compatível com a visualização. O servidor precisa informar o tipo PDF ou imagem do arquivo.");
      }
      blobUrl = URL.createObjectURL(blob);
      setArquivo({ url: blobUrl, tipo });
    }).catch((error: unknown) => {
      if (ativo && !controller.signal.aborted) setErroDocumento(error instanceof Error ? error.message : "Não foi possível carregar o documento.");
    });
    return () => { ativo = false; controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [documento.url]);
  const imagem = arquivo?.tipo.startsWith("image/");
  return <Modal title={documento.titulo} onClose={onClose} wide>
    <div className="nf-preview-toolbar"><span><FileText size={16} />Visualização do documento</span>
      {arquivo && <a className="nf-btn" href={arquivo.url} download={`${documento.titulo}.${arquivo.tipo === "application/pdf" ? "pdf" : arquivo.tipo.split("/")[1]}`}><Download size={16} />Baixar</a>}
    </div>
    {erroDocumento ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível exibir o documento</h3><p>{erroDocumento}</p></div>
      : !arquivo ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><p>Carregando documento…</p></div>
      : <div className="nf-preview">
          {imagem ? <img src={arquivo.url} alt={documento.titulo} onError={() => setErroDocumento("Não foi possível exibir a imagem.")} />
            : <iframe title={documento.titulo} src={arquivo.url} />}
        </div>}
    <footer className="nf-modal-footer"><button type="button" className="nf-btn primary" onClick={onClose}><ArrowLeft size={16} />Voltar à despesa</button></footer>
  </Modal>;
}

const STYLES = `
html .nf-workspace.nf-payment-requests{height:auto;min-height:0;overflow:visible;margin:0;padding:12px}
html .nf-workspace.nf-payment-requests .nf-panel{flex:none;min-height:0;margin:0}
html .nf-workspace.nf-payment-requests .nf-table-wrap{flex:none;max-height:none;overflow:auto}
html .nf-workspace.nf-payment-requests .erp-tabela td.erp-td-acoes{overflow:visible}
html .nf-workspace.nf-payment-requests .erp-tabela th{position:sticky;top:0;z-index:1;background:var(--app-soft)}
html .nf-workspace.nf-payment-requests .nf-icon{width:30px;min-height:30px;height:30px;padding:5px}

.nf-payment-requests,.nf-payment-dialog{--nf-ink: var(--app-text);--nf-muted: var(--app-muted);--nf-border: var(--app-line);--nf-blue: var(--app-info);color:var(--nf-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;color-scheme:var(--app-color-scheme)}
.nf-payment-requests *,.nf-payment-dialog *{box-sizing:border-box}
.nf-payment-requests{container-type:inline-size;width:100%;min-width:0;background:var(--app-soft);margin:-8px -3px;padding:38px 18px;border-radius:18px}
.nf-payment-requests button,.nf-payment-dialog button,.nf-payment-requests input,.nf-payment-dialog input,.nf-payment-requests select,.nf-payment-dialog select,.nf-payment-dialog textarea{font:inherit}
.nf-payment-requests button,.nf-payment-dialog button{cursor:pointer}
.nf-payment-requests button:disabled,.nf-payment-dialog button:disabled{opacity:.48;cursor:not-allowed}
.nf-payment-requests :focus-visible,.nf-payment-dialog :focus-visible{outline:3px solid #93b4ff;outline-offset:3px}
.nf-payment-requests h1,.nf-payment-requests h2,.nf-payment-requests h3,.nf-payment-dialog h2,.nf-payment-dialog h3{margin:0;color:var(--nf-ink)}
.nf-payment-requests .nf-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.nf-payment-requests .nf-dot{width:6px;height:6px;background:var(--nf-blue);border-radius:50%}
.nf-payment-requests h1{font-size:27px;font-weight:650;letter-spacing:-1px;margin:-15px 0 4px}
.nf-payment-requests .nf-subtitle{margin:0;color:var(--nf-muted);font-size:13px}
.nf-payment-requests .nf-btn,.nf-payment-dialog .nf-btn,.nf-payment-requests .nf-icon,.nf-payment-dialog .nf-icon{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 13px;border:1px solid var(--app-line);border-radius:9px;color:var(--app-text);background:var(--app-surface);font-size:12px;font-weight:600;text-decoration:none;transition:background .15s,box-shadow .15s}
.nf-payment-requests .nf-btn:hover,.nf-payment-dialog .nf-btn:hover{background:var(--app-soft);box-shadow:0 2px 5px #162c4510}
.nf-payment-requests .nf-btn.primary,.nf-payment-dialog .nf-btn.primary{background:var(--nf-blue);border-color:var(--nf-blue);color:var(--app-primary-text);box-shadow:0 2px 4px #245bd81a}
.nf-payment-requests .nf-btn.primary:hover,.nf-payment-dialog .nf-btn.primary:hover{background:var(--app-info)}
.nf-payment-requests .nf-btn svg,.nf-payment-dialog .nf-btn svg,.nf-payment-requests .nf-icon svg,.nf-payment-dialog .nf-icon svg{width:16px;height:16px;flex-shrink:0}
.nf-payment-requests .nf-icon,.nf-payment-dialog .nf-icon{width:40px;padding:8px}
.nf-payment-requests .nf-panel{background:var(--app-surface);border:1px solid var(--nf-border);border-radius:14px;box-shadow:0 4px 18px #19314d04;overflow:hidden;margin:0 -14px;padding:1px 0}
.nf-payment-requests .nf-panel-top{padding:13px 20px;margin:-1px 0;border-bottom:1px solid #edf0f5}
.nf-payment-requests .nf-segment{display:inline-flex;flex-wrap:wrap;background:var(--app-soft);border:1px solid var(--app-line);border-radius:10px;padding:4px;gap:3px}
.nf-payment-requests .nf-segment button{display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 15px;border:0;border-radius:7px;background:transparent;color:var(--app-muted);font-size:12px;font-weight:600;min-height:40px}
.nf-payment-requests .nf-segment button.active{background:white;color:var(--app-info);box-shadow:0 1px 4px #1a34561a}
.nf-payment-requests .nf-segment span{background:var(--app-soft);border-radius:5px;padding:1px 6px;font-size:10px}.nf-payment-requests .nf-segment .active span{background:var(--app-soft)}
.nf-payment-requests.nf-workspace .nf-panel-top{display:flex;flex-direction:column;gap:31px}
.nf-payment-requests.nf-workspace .nf-segment{gap:36px;border:0}
.nf-payment-requests.nf-workspace .nf-segment button.active{border-color:rgba(37,124,179,1)}
.nf-payment-requests .nf-toolbar{display:flex;align-items:center;gap:12px;padding:22px 22px 14px}
.nf-payment-requests .nf-search{display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:1px solid var(--nf-border);background:var(--app-surface);border-radius:9px;padding:0 12px}
.nf-payment-requests .nf-search svg{width:17px;height:17px;color:var(--app-muted);flex-shrink:0}
.nf-payment-requests .nf-search input{width:100%;min-width:0;border:0;background:transparent;min-height:42px;color:var(--app-text);font-size:12px}
.nf-payment-requests .nf-toolbar select{border:1px solid var(--nf-border);border-radius:9px;min-height:42px;padding:8px 32px 8px 12px;background:var(--app-surface);color:var(--app-muted);font-size:12px;max-width:100%}
.nf-payment-requests .nf-list-heading{padding:4px 22px 18px}.nf-payment-requests .nf-list-heading h2{font-size:15px;font-weight:650}.nf-payment-requests .nf-list-heading p{margin:3px 0 0;color:var(--app-muted);font-size:11px}
.nf-payment-requests .nf-text-btn,.nf-payment-dialog .nf-text-btn{padding:5px 8px;border:0;background:transparent;color:var(--app-info);font-size:12px;font-weight:600;min-height:36px}
.nf-payment-requests .nf-table-wrap{width:100%;overflow:auto}.nf-payment-requests .erp-tabela{width:100%;table-layout:fixed}.nf-payment-requests .erp-tabela th{position:relative}.nf-payment-requests .erp-redimensionar{position:absolute;right:-3px;top:0;bottom:0;z-index:1;width:7px;cursor:col-resize;touch-action:none}.nf-payment-requests .erp-redimensionar:hover{background:var(--app-info)}.nf-payment-requests .erp-tabela-container{cursor:auto}.nf-payment-requests .erp-linha{cursor:default}.nf-payment-requests .erp-linha-detalhes .nf-detail{margin:12px 16px}
.nf-payment-requests .erp-tabela{font-size:14px;line-height:1.45}
.nf-payment-requests .erp-tabela th{height:46px;padding:0 14px}
.nf-payment-requests .erp-tabela th .erp-ordenar{height:44px;font-size:11px}
.nf-payment-requests .erp-tabela td{padding:10px 14px;font-size:14px}
.nf-payment-requests .erp-tabela td.erp-td-data{padding-top:10px;padding-bottom:10px}
.nf-payment-requests .erp-tabela .erp-linha{height:56px}
.nf-payment-requests .erp-tabela .erp-documento{font-size:13px}
.nf-payment-requests .erp-tabela .erp-texto-secundario{font-size:12px;margin-top:3px;margin-bottom:0}
.nf-payment-requests .erp-tabela .erp-valor{font-size:15px}
.nf-payment-requests .erp-tabela .erp-expandir{width:24px;height:32px}
.nf-payment-requests .nf-doc-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:30px;height:34px;border:1px solid var(--app-line);border-radius:7px;background:var(--app-soft);color:var(--app-muted)}.nf-payment-requests .nf-doc-icon svg{width:15px;height:15px}
.nf-payment-requests .nf-amount{font-weight:650;font-variant-numeric:tabular-nums;color:var(--app-text)}
.nf-payment-requests .nf-detail{display:grid;grid-template-columns:minmax(160px,1fr) minmax(0,3fr);gap:24px;padding:22px;background:var(--app-soft);border:1px solid var(--app-line);border-radius:10px;white-space:normal}.nf-payment-requests .nf-detail h3{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--app-muted);margin-bottom:12px}.nf-payment-requests .nf-detail p{font-size:12px;color:var(--app-muted)}
.nf-payment-requests .nf-attachment{display:flex;align-items:center;gap:9px;padding:11px 12px;width:100%;text-align:left;margin-bottom:8px;background:var(--app-surface);border:1px solid var(--app-line);border-radius:8px;font-size:12px;color:var(--app-muted)}.nf-payment-requests .nf-attachment svg:last-child{margin-left:auto}.nf-payment-requests .nf-attachment:hover{border-color:var(--app-info-line);background:var(--app-soft)}
.nf-payment-requests .nf-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 24px;margin:0}.nf-payment-requests .nf-detail dt{font-size:10px;color:var(--app-muted);margin-bottom:3px}.nf-payment-requests .nf-detail dd{font-size:12px;color:var(--app-text);margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.nf-payment-requests .nf-detail-actions{grid-column:1/-1;display:flex;justify-content:flex-end;border-top:1px solid #e4ebf4;padding-top:15px}
.nf-payment-requests .nf-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;font-size:11px;color:var(--app-muted)}.nf-payment-requests .nf-pagination>div{display:flex;align-items:center;gap:14px}.nf-payment-requests .nf-mobile-docs{display:none}
.nf-payment-requests .nf-empty,.nf-payment-dialog .nf-empty{padding:60px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;color:var(--app-muted)}.nf-payment-requests .nf-empty h3,.nf-payment-dialog .nf-empty h3{font-size:16px}.nf-payment-requests .nf-empty p,.nf-payment-dialog .nf-empty p{margin:0;font-size:12px;max-width:380px}
.nf-payment-requests .nf-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.nf-spin{animation:nf-payment-spin 1s linear infinite}@keyframes nf-payment-spin{to{transform:rotate(360deg)}}
.nf-payment-dialog{border:1px solid var(--app-line);border-radius:16px;padding:0;background:var(--app-surface);width:min(620px,calc(100vw - 28px));max-width:calc(100vw - 28px);max-height:calc(100dvh - 32px);box-shadow:0 24px 90px #091a4433;overflow:auto}.nf-payment-dialog.wide{width:min(1200px,calc(100vw - 28px))}.nf-payment-dialog::backdrop{background:#14253d99;backdrop-filter:blur(4px)}
.nf-payment-dialog .nf-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;position:sticky;top:0;z-index:2;background:var(--app-surface);border-bottom:1px solid #e8edf4;padding:16px 22px}.nf-payment-dialog .nf-dialog-header h2{font-size:17px;font-weight:650}.nf-payment-dialog .nf-dialog-content{padding:22px}
.nf-payment-dialog .nf-payment-summary{display:flex;justify-content:space-between;gap:16px;padding:16px;background:var(--app-soft);border:1px solid var(--app-info-line);border-radius:10px;margin-bottom:22px}.nf-payment-dialog .nf-payment-summary span{font-size:12px;font-weight:600}.nf-payment-dialog .nf-payment-summary small{display:block;color:var(--app-muted);font-weight:400;margin-top:5px;overflow-wrap:anywhere}.nf-payment-dialog .nf-payment-summary strong{font-size:20px;white-space:nowrap}
.nf-payment-dialog .nf-fieldset{border:0;padding:0;margin:0 0 22px;min-width:0}.nf-payment-dialog legend{display:flex;align-items:center;gap:9px;padding:0;margin-bottom:16px;font-size:12px;font-weight:650;color:var(--app-muted)}.nf-payment-dialog legend span{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:var(--app-soft);border-radius:6px;color:var(--app-info);font-size:10px}
.nf-payment-dialog .nf-form-grid{display:grid;gap:16px;margin-bottom:20px}.nf-payment-dialog .nf-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nf-payment-dialog .nf-form-grid label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:600;color:var(--app-muted);min-width:0}.nf-payment-dialog .span-2{grid-column:1/-1}
.nf-payment-dialog .nf-form-grid input,.nf-payment-dialog .nf-form-grid select,.nf-payment-dialog .nf-form-grid textarea{display:block;width:100%;min-width:0;min-height:42px;border:1px solid var(--app-line);border-radius:8px;padding:10px 12px;background:white;color:var(--app-text);font-size:13px;font-weight:400}.nf-payment-dialog textarea{resize:vertical}
.nf-payment-dialog .nf-upload{position:relative;display:inline-flex;align-items:center;gap:9px;max-width:100%;border:1px solid var(--app-info-line);border-radius:8px;padding:11px 15px;cursor:pointer;color:var(--app-info);background:var(--app-soft);font-size:12px;overflow-wrap:anywhere}.nf-payment-dialog .nf-upload svg{width:17px;height:17px;flex-shrink:0}.nf-payment-dialog .nf-upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.nf-payment-dialog .nf-upload:focus-within{outline:3px solid #93b4ff;outline-offset:3px}.nf-payment-dialog .nf-upload strong{font-weight:600}
.nf-payment-dialog .nf-info{padding:12px;background:var(--app-soft);border-radius:8px;color:var(--app-muted);font-size:11px}.nf-payment-dialog .nf-modal-footer{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding-top:18px;margin-top:20px;border-top:1px solid #e8edf4}
.nf-payment-dialog .nf-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;color:var(--app-muted);font-size:12px}.nf-payment-dialog .nf-preview-toolbar>span{display:flex;align-items:center;gap:8px}.nf-payment-dialog .nf-preview{height:75dvh;min-height:240px;overflow:auto;display:flex;justify-content:center;align-items:center;border:1px solid var(--app-line);border-radius:9px;background:var(--app-soft)}.nf-payment-dialog .nf-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain}.nf-payment-dialog .nf-preview iframe{width:100%;height:100%;border:0;background:var(--app-surface)}
@container(max-width:760px){.nf-payment-requests .nf-table-wrap{display:none}.nf-payment-requests .nf-mobile-docs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0 20px 20px}.nf-payment-requests .nf-mobile-doc{min-width:0;border:1px solid var(--app-line);border-radius:11px;overflow:hidden;background:white}.nf-payment-requests .nf-mobile-doc.expanded{grid-column:1/-1}.nf-payment-requests .nf-mobile-doc>header{display:flex;align-items:center;gap:9px;padding:16px;border-bottom:1px solid #edf1f6}.nf-payment-requests .nf-mobile-doc>header>div{flex:1;min-width:0;overflow-wrap:anywhere}.nf-payment-requests .nf-mobile-doc>header strong{font-size:12px}.nf-payment-requests .nf-mobile-doc>header small{display:block;font-size:11px;color:var(--app-muted)}.nf-payment-requests .nf-mobile-doc>dl{display:grid;gap:16px;padding:16px;margin:0}.nf-payment-requests .nf-mobile-doc dt{font-size:10px;color:var(--app-muted);margin-bottom:4px}.nf-payment-requests .nf-mobile-doc dd{margin:0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.nf-payment-requests .nf-mobile-doc dd small{display:block;font-size:12px;color:var(--app-muted);line-height:1.7;margin-top:6px}.nf-payment-requests .nf-mobile-doc>footer{display:flex;justify-content:flex-end;gap:8px;padding:0 16px 16px;flex-wrap:wrap}.nf-payment-requests .nf-mobile-doc .nf-detail{border-radius:0;border-width:1px 0 0}}
@container(max-width:620px){.nf-payment-requests .nf-header{align-items:flex-start;gap:10px}.nf-payment-requests .nf-header-actions .nf-btn{font-size:0;padding:10px}.nf-payment-requests .nf-header-actions .nf-btn svg{width:18px;height:18px}nf-payment-requests .nf-panel-top{padding:12px}.nf-payment-requests .nf-segment{display:flex}.nf-payment-requests .nf-segment button{flex:1;font-size:11px;padding:7px;gap:6px}.nf-payment-requests .nf-toolbar{padding:14px 12px;flex-direction:column;align-items:stretch;gap:8px}.nf-payment-requests .nf-list-heading{padding:2px 14px 14px}.nf-payment-requests .nf-mobile-docs{grid-template-columns:1fr;padding:0 12px 12px;gap:12px}.nf-payment-requests .nf-detail{grid-template-columns:1fr;padding:16px;gap:20px}.nf-payment-requests .nf-detail dl{grid-template-columns:1fr}.nf-payment-requests .nf-pagination{padding:14px 12px;flex-wrap:wrap;font-size:10px}.nf-payment-requests .nf-pagination>div{gap:8px}}
@media(max-width:600px){.nf-payment-dialog .nf-dialog-header{padding:12px 14px}.nf-payment-dialog .nf-dialog-header h2{font-size:15px}.nf-payment-dialog .nf-dialog-content{padding:14px}.nf-payment-dialog .nf-form-grid.two{grid-template-columns:1fr}.nf-payment-dialog .nf-form-grid input,.nf-payment-dialog .nf-form-grid select,.nf-payment-dialog .nf-form-grid textarea{font-size:16px}.nf-payment-dialog .nf-payment-summary{flex-direction:column}.nf-payment-dialog .nf-modal-footer .nf-btn{flex:1}.nf-payment-dialog .nf-preview-toolbar{flex-wrap:wrap}.nf-payment-dialog .nf-preview{height:60dvh}}
@media(prefers-reduced-motion:reduce){.nf-spin{animation:none}.nf-payment-requests *,.nf-payment-dialog *{transition:none!important}}
`;
