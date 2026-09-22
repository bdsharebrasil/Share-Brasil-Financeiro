import { useEffect, useMemo, useState } from "react";
import { CheckSquare, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buscarReembolsosPendentes, baixarReembolsosConsolidados, formatarCentavos, type ReembolsoPendente } from "@/lib/financeiro-share-api";

export function AbaReembolsos() {
  const [items, setItems] = useState<ReembolsoPendente[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pagador, setPagador] = useState("");
  const [banco, setBanco] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [comprovante, setComprovante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const carregar = () => { setCarregando(true); void buscarReembolsosPendentes().then(setItems).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar reembolsos")).finally(() => setCarregando(false)); };
  useEffect(carregar, []);
  const ativos = useMemo(() => items.filter((item) => selecionados.includes(item.id)), [items, selecionados]);
  const total = ativos.reduce((sum, item) => sum + item.valor_pendente_centavos, 0);
  const alternar = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]);
  async function baixar() { if (!pagador || !banco || !ativos.length) return; setSalvando(true); try { await baixarReembolsosConsolidados({ reembolso_ids: selecionados, tipo_pagador: "COTISTA", pagador_cotista_id: pagador, banco, valor_centavos: total, data_pagamento: data, comprovante }); setSelecionados([]); carregar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha na baixa consolidada"); } finally { setSalvando(false); } }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-bold">Reembolsos Pendentes</h2><p className="text-xs text-muted-foreground">Uma obrigação por despesa; o rateio registra quem efetivamente pagou.</p></div><Button variant="outline" size="sm" onClick={carregar}><RefreshCw size={14} className="mr-2" /> Atualizar D1</Button></div>
    {erro && <p className="rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-xs text-red-600">{erro}</p>}
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[850px] text-xs"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Selecionar</th><th className="p-3 text-left">Despesa</th><th className="p-3 text-left">Aeronave</th><th className="p-3 text-left">Cliente/Cotista</th><th className="p-3 text-right">Valor total</th><th className="p-3 text-right">Devido</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Pendente</th><th className="p-3 text-left">Status</th></tr></thead><tbody className="divide-y divide-border">{carregando ? <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Carregando dados reais do D1…</td></tr> : items.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum reembolso pendente.</td></tr> : items.map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="p-3"><button type="button" aria-label="Selecionar pendência" onClick={() => alternar(item.id)} className="text-primary">{selecionados.includes(item.id) ? <CheckSquare size={16} /> : <span className="inline-block h-4 w-4 rounded border border-border" />}</button></td><td className="p-3 font-medium">{item.descricao || "Despesa"}</td><td className="p-3">{item.aeronave || "—"}</td><td className="p-3">{item.cotista_nome || "—"}</td><td className="p-3 text-right">{formatarCentavos(item.valor_total_centavos)}</td><td className="p-3 text-right">{formatarCentavos(item.valor_devido_centavos)}</td><td className="p-3 text-right text-emerald-600">{formatarCentavos(item.valor_recebido_centavos)}</td><td className="p-3 text-right font-bold text-amber-600">{formatarCentavos(item.valor_pendente_centavos)}</td><td className="p-3">{item.status}</td></tr>)}</tbody></table></div>
    {ativos.length > 0 && <section className="rounded-xl border border-primary/20 bg-primary/[.04] p-4"><div className="mb-3 flex items-center gap-2"><Wallet size={16} className="text-primary" /><p className="text-sm font-bold">Baixa consolidada · {formatarCentavos(total)}</p></div><div className="grid gap-3 md:grid-cols-4"><input className="h-9 rounded-lg border border-border bg-background px-3 text-xs" placeholder="Quem pagou (ID cotista)" value={pagador} onChange={(e) => setPagador(e.target.value)} /><input className="h-9 rounded-lg border border-border bg-background px-3 text-xs" placeholder="Banco / conta" value={banco} onChange={(e) => setBanco(e.target.value)} /><input type="date" className="h-9 rounded-lg border border-border bg-background px-3 text-xs" value={data} onChange={(e) => setData(e.target.value)} /><input className="h-9 rounded-lg border border-border bg-background px-3 text-xs" placeholder="URL do comprovante" value={comprovante} onChange={(e) => setComprovante(e.target.value)} /></div><Button className="mt-3" disabled={salvando || !pagador || !banco} onClick={() => void baixar()}>{salvando ? "Baixando…" : "Registrar transferência e baixar selecionadas"}</Button></section>}
  </div>;
}
