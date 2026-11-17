import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  atualizarDocumentoGestao,
  carregarDocumentoGestao,
  excluirDocumentoGestao,
  enviarDocumentoGestao,
  type FichaColaborador,
} from "@/lib/colaborador-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  brl,
  dataBr,
  formatarFuncao,
  hojeLocal,
  inativo,
  mensagemGestao,
  nomeColaborador,
  validarArquivo,
} from "@/lib/gestao-colaboradores";
import {
  AvatarColaborador,
  AvisoGestao,
  DadoFicha,
  StatusColaborador,
  VazioColaboradores,
} from "@/components/colaboradores/ComponentesColaboradores";
import "@/components/colaboradores/colaboradores.css";

type Documento = FichaColaborador["documentos"][number];
export function FichaColaboradorAbas({
  ficha,
  onClose,
  onEdit,
}: {
  ficha: FichaColaborador;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { perfil } = ficha;
  const hoje = hojeLocal();
  const feriasAtuais =
    ficha.ferias.some(
      (f) =>
        f.status.toLowerCase() === "aprovada" &&
        f.data_inicio <= hoje &&
        f.data_fim >= hoje,
    ) || perfil.status?.toLowerCase() === "ferias";
  return (
    <div>
      <button type="button" className="rh-profile-back" onClick={onClose}>
        <ArrowLeft size={15} /> Todos os colaboradores
      </button>
      <Tabs defaultValue="pessoal">
        <section className="rh-panel rh-profile-header">
          <div className="rh-profile-identity">
            <div className="rh-profile-name">
              <AvatarColaborador
                nome={nomeColaborador(perfil)}
                url={perfil.url_avatar}
                colaboradorId={perfil.id}
                grande
              />
              <div>
                <StatusColaborador
                  tom={
                    inativo(perfil.status)
                      ? "neutro"
                      : feriasAtuais
                        ? "ambar"
                        : "verde"
                  }
                >
                  {inativo(perfil.status)
                    ? "Inativo"
                    : feriasAtuais
                      ? "Em férias"
                      : "Ativo"}
                </StatusColaborador>
                <h1 id="rh-perfil-titulo" tabIndex={-1}>
                  {nomeColaborador(perfil)}
                </h1>
                <div className="rh-profile-contact">
                  <span>
                    {perfil.departamento || "Departamento não informado"}
                  </span>
                  <a href={`mailto:${perfil.email}`}>
                    <Mail size={13} />
                    {perfil.email}
                  </a>
                  {perfil.telefone && (
                    <a href={`tel:${perfil.telefone.replace(/[^+\d]/g, "")}`}>
                      <Phone size={13} />
                      {perfil.telefone}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button type="button" className="rh-btn" onClick={onEdit}>
              <Pencil size={15} /> Editar cadastro
            </button>
          </div>
          <TabsList
            className="rh-profile-tabs"
            aria-label="Informações do colaborador"
          >
            <TabsTrigger value="pessoal" className="rh-profile-tab">
              <UserRound size={15} /> Dados pessoais
            </TabsTrigger>
            <TabsTrigger value="profissional" className="rh-profile-tab">
              <BriefcaseBusiness size={15} /> Profissional
            </TabsTrigger>
            <TabsTrigger value="documentos" className="rh-profile-tab">
              <FolderOpen size={15} /> Documentos
            </TabsTrigger>
            <TabsTrigger value="ferias" className="rh-profile-tab">
              <CalendarDays size={15} /> Férias
            </TabsTrigger>
            <TabsTrigger value="extrato" className="rh-profile-tab">
              <WalletCards size={15} /> Extrato recebido
            </TabsTrigger>
          </TabsList>
        </section>
        <TabsContent value="pessoal" className="rh-profile-content rh-enter">
          <div className="rh-profile-layout">
            <div>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Informações pessoais</h2>
                  <UserRound size={16} className="rh-text-muted" />
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha
                    titulo="Nome completo"
                    valor={perfil.nome_completo}
                  />
                  <DadoFicha
                    titulo="Nome de exibição"
                    valor={perfil.nome_exibicao}
                  />
                  <DadoFicha
                    titulo="Data de nascimento"
                    valor={dataBr(perfil.data_nascimento)}
                  />
                  <DadoFicha titulo="CPF" valor={perfil.cpf} />
                  <DadoFicha titulo="RG" valor={perfil.rg} />
                  <DadoFicha titulo="CANAC" valor={perfil.canac} />
                </dl>
              </section>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Contato e localização</h2>
                  <MapPin size={16} className="rh-text-muted" />
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha titulo="E-mail" valor={perfil.email} />
                  <DadoFicha titulo="Telefone" valor={perfil.telefone} />
                  <DadoFicha
                    titulo="Cidade / UF"
                    valor={[perfil.cidade, perfil.uf]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                </dl>
              </section>
            </div>
            <ResumoVinculo ficha={ficha} />
          </div>
        </TabsContent>
        <TabsContent
          value="profissional"
          className="rh-profile-content rh-enter"
        >
          <div className="rh-profile-layout">
            <div>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Vínculo com a Share Brasil</h2>
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha
                    titulo="Departamento"
                    valor={perfil.departamento}
                  />
                  <DadoFicha
                    titulo="Data de admissão"
                    valor={dataBr(perfil.data_admissao)}
                  />
                  <DadoFicha
                    titulo="Situação"
                    valor={
                      inativo(perfil.status)
                        ? "Inativo"
                        : feriasAtuais
                          ? "Em férias"
                          : "Ativo"
                    }
                  />
                </dl>
                <div style={{ padding: "0 23px 23px" }}>
                  <p className="rh-inline-meta" style={{ marginBottom: 9 }}>
                    Funções no sistema
                  </p>
                  <div className="rh-actions">
                    {ficha.funcoes.length ? (
                      ficha.funcoes.map((f) => (
                        <StatusColaborador key={f.id} tom="azul">
                          {formatarFuncao(f.funcao)}
                        </StatusColaborador>
                      ))
                    ) : (
                      <p className="rh-inline-meta">
                        Nenhuma função cadastrada.
                      </p>
                    )}
                  </div>
                </div>
              </section>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Exame admissional</h2>
                  <StatusColaborador
                    tom={perfil.exame_admissional_realizado ? "verde" : "ambar"}
                  >
                    {perfil.exame_admissional_realizado
                      ? "Realizado"
                      : "Pendente"}
                  </StatusColaborador>
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha
                    titulo="Data do exame"
                    valor={dataBr(perfil.exame_admissional_data)}
                  />
                  <DadoFicha
                    titulo="Local"
                    valor={perfil.exame_admissional_local}
                  />
                  <DadoFicha
                    titulo="Empresa responsável"
                    valor={perfil.exame_admissional_empresa}
                  />
                  <DadoFicha
                    titulo="Prazo para realizar"
                    valor={dataBr(perfil.exame_admissional_prazo)}
                  />
                  <DadoFicha
                    titulo="Comprovante"
                    valor={
                      perfil.exame_admissional_documento_id
                        ? "Anexado em documentos"
                        : "Não anexado"
                    }
                  />
                </dl>
              </section>
            </div>
            <ResumoVinculo ficha={ficha} />
          </div>
        </TabsContent>
        <TabsContent value="documentos" className="rh-profile-content rh-enter">
          <DocumentosColaborador
            documentos={ficha.documentos}
            colaboradorId={perfil.id}
          />
        </TabsContent>
        <TabsContent value="ferias" className="rh-profile-content rh-enter">
          <section className="rh-panel">
            <header className="rh-panel-head">
              <div>
                <h2>Histórico de férias</h2>
                <p>{ficha.ferias.length} solicitação(ões)</p>
              </div>
              <CalendarDays size={17} className="rh-text-muted" />
            </header>
            {ficha.ferias.length ? (
              <div className="rh-table-wrap">
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Dias</th>
                      <th>Situação</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.ferias.map((f) => (
                      <tr key={f.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {dataBr(f.data_inicio)} a {dataBr(f.data_fim)}
                        </td>
                        <td>{f.quantidade_dias}</td>
                        <td>
                          <StatusColaborador
                            tom={
                              f.status === "aprovada"
                                ? "verde"
                                : f.status === "solicitada"
                                  ? "ambar"
                                  : f.status === "reprovada"
                                    ? "vermelho"
                                    : "neutro"
                            }
                          >
                            {{
                              aprovada: "Aprovada",
                              solicitada: "Solicitada",
                              reprovada: "Reprovada",
                              cancelada: "Cancelada",
                            }[f.status] || f.status}
                          </StatusColaborador>
                        </td>
                        <td>{f.motivo_reprovacao || f.observacoes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VazioColaboradores
                titulo="Nenhuma solicitação de férias"
                detalhe="As solicitações deste colaborador aparecerão aqui."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="extrato" className="rh-profile-content rh-enter">
          <section className="rh-panel">
            <header className="rh-panel-head">
              <div>
                <h2>Extrato do colaborador</h2>
                <p>Últimos {ficha.recebimentos.length} registros disponíveis</p>
              </div>
              <WalletCards size={17} className="rh-text-muted" />
            </header>
            {ficha.recebimentos.length ? (
              <div className="rh-table-wrap">
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Vencimento</th>
                      <th>Pagamento</th>
                      <th>Situação</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.recebimentos.map((r) => {
                      const status = String(r.status || "").toLowerCase();
                      const pago =
                        Boolean(r.data_pagamento) || status === "pago";
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong>
                              {r.descricao || r.tipo || "Recebimento"}
                            </strong>
                            {r.observacoes && (
                              <p className="rh-inline-meta">{r.observacoes}</p>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {dataBr(
                              String(
                                r.data_vencimento ||
                                  r.vencimento ||
                                  r.data ||
                                  "",
                              ),
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {dataBr(r.data_pagamento)}
                          </td>
                          <td>
                            <StatusColaborador
                              tom={
                                status === "cancelado"
                                  ? "neutro"
                                  : pago
                                    ? "verde"
                                    : "ambar"
                              }
                            >
                              {status === "cancelado"
                                ? "Cancelado"
                                : pago
                                  ? "Pago"
                                  : status === "pendente"
                                    ? "Pendente"
                                    : String(r.status || "Registrado").replace(
                                        /_/g,
                                        " ",
                                      )}
                            </StatusColaborador>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                            }}
                          >
                            {brl(r.valor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <VazioColaboradores
                titulo="Nenhum recebimento disponível"
                detalhe="Os registros financeiros vinculados ao colaborador aparecerão aqui."
              />
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
function ResumoVinculo({ ficha }: { ficha: FichaColaborador }) {
  return (
    <aside className="rh-panel">
      <header className="rh-panel-head">
        <h2>Na Share Brasil</h2>
        <BriefcaseBusiness size={16} className="rh-text-muted" />
      </header>
      <dl className="rh-side-body">
        <DadoFicha
          titulo="Admissão"
          valor={dataBr(ficha.perfil.data_admissao)}
        />
        <DadoFicha titulo="Departamento" valor={ficha.perfil.departamento} />
        <DadoFicha
          titulo="Exame admissional"
          valor={
            <StatusColaborador
              tom={ficha.perfil.exame_admissional_realizado ? "verde" : "ambar"}
            >
              {ficha.perfil.exame_admissional_realizado
                ? "Realizado"
                : "Pendente"}
            </StatusColaborador>
          }
        />
      </dl>
    </aside>
  );
}
function DocumentosColaborador({
  documentos: iniciais,
  colaboradorId,
}: {
  documentos: Documento[];
  colaboradorId: string;
}) {
  const [documentos, setDocumentos] = useState(iniciais);
  const [selecionado, setSelecionado] = useState<Documento | null>(
    iniciais[0] || null,
  );
  const [preview, setPreview] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroPreview, setErroPreview] = useState("");
  const [aviso, setAviso] = useState("");
  const [categoria, setCategoria] = useState("");
  const [arquivo, setArquivo] = useState<File>();
  const [uploader, setUploader] = useState(false);
  const [editando, setEditando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const trava = useRef(false);
  useEffect(() => {
    setDocumentos(iniciais);
    setSelecionado(iniciais[0] || null);
  }, [iniciais]);
  useEffect(() => {
    let ativo = true;
    let url = "";
    setPreview("");
    setErroPreview("");
    setExcluir(false);
    setCarregando(Boolean(selecionado));
    if (!selecionado) return;
    void carregarDocumentoGestao(colaboradorId, String(selecionado.id))
      .then((blob) => {
        if (!ativo) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch((cause) => {
        if (ativo)
          setErroPreview(
            mensagemGestao(
              cause,
              "Não foi possível abrir este arquivo. Tente novamente.",
            ),
          );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [colaboradorId, selecionado, tentativa]);
  const limpar = () => {
    setUploader(false);
    setEditando(false);
    setArquivo(undefined);
    setCategoria("");
    setErro("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const salvar = async () => {
    if (trava.current) return;
    if (!arquivo && !editando) {
      setErro("Selecione um arquivo para enviar.");
      return;
    }
    if (arquivo) {
      const issue = validarArquivo(arquivo);
      if (issue) {
        setErro(issue);
        return;
      }
    }
    trava.current = true;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const documento =
        editando && selecionado
          ? await atualizarDocumentoGestao(
              colaboradorId,
              String(selecionado.id),
              categoria || "documentos",
              arquivo,
            )
          : await enviarDocumentoGestao(
              colaboradorId,
              arquivo!,
              categoria || "documentos",
            );
      const atualizado: Documento = {
        ...documento,
        criado_em:
          documento.criado_em ||
          (editando ? selecionado?.criado_em : null) ||
          new Date().toISOString(),
      };
      setDocumentos((current) =>
        editando
          ? current.map((d) => (d.id === atualizado.id ? atualizado : d))
          : [atualizado, ...current],
      );
      setSelecionado(atualizado);
      limpar();
      setAviso("Documento salvo com sucesso.");
    } catch (cause) {
      setErro(
        mensagemGestao(
          cause,
          "Não foi possível salvar o documento. Tente novamente.",
        ),
      );
    } finally {
      setSalvando(false);
      trava.current = false;
    }
  };
  const remover = async () => {
    if (!selecionado || trava.current) return;
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      await excluirDocumentoGestao(colaboradorId, String(selecionado.id));
      const restantes = documentos.filter((d) => d.id !== selecionado.id);
      setDocumentos(restantes);
      setSelecionado(restantes[0] || null);
      setExcluir(false);
      limpar();
      setAviso("Documento excluído.");
    } catch (cause) {
      setErro(
        mensagemGestao(
          cause,
          "Não foi possível excluir o documento. Tente novamente.",
        ),
      );
    } finally {
      setSalvando(false);
      trava.current = false;
    }
  };
  const baixar = () => {
    if (!preview || !selecionado) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = selecionado.nome_arquivo || "documento";
    a.click();
  };
  const mime = String(
    selecionado?.mime_type || selecionado?.tipo_arquivo || "",
  ).toLowerCase();
  const grupos = documentos.reduce<Record<string, Documento[]>>((acc, doc) => {
    const key = String(doc.criado_em || "").slice(0, 7) || "Sem data";
    (acc[key] ||= []).push(doc);
    return acc;
  }, {});
  return (
    <div>
      <section className="rh-panel">
        <header className="rh-panel-head">
          <div>
            <h2>Documentos do colaborador</h2>
            <p>{documentos.length} arquivo(s) · PDF, JPG, PNG ou WEBP</p>
          </div>
          <button
            type="button"
            className="rh-btn rh-btn-primary"
            disabled={salvando}
            onClick={() => {
              limpar();
              setUploader(true);
            }}
          >
            <Plus size={16} /> Anexar documento
          </button>
        </header>
        {uploader && (
          <div style={{ padding: 20 }} className="rh-enter">
            <div className="rh-fields">
              <label className="rh-field">
                Categoria
                <input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex.: Identificação, contrato, exame"
                  className="rh-input"
                  disabled={salvando}
                />
              </label>
              <label className="rh-field">
                {editando
                  ? "Substituir arquivo (opcional)"
                  : "Arquivo · até 10 MB"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0]);
                    setErro("");
                  }}
                  className="rh-input"
                  disabled={salvando}
                />
              </label>
            </div>
            <div className="rh-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="rh-btn rh-btn-primary"
                onClick={() => void salvar()}
                disabled={salvando}
              >
                {salvando ? (
                  <Loader2 size={16} className="rh-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {editando ? "Salvar alteração" : "Enviar documento"}
              </button>
              <button
                type="button"
                className="rh-btn"
                onClick={limpar}
                disabled={salvando}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
      <div style={{ marginTop: 15 }}>
        {erro && (
          <AvisoGestao erro onClose={() => setErro("")}>
            {erro}
          </AvisoGestao>
        )}
        {aviso && (
          <AvisoGestao onClose={() => setAviso("")}>{aviso}</AvisoGestao>
        )}
      </div>
      <div className="rh-doc-layout">
        <section className="rh-panel">
          <header className="rh-panel-head">
            <h3>Arquivos</h3>
            <FolderOpen size={16} className="rh-text-muted" />
          </header>
          {documentos.length ? (
            Object.entries(grupos).map(([periodo, docs]) => (
              <details key={periodo} open>
                <summary
                  className="rh-inline-meta"
                  style={{
                    padding: "12px 15px",
                    background: "var(--rh-suave)",
                    cursor: "pointer",
                  }}
                >
                  {periodo === "Sem data"
                    ? periodo
                    : new Date(`${periodo}-01T12:00:00`).toLocaleDateString(
                        "pt-BR",
                        { month: "long", year: "numeric" },
                      )}{" "}
                  · {docs.length}
                </summary>
                {docs.map((doc) => (
                  <button
                    type="button"
                    className="rh-doc-button"
                    aria-pressed={selecionado?.id === doc.id}
                    disabled={salvando}
                    key={doc.id}
                    onClick={() => {
                      setSelecionado(doc);
                      limpar();
                    }}
                  >
                    <FileText size={17} style={{ flexShrink: 0 }} />
                    <span style={{ minWidth: 0 }}>
                      <strong>{doc.nome_arquivo || "Documento"}</strong>
                      <small>
                        {doc.categoria || "Documento"} · {dataBr(doc.criado_em)}
                      </small>
                    </span>
                  </button>
                ))}
              </details>
            ))
          ) : (
            <VazioColaboradores
              titulo="Nenhum documento anexado"
              detalhe="Adicione os arquivos para organizar a ficha."
            />
          )}
        </section>
        <section className="rh-panel">
          <header className="rh-panel-head" style={{ flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ overflowWrap: "anywhere" }}>
                {selecionado?.nome_arquivo || "Visualização do documento"}
              </h3>
              {selecionado && <p>{selecionado.categoria || "Documento"}</p>}
            </div>
            <div className="rh-actions">
              {selecionado && (
                <>
                  <button
                    type="button"
                    className="rh-btn rh-icon-btn"
                    aria-label="Editar documento"
                    disabled={salvando}
                    onClick={() => {
                      limpar();
                      setEditando(true);
                      setCategoria(selecionado.categoria || "documentos");
                      setUploader(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rh-btn rh-icon-btn rh-btn-danger"
                    aria-label="Excluir documento"
                    disabled={salvando}
                    onClick={() => setExcluir(true)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              {preview && (
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Baixar documento"
                  onClick={baixar}
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </header>
          {excluir && (
            <div
              className="rh-upload rh-enter"
              style={{ margin: 15 }}
              role="alert"
            >
              <h3>Excluir este documento?</h3>
              <p className="rh-inline-meta" style={{ margin: "5px 0 14px" }}>
                O arquivo será removido permanentemente da ficha.
              </p>
              <div className="rh-actions">
                <button
                  type="button"
                  className="rh-btn rh-btn-danger"
                  disabled={salvando}
                  onClick={() => void remover()}
                >
                  {salvando ? "Excluindo..." : "Excluir documento"}
                </button>
                <button
                  type="button"
                  className="rh-btn"
                  disabled={salvando}
                  onClick={() => setExcluir(false)}
                >
                  Manter arquivo
                </button>
              </div>
            </div>
          )}
          <div className="rh-doc-preview">
            {!selecionado ? (
              <p className="rh-inline-meta">
                Selecione um arquivo para visualizar.
              </p>
            ) : carregando ? (
              <p className="rh-actions" role="status">
                <Loader2 size={18} className="rh-spin" /> Carregando
                documento...
              </p>
            ) : erroPreview ? (
              <div>
                <AvisoGestao erro>{erroPreview}</AvisoGestao>
                <button
                  type="button"
                  className="rh-btn"
                  onClick={() => setTentativa((v) => v + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : preview && mime === "application/pdf" ? (
              <iframe
                src={preview}
                title={`Documento: ${selecionado.nome_arquivo}`}
              />
            ) : preview && mime.startsWith("image/") ? (
              <img
                src={preview}
                alt={selecionado.nome_arquivo || "Documento do colaborador"}
              />
            ) : (
              <div>
                <p className="rh-inline-meta">
                  A pré-visualização deste formato não está disponível.
                </p>
                <button
                  type="button"
                  className="rh-btn"
                  onClick={baixar}
                  style={{ marginTop: 12 }}
                >
                  Baixar arquivo
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
