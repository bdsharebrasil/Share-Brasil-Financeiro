import { Fragment, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Eye, FileText, Image as ImageIcon, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { alterarStatusLancamento, editarLancamento, gerarReembolso } from "@/lib/financeiro-share-api";
import type { FluxoLancamento, Lancamento, StatusLancamento } from "./tipos";

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}

const CORES_STATUS: Record<StatusLancamento, string> = {
  EM_ABERTO: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PAGO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  RECEBIDO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PENDENTE: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ATRASADO: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  EM_ATRASO: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  CANCELADO: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

function formatarStatus(status: StatusLancamento) {
  return status.replace(/_/g, " ");
}

function DocumentoPreview({ documento, onClose }: { documento: Lancamento["anexos"][number]; onClose: () => void }) {
  const imagem = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(documento.url) || documento.tipo?.startsWith("image/");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-hidden border-border bg-background p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="flex min-w-0 items-center gap-2 truncate text-sm"><FileText className="size-4 shrink-0 text-primary" />{documento.nome}</DialogTitle>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Fechar documento"><X size={16} /></Button>
        </DialogHeader>
        <div className="flex max-h-[calc(92dvh-76px)] min-h-[260px] items-center justify-center overflow-auto bg-muted/20 p-4">
          {imagem ? <img src={documento.url} alt={documento.nome} className="max-h-[calc(92dvh-120px)] max-w-full rounded-lg object-contain shadow-sm" /> : <iframe title={documento.nome} src={documento.url} className="h-[70vh] w-full rounded-lg border border-border bg-background" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinhaExpandida({ lancamento, onDocumento, onEditar, onExcluir, onBaixa, onReembolso }: {
  lancamento: Lancamento;
  onDocumento: (documento: Lancamento["anexos"][number]) => void;
  onEditar: () => void;
  onExcluir: () => void;
  onBaixa: () => void;
  onReembolso: () => void;
}) {
  const finalizado = ["PAGO", "RECEBIDO", "CANCELADO"].includes(lancamento.status);
  return (
    <div className="border-t border-border/70 bg-muted/20 px-4 py-5 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Documentos vinculados</h3>
          {lancamento.anexos.length ? <div className="flex flex-wrap gap-2">{lancamento.anexos.map((documento) => {
            const imagem = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(documento.url) || documento.tipo?.startsWith("image/");
            return <button key={documento.id} type="button" onClick={() => onDocumento(documento)} className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{imagem ? <ImageIcon size={14} /> : <FileText size={14} />}</span><span className="max-w-[240px] truncate font-medium text-foreground">{documento.nome}</span><Eye size={13} className="shrink-0 text-muted-foreground group-hover:text-primary" /></button>;
          })}</div> : <p className="text-xs text-muted-foreground">Nenhum documento vinculado a este lançamento.</p>}
        </section>
        <section>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Mais informações da despesa</h3>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Vencimento</dt><dd className="mt-1 font-semibold text-foreground">{formatarData(lancamento.prazo)}</dd></div>
            <div><dt className="text-muted-foreground">Categoria</dt><dd className="mt-1 truncate font-semibold text-foreground">{lancamento.categoria}</dd></div>
            <div><dt className="text-muted-foreground">Caixa</dt><dd className="mt-1 font-semibold text-foreground">{lancamento.caixa}</dd></div>
            <div><dt className="text-muted-foreground">Pagador</dt><dd className="mt-1 truncate font-semibold text-foreground">{lancamento.pagoPor || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Reembolsável</dt><dd className="mt-1 font-semibold text-foreground">{lancamento.reembolsavel ? "Sim" : "Não"}</dd></div>
            <div><dt className="text-muted-foreground">Criado em</dt><dd className="mt-1 font-semibold text-foreground">{formatarData(lancamento.criadoEm)}</dd></div>
          </dl>
          {lancamento.observacoes && <p className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Observações: </span>{lancamento.observacoes}</p>}
        </section>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
        {lancamento.reembolsavel && lancamento.cotistaId && <Button size="sm" variant="outline" onClick={onReembolso} className="gap-1.5 text-xs">Gerar reembolso</Button>}
        <Button size="sm" variant="outline" onClick={onEditar} className="gap-1.5 text-xs"><Pencil size={13} /> Editar</Button>
        {!finalizado && <Button size="sm" variant="outline" onClick={onBaixa} className="gap-1.5 text-xs"><CheckCircle2 size={13} /> Dar baixa</Button>}
        {!finalizado && <Button size="sm" variant="ghost" onClick={onExcluir} className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /> Excluir</Button>}
      </div>
    </div>
  );
}

export function AbaCaixaEmpresa({ onNovoLancamento }: { onNovoLancamento?: () => void }) {
  const [fluxo, setFluxo] = useState<FluxoLancamento | "TODOS">("TODOS");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<Lancamento["anexos"][number] | null>(null);
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([]);
  const { lancamentos, carregando, erro, recarregar } = useCaixaEmpresa({ fluxo: fluxo === "TODOS" ? undefined : fluxo });

  const mesDoLancamento = (lancamento: Lancamento) => lancamento.data ? lancamento.data.slice(0, 7) : "sem-data";
  const rotuloMes = (mes: string) => mes === "sem-data" ? "Sem data" : new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mesesDisponiveis = Array.from(new Set(lancamentos.map(mesDoLancamento))).sort().reverse();
  const lancamentosVisiveis = lancamentos
    .filter((lancamento) => mesesSelecionados.length === 0 || mesesSelecionados.includes(mesDoLancamento(lancamento)))
    .sort((a, b) => mesDoLancamento(b).localeCompare(mesDoLancamento(a)));
  const saldoVisivel = lancamentosVisiveis.reduce((total, lancamento) => total + (lancamento.fluxo === "ENTRADA" ? lancamento.valorCentavos : -lancamento.valorCentavos), 0);
  const alternarMes = (mes: string, marcado: boolean) => setMesesSelecionados((atuais) => marcado ? [...atuais, mes] : atuais.filter((item) => item !== mes));

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try { await acao(); await recarregar(); toast.success(sucesso); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o lançamento."); }
  }
  async function editar(lancamento: Lancamento) {
    const descricao = window.prompt("Descrição do lançamento", lancamento.descricao);
    if (!descricao?.trim() || descricao.trim() === lancamento.descricao) return;
    await executar(() => editarLancamento(lancamento.id, { descricao: descricao.trim() }), "Lançamento atualizado.");
  }
  async function excluir(lancamento: Lancamento) {
    if (!window.confirm("Excluir este lançamento? Ele será cancelado e permanecerá no histórico.")) return;
    await executar(() => alterarStatusLancamento(lancamento.id, "CANCELADO"), "Lançamento cancelado.");
  }
  async function baixa(lancamento: Lancamento) {
    await executar(() => alterarStatusLancamento(lancamento.id, lancamento.fluxo === "ENTRADA" ? "RECEBIDO" : "PAGO"), "Baixa registrada.");
  }
  async function reembolso(lancamento: Lancamento) {
    if (!lancamento.cotistaId) return;
    await executar(() => gerarReembolso({ lancamento_origem_id: lancamento.id, cotista_aeronave_id: lancamento.cotistaId, valor_centavos: lancamento.valorCentavos, descricao: lancamento.descricao, data: lancamento.data, data_emissao: lancamento.data, data_vencimento: lancamento.prazo }), "Reembolso gerado e salvo.");
  }

  return <div className="space-y-5">
    <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-sm">Movimentações do caixa</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">Lançamentos próprios da Share Brasil · clique em Ações para expandir</p>
          </div>
          {onNovoLancamento && <Button type="button" onClick={onNovoLancamento} className="h-10 w-full gap-2 rounded-xl sm:w-auto"><Plus size={16} aria-hidden="true" /> Novo Lançamento</Button>}
          <div className="flex items-center gap-3 self-start rounded-xl border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Soma total</span>
            <span className={`font-mono text-sm font-bold ${saldoVisivel >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatarMoeda(saldoVisivel)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Mês e ano</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between gap-2"><span className="flex items-center gap-2"><CalendarDays size={14} />{mesesSelecionados.length ? `${mesesSelecionados.length} ${mesesSelecionados.length === 1 ? "mês" : "meses"}` : "Todos os meses"}</span><ChevronDown size={14} /></Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Meses</span>{mesesSelecionados.length > 0 && <button type="button" onClick={() => setMesesSelecionados([])} className="text-xs text-primary hover:underline">Limpar</button>}</div>
                {mesesDisponiveis.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum mês disponível.</p> : <div className="max-h-72 space-y-1 overflow-y-auto">{mesesDisponiveis.map((mes) => <label key={mes} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs capitalize hover:bg-muted"><Checkbox checked={mesesSelecionados.includes(mes)} onCheckedChange={(marcado) => alternarMes(mes, marcado === true)} />{rotuloMes(mes)}</label>)}</div>}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Fluxo</span>
            <Select value={fluxo} onValueChange={(v) => setFluxo(v as FluxoLancamento | "TODOS")}>
              <SelectTrigger><SelectValue placeholder="Fluxo" /></SelectTrigger>
              <SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="ENTRADA">Entradas</SelectItem><SelectItem value="SAIDA">Saídas</SelectItem></SelectContent>
            </Select>
          </div>
          <p className="text-xs font-semibold text-muted-foreground sm:ml-auto sm:pb-2">Lançamentos ({lancamentosVisiveis.length})</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {erro && <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
        {carregando ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><RefreshCw size={15} className="animate-spin" /> Carregando lançamentos…</div> : <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-muted/30"><tr className="border-b border-border text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Doc. / emissão</th><th className="px-4 py-3">Fluxo</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="text-sm">
              {lancamentosVisiveis.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</td></tr> : lancamentosVisiveis.map((lancamento, indice) => {
                const aberto = expandido === lancamento.id;
                const mes = mesDoLancamento(lancamento);
                const novoMes = indice === 0 || mesDoLancamento(lancamentosVisiveis[indice - 1]) !== mes;
                return <Fragment key={lancamento.id}>
                  {novoMes && <tr className="border-b border-border/60 bg-muted/20"><td colSpan={7} className="px-4 py-2 text-[11px] font-bold capitalize tracking-[.08em] text-primary">{rotuloMes(mes)}</td></tr>}
                  <tr className={`border-b border-border/60 transition-colors hover:bg-muted/40 ${aberto ? "bg-primary/[.04]" : ""}`}>
                    <td className="px-4 py-3 align-top"><p className="font-mono text-xs font-bold text-foreground">{lancamento.documento || "—"}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays size={12} />{formatarData(lancamento.data)}</p></td>
                    <td className="px-4 py-3 align-top"><Badge variant={lancamento.fluxo === "ENTRADA" ? "default" : "secondary"}>{lancamento.fluxo === "ENTRADA" ? "Entrada" : "Saída"}</Badge></td>
                    <td className="min-w-[220px] max-w-[320px] px-4 py-3 align-top"><p className="font-semibold leading-snug text-foreground">{lancamento.descricao}</p><p className="mt-1 text-[11px] text-muted-foreground">{lancamento.categoria}</p></td>
                    <td className="max-w-[180px] px-4 py-3 align-top text-muted-foreground">{lancamento.fornecedor || "—"}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right align-top font-mono font-bold ${lancamento.fluxo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{lancamento.fluxo === "ENTRADA" ? "+" : "−"}{formatarMoeda(lancamento.valorCentavos)}</td>
                    <td className="px-4 py-3 align-top"><Badge className={CORES_STATUS[lancamento.status]}>{formatarStatus(lancamento.status)}</Badge></td>
                    <td className="px-4 py-3 text-right align-top"><Button type="button" size="sm" variant="outline" onClick={() => setExpandido(aberto ? null : lancamento.id)} className="gap-1.5 text-xs" aria-expanded={aberto}>{aberto ? "Fechar" : "Ações"}{aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</Button></td>
                  </tr>
                  {aberto && <tr><td colSpan={7} className="p-0"><LinhaExpandida lancamento={lancamento} onDocumento={setDocumentoAberto} onEditar={() => void editar(lancamento)} onExcluir={() => void excluir(lancamento)} onBaixa={() => void baixa(lancamento)} onReembolso={() => void reembolso(lancamento)} /></td></tr>}
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>}
      </CardContent>
    </Card>
    {documentoAberto && <DocumentoPreview documento={documentoAberto} onClose={() => setDocumentoAberto(null)} />}
  </div>;
}
