import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Paperclip,
  Receipt,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/financeiro-design/StatusBadge";
import { formatarBRL, formatarData, hojeISO } from "@/components/financeiro-design/lancamento-tabela";
import type { ContaAPagar } from "./tipos";
import type { DadosBaixaAPagar } from "@/hooks/useContasAPagar";

const FORMAS = ["PIX", "TRANSFERENCIA", "BOLETO", "DINHEIRO", "CARTAO"];
const PENDENTES = ["EM_ABERTO", "PENDENTE", "ATRASADO", "EM_ATRASO"];

interface Props {
  conta: ContaAPagar | null;
  onFechar: () => void;
  onBaixar: (id: string, dados: DadosBaixaAPagar) => Promise<void>;
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 truncate text-sm font-semibold text-card-foreground ${mono ? "font-mono" : ""}`}>
        {valor || "—"}
      </p>
    </div>
  );
}

function ehImagem(url: string) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
}

export function DetalheContaAPagar({ conta, onFechar, onBaixar }: Props) {
  const anexos = useMemo(
    () =>
      [
        { chave: "boleto", rotulo: "Boleto", url: conta?.boletoUrl, Icon: Receipt },
        { chave: "nf", rotulo: "Nota fiscal", url: conta?.nfUrl, Icon: FileText },
        { chave: "comprovante", rotulo: "Comprovante", url: conta?.comprovantePagamentoUrl, Icon: Banknote },
      ].filter((a): a is { chave: string; rotulo: string; url: string; Icon: typeof Receipt } => Boolean(a.url)),
    [conta],
  );
  const [anexoAtivo, setAnexoAtivo] = useState(0);
  const [dataPagamento, setDataPagamento] = useState(hojeISO());
  const [valorPago, setValorPago] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [banco, setBanco] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (!conta) return null;

  const pendente = PENDENTES.includes(conta.status);
  const anexo = anexos[Math.min(anexoAtivo, anexos.length - 1)];

  async function confirmar() {
    if (!conta) return;
    if (!banco.trim()) {
      setErro("Informe a conta bancária usada no pagamento.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await onBaixar(conta.id, {
        dataPagamento,
        bancoPagamento: banco.trim(),
        comprovantePagamentoUrl: comprovanteUrl.trim() || undefined,
        valorPago: valorPago ? Number(valorPago) : conta.valor,
        formaPagamento,
        observacoes: observacoes.trim() || undefined,
      });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível dar baixa nesta conta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-background/80 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden border border-border bg-background shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Contas a pagar</p>
            <h2 className="mt-1 truncate text-lg font-bold">
              {conta.descricao || conta.categoriaNome || "Conta a pagar"}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{conta.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={conta.status} />
            <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
          <section className="space-y-4 overflow-y-auto border-border p-5 lg:border-r">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Valor do título</p>
              <p className="mt-1 font-mono text-3xl font-black tracking-tight">{formatarBRL(conta.valor)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Vence em {formatarData(conta.dataVencimento)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Categoria" valor={conta.categoriaNome || "—"} />
              <Campo rotulo="Aeronave" valor={conta.aeronaveId || "—"} mono />
              <Campo rotulo="Fornecedor" valor={conta.fornecedorId || "—"} mono />
              <Campo rotulo="Cotista" valor={conta.cotistaId || "—"} mono />
              <Campo rotulo="Criado por" valor={conta.criadoPor || "—"} />
              <Campo rotulo="Criado em" valor={formatarData(conta.criadoEm)} mono />
              <Campo rotulo="Pagamento" valor={conta.dataPagamento ? formatarData(conta.dataPagamento) : "—"} mono />
              <Campo rotulo="Banco do pagamento" valor={conta.bancoPagamento || "—"} />
            </div>

            <div className="rounded-2xl border border-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <Paperclip className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wide">Anexos da programação</p>
                <span className="ml-auto text-[11px] text-muted-foreground">{anexos.length} arquivo(s)</span>
              </div>
              {!anexos.length ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhum boleto, nota fiscal ou comprovante anexado nesta programação.
                </p>
              ) : (
                <div className="p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {anexos.map((item, indice) => (
                      <button
                        key={item.chave}
                        type="button"
                        onClick={() => setAnexoAtivo(indice)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          indice === anexoAtivo
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <item.Icon className="h-3.5 w-3.5" /> {item.rotulo}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    {ehImagem(anexo.url) ? (
                      <img src={anexo.url} alt={anexo.rotulo} className="max-h-[360px] w-full object-contain" />
                    ) : (
                      <iframe src={anexo.url} title={anexo.rotulo} className="h-[360px] w-full" />
                    )}
                  </div>
                  <a
                    href={anexo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir {anexo.rotulo.toLowerCase()} em nova aba
                  </a>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">{pendente ? "Registrar pagamento" : "Pagamento registrado"}</h3>
            </div>

            {!pendente ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
                <p className="flex items-center gap-2 font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Título liquidado
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Baixa em {conta.dataPagamento ? formatarData(conta.dataPagamento) : "—"} · {conta.bancoPagamento || "conta não informada"}
                </p>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-data">Data do pagamento</Label>
                    <Input id="pg-data" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-valor">Valor pago</Label>
                    <Input
                      id="pg-valor"
                      type="number"
                      step="0.01"
                      placeholder={String(conta.valor)}
                      value={valorPago}
                      onChange={(e) => setValorPago(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-forma">Forma de pagamento</Label>
                    <select
                      id="pg-forma"
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {FORMAS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-banco">Conta bancária</Label>
                    <Input id="pg-banco" placeholder="Ex.: DGA - BRADESCO 1868-6" value={banco} onChange={(e) => setBanco(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="pg-comprovante">Comprovante (URL)</Label>
                    <Input id="pg-comprovante" placeholder="https://…" value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="pg-obs">Observações</Label>
                    <Textarea id="pg-obs" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Número da transação, justificativa da diferença…" />
                  </div>
                </div>

                {erro && <p className="text-xs font-semibold text-destructive">{erro}</p>}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onFechar} disabled={enviando}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void confirmar()} disabled={enviando} className="gap-2">
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {enviando ? "Confirmando…" : "Confirmar pagamento"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
