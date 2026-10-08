import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const navigation = await readFile(new URL('../src/types/navegacao.ts', import.meta.url), 'utf8')
const sidebar = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8')
const layout = await readFile(new URL('../src/components/layout/LayoutInterno.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('../src/components/dashboard/gestor/MenuGestor.tsx', import.meta.url), 'utf8')

test('menu Gestor fica visível somente a admin e gestor master', () => {
  assert.match(navigation, /id: "gestor", label: "Gestor"/)
  assert.match(sidebar, /item\.id !== "gestor" \|\| podeAcessarMenuGestor/)
  assert.match(layout, /\["admin", "administrador", "gestor_master"\]/)
  assert.match(layout, /"financeiro_master"/)
  assert.doesNotMatch(layout.match(/const menuGestorPermitido = ([^;]+)/)?.[1] || '', /financeiro_master/)
})

test('Dashboard Gestor reutiliza o caixa existente e prevê entradas/saídas registradas', () => {
  assert.match(menu, /<AbaCaixaEmpresa \/>/)
  assert.match(menu, /buscarContasAPagar\(\)/)
  assert.match(menu, /buscarContasAReceber\(\)/)
  assert.match(menu, /Até 30 dias/)
  assert.match(menu, /Leitura estratégica/)
})

test('editor mantém timbre Share Brasil e grava contratos e anexos pelas rotas protegidas', () => {
  assert.match(menu, /src="\/logo\.share\.png"/)
  assert.match(menu, /border border-\[#174f78\]/)
  assert.match(menu, /\/api\/gestor\/contratos/)
  assert.match(menu, /contrato_anexos/)
  assert.match(menu, /contrato_cotista/)
})

test('impressão do contrato mantém o fluxo paginável e não corta o texto', () => {
  assert.match(menu, /#contrato-preview\{position:static!important/)
  assert.match(menu, /overflow:visible!important/)
  assert.match(menu, /height:auto!important/)
  assert.match(menu, /page-break-inside:auto!important/)
  assert.doesNotMatch(menu, /#contrato-preview\{position:absolute!important/)
})
