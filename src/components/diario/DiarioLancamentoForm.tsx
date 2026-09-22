
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, Calculator, Check, Fuel, PlaneTakeoff, Save, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiarioLancamento, DiarioOpcoesResponse, NumeroVooJornada, NumeroVooPerna } from "@/lib/colaborador-api";
import { buscarNumerosVooAeronave } from "@/lib/colaborador-api";

type FormValues = Record<string, string | boolean>;
const naturezas = ["AE - Aérea/Regular","CQ - Cheque","EX - Executivo","NR - Não remunerado","RE - Retorno/Reposição","PV - Privado","SA - Serviço aéreo","TN - Táxi aéreo","TR - Traslado","VT - Voo Teste"];

const toMinutes = (value?: string | null) => {
  if (!value) return 0;
  const m = String(value).match(/^(\d{1,3}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const minutesToHHMM = (minutes: number) => {
  const safe = Math.max(0, Math.round(Number(minutes) || 0));
  return String(Math.floor(safe / 60)).padStart(2,"0") + ":" + String(safe % 60).padStart(2,"0");
};
const decimalToHHMM = (value: number | string | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? minutesToHHMM(n * 60) : "00:00";
};
const hhmmToDecimal = (value: string) => Number((toMinutes(value) / 60).toFixed(4));
const normalizeDuration = (raw: string) => {
  const clean = raw.replace(/[^\d:]/g,"");
  if (!clean) return "";
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return (parts[0] || "0").slice(0,3).padStart(2,"0") + ":" + (parts[1] || "0").slice(0,2).padStart(2,"0");
  }
  const digits = clean.slice(0,5);
  if (digits.length <= 2) return digits.padStart(2,"0") + ":00";
  return digits.slice(0,-2).padStart(2,"0") + ":" + digits.slice(-2);
};
const durationBetween = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh,sm] = start.split(":").map(Number), [eh,em] = end.split(":").map(Number);
  let result = (eh*60+em) - (sh*60+sm);
  if (result < 0) result += 1440;
  return result;
};
function formFromEntry(entry: DiarioLancamento | null | undefined, date: string, celula: number, trecho = ""): FormValues {
  return {
    data_registro: entry?.data_registro?.slice(0,10) || date, numero_voo: entry?.numero_voo || "",
    jornada_id: entry?.jornada_id || "", perna_jornada_id: entry?.perna_jornada_id || "",
    natureza_voo: entry?.natureza_voo || "PV - Privado", aerodromo_partida: entry?.aerodromo_partida || "",
    aerodromo_chegada: entry?.aerodromo_chegada || "", trecho: entry?.trecho || trecho,
    pic_canac: entry?.pic_canac || "", sic_canac: entry?.sic_canac || "", cliente_id: entry?.cliente_id || "",
    holding_id: entry?.holding_id || "", socio_id: entry?.socio_id || "", voo_emprestado: Boolean(entry?.voo_emprestado),
    cliente_tomador_emprestimo_id: entry?.cliente_tomador_emprestimo_id || "", socio_tomador_emprestimo_id: entry?.socio_tomador_emprestimo_id || "",
    tempo_ac: entry?.tempo_ac?.slice(0,5) || "", tempo_dep: entry?.tempo_dep?.slice(0,5) || "",
    tempo_pou: entry?.tempo_pou?.slice(0,5) || "", tempo_cor: entry?.tempo_cor?.slice(0,5) || "",
    tripulacao_checkin_hora: entry?.tempo_ac?.slice(0,5) || "",
    tempo_ifr: decimalToHHMM(entry?.tempo_ifr), tempo_voo: decimalToHHMM(entry?.tempo_voo),
    tempo_total: decimalToHHMM(entry?.tempo_total), horas_diurnas: decimalToHHMM(entry?.horas_diurnas),
    horas_noturnas: decimalToHHMM(entry?.horas_noturnas), pousos_total: String(entry?.pousos_total ?? 1),
    distancia_nm: String(entry?.distancia_nm ?? ""), litros_combustivel_inicio_voo: String(entry?.litros_combustivel_inicio_voo ?? ""),
    litros_combustivel_abastecido: String(entry?.litros_combustivel_abastecido ?? ""), local_combustivel: entry?.local_combustivel || "",
    celula: decimalToHHMM(entry?.celula ?? celula), diarias: String(entry?.diarias ?? "0"), passageiros: String(entry?.passageiros ?? 0),
    carga_kg: entry?.carga_kg || "", ocorrencias: entry?.ocorrencias || "", discrepancias: entry?.discrepancias || "", acoes_corretivas: entry?.acoes_corretivas || "",
    abastecimento_litros: "", abastecimento_data: date, abastecimento_cliente_id: "", abastecimento_socio_id: "", abastecimento_local: "",
    abastecimento_numero_comanda: "", abastecimento_numero_nf: "", abastecimento_auto_trecho: true,
  };
}

