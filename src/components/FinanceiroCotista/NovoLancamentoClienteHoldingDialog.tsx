/**
 * NovoLancamentoClienteHoldingDialog.tsx
 * ----------------------------------------------------------------------------
 * Financeiro Cotista > Dashboard Gestor
 *
 * Substitui o antigo `NovoLancamentoCotistaDialog` por um diálogo com DUAS
 * abas, porque "cliente" e "hold" seguem fluxos financeiros diferentes no D1
 * (ver explicacao.txt):
 *
 *  CLIENTE (cotista_aeronave.cliente_id preenchido)
 *  ─────────────────────────────────────────────────
 *  - "Reembolsável": a Share paga e depois cobra do(s) cotista(s).
 *      → 1 linha em `lancamentos`   (fluxo='DESPESA', tipo_caixa='SHARE',
 *        grupo_categoria='DESPESAS REEMBOLSÁVEIS', reembolsavel=1, status ABERTO)
 *      → N linhas em `rateio_despesas` (uma por cotista, status='PENDENTE')
 *  - "Direto": o cliente já pagou do próprio bolso, a Share nunca vê o dinheiro.
 *      → 0 linhas em `lancamentos`
 *      → 1 linha em `rateio_despesas` (status='PAGO_DIRETAMENTE', pago_diretamente=1)
 *
 *  HOLDING (cotista_aeronave.socio_id preenchido → hold_socios)
 *  ─────────────────────────────────────────────────
 *  - "Aporte": um sócio deposita na conta conjunta do hold.
 *      → 1 linha em `movimentos_holding` (fluxo ENTRADA)
 *  - "Despesa (conta conjunta)": paga com o saldo já aportado.
 *      → 1 linha em `movimentos_holding` (fluxo SAIDA)
 *      → N linhas em `rateio_hold` (uma por sócio, status='PAGO')
 *  - "Despesa (pago do bolso do sócio)": o sócio pagou sem usar a conta conjunta.
 *      → 0 linhas em `movimentos_holding`
 *      → 1 linha em `rateio_hold` (pago_diretamente=1, pago_por_socio_id=<sócio>)
 *
 *  A Share só entra na tabela `lancamentos` para o hold quando emite NF/recibo
 *  de saída (cobrança mensal de administração + pilotagem) — isso é outro
 *  fluxo (emissão de NF/recibo), não este diálogo de lançamento manual.
 *
 * ----------------------------------------------------------------------------
 * CONTRATO DE API ESPERADO (a implementar no Worker Hono / lib do frontend)
 * Os nomes abaixo são sugestões — ajuste para o padrão real do seu backend-share.
 * Todas as funções recebem/retornam valores em centavos (inteiros).
 * ----------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, HandCoins, Loader2, Landmark, Plus, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { criarLancamentoEconomico } from "@/lib/financeiro-share-api";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Uma linha de `cotista_aeronave`, já anotada com o tipo real de cotista. */
export type CotistaDaAeronave = {
  id: string; // cotista_aeronave.id
  nome: string;
  percentual_sociedade: number;
  tipo: "cliente" | "hold";
  // presentes apenas quando tipo === "hold"
  holding_id?: string;
  socio_id?: string;
};

export type CategoriaOpcao = { id: string; nome: string; grupo?: string };

export type OpcoesLancamentoClienteHold = {
  categoriasCliente: CategoriaOpcao[]; // categoria_movimentacao_share (grupo DESPESAS REEMBOLSÁVEIS etc.)
  categoriasHold: CategoriaOpcao[]; // categoria_movimentacao_cliente (reaproveitada para rateio_hold)
  contasBancarias: { id: string; nome: string }[];
};

type RateioDraft = { cotistaId: string; nome: string; percentual: string };

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function parseValorReais(value: string): number {
  const n = value.trim().replace(/\./g, "").replace(",", ".");
  const num = Number(n);
  return Number.isFinite(num) ? Math.round(num * 100) : Number.NaN;
}

function centavosPorPercentual(totalCentavos: number, percentual: number): number {
  return Math.round((totalCentavos * percentual) / 100);
}

// ---------------------------------------------------------------------------
// Funções de API — TODO: substituir pelas chamadas reais ao backend-share (D1)
// Mantidas aqui como stubs tipados para deixar o contrato explícito.
// ---------------------------------------------------------------------------

