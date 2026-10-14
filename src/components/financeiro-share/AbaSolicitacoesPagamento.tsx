import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, FileImage, FileText, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buscarContasBancariasHolding,
  buscarSolicitacoesPagamento,
  darBaixaContaAPagar,
  enviarComprovanteReembolso,
  formatarData,
  formatarMoeda,
  type ContaBancaria,
  type ReembolsoColaborador,
  type SolicitacaoPagamento,
} from "@/lib/financeiro-share-api";
import { TabelaFinanceiraPremium, type FiltroTabelaFinanceira, type LinhaTabelaFinanceira, type TomStatusFinanceiro } from "@/components/financeiro-design/TabelaFinanceiraPremium";

function statusLegivel(valor: string): string {
  const estado = valor.toUpperCase();
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    EMAIL_ENVIADO: "Enviado",
    CONVERTIDO: "Convertido",
    PAGO: "Pago",
    CANCELADO: "Cancelado",
    EM_ABERTO: "A pagar",
    AGUARDANDO_REEMBOLSO: "Aguardando reembolso",
  };
  return labels[estado] ?? estado.replace(/_/g, " ");
}

function tomStatus(valor: string): TomStatusFinanceiro {
  const estado = valor.toUpperCase();
  if (["PAGO", "CONVERTIDO"].includes(estado)) return "emerald";
  if (["APROVADO", "EMAIL_ENVIADO"].includes(estado)) return "blue";
  if (["CANCELADO", "REJEITADO"].includes(estado)) return "muted";
  if (["ATRASADO", "EM_ATRASO"].includes(estado)) return "red";
  return "amber";
}

function dataLegivel(valor: string | null): string {
  return valor ? formatarData(valor) : "—";
}

function textoBusca(...valores: Array<string | null | undefined>): string {
  return valores.filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}

const FILTROS_ENVIO: FiltroTabelaFinanceira[] = [
  { id: "TODOS", label: "Todos" },
  { id: "PENDENTES", label: "Pendentes" },
  { id: "EM_ANDAMENTO", label: "Em andamento" },
  { id: "CONCLUIDOS", label: "Convertidos" },
  { id: "CANCELADOS", label: "Cancelados" },
];

