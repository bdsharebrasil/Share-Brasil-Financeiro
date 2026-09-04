import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ImageOff, Loader2, Plane, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarAeronavesShare, buscarAeronaveShare, criarAeronaveShare, type AeronavePayload, type AeronaveShare } from "@/lib/colaborador-api";
import { CabecalhoSecao, EstadoVazio } from "@/components/dashboard/PrimitivosDashboard";

const camposCadastro: Array<[keyof AeronavePayload, string, string]> = [
  ["matricula_registro", "Matrícula de registro", "PR-XXX"],
  ["fabricante", "Fabricante", "Cirrus"],
  ["modelo", "Modelo", "SR20"],
  ["numero_serie", "Número de série", "Opcional"],
  ["nome_proprietario", "Proprietário", "Nome ou empresa"],
  ["tipo_aeronave", "Tipo de aeronave", "Monomotor"],
  ["ano", "Ano", "2024"],
  ["base", "Base", "SBSP"],
  ["numero_motores", "Motores", "1"],
  ["consumo_combustivel", "Consumo de combustível", "L/h"],
  ["velocidade_cruzeiro", "Velocidade de cruzeiro", "kt"],
  ["preco_hora", "Preço hora", "R$"],
  ["url_imagem", "URL da foto", "https://..."],
  ["performance_categoria", "Categoria performance", "Normal / Utility"],
  ["performance_teto_servico_ft", "Teto de serviço", "ft"],
  ["performance_nivel_cruzeiro_min_ft", "Nível cruzeiro mínimo", "ft"],
  ["performance_nivel_cruzeiro_max_ft", "Nível cruzeiro máximo", "ft"],
  ["performance_velocidade_cruzeiro_kt", "Performance — velocidade", "kt"],
  ["performance_taxa_subida_fpm", "Taxa de subida", "fpm"],
  ["performance_taxa_descida_fpm", "Taxa de descida", "fpm"],
];

function valorAeronave(aeronave: AeronaveShare, chave: string) {
  const valor = aeronave[chave as keyof AeronaveShare];
  return valor === null || valor === undefined || valor === "" ? "Não informado" : String(valor);
}

function moeda(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero) : "Não informado";
}

