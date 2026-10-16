import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { darBaixaLancamento, formatarCentavos, formatarData, type LancamentoEconomico } from "@/lib/financeiro-share-api";

interface Props {
  lancamento: LancamentoEconomico | null;
  onFechar: () => void;
  onConcluido: () => Promise<void>;
}

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** Baixa integral de despesas, compatível com o endpoint atualmente disponível.
 * Conta, forma e observações não são enviadas: esse endpoint ainda não as persiste.
 * Não enviar pagoPor: o dashboard pode devolver um nome de exibição, e não um ID.
 */
export function DarBaixaCotistaDialog({ lancamento, onFechar, onConcluido }: Props) {
  const [dataPagamento, setDataPagamento] = useState(hojeLocal);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const trava = useRef(false);

  useEffect(() => {
    setDataPagamento(hojeLocal());
    setErro("");
    setSalvo(false);
  }, [lancamento?.id]);

  async function confirmar() {
    if (!lancamento || trava.current) return;
    if (!salvo && !dataValida(dataPagamento)) { setErro("Informe uma data de pagamento válida."); return; }
    if (!salvo && (!Number.isSafeInteger(lancamento.valorCentavos) || lancamento.valorCentavos <= 0)) {
      setErro("O lançamento precisa ter um valor válido maior que zero."); return;
    }
    if (!salvo && lancamento.fluxo !== "SAIDA") { setErro("Este diálogo é destinado à baixa de despesas."); return; }
    if (!salvo && ["PAGO", "PAGO_DIRETAMENTE", "RECEBIDO", "REEMBOLSADO", "CANCELADO", "ESTORNO"].includes(String(lancamento.status).toUpperCase())) {
      setErro("Este lançamento não está disponível para baixa."); return;
    }
    trava.current = true;
    setProcessando(true);
    setErro("");
    let pagamentoSalvo = salvo;
    try {
      if (!pagamentoSalvo) {
        await darBaixaLancamento(lancamento.id, {
          dataPagamento,
          valorPagoRealCentavos: lancamento.valorCentavos,
        });
        pagamentoSalvo = true;
        setSalvo(true);
      }
      await onConcluido();
      onFechar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
      setErro(pagamentoSalvo ? `Pagamento registrado, mas a lista não foi atualizada. Tente atualizar novamente. ${mensagem}` : mensagem);
    } finally {
      trava.current = false;
      setProcessando(false);
    }
  }

  return (
    <Dialog open={Boolean(lancamento)} onOpenChange={(aberto) => { if (!aberto && !trava.current) onFechar(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" onEscapeKeyDown={(e) => { if (trava.current) e.preventDefault(); }} onPointerDownOutside={(e) => { if (trava.current) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Dar baixa no lançamento</DialogTitle>
          <DialogDescription>Confira a despesa e informe a data da quitação integral.</DialogDescription>
        </DialogHeader>
        {lancamento && <>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{lancamento.descricao}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{lancamento.fornecedor || "Fornecedor não informado"}</p>
                {lancamento.numeroRecibo && <p className="mt-1 text-xs text-muted-foreground">Recibo {lancamento.numeroRecibo}</p>}
              </div>
              <span className="rounded-md border px-2 py-1 text-xs">{salvo ? "Pago" : String(lancamento.status || "EM_ABERTO").replaceAll("_", " ")}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Vencimento</dt><dd className="mt-1 text-sm font-medium">{lancamento.prazo ? formatarData(lancamento.prazo) : "Não informado"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Categoria</dt><dd className="mt-1 break-words text-sm font-medium">{lancamento.categoria || "Não informada"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Valor do título</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{formatarCentavos(lancamento.valorCentavos)}</dd></div>
            </dl>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baixa-cotista-data">Data do pagamento</Label>
              <Input id="baixa-cotista-data" type="date" value={dataPagamento} disabled={processando || salvo} onChange={(e) => { setDataPagamento(e.target.value); setErro(""); }} aria-describedby="baixa-cotista-data-ajuda" />
              <p id="baixa-cotista-data-ajuda" className="text-xs text-muted-foreground">Data em que o pagamento foi realizado.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baixa-cotista-valor">Valor da quitação</Label>
              <Input id="baixa-cotista-valor" value={formatarCentavos(lancamento.valorCentavos)} readOnly aria-describedby="baixa-cotista-valor-ajuda" className="tabular-nums" />
              <p id="baixa-cotista-valor-ajuda" className="text-xs text-muted-foreground">Quitação integral, sem acréscimo ou desconto.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p>{salvo ? "Pagamento registrado." : <>Após confirmar, a despesa será marcada como <strong>paga</strong>{dataValida(dataPagamento) && <> em <strong>{formatarData(dataPagamento)}</strong></>}.</>}</p>
          </div>
          {erro && <p role="alert" className="break-words text-sm text-destructive">{erro}</p>}
        </>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={processando} onClick={onFechar}>{salvo ? "Fechar" : "Cancelar"}</Button>
          <Button type="button" disabled={processando || !lancamento} onClick={() => void confirmar()}>
            {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {processando ? "Aguarde…" : salvo ? "Atualizar lista" : "Confirmar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
