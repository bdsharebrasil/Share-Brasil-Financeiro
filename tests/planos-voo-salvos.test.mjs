import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/pages/PlanoDeVoo.tsx", import.meta.url), "utf8");
const folder = await readFile(new URL("../src/components/plano/PlanosVooSalvos.tsx", import.meta.url), "utf8");
const meteo = await readFile(new URL("../src/components/plano/ConsultaMeteorologia.tsx", import.meta.url), "utf8");

test("plano de voo apresenta as quatro áreas solicitadas e separa formulário de rotas", () => {
  assert.match(page, /Criar Plano de Voo Completo/);
  assert.match(page, /Informações Aeródromo/);
  assert.match(page, /Meteorologia/);
  assert.match(page, /Planos de Voo Salvos/);
  assert.match(page, /type AbaCompleto = "formulario" \| "rotas"/);
  assert.match(page, /<PlanosVooSalvos/);
  assert.match(page, /<ConsultaAerodromo/);
  assert.match(page, /<ConsultaMeteorologia/);
  assert.match(page, /<CriarRotas/);
  assert.doesNotMatch(page, /Mapa da rota/);
});

test("pontos A e B alimentam a consulta de rota, mapa e informações AISWEB", () => {
  assert.match(page, /consultarRotaAisweb\(adep, ades\)/);
  assert.match(page, /<MapaRota/);
  assert.match(page, /<PainelAerodromos/);
});

test("planos salvos agrupam por matrícula e depois por mês com busca", () => {
  assert.match(folder, /matriculaPlano/);
  assert.match(folder, /chaveMes/);
  assert.match(folder, /Buscar matrícula, voo, rota ou ICAO/);
  assert.match(folder, /Aeronave não identificada/);
  assert.match(folder, /onAbrir=\{\(\) => setSelecionado\(plano\)\}/);
  assert.match(folder, /Dados do formulário ICAO/);
});

test("meteorologia consulta METAR/TAF e oferece as camadas solicitadas no mapa", () => {
  assert.match(meteo, /buscarClima\(codigo\)/);
  assert.match(meteo, /buscarRotaer\(codigo\)/);
  assert.match(meteo, /dados\.met\.metar/);
  assert.match(meteo, /dados\.met\.taf/);
  for (const camada of ["temp", "clouds", "wind", "rain", "pressure", "visibility"]) {
    assert.match(meteo, new RegExp(`id: "${camada}"`));
  }
});
