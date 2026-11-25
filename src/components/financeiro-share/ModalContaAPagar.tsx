import { BaixaResumo } from "@/components/financeiro-design/BaixaResumo";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Paperclip,
  UploadCloud,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import {
  enviarComprovantePagamento,
  type ContaBancaria,
} from "@/lib/financeiro-share-api";
import { enviarAnexoEnvioPagamento } from "@/lib/colaborador-api";
import type { ContaAPagar } from "./tipos";

interface DadosBaixa {
  dataPagamento: string;
  bancoPagamento: string;
  contaBancariaId: string;
  formaPagamento: string;
  comprovantePagamentoUrl?: string;
  observacoes?: string;
}

interface ModalContaAPagarProps {
  conta: ContaAPagar;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixa) => Promise<void>;
  contasBancarias: ContaBancaria[];
  progresso?: string;
}

const FORMAS_PAGAMENTO = ["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"];
const TIPOS_COMPROVANTE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const LIMITE_COMPROVANTE = 10 * 1024 * 1024;

function hoje() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function nomeConta(conta: ContaBancaria) {
  return [conta.banco, conta.numero_conta].filter(Boolean).join(" · ") || "Conta bancária";
}

function dataLegivel(valor: string | null | undefined) {
  if (!valor) return "Não informada";
  const data = new Date(`${valor.slice(0, 10)}T12:00:00`);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat("pt-BR").format(data);
}

