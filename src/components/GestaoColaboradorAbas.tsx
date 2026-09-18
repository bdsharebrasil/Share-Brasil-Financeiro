import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, Eye, FileText, FolderOpen, Image as ImageIcon, Loader2, Pencil, Trash2, Upload, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EtiquetaStatus, EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { atualizarDocumentoGestao, carregarDocumentoGestao, excluirDocumentoGestao, enviarDocumentoGestao, type FichaColaborador } from "@/lib/colaborador-api";
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

  return <section className={`${card} route-enter mt-6 w-full bg-background p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <IndicadorPagina>Ficha de RH</IndicadorPagina>
          <h2 className="mt-1 text-xl font-extrabold">{perfil.nome_exibicao || perfil.nome_completo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{perfil.departamento || "Departamento não informado"} · {perfil.email}</p>
        </div>
        <Button type="button" variant="outline" onClick={onClose} className="h-8 gap-1.5 px-3 text-[10px]"><X size={14} /> Voltar para colaboradores</Button>
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
        <TabsContent value="documentos"><DocumentosColaborador documentos={ficha.documentos} colaboradorId={perfil.id} /></TabsContent>
        <TabsContent value="ferias"><PastasTemporais items={ficha.ferias} dateFor={(item) => item.data_inicio} empty="Nenhuma solicitação de férias encontrada" render={(item) => <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{dataBr(item.data_inicio)} a {dataBr(item.data_fim)}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.observacoes || "Sem observações"}</p></div><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-primary">{item.quantidade_dias} dias</span><EtiquetaStatus tone={item.status === "aprovada" ? "green" : item.status === "solicitada" ? "amber" : item.status === "reprovada" ? "red" : "neutral"}>{item.status}</EtiquetaStatus></div></div>} /></TabsContent>
        <TabsContent value="extrato"><PastasTemporais items={ficha.recebimentos} dateFor={(item) => String(item.data_vencimento || item.vencimento || item.data || item.criado_em || "")} empty="Nenhum recebimento encontrado" render={(item) => { const status = String(item.status || ""); const pago = Boolean(item.data_pagamento); return <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{String(item.descricao || item.tipo || "Recebimento")}</p><p className="mt-1 text-[10px] text-muted-foreground">Vencimento: {dataBr(String(item.data_vencimento || item.vencimento || item.data || item.criado_em || ""))}{pago ? ` · Pagamento: ${dataBr(String(item.data_pagamento))}` : ""}{item.observacoes ? ` · ${String(item.observacoes)}` : ""}</p></div><div className="text-right"><p className="font-mono text-xs font-bold text-emerald-500">{brl(item.valor)}</p><EtiquetaStatus tone={status.toLowerCase() === "pago" || pago ? "green" : status.toLowerCase() === "cancelado" ? "red" : "amber"}>{status || "Registrado"}</EtiquetaStatus></div></div> }} /></TabsContent>
      </Tabs>
    </section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card/50 p-3"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><strong className="mt-1 block truncate text-xs">{value}</strong></div>;
}

function DocumentosColaborador({ documentos: documentosIniciais, colaboradorId }: { documentos: DocumentoFicha[]; colaboradorId: string }) {
  const [documentos, setDocumentos] = useState<DocumentoFicha[]>(documentosIniciais);
  const [selecionado, setSelecionado] = useState<DocumentoFicha | null>(documentosIniciais[0] || null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [categoria, setCategoria] = useState("documentos");
  const [arquivo, setArquivo] = useState<File | undefined>();
  const [editando, setEditando] = useState(false);

  useEffect(() => { setDocumentos(documentosIniciais); setSelecionado(documentosIniciais[0] || null); }, [documentosIniciais]);
  useEffect(() => {
    let ativo = true; let url = "";
    setPreviewUrl(""); setErro("");
    if (!selecionado) return () => undefined;
    setCarregando(true);
    void carregarDocumentoGestao(colaboradorId, String(selecionado.id)).then((blob) => { if (!ativo) return; url = URL.createObjectURL(blob); setPreviewUrl(url); }).catch((cause) => { if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível abrir o documento."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; if (url) URL.revokeObjectURL(url); };
  }, [colaboradorId, selecionado]);

  const mime = String(selecionado?.mime_type || selecionado?.tipo_arquivo || "").toLowerCase();
  const baixar = () => { if (!previewUrl || !selecionado) return; const anchor = document.createElement("a"); anchor.href = previewUrl; anchor.download = selecionado.nome_arquivo || "documento"; anchor.click(); };
  const salvar = async () => {
    if (!arquivo && !editando) return setErro("Selecione um arquivo para enviar.");
    setSalvando(true); setErro("");
    try {
      const documento = editando && selecionado ? await atualizarDocumentoGestao(colaboradorId, String(selecionado.id), categoria, arquivo) : await enviarDocumentoGestao(colaboradorId, arquivo!, categoria);
      const atualizado = { ...documento, mime_type: documento.tipo_arquivo, tamanho_bytes: documento.tamanho_arquivo, criado_em: documento.criado_em || new Date().toISOString() } as DocumentoFicha;
      setDocumentos((items) => editando ? items.map((item) => item.id === atualizado.id ? atualizado : item) : [atualizado, ...items]);
      setSelecionado(atualizado); setArquivo(undefined); setCategoria("documentos"); setEditando(false);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível salvar o documento."); } finally { setSalvando(false); }
  };
  const remover = async () => {
    if (!selecionado || !window.confirm("Excluir este documento? Essa ação não pode ser desfeita.")) return;
    setSalvando(true); setErro("");
    try { await excluirDocumentoGestao(colaboradorId, String(selecionado.id)); const restantes = documentos.filter((item) => item.id !== selecionado.id); setDocumentos(restantes); setSelecionado(restantes[0] || null); } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível excluir o documento."); } finally { setSalvando(false); }
  };
  const iniciarEdicao = () => { if (!selecionado) return; setCategoria(String(selecionado.categoria || "documentos")); setArquivo(undefined); setEditando(true); };

  return <div className="mt-4 space-y-3">
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card/50 p-3">
      <label className="min-w-[180px] flex-1"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground">Categoria</span><input value={categoria} onChange={(event) => setCategoria(event.target.value)} placeholder="RG, CPF, CNH..." className="h-9 w-full rounded-lg border border-border bg-background/60 px-3 text-[10px] outline-none focus:border-primary/60" /></label>
      <label className="min-w-[220px] flex-[1.5] cursor-pointer"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground">Arquivo {editando ? "para substituir (opcional)" : ""}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setArquivo(event.target.files?.[0])} className="block h-9 w-full cursor-pointer rounded-lg border border-border bg-background/60 px-2 py-2 text-[10px]" /></label>
      <Button type="button" disabled={salvando || (!arquivo && !editando)} onClick={() => void salvar()} className="h-9 gap-1.5 text-[10px]"><Upload size={13} /> {salvando ? "Salvando..." : editando ? "Salvar alteração" : "Enviar documento"}</Button>
      {editando && <Button type="button" variant="outline" onClick={() => { setEditando(false); setArquivo(undefined); }} className="h-9 text-[10px]">Cancelar</Button>}
    </div>
    {erro && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-2 text-[10px] text-red-200">{erro}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,.8fr)_minmax(0,1.6fr)]">
      <section className="overflow-hidden rounded-xl border border-border bg-card/50"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-xs font-bold">Pastas de documentos</p><p className="mt-0.5 text-[10px] text-muted-foreground">RG, CPF, CNH e demais anexos</p></div><FolderOpen size={15} className="text-primary" /></div><div className="max-h-[470px] overflow-y-auto p-3"><PastasTemporais items={documentos} dateFor={(item) => item.criado_em} empty="Nenhum documento enviado" render={(item) => <button type="button" onClick={() => { setSelecionado(item); setEditando(false); }} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors ${selecionado?.id === item.id ? "bg-primary/10 text-primary" : "hover:bg-secondary/50"}`}><FileText size={14} className="shrink-0" /><span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{item.nome_arquivo || item.categoria || "Documento"}</span><span className="max-w-20 truncate text-[9px] text-muted-foreground">{item.categoria}</span><Eye size={12} className="shrink-0 text-muted-foreground" /></button>} compact /></div></section>
      <section className="min-h-[390px] overflow-hidden rounded-xl border border-border bg-card/50"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{selecionado?.nome_arquivo || "Visualização do documento"}</p>{selecionado && <p className="mt-0.5 text-[10px] text-muted-foreground">{selecionado.categoria || "Documento"} · {dataBr(selecionado.criado_em)}</p>}</div><div className="flex gap-1.5">{selecionado && <><Button type="button" variant="outline" onClick={iniciarEdicao} className="h-7 gap-1 px-2 text-[9px]"><Pencil size={11} /> Editar</Button><Button type="button" variant="outline" onClick={() => void remover()} disabled={salvando} className="h-7 gap-1 px-2 text-[9px] text-red-300"><Trash2 size={11} /> Excluir</Button></>}{previewUrl && <Button type="button" variant="outline" onClick={baixar} className="h-7 gap-1.5 px-2 text-[9px]"><Download size={12} /> Baixar</Button>}</div></div><div className="flex min-h-[340px] items-center justify-center bg-secondary/20 p-3">{!selecionado ? <EstadoVazio label="Selecione um documento" /> : carregando ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Carregando documento...</div> : erro ? <p className="text-xs text-red-300">{erro}</p> : previewUrl && mime === "application/pdf" ? <iframe src={previewUrl} title={`Visualização de ${selecionado.nome_arquivo}`} className="h-[500px] w-full rounded-lg border border-border bg-background" /> : previewUrl && mime.startsWith("image/") ? <img src={previewUrl} alt={selecionado.nome_arquivo} className="max-h-[500px] max-w-full rounded-lg object-contain" /> : previewUrl ? <div className="text-center"><ImageIcon size={26} className="mx-auto text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Pré-visualização não disponível para este formato.</p><Button type="button" variant="outline" onClick={baixar} className="mt-3 h-8 text-[10px]">Baixar arquivo</Button></div> : null}</div></section>
    </div>
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
