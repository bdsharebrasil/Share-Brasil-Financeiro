import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, CheckCircle2, FileText, Plane, RefreshCw, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarContasBancariasHolding, buscarMovimentosHoldingPendentes, darBaixaMovimentoHolding, formatarCentavos, formatarData, type ContaBancaria, type MovimentoHoldingPendente } from "@/lib/financeiro-share-api";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";
import { enviarAnexoDocumentoSaida } from "@/lib/nfSaidaApi";
import { tipoAnexoLancamentoPermitido } from "@/lib/documentos-financeiros";
import { API_BASE } from "@/lib/api";

const ACEITOS_COMPROVANTE = "application/pdf,image/jpeg,image/png,image/apng,image/gif,image/webp,image/avif,image/bmp,image/svg+xml,image/x-icon,.pdf,.jpg,.jpeg,.png,.apng,.gif,.webp,.avif,.bmp,.svg,.ico";
const LIMITE_COMPROVANTE = 20 * 1024 * 1024;

function hojeLocal() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 10);
}

function rotuloStatus(status: string) {
  return String(status || "PENDENTE").replace(/_/g, " ").toLocaleUpperCase("pt-BR");
}

function movimentoEhEntrada(movimento: MovimentoHoldingPendente | null) {
  return ["ENTRADA", "APORTE", "ESTORNO", "REEMBOLSO"].includes(String(movimento?.fluxo ?? "").toUpperCase());
}

function documentosMovimento(movimento: MovimentoHoldingPendente) {
  return [
    { label: "Nota fiscal", numero: movimento.numero_nf, url: movimento.url_nf },
    { label: "Recibo", numero: movimento.numero_recibo, url: movimento.url_recibo },
    { label: "Boleto", numero: movimento.numero_boleto, url: movimento.url_boleto },
    { label: "Demonstrativo", numero: movimento.numero_demonstrativo, url: movimento.url_demonstrativo },
    { label: "Documento", numero: movimento.numero_doc, url: movimento.url_doc },
    { label: "Comprovante", numero: null, url: movimento.comprovante_url },
  ].filter((documento): documento is { label: string; numero: string | null | undefined; url: string } => Boolean(documento.url));
}

