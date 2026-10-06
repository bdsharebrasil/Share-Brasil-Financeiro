import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, Eye, FileText, Loader2, Receipt, Save, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { buscarGestaoColaboradores, type ColaboradorGestao } from '@/lib/colaborador-api'
import { buscarOpcoesFinanceiroShare, type ContaBancaria } from '@/lib/financeiro-share-api'
import { formatCentavos, parseReaisToCentavos } from '@/lib/money'
import { type HoleriteLido } from '@/lib/holerite-parser'
import { lerHoleritePdf } from '@/lib/holerite-pdf'
import {
  buscarPagamentosFolha,
  carregarAnexoPagamentoFolha,
  excluirPagamentosFolhaColaborador,
  enviarAnexoPagamentoFolha,
  registrarPagamentoFolha,
  type ItemPagamentoPayload,
  type PagamentoFolha,
  type RotuloPagamento,
} from '@/lib/pagamentoSalarioApi'

type Campo = 'salario' | 'ferias' | 'decimo1' | 'decimo2' | 'beneficio' | 'horasVoo' | 'extra'
type Linha = {
  userId: string
  nome: string
  valores: Record<Campo, string>
  contaId: string
  dataPagamento: string
  observacoes: string
  holeriteUrl: string | null
  comprovanteUrl: string | null
  status: PagamentoFolha['status'] | null
  registrado: boolean
  dirty: boolean
  loading: boolean
}

const MAPA_CAMPOS: Record<Campo, { rotulo: RotuloPagamento; tipo: ItemPagamentoPayload['tipo_pagamento']; label: string }> = {
  salario: { rotulo: 'SALARIO', tipo: 'SALARIO', label: 'Salário' },
  ferias: { rotulo: 'FERIAS', tipo: 'FERIAS', label: 'Férias' },
  decimo1: { rotulo: '13_P1', tipo: 'DECIMO_TERCEIRO', label: '13º — P1' },
  decimo2: { rotulo: '13_P2', tipo: 'DECIMO_TERCEIRO', label: '13º — P2' },
  beneficio: { rotulo: 'BENEFICIO', tipo: 'OUTRO', label: 'Benefício' },
  horasVoo: { rotulo: 'HORAS_VOO', tipo: 'OUTRO', label: 'Horas de voo' },
  extra: { rotulo: 'EXTRA', tipo: 'OUTRO', label: 'Extra' },
}
const CAMPOS = Object.keys(MAPA_CAMPOS) as Campo[]
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const HOJE = () => {
  const data = new Date()
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}
const valoresVazios = (): Record<Campo, string> => ({ salario: '', ferias: '', decimo1: '', decimo2: '', beneficio: '', horasVoo: '', extra: '' })
const centavosParaTexto = (valor: number) => (valor ? (valor / 100).toFixed(2) : '')
const nomesCorrespondem = (primeiro: string, segundo: string) => {
  const normalizar = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((parte) => parte && !['DA', 'DAS', 'DE', 'DO', 'DOS', 'E'].includes(parte))
  const a = normalizar(primeiro)
  const b = normalizar(segundo)
  const menor = a.length <= b.length ? a : b
  const maior = a.length <= b.length ? b : a
  return menor.length > 0 && menor.every((parte) => maior.includes(parte))
}

function montarLinha(colaborador: ColaboradorGestao, pagamentos: PagamentoFolha[]): Linha {
  const itens = pagamentos.filter((pagamento) => pagamento.user_id === colaborador.id && pagamento.status !== 'CANCELADO')
  const valores = valoresVazios()
  for (const pagamento of itens) {
    const campo = CAMPOS.find((key) => MAPA_CAMPOS[key].rotulo === pagamento.rotulo)
    if (campo) valores[campo] = centavosParaTexto(Number(pagamento.valor_centavos))
  }
  const referencia = itens[0]
  return {
    userId: colaborador.id,
    nome: colaborador.nome_exibicao || colaborador.nome_completo,
    valores,
    contaId: referencia?.conta_pagamento_id || '',
    dataPagamento: referencia?.data_prevista || referencia?.data_pagamento || '',
    observacoes: referencia?.observacoes || '',
    holeriteUrl: itens.find((item) => item.holerite_url)?.holerite_url ?? null,
    comprovanteUrl: itens.find((item) => item.comprovante_url)?.comprovante_url ?? null,
    status: itens.some((item) => item.status === 'PAGO') ? 'PAGO' : referencia?.status ?? null,
    registrado: itens.length > 0,
    dirty: false,
    loading: false,
  }
}

