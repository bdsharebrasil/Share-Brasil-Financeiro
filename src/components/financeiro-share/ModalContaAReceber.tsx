import { BaixaResumo } from "@/components/financeiro-design/BaixaResumo";
import { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableCombobox } from '@/components/ui/searchableCombobox';
import { avisarAtualizacaoFinanceiro } from '@/lib/baixa-conciliada-api';

import { enviarComprovanteRecebimento, type ContaBancaria } from '../../lib/financeiro-share-api';
import type { ContaAReceber } from './tipos';

type TipoPagador = 'COTISTA' | 'SHARE' | 'HOLDING';
export type SaidaPagamento = 'DGA_BRADESCO' | 'CONTA_COTISTA';
type RateioInput = { rateio_id: string; valor_centavos: number };

export type DadosBaixaReceber = {
  dataRecebimento?: string;
  bancoRecebimento?: string;
  formaPagamento?: string;
  comprovanteRecebimentoUrl?: string;
  pagamentos: Array<{
    idempotency_key: string;
    data_pagamento: string;
    conta_bancaria_id: string;
    comprovante_url?: string | null;
    forma_pagamento?: string | null;
    tipo_pagador: TipoPagador;
    pagador_cotista_id?: string;
    pagador_holding_id?: string;
    saida_pagamento?: SaidaPagamento;
    valor_centavos: number;
    rateios: RateioInput[];
  }>;
};

interface ModalContaAReceberProps {
  conta: ContaAReceber;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixaReceber) => Promise<void>;
  contasBancarias: ContaBancaria[];
}

type Opcao = { id: string; label: string };
type Rateio = { id: string; nome: string; previsto: number; recebido: number };
type Pagamento = {
  chave: string;
  pagador: '' | 'COTISTA' | 'HOLDING';
  valor: string;
  data: string;
  banco: string;
  forma: string;
  saidaPagamento: '' | SaidaPagamento;
  arquivo: File | null;
  rateios: Record<string, string>;
};

type EnvioPagamento = Omit<DadosBaixaReceber['pagamentos'][number], 'comprovante_url'> & {
  arquivo: File | null;
};

const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Boleto', 'Dinheiro', 'Cartão'];
const TIPOS_COMPROVANTE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const LIMITE_COMPROVANTE = 10 * 1024 * 1024;
const numeroBR = new Intl.NumberFormat('pt-BR');
const dataBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const classeCampo = 'campo min-h-11 min-w-0 max-w-full !text-base md:!text-sm';
const rotulo = 'mb-1.5 block text-sm font-medium text-foreground';

function lerCentavos(texto: string, vazioComoZero = false): number {
  const valor = texto.trim();
  if (!valor && vazioComoZero) return 0;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor)) return NaN;

  const [inteiro, decimal = ''] = valor.replace(/\./g, '').split(',');
  const centavos = Number(inteiro + decimal.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : NaN;
}

function exibirValor(centavos: number, moeda = true): string {
  if (!Number.isSafeInteger(centavos)) return '—';

  const absoluto = Math.abs(centavos);
  const reais = Math.floor(absoluto / 100);
  const decimal = String(absoluto % 100).padStart(2, '0');
  const valor = `${centavos < 0 ? '−' : ''}${numeroBR.format(reais)},${decimal}`;
  return moeda ? `R$ ${valor}` : valor;
}

