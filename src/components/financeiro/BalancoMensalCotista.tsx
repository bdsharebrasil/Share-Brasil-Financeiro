import { useEffect, useMemo, useRef, useState } from 'react'
import { colaboradorRequest } from '@/lib/colaborador-api'

type Saldo = { id: string; nome: string; dominio: string; devidoCentavos: number; pagoCentavos: number; saldoCentavos: number }
type Linha = { id: string; participanteId: string; dominio: string; origemChave: string; competencia: string; categoria: string; descricao: string; tipo: string; devido: number }
type Balanco = {
 status: string; custoTotalCentavos: number; pagoPessoalCentavos: number; diferencaCustoPagamentoCentavos: number;
 saldos: Saldo[]; linhas: Linha[]; avisos: string[];
 compensacoes: { deId: string; paraId: string; valorCentavos: number }[];
 holdings: { dominio: string; saldoMovimentosAeronaveCentavos: number; aportesSemSocioCentavos: number;
   socios: (Saldo & { aporteCentavos: number; posicaoCentavos: number })[] }[];
}
const dinheiro = (v: number) => (v/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const mesLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function valorCentavos(s: string) {
 if (!/^\d+(,\d{1,2})?$/.test(s)) return null
 const [inteiro, fracao=''] = s.split(',')
 const v = Number(inteiro)*100 + Number(fracao.padEnd(2,'0'))
 return Number.isSafeInteger(v) && v > 0 ? v : null
}
/** cotistaId usa cotista_aeronave.id. Filtra a exibição após calcular toda a aeronave. */
export function BalancoMensalCotista({ aeronaveId, cotistaId }: { aeronaveId: string; cotistaId?: string }) {
 const [mes,setMes] = useState(mesLocal), [dados,setDados] = useState<Balanco|null>(null)
 const [erro,setErro] = useState(''), [carregando,setCarregando] = useState(false), [revisao,setRevisao] = useState(0)
 const [origem,setOrigem] = useState(''), [destino,setDestino] = useState(''), [valor,setValor] = useState(''), [motivo,setMotivo] = useState('')
 const [salvando,setSalvando] = useState(false)
 const chave = useRef<string|null>(null)
 useEffect(() => {
  let vivo=true; setDados(null); setErro(''); setCarregando(true); setOrigem(''); setDestino('')
  colaboradorRequest<Balanco>(`/api/financeiro/cotista/balanco-mensal?aeronave_id=${encodeURIComponent(aeronaveId)}&competencia=${encodeURIComponent(mes)}`)
   .then(r=>{if(vivo)setDados(r)}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:'Falha ao carregar')})
   .finally(()=>{if(vivo)setCarregando(false)})
  return ()=>{vivo=false}
 },[aeronaveId,mes,revisao])
 useEffect(()=>{chave.current=null},[origem,destino,valor,motivo,aeronaveId,mes])
 const saldos = dados?.saldos.filter(s=>!cotistaId || s.id===cotistaId) || []
 const nomes = useMemo(()=>new Map(dados?.saldos.map(s=>[s.id,s.nome])||[]),[dados])
 const linha = dados?.linhas.find(l=>l.id===origem)
 const destinos = dados?.linhas.filter(l=>l.origemChave===linha?.origemChave && l.dominio===linha?.dominio && l.competencia===linha?.competencia && l.participanteId!==linha?.participanteId)||[]
 async function salvar() {
  const cents=valorCentavos(valor)
  if(!linha || !destinos.some(d=>d.id===destino) || !cents || cents>linha.devido || motivo.trim().length<5) {setErro('Confira valor, destino e motivo (mínimo 5 caracteres).');return}
  setSalvando(true);setErro('');chave.current ||= crypto.randomUUID()
  try {
   await colaboradorRequest('/api/financeiro/cotista/balanco-ajustes',{method:'POST',body:JSON.stringify({
    aeronave_id:aeronaveId,origem_rateio_id:origem,destino_rateio_id:destino,valor_centavos:cents,motivo:motivo.trim(),idempotency_key:chave.current,
   })})
   setValor('');setMotivo('');chave.current=null;setRevisao(v=>v+1)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar')}finally{setSalvando(false)}
 }
 return <section className="space-y-4 rounded-lg border p-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Balanço mensal dos cotistas</h2>
   <label>Competência <input aria-label="Competência" type="month" value={mes} min="2000-01" max="2099-12" disabled={salvando} onChange={e=>setMes(e.target.value)} className="rounded border bg-transparent p-2"/></label></div>
  {erro && <p role="alert" className="text-red-500">{erro}</p>}
  {carregando && <p role="status">Carregando balanço…</p>}
  {dados && <>
   <p className="text-sm">Apuração preliminar. Custo por competência; pagamentos conhecidos até o fim do mês. Ajustes têm histórico e motivo.</p>
   <div className="grid gap-3 md:grid-cols-3">{[['Custo da aeronave',dados.custoTotalCentavos],['Pagamentos pessoais',dados.pagoPessoalCentavos],['Custo menos pagamentos pessoais',dados.diferencaCustoPagamentoCentavos]].map(([t,v])=><div key={String(t)} className="rounded border p-3"><p className="text-sm">{t}</p><strong>{dinheiro(Number(v))}</strong></div>)}</div>
   <p className="text-sm">A diferença pode incluir fornecedor pendente, valor devido à Share e despesas pagas pela conta conjunta. Essas fontes precisam ser conciliadas antes de fechar.</p>
   {dados.avisos.map(a=><p role="alert" key={a} className="text-amber-600">{a}</p>)}
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Cotista','Custo devido','Pago pessoal','Pago − devido'].map(t=><th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{saldos.map(s=><tr key={s.id} className="border-t"><td className="p-2">{s.nome}</td><td>{dinheiro(s.devidoCentavos)}</td><td>{dinheiro(s.pagoCentavos)}</td><td>{dinheiro(s.saldoCentavos)}</td></tr>)}</tbody></table></div>
   <h3 className="font-semibold">Compensação entre cotistas</h3>
   <p className="text-sm">Valores bilaterais por despesas identificadas, como na planilha. São sugestões; ainda não registram pagamento.</p>
   {dados.compensacoes.filter(c=>!cotistaId || c.deId===cotistaId || c.paraId===cotistaId).map(c=><p key={`${c.deId}:${c.paraId}`}>{nomes.get(c.deId)} → {nomes.get(c.paraId)}: <strong>{dinheiro(c.valorCentavos)}</strong></p>)}
   {dados.holdings.map(h=><div key={h.dominio} className="space-y-2 rounded border p-3"><h3 className="font-semibold">Conta conjunta {h.dominio.slice(5)}</h3>
    <p>Saldo dos movimentos vinculados à aeronave até o fim do mês: {dinheiro(h.saldoMovimentosAeronaveCentavos)}</p>
    {!!h.aportesSemSocioCentavos && <p role="alert">Aportes sem sócio: {dinheiro(h.aportesSemSocioCentavos)}</p>}
    {h.socios.filter(s=>!cotistaId||s.id===cotistaId).map(s=><p key={s.id}>{s.nome}: aportes {dinheiro(s.aporteCentavos)} + pago pessoal {dinheiro(s.pagoCentavos)} − custo {dinheiro(s.devidoCentavos)} = posição {dinheiro(s.posicaoCentavos)}</p>)}
    <p className="text-sm">Posição acumulada. Saldo positivo pode ser dinheiro disponível na conta; não significa retirada autorizada. Depende do saldo inicial e dos movimentos completos.</p></div>)}
   <fieldset disabled={salvando} className="space-y-3 rounded border p-3"><legend className="px-1 font-semibold">Atribuir custo ao responsável</legend>
    <p className="text-sm">Transfere responsabilidade entre duas linhas da mesma despesa e grupo. Não altera quem pagou.</p>
    <label className="block">Retirar custo de <select className="ml-2 max-w-full rounded border bg-transparent p-2" value={origem} onChange={e=>{setOrigem(e.target.value);setDestino('')}}><option value="">Escolha a despesa e o cotista</option>{dados.linhas.filter(l=>l.devido>0&&!l.origemChave.startsWith('SEM_VINCULO:')).map(l=><option key={l.id} value={l.id}>{l.descricao} — {nomes.get(l.participanteId)} — {dinheiro(l.devido)}</option>)}</select></label>
    <label className="block">Atribuir a <select className="ml-2 rounded border bg-transparent p-2" value={destino} onChange={e=>setDestino(e.target.value)}><option value="">Escolha outro cotista</option>{destinos.map(l=><option key={l.id} value={l.id}>{nomes.get(l.participanteId)}</option>)}</select></label>
    <label className="block">Valor em reais <input className="ml-2 rounded border bg-transparent p-2" inputMode="decimal" placeholder="100,00" value={valor} onChange={e=>setValor(e.target.value)}/></label>
    <label className="block">Motivo <input className="ml-2 w-full rounded border bg-transparent p-2" value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={1000}/></label>
    <button type="button" onClick={salvar} disabled={!origem||!destino||salvando} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{salvando?'Salvando…':'Salvar ajuste de responsabilidade'}</button>
   </fieldset>
  </>}
 </section>
}
