import { useMemo, useState } from 'react';
import { calcularBalancoMensal, simularProximaDespesa, type ParticipanteBalanco, type RateioBalanco, type PagamentoBalanco, type AjusteBalanco } from '@/lib/balanco-cotistas';

type Fontes = { versao: number; aeronaveId: string; participantes: ParticipanteBalanco[]; rateios: RateioBalanco[]; pagamentos: PagamentoBalanco[]; ajustes: AjusteBalanco[] };
type Props = { dashboard: object; mesesSelecionados: string[] };
const moeda = (v: number) => (v/100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const percentual = (v: number) => `${v.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const data = (s: string) => s.slice(0,10).split('-').reverse().join('/');
const parser = (s: string) => /^\d+(,\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s.replace(',','.'))*100) : 0;

export function DespesasAcertosCotistas({dashboard,mesesSelecionados}:Props) {
  const d = dashboard as {balanco_fontes?:Fontes|null;balanco_detalhado_erro?:string|null;lancamentos?:Array<{id:string;data:string;descricao:string;tipo?:string;fluxo?:string;status?:string;valorCentavos:number;rateios?:unknown[]}>};
  const [aba,setAba] = useState('resumo');
  const [busca,setBusca] = useState('');
  const [pessoa,setPessoa] = useState('');
  const [situacao,setSituacao] = useState('');
  const [pagina,setPagina] = useState(1);
  const [valor,setValor] = useState('1000,00');
  const [pesos,setPesos] = useState<Record<string,string>>({});
  const [expandido,setExpandido] = useState<string|null>(null);
  const [cenarioId,setCenarioId] = useState('');
  const meses = [...new Set(mesesSelecionados.filter(m=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)))].sort();
  const assinatura = meses.join(',');
  const calculo = useMemo(()=>{
    const f=d.balanco_fontes;
    if(!f || f.versao!==1 || !meses.length) return {balanco:null,erro:null};
    try {
      const ultimo=meses[meses.length-1];const [ano,mes]=ultimo.split('-').map(Number);
      const fim=new Date(Date.UTC(ano,mes,0)).toISOString().slice(0,10);
      return {balanco:calcularBalancoMensal(f.participantes,f.rateios,f.pagamentos,f.ajustes,`${meses[0]}-01`,fim,meses),erro:null};
    }catch(e){return {balanco:null,erro:e instanceof Error?e.message:String(e)}}
  // assinatura representa os meses ordenados e sem duplicidade.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[d.balanco_fontes,assinatura]);
  const b=calculo.balanco;
  const nomes=new Map(d.balanco_fontes?.participantes.map(p=>[p.id,p.nome])??[]);
  const nome=(id:string)=>nomes.get(id)||'Cotista sem cadastro';
  const semRateio=(d.lancamentos??[]).filter(l=>meses.includes(l.data.slice(0,7))&&l.fluxo==='SAIDA'&&l.tipo==='lancamentos'&&!l.rateios?.length&&!['CANCELADO','ESTORNO'].includes(l.status??''));
  const totalSemRateio=semRateio.reduce((s,l)=>s+l.valorCentavos,0);
  const clientes=b?.saldos.filter(s=>s.dominio==='CLIENTES')??[];
  const pendente=b?.despesas.reduce((s,r)=>s+r.pendenteCentavos,0)??0;
  const acerto=b?.compensacoes.reduce((s,c)=>s+c.valorCentavos,0)??0;
  const simulacao=useMemo(()=>{
    if(!b || !parser(valor) || clientes.length<2) return {dados:null,erro:null};
    if(totalSemRateio>0) return {dados:null,erro:'Distribua as despesas sem rateio antes de simular o equilíbrio.'};
    const entradas=clientes.map(c=>({id:c.id,peso:Number((pesos[c.id]??'').replace(',','.'))}));
    if(entradas.some(p=>!Number.isFinite(p.peso)||p.peso<0)||Math.abs(entradas.reduce((s,p)=>s+p.peso,0)-100)>0.000001) return {dados:null,erro:'Informe os percentuais da nova despesa, somando 100%.'};
    try{return {dados:simularProximaDespesa(b,parser(valor),entradas),erro:null}}catch(e){return {dados:null,erro:e instanceof Error?e.message:String(e)}}
  },[b,valor,pesos,totalSemRateio]); // clientes deriva de b.
  const filtradas=(b?.despesas??[]).filter(r=>(!busca||`${r.descricao} ${r.categoria} ${r.chave}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))&&(!pessoa||r.rateios.some(p=>p.participanteId===pessoa)||r.pagamentos.some(p=>p.pagadorId===pessoa))&&(!situacao||(situacao==='pendente'?r.pendenteCentavos>0:situacao==='excesso'?r.excessoCentavos>0:r.pendenteCentavos===0&&r.excessoCentavos===0)));
  const paginas=Math.max(1,Math.ceil(filtradas.length/20));const atual=Math.min(pagina,paginas);
  const ranking=[...clientes].sort((a,b)=>b.devidoCentavos-a.devidoCentavos);
  const maiorCusto=ranking[0];const maiorPago=[...clientes].sort((a,b)=>b.pagoCentavos-a.pagoCentavos)[0];
  const escolhido=simulacao.dados?.cenarios.find(c=>c.pagadorId===cenarioId)||simulacao.dados?.cenarios[0];
  if(!b) return <div className="bca"><style>{CSS}</style><div className="bca-alert" role="status">{calculo.erro||d.balanco_detalhado_erro||'Detalhamento indisponível. Instale os arquivos do backend e preserve balanco_fontes e balanco_detalhado_erro na resposta de buscarDashboardCotista.'}</div></div>;
  return <div className="bca"><style>{CSS}</style>
    <div className="bca-intro"><div><small>DESPESAS · RATEIOS · EQUILÍBRIO</small><h3>Uma conta clara para cada cotista</h3><p>Custos por competência nos meses selecionados. Pagamentos dessas despesas até {data(b.fim)}.</p></div><span className="bca-badge">Prévia de acerto</span></div>
    <div className="bca-metrics">
      <Metrica titulo="Custo rateado" valor={moeda(b.custoTotalCentavos)} texto="Inclui categorias sem classificação" />
      <Metrica titulo="Pago pelos cotistas" valor={moeda(b.pagoPessoalCentavos)} texto="Pagamentos pessoais identificados" />
      <Metrica titulo="Cobertura pendente" valor={moeda(pendente)} texto="Não vira crédito de outro cotista" />
      <Metrica titulo="Acertos entre clientes" valor={moeda(acerto)} texto="Compensações bilaterais sugeridas" />
    </div>
    {semRateio.length>0&&<div className="bca-alert" role="alert">{semRateio.length} despesa(s) sem rateio, total de {moeda(totalSemRateio)}. Não foram atribuídas aos cotistas nem entram no acerto. Confira a lista na aba de lançamentos.</div>}
    {!!b.avisos.length&&<div className="bca-alert" role="alert"><strong>Conferência necessária · simulação bloqueada</strong><ul>{b.avisos.map(a=><li key={a}>{a}</li>)}</ul></div>}
    <nav className="bca-nav" aria-label="Detalhamento financeiro">{[['resumo','Visão dos cotistas'],['despesas','Lançamentos e percentuais'],['acertos','Quem deve para quem'],['simular','Equilibrar próxima despesa']].map(([id,label])=><button type="button" aria-pressed={aba===id} onClick={()=>setAba(id)} key={id}>{label}</button>)}</nav>
    {aba==='resumo'&&<>
      <div className="bca-highlights"><div><small>MAIOR CUSTO ATRIBUÍDO</small><strong>{maiorCusto?.nome||'Sem clientes'}</strong><span>{moeda(maiorCusto?.devidoCentavos||0)}</span></div><div><small>MAIOR DESEMBOLSO PESSOAL</small><strong>{maiorPago?.nome||'Sem clientes'}</strong><span>{moeda(maiorPago?.pagoCentavos||0)}</span></div></div>
      <div className="bca-scroll"><table><thead><tr><th>Cotista / grupo</th><th>Custo atribuído</th><th>% do custo total</th><th>Desembolso pessoal</th><th>Pago − custo</th><th>A receber de clientes</th><th>A pagar a clientes</th></tr></thead><tbody>{[...b.saldos].sort((a,b)=>b.devidoCentavos-a.devidoCentavos).map(s=>{const receber=b.compensacoes.filter(c=>c.paraId===s.id).reduce((s,c)=>s+c.valorCentavos,0);const pagar=b.compensacoes.filter(c=>c.deId===s.id).reduce((s,c)=>s+c.valorCentavos,0);return <tr key={s.id}><th>{s.nome}<small>{s.dominio==='CLIENTES'?'Cliente':'Conta comum · '+s.dominio}</small></th><td>{moeda(s.devidoCentavos)}</td><td>{percentual(b.custoTotalCentavos?s.devidoCentavos/b.custoTotalCentavos*100:0)}</td><td>{moeda(s.pagoCentavos)}</td><td className={s.saldoCentavos>0?'bca-credit':s.saldoCentavos<0?'bca-debt':''}>{moeda(s.saldoCentavos)}</td><td>{s.dominio==='CLIENTES'?moeda(receber):'Ver conta comum'}</td><td>{s.dominio==='CLIENTES'?moeda(pagar):'Ver conta comum'}</td></tr>})}</tbody></table></div>
      <p className="bca-note">Pago − custo inclui despesas ainda sem cobertura. Para saber a dívida entre pessoas, use as colunas “a receber” e “a pagar”. Recursos da conta comum não são tratados como pagamentos pessoais.</p>
    </>}
    {aba==='despesas'&&<>
      <div className="bca-toolbar"><label>Buscar descrição ou categoria<input value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}} placeholder="Ex.: hangaragem, seguro, combustível" /></label><label>Cotista<select value={pessoa} onChange={e=>{setPessoa(e.target.value);setPagina(1)}}><option value="">Todos</option>{b.saldos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label>Cobertura pessoal<select value={situacao} onChange={e=>{setSituacao(e.target.value);setPagina(1)}}><option value="">Todas</option><option value="pendente">Pendente</option><option value="pago">Coberta</option><option value="excesso">Pagamento excedente</option></select></label></div>
      <div className="bca-scroll"><table className="bca-ledger"><thead><tr><th>Competência / despesa</th><th>Valor rateado</th><th>Responsáveis e percentuais</th><th>Quem pagou a despesa</th><th>Pendente</th><th>Detalhes</th></tr></thead><tbody>{filtradas.slice((atual-1)*20,atual*20).map(r=><Linha key={r.chave} despesa={r} nome={nome} aberta={expandido===r.chave} alternar={()=>setExpandido(expandido===r.chave?null:r.chave)} />)}</tbody></table></div>
      {semRateio.length>0&&<><h4>Despesas sem rateio · responsabilidade não atribuída</h4><div className="bca-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{semRateio.map(l=><tr key={l.id}><td>{data(l.data)}</td><th>{l.descricao}</th><td>{moeda(l.valorCentavos)}</td></tr>)}</tbody></table></div></>}
      {!filtradas.length&&<p className="bca-empty">Nenhuma despesa encontrada com esses filtros.</p>}
      <div className="bca-pagination"><span>{filtradas.length} despesas · total filtrado {moeda(filtradas.reduce((s,r)=>s+r.totalCentavos,0))}</span><div><button type="button" disabled={atual<=1} onClick={()=>setPagina(atual-1)}>Anterior</button><span>{atual} / {paginas}</span><button type="button" disabled={atual>=paginas} onClick={()=>setPagina(atual+1)}>Próxima</button></div></div>
      <p className="bca-note">Percentuais calculados sobre o valor rateado de cada origem, após os ajustes registrados. Despesas sem rateio não entram nesta apuração. Filtrar a tabela não altera os indicadores nem os acertos.</p>
    </>}
    {aba==='acertos'&&<>
      <h4>Compensações líquidas entre cotistas clientes</h4>
      <Transferencias itens={b.compensacoes} nome={nome} />
      <h4>Matriz · quem pagou despesas de quem</h4><div className="bca-scroll"><table><thead><tr><th>Pagador ↓ / beneficiário →</th>{clientes.map(c=><th key={c.id}>{c.nome}</th>)}</tr></thead><tbody>{clientes.map(c=><tr key={c.id}><th>{c.nome}</th>{clientes.map(outro=><td key={outro.id}>{c.id===outro.id?'—':moeda(b.matrizBruta[c.id]?.[outro.id]||0)}</td>)}</tr>)}</tbody></table></div>
      <p className="bca-note">Cada valor mostra custo de outro cotista coberto pelo pagador. O acerto desconta os pagamentos no sentido contrário. Pagamentos parciais são distribuídos proporcionalmente ao custo. Esta matriz não comprova transferências bancárias entre cotistas; elas não estão registradas nesta fonte. Se já houve acerto fora do sistema, concilie antes de pagar.</p>
    </>}
    {aba==='simular'&&<>
      <h4>Quem pode pagar a próxima despesa?</h4><p className="bca-note">Informe o custo e o rateio real da nova despesa. A simulação compara o pagamento integral por cada cliente e busca o menor total de acertos bilaterais. Nada é salvo.</p>
      <div className="bca-simulator"><label>Valor da nova despesa (R$)<input inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)} placeholder="1000,00" /></label>{clientes.map(c=><label key={c.id}>{c.nome} · participação (%)<input inputMode="decimal" value={pesos[c.id]??''} placeholder="0" onChange={e=>setPesos({...pesos,[c.id]:e.target.value})} /></label>)}</div>
      {clientes.length<2&&<p className="bca-empty">A simulação precisa de pelo menos dois cotistas clientes.</p>}
      {!parser(valor)&&<p role="status">Informe um valor positivo, sem separador de milhar, por exemplo 1500,50.</p>}
      {simulacao.erro&&<div className="bca-alert" role="status">{simulacao.erro}</div>}
      {simulacao.dados&&escolhido&&<>
        <div className="bca-recommend"><small>{simulacao.dados.cenarios[0].reducaoCentavos>0?'MELHOR REDUÇÃO DE ACERTO':'MENOR ACERTO ENTRE OS CENÁRIOS'}</small><h3>{simulacao.dados.cenarios[0].nome} pode pagar a nova despesa</h3><p>Acerto atual: {moeda(acerto)} → após a despesa: {moeda(simulacao.dados.cenarios[0].totalAcertoCentavos)}.</p><p>{simulacao.dados.cenarios[0].reducaoCentavos>0?`Redução de ${moeda(simulacao.dados.cenarios[0].reducaoCentavos)}.`:'Nenhum cenário reduz o acerto atual; o primeiro produz o menor total. Pode haver empate.'}</p></div>
        <div className="bca-scroll"><table><thead><tr><th>Se o pagamento for de</th><th>Acerto resultante</th><th>Redução / aumento</th><th>Comparar</th></tr></thead><tbody>{simulacao.dados.cenarios.map(c=><tr key={c.pagadorId}><th>{c.nome}</th><td>{moeda(c.totalAcertoCentavos)}</td><td className={c.reducaoCentavos>0?'bca-credit':'bca-debt'}>{c.reducaoCentavos>=0?'Reduz':'Aumenta'} {moeda(Math.abs(c.reducaoCentavos))}</td><td><button type="button" aria-pressed={escolhido.pagadorId===c.pagadorId} onClick={()=>setCenarioId(c.pagadorId)}>Ver cenário</button></td></tr>)}</tbody></table></div>
        <h4>Depois de {escolhido.nome} pagar {moeda(parser(valor))}</h4><Transferencias itens={escolhido.compensacoes} nome={nome}/>
      </>}
      <p className="bca-note">Para equilibrar desembolsos, escolha o pagador. O percentual de responsabilidade deve continuar refletindo o uso, o contrato ou a regra da despesa. A simulação considera apenas as despesas dos meses selecionados e não inclui saldos anteriores nem acertos já realizados fora desta fonte.</p>
    </>}
  </div>;
}
function Metrica({titulo,valor,texto}:{titulo:string;valor:string;texto:string}){return <div className="bca-metric"><span>{titulo}</span><strong>{valor}</strong><small>{texto}</small></div>}
function Transferencias({itens,nome}:{itens:Array<{deId:string;paraId:string;valorCentavos:number}>;nome:(id:string)=>string}){return itens.length?<div className="bca-transfers">{itens.map(c=><div className="bca-transfer" key={`${c.deId}:${c.paraId}`}><span><small>QUEM PAGA</small><strong>{nome(c.deId)}</strong></span><span className="bca-arrow" aria-label="paga para">→</span><span><small>QUEM RECEBE</small><strong>{nome(c.paraId)}</strong></span><b>{moeda(c.valorCentavos)}</b></div>)}</div>:<p className="bca-empty">Não há compensação entre clientes com os pagamentos identificados neste recorte.</p>}
function Linha({despesa:r,nome,aberta,alternar}:{despesa:ReturnType<typeof calcularBalancoMensal>['despesas'][number];nome:(id:string)=>string;aberta:boolean;alternar:()=>void}){return <>
  <tr><th><small>{data(r.competencia)} · {r.tipo}</small><span className="bca-description">{r.descricao||'Sem descrição'}</span><small>{r.categoria}</small></th><td>{moeda(r.totalCentavos)}</td><td>{r.rateios.map(p=><div className="bca-split" key={p.id}><span>{nome(p.participanteId)} <b>{percentual(p.percentual)}</b></span><strong>{moeda(p.valorCentavos)}</strong></div>)}</td><td>{r.pagamentos.length?r.pagamentos.map(p=><div className="bca-split" key={p.pagadorId}><span>{nome(p.pagadorId)}</span><strong>{moeda(p.valorCentavos)}</strong></div>):<span>Sem pagamento pessoal identificado</span>}{r.excessoCentavos>0&&<small className="bca-debt">Excedente: {moeda(r.excessoCentavos)}</small>}</td><td className={r.pendenteCentavos?'bca-debt':'bca-credit'}>{moeda(r.pendenteCentavos)}</td><td><button type="button" aria-expanded={aberta} onClick={alternar}>{aberta?'Fechar':'Ver cobertura'}</button></td></tr>
  {aberta&&<tr className="bca-detail"><td colSpan={6}><strong>Cobertura da despesa, por pagador e beneficiário</strong>{r.cobertura.filter(c=>c.valorCentavos>0).map((c,i)=><p key={i}>{nome(c.pagadorId)} cobriu {moeda(c.valorCentavos)} da parcela de {nome(c.beneficiarioId)}{c.pagadorId===c.beneficiarioId?' (parcela própria)':''}.</p>)}{!r.cobertura.some(c=>c.valorCentavos>0)&&<p>Não há cobertura pessoal identificada até a data de corte.</p>}<small>Origem: {r.chave}. Cobertura proporcional; acerto líquido calculado considerando também o sentido inverso.</small></td></tr>}
</>}
const CSS=`
.bca{--bc-card:var(--bcp-card,hsl(var(--card)));--bc-fg:var(--bcp-fg,hsl(var(--foreground)));--bc-border:var(--bcp-border,hsl(var(--border)));color:var(--bc-fg);font-size:13px;min-width:0}.bca *{box-sizing:border-box}.bca-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.bca-intro small,.bca-recommend>small{letter-spacing:.13em;color:#509bb8;font-weight:700;font-size:10px}.bca h3{font-size:21px;letter-spacing:-.03em;margin:7px 0}.bca p{line-height:1.65}.bca-intro p{margin:0;opacity:.7}.bca-badge{border:1px solid var(--bc-border);padding:7px 10px;border-radius:99px;white-space:nowrap;font-size:11px}.bca-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.bca-metric{background:var(--bc-card);border:1px solid var(--bc-border);border-radius:12px;padding:17px;min-width:0}.bca-metric>span{font-size:11px;opacity:.75}.bca-metric strong{display:block;font-size:clamp(17px,2vw,24px);font-variant-numeric:tabular-nums;margin:9px 0;overflow-wrap:anywhere}.bca-metric small{opacity:.65;font-size:10px;display:block}.bca-nav{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--bc-border);padding:18px 0 10px;margin-bottom:20px}.bca button,.bca input,.bca select{font:inherit;color:inherit;background:var(--bc-card);border:1px solid var(--bc-border);border-radius:7px;padding:9px 12px}.bca button{cursor:pointer;min-height:36px}.bca button:hover,.bca button[aria-pressed=true]{background:rgba(60,160,190,.12);border-color:#509bb8}.bca button:disabled{opacity:.4;cursor:default}.bca :is(button,input,select):focus-visible{outline:2px solid #509bb8;outline-offset:3px}.bca-highlights{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.bca-highlights>div{padding:17px;border:1px solid var(--bc-border);border-left:3px solid #509bb8;border-radius:8px}.bca-highlights small{display:block;font-size:10px;letter-spacing:.08em;opacity:.65}.bca-highlights strong{display:block;font-size:18px;margin:7px 0}.bca-scroll{width:100%;overflow:auto;border:1px solid var(--bc-border);border-radius:10px}.bca table{width:100%;border-collapse:collapse;min-width:840px;font-size:12px}.bca thead{background:rgba(100,140,170,.07)}.bca th,.bca td{border-bottom:1px solid var(--bc-border);padding:14px;text-align:left;vertical-align:top}.bca thead th{font-size:10px;letter-spacing:.03em}.bca td{font-variant-numeric:tabular-nums}.bca th small,.bca td>small{display:block;font-size:10px;opacity:.65;font-weight:400;margin:4px 0}.bca .bca-credit{color:#199c7b}.bca .bca-debt{color:#d07b3a}.bca-note{font-size:12px;opacity:.75;padding:10px 0}.bca h4{font-size:15px;margin:24px 0 14px}.bca-alert{border:1px solid rgba(200,140,60,.5);background:rgba(200,140,60,.08);border-radius:10px;margin:16px 0;padding:16px;line-height:1.6}.bca-alert ul{padding-left:18px;margin-bottom:0}.bca-toolbar{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin-bottom:16px}.bca label{font-size:11px;display:flex;flex-direction:column;gap:7px}.bca input,.bca select{width:100%;min-width:0;font-size:13px;min-height:40px}.bca-split{margin:0 0 9px;min-width:180px}.bca-split>span{display:block;opacity:.75;margin-bottom:3px}.bca-split b{margin-left:6px;font-size:10px}.bca-description{display:block;min-width:220px;max-width:400px;white-space:normal;overflow-wrap:anywhere;line-height:1.65;font-weight:600}.bca-detail{background:rgba(60,160,190,.06)}.bca-detail p{margin:6px 0}.bca-detail small{word-break:break-word}.bca-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;font-size:11px}.bca-pagination>div{display:flex;align-items:center;gap:12px}.bca-transfers{display:grid;gap:10px}.bca-transfer{display:flex;align-items:center;gap:22px;border:1px solid var(--bc-border);padding:20px;border-radius:10px;background:var(--bc-card)}.bca-transfer small{display:block;opacity:.6;font-size:9px;letter-spacing:.08em;margin-bottom:5px}.bca-transfer strong{font-size:15px}.bca-transfer b{margin-left:auto;font-size:19px;color:#199c7b;white-space:nowrap}.bca-arrow{color:#509bb8;font-size:22px}.bca-simulator{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;padding:20px;border:1px solid var(--bc-border);border-radius:10px}.bca-recommend{border:1px solid rgba(30,160,120,.45);background:rgba(30,160,120,.06);padding:20px;border-radius:12px;margin:20px 0}.bca-recommend h3{font-size:20px}.bca-empty{padding:28px;border:1px dashed var(--bc-border);border-radius:10px;opacity:.7;text-align:center}
@media(max-width:800px){.bca-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.bca-toolbar{grid-template-columns:1fr 1fr}.bca-toolbar label:first-child{grid-column:1/-1}.bca-transfer{gap:12px;flex-wrap:wrap}.bca-transfer b{width:100%;margin-left:0}}@media(max-width:480px){.bca-highlights{grid-template-columns:1fr}.bca-intro{flex-direction:column}.bca-nav{display:grid;grid-template-columns:1fr 1fr}.bca-nav button{font-size:11px}.bca-pagination{align-items:flex-start;flex-direction:column}.bca-metric{padding:12px}.bca-transfer strong{font-size:13px}}@media print{.bca-nav,.bca-toolbar,.bca-pagination,.bca button{display:none}.bca-scroll{overflow:visible}.bca table{min-width:0;font-size:9px}.bca th,.bca td{padding:6px}.bca-transfer,.bca-metric{break-inside:avoid}}
`;
