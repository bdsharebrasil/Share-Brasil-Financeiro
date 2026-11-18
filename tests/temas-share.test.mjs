import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const css = postcss.parse(await readFile(new URL('../src/index.css', import.meta.url), 'utf8'));
function paleta(escuro) {
  const props = {};
  // A classe .dark está no mesmo elemento que :root; sua especificidade e valores prevalecem.
  for (const selector of escuro ? [':root', '.dark'] : [':root']) css.walkRules(rule => {
    if (rule.selector !== selector || rule.parent.type === 'atrule') return;
    rule.walkDecls(/^--/, d => { props[d.prop] = d.value; });
  });
  const resolver = (valor, vistos = []) => valor.replace(/var\((--[\w-]+)\)/g, (_, nome) => {
    assert.ok(!vistos.includes(nome), `Ciclo de variáveis: ${[...vistos, nome]}`);
    assert.ok(props[nome], `Variável ausente: ${nome}`);
    return resolver(props[nome], [...vistos, nome]);
  });
  return nome => resolver(props[nome]);
}
function rgb(valor) {
  if (valor.startsWith('#')) { const hex = valor.slice(1); return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
  const partes = valor.replace(/^hsl\(|\)$/g, '').match(/[\d.]+/g).map(Number);
  let [h, s, l] = partes; h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
}
const luminancia = cor => rgb(cor).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((t, c, i) => t + c * [.2126, .7152, .0722][i], 0);
function contraste(a, b) { const l = [luminancia(a), luminancia(b)].sort((a, b) => b - a); return (l[0] + .05) / (l[1] + .05); }
for (const escuro of [false, true]) {
  test(`textos, ações e estados legíveis no tema ${escuro ? 'escuro' : 'claro'}`, () => {
    const cor = paleta(escuro);
    const pares = [
      ['--foreground', '--background'], ['--card-foreground', '--card'], ['--muted-foreground', '--card'],
      ['--popover-foreground', '--popover'], ['--primary-foreground', '--primary'], ['--accent-foreground', '--accent'],
      ['--sidebar-foreground', '--sidebar'], ['--sidebar-primary', '--sidebar'],
      ['--app-success', '--app-success-soft'], ['--app-warning', '--app-warning-soft'], ['--app-danger', '--app-danger-soft'],
    ];
    for (const [texto, fundo] of pares) {
      const ratio = contraste(cor(texto), cor(fundo));
      assert.ok(ratio >= 4.5, `${texto} sobre ${fundo}: ${ratio.toFixed(2)}:1`);
    }
    assert.equal(cor('--app-color-scheme'), escuro ? 'dark' : 'light');
    assert.ok(luminancia(cor('--app-surface')) > (escuro ? luminancia(cor('--app-canvas')) : .9));
  });
  test(`paletas legadas herdam cores do tema ${escuro ? 'escuro' : 'claro'}`, () => {
    const cor = paleta(escuro);
    for (const [antigo, novo] of [['--light-surface', '--app-surface'], ['--light-canvas', '--app-canvas'], ['--light-text', '--app-text'], ['--light-line', '--app-line']]) assert.equal(cor(antigo), cor(novo));
    const azul = rgb(cor('--sidebar')).map(c => Math.round(c * 255));
    assert.deepEqual(azul, [16, 38, 58]);
  });
}
