import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PenLine, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buscarPesoBalanceamentoVoo,
  salvarPesoBalanceamentoVoo,
  type ItemCarregamento,
  type PesoBalanceamentoContexto,
  type SolicitacaoVooInterna,
} from "@/lib/colaborador-api";

const DENSIDADE_AVGAS = 0.72;
const input = "h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary";
const cell = "rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary w-full";

const uid = () => Math.random().toString(36).slice(2, 10);
const n = (valor: unknown) => {
  const numero = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};
const fmt = (valor: number, casas = 1) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function itensPadrao(passageiros: number): ItemCarregamento[] {
  const base: ItemCarregamento[] = [
    { id: uid(), descricao: "Piloto", peso: null, braco: null },
    { id: uid(), descricao: "Copiloto", peso: null, braco: null },
  ];
  for (let i = 1; i <= Math.max(1, passageiros); i += 1) base.push({ id: uid(), descricao: `Passageiro ${i}`, peso: null, braco: null });
  base.push({ id: uid(), descricao: "Bagagem 1", peso: null, braco: null });
  base.push({ id: uid(), descricao: "Bagagem 2", peso: null, braco: null });
  return base;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Limite({ label, valor, unidade = "kg" }: { label: string; valor: number | null | undefined; unidade?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <strong className="text-[11px]">{valor === null || valor === undefined ? "—" : `${fmt(valor, 0)} ${unidade}`}</strong>
    </div>
  );
}

export default function PesoBalanceamentoFicha({ item }: { item: SolicitacaoVooInterna }) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [contexto, setContexto] = useState<PesoBalanceamentoContexto | null>(null);
  const [itens, setItens] = useState<ItemCarregamento[]>([]);
  const [litros, setLitros] = useState("");
  const [bracoFuel, setBracoFuel] = useState("");
  const [pesoVazio, setPesoVazio] = useState("");
  const [bracoVazio, setBracoVazio] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [assinatura, setAssinatura] = useState("");

  const ficha = contexto?.ficha ?? null;
  const somenteLeitura = ficha?.status === "FINALIZADA";
  const config = contexto?.configuracao ?? null;

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro("");
    buscarPesoBalanceamentoVoo(item.id)
      .then((dados) => {
        setContexto(dados);
        const salva = dados.ficha;
        setPesoVazio(String(salva?.peso_vazio_kg ?? dados.configuracao?.peso_vazio_padrao ?? ""));
        setBracoVazio(String(salva?.braco_vazio ?? dados.configuracao?.braco_cg_padrao ?? ""));
        setLitros(salva?.fuel_litros != null ? String(salva.fuel_litros) : "");
        setBracoFuel(salva?.fuel_braco != null ? String(salva.fuel_braco) : "");
        setObservacoes(salva?.observacoes ?? "");
        setAssinatura(salva?.assinatura_nome ?? dados.piloto?.nome ?? "");
        setItens(salva?.itens_carregamento?.length ? salva.itens_carregamento : itensPadrao(dados.solicitacao.numero_passageiros));
      })
      .catch((causa) => setErro(causa instanceof Error ? causa.message : "Não foi possível carregar a ficha."))
      .finally(() => setCarregando(false));
  }, [aberto, item.id]);

  const fuelKg = useMemo(() => n(litros) * DENSIDADE_AVGAS, [litros]);
  const linhasVazio = useMemo(() => ({ peso: n(pesoVazio), braco: n(bracoVazio), momento: n(pesoVazio) * n(bracoVazio) }), [pesoVazio, bracoVazio]);
  const momentoFuel = fuelKg * n(bracoFuel);

  const totais = useMemo(() => {
    const pesoItens = itens.reduce((soma, i) => soma + n(i.peso), 0);
    const momentoItens = itens.reduce((soma, i) => soma + n(i.peso) * n(i.braco), 0);
    const peso = linhasVazio.peso + pesoItens + fuelKg;
    const momento = linhasVazio.momento + momentoItens + momentoFuel;
    return { peso, momento, cg: peso > 0 ? momento / peso : 0 };
  }, [itens, linhasVazio, fuelKg, momentoFuel]);

  const dentroLimites = useMemo(() => {
    if (!config) return null;
    const pesoOk = totais.peso <= config.peso_maximo_decolagem;
    const cgOk = totais.cg >= config.cg_limite_dianteiro && totais.cg <= config.cg_limite_traseiro;
    return pesoOk && cgOk;
  }, [config, totais]);

  const atualizarItem = (id: string, campo: keyof ItemCarregamento, valor: string) =>
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, [campo]: campo === "descricao" ? valor : valor === "" ? null : n(valor) } : i)));

  const salvar = async (finalizar: boolean) => {
    if (!config) {
      setErro("Aeronave sem configuração de peso e balanceamento cadastrada no CTM.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const resposta = await salvarPesoBalanceamentoVoo(item.id, {
        peso_balanceamento_id: config.id,
        data_voo: item.data_agendada,
        numero_voo: item.numero_voo,
        piloto_responsavel: assinatura || contexto?.piloto?.nome || "Piloto",
        assinatura_nome: assinatura || contexto?.piloto?.nome || null,
        peso_vazio_kg: linhasVazio.peso,
        braco_vazio: linhasVazio.braco,
        momento_vazio: linhasVazio.momento,
        itens_carregamento: itens,
        fuel_litros: n(litros) || null,
        fuel_kg: fuelKg || null,
        fuel_braco: n(bracoFuel) || null,
        fuel_momento: momentoFuel || null,
        peso_total_kg: totais.peso,
        momento_total: totais.momento,
        cg_calculado: totais.cg,
        peso_maximo_decolagem: config.peso_maximo_decolagem,
        peso_maximo_pouso: config.peso_maximo_pouso,
        peso_maximo_sem_combustivel: config.peso_maximo_sem_combustivel,
        cg_limite_dianteiro: config.cg_limite_dianteiro,
        cg_limite_traseiro: config.cg_limite_traseiro,
        dentro_dos_limites: dentroLimites,
        status: finalizar ? "FINALIZADA" : "RASCUNHO",
        snapshot_limites: config,
        observacoes,
      });
      setContexto((atual) => (atual ? { ...atual, ficha: resposta.ficha } : atual));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível salvar a ficha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAberto(true)} className="h-9 gap-2 border-emerald-400/40 text-[10px] text-emerald-300">
        <Scale size={13} /> Gerar peso e balanceamento
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-4xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale size={17} className="text-primary" /> Ficha de peso e balanceamento
              {somenteLeitura && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">Finalizada</span>}
            </DialogTitle>
          </DialogHeader>

          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Carregando dados da aeronave…</div>
          ) : (
            <div className={`space-y-4 ${somenteLeitura ? "pointer-events-none opacity-90" : ""}`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo label="Aeronave"><input className={input} value={contexto?.solicitacao.matricula_registro || item.matricula_registro || ""} readOnly /></Campo>
                <Campo label="Modelo"><input className={input} value={contexto?.solicitacao.modelo || item.modelo || ""} readOnly /></Campo>
                <Campo label="Data"><input className={input} value={new Date(`${item.data_agendada}T00:00:00`).toLocaleDateString("pt-BR")} readOnly /></Campo>
                <Campo label="Piloto"><input className={input} value={contexto?.piloto?.nome || ""} readOnly /></Campo>
                <Campo label="Licença (CANAC)"><input className={input} value={contexto?.piloto?.canac || ""} readOnly /></Campo>
                <Campo label="Voo nº"><input className={input} value={contexto?.solicitacao.numero_voo || item.numero_voo || ""} readOnly /></Campo>
              </div>

              <div className="rounded-xl border border-border/70 bg-secondary/[.12] p-3">
                <strong className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Limites da aeronave</strong>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Limite label="Peso máximo de decolagem" valor={config?.peso_maximo_decolagem} />
                  <Limite label="Peso máximo de pouso" valor={config?.peso_maximo_pouso} />
                  <Limite label="Peso máx. sem combustível" valor={config?.peso_maximo_sem_combustivel} />
                  <Limite label="Capacidade de combustível" valor={config?.capacidade_combustivel_util} unidade="L" />
                  <Limite label="Limite de CG dianteiro" valor={config?.cg_limite_dianteiro} unidade="pol" />
                  <Limite label="Limite de CG traseiro" valor={config?.cg_limite_traseiro} unidade="pol" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="bg-secondary/[.18] text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                    <tr><th className="p-2 text-left">Itens</th><th className="p-2 text-left">Peso (kg)</th><th className="p-2 text-left">Braço (pol)</th><th className="p-2 text-right">Momento (kg x pol)</th><th /></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/60">
                      <td className="p-2">Peso básico da aeronave</td>
                      <td className="p-2"><input className={cell} value={pesoVazio} onChange={(e) => setPesoVazio(e.target.value)} inputMode="decimal" /></td>
                      <td className="p-2"><input className={cell} value={bracoVazio} onChange={(e) => setBracoVazio(e.target.value)} inputMode="decimal" /></td>
                      <td className="p-2 text-right font-semibold">{fmt(linhasVazio.momento)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border/60 bg-background/40">
                      <td className="p-2">Combustível <span className="text-[9px] text-muted-foreground">({fmt(n(litros), 0)} L × {DENSIDADE_AVGAS})</span></td>
                      <td className="p-2">
                        <input className={cell} value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="litros" inputMode="decimal" />
                        <small className="text-[9px] text-muted-foreground">{fmt(fuelKg)} kg</small>
                      </td>
                      <td className="p-2"><input className={cell} value={bracoFuel} onChange={(e) => setBracoFuel(e.target.value)} inputMode="decimal" /></td>
                      <td className="p-2 text-right font-semibold">{fmt(momentoFuel)}</td>
                      <td />
                    </tr>
                    {itens.map((linha) => (
                      <tr key={linha.id} className="border-t border-border/60">
                        <td className="p-2"><input className={cell} value={linha.descricao} onChange={(e) => atualizarItem(linha.id, "descricao", e.target.value)} /></td>
                        <td className="p-2"><input className={cell} value={linha.peso ?? ""} onChange={(e) => atualizarItem(linha.id, "peso", e.target.value)} inputMode="decimal" /></td>
                        <td className="p-2"><input className={cell} value={linha.braco ?? ""} onChange={(e) => atualizarItem(linha.id, "braco", e.target.value)} inputMode="decimal" /></td>
                        <td className="p-2 text-right font-semibold">{fmt(n(linha.peso) * n(linha.braco))}</td>
                        <td className="p-2 text-right">
                          <button type="button" onClick={() => setItens((atual) => atual.filter((i) => i.id !== linha.id))} className="rounded-lg border border-border p-1.5 text-red-300"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-secondary/[.14] text-sm">
                      <td className="p-2 font-extrabold">TOTAIS</td>
                      <td className="p-2 font-extrabold">{fmt(totais.peso)}</td>
                      <td className="p-2 font-extrabold">{fmt(totais.cg, 1)}</td>
                      <td className="p-2 text-right font-extrabold">{fmt(totais.momento)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              {!somenteLeitura && (
                <Button type="button" variant="outline" onClick={() => setItens((atual) => [...atual, { id: uid(), descricao: "Novo item", peso: null, braco: null }])} className="h-8 gap-2 text-[10px]">
                  <Plus size={12} /> Adicionar item
                </Button>
              )}

              <div className={`flex flex-col gap-2 rounded-xl border p-3 text-[11px] sm:flex-row sm:items-center sm:justify-between ${dentroLimites === false ? "border-red-400/40 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
                <span className="flex items-center gap-2 font-bold">
                  {dentroLimites === false ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  {dentroLimites === false ? "Fora dos limites da aeronave" : "Dentro dos limites da aeronave"}
                </span>
                <span>Peso total {fmt(totais.peso)} kg · Braço do CG {fmt(totais.cg)} pol</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Observações">
                  <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: voo local, combustível calibrado." className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary" />
                </Campo>
                <Campo label="Assinatura do tripulante">
                  <input className={input} value={assinatura} onChange={(e) => setAssinatura(e.target.value)} placeholder="Nome do tripulante" />
                  <small className="mt-1 block text-[9px] text-muted-foreground">
                    {ficha?.finalizado_em ? `Assinada em ${new Date(ficha.finalizado_em).toLocaleString("pt-BR")}` : "A data será registrada ao finalizar a ficha."}
                  </small>
                </Campo>
              </div>

              {erro && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-[10px] text-red-200">{erro}</div>}
            </div>
          )}

          {!carregando && (
            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
              {somenteLeitura ? (
                <Button type="button" variant="outline" onClick={() => setAberto(false)} className="h-9 text-[10px]">Fechar</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => void salvar(false)} disabled={salvando} className="h-9 gap-2 text-[10px]">Salvar rascunho</Button>
                  <Button type="button" onClick={() => void salvar(true)} disabled={salvando || !contexto?.configuracao} className="h-9 gap-2 text-[10px]">
                    {salvando ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} Finalizar e assinar
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
