import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Folder, Plane, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoSecao, EstadoVazio, EtiquetaStatus, formatarMoeda } from "@/components/dashboard/ComponentesDashboard";
import { buscarMovimentacoesFinanceiras, type PastaMovimentacoesFinanceiras } from "@/lib/colaborador-api";

type Despesa = PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null) {
  return status ? status.replace(/_/g, " ") : "Sem status";
}

function statusTone(status: string | null): "green" | "amber" | "red" | "blue" | "violet" | "neutral" {
  const value = (status || "").toLowerCase();
  if (["pago", "aprovado", "recebido", "reembolsado"].includes(value)) return "green";
  if (["cancelado", "reprovado", "estorno"].includes(value)) return "red";
  if (["pendente", "em_aberto", "aguardando_reembolso"].includes(value)) return "amber";
  if (["enviado"].includes(value)) return "blue";
  return "neutral";
}

function DespesasTabela({ despesas }: { despesas: Despesa[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/50">
      <table className="w-full min-w-[920px] text-left">
        <thead>
          <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
            <th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Nº doc</th>
            <th className="px-4 py-3">Caixa</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">E-mail</th>
          </tr>
        </thead>
        <tbody>
          {despesas.map((despesa) => (
            <tr key={`${despesa.id}-${despesa.origem || "despesa"}`} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{dataBruta(despesa.data)}</td>
              <td className="px-4 py-3 text-sm font-semibold">{despesa.descricao || "Despesa sem descrição"}</td>
              <td className="px-4 py-3 text-sm">{despesa.numero_doc || "—"}</td>
              <td className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">{despesa.tipo_caixa || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold">{formatarMoeda(Number(despesa.valor) || 0)}</td>
              <td className="px-4 py-3"><EtiquetaStatus tone={statusTone(despesa.status)}>{statusLabel(despesa.status)}</EtiquetaStatus></td>
              <td className="px-4 py-3 text-[10px] font-bold uppercase text-muted-foreground">{despesa.email || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MovimentacoesFinanceiras({ aoVoltar }: { aoVoltar: () => void }) {
  const [pastas, setPastas] = useState<PastaMovimentacoesFinanceiras[]>([]);
  const [pastaAberta, setPastaAberta] = useState<string | null>(null);
  const [vooAberto, setVooAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true); setErro(null);
    try { setPastas((await buscarMovimentacoesFinanceiras()).pastas || []); }
    catch { setErro("Não foi possível carregar todas as movimentações financeiras."); }
    finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); }, []);

  return (
    <div className="route-enter space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro / Movimentações</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Todas as movimentações financeiras</h1><p className="mt-1 text-xs text-muted-foreground">Consulte despesas organizadas por cotista e número de voo.</p></div>
        <div className="flex gap-2"><Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={aoVoltar}><ArrowLeft size={14} /> Voltar</Button><Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={() => void carregar()} disabled={carregando}><RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar</Button></div>
      </div>
      {erro && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-600">{erro}</div>}
      {carregando ? <div className="space-y-3"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div> : !pastas.length ? <EstadoVazio label="Nenhuma movimentação financeira encontrada" /> : <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Folder size={15} />} title="Pastas de cotistas" detail={`${pastas.reduce((total, pasta) => total + pasta.quantidade, 0)} movimentações consolidadas`} />
        <div className="divide-y divide-border/70">{pastas.map((pasta) => { const aberta = pastaAberta === pasta.id; return <div key={pasta.id}><button type="button" className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20" onClick={() => { setPastaAberta(aberta ? null : pasta.id); setVooAberto(null); }}><span className="text-muted-foreground">{aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span><Folder size={18} className="text-amber-500" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{pasta.nome}</span><span className="text-xs text-muted-foreground">{pasta.quantidade} itens</span></button>{aberta && <div className="space-y-3 bg-secondary/10 p-4">{pasta.voos.map((voo) => { const chave = `${pasta.id}:${voo.numero_voo}`; const vooAbertoAtual = vooAberto === chave; return <div key={chave} className="rounded-xl border border-border/70 bg-card/60"><button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setVooAberto(vooAbertoAtual ? null : chave)}><span className="text-muted-foreground">{vooAbertoAtual ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><Plane size={15} className="text-primary" /><span className="flex-1 font-mono text-sm font-bold">{voo.numero_voo}</span><span className="text-xs text-muted-foreground">{voo.quantidade} despesas</span></button>{vooAbertoAtual && <div className="border-t border-border/70 p-3"><DespesasTabela despesas={voo.despesas} /></div>}</div>; })}</div>}</div>; })}</div>
      </section>}
    </div>
  );
}
