import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colaboradorRequest, type CtmRegistro as Linha } from "@/lib/colaborador-api";
import { formatarMoeda } from "@/components/dashboard/ComponentesDashboard";

const raiz="/api/ctm/coordenacao";
const nome:Record<string,string>={numero:"Número",oas_numero:"OAS vinculada",os_oficina:"OS da oficina",ordem_servico_id:"RAS vinculado",p_n_instalado:"P/N instalado",s_n_instalado:"S/N instalado",p_n_removido:"P/N removido",s_n_removido:"S/N removido",numero_da_peça:"P/N",numero_de_serie:"S/N",observacoes:"Observações",descricao:"Descrição",tipo_manutencao:"Tipo de manutenção",tipo_rateio:"Critério de rateio",total_pecas:"Custo de peças (R$)",total_mao_obra:"Mão de obra (R$)",relatorio_voo_de:"Uso desde",relatorio_voo_ate:"Uso até",valor_unitario:"Preço unitário (R$)",data_saida:"Saída da oficina",data_leitura:"Data da leitura dos contadores",base_legal:"Referência técnica e revisão",tipo_controle:"Controle",data_de_conformidade:"Data do cumprimento",metodo_de_conformidade:"Referência da execução",data_troca:"Data da troca",percentual:"Cota fixa",horas:"Horas de uso",pending:"Pendente",urgent:"Urgente",complied:"Cumprida",not_applicable:"Não aplicável",open:"Aberto",in_analysis:"Em avaliação",in_maintenance:"Em manutenção",resolved:"Corrigido",low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const rotulo=(v:string)=>nome[v]||v.replaceAll("_"," ").replace(/^./,c=>c.toUpperCase());
const dia=(v:unknown)=>v?String(v).slice(0,10).split("-").reverse().join("/"):"—";
const num=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:2});
const aviso=(e:unknown)=>e instanceof Error?e.message:"Falha ao acessar o CTM.";
const base=(id:string)=>raiz+"/aeronaves/"+encodeURIComponent(id);
const select="rounded-md border border-input bg-background p-2 text-sm";
type Campo={nome:string;tipo:string;opcoes?:string[];obrigatorio:boolean};
function useDados<T>(path:string,ativo=true,intervalo?:number){
  return useQuery({queryKey:[path],queryFn:()=>colaboradorRequest<T>(path),enabled:ativo,refetchInterval:intervalo});
}
function Historico({path,id}:{path:string;id?:string}){
  const q=useDados<{eventos:Linha[]}>(path);
  if(!q.data)return <p>{q.isError?aviso(q.error):"Carregando histórico…"}</p>;
  const eventos=q.data.eventos.filter(e=>!id||e.registro_id===id);
  return <div className="space-y-2">{eventos.map(e=><details key={e.registro_id+"-"+e.versao} className="rounded border p-2 text-xs"><summary>{e.data} UTC · {e.acao} · {e.responsavel} · {e.motivo || "Novo registro"}</summary>{[["Antes",e.anterior],["Depois",e.posterior]].map(([k,json])=>json&&<div key={k}><strong>{k}</strong><dl>{Object.entries(JSON.parse(json)).filter(([,v])=>v!=null).map(([campo,v])=><div key={campo}>{rotulo(campo)}: {String(v)}</div>)}</dl></div>)}</details>)}{!eventos.length&&<p>Nenhuma alteração posterior ao cadastro.</p>}</div>;
}
export function Cadastro({aeronave,modulo,titulo,ras,atualizar}:{aeronave:string;modulo:string;titulo:string;ras:Linha[];atualizar:()=>void}){
  const path=base(aeronave)+"/registros/"+modulo;
  const q=useDados<{registros:Linha[];campos:Campo[];podeEditar:boolean}>(path,!!aeronave);
  const cliente=useQueryClient();
  const [row,setRow]=useState<Linha|null>(null),[arquivo,setArquivo]=useState(false),[historico,setHistorico]=useState(false);
  const [motivo,setMotivo]=useState(""),[erro,setErro]=useState(""),[ocupado,setOcupado]=useState(false);
  function abrir(r:Linha,excluir=false){setRow({...r});setArquivo(excluir);setMotivo("");setErro("");}
  async function salvar(){
    if(!row||ocupado)return;
    setOcupado(true);setErro("");
    try{
      await colaboradorRequest(path+(row.id?"/"+encodeURIComponent(row.id):""),{method:arquivo?"DELETE":row.id?"PATCH":"POST",body:JSON.stringify({dados:row,motivo,versao:row.versao})});
      setRow(null);await cliente.invalidateQueries({queryKey:[path]});await cliente.invalidateQueries({queryKey:[base(aeronave)+"/historico/"+modulo]});atualizar();
    }catch(e){setErro(aviso(e));}finally{setOcupado(false);}
  }
  if(!q.data)return <p role="status">{q.isError?aviso(q.error):"Carregando cadastro…"}</p>;
  const {registros,campos,podeEditar}=q.data;
  const leitura=!podeEditar||row?.bloqueado;
  const resumo=campos.filter(f=>f.nome!=="ordem_servico_id").slice(0,5);
  return <section className="space-y-3 rounded-xl border bg-card p-4"><header className="flex flex-wrap items-center gap-2"><h2 className="mr-auto font-semibold">{titulo}</h2><Button variant="outline" onClick={()=>setHistorico(!historico)}>Histórico</Button>{podeEditar&&<Button disabled={ocupado} onClick={()=>abrir({})}>Novo registro</Button>}</header>
    {historico&&<Historico path={base(aeronave)+"/historico/"+modulo}/>}
    {row&&<form onSubmit={e=>{e.preventDefault();void salvar();}} className="grid gap-3 rounded border p-3 sm:grid-cols-2 lg:grid-cols-3">{campos.map(f=><label key={f.nome} className="grid gap-1 text-xs">{rotulo(f.nome)}{f.obrigatorio?" *":""}
      {f.opcoes||f.nome==="ordem_servico_id"?<select className={select} required={f.obrigatorio} disabled={leitura||arquivo||ocupado} value={row[f.nome]??""} onChange={e=>setRow({...row,[f.nome]:e.target.value})}><option value="">Selecione</option>{f.nome==="ordem_servico_id"?ras.map(r=><option key={r.id} value={r.id}>{r.numero||r.id}</option>):f.opcoes?.map(v=><option key={v} value={v}>{rotulo(v)}</option>)}</select>:<Input type={f.tipo} disabled={leitura||arquivo||ocupado} required={f.obrigatorio} value={row[f.nome]??""} step="any" min={f.tipo==="number"?0:undefined} onChange={e=>setRow({...row,[f.nome]:e.target.value})}/>}</label>)}
      {row.id&&!leitura&&<label className="col-span-full text-xs">Motivo da {arquivo?"exclusão da lista ativa":"alteração"}<Input value={motivo} required onChange={e=>setMotivo(e.target.value)}/></label>}
      {erro&&<p role="alert" className="col-span-full text-destructive">{erro}</p>}<div className="col-span-full flex gap-2"><Button type="button" variant="outline" disabled={ocupado} onClick={()=>setRow(null)}>Fechar</Button>{!leitura&&<Button disabled={ocupado}>{arquivo?"Confirmar arquivamento":"Salvar"}</Button>}</div></form>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{resumo.map(f=><th className="p-2" key={f.nome}>{rotulo(f.nome)}</th>)}<th>Ações</th></tr></thead><tbody>{registros.map(r=><tr key={r.id} className="border-t">{resumo.map(f=><td className="p-2" key={f.nome}>{f.tipo==="date"?dia(r[f.nome]):String(r[f.nome]??"—")}</td>)}<td className="whitespace-nowrap"><Button size="sm" variant="ghost" disabled={ocupado} onClick={()=>abrir(r)}>{r.bloqueado||!podeEditar?"Detalhar":"Editar"}</Button>{podeEditar&&!r.bloqueado&&<Button size="sm" variant="ghost" disabled={ocupado} onClick={()=>abrir(r,true)}>Arquivar</Button>}</td></tr>)}</tbody></table></div>{!registros.length&&<p>Nenhum registro para esta aeronave.</p>}</section>;
}
const proximos:Record<string,string[]>={open:["in_analysis"],in_analysis:["in_analysis","in_maintenance","resolved"],in_maintenance:["in_analysis","in_maintenance","resolved"],resolved:["in_analysis"]};
export function Reportes({aeronave,expandido,abrir}:{aeronave:string;expandido:boolean;abrir:()=>void}){
  const q=useDados<{registros:Linha[];podeEditar:boolean}>(raiz+"/reportes",true,60000);
  const cliente=useQueryClient();
  const [frota,setFrota]=useState(false),[edit,setEdit]=useState<Linha|null>(null),[hist,setHist]=useState(""),[status,setStatus]=useState(""),[motivo,setMotivo]=useState(""),[erro,setErro]=useState(""),[ocupado,setOcupado]=useState(false);
  if(!q.data)return <p className="text-xs">{q.isError?aviso(q.error):"Consultando reportes…"}</p>;
  const pendentes=q.data.registros.filter(r=>r.status!=="resolved");
  if(!expandido)return pendentes.length?<Button variant="outline" className="max-w-full whitespace-normal border-amber-500/50" onClick={()=>{setFrota(true);abrir();}}>{pendentes.length} reporte(s) em aberto na frota · {pendentes[0].matricula_registro} · Severidade {rotulo(pendentes[0].severidade)}</Button>:null;
  async function salvar(){
    if(!edit||ocupado)return;
    setOcupado(true);setErro("");
    try{await colaboradorRequest(base(edit.aeronave_id)+"/registros/reportes/"+edit.id,{method:"PATCH",body:JSON.stringify({versao:edit.versao,status,motivo})});setEdit(null);await Promise.all([q.refetch(),cliente.invalidateQueries({queryKey:[base(edit.aeronave_id)+"/historico/reportes"]})]);}catch(e){setErro(aviso(e));}finally{setOcupado(false);}
  }
  const rows=q.data.registros.filter(r=>frota||r.aeronave_id===aeronave);
  return <section className="space-y-3 rounded-xl border bg-card p-4"><header className="flex justify-between"><h2 className="font-semibold">Reportes da tripulação</h2><label><input type="checkbox" checked={frota} onChange={e=>setFrota(e.target.checked)}/> Toda a frota</label></header>{!rows.length&&<p>Nenhum reporte para a seleção.</p>}{rows.map(r=><article className="space-y-2 rounded-lg border p-3 text-sm" key={r.id}><strong>{r.matricula_registro} · {rotulo(r.status)} · Severidade {rotulo(r.severidade)}</strong><p>{r.descricao}</p><p>{dia(r.data_relatorio)} · {r.criado_por_nome}</p>{r.acao_corretiva&&<p>Último acompanhamento: {r.acao_corretiva}</p>}<Button size="sm" variant="outline" onClick={()=>setHist(hist===r.id?"":r.id)}>Histórico</Button>{q.data?.podeEditar&&<Button size="sm" variant="ghost" disabled={ocupado} onClick={()=>{setEdit(r);setMotivo("");setErro("");setStatus(proximos[r.status][0]);}}>{r.status==="resolved"?"Reabrir avaliação":"Atualizar acompanhamento"}</Button>}
    {hist===r.id&&<Historico path={base(r.aeronave_id)+"/historico/reportes"} id={r.id}/>}
    {edit?.id===r.id&&<form className="grid gap-2" onSubmit={e=>{e.preventDefault();void salvar();}}><label>Situação <select value={status} className={select} onChange={e=>setStatus(e.target.value)}>{proximos[r.status].map(v=><option key={v} value={v}>{rotulo(v)}</option>)}</select></label><label>Avaliação ou ação corretiva<textarea required maxLength={5000} className="block w-full rounded border bg-background p-2" value={motivo} onChange={e=>setMotivo(e.target.value)}/></label>{erro&&<p role="alert">{erro}</p>}<div><Button disabled={ocupado}>Salvar acompanhamento</Button> <Button type="button" variant="outline" disabled={ocupado} onClick={()=>setEdit(null)}>Cancelar</Button></div></form>}</article>)}</section>;
}
function Grade({titulos,linhas}:{titulos:string[];linhas:(string|number)[][]}){
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{titulos.map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{linhas.map((row,i)=><tr className="border-t" key={i}>{row.map((v,j)=><td className="p-2" key={j}>{v}</td>)}</tr>)}</tbody></table>{!linhas.length&&<p className="p-2">Nenhum registro.</p>}</div>;
}
export function Previsoes({aeronave}:{aeronave:string}){
  const q=useDados<{horas:number|null;media:number|null;itens:Linha[]}>(base(aeronave)+"/previsoes",!!aeronave);
  if(!q.data)return <p>{q.isError?aviso(q.error):"Carregando previsões…"}</p>;
  return <section className="space-y-2 rounded-xl border bg-card p-4"><h2 className="font-semibold">Próximas manutenções e trocas</h2><p>Horas de célula: {q.data.horas??"Sem leitura"} · Utilização média nos últimos 90 dias: {q.data.media==null?"Sem base":num(q.data.media)+" h/dia"}</p><Grade titulos={["Item","Próxima data","Horas restantes","Ciclos restantes","Limite em ciclos","Limite em pousos"]} linhas={q.data.itens.map(r=>[r.item,r.data?dia(r.data)+(r.estimada?" (estimada por uso)":" (calendário)"):"Sem previsão",r.saldo==null?"—":num(r.saldo),r.ciclos??"—",r.limite_ciclos??"—",r.limite_pousos??"—"])}/></section>;
}
export function Custos({aeronave,ordens}:{aeronave:string;ordens:Linha[]}){
  const [sel,setSel]=useState(""),[cat,setCat]=useState("");const id=sel||ordens[0]?.id;
  const divisao=useDados<Linha>(base(aeronave)+"/rateio/"+id,!!id);
  const financeiro=useDados<{registros:Linha[]}>(base(aeronave)+"/financeiro",!!aeronave);
  const pecas=useDados<{registros:Linha[]}>(base(aeronave)+"/registros/pecas",!!aeronave);
  const categorias=[...new Set((financeiro.data?.registros||[]).map(r=>String(r.categoria_nome||"Sem categoria")))].sort();
  const categoria=cat||categorias.find(c=>/manuten/i.test(c))||"";
  const meses=new Map<string,{pecas:number;servicos:number}>();
  for(const o of ordens){if(!o.data_entrada || o.total_pecas==null && o.total_mao_obra==null)continue;const k=String(o.data_entrada).slice(0,7),v=meses.get(k)||{pecas:0,servicos:0};v.pecas+=Number(o.total_pecas||0);v.servicos+=Number(o.total_mao_obra||0);meses.set(k,v);}
  const max=Math.max(1,...[...meses.values()].map(m=>Math.max(m.pecas,m.servicos)));
  return <div className="space-y-4"><section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Custos por mês de entrada na oficina</h2>{!meses.size&&<p>Nenhuma OAS com custos informados.</p>}{[...meses].sort(([a],[b])=>b.localeCompare(a)).map(([k,m])=><div key={k} className="my-3 text-xs"><strong>{k}</strong>{([["Peças",m.pecas],["Mão de obra",m.servicos]] as const).map(([l,v])=><div key={l} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-2"><span>{l}</span><div className="h-2 rounded bg-muted"><div className={l==="Peças"?"h-2 rounded bg-primary":"h-2 rounded bg-emerald-500"} style={{width:(v/max*100)+"%"}}/></div>{formatarMoeda(v)}</div>)}</div>)}</section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Histórico de preços das peças</h2>{pecas.isError?<p>{aviso(pecas.error)}</p>:<Grade titulos={["Troca","Peça","P/N instalado","Fornecedor","Quantidade","Unitário","Total"]} linhas={(pecas.data?.registros||[]).map(r=>[dia(r.data_troca),r.descricao,r.p_n_instalado||"—",r.fornecedor||"—",r.quantidade??"—",r.valor_unitario==null?"—":formatarMoeda(r.valor_unitario),r.valor_unitario==null||r.quantidade==null?"—":formatarMoeda(r.quantidade*r.valor_unitario)])}/>}</section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Prévia do rateio com as cotas ativas</h2><select className={select} aria-label="Selecionar OAS" value={id||""} onChange={e=>setSel(e.target.value)}>{ordens.map(o=><option value={o.id} key={o.id}>OAS {o.numero} · {o.objetivo}</option>)}</select>{divisao.isError?<p>{aviso(divisao.error)}</p>:divisao.data?.linhas?<Grade titulos={["Cotista",divisao.data.uso?"Horas no período":"Cota fixa (%)","Participação (%)","Valor previsto"]} linhas={divisao.data.linhas.map((r:Linha)=>[r.nome,num(divisao.data!.uso?r.base/60:r.base),num(r.percentual),formatarMoeda(r.centavos/100)])}/>:<p>{divisao.data?.aviso}</p>}</section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Rateios registrados no Financeiro</h2><label>Categoria <select className={select} value={categoria} onChange={e=>setCat(e.target.value)}><option value="">Selecione</option>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>{financeiro.isError?<p>{aviso(financeiro.error)}</p>:<Grade titulos={["Emissão","Cotista","Origem","Despesa","Situação","Valor rateado"]} linhas={(financeiro.data?.registros||[]).filter(r=>String(r.categoria_nome||"Sem categoria")===categoria).map(r=>[dia(r.competencia),r.cotista,String(r.dominio).startsWith("HOLD")?"Holding":"Cliente",r.descricao_despesa,r.status,formatarMoeda(r.valor_rateado_centavos/100)])}/>}</section></div>;
}
