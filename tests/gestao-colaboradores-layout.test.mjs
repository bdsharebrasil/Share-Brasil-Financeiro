import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import postcss from 'postcss';

const css = postcss.parse(await readFile(new URL('../src/components/colaboradores/colaboradores.css', import.meta.url), 'utf8'));

test('cards de RH não herdam a célula compartilhada das etapas do formulário', () => {
  const posicionamentos = [];
  css.walkRules(rule => {
    if (!rule.selectors.includes('.rh-panel')) return;
    rule.walkDecls(decl => {
      if (['grid-area', 'grid-row', 'grid-column', 'position'].includes(decl.prop)) posicionamentos.push(`${decl.prop}: ${decl.value}`);
    });
  });
  assert.deepEqual(posicionamentos, [], 'Uma posição comum aos cards sobrepõe departamentos, aniversários e perfil');
});
