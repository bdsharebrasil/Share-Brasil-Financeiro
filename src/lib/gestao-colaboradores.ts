import type { ColaboradorGestao } from "./colaborador-api";

export const normalizar = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const inativo = (value?: string | null) =>
  ["inativo", "inactive"].includes(normalizar(value || ""));
export const nomeColaborador = (
  p: Pick<ColaboradorGestao, "nome_completo" | "nome_exibicao">,
) => p.nome_exibicao || p.nome_completo || "Colaborador";
export const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const dataBr = (value?: string | null) =>
  value && !Number.isNaN(new Date(`${value.slice(0, 10)}T12:00:00`).getTime())
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
    : "—";
export const brl = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value) || 0,
  );
export const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const formatarFuncao = (value: string) =>
  ({
    gestor_master: "Gestor Master",
    admin: "Administrador",
    financeiro_master: "Financeiro Master",
    coordenador_de_voo: "Coordenador de voo",
    tripulante: "Tripulante",
    operacoes: "Operações",
  })[normalizar(value).replace(/[\s-]+/g, "_")] || value.replace(/_/g, " ");

const mensagens: Record<string, string> = {
  permissao_necessaria:
    "Seu acesso não permite esta ação. Solicite a liberação ao administrador.",
  nome_email_e_senha_validos_sao_obrigatorios:
    "Revise o nome, o e-mail e a senha inicial.",
  dados_do_exame_admissional_obrigatorios:
    "Preencha a data, o local e a empresa responsável pelo exame.",
  prazo_do_exame_admissional_obrigatorio:
    "Informe o prazo para realizar o exame admissional.",
  canac_obrigatorio_para_tripulante:
    "Informe o CANAC para cadastrar um tripulante.",
  tipo_de_arquivo_nao_permitido: "Escolha um arquivo PDF, JPG, PNG ou WEBP.",
  arquivo_obrigatorio: "Selecione o arquivo que deseja enviar.",
  arquivo_muito_grande: "O arquivo deve ter até 10 MB.",
};
export function mensagemGestao(
  cause: unknown,
  fallback = "Não foi possível concluir a ação. Tente novamente.",
) {
  const raw = cause instanceof Error ? cause.message : String(cause || "");
  if (mensagens[raw]) return mensagens[raw];
  if (
    /already.*registered|already.*exists|email.*existe|email_exists|user_already_exists/i.test(
      raw,
    )
  )
    return "Este e-mail já está cadastrado. Confira o endereço ou edite o colaborador existente.";
  if (
    /sessão|sessao|session|token.*expired|jwt.*expired|não autenticado/i.test(
      raw,
    )
  )
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (/failed to fetch|network|fetch failed|load failed/i.test(raw))
    return "Não foi possível conectar. Confira sua conexão e tente novamente.";
  if (/10\s?mb|tamanho.*limite|file.*large/i.test(raw))
    return "O arquivo deve ter até 10 MB.";
  return fallback;
}
export function validarArquivo(file: File, pdf = false): string | null {
  if (file.size > 10 * 1024 * 1024) return "O arquivo deve ter até 10 MB.";
  if (file.size === 0)
    return "Este arquivo está vazio. Selecione outro arquivo.";
  if (
    !(
      pdf
        ? ["application/pdf"]
        : ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    ).includes(file.type)
  )
    return pdf
      ? "Selecione um comprovante em PDF."
      : "Escolha um arquivo PDF, JPG, PNG ou WEBP.";
  return null;
}
