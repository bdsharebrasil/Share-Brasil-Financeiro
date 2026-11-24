import { useEffect, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type AeronaveAgendamento, type ConfiguracaoPesoBalanceamento, type PontoEnvelopePeso } from "@/lib/colaborador-api";

const campos = [
  ["peso_vazio_padrao", "Peso básico vazio (kg)"],
  ["braco_cg_padrao", "Estação CG do peso básico (m/estação)"],
  ["peso_maximo_decolagem", "Peso máximo de decolagem (kg)"],
  ["peso_maximo_pouso", "Peso máximo de pouso (kg)"],
  ["peso_maximo_sem_combustivel", "Peso máximo zero combustível (kg)"],
  ["cg_limite_dianteiro", "Estação CG dianteira (m/estação)"],
  ["cg_limite_traseiro", "Estação CG traseira (m/estação)"],
  ["mac_comprimento", "MAC / CMA (m)"],
  ["lemac_distancia", "LEMAC a partir do datum (m)"],
] as const;
const entrada = "h-10 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition focus:border-primary";
type LinhaEnvelope = { peso_kg: string; cg_estacao: string };
type Props = { aeronaveFixa?: string; aeronaves: AeronaveAgendamento[]; inicial?: ConfiguracaoPesoBalanceamento | null; salvar: (dados: Partial<ConfiguracaoPesoBalanceamento> & { aeronave_id: string }) => Promise<unknown>; fechar: () => void };

function carregarPontos(config?: ConfiguracaoPesoBalanceamento | null): LinhaEnvelope[] {
  let valor: unknown = config?.envelope_pontos ?? config?.envelope_pontos_json;
  if (typeof valor === "string") {
    try { valor = JSON.parse(valor); } catch { valor = []; }
  }
  if (!Array.isArray(valor)) return [];
  return valor.map((ponto) => ({ peso_kg: String(ponto?.peso_kg ?? ""), cg_estacao: String(ponto?.cg_estacao ?? "") }));
}