async function criarLancamentoClienteReembolsavel(payload: {
  aeronaveId: string;
  descricao: string;
  categoriaId: string;
  categoriaNome: string;
  grupoCategoria: string;
  valorTotalCentavos: number;
  dataEmissao: string;
  contaBancariaId?: string;
  observacoes?: string;
  rateios: { cotistaAeronaveId: string; percentual: number; valorRateadoCentavos: number }[];
  pagoPorCotistaAeronaveId?: string; // se um só cotista adiantou por todos
}): Promise<void> {
  await criarLancamentoEconomico({
    fluxo: "SAIDA", data: payload.dataEmissao, descricao: payload.descricao,
    categoria_id: payload.categoriaId, categoria_nome: payload.categoriaNome,
    grupo_categoria: payload.grupoCategoria, aeronave_id: payload.aeronaveId,
    valor_centavos: payload.valorTotalCentavos, reembolsavel: true,
    pago_diretamente: false, cotista_aeronave_id: payload.rateios[0]?.cotistaAeronaveId,
    rateios: payload.rateios.map((line) => ({
      cotista_id: line.cotistaAeronaveId, percentual: line.percentual,
      valor_centavos: line.valorRateadoCentavos,
      pago_por: payload.pagoPorCotistaAeronaveId,
    })), observacoes: payload.observacoes,
  });
}

async function criarRateioClienteDireto(payload: {
  aeronaveId: string;
  cotistaAeronaveId: string;
  categoriaId: string;
  categoriaNome: string;
  valorTotalCentavos: number;
  descricaoDespesa: string;
  observacoes?: string;
}): Promise<void> {
  await criarLancamentoEconomico({
    fluxo: "SAIDA", data: hoje(), descricao: payload.descricaoDespesa,
    categoria_id: payload.categoriaId, categoria_nome: payload.categoriaNome,
    aeronave_id: payload.aeronaveId, cotista_aeronave_id: payload.cotistaAeronaveId,
    valor_centavos: payload.valorTotalCentavos, pago_diretamente: true,
    tipo_rateio: "EXTRA", periodicidade: "ÚNICO",
    rateios: [{ cotista_id: payload.cotistaAeronaveId, percentual: 100, valor_centavos: payload.valorTotalCentavos, pago_por: payload.cotistaAeronaveId }],
    observacoes: payload.observacoes,
  });
}

async function criarMovimentoHoldingAporte(payload: {
  holdingId: string;
  socioId: string;
  aeronaveId: string;
  valorCentavos: number;
  data: string;
  contaBancariaId?: string;
  observacoes?: string;
}): Promise<void> {
  await criarLancamentoEconomico({
    fluxo: "ENTRADA", data: payload.data, descricao: "Aporte na holding",
    holding_id: payload.holdingId, socio_id: payload.socioId,
    aeronave_id: payload.aeronaveId, valor_centavos: payload.valorCentavos,
    pago_diretamente: true, observacoes: payload.observacoes,
  });
}

async function criarDespesaHoldingContaConjunta(payload: {
  holdingId: string;
  aeronaveId: string;
  descricao: string;
  categoriaId: string;
  categoriaNome: string;
  valorTotalCentavos: number;
  data: string;
  contaBancariaId?: string;
  observacoes?: string;
  rateios: { socioId: string; percentual: number; valorRateadoCentavos: number }[];
}): Promise<void> {
  await criarLancamentoEconomico({
    fluxo: "SAIDA", data: payload.data, descricao: payload.descricao,
    holding_id: payload.holdingId, socio_id: payload.rateios[0]?.socioId,
    aeronave_id: payload.aeronaveId, categoria_id: payload.categoriaId,
    categoria_nome: payload.categoriaNome, valor_centavos: payload.valorTotalCentavos,
    pago_diretamente: false,
    rateios: payload.rateios.map((line) => ({ socio_id: line.socioId, percentual: line.percentual, valor_centavos: line.valorRateadoCentavos })),
    observacoes: payload.observacoes,
  });
}

