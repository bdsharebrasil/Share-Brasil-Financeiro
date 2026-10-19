import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buscarOpcoesLancamento, formatarCentavos, type OpcoesLancamento, type LancamentoEconomico } from '@/lib/financeiro-share-api';
import { buscarContextoBaixa, confirmarBaixaConciliada, avisarAtualizacaoFinanceiro, type ContextoBaixa } from '@/lib/baixa-conciliada-api';
interface Props { lancamento: LancamentoEconomico | null; onFechar: () => void; onConcluido: () => Promise<void> }
const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const cents = (s: string) => /^\d+(,\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s.replace(',', '.')) * 100) : NaN;
function hoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
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
  const [valores,setValores] = useState<Record<string,string>>({});
  const [erro,setErro] = useState('');
  const [loading,setLoading] = useState(false);
  const [enviando,setEnviando] = useState(false);
  const [salvo,setSalvo] = useState(false);
  const trava = useRef(false);
  const chave = useRef('');
  const payloadEnviado = useRef<string|null>(null);
  useEffect(() => {
    if (!lancamento) return;
    let ativo = true;
    setLoading(true);setErro('');setContexto(null);setSalvo(false);setBanco('');setForma('PIX');setTipo('COTISTA');setObs('');setComprovante('');setData(hoje());
    chave.current = crypto.randomUUID();payloadEnviado.current = null;
    Promise.all([buscarContextoBaixa(lancamento.id),buscarOpcoesLancamento()]).then(([ctx,opts]) => {
      if (!ativo) return;
      setContexto(ctx);setOpcoes(opts);setPagador(ctx.cotista_id || '');
      setValores(Object.fromEntries(ctx.rateios.map(r => [r.id,money(Math.max(0,Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0)))])));
    }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar a obrigação.'); }).finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  },[lancamento?.id]);
  const direto = contexto?.natureza === 'PAGAMENTO_DIRETO';
  const rateios = contexto?.rateios || [];
  const total = rateios.reduce((s,r) => s+cents(valores[r.id] || '0'),0);
  const pessoas = tipo === 'HOLDING' ? opcoes?.holdings || [] : (opcoes?.cotistas || []).filter(c => !direto || c.aeronave_id === contexto?.lancamento.aeronave_id);
  async function confirmar() {
    if (!lancamento || !contexto || trava.current) return;
    if (!salvo) {
      if (!pagador || !pessoas.some(p => p.id === pagador)) {setErro('Selecione o pagador real.');return;}
      if (!direto && !(opcoes?.contas_bancarias || []).some(c => c.id === banco)) {setErro('Selecione a conta que recebeu o dinheiro.');return;}
      const date = new Date(`${data}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==data) {setErro('Informe uma data válida.');return;}
      if (!Number.isSafeInteger(total) || total<=0 || rateios.some(r => !Number.isSafeInteger(cents(valores[r.id]||'0')) || cents(valores[r.id]||'0')<0 || cents(valores[r.id]||'0')>Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0))) {setErro('Informe valores válidos dentro do saldo de cada rateio. Use vírgula para os centavos, sem separador de milhar.');return;}
      if (comprovante && !/^https:\/\//i.test(comprovante.trim())) {setErro('O link do comprovante precisa começar com https://.');return;}
    }
    trava.current=true;setEnviando(true);setErro('');
    let confirmado=salvo;
    try {
      if (!confirmado) {
        const pagamento = {idempotency_key:chave.current,tipo_pagador:tipo,...(tipo==='COTISTA'?{pagador_cotista_id:pagador}:{pagador_holding_id:pagador}),valor_centavos:total,data_pagamento:data,conta_bancaria_id:direto?null:banco,forma_pagamento:forma,observacoes:obs,comprovante_url:comprovante.trim()||null,rateios:rateios.map(r=>({rateio_id:r.id,valor_centavos:cents(valores[r.id]||'0')})).filter(r=>r.valor_centavos>0)};
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
  const selectClass='h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  return <Dialog open={Boolean(lancamento)} onOpenChange={o=>{if(!o&&!trava.current)onFechar();}}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={e=>{if(trava.current)e.preventDefault();}} onPointerDownOutside={e=>{if(trava.current)e.preventDefault();}}>
      <DialogHeader><DialogTitle>{direto?'Registrar pagamento direto':'Registrar pagamento à Share'}</DialogTitle><DialogDescription>{direto?'O cotista pagou ao fornecedor. Esta operação não movimenta o caixa da Share.':'O recebimento será conciliado com a conta a receber, o documento e os rateios vinculados.'}</DialogDescription></DialogHeader>
      {loading?<p className="flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin"/>Carregando obrigação…</p>:contexto&&<>
        <div className="rounded-xl border bg-muted/30 p-4"><p className="break-words font-semibold">{lancamento?.descricao}</p><p className="mt-1 text-sm text-muted-foreground">{lancamento?.fornecedor}</p><p className="mt-3 font-semibold tabular-nums">{Number.isFinite(total)?formatarCentavos(total):'Confira os valores'}</p></div>
        <fieldset disabled={enviando||salvo} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="baixa-data">Data do pagamento</Label><Input id="baixa-data" type="date" value={data} onChange={e=>setData(e.target.value)}/></div>
          <div className="space-y-1"><Label htmlFor="baixa-forma">Forma de pagamento</Label><select id="baixa-forma" className={selectClass} value={forma} onChange={e=>setForma(e.target.value)}>{['PIX','TRANSFERENCIA','BOLETO','DINHEIRO','CARTAO'].map(f=><option key={f}>{f}</option>)}</select></div>
          {!direto&&<div className="space-y-1"><Label htmlFor="baixa-tipo">Tipo de pagador</Label><select id="baixa-tipo" className={selectClass} value={tipo} onChange={e=>{setTipo(e.target.value as 'COTISTA'|'HOLDING');setPagador('');}}><option value="COTISTA">Cotista</option><option value="HOLDING">Holding</option></select></div>}
          <div className="space-y-1"><Label htmlFor="baixa-pagador">Pagador real</Label><select id="baixa-pagador" className={selectClass} value={pagador} onChange={e=>setPagador(e.target.value)}><option value="">Selecione…</option>{pessoas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          {!direto&&<div className="space-y-1 sm:col-span-2"><Label htmlFor="baixa-banco">Conta bancária que recebeu o dinheiro</Label><select id="baixa-banco" className={selectClass} value={banco} onChange={e=>setBanco(e.target.value)}><option value="">Selecione…</option>{(opcoes?.contas_bancarias||[]).filter(c=>c.ativo!==false&&c.ativo!==0).map(c=><option key={c.id} value={c.id}>{c.banco} · {c.numero_conta}</option>)}</select></div>}
          <div className="space-y-2 sm:col-span-2"><p className="text-sm font-medium">Distribuição do pagamento</p>{rateios.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><Label htmlFor={`rateio-${r.id}`} className="text-xs">{opcoes?.cotistas.find(c=>c.id===r.cotista_id)?.nome||'Rateio da obrigação'}<span className="mt-1 block text-muted-foreground">Saldo: {formatarCentavos(Math.max(0,Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0)))}</span></Label><Input id={`rateio-${r.id}`} className="w-32 text-right tabular-nums" inputMode="decimal" value={valores[r.id]||''} onChange={e=>setValores(v=>({...v,[r.id]:e.target.value}))}/></div>)}<p className="text-xs text-muted-foreground">Pagamentos menores mantêm o saldo em aberto. Não são tratados como desconto.</p></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="baixa-comprovante">Link do comprovante (opcional)</Label><Input id="baixa-comprovante" type="url" value={comprovante} onChange={e=>setComprovante(e.target.value)} placeholder="https://…"/></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="baixa-obs">Observações do pagamento</Label><Textarea id="baixa-obs" value={obs} onChange={e=>setObs(e.target.value)} rows={2}/></div>
        </fieldset>
      </>}
      {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" disabled={enviando} onClick={onFechar}>{salvo?'Fechar':'Cancelar'}</Button><Button disabled={loading||enviando||!contexto} onClick={()=>void confirmar()}>{enviando?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<CheckCircle2 className="mr-2 h-4 w-4"/>}{salvo?'Atualizar tela':'Confirmar pagamento'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
