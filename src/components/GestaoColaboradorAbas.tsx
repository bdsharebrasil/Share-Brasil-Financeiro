import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, Eye, FileText, FolderOpen, Image as ImageIcon, Loader2, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EtiquetaStatus, EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { carregarArquivoColaborador, type FichaColaborador } from "@/lib/colaborador-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const card = "rounded-xl border border-border bg-card/80 shadow-sm";
const dataBr = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
const brl = (value: unknown) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

type DocumentoFicha = FichaColaborador["documentos"][number];

type GrupoTemporalProps<T> = {
  items: T[];
  dateFor: (item: T) => string;
  empty: string;
  render: (item: T) => ReactNode;
  compact?: boolean;
};

export function FichaColaboradorAbas({ ficha, onClose }: { ficha: FichaColaborador; onClose: () => void }) {
  const { perfil } = ficha;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <section className={`${card} max-h-[92dvh] w-full max-w-6xl overflow-y-auto bg-background p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <IndicadorPagina>Ficha de RH</IndicadorPagina>
          <h2 className="mt-1 text-xl font-extrabold">{perfil.nome_exibicao || perfil.nome_completo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{perfil.departamento || "Departamento não informado"} · {perfil.email}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}><X size={17} /></Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="CPF" value={perfil.cpf || "—"} />
        <Info label="RG / CANAC" value={`${perfil.rg || "—"} / ${perfil.canac || "—"}`} />
        <Info label="Telefone" value={perfil.telefone || "—"} />
        <Info label="Admissão" value={dataBr(perfil.data_admissao)} />
      </div>
      <Tabs defaultValue="documentos" className="mt-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-secondary/50 p-1">
          <TabsTrigger value="documentos" className="h-10 gap-2 text-[10px] data-[state=active]:bg-background"><FileText size={14} /> Documentos</TabsTrigger>
          <TabsTrigger value="ferias" className="h-10 gap-2 text-[10px] data-[state=active]:bg-background"><CalendarDays size={14} /> Férias</TabsTrigger>
          <TabsTrigger value="extrato" className="h-10 gap-2 text-[10px] data-[state=active]:bg-background"><WalletCards size={14} /> Extrato recebido</TabsTrigger>
        </TabsList>
        <TabsContent value="documentos"><DocumentosColaborador documentos={ficha.documentos} /></TabsContent>
        <TabsContent value="ferias"><PastasTemporais items={ficha.ferias} dateFor={(item) => item.data_inicio} empty="Nenhuma solicitação de férias encontrada" render={(item) => <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{dataBr(item.data_inicio)} a {dataBr(item.data_fim)}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.observacoes || "Sem observações"}</p></div><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-primary">{item.quantidade_dias} dias</span><EtiquetaStatus tone={item.status === "aprovada" ? "green" : item.status === "solicitada" ? "amber" : item.status === "reprovada" ? "red" : "neutral"}>{item.status}</EtiquetaStatus></div></div>} /></TabsContent>
        <TabsContent value="extrato"><PastasTemporais items={ficha.recebimentos} dateFor={(item) => String(item.data_despesa || item.data || item.criado_em || "")} empty="Nenhum recebimento encontrado" render={(item) => <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{String(item.descricao || item.tipo || "Recebimento")}</p><p className="mt-1 text-[10px] text-muted-foreground">{dataBr(String(item.data_despesa || item.data || item.criado_em || ""))}{item.observacoes ? ` · ${String(item.observacoes)}` : ""}</p></div><div className="text-right"><p className="font-mono text-xs font-bold text-emerald-500">{brl(item.valor)}</p><EtiquetaStatus tone={item.status === "pago" ? "green" : item.status === "cancelado" ? "red" : "amber"}>{String(item.status || "Registrado")}</EtiquetaStatus></div></div>} /></TabsContent>
      </Tabs>
    </section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card/50 p-3"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><strong className="mt-1 block truncate text-xs">{value}</strong></div>;
}

function DocumentosColaborador({ documentos }: { documentos: DocumentoFicha[] }) {
  const [selecionado, setSelecionado] = useState<DocumentoFicha | null>(documentos[0] || null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    let url = "";
    setPreviewUrl("");
    setErro("");
    if (!selecionado) return () => undefined;
    setCarregando(true);
    const caminho = String(selecionado.arquivo_url || `/api/colaborador/documentos/${encodeURIComponent(String(selecionado.id))}/arquivo`);
    void carregarArquivoColaborador(caminho).then((blob) => {
      if (!ativo) return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    }).catch((cause) => {
      if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível abrir o documento.");
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selecionado]);

  const mime = String(selecionado?.mime_type || selecionado?.tipo_arquivo || "").toLowerCase();
  const baixar = () => {
    if (!previewUrl || !selecionado) return;
    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = selecionado.nome_arquivo || "documento";
    anchor.click();
  };

  return <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,.8fr)_minmax(0,1.6fr)]">
    <section className="overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-xs font-bold">Pastas de documentos</p><p className="mt-0.5 text-[10px] text-muted-foreground">Organizados por ano e mês</p></div><FolderOpen size={15} className="text-primary" /></div>
      <div className="max-h-[470px] overflow-y-auto p-3"><PastasTemporais items={documentos} dateFor={(item) => item.criado_em} empty="Nenhum documento enviado" render={(item) => <button type="button" onClick={() => setSelecionado(item)} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors ${selecionado?.id === item.id ? "bg-primary/10 text-primary" : "hover:bg-secondary/50"}`}><FileText size={14} className="shrink-0" /><span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{item.nome_arquivo || item.categoria || "Documento"}</span><Eye size={12} className="shrink-0 text-muted-foreground" /></button>} compact /></div>
    </section>
    <section className="min-h-[390px] overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{selecionado?.nome_arquivo || "Visualização do documento"}</p>{selecionado && <p className="mt-0.5 text-[10px] text-muted-foreground">{selecionado.categoria || "Documento"} · {dataBr(selecionado.criado_em)}</p>}</div>{previewUrl && <Button type="button" variant="outline" onClick={baixar} className="h-7 gap-1.5 px-2 text-[9px]"><Download size={12} /> Baixar</Button>}</div>
      <div className="flex min-h-[340px] items-center justify-center bg-secondary/20 p-3">{!selecionado ? <EstadoVazio label="Selecione um documento" /> : carregando ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Carregando documento...</div> : erro ? <p className="text-xs text-red-300">{erro}</p> : previewUrl && mime === "application/pdf" ? <iframe src={previewUrl} title={`Visualização de ${selecionado.nome_arquivo}`} className="h-[500px] w-full rounded-lg border border-border bg-background" /> : previewUrl && mime.startsWith("image/") ? <img src={previewUrl} alt={selecionado.nome_arquivo} className="max-h-[500px] max-w-full rounded-lg object-contain" /> : previewUrl ? <div className="text-center"><ImageIcon size={26} className="mx-auto text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Pré-visualização não disponível para este formato.</p><Button type="button" variant="outline" onClick={baixar} className="mt-3 h-8 text-[10px]">Baixar arquivo</Button></div> : null}</div>
    </section>
  </div>;
}

