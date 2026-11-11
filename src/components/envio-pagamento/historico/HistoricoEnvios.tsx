import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock3, FileText, Folder, FolderOpen, History, Loader2, Mail, RefreshCw, Search, SearchX, Send, Trash2, X, XCircle } from "lucide-react";
import type { EnvioPagamento, RascunhoEnvioPagamento } from "@/lib/colaborador-api";
import { agruparHistorico, agruparHistoricoPorAeronave, agruparHistoricoPorMes, dataHistorico, moeda, normalizarBusca, prepararHistorico, registro } from "./history-model";
import type { FiltroHistorico, GrupoHistorico, ItemHistorico } from "./history-model";
import { useNomesCotistas } from "./useNomesCotistas";
import "./historico-envios.css";

export interface HistoricoEnviosProps {
  envios: EnvioPagamento[];
  rascunhos: RascunhoEnvioPagamento[];
  aeronaves?: Array<{ id: string; matricula_registro: string }>;
  carregando: boolean;
  erro?: string;
  rotuloTipo: (tipo: EnvioPagamento["tipo"]) => string;
  restauracaoId?: string | null;
  conversaoId?: string | null;
  restaurandoRascunho?: boolean;
  excluindoRascunhoId?: string | null;
  onVoltar: () => void;
  onAtualizar: () => void | Promise<void>;
  onAbrirPendente: (envio: EnvioPagamento) => void | Promise<void>;
  onRecuperarConversao: (envio: EnvioPagamento) => void | Promise<void>;
  onContinuarRascunho: (rascunho: RascunhoEnvioPagamento) => void | Promise<void>;
  onExcluirRascunho: (rascunho: RascunhoEnvioPagamento) => void;
}

const FILTROS: Array<{ id: FiltroHistorico; nome: string }> = [
  { id: "todos", nome: "Todos" }, { id: "pendente", nome: "Pendentes" },
  { id: "pago", nome: "Pagos" }, { id: "cancelado", nome: "Cancelados" },
];

function Badge({ item }: { item: ItemHistorico }) {
  return <span className={`hp-badge hp-badge--${item.situacao}`}><span aria-hidden="true" />{item.status}</span>;
}

function Metrica({ titulo, valor }: { titulo: string; valor: number }) {
  return <div className="hp-metric"><dt>{titulo}</dt><dd>{valor}</dd></div>;
}

