import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ColaboradorGestao } from "@/lib/colaborador-api";
import { dataBr, hojeLocal, validarArquivo } from "@/lib/gestao-colaboradores";
import { AvisoGestao, DadoFicha } from "./ComponentesColaboradores";

export type CadastroColaborador = {
  values: Record<string, unknown>;
  exame?: File;
  anexos: Array<{ arquivo: File; nome: string; chave: string }>;
};
const etapas = [
  "Dados pessoais",
  "Vínculo e acesso",
  "Admissão e documentos",
  "Revisão",
];
const departamentos = [
  "Operações",
  "Coordenador de Voo",
  "Tripulante",
  "Piloto Chefe",
  "Financeiro",
  "Financeiro Master",
  "Administrativo",
];
const estados = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function FormularioColaborador({
  inicial,
  salvando,
  erro,
  parcial,
  onCancel,
  onSave,
}: {
  inicial: ColaboradorGestao | null;
  salvando: boolean;
  erro: string;
  parcial: boolean;
  onCancel: () => void;
  onSave: (cadastro: CadastroColaborador) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [realizado, setRealizado] = useState(
    Boolean(inicial?.exame_admissional_realizado),
  );
  const [departamento, setDepartamento] = useState(
    inicial?.departamentos_email || inicial?.departamento || "",
  );
  const [anexos, setAnexos] = useState<string[]>([]);
  const [revisao, setRevisao] = useState<Record<string, FormDataEntryValue>>(
    {},
  );
  const [descartar, setDescartar] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (etapa > 0) titleRef.current?.focus();
  }, [etapa]);
  const fechar = () => {
    if (salvando) return;
    if (dirtyRef.current && !parcial) setDescartar(true);
    else onCancel();
  };
  const dados = () => new FormData(formRef.current!);
  function validar(target: number, formData: FormData): Record<string, string> {
    const errors: Record<string, string> = {};
    const value = (key: string) => String(formData.get(key) || "").trim();
    const required = (key: string, message: string) => {
      if (!value(key)) errors[key] = message;
    };
    if (target === 0) {
      required("nome_completo", "Informe o nome completo.");
      if (value("data_nascimento") && value("data_nascimento") > hojeLocal())
        errors.data_nascimento =
          "A data de nascimento não pode estar no futuro.";
      if (value("cpf") && value("cpf").replace(/\D/g, "").length !== 11)
        errors.cpf = "Informe os 11 números do CPF.";
    }
    if (target === 1) {
      if (!inicial) {
        required("email", "Informe o endereço de e-mail.");
        if (value("email") && !/^[a-zA-Z0-9._+-]+$/.test(value("email")))
          errors.email =
            "Digite apenas a parte antes de @share-brasil.com, sem espaços.";
        if (String(formData.get("senha") || "").length < 6)
          errors.senha = "Use pelo menos 6 caracteres.";
      }
      if (
        departamento === "Tripulante" ||
        inicial?.funcoes?.some((f) => f.toLowerCase() === "tripulante")
      )
        required("canac", "Informe o CANAC do tripulante.");
    }
    if (target === 2) {
      if (realizado) {
        required("exame_admissional_data", "Informe a data do exame.");
        required("exame_admissional_local", "Informe o local do exame.");
        required("exame_admissional_empresa", "Informe a empresa responsável.");
        const file = formData.get("exame_admissional_arquivo");
        if (
          !(file instanceof File && file.size) &&
          !inicial?.exame_admissional_documento_id &&
          !parcial
        )
          errors.exame_admissional_arquivo =
            "Anexe o comprovante do exame em PDF.";
      } else
        required(
          "exame_admissional_prazo",
          "Informe o prazo para realizar o exame.",
        );
      for (const [key, file] of formData.entries())
        if (file instanceof File && file.name) {
          const issue = validarArquivo(
            file,
            key === "exame_admissional_arquivo",
          );
          if (issue) errors[key] = issue;
        }
    }
    return errors;
  }
  function ir(next: number) {
    if (salvando) return;
    const formData = dados();
    if (next > etapa) {
      const errors = validar(etapa, formData);
      if (Object.keys(errors).length) {
        setErros(errors);
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>("[aria-invalid=true]")
            ?.focus(),
        );
        return;
      }
    }
    setErros({});
    setRevisao(Object.fromEntries(formData.entries()));
    setEtapa(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    if (etapa < 3) {
      ir(etapa + 1);
      return;
    }
    const formData = dados();
    for (let i = 0; i < 3; i++) {
      const errors = validar(i, formData);
      if (Object.keys(errors).length) {
        setErros(errors);
        setEtapa(i);
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>("[aria-invalid=true]")
            ?.focus(),
        );
        return;
      }
    }
    const values: Record<string, unknown> = Object.fromEntries(
      [...formData.entries()].filter(
        ([key, value]) =>
          !(value instanceof File) && !key.startsWith("documento_"),
      ),
    );
    values.exame_admissional_realizado = realizado;
    values.departamento = departamento;
    values.departamentos_email = departamento;
    if (!inicial)
      values.email = `${String(values.email).trim().toLowerCase()}@share-brasil.com`;
    if (typeof values.uf === "string") values.uf = values.uf.toUpperCase();
    const exame = formData.get("exame_admissional_arquivo");
    await onSave({
      values,
      exame: exame instanceof File && exame.size ? exame : undefined,
      anexos: anexos.flatMap((id) => {
        const file = formData.get(`documento_arquivo_${id}`);
        return file instanceof File && file.size
          ? [
              {
                arquivo: file,
                nome: String(formData.get(`documento_nome_${id}`) || file.name),
                chave: id,
              },
            ]
          : [];
      }),
    });
  }
  const field = (
    name: string,
    titulo: string,
    options: {
      type?: string;
      wide?: boolean;
      help?: string;
      placeholder?: string;
      maxLength?: number;
      autoComplete?: string;
    } = {},
  ) => (
    <Campo
      nome={name}
      titulo={titulo}
      erro={erros[name]}
      wide={options.wide}
      help={options.help}
    >
      <input
        id={`rh-${name}`}
        name={name}
        type={options.type || "text"}
        defaultValue={String(
          inicial?.[name as keyof ColaboradorGestao] || "",
        ).slice(0, options.type === "date" ? 10 : undefined)}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        maxLength={options.maxLength}
        className="rh-input"
        aria-required={titulo.endsWith("*")}
        aria-invalid={Boolean(erros[name])}
        aria-describedby={erros[name] ? `rh-error-${name}` : undefined}
      />
    </Campo>
  );
  const arquivoCount = anexos.filter(
    (id) => (revisao[`documento_arquivo_${id}`] as File)?.size,
  ).length;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) fechar();
      }}
    >
      <DialogContent
        className="rh-dialog"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          fechar();
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        aria-describedby="rh-form-desc"
      >
        <form
          ref={formRef}
          onSubmit={submit}
          noValidate
          onChange={(e) => {
            dirtyRef.current = true;
            const key = (e.target as unknown as HTMLInputElement).name;
            if (key && erros[key])
              setErros((current) => {
                const next = { ...current };
                delete next[key];
                return next;
              });
          }}
          className="rh-form"
        >
          <header className="rh-form-header">
            <div>
              <div className="rh-eyebrow">GESTÃO DE COLABORADORES</div>
              <DialogTitle>
                {inicial ? "Editar colaborador" : "Novo colaborador"}
              </DialogTitle>
              <DialogDescription id="rh-form-desc">
                {inicial
                  ? "Atualize o cadastro e as informações de admissão."
                  : "Cadastre a pessoa, prepare o acesso e organize a admissão."}
              </DialogDescription>
            </div>
            <button
              type="button"
              className="rh-btn rh-icon-btn"
              onClick={fechar}
              disabled={salvando}
              aria-label="Fechar cadastro"
            >
              <X size={18} />
            </button>
          </header>
          <div className="rh-form-body" ref={bodyRef}>
            <nav className="rh-steps" aria-label="Etapas do cadastro">
              <ol>
                {etapas.map((nome, i) => (
                  <li key={nome} className={i < etapa ? "rh-step-done" : ""}>
                    <button
                      type="button"
                      disabled={i > etapa || salvando}
                      onClick={() => ir(i)}
                      aria-current={i === etapa ? "step" : undefined}
                    >
                      <span className="rh-step-number">
                        {i < etapa ? <Check size={15} /> : `0${i + 1}`}
                      </span>
                      <span>
                        {nome}
                        <small>
                          {i < etapa
                            ? "Preenchido"
                            : i === etapa
                              ? "Etapa atual"
                              : "A seguir"}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="rh-form-content">
              {descartar ? (
                <div className="rh-review-block" role="alert">
                  <h3>Descartar este preenchimento?</h3>
                  <p className="rh-section-desc">
                    As alterações ainda não foram salvas.
                  </p>
                  <div className="rh-actions">
                    <button
                      type="button"
                      className="rh-btn"
                      onClick={() => setDescartar(false)}
                    >
                      Continuar preenchendo
                    </button>
                    <button
                      type="button"
                      className="rh-btn rh-btn-danger"
                      onClick={onCancel}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ) : null}
              {erro && <AvisoGestao erro>{erro}</AvisoGestao>}
              <p className="sr-only" role="status">
                Etapa {etapa + 1} de 4: {etapas[etapa]}
              </p>
              <h3 ref={titleRef} tabIndex={-1}>
                {etapas[etapa]}
              </h3>
              <p className="rh-section-desc">
                {
                  [
                    "Informações de identificação e contato.",
                    "Lotação, admissão e acesso ao sistema.",
                    "Situação do exame e arquivos do colaborador.",
                    "Confira os dados antes de concluir o cadastro.",
                  ][etapa]
                }
              </p>
              <fieldset
                hidden={etapa !== 0}
                className={etapa === 0 ? "rh-fields rh-enter" : ""}
                disabled={salvando}
              >
                {field("nome_completo", "Nome completo *", {
                  wide: true,
                  autoComplete: "name",
                  placeholder: "Nome e sobrenome",
                })}
                {field("nome_exibicao", "Nome de exibição", {
                  placeholder: "Como prefere ser chamado",
                })}
                {field("data_nascimento", "Data de nascimento", {
                  type: "date",
                })}
                {field("cpf", "CPF", {
                  maxLength: 14,
                  placeholder: "000.000.000-00",
                })}
                {field("rg", "RG")}
                {field("telefone", "Telefone", {
                  type: "tel",
                  autoComplete: "tel",
                  placeholder: "(00) 00000-0000",
                })}
                {field("cidade", "Cidade", { autoComplete: "address-level2" })}
                <Campo nome="uf" titulo="Estado">
                  <select
                    name="uf"
                    id="rh-uf"
                    className="rh-input"
                    defaultValue={inicial?.uf?.toUpperCase() || ""}
                  >
                    <option value="">Selecione</option>
                    {estados.map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                </Campo>
              </fieldset>
              <fieldset
                hidden={etapa !== 1}
                className={etapa === 1 ? "rh-fields rh-enter" : ""}
                disabled={salvando}
              >
                <Campo nome="departamento" titulo="Departamento">
                  <select
                    id="rh-departamento"
                    name="departamento"
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    className="rh-input"
                  >
                    <option value="">Selecione o departamento</option>
                    {[
                      ...new Set([
                        ...departamentos,
                        ...(departamento ? [departamento] : []),
                      ]),
                    ].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Campo>
                {field("data_admissao", "Data de admissão", { type: "date" })}
                {field(
                  "canac",
                  `CANAC${departamento === "Tripulante" ? " *" : ""}`,
                  { help: "Obrigatório para tripulantes." },
                )}
                {inicial && (
                  <Campo nome="status" titulo="Situação">
                    <select
                      id="rh-status"
                      name="status"
                      className="rh-input"
                      defaultValue={inicial.status?.toLowerCase() || "ativo"}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                      <option value="ferias">Férias</option>
                    </select>
                  </Campo>
                )}
                {!inicial ? (
                  <>
                    <div className="rh-field-wide rh-form-divider">
                      <h4>Acesso ao sistema</h4>
                      <ShieldCheck size={18} className="rh-text-muted" />
                    </div>
                    <Campo
                      nome="email"
                      titulo="E-mail corporativo *"
                      erro={erros.email}
                      wide
                    >
                      <div className="rh-input-group">
                        <input
                          id="rh-email"
                          name="email"
                        aria-required="true"
                          autoComplete="off"
                          placeholder="nome.sobrenome"
                          aria-invalid={Boolean(erros.email)}
                          aria-describedby={
                            erros.email ? "rh-error-email" : undefined
                          }
                          className="rh-input"
                        />
                        <span>@share-brasil.com</span>
                      </div>
                    </Campo>
                    <Campo
                      nome="senha"
                      titulo="Senha inicial *"
                      erro={erros.senha}
                      help="Pelo menos 6 caracteres."
                      wide
                    >
                      <div className="rh-input-group">
                        <input
                          id="rh-senha"
                          name="senha"
                        aria-required="true"
                          type={mostrarSenha ? "text" : "password"}
                          autoComplete="new-password"
                          aria-invalid={Boolean(erros.senha)}
                          aria-describedby={
                            erros.senha ? "rh-error-senha" : undefined
                          }
                          className="rh-input"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((v) => !v)}
                          aria-label={
                            mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                          }
                        >
                          {mostrarSenha ? (
                            <EyeOff size={17} />
                          ) : (
                            <Eye size={17} />
                          )}
                        </button>
                      </div>
                    </Campo>
                  </>
                ) : (
                  <div className="rh-field-wide">
                    <DadoFicha
                      titulo="E-mail corporativo"
                      valor={inicial.email}
                    />
                  </div>
                )}
              </fieldset>
              <fieldset
                hidden={etapa !== 2}
                disabled={salvando}
                className={etapa === 2 ? "rh-enter" : ""}
              >
                <div className="rh-fields">
                  <Campo
                    nome="exame_admissional_realizado"
                    titulo="Situação do exame"
                  >
                    <select
                      id="rh-exame_admissional_realizado"
                      name="exame_admissional_realizado"
                      value={realizado ? "1" : "0"}
                      onChange={(e) => setRealizado(e.target.value === "1")}
                      className="rh-input"
                    >
                      <option value="0">Exame pendente</option>
                      <option value="1">Exame realizado</option>
                    </select>
                  </Campo>
                  <div hidden={realizado}>
                    {field("exame_admissional_prazo", "Prazo para realizar *", {
                      type: "date",
                    })}
                  </div>
                  <div hidden={!realizado}>
                    {field(
                      "exame_admissional_data",
                      `Data do exame${realizado ? " *" : ""}`,
                      { type: "date" },
                    )}
                  </div>
                  {field(
                    "exame_admissional_local",
                    `Local do exame${realizado ? " *" : ""}`,
                    { placeholder: "Clínica ou endereço" },
                  )}
                  {field(
                    "exame_admissional_empresa",
                    `Empresa responsável${realizado ? " *" : ""}`,
                  )}
                  <Campo
                    nome="exame_admissional_arquivo"
                    titulo={
                      inicial?.exame_admissional_documento_id
                        ? "Substituir comprovante"
                        : `Comprovante do exame${realizado ? " *" : ""}`
                    }
                    erro={erros.exame_admissional_arquivo}
                    wide
                  >
                    <div className="rh-upload">
                      <span className="rh-inline-meta">
                        PDF · até 10 MB
                        {inicial?.exame_admissional_documento_id
                          ? " · Já existe um comprovante anexado"
                          : ""}
                      </span>
                      <input
                        id="rh-exame_admissional_arquivo"
                        name="exame_admissional_arquivo"
                        type="file"
                        accept="application/pdf"
                        aria-invalid={Boolean(erros.exame_admissional_arquivo)}
                        aria-describedby={
                          erros.exame_admissional_arquivo
                            ? "rh-error-exame_admissional_arquivo"
                            : undefined
                        }
                      />
                    </div>
                  </Campo>
                </div>
                <div className="rh-form-divider">
                  <h4>Documentos {inicial ? "adicionais" : "iniciais"}</h4>
                  <button
                    type="button"
                    className="rh-btn"
                    onClick={() =>
                      setAnexos((current) => [...current, crypto.randomUUID()])
                    }
                  >
                    <Plus size={15} /> Anexar
                  </button>
                </div>
                {!anexos.length && (
                  <p className="rh-inline-meta">
                    RG, CPF e outros documentos podem ser anexados agora ou
                    depois, na ficha.
                  </p>
                )}
                <div className="rh-file-list">
                  {anexos.map((id, i) => (
                    <div key={id} className="rh-upload">
                      <div
                        className="rh-actions"
                        style={{
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <strong style={{ fontSize: 12 }}>
                          Documento {i + 1}
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            setAnexos((current) =>
                              current.filter((item) => item !== id),
                            )
                          }
                          aria-label={`Remover documento ${i + 1}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <label className="rh-field">
                        <span>Nome do documento</span>
                        <input
                          name={`documento_nome_${id}`}
                          className="rh-input"
                          placeholder="Ex.: RG frente e verso"
                        />
                      </label>
                      <Campo
                        nome={`documento_arquivo_${id}`}
                        titulo="Arquivo"
                        erro={erros[`documento_arquivo_${id}`]}
                      >
                        <input
                          id={`rh-documento_arquivo_${id}`}
                          name={`documento_arquivo_${id}`}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          aria-invalid={Boolean(
                            erros[`documento_arquivo_${id}`],
                          )}
                          aria-describedby={
                            erros[`documento_arquivo_${id}`]
                              ? `rh-error-documento_arquivo_${id}`
                              : undefined
                          }
                        />
                      </Campo>
                    </div>
                  ))}
                </div>
                {anexos.length > 0 && (
                  <p className="rh-field-help" style={{ marginTop: 12 }}>
                    PDF, JPG, PNG ou WEBP · até 10 MB por arquivo.
                  </p>
                )}
              </fieldset>
              {etapa === 3 && (
                <div className="rh-enter">
                  <div className="rh-review-block">
                    <h4>
                      Identificação{" "}
                      <button
                        type="button"
                        className="rh-link"
                        onClick={() => ir(0)}
                      >
                        Editar
                      </button>
                    </h4>
                    <dl className="rh-review">
                      <DadoFicha
                        titulo="Nome completo"
                        valor={String(revisao.nome_completo || "")}
                      />
                      <DadoFicha
                        titulo="Nome de exibição"
                        valor={String(revisao.nome_exibicao || "")}
                      />
                      <DadoFicha
                        titulo="Telefone"
                        valor={String(revisao.telefone || "")}
                      />
                      <DadoFicha
                        titulo="Cidade / UF"
                        valor={[revisao.cidade, revisao.uf]
                          .filter(Boolean)
                          .join(" / ")}
                      />
                    </dl>
                  </div>
                  <div className="rh-review-block">
                    <h4>
                      Vínculo e acesso{" "}
                      <button
                        type="button"
                        className="rh-link"
                        onClick={() => ir(1)}
                      >
                        Editar
                      </button>
                    </h4>
                    <dl className="rh-review">
                      <DadoFicha titulo="Departamento" valor={departamento} />
                      <DadoFicha
                        titulo="Admissão"
                        valor={dataBr(String(revisao.data_admissao || ""))}
                      />
                      <DadoFicha
                        titulo="E-mail"
                        valor={
                          inicial?.email ||
                          `${revisao.email || ""}@share-brasil.com`
                        }
                      />
                      <DadoFicha
                        titulo="CANAC"
                        valor={String(revisao.canac || "")}
                      />
                    </dl>
                  </div>
                  <div className="rh-review-block">
                    <h4>
                      Admissão e documentos{" "}
                      <button
                        type="button"
                        className="rh-link"
                        onClick={() => ir(2)}
                      >
                        Editar
                      </button>
                    </h4>
                    <dl className="rh-review">
                      <DadoFicha
                        titulo="Exame admissional"
                        valor={realizado ? "Realizado" : "Pendente"}
                      />
                      <DadoFicha
                        titulo={
                          realizado ? "Data do exame" : "Prazo para realizar"
                        }
                        valor={dataBr(
                          String(
                            revisao[
                              realizado
                                ? "exame_admissional_data"
                                : "exame_admissional_prazo"
                            ] || "",
                          ),
                        )}
                      />
                      <DadoFicha
                        titulo="Comprovante"
                        valor={
                          (revisao.exame_admissional_arquivo as File)?.name ||
                          (inicial?.exame_admissional_documento_id
                            ? "Já anexado"
                            : "Sem anexo")
                        }
                      />
                      <DadoFicha
                        titulo="Documentos adicionais"
                        valor={`${arquivoCount} arquivo(s)`}
                      />
                    </dl>
                  </div>
                </div>
              )}
            </div>
          </div>
          <footer className="rh-form-footer">
            <button
              type="button"
              className="rh-btn"
              disabled={salvando}
              onClick={() => (etapa ? ir(etapa - 1) : fechar())}
            >
              {etapa ? <ArrowLeft size={15} /> : null}
              {etapa ? "Voltar" : parcial ? "Concluir depois" : "Cancelar"}
            </button>
            <small>Etapa {etapa + 1} de 4</small>
            <button
              type="submit"
              disabled={salvando || descartar}
              className="rh-btn rh-btn-primary"
            >
              {salvando ? (
                <Loader2 size={16} className="rh-spin" />
              ) : etapa === 3 ? (
                <UserPlus size={16} />
              ) : null}
              {salvando
                ? "Salvando..."
                : etapa === 3
                  ? parcial
                    ? "Concluir envio"
                    : inicial
                      ? "Salvar alterações"
                      : "Criar colaborador"
                  : "Continuar"}
              {etapa < 3 && <ArrowRight size={15} />}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Campo({
  nome,
  titulo,
  children,
  erro,
  wide = false,
  help,
}: {
  nome: string;
  titulo: string;
  children: ReactNode;
  erro?: string;
  wide?: boolean;
  help?: string;
}) {
  return (
    <div className={`rh-field ${wide ? "rh-field-wide" : ""}`}>
      <label htmlFor={`rh-${nome}`}>{titulo}</label>
      {children}
      {erro ? (
        <span className="rh-field-error" id={`rh-error-${nome}`}>
          {erro}
        </span>
      ) : help ? (
        <span className="rh-field-help">{help}</span>
      ) : null}
    </div>
  );
}