function PastasTemporais<T>({ items, dateFor, empty, render, compact = false }: GrupoTemporalProps<T>) {
  const grupos = useMemo(() => {
    const porAno = new Map<string, Map<string, T[]>>();
    items.forEach((item) => {
      const valor = dateFor(item).slice(0, 10);
      const data = valor ? new Date(`${valor}T00:00:00`) : null;
      const valido = Boolean(data && !Number.isNaN(data.getTime()));
      const ano = valido ? String(data!.getFullYear()) : "Sem data";
      const mes = valido ? String(data!.getMonth() + 1).padStart(2, "0") : "00";
      if (!porAno.has(ano)) porAno.set(ano, new Map());
      const meses = porAno.get(ano)!;
      if (!meses.has(mes)) meses.set(mes, []);
      meses.get(mes)!.push(item);
    });
    return [...porAno.entries()].sort(([anoA], [anoB]) => anoB.localeCompare(anoA, "pt-BR", { numeric: true })).map(([ano, meses]) => ({ ano, meses: [...meses.entries()].sort(([mesA], [mesB]) => Number(mesA) - Number(mesB)) }));
  }, [dateFor, items]);

  if (!items.length) return <div className={compact ? "py-5" : "rounded-xl border border-border bg-card/50 py-8"}><EstadoVazio label={empty} /></div>;
  return <div className="space-y-2">{grupos.map(({ ano, meses }) => <details key={ano} open className="overflow-hidden rounded-xl border border-border bg-card/50"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold"><FolderOpen size={15} className="text-primary" /> Ano {ano}<span className="ml-auto flex items-center gap-2 text-[10px] font-normal text-muted-foreground">{meses.reduce((total, [, registros]) => total + registros.length, 0)} registro(s)<ChevronDown size={14} /></span></summary><div className="space-y-3 border-t border-border p-3">{meses.map(([mes, registros]) => <details key={mes} open className="overflow-hidden rounded-lg border border-border/70"><summary className="flex cursor-pointer list-none items-center gap-2 bg-secondary/30 px-3 py-2 text-[10px] font-bold capitalize"><FolderOpen size={13} className="text-primary/80" /> {mes === "00" ? "Sem mês" : new Date(2024, Number(mes) - 1, 1).toLocaleDateString("pt-BR", { month: "long" })}<span className="ml-auto text-muted-foreground">{registros.length}</span></summary><div className="divide-y divide-border/60">{registros.map((item, index) => <div key={String((item as { id?: string }).id || index)} className="p-3">{render(item)}</div>)}</div></details>)}</div></details>)}</div>;
}
