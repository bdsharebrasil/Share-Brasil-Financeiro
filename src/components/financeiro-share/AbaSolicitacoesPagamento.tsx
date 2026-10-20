import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleDollarSign, Clock, FileText, RefreshCw, Search, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  buscarContasBancariasHolding,
  buscarSolicitacoesPagamento,
  darBaixaContaAPagar,
  enviarComprovanteReembolso,
  formatarData,
  formatarMoeda,
  type CamposLancamento,
  type ContaBancaria,
  type ReembolsoColaborador,
  type SolicitacaoPagamento,
} from "@/lib/financeiro-share-api";
import { buscarAeronavesShare } from "@/lib/colaborador-api";
import { Modal, STYLES } from "./NFSaidaTab";

const POR_PAGINA = 12;

type AbaSolicitacao = "cotista" | "colaborador";
type FiltroLista = { id: string; label: string; quantidade?: number };
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

function detalheLancamento(campos: CamposLancamento, acao?: ReactNode): ReactNode {
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
        ? anexos.map(({ rotulo, url }) => <a key={rotulo} href={url} target="_blank" rel="noopener noreferrer"><FileText size={13} />{rotulo}</a>)
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
        {campos.tipo_caixa && <div><dt>Caixa</dt><dd>{campos.tipo_caixa}</dd></div>}
        {campos.fluxo && <div><dt>Fluxo</dt><dd>{campos.fluxo}</dd></div>}
        {campos.data_emissao && <div><dt>Emissão</dt><dd>{dataLegivel(campos.data_emissao)}</dd></div>}
        {campos.data_vencimento && <div><dt>Vencimento</dt><dd>{dataLegivel(campos.data_vencimento)}</dd></div>}
        {campos.data_pagamento && <div><dt>Pagamento</dt><dd>{dataLegivel(campos.data_pagamento)}</dd></div>}
        {campos.pago_por && <div><dt>Pago por</dt><dd>{campos.pago_por}</dd></div>}
        {campos.reembolsavel != null && <div><dt>Reembolsável</dt><dd>{Number(campos.reembolsavel) === 1 ? "Sim" : "Não"}</dd></div>}
        {campos.pago_diretamente != null && <div><dt>Pago diretamente</dt><dd>{Number(campos.pago_diretamente) === 1 ? "Sim" : "Não"}</dd></div>}
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
  const [envios, setEnvios] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaSolicitacao>("cotista");
  const [alvo, setAlvo] = useState<ReembolsoColaborador | null>(null);
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
      setEnvios(dados.envios);
      setReembolsos(dados.reembolsos);
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
    if (!alvo?.id || !bancoId) return;
    setSalvando(true);
    try {
      let comprovanteUrl: string | undefined;
      if (comprovanteArquivo) {
        setEnviandoComprovante(true);
        comprovanteUrl = (await enviarComprovanteReembolso(alvo.id, comprovanteArquivo)).url;
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
    setAlvo(item);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setBancoId("");
    setComprovanteArquivo(null);
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
      matricula?.trim() || (id ? matriculasAeronaves[id] : null) || null,
    [matriculasAeronaves],
  );

  const enviosFiltrados = useMemo(() => envios.filter((item) => {
    const atendeFiltro = atendeFiltroCaixaCliente(filtroEnvio, item.status);
    return atendeFiltro && (!busca || textoBusca(item.id, item.descricao, item.cliente_razao_social, item.lancamento_categoria_nome, item.grupo_categoria, item.lancamento_fornecedor_nome, item.fornecedor_nome, item.fornecedor, item.solicitante_nome, rotuloAeronave(item.aeronave_id, item.aeronave_matricula ?? item.matricula_registro)).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [envios, filtroEnvio, busca, rotuloAeronave]);

  const reembolsosFiltrados = useMemo(() => reembolsos.filter((item) => {
    const vencido = item.dataVencimento.slice(0, 10) < hoje;
    const atendeFiltro = filtroReembolso === "TODOS" || (filtroReembolso === "VENCIDOS" && vencido);
    return atendeFiltro && (!busca || textoBusca(item.id, item.documento, item.descricao, item.fornecedor, item.numeroVoo, item.cotistaNome, item.solicitanteNome, item.aeronaveId, rotuloAeronave(item.aeronaveId, item.aeronave_matricula ?? item.matricula_registro)).includes(busca.toLocaleLowerCase("pt-BR")));
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
    const aeronave = rotuloAeronave(item.aeronave_id, item.aeronave_matricula ?? item.matricula_registro);
    return {
      chave,
      expandida,
      documento: primeiroTexto(item.numero_nf, item.numero_recibo, item.numero_doc, item.numero_demonstrativo) ?? "—",
      dataEmissao: dataLegivel(item.data_emissao ?? item.data_despesa),
      cliente: primeiroTexto(item.cliente_razao_social, item.cliente_nome, item.razao_social, item.socio_nome, item.hold_socios_nome, item.hold_socios?.nome, item.cotista_nome, item.holding_nome) ?? "—",
      principal: primeiroTexto(item.descricao, aeronave) ?? "—",
      secundaria: [aeronave, item.lancamento_categoria_nome ?? item.categoria_nome, item.grupo_categoria, item.lancamento_fornecedor_nome ?? item.fornecedor_nome ?? item.fornecedor].filter(Boolean).join(" · "),
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : Number(item.valor ?? 0))}`,
      status: item.status,
      detalhe: expandida ? detalheLancamento(item) : null,
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
      principal: primeiroTexto(rotuloAeronave(item.aeronave_id ?? item.aeronaveId, item.aeronave_matricula ?? item.matricula_registro), item.descricao) ?? "—",
      secundaria: [item.grupo_categoria ?? item.categoriaNome, item.fornecedor_nome ?? item.fornecedor].filter(Boolean).join(" · "),
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : item.valor)}`,
      status: item.status,
      detalhe: expandida ? detalheLancamento(item, <button type="button" className="nf-btn primary" onClick={() => abrirBaixa(item)}><CheckCircle2 /> Dar baixa</button>) : null,
    };
  });

  const linhas = aba === "cotista" ? linhasEnvio : linhasReembolso;

  return (
    <div className="nf-workspace nf-payment-requests" style={{ background: "#080d17" }}>
      <style>{STYLES}</style>
      <style>{`.nf-workspace.nf-payment-requests{background:#080d17}.nf-workspace.nf-payment-requests .nf-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:4px 0 12px;padding:0 12px}.nf-workspace.nf-payment-requests .nf-stat{padding:12px 14px;border-radius:10px;background:#111b2b;box-shadow:none}.nf-workspace.nf-payment-requests .nf-stat:before{top:12px;bottom:12px}.nf-workspace.nf-payment-requests .nf-stat-top{margin-bottom:8px}.nf-workspace.nf-payment-requests .nf-stat-top span{font-size:10px}.nf-workspace.nf-payment-requests .nf-stat-top svg{width:16px;height:16px}.nf-workspace.nf-payment-requests .nf-stat strong{font-size:clamp(17px,1.5vw,21px);font-weight:600}.nf-workspace.nf-payment-requests .nf-stat small{margin-top:4px;font-size:9px}.nf-workspace.nf-payment-requests .nf-table{table-layout:fixed;white-space:normal}.nf-workspace.nf-payment-requests .nf-table th,.nf-workspace.nf-payment-requests .nf-table td{padding:12px 10px;overflow-wrap:anywhere}.nf-workspace.nf-payment-requests .nf-table th:nth-child(1){width:16%}.nf-workspace.nf-payment-requests .nf-table th:nth-child(2){width:20%}.nf-workspace.nf-payment-requests .nf-table th:nth-child(3){width:27%}.nf-workspace.nf-payment-requests .nf-table th:nth-child(4){width:12%}.nf-workspace.nf-payment-requests .nf-table th:nth-child(5){width:13%}.nf-workspace.nf-payment-requests .nf-table th:nth-child(6){width:12%}.nf-workspace.nf-payment-requests .nf-table .nf-btn{min-height:36px;padding:8px}.@container(max-width:760px){.nf-workspace.nf-payment-requests .nf-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
      <header className="nf-header">
        <div><div className="nf-eyebrow"><span className="nf-dot" /> FINANCEIRO / SOLICITAÇÕES DE PAGAMENTO</div></div>
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
                      <td><div className="nf-doc-cell"><div><strong>{linha.principal}</strong>{linha.secundaria && <small title={linha.secundaria}>{linha.secundaria}</small>}</div></div></td>
                      <td className="right nf-amount">{linha.valor}</td>
                      <td><StatusSolicitacao status={linha.status} /></td>
                      <td className="right"><button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></td>
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
                <footer><button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></footer>
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
            <label className="nf-upload"><Upload /><span><strong>{comprovanteArquivo ? comprovanteArquivo.name : "Selecione o comprovante (opcional)"}</strong><small>PDF, PNG, JPG ou WebP • até 10 MB</small></span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { selecionarComprovante(e.target.files?.[0]); e.target.value = ""; }} /></label>
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
