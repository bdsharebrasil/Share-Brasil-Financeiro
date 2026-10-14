import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleDollarSign, Clock, FileText, RefreshCw, Search, TriangleAlert, Upload, Wallet } from "lucide-react";
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
import { Modal, STYLES } from "./NFSaidaTab";

const POR_PAGINA = 12;

type AbaSolicitacao = "cotista" | "colaborador";
type FiltroLista = { id: string; label: string; quantidade?: number };
type LinhaExibida = {
  chave: string;
  expandida: boolean;
  documento: string;
  dataEmissao: string;
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
    CONVERTIDO: "Convertido",
    PAGO: "Pago",
    CANCELADO: "Cancelado",
    EM_ABERTO: "A pagar",
    AGUARDANDO_REEMBOLSO: "Aguardando reembolso",
  };
  return labels[estado] ?? estado.replace(/_/g, " ");
}

function estadoBadge(valor: string): "paid" | "pending" | "neutral" {
  const estado = valor.toUpperCase();
  if (["PAGO", "CONVERTIDO"].includes(estado)) return "paid";
  if (["APROVADO", "EMAIL_ENVIADO", "CANCELADO", "REJEITADO"].includes(estado)) return "neutral";
  return "pending";
}

function StatusSolicitacao({ status }: { status: string }) {
  if (status.toUpperCase() === "CONVERTIDO") return null;
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
        {campos.numero_boleto && <div><dt>Número do boleto</dt><dd>{campos.numero_boleto}</dd></div>}
        <div><dt>E-mail enviado em</dt><dd>{dataLegivel(campos.email_enviado_em ?? null)}</dd></div>
        <div><dt>Número do voo</dt><dd>{campos.numero_voo || "—"}</dd></div>
      </dl>
    </section>
    {acao && <div className="nf-detail-actions">{acao}</div>}
  </div>;
}

