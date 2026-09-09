import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Folder, FolderOpen, Plane, Plus } from "lucide-react";
import type { OpcoesRelatorioViagem, RelatorioDespesaViagem } from "@/lib/colaborador-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Relatorio = RelatorioDespesaViagem;

type RelatorioFolderProps = {
  carregando: boolean;
  clientes: OpcoesRelatorioViagem["clientes"];
  relatorios: Relatorio[];
  visao: "finalizados" | "rascunhos";
  onMudarVisao: (visao: "finalizados" | "rascunhos") => void;
  onAbrirRelatorio: (relatorio: Relatorio) => void;
  onNovoRelatorio: () => void;
};

type CotistaFolder = {
  id: string;
  nome: string;
  relatorios: Relatorio[];
};

function statusLabel(status?: string) {
  return ({
    rascunho: "Rascunho",
    finalizado: "Finalizado",
    aguardando_aprovacao: "Aguardando aprovação",
    ajuste_necessario: "Ajuste necessário",
    aprovado: "Aprovado",
    enviado_cliente: "Enviado ao cliente",
  } as Record<string, string>)[status || ""] || status || "Rascunho";
}

function statusClass(status?: string) {
  return status === "aprovado"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : status === "ajuste_necessario"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
      : status === "aguardando_aprovacao"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-border bg-secondary/50 text-muted-foreground";
}

