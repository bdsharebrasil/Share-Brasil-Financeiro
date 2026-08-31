import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Folder, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarSenhas, criarSenha, excluirSenha, revelarSenha, type SenhaEmpresa } from "@/lib/colaborador-api";

const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";

export default function SenhasPastas() {
  const [items, setItems] = useState<SenhaEmpresa[]>([]);
  const [visible, setVisible] = useState<Record<string, string>>({});
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", site: "", login: "", senha: "", setor: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => { void buscarSenhas().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as senhas.")); };
  useEffect(refresh, []);

  const folders = useMemo(() => Array.from(new Set(items.map((item) => item.setor?.trim() || "Sem pasta"))).sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const selectedItems = selectedFolder ? items.filter((item) => (item.setor?.trim() || "Sem pasta") === selectedFolder) : [];

  const reveal = async (id: string) => {
    if (visible[id]) {
      setVisible((current) => { const next = { ...current }; delete next[id]; return next; });
      return;
    }
    try {
      const item = await revelarSenha(id);
      setVisible((current) => ({ ...current, [id]: item.senha || "" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível revelar a senha."); }
  };

  const add = async () => {
    if (!form.titulo || !form.site || !form.login || !form.senha) return setError("Preencha título, site, login e senha.");
    try {
      await criarSenha({ ...form, setor: form.setor.trim() || "Sem pasta" });
      setForm({ titulo: "", site: "", login: "", senha: "", setor: "" });
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a credencial."); }
  };

  const remove = async (id: string) => {
    try { await excluirSenha(id); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir a credencial."); }
  };

  return <div className="route-enter space-y-5">
    <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Share Brasil / Cofre</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Senhas</h1><p className="mt-1.5 text-xs text-muted-foreground">Credenciais corporativas organizadas em pastas, com visualização protegida.</p></div>
    {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.13] via-card to-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Cofre corporativo</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">Tudo no lugar certo.</h2><p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground">Abra uma pasta para visualizar credenciais em um painel seguro, limpo e fácil de consultar.</p></div><div className="flex gap-3"><Stat label="Pastas" value={folders.length} accent /><Stat label="Credenciais" value={items.length} /></div></div></section>
    <section className="rounded-xl border border-border bg-card/75 p-4 shadow-sm"><div><p className="text-sm font-extrabold">Nova credencial</p><p className="mt-1 text-[10px] text-muted-foreground">Informe a pasta para manter seu cofre organizado.</p></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6"><Input placeholder="Nome da credencial" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={field} /><Input placeholder="Site ou sistema" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className={field} /><Input placeholder="Login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className={field} /><Input placeholder="Senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className={field} /><Input placeholder="Pasta (ex.: Operações)" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className={field} /><Button type="button" onClick={() => void add()} className="h-10 gap-2 text-xs"><Plus size={14} /> Salvar</Button></div></section>
    {selectedFolder ? <section className="overflow-hidden rounded-2xl border border-border bg-card/75 shadow-sm"><div className="border-b border-border/70 bg-muted/25 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button type="button" onClick={() => setSelectedFolder(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"><ChevronLeft size={17} /></button><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Folder size={19} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Pasta de senhas</p><h2 className="mt-0.5 text-base font-extrabold">{selectedFolder}</h2></div></div><span className="rounded-full border border-border bg-background/70 px-3 py-1 text-[10px] font-bold text-muted-foreground">{selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"}</span></div></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{selectedItems.map((item) => <CredentialCard key={item.id} item={item} value={visible[item.id]} onReveal={() => void reveal(item.id)} onCopy={(value) => void navigator.clipboard?.writeText(value)} onRemove={() => void remove(item.id)} />)}</div>{!selectedItems.length && <Empty title="Nenhuma credencial nesta pasta" detail="Cadastre uma nova credencial e associe-a a esta pasta." />}</section> : <section><div className="mb-3"><p className="text-sm font-extrabold">Suas pastas</p><p className="mt-1 text-[10px] text-muted-foreground">Abra uma pasta para acessar as credenciais.</p></div>{folders.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{folders.map((folder) => { const count = items.filter((item) => (item.setor?.trim() || "Sem pasta") === folder).length; return <button type="button" key={folder} onClick={() => setSelectedFolder(folder)} className="group flex min-h-[142px] flex-col justify-between rounded-2xl border border-border/70 bg-card/70 p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/15 text-amber-500 transition-transform group-hover:scale-105"><Folder size={22} fill="currentColor" fillOpacity=".18" /></span><ChevronRight size={17} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div><div><p className="truncate text-sm font-extrabold">{folder}</p><p className="mt-1 text-[10px] text-muted-foreground">{count} {count === 1 ? "credencial" : "credenciais"}</p></div></button>; })}</div> : <Empty title="Seu cofre está vazio" detail="Cadastre a primeira credencial e defina uma pasta para começar." />}</section>}
  </div>;
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div className={`rounded-xl border px-4 py-3 ${accent ? "border-primary/20 bg-primary/10" : "border-border/70 bg-background/50"}`}><p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-extrabold ${accent ? "text-primary" : ""}`}>{value}</p></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center"><KeyRound size={22} className="mx-auto text-primary" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>; }
function CredentialCard({ item, value, onReveal, onCopy, onRemove }: { item: SenhaEmpresa; value?: string; onReveal: () => void; onCopy: (value: string) => void; onRemove: () => void }) { return <article className="group rounded-xl border border-border/70 bg-background/35 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold">{item.titulo}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{item.site}</p></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound size={15} /></span></div><div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-card/70 p-3"><CredentialValue label="Login" value={item.login} onCopy={() => onCopy(item.login)} /><div className="border-t border-border/60 pt-2"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Senha</p><div className="mt-1 flex items-center justify-between gap-2"><p className="min-w-0 truncate font-mono text-xs">{value || "••••••••••••"}</p><div className="flex items-center gap-2"><button type="button" onClick={onReveal} className="text-[10px] font-bold text-primary hover:underline">{value ? "Ocultar" : "Revelar"}</button>{value && <button type="button" aria-label="Copiar senha" onClick={() => onCopy(value)} className="text-muted-foreground hover:text-primary"><Copy size={13} /></button>}</div></div></div></div><button type="button" onClick={onRemove} className="mt-3 flex items-center gap-1 text-[10px] font-bold text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><Trash2 size={12} /> Excluir</button></article>; }
function CredentialValue({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) { return <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs font-medium">{value}</p><button type="button" aria-label={`Copiar ${label}`} onClick={onCopy} className="text-muted-foreground hover:text-primary"><Copy size={13} /></button></div></div>; }
