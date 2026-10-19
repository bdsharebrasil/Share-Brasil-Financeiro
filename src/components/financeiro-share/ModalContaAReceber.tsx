import { avisarAtualizacaoFinanceiro } from '@/lib/baixa-conciliada-api';
import { useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Paperclip, Plane, Plus, Trash2, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContaAReceber } from './tipos';
import { enviarComprovanteRecebimento, type ContaBancaria } from '../../lib/financeiro-share-api';
import { SearchableCombobox } from '@/components/ui/searchableCombobox';

type TipoPagador = 'COTISTA' | 'SHARE' | 'HOLDING';
const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Boleto', 'Dinheiro', 'Cartão'];
type RateioInput = { rateio_id: string; valor_centavos: number };

type PagamentoForm = {
  id: string;
  idempotency_key: string;
  tipo_pagador: TipoPagador;
  pagadorId: string;
  valor: string;
  data_pagamento: string;
  conta_bancaria_id: string;
  forma_pagamento: string;
  comprovante: File | null;
  rateios: Record<string, string>;
};

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

const cents = (value: string) => /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100) : NaN;
const money = (value: number) => (value / 100).toFixed(2).replace('.', ',');
const TIPOS_COMPROVANTE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const dataLegivel = (value: string | null | undefined) => {
  if (!value) return 'Não informada';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date);
};