async function criarDespesaHoldingPagoDireto(payload: {
  holdingId: string;
  aeronaveId: string;
  socioPagadorId: string;
  categoriaId: string;
  categoriaNome: string;
  valorTotalCentavos: number;
  descricaoDespesa: string;
  observacoes?: string;
}): Promise<void> {
  await criarLancamentoEconomico({
    fluxo: "SAIDA", data: hoje(), descricao: payload.descricaoDespesa,
    holding_id: payload.holdingId, socio_id: payload.socioPagadorId,
    aeronave_id: payload.aeronaveId, categoria_id: payload.categoriaId,
    categoria_nome: payload.categoriaNome, valor_centavos: payload.valorTotalCentavos,
    pago_diretamente: true, tipo_rateio: "EXTRA", periodicidade: "ÚNICO",
    rateios: [{ socio_id: payload.socioPagadorId, percentual: 100, valor_centavos: payload.valorTotalCentavos }],
    observacoes: payload.observacoes,
  });
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function NovoLancamentoClienteHoldingDialog({
  aberto,
  aoFechar,
  aeronaveId,
  cotistas,
  opcoes,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aeronaveId: string;
  cotistas: CotistaDaAeronave[];
  opcoes: OpcoesLancamentoClienteHold | null;
  aoCriar: () => Promise<void>;
}) {
  const cotistasCliente = useMemo(() => cotistas.filter((c) => c.tipo === "cliente"), [cotistas]);
  const cotistasHold = useMemo(() => cotistas.filter((c) => c.tipo === "hold"), [cotistas]);
  const holdingId = cotistasHold[0]?.holding_id;

  const [aba, setAba] = useState<"cliente" | "hold">(cotistasCliente.length ? "cliente" : "hold");

  useEffect(() => {
    if (!aberto) return;
    setAba(cotistasCliente.length ? "cliente" : "hold");
  }, [aberto, cotistasCliente.length]);

  return (
    <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) aoFechar(); }}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-[-.02em]">Novo lançamento</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Cliente e Holding seguem regras de caixa diferentes — escolha a aba correta.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={(v) => setAba(v as "cliente" | "hold")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cliente" className="gap-2" disabled={!cotistasCliente.length}>
              <Users size={14} /> Cliente
            </TabsTrigger>
            <TabsTrigger value="hold" className="gap-2" disabled={!cotistasHold.length}>
              <Landmark size={14} /> Holding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cliente" className="pt-4">
            {cotistasCliente.length ? (
              <FormularioCliente
                aeronaveId={aeronaveId}
                cotistas={cotistasCliente}
                opcoes={opcoes}
                aoSalvar={async () => { await aoCriar(); aoFechar(); }}
              />
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Esta aeronave não tem cotistas do tipo cliente.
              </p>
            )}
          </TabsContent>

          <TabsContent value="hold" className="pt-4">
            {cotistasHold.length && holdingId ? (
              <FormularioHolding
                aeronaveId={aeronaveId}
                holdingId={holdingId}
                socios={cotistasHold}
                opcoes={opcoes}
                aoSalvar={async () => { await aoCriar(); aoFechar(); }}
              />
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Esta aeronave não tem cotistas do tipo holding.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Aba Cliente
// ---------------------------------------------------------------------------

function FormularioCliente({
  aeronaveId,
  cotistas,
  opcoes,
  aoSalvar,
}: {
  aeronaveId: string;
  cotistas: CotistaDaAeronave[];
  opcoes: OpcoesLancamentoClienteHold | null;
  aoSalvar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<"REEMBOLSAVEL" | "DIRETO">("REEMBOLSAVEL");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [cotistaDiretoId, setCotistaDiretoId] = useState(cotistas[0]?.id ?? "");
  const [pagoPorId, setPagoPorId] = useState<string>(""); // reembolsável: quem adiantou (opcional)
  const [rateios, setRateios] = useState<RateioDraft[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const pct = cotistas.length ? (100 / cotistas.length).toFixed(4) : "100";
    setRateios(cotistas.map((c) => ({ cotistaId: c.id, nome: c.nome, percentual: pct })));
    setCotistaDiretoId(cotistas[0]?.id ?? "");
    setPagoPorId("");
  }, [cotistas]);

  const categorias = opcoes?.categoriasCliente ?? [];
  const totalPercentual = rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0);
  const valorCentavos = parseValorReais(valor);

  const salvar = async () => {
    setErro(null);
    const categoria = categorias.find((c) => c.id === categoriaId);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) return setErro("Valor inválido.");
    if (!categoria) return setErro("Selecione uma categoria.");

    setSalvando(true);
    try {
      if (tipo === "DIRETO") {
        if (!cotistaDiretoId) throw new Error("Selecione o cotista que pagou.");
        await criarRateioClienteDireto({
          aeronaveId,
          cotistaAeronaveId: cotistaDiretoId,
          categoriaId: categoria.id,
          categoriaNome: categoria.nome,
          valorTotalCentavos: valorCentavos,
          descricaoDespesa: descricao.trim(),
          observacoes: observacoes.trim() || undefined,
        });
      } else {
        if (Math.abs(totalPercentual - 100) > 0.0001) {
          throw new Error(`Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`);
        }
        await criarLancamentoClienteReembolsavel({
          aeronaveId,
          descricao: descricao.trim(),
          categoriaId: categoria.id,
          categoriaNome: categoria.nome,
          grupoCategoria: categoria.grupo || "DESPESAS REEMBOLSÁVEIS",
          valorTotalCentavos: valorCentavos,
          dataEmissao: data,
          observacoes: observacoes.trim() || undefined,
          pagoPorCotistaAeronaveId: pagoPorId || undefined,
          rateios: rateios.map((r) => ({
            cotistaAeronaveId: r.cotistaId,
            percentual: Number(r.percentual),
            valorRateadoCentavos: centavosPorPercentual(valorCentavos, Number(r.percentual)),
          })),
        });
      }
      toast.success("Lançamento do cliente registrado.");
      await aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]">
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Tipo de lançamento do cliente */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTipo("REEMBOLSAVEL")}
          className={`rounded-xl border p-3 text-left text-[11px] transition ${tipo === "REEMBOLSAVEL" ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
        >
          <p className="font-bold">Reembolsável</p>
          <p className="mt-1 text-[10px] text-muted-foreground">A Share paga agora e cobra o(s) cotista(s) depois.</p>
        </button>
        <button
          type="button"
          onClick={() => setTipo("DIRETO")}
          className={`rounded-xl border p-3 text-left text-[11px] transition ${tipo === "DIRETO" ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
        >
          <p className="font-bold">Direto</p>
          <p className="mt-1 text-[10px] text-muted-foreground">O cliente já pagou do próprio bolso. Não passa pelo caixa Share.</p>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Revisão de célula" />
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent className="max-h-[280px]">
              {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {tipo === "DIRETO" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>Cotista que pagou</Label>
            <Select value={cotistaDiretoId} onValueChange={setCotistaDiretoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cotistas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="space-y-2 sm:col-span-2">
              <Label>Quem adiantou por todos? (opcional)</Label>
              <Select value={pagoPorId} onValueChange={setPagoPorId}>
                <SelectTrigger><SelectValue placeholder="Nenhum — cada um paga sua parte" /></SelectTrigger>
                <SelectContent>
                  {cotistas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Se um cotista adiantar por todos, o valor pago real dele vira o total e o dos demais fica zerado até o acerto.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">Rateio entre cotistas</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Soma deve fechar em 100%.</p>
                </div>
                <span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${Math.abs(totalPercentual - 100) <= 0.0001 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                  {totalPercentual.toFixed(4)}%
                </span>
              </div>
              {rateios.map((r, i) => (
                <div key={r.cotistaId} className="grid grid-cols-[1fr_110px] items-center gap-2 text-[11px]">
                  <span className="truncate font-semibold">{r.nome}</span>
                  <Input
                    inputMode="decimal"
                    value={r.percentual}
                    onChange={(e) => setRateios((atual) => atual.map((linha, li) => (li === i ? { ...linha, percentual: e.target.value } : linha)))}
                    className="h-8 text-right"
                  />
                </div>
              ))}
              {Number.isInteger(valorCentavos) && valorCentavos > 0 && (
                <p className="pt-1 text-[9px] text-muted-foreground">
                  {rateios.map((r) => `${r.nome}: R$ ${(centavosPorPercentual(valorCentavos, Number(r.percentual) || 0) / 100).toFixed(2)}`).join(" · ")}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes para auditoria" />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento
        </Button>
      </DialogFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Holding
// ---------------------------------------------------------------------------

function FormularioHolding({
  aeronaveId,
  holdingId,
  socios,
  opcoes,
  aoSalvar,
}: {
  aeronaveId: string;
  holdingId: string;
  socios: CotistaDaAeronave[];
  opcoes: OpcoesLancamentoClienteHold | null;
  aoSalvar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<"APORTE" | "DESPESA_CONJUNTA" | "DESPESA_BOLSO">("DESPESA_CONJUNTA");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [socioId, setSocioId] = useState(socios[0]?.socio_id ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setRateios(socios.map((s) => ({ cotistaId: s.socio_id ?? s.id, nome: s.nome, percentual: String(s.percentual_sociedade) })));
    setSocioId(socios[0]?.socio_id ?? "");
  }, [socios]);

  const categorias = opcoes?.categoriasHold ?? [];
  const totalPercentual = rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0);
  const valorCentavos = parseValorReais(valor);

  const salvar = async () => {
    setErro(null);
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) return setErro("Valor inválido.");

    setSalvando(true);
    try {
      if (tipo === "APORTE") {
        if (!socioId) throw new Error("Selecione o sócio que fez o aporte.");
        await criarMovimentoHoldingAporte({
          holdingId,
          socioId,
          aeronaveId,
          valorCentavos,
          data,
          observacoes: observacoes.trim() || undefined,
        });
      } else {
        const categoria = categorias.find((c) => c.id === categoriaId);
        if (!descricao.trim()) throw new Error("Informe a descrição.");
        if (!categoria) throw new Error("Selecione uma categoria.");

        if (tipo === "DESPESA_BOLSO") {
          if (!socioId) throw new Error("Selecione o sócio que pagou.");
          await criarDespesaHoldingPagoDireto({
            holdingId,
            aeronaveId,
            socioPagadorId: socioId,
            categoriaId: categoria.id,
            categoriaNome: categoria.nome,
            valorTotalCentavos: valorCentavos,
            descricaoDespesa: descricao.trim(),
            observacoes: observacoes.trim() || undefined,
          });
        } else {
          if (Math.abs(totalPercentual - 100) > 0.0001) {
            throw new Error(`Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`);
          }
          await criarDespesaHoldingContaConjunta({
            holdingId,
            aeronaveId,
            descricao: descricao.trim(),
            categoriaId: categoria.id,
            categoriaNome: categoria.nome,
            valorTotalCentavos: valorCentavos,
            data,
            observacoes: observacoes.trim() || undefined,
            rateios: rateios.map((r) => ({
              socioId: r.cotistaId,
              percentual: Number(r.percentual),
              valorRateadoCentavos: centavosPorPercentual(valorCentavos, Number(r.percentual)),
            })),
          });
        }
      }
      toast.success("Lançamento do holding registrado.");
      await aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]">
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Tipo de lançamento do holding */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setTipo("APORTE")}
          className={`rounded-xl border p-3 text-left text-[11px] transition ${tipo === "APORTE" ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
        >
          <HandCoins size={14} className="mb-1" />
          <p className="font-bold">Aporte</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Sócio deposita na conta conjunta.</p>
        </button>
        <button
          type="button"
          onClick={() => setTipo("DESPESA_CONJUNTA")}
          className={`rounded-xl border p-3 text-left text-[11px] transition ${tipo === "DESPESA_CONJUNTA" ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
        >
          <Wallet size={14} className="mb-1" />
          <p className="font-bold">Despesa · conta conjunta</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Paga com saldo já aportado.</p>
        </button>
        <button
          type="button"
          onClick={() => setTipo("DESPESA_BOLSO")}
          className={`rounded-xl border p-3 text-left text-[11px] transition ${tipo === "DESPESA_BOLSO" ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
        >
          <Users size={14} className="mb-1" />
          <p className="font-bold">Despesa · bolso do sócio</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Não usou a conta conjunta.</p>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tipo !== "APORTE" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Hangaragem mensal" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        {tipo !== "APORTE" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {(tipo === "APORTE" || tipo === "DESPESA_BOLSO") && (
          <div className="space-y-2 sm:col-span-2">
            <Label>{tipo === "APORTE" ? "Sócio que aportou" : "Sócio que pagou"}</Label>
            <Select value={socioId} onValueChange={setSocioId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {socios.map((s) => <SelectItem key={s.socio_id ?? s.id} value={s.socio_id ?? s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {tipo === "DESPESA_CONJUNTA" && (
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold">Rateio entre sócios do holding</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Pré-preenchido com o percentual de sociedade; ajuste se necessário.</p>
              </div>
              <span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${Math.abs(totalPercentual - 100) <= 0.0001 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                {totalPercentual.toFixed(4)}%
              </span>
            </div>
            {rateios.map((r, i) => (
              <div key={r.cotistaId} className="grid grid-cols-[1fr_110px] items-center gap-2 text-[11px]">
                <span className="truncate font-semibold">{r.nome}</span>
                <Input
                  inputMode="decimal"
                  value={r.percentual}
                  onChange={(e) => setRateios((atual) => atual.map((linha, li) => (li === i ? { ...linha, percentual: e.target.value } : linha)))}
                  className="h-8 text-right"
                />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes para auditoria" />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento
        </Button>
      </DialogFooter>
    </div>
  );
}