export function AbaMovimentosHolding() {
  const [movimentos, setMovimentos] = useState<MovimentoHoldingPendente[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<MovimentoHoldingPendente | null>(null);
  const [data, setData] = useState(hojeLocal);
  const [contaId, setContaId] = useState("");
  const [comprovanteArquivo, setComprovanteArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [pendentes, opcoes] = await Promise.all([buscarMovimentosHoldingPendentes(), buscarContasBancariasHolding()]);
      setMovimentos(pendentes);
      setContas(opcoes);
      setContaId((atual) => opcoes.some((item) => item.id === atual) ? atual : opcoes[0]?.id ?? "");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar pagamentos de holdings.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const movimentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return movimentos;
    return movimentos.filter((movimento) => [movimento.descricao, movimento.categoria_nome, movimento.holding_nome, movimento.socio_nome, movimento.aeronave, movimento.fornecedor_nome, movimento.status]
      .some((valor) => String(valor ?? "").toLocaleLowerCase("pt-BR").includes(termo)));
  }, [busca, movimentos]);
  const valorTotal = movimentosFiltrados.reduce((soma, movimento) => soma + movimento.valor_centavos, 0);

  async function confirmarBaixa() {
    if (!alvo || !contaId) return;
    setSalvando(true);
    try {
      let comprovanteUrl = alvo.comprovante_url || undefined;
      if (comprovanteArquivo) {
        if (!tipoAnexoLancamentoPermitido(comprovanteArquivo) || comprovanteArquivo.size > LIMITE_COMPROVANTE) {
          throw new Error("Selecione um PDF ou imagem compatível de até 20 MB.");
        }
        comprovanteUrl = (await enviarAnexoDocumentoSaida(comprovanteArquivo, comprovanteArquivo.name, {
          origem: "lancamento",
          documentoId: alvo.id,
        })).url;
      }
      await darBaixaMovimentoHolding(alvo.id, { dataPagamento: data, contaBancariaId: contaId, formaPagamento: "TRANSFERENCIA", comprovanteUrl });
      toast.success(movimentoEhEntrada(alvo) ? "Recebimento e rateios da holding registrados." : "Pagamento e rateios da holding atualizados.");
      setAlvo(null);
      setComprovanteArquivo(null);
      await carregar();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível baixar o movimento da holding.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirBaixa(movimento: MovimentoHoldingPendente) {
    setAlvo(movimento);
    setData(hojeLocal());
    setComprovanteArquivo(null);
    setContaId(contas.find((conta) => conta.holding_id === movimento.holding_id)?.id ?? "");
  }

  return <section className="min-w-0 space-y-4" aria-labelledby="holding-pendentes-titulo" aria-busy={carregando}>
    <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Financeiro · Holdings</p>
        <h2 id="holding-pendentes-titulo" className="mt-1 text-base font-bold tracking-tight">Movimentos pendentes</h2>
        <p className="mt-1 text-xs text-muted-foreground">Registre pagamentos e recebimentos nas contas conjuntas das holdings.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando} className="h-9 shrink-0 gap-2 self-start sm:self-auto">
        <RefreshCw size={14} className={carregando ? "animate-spin" : ""} aria-hidden="true" />Atualizar
      </Button>
    </header>

    {erro && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 break-words">{erro}</span><Button variant="outline" size="sm" onClick={() => void carregar()} className="shrink-0 self-start sm:self-auto">Tentar novamente</Button>
    </div>}

    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300"><Building2 size={17} /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos pendentes</p><p className="mt-1 text-lg font-bold tabular-nums">{carregando ? "—" : movimentosFiltrados.length}</p></div>
        </div>
      </article>
      <article className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300"><Wallet size={17} /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valor listado</p><p className="mt-1 text-lg font-bold tabular-nums">{carregando ? "—" : formatarCentavos(valorTotal)}</p></div>
        </div>
      </article>
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block min-w-0 flex-1 sm:max-w-md">
        <span className="sr-only">Buscar movimentos de holding</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar movimento, holding, cotista ou aeronave…" className="h-10 pl-9 text-xs" />
      </label>
      <p className="text-[10px] text-muted-foreground sm:text-right">{carregando ? "Carregando…" : `${movimentosFiltrados.length} de ${movimentos.length} movimento(s)`}</p>
    </div>

    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
            <tr><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Holding / cotista</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {carregando ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Carregando movimentos…</td></tr>
              : movimentosFiltrados.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{movimentos.length ? "Nenhum movimento corresponde à busca." : "Nenhum movimento pendente da Holding."}</td></tr>
                : movimentosFiltrados.map((movimento) => <tr key={movimento.id} className="transition-colors hover:bg-muted/25">
                  <td className="max-w-[300px] px-4 py-3.5"><p className="truncate font-semibold text-foreground" title={movimento.descricao}>{movimento.descricao}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{movimentoEhEntrada(movimento) ? "Entrada" : "Saída"} · {movimento.fornecedor_nome || "Sem fornecedor"} · {movimento.categoria_nome || "Sem categoria"}</p>{documentosMovimento(movimento).length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{documentosMovimento(movimento).map((documento) => <a key={`${documento.label}-${documento.url}`} href={documento.url.startsWith("/") ? `${API_BASE}${documento.url}` : documento.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[9px] text-primary hover:bg-muted"><FileText size={11} />{documento.label}{documento.numero ? ` · ${documento.numero}` : ""}</a>)}</div>}</td>
                  <td className="px-4 py-3.5"><p className="font-medium">{movimento.holding_nome ?? "Holding não identificada"}</p><p className="mt-1 text-[10px] text-muted-foreground">{movimento.socio_nome ?? "Cotista não identificado"}</p></td>
                  <td className="px-4 py-3.5">{movimento.aeronave ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3.5">{formatarData(movimento.data_vencimento)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold tabular-nums">{formatarCentavos(movimento.valor_centavos)}</td>
                  <td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">{rotuloStatus(movimento.status)}</span></td>
                  <td className="px-4 py-3.5 text-right"><Button size="sm" variant="outline" className="h-8" onClick={() => abrirBaixa(movimento)}>{movimentoEhEntrada(movimento) ? "Receber" : "Dar baixa"}</Button></td>
                </tr>)}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {carregando ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando movimentos…</p>
          : movimentosFiltrados.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{movimentos.length ? "Nenhum movimento corresponde à busca." : "Nenhum movimento pendente da Holding."}</p>
          : movimentosFiltrados.map((movimento) => <article key={movimento.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold leading-5">{movimento.descricao}</p><p className="mt-1 text-[10px] text-muted-foreground">{movimentoEhEntrada(movimento) ? "Entrada" : "Saída"} · {movimento.fornecedor_nome || "Sem fornecedor"} · {movimento.categoria_nome || "Sem categoria"}</p></div><span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">{rotuloStatus(movimento.status)}</span></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[11px]">
                <div className="min-w-0"><p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground"><Building2 size={11} />Holding / cotista</p><p className="mt-1 break-words font-medium">{movimento.holding_nome ?? "Holding não identificada"}</p><p className="break-words text-muted-foreground">{movimento.socio_nome ?? "Cotista não identificado"}</p></div>
                <div className="min-w-0"><p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground"><Plane size={11} />Aeronave</p><p className="mt-1 break-words font-medium">{movimento.aeronave ?? "—"}</p></div>
                <div><p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground"><CalendarDays size={11} />Vencimento</p><p className="mt-1 font-medium">{formatarData(movimento.data_vencimento)}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-muted-foreground">Valor do movimento</p><p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">{formatarCentavos(movimento.valor_centavos)}</p></div>
              </div>
              {documentosMovimento(movimento).length > 0 && <div className="flex flex-wrap gap-1.5">{documentosMovimento(movimento).map((documento) => <a key={`${documento.label}-${documento.url}`} href={documento.url.startsWith("/") ? `${API_BASE}${documento.url}` : documento.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-primary"><FileText size={12} />{documento.label}{documento.numero ? ` · ${documento.numero}` : ""}</a>)}</div>}
              <Button size="sm" variant="outline" className="h-10 w-full" onClick={() => abrirBaixa(movimento)}>{movimentoEhEntrada(movimento) ? "Registrar recebimento" : "Dar baixa"}</Button>
            </article>)}
      </div>
    </div>

    <Dialog open={Boolean(alvo)} onOpenChange={(aberto) => { if (!aberto) setAlvo(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{movimentoEhEntrada(alvo) ? "Registrar recebimento da holding" : "Dar baixa no pagamento da holding"}</DialogTitle><DialogDescription>Confirme os dados do movimento na conta bancária da própria Holding.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="break-words text-sm font-semibold">{alvo?.descricao}</p><p className="mt-1 text-xs text-muted-foreground">{alvo?.holding_nome} · {formatarCentavos(alvo?.valor_centavos ?? 0)}</p></div>
          <div className="grid gap-2"><Label htmlFor="holding-data">{movimentoEhEntrada(alvo) ? "Data do recebimento" : "Data do pagamento"}</Label><Input id="holding-data" type="date" value={data} onChange={(event) => setData(event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="holding-conta">Conta bancária da holding</Label><Select value={contaId} onValueChange={setContaId}><SelectTrigger id="holding-conta"><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contas.filter((conta) => conta.holding_id === alvo?.holding_id).map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <AnexosDinamicos
            file={comprovanteArquivo}
            onFileChange={(file) => {
              if (file && (!tipoAnexoLancamentoPermitido(file) || file.size > LIMITE_COMPROVANTE)) {
                toast.error("Selecione um PDF ou imagem compatível de até 20 MB.");
                return;
              }
              setComprovanteArquivo(file);
            }}
            accept={ACEITOS_COMPROVANTE}
            maxSizeMb={20}
            label="Comprovante do pagamento/recebimento"
            description="PDF ou imagem · até 20 MB"
            existingUrl={alvo?.comprovante_url ?? null}
            existingName={alvo?.comprovante_url ? "Comprovante já anexado" : null}
            onView={(url) => window.open(url.startsWith("/") ? `${API_BASE}${url}` : url, "_blank", "noopener,noreferrer")}
          />
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0"><Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button><Button disabled={salvando || !contaId} onClick={() => void confirmarBaixa()}><CheckCircle2 size={15} className="mr-2" />{salvando ? "Salvando…" : movimentoEhEntrada(alvo) ? "Confirmar recebimento" : "Confirmar baixa"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
