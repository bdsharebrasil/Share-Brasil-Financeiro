import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, FileText, Folder, Plane, Search } from "lucide-react";
import type { PlanoVooSalvo } from "@/lib/colaborador-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  planos: PlanoVooSalvo[];
  carregando: boolean;
  erro: string | null;
  onRecarregar: () => void;
  aoAbrir?: (plano: PlanoVooSalvo) => void;
};

type GrupoAeronave = { id: string; matricula: string; planos: PlanoVooSalvo[] };
type GrupoMes = { id: string; label: string; planos: PlanoVooSalvo[] };

const ROTULOS_FPL: Record<string, string> = {
  identificacao: "Item 7 · Identificação",
  regraVoo: "Item 8 · Regra de voo",
  tipoVoo: "Item 8 · Tipo de voo",
  numeroAeronaves: "Item 9 · Número de aeronaves",
  tipoAeronave: "Item 9 · Tipo de aeronave",
  esteira: "Item 9 · Categoria de esteira",
  equipamento: "Item 10 · Equipamento",
  adep: "Item 13 · ADEP",
  dataVoo: "Data do voo",
  eobt: "Item 13 · EOBT (UTC)",
  velocidade: "Item 15 · Velocidade",
  nivel: "Item 15 · Nível",
  rota: "Item 15 · Rota",
  ades: "Item 16 · ADES",
  eet: "Item 16 · EET",
  alternado1: "Item 16 · Alternado 1",
  alternado2: "Item 16 · Alternado 2",
  outrasInformacoes: "Item 18 · Outras informações",
  autonomia: "Item 19 · Autonomia",
  pessoasABordo: "Item 19 · Pessoas a bordo",
  radioEmergencia: "Item 19 · Rádio de emergência",
  sobrevivencia: "Item 19 · Equipamento de sobrevivência",
  coletes: "Item 19 · Coletes",
  botes: "Item 19 · Botes",
  corAeronave: "Item 19 · Cor e marcas",
  observacoes: "Item 19 · Observações",
  piloto: "Item 19 · Piloto em comando",
};

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
  const match = /^\d{4}-\d{2}/.exec(dataPlano(plano));
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
      <span className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-xl border ${aberta ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-muted/60 text-primary"}`}>{icon}</span>
        <ChevronRight size={17} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{titulo}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detalhe}</span>
      </span>
    </button>
  );
}

