import { useState } from "react";
import { ArrowLeft, Pencil, Plane, Plus, Save, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CabecalhoSecao, EstadoVazio } from "@/components/dashboard/ComponentesDashboard";
import { atualizarTripulanteFreelancer, criarTripulanteFreelancer, excluirTripulanteFreelancer, type AeronaveTripulacao, type FreelancerTripulacao } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";
type Formulario = { nome_completo: string; canac: string; telefone: string; aeronave_id: string; observacao: string; status: string };
const vazio: Formulario = { nome_completo: "", canac: "", telefone: "", aeronave_id: "", observacao: "", status: "ativo" };

export default function GestaoTripulacaoExternos({ freelancers, aeronaves, onChanged, onError, onOk }: { freelancers: FreelancerTripulacao[]; aeronaves: AeronaveTripulacao[]; onChanged: () => void; onError: (message: string | null) => void; onOk: (message: string | null) => void }) {
  const [selecionado, setSelecionado] = useState<FreelancerTripulacao | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [emFormulario, setEmFormulario] = useState(false);

  const abrir = (item?: FreelancerTripulacao) => { setSelecionado(item || null); setFormulario(item ? { nome_completo: item.nome_completo || "", canac: item.canac || "", telefone: item.telefone || "", aeronave_id: item.aeronave_id || "", observacao: item.observacao || "", status: item.status || "ativo" } : { ...vazio }); setEmFormulario(true); onError(null); onOk(null); };
  const voltar = () => { setSelecionado(null); setEmFormulario(false); onError(null); };
  const salvar = async () => {
    if (!formulario.nome_completo.trim() || !formulario.canac.trim()) return onError("Informe nome e CANAC do tripulante externo.");
    setSalvando(true); onError(null);
    try {
      if (selecionado) await atualizarTripulanteFreelancer(selecionado.id, formulario);
      else await criarTripulanteFreelancer(formulario);
      onChanged(); onOk(selecionado ? "Tripulante externo atualizado." : "Tripulante externo cadastrado."); setSelecionado(null); setEmFormulario(false);
    } catch (e) { onError(e instanceof Error ? e.message : "Não foi possível salvar o tripulante externo."); } finally { setSalvando(false); }
  };
  const excluir = async () => {
    if (!selecionado || !window.confirm(`Excluir ${selecionado.nome_completo}? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true); onError(null);
    try { await excluirTripulanteFreelancer(selecionado.id); onChanged(); onOk("Tripulante externo excluído."); setSelecionado(null); setEmFormulario(false); }
    catch (e) { onError(e instanceof Error ? e.message : "Não foi possível excluir o tripulante externo."); } finally { setSalvando(false); }
  };
  const preencher = (campo: keyof Formulario, valor: string) => setFormulario((atual) => ({ ...atual, [campo]: valor }));

  if (emFormulario) return <section className={`${card} p-5`}><div className="mb-5 flex items-center justify-between gap-3"><CabecalhoSecao icon={<UserRound size={15} />} title={selecionado ? "Editar tripulante externo" : "Novo tripulante externo"} detail="Altere somente os dados deste tripulante e salve para voltar à lista." /><Button type="button" variant="outline" onClick={voltar} className="h-8 gap-2 text-[10px]"><ArrowLeft size={14} /> Voltar à lista</Button></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-[10px] font-bold text-muted-foreground">Nome completo<Input value={formulario.nome_completo} onChange={(e) => preencher("nome_completo", e.target.value)} className={field} /></label><label className="space-y-1 text-[10px] font-bold text-muted-foreground">CANAC<Input value={formulario.canac} onChange={(e) => preencher("canac", e.target.value)} className={field} /></label><label className="space-y-1 text-[10px] font-bold text-muted-foreground">Telefone<Input value={formulario.telefone} onChange={(e) => preencher("telefone", e.target.value)} className={field} /></label><label className="space-y-1 text-[10px] font-bold text-muted-foreground">Status<select value={formulario.status} onChange={(e) => preencher("status", e.target.value)} className={`${field} w-full px-3`}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label><label className="space-y-1 text-[10px] font-bold text-muted-foreground md:col-span-2">Aeronave contratada<select value={formulario.aeronave_id} onChange={(e) => preencher("aeronave_id", e.target.value)} className={`${field} w-full px-3`}><option value="">Nenhuma</option>{aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro} · {aeronave.fabricante} {aeronave.modelo}</option>)}</select></label><label className="space-y-1 text-[10px] font-bold text-muted-foreground md:col-span-2">Observação<Textarea value={formulario.observacao} onChange={(e) => preencher("observacao", e.target.value)} className="min-h-[110px] bg-background/70 text-sm" /></label></div><div className="mt-5 flex flex-wrap justify-between gap-2"><div>{selecionado && <Button type="button" variant="outline" onClick={() => void excluir()} disabled={salvando} className="gap-2 border-red-400/40 text-red-300 hover:bg-red-400/10"><Trash2 size={14} /> Excluir</Button>}</div><div className="flex gap-2"><Button type="button" variant="outline" onClick={voltar} disabled={salvando}>Cancelar</Button><Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2"><Save size={14} /> {salvando ? "Salvando..." : "Salvar"}</Button></div></div></section>;

  return <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between gap-3 border-b border-border/60 p-5"><CabecalhoSecao icon={<Plane size={15} />} title="Tripulantes externos" detail="Clique em um card para abrir somente os dados daquele tripulante." action={<Button type="button" onClick={() => abrir()} className="h-8 gap-2 text-[10px]"><Plus size={14} /> Novo cadastro</Button>} /></div>{freelancers.length ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{freelancers.map((item) => <button type="button" key={item.id} onClick={() => abrir(item)} className="group rounded-xl border border-border/70 bg-background/35 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/10 text-amber-300"><UserRound size={17} /></span><span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-300">{item.status === "inativo" ? "INATIVO" : "EXTERNO"}</span></div><p className="mt-4 truncate text-sm font-bold">{item.nome_completo}</p><p className="mt-1 text-[10px] text-muted-foreground">CANAC {item.canac} · {item.telefone || "Telefone não informado"}</p><p className="mt-3 flex items-center gap-1 text-[10px] text-primary"><Plane size={12} /> {item.matricula_registro ? `${item.matricula_registro} · ${item.fabricante || ""} ${item.modelo || ""}` : "Sem aeronave contratada"}</p><span className="mt-4 flex items-center gap-1 text-[10px] font-bold text-muted-foreground group-hover:text-primary"><Pencil size={12} /> Clique para editar</span></button>)}</div> : <div className="p-5"><EstadoVazio label="Nenhum tripulante externo cadastrado" /></div>}</section>;
}