function dataBr(data?: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function nomeAeronave(relatorio: Relatorio) {
  return relatorio.aeronave_matricula || relatorio.matricula_aeronave || "Aeronave não identificada";
}

function ListaRelatorios({ relatorios, onAbrir }: { relatorios: Relatorio[]; onAbrir: (relatorio: Relatorio) => void }) {
  return (
    <div className="space-y-2">
      {relatorios.map((item) => (
        <button key={item.id} type="button" onClick={() => onAbrir(item)} className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card/70 px-4 py-4 text-left transition-colors hover:border-primary/45 hover:bg-card sm:flex-row sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-bold">{item.numero_relatorio || "Sem número"}</p><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{[item.numero_voo && `Voo ${item.numero_voo}`, item.rota, `${dataBr(item.data_inicio)} a ${dataBr(item.data_fim)}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="shrink-0 text-sm font-bold text-primary">{moeda(Number(item.total_valor) || 0)}</div>
        </button>
      ))}
    </div>
  );
}

export default function RelatorioFolder({ carregando, clientes, relatorios, visao, onMudarVisao, onAbrirRelatorio, onNovoRelatorio }: RelatorioFolderProps) {
  const [cotistaAberto, setCotistaAberto] = useState<string | null>(null);
  const [aeronaveAberta, setAeronaveAberta] = useState<string | null>(null);

  const relatoriosFinalizados = relatorios.filter((item) => item.status !== "rascunho");
  const rascunhos = relatorios.filter((item) => item.status === "rascunho");
  const cotistas = useMemo<CotistaFolder[]>(() => {
    const nomesClientes = new Map(clientes.map((cliente) => [cliente.id, cliente.razao_social || "Cliente sem razão social"]));
    const grupos = new Map<string, CotistaFolder>();
    relatoriosFinalizados.forEach((relatorio) => {
      const id = relatorio.socio_id
        ? `socio:${relatorio.socio_id}`
        : relatorio.holding_nome
          ? `holding:${relatorio.cliente_id || relatorio.holding_nome}`
          : `cliente:${relatorio.cliente_id || "sem-cliente"}`;
      const nome = relatorio.socio_id
        ? relatorio.socio_nome || "Sócio não identificado"
        : relatorio.holding_nome || relatorio.cliente_nome || nomesClientes.get(relatorio.cliente_id || "") || "Cliente não identificado";
      const atual = grupos.get(id) || { id, nome, relatorios: [] };
      atual.relatorios.push(relatorio);
      grupos.set(id, atual);
    });
    return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, relatoriosFinalizados]);

  const cotista = cotistas.find((item) => item.id === cotistaAberto);
  const aeronaves = useMemo(() => {
    if (!cotista) return [];
    const grupos = new Map<string, Relatorio[]>();
    cotista.relatorios.forEach((relatorio) => {
      const id = relatorio.aeronave_id || nomeAeronave(relatorio);
      grupos.set(id, [...(grupos.get(id) || []), relatorio]);
    });
    return [...grupos.entries()].map(([id, itens]) => ({ id, nome: nomeAeronave(itens[0]), relatorios: itens })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [cotista]);
  const aeronave = aeronaves.find((item) => item.id === aeronaveAberta);

  const voltar = () => {
    if (aeronaveAberta) { setAeronaveAberta(null); return; }
    setCotistaAberto(null);
  };

  return (
    <section className="route-enter space-y-6">
      <div className="flex flex-col gap-5 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · Despesas</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Relatório de despesa de viagem</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organize os relatórios por cotista e aeronave.</p>
        </div>
        <Button type="button" onClick={onNovoRelatorio} className="gap-2 self-start lg:self-auto"><Plus size={16} /> Criar novo</Button>
      </div>
      <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Relatórios de viagem">
        <button type="button" role="tab" aria-selected={visao === "finalizados"} onClick={() => { onMudarVisao("finalizados"); setCotistaAberto(null); setAeronaveAberta(null); }} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${visao === "finalizados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Folder size={15} /> Relatórios finalizados <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{relatoriosFinalizados.length}</span></button>
        <button type="button" role="tab" aria-selected={visao === "rascunhos"} onClick={() => { onMudarVisao("rascunhos"); setCotistaAberto(null); setAeronaveAberta(null); }} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${visao === "rascunhos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><FileText size={15} /> Rascunhos <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{rascunhos.length}</span></button>
      </div>
      {carregando ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton h-36 rounded-2xl" />)}</div> : visao === "rascunhos" ? <ListaRelatorios relatorios={rascunhos} onAbrir={onAbrirRelatorio} /> : cotista && aeronave ? <div className="space-y-4"><div className="flex items-center gap-3"><Button type="button" size="icon" variant="ghost" onClick={voltar} aria-label="Voltar para aeronaves"><ArrowLeft size={17} /></Button><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">{cotista.nome}</p><h2 className="text-lg font-bold flex items-center gap-2"><Plane size={17} className="text-primary" /> {aeronave.nome}</h2></div></div><ListaRelatorios relatorios={aeronave.relatorios} onAbrir={onAbrirRelatorio} /></div> : cotista ? <div className="space-y-4"><div className="flex items-center gap-3"><Button type="button" size="icon" variant="ghost" onClick={voltar} aria-label="Voltar para cotistas"><ArrowLeft size={17} /></Button><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Pasta do cotista</p><h2 className="text-lg font-bold">{cotista.nome}</h2></div></div><div className="grid gap-3 sm:grid-cols-2">{aeronaves.map((item) => <button key={item.id} type="button" onClick={() => setAeronaveAberta(item.id)} className="group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card/70 px-4 py-4 text-left hover:border-primary/45 hover:bg-card"><FolderOpen className="shrink-0 fill-primary/20 text-primary" size={42} strokeWidth={1.6} /><div><p className="text-sm font-bold">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{item.relatorios.length} {item.relatorios.length === 1 ? "relatório" : "relatórios"}</p></div></button>)}</div></div> : <div className="space-y-4"><div><h2 className="text-sm font-bold">Pastas de cotistas</h2><p className="mt-1 text-xs text-muted-foreground">Selecione um cotista para ver suas aeronaves.</p></div>{cotistas.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center"><FolderOpen className="mx-auto text-muted-foreground" size={30} /><p className="mt-3 text-sm font-semibold">Nenhum cotista com relatório finalizado</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cotistas.map((item) => <button key={item.id} type="button" onClick={() => setCotistaAberto(item.id)} className="group relative min-h-36 overflow-hidden rounded-2xl border border-border bg-card/70 p-5 text-left hover:border-primary/50 hover:bg-card"><div className="relative flex h-full flex-col justify-between"><Folder className="fill-primary/20 text-primary" size={52} strokeWidth={1.6} /><div><p className="truncate text-xs font-bold uppercase tracking-wide">{item.nome}</p><p className="mt-2 text-xs text-muted-foreground">{item.relatorios.length} {item.relatorios.length === 1 ? "relatório" : "relatórios"}</p></div></div></button>)}</div>}</div>}
    </section>
  );
}
