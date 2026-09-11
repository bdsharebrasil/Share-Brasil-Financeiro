import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Folder, FolderOpen, Plane, Plus, RotateCcw } from "lucide-react";
import type { OpcoesRelatorioViagem, RelatorioDespesaViagem } from "@/lib/colaborador-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AeronavePasta } from "@/components/ui/aeronavepasta";

type Relatorio = RelatorioDespesaViagem;
type RelatorioFolderProps = { carregando: boolean; clientes: OpcoesRelatorioViagem["clientes"]; relatorios: Relatorio[]; visao: "finalizados" | "rascunhos" | "revisao"; onMudarVisao: (visao: "finalizados" | "rascunhos" | "revisao") => void; onAbrirRelatorio: (relatorio: Relatorio) => void; onNovoRelatorio: () => void };
type CotistaFolder = { id: string; nome: string; relatorios: Relatorio[] };

function statusLabel(status?: string) {
  return ({ rascunho: "Rascunho", finalizado: "Finalizado", aguardando_aprovacao: "Aguardando aprovação", ajuste_necessario: "Ajuste necessário", aprovado: "Aprovado", enviado_cliente: "Enviado ao cliente" } as Record<string, string>)[status || ""] || status || "Rascunho";
}
function statusClass(status?: string) {
  if (status === "finalizado") return "border-blue-400/35 bg-blue-400/10 text-blue-300";
  if (status === "rascunho") return "border-orange-400/35 bg-orange-400/10 text-orange-300";
  if (status === "aprovado") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "ajuste_necessario") return "border-rose-400/30 bg-rose-400/10 text-rose-300";
  if (status === "aguardando_aprovacao") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-border bg-secondary/50 text-muted-foreground";
}
function dataBr(data?: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}
function moeda(valor: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0); }
function nomeAeronave(relatorio: Relatorio) { return relatorio.aeronave_matricula || relatorio.matricula_aeronave || "Aeronave não identificada"; }

