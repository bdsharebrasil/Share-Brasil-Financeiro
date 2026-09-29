import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Cake, CalendarDays, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  atualizarAniversarioShare,
  buscarAniversariosShare,
  criarAniversarioShare,
  excluirAniversarioShare,
  type AniversarioShare,
  type AniversarioSharePayload,
} from "@/lib/colaborador-api";

type FiltroAniversario = "mes" | "proximos7" | "todos";
type FormularioAniversario = { nome: string; data_aniversario: string; empresa: string; categoria: string; url_avatar: string };
const formularioVazio: FormularioAniversario = { nome: "", data_aniversario: "", empresa: "", categoria: "cliente", url_avatar: "" };

function nomeCategoria(categoria?: string | null) {
  const categorias: Record<string, string> = { cliente: "Cliente", colaborador: "Colaborador", fornecedor: "Fornecedor", hotel: "Hotel" };
  return categorias[String(categoria || "").toLowerCase()] || "Contato";
}
function classeCategoria(categoria?: string | null) {
  const classes: Record<string, string> = {
    cliente: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    colaborador: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    fornecedor: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    hotel: "border-purple-500/20 bg-purple-500/10 text-purple-400",
  };
  return classes[String(categoria || "").toLowerCase()] || "border-border bg-secondary/30 text-muted-foreground";
}
function iniciais(nome?: string | null) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "AN";
  return (partes.length === 1 ? partes[0].slice(0, 2) : `${partes[0][0]}${partes[partes.length - 1][0]}`).toUpperCase();
}
function dataLocal(valor: string) {
  const data = valor.slice(0, 10);
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}
function dataCurta(valor: string) {
  const data = dataLocal(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function diasAteAniversario(valor: string, hoje: Date) {
  const data = dataLocal(valor);
  if (Number.isNaN(data.getTime())) return Number.MAX_SAFE_INTEGER;
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let proximo = new Date(hoje.getFullYear(), data.getMonth(), data.getDate());
  if (proximo < hojeZerado) proximo = new Date(hoje.getFullYear() + 1, data.getMonth(), data.getDate());
  return Math.round((proximo.getTime() - hojeZerado.getTime()) / 86_400_000);
}

export default function Aniversarios() {
  const { toast } = useToast();
  const [aniversarios, setAniversarios] = useState<AniversarioShare[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroAniversario>("mes");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<AniversarioShare | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState<FormularioAniversario>(formularioVazio);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const resposta = await buscarAniversariosShare();
      setAniversarios(Array.isArray(resposta?.aniversarios) ? resposta.aniversarios : []);
    } catch (error) {
      toast({ title: "Não foi possível carregar aniversários", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [toast]);

  useEffect(() => { void carregar(); }, [carregar]);

  const hoje = useMemo(() => new Date(), []);
  const aniversariosDoMes = useMemo(() => aniversarios.filter((item) => dataLocal(item.data_aniversario).getMonth() === hoje.getMonth()).length, [aniversarios, hoje]);
  const proximosSeteDias = useMemo(() => aniversarios.filter((item) => diasAteAniversario(item.data_aniversario, hoje) <= 7).length, [aniversarios, hoje]);
  const filtrados = useMemo(() => {
    const itens = aniversarios.filter((item) => {
      if (filtro === "mes") return dataLocal(item.data_aniversario).getMonth() === hoje.getMonth();
      if (filtro === "proximos7") return diasAteAniversario(item.data_aniversario, hoje) <= 7;
      return true;
    });
    return [...itens].sort((a, b) => diasAteAniversario(a.data_aniversario, hoje) - diasAteAniversario(b.data_aniversario, hoje) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [aniversarios, filtro, hoje]);

  const abrirNovo = () => {
    setEditando(null);
    setFormulario(formularioVazio);
    setDialogAberto(true);
  };
  const abrirEdicao = (item: AniversarioShare) => {
    setEditando(item);
    setFormulario({ nome: item.nome, data_aniversario: item.data_aniversario.slice(0, 10), empresa: item.empresa || "", categoria: item.categoria || "cliente", url_avatar: item.url_avatar || "" });
    setDialogAberto(true);
  };
  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formulario.nome.trim() || !formulario.data_aniversario) {
      toast({ title: "Campos obrigatórios", description: "Informe o nome e a data do aniversário.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const payload: AniversarioSharePayload = { nome: formulario.nome.trim(), data_aniversario: formulario.data_aniversario, empresa: formulario.empresa.trim() || null, categoria: formulario.categoria, url_avatar: formulario.url_avatar.trim() || null };
    try {
      if (editando) {
        await atualizarAniversarioShare(editando.id, payload);
        toast({ title: "Aniversário atualizado", description: "Os dados foram salvos no D1." });
      } else {
        await criarAniversarioShare(payload);
        toast({ title: "Aniversário cadastrado", description: "O novo registro foi salvo no D1." });
      }
      setDialogAberto(false);
      setEditando(null);
      await carregar(true);
    } catch (error) {
      toast({ title: "Erro ao salvar aniversário", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };
  const excluir = async (item: AniversarioShare) => {
    if (!window.confirm(`Excluir o aniversário de ${item.nome}?`)) return;
    try {
      await excluirAniversarioShare(item.id);
      toast({ title: "Aniversário excluído", description: "O registro foi removido do D1." });
      await carregar(true);
    } catch (error) {
      toast({ title: "Erro ao excluir aniversário", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  };

  const tituloLista = filtro === "proximos7" ? "Aniversários — próximos 7 dias" : filtro === "todos" ? "Todos os aniversários cadastrados" : "Aniversariantes deste mês";
  return (
    <div className="mx-auto max-w-7xl space-y-7 p-3 sm:p-5 md:p-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 p-2.5 text-primary shadow-inner"><Cake className="h-6 w-6" /></div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Aniversários</h1>
          </div>
          <p className="pl-1 text-sm text-muted-foreground">Acompanhe e comemore as datas especiais da equipe e dos contatos.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-11 gap-2 rounded-xl"><RefreshCw className={atualizando ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar</Button>
          <Button type="button" onClick={abrirNovo} className="h-11 gap-2 rounded-xl px-5"><Plus className="h-5 w-5" />Novo aniversário</Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Resumo de aniversários">
        <button type="button" onClick={() => setFiltro("mes")} aria-pressed={filtro === "mes"} className="text-left">
          <Card className={`h-full cursor-pointer rounded-2xl border bg-background/60 transition-all ${filtro === "mes" ? "border-primary/80 ring-1 ring-primary/40" : "border-border/60 hover:border-border"}`}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Este mês</p><p className="mt-1 text-3xl font-extrabold">{aniversariosDoMes}</p></div><div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary"><Cake className="h-6 w-6" /></div></CardContent></Card>
        </button>
        <button type="button" onClick={() => setFiltro("proximos7")} aria-pressed={filtro === "proximos7"} className="text-left">
          <Card className={`h-full cursor-pointer rounded-2xl border bg-background/60 transition-all ${filtro === "proximos7" ? "border-primary/80 ring-1 ring-primary/40" : "border-border/60 hover:border-border"}`}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Próximos 7 dias</p><p className="mt-1 text-3xl font-extrabold">{proximosSeteDias}</p></div><div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300"><CalendarDays className="h-6 w-6" /></div></CardContent></Card>
        </button>
        <button type="button" onClick={() => setFiltro("todos")} aria-pressed={filtro === "todos"} className="text-left">
          <Card className={`h-full cursor-pointer rounded-2xl border bg-background/60 transition-all ${filtro === "todos" ? "border-primary/80 ring-1 ring-primary/40" : "border-border/60 hover:border-border"}`}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total geral</p><p className="mt-1 text-3xl font-extrabold">{aniversarios.length}</p></div><div className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-3 text-blue-300"><Users className="h-6 w-6" /></div></CardContent></Card>
        </button>
      </section>

      <Card className="overflow-hidden rounded-2xl border border-border/80 bg-background/60 shadow-xl">
        <CardHeader className="border-b border-border/60 px-5 pb-4 pt-5 sm:px-6"><CardTitle className="flex items-center gap-3 text-lg"><Cake className="h-5 w-5 text-primary" />{tituloLista}</CardTitle></CardHeader>
        <CardContent className="p-4 sm:p-6">
          {carregando ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Cake className="mb-3 h-8 w-8 animate-pulse text-primary" /><p className="text-sm">Carregando aniversariantes...</p></div> : filtrados.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground"><Cake className="mb-3 h-8 w-8" /><p className="font-semibold text-foreground">Nenhum aniversário encontrado</p><p className="mt-1 text-xs">Cadastre um novo contato ou ajuste o filtro.</p><Button type="button" variant="outline" onClick={abrirNovo} className="mt-4 gap-2"><Plus className="h-4 w-4" />Novo aniversário</Button></div> : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtrados.map((item) => (
                <article key={`${item.origem}:${item.id}`} className="group relative flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm transition-all hover:border-border/80 hover:bg-card/80">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <Avatar className="h-12 w-12 shrink-0 border border-border/60 shadow-inner"><AvatarImage src={item.url_avatar || undefined} alt={item.nome} className="object-cover" /><AvatarFallback className="bg-secondary text-sm font-semibold text-foreground">{iniciais(item.nome)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1"><h3 className="truncate text-base font-semibold text-foreground">{item.nome}</h3>{item.empresa && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><Building2 className="h-3 w-3 shrink-0" />{item.empresa}</p>}<Badge variant="outline" className={`mt-1.5 text-[10px] ${classeCategoria(item.categoria)}`}>{nomeCategoria(item.categoria)}</Badge>{item.origem === "user_profiles" && <span className="ml-2 text-[10px] text-muted-foreground">Perfil</span>}</div>
                  </div>
                  <div className="shrink-0 pl-2 text-right"><span className="text-base font-bold tracking-tight">{dataCurta(item.data_aniversario)}</span><p className="text-[10px] text-muted-foreground">{diasAteAniversario(item.data_aniversario, hoje) === 0 ? "Hoje" : `em ${diasAteAniversario(item.data_aniversario, hoje)} dias`}</p></div>
                  {item.origem === "aniversarios" && <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg border border-border/80 bg-card/95 p-1 opacity-100 shadow-lg transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(item)} aria-label={`Editar aniversário de ${item.nome}`} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300" onClick={() => void excluir(item)} aria-label={`Excluir aniversário de ${item.nome}`} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={(aberto) => { if (!salvando) setDialogAberto(aberto); }}>
        <DialogContent className="rounded-2xl border-border bg-background text-foreground sm:max-w-lg">
          <form onSubmit={(event) => void salvar(event)}>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Cake className="h-5 w-5 text-primary" />{editando ? "Editar aniversário" : "Novo aniversário"}</DialogTitle><DialogDescription>{editando ? "Atualize os dados do contato." : "Preencha os dados para adicionar um aniversário à lista."}</DialogDescription></DialogHeader>
            <div className="space-y-4 py-5">
              <div className="space-y-1.5"><Label htmlFor="aniversario-nome">Nome completo *</Label><Input id="aniversario-nome" required maxLength={160} value={formulario.nome} onChange={(event) => setFormulario((atual) => ({ ...atual, nome: event.target.value }))} placeholder="Ex.: Maria Silva" /></div>
              <div className="space-y-1.5"><Label htmlFor="aniversario-data">Data de aniversário *</Label><Input id="aniversario-data" type="date" required value={formulario.data_aniversario} onChange={(event) => setFormulario((atual) => ({ ...atual, data_aniversario: event.target.value }))} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="aniversario-empresa">Empresa</Label><Input id="aniversario-empresa" maxLength={160} value={formulario.empresa} onChange={(event) => setFormulario((atual) => ({ ...atual, empresa: event.target.value }))} placeholder="Empresa ou departamento" /></div><div className="space-y-1.5"><Label>Categoria</Label><Select value={formulario.categoria} onValueChange={(categoria) => setFormulario((atual) => ({ ...atual, categoria }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cliente">Cliente</SelectItem><SelectItem value="colaborador">Colaborador</SelectItem><SelectItem value="fornecedor">Fornecedor</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent></Select></div></div>
              <div className="space-y-1.5"><Label htmlFor="aniversario-avatar">URL da foto (opcional)</Label><Input id="aniversario-avatar" type="url" maxLength={500} value={formulario.url_avatar} onChange={(event) => setFormulario((atual) => ({ ...atual, url_avatar: event.target.value }))} placeholder="https://exemplo.com/foto.jpg" /></div>
            </div>
            <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
