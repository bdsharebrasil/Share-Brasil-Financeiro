import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Info,
  Landmark,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { colaboradorRequest } from "@/lib/colaborador-api";

type Saldo = {
  id: string;
  nome: string;
  dominio: string;
  devidoCentavos: number;
  pagoCentavos: number;
  saldoCentavos: number;
};
type Linha = {
  id: string;
  participanteId: string;
  dominio: string;
  origemChave: string;
  competencia: string;
  categoria: string;
  descricao: string;
  tipo: string;
  devido: number;
};
type Balanco = {
  status: string;
  custoTotalCentavos: number;
  pagoPessoalCentavos: number;
  diferencaCustoPagamentoCentavos: number;
  saldos: Saldo[];
  linhas: Linha[];
  avisos: string[];
  compensacoes: { deId: string; paraId: string; valorCentavos: number }[];
  holdings: {
    dominio: string;
    saldoMovimentosAeronaveCentavos: number;
    aportesSemSocioCentavos: number;
    socios: (Saldo & { aporteCentavos: number; posicaoCentavos: number })[];
  }[];
};

const dinheiro = (valor: number) =>
  (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (valor: number) =>
  Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const mesLocal = () => {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
};

function valorCentavos(valor: string) {
  if (!/^\d+(,\d{1,2})?$/.test(valor)) return null;
  const [inteiroValor, fracao = ""] = valor.split(",");
  const cents = Number(inteiroValor) * 100 + Number(fracao.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function sinal(valor: number) {
  return valor > 0 ? "positivo" : valor < 0 ? "negativo" : "neutro";
}

function Avatar({ nome, holding = false }: { nome: string; holding?: boolean }) {
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${holding ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-primary/10 text-primary"}`}>
      {iniciais || <Users size={14} />}
    </span>
  );
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof WalletCards;
  tone?: "primary" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    primary: "border-primary/20 bg-primary/[.035] text-primary",
    emerald: "border-emerald-500/20 bg-emerald-500/[.035] text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/[.035] text-amber-700 dark:text-amber-300",
    violet: "border-violet-500/20 bg-violet-500/[.035] text-violet-700 dark:text-violet-300",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 ${tones[tone]}`}>
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-current opacity-[.04]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-current/10">
          <Icon size={15} />
        </span>
      </div>
    </div>
  );
}

/** Balanço econômico: responsabilidade pelo rateio separada do pagamento pessoal real. */
export function BalancoMensalCotista({
  aeronaveId,
  cotistaId,
}: {
  aeronaveId: string;
  cotistaId?: string;
}) {
  const [mes, setMes] = useState(mesLocal);
  const [dados, setDados] = useState<Balanco | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const chave = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro("");
    setCarregando(true);
    setOrigem("");
    setDestino("");
    colaboradorRequest<Balanco>(
      `/api/financeiro/cotista/balanco-mensal?aeronave_id=${encodeURIComponent(aeronaveId)}&competencia=${encodeURIComponent(mes)}`,
    )
      .then((resposta) => {
        if (vivo) setDados(resposta);
      })
      .catch((error) => {
        if (vivo) setErro(error instanceof Error ? error.message : "Falha ao carregar o balanço.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [aeronaveId, mes, revisao]);

  useEffect(() => {
    chave.current = null;
  }, [origem, destino, valor, motivo, aeronaveId, mes]);

  const saldos = dados?.saldos.filter((saldo) => !cotistaId || saldo.id === cotistaId) || [];
  const nomes = useMemo(
    () => new Map(dados?.saldos.map((saldo) => [saldo.id, saldo.nome]) || []),
    [dados],
  );
  const linha = dados?.linhas.find((item) => item.id === origem);
  const destinos = dados?.linhas.filter(
    (item) =>
      item.origemChave === linha?.origemChave &&
      item.dominio === linha?.dominio &&
      item.competencia === linha?.competencia &&
      item.participanteId !== linha?.participanteId,
  ) || [];

  async function salvar() {
    const cents = valorCentavos(valor);
    if (
      !linha ||
      !destinos.some((item) => item.id === destino) ||
      !cents ||
      cents > linha.devido ||
      motivo.trim().length < 5
    ) {
      setErro("Confira a origem, o destino, o valor e informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    setSalvando(true);
    setErro("");
    chave.current ||= crypto.randomUUID();
    try {
      await colaboradorRequest("/api/financeiro/cotista/balanco-ajustes", {
        method: "POST",
        body: JSON.stringify({
          aeronave_id: aeronaveId,
          origem_rateio_id: origem,
          destino_rateio_id: destino,
          valor_centavos: cents,
          motivo: motivo.trim(),
          idempotency_key: chave.current,
        }),
      });
      setValor("");
      setMotivo("");
      chave.current = null;
      setRevisao((atual) => atual + 1);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar o ajuste.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <section className="financeiro-panel flex min-h-[300px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={18} />
          </span>
          <p className="text-xs font-medium">Preparando o balanço da aeronave…</p>
        </div>
      </section>
    );
  }

  if (erro && !dados) {
    return (
      <section className="financeiro-panel flex flex-col items-center justify-center gap-3 border border-destructive/25 bg-destructive/5 p-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle size={17} /></span>
        <div><p className="text-sm font-bold">Não foi possível carregar o balanço</p><p className="mt-1 max-w-md text-xs text-muted-foreground">{erro}</p></div>
      </section>
    );
  }

  if (!dados) return null;

  return (
    <section className="space-y-4">
      <header className="financeiro-panel overflow-hidden">
        <div className="relative flex flex-col gap-4 bg-gradient-to-br from-primary/[.09] via-transparent to-violet-500/[.05] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck size={20} /></span>
            <div>
              <p className="financeiro-eyebrow">APURAÇÃO FINANCEIRA</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">Balanço mensal dos cotistas</h2>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">Responsabilidade do rateio e pagamento pessoal ficam separados para que a compensação reflita o dinheiro real.</p>
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 shadow-sm backdrop-blur">
            <CalendarDays size={14} className="text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Competência</span>
            <input aria-label="Competência" type="month" value={mes} min="2000-01" max="2099-12" disabled={salvando} onChange={(event) => setMes(event.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs font-semibold text-foreground outline-none" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-5 py-2.5 text-[10px] text-muted-foreground sm:px-6">
          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-300" />
          <span>Apuração preliminar</span><span className="text-border">•</span><span>Pagamentos considerados até o fim do mês</span>
          <span className="ml-auto rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold text-primary">{dados.status}</span>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Custo da aeronave" value={dinheiro(dados.custoTotalCentavos)} detail="Total das parcelas rateadas" icon={ReceiptText} tone="primary" />
        <Kpi label="Pagamentos pessoais" value={dinheiro(dados.pagoPessoalCentavos)} detail="Crédito pelo pagador real" icon={WalletCards} tone="emerald" />
        <Kpi label="Diferença a conciliar" value={dinheiro(dados.diferencaCustoPagamentoCentavos)} detail="Custo menos pagamentos pessoais" icon={Landmark} tone="amber" />
        <Kpi label="Compensações sugeridas" value={inteiro(dados.compensacoes.length)} detail="Transferências entre cotistas" icon={ArrowRight} tone="violet" />
      </div>

      {dados.avisos.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[.06] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300"><AlertTriangle size={14} /> Pontos que pedem conferência</div>
          <div className="space-y-1.5">{dados.avisos.map((aviso) => <p role="alert" key={aviso} className="pl-5 text-[11px] leading-relaxed text-muted-foreground">{aviso}</p>)}</div>
        </div>
      )}

      <section className="financeiro-panel overflow-hidden">
        <div className="financeiro-panel-header flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold">Posição por cotista</p><p className="mt-1 text-[10px] text-muted-foreground">Quanto cada pessoa deve, quanto pagou e o saldo econômico resultante.</p></div>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[9px] font-semibold text-muted-foreground">{saldos.length} participante(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead><tr className="border-b border-border bg-muted/20 text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3 font-bold">Cotista</th><th className="px-4 py-3 text-right font-bold">Custo devido</th><th className="px-4 py-3 text-right font-bold">Pago pessoal</th><th className="px-5 py-3 text-right font-bold">Saldo</th></tr></thead>
            <tbody className="divide-y divide-border/70">{saldos.map((saldo) => {
              const estado = sinal(saldo.saldoCentavos);
              return <tr key={saldo.id} className="transition-colors hover:bg-primary/[.035]">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><Avatar nome={saldo.nome} holding={saldo.dominio.startsWith("HOLD:")} /><div><p className="font-semibold text-foreground">{saldo.nome}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{saldo.dominio.startsWith("HOLD:") ? "Holding / conta conjunta" : "Cotista cliente"}</p></div></div></td>
                <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums">{dinheiro(saldo.devidoCentavos)}</td>
                <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{dinheiro(saldo.pagoCentavos)}</td>
                <td className={`px-5 py-3.5 text-right font-mono font-bold tabular-nums ${estado === "positivo" ? "text-emerald-700 dark:text-emerald-300" : estado === "negativo" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}><span className="inline-flex items-center gap-1.5">{saldo.saldoCentavos > 0 ? <ArrowUpRight size={13} /> : saldo.saldoCentavos < 0 ? <ArrowDownLeft size={13} /> : null}{dinheiro(saldo.saldoCentavos)}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <section className="financeiro-panel overflow-hidden">
          <div className="financeiro-panel-header"><div className="flex items-center gap-2"><ArrowRight size={15} className="text-violet-600 dark:text-violet-300" /><div><p className="text-sm font-bold">Compensação entre cotistas</p><p className="mt-1 text-[10px] text-muted-foreground">Sugestões baseadas em despesas identificadas. Nenhum pagamento é registrado aqui.</p></div></div></div>
          <div className="p-4">{dados.compensacoes.filter((item) => !cotistaId || item.deId === cotistaId || item.paraId === cotistaId).length ? <div className="space-y-2">{dados.compensacoes.filter((item) => !cotistaId || item.deId === cotistaId || item.paraId === cotistaId).map((item) => <div key={`${item.deId}:${item.paraId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[.04] px-3.5 py-3"><div className="flex min-w-0 items-center gap-2"><Avatar nome={nomes.get(item.deId) || "Cotista"} /><div className="flex items-center gap-2 text-xs font-semibold"><span className="truncate">{nomes.get(item.deId) || "Cotista"}</span><ArrowRight size={13} className="shrink-0 text-violet-500" /><span className="truncate">{nomes.get(item.paraId) || "Cotista"}</span></div></div><span className="font-mono text-sm font-bold text-violet-700 dark:text-violet-300">{dinheiro(item.valorCentavos)}</span></div>)}</div> : <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-8 text-center"><CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-300" /><p className="mt-2 text-xs font-semibold">Nenhuma compensação sugerida</p><p className="mt-1 text-[10px] text-muted-foreground">Com os pagamentos conhecidos, não há transferência bilateral pendente.</p></div>}</div>
        </section>

        <section className="financeiro-panel overflow-hidden">
          <div className="financeiro-panel-header"><div className="flex items-center gap-2"><Info size={15} className="text-primary" /><div><p className="text-sm font-bold">Como interpretar</p><p className="mt-1 text-[10px] text-muted-foreground">Leitura rápida do balanço</p></div></div></div>
          <div className="space-y-3 p-4 text-[11px] leading-relaxed text-muted-foreground"><p><strong className="text-foreground">Custo devido</strong> é a responsabilidade da parcela, mesmo quando ainda não foi paga.</p><p><strong className="text-foreground">Pago pessoal</strong> é o crédito de quem efetivamente desembolsou o valor.</p><p><strong className="text-foreground">Diferença</strong> também pode conter fornecedor pendente, valor devido à Share ou despesa da conta conjunta.</p></div>
        </section>
      </div>

      {dados.holdings.map((holding) => <section key={holding.dominio} className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Landmark size={15} className="text-violet-600 dark:text-violet-300" /><div><p className="text-sm font-bold">Conta conjunta · {holding.dominio.slice(5)}</p><p className="mt-1 text-[10px] text-muted-foreground">Posição acumulada dos movimentos vinculados à aeronave até o fim do mês.</p></div></div><span className="font-mono text-sm font-bold">{dinheiro(holding.saldoMovimentosAeronaveCentavos)}</span></div><div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">{holding.socios.filter((socio) => !cotistaId || socio.id === cotistaId).map((socio) => <div key={socio.id} className="rounded-xl border border-border bg-muted/15 p-3"><div className="flex items-center gap-2"><Avatar nome={socio.nome} holding /><p className="text-xs font-semibold">{socio.nome}</p></div><p className="mt-3 text-[10px] text-muted-foreground">Aportes + pagamentos pessoais − custo</p><p className="mt-1 font-mono text-sm font-bold text-violet-700 dark:text-violet-300">{dinheiro(socio.posicaoCentavos)}</p></div>)}</div>{holding.aportesSemSocioCentavos > 0 && <p className="border-t border-amber-500/20 bg-amber-500/[.05] px-4 py-3 text-[10px] text-amber-700 dark:text-amber-300">Aportes sem sócio identificado: <strong>{dinheiro(holding.aportesSemSocioCentavos)}</strong></p>}</section>)}

      <section className="financeiro-panel overflow-hidden">
        <div className="financeiro-panel-header"><div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-primary" /><div><p className="text-sm font-bold">Ajustar responsabilidade</p><p className="mt-1 text-[10px] text-muted-foreground">Transfira custo entre duas linhas da mesma origem sem alterar quem pagou.</p></div></div></div>
        <fieldset disabled={salvando} className="grid gap-3 p-4 lg:grid-cols-[1.3fr_1.05fr_.55fr_1.25fr_auto] lg:items-end">
          <label className="min-w-0"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Retirar custo de</span><select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" value={origem} onChange={(event) => { setOrigem(event.target.value); setDestino(""); }}><option value="">Selecione a despesa</option>{dados.linhas.filter((item) => item.devido > 0 && !item.origemChave.startsWith("SEM_VINCULO:")).map((item) => <option key={item.id} value={item.id}>{item.descricao} · {nomes.get(item.participanteId)} · {dinheiro(item.devido)}</option>)}</select></label>
          <label className="min-w-0"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Atribuir a</span><select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" value={destino} onChange={(event) => setDestino(event.target.value)}><option value="">Selecione o cotista</option>{destinos.map((item) => <option key={item.id} value={item.id}>{nomes.get(item.participanteId)}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Valor</span><input className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" inputMode="decimal" placeholder="100,00" value={valor} onChange={(event) => setValor(event.target.value)} /></label>
          <label className="min-w-0"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Motivo obrigatório</span><input className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={1000} placeholder="Ex.: despesa atribuída ao responsável" /></label>
          <button type="button" onClick={salvar} disabled={!origem || !destino || salvando} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{salvando ? "Salvando…" : "Salvar ajuste"}</button>
        </fieldset>
        {erro && <p role="alert" className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">{erro}</p>}
        <div className="flex items-start gap-2 border-t border-border bg-muted/15 px-4 py-3 text-[10px] leading-relaxed text-muted-foreground"><Info size={13} className="mt-0.5 shrink-0 text-primary" /><span>O histórico é imutável e o total da despesa permanece igual. Para desfazer, registre um ajuste inverso.</span></div>
      </section>
    </section>
  );
}
