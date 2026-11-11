import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Receipt, UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BaixaResumo } from '@/components/financeiro-design/BaixaResumo';
import { buscarOpcoesLancamento, formatarCentavos, type OpcoesLancamento, type LancamentoEconomico } from '@/lib/financeiro-share-api';
import { buscarContextoBaixa, confirmarBaixaConciliada, avisarAtualizacaoFinanceiro, type ContextoBaixa, type RateioBaixa } from '@/lib/baixa-conciliada-api';
import { enviarAnexoEnvioPagamento } from '@/lib/colaborador-api';

interface Props { lancamento: LancamentoEconomico | null; onFechar: () => void; onConcluido: () => Promise<void> }
type Parcela = { data: string; banco: string; forma: string; pagador: string; tipo: 'COTISTA' | 'HOLDING'; obs: string; valor: string; comprovante: string; arquivo: File | null };
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const cents = (s: string) => /^\d+(,\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s.replace(',', '.')) * 100) : NaN;
const saldo = (r: RateioBaixa) => Math.max(0,Number(r.valor_rateado_centavos)-Number(r.valor_pago_real_centavos||0));
const quitado = (r: RateioBaixa) => saldo(r) === 0 || ['PAGO','PAGO_DIRETAMENTE','REEMBOLSADO','RECEBIDO','CANCELADO'].includes(String(r.status || '').toUpperCase());
const dataLegivel = (v?: string | null) => v ? v.slice(0,10).split('-').reverse().join('/') : 'Não informado';
const novaParcela = (r: RateioBaixa): Parcela => ({ data: hoje(), banco: '', forma: 'PIX', pagador: r.cotista_id || r.socio_id || '', tipo: 'COTISTA', obs: '', valor: (saldo(r)/100).toFixed(2).replace('.',','), comprovante: '', arquivo: null });

