import { Fragment, useCallback, useEffect, useMemo, useState, useRef, useId, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleDollarSign, Clock, FileText, RefreshCw, Search, TriangleAlert, Upload, X, Download, Plane } from "lucide-react";
import { toast } from "sonner";
import {
  buscarContasBancariasHolding,
  buscarSolicitacoesPagamento,
  darBaixaContaAPagar,
  editarLancamento,
  enviarComprovantePagamento,
  carregarDocumentoFinanceiro,
  formatarData,
  formatarMoeda,
  parseValorReais,
  type CamposLancamento,
  type ContaBancaria,
  type ReembolsoColaborador,
  type SolicitacaoPagamento,
} from "@/lib/financeiro-share-api";
import { buscarAeronavesShare } from "@/lib/colaborador-api";
import { createPortal } from "react-dom";

const POR_PAGINA = 12;

type AbaSolicitacao = "cotista" | "colaborador";
type FiltroLista = { id: string; label: string; quantidade?: number };
type DadosLancamentoEditavel = {
  descricao: string;
  fornecedor: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: string;
  numeroDoc: string;
  numeroNf: string;
  numeroRecibo: string;
  numeroBoleto: string;
  numeroDemonstrativo: string;
  observacoes: string;
};
type LinhaExibida = {
  chave: string;
  expandida: boolean;
  documento: string;
  dataEmissao: string;
  cliente?: string;
  colaborador?: string;
  principal: string;
  secundaria: string;
  valor: string;
  status: string;
  acao?: ReactNode;
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

function estadoBadge(valor: string): "paid" | "pending" | "neutral" {
  const estado = valor.toUpperCase();
  if (["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(estado)) return "paid";
  if (["APROVADO", "EMAIL_ENVIADO", "CANCELADO", "REJEITADO"].includes(estado)) return "neutral";
  return "pending";
}

function atendeFiltroCaixaCliente(filtro: string, status: string): boolean {
  const estado = status.toUpperCase();
  if (filtro === "TODOS") return true;
  if (filtro === "ABERTOS") return ["EM_ABERTO", "PENDENTE", "ATRASADO", "EM_ATRASO", "AGUARDANDO_REEMBOLSO"].includes(estado);
  if (filtro === "PAGOS") return ["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(estado);
  return estado === "CANCELADO";
}

function StatusSolicitacao({ status }: { status: string }) {
  const estado = estadoBadge(status);
  return <span className={`nf-badge ${estado}`}>{estado === "paid" ? <CheckCircle2 /> : <Clock />}{statusLegivel(status)}</span>;
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

function primeiroTexto(...valores: Array<string | null | undefined>): string | null {
  return valores.find((valor) => valor && valor.trim() !== "") ?? null;
}

const ANEXOS: Array<{ campo: "url_demonstrativo" | "url_nf" | "url_recibo" | "url_boleto" | "url_doc" | "comprovante_url"; rotulo: string }> = [
  { campo: "url_demonstrativo", rotulo: "Demonstrativo" },
  { campo: "url_nf", rotulo: "Nota fiscal" },
  { campo: "url_recibo", rotulo: "Recibo" },
  { campo: "url_boleto", rotulo: "Boleto" },
  { campo: "url_doc", rotulo: "Documento" },
  { campo: "comprovante_url", rotulo: "Comprovante" },
];

function detalheLancamento(campos: CamposLancamento, abrirDocumento: (documento: DocumentoAberto) => void, acao?: ReactNode): ReactNode {
  const anexos = ANEXOS.flatMap(({ campo, rotulo }) => {
    const url = campos[campo];
    return url ? [{ rotulo, url }] : [];
  });
  const fornecedor = campos.lancamento_fornecedor_nome ?? campos.fornecedor_nome ?? campos.fornecedor;
  const categoria = campos.lancamento_categoria_nome ?? campos.categoria_nome;
  return <div className="nf-detail">
    <section>
      <h3>Documentos anexos</h3>
      {anexos.length > 0
        ? anexos.map(({ rotulo, url }) => <button type="button" className="nf-attachment" key={rotulo} onClick={() => abrirDocumento({ titulo: rotulo, url })}><FileText size={16} />{rotulo}<ChevronRight size={14} /></button>)
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

export function AbaSolicitacoesPagamento({ contasBancarias }: { contasBancarias: ContaBancaria[] }) {
  const [documentoAberto, setDocumentoAberto] = useState<DocumentoAberto | null>(null);
  const uploadRef = useRef<{ arquivo: File; url: string } | null>(null);
  const [envios, setEnvios] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaSolicitacao>("cotista");
  const [alvo, setAlvo] = useState<ReembolsoColaborador | null>(null);
  const [alvoPagamentoCliente, setAlvoPagamentoCliente] = useState<SolicitacaoPagamento | null>(null);
  const [edicaoLancamento, setEdicaoLancamento] = useState<DadosLancamentoEditavel>({
    descricao: "", fornecedor: "", dataEmissao: "", dataVencimento: "", valor: "", numeroDoc: "", numeroNf: "", numeroRecibo: "", numeroBoleto: "", numeroDemonstrativo: "", observacoes: "",
  });
  const [formaPagamentoCliente, setFormaPagamentoCliente] = useState("TRANSFERENCIA");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroEnvio, setFiltroEnvio] = useState("TODOS");
  const [filtroReembolso, setFiltroReembolso] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoId, setBancoId] = useState("");
  const [comprovanteArquivo, setComprovanteArquivo] = useState<File | null>(null);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [contasParaPagamento, setContasParaPagamento] = useState<ContaBancaria[]>(contasBancarias);
  const [matriculasAeronaves, setMatriculasAeronaves] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [dados, aeronavesAtivas, aeronavesInativas] = await Promise.all([
        buscarSolicitacoesPagamento(),
        buscarAeronavesShare("ativa").catch(() => ({ aeronaves: [] })),
        buscarAeronavesShare("inativa").catch(() => ({ aeronaves: [] })),
      ]);
      setEnvios(dados.envios.filter((item) => naoPago(item.status)));
      setReembolsos(dados.reembolsos.filter((item) => naoPago(item.status)));
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
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

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

  async function confirmarBaixa() {
    if (salvando || !alvo?.id || !bancoId || !dataPagamento) return;
    setSalvando(true);
    try {
      let comprovanteUrl: string | undefined;
      if (comprovanteArquivo) {
        setEnviandoComprovante(true);
        comprovanteUrl = uploadRef.current?.arquivo === comprovanteArquivo
          ? uploadRef.current.url
          : (await enviarComprovantePagamento(alvo.id, comprovanteArquivo)).url;
        if (!comprovanteUrl) throw new Error("O upload não retornou a URL do comprovante.");
        uploadRef.current = { arquivo: comprovanteArquivo, url: comprovanteUrl };
        setEnviandoComprovante(false);
      }
      await darBaixaContaAPagar(alvo.id, {
        dataPagamento,
        bancoPagamento: bancoId,
        comprovantePagamentoUrl: comprovanteUrl,
        formaPagamento: "TRANSFERENCIA",
      });
      toast.success("Reembolso do colaborador marcado como pago.");
      setAlvo(null);
      setComprovanteArquivo(null);
      await carregar();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível registrar o pagamento.");
    } finally {
      setEnviandoComprovante(false);
      setSalvando(false);
    }
  }

  function selecionarComprovante(arquivo?: File) {
    if (!arquivo) return;
    const tiposAceitos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!tiposAceitos.includes(arquivo.type)) {
      toast.error("Escolha um arquivo PDF, JPG, PNG ou WebP.");
      return;
    }
    if (arquivo.size < 1 || arquivo.size > 10 * 1024 * 1024) {
      toast.error("O comprovante deve ter no máximo 10 MB.");
      return;
    }
    setComprovanteArquivo(arquivo);
  }

  function abrirBaixa(item: ReembolsoColaborador) {
    uploadRef.current = null;
    setAlvo(item);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setBancoId("");
    setComprovanteArquivo(null);
  }

  function abrirBaixaCliente(item: SolicitacaoPagamento) {
    if (!item.conta_a_pagar_id) {
      toast.error("Não foi encontrada uma conta a pagar vinculada a este lançamento.");
      return;
    }
    const valorCentavos = Number(item.valor_centavos ?? Math.round(Number(item.valor ?? 0) * 100));
    uploadRef.current = null;
    setComprovanteArquivo(null);
    setAlvoPagamentoCliente(item);
    setEdicaoLancamento({
      descricao: item.descricao ?? "",
      fornecedor: item.lancamento_fornecedor_nome ?? item.fornecedor_nome ?? item.fornecedor ?? "",
      dataEmissao: (item.data_emissao ?? item.data_despesa ?? "").slice(0, 10),
      dataVencimento: (item.data_vencimento ?? item.vencimento ?? "").slice(0, 10),
      valor: (valorCentavos / 100).toFixed(2).replace(".", ","),
      numeroDoc: item.numero_doc ?? "",
      numeroNf: item.numero_nf ?? "",
      numeroRecibo: item.numero_recibo ?? "",
      numeroBoleto: item.numero_boleto ?? "",
      numeroDemonstrativo: item.numero_demonstrativo ?? "",
      observacoes: item.observacoes ?? "",
    });
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setBancoId(contasBancarias[0]?.id ?? "");
    setFormaPagamentoCliente("TRANSFERENCIA");
  }

  function fecharBaixaCliente() {
    if (salvando) return;
    setAlvoPagamentoCliente(null);
    setBancoId("");
  }

  async function confirmarBaixaCliente() {
    if (salvando || !alvoPagamentoCliente?.conta_a_pagar_id || !bancoId || !dataPagamento) return;
    if (!edicaoLancamento.descricao.trim()) {
      toast.error("Informe a descrição do lançamento.");
      return;
    }
    const valorCentavos = parseValorReais(edicaoLancamento.valor);
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      let comprovanteUrl: string | undefined;
      if (comprovanteArquivo) {
        setEnviandoComprovante(true);
        comprovanteUrl = uploadRef.current?.arquivo === comprovanteArquivo
          ? uploadRef.current.url
          : (await enviarComprovantePagamento(alvoPagamentoCliente.conta_a_pagar_id, comprovanteArquivo)).url;
        if (!comprovanteUrl) throw new Error("O upload não retornou a URL do comprovante.");
        uploadRef.current = { arquivo: comprovanteArquivo, url: comprovanteUrl };
        setEnviandoComprovante(false);
      }
      const dados: Parameters<typeof editarLancamento>[1] = {
        descricao: edicaoLancamento.descricao.trim(),
        fornecedor_nome: edicaoLancamento.fornecedor.trim() || null,
        data_emissao: edicaoLancamento.dataEmissao || undefined,
        data_vencimento: edicaoLancamento.dataVencimento || null,
        valor_centavos: valorCentavos,
        numero_doc: edicaoLancamento.numeroDoc.trim() || null,
        numero_nf: edicaoLancamento.numeroNf.trim() || null,
        numero_recibo: edicaoLancamento.numeroRecibo.trim() || null,
        numero_boleto: edicaoLancamento.numeroBoleto.trim() || null,
        numero_demonstrativo: edicaoLancamento.numeroDemonstrativo.trim() || null,
        observacoes: edicaoLancamento.observacoes.trim() || null,
      };
      await editarLancamento(alvoPagamentoCliente.lancamento_id ?? alvoPagamentoCliente.id, dados);
      await darBaixaContaAPagar(alvoPagamentoCliente.conta_a_pagar_id, {
        comprovantePagamentoUrl: comprovanteUrl,
        dataPagamento,
        bancoPagamento: bancoId,
        formaPagamento: formaPagamentoCliente,
        observacoes: edicaoLancamento.observacoes.trim() || undefined,
      });
      toast.success("Pagamento confirmado e lançamento do caixa SHARE atualizado.");
      setAlvoPagamentoCliente(null);
      setExpandido(null);
      setBancoId("");
      await carregar();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível atualizar o lançamento e confirmar o pagamento.");
    } finally {
      setEnviandoComprovante(false);
      setSalvando(false);
    }
  }

  function fecharBaixa() {
    if (salvando) return;
    setAlvo(null);
    setComprovanteArquivo(null);
    setBancoId("");
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

  const lancamentosAbertos = envios.filter((item) => atendeFiltroCaixaCliente("ABERTOS", item.status));
  const totalEmAberto = lancamentosAbertos.reduce((soma, item) => soma + Number(item.valor ?? 0), 0);
  const totalReembolsos = reembolsos.reduce((soma, item) => soma + item.valor, 0);
  const totalVencidos = reembolsosVencidos.reduce((soma, item) => soma + item.valor, 0);

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
      cliente: primeiroTexto(item.cliente_razao_social, item.cliente_nome, item.razao_social, item.socio_nome, item.hold_socios_nome, item.hold_socios?.nome, item.cotista_nome, item.holding_nome) ?? "—",
      principal: aeronave ?? "—",
      secundaria: item.descricao ?? "",
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : Number(item.valor ?? 0))}`,
      status: item.status,
      acao: baixaDisponivel ? <button type="button" className="nf-btn primary" disabled={!item.conta_a_pagar_id} title={!item.conta_a_pagar_id ? "Conta a pagar vinculada não encontrada" : undefined} onClick={() => abrirBaixaCliente(item)}>Dar baixa</button> : undefined,
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
      colaborador: primeiroTexto(item.user_profiles?.nome_completo, item.nome_completo, item.solicitanteNome) ?? "—",
      principal: rotuloAeronave(item.aeronave_id ?? item.aeronaveId, item.matricula_registro ?? item.aeronave_matricula) ?? "—",
      secundaria: item.descricao ?? "",
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : item.valor)}`,
      status: item.status,
      acao: <button type="button" className="nf-btn primary" onClick={() => abrirBaixa(item)}><CheckCircle2 /> Dar baixa</button>,
      detalhe: expandida ? detalheLancamento(item, setDocumentoAberto) : null,
    };
  });

  const linhas = aba === "cotista" ? linhasEnvio : linhasReembolso;

  return (
    <div className="nf-workspace nf-payment-requests">
      <style>{STYLES}</style>
      <style>{`.dark .nf-payment-requests{--nf-ink:#edf4ff;--nf-muted:#9aaec8;--nf-border:#25334a;--nf-blue:#3478f6;color-scheme:dark;background:radial-gradient(ellipse at 5% 0%,#112645 0%,transparent 42%),#0b1120;color:#edf4ff}.dark .nf-payment-requests h1,.dark .nf-payment-requests h2,.dark .nf-payment-requests h3{color:#edf4ff}.dark .nf-payment-requests .nf-eyebrow{color:#93b7e6}.dark .nf-payment-requests .nf-subtitle,.dark .nf-payment-requests .nf-list-heading p{color:#91a6c2}.dark .nf-payment-requests .nf-btn{background:#172238;border-color:#25334a;color:#dbe8fa}.dark .nf-payment-requests .nf-btn:hover{background:#21314c;border-color:#3b526f}.dark .nf-payment-requests .nf-btn.primary{background:#09317a;border-color:#020f27;color:#fff}.dark .nf-payment-requests .nf-btn.primary:hover{background:#4289ff}.dark .nf-payment-requests .nf-stat{background:linear-gradient(135deg,#152139,#101a2b);border-color:#25334a;color:#edf4ff}.dark .nf-payment-requests .nf-stat-top{color:#b0c1d8}.dark .nf-payment-requests .nf-stat-top svg{background:#203557;color:#78afff}.dark .nf-payment-requests .nf-stat.green .nf-stat-top svg{background:#10352e;color:#5fe1b5}.dark .nf-payment-requests .nf-stat.amber .nf-stat-top svg{background:#372e1f;color:#f3cb79}.dark .nf-payment-requests .nf-stat small{color:#91a6c2}.dark .nf-payment-requests .nf-panel{background:#10192a;border-color:#25334a;box-shadow:0 12px 40px #00000055}.dark .nf-payment-requests .nf-panel-top{border-color:#25334a}.dark .nf-payment-requests .nf-segment{background:#0b1322;border-color:#253249}.dark .nf-payment-requests .nf-segment button{color:#a4b6cd}.dark .nf-payment-requests .nf-segment button.active{background:#2869e4;color:#fff}.dark .nf-payment-requests .nf-segment span{background:#ffffff10}.dark .nf-payment-requests .nf-toolbar input,.dark .nf-payment-requests .nf-toolbar select{background:#0c1525;border-color:#25334a;color:#edf4ff}.dark .nf-payment-requests .nf-search{background:#0c1525;border-color:#25334a}.dark .nf-payment-requests .nf-search input::placeholder{color:#8196b2}.dark .nf-payment-requests .nf-table th{background:#0d1728;color:#8fa8ca;border-color:#24344c}.dark .nf-payment-requests .nf-table td{border-color:#223047}.dark .nf-payment-requests .nf-table tbody tr:not(.nf-detail-row):hover{background:#1a2b45}.dark .nf-payment-requests .nf-doc-cell strong{color:#e0ecff}.dark .nf-payment-requests .nf-doc-cell small{color:#90a5c0}.dark .nf-payment-requests .nf-doc-icon{background:#20355780;border-color:#304a6d80;color:#78afff}.dark .nf-payment-requests .nf-amount{color:#ecf5ff}.dark .nf-payment-requests .nf-badge.pending{color:#f3cb79;background:#372e1f}.dark .nf-payment-requests .nf-badge.paid{color:#5fe1b5;background:#10352e}.dark .nf-payment-requests .nf-badge.neutral{color:#bbc9dc;background:#223047}.dark .nf-payment-requests .nf-detail{background:#111c2e;border-color:#223047}.dark .nf-payment-requests .nf-detail h3{color:#93b7e6}.dark .nf-payment-requests .nf-detail p{color:#c7d7ee}.dark .nf-payment-requests .nf-detail dt{color:#90a5c0}.dark .nf-payment-requests .nf-detail dd{color:#e0ecff}.dark .nf-payment-requests .nf-detail-actions{border-color:#223047}.dark .nf-payment-requests .nf-attachment{background:#0c1525;border-color:#304a6d;color:#9ec6f1}.dark .nf-payment-requests .nf-attachment:hover{background:#162842;border-color:#7cafe6}.dark .nf-payment-requests .nf-pagination{color:#9cb0cb}.dark .nf-payment-requests .nf-empty{color:#a3b8d3}.dark .nf-payment-requests .nf-mobile-doc{background:#142136;border-color:#2b3f5b}.dark .nf-payment-requests .nf-mobile-doc>header{border-color:#2a3c55}.dark .nf-payment-requests .nf-mobile-doc header small,.dark .nf-payment-requests .nf-mobile-doc dt{color:#8faacc}`}</style>
      <header className="nf-header">
        <div><div className="nf-eyebrow"><span className="nf-dot" /> FINANCEIRO / CONTROLE DE DESPESAS</div><h1>Solicitações de pagamento</h1><p className="nf-subtitle">Gestão de despesas e reembolsos</p></div>
        <div className="nf-header-actions">
          <button className="nf-btn" disabled={carregando} onClick={() => void carregar()}><RefreshCw className={carregando ? "nf-spin" : ""} /> Atualizar</button>
        </div>
      </header>
      <section className="nf-stats" aria-label="Resumo das solicitações" aria-busy={carregando}>
        {[
          { label: "Em aberto", valor: formatarMoeda(totalEmAberto), nota: `${lancamentosAbertos.length} despesas aguardando pagamento`, Icon: Clock, cor: "cyan" },
          { label: "Reembolsos", valor: formatarMoeda(totalReembolsos), nota: `${reembolsos.length} ${reembolsos.length === 1 ? "título" : "títulos"} aguardando pagamento`, Icon: CircleDollarSign, cor: "green" },
          { label: "Vencidos", valor: formatarMoeda(totalVencidos), nota: `${reembolsosVencidos.length} ${reembolsosVencidos.length === 1 ? "reembolso vencido" : "reembolsos vencidos"}`, Icon: TriangleAlert, cor: "amber" },
        ].map(({ label, valor, nota, Icon, cor }) => <article className={`nf-stat ${cor}`} key={label}><div className="nf-stat-top"><span>{label}</span><Icon /></div><strong>{carregando || erro ? "—" : valor}</strong><small>{carregando ? "Atualizando solicitações…" : erro ? "Dados indisponíveis" : nota}</small></article>)}
      </section>
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
        <div className="nf-list-heading">
          <div>
            <h2>{aba === "cotista" ? "Caixa cliente" : "Reembolsos de colaboradores"}</h2>
            <p>{carregando ? "Carregando…" : `${totalItens} ${aba === "cotista" ? (totalItens === 1 ? "lançamento" : "lançamentos") : (totalItens === 1 ? "título" : "títulos")} encontrados`}{temFiltro && <button className="nf-text-btn" onClick={limparFiltros}>Limpar filtros</button>}</p>
          </div>
        </div>
        {carregando ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><h3>Carregando solicitações</h3><p>Organizando as informações de pagamento.</p></div>
          : erro ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível carregar</h3><p>{erro}</p><button className="nf-btn" onClick={() => void carregar()}>Tentar novamente</button></div>
          : totalItens === 0 ? <div className="nf-empty"><Search /><h3>{temFiltro ? "Nenhum resultado encontrado" : "Nada por aqui"}</h3><p>{temFiltro ? "Ajuste a busca ou o filtro para encontrar o registro." : aba === "cotista" ? "Não há despesas reembolsáveis no caixa cliente." : "Não há reembolsos pendentes de colaboradores."}</p>{temFiltro && <button className="nf-btn" onClick={limparFiltros}>Limpar filtros</button>}</div>
          : <>
            <div className="nf-table-wrap">
              <table className="nf-table">
                <caption className="nf-sr">{aba === "cotista" ? "Lançamentos reembolsáveis de caixa cliente" : "Reembolsos de colaboradores"}</caption>
                <thead><tr><th scope="col">Doc / emissão</th>{aba === "cotista" ? <th scope="col">Cliente</th> : <th scope="col">Colaborador</th>}<th scope="col">Aeronave / descrição</th><th scope="col" className="right">Valor</th><th scope="col">Status</th><th scope="col" className="right">Ações</th></tr></thead>
                <tbody>
                  {linhas.map((linha) => <Fragment key={linha.chave}>
                    <tr>
                      <td><div className="nf-doc-cell"><span className="nf-doc-icon"><FileText /></span><div><strong>{linha.documento}</strong><small>{linha.dataEmissao}</small></div></div></td>
                      <td>{aba === "cotista" ? linha.cliente : linha.colaborador}</td>
                      <td><div className="nf-doc-cell"><div><strong className="nf-registration"><Plane size={14} />{linha.principal}</strong>{linha.secundaria && <small title={linha.secundaria}>{linha.secundaria}</small>}</div></div></td>
                      <td className="right nf-amount">{linha.valor}</td>
                      <td><StatusSolicitacao status={linha.status} /></td>
                      <td className="right"><div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>{linha.acao}<button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></div></td>
                    </tr>
                    {linha.expandida && <tr className="nf-detail-row"><td colSpan={6}>{linha.detalhe}</td></tr>}
                  </Fragment>)}
                </tbody>
              </table>
            </div>
            <div className="nf-mobile-docs">
              {linhas.map((linha) => <article className={`nf-mobile-doc${linha.expandida ? " expanded" : ""}`} key={linha.chave}>
                <header><span className="nf-doc-icon"><FileText /></span><div><strong>{linha.documento}</strong><small>{linha.dataEmissao}</small></div><StatusSolicitacao status={linha.status} /></header>
                <dl><div><dt>{aba === "cotista" ? "Cliente" : "Colaborador"}</dt><dd>{aba === "cotista" ? linha.cliente : linha.colaborador}</dd></div><div><dt>Aeronave / descrição</dt><dd>{linha.principal}{linha.secundaria && <small>{linha.secundaria}</small>}</dd></div><div><dt>Valor</dt><dd className="nf-amount">{linha.valor}</dd></div></dl>
                <footer>{linha.acao}<button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></footer>
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

      {alvoPagamentoCliente && <Modal title="Editar lançamento e dar baixa" onClose={fecharBaixaCliente} busy={salvando} wide>
        <form onSubmit={(e) => { e.preventDefault(); void confirmarBaixaCliente(); }}>
          <div className="nf-payment-summary">
            <span>Despesa reembolsável · Caixa SHARE<small>{alvoPagamentoCliente.cliente_razao_social || "Cliente"} · {edicaoLancamento.descricao || "Lançamento"}</small></span>
            <strong>{formatarMoeda(parseValorReais(edicaoLancamento.valor) / 100)}</strong>
          </div>
          <fieldset disabled={salvando} className="nf-fieldset">
            <legend><span>01</span> Dados editáveis do lançamento</legend>
            <div className="nf-form-grid two">
              <label className="span-2">Descrição *<input required value={edicaoLancamento.descricao} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, descricao: e.target.value }))} /></label>
              <label>Fornecedor<input value={edicaoLancamento.fornecedor} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, fornecedor: e.target.value }))} /></label>
              <label>Data de emissão<input type="date" value={edicaoLancamento.dataEmissao} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, dataEmissao: e.target.value }))} /></label>
              <label>Vencimento<input type="date" value={edicaoLancamento.dataVencimento} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, dataVencimento: e.target.value }))} /></label>
              <label>Valor da despesa (R$) *<input required inputMode="decimal" value={edicaoLancamento.valor} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, valor: e.target.value }))} /></label>
              <label>Número do documento<input value={edicaoLancamento.numeroDoc} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, numeroDoc: e.target.value }))} /></label>
              <label>Nota fiscal<input value={edicaoLancamento.numeroNf} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, numeroNf: e.target.value }))} /></label>
              <label>Número do recibo<input value={edicaoLancamento.numeroRecibo} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, numeroRecibo: e.target.value }))} /></label>
              <label>Número do boleto<input value={edicaoLancamento.numeroBoleto} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, numeroBoleto: e.target.value }))} /></label>
              <label>Número do demonstrativo<input value={edicaoLancamento.numeroDemonstrativo} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, numeroDemonstrativo: e.target.value }))} /></label>
              <label className="span-2">Observações<textarea rows={3} value={edicaoLancamento.observacoes} onChange={(e) => setEdicaoLancamento((atual) => ({ ...atual, observacoes: e.target.value }))} /></label>
            </div>
          </fieldset>
          <fieldset disabled={salvando} className="nf-fieldset">
            <legend><span>02</span> Dados do pagamento</legend>
            <div className="nf-form-grid two">
              <label>Data do pagamento *<input required type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></label>
              <label>Conta SHARE *<select required value={bancoId} onChange={(e) => setBancoId(e.target.value)}><option value="">Selecione a conta</option>{contasBancarias.map((conta) => <option key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` • ${conta.numero_conta}` : ""}</option>)}</select></label>
              <label>Forma de pagamento<select value={formaPagamentoCliente} onChange={(e) => setFormaPagamentoCliente(e.target.value)}><option value="PIX">PIX</option><option value="TRANSFERENCIA">Transferência</option><option value="BOLETO">Boleto</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO">Cartão</option></select></label>
            </div>
          </fieldset>
          <fieldset disabled={salvando} className="nf-fieldset">
            <legend><span>03</span> Comprovante de pagamento</legend>
            <label className="nf-upload"><Upload /><span><strong>{comprovanteArquivo ? comprovanteArquivo.name : "Upload de comprovante"}</strong></span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { selecionarComprovante(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {comprovanteArquivo && <button type="button" className="nf-text-btn" onClick={() => setComprovanteArquivo(null)}>Remover comprovante</button>}
            {enviandoComprovante && <p role="status">Enviando comprovante…</p>}
          </fieldset>
          <p className="nf-info">Ao confirmar, os dados editados serão salvos, a conta a pagar será liquidada e o lançamento do caixa SHARE passará para pago.</p>
          <footer className="nf-modal-footer">
            <button type="button" className="nf-btn" disabled={salvando} onClick={fecharBaixaCliente}>Cancelar</button>
            <button type="submit" className="nf-btn primary" disabled={salvando || !bancoId || !dataPagamento}>{salvando ? "Salvando e confirmando…" : "Confirmar pagamento"}</button>
          </footer>
        </form>
      </Modal>}

      {alvo && <Modal title="Dar baixa no reembolso" onClose={fecharBaixa} busy={salvando}>
        <form onSubmit={(e) => { e.preventDefault(); void confirmarBaixa(); }}>
          <div className="nf-payment-summary">
            <span>{alvo.solicitanteNome || "Colaborador"}<small>{alvo.descricao || "Despesa reembolsável"} · Vencimento {dataLegivel(alvo.dataVencimento)}</small></span>
            <strong>{formatarMoeda(alvo.valor)}</strong>
          </div>
          <div className="nf-form-grid two">
            <label>Data do pagamento *<input required type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></label>
            <label>Conta {String(alvo.tipoCaixa).toUpperCase() === "HOLDING" ? "da holding" : "Share"} *<select required value={bancoId} onChange={(e) => setBancoId(e.target.value)}><option value="">Selecione a conta</option>{contasParaPagamento.map((conta) => <option key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` • ${conta.numero_conta}` : ""}</option>)}</select></label>
          </div>
          <fieldset disabled={salvando} className="nf-fieldset">
            <legend><span>02</span> Comprovante de pagamento</legend>
            <label className="nf-upload"><Upload /><span><strong>{comprovanteArquivo ? comprovanteArquivo.name : "Upload de comprovante"}</strong></span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { selecionarComprovante(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {comprovanteArquivo && <button type="button" className="nf-text-btn" onClick={() => setComprovanteArquivo(null)}>Remover comprovante</button>}
            {enviandoComprovante && <p role="status">Enviando comprovante…</p>}
          </fieldset>
          <footer className="nf-modal-footer">
            <button type="button" className="nf-btn" disabled={salvando} onClick={fecharBaixa}>Cancelar</button>
            <button type="submit" className="nf-btn primary" disabled={salvando || !bancoId || !dataPagamento}>{salvando ? enviandoComprovante ? "Enviando comprovante…" : "Registrando pagamento…" : "Confirmar pagamento"}</button>
          </footer>
        </form>
      </Modal>}
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
.nf-payment-requests,.nf-payment-dialog{--nf-ink:#172b45;--nf-muted:#64748b;--nf-border:#e2e8f0;--nf-blue:#245bd8;color:var(--nf-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;color-scheme:light}
.nf-payment-requests *,.nf-payment-dialog *{box-sizing:border-box}
.nf-payment-requests{container-type:inline-size;width:100%;min-width:0;background:#f4f6fa;padding:clamp(14px,2.4vw,32px);border-radius:18px}
.nf-payment-requests button,.nf-payment-dialog button,.nf-payment-requests input,.nf-payment-dialog input,.nf-payment-requests select,.nf-payment-dialog select,.nf-payment-dialog textarea{font:inherit}
.nf-payment-requests button,.nf-payment-dialog button{cursor:pointer}
.nf-payment-requests button:disabled,.nf-payment-dialog button:disabled{opacity:.48;cursor:not-allowed}
.nf-payment-requests :focus-visible,.nf-payment-dialog :focus-visible{outline:3px solid #93b4ff;outline-offset:3px}
.nf-payment-requests h1,.nf-payment-requests h2,.nf-payment-requests h3,.nf-payment-dialog h2,.nf-payment-dialog h3{margin:0;color:var(--nf-ink)}
.nf-payment-requests .nf-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.nf-payment-requests .nf-eyebrow{display:flex;align-items:center;gap:8px;color:#6b7b91;font-size:10px;font-weight:700;letter-spacing:1.3px}
.nf-payment-requests .nf-dot{width:6px;height:6px;background:var(--nf-blue);border-radius:50%}
.nf-payment-requests h1{font-size:clamp(22px,2.4vw,30px);font-weight:650;letter-spacing:-1px;margin:8px 0 4px}
.nf-payment-requests .nf-subtitle{margin:0;color:var(--nf-muted);font-size:13px}
.nf-payment-requests .nf-btn,.nf-payment-dialog .nf-btn,.nf-payment-requests .nf-icon,.nf-payment-dialog .nf-icon{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 13px;border:1px solid #dce3ed;border-radius:9px;color:#33465f;background:#fff;font-size:12px;font-weight:600;text-decoration:none;transition:background .15s,box-shadow .15s}
.nf-payment-requests .nf-btn:hover,.nf-payment-dialog .nf-btn:hover{background:#f1f5fc;box-shadow:0 2px 5px #162c4510}
.nf-payment-requests .nf-btn.primary,.nf-payment-dialog .nf-btn.primary{background:var(--nf-blue);border-color:var(--nf-blue);color:#fff;box-shadow:0 2px 4px #245bd81a}
.nf-payment-requests .nf-btn.primary:hover,.nf-payment-dialog .nf-btn.primary:hover{background:#1949b8}
.nf-payment-requests .nf-btn svg,.nf-payment-dialog .nf-btn svg,.nf-payment-requests .nf-icon svg,.nf-payment-dialog .nf-icon svg{width:16px;height:16px;flex-shrink:0}
.nf-payment-requests .nf-icon,.nf-payment-dialog .nf-icon{width:40px;padding:8px}
.nf-payment-requests .nf-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0 0 24px}
.nf-payment-requests .nf-stat{position:relative;background:#fff;border:1px solid var(--nf-border);border-radius:13px;padding:20px 22px;box-shadow:0 3px 14px #20395904;overflow:hidden}
.nf-payment-requests .nf-stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#64748b;font-weight:600;font-size:12px;margin-bottom:12px}
.nf-payment-requests .nf-stat-top svg{width:32px;height:32px;padding:7px;background:#eff4ff;border-radius:9px;color:#245bd8}
.nf-payment-requests .nf-stat.green .nf-stat-top svg{color:#13785c;background:#ecf8f2}.nf-payment-requests .nf-stat.amber .nf-stat-top svg{color:#ab7014;background:#fff6e6}
.nf-payment-requests .nf-stat strong{display:block;font-size:clamp(20px,2.3vw,29px);letter-spacing:-.9px;font-weight:650;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.nf-payment-requests .nf-stat small{display:block;font-size:11px;color:#77859a;margin-top:6px}
.nf-payment-requests .nf-panel{background:#fff;border:1px solid var(--nf-border);border-radius:14px;box-shadow:0 4px 18px #19314d04;overflow:hidden}
.nf-payment-requests .nf-panel-top{padding:18px 22px;border-bottom:1px solid #edf0f5}
.nf-payment-requests .nf-segment{display:inline-flex;flex-wrap:wrap;background:#f1f4f9;border:1px solid #e9edf4;border-radius:10px;padding:4px;gap:3px}
.nf-payment-requests .nf-segment button{display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 15px;border:0;border-radius:7px;background:transparent;color:#64748b;font-size:12px;font-weight:600;min-height:40px}
.nf-payment-requests .nf-segment button.active{background:white;color:#245bd8;box-shadow:0 1px 4px #1a34561a}
.nf-payment-requests .nf-segment span{background:#e7edf6;border-radius:5px;padding:1px 6px;font-size:10px}.nf-payment-requests .nf-segment .active span{background:#edf3ff}
.nf-payment-requests .nf-toolbar{display:flex;align-items:center;gap:12px;padding:22px 22px 14px}
.nf-payment-requests .nf-search{display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:1px solid var(--nf-border);background:#fafbfd;border-radius:9px;padding:0 12px}
.nf-payment-requests .nf-search svg{width:17px;height:17px;color:#8290a4;flex-shrink:0}
.nf-payment-requests .nf-search input{width:100%;min-width:0;border:0;background:transparent;min-height:42px;color:#243852;font-size:12px}
.nf-payment-requests .nf-toolbar select{border:1px solid var(--nf-border);border-radius:9px;min-height:42px;padding:8px 32px 8px 12px;background:#fff;color:#45566d;font-size:12px;max-width:100%}
.nf-payment-requests .nf-list-heading{padding:4px 22px 18px}.nf-payment-requests .nf-list-heading h2{font-size:15px;font-weight:650}.nf-payment-requests .nf-list-heading p{margin:3px 0 0;color:#7c899d;font-size:11px}
.nf-payment-requests .nf-text-btn,.nf-payment-dialog .nf-text-btn{padding:5px 8px;border:0;background:transparent;color:#245bd8;font-size:12px;font-weight:600;min-height:36px}
.nf-payment-requests .nf-table-wrap{width:100%;overflow:auto}.nf-payment-requests .nf-table{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left;white-space:normal}
.nf-payment-requests .nf-table th{background:#f8fafc;color:#738197;font-size:10px;text-transform:uppercase;letter-spacing:.6px;font-weight:650;border-block:1px solid #edf1f6;padding:12px 16px}
.nf-payment-requests .nf-table td{border-bottom:1px solid #edf1f6;padding:18px 16px;vertical-align:top;font-size:12px;overflow-wrap:anywhere}
.nf-payment-requests .nf-table th:nth-child(1){width:14%}.nf-payment-requests .nf-table th:nth-child(2){width:17%}.nf-payment-requests .nf-table th:nth-child(3){width:27%}.nf-payment-requests .nf-table th:nth-child(4){width:13%}.nf-payment-requests .nf-table th:nth-child(5){width:12%}.nf-payment-requests .nf-table th:nth-child(6){width:17%}
.nf-payment-requests .nf-table tbody tr:not(.nf-detail-row):hover{background:#fafcff}.nf-payment-requests .right{text-align:right}
.nf-payment-requests .nf-doc-cell{display:flex;align-items:flex-start;gap:9px;min-width:0}.nf-payment-requests .nf-doc-cell>div{min-width:0}.nf-payment-requests .nf-doc-cell strong{font-size:12px;font-weight:600}.nf-payment-requests .nf-doc-cell small{display:block;color:#6f7d91;font-size:12px;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
.nf-payment-requests .nf-registration{display:flex;gap:6px;align-items:center;color:#304864}.nf-payment-requests .nf-registration svg{color:#8899b0;flex-shrink:0}
.nf-payment-requests .nf-doc-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:30px;height:34px;border:1px solid #e7ecf3;border-radius:7px;background:#f8fafc;color:#7a8ba3}.nf-payment-requests .nf-doc-icon svg{width:15px;height:15px}
.nf-payment-requests .nf-amount{font-weight:650;font-variant-numeric:tabular-nums;color:#243852}
.nf-payment-requests .nf-badge{display:inline-flex;align-items:center;gap:5px;border-radius:6px;padding:5px 7px;font-size:10px;font-weight:600;line-height:1.4;max-width:100%;text-align:left}.nf-payment-requests .nf-badge svg{width:12px;height:12px;flex-shrink:0}.nf-payment-requests .nf-badge.pending{color:#a46b16;background:#fff6e6}.nf-payment-requests .nf-badge.paid{color:#147553;background:#eaf7f0}.nf-payment-requests .nf-badge.neutral{color:#65758b;background:#eef2f6}
.nf-payment-requests .nf-detail{display:grid;grid-template-columns:minmax(160px,1fr) minmax(0,3fr);gap:24px;padding:22px;background:#f8fafd;border:1px solid #e6edf5;border-radius:10px;white-space:normal}.nf-payment-requests .nf-detail h3{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#65758d;margin-bottom:12px}.nf-payment-requests .nf-detail p{font-size:12px;color:#7b889a}
.nf-payment-requests .nf-attachment{display:flex;align-items:center;gap:9px;padding:11px 12px;width:100%;text-align:left;margin-bottom:8px;background:#fff;border:1px solid #dfe7f2;border-radius:8px;font-size:12px;color:#31537a}.nf-payment-requests .nf-attachment svg:last-child{margin-left:auto}.nf-payment-requests .nf-attachment:hover{border-color:#9bb8f4;background:#f4f7ff}
.nf-payment-requests .nf-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 24px;margin:0}.nf-payment-requests .nf-detail dt{font-size:10px;color:#8793a5;margin-bottom:3px}.nf-payment-requests .nf-detail dd{font-size:12px;color:#354a64;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.nf-payment-requests .nf-detail-actions{grid-column:1/-1;display:flex;justify-content:flex-end;border-top:1px solid #e4ebf4;padding-top:15px}
.nf-payment-requests .nf-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;font-size:11px;color:#8290a4}.nf-payment-requests .nf-pagination>div{display:flex;align-items:center;gap:14px}.nf-payment-requests .nf-mobile-docs{display:none}
.nf-payment-requests .nf-empty,.nf-payment-dialog .nf-empty{padding:60px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;color:#8493a8}.nf-payment-requests .nf-empty h3,.nf-payment-dialog .nf-empty h3{font-size:16px}.nf-payment-requests .nf-empty p,.nf-payment-dialog .nf-empty p{margin:0;font-size:12px;max-width:380px}
.nf-payment-requests .nf-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.nf-spin{animation:nf-payment-spin 1s linear infinite}@keyframes nf-payment-spin{to{transform:rotate(360deg)}}
.nf-payment-dialog{border:1px solid #e3e9f2;border-radius:16px;padding:0;background:#fff;width:min(620px,calc(100vw - 28px));max-width:calc(100vw - 28px);max-height:calc(100dvh - 32px);box-shadow:0 24px 90px #091a4433;overflow:auto}.nf-payment-dialog.wide{width:min(980px,calc(100vw - 28px))}.nf-payment-dialog::backdrop{background:#14253d99;backdrop-filter:blur(4px)}
.nf-payment-dialog .nf-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e8edf4;padding:16px 22px}.nf-payment-dialog .nf-dialog-header h2{font-size:17px;font-weight:650}.nf-payment-dialog .nf-dialog-content{padding:22px}
.nf-payment-dialog .nf-payment-summary{display:flex;justify-content:space-between;gap:16px;padding:16px;background:#f5f8fd;border:1px solid #e5ecf7;border-radius:10px;margin-bottom:22px}.nf-payment-dialog .nf-payment-summary span{font-size:12px;font-weight:600}.nf-payment-dialog .nf-payment-summary small{display:block;color:#748399;font-weight:400;margin-top:5px;overflow-wrap:anywhere}.nf-payment-dialog .nf-payment-summary strong{font-size:20px;white-space:nowrap}
.nf-payment-dialog .nf-fieldset{border:0;padding:0;margin:0 0 22px;min-width:0}.nf-payment-dialog legend{display:flex;align-items:center;gap:9px;padding:0;margin-bottom:16px;font-size:12px;font-weight:650;color:#425570}.nf-payment-dialog legend span{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#edf3ff;border-radius:6px;color:#245bd8;font-size:10px}
.nf-payment-dialog .nf-form-grid{display:grid;gap:16px;margin-bottom:20px}.nf-payment-dialog .nf-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nf-payment-dialog .nf-form-grid label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:600;color:#52637b;min-width:0}.nf-payment-dialog .span-2{grid-column:1/-1}
.nf-payment-dialog .nf-form-grid input,.nf-payment-dialog .nf-form-grid select,.nf-payment-dialog .nf-form-grid textarea{display:block;width:100%;min-width:0;min-height:42px;border:1px solid #dfe6f0;border-radius:8px;padding:10px 12px;background:white;color:#273b56;font-size:13px;font-weight:400}.nf-payment-dialog textarea{resize:vertical}
.nf-payment-dialog .nf-upload{position:relative;display:inline-flex;align-items:center;gap:9px;max-width:100%;border:1px solid #ccd9ee;border-radius:8px;padding:11px 15px;cursor:pointer;color:#2b568c;background:#f6f9ff;font-size:12px;overflow-wrap:anywhere}.nf-payment-dialog .nf-upload svg{width:17px;height:17px;flex-shrink:0}.nf-payment-dialog .nf-upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.nf-payment-dialog .nf-upload:focus-within{outline:3px solid #93b4ff;outline-offset:3px}.nf-payment-dialog .nf-upload strong{font-weight:600}
.nf-payment-dialog .nf-info{padding:12px;background:#f7f9fc;border-radius:8px;color:#79879b;font-size:11px}.nf-payment-dialog .nf-modal-footer{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding-top:18px;margin-top:20px;border-top:1px solid #e8edf4}
.nf-payment-dialog .nf-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;color:#6c7d94;font-size:12px}.nf-payment-dialog .nf-preview-toolbar>span{display:flex;align-items:center;gap:8px}.nf-payment-dialog .nf-preview{height:65dvh;min-height:240px;overflow:auto;display:flex;justify-content:center;align-items:center;border:1px solid #dce4ef;border-radius:9px;background:#eef2f7}.nf-payment-dialog .nf-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain}.nf-payment-dialog .nf-preview iframe{width:100%;height:100%;border:0;background:#fff}
@container(max-width:1050px){.nf-payment-requests .nf-table-wrap{display:none}.nf-payment-requests .nf-mobile-docs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0 20px 20px}.nf-payment-requests .nf-mobile-doc{min-width:0;border:1px solid #e2e9f2;border-radius:11px;overflow:hidden;background:white}.nf-payment-requests .nf-mobile-doc.expanded{grid-column:1/-1}.nf-payment-requests .nf-mobile-doc>header{display:flex;align-items:center;gap:9px;padding:16px;border-bottom:1px solid #edf1f6}.nf-payment-requests .nf-mobile-doc>header>div{flex:1;min-width:0;overflow-wrap:anywhere}.nf-payment-requests .nf-mobile-doc>header strong{font-size:12px}.nf-payment-requests .nf-mobile-doc>header small{display:block;font-size:11px;color:#8a97a8}.nf-payment-requests .nf-mobile-doc>dl{display:grid;gap:16px;padding:16px;margin:0}.nf-payment-requests .nf-mobile-doc dt{font-size:10px;color:#8593a6;margin-bottom:4px}.nf-payment-requests .nf-mobile-doc dd{margin:0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.nf-payment-requests .nf-mobile-doc dd small{display:block;font-size:12px;color:#64748b;line-height:1.7;margin-top:6px}.nf-payment-requests .nf-mobile-doc>footer{display:flex;justify-content:flex-end;gap:8px;padding:0 16px 16px;flex-wrap:wrap}.nf-payment-requests .nf-mobile-doc .nf-detail{border-radius:0;border-width:1px 0 0}}
@container(max-width:620px){.nf-payment-requests .nf-header{align-items:flex-start;gap:10px}.nf-payment-requests .nf-header-actions .nf-btn{font-size:0;padding:10px}.nf-payment-requests .nf-header-actions .nf-btn svg{width:18px;height:18px}.nf-payment-requests .nf-eyebrow{font-size:8px;letter-spacing:.8px}.nf-payment-requests .nf-stats{grid-template-columns:1fr;gap:9px;margin-bottom:16px}.nf-payment-requests .nf-stat{padding:14px 16px;display:grid;grid-template-columns:1fr auto;column-gap:12px;align-items:center}.nf-payment-requests .nf-stat-top{margin:0;font-size:11px}.nf-payment-requests .nf-stat-top svg{display:none}.nf-payment-requests .nf-stat strong{font-size:22px}.nf-payment-requests .nf-stat small{grid-column:1/-1;margin-top:2px}.nf-payment-requests .nf-panel-top{padding:12px}.nf-payment-requests .nf-segment{display:flex}.nf-payment-requests .nf-segment button{flex:1;font-size:11px;padding:7px;gap:6px}.nf-payment-requests .nf-toolbar{padding:14px 12px;flex-direction:column;align-items:stretch;gap:8px}.nf-payment-requests .nf-list-heading{padding:2px 14px 14px}.nf-payment-requests .nf-mobile-docs{grid-template-columns:1fr;padding:0 12px 12px;gap:12px}.nf-payment-requests .nf-detail{grid-template-columns:1fr;padding:16px;gap:20px}.nf-payment-requests .nf-detail dl{grid-template-columns:1fr}.nf-payment-requests .nf-pagination{padding:14px 12px;flex-wrap:wrap;font-size:10px}.nf-payment-requests .nf-pagination>div{gap:8px}}
@media(max-width:600px){.nf-payment-dialog .nf-dialog-header{padding:12px 14px}.nf-payment-dialog .nf-dialog-header h2{font-size:15px}.nf-payment-dialog .nf-dialog-content{padding:14px}.nf-payment-dialog .nf-form-grid.two{grid-template-columns:1fr}.nf-payment-dialog .nf-form-grid input,.nf-payment-dialog .nf-form-grid select,.nf-payment-dialog .nf-form-grid textarea{font-size:16px}.nf-payment-dialog .nf-payment-summary{flex-direction:column}.nf-payment-dialog .nf-modal-footer .nf-btn{flex:1}.nf-payment-dialog .nf-preview-toolbar{flex-wrap:wrap}.nf-payment-dialog .nf-preview{height:60dvh}}
@media(prefers-reduced-motion:reduce){.nf-spin{animation:none}.nf-payment-requests *,.nf-payment-dialog *{transition:none!important}}
`;
