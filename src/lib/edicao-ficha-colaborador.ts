export type EscopoEdicaoFicha = "pessoal" | "profissional";

export const CAMPOS_EDICAO_FICHA: Record<EscopoEdicaoFicha, readonly string[]> = {
  pessoal: [
    "nome_completo",
    "nome_exibicao",
    "data_nascimento",
    "cpf",
    "rg",
    "telefone",
    "endereco",
    "cidade",
    "uf",
    "nome_banco",
    "tipo_conta",
    "agencia_numero",
    "conta_numero",
    "tipo_chave_pix",
    "pix",
  ],
  profissional: [
    "departamento",
    "data_admissao",
    "status",
    "canac",
    "exame_admissional_realizado",
    "exame_admissional_data",
    "exame_admissional_local",
    "exame_admissional_empresa",
    "exame_admissional_prazo",
  ],
};

function normalizarComparacao(valor: unknown) {
  return valor == null ? "" : valor;
}

function valorCampo(escopo: EscopoEdicaoFicha, campo: string, valor: unknown) {
  if (escopo === "profissional" && campo === "exame_admissional_realizado") {
    return valor === true || valor === 1 || valor === "1" || valor === "true";
  }
  if (escopo === "pessoal" && (campo === "cpf" || campo === "telefone")) {
    return valor == null ? "" : String(valor).replace(/\D/g, "");
  }
  return normalizarComparacao(valor);
}

/** Retorna somente campos permitidos para a aba e que realmente foram alterados. */
export function montarAlteracoesFicha(
  escopo: EscopoEdicaoFicha,
  inicial: Record<string, unknown>,
  valores: Record<string, unknown>,
): Record<string, unknown> {
  const alteracoes: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDICAO_FICHA[escopo]) {
    const valor = valores[campo];
    const original =
      escopo === "profissional" &&
      campo === "departamento" &&
      !inicial.departamento
        ? inicial.departamentos_email
        : inicial[campo];
    if (valorCampo(escopo, campo, original) !== valorCampo(escopo, campo, valor)) {
      alteracoes[campo] = valor;
    }
  }
  if (escopo === "profissional" && "departamento" in alteracoes) {
    alteracoes.departamentos_email = alteracoes.departamento;
  }
  return alteracoes;
}