function hojeLocal(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

function lerData(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return null;

  const data = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor
    ? data
    : null;
}

function distribuir(pagamento: Pagamento, rateios: Rateio[]): RateioInput[] {
  return rateios.map(({ id }) => ({
    rateio_id: id,
    valor_centavos: lerCentavos(pagamento.rateios[id] ?? '', true),
  }));
}

function prepararEnvio(
  pagamentos: Pagamento[],
  rateios: Rateio[],
  bancos: Opcao[],
  conta: ContaAReceber,
  saldo: number,
): EnvioPagamento[] {
  const totalPorRateio = new Map(rateios.map((rateio) => [rateio.id, rateio.recebido]));
  let total = 0;

  const envio = pagamentos.map((pagamento, index): EnvioPagamento => {
    const prefixo = `Pagamento ${index + 1}`;
    const idPagador = pagamento.pagador === 'COTISTA' ? conta.cotistaId : conta.holdingId;
    const valor = lerCentavos(pagamento.valor);
    const distribuicao = distribuir(pagamento, rateios);
    const ehHoldSocio = Boolean(conta.holdingId);

    if (!pagamento.pagador || !idPagador) throw new Error(`${prefixo} — selecione o pagador.`);
    if (ehHoldSocio && !pagamento.saidaPagamento) {
      throw new Error(`${prefixo} — selecione a saída do pagamento do hold.`);
    }
    if (ehHoldSocio && pagamento.saidaPagamento === 'CONTA_COTISTA' && pagamento.pagador !== 'COTISTA') {
      throw new Error(`${prefixo} — CONTA COTISTA exige o cotista como pagador.`);
    }
    if (ehHoldSocio && pagamento.saidaPagamento === 'DGA_BRADESCO' && pagamento.pagador !== 'HOLDING') {
      throw new Error(`${prefixo} — DGA - BRADESCO exige a holding como pagadora.`);
    }
    if (!lerData(pagamento.data)) throw new Error(`${prefixo} — informe uma data válida.`);
    if (!bancos.some((banco) => banco.id === pagamento.banco)) {
      throw new Error(`${prefixo} — selecione uma conta bancária.`);
    }
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      throw new Error(`${prefixo} — informe um valor maior que zero, como 1.250,00.`);
    }
    if (distribuicao.some((item) => !Number.isSafeInteger(item.valor_centavos))) {
      throw new Error(`${prefixo} — corrija os valores dos rateios.`);
    }
    if (distribuicao.reduce((soma, item) => soma + item.valor_centavos, 0) !== valor) {
      throw new Error(`${prefixo} — a soma dos rateios deve ser igual ao valor do pagamento.`);
    }

    for (const item of distribuicao) {
      const acumulado = (totalPorRateio.get(item.rateio_id) ?? 0) + item.valor_centavos;
      totalPorRateio.set(item.rateio_id, acumulado);
    }

    total += valor;
    return {
      idempotency_key: pagamento.chave,
      data_pagamento: pagamento.data,
      conta_bancaria_id: pagamento.banco,
      forma_pagamento: pagamento.forma || null,
      tipo_pagador: pagamento.pagador,
      ...(pagamento.pagador === 'COTISTA'
        ? { pagador_cotista_id: idPagador }
        : { pagador_holding_id: idPagador }),
      ...(ehHoldSocio ? { saida_pagamento: pagamento.saidaPagamento as SaidaPagamento } : {}),
      valor_centavos: valor,
      rateios: distribuicao.filter((item) => item.valor_centavos > 0),
      arquivo: pagamento.arquivo,
    };
  });

  if (!Number.isSafeInteger(total) || total > saldo) {
    throw new Error('A soma dos pagamentos excede o saldo em aberto.');
  }

  for (const rateio of rateios) {
    const acumulado = totalPorRateio.get(rateio.id) ?? 0;
    if (!Number.isSafeInteger(acumulado) || acumulado > rateio.previsto) {
      throw new Error(`A distribuição excede o saldo do rateio de ${rateio.nome}.`);
    }
  }

  return envio;
}

export function ModalContaAReceber(props: ModalContaAReceberProps) {
  const envioEmCurso = useRef(false);

  function fechar() {
    if (!envioEmCurso.current) props.onFechar();
  }

  return (
    <Dialog
      open={props.aberto}
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
    >
      {props.aberto && (
        <Recebimento key={props.conta.id} {...props} onFechar={fechar} envioEmCurso={envioEmCurso} />
      )}
    </Dialog>
  );
}

