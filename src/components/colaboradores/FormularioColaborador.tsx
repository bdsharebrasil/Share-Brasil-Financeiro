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
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import {
  AnimatedStepper,
  AnimatedStepPanel,
} from "@/components/envio-pagamento/AnimatedStepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColaboradorGestao } from "@/lib/colaborador-api";
import { dataBr, hojeLocal, validarArquivo } from "@/lib/gestao-colaboradores";
import {
  aplicarMascara,
  formatarCpf,
  formatarTelefone,
  TIPOS_CONTA,
  TIPOS_CHAVE_PIX,
} from "@/lib/cadastro-colaborador";
import { AvisoGestao, DadoFicha } from "./ComponentesColaboradores";

export type CadastroColaborador = {
  values: Record<string, unknown>;
  exame?: File;
  anexos: Array<{ arquivo: File; nome: string; chave: string }>;
};
const etapas = [
  "Dados pessoais",
  "Vínculo e acesso",
  "Dados bancários",
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
  const [uf, setUf] = useState(inicial?.uf?.toUpperCase() || "");
  const [statusColab, setStatusColab] = useState(
    inicial?.status?.toLowerCase() || "ativo",
  );
  const [tipoConta, setTipoConta] = useState(
    inicial?.tipo_conta || "corrente",
  );
  const [departamento, setDepartamento] = useState(
    inicial?.departamentos_email || inicial?.departamento || "",
  );
  const [tipoPix, setTipoPix] = useState(
    String(inicial?.tipo_chave_pix || "").toLowerCase(),
  );
  const [anexos, setAnexos] = useState<string[]>([]);
  const [revisao, setRevisao] = useState<Record<string, FormDataEntryValue>>(
    {},
  );
  const [descartar, setDescartar] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const valoresIniciais = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [etapa]);
  const fechar = () => {
    if (salvando) return;
    if (dirtyRef.current && !parcial) setDescartar(true);
    else onCancel();
  };
  const dados = () => new FormData(formRef.current!);
  function valores(formData: FormData): Record<string, unknown> {
    const values: Record<string, unknown> = Object.fromEntries(
      [...formData.entries()]
        .filter(
          ([key, value]) =>
            !(value instanceof File) && !key.startsWith("documento_"),
        )
        .map(([key, value]) => [key, value === "__NONE__" ? "" : value]),
    );
    values.exame_admissional_realizado = realizado;
    values.departamento = departamento;
    values.departamentos_email = departamento;
    if (!inicial)
      values.email = `${String(values.email).trim().toLowerCase()}@share-brasil.com`;
    if (typeof values.uf === "string") values.uf = values.uf.toUpperCase();
    for (const campo of [
      "endereco",
      "nome_banco",
      "agencia_numero",
      "conta_numero",
      "pix",
    ]) {
      if (typeof values[campo] === "string")
        values[campo] = values[campo].trim();
    }
    return values;
  }
  function alterados(formData: FormData) {
    return Object.fromEntries(
      Object.entries(valores(formData)).filter(
        ([key, value]) => value !== valoresIniciais.current?.[key],
      ),
    );
  }
  function validar(target: number, formData: FormData): Record<string, string> {
    const errors: Record<string, string> = {};
    const value = (key: string) => {
      const raw = String(formData.get(key) || "").trim();
      return raw === "__NONE__" ? "" : raw;
    };
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
      if (
        value("telefone") &&
        ![10, 11].includes(value("telefone").replace(/\D/g, "").length)
      )
        errors.telefone = "Informe o DDD e o telefone com 10 ou 11 números.";
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
      const pix = value("pix");
      const tipo = value("tipo_chave_pix");
      if (pix && !tipo)
        errors.tipo_chave_pix = "Selecione o tipo da chave Pix.";
      if (tipo && !pix) errors.pix = "Informe a chave Pix.";
      if (pix && tipo === "cpf" && pix.replace(/\D/g, "").length !== 11)
        errors.pix = "Informe os 11 números do CPF da chave Pix.";
      if (
        pix &&
        tipo === "telefone" &&
        ![10, 11].includes(pix.replace(/\D/g, "").length)
      )
        errors.pix = "Informe o DDD e o telefone da chave Pix.";
      if (pix && tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pix))
        errors.pix = "Informe um e-mail válido para a chave Pix.";
    }
    if (target === 3) {
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
            "Anexe o comprovante do exame em PDF, JPG, PNG ou WEBP.";
      } else
        required(
          "exame_admissional_prazo",
          "Informe o prazo para realizar o exame.",
        );
      for (const [key, file] of formData.entries())
        if (file instanceof File && file.name) {
          const issue = validarArquivo(file);
          if (issue) errors[key] = issue;
        }
    }
    if (!inicial) return errors;
    const changes = alterados(formData);
    const mudou = (key: string) => key in changes;
    // Pendências do cadastro existente não impedem alterações em outras seções.
    return Object.fromEntries(
      Object.entries(errors).filter(([key]) => {
        if (formData.get(key) instanceof File)
          return Boolean((formData.get(key) as File).name) ||
            (key === "exame_admissional_arquivo" &&
              mudou("exame_admissional_realizado"));
        if (key === "pix" || key === "tipo_chave_pix")
          return mudou("pix") || mudou("tipo_chave_pix");
        if (key === "canac") return mudou(key) || mudou("departamento");
        if (key.startsWith("exame_admissional_"))
          return mudou(key) || mudou("exame_admissional_realizado");
        return mudou(key);
      }),
    );
  }
  function ir(next: number) {
    if (salvando) return;
    const formData = dados();
    if (!inicial && next > etapa) {
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
    setRevisao(
      Object.fromEntries(
        [...formData.entries()].map(([k, v]) => [k, v === "__NONE__" ? "" : v]),
      ),
    );
    setEtapa(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    if (!inicial && etapa < etapas.length - 1) {
      ir(etapa + 1);
      return;
    }
    const formData = dados();
    for (let i = 0; i < etapas.length - 1; i++) {
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
    const values = inicial ? alterados(formData) : valores(formData);
    if (inicial && "exame_admissional_realizado" in values) {
      // A mudança de situação valida e envia os dados do exame em conjunto.
      const atuais = valores(formData);
      const camposExame = realizado
        ? [
            "exame_admissional_data",
            "exame_admissional_local",
            "exame_admissional_empresa",
          ]
        : ["exame_admissional_prazo"];
      for (const campo of camposExame) values[campo] = atuais[campo];
    }
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
      mascara?: (value: string) => string;
      inputMode?: "text" | "numeric" | "tel";
    } = {},
  ) => (
    <Campo
      nome={name}
      titulo={titulo}
      erro={erros[name]}
      wide={options.wide}
      help={options.help}
    >
      <Input
        id={`rh-${name}`}
        name={name}
        type={options.type || "text"}
        defaultValue={
          options.mascara
            ? options.mascara(
                String(inicial?.[name as keyof ColaboradorGestao] || ""),
              )
            : String(inicial?.[name as keyof ColaboradorGestao] || "").slice(
                0,
                options.type === "date" ? 10 : undefined,
              )
        }
        inputMode={options.inputMode}
        onChange={(event) => {
          if (options.mascara)
            aplicarMascara(event.currentTarget, options.mascara);
        }}
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
          ref={(form) => {
            formRef.current = form;
            // O diálogo monta o formulário no portal depois do componente pai.
            if (form && !valoresIniciais.current)
              valoresIniciais.current = valores(new FormData(form));
          }}
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
            {inicial ? (
              <nav className="rh-tabs" aria-label="Seções do cadastro">
                {etapas.map((titulo, i) => (
                  <button
                    key={titulo}
                    type="button"
                    aria-pressed={etapa === i}
                    disabled={salvando || descartar}
                    onClick={() => ir(i)}
                  >
                    {titulo}
                  </button>
                ))}
              </nav>
            ) : (
              <AnimatedStepper
                atual={etapa}
                etapas={etapas.map((titulo, i) => ({ id: String(i), titulo }))}
                ariaLabel="Etapas do cadastro do colaborador"
              />
            )}
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
              <div className="rh-panel-stack">
                <AnimatedStepPanel
                  etapa={etapa}
                  ativo={etapa === 0}
                  titulo={etapas[0]}
                  className="rh-panel"
                >
                  <p className="rh-section-desc">
                    Informações de identificação e contato.
                  </p>
                  <fieldset className="rh-fields" disabled={salvando}>
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
                      mascara: formatarCpf,
                      inputMode: "numeric",
                    })}
                    {field("rg", "RG")}
                    {field("telefone", "Telefone", {
                      type: "tel",
                      autoComplete: "tel",
                      placeholder: "(00)0000-0000",
                      mascara: formatarTelefone,
                      inputMode: "tel",
                    })}
                    {field("endereco", "Endereço", {
                      wide: true,
                      autoComplete: "street-address",
                      placeholder: "Rua, número, bairro e complemento",
                    })}
                    {field("cidade", "Cidade", {
                      autoComplete: "address-level2",
                    })}
                    <Campo nome="uf" titulo="Estado">
                      <Select
                        name="uf"
                        value={uf || "__NONE__"}
                        onValueChange={(v) => {
                          setUf(v === "__NONE__" ? "" : v);
                          dirtyRef.current = true;
                        }}
                      >
                        <SelectTrigger id="rh-uf">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Selecione</SelectItem>
                          {estados.map((itemUf) => (
                            <SelectItem key={itemUf} value={itemUf}>
                              {itemUf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>
                  </fieldset>
                </AnimatedStepPanel>
                <AnimatedStepPanel
                  etapa={etapa}
                  ativo={etapa === 1}
                  titulo={etapas[1]}
                  className="rh-panel"
                >
                  <p className="rh-section-desc">
                    Lotação, admissão e acesso ao sistema.
                  </p>
                  <fieldset className="rh-fields" disabled={salvando}>
                    <Campo nome="departamento" titulo="Departamento">
                      <Select
                        name="departamento"
                        value={departamento || "__NONE__"}
                        onValueChange={(v) => {
                          setDepartamento(v === "__NONE__" ? "" : v);
                          dirtyRef.current = true;
                        }}
                      >
                        <SelectTrigger id="rh-departamento">
                          <SelectValue placeholder="Selecione o departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">
                            Selecione o departamento
                          </SelectItem>
                          {[
                            ...new Set([
                              ...departamentos,
                              ...(departamento ? [departamento] : []),
                            ]),
                          ].map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>
                    {field("data_admissao", "Data de admissão", {
                      type: "date",
                    })}
                    {field(
                      "canac",
                      `CANAC${departamento === "Tripulante" ? " *" : ""}`,
                      { help: "Obrigatório para tripulantes." },
                    )}
                    {inicial && (
                      <Campo nome="status" titulo="Situação">
                        <Select
                          name="status"
                          value={statusColab}
                          onValueChange={(v) => {
                            setStatusColab(v);
                            dirtyRef.current = true;
                          }}
                        >
                          <SelectTrigger id="rh-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="ferias">Férias</SelectItem>
                          </SelectContent>
                        </Select>
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
                            <Input
                              id="rh-email"
                              name="email"
                              aria-required="true"
                              autoComplete="off"
                              placeholder="nome.sobrenome"
                              aria-invalid={Boolean(erros.email)}
                              aria-describedby={
                                erros.email ? "rh-error-email" : undefined
                              }
                              className="rh-input border-0 shadow-none focus-visible:ring-0"
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
                            <Input
                              id="rh-senha"
                              name="senha"
                              aria-required="true"
                              type={mostrarSenha ? "text" : "password"}
                              autoComplete="new-password"
                              aria-invalid={Boolean(erros.senha)}
                              aria-describedby={
                                erros.senha ? "rh-error-senha" : undefined
                              }
                              className="rh-input border-0 shadow-none focus-visible:ring-0"
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
                </AnimatedStepPanel>
                <AnimatedStepPanel
                  etapa={etapa}
                  ativo={etapa === 2}
                  titulo={etapas[2]}
                  className="rh-panel"
                >
                  <p className="rh-section-desc">
                    Conta e chave Pix do colaborador.
                  </p>
                  <fieldset className="rh-fields" disabled={salvando}>
                    {field("nome_banco", "Banco", {
                      placeholder: "Nome do banco",
                    })}
                    <Campo nome="tipo_conta" titulo="Tipo de conta">
                      <Select
                        name="tipo_conta"
                        value={tipoConta}
                        onValueChange={(v) => {
                          setTipoConta(v);
                          dirtyRef.current = true;
                        }}
                      >
                        <SelectTrigger id="rh-tipo_conta">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CONTA.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                          {inicial?.tipo_conta &&
                            !TIPOS_CONTA.some(
                              (t) => t.value === inicial.tipo_conta,
                            ) && (
                              <SelectItem value={inicial.tipo_conta}>
                                {inicial.tipo_conta}
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </Campo>
                    {field("agencia_numero", "Agência", {
                      placeholder: "0000",
                    })}
                    {field("conta_numero", "Número da conta", {
                      placeholder: "00000-0",
                    })}
                    <Campo
                      nome="tipo_chave_pix"
                      titulo="Tipo de chave Pix"
                      erro={erros.tipo_chave_pix}
                    >
                      <Select
                        name="tipo_chave_pix"
                        value={tipoPix || "__NONE__"}
                        onValueChange={(v) => {
                          const next = v === "__NONE__" ? "" : v;
                          setTipoPix(next);
                          dirtyRef.current = true;
                          setErros((current) => {
                            if (!current.tipo_chave_pix) return current;
                            const copy = { ...current };
                            delete copy.tipo_chave_pix;
                            return copy;
                          });
                        }}
                      >
                        <SelectTrigger
                          id="rh-tipo_chave_pix"
                          aria-invalid={Boolean(erros.tipo_chave_pix)}
                          aria-describedby={
                            erros.tipo_chave_pix
                              ? "rh-error-tipo_chave_pix"
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Sem chave Pix" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem chave Pix</SelectItem>
                          {TIPOS_CHAVE_PIX.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                          {tipoPix &&
                            !TIPOS_CHAVE_PIX.some(
                              (t) => t.value === tipoPix,
                            ) && (
                              <SelectItem value={tipoPix}>{tipoPix}</SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </Campo>
                    {field("pix", "Chave Pix", {
                      placeholder:
                        tipoPix === "cpf"
                          ? "000.000.000-00"
                          : tipoPix === "telefone"
                            ? "(00)0000-0000"
                            : tipoPix === "email"
                              ? "nome@exemplo.com"
                              : "Digite a chave Pix",
                      mascara:
                        tipoPix === "cpf"
                          ? formatarCpf
                          : tipoPix === "telefone"
                            ? formatarTelefone
                            : undefined,
                    })}
                  </fieldset>
                </AnimatedStepPanel>
                <AnimatedStepPanel
                  etapa={etapa}
                  ativo={etapa === 3}
                  titulo={etapas[3]}
                  className="rh-panel"
                >
                  <p className="rh-section-desc">
                    Situação do exame e arquivos do colaborador.
                  </p>
                  <fieldset className="" disabled={salvando}>
                    <div className="rh-fields">
                      <Campo
                        nome="exame_admissional_realizado"
                        titulo="Situação do exame"
                      >
                        <Select
                          name="exame_admissional_realizado"
                          value={realizado ? "1" : "0"}
                          onValueChange={(v) => {
                            setRealizado(v === "1");
                            dirtyRef.current = true;
                          }}
                        >
                          <SelectTrigger id="rh-exame_admissional_realizado">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Exame pendente</SelectItem>
                            <SelectItem value="1">Exame realizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </Campo>
                      <div hidden={realizado}>
                        {field(
                          "exame_admissional_prazo",
                          "Prazo para realizar *",
                          {
                            type: "date",
                          },
                        )}
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
                            PDF, JPG, PNG ou WEBP · até 10 MB
                            {inicial?.exame_admissional_documento_id
                              ? " · Já existe um comprovante anexado"
                              : ""}
                          </span>
                          <input
                            id="rh-exame_admissional_arquivo"
                            name="exame_admissional_arquivo"
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                            aria-invalid={Boolean(
                              erros.exame_admissional_arquivo,
                            )}
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
                          setAnexos((current) => [
                            ...current,
                            crypto.randomUUID(),
                          ])
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
                          <Field className="rh-field gap-1.5">
                            <FieldLabel>Nome do documento</FieldLabel>
                            <Input
                              name={`documento_nome_${id}`}
                              className="rh-input"
                              placeholder="Ex.: RG frente e verso"
                            />
                          </Field>
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
                </AnimatedStepPanel>
                <AnimatedStepPanel
                  etapa={etapa}
                  ativo={etapa === 4}
                  titulo={etapas[4]}
                  className="rh-panel"
                >
                  <p className="rh-section-desc">
                    Confira os dados antes de concluir o cadastro.
                  </p>
                  <div>
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
                          titulo="CPF"
                          valor={String(revisao.cpf || "")}
                        />
                        <DadoFicha
                          titulo="Endereço"
                          valor={String(revisao.endereco || "")}
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
                        Dados bancários{" "}
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
                          titulo="Banco"
                          valor={String(revisao.nome_banco || "")}
                        />
                        <DadoFicha
                          titulo="Tipo de conta"
                          valor={
                            TIPOS_CONTA.find(
                              (t) => t.value === revisao.tipo_conta,
                            )?.label || String(revisao.tipo_conta || "")
                          }
                        />
                        <DadoFicha
                          titulo="Agência"
                          valor={String(revisao.agencia_numero || "")}
                        />
                        <DadoFicha
                          titulo="Número da conta"
                          valor={String(revisao.conta_numero || "")}
                        />
                        <DadoFicha
                          titulo="Tipo de chave Pix"
                          valor={
                            TIPOS_CHAVE_PIX.find(
                              (t) => t.value === revisao.tipo_chave_pix,
                            )?.label || String(revisao.tipo_chave_pix || "")
                          }
                        />
                        <DadoFicha
                          titulo="Chave Pix"
                          valor={String(revisao.pix || "")}
                        />
                      </dl>
                    </div>
                    <div className="rh-review-block">
                      <h4>
                        Admissão e documentos{" "}
                        <button
                          type="button"
                          className="rh-link"
                          onClick={() => ir(3)}
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
                </AnimatedStepPanel>
              </div>
            </div>
          </div>
          <footer className="rh-form-footer">
            <button
              type="button"
              className="rh-btn"
              disabled={salvando}
              onClick={() => (!inicial && etapa ? ir(etapa - 1) : fechar())}
            >
              {!inicial && etapa ? <ArrowLeft size={15} /> : null}
              {!inicial && etapa
                ? "Voltar"
                : parcial ? "Concluir depois" : "Cancelar"}
            </button>
            {!inicial && <small>Etapa {etapa + 1} de {etapas.length}</small>}
            <button
              type="submit"
              disabled={salvando || descartar}
              className="rh-btn rh-btn-primary"
            >
              {salvando ? (
                <Loader2 size={16} className="rh-spin" />
              ) : inicial ? (
                <Save size={16} />
              ) : etapa === etapas.length - 1 ? (
                <UserPlus size={16} />
              ) : null}
              {salvando
                ? "Salvando..."
                : inicial
                  ? "Salvar alterações"
                  : etapa === etapas.length - 1
                  ? parcial
                    ? "Concluir envio"
                    : "Criar colaborador"
                  : "Continuar"}
              {!inicial && etapa < etapas.length - 1 && <ArrowRight size={15} />}
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
    <Field className={`rh-field gap-1.5 ${wide ? "rh-field-wide" : ""}`}>
      <FieldLabel htmlFor={`rh-${nome}`}>{titulo}</FieldLabel>
      {children}
      {erro ? (
        <span className="rh-field-error" id={`rh-error-${nome}`}>
          {erro}
        </span>
      ) : help ? (
        <span className="rh-field-help">{help}</span>
      ) : null}
    </Field>
  );
}
