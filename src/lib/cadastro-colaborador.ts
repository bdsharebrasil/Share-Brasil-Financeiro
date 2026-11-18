export const TIPOS_CONTA = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "salario", label: "Conta salário" },
  { value: "pagamento", label: "Conta de pagamento" },
];
export const TIPOS_CHAVE_PIX = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];
export function formatarCpf(value: string) {
  const n = value.replace(/\D/g, "").slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}
export function formatarTelefone(value: string) {
  let n = value.replace(/\D/g, "");
  if (n.length > 11 && n.startsWith("55")) n = n.slice(2);
  n = n.slice(0, 11);
  if (!n) return "";
  if (n.length < 3) return `(${n}${n.length === 2 ? ")" : ""}`;
  const numero = n.slice(2);
  const prefixo = n.length > 10 ? 5 : 4;
  return `(${n.slice(0, 2)})${numero.slice(0, prefixo)}${numero.length > prefixo ? "-" + numero.slice(prefixo) : ""}`;
}
/** Mantém a posição de edição em relação aos dígitos ao inserir os separadores. */
export function aplicarMascara(
  input: HTMLInputElement,
  mascara: (value: string) => string,
) {
  const pos = input.selectionStart ?? input.value.length;
  const digitos = input.value.slice(0, pos).replace(/\D/g, "").length;
  const formatado = mascara(input.value);
  input.value = formatado;
  let cursor = 0;
  let vistos = 0;
  while (cursor < formatado.length && vistos < digitos) {
    if (/\d/.test(formatado[cursor])) vistos++;
    cursor++;
  }
  input.setSelectionRange(cursor, cursor);
}