type RecebimentoProps = ModalContaAReceberProps & { envioEmCurso: { current: boolean } };

function Recebimento({ conta, onFechar, onConfirmar, contasBancarias, envioEmCurso }: RecebimentoProps) {
  const descricaoId = useId();
  const comprovantes = useRef(new WeakMap<File, Promise<string>>());
  const [status, setStatus] = useState<'editando' | 'enviando' | 'concluido'>('editando');
  const [erro, setErro] = useState('');

  const cotista = conta.cotistaNome || 'Cotista não informado';
  const ehHoldSocio = Boolean(conta.holdingId);
  const aeronave = conta.aeronaveMatricula || 'Aeronave não informada';
  const vencimento = lerData(conta.dataVencimento?.slice(0, 10) ?? '');
  const rateios: Rateio[] = (conta.rateios ?? []).map((rateio, index) => ({
    id: rateio.id,
    nome: rateio.cotista_nome || (rateio.cotista_id === conta.cotistaId ? cotista : `Rateio ${index + 1}`),
    previsto: Number(rateio.valor_rateado_centavos),
    recebido: Number(rateio.valor_pago_real_centavos || 0),
  }));
  const totalConta = Math.round(Number(conta.valor || 0) * 100);
  const totalRecebido = rateios.reduce((total, rateio) => total + rateio.recebido, 0);
  const saldo = Math.max(0, totalConta - totalRecebido);
  const conciliacaoErro = (conta as ContaAReceber & { conciliacaoErro?: string }).conciliacaoErro;
  const valoresValidos = [totalConta, totalRecebido, saldo, ...rateios.flatMap((rateio) => [
    rateio.previsto,
    rateio.recebido,
  ])].every((valor) => Number.isSafeInteger(valor) && valor >= 0);
  const bloqueio = conciliacaoErro || (!rateios.length
    ? 'Vincule os rateios à conta antes de registrar o recebimento.'
    : !valoresValidos
      ? 'Confira os valores da conta e dos rateios antes de registrar o recebimento.'
      : saldo === 0
        ? 'Esta conta está sem saldo em aberto.'
        : '');

  const bancos = contasBancarias.map((banco) => ({
    id: banco.id,
    label: [banco.banco, banco.numero_conta].filter(Boolean).join(' · ') || 'Conta bancária',
  }));

  function criarPagamento(preencher: boolean): Pagamento {
    const saldosRateio = rateios.map((rateio) => Math.max(0, rateio.previsto - rateio.recebido));
    const sugerirRateios = preencher && saldosRateio.reduce((soma, valor) => soma + valor, 0) === saldo;
    return {
      chave: `recebimento-${conta.id}-${crypto.randomUUID()}`,
      pagador: conta.cotistaId ? 'COTISTA' : conta.holdingId ? 'HOLDING' : '',
      valor: preencher && saldo > 0 && valoresValidos ? exibirValor(saldo, false) : '',
      data: hojeLocal(),
      banco: '',
      forma: 'PIX',
      saidaPagamento: '',
      arquivo: null,
      rateios: sugerirRateios
        ? Object.fromEntries(rateios.map(({ id }, index) => [id, exibirValor(saldosRateio[index], false)]))
        : {},
    };
  }

  const [pagamentos, setPagamentos] = useState<Pagamento[]>(() => [criarPagamento(true)]);
  const totalInformado = pagamentos.reduce((soma, pagamento) => soma + lerCentavos(pagamento.valor, true), 0);
  const valoresProjetados = rateios.map((rateio) => ({
    ...rateio,
    projetado: pagamentos.reduce(
      (soma, pagamento) => soma + lerCentavos(pagamento.rateios[rateio.id] ?? '', true),
      rateio.recebido,
    ),
  }));
  const enviando = status === 'enviando';
  const concluido = status === 'concluido';

  function atualizar(chave: string, alterar: (pagamento: Pagamento) => Pagamento) {
    if (envioEmCurso.current || concluido) return;
    setErro('');
    setPagamentos((lista) => lista.map((item) => item.chave === chave ? alterar(item) : item));
  }

  function selecionarArquivo(chave: string, arquivo: File | null) {
    if (arquivo && (!TIPOS_COMPROVANTE.includes(arquivo.type) || arquivo.size > LIMITE_COMPROVANTE)) {
      const numero = pagamentos.findIndex((item) => item.chave === chave) + 1;
      setErro(`Pagamento ${numero} — use um comprovante em PDF, JPG, PNG ou WebP de até 10 MB.`);
      return;
    }
    atualizar(chave, (pagamento) => ({ ...pagamento, arquivo }));
  }

  function enviarArquivo(arquivo: File): Promise<string> {
    const existente = comprovantes.current.get(arquivo);
    if (existente) return existente;

    const envio = enviarComprovanteRecebimento(conta.id, arquivo)
      .then(({ url }) => url)
      .catch((falha: unknown) => {
        comprovantes.current.delete(arquivo);
        throw falha;
      });
    comprovantes.current.set(arquivo, envio);
    return envio;
  }

  async function confirmar() {
    if (envioEmCurso.current || bloqueio || concluido) return;

    let envio: EnvioPagamento[];
    try {
      envio = prepararEnvio(pagamentos, rateios, bancos, conta, saldo);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Revise os dados do recebimento.');
      return;
    }

    envioEmCurso.current = true;
    setStatus('enviando');
    setErro('');

    try {
      const registrados = await Promise.all(envio.map(async ({ arquivo, ...pagamento }) => ({
        ...pagamento,
        comprovante_url: arquivo ? await enviarArquivo(arquivo) : undefined,
      })));
      const primeiro = registrados[0];

      await onConfirmar({
        dataRecebimento: primeiro?.data_pagamento,
        bancoRecebimento: primeiro?.conta_bancaria_id,
        formaPagamento: primeiro?.forma_pagamento ?? undefined,
        comprovanteRecebimentoUrl: primeiro?.comprovante_url,
        pagamentos: registrados,
      });
      setStatus('concluido');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível registrar o recebimento.');
      setStatus('editando');
      return;
    } finally {
      envioEmCurso.current = false;
    }

    try {
      avisarAtualizacaoFinanceiro();
    } catch (falha) {
      console.error('Falha ao avisar sobre a atualização financeira.', falha);
    }
  }

  return (
    <DialogContent
      aria-describedby={descricaoId}
      onEscapeKeyDown={(event) => {
        if (envioEmCurso.current) event.preventDefault();
      }}
      onInteractOutside={(event) => event.preventDefault()}
      className="despesas-theme baixa-dialog [&>button]:hidden"
    >
      <DialogHeader className="baixa-header relative pr-14">
        <p className="baixa-kicker">Financeiro Share · Entrada</p>
        <DialogTitle className="baixa-titulo"><ArrowDownToLine size={20}/>Registrar recebimento</DialogTitle>
        <p id={descricaoId}>Registre os pagamentos recebidos na conta da Share, com datas, pagadores e comprovantes individuais.</p>
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar" disabled={enviando} onClick={onFechar} className="absolute right-3 top-3 text-muted-foreground"><X size={18}/></Button>
      </DialogHeader>

      <div className="baixa-body">
        <div className="min-w-0 space-y-5">
          <BaixaResumo descricao={conta.descricao || conta.categoriaNome || 'Conta a receber'} detalhe={`${cotista} · ${aeronave}`} valor={exibirValor(totalInformado)} rotuloValor="Total deste recebimento" vencimento={vencimento ? dataBR.format(vencimento) : 'Não informado'} categoria={conta.categoriaNome || '—'} situacao={conta.status || 'Em aberto'}/>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Valor original</dt><dd className="mt-1 font-semibold">{exibirValor(totalConta)}</dd></div>
            <div><dt className="text-muted-foreground">Já recebido</dt><dd className="mt-1 font-semibold">{exibirValor(totalRecebido)}</dd></div>
            <div><dt className="text-muted-foreground">Saldo em aberto</dt><dd className="mt-1 font-semibold">{exibirValor(saldo)}</dd></div>
          </dl>
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Pagamentos</h3>
              <span className="text-xs text-foreground">
                {pagamentos.length} {pagamentos.length === 1 ? 'pagamento' : 'pagamentos'}
              </span>
            </div>

            {bloqueio && (
              <p role="alert" className="mb-3 flex items-start gap-2 rounded-md border border-[hsl(var(--chart-3)/.55)] bg-[hsl(var(--chart-3)/.12)] p-3 text-sm text-foreground">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{bloqueio}</span>
              </p>
            )}

            <fieldset disabled={enviando || concluido || Boolean(bloqueio)} className="min-w-0 space-y-3">
              <legend className="sr-only">Dados dos pagamentos</legend>
              {pagamentos.map((pagamento, index) => (
                <EditorPagamento
                  key={pagamento.chave}
                  numero={index + 1}
                  pagamento={pagamento}
                  rateios={rateios}
                  bancos={bancos}
                  cotista={conta.cotistaId ? cotista : undefined}
                  holding={conta.holdingId ? conta.holdingNome || 'Holding vinculada' : undefined}
                  ehHoldSocio={ehHoldSocio}
                  onAlterar={(patch) => atualizar(pagamento.chave, (atual) => ({ ...atual, ...patch }))}
                  onRateio={(id, valor) => atualizar(pagamento.chave, (atual) => ({
                    ...atual,
                    rateios: { ...atual.rateios, [id]: valor },
                  }))}
                  onArquivo={(arquivo) => selecionarArquivo(pagamento.chave, arquivo)}
                  onRemover={pagamentos.length > 1 ? () => {
                    setErro('');
                    setPagamentos((lista) => lista.filter((item) => item.chave !== pagamento.chave));
                  } : undefined}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full gap-2 border-input bg-card text-foreground hover:bg-secondary sm:w-auto"
                onClick={() => {
                  const pagamento = criarPagamento(false);
                  setErro('');
                  setPagamentos((lista) => [...lista, pagamento]);
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Adicionar pagamento
              </Button>
            </fieldset>
          </div>
        </div>
      </div>

      <footer className="baixa-footer">
        {erro && (
          <p role="alert" className="mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-foreground">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            <span className="max-h-[18dvh] min-w-0 overflow-y-auto break-words">{erro}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 sm:block">
            <p className="text-sm text-muted-foreground">{concluido ? 'Recebimento registrado' : 'Total informado'}</p>
            <p className="break-words font-mono text-lg font-medium leading-tight text-foreground tabular-nums">
              {exibirValor(totalInformado)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-input bg-card text-foreground hover:bg-secondary"
              disabled={enviando}
              onClick={onFechar}
            >
              {concluido ? 'Fechar' : 'Cancelar'}
            </Button>
            {!concluido && (
              <Button
                type="button"
                className="financeiro-primary-action h-auto !min-h-11 min-w-0 flex-1 gap-2 whitespace-normal bg-[color:color-mix(in_srgb,hsl(var(--primary)),hsl(var(--card))_18%)] px-3 py-2 text-primary-foreground hover:brightness-110 sm:flex-none sm:px-4 [.dark_&]:bg-primary"
                onClick={confirmar}
                disabled={enviando || Boolean(bloqueio)}
              >
                {enviando
                  ? <Loader2 size={16} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
                  : <Check size={16} className="shrink-0" aria-hidden="true" />}
                {enviando ? 'Registrando…' : 'Confirmar recebimento'}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </DialogContent>
  );
}

type EditorPagamentoProps = {
  numero: number;
  pagamento: Pagamento;
  rateios: Rateio[];
  bancos: Opcao[];
  cotista?: string;
  holding?: string;
  ehHoldSocio: boolean;
  onAlterar: (patch: Partial<Pagamento>) => void;
  onRateio: (id: string, valor: string) => void;
  onArquivo: (arquivo: File | null) => void;
  onRemover?: () => void;
};

function EditorPagamento({
  numero, pagamento, rateios, bancos, cotista, holding, ehHoldSocio, onAlterar, onRateio, onArquivo, onRemover,
}: EditorPagamentoProps) {
  const id = useId();
  const totalRateios = distribuir(pagamento, rateios).reduce((total, item) => total + item.valor_centavos, 0);
  const valor = lerCentavos(pagamento.valor);
  const diferenca = valor - totalRateios;

  return (
    <section aria-labelledby={`${id}-titulo`} className="financeiro-panel min-w-0 !overflow-visible text-card-foreground">
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
        <h4 id={`${id}-titulo`} className="text-sm font-semibold text-foreground">Pagamento {numero}</h4>
        {onRemover && (
          <Button
            type="button"
            variant="ghost"
            onClick={onRemover}
            aria-label={`Remover pagamento ${numero}`}
            className="min-h-11 gap-2 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={15} aria-hidden="true" />
            Remover
          </Button>
        )}
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor={`${id}-pagador`} className={rotulo}>Pagador</Label>
            <select
              id={`${id}-pagador`}
              value={pagamento.pagador}
              onChange={(event) => {
                const opcao = event.currentTarget.value;
                onAlterar({ pagador: opcao === 'COTISTA' || opcao === 'HOLDING' ? opcao : '' });
              }}
              className={`${classeCampo} truncate`}
            >
              <option value="">Selecione o pagador</option>
              {cotista && <option value="COTISTA">Cotista · {cotista}</option>}
              {holding && <option value="HOLDING">Holding · {holding}</option>}
            </select>
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${id}-valor`} className={rotulo}>Valor recebido</Label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
              <Input
                id={`${id}-valor`}
                inputMode="decimal"
                value={pagamento.valor}
                placeholder="0,00"
                onChange={(event) => onAlterar({ valor: event.currentTarget.value })}
                className={`${classeCampo} !pl-10 font-mono tabular-nums`}
              />
            </div>
          </div>
          {ehHoldSocio && (
            <div className="min-w-0">
              <Label htmlFor={`${id}-saida`} className={rotulo}>Saída do pagamento do hold</Label>
              <select
                id={`${id}-saida`}
                value={pagamento.saidaPagamento}
                onChange={(event) => {
                  const saida = event.currentTarget.value as '' | SaidaPagamento;
                  onAlterar({
                    saidaPagamento: saida,
                    pagador: saida === 'CONTA_COTISTA' ? 'COTISTA' : saida === 'DGA_BRADESCO' ? 'HOLDING' : '',
                  });
                }}
                className={classeCampo}
              >
                <option value="">Selecione a origem</option>
                <option value="DGA_BRADESCO">DGA - BRADESCO · pago pela holding</option>
                <option value="CONTA_COTISTA">CONTA COTISTA · pago diretamente pelo cotista</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Define quem realizou o pagamento e o rateio do hold.</p>
            </div>
          )}
          <div className="min-w-0">
            <Label htmlFor={`${id}-data`} className={rotulo}>Data do pagamento</Label>
            <Input
              id={`${id}-data`}
              type="date"
              value={pagamento.data}
              onChange={(event) => onAlterar({ data: event.currentTarget.value })}
              className={`${classeCampo} [color-scheme:light] [.dark_&]:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:!filter-none`}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${id}-forma`} className={rotulo}>Forma de pagamento</Label>
            <select
              id={`${id}-forma`}
              value={pagamento.forma}
              onChange={(event) => onAlterar({ forma: event.currentTarget.value })}
              className={classeCampo}
            >
              <option value="">Selecione a forma</option>
              {FORMAS_PAGAMENTO.map((forma) => <option key={forma} value={forma}>{forma}</option>)}
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2" role="group" aria-labelledby={`${id}-banco`}>
            <span id={`${id}-banco`} className={rotulo}>Conta bancária</span>
            <SearchableCombobox
              items={bancos}
              value={pagamento.banco}
              onChange={(banco) => onAlterar({ banco })}
              placeholder="Selecione a conta de destino"
              searchPlaceholder="Buscar banco ou número da conta…"
              emptyMessage="Nenhuma conta encontrada."
              wrapSelectedLabel
              className={`${classeCampo} h-auto !min-h-11 justify-between text-left`}
            />
          </div>
        </div>

        {rateios.length > 0 && (
          <div aria-labelledby={`${id}-rateios`} role="group">
            <h5 id={`${id}-rateios`} className="text-sm font-semibold text-foreground">Distribuição por rateio</h5>
            <p className="mt-1 text-sm text-muted-foreground">Distribua o valor recebido entre os saldos dos rateios.</p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-muted/40">
              {rateios.map((rateio, index) => {
                const campoId = `${id}-rateio-${index}`;
                return (
                  <li key={rateio.id} className="grid min-w-0 gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center">
                    <div className="min-w-0">
                      <Label htmlFor={campoId} className="break-words text-sm font-medium text-foreground">
                        {rateio.nome}<span className="sr-only">, valor destinado ao rateio em reais</span>
                      </Label>
                      <p id={`${campoId}-saldo`} className="mt-1 break-words text-xs text-muted-foreground">
                        Saldo em aberto {exibirValor(Math.max(0, rateio.previsto - rateio.recebido))}
                      </p>
                    </div>
                    <Input
                      id={campoId}
                      aria-describedby={`${campoId}-saldo`}
                      inputMode="decimal"
                      value={pagamento.rateios[rateio.id] ?? ''}
                      placeholder="0,00"
                      onChange={(event) => onRateio(rateio.id, event.currentTarget.value)}
                      className={`${classeCampo} text-right font-mono tabular-nums`}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <p>Total distribuído <strong className="font-semibold text-foreground tabular-nums">{exibirValor(totalRateios)}</strong></p>
              {Number.isSafeInteger(diferenca) && diferenca !== 0 && (
                <p className="rounded-sm bg-[hsl(var(--chart-3)/.12)] px-1.5 font-medium text-foreground">
                  {diferenca > 0 ? 'A distribuir' : 'Distribuído a mais'} {exibirValor(Math.abs(diferenca))}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">
            Comprovante <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
          </p>
          {pagamento.arquivo && (
            <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 break-all text-sm text-foreground">{pagamento.arquivo.name}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover comprovante do pagamento ${numero}`}
                className="h-11 w-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onArquivo(null)}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
          <input
            id={`${id}-arquivo`}
            type="file"
            accept={TIPOS_COMPROVANTE.join(',')}
            aria-describedby={`${id}-arquivo-ajuda`}
            className="peer sr-only"
            onChange={(event) => {
              const arquivo = event.currentTarget.files?.[0];
              if (arquivo) onArquivo(arquivo);
              event.currentTarget.value = '';
            }}
          />
          <Label
            htmlFor={`${id}-arquivo`}
            className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm text-foreground hover:bg-muted/40 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-card peer-disabled:cursor-default peer-disabled:opacity-60"
          >
            <Paperclip size={15} aria-hidden="true" />
            {pagamento.arquivo ? 'Trocar comprovante' : 'Anexar comprovante'}
            <span className="sr-only"> do pagamento {numero}</span>
          </Label>
          <p id={`${id}-arquivo-ajuda`} className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG ou WebP · até 10 MB
          </p>
        </div>
      </div>
    </section>
  );
}
