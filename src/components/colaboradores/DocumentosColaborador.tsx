import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  atualizarDocumentoGestao,
  carregarDocumentoGestao,
  excluirDocumentoGestao,
  enviarDocumentoGestao,
  type FichaColaborador,
} from "@/lib/colaborador-api";
import {
  dataBr,
  mensagemGestao,
  validarArquivo,
} from "@/lib/gestao-colaboradores";
import {
  agruparPastasDocumentos,
  criarCacheDocumentos,
  pastaDoDocumento,
  tamanhoDocumento,
  tipoDocumento,
  type ArquivoDocumento,
  type DocumentoColaborador,
} from "@/lib/documentos-colaborador";
import { criarMiniaturaPdf } from "@/lib/miniatura-documento";
import { AvisoGestao, VazioColaboradores } from "./ComponentesColaboradores";
import "./documentos-colaborador.css";

type Documento = FichaColaborador["documentos"][number];
type Cache = ReturnType<typeof criarCacheDocumentos>;
export function DocumentosColaborador({
  documentos: iniciais,
  colaboradorId,
}: {
  documentos: Documento[];
  colaboradorId: string;
}) {
  const [documentos, setDocumentos] = useState(iniciais);
  const [pastaChave, setPastaChave] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Documento | null>(null);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [uploader, setUploader] = useState(false);
  const [pastaNome, setPastaNome] = useState("");
  const [arquivo, setArquivo] = useState<File>();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);
  const trava = useRef(false);
  const datalistId = useId();
  const cache = useMemo(
    () =>
      criarCacheDocumentos((id) => carregarDocumentoGestao(colaboradorId, id)),
    [colaboradorId],
  );
  useEffect(() => () => cache.limpar(), [cache]);
  useEffect(() => {
    setDocumentos(iniciais);
    setSelecionado(null);
    cache.limpar();
  }, [iniciais, cache]);
  const pastas = useMemo(
    () => agruparPastasDocumentos(documentos),
    [documentos],
  );
  const pasta = pastas.find((p) => p.chave === pastaChave);
  const filtrados = (pasta?.documentos || []).filter((d) =>
    String(d.nome_arquivo || "")
      .toLocaleLowerCase("pt-BR")
      .includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 12));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const exibidos = filtrados.slice((paginaAtual - 1) * 12, paginaAtual * 12);
  const abrirPasta = (chave: string) => {
    setPastaChave(chave);
    setBusca("");
    setPagina(1);
  };
  const limparUpload = () => {
    setUploader(false);
    setEditando(null);
    setArquivo(undefined);
    setPastaNome("");
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  };
  const iniciarUpload = () => {
    limparUpload();
    setPastaNome(pasta?.nome || "Documentos pessoais");
    setUploader(true);
    requestAnimationFrame(() => pastaRef.current?.focus());
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
    if (!pastaNome.trim()) {
      setErro("Informe a pasta do documento.");
      pastaRef.current?.focus();
      return;
    }
    const existente = pastas.find(
      (p) =>
        p.nome.toLocaleLowerCase("pt-BR") ===
        pastaNome.trim().toLocaleLowerCase("pt-BR"),
    );
    const categoria =
      existente?.categoria ||
      (pastaNome.trim().toLocaleLowerCase("pt-BR") === "documentos pessoais"
        ? "documentos"
        : pastaNome.trim());
    trava.current = true;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const resposta = editando
        ? await atualizarDocumentoGestao(
            colaboradorId,
            String(editando.id),
            categoria,
            arquivo,
          )
        : await enviarDocumentoGestao(colaboradorId, arquivo!, categoria);
      const atualizado: Documento = {
        ...editando,
        ...resposta,
        categoria,
        criado_em:
          resposta.criado_em || editando?.criado_em || new Date().toISOString(),
      };
      cache.invalidar(String(atualizado.id));
      setDocumentos((current) =>
        editando
          ? current.map((d) => (d.id === atualizado.id ? atualizado : d))
          : [atualizado, ...current],
      );
      abrirPasta(pastaDoDocumento(atualizado).chave);
      limparUpload();
      setAviso(
        editando ? "Documento atualizado." : "Documento enviado com sucesso.",
      );
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
  const editar = (doc: Documento) => {
    setSelecionado(null);
    limparUpload();
    setEditando(doc);
    setPastaNome(pastaDoDocumento(doc).nome);
    setUploader(true);
    requestAnimationFrame(() => {
      pastaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      pastaRef.current?.focus();
    });
  };
  const remover = async (doc: Documento) => {
    if (trava.current) return;
    trava.current = true;
    setSalvando(true);
    try {
      await excluirDocumentoGestao(colaboradorId, String(doc.id));
      cache.invalidar(String(doc.id));
      setDocumentos((current) => current.filter((d) => d.id !== doc.id));
      setSelecionado(null);
      setAviso("Documento excluído.");
    } finally {
      setSalvando(false);
      trava.current = false;
    }
  };
  return (
    <div className="rh-documentos">
      <section className="rh-panel">
        <header className="rh-panel-head">
          <div>
            <h2>Documentos do colaborador</h2>
            <p>
              {pastas.length} {pastas.length === 1 ? "pasta" : "pastas"} ·{" "}
              {documentos.length}{" "}
              {documentos.length === 1 ? "arquivo" : "arquivos"}
            </p>
          </div>
          <button
            type="button"
            className="rh-btn rh-btn-primary"
            disabled={salvando}
            onClick={iniciarUpload}
          >
            <Plus size={16} /> Anexar documento
          </button>
        </header>
        {uploader && (
          <div className="rh-documentos-upload rh-enter">
            <div className="rh-fields">
              <label className="rh-field">
                Pasta
                <input
                  ref={pastaRef}
                  value={pastaNome}
                  onChange={(e) => setPastaNome(e.target.value)}
                  list={datalistId}
                  className="rh-input"
                  placeholder="Selecione ou digite o nome da pasta"
                  disabled={salvando}
                />
                <datalist id={datalistId}>
                  {pastas.map((p) => (
                    <option key={p.chave} value={p.nome} />
                  ))}
                </datalist>
              </label>
              <label className="rh-field">
                {editando
                  ? "Substituir arquivo (opcional)"
                  : "Arquivo · até 10 MB"}
                <input
                  key={editando?.id || "novo"}
                  ref={inputRef}
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
            <div className="rh-actions">
              <button
                type="button"
                className="rh-btn rh-btn-primary"
                disabled={salvando}
                onClick={() => void salvar()}
              >
                {salvando ? (
                  <Loader2 size={16} className="rh-spin" />
                ) : (
                  <Upload size={16} />
                )}{" "}
                {editando ? "Salvar alteração" : "Enviar documento"}
              </button>
              <button
                type="button"
                className="rh-btn"
                disabled={salvando}
                onClick={limparUpload}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
      {erro && (
        <AvisoGestao erro onClose={() => setErro("")}>
          {erro}
        </AvisoGestao>
      )}
      {aviso && <AvisoGestao onClose={() => setAviso("")}>{aviso}</AvisoGestao>}
      <div className="rh-documentos-browser">
        <aside
          className="rh-panel rh-documentos-pastas"
          aria-label="Pastas de documentos"
        >
          <header className="rh-panel-head">
            <h3>Pastas</h3>
            <FolderOpen size={17} className="rh-text-muted" />
          </header>
          <div className="rh-folder-list">
            {pastas.map((item, i) => (
              <button
                type="button"
                className="rh-folder-item"
                key={item.chave}
                aria-pressed={pastaChave === item.chave}
                onClick={() => abrirPasta(item.chave)}
              >
                <IconePasta tom={i % 4} />
                <span>
                  <strong>{item.nome}</strong>
                  <small>
                    {item.documentos.length}{" "}
                    {item.documentos.length === 1 ? "arquivo" : "arquivos"}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!pastas.length && (
              <p className="rh-folder-empty">
                As pastas aparecerão quando você anexar os documentos.
              </p>
            )}
          </div>
        </aside>
        <section
          className="rh-panel rh-documentos-galeria"
          aria-label="Arquivos da pasta"
        >
          <header className="rh-panel-head">
            <div>
              <h3>{pasta?.nome || "Arquivos"}</h3>
              <p>
                {pasta
                  ? `${filtrados.length} ${filtrados.length === 1 ? "arquivo" : "arquivos"}`
                  : "Selecione uma pasta"}
              </p>
            </div>
            {pasta && (
              <label className="rh-search rh-documentos-busca">
                <Search size={15} />
                <input
                  aria-label="Buscar documentos na pasta"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(1);
                  }}
                  placeholder="Buscar arquivo"
                />
              </label>
            )}
          </header>
          {!pasta ? (
            <VazioColaboradores
              titulo={
                pastas.length ? "Abra uma pasta" : "Nenhum documento anexado"
              }
              detalhe={
                pastas.length
                  ? "Escolha uma pasta para visualizar seus arquivos."
                  : "Anexe o primeiro documento para organizar a ficha."
              }
            />
          ) : !filtrados.length ? (
            <VazioColaboradores
              titulo="Nenhum arquivo encontrado"
              detalhe="Tente outro nome na busca."
            />
          ) : (
            <div className="rh-documentos-grid rh-enter" key={pasta.chave}>
              {exibidos.map((doc) => (
                <MiniaturaDocumento
                  key={`${doc.id}-${doc.criado_em}-${doc.tamanho_arquivo}`}
                  documento={doc}
                  cache={cache}
                  onOpen={() => setSelecionado(doc)}
                />
              ))}
            </div>
          )}
          {pasta && totalPaginas > 1 && (
            <footer className="rh-footer">
              <span>
                {(paginaAtual - 1) * 12 + 1}–
                {Math.min(paginaAtual * 12, filtrados.length)} de{" "}
                {filtrados.length}
              </span>
              <div className="rh-actions">
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Página anterior de documentos"
                  disabled={paginaAtual === 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {paginaAtual}/{totalPaginas}
                </span>
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Próxima página de documentos"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          )}
        </section>
      </div>
      {selecionado && (
        <VisualizadorDocumento
          key={String(selecionado.id)}
          documento={selecionado}
          cache={cache}
          salvando={salvando}
          onClose={() => {
            if (!salvando) setSelecionado(null);
          }}
          onEdit={() => editar(selecionado)}
          onDelete={() => remover(selecionado)}
        />
      )}
    </div>
  );
}
function IconePasta({ tom }: { tom: number }) {
  return (
    <svg
      className={`rh-folder-icon rh-folder-tone-${tom}`}
      viewBox="0 0 56 46"
      aria-hidden="true"
    >
      <path
        d="M3 10a5 5 0 0 1 5-5h13l5 5h22a5 5 0 0 1 5 5v25H3Z"
        className="rh-folder-back"
      />
      <rect
        x="8"
        y="13"
        width="39"
        height="26"
        rx="3"
        className="rh-folder-paper"
      />
      <path
        d="M3 21a4 4 0 0 1 4-4h13l4 4h25a4 4 0 0 1 4 4l-3 15a4 4 0 0 1-4 3H7a4 4 0 0 1-4-4Z"
        className="rh-folder-front"
      />
      <path d="M7 24h39" className="rh-folder-shine" />
    </svg>
  );
}
function MiniaturaDocumento({
  documento,
  cache,
  onOpen,
}: {
  documento: DocumentoColaborador;
  cache: Cache;
  onOpen: () => void;
}) {
  const [miniatura, setMiniatura] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let ativo = true;
    let iniciou = false;
    setMiniatura("");
    setCarregando(true);
    setFalhou(false);
    const carregar = () => {
      if (iniciou) return;
      iniciou = true;
      void cache
        .carregar(String(documento.id))
        .then(async (arquivo) => {
          const tipo = tipoDocumento(documento, arquivo.blob);
          const url =
            tipo === "pdf"
              ? await (arquivo.miniaturaPdf ||= criarMiniaturaPdf(arquivo.blob))
              : tipo === "imagem"
                ? arquivo.url
                : "";
          if (ativo) setMiniatura(url);
        })
        .catch(() => {
          if (ativo) setFalhou(true);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    };
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") carregar();
    else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            carregar();
            observer?.disconnect();
          }
        },
        { rootMargin: "160px" },
      );
      if (ref.current) observer.observe(ref.current);
    }
    return () => {
      ativo = false;
      observer?.disconnect();
    };
  }, [cache, documento]);
  return (
    <button
      ref={ref}
      type="button"
      className="rh-documento-card"
      onClick={onOpen}
      aria-label={`Abrir documento ${documento.nome_arquivo || "Documento"}`}
    >
      <span className="rh-documento-thumb">
        {miniatura ? (
          <img
            src={miniatura}
            alt=""
            loading="lazy"
            onError={() => {
              setMiniatura("");
              setFalhou(true);
            }}
          />
        ) : carregando ? (
          <Loader2 size={22} className="rh-spin" />
        ) : (
          <span className="rh-documento-fallback">
            <FileText size={36} />
            <small>
              {falhou
                ? "Abrir documento"
                : tipoDocumento(documento) === "pdf"
                  ? "PDF"
                  : "Arquivo"}
            </small>
          </span>
        )}
        <span className="rh-documento-expand">
          <Maximize2 size={17} />
        </span>
      </span>
      <span className="rh-documento-legenda">
        <strong>{documento.nome_arquivo || "Documento"}</strong>
        <small>
          {[
            tamanhoDocumento(
              documento.tamanho_arquivo || documento.tamanho_bytes,
            ),
            dataBr(documento.criado_em),
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
    </button>
  );
}
function VisualizadorDocumento({
  documento,
  cache,
  salvando,
  onClose,
  onEdit,
  onDelete,
}: {
  documento: Documento;
  cache: Cache;
  salvando: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [arquivo, setArquivo] = useState<ArquivoDocumento>();
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [confirmar, setConfirmar] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imagemFalhou, setImagemFalhou] = useState(false);
  useEffect(() => {
    let ativo = true;
    setArquivo(undefined);
    setErro("");
    void cache
      .carregar(String(documento.id))
      .then((d) => {
        if (ativo) setArquivo(d);
      })
      .catch((cause) => {
        if (ativo)
          setErro(
            mensagemGestao(
              cause,
              "Não foi possível abrir o documento. Tente novamente.",
            ),
          );
      });
    return () => {
      ativo = false;
    };
  }, [cache, documento, tentativa]);
  const tipo = tipoDocumento(documento, arquivo?.blob);
  const baixar = () => {
    if (!arquivo) return;
    const a = document.createElement("a");
    a.href = arquivo.url;
    a.download = documento.nome_arquivo || "documento";
    document.body.append(a);
    a.click();
    a.remove();
  };
  const excluir = async () => {
    setErro("");
    try {
      await onDelete();
    } catch (cause) {
      setErro(
        mensagemGestao(
          cause,
          "Não foi possível excluir o documento. Tente novamente.",
        ),
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rh rh-doc-dialog">
        <header className="rh-doc-modal-header">
          <div>
            <DialogTitle>{documento.nome_arquivo || "Documento"}</DialogTitle>
            <DialogDescription>
              {pastaDoDocumento(documento).nome} · {dataBr(documento.criado_em)}
            </DialogDescription>
          </div>
          <button
            type="button"
            className="rh-btn rh-icon-btn"
            onClick={onClose}
            disabled={salvando}
            aria-label="Fechar documento"
          >
            <X size={18} />
          </button>
        </header>
        <div className="rh-doc-modal-toolbar">
          <div className="rh-actions">
            <button
              type="button"
              className="rh-btn"
              onClick={baixar}
              disabled={!arquivo}
            >
              <Download size={16} /> Baixar documento
            </button>
            {tipo === "imagem" && arquivo && (
              <>
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Diminuir imagem"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                >
                  <ZoomOut size={16} />
                </button>
                <span className="rh-inline-meta">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Ampliar imagem"
                  disabled={zoom >= 3}
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className="rh-btn rh-icon-btn"
                  aria-label="Ajustar imagem à tela"
                  onClick={() => setZoom(1)}
                >
                  <RotateCcw size={16} />
                </button>
              </>
            )}
          </div>
          <div className="rh-actions">
            <button
              type="button"
              className="rh-btn rh-icon-btn"
              aria-label="Editar documento"
              disabled={salvando}
              onClick={onEdit}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="rh-btn rh-icon-btn rh-btn-danger"
              aria-label="Excluir documento"
              disabled={salvando}
              onClick={() => setConfirmar(true)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {erro && <AvisoGestao erro>{erro}</AvisoGestao>}
        {confirmar && (
          <div className="rh-doc-confirm" role="alert">
            <div>
              <strong>Excluir este documento?</strong>
              <p>O arquivo será removido permanentemente da ficha.</p>
            </div>
            <div className="rh-actions">
              <button
                type="button"
                className="rh-btn rh-btn-danger"
                disabled={salvando}
                onClick={() => void excluir()}
              >
                {salvando ? "Excluindo..." : "Excluir documento"}
              </button>
              <button
                type="button"
                className="rh-btn"
                disabled={salvando}
                onClick={() => setConfirmar(false)}
              >
                Manter arquivo
              </button>
            </div>
          </div>
        )}
        <div
          className={`rh-doc-fullview ${zoom > 1 ? "rh-doc-zoomed" : ""}`}
          role={!arquivo && !erro ? "status" : undefined}
        >
          {!arquivo ? (
            erro ? (
              <button
                type="button"
                className="rh-btn"
                onClick={() => setTentativa((v) => v + 1)}
              >
                Tentar novamente
              </button>
            ) : (
              <span className="rh-actions">
                <Loader2 size={22} className="rh-spin" /> Carregando
                documento...
              </span>
            )
          ) : tipo === "imagem" && imagemFalhou ? (
            <div>
              <FileText size={40} />
              <p>Não foi possível exibir esta imagem.</p>
              <p>Você pode baixar o arquivo.</p>
            </div>
          ) : tipo === "imagem" ? (
            <img
              src={arquivo.url}
              alt={documento.nome_arquivo || "Documento"}
              onError={() => setImagemFalhou(true)}
              style={
                zoom > 1
                  ? {
                      width: `${zoom * 100}%`,
                      maxWidth: "none",
                      maxHeight: "none",
                    }
                  : undefined
              }
            />
          ) : tipo === "pdf" ? (
            <iframe
              src={`${arquivo.url}#toolbar=1&navpanes=0&view=FitH`}
              title={`Documento: ${documento.nome_arquivo}`}
            />
          ) : (
            <div>
              <FileText size={40} />
              <p>Pré-visualização indisponível para este formato.</p>
              <button type="button" className="rh-btn" onClick={baixar}>
                Baixar documento
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
