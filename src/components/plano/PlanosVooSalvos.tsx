import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, FileText, Folder, Plane, Search } from "lucide-react";
import type { PlanoVooSalvo } from "@/lib/colaborador-api";

type Props = {
  planos: PlanoVooSalvo[];
  carregando: boolean;
  erro: string | null;
  onRecarregar: () => void;
};

type GrupoAeronave = { id: string; matricula: string; planos: PlanoVooSalvo[] };
type GrupoMes = { id: string; label: string; planos: PlanoVooSalvo[] };

function valorTexto(valor: unknown) {
  return String(valor ?? "").trim();
}

function matriculaPlano(plano: PlanoVooSalvo) {
  const contexto = plano.payload?.contexto as { aeronave?: { matricula_registro?: string | null } } | undefined;
  return valorTexto(contexto?.aeronave?.matricula_registro) || "Aeronave não identificada";
}

function dataPlano(plano: PlanoVooSalvo) {
  return plano.data_voo || valorTexto(plano.payload?.form?.dataVoo) || plano.created_at;
}

function chaveMes(plano: PlanoVooSalvo) {
  const data = dataPlano(plano);
  const match = /^\d{4}-\d{2}/.exec(data);
  return match?.[0] || "sem-data";
}

function labelMes(chave: string) {
  if (chave === "sem-data") return "Sem data";
  const [ano, mes] = chave.split("-").map(Number);
  if (!ano || !mes) return chave;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(ano, mes - 1, 1)));
}

function dataBr(valor: string | null | undefined) {
  if (!valor) return "Sem data";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : valor;
}

function pastaClassName(aberta = false) {
  return `group relative flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 text-left transition-colors ${aberta ? "border-primary/60 bg-primary/[.08]" : "border-border bg-card hover:border-primary/45 hover:bg-muted/40"}`;
}

function Pasta({ icon, titulo, detalhe, aberta, onClick }: { icon: React.ReactNode; titulo: string; detalhe: string; aberta?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={pastaClassName(aberta)}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-xl border ${aberta ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-muted/60 text-primary"}`}>
          {icon}
        </span>
        <ChevronRight size={17} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{titulo}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detalhe}</span>
      </span>
    </button>
  );
}

function PlanoLinha({ plano }: { plano: PlanoVooSalvo }) {
  const rota = valorTexto(plano.payload?.form?.rota) || valorTexto(plano.payload?.rota?.routes?.[0]?.route);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-mono text-sm font-bold text-foreground">{plano.numero_voo || "Plano sem número"}</h3>
          <span className="text-xs text-muted-foreground">{plano.adep} → {plano.ades}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{rota || "Rota não informada"}</p>
      </div>
      <time className="shrink-0 text-xs font-semibold text-muted-foreground">{dataBr(dataPlano(plano))}</time>
    </article>
  );
}

export default function PlanosVooSalvos({ planos, carregando, erro, onRecarregar }: Props) {
  const [busca, setBusca] = useState("");
  const [aeronaveAberta, setAeronaveAberta] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return planos;
    return planos.filter((plano) => [
      matriculaPlano(plano), plano.numero_voo, plano.adep, plano.ades,
      valorTexto(plano.payload?.form?.rota), valorTexto(plano.payload?.rota?.routes?.[0]?.route),
    ].join(" ").toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, planos]);

  const aeronaves = useMemo<GrupoAeronave[]>(() => {
    const grupos = new Map<string, GrupoAeronave>();
    filtrados.forEach((plano) => {
      const matricula = matriculaPlano(plano);
      const atual = grupos.get(matricula) || { id: matricula, matricula, planos: [] };
      atual.planos.push(plano);
      grupos.set(matricula, atual);
    });
    return [...grupos.values()].sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR"));
  }, [filtrados]);

  const aeronave = aeronaves.find((item) => item.id === aeronaveAberta);
  const meses = useMemo<GrupoMes[]>(() => {
    if (!aeronave) return [];
    const grupos = new Map<string, GrupoMes>();
    aeronave.planos.forEach((plano) => {
      const id = chaveMes(plano);
      const atual = grupos.get(id) || { id, label: labelMes(id), planos: [] };
      atual.planos.push(plano);
      grupos.set(id, atual);
    });
    return [...grupos.values()].sort((a, b) => b.id.localeCompare(a.id));
  }, [aeronave]);

  const mes = meses.find((item) => item.id === mesAberto);
  const voltar = () => {
    if (mesAberto) setMesAberto(null);
    else setAeronaveAberta(null);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Operações · Arquivo</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Planos de voo salvos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organizados por matrícula da aeronave e mês do voo.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(event) => { setBusca(event.target.value); setAeronaveAberta(null); setMesAberto(null); }} placeholder="Buscar matrícula, voo, rota ou ICAO" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
        </div>
      </div>

      {carregando ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[132px] animate-pulse rounded-2xl border border-border bg-muted/40" />)}</div> : erro ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><p>{erro}</p><button type="button" onClick={onRecarregar} className="mt-3 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold">Tentar novamente</button></div> : !filtrados.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><Folder size={28} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold text-foreground">{busca ? "Nenhum plano corresponde à busca." : "Nenhum plano de voo salvo."}</p><p className="mt-1 text-xs text-muted-foreground">Salve um plano na aba “Novo plano” para ele aparecer aqui.</p></div> : aeronave && mes ? <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" onClick={voltar} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Voltar"><ArrowLeft size={16} /></button><div><p className="text-xs text-muted-foreground">{aeronave.matricula}</p><h3 className="text-lg font-extrabold text-foreground">{mes.label}</h3></div><span className="ml-auto text-xs text-muted-foreground">{mes.planos.length} {mes.planos.length === 1 ? "plano" : "planos"}</span></div><div className="space-y-3">{mes.planos.map((plano) => <PlanoLinha key={plano.id} plano={plano} />)}</div></div> : aeronave ? <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" onClick={voltar} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Voltar"><ArrowLeft size={16} /></button><div><p className="text-xs text-muted-foreground">Pasta da aeronave</p><h3 className="text-lg font-extrabold text-foreground">{aeronave.matricula}</h3></div><span className="ml-auto text-xs text-muted-foreground">{aeronave.planos.length} {aeronave.planos.length === 1 ? "plano" : "planos"}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meses.map((item) => <Pasta key={item.id} icon={<CalendarDays size={21} />} titulo={item.label} detalhe={`${item.planos.length} ${item.planos.length === 1 ? "plano salvo" : "planos salvos"}`} onClick={() => setMesAberto(item.id)} />)}</div></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{aeronaves.map((item) => <Pasta key={item.id} icon={<Plane size={21} />} titulo={item.matricula} detalhe={`${item.planos.length} ${item.planos.length === 1 ? "plano salvo" : "planos salvos"}`} onClick={() => setAeronaveAberta(item.id)} />)}</div>}
    </section>
  );
}
