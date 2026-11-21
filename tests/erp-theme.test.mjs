import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const temaBase = ler("../src/index.css");
const temaERP = ler("../src/styles/erp-system.css");
const entrada = ler("../src/main.tsx");

function cor(css, token) {
  const nome = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`^\\s*${nome}:\\s*(#[a-fA-F0-9]{6});`, "m"));
  assert.ok(match, `Token ${token} deve ter valor hexadecimal`);
  return match[1];
}

function luminancia(hex) {
  const canais = [1, 3, 5].map((indice) => parseInt(hex.slice(indice, indice + 2), 16) / 255);
  const linear = canais.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contraste(a, b) {
  const [maisClara, maisEscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maisClara + 0.05) / (maisEscura + 0.05);
}

test("modo claro não reintroduz tokens escuros em cartões e tabelas", () => {
  assert.doesNotMatch(temaBase, /Modo light: cards e tabelas usam #0D1317/);
  assert.doesNotMatch(temaBase, /background-color:\s*#DADDDD/);
  assert.match(temaBase, /--background:\s*210 24% 93\.5%/);
});

test("tema ERP é carregado depois das regras base", () => {
  assert.ok(entrada.indexOf('import "./styles/erp-system.css"') > entrada.indexOf('import "./index.css"'));
  assert.match(temaERP, /\.dark\s*\{/);
  assert.match(temaERP, /html:not\(\.dark\)/);
});

test("cabeçalho de tabela mantém contraste mínimo AA", () => {
  assert.ok(contraste(cor(temaERP, "--erp-section-head"), cor(temaERP, "--erp-section-text")) >= 4.5);
});

test("superfícies de canvas e cartões são diferentes no modo claro", () => {
  assert.notEqual(cor(temaERP, "--erp-workspace"), cor(temaERP, "--erp-surface"));
});

test("inputs, abas e cartões têm seletores reutilizáveis", () => {
  for (const atributo of ["data-erp-field", "data-erp-tabs-list", "data-erp-card-title", "data-erp-dialog"]) {
    assert.ok(temaERP.includes(atributo), `Falta padrão global: ${atributo}`);
  }
});