function totalCentavos(linha: Linha) {
  return CAMPOS.reduce((total, campo) => total + parseReaisToCentavos(linha.valores[campo]), 0)
}

export function PagamentoSalarioTab() {
  const dataAtual = new Date()
  const [colaboradores, setColaboradores] = useState<ColaboradorGestao[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [mes, setMes] = useState(String(dataAtual.getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(dataAtual.getFullYear()))
  const [carregandoBase, setCarregandoBase] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [erroBase, setErroBase] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; pdf: boolean; tipo: 'holerite' | 'comprovante' } | null>(null)
  const anos = Array.from({ length: 7 }, (_, index) => String(dataAtual.getFullYear() - 3 + index))

  useEffect(() => {
    let ativo = true
    void Promise.all([buscarGestaoColaboradores(), buscarOpcoesFinanceiroShare()])
      .then(([pessoas, opcoes]) => {
        if (!ativo) return
        setColaboradores(pessoas.filter((pessoa) => String(pessoa.status ?? 'ativo').toLowerCase() === 'ativo'))
        setContas((opcoes.contas_bancarias ?? []).filter((conta) =>
          (!conta.tipo_caixa || conta.tipo_caixa.toUpperCase() === 'SHARE') && conta.ativo !== 0 && conta.ativo !== false,
        ))
      })
      .catch((cause: unknown) => {
        if (ativo) setErroBase(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados do Financeiro Share.')
      })
      .finally(() => { if (ativo) setCarregandoBase(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  const patch = (userId: string, mudanca: Partial<Linha>) => {
    setLinhas((atuais) => atuais.map((linha) => linha.userId === userId ? { ...linha, ...mudanca } : linha))
  }
  const patchValor = (userId: string, campo: Campo, valor: string) => {
    setLinhas((atuais) => atuais.map((linha) => linha.userId === userId
      ? { ...linha, valores: { ...linha.valores, [campo]: valor }, dirty: true }
      : linha))
  }

  const carregarPeriodo = async () => {
    if (!ano || !mes) return toast.error('Selecione mês e ano.')
    setCarregando(true)
    try {
      const { pagamentos } = await buscarPagamentosFolha(Number(ano), Number(mes))
      const novasLinhas = colaboradores.map((colaborador) => montarLinha(colaborador, pagamentos))
      novasLinhas.sort((a, b) => Number(b.registrado) - Number(a.registrado) || a.nome.localeCompare(b.nome, 'pt-BR'))
      setLinhas(novasLinhas)
      setExpandido(null)
    } catch (cause) {
      toast.error(`Não foi possível carregar os pagamentos: ${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setCarregando(false)
    }
  }

  const salvar = async (userId: string, silencioso = false): Promise<boolean> => {
    const linha = linhas.find((item) => item.userId === userId)
    if (!linha) return false
    const itens = CAMPOS.map((campo) => ({
      rotulo: MAPA_CAMPOS[campo].rotulo,
      tipo_pagamento: MAPA_CAMPOS[campo].tipo,
      valor_centavos: parseReaisToCentavos(linha.valores[campo]),
      preenchido: linha.valores[campo].trim() !== '',
    }))
    if (itens.some((item) => item.preenchido && item.valor_centavos <= 0)) {
      toast.error('Os valores preenchidos devem ser maiores que zero e válidos.')
      return false
    }
    const itensPayload: ItemPagamentoPayload[] = itens
      .filter((item) => item.preenchido && item.valor_centavos > 0)
      .map(({ preenchido: _preenchido, ...item }) => item)
    if (!itensPayload.length) {
      toast.error(`Informe ao menos um valor para ${linha.nome}. Para remover a competência inteira, use Excluir.`)
      return false
    }

    patch(userId, { loading: true })
    try {
      const chaveItens = itensPayload.map((item) => `${item.rotulo}=${item.valor_centavos}`).join(',')
      const resposta = await registrarPagamentoFolha({
        user_id: userId,
        ano: Number(ano),
        mes: Number(mes),
        data_pagamento: linha.dataPagamento || null,
        conta_pagamento_id: linha.contaId || null,
        observacoes: linha.observacoes.trim() || null,
        comprovante_url: linha.comprovanteUrl,
        holerite_url: linha.holeriteUrl,
        itens: itensPayload,
        idempotency_key: `folha:${userId}:${ano}-${mes}:${chaveItens}:${linha.dataPagamento || ''}`,
      })
      const colaborador = colaboradores.find((pessoa) => pessoa.id === userId)
      if (colaborador) patch(userId, montarLinha(colaborador, resposta.pagamentos))
      if (!silencioso) toast.success(`Pagamentos de ${linha.nome} registrados.`)
      return true
    } catch (cause) {
      patch(userId, { loading: false })
      toast.error(`Não foi possível salvar ${linha.nome}: ${cause instanceof Error ? cause.message : String(cause)}`)
      return false
    }
  }

  const salvarAlteracoes = async () => {
    const alteradas = linhas.filter((linha) => linha.dirty)
    if (!alteradas.length) return toast.info('Nenhuma alteração pendente.')
    let salvas = 0
    for (const linha of alteradas) if (await salvar(linha.userId, true)) salvas += 1
    if (salvas === alteradas.length) toast.success(`${salvas} colaborador(es) salvo(s).`)
    else if (salvas) toast.warning(`${salvas} de ${alteradas.length} colaborador(es) salvo(s); verifique os itens com erro.`)
  }

  const excluir = async (linha: Linha) => {
    if (!window.confirm(`Excluir os pagamentos de ${linha.nome} em ${mes}/${ano}?`)) return
    patch(linha.userId, { loading: true })
    try {
      await excluirPagamentosFolhaColaborador(linha.userId, Number(ano), Number(mes))
      const colaborador = colaboradores.find((pessoa) => pessoa.id === linha.userId)
      if (colaborador) patch(linha.userId, montarLinha(colaborador, []))
      setExpandido(null)
      toast.success(`Pagamentos de ${linha.nome} excluídos.`)
    } catch (cause) {
      patch(linha.userId, { loading: false })
      toast.error(`Não foi possível excluir: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  const enviarAnexo = async (linha: Linha, arquivo: File, tipo: 'holerite' | 'comprovante') => {
    if (!(arquivo.type === 'application/pdf' || ['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type))) {
      return toast.error('Formato não permitido. Envie PDF, JPEG, PNG ou WEBP.')
    }
    if (arquivo.size > 10 * 1024 * 1024) return toast.error('O arquivo deve ter até 10 MB.')
    patch(linha.userId, { loading: true })
    try {
      let linhaDestino = linha
      let anoDestino = Number(ano)
      let mesDestino = Number(mes)
      let leitura: HoleriteLido | null = null
      if (tipo === 'holerite' && arquivo.type === 'application/pdf') {
        try {
          leitura = await lerHoleritePdf(arquivo)
        } catch { leitura = null }
        if (leitura?.nomeColaborador && !nomesCorrespondem(leitura.nomeColaborador, linha.nome)) {
          throw new Error(`O holerite está em nome de ${leitura.nomeColaborador}, não de ${linha.nome}. Selecione o colaborador correto.`)
        }
        if (leitura && (leitura.ano !== anoDestino || leitura.mes !== mesDestino)) {
          const resposta = await buscarPagamentosFolha(leitura.ano, leitura.mes)
          const novasLinhas = colaboradores.map((colaborador) => montarLinha(colaborador, resposta.pagamentos))
          novasLinhas.sort((a, b) => Number(b.registrado) - Number(a.registrado) || a.nome.localeCompare(b.nome, 'pt-BR'))
          setAno(String(leitura.ano))
          setMes(String(leitura.mes).padStart(2, '0'))
          setLinhas(novasLinhas)
          setExpandido(linha.userId)
          anoDestino = leitura.ano
          mesDestino = leitura.mes
          linhaDestino = novasLinhas.find((item) => item.userId === linha.userId) ?? linha
        }
        if (leitura?.nomeColaborador && !nomesCorrespondem(leitura.nomeColaborador, linhaDestino.nome)) {
          throw new Error(`O colaborador ${linhaDestino.nome} não corresponde ao nome no holerite (${leitura.nomeColaborador}).`)
        }
        if (leitura && linhaDestino.status === 'PAGO') {
          throw new Error('Este pagamento já está marcado como pago e não pode ser alterado.')
        }
        if (leitura) {
          const resumoHolerite = `Holerite lido automaticamente: vencimentos ${formatCentavos(leitura.totalVencimentosCentavos ?? 0)}, descontos ${formatCentavos(leitura.totalDescontosCentavos ?? 0)}, líquido ${formatCentavos(leitura.totalLiquidoCentavos)}, salário-base ${formatCentavos(leitura.salarioBaseCentavos ?? 0)}.`
          const observacoesAnteriores = linhaDestino.observacoes.replace(/\n?Holerite lido automaticamente:[^\n]*/g, '').trim()
          patch(linha.userId, {
            valores: {
              ...linhaDestino.valores,
              salario: linhaDestino.valores.salario.trim() || centavosParaTexto(leitura.totalLiquidoCentavos),
            },
            observacoes: [observacoesAnteriores, resumoHolerite].filter(Boolean).join('\n').slice(0, 2000),
            dirty: true,
            loading: true,
          })
        }
      }
      const { url } = await enviarAnexoPagamentoFolha(arquivo, tipo, linha.userId, anoDestino, mesDestino)
      patch(linha.userId, {
        [tipo === 'holerite' ? 'holeriteUrl' : 'comprovanteUrl']: url,
        dirty: true,
        loading: false,
      })
      if (leitura) {
        toast.success(`Holerite lido e enviado. Líquido preenchido no campo Salário${leitura.ano !== Number(ano) || leitura.mes !== Number(mes) ? `; competência ajustada para ${String(leitura.mes).padStart(2, '0')}/${leitura.ano}` : ''}. Revise os dados e salve a linha.`)
      } else {
        toast.success(`${tipo === 'holerite' ? 'Holerite' : 'Comprovante'} enviado. Salve a linha para vinculá-lo ao pagamento.`)
        if (tipo === 'holerite') {
          toast.info('Não foi possível identificar os valores automaticamente neste arquivo. O anexo foi mantido; confira e preencha os campos manualmente.')
        }
      }
    } catch (cause) {
      patch(linha.userId, { loading: false })
      toast.error(`Não foi possível processar o anexo: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  const abrirPreview = async (url: string, tipo: 'holerite' | 'comprovante') => {
    try {
      const arquivo = await carregarAnexoPagamentoFolha(url)
      setPreview({ url: URL.createObjectURL(arquivo), pdf: arquivo.type === 'application/pdf', tipo })
    } catch (cause) {
      toast.error(`Não foi possível abrir o arquivo: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  const comPagamento = useMemo(() => linhas.filter((linha) => linha.registrado).length, [linhas])

  return <Card className="border-border/80">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <div>
        <CardTitle className="text-base">Registrar pagamentos de salários</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Cada valor informado gera um item separado em centavos e um lançamento de RH.</p>
      </div>
      {linhas.length > 0 && <Button onClick={salvarAlteracoes} disabled={carregando || !linhas.some((linha) => linha.dirty)} className="gap-2">
        <Save size={15} /> Salvar alterações
      </Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      {erroBase && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Falha ao carregar colaboradores ou contas: {erroBase}</p>}
      <div className="flex flex-col items-end gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row">
        <div className="w-full space-y-1.5 sm:flex-1">
          <Label htmlFor="pagamentos-folha-mes">Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger id="pagamentos-folha-mes"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{MESES.map((nome, index) => <SelectItem key={nome} value={String(index + 1).padStart(2, '0')}>{nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1.5 sm:flex-1">
          <Label htmlFor="pagamentos-folha-ano">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger id="pagamentos-folha-ano"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{anos.map((valor) => <SelectItem key={valor} value={valor}>{valor}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={() => void carregarPeriodo()} disabled={carregandoBase || carregando || !colaboradores.length} className="w-full gap-2 sm:w-auto">
          {carregandoBase || carregando ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
          Carregar competência
        </Button>
      </div>
      {carregandoBase && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Carregando colaboradores e contas...</div>}
      {!carregandoBase && linhas.length > 0 && <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold">{MESES[Number(mes) - 1]} / {ano}</span>
          <span className="text-muted-foreground">{comPagamento} de {linhas.length} colaboradores com pagamentos · totais exibidos em BRL</span>
        </div>
        <div className="space-y-2">
          {linhas.map((linha) => {
            const aberto = expandido === linha.userId
            const bloqueado = linha.status === 'PAGO'
            const anexos = [
              { tipo: 'holerite' as const, url: linha.holeriteUrl, Icon: FileText, label: 'Holerite' },
              { tipo: 'comprovante' as const, url: linha.comprovanteUrl, Icon: Receipt, label: 'Comprovante' },
            ]
            return <section key={linha.userId} className={`overflow-hidden rounded-xl border ${linha.dirty ? 'border-amber-500/50' : linha.registrado ? 'border-emerald-500/30' : 'border-border'}`}>
              <button type="button" onClick={() => setExpandido(aberto ? null : linha.userId)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{linha.nome}</strong>
                  <span className="text-xs text-muted-foreground">{linha.registrado ? formatCentavos(totalCentavos(linha)) : 'Sem pagamentos registrados'}</span>
                </span>
                {linha.registrado && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${bloqueado ? 'bg-blue-500/10 text-blue-700' : 'bg-emerald-500/10 text-emerald-700'}`}>{linha.status || 'PENDENTE'}</span>}
                <ChevronDown size={17} className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
              </button>
              {aberto && <div className="space-y-4 border-t border-border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {CAMPOS.map((campo) => <div key={campo} className="space-y-1.5">
                    <Label htmlFor={`${linha.userId}-${campo}`} className="text-xs">{MAPA_CAMPOS[campo].label} (R$)</Label>
                    <Input id={`${linha.userId}-${campo}`} type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={linha.valores[campo]} disabled={bloqueado || linha.loading} onChange={(event) => patchValor(linha.userId, campo, event.target.value)} />
                  </div>)}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta de pagamento</Label>
                    <Select value={linha.contaId || '__sem_conta__'} disabled={bloqueado || linha.loading} onValueChange={(value) => patch(linha.userId, { contaId: value === '__sem_conta__' ? '' : value, dirty: true })}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sem_conta__">Sem conta selecionada</SelectItem>
                        {contas.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${linha.userId}-data`} className="text-xs">Data prevista para pagamento</Label>
                    <Input id={`${linha.userId}-data`} type="date" value={linha.dataPagamento} disabled={bloqueado || linha.loading} onChange={(event) => patch(linha.userId, { dataPagamento: event.target.value, dirty: true })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor={`${linha.userId}-observacoes`} className="text-xs">Observações</Label>
                    <Input id={`${linha.userId}-observacoes`} value={linha.observacoes} disabled={bloqueado || linha.loading} placeholder="Observações do pagamento" onChange={(event) => patch(linha.userId, { observacoes: event.target.value, dirty: true })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {anexos.map(({ tipo, url, Icon, label }) => <div key={tipo} className="rounded-lg border border-dashed border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-medium"><Icon size={15} /> {label}{url ? ' anexado' : ''}</span>
                      <label className="cursor-pointer">
                        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={bloqueado || linha.loading} className="sr-only" onChange={(event) => {
                          const arquivo = event.currentTarget.files?.[0]
                          if (arquivo) void enviarAnexo(linha, arquivo, tipo)
                          event.currentTarget.value = ''
                        }} />
                        <span className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"><Upload size={13} /> Enviar</span>
                      </label>
                    </div>
                    {url && <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-1 text-xs" onClick={() => void abrirPreview(url, tipo)}><Eye size={13} className="mr-1" /> Visualizar (autenticado)</Button>}
                  </div>)}
                </div>
                {bloqueado && <p className="rounded-lg bg-blue-500/5 p-3 text-xs text-blue-700">Este pagamento está pago e não pode ser alterado nem excluído.</p>}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-sm font-semibold">Total: {formatCentavos(totalCentavos(linha))}</span>
                  <div className="flex gap-2">
                    {linha.registrado && <Button type="button" variant="destructive" disabled={linha.loading || bloqueado} onClick={() => void excluir(linha)} className="gap-2"><Trash2 size={14} /> Excluir competência</Button>}
                    <Button type="button" disabled={linha.loading || bloqueado || !linha.dirty} onClick={() => void salvar(linha.userId)} className="gap-2">
                      {linha.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar pagamentos
                    </Button>
                  </div>
                </div>
              </div>}
            </section>
          })}
        </div>
      </>}
      {!carregandoBase && !carregando && !erroBase && colaboradores.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum colaborador ativo encontrado.</p>}
      {!carregandoBase && !carregando && linhas.length === 0 && colaboradores.length > 0 && <p className="py-5 text-center text-xs text-muted-foreground">Selecione uma competência e carregue os colaboradores para registrar pagamentos.</p>}
    </CardContent>
    <Dialog open={Boolean(preview)} onOpenChange={(aberto) => { if (!aberto) setPreview(null) }}>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader><DialogTitle>{preview?.tipo === 'holerite' ? 'Holerite' : 'Comprovante de pagamento'}</DialogTitle></DialogHeader>
        {preview && (preview.pdf
          ? <iframe src={preview.url} title="Prévia de anexo" className="h-[70vh] w-full rounded-lg border" />
          : <div className="max-h-[70vh] overflow-auto"><img src={preview.url} alt="Prévia de anexo" className="mx-auto h-auto max-w-full rounded-lg" /></div>)}
      </DialogContent>
    </Dialog>
  </Card>
}
