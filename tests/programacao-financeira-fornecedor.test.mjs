import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/financeiro-share/ProgramarContaAPagarDialog.tsx", import.meta.url), "utf8");
const hook = await readFile(new URL("../src/hooks/useFornecedores.ts", import.meta.url), "utf8");
const financeiroCotista = await readFile(new URL("../src/components/FinanceiroCotista/FinanceiroCotista.tsx", import.meta.url), "utf8");

test("fornecedor permite uso manual no recibo ou cadastro permanente", () => {
  assert.match(source, /fornecedoresDisponiveis\.map\(\(item\) => \(\{ id: item\.id, label: item\.nome \}\)\)/);
  assert.doesNotMatch(source, /item\.origem ===/);
  assert.match(source, /allowFreeText/);
  assert.match(source, /Somente neste recibo/);
  assert.match(source, /Cadastrar fornecedor/);
  assert.match(source, /criarContatoShare/);
  assert.match(source, /criarFornecedorAbastecimento/);
  assert.match(source, /Nenhum fornecedor correspondente encontrado/);
});

test("lista de fornecedores é deduplicada por nome ignorando acentos e caixa", () => {
  assert.match(hook, /const byName = new Map/);
  assert.match(hook, /normalize\("NFD"\)/);
  assert.match(hook, /toLowerCase\(\)/);
  assert.match(hook, /loadSource\("agenda", buscarContatosShare\)/);
  assert.match(hook, /record\.nome_contato_responsavel/);
  assert.match(hook, /buscarAbastecimentoOpcoes/);
  assert.match(hook, /buscarHoteisShare/);
  assert.doesNotMatch(hook, /supabase\.from/);
});

test("agenda usa empresa ou razão social antes do contato responsável", () => {
  const campos = hook.match(/const name = \[([\s\S]*?)\]\.find/)?.[1] || "";
  const posicao = (campo) => campos.search(new RegExp(`(?:^|\\n)\\s*record\\.${campo},`));
  assert.ok(posicao("empresa") < posicao("nome"));
  assert.ok(posicao("razao_social") < posicao("nome"));
  assert.ok(posicao("empresa") < posicao("nome_contato_responsavel"));
  assert.ok(posicao("razao_social") < posicao("nome_contato_responsavel"));
});

test("fornecedores favoritos priorizam apelido no campo pesquisável", () => {
  assert.match(hook, /origem === "favorito" && apelido/);
  assert.match(hook, /const apelido = typeof record\.apelido === "string"/);
});

test("tabela e edição resolvem o nome do favorecido pelo ID cadastrado", () => {
  assert.match(financeiroCotista, /function nomeFornecedorLancamento/);
  assert.match(financeiroCotista, /fornecedor\.id\.endsWith\(`:\$\{identificador\}`\)/);
  assert.match(financeiroCotista, /valor: \(item\) => nomeFornecedorLancamento\(item, fornecedoresEdicao\)/);
  assert.match(financeiroCotista, /fornecedor: nomeFornecedorLancamento\(item, fornecedoresEdicao\)/);
});

test("programação inclui favoritos e remove o prefixo de origem ao selecionar", () => {
  assert.match(source, /includeFavorites: true/);
  assert.match(source, /id\.slice\(fornecedor\.origem\.length \+ 1\)/);
});

test("tipos de rateio exibem rótulos atuais sem alterar os valores enviados à API", () => {
  assert.match(source, /VARIAVEL_POR_VOO: "VARIAVEL POR VOO"/);
  assert.match(source, /VARIAVEL_POR_HORA: "VARIAVEL POR HORA"/);
  assert.match(source, /value=\{tipo\}>\{rotulosTipoRateio\[tipo\]\}/);
  assert.match(source, /tipo_rateio: tipoRateio/);
});

test("programação exige categoria presente na lista antes de enviar a requisição", () => {
  assert.match(source, /if \(!categoriaSelecionada\) \{[\s\S]{0,160}Selecione uma categoria de cliente válida/);
});
