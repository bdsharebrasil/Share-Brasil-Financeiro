import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Eye, Mail, MapPin, Pencil, Phone, Plus, Save, Search, Trash2, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  atualizarContatoShare, buscarContatosShare, criarContatoShare, excluirContatoShare,
  type ContatoAgenda,
} from "@/lib/colaborador-api";
import "./agenda-contatos.css";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const SERVICOS = [
  { nome: "GPU", disponibilidade: "gpu", custo: "custo_gpu", valor: "valor_gpu" },
  { nome: "Transfer", disponibilidade: "transfer", custo: "custo_transfer", valor: "valor_transfer" },
] as const;

const SEM_SERVICOS_HANGAR = { gpu: "", transfer: "", custo_gpu: "", custo_transfer: "", valor_gpu: "", valor_transfer: "", ar_condicionado: "", pernoite: "" };

export type FormularioContato = {
  codigo_icao: string; nome: string; telefone: string; email: string; empresa: string; razao_social: string;
  cnpj: string; categoria: string; categoria_tipo: string; categoria_personalizada: string;
  gpu: string; transfer: string; custo_gpu: string; custo_transfer: string;
  valor_gpu: string; valor_transfer: string; ar_condicionado: string; pernoite: string;
  atendimento_pista: string; endereco: string; cidade: string;
  uf: string; observacoes: string;
};

function vazio(): FormularioContato {
  return { codigo_icao: "", nome: "", telefone: "", email: "", empresa: "", razao_social: "", cnpj: "", categoria: "",
    categoria_tipo: "", categoria_personalizada: "", gpu: "", transfer: "", custo_gpu: "",
    custo_transfer: "", valor_gpu: "", valor_transfer: "", ar_condicionado: "", pernoite: "",
    atendimento_pista: "", endereco: "", cidade: "", uf: "", observacoes: "" };
}

