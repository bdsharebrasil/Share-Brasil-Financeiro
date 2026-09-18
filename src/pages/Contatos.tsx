import { useEffect, useMemo, useState } from "react";
import { 
  AlertCircle, Edit, LayoutGrid, List, Mail, MapPin, 
  Phone, Plus, Search, Trash2, UserRound, Briefcase 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  buscarContatosShare, criarContatoShare, excluirContatoShare, 
  atualizarContatoShare, type ContatoAgenda 
} from "@/lib/colaborador-api";

const field = "h-11 rounded-xl border-border bg-background shadow-sm text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary";
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
    return contatos.filter((item) => 
      [item.nome, item.email, item.telefone, item.empresa, item.cidade, item.categoria]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term))
    ).sort((a, b) => {
      const first = sortMode === "cidade" ? (a.cidade || "") : a.nome;
      const second = sortMode === "cidade" ? (b.cidade || "") : b.nome;
      return first.localeCompare(second, "pt-BR");
    });
  }, [contatos, busca, sortMode]);

  return (
    <div className="route-enter space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Share Brasil · Diretório</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl text-foreground">Contatos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sua agenda centralizada para organizar parceiros, clientes e empresas.
          </p>
        </div>
        <Button onClick={() => openForm()} className="h-10 gap-2 font-medium shadow-sm">
          <Plus size={16} /> Novo contato
        </Button>
      </div>

      {/* Barra de Ferramentas (Busca e Filtros) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center p-1 bg-muted/20 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
          <Input 
            value={busca} 
            onChange={(event) => setBusca(event.target.value)} 
            placeholder="Buscar por nome, empresa, e-mail..." 
            className="h-12 w-full rounded-xl border-none bg-transparent pl-11 text-sm shadow-none focus-visible:ring-0 focus-visible:bg-background/80" 
          />
        </div>
        
        <div className="flex items-center gap-2 px-2">
          <div className="h-6 w-px bg-border/60 hidden lg:block mr-2" />
          <select 
            value={sortMode} 
            onChange={(event) => setSortMode(event.target.value as SortMode)} 
            className="h-9 rounded-lg border-none bg-background/50 px-3 text-sm font-medium text-muted-foreground shadow-sm focus:ring-1 focus:ring-primary lg:w-48 cursor-pointer"
          >
            <option value="nome">Ordenar por nome</option>
            <option value="cidade">Ordenar por cidade</option>
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 p-1 shadow-sm">
            <button 
              type="button" 
              onClick={() => setViewMode("cards")} 
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${viewMode === "cards" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode("lista")} 
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${viewMode === "lista" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <List size={14} /> Lista
            </button>
          </div>
        </div>
      </div>

      {/* Estados: Erro, Carregamento ou Vazio */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="flex-1 font-medium">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()} className="bg-background">Tentar novamente</Button>
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary mb-4"></div>
          <p className="text-sm font-medium">Carregando seus contatos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound size={30} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-foreground">{busca ? "Nenhum contato encontrado" : "Sua agenda está vazia"}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {busca ? "Tente buscar por um nome, empresa ou cidade diferente." : "Cadastre o primeiro contato para começar a organizar seu diretório."}
          </p>
          {!busca && (
            <Button className="mt-6 gap-2 shadow-sm" onClick={() => openForm()}>
              <Plus size={16} /> Cadastrar contato
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        
        /* MODO CARDS */
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((contato) => (
            <Card key={contato.id} className="group overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/30">
              <CardContent className="p-0">
                {/* Cabeçalho do Card (Colorido) */}
                <div className="relative flex items-end p-5 pb-0">
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-sm text-muted-foreground" onClick={() => openForm(contato)}>
                      <Edit size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-red-500 hover:text-white shadow-sm text-red-500 transition-colors" onClick={() => setDeleteTarget(contato)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-500 text-lg font-bold text-white shadow-inner">
                    {iniciais(contato.nome)}
                  </div>
                </div>

                {/* Informações Principais */}
                <div className="p-5 pt-4">
                  <h2 className="truncate text-base font-bold text-foreground">{contato.nome}</h2>
                  
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Briefcase size={12} className="opacity-70" />
                    <span className="truncate">
                      {[contato.cargo, contato.empresa].filter(Boolean).join(" na ") || "Contato profissional"}
                    </span>
                  </div>
                  
                  {contato.categoria && (
                    <span className="mt-3 inline-block rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {contato.categoria}
                    </span>
                  )}
                </div>

                {/* Informações de Contato (Rodapé do Card) */}
                <div className="space-y-2.5 bg-muted/30 p-5 text-[13px] text-muted-foreground">
                  {contato.telefone && (
                    <p className="flex items-center gap-2.5">
                      <Phone size={14} className="text-primary/70" />
                      <span className="font-medium text-foreground/80">{contato.telefone}</span>
                    </p>
                  )}
                  {contato.email && (
                    <p className="flex items-center gap-2.5 truncate">
                      <Mail size={14} className="shrink-0 text-primary/70" />
                      <span className="truncate">{contato.email}</span>
                    </p>
                  )}
                  {(contato.cidade || contato.uf) && (
                    <p className="flex items-center gap-2.5">
                      <MapPin size={14} className="text-primary/70" />
                      <span>{[contato.cidade, contato.uf].filter(Boolean).join(", ")}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (

        /* MODO LISTA */
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="divide-y divide-border/40">
            {filtered.map((contato) => (
              <div key={contato.id} className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/20">
                <div className="flex min-w-[250px] flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary/20 to-blue-500/20 text-sm font-bold text-primary">
                    {iniciais(contato.nome)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{contato.nome}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {[contato.cargo, contato.empresa].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="hidden min-w-[200px] flex-col text-sm md:flex">
                  <span className="truncate font-medium text-foreground/80">{contato.email || "—"}</span>
                  <span className="text-xs text-muted-foreground">{contato.telefone || "—"}</span>
                </div>

                <div className="hidden min-w-[150px] md:flex">
                  {contato.cidade ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin size={12} className="text-primary/60" /> 
                      {contato.cidade}
                    </span>
                  ) : "—"}
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border/50 text-muted-foreground hover:bg-background" onClick={() => openForm(contato)}>
                    <Edit size={13} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-red-200 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-900/30" onClick={() => setDeleteTarget(contato)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DIALOG DE FORMULÁRIO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-2xl p-0">
          <div className="px-6 py-5 border-b border-border/60">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
              <DialogDescription className="text-xs mt-1">Preencha as informações do contato. Os dados são salvos no banco D1 do portal.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            {([ 
              ["nome", "Nome completo *", "text"], 
              ["empresa", "Empresa", "text"], 
              ["cargo", "Cargo / Função", "text"], 
              ["telefone", "Telefone", "tel"], 
              ["email", "E-mail", "email"], 
              ["categoria", "Categoria (Ex: Fornecedor)", "text"], 
              ["endereco", "Endereço completo", "text"], 
              ["cidade", "Cidade", "text"], 
              ["uf", "Estado (UF)", "text"] 
            ] as const).map(([key, label, type]) => (
              <div key={key} className={key === "endereco" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`contato-${key}`} className="mb-2 block text-[13px] font-semibold text-foreground/80">{label}</Label>
                <Input 
                  id={`contato-${key}`} 
                  type={type}
                  value={form[key as keyof typeof form]} 
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })} 
                  className={field} 
                />
              </div>
            ))}
            
            <div className="sm:col-span-2">
              <Label htmlFor="contato-observacoes" className="mb-2 block text-[13px] font-semibold text-foreground/80">Anotações / Observações</Label>
              <Textarea 
                id="contato-observacoes" 
                value={form.observacoes} 
                onChange={(event) => setForm({ ...form, observacoes: event.target.value })} 
                className="min-h-[100px] rounded-xl border-border bg-background shadow-sm text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary p-3" 
                placeholder="Insira detalhes adicionais sobre este contato..."
              />
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-border/60 bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="font-medium">Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving} className="font-semibold shadow-sm">
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar contato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE EXCLUSÃO */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 dark:text-red-400">Remover contato?</DialogTitle>
            <DialogDescription className="mt-2 text-base text-foreground/80">
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong> da sua agenda? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void remove()}>Sim, excluir contato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
