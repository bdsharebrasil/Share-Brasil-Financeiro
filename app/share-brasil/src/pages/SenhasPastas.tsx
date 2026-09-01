import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Folder, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarSenhas, criarSenha, excluirSenha, revelarSenha, type SenhaEmpresa } from "@/lib/colaborador-api";

const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";
const pastaPadrao = "Sem pasta";

export default function SenhasPastas() {
  const [items, setItems] = useState<SenhaEmpresa[]>([]);
  const [visible, setVisible] = useState<Record<string, string>>({});
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", site: "", login: "", senha: "", setor: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void buscarSenhas()
      .then(setItems)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar as senhas."));
  };

  useEffect(refresh, []);

  const folders = useMemo(() => {
    const names = items.map((item) => item.setor?.trim() || pastaPadrao);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const selectedItems = useMemo(
    () => selectedFolder ? items.filter((item) => (item.setor?.trim() || pastaPadrao) === selectedFolder) : [],
    [items, selectedFolder],
  );

  const reveal = async (id: string) => {
    if (visible[id]) {
      setVisible((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    try {
      const item = await revelarSenha(id);
      setVisible((current) => ({ ...current, [id]: item.senha || "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível revelar a senha.");
    }
  };

  const add = async () => {
    if (!form.titulo || !form.site || !form.login || !form.senha) {
      setError("Preencha título, site, login e senha.");
      return;
    }

    try {
      const folder = form.setor.trim() || selectedFolder || pastaPadrao;
      await criarSenha({ ...form, setor: folder });
      setForm({ titulo: "", site: "", login: "", senha: "", setor: "" });
      setShowForm(false);
      setError(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a credencial.");
    }
  };

  const remove = async (id: string) => {
    try {
      await excluirSenha(id);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a credencial.");
    }
  };

  const copy = (value: string) => void navigator.clipboard?.writeText(value);
  const openForm = () => {
    setForm((current) => ({ ...current, setor: selectedFolder || current.setor }));
    setShowForm(true);
  };

  return (
    <div className="route-enter space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Share Brasil / Cofre</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.045em] md:text-[30px]">Senhas</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Credenciais corporativas organizadas para uma consulta segura e rápida.</p>
        </div>
        <Button type="button" onClick={openForm} className="h-10 gap-2 self-start text-xs sm:self-auto"><Plus size={15} /> Nova senha</Button>
      </header>

      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">{error}</p>}

      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.14] via-card to-card p-5 shadow-sm md:p-6">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><ShieldCheck size={18} /></span>
            <h2 className="mt-3 text-xl font-extrabold tracking-[-.03em]">Seu cofre, bem organizado.</h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground">Cada pasta reúne as credenciais da mesma área, sem expor senhas até que você escolha revelá-las.</p>
          </div>
          <div className="flex gap-2">
            <Stat label="Pastas" value={folders.length} />
            <Stat label="Credenciais" value={items.length} accent />
          </div>
        </div>
      </section>

      {showForm && <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-extrabold">Adicionar credencial</p><p className="mt-1 text-[10px] text-muted-foreground">Associe a senha a uma pasta para encontrá-la com facilidade.</p></div>
          <button type="button" onClick={() => setShowForm(false)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <Input placeholder="Nome da credencial" value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} className={field} />
          <Input placeholder="Site ou sistema" value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} className={field} />
          <Input placeholder="Login ou usuário" value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} className={field} />
          <Input placeholder="Senha" type="password" value={form.senha} onChange={(event) => setForm({ ...form, senha: event.target.value })} className={field} />
          <Input placeholder="Pasta (ex.: Operações)" value={form.setor} onChange={(event) => setForm({ ...form, setor: event.target.value })} className={field} />
          <Button type="button" onClick={() => void add()} className="h-10 gap-2 text-xs"><Plus size={14} /> Salvar</Button>
        </div>
      </section>}

      {selectedFolder ? (
        <FolderContent
          folder={selectedFolder}
          items={selectedItems}
          visible={visible}
          onBack={() => setSelectedFolder(null)}
          onAdd={openForm}
          onReveal={reveal}
          onCopy={copy}
          onRemove={remove}
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-extrabold">Pastas</h2><p className="mt-1 text-[10px] text-muted-foreground">Escolha uma pasta para abrir suas credenciais.</p></div>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold text-muted-foreground">{folders.length} {folders.length === 1 ? "pasta" : "pastas"}</span>
          </div>
          {folders.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{folders.map((folder) => <FolderTile key={folder} name={folder} count={items.filter((item) => (item.setor?.trim() || pastaPadrao) === folder).length} onOpen={() => setSelectedFolder(folder)} />)}</div> : <Empty title="Seu cofre está vazio" detail="Adicione uma senha para criar sua primeira pasta." />}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`min-w-[92px] rounded-xl border px-3.5 py-3 ${accent ? "border-primary/25 bg-primary/10" : "border-border bg-background/60"}`}><p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-extrabold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</p></div>;
}

function FolderTile({ name, count, onOpen }: { name: string; count: number; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary/45 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/[.08] blur-2xl transition-transform group-hover:scale-125" />
    <span className="relative flex items-start justify-between"><span className="relative flex h-[58px] w-[72px] items-end"><span className="absolute bottom-0 left-0 h-[45px] w-[70px] rounded-[10px] rounded-tl-[4px] bg-gradient-to-br from-sky-300 via-sky-500 to-blue-700 shadow-[inset_0_2px_0_rgba(255,255,255,.35),0_10px_18px_rgba(37,99,235,.25)]" /><span className="absolute left-0 top-0 h-[21px] w-[34px] rounded-t-[8px] rounded-br-[4px] bg-gradient-to-br from-sky-300 to-blue-600" /></span><span className="rounded-lg border border-border bg-secondary/60 p-2 text-muted-foreground transition-colors group-hover:text-primary"><ChevronRight size={15} /></span></span>
    <span className="relative mt-6 block"><span className="block truncate text-sm font-extrabold tracking-[-.02em]">{name}</span><span className="mt-1 block text-[10px] text-muted-foreground">Credenciais organizadas nesta pasta</span><span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-1 text-[10px] font-bold text-muted-foreground"><KeyRound size={11} className="text-primary" />{count} {count === 1 ? "senha" : "senhas"}</span></span>
  </button>;
}

function FolderContent({ folder, items, visible, onBack, onAdd, onReveal, onCopy, onRemove }: { folder: string; items: SenhaEmpresa[]; visible: Record<string, string>; onBack: () => void; onAdd: () => void; onReveal: (id: string) => void; onCopy: (value: string) => void; onRemove: (id: string) => void }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="border-b border-border bg-secondary/25 px-4 py-4 md:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Voltar para pastas" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"><ChevronLeft size={17} /></button><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Folder size={19} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Pasta de senhas</p><h2 className="mt-0.5 text-base font-extrabold">{folder}</h2></div></div><div className="flex items-center gap-2"><span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold text-muted-foreground">{items.length} {items.length === 1 ? "senha" : "senhas"}</span><Button type="button" variant="outline" onClick={onAdd} className="h-8 gap-1.5 px-2.5 text-[10px]"><Plus size={13} /> Adicionar</Button></div></div></div>
    {items.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <CredentialCard key={item.id} item={item} value={visible[item.id]} onReveal={() => onReveal(item.id)} onCopy={onCopy} onRemove={() => onRemove(item.id)} />)}</div> : <div className="p-4"><Empty title="Nenhuma credencial nesta pasta" detail="Use “Adicionar” para incluir a primeira senha." /></div>}
  </section>;
}

function CredentialCard({ item, value, onReveal, onCopy, onRemove }: { item: SenhaEmpresa; value?: string; onReveal: () => void; onCopy: (value: string) => void; onRemove: () => void }) {
  return <article className="group rounded-xl border border-border bg-background/45 p-4 transition-all hover:border-primary/35 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold">{item.titulo}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{item.site}</p></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LockKeyhole size={15} /></span></div><div className="mt-4 space-y-2.5 rounded-lg border border-border/70 bg-card p-3"><CredentialValue label="Login / usuário" value={item.login} onCopy={() => onCopy(item.login)} /><div className="border-t border-border/70 pt-2.5"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Senha</p><div className="mt-1 flex items-center justify-between gap-2"><p className="min-w-0 truncate font-mono text-xs">{value || "••••••••••••"}</p><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onReveal} aria-label={value ? "Ocultar senha" : "Revelar senha"} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary">{value ? <EyeOff size={14} /> : <Eye size={14} />}</button>{value && <button type="button" aria-label="Copiar senha" onClick={() => onCopy(value)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Copy size={13} /></button>}</div></div></div></div><div className="mt-3 flex justify-end"><button type="button" onClick={onRemove} className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><Trash2 size={12} /> Excluir</button></div></article>;
}

function CredentialValue({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs font-medium">{value}</p><button type="button" aria-label={`Copiar ${label}`} onClick={onCopy} className="text-muted-foreground hover:text-primary"><Copy size={13} /></button></div></div>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-11 text-center"><KeyRound size={23} className="mx-auto text-primary" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
}