function normalizar(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/** Aceita 1250.50, 1250,50 ou 1.250,50; a API recebe string decimal sem separador de milhar. */
export function valorDecimal(value: string): string {
  const limpo = value.trim().replace(/\s/g, "");
  return limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
}

function contatoParaFormulario(item?: ContatoAgenda): FormularioContato {
  if (!item) return vazio();
  const form = vazio();
  for (const key of Object.keys(form) as (keyof FormularioContato)[]) {
    // Todos estes campos já existem no contrato usado pela tela original.
    if (key in item) form[key] = String(item[key as keyof ContatoAgenda] ?? "");
  }
  const tipo = String(item.categoria_tipo || "").toUpperCase();
  const categoria = String(item.categoria || "");
  form.categoria_tipo = ["FORNECEDOR", "HANGAR", "OUTRO"].includes(tipo)
    ? tipo : ["FORNECEDOR", "HANGAR"].includes(categoria.toUpperCase()) ? categoria.toUpperCase() : "OUTRO";
  form.categoria_personalizada = item.categoria_personalizada || (form.categoria_tipo === "OUTRO" ? categoria : "");
  form.uf = form.uf.toUpperCase();
  for (const servico of SERVICOS) {
    const valor = String(item[servico.valor] ?? "");
    form[servico.custo] = valor === "GRATUITO" ? "GRATUITO" : valor ? "COBRADO" : "";
    form[servico.valor] = valor === "GRATUITO" ? "" : valor;
  }
  return form;
}

export function prepararContato(form: FormularioContato): FormularioContato {
  const payload = { ...form };
  for (const key of Object.keys(payload) as (keyof FormularioContato)[]) {
    payload[key] = payload[key].trim().toLocaleUpperCase("pt-BR");
  }
  if (!payload.nome) throw new Error("Informe o nome do contato.");
  if (!["FORNECEDOR", "HANGAR", "OUTRO"].includes(payload.categoria_tipo)) throw new Error("Selecione uma categoria válida.");
  if (payload.categoria_tipo === "OUTRO" && !payload.categoria_personalizada) throw new Error("Informe a categoria para a opção Outro.");
  payload.categoria = payload.categoria_tipo === "OUTRO" ? payload.categoria_personalizada : payload.categoria_tipo;
  if (["hotel", "hoteis"].includes(normalizar(payload.categoria))) throw new Error("Esse fornecedor deverá ser salvo em Share Brasil → Hotéis.");
  if (["combustivel", "combustiveis", "abastecimento"].includes(normalizar(payload.categoria))) throw new Error("Esse fornecedor deve ser salvo em Operações → Abastecimento → Fornecedores.");
  if (payload.categoria_tipo !== "OUTRO") payload.categoria_personalizada = "";
  payload.uf = payload.uf.toUpperCase();
  payload.codigo_icao = payload.codigo_icao.toUpperCase();
  if(payload.codigo_icao && !/^[A-Z0-9]{4}$/.test(payload.codigo_icao)) throw new Error("Informe quatro letras ou números para o código ICAO.");
  if (payload.categoria_tipo !== "HANGAR") payload.atendimento_pista = "";
  else if (!["SIM", "NAO"].includes(payload.atendimento_pista)) throw new Error("Informe se o hangar possui atendimento de pista.");
  if (payload.categoria_tipo !== "HANGAR" || payload.atendimento_pista !== "SIM") {
    Object.assign(payload, SEM_SERVICOS_HANGAR);
    return payload;
  }
  for (const servico of SERVICOS) {
    if (payload[servico.disponibilidade] !== "SIM") {
      payload[servico.disponibilidade] = "NAO"; payload[servico.custo] = ""; payload[servico.valor] = "";
      continue;
    }
    if (!payload[servico.valor]) {
      payload[servico.custo] = "GRATUITO"; payload[servico.valor] = "GRATUITO";
      continue;
    }
    const valor = valorDecimal(payload[servico.valor]);
    if (!/^\d+(\.\d{1,2})?$/.test(valor) || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      throw new Error(`Informe um valor válido, maior que zero, para ${servico.nome} (até duas casas decimais).`);
    }
    payload[servico.custo] = "COBRADO"; payload[servico.valor] = valor;
  }
  for (const key of ["ar_condicionado", "pernoite"] as const) {
    if (!payload[key] || payload[key] === "SIM") continue;
    const valor = valorDecimal(payload[key]);
    if (!/^\d+(\.\d{1,2})?$/.test(valor) || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      throw new Error(`Informe um valor válido, maior que zero, para ${key === "ar_condicionado" ? "ar condicionado" : "pernoite"} (até duas casas decimais).`);
    }
    payload[key] = valor;
  }
  return payload;
}

type CampoProps = InputHTMLAttributes<HTMLInputElement> & { label: string };
function Campo({ label, id, ...props }: CampoProps) {
  return <label className="ac-field" htmlFor={id}><span>{label}{props.required && " *"}</span><input {...props} id={id} className="ac-control" /></label>;
}

type CadastroProps = {
  contato?: ContatoAgenda;
  categoriaInicial?: "FORNECEDOR" | "HANGAR" | "OUTRO";
  salvando: boolean;
  erro: string | null;
  aoSalvar: (form: FormularioContato) => Promise<void>;
  aoCancelar: () => void;
};

/** Formulário completo. Pode ser reutilizado em outros Dialogs. */
export function FormularioCadastroContato({ contato, categoriaInicial, salvando, erro, aoSalvar, aoCancelar }: CadastroProps) {
  const [form, setForm] = useState(() => {
    const inicial = contatoParaFormulario(contato);
    return categoriaInicial ? { ...inicial, categoria_tipo: categoriaInicial, categoria: categoriaInicial } : inicial;
  });
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const resumoRef = useRef<HTMLDivElement>(null);
  const mensagem = erroLocal || erro;
  useEffect(() => { if (mensagem) resumoRef.current?.focus(); }, [mensagem]);
  function alterar<K extends keyof FormularioContato>(key: K, value: FormularioContato[K]) {
    const valorNormalizado = typeof value === "string"
      ? value.toLocaleUpperCase("pt-BR")
      : value;
    setForm((atual) => ({ ...atual, [key]: valorNormalizado }));
    setErroLocal(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    let payload: FormularioContato;
    try { payload = prepararContato(form); }
    catch (e) { setErroLocal(e instanceof Error ? e.message : "Revise os dados do formulário."); return; }
    await aoSalvar(payload);
  }
  const campo = (key: keyof FormularioContato, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Campo key={key} id={`contato-${key}`} label={label} value={form[key].toLocaleUpperCase("pt-BR")} disabled={salvando}
      onChange={(e) => alterar(key, e.target.value)} {...props} />
  );

  return (
    <form className="ac-dialog-form" onSubmit={(e) => void submit(e)} aria-busy={salvando}>
      <div className="ac-form-body bg-card dark:bg-background">
        <p className="ac-muted">Os campos com * são obrigatórios.</p>
        {mensagem && <div ref={resumoRef} tabIndex={-1} role="alert" className="ac-notice ac-notice--error">{mensagem}</div>}
        <section className="ac-section" aria-labelledby="ac-identificacao">
          <h3 id="ac-identificacao" className="ac-section-heading">Identificação do contato</h3>
          <div className="ac-form-grid">
            {campo("nome", "Nome do contato", { required: true, autoComplete: "name", autoFocus: true, placeholder: "Nome completo" })}
            {campo("telefone", "Telefone", { type: "tel", autoComplete: "tel", placeholder: "(00) 00000-0000" })}
            {campo("codigo_icao", "Aeroporto (ICAO)", { maxLength: 4, placeholder: "Ex.: SBCY" })}
            {campo("email", "E-mail", { type: "email", autoComplete: "email", placeholder: "contato@empresa.com.br" })}
            <label className="ac-field" htmlFor="contato-categoria">
              <span>Categoria *</span>
              <select id="contato-categoria" className="ac-control" value={form.categoria_tipo} required disabled={salvando || Boolean(categoriaInicial)}
                onChange={(e) => { const tipo = e.target.value; setErroLocal(null); setForm((atual) => ({ ...atual,
                  categoria_tipo: tipo, categoria_personalizada: "", ...(tipo !== "HANGAR" ? { ...SEM_SERVICOS_HANGAR, atendimento_pista: "" } : {}),
                })); }}>
                <option value="">Selecione uma categoria</option><option value="FORNECEDOR">Fornecedor</option>
                <option value="HANGAR">Hangar</option><option value="OUTRO">Outro</option>
              </select>
            </label>
            {form.categoria_tipo === "OUTRO" && campo("categoria_personalizada", "Qual categoria?", { required: true, placeholder: "Informe a categoria" })}
          </div>
        </section>
        <section className="ac-section" aria-labelledby="ac-empresa">
          <h3 id="ac-empresa" className="ac-section-heading">Dados da empresa</h3>
          <div className="ac-form-grid">
            {campo("empresa", "Empresa / nome fantasia", { autoComplete: "organization" })}
            {campo("razao_social", "Razão social")}
            {campo("cnpj", "CNPJ", { inputMode: "text", placeholder: "CNPJ da empresa" })}
          </div>
        </section>
        {form.categoria_tipo === "HANGAR" && (
          <section className="ac-section" aria-labelledby="ac-servicos">
            <h3 id="ac-servicos" className="ac-section-heading">Serviços do hangar</h3>
            <fieldset className="ac-service" disabled={salvando}>
              <legend>Possui atendimento de pista? *</legend>
              <label className="ac-field" htmlFor="contato-atendimento_pista-sim">
                <span><input id="contato-atendimento_pista-sim" type="checkbox" checked={form.atendimento_pista === "SIM"}
                  onChange={(e) => { setErroLocal(null); setForm((atual) => ({ ...atual, atendimento_pista: e.target.checked ? "SIM" : "", ...(e.target.checked ? {} : SEM_SERVICOS_HANGAR) })); }} /> Sim</span>
              </label>
              <label className="ac-field" htmlFor="contato-atendimento_pista-nao">
                <span><input id="contato-atendimento_pista-nao" type="checkbox" checked={form.atendimento_pista === "NAO"}
                  onChange={(e) => { setErroLocal(null); setForm((atual) => ({ ...atual, atendimento_pista: e.target.checked ? "NAO" : "", ...SEM_SERVICOS_HANGAR })); }} /> Não</span>
              </label>
            </fieldset>
            {form.atendimento_pista === "SIM" && <div className="ac-expand"><div className="ac-expand-body">
            <fieldset className="ac-service-list" disabled={salvando}>
              {([ ["ar_condicionado", "Ar condicionado"], ["pernoite", "Pernoite"] ] as const).map(([key, label]) => {
                const marcado = Boolean(form[key]);
                return <div key={key} className="ac-service-row">
                  <label className="ac-service-check" htmlFor={`contato-${key}-check`}>
                    <input id={`contato-${key}-check`} type="checkbox" checked={marcado}
                      onChange={(e) => alterar(key, e.target.checked ? "SIM" : "")} />
                    <span>{label}</span>
                  </label>
                  {marcado && <input id={`contato-${key}`} className="ac-control ac-service-value" aria-label={`Valor de ${label} (R$)`}
                    value={form[key] === "SIM" ? "" : form[key]} inputMode="decimal" placeholder="Valor (R$)"
                    onChange={(e) => alterar(key, e.target.value || "SIM")} />}
                </div>;
              })}
              {SERVICOS.map((servico) => {
                const marcado = form[servico.disponibilidade] === "SIM";
                return <div key={servico.nome} className="ac-service-row">
                  <label className="ac-service-check" htmlFor={`contato-${servico.disponibilidade}-check`}>
                    <input id={`contato-${servico.disponibilidade}-check`} type="checkbox" checked={marcado}
                      onChange={(e) => { setErroLocal(null); setForm((atual) => ({ ...atual, [servico.disponibilidade]: e.target.checked ? "SIM" : "NAO", [servico.valor]: "" })); }} />
                    <span>{servico.nome}</span>
                  </label>
                  {marcado && <input id={`contato-${servico.valor}`} className="ac-control ac-service-value" aria-label={`Valor de ${servico.nome} (R$)`}
                    value={form[servico.valor]} inputMode="decimal" placeholder="Valor (R$)"
                    onChange={(e) => { const valor = e.target.value; setErroLocal(null); setForm((atual) => ({ ...atual, [servico.valor]: valor })); }} />}
                </div>;
              })}
            </fieldset>
            </div></div>}
          </section>
        )}
        <section className="ac-section" aria-labelledby="ac-localizacao">
          <h3 id="ac-localizacao" className="ac-section-heading">Localização</h3>
          <div className="ac-form-grid">
            <div className="ac-full">{campo("endereco", "Endereço", { autoComplete: "street-address", placeholder: "Rua, número e complemento" })}</div>
            {campo("cidade", "Cidade", { autoComplete: "address-level2" })}
            <label className="ac-field" htmlFor="contato-uf"><span>UF</span>
              <select id="contato-uf" className="ac-control" value={form.uf} autoComplete="address-level1" disabled={salvando}
                onChange={(e) => alterar("uf", e.target.value)}>
                <option value="">Selecione</option>{form.uf && !UFS.includes(form.uf) && <option value={form.uf}>{form.uf}</option>}
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
          </div>
        </section>
        <label className="ac-field" htmlFor="contato-observacoes"><span>Observações</span>
          <textarea id="contato-observacoes" className="ac-control" value={form.observacoes} disabled={salvando}
            onChange={(e) => alterar("observacoes", e.target.value)} placeholder="Informações complementares sobre o contato" />
        </label>
      </div>
      <div className="ac-footer">
        <button type="button" className="ac-btn" disabled={salvando} onClick={aoCancelar}><X size={16} aria-hidden="true" />Cancelar</button>
        <button type="submit" className="ac-btn ac-btn--primary" disabled={salvando}><Save size={16} aria-hidden="true" />{salvando ? "Salvando…" : contato ? "Salvar alterações" : "Salvar contato"}</button>
      </div>
    </form>
  );
}

function descricaoServico(item: ContatoAgenda, servico: typeof SERVICOS[number]) {
  if (item[servico.disponibilidade] === "NAO") return "Não disponível";
  if (item[servico.disponibilidade] !== "SIM") return "Não informado";
  const valor = String(item[servico.valor] || "");
  if (valor === "GRATUITO") return "Disponível · gratuito";
  const numero = Number(valorDecimal(valor));
  return valor && Number.isFinite(numero) && numero > 0
    ? `Disponível · ${numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Disponível · valor não informado";
}

function Detalhes({ contato }: { contato: ContatoAgenda }) {
  const dados = [
    ["Aeroporto (ICAO)", contato.codigo_icao], ["Nome", contato.nome], ["Categoria", contato.categoria], ["Telefone", contato.telefone], ["E-mail", contato.email],
    ["Empresa", contato.empresa], ["Razão social", contato.razao_social], ["CNPJ", contato.cnpj],
    ["Endereço", contato.endereco], ["Cidade / UF", [contato.cidade, contato.uf].filter(Boolean).join(" / ")],
  ];
  return <dl className="ac-details">{dados.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Não informado"}</dd></div>)}
    {(contato.categoria_tipo === "HANGAR" || contato.categoria === "HANGAR") && <>
      <div><dt>Atendimento de pista</dt><dd>{contato.atendimento_pista === "SIM" ? "Sim" : contato.atendimento_pista === "NAO" ? "Não" : "Não informado"}</dd></div>
      {([ ["ar_condicionado", "Ar condicionado"], ["pernoite", "Pernoite"] ] as const).map(([key, label]) => {
        const valor = String(contato[key] || "");
        if (!valor) return null;
        const preco = valor === "SIM" ? "Valor não informado" : Number(valorDecimal(valor)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        return <div key={key}><dt>{label}</dt><dd>Disponível · {preco}</dd></div>;
      })}
    </>}
    {(contato.categoria_tipo === "HANGAR" || contato.categoria === "HANGAR") && SERVICOS.map((servico) => <div key={servico.nome}><dt>{servico.nome}</dt><dd>{descricaoServico(contato, servico)}</dd></div>)}
    {contato.observacoes && <div className="ac-full"><dt>Observações</dt><dd>{contato.observacoes}</dd></div>}
  </dl>;
}

/** Substitui apenas o conteúdo da aba AGENDA. Os cotistas continuam no componente atual. */
export function AgendaContatos() {
  const [contatos, setContatos] = useState<ContatoAgenda[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState(false);
  const [editando, setEditando] = useState<ContatoAgenda>();
  const [selecionado, setSelecionado] = useState<ContatoAgenda>();
  const [excluindo, setExcluindo] = useState<ContatoAgenda>();
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const mutationLock = useRef(false);
  const requestId = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++requestId.current;
    setCarregando(true);
    try { const items = await buscarContatosShare(); if (id === requestId.current) { setContatos(items); setErro(null); } }
    catch (e) { if (id === requestId.current) setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda."); }
    finally { if (id === requestId.current) setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); return () => { requestId.current++; }; }, [carregar]);
  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return contatos.filter((item) => [item.nome, item.empresa, item.razao_social, item.categoria, item.email, item.telefone, item.cnpj, item.cidade]
      .some((value) => normalizar(String(value || "")).includes(termo)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [contatos, busca]);

  function abrirCadastro(contato?: ContatoAgenda) { setEditando(contato); setErroForm(null); setAviso(null); setCadastro(true); }
  async function salvar(payload: FormularioContato) {
    if (mutationLock.current) return;
    mutationLock.current = true; setSalvando(true); setErroForm(null);
    try {
      const dados = { ...payload, categoria_tipo: payload.categoria_tipo as ContatoAgenda["categoria_tipo"] };
      if (editando) await atualizarContatoShare(editando.id, dados); else await criarContatoShare(dados);
      setCadastro(false); setEditando(undefined); setAviso(editando ? "Contato atualizado." : "Contato cadastrado.");
      await carregar();
    } catch (e) { setErroForm(e instanceof Error ? e.message : "Não foi possível salvar o contato."); }
    finally { mutationLock.current = false; setSalvando(false); }
  }
  async function excluir() {
    if (!excluindo || mutationLock.current) return;
    mutationLock.current = true; setRemovendo(true); setErroExclusao(null);
    try { await excluirContatoShare(excluindo.id); setExcluindo(undefined); setAviso("Contato removido."); await carregar(); }
    catch (e) { setErroExclusao(e instanceof Error ? e.message : "Não foi possível remover o contato."); }
    finally { mutationLock.current = false; setRemovendo(false); }
  }

  return (
    <section className="ac-root" aria-labelledby="ac-agenda-titulo">
      <header className="ac-toolbar">
        <div><h2 id="ac-agenda-titulo">Agenda de contatos</h2><p className="ac-muted">Contatos e fornecedores da empresa</p></div>
        <div className="ac-toolbar-actions">
          <div className="ac-search"><Search size={16} aria-hidden="true" /><input className="ac-control" type="search" value={busca}
            onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na agenda" aria-label="Buscar por nome, empresa, categoria, telefone ou e-mail" /></div>
          <button type="button" className="ac-btn ac-btn--primary" onClick={() => abrirCadastro()}><Plus size={16} aria-hidden="true" />Novo contato</button>
        </div>
      </header>
      {aviso && <div role="status" className="ac-notice">{aviso}</div>}
      {erro && <div role="alert" className="ac-notice ac-notice--error">{erro} <button type="button" className="ac-btn" onClick={() => void carregar()}>Tentar novamente</button></div>}
      <p className="ac-muted" role="status">{carregando ? "Carregando contatos…" : `${visiveis.length} ${visiveis.length === 1 ? "contato encontrado" : "contatos encontrados"}`}</p>
      {visiveis.length > 0 ? <ul className="ac-cards" aria-busy={carregando}>
        {visiveis.map((item) => <li key={item.id}><article className="ac-card">
          <div className="ac-identity"><span className="ac-avatar" aria-hidden="true">{item.nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?"}</span>
            <div><h3 className="ac-wrap">{item.nome}</h3><p className="ac-muted ac-wrap">{item.empresa || item.razao_social || "Contato profissional"}</p></div>
          </div>
          {item.categoria && <div><span className="ac-badge">{item.categoria}</span></div>}
          <div className="ac-contact-data">
            {item.telefone && <a href={`tel:${item.telefone.replace(/[^\d+]/g, "")}`}><Phone size={15} aria-hidden="true" /><span className="ac-wrap">{item.telefone}</span></a>}
            {item.email && <a href={`mailto:${item.email}`}><Mail size={15} aria-hidden="true" /><span className="ac-wrap">{item.email}</span></a>}
            {(item.cidade || item.uf || item.endereco) && <p><MapPin size={15} aria-hidden="true" /><span className="ac-wrap">{[item.cidade, item.uf].filter(Boolean).join(" / ") || item.endereco}</span></p>}
            {!item.telefone && !item.email && !item.cidade && !item.uf && !item.endereco && <p>Sem dados adicionais de contato</p>}
          </div>
          <div className="ac-card-actions">
            <button type="button" className="ac-btn" onClick={() => setSelecionado(item)}><Eye size={16} aria-hidden="true" />Ver contato</button>
            <button type="button" className="ac-btn ac-btn--icon" aria-label={`Editar ${item.nome}`} title="Editar contato" onClick={() => abrirCadastro(item)}><Pencil size={16} aria-hidden="true" /></button>
            <button type="button" className="ac-btn ac-btn--icon ac-btn--danger" aria-label={`Excluir ${item.nome}`} title="Excluir contato" onClick={() => { setExcluindo(item); setErroExclusao(null); }}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </article></li>)}
      </ul> : !carregando && !erro && <div className="ac-empty"><Users size={24} aria-hidden="true" style={{ margin: "0 auto 10px" }} />{busca ? "Nenhum contato corresponde à busca." : "Nenhum contato cadastrado. Clique em Novo contato para começar."}</div>}

      <Dialog open={cadastro} onOpenChange={(open) => { if (!salvando) { setCadastro(open); if (!open) setEditando(undefined); } }}>
        <DialogContent className="ac-dialog" onEscapeKeyDown={(e) => { if (salvando) e.preventDefault(); }} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="ac-dialog-header"><DialogTitle>{editando ? "Editar contato" : "Novo contato"}</DialogTitle><DialogDescription>Preencha os dados para organizar o contato na agenda corporativa.</DialogDescription></DialogHeader>
          {cadastro && <FormularioCadastroContato key={editando?.id || "novo"} contato={editando} salvando={salvando} erro={erroForm} aoSalvar={salvar} aoCancelar={() => { setCadastro(false); setEditando(undefined); }} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selecionado)} onOpenChange={(open) => { if (!open) setSelecionado(undefined); }}>
        <DialogContent className="ac-dialog">
          <DialogHeader className="ac-dialog-header"><DialogTitle className="ac-wrap">{selecionado?.nome || "Contato"}</DialogTitle><DialogDescription>Dados cadastrados na agenda corporativa.</DialogDescription></DialogHeader>
          <div className="ac-form-body">{selecionado && <Detalhes contato={selecionado} />}</div>
          <div className="ac-footer"><button type="button" className="ac-btn" onClick={() => setSelecionado(undefined)}>Fechar</button><button type="button" className="ac-btn ac-btn--primary" onClick={() => { const item = selecionado; setSelecionado(undefined); abrirCadastro(item); }}><Pencil size={16} aria-hidden="true" />Editar contato</button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(excluindo)} onOpenChange={(open) => { if (!removendo && !open) setExcluindo(undefined); }}>
        <DialogContent className="ac-dialog" onInteractOutside={(e) => { if (removendo) e.preventDefault(); }}>
          <DialogHeader className="ac-dialog-header"><DialogTitle>Excluir contato</DialogTitle><DialogDescription className="ac-wrap">Deseja excluir {excluindo?.nome}? Essa ação remove o contato da agenda.</DialogDescription></DialogHeader>
          {erroExclusao && <div role="alert" className="ac-notice ac-notice--error">{erroExclusao}</div>}
          <div className="ac-footer"><button type="button" className="ac-btn" disabled={removendo} onClick={() => setExcluindo(undefined)}>Cancelar</button><button type="button" className="ac-btn ac-btn--danger" disabled={removendo} onClick={() => void excluir()}><Trash2 size={16} aria-hidden="true" />{removendo ? "Excluindo…" : "Excluir contato"}</button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default AgendaContatos;