export function ModalContaAReceber({ conta, aberto, onFechar, onConfirmar, contasBancarias }: ModalContaAReceberProps) {
  const local = new Date();
  const hoje = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  const trava = useRef(false);
  const conciliacaoErro = (conta as ContaAReceber & { conciliacaoErro?: string }).conciliacaoErro;
  const rateios = useMemo(() => conta.rateios ?? [], [conta.rateios]);
  const esperado = Math.round(Number(conta.valor || 0) * 100);
  const recebido = rateios.reduce((sum, rateio) => sum + Number(rateio.valor_pago_real_centavos || 0), 0);
  const saldo = Math.max(0, esperado - recebido);
  const novoPagamento = (): PagamentoForm => ({
    id: crypto.randomUUID(), idempotency_key: `recebimento-${conta.id}-${crypto.randomUUID()}`,
    tipo_pagador: 'COTISTA', pagadorId: conta.cotistaId ?? '', valor: money(saldo || esperado),
    data_pagamento: hoje, conta_bancaria_id: '', forma_pagamento: 'PIX', comprovante: null,
    rateios: Object.fromEntries(rateios.map((rateio) => [rateio.id, money(Math.max(0, Number(rateio.valor_rateado_centavos) - Number(rateio.valor_pago_real_centavos || 0)))])),
  });
  const [pagamentos, setPagamentos] = useState<PagamentoForm[]>(() => [novoPagamento()]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const totalInformado = useMemo(() => pagamentos.reduce((sum, pagamento) => sum + cents(pagamento.valor), 0), [pagamentos]);
  const quitadoPorRateio = useMemo(() => Object.fromEntries(rateios.map((rateio) => [
    rateio.id,
    Number(rateio.valor_pago_real_centavos || 0) + pagamentos.reduce((sum, pagamento) => sum + cents(pagamento.rateios[rateio.id] ?? '0'), 0),
  ])), [pagamentos, rateios]);
  const cotistaLabel = conta.cotistaNome || 'Cotista não informado';
  const aeronaveLabel = conta.aeronaveMatricula || 'Aeronave não informada';
  const pagadores = [
    ...(conta.cotistaId ? [{ id: conta.cotistaId, label: `Cotista · ${cotistaLabel}` }] : []),
    ...(conta.holdingId ? [{ id: conta.holdingId, label: `Holding · ${conta.holdingNome || 'Holding vinculada'}` }] : []),
  ];
  const contas = contasBancarias.map((item) => ({ id: item.id, label: [item.banco, item.numero_conta].filter(Boolean).join(' · ') || 'Conta bancária' }));

  function atualizar(id: string, patch: Partial<PagamentoForm>) {
    setPagamentos((current) => current.map((pagamento) => pagamento.id === id ? { ...pagamento, ...patch } : pagamento));
  }
  function atualizarRateio(id: string, rateioId: string, value: string) {
    setPagamentos((current) => current.map((pagamento) => pagamento.id === id ? { ...pagamento, rateios: { ...pagamento.rateios, [rateioId]: value } } : pagamento));
  }
  function adicionarPagamento() { setPagamentos((current) => [...current, novoPagamento()]); }
  function selecionarComprovante(id: string, arquivo?: File) {
    if (!arquivo) return;
    if (!TIPOS_COMPROVANTE.includes(arquivo.type)) { setErro('O comprovante deve ser PDF, PNG, JPG ou WebP.'); return; }
    if (arquivo.size > 10 * 1024 * 1024) { setErro('O comprovante deve ter no máximo 10 MB.'); return; }
    setErro(null);
    atualizar(id, { comprovante: arquivo });
  }

  async function confirmar() {
    if (trava.current) return;
    if (!rateios.length || conciliacaoErro) { setErro(conciliacaoErro || 'Obrigação sem rateio vinculado. Regularize antes de receber.'); return; }
    if (Object.values(quitadoPorRateio).some((value) => !Number.isSafeInteger(value)) || rateios.some((rateio) => quitadoPorRateio[rateio.id] > Number(rateio.valor_rateado_centavos))) { setErro('A distribuição excede o saldo de um rateio ou contém valor inválido.'); return; }
    const payload: Array<Omit<DadosBaixaReceber['pagamentos'][number], 'comprovante_url'> & { arquivo: File | null }> = [];
    for (const pagamento of pagamentos) {
      const arquivo = pagamento.comprovante;
      if (pagamento.tipo_pagador === 'SHARE') { setErro('Recebimento da Share exige um pagador externo.'); return; }
      const date = new Date(`${pagamento.data_pagamento}T12:00:00Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== pagamento.data_pagamento) { setErro('Data de pagamento inválida.'); return; }
      const valorCentavos = cents(pagamento.valor);
      const distribuicao = rateios.map((rateio) => ({ rateio_id: rateio.id, valor_centavos: cents(pagamento.rateios[rateio.id] ?? '0') })).filter((rateio) => rateio.valor_centavos > 0);
      if (!pagamento.conta_bancaria_id.trim() || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || !pagamento.data_pagamento || !distribuicao.length) {
        setErro('Cada pagamento precisa de data, conta bancária, valor positivo e ao menos um rateio.'); return;
      }
      if ((pagamento.tipo_pagador === 'COTISTA' || pagamento.tipo_pagador === 'HOLDING') && !pagamento.pagadorId.trim()) {
        setErro('Selecione o pagador real.'); return;
      }
      if (distribuicao.reduce((sum, rateio) => sum + rateio.valor_centavos, 0) !== valorCentavos) {
        setErro('O valor de cada pagamento deve ser exatamente igual à soma dos seus rateios.'); return;
      }
      payload.push({ idempotency_key: pagamento.idempotency_key, data_pagamento: pagamento.data_pagamento, conta_bancaria_id: pagamento.conta_bancaria_id, forma_pagamento: pagamento.forma_pagamento || null, tipo_pagador: pagamento.tipo_pagador, ...(pagamento.tipo_pagador === 'COTISTA' ? { pagador_cotista_id: pagamento.pagadorId } : {}), ...(pagamento.tipo_pagador === 'HOLDING' ? { pagador_holding_id: pagamento.pagadorId } : {}), valor_centavos: valorCentavos, rateios: distribuicao, arquivo });
    }
    if (totalInformado > saldo) { setErro('A soma dos novos pagamentos não pode exceder o saldo restante da conta.'); return; }
    trava.current = true; setEnviando(true); setErro(null);
    try {
      const pagamentosComComprovante = await Promise.all(payload.map(async ({ arquivo, ...pagamento }) => ({ ...pagamento, comprovante_url: arquivo ? (await enviarComprovanteRecebimento(conta.id, arquivo)).url : undefined })));
      const primeiro = pagamentosComComprovante[0];
      await onConfirmar({ dataRecebimento: primeiro?.data_pagamento, bancoRecebimento: primeiro?.conta_bancaria_id, formaPagamento: primeiro?.forma_pagamento ?? undefined, comprovanteRecebimentoUrl: primeiro?.comprovante_url, pagamentos: pagamentosComComprovante });
      avisarAtualizacaoFinanceiro();
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha ao dar baixa na conta.'); }
    finally { trava.current = false; setEnviando(false); }
  }

  return <Dialog open={aberto} onOpenChange={(value) => { if (!value && !trava.current) onFechar(); }}>
    <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden border-0 bg-[#0a0f17] p-0 text-slate-100 shadow-[0_28px_100px_rgba(0,0,0,.65)] sm:max-w-4xl sm:rounded-2xl">
      <DialogHeader className="border-b border-white/[.08] px-5 py-5 pr-12 text-left sm:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-300">Contas a receber · liquidação</p>
        <DialogTitle className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">Receber conta — {conta.descricao || conta.categoriaNome || 'Conta a receber'}</DialogTitle>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2"><UserRound size={14} className="text-cyan-300" />{cotistaLabel}</span>
          <span className="inline-flex items-center gap-2"><Plane size={14} className="text-cyan-300" />{aeronaveLabel}</span>
          <span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-cyan-300" />Vence em {dataLegivel(conta.dataVencimento)}</span>
        </div>
      </DialogHeader>
      <div className="max-h-[calc(92dvh-170px)] overflow-y-auto px-5 py-5 sm:px-7">
        <fieldset disabled={enviando} className="space-y-5">
          <div className="grid gap-2 rounded-xl bg-[#111a27] p-3 sm:grid-cols-3 sm:p-4">
            <div className="rounded-lg px-2 py-1"><span className="text-xs text-slate-400">Saldo total da conta</span><strong className="mt-1 block text-base font-semibold text-slate-100">R$ {money(esperado)}</strong></div>
            <div className="rounded-lg px-2 py-1"><span className="text-xs text-slate-400">Saldo já recebido</span><strong className="mt-1 block text-base font-semibold text-slate-100">R$ {money(recebido)}</strong></div>
            <div className="rounded-lg bg-emerald-400/[.08] px-3 py-2"><span className="text-xs text-emerald-200/75">Saldo restante</span><strong className="mt-1 block text-base font-semibold text-emerald-300">R$ {money(saldo)}</strong></div>
          </div>
          {pagamentos.map((pagamento, index) => <section key={pagamento.id} className="space-y-4 rounded-xl bg-[#0e1520] p-4 sm:p-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-100">Pagamento {index + 1}</h3>{pagamentos.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setPagamentos((items) => items.filter((item) => item.id !== pagamento.id))} className="gap-1.5 text-slate-400 hover:bg-red-400/10 hover:text-red-300"><Trash2 size={14} />Remover</Button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-slate-300">Pagador real</Label><SearchableCombobox items={pagadores} value={pagamento.pagadorId} onChange={(id) => atualizar(pagamento.id, { pagadorId: id, tipo_pagador: id === conta.holdingId && conta.holdingId ? 'HOLDING' : 'COTISTA' })} placeholder="Selecione cotista ou holding" searchPlaceholder="Buscar pelo nome…" emptyMessage="Nenhum pagador identificado nesta conta." wrapSelectedLabel className="border-white/[.08] bg-[#131c29] text-slate-100" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300">Valor deste pagamento (R$)</Label><div className="relative"><CircleDollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input value={pagamento.valor} onChange={(event) => atualizar(pagamento.id, { valor: event.target.value })} inputMode="decimal" aria-label="Valor deste pagamento em reais" className="border-white/[.08] bg-[#131c29] pl-9 text-slate-100" /></div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-slate-300">Data do pagamento</Label><Input type="date" value={pagamento.data_pagamento} onChange={(event) => atualizar(pagamento.id, { data_pagamento: event.target.value })} className="border-white/[.08] bg-[#131c29] text-slate-100" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300">Conta bancária</Label><SearchableCombobox items={contas} value={pagamento.conta_bancaria_id} onChange={(id) => atualizar(pagamento.id, { conta_bancaria_id: id })} placeholder="Selecione a conta" searchPlaceholder="Buscar banco ou conta…" emptyMessage="Nenhuma conta encontrada." wrapSelectedLabel className="border-white/[.08] bg-[#131c29] text-slate-100" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300">Forma de pagamento</Label><SearchableCombobox items={FORMAS_PAGAMENTO.map((forma) => ({ id: forma, label: forma }))} value={pagamento.forma_pagamento} onChange={(forma) => atualizar(pagamento.id, { forma_pagamento: forma })} placeholder="Selecione a forma" searchPlaceholder="Buscar forma…" emptyMessage="Nenhuma forma encontrada." className="border-white/[.08] bg-[#131c29] text-slate-100" /></div>
            </div>
            <p className="text-xs text-slate-500">{cotistaLabel} · {aeronaveLabel}</p>
            <div className="space-y-2"><div><Label className="text-slate-300">Rateios desta conta</Label><p className="mt-1 text-xs text-slate-500">Confira o saldo esperado e distribua o valor recebido.</p></div>{rateios.length ? rateios.map((rateio, rateioIndex) => {
              const nome = rateio.cotista_nome || (rateio.cotista_id === conta.cotistaId ? cotistaLabel : `Rateio ${rateioIndex + 1}`);
              const quitado = Number(rateio.valor_pago_real_centavos || 0);
              const esperadoRateio = Number(rateio.valor_rateado_centavos || 0);
              return <div key={rateio.id} className="grid gap-3 rounded-lg bg-[#131c29] p-3 sm:grid-cols-[minmax(0,1fr)_auto_140px] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{nome}</p><p className="mt-1 text-xs text-slate-400">{aeronaveLabel} · Esperado R$ {money(esperadoRateio)} · já recebido R$ {money(quitado)}</p></div><span className="text-xs text-slate-400">Nesta baixa: <strong className="text-slate-200">R$ {money(cents(pagamento.rateios[rateio.id] ?? '0'))}</strong></span><Input value={pagamento.rateios[rateio.id] ?? '0,00'} onChange={(event) => atualizarRateio(pagamento.id, rateio.id, event.target.value)} aria-label={`Valor desta baixa para ${nome}`} inputMode="decimal" className="border-white/[.08] bg-[#0d141e] text-slate-100" /></div>;
            }) : <p className="rounded-lg bg-amber-400/[.08] p-3 text-sm text-amber-200">Obrigação sem rateio vinculado. Regularize a emissão antes de registrar o recebimento.</p>}</div>
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-slate-400">Total deste pagamento: <strong className="text-slate-200">R$ {money(cents(pagamento.valor))}</strong><span>Rateios: <strong className="text-slate-200">R$ {money(rateios.reduce((sum, rateio) => sum + cents(pagamento.rateios[rateio.id] ?? '0'), 0))}</strong></span></div>
            <div className="space-y-1.5"><Label htmlFor={`comprovante-${pagamento.id}`} className="text-slate-300">Comprovante de recebimento</Label><label htmlFor={`comprovante-${pagamento.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#131c29] px-3 py-3 text-sm text-slate-300 transition-colors hover:bg-[#182333]"><Paperclip size={16} className="shrink-0 text-cyan-300" /><span className="min-w-0 truncate">{pagamento.comprovante?.name || 'Anexar PDF ou imagem · até 10 MB'}</span></label><Input id={`comprovante-${pagamento.id}`} type="file" accept={TIPOS_COMPROVANTE.join(',')} onChange={(event) => selecionarComprovante(pagamento.id, event.target.files?.[0])} className="sr-only" /></div>
          </section>)}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" onClick={adicionarPagamento} className="gap-2 border-white/[.1] bg-transparent text-slate-200 hover:bg-white/[.05]"><Plus size={15} />Adicionar pagamento</Button><div className="text-xs text-slate-400">Quitado após esta baixa: {rateios.map((rateio, index) => <span key={rateio.id} className="ml-2 inline-block">{rateio.cotista_nome || (rateio.cotista_id === conta.cotistaId ? cotistaLabel : `Rateio ${index + 1}`)} <strong className="text-slate-200">R$ {money(quitadoPorRateio[rateio.id] ?? 0)}</strong> / R$ {money(Number(rateio.valor_rateado_centavos))}</span>)}</div></div>
          {erro && <p role="alert" className="rounded-lg bg-red-400/10 px-3 py-2.5 text-sm text-red-300">{erro}</p>}
        </fieldset>
      </div>
      <DialogFooter className="sticky bottom-0 gap-2 border-t border-white/[.08] bg-[#0a0f17] px-5 py-4 sm:px-7"><Button variant="ghost" onClick={onFechar} disabled={enviando} className="text-slate-300 hover:bg-white/[.05]">Cancelar</Button><Button onClick={confirmar} disabled={enviando || !rateios.length || Boolean(conciliacaoErro)} className="gap-2 bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300"><CheckCircle2 size={16} />{enviando ? 'Confirmando…' : 'Confirmar recebimento'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