const FILTROS_ENVIO: FiltroLista[] = [
  { id: "TODOS", label: "Todos" },
  { id: "PENDENTES", label: "Pendentes" },
  { id: "EM_ANDAMENTO", label: "Em andamento" },
  { id: "CONCLUIDOS", label: "Convertidos" },
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarSolicitacoesPagamento();
      setEnvios(dados.envios);
      setReembolsos(dados.reembolsos);
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

  const enviosFiltrados = useMemo(() => envios.filter((item) => {
    const estado = item.status.toUpperCase();
    const atendeFiltro = filtroEnvio === "TODOS"
      || (filtroEnvio === "PENDENTES" && estado === "PENDENTE")
      || (filtroEnvio === "EM_ANDAMENTO" && ["APROVADO", "EMAIL_ENVIADO"].includes(estado))
      || (filtroEnvio === "CONCLUIDOS" && estado === "CONVERTIDO")
      || (filtroEnvio === "CANCELADOS" && estado === "CANCELADO");
    return atendeFiltro && (!busca || textoBusca(item.id, item.descricao, item.fornecedor_nome, item.fornecedor, item.solicitante_nome).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [envios, filtroEnvio, busca]);

  const reembolsosFiltrados = useMemo(() => reembolsos.filter((item) => {
    const vencido = item.dataVencimento.slice(0, 10) < hoje;
    const atendeFiltro = filtroReembolso === "TODOS" || (filtroReembolso === "VENCIDOS" && vencido);
    return atendeFiltro && (!busca || textoBusca(item.id, item.documento, item.descricao, item.fornecedor, item.numeroVoo, item.cotistaNome, item.solicitanteNome, item.aeronaveId).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [reembolsos, filtroReembolso, busca, hoje]);

  const opcoesEnvio: FiltroLista[] = useMemo(() => FILTROS_ENVIO.map((filtro) => ({
    ...filtro,
    quantidade: envios.filter((item) => {
      const estado = item.status.toUpperCase();
      if (filtro.id === "TODOS") return true;
      if (filtro.id === "PENDENTES") return estado === "PENDENTE";
      if (filtro.id === "EM_ANDAMENTO") return ["APROVADO", "EMAIL_ENVIADO"].includes(estado);
      if (filtro.id === "CONCLUIDOS") return estado === "CONVERTIDO";
      return estado === "CANCELADO";
    }).length,
  })), [envios]);

  const reembolsosVencidos = reembolsos.filter((item) => item.dataVencimento.slice(0, 10) < hoje);
  const opcoesReembolso: FiltroLista[] = [
    { id: "TODOS", label: "Todos", quantidade: reembolsos.length },
    { id: "VENCIDOS", label: "Vencidos", quantidade: reembolsosVencidos.length },
  ];

  const enviosPendentes = envios.filter((item) => item.status.toUpperCase() === "PENDENTE");
  const totalCaixaCliente = envios.reduce((soma, item) => soma + Number(item.valor ?? 0), 0);
  const totalPendentes = enviosPendentes.reduce((soma, item) => soma + Number(item.valor ?? 0), 0);
  const totalReembolsos = reembolsos.reduce((soma, item) => soma + item.valor, 0);
  const totalVencidos = reembolsosVencidos.reduce((soma, item) => soma + item.valor, 0);

  const filtrosAtuais = aba === "cotista" ? opcoesEnvio : opcoesReembolso;
  const filtroAtual = aba === "cotista" ? filtroEnvio : filtroReembolso;
  const placeholderBusca = aba === "cotista" ? "Buscar solicitação, fornecedor ou solicitante" : "Buscar documento, descrição, fornecedor, voo ou cotista";
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
    return {
      chave,
      expandida,
      documento: primeiroTexto(item.numero_nf, item.numero_recibo, item.numero_doc, item.numero_demonstrativo) ?? "—",
      dataEmissao: dataLegivel(item.data_emissao ?? item.data_despesa),
      principal: primeiroTexto(item.aeronave_id, item.cotista_aeronave_id, item.descricao) ?? "—",
      secundaria: [item.grupo_categoria, item.fornecedor_nome ?? item.fornecedor].filter(Boolean).join(" · "),
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
      principal: primeiroTexto(item.aeronave_id, item.aeronaveId, item.cotista_aeronave_id, item.descricao) ?? "—",
      secundaria: [item.grupo_categoria ?? item.categoriaNome, item.fornecedor_nome ?? item.fornecedor].filter(Boolean).join(" · "),
      valor: `−${formatarMoeda(item.valor_centavos != null ? item.valor_centavos / 100 : item.valor)}`,
      status: item.status,
      detalhe: expandida ? detalheLancamento(item, <button type="button" className="nf-btn primary" onClick={() => abrirBaixa(item)}><CheckCircle2 /> Dar baixa</button>) : null,
    };
  });

  const linhas = aba === "cotista" ? linhasEnvio : linhasReembolso;

  return (
    <div className="nf-workspace" style={{ background: "var(--nf-bg)" }}>
      <style>{STYLES}</style>
      <header className="nf-header">
        <div><div className="nf-eyebrow"><span className="nf-dot" /> FINANCEIRO / SOLICITAÇÕES DE PAGAMENTO</div></div>
        <div className="nf-header-actions">
          <button className="nf-btn" disabled={carregando} onClick={() => void carregar()}><RefreshCw className={carregando ? "nf-spin" : ""} /> Atualizar</button>
        </div>
      </header>
      <section className="nf-stats" aria-label="Resumo das solicitações" aria-busy={carregando}>
        {[
          { label: "Caixa cliente", valor: formatarMoeda(totalCaixaCliente), nota: `${envios.length} ${envios.length === 1 ? "solicitação" : "solicitações"}`, Icon: Wallet, cor: "blue" },
          { label: "Pendentes", valor: formatarMoeda(totalPendentes), nota: `${enviosPendentes.length} aguardando aprovação`, Icon: Clock, cor: "cyan" },
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
            <p>{carregando ? "Carregando…" : `${totalItens} ${aba === "cotista" ? (totalItens === 1 ? "solicitação" : "solicitações") : (totalItens === 1 ? "título" : "títulos")} encontrados`}{temFiltro && <button className="nf-text-btn" onClick={limparFiltros}>Limpar filtros</button>}</p>
          </div>
        </div>
        {carregando ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><h3>Carregando solicitações</h3><p>Organizando as informações de pagamento.</p></div>
          : erro ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível carregar</h3><p>{erro}</p><button className="nf-btn" onClick={() => void carregar()}>Tentar novamente</button></div>
          : totalItens === 0 ? <div className="nf-empty"><Search /><h3>{temFiltro ? "Nenhum resultado encontrado" : "Nada por aqui"}</h3><p>{temFiltro ? "Ajuste a busca ou o filtro para encontrar o registro." : aba === "cotista" ? "Não há solicitações de pagamento de caixa cliente." : "Não há reembolsos pendentes de colaboradores."}</p>{temFiltro && <button className="nf-btn" onClick={limparFiltros}>Limpar filtros</button>}</div>
          : <>
            <div className="nf-table-wrap">
              <table className="nf-table">
                <caption className="nf-sr">{aba === "cotista" ? "Solicitações de pagamento de caixa cliente" : "Reembolsos de colaboradores"}</caption>
                <thead><tr><th scope="col">Doc / emissão</th><th scope="col">Aeronave / descrição</th><th scope="col" className="right">Valor</th><th scope="col">Status</th><th scope="col" className="right">Ações</th></tr></thead>
                <tbody>
                  {linhas.map((linha) => <Fragment key={linha.chave}>
                    <tr>
                      <td><div className="nf-doc-cell"><span className="nf-doc-icon"><FileText /></span><div><strong>{linha.documento}</strong><small>{linha.dataEmissao}</small></div></div></td>
                      <td><div className="nf-doc-cell"><div><strong>{linha.principal}</strong>{linha.secundaria && <small title={linha.secundaria}>{linha.secundaria}</small>}</div></div></td>
                      <td className="right nf-amount">{linha.valor}</td>
                      <td><StatusSolicitacao status={linha.status} /></td>
                      <td className="right"><button type="button" className="nf-btn" aria-expanded={linha.expandida} onClick={() => alternarDetalhe(linha.chave)}>{linha.expandida ? "Fechar" : "Detalhes"}{linha.expandida ? <ChevronUp /> : <ChevronDown />}</button></td>
                    </tr>
                    {linha.expandida && <tr className="nf-detail-row"><td colSpan={5}>{linha.detalhe}</td></tr>}
                  </Fragment>)}
                </tbody>
              </table>
            </div>
            <div className="nf-mobile-docs">
              {linhas.map((linha) => <article className={`nf-mobile-doc${linha.expandida ? " expanded" : ""}`} key={linha.chave}>
                <header><span className="nf-doc-icon"><FileText /></span><div><strong>{linha.documento}</strong><small>{linha.dataEmissao}</small></div><StatusSolicitacao status={linha.status} /></header>
                <dl><div><dt>Aeronave / descrição</dt><dd>{linha.principal}{linha.secundaria && <small>{linha.secundaria}</small>}</dd></div><div><dt>Valor</dt><dd className="nf-amount">{linha.valor}</dd></div></dl>
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