function ListaRelatorios({ relatorios, onAbrir }: { relatorios: Relatorio[]; onAbrir: (relatorio: Relatorio) => void }) {
  if (relatorios.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum relatório encontrado.</p>;
  return <div className="space-y-3">{relatorios.map((item) => <button key={item.id} type="button" onClick={() => onAbrir(item)} className="group flex w-full flex-col gap-3 rounded-lg border border-border p-4 text-left transition-[border-color,box-shadow] hover:border-primary/60 hover:shadow-[0_4px_14px_hsl(var(--primary)/0.10)] sm:flex-row sm:items-center">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20"><FileText size={18} /></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-bold text-foreground">{item.numero_relatorio || "Sem número"}</p><Badge variant="outline" className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{[item.numero_voo && `Voo ${item.numero_voo}`, item.nome_tripulante, item.rota].filter(Boolean).join(" · ") || "Sem detalhes cadastrados"}</p><p className="mt-1 text-xs text-muted-foreground">{dataBr(item.data_inicio)} a {dataBr(item.data_fim)}</p></div>
    <div className="w-full text-left text-sm font-bold text-primary sm:w-auto sm:text-right">{moeda(Number(item.total_valor) || 0)}</div>
  </button>)}</div>;
}

export default function RelatorioFolder({ carregando, clientes, relatorios, visao, onMudarVisao, onAbrirRelatorio, onNovoRelatorio }: RelatorioFolderProps) {
  const [cotistaAberto, setCotistaAberto] = useState<string | null>(null);
  const [aeronaveAberta, setAeronaveAberta] = useState<string | null>(null);
  const relatoriosFinalizados = relatorios.filter((item) => item.status !== "rascunho" && !["aprovado", "ajuste_necessario"].includes(item.status));
  const relatoriosRevisao = relatorios.filter((item) => ["aprovado", "ajuste_necessario"].includes(item.status));
  const rascunhos = relatorios.filter((item) => item.status === "rascunho");
  const cotistas = useMemo<CotistaFolder[]>(() => {
    const nomesClientes = new Map(clientes.map((cliente) => [cliente.id, cliente.razao_social || "Cliente sem razão social"]));
    const grupos = new Map<string, CotistaFolder>();
    relatoriosFinalizados.forEach((relatorio) => {
      const id = relatorio.socio_id ? `socio:${relatorio.socio_id}` : relatorio.holding_nome ? `holding:${relatorio.cliente_id || relatorio.holding_nome}` : `cliente:${relatorio.cliente_id || "sem-cliente"}`;
      const nome = relatorio.socio_id ? relatorio.socio_nome || "Sócio não identificado" : relatorio.holding_nome || relatorio.cliente_nome || nomesClientes.get(relatorio.cliente_id || "") || "Cliente não identificado";
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
    cotista.relatorios.forEach((relatorio) => { const id = relatorio.aeronave_id || nomeAeronave(relatorio); grupos.set(id, [...(grupos.get(id) || []), relatorio]); });
    return [...grupos.entries()].map(([id, itens]) => ({ id, nome: nomeAeronave(itens[0]), relatorios: itens })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [cotista]);
  const aeronave = aeronaves.find((item) => item.id === aeronaveAberta);
  const voltar = () => { if (aeronaveAberta) { setAeronaveAberta(null); return; } setCotistaAberto(null); };
  const mudarVisao = (novaVisao: "finalizados" | "rascunhos" | "revisao") => { onMudarVisao(novaVisao); setCotistaAberto(null); setAeronaveAberta(null); };

  return <section className="route-enter space-y-6">
    <div className="flex flex-col gap-5 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · Despesas</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Relatório de despesa de viagem</h1><p className="mt-1 text-sm text-muted-foreground">Organize os relatórios por cliente e aeronave.</p></div><Button type="button" onClick={onNovoRelatorio} className="gap-2 self-start lg:self-auto"><Plus size={16} /> Criar novo</Button></div>
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Relatórios de viagem"><button type="button" role="tab" aria-selected={visao === "finalizados"} onClick={() => mudarVisao("finalizados")} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${visao === "finalizados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Folder size={15} /> Relatórios finalizados <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{relatoriosFinalizados.length}</span></button><button type="button" role="tab" aria-selected={visao === "revisao"} onClick={() => mudarVisao("revisao")} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${visao === "revisao" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><CheckCircle2 size={15} /> Aprovados e rejeitados <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{relatoriosRevisao.length}</span></button><button type="button" role="tab" aria-selected={visao === "rascunhos"} onClick={() => mudarVisao("rascunhos")} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${visao === "rascunhos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><FileText size={15} /> Rascunhos <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{rascunhos.length}</span></button></div>
    {carregando ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-[70px] rounded-xl" />)}</div> : visao === "rascunhos" ? <Card className="border-border shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" /> Rascunhos</CardTitle></CardHeader><CardContent><ListaRelatorios relatorios={rascunhos} onAbrir={onAbrirRelatorio} /></CardContent></Card> : visao === "revisao" ? <Card className="border-border shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="size-5 text-primary" /> Prontos para enviar ou ajustar</CardTitle></CardHeader><CardContent><ListaRelatorios relatorios={relatoriosRevisao} onAbrir={onAbrirRelatorio} /></CardContent></Card> : cotista && aeronave ? <Card className="border-border shadow-card"><CardHeader><div className="flex min-w-0 items-center gap-3"><Button type="button" size="icon" variant="ghost" onClick={voltar} aria-label="Voltar para aeronaves"><ArrowLeft size={17} /></Button><div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{cotista.nome}</p><CardTitle className="flex min-w-0 items-center gap-2"><Plane className="size-5 shrink-0 text-primary" /> <span className="min-w-0 truncate">{aeronave.nome}</span></CardTitle></div><Badge variant="outline" className="ml-auto shrink-0">{aeronave.relatorios.length} {aeronave.relatorios.length === 1 ? "relatório" : "relatórios"}</Badge></div></CardHeader><CardContent><ListaRelatorios relatorios={aeronave.relatorios} onAbrir={onAbrirRelatorio} /></CardContent></Card> : cotista ? <Card className="border-border shadow-card"><CardHeader><div className="flex min-w-0 items-center gap-3"><Button type="button" size="icon" variant="ghost" onClick={voltar} aria-label="Voltar para clientes"><ArrowLeft size={17} /></Button><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Pasta do cliente</p><CardTitle className="truncate">{cotista.nome}</CardTitle></div><Badge variant="outline" className="ml-auto shrink-0">{aeronaves.length} {aeronaves.length === 1 ? "aeronave" : "aeronaves"}</Badge></div></CardHeader><CardContent>{aeronaves.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma aeronave encontrada para este cliente.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{aeronaves.map((item) => <AeronavePasta key={item.id} label={item.nome} count={item.relatorios.length} isOpen={aeronaveAberta === item.id} onClick={() => setAeronaveAberta(item.id)} />)}</div>}</CardContent></Card> : <Card className="border-border shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-primary" /> Pastas por cliente <Badge variant="outline" className="ml-1">{cotistas.length}</Badge></CardTitle></CardHeader><CardContent>{cotistas.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum relatório finalizado encontrado.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cotistas.map((item) => <AeronavePasta key={item.id} label={item.nome} count={item.relatorios.length} isOpen={cotistaAberto === item.id} onClick={() => setCotistaAberto(item.id)} />)}</div>}</CardContent></Card>}
  </section>;
}