export function AbaSolicitacoesPagamento({ contasBancarias }: { contasBancarias: ContaBancaria[] }) {
  const [envios, setEnvios] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<ReembolsoColaborador | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroEnvio, setFiltroEnvio] = useState("TODOS");
  const [filtroReembolso, setFiltroReembolso] = useState("TODOS");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoId, setBancoId] = useState("");
  const [comprovanteArquivo, setComprovanteArquivo] = useState<File | null>(null);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [contasParaPagamento, setContasParaPagamento] = useState<ContaBancaria[]>(contasBancarias);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarSolicitacoesPagamento();
      setEnvios(dados.envios);
      setReembolsos(dados.reembolsos);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as solicitações de pagamento.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    let ativo = true;
    if (!alvo || String(alvo.tipoCaixa).toUpperCase() !== "HOLDING") {
      setContasParaPagamento(contasBancarias);
      return () => { ativo = false; };
    }
    void buscarContasBancariasHolding()
      .then((contas) => {
        if (ativo) setContasParaPagamento(contas.filter((conta) => !alvo.holdingId || conta.holding_id === alvo.holdingId));
      })
      .catch(() => { if (ativo) setContasParaPagamento([]); });
    return () => { ativo = false; };
  }, [alvo, contasBancarias]);

  async function confirmarBaixa() {
    if (!alvo?.id || !bancoId) return;
    setSalvando(true);
    try {
      let comprovanteUrl: string | undefined;
      if (comprovanteArquivo) {
        setEnviandoComprovante(true);
        comprovanteUrl = (await enviarComprovanteReembolso(alvo.id, comprovanteArquivo)).url;
        setEnviandoComprovante(false);
      }
      await darBaixaContaAPagar(alvo.id, {
        dataPagamento,
        bancoPagamento: bancoId,
        comprovantePagamentoUrl: comprovanteUrl,
        formaPagamento: "TRANSFERENCIA",
      });
      toast.success("Reembolso do colaborador marcado como pago.");
      setAlvo(null);
      setComprovanteArquivo(null);
      await carregar();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível registrar o pagamento.");
    } finally {
      setEnviandoComprovante(false);
      setSalvando(false);
    }
  }

  function selecionarComprovante(arquivo?: File) {
    if (!arquivo) return;
    const tiposAceitos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!tiposAceitos.includes(arquivo.type)) {
      toast.error("Escolha um arquivo PDF, JPG, PNG ou WebP.");
      return;
    }
    if (arquivo.size < 1 || arquivo.size > 10 * 1024 * 1024) {
      toast.error("O comprovante deve ter no máximo 10 MB.");
      return;
    }
    setComprovanteArquivo(arquivo);
  }

  function fecharBaixa(aberto: boolean) {
    if (aberto || salvando) return;
    setAlvo(null);
    setComprovanteArquivo(null);
    setBancoId("");
  }

  const enviosFiltrados = useMemo(() => envios.filter((item) => {
    const estado = item.status.toUpperCase();
    const atendeFiltro = filtroEnvio === "TODOS"
      || (filtroEnvio === "PENDENTES" && estado === "PENDENTE")
      || (filtroEnvio === "EM_ANDAMENTO" && ["APROVADO", "EMAIL_ENVIADO"].includes(estado))
      || (filtroEnvio === "CONCLUIDOS" && estado === "CONVERTIDO")
      || (filtroEnvio === "CANCELADOS" && estado === "CANCELADO");
    return atendeFiltro && (!busca || textoBusca(item.id, item.descricao, item.fornecedor_nome, item.fornecedor, item.solicitante_nome).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [envios, filtroEnvio, busca]);

  const reembolsosFiltrados = useMemo(() => reembolsos.filter((item) => {
    const vencido = item.dataVencimento.slice(0, 10) < new Date().toISOString().slice(0, 10);
    const atendeFiltro = filtroReembolso === "TODOS" || (filtroReembolso === "VENCIDOS" && vencido);
    return atendeFiltro && (!busca || textoBusca(item.id, item.documento, item.descricao, item.fornecedor, item.numeroVoo, item.cotistaNome, item.solicitanteNome, item.aeronaveId).includes(busca.toLocaleLowerCase("pt-BR")));
  }), [reembolsos, filtroReembolso, busca]);

  const opcoesEnvio = useMemo(() => FILTROS_ENVIO.map((filtro) => ({
    ...filtro,
    quantidade: envios.filter((item) => {
      const estado = item.status.toUpperCase();
      if (filtro.id === "TODOS") return true;
      if (filtro.id === "PENDENTES") return estado === "PENDENTE";
      if (filtro.id === "EM_ANDAMENTO") return ["APROVADO", "EMAIL_ENVIADO"].includes(estado);
      if (filtro.id === "CONCLUIDOS") return estado === "CONVERTIDO";
      return estado === "CANCELADO";
    }).length,
  })), [envios]);

  const hoje = new Date().toISOString().slice(0, 10);
  const opcoesReembolso: FiltroTabelaFinanceira[] = [
    { id: "TODOS", label: "Todos", quantidade: reembolsos.length },
    { id: "VENCIDOS", label: "Vencidos", quantidade: reembolsos.filter((item) => item.dataVencimento.slice(0, 10) < hoje).length },
  ];

  const linhasEnvio: LinhaTabelaFinanceira[] = enviosFiltrados.map((item) => {
    const chave = `envio:${item.id}`;
    const aberto = expandido === chave;
    return {
      id: chave,
      principal: item.fornecedor_nome ?? item.fornecedor ?? "—",
      secundaria: item.descricao,
      categoria: item.tipo === "reembolso" ? "Reembolso" : "Caixa cliente",
      vencimento: dataLegivel(item.vencimento),
      valor: `−${formatarMoeda(Number(item.valor ?? 0))}`,
      status: item.status,
      statusLabel: statusLegivel(item.status),
      tomStatus: tomStatus(item.status),
      acoes: <Button type="button" size="sm" variant="outline" onClick={() => setExpandido(aberto ? null : chave)} className="h-8 gap-1.5 text-[11px]">{aberto ? "Fechar" : "Detalhes"}{aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</Button>,
      expandida: aberto,
      detalhe: <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-primary">Documentos vinculados</h3>
          <p className="text-[11px] text-muted-foreground"><FileText size={13} className="mr-2 inline text-primary" />Os documentos desta solicitação ficam disponíveis no lançamento financeiro após a conversão.</p>
        </section>
        <section>
          <h3 className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-primary">Mais informações</h3>
          <dl className="grid grid-cols-2 gap-3 text-[11px]">
            <div><dt className="text-muted-foreground">Vencimento</dt><dd className="mt-1 font-semibold">{dataLegivel(item.vencimento)}</dd></div>
            <div><dt className="text-muted-foreground">Solicitante</dt><dd className="mt-1 font-semibold">{item.solicitante_nome ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Data da despesa</dt><dd className="mt-1 font-semibold">{dataLegivel(item.data_despesa)}</dd></div>
          </dl>
        </section>
      </div>,
    };
  });

  const linhasReembolso: LinhaTabelaFinanceira[] = reembolsosFiltrados.map((item) => {
    const chave = `reembolso:${item.id}`;
    const aberto = expandido === chave;
    return {
      id: chave,
      principal: item.documento || item.descricao || "Despesa reembolsável",
      secundaria: `${dataLegivel(item.dataEmissao ?? null)} · ${item.descricao ?? "Reembolso de colaborador"}`,
      categoria: item.categoriaNome || "Reembolso de colaborador",
      vencimento: dataLegivel(item.dataVencimento),
      valor: `−${formatarMoeda(item.valor)}`,
      status: item.status,
      statusLabel: statusLegivel(item.status),
      tomStatus: tomStatus(item.status),
      acoes: <Button type="button" size="sm" variant="outline" onClick={() => setExpandido(aberto ? null : chave)} className="h-8 gap-1.5 text-[11px]">{aberto ? "Fechar" : "Detalhes"}{aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</Button>,
      expandida: aberto,
      detalhe: <div>
        <div className="grid gap-5 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-primary">Documentos vinculados</h3>
            {item.documentoUrl
              ? <a href={item.documentoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[11px] font-medium text-primary underline-offset-4 hover:underline"><FileText size={13} />{item.documento || "Abrir documento vinculado"}</a>
              : <p className="text-[11px] text-muted-foreground"><FileText size={13} className="mr-2 inline text-primary" />Nenhum documento vinculado diretamente ao título.</p>}
          </section>
          <section>
            <h3 className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-primary">Mais informações</h3>
            <dl className="grid grid-cols-2 gap-3 text-[11px]">
              <div><dt className="text-muted-foreground">Vencimento</dt><dd className="mt-1 font-semibold">{dataLegivel(item.dataVencimento)}</dd></div>
              <div><dt className="text-muted-foreground">Caixa</dt><dd className="mt-1 font-semibold">{String(item.tipoCaixa).toUpperCase() === "HOLDING" ? "Holding" : "Share"}</dd></div>
              <div><dt className="text-muted-foreground">Fornecedor</dt><dd className="mt-1 font-semibold">{item.fornecedor || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Número do voo</dt><dd className="mt-1 font-semibold">{item.numeroVoo || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Cotista</dt><dd className="mt-1 font-semibold">{item.cotistaNome || "—"}</dd></div>
            </dl>
          </section>
        </div>
        <div className="mt-4 flex justify-end border-t border-border/60 pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setAlvo(item);
            setDataPagamento(new Date().toISOString().slice(0, 10));
            setBancoId("");
            setComprovanteArquivo(null);
          }} className="h-8 gap-1.5 text-[11px]"><CheckCircle2 size={13} /> Dar baixa</Button>
        </div>
      </div>,
    };
  });

  return (
    <div className="space-y-3">
      {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{erro}</p>}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando} className="h-8 gap-2 text-[11px]"><RefreshCw size={13} className={carregando ? "animate-spin" : ""} /> Atualizar</Button>
      </div>
      <Tabs defaultValue="cotista" onValueChange={() => { setBusca(""); setExpandido(null); }} className="space-y-3">
        <TabsList className="financeiro-tabs h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1">
          <TabsTrigger value="cotista" className="shrink-0 rounded-lg px-3 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Caixa cliente <span className="ml-1 opacity-70">{envios.length}</span></TabsTrigger>
          <TabsTrigger value="colaborador" className="shrink-0 rounded-lg px-3 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reembolso colaborador <span className="ml-1 opacity-70">{reembolsos.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="cotista" className="mt-0">
          <TabelaFinanceiraPremium
            titulo="Solicitações de pagamento"
            descricao={`${envios.length} ${envios.length === 1 ? "solicitação" : "solicitações"} · caixa cliente`}
            linhas={linhasEnvio}
            filtros={opcoesEnvio}
            filtroAtivo={filtroEnvio}
            aoFiltrar={setFiltroEnvio}
            busca={busca}
            aoBuscar={setBusca}
            placeholderBusca="Buscar solicitação, fornecedor ou solicitante"
            carregando={carregando}
            mensagemVazia="Nenhuma solicitação de pagamento encontrada."
          />
        </TabsContent>
        <TabsContent value="colaborador" className="mt-0">
          <TabelaFinanceiraPremium
            titulo="Reembolsos de colaboradores"
            descricao={`${reembolsos.length} ${reembolsos.length === 1 ? "título" : "títulos"} · aguardando pagamento`}
            linhas={linhasReembolso}
            filtros={opcoesReembolso}
            filtroAtivo={filtroReembolso}
            aoFiltrar={setFiltroReembolso}
            busca={busca}
            aoBuscar={setBusca}
            placeholderBusca="Buscar documento, descrição, fornecedor, voo ou cotista"
            carregando={carregando}
            mensagemVazia="Nenhum reembolso pendente encontrado."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(alvo)} onOpenChange={fecharBaixa}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-border/70 p-0">
          <div className="border-b border-border/70 bg-gradient-to-br from-primary/[.12] via-transparent to-emerald-500/[.06] p-5 sm:p-6">
            <DialogHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><CheckCircle2 size={20} /></div>
              <DialogTitle className="text-lg">Dar baixa no reembolso</DialogTitle>
              <p className="text-xs text-muted-foreground">Registre o pagamento e, se desejar, anexe o comprovante.</p>
            </DialogHeader>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Colaborador · {alvo?.solicitanteNome || "Reembolso"}</p><p className="mt-1 truncate text-sm font-semibold">{alvo?.descricao || "Despesa reembolsável"}</p><p className="mt-1 text-[10px] text-muted-foreground">Vencimento {dataLegivel(alvo?.dataVencimento || null)}</p></div>
              <strong className="shrink-0 text-lg font-extrabold text-primary">{formatarMoeda(alvo?.valor ?? 0)}</strong>
            </div>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="reembolso-data" className="flex items-center gap-2 text-xs"><CalendarDays size={14} className="text-primary" />Data do pagamento</Label><Input id="reembolso-data" type="date" value={dataPagamento} onChange={(event) => setDataPagamento(event.target.value)} /></div>
              <div className="grid gap-2"><Label className="text-xs">Conta {String(alvo?.tipoCaixa).toUpperCase() === "HOLDING" ? "da holding" : "Share"}</Label><Select value={bancoId} onValueChange={setBancoId}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contasParaPagamento.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <section className="space-y-2">
              <div><Label className="text-xs">Comprovante de pagamento <span className="font-normal text-muted-foreground">· opcional</span></Label><p className="mt-1 text-[10px] text-muted-foreground">Imagem ou PDF · até 10 MB</p></div>
              {comprovanteArquivo ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[.05] p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{comprovanteArquivo.type === "application/pdf" ? <FileText size={18} /> : <FileImage size={18} />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{comprovanteArquivo.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{(comprovanteArquivo.size / (1024 * 1024)).toFixed(2)} MB · pronto para enviar</p></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover comprovante" disabled={salvando} onClick={() => setComprovanteArquivo(null)} className="h-8 w-8 shrink-0"><X size={15} /></Button>
                </div>
              ) : (
                <label htmlFor="reembolso-comprovante-arquivo" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[.04]">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload size={16} /></span><span className="text-xs font-semibold">Clique para escolher o comprovante</span><span className="mt-1 text-[10px] text-muted-foreground">PDF, JPG, PNG ou WebP</span>
                  <input id="reembolso-comprovante-arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={salvando} onChange={(event) => { selecionarComprovante(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
              )}
              {enviandoComprovante && <p role="status" className="text-[10px] text-primary">Enviando comprovante…</p>}
            </section>
          </div>
          <DialogFooter className="border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" disabled={salvando} onClick={() => fecharBaixa(false)}>Cancelar</Button>
            <Button type="button" disabled={salvando || !bancoId || !dataPagamento} onClick={() => void confirmarBaixa()}><CheckCircle2 size={15} className="mr-2" />{salvando ? enviandoComprovante ? "Enviando comprovante…" : "Registrando pagamento…" : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
