import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Edit,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  atualizarContatoShare,
  buscarContatosShare,
  criarContatoShare,
  excluirContatoShare,
  type ContatoAgenda,
} from "@/lib/colaborador-api";

const field = "h-11 rounded-xl border-border bg-background shadow-sm text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary";
const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  empresa: "",
  cargo: "",
  endereco: "",
  cidade: "",
  uf: "",
  categoria: "",
  observacoes: "",
};

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || "")
    .join("");
}

export default function Contatos() {
  const [contatos, setContatos] = useState<ContatoAgenda[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<ContatoAgenda | null>(null);
  const [selected, setSelected] = useState<ContatoAgenda | null>(null);
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

  useEffect(() => {
    void load();
  }, []);

  function openForm(contato?: ContatoAgenda) {
    setEditing(contato || null);
    setForm(
      contato
        ? {
            nome: contato.nome || "",
            email: contato.email || "",
            telefone: contato.telefone || "",
            empresa: contato.empresa || "",
            cargo: contato.cargo || "",
            endereco: contato.endereco || "",
            cidade: contato.cidade || "",
            uf: contato.uf || "",
            categoria: contato.categoria || "",
            observacoes: contato.observacoes || "",
          }
        : { ...emptyForm },
    );
    setFormOpen(true);
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
      toast({
        title: editing ? "Contato atualizado" : "Contato cadastrado",
        description: "As informações foram salvas no D1.",
      });
      setFormOpen(false);
      setDetailOpen(false);
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
      setDetailOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      toast({ title: "Erro ao excluir", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    }
  }

  const filtered = useMemo(() => {
    const term = busca.trim().toLocaleLowerCase("pt-BR");
    return contatos
      .filter((item) =>
        [item.nome, item.email, item.telefone, item.empresa, item.cargo, item.cidade, item.categoria]
          .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [contatos, busca]);

  const detailRows = selected
    ? [
        { label: "Telefone", value: selected.telefone, icon: Phone },
        { label: "E-mail", value: selected.email, icon: Mail },
        { label: "Empresa", value: selected.empresa, icon: Briefcase },
        { label: "Cargo", value: selected.cargo, icon: Briefcase },
        { label: "Localização", value: [selected.cidade, selected.uf].filter(Boolean).join(" / ") || selected.endereco, icon: MapPin },
      ].filter((item) => item.value)
    : [];

  return (
    <div className="route-enter space-y-5 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Agenda de contatos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {contatos.length} {contatos.length === 1 ? "contato" : "contatos"} internos
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Nome, setor, ramal..."
              aria-label="Buscar contatos por nome, categoria ou dados de contato"
              className="h-10 rounded-lg border-white/10 bg-[#0b1730] pl-9 text-sm text-foreground shadow-none placeholder:text-slate-500 focus-visible:ring-sky-500/50"
            />
          </div>
          <Button onClick={() => openForm()} className="h-10 gap-2">
            <Plus size={16} /> Novo contato
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={18} aria-hidden="true" />
          <span className="min-w-0 flex-1 font-medium">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground" role="status">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm font-medium">Carregando seus contatos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound size={30} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{busca ? "Nenhum contato encontrado" : "Sua agenda está vazia"}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {busca ? "Ajuste os termos da busca e tente novamente." : "Cadastre o primeiro contato para começar a organizar sua agenda."}
          </p>
          {!busca && <Button className="mt-6 gap-2" onClick={() => openForm()}><Plus size={16} /> Cadastrar contato</Button>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contato) => (
            <li key={contato.id}>
              <Card className="group h-full overflow-hidden rounded-2xl border-white/10 bg-[#071226] text-slate-100 shadow-sm transition-colors hover:border-sky-400/30">
                <CardContent className="flex h-full flex-col p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#102447] text-sm font-semibold text-sky-200">
                      {iniciais(contato.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-white">{contato.nome}</h2>
                      <p className="truncate text-xs text-slate-400">{contato.cargo || contato.empresa || "Contato profissional"}</p>
                      {(contato.categoria || contato.empresa) && (
                        <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                          {contato.categoria || contato.empresa}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${contato.nome}`} className="h-8 w-8 text-slate-400 hover:text-sky-200" onClick={() => openForm(contato)}>
                        <Edit size={14} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${contato.nome}`} className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => setDeleteTarget(contato)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <dl className="mt-4 flex-1 space-y-2 border-t border-white/5 pt-3 text-xs text-slate-300">
                    {contato.telefone && (
                      <div className="flex min-w-0 items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <dt className="sr-only">Telefone</dt>
                        <dd className="truncate">{contato.telefone}</dd>
                      </div>
                    )}
                    {contato.email && (
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <dt className="sr-only">E-mail</dt>
                        <dd className="min-w-0 truncate">{contato.email}</dd>
                      </div>
                    )}
                    {(contato.cidade || contato.uf || contato.endereco) && (
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <dt className="sr-only">Localização</dt>
                        <dd className="truncate">{[contato.cidade, contato.uf].filter(Boolean).join(" / ") || contato.endereco}</dd>
                      </div>
                    )}
                    {!contato.telefone && !contato.email && !contato.cidade && !contato.uf && !contato.endereco && (
                      <div className="text-slate-500">Sem dados adicionais de contato</div>
                    )}
                  </dl>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setSelected(contato); setDetailOpen(true); }}
                    className="mt-4 h-9 w-full gap-2 border-sky-400/25 bg-sky-500/10 text-xs font-medium text-sky-200 hover:bg-sky-500/20 hover:text-sky-100"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Ver
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-white/10 bg-[#071226] text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-4 pr-6">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#102447] text-lg font-semibold text-sky-200">
                {selected ? iniciais(selected.nome) : ""}
              </span>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-lg text-white">{selected?.nome}</DialogTitle>
                <DialogDescription className="truncate text-slate-400">{selected?.cargo || selected?.empresa || "Contato profissional"}</DialogDescription>
                {(selected?.categoria || selected?.empresa) && <span className="mt-2 inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-300">{selected.categoria || selected.empresa}</span>}
              </div>
            </div>
          </DialogHeader>
          <dl className="grid gap-2 sm:grid-cols-2">
            {detailRows.map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 rounded-lg border border-white/5 bg-white/[.02] p-3">
                <dt className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</dt>
                <dd className="mt-1.5 break-words text-sm font-medium text-slate-100">{value}</dd>
              </div>
            ))}
            {selected?.observacoes && <div className="rounded-lg border border-white/5 bg-white/[.02] p-3 sm:col-span-2"><dt className="text-xs text-slate-500">Observações</dt><dd className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-100">{selected.observacoes}</dd></div>}
          </dl>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
            {selected && <Button type="button" onClick={() => { setDetailOpen(false); openForm(selected); }}><Edit className="mr-2 h-4 w-4" />Editar contato</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-2xl">
          <div className="border-b border-border/60 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">Preencha as informações do contato. Os dados são salvos no banco D1 do portal.</DialogDescription>
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
              ["uf", "Estado (UF)", "text"],
            ] as const).map(([key, label, type]) => (
              <div key={key} className={key === "endereco" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`contato-${key}`} className="mb-2 block text-[13px] font-semibold text-foreground/80">{label}</Label>
                <Input
                  id={`contato-${key}`}
                  type={type}
                  value={form[key]}
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
                className="min-h-[100px] resize-none rounded-xl border-border bg-background p-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                placeholder="Insira detalhes adicionais sobre este contato..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 rounded-b-2xl border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void save()} disabled={saving} className="font-semibold shadow-sm">
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar contato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 dark:text-red-400">Remover contato?</DialogTitle>
            <DialogDescription className="mt-2 text-base text-foreground/80">
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong> da sua agenda? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => void remove()}>Sim, excluir contato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