export default function FormularioPesoBalanceamento({ aeronaves, inicial, salvar, fechar, aeronaveFixa }: Props) {
  const [dados, setDados] = useState<Record<string, unknown>>({ aeronave_id: inicial?.aeronave_id || aeronaveFixa || "", ...inicial });
  const [pontos, setPontos] = useState<LinhaEnvelope[]>(() => carregarPontos(inicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [revisado, setRevisado] = useState(inicial?.validado === true || inicial?.validado === 1);

  useEffect(() => {
    setDados({ aeronave_id: inicial?.aeronave_id || aeronaveFixa || "", ...inicial });
    setPontos(carregarPontos(inicial));
    setErro("");
    setRevisado(inicial?.validado === true || inicial?.validado === 1);
  }, [inicial, aeronaveFixa]);

  const alterar = (campo: string, valor: string) => { setRevisado(false); setDados((atual) => ({ ...atual, [campo]: valor === "" ? null : valor })); };
  const alterarPonto = (indice: number, campo: keyof LinhaEnvelope, valor: string) => { setRevisado(false); setPontos((atuais) => atuais.map((ponto, i) => i === indice ? { ...ponto, [campo]: valor } : ponto)); };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dados.aeronave_id) { setErro("Selecione uma aeronave."); return; }
    if (pontos.length < 3) { setErro("Transcreva no mínimo 3 vértices do envelope aprovado desta matrícula."); return; }
    const envelope: PontoEnvelopePeso[] = pontos.map((ponto) => ({ peso_kg: Number(ponto.peso_kg.replace(",", ".")), cg_estacao: Number(ponto.cg_estacao.replace(",", ".")) }));
    if (envelope.some((ponto) => !Number.isFinite(ponto.peso_kg) || ponto.peso_kg <= 0 || !Number.isFinite(ponto.cg_estacao))) {
      setErro("Todos os vértices precisam ter peso positivo em kg e estação CG válida em metros.");
      return;
    }
    const areaDobrada = envelope.reduce((soma, ponto, indice) => {
      const proximo = envelope[(indice + 1) % envelope.length];
      return soma + ponto.cg_estacao * proximo.peso_kg - proximo.cg_estacao * ponto.peso_kg;
    }, 0);
    if (new Set(envelope.map((ponto) => `${ponto.cg_estacao}:${ponto.peso_kg}`)).size < 3 || Math.abs(areaDobrada) < 1e-6) {
      setErro("Os vértices precisam formar um polígono não degenerado, com ao menos 3 pontos distintos.");
      return;
    }
    const camposEssenciais = campos.map(([campo]) => Number(String(dados[campo] ?? "").replace(",", ".")));
    if (camposEssenciais.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
      setErro("Complete os parâmetros técnicos essenciais com os valores da documentação aprovada. Valores zero não são avaliáveis.");
      return;
    }
    const dianteiro = Number(String(dados.cg_limite_dianteiro).replace(",", "."));
    const traseiro = Number(String(dados.cg_limite_traseiro).replace(",", "."));
    if (dianteiro >= traseiro) { setErro("A estação dianteira deve ser menor que a estação traseira."); return; }
    if (revisado && (!String(dados.responsavel_tecnico || "").trim() || !String(dados.numero_relatorio_pesagem || "").trim())) {
      setErro("Para marcar a configuração como revisada, informe o responsável técnico e a referência da documentação aprovada.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await salvar({ ...dados, aeronave_id: String(dados.aeronave_id), envelope_pontos_json: envelope, validado: revisado ? 1 : 0 });
      fechar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível salvar.");
    } finally { setSalvando(false); }
  };

  return <form onSubmit={enviar} className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
    {!aeronaveFixa && (<div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Manutenção · cadastro por matrícula</p><h3 className="text-base font-extrabold">{inicial ? "Atualizar configuração técnica" : "Novo peso e balanceamento"}</h3><p className="mt-1 text-[10px] text-muted-foreground">Registre parâmetros específicos da aeronave; salvar alterações deixa a configuração pendente de validação técnica.</p></div><button type="button" onClick={fechar} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Fechar"><X size={16} /></button></div>)}
    <label className="block space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Aeronave / matrícula</span><select className={entrada} value={String(dados.aeronave_id || "")} onChange={(e) => alterar("aeronave_id", e.target.value)} disabled={Boolean(inicial || aeronaveFixa)}><option value="">Selecione...</option>{aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro} · {aeronave.modelo}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{campos.map(([campo, rotulo]) => <label key={campo} className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{rotulo}</span><input className={entrada} type="number" min="0.0001" step="any" value={String(dados[campo] ?? "")} onChange={(e) => alterar(campo, e.target.value)} required /></label>)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Combustível utilizável (kg)</span><input className={entrada} type="number" min="0" step="any" value={String(dados.capacidade_combustivel_util ?? "")} onChange={(e) => alterar("capacidade_combustivel_util", e.target.value)} /></label><label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Responsável técnico</span><input className={entrada} value={String(dados.responsavel_tecnico ?? "")} onChange={(e) => alterar("responsavel_tecnico", e.target.value)} placeholder="Nome do responsável" /></label><label className="space-y-1 sm:col-span-2"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Referência do relatório/manual aprovado</span><input className={entrada} value={String(dados.numero_relatorio_pesagem ?? "")} onChange={(e) => alterar("numero_relatorio_pesagem", e.target.value)} placeholder="Documento e revisão específicos desta matrícula" /></label></div>
    <label className="block text-xs">Data da pesagem<input required={revisado} className={entrada} type="date" value={String(dados.data_ultima_pesagem??"").slice(0,10)} onChange={e=>alterar("data_ultima_pesagem",e.target.value)}/></label>
    <section className="space-y-3 rounded-xl border border-primary/25 bg-primary/[.04] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-xs font-bold">Envelope de peso × centro de gravidade</h4><p className="mt-1 max-w-3xl text-[10px] text-muted-foreground">Transcreva os vértices publicados no AFM/manual de voo, relatório de pesagem ou outra documentação aprovada específica desta matrícula. Não use valores genéricos de modelo. CG em m/estação; peso em kg.</p></div><Button type="button" variant="outline" onClick={() => setPontos((atuais) => [...atuais, { peso_kg: "", cg_estacao: "" }])} className="h-8 gap-1.5 text-[10px]"><Plus size={12} /> Vértice</Button></div>
      {pontos.length === 0 && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-[10px] text-amber-100">Nenhum envelope foi cadastrado. Sem 3 ou mais vértices aprovados, as fichas não serão avaliáveis.</p>}
      {pontos.map((ponto, indice) => <div key={indice} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Vértice {indice + 1} · peso (kg)</span><input aria-label={`Vértice ${indice + 1}: peso kg`} className={entrada} type="number" min="0.0001" step="any" value={ponto.peso_kg} onChange={(e) => alterarPonto(indice, "peso_kg", e.target.value)} /></label><label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">CG / estação (m/estação)</span><input aria-label={`Vértice ${indice + 1}: estação CG`} className={entrada} type="number" step="any" value={ponto.cg_estacao} onChange={(e) => alterarPonto(indice, "cg_estacao", e.target.value)} /></label><Button type="button" variant="outline" aria-label={`Remover vértice ${indice + 1}`} onClick={() => setPontos((atuais) => atuais.filter((_, i) => i !== indice))} className="h-10 w-10 px-0 text-red-300"><Trash2 size={13} /></Button></div>)}
    </section>
    <label className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-[10px]"><input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} className="mt-0.5 accent-primary" /><span><strong>Revisão técnica concluída.</strong> Confirmo que os parâmetros e vértices acima foram transcritos e conferidos na documentação aprovada específica desta matrícula. Marque somente após a revisão; a identificação do responsável técnico e a referência documental são obrigatórias para gravar como validado.</span></label>
    <label className="block space-y-1"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Observações técnicas</span><textarea className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-xs outline-none focus:border-primary" value={String(dados.notas ?? "")} onChange={(e) => alterar("notas", e.target.value)} /></label>
    <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-[10px] text-amber-100">Este cadastro não valida nem aprova a documentação. A configuração só será considerada avaliável após revisão técnica e validação por responsável autorizado. O software não substitui verificação, julgamento ou assinatura técnica.</p>
    {erro && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{erro}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={fechar}>Cancelar</Button><Button type="submit" disabled={salvando} className="gap-2"><Save size={14} />{salvando ? "Salvando..." : "Salvar configuração"}</Button></div>
  </form>;
}