function PlanoLinha({ plano, onAbrir }: { plano: PlanoVooSalvo; onAbrir: () => void }) {
  const rota = valorTexto(plano.payload?.form?.rota) || valorTexto(plano.payload?.rota?.routes?.[0]?.route);
  return (
    <button type="button" onClick={onAbrir} className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-sm font-bold text-foreground">{plano.numero_voo || "Plano sem número"}</span>
          <span className="text-xs text-muted-foreground">{plano.adep} → {plano.ades}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{rota || "Rota não informada"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground"><time>{dataBr(dataPlano(plano))}</time><ChevronRight size={15} /></span>
    </button>
  );
}

export default function PlanosVooSalvos({ planos, carregando, erro, onRecarregar, aoAbrir }: Props) {
  const [busca, setBusca] = useState("");
  const [aeronaveAberta, setAeronaveAberta] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<PlanoVooSalvo | null>(null);

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
  const formulario = (selecionado?.payload?.form ?? {}) as Record<string, unknown>;
  const campos = Object.entries(ROTULOS_FPL)
    .map(([chave, rotulo]) => [rotulo, valorTexto(formulario[chave])] as const)
    .filter(([, valor]) => valor);
  const rotaSugerida = valorTexto(selecionado?.payload?.rota?.routes?.[0]?.route);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Operações · Arquivo</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Planos de voo salvos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organizados por matrícula da aeronave e mês do voo. Selecione um plano para abrir seus dados.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(event) => { setBusca(event.target.value); setAeronaveAberta(null); setMesAberto(null); }} placeholder="Buscar matrícula, voo, rota ou ICAO" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
        </div>
      </div>

      {carregando ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[132px] animate-pulse rounded-2xl border border-border bg-muted/40" />)}</div>
        : erro ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><p>{erro}</p><button type="button" onClick={onRecarregar} className="mt-3 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold">Tentar novamente</button></div>
          : !filtrados.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><Folder size={28} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold text-foreground">{busca ? "Nenhum plano corresponde à busca." : "Nenhum plano de voo salvo."}</p><p className="mt-1 text-xs text-muted-foreground">Salve um plano na opção “Criar Plano de Voo Completo” para ele aparecer aqui.</p></div>
            : aeronave && mes ? <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" onClick={voltar} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Voltar"><ArrowLeft size={16} /></button><div><p className="text-xs text-muted-foreground">{aeronave.matricula}</p><h3 className="text-lg font-extrabold text-foreground">{mes.label}</h3></div><span className="ml-auto text-xs text-muted-foreground">{mes.planos.length} {mes.planos.length === 1 ? "plano" : "planos"}</span></div><div className="space-y-3">{mes.planos.map((plano) => <PlanoLinha key={plano.id} plano={plano} onAbrir={() => setSelecionado(plano)} />)}</div></div>
              : aeronave ? <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" onClick={voltar} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Voltar"><ArrowLeft size={16} /></button><div><p className="text-xs text-muted-foreground">Pasta da aeronave</p><h3 className="text-lg font-extrabold text-foreground">{aeronave.matricula}</h3></div><span className="ml-auto text-xs text-muted-foreground">{aeronave.planos.length} {aeronave.planos.length === 1 ? "plano" : "planos"}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meses.map((item) => <Pasta key={item.id} icon={<CalendarDays size={21} />} titulo={item.label} detalhe={`${item.planos.length} ${item.planos.length === 1 ? "plano salvo" : "planos salvos"}`} onClick={() => setMesAberto(item.id)} />)}</div></div>
                : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{aeronaves.map((item) => <Pasta key={item.id} icon={<Plane size={21} />} titulo={item.matricula} detalhe={`${item.planos.length} ${item.planos.length === 1 ? "plano salvo" : "planos salvos"}`} onClick={() => setAeronaveAberta(item.id)} />)}</div>}

      <Dialog open={!!selecionado} onOpenChange={(aberto) => !aberto && setSelecionado(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selecionado?.numero_voo || "Plano de voo"} · {selecionado?.adep} → {selecionado?.ades}</DialogTitle></DialogHeader>
          {selecionado && (
            <div className="space-y-4">
              {aoAbrir && <button type="button" onClick={() => { setSelecionado(null); aoAbrir(selecionado); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">Abrir no formulário</button>}
              <div className="grid gap-2 sm:grid-cols-3">
                <Resumo rotulo="Aeronave" valor={matriculaPlano(selecionado)} />
                <Resumo rotulo="Data do voo" valor={dataBr(dataPlano(selecionado))} />
                <Resumo rotulo="EOBT (UTC)" valor={valorTexto(selecionado.eobt) || "—"} />
              </div>
              {rotaSugerida && <section className="rounded-lg border border-primary/25 bg-primary/[.06] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Rota AISWEB/DECEA</p><p className="mt-1 break-words font-mono text-sm text-foreground">{rotaSugerida}</p></section>}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados do formulário ICAO</h3>
                {campos.length ? <dl className="grid gap-2 sm:grid-cols-2">{campos.map(([rotulo, valor]) => <div key={rotulo} className="min-w-0 rounded-lg border border-border bg-card p-3"><dt className="text-[10px] font-semibold uppercase text-muted-foreground">{rotulo}</dt><dd className="mt-1 break-words whitespace-pre-wrap font-mono text-xs text-foreground">{valor}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Este registro não contém os campos detalhados do formulário.</p>}
              </section>
              {Array.isArray(selecionado.payload?.segmentos) && selecionado.payload.segmentos.length > 0 && <section className="rounded-lg border border-border bg-card p-3"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Trechos calculados</h3><p className="mt-1 text-sm text-foreground">{selecionado.payload.segmentos.length} trecho(s) · {Number(selecionado.payload.distancia_total_nm || 0).toFixed(1)} NM</p></section>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p><p className="mt-1 truncate font-mono text-xs text-foreground">{valor}</p></div>;
}
