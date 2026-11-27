import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
test("ficha consulta o estado persistido do item plano_voo e omite os cards", async () => {
  const ficha = await readFile(new URL("../src/components/agendamento/FichaAgendaOperacional.tsx",import.meta.url),"utf8");
  const estado = await readFile(new URL("../src/components/agendamento/estadoPlanoPreparacao.ts",import.meta.url),"utf8");
  assert.match(estado,/itens\?\.plano_voo\?\.estado === "CONCLUIDO"/);
  assert.match(ficha,/planoAprovado &&/);
  assert.doesNotMatch(ficha,/Combustível do plano/);
  assert.match(ficha,/<JornadaVoo incorporadoNaFicha/);
});
test("histórico tem navegação exclusiva e retorno preservado", async () => {
  const lista = await readFile(new URL("../src/components/agendamento/ListaAgendaOperacional.tsx",import.meta.url),"utf8");
  const pagina = await readFile(new URL("../src/pages/Agendamentos.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(lista,/<details/);
  assert.match(lista,/Voltar aos clientes/);
  assert.match(pagina,/if \(!selecionada && clienteHistorico\) setClienteHistorico\(null\)/);
});
test("cartas de alta e baixa não usam mapas genéricos como substituto", async () => {
  const mapa = await readFile(new URL("../src/components/agendamento/MapaAgendaCamadas.tsx",import.meta.url),"utf8");
  assert.match(mapa,/VITE_MAPA_ENRC_ALTA_TILES/);
  assert.match(mapa,/VITE_MAPA_ENRC_BAIXA_TILES/);
  assert.match(mapa,/if \(!cartaDisponivel\(modo\)\) return \{ version: 8, sources: \{\}/);
});
