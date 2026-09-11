import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoFormulario } from "./CampoFormulario";
import { StatusBadge } from "./StatusBadge";
import { type LancamentoTabela, formatarBRL, formatarData, hojeISO } from "./lancamento-tabela";

export interface DadosBaixaSaida {
  dataPagamento: string;
  valorPago: number;
  formaPagamento: string;
  contaBancaria: string;
  observacoes: string;
}

interface DarBaixaDialogProps {
  lancamento: LancamentoTabela | null;
  onFechar: () => void;
  onConfirmar: (id: string, dados: DadosBaixaSaida) => Promise<void>;
  contasBancarias?: Array<{ id: string; label: string }>;
}

const FORMAS_PAGAMENTO = [
  { id: "PIX", label: "PIX" },
  { id: "TRANSFERENCIA", label: "Transferência" },
  { id: "BOLETO", label: "Boleto" },
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" },
];

export function DarBaixaDialog({
  lancamento,
  onFechar,
  onConfirmar,
  contasBancarias = [],
}: DarBaixaDialogProps) {
  const [dados, setDados] = useState<DadosBaixaSaida>({
    dataPagamento: hojeISO(),
    valorPago: 0,
    formaPagamento: "PIX",
    contaBancaria: "",
    observacoes: "",
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (lancamento) {
      setDados({
        dataPagamento: hojeISO(),
        valorPago: lancamento.valor,
        formaPagamento: "PIX",
        contaBancaria: contasBancarias[0]?.id ?? "",
        observacoes: "",
      });
      setErro("");
    }
  }, [lancamento, contasBancarias]);

  if (!lancamento) return null;

  const diferenca = dados.valorPago - lancamento.valor;
  const novoStatus = lancamento.fluxo === "ENTRADA" ? "RECEBIDO" : "PAGO";

  async function confirmar() {
    if (dados.valorPago <= 0) {
      setErro("Informe um valor pago maior que zero.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await onConfirmar(lancamento!.id, dados);
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao dar baixa.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={!!lancamento} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dar baixa no lançamento</DialogTitle>
          <DialogDescription>
            Confirme os dados do pagamento para liquidar o título.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-card-foreground">{lancamento.descricao}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {lancamento.id} · {lancamento.fornecedor}
              </p>
            </div>
            <StatusBadge status={lancamento.status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Vencimento
              </dt>
              <dd className="font-mono text-sm font-semibold text-card-foreground">
                {formatarData(lancamento.dataVencimento)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Categoria
              </dt>
              <dd className="text-sm font-semibold text-card-foreground">
                {lancamento.categoriaNome}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Valor do título
              </dt>
              <dd className="font-mono text-sm font-semibold text-card-foreground">
                {formatarBRL(lancamento.valor)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFormulario rotulo="Data do pagamento" dica="Data em que o valor saiu ou entrou na conta.">
            <Input
              type="date"
              value={dados.dataPagamento}
              onChange={(e) => setDados({ ...dados, dataPagamento: e.target.value })}
              aria-label="Data do pagamento"
            />
          </CampoFormulario>

          <CampoFormulario
            id="valorPago"
            rotulo="Valor pago"
            erro={erro || undefined}
            dica={
              diferenca === 0
                ? "Igual ao valor do título."
                : `${diferenca > 0 ? "Acréscimo" : "Desconto"} de ${formatarBRL(Math.abs(diferenca))} em relação ao título.`
            }
          >
            <Input
              id="valorPago"
              type="number"
              step="0.01"
              value={dados.valorPago}
              onChange={(e) => setDados({ ...dados, valorPago: Number(e.target.value) })}
              aria-label="Valor pago"
            />
          </CampoFormulario>

          <CampoFormulario rotulo="Forma de pagamento">
            <select
              value={dados.formaPagamento}
              onChange={(e) => setDados({ ...dados, formaPagamento: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Forma de pagamento"
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </CampoFormulario>

          <CampoFormulario rotulo="Conta bancária">
            {contasBancarias.length > 0 ? (
              <select
                value={dados.contaBancaria}
                onChange={(e) => setDados({ ...dados, contaBancaria: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Conta bancária"
              >
                {contasBancarias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={dados.contaBancaria}
                onChange={(e) => setDados({ ...dados, contaBancaria: e.target.value })}
                placeholder="Ex.: DGA - BRADESCO 1868-6"
                aria-label="Conta bancária"
              />
            )}
          </CampoFormulario>

          <CampoFormulario
            id="obsBaixa"
            rotulo="Observações da baixa"
            dica="Número do comprovante, transação ou justificativa da diferença."
            className="sm:col-span-2"
          >
            <Textarea
              id="obsBaixa"
              rows={2}
              value={dados.observacoes}
              onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
              placeholder="Comprovante, número da transação…"
              className="rounded-xl"
            />
          </CampoFormulario>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50 p-3.5 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="text-card-foreground">
            Após confirmar, o título passa a{" "}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {novoStatus === "RECEBIDO" ? "Recebido" : "Pago"}
            </span>{" "}
            com baixa em{" "}
            <strong className="font-mono">{formatarData(dados.dataPagamento)}</strong>.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {enviando ? "Confirmando…" : "Confirmar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
