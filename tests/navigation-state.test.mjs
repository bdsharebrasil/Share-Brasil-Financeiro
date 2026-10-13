import assert from 'node:assert/strict'
import { test } from 'node:test'
import { limparNavegacao, restaurarNavegacao, salvarNavegacao } from '../src/lib/navigation-state.ts'

const menus = {
  operacoes: [{ id: 'overview' }, { id: 'diario-de-bordo' }],
  'share-brasil': [{ id: 'overview' }, { id: 'documentos' }],
  gestor: [{ id: 'overview' }, { id: 'financeiro-share' }],
}

function criarArmazenamento(inicial = {}) {
  const valores = new Map(Object.entries(inicial))
  return {
    getItem: (chave) => valores.get(chave) ?? null,
    setItem: (chave, valor) => valores.set(chave, valor),
    removeItem: (chave) => valores.delete(chave),
    valores,
  }
}

test('restaura o ambiente e a página salvos após uma recarga', () => {
  const armazenamento = criarArmazenamento({
    'share-brasil:pagina-ativa': JSON.stringify({ ambiente: 'operacoes', menuAtivo: 'diario-de-bordo' }),
  })

  assert.deepEqual(restaurarNavegacao(menus, armazenamento), {
    ambiente: 'operacoes',
    menuAtivo: 'diario-de-bordo',
    restaurada: true,
  })
})

test('mantém páginas internas e perfil que não aparecem como item direto do menu', () => {
  const armazenamento = criarArmazenamento({
    'share-brasil:pagina-ativa': JSON.stringify({ ambiente: 'operacoes', menuAtivo: 'aerodromos' }),
  })
  assert.equal(restaurarNavegacao(menus, armazenamento).menuAtivo, 'aerodromos')

  armazenamento.setItem('share-brasil:pagina-ativa', JSON.stringify({ ambiente: 'share-brasil', menuAtivo: 'perfil' }))
  assert.equal(restaurarNavegacao(menus, armazenamento).menuAtivo, 'perfil')
})

test('usa o dashboard inicial se o estado salvo for inválido ou ilegível', () => {
  const armazenamento = criarArmazenamento({
    'share-brasil:pagina-ativa': JSON.stringify({ ambiente: 'gestor', menuAtivo: 'menu-inexistente' }),
  })
  assert.deepEqual(restaurarNavegacao(menus, armazenamento), {
    ambiente: 'share-brasil',
    menuAtivo: 'overview',
    restaurada: false,
  })

  armazenamento.setItem('share-brasil:pagina-ativa', '{json inválido')
  assert.equal(restaurarNavegacao(menus, armazenamento).restaurada, false)
})

test('persiste e limpa a página ativa sem deixar de funcionar se o armazenamento falhar', () => {
  const armazenamento = criarArmazenamento()
  salvarNavegacao(armazenamento, { ambiente: 'gestor', menuAtivo: 'financeiro-share' })
  assert.equal(restaurarNavegacao(menus, armazenamento).menuAtivo, 'financeiro-share')

  limparNavegacao(armazenamento)
  assert.equal(restaurarNavegacao(menus, armazenamento).restaurada, false)

  const bloqueado = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
  assert.equal(restaurarNavegacao(menus, bloqueado).ambiente, 'share-brasil')
  assert.doesNotThrow(() => salvarNavegacao(bloqueado, { ambiente: 'share-brasil', menuAtivo: 'overview' }))
  assert.doesNotThrow(() => limparNavegacao(bloqueado))
})