export default function AeronavesShareBrasil() {
  const [ativas, setAtivas] = useState<AeronaveShare[]>([]);
  const [inativas, setInativas] = useState<AeronaveShare[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<AeronaveShare | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ status: "ativa" });

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [ativasResponse, inativasResponse] = await Promise.all([buscarAeronavesShare("ativa"), buscarAeronavesShare("inativa")]);
      setAtivas(ativasResponse.aeronaves || []);
      setInativas(inativasResponse.aeronaves || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as aeronaves.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const abrirDetalhe = async (aeronave: AeronaveShare) => {
    try {
      const response = await buscarAeronaveShare(aeronave.id);
      setSelecionada(response.aeronave);
    } catch {
      setSelecionada(aeronave);
      toast.error("Não foi possível atualizar o detalhe; exibindo os dados da listagem.");
    }
  };

  const atualizarCampo = (campo: string, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const abrirNova = () => { setForm({ status: "ativa" }); setNovaAberta(true); };
  const salvar = async () => {
    if (!form.matricula_registro || !form.fabricante || !form.modelo) { toast.error("Matrícula, fabricante e modelo são obrigatórios."); return; }
    setSalvando(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const campo of ["ano", "numero_motores", "consumo_combustivel", "velocidade_cruzeiro", "preco_hora", "performance_teto_servico_ft", "performance_nivel_cruzeiro_min_ft", "performance_nivel_cruzeiro_max_ft", "performance_velocidade_cruzeiro_kt", "performance_taxa_subida_fpm", "performance_taxa_descida_fpm"]) if (payload[campo] !== undefined && payload[campo] !== "") payload[campo] = Number(payload[campo]);
      payload.aprovado_rvsm = form.aprovado_rvsm === "true";
      await criarAeronaveShare(payload as AeronavePayload);
      setNovaAberta(false);
      toast.success("Aeronave cadastrada com sucesso.");
      await carregar(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a aeronave.");
    } finally { setSalvando(false); }
  };

  const total = useMemo(() => ativas.length + inativas.length, [ativas.length, inativas.length]);
  const renderCards = (lista: AeronaveShare[], vazia: string) => lista.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{lista.map((aeronave) => <button key={aeronave.id} type="button" onClick={() => void abrirDetalhe(aeronave)} className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/60"><div className="relative aspect-[1.55] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-primary/30">{aeronave.url_imagem ? <img src={aeronave.url_imagem} alt={`${aeronave.matricula_registro} — ${aeronave.fabricante} ${aeronave.modelo}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full items-center justify-center text-primary/70"><Plane size={64} strokeWidth={1.2} /></div>}<div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" /><span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white backdrop-blur">{aeronave.status || "ATIVA"}</span><div className="absolute inset-x-4 bottom-4"><p className="text-2xl font-black tracking-tight text-white">{aeronave.matricula_registro}</p><p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[.08em] text-slate-300">{aeronave.fabricante} {aeronave.modelo}</p></div></div><div className="grid grid-cols-3 gap-2 p-4"><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Base</p><p className="mt-1 truncate text-xs font-bold">{aeronave.base || "—"}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Ano</p><p className="mt-1 text-xs font-bold">{aeronave.ano || "—"}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Performance</p><p className="mt-1 text-xs font-bold">{aeronave.performance_velocidade_cruzeiro_kt ? `${aeronave.performance_velocidade_cruzeiro_kt} kt` : "—"}</p></div></div></button>)}</div> : <EstadoVazio label={vazia} />;

  if (carregando) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  return <div className="route-enter space-y-5"><header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-sm md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary"><Plane size={14} /> Frota Share Brasil</div><h1 className="text-2xl font-extrabold tracking-tight">Aeronaves</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">Cadastro, performance e histórico da frota em uma única operação.</p></div><div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-10 gap-2 text-xs"><RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button><Button type="button" onClick={abrirNova} className="h-10 gap-2 text-xs"><Plus size={15} /> Nova aeronave</Button></div></header>{erro && <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500"><span>{erro}</span><Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 text-[10px]">Tentar novamente</Button></div>}<CabecalhoSecao icon={<Plane size={15} />} title="Frota cadastrada" detail={`${total} aeronave(s) no cadastro · clique em um card para abrir todos os dados`} /><Tabs defaultValue="ativas" className="space-y-4"><TabsList className="bg-card/80"><TabsTrigger value="ativas">Ativas <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 text-[9px] text-emerald-400">{ativas.length}</span></TabsTrigger><TabsTrigger value="inativas">Inativas <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 text-[9px] text-amber-300">{inativas.length}</span></TabsTrigger></TabsList><TabsContent value="ativas">{renderCards(ativas, "Nenhuma aeronave ativa cadastrada.")}</TabsContent><TabsContent value="inativas">{renderCards(inativas, "Nenhuma aeronave inativa cadastrada.")}</TabsContent></Tabs>

    <Dialog open={Boolean(selecionada)} onOpenChange={(aberta) => !aberta && setSelecionada(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><Plane size={18} className="text-primary" /> {selecionada?.matricula_registro} · {selecionada?.fabricante} {selecionada?.modelo}</DialogTitle><DialogDescription>Dados completos do cadastro da aeronave e sua ficha de performance.</DialogDescription></DialogHeader>{selecionada && <div className="space-y-5">{selecionada.url_imagem && <img src={selecionada.url_imagem} alt={selecionada.matricula_registro} className="max-h-64 w-full rounded-xl object-cover" />}<DetailGroup title="Cadastro" items={[["Status", valorAeronave(selecionada, "status")], ["Matrícula", valorAeronave(selecionada, "matricula_registro")], ["Fabricante", valorAeronave(selecionada, "fabricante")], ["Modelo", valorAeronave(selecionada, "modelo")], ["Número de série", valorAeronave(selecionada, "numero_serie")], ["Proprietário", valorAeronave(selecionada, "nome_proprietario")], ["Tipo", valorAeronave(selecionada, "tipo_aeronave")], ["Ano", valorAeronave(selecionada, "ano")], ["Base", valorAeronave(selecionada, "base")], ["Motores", valorAeronave(selecionada, "numero_motores")], ["Consumo", valorAeronave(selecionada, "consumo_combustivel")], ["Velocidade de cruzeiro", valorAeronave(selecionada, "velocidade_cruzeiro")], ["Preço por hora", moeda(selecionada.preco_hora)]]} /><DetailGroup title="Performance" items={[["Categoria", valorAeronave(selecionada, "performance_categoria")], ["Modelo performance", valorAeronave(selecionada, "performance_modelo")], ["Teto de serviço", valorAeronave(selecionada, "performance_teto_servico_ft")], ["Nível cruzeiro mínimo", valorAeronave(selecionada, "performance_nivel_cruzeiro_min_ft")], ["Nível cruzeiro máximo", valorAeronave(selecionada, "performance_nivel_cruzeiro_max_ft")], ["RVSM aprovado", Number(selecionada.performance_aprovado_rvsm) ? "Sim" : "Não informado"], ["Velocidade performance", valorAeronave(selecionada, "performance_velocidade_cruzeiro_kt")], ["Taxa de subida", valorAeronave(selecionada, "performance_taxa_subida_fpm")], ["Taxa de descida", valorAeronave(selecionada, "performance_taxa_descida_fpm")]]} /></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setSelecionada(null)}>Fechar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={novaAberta} onOpenChange={setNovaAberta}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Nova aeronave</DialogTitle><DialogDescription>Cadastre os dados principais e a ficha de performance. A foto pode ser informada por URL.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2">{camposCadastro.map(([campo, label, placeholder]) => <div key={String(campo)} className="space-y-1.5"><Label className="text-[10px]">{label}</Label><Input type={["ano", "numero_motores", "consumo_combustivel", "velocidade_cruzeiro", "preco_hora", "performance_teto_servico_ft", "performance_nivel_cruzeiro_min_ft", "performance_nivel_cruzeiro_max_ft", "performance_velocidade_cruzeiro_kt", "performance_taxa_subida_fpm", "performance_taxa_descida_fpm"].includes(String(campo)) ? "number" : "text"} value={form[String(campo)] || ""} onChange={(event) => atualizarCampo(String(campo), event.target.value)} placeholder={placeholder} className="h-9 text-xs" /></div>)}<div className="space-y-1.5"><Label className="text-[10px]">Status</Label><select value={form.status || "ativa"} onChange={(event) => atualizarCampo("status", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></div><div className="space-y-1.5"><Label className="text-[10px]">RVSM aprovado</Label><select value={form.aprovado_rvsm || "false"} onChange={(event) => atualizarCampo("aprovado_rvsm", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="false">Não informado</option><option value="true">Sim</option></select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setNovaAberta(false)} disabled={salvando}>Cancelar</Button><Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">{salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar aeronave</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function DetailGroup({ title, items }: { title: string; items: Array<[string, string]> }) { return <section><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary">{title}</h3><div className="grid gap-2 sm:grid-cols-3">{items.map(([label, value]) => <div key={label} className="rounded-lg border border-border/70 bg-muted/20 p-3"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value}</p></div>)}</div></section>; }
