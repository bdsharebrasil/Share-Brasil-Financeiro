import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Eye, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import { buscarCotistasAeronave } from "@/lib/colaborador-api";
import type { ContaAReceber } from "./tipos";
import { alterarStatusLancamento, buscarDocumentoFinanceiro, editarLancamento, type ContaBancaria } from "@/lib/financeiro-share-api";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { formatarBRL } from "@/components/financeiro-design/lancamento-tabela";

const CORES_STATUS: Record<string, string> = {
  PENDENTE: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", EM_ABERTO: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ATRASADO: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300", EM_ATRASO: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  RECEBIDO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", CANCELADO: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};
function data(iso: string | null) { if (!iso) return "—"; const d = new Date(`${iso.slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); }
function status(value: string) { return value.replace(/_/g, " "); }

export function AbaContasAReceber({ contasBancarias }: { contasBancarias: ContaBancaria[] }) {
  const { contas, carregando, erro, darBaixa, recarregar } = useContasAReceber({});
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [contaSelecionada, setContaSelecionada] = useState<ContaAReceber | null>(null);
  const [documento, setDocumento] = useState<string | null>(null);
  const [documentoVisualizado, setDocumentoVisualizado] = useState<string | null>(null);
  const [carregandoDocumento, setCarregandoDocumento] = useState(false);
  const [nomesCotistas, setNomesCotistas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!documento) {
      setDocumentoVisualizado(null);
      setCarregandoDocumento(false);
      return;
    }
    if (!documento.startsWith("/api/financeiro/")) {
      setDocumentoVisualizado(documento);
      setCarregandoDocumento(false);
      return;
    }

    let cancelado = false;
    let urlBlob: string | null = null;
    setDocumentoVisualizado(null);
    setCarregandoDocumento(true);
    buscarDocumentoFinanceiro(documento)
      .then((blob) => {
        if (cancelado) return;
        urlBlob = URL.createObjectURL(blob);
        setDocumentoVisualizado(urlBlob);
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        toast.error(error instanceof Error ? error.message : "Não foi possível abrir o documento.");
        setDocumento(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoDocumento(false);
      });
    return () => {
      cancelado = true;
      if (urlBlob) URL.revokeObjectURL(urlBlob);
    };
  }, [documento]);

  useEffect(() => {
    let ativo = true;
    const aeronavesIds = [...new Set(contas.map((conta) => conta.aeronaveId).filter((id): id is string => Boolean(id)))];

    if (aeronavesIds.length === 0) {
      setNomesCotistas({});
      return () => { ativo = false; };
    }

    void Promise.all(
      aeronavesIds.map((aeronaveId) =>
        buscarCotistasAeronave(aeronaveId)
          .then((resposta) => resposta.cotistas)
          .catch(() => []),
      ),
    ).then((grupos) => {
      if (!ativo) return;
      setNomesCotistas(
        Object.fromEntries(
          grupos.flatMap((cotistas) =>
            cotistas.map((cotista) => [cotista.id, cotista.nome]),
          ),
        ),
      );
    });

    return () => { ativo = false; };
  }, [contas]);

  const nomeCotistaConta = useCallback(
    (conta: ContaAReceber) =>
      (conta.cotistaId ? nomesCotistas[conta.cotistaId] : null) ||
      conta.cotistaNome ||
      conta.cotista ||
      conta.rateios?.map((rateio) => rateio.cotista_nome).filter(Boolean).join(", ") ||
      "—",
    [nomesCotistas],
  );

  const filtradas = useMemo(() => contas
    .filter((conta) => {
      const cotistasRateio = conta.rateios?.map((rateio) => rateio.cotista_nome).filter(Boolean).join(" ") ?? "";
      const texto = `${conta.descricao ?? ""} ${nomeCotistaConta(conta)} ${cotistasRateio} ${conta.documento ?? ""}`.toLowerCase();
      return (!busca || texto.includes(busca.toLowerCase())) && (filtroStatus === "TODOS" || conta.status === filtroStatus);
    })
    .map((conta) => ({ ...conta, cotista: nomeCotistaConta(conta) })),
    [busca, contas, filtroStatus, nomeCotistaConta],
  );
  const total = contas.reduce((sum, conta) => sum + conta.valor, 0);
  const aberto = contas.filter((conta) => ["PENDENTE", "EM_ABERTO", "ATRASADO", "EM_ATRASO"].includes(conta.status)).reduce((sum, conta) => sum + conta.valor, 0);

  async function editar(conta: ContaAReceber) {
    const descricao = window.prompt("Descrição do recebimento", conta.descricao ?? "");
    if (!descricao?.trim() || descricao.trim() === conta.descricao) return;
    try { await editarLancamento(conta.lancamentoId ?? conta.id, { descricao: descricao.trim() }); await recarregar(); toast.success("Recebimento atualizado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível editar o recebimento."); }
  }
  async function cancelar(conta: ContaAReceber) {
    if (!window.confirm("Cancelar este recebimento? O registro permanecerá no histórico.")) return;
    try { await alterarStatusLancamento(conta.lancamentoId ?? conta.id, "CANCELADO"); await recarregar(); toast.success("Recebimento cancelado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o recebimento."); }
  }

  return <div className="space-y-4">
    {erro && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm">Contas a receber</CardTitle><p className="mt-1 text-[10px] text-muted-foreground">{contas.length} registros · aberto {formatarBRL(aberto)} · clique em Ações para expandir</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição ou documento" className="h-9 rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary" /><Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="ATRASADO">Atrasado</SelectItem><SelectItem value="RECEBIDO">Recebido</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="p-0">
        {carregando ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            Carregando contas…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-muted/30">
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                  <th className="px-4 py-3">Doc. / emissão</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-sm text-muted-foreground">
                      Nenhuma conta encontrada.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((conta) => {
                    const abertoLinha = expandido === conta.id;
                    const finalizado = ["RECEBIDO", "CANCELADO"].includes(conta.status);
                    return (
                      <Fragment key={conta.id}>
                        <tr className={`border-b border-border/60 hover:bg-primary/5 ${abertoLinha ? "bg-primary/[.03]" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-bold">{conta.documento || "—"}</p>
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CalendarDays size={12} />{data(conta.dataEmissao)}
                            </p>
                          </td>
                          <td className="w-[34%] min-w-[220px] whitespace-normal break-words px-4 py-3">
                            <p className="whitespace-normal break-words font-semibold">
                              {conta.descricao || conta.categoriaNome || "Recebimento"}
                            </p>
                            <p className="mt-1 truncate text-[10px] text-muted-foreground">
                              {conta.categoriaNome || "Sem categoria"}
                            </p>
                          </td>
                          <td className="max-w-[180px] whitespace-normal break-words px-4 py-3 text-muted-foreground">
                            {conta.cotista || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {data(conta.dataVencimento)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatarBRL(conta.valor)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={CORES_STATUS[conta.status] ?? "border-border bg-muted text-muted-foreground"}>
                              {status(conta.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => setExpandido(abertoLinha ? null : conta.id)} className="gap-1.5 text-xs">
                              {abertoLinha ? "Fechar" : "Ações"}
                              {abertoLinha ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </Button>
                          </td>
                        </tr>
                        {abertoLinha && (
                          <tr key={`${conta.id}-detalhe`}>
                            <td colSpan={7} className="p-0">
                              <div className="border-t border-border/70 bg-muted/20 px-4 py-5 sm:px-6">
                                <div className="grid gap-6 lg:grid-cols-2">
                                  <section>
                                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Documentos vinculados</h3>
                                    {conta.documentoUrl ? (
                                      <button type="button" onClick={() => setDocumento(conta.documentoUrl)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/50 hover:bg-primary/5">
                                        <FileText size={15} className="text-primary" />
                                        {conta.documento || "Abrir documento"}
                                        <Eye size={13} className="text-muted-foreground" />
                                      </button>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">Nenhum documento vinculado.</p>
                                    )}
                                  </section>
                                  <section>
                                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Mais informações do recebimento</h3>
                                    <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                                      <div><dt className="text-muted-foreground">Vencimento</dt><dd className="mt-1 font-semibold">{data(conta.dataVencimento)}</dd></div>
                                      <div><dt className="text-muted-foreground">Categoria</dt><dd className="mt-1 truncate font-semibold">{conta.categoriaNome || "—"}</dd></div>
                                      <div><dt className="text-muted-foreground">Recebido em</dt><dd className="mt-1 font-semibold">{data(conta.dataRecebimento)}</dd></div>
                                    </dl>
                                  </section>
                                </div>
                                <div className="mt-5 flex justify-end gap-2 border-t border-border/60 pt-4">
                                  <Button size="sm" variant="outline" onClick={() => void editar(conta)} className="gap-1.5 text-xs"><Pencil size={13} /> Editar</Button>
                                  {!finalizado && <Button size="sm" variant="outline" onClick={() => setContaSelecionada(conta)} className="gap-1.5 text-xs"><CheckCircle2 size={13} /> Dar baixa</Button>}
                                  {!finalizado && <Button size="sm" variant="ghost" onClick={() => void cancelar(conta)} className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /> Excluir</Button>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    {contaSelecionada && <ModalContaAReceber conta={contaSelecionada} aberto onFechar={() => setContaSelecionada(null)} onConfirmar={async (dados) => { await darBaixa(contaSelecionada.id, dados); setContaSelecionada(null); }} contasBancarias={contasBancarias} />}
    {documento && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDocumento(null)}><div className="h-[85vh] w-full max-w-5xl rounded-xl bg-background p-3" onClick={(e) => e.stopPropagation()}>{carregandoDocumento ? <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando documento…</p> : documentoVisualizado ? <iframe title="Documento vinculado" src={documentoVisualizado} className="h-full w-full rounded-lg border border-border" /> : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Documento indisponível.</p>}</div></div>}
    <span className="sr-only">Total a receber: {formatarBRL(total)}</span>
  </div>;
}