export function DarBaixaCotistaDialog({ lancamento, onFechar, onConcluido }: Props) {
  const [contexto,setContexto] = useState<ContextoBaixa|null>(null);
  const [opcoes,setOpcoes] = useState<OpcoesLancamento|null>(null);
  const [parcelas,setParcelas] = useState<Record<string,Parcela>>({});
  const [selecionado,setSelecionado] = useState('');
  const [erro,setErro] = useState('');
  const [mensagem,setMensagem] = useState('');
  const [loading,setLoading] = useState(false);
  const [enviando,setEnviando] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [precisaAtualizar,setPrecisaAtualizar] = useState(false);
  const [baixaRegistrada,setBaixaRegistrada] = useState(false);
  const trava = useRef(false);
  const tentativas = useRef<Record<string,{ chave: string; snapshot?: string }>>({});
  const sessao = useRef(0);

  useEffect(() => {
    const lancamentoId = lancamento?.id;
    const versao = ++sessao.current;
    if (!lancamentoId) return;
    setLoading(true); setUploading(false); setErro(''); setMensagem(''); setContexto(null); setPrecisaAtualizar(false); setBaixaRegistrada(false); setParcelas({}); setSelecionado(''); tentativas.current = {};
    Promise.all([buscarContextoBaixa(lancamentoId),buscarOpcoesLancamento()]).then(([ctx,opts]) => {
      if (sessao.current !== versao) return;
      setContexto(ctx); setOpcoes(opts);
      setSelecionado((ctx.rateios.find(r => !quitado(r)) || ctx.rateios[0])?.id || '');
      setParcelas(Object.fromEntries(ctx.rateios.map(r => [r.id,novaParcela(r)])));
    }).catch(e => { if (sessao.current === versao) setErro(e instanceof Error ? e.message : 'Falha ao carregar a obrigação.'); })
      .finally(() => { if (sessao.current === versao) setLoading(false); });
    return () => { ++sessao.current; };
  },[lancamento?.id]);

  const rateios = contexto?.rateios || [];
  const rateio = rateios.find(r => r.id === selecionado);
  const parcela = parcelas[selecionado];
  const direto = contexto?.natureza === 'PAGAMENTO_DIRETO';
  const ocupado = enviando || uploading;
  const somenteLeitura = ocupado || precisaAtualizar || baixaRegistrada || Boolean(rateio && quitado(rateio));
  const total = parcela ? cents(parcela.valor) : 0;
  const pendentes = rateios.filter(r => !quitado(r));
  const nomeCotista = (r: RateioBaixa) => opcoes?.cotistas.find(c => c.id === (r.cotista_id || r.socio_id))?.nome || r.cotista_nome || lancamento?.rateios?.find(item => item.id === r.id)?.cotista || 'Cotista não identificado';
  const documento = rateio?.numero_nf || rateio?.numero_doc || rateio?.numero_recibo || lancamento?.numeroNf || lancamento?.documentoNumero || lancamento?.documento || '—';
  const pessoas = parcela?.tipo === 'HOLDING' ? opcoes?.holdings || [] : (opcoes?.cotistas || []).filter(c => !direto || c.aeronave_id === contexto?.lancamento.aeronave_id);
  const historico = (contexto?.pagamentos || []).filter(p => p.rateio_id === selecionado);
  const alterar = (patch: Partial<Parcela>) => { if (!somenteLeitura) { setParcelas(v=>({...v,[selecionado]:{...v[selecionado],...patch}})); setErro(''); } };

  async function selecionarArquivo(file?: File) {
    if (!file || !lancamento || somenteLeitura) return;
    if (file.size > 20*1024*1024 || !['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)) { setErro('Use PDF, JPG, PNG ou WebP de até 20 MB.'); return; }
    const id = selecionado; const versao = sessao.current;
    alterar({arquivo:file,comprovante:''}); setUploading(true);
    try {
      const {url} = await enviarAnexoEnvioPagamento(file, `baixa-${lancamento.id}-${id}-${crypto.randomUUID()}`);
      if (versao === sessao.current) setParcelas(v=>({...v,[id]:{...v[id],comprovante:url}}));
    } catch(e) {
      if (versao === sessao.current) { setParcelas(v=>({...v,[id]:{...v[id],arquivo:null,comprovante:''}})); setErro(e instanceof Error?e.message:'Falha ao enviar o comprovante.'); }
    } finally { if (versao === sessao.current) setUploading(false); }
  }

  async function atualizar() {
    if (!lancamento) return;
    const ctx = await buscarContextoBaixa(lancamento.id);
    setContexto(ctx);
    setParcelas(anteriores => Object.fromEntries(ctx.rateios.map(r => [r.id, quitado(r) || r.id === selecionado ? novaParcela(r) : anteriores[r.id] || novaParcela(r)])));
    setPrecisaAtualizar(false);
    await onConcluido();
  }

  async function confirmar() {
    if (!lancamento || !contexto || trava.current || uploading || (baixaRegistrada && !precisaAtualizar)) return;
    if (!precisaAtualizar) {
      if (!rateio || !parcela || quitado(rateio)) {setErro('Selecione um cotista com saldo em aberto.');return;}
      if (!parcela.pagador || !pessoas.some(p=>p.id===parcela.pagador)) {setErro('Selecione o pagador real desta parcela.');return;}
      if (!direto && !(opcoes?.contas_bancarias||[]).some(c=>c.id===parcela.banco && c.ativo!==false && c.ativo!==0)) {setErro('Selecione a conta que recebeu o dinheiro.');return;}
      const date = new Date(`${parcela.data}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parcela.data) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==parcela.data) {setErro('Informe uma data válida.');return;}
      if (!Number.isSafeInteger(total) || total<=0 || total>saldo(rateio)) {setErro('Informe um valor maior que zero e dentro do saldo individual.');return;}
      if (parcela.arquivo && !parcela.comprovante) {setErro('Aguarde o envio do comprovante.');return;}
    }
    trava.current=true;setEnviando(true);setErro('');
    let registrado = precisaAtualizar;
    try {
      if (!registrado && rateio && parcela) {
        const tentativa = tentativas.current[selecionado] ||= {chave:crypto.randomUUID()};
        const pagamento = {idempotency_key:tentativa.chave,tipo_pagador:parcela.tipo,...(parcela.tipo==='COTISTA'?{pagador_cotista_id:parcela.pagador}:{pagador_holding_id:parcela.pagador}),valor_centavos:total,data_pagamento:parcela.data,conta_bancaria_id:direto?null:parcela.banco,forma_pagamento:parcela.forma,observacoes:parcela.obs,comprovante_url:parcela.comprovante||null,rateios:[{rateio_id:rateio.id,valor_centavos:total}]};
        const snapshot=JSON.stringify(pagamento);
        if(tentativa.snapshot && tentativa.snapshot!==snapshot) throw new Error('Confira o saldo fechando e reabrindo a janela antes de alterar uma tentativa de pagamento.');
        tentativa.snapshot=snapshot;
        await confirmarBaixaConciliada(lancamento.id,pagamento);
        registrado=true;setPrecisaAtualizar(true);setBaixaRegistrada(true); delete tentativas.current[selecionado];
        setMensagem(`Pagamento de ${nomeCotista(rateio)} registrado. Os saldos de cada cotista foram atualizados.`);
        avisarAtualizacaoFinanceiro();
      }
      await atualizar();
    } catch(e) {setErro(`${registrado?'Pagamento salvo. Atualize os saldos antes de continuar: ':''}${e instanceof Error?e.message:'Falha ao registrar pagamento.'}`);}
    finally {trava.current=false;setEnviando(false);}
  }

  return <Dialog open={Boolean(lancamento)} onOpenChange={o=>{if(!o&&!ocupado)onFechar();}}>
    <DialogContent className="despesas-theme baixa-dialog" onEscapeKeyDown={e=>{if(ocupado)e.preventDefault();}} onPointerDownOutside={e=>{if(ocupado)e.preventDefault();}}>
      <DialogHeader className="baixa-header">
        <p className="baixa-kicker">Financeiro Cotista · Baixa individual</p>
        <DialogTitle className="baixa-titulo"><Receipt size={20}/>{direto?'Registrar pagamento direto':'Registrar pagamento à Share'}</DialogTitle>
        <DialogDescription>{direto?'Registre separadamente o pagamento de cada cotista ao fornecedor.':'Registre o recebimento de cada cotista com sua data, conta e comprovante.'}</DialogDescription>
      </DialogHeader>
      <div className="baixa-body">
        {loading ? <p role="status">Carregando os pagamentos dos cotistas…</p> : contexto && <>
          <BaixaResumo descricao={lancamento?.descricao||contexto.lancamento.descricao||'Despesa do cotista'} detalhe={`${lancamento?.fornecedor||'Despesa rateada'} · Documento: ${documento}`} valor={rateio&&quitado(rateio)?formatarCentavos(Number(rateio.valor_pago_real_centavos||0)):Number.isFinite(total)?formatarCentavos(total):'Confira os valores'} rotuloValor={rateio&&quitado(rateio)?'Total pago pelo cotista':'Total desta baixa'} vencimento={dataLegivel(rateio?.data_vencimento||lancamento?.prazo)} categoria={lancamento?.categoria||'—'} situacao={`${pendentes.length} de ${rateios.length} cotista(s) com saldo pendente`}/>
          <section>
            <h3 className="text-sm font-semibold">Qual cotista deseja baixar?</h3>
            <p className="baixa-nota mb-3 mt-1">Cada confirmação registra somente a parcela selecionada. A despesa permanece aberta até a quitação de todos.</p>
            <div className="baixa-cotistas" role="radiogroup" aria-label="Cotista da baixa">
              {rateios.map(r=><button key={r.id} type="button" role="radio" aria-checked={selecionado===r.id} disabled={ocupado||precisaAtualizar} className="baixa-cotista" onClick={()=>{setSelecionado(r.id);setBaixaRegistrada(false);setErro('');}}>
                <span><strong>{nomeCotista(r)}</strong><small>Previsto: {formatarCentavos(Number(r.valor_rateado_centavos))} · Pago: {formatarCentavos(Number(r.valor_pago_real_centavos||0))} · Saldo: {formatarCentavos(saldo(r))}</small>{r.data_pagamento&&<small>Pagamento: {dataLegivel(r.data_pagamento)}</small>}</span>
                <span>{quitado(r)?'Quitado':selecionado===r.id?'Selecionado':'Selecionar'}</span>
              </button>)}
            </div>
          </section>
          {rateio&&parcela&&!quitado(rateio)&&<fieldset disabled={somenteLeitura} className="baixa-campos">
            <legend className="sr-only">Pagamento de {nomeCotista(rateio)}</legend>
            <div><Label htmlFor="baixa-data">Data do pagamento</Label><Input id="baixa-data" type="date" value={parcela.data} onChange={e=>alterar({data:e.target.value})}/></div>
            <div><Label htmlFor="baixa-forma">Forma de pagamento</Label><select id="baixa-forma" value={parcela.forma} onChange={e=>alterar({forma:e.target.value})}>{['PIX','TRANSFERENCIA','BOLETO','DINHEIRO','CARTAO'].map(f=><option key={f}>{f}</option>)}</select></div>
            {!direto&&<div><Label htmlFor="baixa-tipo">Tipo de pagador</Label><select id="baixa-tipo" value={parcela.tipo} onChange={e=>alterar({tipo:e.target.value as 'COTISTA'|'HOLDING',pagador:''})}><option value="COTISTA">Cotista</option><option value="HOLDING">Holding</option></select></div>}
            <div><Label htmlFor="baixa-pagador">Pagador real</Label><select id="baixa-pagador" value={parcela.pagador} onChange={e=>alterar({pagador:e.target.value})}><option value="">Selecione…</option>{pessoas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div><Label htmlFor="baixa-valor">Valor desta baixa · {nomeCotista(rateio)}</Label><Input id="baixa-valor" inputMode="decimal" value={parcela.valor} onChange={e=>alterar({valor:e.target.value})}/><small className="baixa-nota">Saldo máximo: {formatarCentavos(saldo(rateio))}</small></div>
            {!direto&&<div className="baixa-campo-inteiro"><Label htmlFor="baixa-banco">Conta bancária que recebeu o dinheiro</Label><select id="baixa-banco" value={parcela.banco} onChange={e=>alterar({banco:e.target.value})}><option value="">Selecione…</option>{(opcoes?.contas_bancarias||[]).filter(c=>c.ativo!==false&&c.ativo!==0).map(c=><option key={c.id} value={c.id}>{c.banco} · {c.numero_conta}</option>)}</select></div>}
            <div className="baixa-campo-inteiro"><Label>Comprovante de {nomeCotista(rateio)}</Label><label className="baixa-upload"><UploadCloud size={24}/><span><strong>{uploading?'Enviando arquivo…':parcela.arquivo?.name||'Anexar comprovante individual'}</strong><small>PDF, JPG, PNG ou WebP · até 20 MB</small></span><input aria-label={`Comprovante de ${nomeCotista(rateio)}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{void selecionarArquivo(e.target.files?.[0]);e.currentTarget.value='';}}/></label>{parcela.comprovante&&<button type="button" className="baixa-nota" onClick={()=>alterar({arquivo:null,comprovante:''})}>Remover comprovante</button>}</div>
            <div className="baixa-campo-inteiro"><Label htmlFor="baixa-obs">Observações do pagamento</Label><Textarea id="baixa-obs" value={parcela.obs} onChange={e=>alterar({obs:e.target.value})} rows={2}/></div>
          </fieldset>}
          {historico.length>0&&<section className="baixa-historico"><h3 className="font-semibold">Pagamentos registrados · {rateio&&nomeCotista(rateio)}</h3><ul>{historico.map(p=><li key={p.id}><span>{dataLegivel(p.data_pagamento)} · {formatarCentavos(p.valor_centavos)} · {p.forma_pagamento||'—'}</span>{p.comprovante_url&&<a href={p.comprovante_url} target="_blank" rel="noopener noreferrer">Ver comprovante</a>}{p.observacoes&&<small>{p.observacoes}</small>}</li>)}</ul></section>}
        </>}
        {mensagem&&<p role="status" className="baixa-mensagem">{mensagem}</p>}
        {erro&&<p role="alert">{erro}</p>}
      </div>
      <DialogFooter className="baixa-footer"><Button variant="outline" disabled={ocupado} onClick={onFechar}>Fechar</Button>{(pendentes.length>0||precisaAtualizar)&&<Button disabled={loading||ocupado||!contexto||(!precisaAtualizar&&(baixaRegistrada||Boolean(rateio&&quitado(rateio))))} onClick={()=>void confirmar()}>{enviando?<Loader2 size={16} className="mr-2 animate-spin"/>:<CheckCircle2 size={16} className="mr-2"/>}{precisaAtualizar?'Atualizar saldos':baixaRegistrada?'Selecione o próximo pagamento':'Confirmar baixa individual'}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
