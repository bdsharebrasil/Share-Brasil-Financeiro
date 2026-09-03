import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit, LayoutGrid, List, Mail, MapPin, Phone, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buscarContatosShare, criarContatoShare, excluirContatoShare, atualizarContatoShare, type ContatoAgenda } from "@/lib/colaborador-api";

const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";
const emptyForm = { nome: "", email: "", telefone: "", empresa: "", cargo: "", endereco: "", cidade: "", uf: "", categoria: "", observacoes: "" };
type ViewMode = "cards" | "lista";
type SortMode = "nome" | "cidade";

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase() || "").join("");
}

export default function Contatos() {
  const [contatos, setContatos] = useState<ContatoAgenda[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [busca, setBusca] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("nome");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContatoAgenda | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContatoAgenda | null>(null);
  const { toast } = useToast();

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setContatos(await buscarContatosShare());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar os contatos.";
      setError(message);
      setContatos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openForm(contato?: ContatoAgenda) {
    setEditing(contato || null);
    setForm(contato ? {
      nome: contato.nome || "", email: contato.email || "", telefone: contato.telefone || "", empresa: contato.empresa || "", cargo: contato.cargo || "",
      endereco: contato.endereco || "", cidade: contato.cidade || "", uf: contato.uf || "", categoria: contato.categoria || "", observacoes: contato.observacoes || "",
    } : { ...emptyForm });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do contato.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      if (editing) await atualizarContatoShare(editing.id, form);
      else await criarContatoShare(form);
      toast({ title: editing ? "Contato atualizado" : "Contato cadastrado", description: "As informações foram salvas no D1." });
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await excluirContatoShare(deleteTarget.id);
      toast({ title: "Contato excluído", description: `${deleteTarget.nome} foi removido da agenda.` });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast({ title: "Erro ao excluir", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    }
  }

  const filtered = useMemo(() => {
    const term = busca.toLocaleLowerCase("pt-BR");
    return contatos.filter((item) => [item.nome, item.email, item.telefone, item.empresa, item.cidade, item.categoria].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term))).sort((a, b) => {
      const first = sortMode === "cidade" ? (a.cidade || "") : a.nome;
      const second = sortMode === "cidade" ? (b.cidade || "") : b.nome;
      return first.localeCompare(second, "pt-BR");
    });
  }, [contatos, busca, sortMode]);

  return <div className="route-enter space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Share Brasil · Diretório</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Contatos</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">Uma agenda centralizada para pessoas, empresas e parceiros importantes.</p></div>
      <Button onClick={() => openForm()} className="h-10 gap-2 text-xs"><Plus size={15} /> Novo contato</Button>
    </div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, empresa, cidade, e-mail..." className={`${field} pl-9`} /></div>
      <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={`${field} px-3 text-xs lg:w-48`}><option value="nome">Ordenar por nome</option><option value="cidade">Ordenar por cidade</option></select>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-1"><button type="button" onClick={() => setViewMode("cards")} className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid size={14} /> Cards</button><button type="button" onClick={() => setViewMode("lista")} className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${viewMode === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List size={14} /> Lista</button></div>
    </div>

    {error && <Card className="border-red-400/30 bg-red-400/5"><CardContent className="flex items-center gap-3 p-4 text-xs text-red-300"><AlertCircle size={17} /><span className="flex-1">{error}</span><Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button></CardContent></Card>}
    {loading ? <div className="flex justify-center py-20 text-xs text-muted-foreground">Carregando contatos...</div> : filtered.length === 0 ? <Card className="border-dashed border-border/70 bg-card/40"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound size={26} /></div><h2 className="text-base font-bold">{busca ? "Nenhum contato encontrado" : "Sua agenda está vazia"}</h2><p className="mt-1 max-w-sm text-xs text-muted-foreground">{busca ? "Tente buscar por outro termo." : "Cadastre o primeiro contato para começar a organizar seu diretório."}</p>{!busca && <Button variant="outline" className="mt-4 gap-2 text-xs" onClick={() => openForm()}><Plus size={14} /> Cadastrar contato</Button>}</CardContent></Card> : viewMode === "cards" ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((contato) => <Card key={contato.id} className="group border-border/80 bg-card/60 transition-colors hover:border-primary/40"><CardContent className="space-y-4 p-5"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-blue-500/80 text-sm font-bold text-white">{iniciais(contato.nome)}</div><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{contato.nome}</h2><p className="truncate text-xs text-muted-foreground">{[contato.cargo, contato.empresa].filter(Boolean).join(" · ") || "Contato profissional"}</p>{contato.categoria && <span className="mt-2 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{contato.categoria}</span>}</div><div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(contato)}><Edit size={14} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-300" onClick={() => setDeleteTarget(contato)}><Trash2 size={14} /></Button></div></div><div className="space-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">{contato.telefone && <p className="flex items-center gap-2"><Phone size={14} className="text-primary" />{contato.telefone}</p>}{contato.email && <p className="flex items-center gap-2 truncate"><Mail size={14} className="shrink-0 text-primary" />{contato.email}</p>}{(contato.cidade || contato.uf) && <p className="flex items-center gap-2"><MapPin size={14} className="text-primary" />{[contato.cidade, contato.uf].filter(Boolean).join(", ")}</p>}</div></CardContent></Card>)}</div> : <Card className="overflow-hidden"><div className="divide-y divide-border/60">{filtered.map((contato) => <div key={contato.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex min-w-[220px] flex-1 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{iniciais(contato.nome)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{contato.nome}</p><p className="truncate text-xs text-muted-foreground">{[contato.cargo, contato.empresa].filter(Boolean).join(" · ") || "—"}</p></div></div><span className="text-xs text-muted-foreground">{contato.email || contato.telefone || contato.cidade || "—"}</span><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openForm(contato)}><Edit size={14} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-300" onClick={() => setDeleteTarget(contato)}><Trash2 size={14} /></Button></div>)}</div></Card>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle><DialogDescription>As informações serão gravadas no banco D1 do portal.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2">{([ ["nome", "Nome *"], ["empresa", "Empresa"], ["cargo", "Cargo"], ["telefone", "Telefone"], ["email", "E-mail"], ["categoria", "Categoria"], ["endereco", "Endereço"], ["cidade", "Cidade"], ["uf", "UF"] ] as const).map(([key, label]) => <div key={key} className={key === "endereco" ? "sm:col-span-2" : ""}><Label htmlFor={`contato-${key}`} className="mb-1.5 block text-xs text-muted-foreground">{label}</Label><Input id={`contato-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={field} /></div>)}<div className="sm:col-span-2"><Label htmlFor="contato-observacoes" className="mb-1.5 block text-xs text-muted-foreground">Observações</Label><Textarea id="contato-observacoes" value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} className="min-h-[90px] bg-background/70 text-sm" /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar contato"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir contato?</DialogTitle><DialogDescription>Esta ação removerá {deleteTarget?.nome || "este contato"} da agenda permanentemente.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="destructive" onClick={() => void remove()}>Excluir</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
