import { useEffect, useState } from "react";
import { Edit3, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  atualizarAerodromoCadastro,
  buscarAerodromosCadastro,
  criarAerodromoCadastro,
  excluirAerodromoCadastro,
  type AerodromoCadastro,
} from "@/lib/colaborador-api";

const input = "h-9 w-full rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-primary/60";
const vazio = { nome: "", designativo_icao: "", coordenadas: "" };

type FormularioAerodromo = typeof vazio;

export default function Aerodromos({ aoVoltar }: { aoVoltar?: () => void }) {
  const [items, setItems] = useState<AerodromoCadastro[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<AerodromoCadastro | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormularioAerodromo>(vazio);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setItems((await buscarAerodromosCadastro()).aerodromos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os aeródromos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const abrir = (item?: AerodromoCadastro) => {
    setError(null);
    setEdit(item || null);
    setShowForm(true);
    setForm({ nome: item?.nome || "", designativo_icao: item?.designativo_icao || "", coordenadas: item?.coordenadas || "" });
  };

  const cancelar = () => { setEdit(null); setShowForm(false); setForm(vazio); };

  const salvar = async () => {
    const nome = form.nome.trim();
    const designativo_icao = form.designativo_icao.trim().toUpperCase();
    if (!nome) return setError("Informe o nome do aeródromo.");
    if (!/^[A-Z0-9]{4}$/.test(designativo_icao)) return setError("O designativo ICAO deve ter exatamente 4 letras ou números.");
    setSaving(true);
    setError(null);
    try {
      const payload = { nome, designativo_icao, coordenadas: form.coordenadas.trim() || null };
      if (edit) await atualizarAerodromoCadastro(edit.id, payload);
      else await criarAerodromoCadastro(payload);
      cancelar();
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o aeródromo.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (item: AerodromoCadastro) => {
    if (!window.confirm(`Excluir o aeródromo ${item.designativo_icao} — ${item.nome}?`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await excluirAerodromoCadastro(item.id);
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o aeródromo.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtrados = items.filter((item) => `${item.designativo_icao} ${item.nome}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="route-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Operações / Diário de bordo</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><MapPin size={25} className="text-primary" /> Aeródromos</h1><p className="mt-1 text-xs text-muted-foreground">Cadastre e mantenha os aeródromos usados em voos, agendamentos e planos de voo.</p></div>
        <div className="flex gap-2">{aoVoltar && <Button variant="outline" onClick={aoVoltar} className="h-9 text-[10px]">Voltar</Button>}<Button onClick={() => abrir()} className="h-9 gap-1.5 text-[10px]"><Plus size={13} /> Novo aeródromo</Button></div>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
      <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ICAO ou nome..." />
      {showForm && <section className="rounded-xl border border-primary/25 bg-card/80 p-4"><h2 className="text-sm font-bold">{edit ? "Editar aeródromo" : "Novo aeródromo"}</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-[10px] font-bold">Nome<input className={input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label><label className="text-[10px] font-bold">ICAO<input className={input} maxLength={4} value={form.designativo_icao} onChange={(e) => setForm({ ...form, designativo_icao: e.target.value.toUpperCase() })} /></label><label className="text-[10px] font-bold">Coordenadas<input className={input} value={form.coordenadas} onChange={(e) => setForm({ ...form, coordenadas: e.target.value })} placeholder="-15.60,-56.10" /></label></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={cancelar} disabled={saving}>Cancelar</Button><Button onClick={() => void salvar()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div></section>}
      {loading ? <div className="rounded-xl border border-border bg-card/60 p-6 text-xs text-muted-foreground">Carregando aeródromos...</div> : filtrados.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Nenhum aeródromo encontrado.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtrados.map((item) => <article key={item.id} className="rounded-xl border border-border bg-card/75 p-4"><div className="flex items-start justify-between"><div><p className="font-mono text-lg font-bold text-primary">{item.designativo_icao}</p><h2 className="mt-1 text-sm font-bold">{item.nome}</h2><p className="mt-2 text-[10px] text-muted-foreground">{item.coordenadas || "Coordenadas não informadas"}</p></div><div className="flex gap-1"><button aria-label={`Editar ${item.designativo_icao}`} className="rounded border border-border p-2 text-muted-foreground hover:text-primary" onClick={() => abrir(item)}><Edit3 size={13} /></button><button aria-label={`Excluir ${item.designativo_icao}`} disabled={deletingId === item.id} className="rounded border border-border p-2 text-muted-foreground hover:text-red-300 disabled:opacity-50" onClick={() => void excluir(item)}><Trash2 size={13} /></button></div></div></article>)}</div>}
    </div>
  );
}
