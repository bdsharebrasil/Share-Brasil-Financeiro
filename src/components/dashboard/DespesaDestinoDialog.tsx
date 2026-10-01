import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { enviarEmailCliente, buscarOpcoesRateioMovimentacao, criarRateioMovimentacao, type MovimentacaoFinanceira, type OpcoesRateioMovimentacao } from "@/lib/colaborador-api";
import { EnviarEmailClienteDialog, type AnexoEmail } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";

type Props = { item: MovimentacaoFinanceira | null; open: boolean; onOpenChange: (open: boolean) => void; onCompleted: () => void };
const hoje = () => new Date().toISOString().slice(0, 10);

export function DespesaDestinoDialog({ item, open, onOpenChange, onCompleted }: Props) {
  const [etapa, setEtapa] = useState<"escolha" | "rateio">("escolha");
  const [opcoes, setOpcoes] = useState<OpcoesRateioMovimentacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [dataVencimento, setDataVencimento] = useState(hoje());
  const [periodicidade, setPeriodicidade] = useState("EVENTUAL");
  const [tipoRateio, setTipoRateio] = useState("EXTRA");
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setEtapa("escolha"); setErro(""); setOpcoes(null); setEmailOpen(false); setDataVencimento(hoje()); setPeriodicidade("EVENTUAL"); setTipoRateio("EXTRA");
  }, [open, item]);

  const carregarOpcoes = async () => {
    if (!item) return;
    setCarregando(true); setErro("");
    try {
      const resposta = await buscarOpcoesRateioMovimentacao(item.origem_tipo, item.origem_id);
      setOpcoes(resposta);
      setPercentuais(Object.fromEntries(resposta.cotistas.map((cotista) => [cotista.id, String(cotista.percentual_sugerido || 0)])));
      setEtapa("rateio");
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar os cotistas para o rateio."); }
    finally { setCarregando(false); }
  };

  const selecionados = useMemo(() => (opcoes?.cotistas || []).filter((cotista) => Number(percentuais[cotista.id] || 0) > 0), [opcoes, percentuais]);
  const total = selecionados.reduce((soma, cotista) => soma + Number(percentuais[cotista.id] || 0), 0);
  const salvarRateio = async () => {
    if (!item || !opcoes || !selecionados.length || Math.abs(total - 100) > 0.01) { setErro("Informe pelo menos um cotista e distribua exatamente 100%."); return; }
    setSalvando(true); setErro("");
    try {
      await criarRateioMovimentacao(item.origem_tipo, item.origem_id, { data_vencimento: dataVencimento, periodicidade, tipo_rateio: tipoRateio, linhas: selecionados.map((cotista) => ({ cotista_id: cotista.id, percentual: Number(percentuais[cotista.id]) })) });
      onOpenChange(false); onCompleted();
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível salvar o rateio."); }
    finally { setSalvando(false); }
  };
  if (!open || !item) return null;
  const anexos: AnexoEmail[] = (item.anexos || []).map((anexo) => ({ id: anexo.id, label: anexo.nome || anexo.filename, filename: anexo.nome || anexo.filename }));
  const destinatario = item.destinatario_email || "";
  const referencias = [`${item.origem_tipo === "lancamentos" ? "lancamento" : "movimento_holding"}:${item.origem_id}`, ...item.referencias];
  return <>
    {etapa === "escolha" && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Destino da despesa</p><h2 className="mt-1 text-lg font-bold">Essa despesa é rateada em balanço?</h2><p className="mt-2 text-xs text-muted-foreground">{item.descricao}</p></div><button type="button" onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={16} /></button></div><div className="mt-5 grid gap-2"><button type="button" onClick={() => void carregarOpcoes()} disabled={carregando} className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left text-sm font-semibold hover:bg-primary/15">{carregando ? <Loader2 size={15} className="inline animate-spin" /> : "Essa despesa é rateada em balanço"}</button><button type="button" onClick={() => setEmailOpen(true)} className="rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold hover:bg-muted">Essa despesa não faz parte do balanço cliente</button></div>{erro && <p className="mt-3 text-xs text-red-500">{erro}</p>}</div></div>}
    {etapa === "rateio" && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Envio de despesa cliente</p><h2 className="mt-1 text-lg font-bold">Definir rateio da despesa</h2></div><button type="button" onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={16} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Vencimento<input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs" /></label><label className="text-xs font-semibold">Periodicidade<select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"><option>EVENTUAL</option><option>ÚNICO</option><option>MENSAL</option><option>ANUAL</option></select></label><label className="text-xs font-semibold">Tipo de rateio<select value={tipoRateio} onChange={(e) => setTipoRateio(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"><option>EXTRA</option><option>FIXO</option><option>VARIAVEL_POR_VOO</option><option>VARIAVEL_POR_HORA</option></select></label></div><div className="mt-4 rounded-xl border border-border/70 p-4"><div className="flex justify-between text-xs font-bold"><span>Cotistas</span><span className={Math.abs(total - 100) < .01 ? "text-emerald-500" : "text-amber-500"}>{total.toFixed(2)}%</span></div><div className="mt-3 space-y-2">{(opcoes?.cotistas || []).map((cotista) => <label key={cotista.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">{cotista.nome}</span><span className="text-[10px] text-muted-foreground">Sugestão {cotista.percentual_sugerido}%</span><input type="number" min="0" max="100" step="0.01" value={percentuais[cotista.id] || "0"} onChange={(e) => setPercentuais((atual) => ({ ...atual, [cotista.id]: e.target.value }))} className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-right" /></label>)}</div></div>{erro && <p className="mt-3 text-xs text-red-500">{erro}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEtapa("escolha")} className="rounded-lg border border-border px-4 py-2 text-xs">Voltar</button><button type="button" onClick={() => void salvarRateio()} disabled={salvando} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">{salvando ? "Salvando..." : "Salvar rateio"}</button></div></div></div>}
    <EnviarEmailClienteDialog open={emailOpen} onOpenChange={(value) => { setEmailOpen(value); if (!value) onOpenChange(false); }} onSent={() => { setEmailOpen(false); onOpenChange(false); onCompleted(); }} destinatarioInicial={destinatario} assuntoSugerido={item.descricao || "Despesa financeira"} mensagemSugerida={`Prezados,\n\nSegue a despesa ${item.numero_doc || item.descricao || "financeira"} para conhecimento.\n\nValor: ${item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`} anexos={anexos} referencias={referencias} />
  </>;
}