function Info({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div><dt>{titulo}</dt><dd>{children || "Não informado"}</dd></div>;
}

function Evento({ icone, titulo, detalhe, tom = "neutro" }: { icone: ReactNode; titulo: string; detalhe: string; tom?: "neutro" | "ok" | "erro" }) {
  return <li className={`hp-event hp-event--${tom}`}><span className="hp-event-icon" aria-hidden="true">{icone}</span><div><strong>{titulo}</strong><p>{detalhe}</p></div></li>;
}

function Detalhe({ item, props, onFechar }: { item: ItemHistorico; props: HistoricoEnviosProps; onFechar: () => void }) {
  const tituloId = useId();
  const ocupado = Boolean(props.restauracaoId || props.restaurandoRascunho || props.conversaoId || props.excluindoRascunhoId);
  const restaurando = item.envio?.id === props.restauracaoId || (item.origem === "rascunho" && props.restaurandoRascunho);
  const rotulo = props.rotuloTipo(item.tipo as EnvioPagamento["tipo"]) || "Programação de pagamento";
  const fonte = registro(item.envio);
  const recuperar = item.envio && item.tipo === "cliente" && item.situacao === "pendente" && !item.lancamentoId && (item.status === "Lançado" || fonte.conversao_pendente === true || Boolean(fonte.erro_conversao));

  return (
    <article className="hp-detail" aria-labelledby={tituloId}>
      <header className="hp-detail-head">
        <div className="hp-detail-top"><span className="hp-eyebrow">{rotulo}</span><button type="button" className="hp-icon-button" onClick={onFechar} aria-label="Fechar detalhes"><X size={17} /></button></div>
        <Badge item={item} />
        <h2 id={tituloId} data-history-detail tabIndex={-1}>{item.descricao}</h2>
        <p className="hp-detail-caption">{item.cliente} · {item.fornecedor}</p>
        <p className="hp-detail-value">{moeda(item.valorCentavos)}</p>
        {item.origem === "rascunho" && item.envioVinculado && <p className="hp-note">Vinculado a uma programação já criada. Este valor não é somado novamente no histórico.</p>}
      </header>

      <dl className="hp-info-grid">
        <Info titulo="Responsável">{item.responsavel}</Info>
        <Info titulo={item.origem === "rascunho" ? "Atualizado em" : "Criado em"}>{dataHistorico(item.origem === "rascunho" ? item.atualizadoEm : item.criadoEm, true)}</Info>
        <Info titulo="Emissão">{dataHistorico(item.emissao)}</Info>
        <Info titulo="Vencimento">{dataHistorico(item.vencimento)}</Info>
        <Info titulo="Destino">{item.tipo === "cliente" ? "Caixa Cliente" : item.tipo === "reembolso" ? "Caixa Share + reembolso" : "Caixa Share"}</Info>
        <Info titulo={item.origem === "rascunho" ? "Etapa salva" : "Pagamento"}>{item.origem === "rascunho" ? `Etapa ${item.etapa + 1}` : dataHistorico(item.pagamento)}</Info>
        {item.categoria && <Info titulo="Categoria">{item.categoria}</Info>}
        {item.aeronave && <Info titulo="Aeronave">{item.aeronave}</Info>}
      </dl>

      {item.observacoes && <div className="hp-observations"><p className="hp-eyebrow">Observações</p><p>{item.observacoes}</p></div>}

      <section className="hp-timeline" aria-label="Trilha da programação">
        <h3 className="hp-eyebrow">Trilha da programação</h3>
        <ol>
          {item.origem === "rascunho" ? <Evento icone={<FileText size={15} />} titulo={item.status === "E-mail pendente" ? "Envio de e-mail em andamento" : "Rascunho salvo"} detalhe={`${dataHistorico(item.atualizadoEm, true)} · etapa ${item.etapa + 1}`} /> : <Evento icone={<FileText size={15} />} titulo="Programação criada" detalhe={`${dataHistorico(item.criadoEm, true)} · ${item.responsavel}`} />}
          {item.lancamentoId && <Evento icone={<Send size={15} />} titulo="Lançamento financeiro vinculado" detalhe={item.tipo === "cliente" ? "Registro vinculado no fluxo do cliente." : "Registro vinculado no fluxo da Share."} />}
          {item.emailEnviado && <Evento icone={<Mail size={15} />} titulo="E-mail enviado" detalhe={[item.emailDestinatario, item.emailEm ? dataHistorico(item.emailEm, true) : "Envio confirmado no registro"].filter(Boolean).join(" · ")} />}
          {item.origem === "envio" && !item.emailEnviado && <Evento icone={<Mail size={15} />} titulo="E-mail sem confirmação de envio" detalhe="O registro não informa um envio confirmado." />}
          {item.situacao === "pendente" && <Evento icone={<Clock3 size={15} />} titulo={item.status === "Em aprovação" ? "Aguardando aprovação" : "Programação pendente"} detalhe={item.vencimento ? `Vencimento em ${dataHistorico(item.vencimento)}.` : "Aguardando atualização do financeiro."} />}
          {item.situacao === "pago" && <Evento icone={<CheckCircle2 size={15} />} titulo="Pagamento concluído" detalhe={item.pagamento ? dataHistorico(item.pagamento, true) : "Status de quitação informado pelo financeiro."} tom="ok" />}
          {item.situacao === "cancelado" && <Evento icone={<XCircle size={15} />} titulo={item.status} detalhe={item.observacoes || "Situação informada no registro financeiro."} tom="erro" />}
        </ol>
      </section>

      {(item.rascunho || (item.envio && item.situacao === "pendente")) && <footer className="hp-detail-actions">
        {item.rascunho && <><button type="button" className="hp-button hp-button--primary" disabled={ocupado} onClick={() => item.rascunho && void props.onContinuarRascunho(item.rascunho)}>{restaurando ? <Loader2 className="hp-spin" size={16} /> : <ArrowRight size={16} />} Continuar rascunho</button><button type="button" className="hp-button hp-button--danger" disabled={ocupado} onClick={() => item.rascunho && props.onExcluirRascunho(item.rascunho)}><Trash2 size={15} /> Excluir rascunho</button></>}
        {item.envio && item.situacao === "pendente" && <button type="button" className="hp-button hp-button--primary" disabled={ocupado} onClick={() => item.envio && void props.onAbrirPendente(item.envio)}>{restaurando ? <Loader2 className="hp-spin" size={16} /> : <ArrowRight size={16} />} Abrir programação</button>}
        {recuperar && <button type="button" className="hp-button" disabled={ocupado} onClick={() => item.envio && void props.onRecuperarConversao(item.envio)}>{props.conversaoId === item.envio?.id ? <Loader2 className="hp-spin" size={15} /> : <RefreshCw size={15} />} Recuperar rateio</button>}
      </footer>}
    </article>
  );
}

function Pasta({ grupo, aberto, onAlternar, onAbrirAeronave, selecao, onSelecionar, uid, detalhe }: { grupo: GrupoHistorico; aberto: boolean; onAlternar: () => void; onAbrirAeronave?: () => void; selecao: string | null; onSelecionar: (id: string) => void; uid: string; detalhe?: ReactNode }) {
  const painel = useId();
  const navegacao = Boolean(onAbrirAeronave);
  return <section className="hp-folder">
    <h3><button type="button" className="hp-folder-toggle" aria-expanded={navegacao ? undefined : aberto} aria-controls={navegacao ? undefined : painel} aria-label={navegacao ? `Abrir histórico da aeronave ${grupo.nome}` : undefined} onClick={onAbrirAeronave ?? onAlternar}>
      <ChevronRight size={16} className={`hp-chevron ${!navegacao && aberto ? "hp-chevron--open" : ""}`} aria-hidden="true" />
      {!navegacao && aberto ? <FolderOpen className="hp-folder-icon" size={19} aria-hidden="true" /> : <Folder className="hp-folder-icon" size={19} aria-hidden="true" />}
      <span className="hp-folder-text"><span className="hp-folder-name">{grupo.nome}</span><span className="hp-folder-caption">{grupo.itens.length} {grupo.itens.length === 1 ? "programação" : "programações"}{grupo.pendentes > 0 ? ` · ${grupo.pendentes} pendente${grupo.pendentes > 1 ? "s" : ""}` : ""}</span></span>
      <span className="hp-folder-total">{moeda(grupo.totalCentavos)}</span>
    </button></h3>
    <div id={painel} hidden={navegacao || !aberto} className="hp-folder-content"><ul>
      {grupo.itens.map(item => <li key={item.id}>
        <button id={`${uid}-${item.id}`} type="button" className={`hp-row ${selecao === item.id ? "hp-row--selected" : ""}`} aria-expanded={selecao === item.id} onClick={() => onSelecionar(item.id)}>
          <span className="hp-row-main"><span className="hp-row-title">{item.descricao}</span><span className="hp-row-subtitle">{item.fornecedor}</span><span className="hp-row-meta">{item.origem === "rascunho" ? `Atualizado ${dataHistorico(item.atualizadoEm)}` : `Venc. ${dataHistorico(item.vencimento)}`} · {item.responsavel}</span></span>
          <span className="hp-row-side"><span className="hp-row-value">{moeda(item.valorCentavos)}</span><Badge item={item} /><span className="hp-row-signals">{item.lancamentoId && <span title="Lançamento vinculado"><Send size={12} aria-label="Lançamento vinculado" /></span>}{item.emailEnviado && <span title="E-mail enviado"><Mail size={12} aria-label="E-mail enviado" /></span>}<ChevronRight size={14} aria-hidden="true" /></span></span>
        </button>
        {selecao === item.id && <div className="hp-inline-detail">{detalhe}</div>}
      </li>)}
    </ul></div>
  </section>;
}

export function HistoricoEnvios(props: HistoricoEnviosProps) {
  const [aba, setAba] = useState<"historico" | "rascunhos">("historico");
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroHistorico>("todos");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [fechadosNaBusca, setFechadosNaBusca] = useState<Set<string>>(() => new Set());
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const uid = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const cabecalho = useRef<HTMLHeadingElement>(null);
  const nomesCotistas = useNomesCotistas(props.envios, props.rascunhos);
  const matriculasAeronaves = useMemo(() => Object.fromEntries((props.aeronaves ?? []).map(aeronave => [aeronave.id, aeronave.matricula_registro])), [props.aeronaves]);
  const { historico, rascunhos } = useMemo(() => prepararHistorico(props.envios, props.rascunhos, nomesCotistas, matriculasAeronaves), [props.envios, props.rascunhos, nomesCotistas, matriculasAeronaves]);
  const registrosAba = aba === "historico" ? historico : rascunhos;
  const origem = aeronaveSelecionada ? registrosAba.filter(item => item.aeronaveGrupoId === aeronaveSelecionada) : registrosAba;
  const termo = normalizarBusca(busca);
  const pesquisados = useMemo(() => origem.filter(item => !termo || item.busca.includes(termo)), [origem, termo]);
  const contagens = useMemo(() => {
    const counts: Record<FiltroHistorico, number> = { todos: pesquisados.length, pendente: 0, pago: 0, cancelado: 0, outro: 0, rascunho: 0 };
    pesquisados.forEach(item => counts[item.situacao]++);
    return counts;
  }, [pesquisados]);
  const visiveis = useMemo(() => pesquisados.filter(item => filtro === "todos" || item.situacao === filtro), [pesquisados, filtro]);
  const aeronaves = useMemo(() => agruparHistoricoPorAeronave(historico), [historico]);
  const aeronaveAtual = aeronaves.find(grupo => grupo.id === aeronaveSelecionada);
  const grupos = useMemo(() => aeronaveSelecionada && aba === "historico" ? agruparHistoricoPorMes(visiveis) : aba === "historico" ? agruparHistoricoPorAeronave(visiveis) : agruparHistorico(visiveis), [visiveis, aeronaveSelecionada, aba]);
  const selecao = visiveis.find(item => item.id === selecionado) ?? null;
  const filtrosAtivos = Boolean(termo || filtro !== "todos");
  const historicoResumo = useMemo(() => aeronaveSelecionada ? historico.filter(item => item.aeronaveGrupoId === aeronaveSelecionada) : historico, [historico, aeronaveSelecionada]);
  const resumo = useMemo(() => ({
    total: historicoResumo.filter(item => item.situacao !== "cancelado").reduce((total, item) => total + item.valorCentavos, 0),
    aberto: historicoResumo.filter(item => item.situacao === "pendente").reduce((total, item) => total + item.valorCentavos, 0),
    clientes: new Set(historicoResumo.flatMap(item => item.clienteIds)).size,
    share: historicoResumo.filter(item => item.tipo === "share" || item.tipo === "reembolso").length,
    emails: historicoResumo.filter(item => item.emailEnviado).length,
  }), [historicoResumo]);

  useEffect(() => { cabecalho.current?.focus({ preventScroll: true }); }, [aeronaveSelecionada]);
  useEffect(() => { setFechadosNaBusca(new Set()); }, [termo, filtro, aba]);
  useEffect(() => {
    if (!selecionado) return;
    const frame = requestAnimationFrame(() => {
      const titulo = Array.from(raiz.current?.querySelectorAll<HTMLElement>("[data-history-detail]") ?? []).find(elemento => elemento.getClientRects().length > 0);
      titulo?.focus({ preventScroll: true });
      titulo?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selecionado]);

  const alternar = (id: string) => {
    const atualizar = (atuais: Set<string>) => { const proximos = new Set(atuais); proximos.has(id) ? proximos.delete(id) : proximos.add(id); return proximos; };
    if (filtrosAtivos) setFechadosNaBusca(atualizar); else setAbertos(atualizar);
    if (selecao && grupos.find(grupo => grupo.id === id)?.itens.some(item => item.id === selecao.id)) setSelecionado(null);
  };
  const selecionar = (id: string) => setSelecionado(atual => atual === id ? null : id);
  const fecharDetalhe = () => {
    const anterior = selecionado;
    setSelecionado(null);
    requestAnimationFrame(() => document.getElementById(`${uid}-${anterior}`)?.focus({ preventScroll: true }));
  };
  const abrirAeronave = (id: string) => { setAeronaveSelecionada(id); setBusca(""); setFiltro("todos"); setSelecionado(null); };
  const voltarAeronaves = () => { setAeronaveSelecionada(null); setSelecionado(null); };
  const trocarAba = (proxima: "historico" | "rascunhos") => { setAba(proxima); setAeronaveSelecionada(null); setFiltro("todos"); setSelecionado(null); };
  const limpar = () => { setBusca(""); setFiltro("todos"); setSelecionado(null); };
  const detalhe = selecao ? <Detalhe item={selecao} props={props} onFechar={fecharDetalhe} /> : null;
  const filtros: Array<{ id: FiltroHistorico; nome: string }> = contagens.outro > 0 ? [...FILTROS, { id: "outro", nome: "Outros" }] : FILTROS;

  return <div className="hp-root" ref={raiz}>
    <div className="hp-page" aria-busy={props.carregando}>
      <header className="hp-page-header"><button type="button" className="hp-icon-button hp-back" onClick={aeronaveSelecionada ? voltarAeronaves : props.onVoltar} aria-label={aeronaveSelecionada ? "Voltar para lista de aeronaves" : "Voltar para programar pagamento"}><ArrowLeft size={18} /></button><div className="hp-page-heading"><h1 ref={cabecalho} tabIndex={-1}>{aeronaveSelecionada ? aeronaveAtual?.nome ?? "Histórico da aeronave" : "HISTÓRICO ENVIO DE PAGAMENTOS"}</h1><p>{aeronaveSelecionada ? "Histórico de envios separado por mês e ano." : ""}</p></div><button type="button" className="hp-button hp-refresh" onClick={() => void props.onAtualizar()} disabled={props.carregando} aria-label="Atualizar histórico"><RefreshCw size={15} className={props.carregando ? "hp-spin" : ""} /><span>Atualizar</span></button></header>

      <section className="hp-summary" aria-label={aeronaveSelecionada ? "Resumo do histórico da aeronave" : "Resumo geral do histórico"}>
        <div className="hp-summary-value" />
        <dl className="hp-summary-metrics"><Metrica titulo="Clientes" valor={resumo.clientes} /><Metrica titulo="Programações" valor={historicoResumo.length} /><Metrica titulo="Caixa Share" valor={resumo.share} /><Metrica titulo="Com e-mail" valor={resumo.emails} /></dl>
      </section>

      {!aeronaveSelecionada && <nav className="hp-sections" aria-label="Seção de pagamentos"><button type="button" aria-current={aba === "historico" ? "page" : undefined} onClick={() => trocarAba("historico")}><History size={15} /> Histórico <span>{historico.length}</span></button><button type="button" aria-current={aba === "rascunhos" ? "page" : undefined} onClick={() => trocarAba("rascunhos")}><FileText size={15} /> Rascunhos <span>{rascunhos.length}</span></button></nav>}

      <section className="hp-toolbar" aria-label="Buscar e filtrar"><div className="hp-search"><Search size={16} aria-hidden="true" /><input type="search" value={busca} onChange={event => { setBusca(event.target.value); setSelecionado(null); }} placeholder={aeronaveSelecionada ? "Buscar no histórico desta aeronave" : "Buscar por aeronave, cliente, fornecedor ou responsável"} aria-label="Buscar programações de pagamento" />{busca && <button type="button" className="hp-icon-button" onClick={() => setBusca("")} aria-label="Limpar busca"><X size={15} /></button>}</div>
        {aba === "historico" && <div className="hp-filters" aria-label="Situação">{filtros.map(opcao => <button type="button" key={opcao.id} aria-pressed={filtro === opcao.id} onClick={() => { setFiltro(opcao.id); setSelecionado(null); }}>{opcao.nome}<span>{contagens[opcao.id]}</span></button>)}</div>}
        <p className="hp-results" role="status" aria-live="polite">{visiveis.length} de {origem.length} {aba === "historico" ? "programações" : "rascunhos"}{aba === "rascunhos" ? " · Valores dos rascunhos não compõem o valor programado." : filtrosAtivos ? " · Filtros aplicados" : ""}</p>
      </section>

      {props.erro && <div className="hp-alert" role="alert"><p>{props.erro}</p><button type="button" className="hp-button" disabled={props.carregando} onClick={() => void props.onAtualizar()}>Tentar novamente</button></div>}
      {props.carregando && origem.length === 0 ? <div className="hp-empty" role="status"><Loader2 size={25} className="hp-spin" /><p>Carregando histórico…</p></div> : grupos.length === 0 ? <div className="hp-empty"><SearchX size={26} aria-hidden="true" /><h2>{filtrosAtivos ? "Nenhum resultado encontrado" : aeronaveSelecionada ? "Nenhuma programação para esta aeronave" : aba === "rascunhos" ? "Nenhum rascunho em andamento" : "Nenhuma programação registrada"}</h2><p>{filtrosAtivos ? "Ajuste a busca ou os filtros para encontrar uma programação." : aeronaveSelecionada ? "Os envios desta aeronave aparecerão aqui." : aba === "rascunhos" ? "Seus preenchimentos salvos aparecerão nesta seção." : "Nenhuma programação registrada."}</p>{filtrosAtivos && <button type="button" className="hp-button" onClick={limpar}>Limpar filtros</button>}</div> : <div className={`hp-workspace ${selecao ? "hp-workspace--selected" : ""}`}>
        <div className="hp-folders">{grupos.map(grupo => <Pasta key={grupo.id} grupo={grupo} aberto={filtrosAtivos ? !fechadosNaBusca.has(grupo.id) : abertos.has(grupo.id)} onAlternar={() => alternar(grupo.id)} onAbrirAeronave={aba === "historico" && !aeronaveSelecionada ? () => abrirAeronave(grupo.id) : undefined} selecao={selecao?.id ?? null} onSelecionar={selecionar} uid={uid} detalhe={detalhe} />)}</div>
        {selecao && <aside className="hp-aside" aria-label="Detalhes da programação">{detalhe}</aside>}
      </div>}
    </div>
  </div>;
}