export function ModalContaAPagar({
  conta,
  aberto,
  onFechar,
  onConfirmar,
  contasBancarias,
  progresso,
}: ModalContaAPagarProps) {
  const contaInicial = contasBancarias.find((item) => item.id === conta.contaBancariaId)
    ?? contasBancarias.find((item) => nomeConta(item) === conta.bancoPagamento);
  const ehLancamentoDireto = conta.fonteLancamento === true && (conta.lancamentoId ?? conta.id) === conta.id;
  const [dataPagamento, setDataPagamento] = useState(hoje);
  const [contaBancariaId, setContaBancariaId] = useState(contaInicial?.id ?? "");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [comprovanteUrl, setComprovanteUrl] = useState(conta.comprovantePagamentoUrl ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);
  const contas = contasBancarias
    .filter((item) => item.ativo !== false && item.ativo !== 0)
    .map((item) => ({ id: item.id, label: nomeConta(item) }));
  const contaSelecionada = contasBancarias.find((item) => item.id === contaBancariaId);
  const moeda = Number(conta.valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  async function selecionarComprovante(arquivoSelecionado?: File) {
    if (!arquivoSelecionado) return;
    if (!TIPOS_COMPROVANTE.includes(arquivoSelecionado.type)) {
      setErro("O comprovante deve ser PDF, PNG, JPG ou WebP.");
      return;
    }
    if (arquivoSelecionado.size > LIMITE_COMPROVANTE) {
      setErro("O comprovante deve ter no máximo 10 MB.");
      return;
    }
    setErro(null);
    setArquivo(arquivoSelecionado);
    setEnviandoComprovante(true);
    try {
      const resultado = ehLancamentoDireto
        ? await enviarAnexoEnvioPagamento(arquivoSelecionado, `baixa-${conta.id}`)
        : await enviarComprovantePagamento(conta.id, arquivoSelecionado);
      setComprovanteUrl(resultado.url);
    } catch (error) {
      setArquivo(null);
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o comprovante.");
    } finally {
      setEnviandoComprovante(false);
    }
  }

  async function confirmar() {
    if (trava.current) return;
    const dataValida = new Date(`${dataPagamento}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento) || !Number.isFinite(dataValida.getTime()) || dataValida.toISOString().slice(0, 10) !== dataPagamento) {
      setErro("Informe uma data de pagamento válida.");
      return;
    }
    if (!contaSelecionada) {
      setErro("Selecione a conta bancária usada no pagamento.");
      return;
    }
    if (arquivo && !comprovanteUrl) {
      setErro("Aguarde o envio do comprovante antes de confirmar.");
      return;
    }
    trava.current = true;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar({
        dataPagamento,
        bancoPagamento: nomeConta(contaSelecionada),
        contaBancariaId,
        formaPagamento,
        comprovantePagamentoUrl: comprovanteUrl || undefined,
        observacoes: observacoes.trim() || undefined,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao dar baixa na conta.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  const ocupada = enviando || enviandoComprovante;

  return (
    <Dialog open={aberto} onOpenChange={(valor) => { if (!valor && !ocupada) onFechar(); }}>
      <DialogContent
        className="despesas-theme baixa-dialog"
        onEscapeKeyDown={(evento) => { if (ocupada) evento.preventDefault(); }}
        onPointerDownOutside={(evento) => { if (ocupada) evento.preventDefault(); }}
      >
        <DialogHeader className="baixa-header">
          <p className="baixa-kicker">Financeiro Share · Saída{progresso ? ` · ${progresso}` : ""}</p>
          <DialogTitle className="baixa-titulo"><CircleDollarSign size={20}/>Registrar pagamento</DialogTitle>
          <DialogDescription>Registre a saída da conta bancária da Share com a data e o comprovante do pagamento.</DialogDescription>
        </DialogHeader>

        <div className="baixa-body">
          <BaixaResumo descricao={conta.descricao || conta.categoriaNome || "Conta a pagar"} detalhe={conta.fornecedor || "Fornecedor não informado"} valor={moeda} rotuloValor="Valor da saída" vencimento={dataLegivel(conta.dataVencimento)} categoria={conta.categoriaNome || "—"} situacao={conta.status || "Em aberto"}/>
          <fieldset disabled={ocupada} className="min-w-0 space-y-4">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground dark:text-slate-100">Dados do pagamento</h3>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="data-pagamento" className="text-xs text-muted-foreground dark:text-slate-300">Data do pagamento</Label>
                  <Input id="data-pagamento" type="date" value={dataPagamento} onChange={(evento) => setDataPagamento(evento.target.value)} className="h-9 min-w-0 border-border dark:border-white/[.08] bg-card dark:bg-secondary text-foreground dark:text-slate-100" />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs text-muted-foreground dark:text-slate-300">Conta bancária</Label>
                  <SearchableCombobox
                    items={contas}
                    value={contaBancariaId}
                    onChange={setContaBancariaId}
                    placeholder="Selecione a conta"
                    searchPlaceholder="Buscar banco ou conta…"
                    emptyMessage="Nenhuma conta bancária ativa encontrada."
                    wrapSelectedLabel
                    className="h-9 min-w-0 border-border dark:border-white/[.08] bg-card dark:bg-secondary text-foreground dark:text-slate-100"
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:col-span-2">
                  <Label htmlFor="forma-pagamento" className="text-xs text-muted-foreground dark:text-slate-300">Forma de pagamento</Label>
                  <SearchableCombobox
                    items={FORMAS_PAGAMENTO.map((forma) => ({ id: forma, label: forma }))}
                    value={formaPagamento}
                    onChange={setFormaPagamento}
                    placeholder="Selecione a forma"
                    searchPlaceholder="Buscar forma…"
                    emptyMessage="Nenhuma forma encontrada."
                    className="h-9 min-w-0 border-border dark:border-white/[.08] bg-card dark:bg-secondary text-foreground dark:text-slate-100"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-1.5">
              <Label htmlFor={`comprovante-pagamento-${conta.id}`} className="text-xs text-muted-foreground dark:text-slate-300">Comprovante do pagamento</Label>
              <label htmlFor={`comprovante-pagamento-${conta.id}`} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-600 px-3 py-2.5 text-xs text-muted-foreground dark:text-slate-300 transition hover:border-cyan-400/70 hover:bg-cyan-950/20">
                <UploadCloud className="h-4 w-4 shrink-0 text-cyan-300" />
                <span className="min-w-0 flex-1"><strong className="block break-all font-medium text-foreground dark:text-slate-100">{enviandoComprovante ? "Enviando arquivo…" : arquivo?.name || "Anexar imagem ou PDF"}</strong><small className="mt-0.5 block text-[11px] text-muted-foreground dark:text-slate-400">PDF, JPG, PNG ou WebP · até 10 MB</small></span>
                {enviandoComprovante ? <span className="shrink-0 text-[11px] text-cyan-300">Enviando</span> : comprovanteUrl ? <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Paperclip className="h-4 w-4 shrink-0 text-slate-500" />}
                <Input
                  id={`comprovante-pagamento-${conta.id}`}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  onChange={(evento) => { void selecionarComprovante(evento.target.files?.[0]); evento.currentTarget.value = ""; }}
                />
              </label>
              {arquivo && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground dark:text-slate-400"><span className="truncate">{comprovanteUrl ? "Comprovante anexado · pronto para salvar" : "Aguardando envio"}</span><button type="button" disabled={ocupada} onClick={() => { setArquivo(null); setComprovanteUrl(""); }} className="text-muted-foreground dark:text-slate-300 hover:text-white">Remover</button></div>}
            </section>

            <section className="space-y-1">
              <Label htmlFor={`observacoes-pagamento-${conta.id}`} className="text-xs text-muted-foreground dark:text-slate-300">Observações do pagamento</Label>
              <Textarea id={`observacoes-pagamento-${conta.id}`} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} rows={2} className="min-h-16 border-slate-700 bg-slate-950/60" placeholder="Detalhes adicionais para conferência" />
            </section>
            {erro && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{erro}</p>}
          </fieldset>
        </div>

        <DialogFooter className="baixa-footer">
          <Button variant="ghost" onClick={onFechar} disabled={ocupada} className="text-muted-foreground dark:text-slate-300 hover:bg-white/[.05]">Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={ocupada || !contaBancariaId} className="gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            {enviando ? "Confirmando…" : <><CheckCircle2 size={16} />Confirmar pagamento</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
