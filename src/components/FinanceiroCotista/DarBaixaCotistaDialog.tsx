import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, FileCheck2, FileText, Loader2, Receipt, UploadCloud, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buscarOpcoesLancamento, formatarCentavos, type OpcoesLancamento, type LancamentoEconomico } from '@/lib/financeiro-share-api';
import { buscarContextoBaixa, confirmarBaixaConciliada, avisarAtualizacaoFinanceiro, type ContextoBaixa } from '@/lib/baixa-conciliada-api';
import { enviarAnexoEnvioPagamento } from '@/lib/colaborador-api';

interface Props { lancamento: LancamentoEconomico | null; onFechar: () => void; onConcluido: () => Promise<void> }
const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const cents = (s: string) => /^\d+(,\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s.replace(',', '.')) * 100) : NaN;
function hoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dataLegivel(value?: string | null) {
  if (!value) return 'Não informado';
  const [ano, mes, dia] = value.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : 'Não informado';
}
const limiteComprovante = 20 * 1024 * 1024;
const formatosComprovante = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function DarBaixaCotistaDialog({ lancamento, onFechar, onConcluido }: Props) {
  const [contexto,setContexto] = useState<ContextoBaixa|null>(null);
  const [opcoes,setOpcoes] = useState<OpcoesLancamento|null>(null);
  const [data,setData] = useState(hoje);
  const [banco,setBanco] = useState('');
  const [forma,setForma] = useState('PIX');
  const [pagador,setPagador] = useState('');
  const [tipo,setTipo] = useState<'COTISTA'|'HOLDING'>('COTISTA');
  const [obs,setObs] = useState('');
  const [comprovante,setComprovante] = useState('');
  const [arquivo,setArquivo] = useState<File|null>(null);
  const [rateioSelecionado,setRateioSelecionado] = useState('');
  const [erro,setErro] = useState('');
  const [loading,setLoading] = useState(false);
  const [enviando,setEnviando] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [salvo,setSalvo] = useState(false);
  const trava = useRef(false);
  const chave = useRef('');
  const payloadEnviado = useRef<string|null>(null);

  useEffect(() => {
    const lancamentoId = lancamento?.id;
    if (!lancamentoId) return;
    let ativo = true;
    setLoading(true);setErro('');setContexto(null);setSalvo(false);setBanco('');setForma('PIX');setTipo('COTISTA');setObs('');setComprovante('');setArquivo(null);setRateioSelecionado('');setData(hoje());
    chave.current = crypto.randomUUID();payloadEnviado.current = null;
    Promise.all([buscarContextoBaixa(lancamentoId),buscarOpcoesLancamento()]).then(([ctx,opts]) => {
      if (!ativo) return;
      setContexto(ctx);setOpcoes(opts);
      const pendente = ctx.rateios.find(r => Number(r.valor_rateado_centavos) > Number(r.valor_pago_real_centavos || 0));
      setRateioSelecionado(pendente?.id || ctx.rateios[0]?.id || '');
      setPagador(pendente?.cotista_id || pendente?.socio_id || ctx.cotista_id || '');
      setValores(Object.fromEntries(ctx.rateios.map(r => [r.id,money(Math.max(0,Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0)))])));
    }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar a obrigação.'); }).finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  },[lancamento?.id]);

  const [valores,setValores] = useState<Record<string,string>>({});
  const direto = contexto?.natureza === 'PAGAMENTO_DIRETO';
  const rateios = contexto?.rateios || [];
  const rateioAtual = rateios.find(r => r.id === rateioSelecionado);
  const total = rateioAtual ? cents(valores[rateioAtual.id] || '0') : 0;
  const cotistaAtual = rateioAtual ? opcoes?.cotistas.find(c => c.id === (rateioAtual.cotista_id || rateioAtual.socio_id)) : undefined;
  const documento = lancamento?.documentoNumero || lancamento?.documento || lancamento?.numeroDoc || lancamento?.numeroNf || lancamento?.numeroRecibo || 'Sem número de documento';
  const pessoas = tipo === 'HOLDING' ? opcoes?.holdings || [] : (opcoes?.cotistas || []).filter(c => !direto || c.aeronave_id === contexto?.lancamento.aeronave_id);
  const vencimento = rateios.map(r => r.data_vencimento).find(Boolean) || lancamento?.prazo || null;

  async function selecionarArquivo(file?: File) {
    if (!file) return;
    if (file.size > limiteComprovante) { setErro('O comprovante deve ter até 20 MB.'); return; }
    if (!formatosComprovante.includes(file.type)) { setErro('Anexe um arquivo PDF, JPG, PNG ou WebP.'); return; }
    if (!lancamento) return;
    setErro('');setArquivo(file);setComprovante('');setUploading(true);
    try {
      const { url } = await enviarAnexoEnvioPagamento(file, `baixa-${lancamento.id}-${rateioSelecionado || 'cotista'}`);
      setComprovante(url);
    } catch (e) {
      setArquivo(null);
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o comprovante.');
    } finally { setUploading(false); }
  }

  async function confirmar() {
    if (!lancamento || !contexto || trava.current) return;
    if (!salvo) {
      if (!rateioAtual) {setErro('Selecione o cotista/rateio que está sendo pago.');return;}
      if (!pagador || !pessoas.some(p => p.id === pagador)) {setErro('Selecione o pagador real desta parcela.');return;}
      if (!direto && !(opcoes?.contas_bancarias || []).some(c => c.id === banco)) {setErro('Selecione a conta que recebeu o dinheiro.');return;}
      const date = new Date(`${data}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==data) {setErro('Informe uma data válida.');return;}
      if (!Number.isSafeInteger(total) || total<=0 || total>Number(rateioAtual.valor_rateado_centavos)-Number(rateioAtual.valor_pago_real_centavos||0)) {setErro('Informe valores válidos dentro do saldo de cada rateio. Use vírgula para os centavos, sem separador de milhar.');return;}
      if (arquivo && !comprovante) {setErro('Aguarde o envio do comprovante antes de confirmar.');return;}
    }
    trava.current=true;setEnviando(true);setErro('');
    let confirmado=salvo;
    try {
      if (!confirmado) {
        const pagamento = {idempotency_key:chave.current,tipo_pagador:tipo,...(tipo==='COTISTA'?{pagador_cotista_id:pagador}:{pagador_holding_id:pagador}),valor_centavos:total,data_pagamento:data,conta_bancaria_id:direto?null:banco,forma_pagamento:forma,observacoes:obs,comprovante_url:comprovante||null,rateios:[{rateio_id:rateioAtual.id,valor_centavos:total}]};
        const snapshot=JSON.stringify(pagamento);
        if(payloadEnviado.current && payloadEnviado.current!==snapshot) throw new Error('Os dados foram alterados após uma tentativa. Feche e reabra para conferir o saldo antes de registrar outro pagamento.');
        payloadEnviado.current=snapshot;
        await confirmarBaixaConciliada(lancamento.id,pagamento);
        confirmado=true;setSalvo(true);avisarAtualizacaoFinanceiro();
      }
      await onConcluido();onFechar();
    } catch(e) {setErro(`${confirmado?'Pagamento salvo. Falha ao atualizar a tela: ':''}${e instanceof Error?e.message:'Falha ao registrar pagamento.'}`);}
    finally {trava.current=false;setEnviando(false);}
  }

  const selectClass='h-10 w-full rounded-lg border border-border bg-background px-3 text-sm';
  const formBusy=enviando||uploading;
  return <Dialog open={Boolean(lancamento)} onOpenChange={o=>{if(!o&&!trava.current)onFechar();}}>
    <DialogContent className="despesas-theme despesa-dialog max-h-[92dvh] overflow-y-auto border-slate-700 bg-card dark:bg-[#111c2e] text-foreground dark:text-slate-100 shadow-2xl sm:max-w-2xl" onEscapeKeyDown={e=>{if(trava.current)e.preventDefault();}} onPointerDownOutside={e=>{if(trava.current)e.preventDefault();}}>
      <DialogHeader className="border-b border-slate-700 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sky-300">Financeiro Cotista · Baixa</p>
        <DialogTitle className="flex items-center gap-2 text-xl"><Receipt className="h-5 w-5 text-sky-300"/>{direto?'Registrar pagamento direto':'Registrar pagamento à Share'}</DialogTitle>
        <DialogDescription className="text-muted-foreground dark:text-slate-400">{direto?'Registre o pagamento feito pelo cotista ao fornecedor. Não há movimentação no caixa Share.':'Concilie o recebimento com a conta bancária e os rateios vinculados.'}</DialogDescription>
      </DialogHeader>
      {loading?<div className="flex items-center gap-2 py-10 text-sm text-muted-foreground dark:text-slate-300"><Loader2 className="h-4 w-4 animate-spin"/>Carregando obrigação…</div>:contexto&&<div className="space-y-5 pt-1">
        <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/90 to-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><p className="break-words text-base font-semibold text-white">{lancamento?.descricao||contexto.lancamento.descricao||'Despesa do cotista'}</p><p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">{lancamento?.fornecedor||'Pagamento vinculado ao rateio da despesa'} · Documento: {documento}</p></div>
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-right"><span className="block text-[9px] font-semibold uppercase tracking-wider text-emerald-200">Total desta baixa</span><strong className="text-xl tabular-nums text-emerald-300">{Number.isFinite(total)?formatarCentavos(total):'Confira os valores'}</strong></div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-slate-700 pt-4 sm:grid-cols-3">
            <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-sky-300"/><div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">Vencimento</p><p className="mt-1 text-sm font-medium text-foreground dark:text-slate-100">{dataLegivel(vencimento)}</p></div></div>
            <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-sky-300"/><div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">Categoria</p><p className="mt-1 text-sm font-medium text-foreground dark:text-slate-100">{lancamento?.categoria||'Despesa rateada'}</p></div></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-300"/><div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">Situação</p><p className="mt-1 text-sm font-medium text-foreground dark:text-slate-100">{lancamento?.status||'Em aberto'}</p></div></div>
          </div>
        </section>
        <fieldset disabled={formBusy||salvo} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="baixa-data" className="text-foreground dark:text-slate-200">Data do pagamento</Label><Input id="baixa-data" type="date" value={data} onChange={e=>setData(e.target.value)} className="border-slate-700 bg-slate-950/60"/></div>
          <div className="space-y-1.5"><Label htmlFor="baixa-forma" className="text-foreground dark:text-slate-200">Forma de pagamento</Label><select id="baixa-forma" className={selectClass} value={forma} onChange={e=>setForma(e.target.value)}>{['PIX','TRANSFERENCIA','BOLETO','DINHEIRO','CARTAO'].map(f=><option key={f}>{f}</option>)}</select></div>
          {!direto&&<div className="space-y-1.5"><Label htmlFor="baixa-tipo" className="text-foreground dark:text-slate-200">Tipo de pagador</Label><select id="baixa-tipo" className={selectClass} value={tipo} onChange={e=>{setTipo(e.target.value as 'COTISTA'|'HOLDING');setPagador('');}}><option value="COTISTA">Cotista</option><option value="HOLDING">Holding</option></select></div>}
          <div className="space-y-1.5"><Label htmlFor="baixa-pagador" className="text-foreground dark:text-slate-200">Pagador real</Label><select id="baixa-pagador" className={selectClass} value={pagador} onChange={e=>setPagador(e.target.value)}><option value="">Selecione…</option>{pessoas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          {!direto&&<div className="space-y-1.5 sm:col-span-2"><Label htmlFor="baixa-banco" className="text-foreground dark:text-slate-200">Conta bancária que recebeu o dinheiro</Label><select id="baixa-banco" className={selectClass} value={banco} onChange={e=>setBanco(e.target.value)}><option value="">Selecione…</option>{(opcoes?.contas_bancarias||[]).filter(c=>c.ativo!==false&&c.ativo!==0).map(c=><option key={c.id} value={c.id}>{c.banco} · {c.numero_conta}</option>)}</select></div>}
          <div className="space-y-2 sm:col-span-2"><div><p className="text-sm font-semibold text-foreground dark:text-slate-100">Distribuição do pagamento</p><p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">Selecione uma parcela para registrar uma baixa individual com pagador e comprovante próprios.</p></div>{rateios.map(r=>{const nome=opcoes?.cotistas.find(c=>c.id===(r.cotista_id||r.socio_id))?.nome||'Cotista não identificado';const saldo=Math.max(0,Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0));return <button type="button" key={r.id} onClick={()=>{setRateioSelecionado(r.id);setPagador(r.cotista_id||r.socio_id||'');setComprovante('');setArquivo(null);setErro('');}} className={`grid w-full gap-3 rounded-xl border p-3 text-left sm:grid-cols-[1fr_auto] sm:items-center ${rateioSelecionado===r.id?'border-sky-400 bg-sky-950/40':'border-slate-700 bg-slate-900/45'} ${saldo===0?'opacity-60':''}`}><div><span className="text-xs font-semibold text-foreground dark:text-slate-200">{nome}</span><p className="mt-1 text-[11px] text-muted-foreground dark:text-slate-400">Documento: {documento} · Saldo individual: {formatarCentavos(saldo)}{r.data_vencimento?` · Vencimento ${dataLegivel(r.data_vencimento)}`:''}{saldo===0?' · Quitado':''}</p></div><span className="text-xs font-semibold text-sky-300">{rateioSelecionado===r.id?'Selecionado':'Selecionar'}</span></button>})}{rateioAtual&&<div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/45 p-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><Label htmlFor={`rateio-${rateioAtual.id}`} className="text-xs font-semibold text-foreground dark:text-slate-200">Valor desta baixa · {cotistaAtual?.nome||'cotista selecionado'}</Label><p className="mt-1 text-[11px] text-muted-foreground dark:text-slate-400">Saldo máximo: {formatarCentavos(Math.max(0,Number(rateioAtual.valor_rateado_centavos)-Number(rateioAtual.valor_pago_real_centavos||0)))}</p></div><Input id={`rateio-${rateioAtual.id}`} className="w-full border-slate-700 bg-slate-950/70 text-right tabular-nums sm:w-36" inputMode="decimal" value={valores[rateioAtual.id]||''} onChange={e=>setValores(v=>({...v,[rateioAtual.id]:e.target.value}))}/></div>}<p className="text-xs text-muted-foreground dark:text-slate-400">Cada confirmação baixa somente o cotista selecionado; pagamentos menores mantêm saldo em aberto.</p></div>
          <div className="space-y-2 sm:col-span-2"><Label className="text-foreground dark:text-slate-200">Comprovante do pagamento</Label><label className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-dashed border-slate-600 bg-slate-950/40 p-4 transition hover:border-sky-400/70 hover:bg-sky-950/20"><UploadCloud className="h-6 w-6 shrink-0 text-sky-300"/><span className="min-w-0 flex-1"><strong className="block break-all text-sm font-medium text-foreground dark:text-slate-100">{uploading?'Enviando arquivo…':arquivo?.name||'Anexar imagem ou PDF do comprovante'}</strong><small className="mt-1 block text-xs text-muted-foreground dark:text-slate-400">PDF, JPG, PNG ou WebP · até 20 MB</small></span>{uploading?<Loader2 className="h-4 w-4 animate-spin text-sky-300"/>:comprovante?<FileCheck2 className="h-5 w-5 text-emerald-400"/>:null}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" className="absolute inset-0 cursor-pointer opacity-0" onChange={e=>{void selecionarArquivo(e.target.files?.[0]);e.currentTarget.value='';}}/></label>{arquivo&&<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground dark:text-slate-400"><span className="truncate">{comprovante?'Comprovante anexado': 'Aguardando upload'}{comprovante?' · pronto para salvar':''}</span><button type="button" disabled={formBusy||salvo} onClick={()=>{setArquivo(null);setComprovante('');}} className="inline-flex items-center gap-1 text-muted-foreground dark:text-slate-300 hover:text-white"><X className="h-3.5 w-3.5"/>Remover</button></div>}</div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="baixa-obs" className="text-foreground dark:text-slate-200">Observações do pagamento</Label><Textarea id="baixa-obs" value={obs} onChange={e=>setObs(e.target.value)} rows={2} className="border-slate-700 bg-slate-950/60" placeholder="Detalhes adicionais para conferência"/></div>
        </fieldset>
      </div>}
      {erro&&<p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{erro}</p>}
      <DialogFooter className="border-t border-slate-700 pt-4"><Button variant="outline" disabled={formBusy} onClick={onFechar} className="border-slate-600 bg-transparent text-foreground dark:text-slate-200 hover:bg-slate-800">{salvo?'Fechar':'Cancelar'}</Button><Button disabled={loading||formBusy||!contexto} onClick={()=>void confirmar()} className="bg-sky-600 text-white hover:bg-sky-500">{enviando?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<CheckCircle2 className="mr-2 h-4 w-4"/>}{salvo?'Atualizar tela':'Confirmar baixa'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
