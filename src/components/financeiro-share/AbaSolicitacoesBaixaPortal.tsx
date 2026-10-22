import { useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  aprovarSolicitacaoBaixaPortal,
  carregarDocumentoFinanceiro,
  formatarCentavos,
  formatarData,
  type ContaBancaria,
  type SolicitacaoBaixaPortal,
} from "@/lib/financeiro-share-api";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  solicitacoes: SolicitacaoBaixaPortal[];
  carregando: boolean;
  erro: boolean;
  contasBancarias: ContaBancaria[];
  aoAtualizar: () => Promise<unknown>;
};

export function AbaSolicitacoesBaixaPortal({ solicitacoes, carregando, erro, contasBancarias, aoAtualizar }: Props) {
  const [alvo, setAlvo] = useState<SolicitacaoBaixaPortal | null>(null);
  const [dataPagamento, setDataPagamento] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregandoAnexo, setCarregandoAnexo] = useState(false);
  const [preview, setPreview] = useState<{ url: string; tipo: string } | null>(null);

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const contasShare = contasBancarias.filter((conta) =>
    conta.ativo !== false && conta.ativo !== 0 && !conta.holding_id &&
    (!conta.tipo_caixa || conta.tipo_caixa.toUpperCase() === "SHARE"),
  );

  function abrir(solicitacao: SolicitacaoBaixaPortal) {
    setAlvo(solicitacao);
    setDataPagamento(solicitacao.data_pagamento?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setContaBancariaId(contasShare[0]?.id || "");
    setPreview(null);
  }

  async function verComprovante() {
    if (!alvo || carregandoAnexo) return;
    setCarregandoAnexo(true);
    try {
      const blob = await carregarDocumentoFinanceiro(alvo.comprovante_path);
      setPreview({ url: URL.createObjectURL(blob), tipo: blob.type });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o comprovante.");
    } finally {
      setCarregandoAnexo(false);
    }
  }

  async function aprovar() {
    if (!alvo || salvando) return;
    if (!dataPagamento) { toast.error("Confirme a data do pagamento."); return; }
    if (alvo.natureza === "RECEBIMENTO_SHARE" && !contaBancariaId) { toast.error("Selecione a conta bancária Share que recebeu o pagamento."); return; }
    setSalvando(true);
    try {
      await aprovarSolicitacaoBaixaPortal(alvo.id, {
        data_pagamento: dataPagamento,
        ...(alvo.natureza === "RECEBIMENTO_SHARE" ? { conta_bancaria_id: contaBancariaId } : {}),
      });
      setAlvo(null);
      avisarAtualizacaoFinanceiro();
      await aoAtualizar();
      toast.success("Solicitação aprovada e baixa conciliada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível aprovar a solicitação.");
    } finally {
      setSalvando(false);
    }
  }

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Bell size={17} /></span><div><h2 className="text-sm font-bold">Baixas solicitadas pelo Portal Cliente</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Comprovantes enviados aguardando conferência e aprovação.</p></div></div>
      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">{solicitacoes.length} pendente(s)</span>
    </header>

    {erro && <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle size={15} /> Não foi possível carregar as solicitações do portal. Atualize a tela ou confira suas permissões.</div>}
    {carregando && !solicitacoes.length ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Buscando solicitações…</div>
      : solicitacoes.length ? <div className="grid gap-3 lg:grid-cols-2">{solicitacoes.map((solicitacao) => <article key={solicitacao.id} className="rounded-xl border border-amber-500/20 bg-card/60 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{solicitacao.descricao_despesa || "Despesa"}</p><p className="mt-1 text-[11px] text-muted-foreground">{solicitacao.nome_cotista || "Cotista"}{solicitacao.aeronave ? ` · ${solicitacao.aeronave}` : ""}</p></div><strong className="shrink-0 font-mono text-sm text-emerald-300">{formatarCentavos(solicitacao.valor_centavos)}</strong></div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span>Enviada: {formatarData(solicitacao.criado_em)}</span><span>Vencimento: {formatarData(solicitacao.data_vencimento)}</span><span>Rateio: {formatarCentavos(solicitacao.valor_rateado_centavos)}</span></div>
        {solicitacao.observacoes && <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{solicitacao.observacoes}</p>}
        {solicitacao.erro_contexto && <p className="mt-2 text-[11px] text-amber-300">Baixa não disponível: {solicitacao.erro_contexto}</p>}
        <div className="mt-4 flex justify-end"><Button size="sm" disabled={!solicitacao.natureza || Boolean(solicitacao.erro_contexto)} onClick={() => abrir(solicitacao)} className="gap-2"><FileText size={14} /> Abrir solicitação</Button></div>
      </article>)}</div>
      : !erro && <div className="rounded-xl border border-dashed border-border p-10 text-center"><CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={21} /><p className="text-sm font-semibold">Nenhum comprovante aguardando aprovação</p><p className="mt-1 text-[11px] text-muted-foreground">Novas solicitações aparecem aqui automaticamente.</p></div>}

    <Dialog open={Boolean(alvo)} onOpenChange={(open) => { if (!open && !salvando) { setAlvo(null); setPreview(null); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Conferir solicitação de baixa</DialogTitle><DialogDescription>{alvo?.descricao_despesa || "Despesa"} · {alvo?.nome_cotista || "Cotista"}{alvo?.aeronave ? ` · ${alvo.aeronave}` : ""}</DialogDescription></DialogHeader>
        {alvo && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs"><div><span className="block text-[10px] text-muted-foreground">Valor solicitado</span><strong>{formatarCentavos(alvo.valor_centavos)}</strong></div><div><span className="block text-[10px] text-muted-foreground">Enviado em</span><strong>{formatarData(alvo.criado_em)}</strong></div></div>
          <Button type="button" variant="outline" disabled={carregandoAnexo} onClick={() => void verComprovante()} className="w-full gap-2">{carregandoAnexo ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{preview ? "Atualizar comprovante" : "Visualizar comprovante enviado"}</Button>
          {preview && <div className="max-h-[45vh] overflow-auto rounded-lg border border-border bg-black/20 p-2">{preview.tipo.startsWith("image/") ? <img src={preview.url} alt="Comprovante enviado pelo cliente" className="mx-auto max-h-[42vh] object-contain" /> : preview.tipo === "application/pdf" ? <iframe title="Comprovante enviado pelo cliente" src={preview.url} className="h-[42vh] w-full rounded" /> : <a href={preview.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Abrir arquivo anexado</a>}</div>}
          <div className="space-y-2"><Label htmlFor="portal-baixa-data">Data do pagamento</Label><Input id="portal-baixa-data" type="date" value={dataPagamento} onChange={(event) => setDataPagamento(event.target.value)} /></div>
          {alvo.natureza === "RECEBIMENTO_SHARE" ? <div className="space-y-2"><Label htmlFor="portal-baixa-conta">Conta bancária Share que recebeu</Label><select id="portal-baixa-conta" value={contaBancariaId} onChange={(event) => setContaBancariaId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a conta…</option>{contasShare.map((conta) => <option key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</option>)}</select></div> : <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] text-muted-foreground">Pagamento direto pelo cliente: confirme a baixa sem vincular uma conta bancária da Share.</p>}
        </div>}
        <DialogFooter><Button type="button" variant="outline" disabled={salvando} onClick={() => { setAlvo(null); setPreview(null); }}>Cancelar</Button><Button type="button" disabled={salvando || !alvo?.natureza} onClick={() => void aprovar()}>{salvando ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle2 size={14} className="mr-2" />}{salvando ? "Aprovando…" : "Aprovar e dar baixa"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
