import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gift,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { FichaColaboradorAbas } from "@/components/GestaoColaboradorAbas";
import { EditorFichaColaborador } from "@/components/colaboradores/EditorFichaColaborador";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  atualizarGestaoColaborador,
  buscarFichaColaborador,
  buscarFeriasCorporativas,
  buscarGestaoColaboradores,
  criarUsuarioColaborador,
  enviarDocumentoGestao,
  type ColaboradorGestao,
  type FeriasCorporativasResponse,
  type FichaColaborador,
} from "@/lib/colaborador-api";
import {
  dataBr,
  hojeLocal,
  inativo,
  mensagemGestao,
  nomeColaborador,
  normalizar,
} from "@/lib/gestao-colaboradores";
import {
  AvatarColaborador,
  AvisoGestao,
  StatusColaborador,
  VazioColaboradores,
} from "@/components/colaboradores/ComponentesColaboradores";
import {
  FormularioColaborador,
  type CadastroColaborador,
} from "@/components/colaboradores/FormularioColaborador";
import "@/components/colaboradores/colaboradores.css";

export default function GestaoColaborador() {
  const [colaboradores, setColaboradores] = useState<ColaboradorGestao[]>([]);
  const [busca, setBusca] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ordem, setOrdem] = useState("nome");
  const [pagina, setPagina] = useState(1);
  const [visual, setVisual] = useState<"lista" | "cards">("lista");
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [ficha, setFicha] = useState<FichaColaborador | null>(null);
  const [editorFicha, setEditorFicha] = useState<"pessoal" | "profissional" | null>(null);
  const [erro, setErro] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [aviso, setAviso] = useState("");
  const [aba, setAba] = useState<"ativos" | "inativos">("ativos");
  const [resumoFerias, setResumoFerias] =
    useState<FeriasCorporativasResponse | null>(null);
  // Retém o cadastro e os uploads concluídos enquanto este formulário estiver aberto.
  // Uma falha de anexo nunca deve disparar uma segunda criação da mesma pessoa.
  const progresso = useRef<{
    perfil: ColaboradorGestao | null;
    arquivos: Map<string, string>;
  }>({ perfil: null, arquivos: new Map() });
  const [parcial, setParcial] = useState(false);
  const travaSalvar = useRef(false);
  const travaFicha = useRef(false);
  const retornoFoco = useRef("");

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      setColaboradores(await buscarGestaoColaboradores());
    } catch (cause) {
      setErro(
        mensagemGestao(
          cause,
          "Não foi possível carregar os colaboradores. Tente atualizar a página.",
        ),
      );
    } finally {
      setCarregando(false);
    }
  };
  const carregarResumo = () => {
    void buscarFeriasCorporativas(hojeLocal())
      .then(setResumoFerias)
      .catch(() => setResumoFerias(null));
  };
  useEffect(() => {
    void carregar();
    carregarResumo();
  }, []);
  useEffect(() => setPagina(1), [aba, busca, departamento, ordem]);
  const ativos = useMemo(
    () => colaboradores.filter((item) => !inativo(item.status)),
    [colaboradores],
  );
  const departamentos = useMemo(
    () =>
      [
        ...new Set(colaboradores.map((p) => p.departamento).filter(Boolean)),
      ].sort((a, b) => a!.localeCompare(b!, "pt-BR")),
    [colaboradores],
  );
  const filtrados = useMemo(
    () =>
      colaboradores
        .filter(
          (item) =>
            (aba === "inativos"
              ? inativo(item.status)
              : !inativo(item.status)) &&
            (!departamento || item.departamento === departamento) &&
            normalizar(
              `${item.nome_completo} ${item.nome_exibicao || ""} ${item.email} ${item.departamento || ""}`,
            ).includes(normalizar(busca)),
        )
        .sort((a, b) =>
          ordem === "admissao"
            ? (b.data_admissao || "").localeCompare(a.data_admissao || "") ||
              nomeColaborador(a).localeCompare(nomeColaborador(b), "pt-BR")
            : nomeColaborador(a).localeCompare(nomeColaborador(b), "pt-BR"),
        ),
    [aba, busca, departamento, ordem, colaboradores],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 12));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const exibidos = filtrados.slice((paginaAtual - 1) * 12, paginaAtual * 12);
  const hoje = hojeLocal();
  const emFerias = (item: ColaboradorGestao) =>
    normalizar(item.status || "") === "ferias" ||
    Boolean(
      resumoFerias?.registros.some(
        (r) =>
          r.colaborador_id === item.id &&
          r.status.toLowerCase() === "aprovada" &&
          r.data_inicio <= hoje &&
          r.data_fim >= hoje,
      ),
    );
  const abrirFicha = async (item: ColaboradorGestao) => {
    if (travaFicha.current) return;
    travaFicha.current = true;
    retornoFoco.current = item.id;
    setAbrindo(item.id);
    setErro("");
    try {
      setFicha(await buscarFichaColaborador(item.id));
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() =>
        document.getElementById("rh-perfil-titulo")?.focus(),
      );
    } catch (cause) {
      setErro(
        mensagemGestao(
          cause,
          "Não foi possível abrir a ficha. Tente novamente.",
        ),
      );
    } finally {
      setAbrindo("");
      travaFicha.current = false;
    }
  };
  const abrirFormulario = () => {
    setErroForm("");
    setParcial(false);
    progresso.current = { perfil: null, arquivos: new Map() };
    setFormAberto(true);
  };
  const fecharFormulario = () => {
    if (salvando) return;
    setFormAberto(false);
    if (parcial) {
      setAviso(
        "Cadastro salvo. Os documentos pendentes podem ser enviados na ficha do colaborador.",
      );
      void carregar();
    }
    setParcial(false);
  };
  const salvar = async ({ values, exame, anexos }: CadastroColaborador) => {
    if (travaSalvar.current) return;
    travaSalvar.current = true;
    setSalvando(true);
    setErroForm("");
    try {
      const anterior = progresso.current.perfil;
      const perfil = anterior
        ? Object.keys(values).length
          ? await atualizarGestaoColaborador(anterior.id, values)
          : anterior
        : await criarUsuarioColaborador(values);
      progresso.current.perfil = perfil;
      setParcial(true);
      const enviar = async (
        arquivo: File,
        categoria: string,
        nome: string,
        chave: string,
      ) => {
        const assinatura = `${chave}:${arquivo.name}:${arquivo.size}:${arquivo.lastModified}`;
        let id = progresso.current.arquivos.get(assinatura);
        if (!id) {
          const doc = await enviarDocumentoGestao(
            perfil.id,
            arquivo,
            categoria,
            nome,
          );
          id = String(doc.id);
          progresso.current.arquivos.set(assinatura, id);
        }
        return id;
      };
      if (exame) {
        const id = await enviar(
          exame,
          "exame_admissional",
          exame.name,
          "exame",
        );
        await atualizarGestaoColaborador(perfil.id, {
          exame_admissional_documento_id: id,
        });
      }
      for (const anexo of anexos)
        await enviar(anexo.arquivo, "documentos", anexo.nome, anexo.chave);
      setFormAberto(false);
      setParcial(false);
      setAviso("Colaborador cadastrado. O acesso já está disponível.");
      // Recarrega a fonte oficial para refletir funções, exame e documentos.
      if (ficha?.perfil.id === perfil.id) {
        try {
          setFicha(await buscarFichaColaborador(perfil.id));
        } catch {
          setFicha(null);
          setAviso(
            "Cadastro salvo. Abra a ficha novamente para consultar as informações atualizadas.",
          );
        }
      }
      await carregar();
      carregarResumo();
    } catch (cause) {
      setErroForm(
        `${progresso.current.perfil ? "O cadastro foi salvo, mas o envio não foi concluído. Tente novamente para enviar os documentos pendentes. " : ""}${mensagemGestao(cause, "Não foi possível concluir o cadastro. Confira os dados e tente novamente.")}`,
      );
    } finally {
      setSalvando(false);
      travaSalvar.current = false;
    }
  };
  const salvarEdicaoFicha = async (alteracoes: Record<string, unknown>) => {
    if (!ficha) return;
    const colaboradorId = ficha.perfil.id;
    await atualizarGestaoColaborador(colaboradorId, alteracoes);
    await carregar();
    try {
      setFicha(await buscarFichaColaborador(colaboradorId));
      setAviso("Alterações salvas com sucesso.");
    } catch {
      setAviso("Alterações salvas. Reabra a ficha para consultar os dados atualizados.");
    }
    carregarResumo();
  };
  const status = (item: ColaboradorGestao) => (
    <StatusColaborador
      tom={inativo(item.status) ? "neutro" : emFerias(item) ? "ambar" : "verde"}
    >
      {inativo(item.status)
        ? "Inativo"
        : emFerias(item)
          ? "Em férias"
          : "Ativo"}
    </StatusColaborador>
  );
  const grupos = departamentos
    .map((d) => ({
      nome: d!,
      total: ativos.filter((p) => p.departamento === d).length,
    }))
    .filter((d) => d.total)
    .sort((a, b) => b.total - a.total);
  const aniversarios = ativos
    .filter((p) => p.data_nascimento?.slice(5, 7) === hoje.slice(5, 7))
    .sort((a, b) =>
      a
        .data_nascimento!.slice(8, 10)
        .localeCompare(b.data_nascimento!.slice(8, 10)),
    );
  const indicadores = [
    {
      titulo: "Colaboradores ativos",
      valor: carregando ? "—" : String(ativos.length),
      detalhe: "Pessoas na equipe",
      icon: Users,
    },
    {
      titulo: "Em férias",
      valor: resumoFerias ? String(resumoFerias.resumo.ativas) : "—",
      detalhe: resumoFerias ? "Afastamentos atuais" : "Resumo indisponível",
      icon: CalendarDays,
    },
    {
      titulo: "Férias solicitadas",
      valor: resumoFerias ? String(resumoFerias.resumo.solicitadas) : "—",
      detalhe: resumoFerias ? "Aguardando aprovação" : "Resumo indisponível",
      icon: CalendarDays,
    },
  ];
  const formulario = formAberto && (
    <FormularioColaborador
      inicial={null}
      salvando={salvando}
      erro={erroForm}
      parcial={parcial}
      onCancel={fecharFormulario}
      onSave={salvar}
    />
  );
  return (
    <div className="rh rh-enter">
      <header className="rh-top">
        <div>
          <p className="rh-eyebrow">Share Brasil / Pessoas</p>
          <h1>Gestão de Colaboradores</h1>
          <p className="rh-subtitle">
            Sua equipe, os cadastros e as informações de RH em um só lugar.
          </p>
        </div>
        <div className="rh-actions">
          <button
            type="button"
            className="rh-btn rh-icon-btn"
            onClick={() => {
              void carregar();
              carregarResumo();
            }}
            disabled={carregando}
            aria-label="Atualizar colaboradores"
          >
            <RefreshCw size={16} className={carregando ? "rh-spin" : ""} />
          </button>
          <button
            type="button"
            className="rh-btn rh-btn-primary"
            onClick={() => abrirFormulario()}
          >
            <Plus size={17} /> Novo colaborador
          </button>
        </div>
      </header>
      <section className="rh-metrics" aria-label="Resumo da equipe">
        {indicadores.map(({ titulo, valor, detalhe, icon: Icon }) => (
          <div className="rh-metric" key={titulo}>
            <div className="rh-metric-top">
              <span>{titulo}</span>
              <span className="rh-metric-icon">
                <Icon size={16} />
              </span>
            </div>
            <strong>{valor}</strong>
            <small>{detalhe}</small>
          </div>
        ))}
      </section>
      {erro && (
        <AvisoGestao erro onClose={() => setErro("")}>
          {erro}
        </AvisoGestao>
      )}
      {aviso && <AvisoGestao onClose={() => setAviso("")}>{aviso}</AvisoGestao>}
      <div className="rh-workspace rh-master-detail">
        <section className={`rh-panel rh-master-list ${ficha ? "rh-master-list-selected" : ""}`} aria-label="Diretório de colaboradores">
          <div className="rh-panel-head">
            <div>
              <h2>Equipe Share Brasil</h2>
              <p>Cadastro e acompanhamento dos colaboradores</p>
            </div>
            <div className="rh-view" aria-label="Visualização">
              <button
                type="button"
                aria-label="Visualizar em lista"
                aria-pressed={visual === "lista"}
                onClick={() => setVisual("lista")}
              >
                <List size={17} />
              </button>
              <button
                type="button"
                aria-label="Visualizar em cartões"
                aria-pressed={visual === "cards"}
                onClick={() => setVisual("cards")}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          </div>
          <div className="rh-tabs" aria-label="Situação dos colaboradores">
            <button
              type="button"
              aria-pressed={aba === "ativos"}
              onClick={() => setAba("ativos")}
            >
              Ativos<span className="rh-count">{ativos.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={aba === "inativos"}
              onClick={() => setAba("inativos")}
            >
              Inativos
              <span className="rh-count">
                {colaboradores.length - ativos.length}
              </span>
            </button>
          </div>
          <div className="rh-toolbar">
            <Field orientation="horizontal" className="rh-search">
              <FieldLabel htmlFor="rh-search" className="sr-only">Buscar colaboradores</FieldLabel>
              <Search size={17} />
              <Input
                id="rh-search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, e-mail ou departamento"
                className="rh-input"
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setBusca("")}
                >
                  ×
                </button>
              )}
            </Field>
            <Field className="rh-filter-field">
              <FieldLabel htmlFor="rh-departamento" className="sr-only">Filtrar departamento</FieldLabel>
              <Select value={departamento || "__TODOS__"} onValueChange={(value) => setDepartamento(value === "__TODOS__" ? "" : value)}>
                <SelectTrigger id="rh-departamento" className="rh-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos os departamentos</SelectItem>
                  {departamentos.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className="rh-filter-field">
              <FieldLabel htmlFor="rh-ordem" className="sr-only">Ordenar colaboradores</FieldLabel>
              <Select value={ordem} onValueChange={setOrdem}>
                <SelectTrigger id="rh-ordem" className="rh-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome: A–Z</SelectItem>
                  <SelectItem value="admissao">Admissão recente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {carregando ? (
            <div
              className="rh-loading"
              role="status"
              aria-label="Carregando colaboradores"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="rh-skeleton" />
              ))}
            </div>
          ) : !filtrados.length ? (
            <VazioColaboradores
              titulo={
                busca || departamento
                  ? "Nenhum resultado para os filtros"
                  : aba === "inativos"
                    ? "Nenhum colaborador inativo"
                    : "Sua equipe começa aqui"
              }
              detalhe={
                busca || departamento
                  ? "Tente outro nome ou selecione outro departamento."
                  : aba === "ativos"
                    ? "Adicione o primeiro colaborador para organizar os cadastros."
                    : undefined
              }
              acao={
                busca || departamento ? (
                  <button
                    type="button"
                    className="rh-btn"
                    onClick={() => {
                      setBusca("");
                      setDepartamento("");
                    }}
                  >
                    Limpar filtros
                  </button>
                ) : aba === "ativos" ? (
                  <button
                    type="button"
                    className="rh-btn rh-btn-primary"
                    onClick={() => abrirFormulario()}
                  >
                    <Plus size={16} /> Novo colaborador
                  </button>
                ) : undefined
              }
            />
          ) : visual === "lista" ? (
            <div className="rh-table-wrap">
              <table className="rh-table">
                <thead>
                  <tr>
                    <th scope="col">Colaborador</th>
                    <th scope="col">Departamento</th>
                    <th scope="col">Admissão</th>
                    <th scope="col">Exame</th>
                    <th scope="col">
                      <span className="sr-only">Abrir ficha</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exibidos.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="rh-person"
                          data-colaborador-ficha={item.id}
                          disabled={Boolean(abrindo)}
                          onClick={() => void abrirFicha(item)}
                        >
                          <AvatarColaborador
                            nome={nomeColaborador(item)}
                            url={item.url_avatar}
                            colaboradorId={item.id}
                          />
                          <span>
                            <strong>{nomeColaborador(item)}</strong>
                            <small>{item.email}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {item.departamento || (
                          <span className="rh-text-muted">Não informado</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {dataBr(item.data_admissao)}
                      </td>
                      <td>
                        <StatusColaborador
                          tom={
                            item.exame_admissional_realizado ? "verde" : "ambar"
                          }
                        >
                          {item.exame_admissional_realizado
                            ? "Realizado"
                            : "Pendente"}
                        </StatusColaborador>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="rh-btn rh-icon-btn"
                          disabled={Boolean(abrindo)}
                          aria-label={`Abrir ficha de ${nomeColaborador(item)}`}
                          onClick={() => void abrirFicha(item)}
                        >
                          {abrindo === item.id ? (
                            <Loader2 size={16} className="rh-spin" />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rh-grid rh-enter">
              {exibidos.map((item) => (
                <button
                  type="button"
                  className="rh-person-card"
                  data-colaborador-ficha={item.id}
                  key={item.id}
                  onClick={() => void abrirFicha(item)}
                  disabled={Boolean(abrindo)}
                >
                  <span className="rh-person">
                    <AvatarColaborador
                      nome={nomeColaborador(item)}
                      url={item.url_avatar}
                      colaboradorId={item.id}
                    />
                    <span>
                      <strong>{nomeColaborador(item)}</strong>
                      <small>
                        {item.departamento || "Departamento não informado"}
                      </small>
                    </span>
                  </span>
                  {status(item)}
                  <span
                    className="rh-inline-meta"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {item.email}
                  </span>
                  <span className="rh-person-card-bottom">
                    <span>Admissão {dataBr(item.data_admissao)}</span>
                    {abrindo === item.id ? (
                      <Loader2 size={16} className="rh-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <footer className="rh-footer">
            <span role="status">
              {filtrados.length
                ? `${(paginaAtual - 1) * 12 + 1}–${Math.min(paginaAtual * 12, filtrados.length)} de ${filtrados.length} colaboradores`
                : "0 colaboradores"}
            </span>
            <div className="rh-actions">
              <button
                type="button"
                className="rh-btn rh-icon-btn"
                aria-label="Página anterior"
                disabled={paginaAtual <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                <ChevronLeft size={15} />
              </button>
              <span>
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                type="button"
                className="rh-btn rh-icon-btn"
                aria-label="Próxima página"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        </section>
        <aside className={`rh-side rh-master-detail-pane ${ficha ? "rh-master-detail-pane-selected" : ""}`}>
          {ficha ? (
            <>
              <FichaColaboradorAbas
                key={ficha.perfil.id}
                ficha={ficha}
                onClose={() => {
                  setFicha(null);
                  setEditorFicha(null);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLElement>(
                        `[data-colaborador-ficha="${CSS.escape(retornoFoco.current)}"]`,
                      )
                      ?.focus(),
                  );
                }}
                onEditPessoal={() => setEditorFicha("pessoal")}
                onEditProfissional={() => setEditorFicha("profissional")}
              />
              {editorFicha && (
                <EditorFichaColaborador
                  perfil={ficha.perfil}
                  escopo={editorFicha}
                  onClose={() => setEditorFicha(null)}
                  onSave={salvarEdicaoFicha}
                />
              )}
            </>
          ) : (
            <>
          <section className="rh-panel" aria-label="Equipe por departamento">
            <header className="rh-panel-head">
              <h2>Equipe por departamento</h2>
              <Users size={16} className="rh-text-muted" />
            </header>
            <div className="rh-side-body">
              {grupos.length ? (
                grupos.map((g) => (
                  <button
                    type="button"
                    style={{ textAlign: "left" }}
                    key={g.nome}
                    onClick={() => {
                      setDepartamento(g.nome);
                      setAba("ativos");
                    }}
                  >
                    <span className="rh-bar-label">
                      <span>{g.nome}</span>
                      <strong>{g.total}</strong>
                    </span>
                    <span className="rh-bar">
                      <span
                        style={{
                          width: `${(g.total / Math.max(ativos.length, 1)) * 100}%`,
                        }}
                      />
                    </span>
                  </button>
                ))
              ) : (
                <p className="rh-side-note">
                  {carregando
                    ? "Carregando equipe..."
                    : "Nenhum departamento informado."}
                </p>
              )}
            </div>
          </section>
          <section className="rh-panel" aria-label="Aniversariantes do mês">
            <header className="rh-panel-head">
              <div>
                <h2>Aniversariantes</h2>
                <p>
                  {new Date().toLocaleDateString("pt-BR", { month: "long" })}
                </p>
              </div>
              <Gift size={17} className="rh-text-muted" />
            </header>
            <div className="rh-side-body">
              {aniversarios.length ? (
                aniversarios.map((p) => (
                  <button
                    type="button"
                    className="rh-person"
                    style={{ minWidth: 0 }}
                    key={p.id}
                    disabled={Boolean(abrindo)}
                    onClick={() => void abrirFicha(p)}
                  >
                    <AvatarColaborador
                      nome={nomeColaborador(p)}
                      url={p.url_avatar}
                      colaboradorId={p.id}
                    />
                    <span>
                      <strong>{nomeColaborador(p)}</strong>
                      <small>Dia {p.data_nascimento!.slice(8, 10)}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="rh-side-note">
                  {carregando
                    ? "Carregando aniversariantes..."
                    : "Nenhum aniversário informado neste mês."}
                </p>
              )}
            </div>
          </section>
            </>
          )}
        </aside>
      </div>
      {formulario}
    </div>
  );
}
