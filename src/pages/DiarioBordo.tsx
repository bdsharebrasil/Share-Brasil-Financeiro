
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CalendarDays, Edit3, Fuel, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateMonthDialog } from "@/components/diario/CreateMonthDialog";
import DiarioBancoHoras from "@/components/diario/DiarioBancoHoras";
import DiarioLancamentoForm from "@/components/diario/DiarioLancamentoForm";
import {
  atualizarLancamentoDiario, atualizarMesDiario, buscarDetalhesDiario, buscarOpcoesDiario, buscarResumoDiario,
  criarLancamentoDiario, criarMesDiario, excluirLancamentoDiario,
  type DiarioAeronaveResumo, type DiarioDetalhesResponse, type DiarioLancamento, type DiarioOpcoesResponse,
} from "@/lib/colaborador-api";

const monthName=(month:number)=>new Date(2000,month-1,1).toLocaleDateString("pt-BR",{month:"long"});
const dateBR=(value?:string|null)=>value?new Date(value.slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR"):"—";
const hhmm=(decimal:number|string|null|undefined)=>{
  const n=Number(decimal); if(!Number.isFinite(n)) return "00:00";
  const minutes=Math.max(0,Math.round(n*60));
  return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");
};

export default function DiarioBordo({aoVoltar,aoAbrirAerodromos}:{aoVoltar?:()=>void;aoAbrirAerodromos?:()=>void}){
  const now=new Date();
  const [ano,setAno]=useState(now.getFullYear());
  const [aeronaves,setAeronaves]=useState<DiarioAeronaveResumo[]>([]);
  const [options,setOptions]=useState<DiarioOpcoesResponse|null>(null);
  const [selected,setSelected]=useState<DiarioAeronaveResumo|null>(null);
  const [details,setDetails]=useState<DiarioDetalhesResponse|null>(null);
  const [period,setPeriod]=useState({ano:now.getFullYear(),mes:now.getMonth()+1});
  const [loading,setLoading]=useState(true),[detailsLoading,setDetailsLoading]=useState(false),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [monthEditor,setMonthEditor]=useState(false);
  const [entryEditor,setEntryEditor]=useState<DiarioLancamento|null|false>(false);
  const [search,setSearch]=useState("");
  const [message,setMessage]=useState<{type:"error"|"success";text:string}|null>(null);

  const loadList=useCallback(async(silent=false)=>{
    silent?setRefreshing(true):setLoading(true); setMessage(null);
    try{const [summary,opcoes]=await Promise.all([buscarResumoDiario(ano),options?Promise.resolve(options):buscarOpcoesDiario()]);setAeronaves(summary.aeronaves||[]);setOptions(opcoes);}
    catch(error){setMessage({type:"error",text:error instanceof Error?error.message:"Não foi possível carregar os diários."});}
    finally{setLoading(false);setRefreshing(false);}
  },[ano,options]);
  const loadDetails=useCallback(async(aircraft:DiarioAeronaveResumo,target=period)=>{
    setDetailsLoading(true);
    try{setDetails(await buscarDetalhesDiario(aircraft.id,target.ano,target.mes));}
    catch(error){setMessage({type:"error",text:error instanceof Error?error.message:"Não foi possível carregar o diário."});}
    finally{setDetailsLoading(false);}
  },[period]);
  useEffect(()=>{void loadList();},[loadList]);

  const filtered=useMemo(()=>aeronaves.filter(i=>(i.matricula_registro+" "+(i.fabricante||"")+" "+(i.modelo||"")).toLowerCase().includes(search.toLowerCase())),[aeronaves,search]);
  const openAircraft=(aircraft:DiarioAeronaveResumo)=>{
    const next={ano,mes:aircraft.mes_referencia||now.getMonth()+1};
    setSelected(aircraft);setPeriod(next);setDetails(null);setEntryEditor(false);setMonthEditor(false);setMessage(null);void loadDetails(aircraft,next);
  };
  const back=()=>{setSelected(null);setDetails(null);setEntryEditor(false);setMonthEditor(false);void loadList(true);};
  const saveMonth=async(payload:Record<string,unknown>,id?:string)=>{
    if(!selected)return;setSaving(true);setMessage(null);
    try{if(id)await atualizarMesDiario(id,payload);else await criarMesDiario(payload);const next={ano:Number(payload.ano),mes:Number(payload.mes)};setPeriod(next);setMonthEditor(false);setMessage({type:"success",text:"Diário mensal salvo."});await loadDetails(selected,next);await loadList(true);}
    catch(error){setMessage({type:"error",text:error instanceof Error?error.message:"Não foi possível salvar o mês."});}finally{setSaving(false);}
  };
  const saveEntry=async(payload:Record<string,unknown>)=>{
    if(!selected||!details?.diario_mes)return;setSaving(true);setMessage(null);
    try{if(entryEditor)await atualizarLancamentoDiario(entryEditor.id,payload);else await criarLancamentoDiario(payload);setEntryEditor(false);setMessage({type:"success",text:entryEditor?"Lançamento atualizado.":"Lançamento registrado."});await loadDetails(selected,period);await loadList(true);}
    catch(error){setMessage({type:"error",text:error instanceof Error?error.message:"Não foi possível salvar o lançamento."});}finally{setSaving(false);}
  };
  const removeEntry=async(entry:DiarioLancamento)=>{
    if(!window.confirm("Excluir o lançamento #"+entry.numero_sequencial+"? Esta ação não pode ser desfeita."))return;
    try{await excluirLancamentoDiario(entry.id);setMessage({type:"success",text:"Lançamento excluído."});await loadDetails(selected!,period);await loadList(true);}
    catch(error){setMessage({type:"error",text:error instanceof Error?error.message:"Não foi possível excluir o lançamento."});}
  };

  if(selected){
    const month=details?.diario_mes,closed=Boolean(month?.fechado);
    const fuel=(details?.lancamentos||[]).reduce((sum,item)=>sum+Number(item.litros_combustivel_abastecido||0),0);
    const periods=(details?.meses_disponiveis||[]).map(i=>({ano:i.ano,mes:i.mes}));
    const key=period.ano+"-"+String(period.mes).padStart(2,"0");
    return <div className="min-w-0 space-y-4 pb-8 md:space-y-5">
      <header className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5"><button type="button" onClick={back} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted"><ArrowLeft size={16}/></button><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-primary">Diário de bordo</p><h1 className="truncate text-base font-extrabold sm:text-lg">{selected.matricula_registro}</h1><p className="truncate text-[10px] text-muted-foreground">{selected.fabricante||"Aeronave"} {selected.modelo||""}</p></div></div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <select value={key} onChange={e=>{const p=e.target.value.split("-").map(Number);const next={ano:p[0],mes:p[1]};setPeriod(next);setEntryEditor(false);void loadDetails(selected,next);}} className="campo h-11 sm:col-span-2 lg:col-span-1"><option value={key}>{monthName(period.mes)} {period.ano}</option>{periods.filter(p=>p.ano+"-"+String(p.mes).padStart(2,"0")!==key).map(p=><option key={p.ano+"-"+p.mes} value={p.ano+"-"+String(p.mes).padStart(2,"0")}>{monthName(p.mes)} {p.ano}</option>)}</select>
            {!closed&&month&&<Button onClick={()=>setEntryEditor(null)} className="h-11 gap-2"><Plus size={15}/>Novo lançamento</Button>}
            <Button variant="outline" onClick={()=>void loadDetails(selected)} disabled={detailsLoading} className="h-11 gap-2"><RefreshCw size={14} className={detailsLoading?"animate-spin":""}/>Atualizar</Button>
            <Button variant="outline" onClick={()=>setMonthEditor(true)} className="h-11 gap-2"><CalendarDays size={14}/>Mês</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 xl:grid-cols-4">
          <Summary label="Horímetro inicial" value={hhmm(month?.horimetro_inicio)}/>
          <Summary label="Horímetro final" value={hhmm(month?.horimetro_final)}/>
          <Summary label="Célula atual" value={hhmm(month?.celula_atual_ttotal||selected.celula_atual_ttotal)}/>
          <Summary label="Disponível" value={hhmm(month?.celula_disponivel_ttotal)}/>
        </div>
      </header>
      {message&&<div className={"rounded-xl border p-3 text-xs "+(message.type==="error"?"border-destructive/30 bg-destructive/10 text-destructive-foreground":"border-emerald-500/30 bg-emerald-500/10 text-emerald-600")}>{message.text}</div>}
      {detailsLoading&&!details&&<div className="h-48 animate-pulse rounded-2xl bg-muted/40"/>}
      {!detailsLoading&&!month&&<section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><BookOpenCheck className="mx-auto mb-3 text-primary" size={30}/><h2 className="text-base font-bold">Mês ainda não aberto</h2><p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Abra o mês para começar os lançamentos de horas e voos.</p><Button onClick={()=>setMonthEditor(true)} className="mt-4 h-11 gap-2"><Plus size={15}/>Abrir diário</Button></section>}
      {month&&<>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 sm:px-4"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Fuel size={15}/></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Combustível</p><p className="text-xs text-muted-foreground">{fuel.toLocaleString("pt-BR",{maximumFractionDigits:2})} L abastecidos no mês</p></div></div>
        {monthEditor&&<CreateMonthDialog open={monthEditor} onOpenChange={setMonthEditor} aircraftId={selected.id} aircraftRegistration={selected.matricula_registro} month={period.mes} year={period.ano} currentModoCelula={month.modo_celula||null} previousMonthData={{celula_atual_ttotal:month.celula_atual_ttotal,celula_prox_revisao_ttotal:month.celula_prox_revisao_ttotal,horimetro_final:month.horimetro_final,aerodromo_base:month.aerodromo_base,consumo_combustivel:month.consumo_combustivel,tem_tarifa_diaria:Boolean(month.tem_tarifa_diaria),tarifa_diaria:month.tarifa_diaria}} onCreate={p=>saveMonth(p,month.id)}/>}
        {entryEditor!==false&&!closed&&options&&<DiarioLancamentoForm aeronaveId={selected.id} diarioMesId={month.id} opcoes={options} initialData={entryEditor||null} sugeridaCelula={Number(month.celula_atual_ttotal||0)} sugestaoTrecho={details?.lancamentos?.at(-1)?.trecho||undefined} temDiaria={Boolean(month.tem_tarifa_diaria)} onSubmit={saveEntry} onCancel={()=>setEntryEditor(false)} saving={saving}/>}
        <Lancamentos lancamentos={details?.lancamentos||[]} closed={closed} onEdit={setEntryEditor} onDelete={removeEntry}/>
        <DiarioBancoHoras lancamentos={details?.lancamentos||[]} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas}/>
      </>}
    </div>;
  }

  return <div className="min-w-0 space-y-5 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Operações</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><BookOpenCheck className="text-primary" size={26}/>Diários de bordo</h1><p className="mt-1 text-xs text-muted-foreground">Lançamento de horas e voos otimizado para celular e desktop.</p></div><div className="flex w-full gap-2 sm:w-auto">{aoVoltar&&<Button variant="outline" onClick={aoVoltar} className="h-10 flex-1 sm:flex-none"><ArrowLeft size={14}/>Voltar</Button>}{aoAbrirAerodromos&&<Button variant="outline" onClick={aoAbrirAerodromos} className="h-10 flex-1 sm:flex-none">Aeródromos</Button>}</div></header>
    {message&&<div className={"rounded-xl border p-3 text-xs "+(message.type==="error"?"border-destructive/30 bg-destructive/10 text-destructive-foreground":"border-emerald-500/30 bg-emerald-500/10 text-emerald-600")}>{message.text}</div>}
    <div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs"><Search size={14} className="shrink-0 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar matrícula, fabricante ou modelo..." className="min-w-0 flex-1 bg-transparent outline-none"/></label><select value={ano} onChange={e=>setAno(Number(e.target.value))} className="campo h-11 sm:w-32"><option value={ano}>{ano}</option><option value={ano-1}>{ano-1}</option><option value={ano+1}>{ano+1}</option></select><Button variant="outline" onClick={()=>void loadList(true)} disabled={refreshing} className="h-11 gap-2 sm:w-auto"><RefreshCw size={14} className={refreshing?"animate-spin":""}/>Atualizar</Button></div>
    {loading?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-40 animate-pulse rounded-2xl bg-muted/40"/>)}</div>:filtered.length===0?<div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><BookOpenCheck className="mx-auto mb-3 text-muted-foreground" size={30}/><p className="text-sm font-bold">Nenhuma aeronave encontrada</p></div>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item=><AircraftCard key={item.id} item={item} onOpen={()=>openAircraft(item)}/>)}</div>}
  </div>;
}

function Summary({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xl font-extrabold">{value}</p></div>;}
function AircraftCard({item,onOpen}:{item:DiarioAeronaveResumo;onOpen:()=>void}){return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-lg font-extrabold">{item.matricula_registro}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.fabricante||"Aeronave"} {item.modelo||""}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">{item.fechado?"FECHADO":"ABERTO"}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><Mini label="Célula" value={hhmm(item.celula_atual_ttotal)}/><Mini label="Horas no ano" value={hhmm(item.horas_ano)}/><Mini label="Próx. revisão" value={hhmm(item.celula_prox_revisao_ttotal)}/><Mini label="Mês" value={monthName(item.mes_referencia)}/></div></button>;}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-muted/30 p-2"><p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 text-xs font-bold">{value}</p></div>;}
function Lancamentos({lancamentos,closed,onEdit,onDelete}:{lancamentos:DiarioLancamento[];closed:boolean;onEdit:(e:DiarioLancamento)=>void;onDelete:(e:DiarioLancamento)=>void}){
  return <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-3 py-3 sm:px-4"><div><h2 className="text-sm font-bold">Lançamentos</h2><p className="text-[10px] text-muted-foreground">{lancamentos.length} registro(s)</p></div>{closed&&<span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-600">MÊS FECHADO</span>}</div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-xs"><thead className="bg-muted/30 text-[9px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Voo / rota</th><th className="px-3 py-2 text-left">Horários</th><th className="px-3 py-2 text-left">Duração</th><th className="px-3 py-2 text-left">Tripulação</th><th className="px-3 py-2 text-right">Pass.</th><th className="px-3 py-2 text-right">Ações</th></tr></thead><tbody>{lancamentos.map(e=><tr key={e.id} className="border-t border-border/70"><td className="px-3 py-3 font-mono">{e.numero_sequencial}</td><td className="px-3 py-3 whitespace-nowrap">{dateBR(e.data_registro)}</td><td className="px-3 py-3"><div className="font-bold">{e.numero_voo||"—"}</div><div className="font-mono text-[10px] text-muted-foreground">{e.trecho||e.aerodromo_partida+" X "+e.aerodromo_chegada}</div></td><td className="px-3 py-3 font-mono text-[10px]">AC {e.tempo_ac?.slice(0,5)||"—"} · DEP {e.tempo_dep?.slice(0,5)||"—"}<br/>POU {e.tempo_pou?.slice(0,5)||"—"} · COR {e.tempo_cor?.slice(0,5)||"—"}</td><td className="px-3 py-3 font-mono">Voo {hhmm(e.tempo_voo)}<br/>Total {hhmm(e.tempo_total)}</td><td className="px-3 py-3">{e.pic_nome_exibicao||e.pic_nome||e.pic_canac}<div className="text-[10px] text-muted-foreground">{e.sic_nome_exibicao||e.sic_nome||e.sic_canac||"Sem SIC"}</div></td><td className="px-3 py-3 text-right font-mono">{e.passageiros??0}</td><td className="px-3 py-3"><div className="flex justify-end gap-1">{!closed&&<><Button variant="ghost" size="icon" onClick={()=>onEdit(e)} aria-label="Editar"><Edit3 size={14}/></Button><Button variant="ghost" size="icon" onClick={()=>onDelete(e)} aria-label="Excluir"><Trash2 size={14}/></Button></>}</div></td></tr>)}</tbody></table></div>
    <div className="divide-y divide-border md:hidden">{lancamentos.map(e=><article key={e.id} className="p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-sm font-bold">#{e.numero_sequencial} · {e.numero_voo||"Voo sem número"}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{dateBR(e.data_registro)} · {e.trecho||e.aerodromo_partida+" X "+e.aerodromo_chegada}</div></div><div className="flex gap-1">{!closed&&<><Button variant="ghost" size="icon" onClick={()=>onEdit(e)}><Edit3 size={14}/></Button><Button variant="ghost" size="icon" onClick={()=>onDelete(e)}><Trash2 size={14}/></Button></>}</div></div><div className="mt-3 grid grid-cols-4 gap-2"><Mini label="Voo" value={hhmm(e.tempo_voo)}/><Mini label="Total" value={hhmm(e.tempo_total)}/><Mini label="Pass." value={String(e.passageiros??0)}/><Mini label="Pousos" value={String(e.pousos_total??0)}/></div><div className="mt-2 font-mono text-[10px] text-muted-foreground">AC {e.tempo_ac?.slice(0,5)||"—"} · DEP {e.tempo_dep?.slice(0,5)||"—"} · POU {e.tempo_pou?.slice(0,5)||"—"} · COR {e.tempo_cor?.slice(0,5)||"—"}</div><div className="mt-2 text-[10px] text-muted-foreground">PIC: <span className="font-medium text-foreground">{e.pic_nome_exibicao||e.pic_nome||e.pic_canac}</span>{e.sic_nome_exibicao||e.sic_nome?" · SIC: "+(e.sic_nome_exibicao||e.sic_nome):""}</div></article>)}</div>
  </section>;
}
