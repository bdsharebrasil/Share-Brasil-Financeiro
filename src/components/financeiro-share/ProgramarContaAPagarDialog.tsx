import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buscarCotistasAeronave, programarContaAPagarRecibo, type CategoriaClienteRecibo, type CotistaAeronave, type Recibo } from "@/lib/colaborador-api";

const tipos = ["FIXO", "VARIAVEL_POR_VOO", "VARIAVEL_POR_HORA", "EXTRA"] as const;
const periodicidades = ["ÚNICO", "EVENTUAL", "MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
const hoje = () => new Date().toISOString().slice(0, 10);

type Props = { open: boolean; recibo: Recibo | null; aeronaves: Array<{ id: string; matricula_registro: string }>; categorias: CategoriaClienteRecibo[]; onOpenChange: (open: boolean) => void; onSaved: () => void };

export default function ProgramarContaAPagarDialog({ open, recibo, aeronaves, categorias, onOpenChange, onSaved }: Props) {
  const [aeronaveId, setAeronaveId] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [tipoRateio, setTipoRateio] = useState<(typeof tipos)[number]>("FIXO");
  const [periodicidade, setPeriodicidade] = useState("ÚNICO");
  const [cotistas, setCotistas] = useState<CotistaAeronave[]>([]);
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carregandoCotistas, setCarregandoCotistas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const categoriaSelecionada = categorias.find((item) => item.id === categoriaId);
  const subcategorias = useMemo(() => [categoriaSelecionada?.subcategoria_1, categoriaSelecionada?.subcategoria_2, categoriaSelecionada?.subcategoria_3, categoriaSelecionada?.subcategoria_4].filter((item): item is string => Boolean(item?.trim())), [categoriaSelecionada]);

  useEffect(() => {
    if (!open || !recibo) return;
    setAeronaveId(recibo.aeronave_id || ""); setDataVencimento(recibo.data_vencimento || hoje()); setCategoriaId(""); setSubcategoria(""); setTipoRateio("FIXO"); setPeriodicidade("ÚNICO"); setObservacoes(""); setErro(""); setCotistas([]); setPercentuais({});
  }, [open, recibo]);

  useEffect(() => {
    if (!aeronaveId) { setCotistas([]); return; }
    setCarregandoCotistas(true);
    void buscarCotistasAeronave(aeronaveId).then((resposta) => { setCotistas(resposta.cotistas || []); setPercentuais((atual) => Object.fromEntries((resposta.cotistas || []).map((cotista) => [cotista.id, atual[cotista.id] || "0"]))); }).catch((cause) => setErro(cause instanceof Error ? cause.message : "Não foi possível carregar os cotistas da aeronave.")).finally(() => setCarregandoCotistas(false));
  }, [aeronaveId]);

  const selecionados = useMemo(() => cotistas.filter((cotista) => Number(percentuais[cotista.id] || 0) > 0), [cotistas, percentuais]);
  const totalPercentual = selecionados.reduce((total, cotista) => total + Number(percentuais[cotista.id] || 0), 0);
  const salvar = async () => {
    if (!recibo || !aeronaveId || !dataVencimento || !selecionados.length || Math.abs(totalPercentual - 100) > 0.01) { setErro("Informe aeronave, vencimento e percentuais dos cotistas somando 100%."); return; }
    setSalvando(true); setErro("");
    try {
      await programarContaAPagarRecibo(recibo.id, { aeronave_id: aeronaveId, data_vencimento: dataVencimento, categoria_id: categoriaId || null, categoria_nome: categoriaSelecionada?.nome || null, subcategoria_1: subcategoria || null, subcategoria_2: null, subcategoria_3: null, subcategoria_4: null, tipo_rateio: tipoRateio, periodicidade, observacoes: observacoes.trim() || null, linhas: selecionados.map((cotista) => ({ cotista_id: cotista.id, percentual_uso: Number(percentuais[cotista.id]) })) });
      onSaved(); onOpenChange(false);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível programar a conta a pagar."); } finally { setSalvando(false); }
  };

  if (!open || !recibo) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl md:p-7"><div className="mb-5 flex items-start justify-between border-b border-border/60 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Programação financeira</p><h2 className="mt-1 text-lg font-bold">Programar contas a pagar</h2><p className="mt-1 text-[11px] text-muted-foreground">Recibo {recibo.numero_recibo} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(recibo.valor || 0) / 100)}</p></div><button type="button" onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={16} /></button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Aeronave<select value={aeronaveId} onChange={(event) => setAeronaveId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"><option value="">Selecione a aeronave</option>{aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}</option>)}</select></label><label className="text-xs font-semibold">Vencimento<span className="relative mt-1 block"><CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs" /></span></label><label className="text-xs font-semibold">Categoria do cliente<select value={categoriaId} onChange={(event) => { setCategoriaId(event.target.value); setSubcategoria(""); }} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"><option value="">Selecione a categoria</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select></label>{subcategorias.length > 0 && <label className="text-xs font-semibold">Subcategoria<select value={subcategoria} onChange={(event) => setSubcategoria(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"><option value="">Selecione a subcategoria</option>{subcategorias.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}<label className="text-xs font-semibold">Tipo de rateio<select value={tipoRateio} onChange={(event) => setTipoRateio(event.target.value as (typeof tipos)[number])} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs">{tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label><label className="text-xs font-semibold">Periodicidade<select value={periodicidade} onChange={(event) => setPeriodicidade(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs">{periodicidades.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="mt-5 rounded-xl border border-border/70 p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold">Cotistas e percentual de uso</p><span className={`font-mono text-xs font-bold ${Math.abs(totalPercentual - 100) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>{totalPercentual.toFixed(2)}%</span></div>{carregandoCotistas ? <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Carregando cotistas...</div> : !aeronaveId ? <p className="mt-3 text-xs text-muted-foreground">Selecione a aeronave para listar os cotistas.</p> : <div className="mt-3 space-y-2">{cotistas.map((cotista) => <label key={cotista.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">{cotista.nome}</span><span className="text-[10px] text-muted-foreground">Sociedade {Number(cotista.percentual_sociedade || 0).toFixed(2)}%</span><input type="number" min="0" max="100" step="0.01" value={percentuais[cotista.id] || "0"} onChange={(event) => setPercentuais((atual) => ({ ...atual, [cotista.id]: event.target.value }))} className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-right text-xs" /></label>)}</div>}</div><label className="mt-4 block text-xs font-semibold">Observações<textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-border bg-card p-3 text-xs" /></label>{erro && <p className="mt-3 text-xs font-semibold text-red-600">{erro}</p>}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void salvar()} disabled={salvando || carregandoCotistas} className="gap-2">{salvando && <Loader2 size={14} className="animate-spin" />} Gravar programação</Button></div></div></div>;
}