export default function DiarioLancamentoForm({ aeronaveId, diarioMesId, opcoes, initialData, sugeridaCelula, sugestaoTrecho, temDiaria, onSubmit, onCancel, saving }: {
  aeronaveId: string; diarioMesId: string; opcoes: DiarioOpcoesResponse; initialData?: DiarioLancamento | null; sugeridaCelula: number;
  sugestaoTrecho?: string; temDiaria?: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onCancel: () => void; saving: boolean;
}) {
  const today = new Date().toISOString().slice(0,10);
  const [form,setForm] = useState<FormValues>(() => formFromEntry(initialData,today,sugeridaCelula,sugestaoTrecho));
  const [error,setError] = useState<string|null>(null);
  const [voos,setVoos] = useState<Array<any>>([]);
  const [jornadaSelecionada,setJornadaSelecionada] = useState(String(initialData?.jornada_id || ""));
  const [pernaSelecionada,setPernaSelecionada] = useState(String(initialData?.perna_jornada_id || ""));
  const setField=(key:string,value:string|boolean)=>setForm(current=>({...current,[key]:value}));
  const value=(key:string)=>String(form[key] ?? "");

  useEffect(()=>{ setForm(formFromEntry(initialData,today,sugeridaCelula,sugestaoTrecho)); setJornadaSelecionada(String(initialData?.jornada_id||"")); setPernaSelecionada(String(initialData?.perna_jornada_id||"")); setError(null); },[initialData,diarioMesId,sugeridaCelula,sugestaoTrecho]);
  useEffect(()=>{ void buscarNumerosVooAeronave(aeronaveId).then(r=>setVoos(r.voos||[])).catch(()=>setVoos([])); },[aeronaveId]);

  const tripulacao=useMemo(()=>opcoes.tripulantes.filter(i=>i.origem==="tripulacao"),[opcoes.tripulantes]);
  const clientesSocios=useMemo(()=>opcoes.socios.filter(i=>value("holding_id") ? i.holding_id===value("holding_id") : !value("cliente_id") || i.cliente_id===value("cliente_id")),[opcoes.socios,form.cliente_id,form.holding_id]);
  const vooSelecionado=voos.find(i=>i.numero_voo===value("numero_voo"));
  const jornadas=(vooSelecionado?.jornadas||[]) as NumeroVooJornada[];
  const jornada=jornadas.find(i=>i.jornada_id===(jornadaSelecionada||value("jornada_id")));
  const pernas=(jornada?.pernas||[]) as NumeroVooPerna[];
  const pernasDisponiveis=pernas.filter(i=>!i.lancamento_diario_id || i.perna_id===pernaSelecionada);

  const recalculate=(next:FormValues)=>{
    const voo=durationBetween(String(next.tempo_dep||""),String(next.tempo_pou||""));
    const total=durationBetween(String(next.tempo_ac||""),String(next.tempo_cor||next.tempo_pou||""));
    setForm(current=>({...current,...next,tempo_voo:voo?minutesToHHMM(voo):String(next.tempo_voo||""),tempo_total:total?minutesToHHMM(total):String(next.tempo_total||""),horas_diurnas:voo?minutesToHHMM(voo):String(next.horas_diurnas||""),horas_noturnas:voo?"00:00":String(next.horas_noturnas||"")}));
  };
  const aplicarVoo=(numero:string)=>{
    const voo=voos.find(i=>i.numero_voo===numero); if(!voo)return;
    setForm(current=>({...current,numero_voo:voo.numero_voo||"",cliente_id:voo.cliente_id||"",socio_id:voo.socio_id||"",voo_emprestado:Boolean(voo.voo_emprestado==="sim"||voo.voo_emprestado===1||voo.voo_emprestado===true),cliente_tomador_emprestimo_id:voo.cliente_emprestimo_id||"",socio_tomador_emprestimo_id:voo.socio_emprestimo_id||"",pic_canac:voo.pic_canac||"",sic_canac:voo.sic_canac||"",jornada_id:"",perna_jornada_id:"",aerodromo_partida:voo.origem||"",aerodromo_chegada:voo.destino||"",trecho:voo.origem&&voo.destino ? voo.origem+" X "+voo.destino : ""}));
    setJornadaSelecionada(""); setPernaSelecionada("");
  };
  const aplicarPerna=(id:string)=>{
    const item=pernasDisponiveis.find(i=>i.perna_id===id); if(!item)return;
    const hh=(iso:string|null)=>iso?iso.slice(11,16):"";
    const voo=durationBetween(hh(item.horario_dep),hh(item.horario_pouso));
    const total=durationBetween(hh(item.horario_ac),hh(item.horario_corte||item.horario_pouso));
    setJornadaSelecionada(jornadaSelecionada); setPernaSelecionada(id);
    setForm(current=>({...current,perna_jornada_id:id,jornada_id:jornadaSelecionada,aerodromo_partida:item.origem,aerodromo_chegada:item.destino,trecho:item.origem+" X "+item.destino,tempo_ac:hh(item.horario_ac),tempo_dep:hh(item.horario_dep),tempo_pou:hh(item.horario_pouso),tempo_cor:hh(item.horario_corte),tempo_voo:minutesToHHMM(voo),tempo_total:minutesToHHMM(total||voo),horas_diurnas:minutesToHHMM(voo),horas_noturnas:"00:00",pousos_total:item.horario_pouso?"1":"0",distancia_nm:String(item.distancia_nm||0),passageiros:String(item.numero_passageiros??0),data_registro:(item.horario_ac||jornada?.data||"").slice(0,10)}));
  };

  const submit=async()=>{
    setError(null);
    if(!value("data_registro")||!value("aerodromo_partida")||!value("aerodromo_chegada")||!value("pic_canac")||!value("natureza_voo")){setError("Informe data, origem, destino, PIC e natureza do voo.");return;}
    const duration=(k:string)=>hhmmToDecimal(value(k)); const number=(k:string)=>value(k)===""?0:Number(value(k));
    const payload:Record<string,unknown>={
      diario_mes_id:diarioMesId,aeronave_id:aeronaveId,data_registro:value("data_registro"),numero_voo:value("numero_voo")||null,jornada_id:value("jornada_id")||null,perna_jornada_id:value("perna_jornada_id")||null,natureza_voo:value("natureza_voo"),
      aerodromo_partida:value("aerodromo_partida").toUpperCase(),aerodromo_chegada:value("aerodromo_chegada").toUpperCase(),trecho:value("trecho")||null,
      pic_canac:value("pic_canac").toUpperCase(),pic_nome:tripulacao.find(i=>i.canac?.toUpperCase()===value("pic_canac").toUpperCase())?.nome_completo||null,
      sic_canac:value("sic_canac").toUpperCase()||null,sic_nome:tripulacao.find(i=>i.canac?.toUpperCase()===value("sic_canac").toUpperCase())?.nome_completo||null,
      cliente_id:value("holding_id")?null:value("cliente_id")||null,holding_id:value("holding_id")||null,socio_id:value("socio_id")||null,
      voo_emprestado:Boolean(form.voo_emprestado),cliente_tomador_emprestimo_id:value("cliente_tomador_emprestimo_id")||null,socio_tomador_emprestimo_id:value("socio_tomador_emprestimo_id")||null,
      tripulacao_checkin_hora:value("tripulacao_checkin_hora")||null,tempo_ac:value("tempo_ac")||null,tempo_dep:value("tempo_dep")||null,tempo_pou:value("tempo_pou")||null,tempo_cor:value("tempo_cor")||null,
      tempo_ifr:duration("tempo_ifr"),tempo_voo:duration("tempo_voo"),tempo_total:duration("tempo_total")||duration("tempo_voo"),horas_diurnas:duration("horas_diurnas")||duration("tempo_voo"),horas_noturnas:duration("horas_noturnas"),
      pousos_total:number("pousos_total"),distancia_nm:number("distancia_nm"),litros_combustivel_inicio_voo:number("litros_combustivel_inicio_voo"),litros_combustivel_abastecido:number("litros_combustivel_abastecido"),
      local_combustivel:value("local_combustivel")||null,celula:duration("celula"),diarias:temDiaria?number("diarias"):null,passageiros:number("passageiros"),carga_kg:value("carga_kg")||null,
      ocorrencias:value("ocorrencias")||null,discrepancias:value("discrepancias")||null,acoes_corretivas:value("acoes_corretivas")||null,
      abastecimento:number("abastecimento_litros")>0?{litros:number("abastecimento_litros"),data:value("abastecimento_data")||value("data_registro"),cliente_id:value("abastecimento_cliente_id")||null,socio_id:value("abastecimento_socio_id")||null,local:value("abastecimento_local")||value("local_combustivel")||value("aerodromo_partida"),trecho:Boolean(form.abastecimento_auto_trecho)?value("aerodromo_partida").toUpperCase()+" X "+value("aerodromo_chegada").toUpperCase():value("trecho"),numero_comanda:value("abastecimento_numero_comanda")||null,numero_nf:value("abastecimento_numero_nf")||null}:null,
    };
    if(Object.entries(payload).some(([_,v])=>typeof v==="number"&&!Number.isFinite(v as number))){setError("Revise os campos numéricos.");return;}
    await onSubmit(payload);
  };

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-3 py-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5"><span className="rounded-xl bg-primary/10 p-2 text-primary"><BookOpen size={16}/></span><div className="min-w-0"><h2 className="truncate text-sm font-bold">{initialData?"Editar lançamento":"Novo lançamento de voo"}</h2><p className="text-[10px] text-muted-foreground">Horas e durações sempre em HH:MM</p></div></div>
      <button type="button" onClick={onCancel} className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"><X size={16}/></button>
    </header>
    <div className="space-y-4 p-3 sm:p-5">
      {error&&<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">{error}</div>}
      <Section icon={<PlaneTakeoff size={14}/>} title="Voo e rota" hint="Escolha o voo e a perna para preencher automaticamente."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Data *"><input type="date" value={value("data_registro")} onChange={e=>setField("data_registro",e.target.value)} className="campo h-11"/></Field>
        <Field label="Número do voo"><select value={value("numero_voo")} onChange={e=>aplicarVoo(e.target.value)} className="campo h-11"><option value="">Selecionar voo</option>{voos.map(i=><option key={i.solicitacao_id} value={i.numero_voo}>{i.numero_voo}{i.data_agendada?" · "+i.data_agendada.slice(0,10):""}</option>)}</select></Field>
        <Field label="Jornada"><select value={jornadaSelecionada} onChange={e=>{setJornadaSelecionada(e.target.value);setPernaSelecionada("");setField("jornada_id",e.target.value);setField("perna_jornada_id","");}} className="campo h-11"><option value="">Selecionar jornada</option>{jornadas.map(i=><option key={i.jornada_id} value={i.jornada_id}>Jornada {i.numero_jornada} · {i.data} · {i.status}</option>)}</select></Field>
        <Field label="Perna"><select value={pernaSelecionada} onChange={e=>aplicarPerna(e.target.value)} className="campo h-11"><option value="">Selecionar perna</option>{pernasDisponiveis.map(i=><option key={i.perna_id} value={i.perna_id}>{i.numero}. {i.origem} → {i.destino}{i.lancamento_diario_id?" · já lançada":""}</option>)}</select></Field>
        <Field label="Natureza *"><select value={value("natureza_voo")} onChange={e=>setField("natureza_voo",e.target.value)} className="campo h-11">{naturezas.map(i=><option key={i}>{i}</option>)}</select></Field>
        <Field label="Origem ICAO *"><input value={value("aerodromo_partida")} onChange={e=>setField("aerodromo_partida",e.target.value.toUpperCase())} maxLength={4} placeholder="SBSP" className="campo h-11 font-mono uppercase"/></Field>
        <Field label="Destino ICAO *"><input value={value("aerodromo_chegada")} onChange={e=>setField("aerodromo_chegada",e.target.value.toUpperCase())} maxLength={4} placeholder="SBGR" className="campo h-11 font-mono uppercase"/></Field>
        <Field label="Trecho"><input value={value("trecho")} onChange={e=>setField("trecho",e.target.value.toUpperCase())} placeholder="SBSP X SBGR" className="campo h-11 font-mono uppercase"/></Field>
      </div></Section>
      <Section icon={<Users size={14}/>} title="Tripulação e cliente"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="PIC *"><select value={value("pic_canac")} onChange={e=>setField("pic_canac",e.target.value)} className="campo h-11"><option value="">Selecionar PIC</option>{tripulacao.map(i=><option key={i.id} value={i.canac}>{i.nome_completo} · {i.canac}</option>)}</select></Field>
        <Field label="SIC"><select value={value("sic_canac")} onChange={e=>setField("sic_canac",e.target.value)} className="campo h-11"><option value="">Sem SIC</option>{tripulacao.map(i=><option key={i.id} value={i.canac}>{i.nome_completo} · {i.canac}</option>)}</select></Field>
        <Field label="Cliente"><select value={value("cliente_id")} onChange={e=>{setField("cliente_id",e.target.value);setField("holding_id","");setField("socio_id","");}} className="campo h-11"><option value="">Nenhum cliente</option>{opcoes.clientes.map(i=><option key={i.id} value={i.id}>{i.nome||i.proprietario||"Sem nome"}{i.codigo_cliente?" · "+i.codigo_cliente:""}</option>)}</select></Field>
        <Field label="Holding"><select value={value("holding_id")} onChange={e=>{setField("holding_id",e.target.value);setField("cliente_id","");setField("socio_id","");}} className="campo h-11"><option value="">Nenhuma holding</option>{opcoes.holdings.map(i=><option key={i.id} value={i.id}>{i.nome||i.proprietario}</option>)}</select></Field>
        <Field label="Sócio"><select value={value("socio_id")} onChange={e=>setField("socio_id",e.target.value)} className="campo h-11"><option value="">Nenhum sócio</option>{clientesSocios.map(i=><option key={i.id} value={i.id}>{i.nome}</option>)}</select></Field>
        <Field label="Passageiros"><input type="number" min="0" inputMode="numeric" value={value("passageiros")} onChange={e=>setField("passageiros",e.target.value)} className="campo h-11"/></Field>
        <Field label="Carga (kg)"><input inputMode="decimal" value={value("carga_kg")} onChange={e=>setField("carga_kg",e.target.value)} className="campo h-11"/></Field>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-xs font-medium"><input type="checkbox" checked={Boolean(form.voo_emprestado)} onChange={e=>setField("voo_emprestado",e.target.checked)} className="h-4 w-4 accent-primary"/>Voo emprestado</label>
      </div>{Boolean(form.voo_emprestado)&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Cliente tomador"><select value={value("cliente_tomador_emprestimo_id")} onChange={e=>setField("cliente_tomador_emprestimo_id",e.target.value)} className="campo h-11"><option value="">Selecionar</option>{opcoes.clientes.map(i=><option key={i.id} value={i.id}>{i.nome||i.proprietario||"Sem nome"}</option>)}</select></Field>
        <Field label="Sócio tomador"><select value={value("socio_tomador_emprestimo_id")} onChange={e=>setField("socio_tomador_emprestimo_id",e.target.value)} className="campo h-11"><option value="">Selecionar</option>{opcoes.socios.map(i=><option key={i.id} value={i.id}>{i.nome}</option>)}</select></Field>
      </div>}</Section>
      <Section icon={<Calculator size={14}/>} title="Tempos de voo" hint="AC, DEP, POU e COR são horários. As durações são HH:MM."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TimeField label="AC — acionamento" value={value("tempo_ac")} onChange={v=>recalculate({...form,tempo_ac:v})}/>
        <TimeField label="DEP — decolagem" value={value("tempo_dep")} onChange={v=>recalculate({...form,tempo_dep:v})}/>
        <TimeField label="POU — pouso" value={value("tempo_pou")} onChange={v=>recalculate({...form,tempo_pou:v})}/>
        <TimeField label="COR — corte" value={value("tempo_cor")} onChange={v=>recalculate({...form,tempo_cor:v})}/>
      </div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DurationField label="Tempo de voo" value={value("tempo_voo")} onChange={v=>setField("tempo_voo",normalizeDuration(v))} calculated/>
        <DurationField label="Tempo total" value={value("tempo_total")} onChange={v=>setField("tempo_total",normalizeDuration(v))} calculated/>
        <DurationField label="Horas diurnas" value={value("horas_diurnas")} onChange={v=>setField("horas_diurnas",normalizeDuration(v))}/>
        <DurationField label="Horas noturnas" value={value("horas_noturnas")} onChange={v=>setField("horas_noturnas",normalizeDuration(v))}/>
        <DurationField label="Tempo IFR" value={value("tempo_ifr")} onChange={v=>setField("tempo_ifr",normalizeDuration(v))}/>
      </div><div className="mt-3 flex flex-wrap gap-2"><Quick label="Voo" value={value("tempo_voo")}/><Quick label="Total" value={value("tempo_total")}/><span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] text-primary"><Sparkles size={11}/>Sem decimal</span></div></Section>
      <Section icon={<BookOpen size={14}/>} title="Célula e operação"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DurationField label="Célula após voo" value={value("celula")} onChange={v=>setField("celula",normalizeDuration(v))}/>
        <Field label="Pousos"><input type="number" min="0" inputMode="numeric" value={value("pousos_total")} onChange={e=>setField("pousos_total",e.target.value)} className="campo h-11"/></Field>
        <Field label="Distância (NM)"><input type="number" min="0" inputMode="numeric" value={value("distancia_nm")} onChange={e=>setField("distancia_nm",e.target.value)} className="campo h-11"/></Field>
        {temDiaria&&<Field label="Diárias"><input type="number" min="0" inputMode="numeric" value={value("diarias")} onChange={e=>setField("diarias",e.target.value)} className="campo h-11"/></Field>}
      </div></Section>
      <Section icon={<Fuel size={14}/>} title="Combustível"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Litros no início"><input type="number" min="0" step="0.01" inputMode="decimal" value={value("litros_combustivel_inicio_voo")} onChange={e=>setField("litros_combustivel_inicio_voo",e.target.value)} className="campo h-11"/></Field>
        <Field label="Litros abastecidos"><input type="number" min="0" step="0.01" inputMode="decimal" value={value("litros_combustivel_abastecido")} onChange={e=>setField("litros_combustivel_abastecido",e.target.value)} className="campo h-11"/></Field>
        <Field label="Local"><input value={value("local_combustivel")} onChange={e=>setField("local_combustivel",e.target.value.toUpperCase())} className="campo h-11" placeholder="ICAO / fornecedor"/></Field>
        <Field label="Novo abastecimento (L)"><input type="number" min="0" step="0.01" inputMode="decimal" value={value("abastecimento_litros")} onChange={e=>setField("abastecimento_litros",e.target.value)} className="campo h-11"/></Field>
      </div>{Number(value("abastecimento_litros"))>0&&<div className="mt-3 grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Data"><input type="date" value={value("abastecimento_data")} onChange={e=>setField("abastecimento_data",e.target.value)} className="campo h-11"/></Field>
        <Field label="Cliente pagador"><select value={value("abastecimento_cliente_id")} onChange={e=>{setField("abastecimento_cliente_id",e.target.value);setField("abastecimento_socio_id","");}} className="campo h-11"><option value="">Nenhum</option>{opcoes.clientes.map(i=><option key={i.id} value={i.id}>{i.nome||i.proprietario||"Sem nome"}</option>)}</select></Field>
        <Field label="Sócio pagador"><select value={value("abastecimento_socio_id")} onChange={e=>{setField("abastecimento_socio_id",e.target.value);setField("abastecimento_cliente_id","");}} className="campo h-11"><option value="">Nenhum</option>{opcoes.socios.map(i=><option key={i.id} value={i.id}>{i.nome}</option>)}</select></Field>
        <Field label="Local do abastecimento"><input value={value("abastecimento_local")} onChange={e=>setField("abastecimento_local",e.target.value.toUpperCase())} className="campo h-11"/></Field>
        <Field label="Comanda"><input value={value("abastecimento_numero_comanda")} onChange={e=>setField("abastecimento_numero_comanda",e.target.value)} className="campo h-11"/></Field>
        <Field label="Nota fiscal"><input value={value("abastecimento_numero_nf")} onChange={e=>setField("abastecimento_numero_nf",e.target.value)} className="campo h-11"/></Field>
      </div>}</Section>
      <Section icon={<Sparkles size={14}/>} title="Ocorrências e observações"><div className="grid gap-3 lg:grid-cols-3"><TextField label="Ocorrências" value={value("ocorrencias")} onChange={v=>setField("ocorrencias",v)}/><TextField label="Discrepâncias" value={value("discrepancias")} onChange={v=>setField("discrepancias",v)}/><TextField label="Ações corretivas" value={value("acoes_corretivas")} onChange={v=>setField("acoes_corretivas",v)}/></div></Section>
    </div>
    <footer className="sticky bottom-0 z-20 flex gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:justify-end sm:px-5"><Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1 sm:flex-none">Cancelar</Button><Button type="button" disabled={saving} onClick={()=>void submit()} className="h-11 flex-1 gap-2 sm:flex-none"><Save size={15}/>{saving?"Salvando...":initialData?"Atualizar lançamento":"Registrar lançamento"}</Button></footer>
  </section>;
}
function Section({icon,title,hint,children}:{icon:ReactNode;title:string;hint?:string;children:ReactNode}){return <section className="rounded-2xl border border-border bg-muted/10 p-3 sm:p-4"><div className="mb-4 flex items-start gap-2"><span className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary">{icon}</span><div><h3 className="text-xs font-extrabold uppercase tracking-[.12em]">{title}</h3>{hint&&<p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}</div></div>{children}</section>;}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="block min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</span>{children}</label>;}
function TimeField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <Field label={label}><input type="time" value={value} onChange={e=>onChange(e.target.value)} className="campo h-11 font-mono text-base"/></Field>;}
function DurationField({label,value,onChange,calculated}:{label:string;value:string;onChange:(value:string)=>void;calculated?:boolean}){return <Field label={label}><div className="relative"><input value={value} inputMode="numeric" onChange={e=>onChange(e.target.value)} onBlur={e=>onChange(normalizeDuration(e.target.value))} placeholder="00:00" className="campo h-11 pr-14 font-mono text-base"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{calculated?"auto":"HH:MM"}</span></div></Field>;}
function Quick({label,value}:{label:string;value:string}){return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px]"><Check size={10} className="text-emerald-500"/>{label} {value||"00:00"}</span>;}
function TextField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <Field label={label}><textarea value={value} onChange={e=>onChange(e.target.value)} className="campo min-h-24 resize-y" placeholder="Sem registro"/></Field>;}
