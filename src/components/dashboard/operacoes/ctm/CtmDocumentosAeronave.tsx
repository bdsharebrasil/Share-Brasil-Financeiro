import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowDownToLine, CalendarDays, CheckCircle2, Clock3, Eye, FileCheck2, FileText, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  atualizarCtmDocumentoAeronave,
  buscarCtmDocumentosAeronave,
  carregarArquivoCtmDocumentoAeronave,
  excluirCtmDocumentoAeronave,
  enviarCtmDocumentoAeronave,
  type CtmDocumentoAeronave,
  type CtmDocumentoAeronavePayload,
  type CtmRegistro,
} from "@/lib/colaborador-api";

type TomDocumento = "green" | "amber" | "red" | "neutral";
type FiltroDocumento = "todos" | "em_dia" | "atencao" | "criticos" | "arquivados";
type FormDocumento = { nome: string; descricao: string; tipo_documento: string; data_validade: string; dias_alerta: string };
type DocumentoVisual = CtmDocumentoAeronave & { diasRestantes: number | null; tom: TomDocumento; alertaAtivo: boolean };
type Props = { podeEditar: boolean; aeronaveId: string; aeronaves: CtmRegistro[]; onSelecionarAeronave: (id: string) => void };

const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const FORMULARIO_VAZIO: FormDocumento = { nome: "", descricao: "", tipo_documento: "outro", data_validade: "", dias_alerta: "30" };
const TIPOS_DOCUMENTO = [
  ["certificado_aeronavegabilidade", "Certificado de aeronavegabilidade"],
  ["seguro", "Seguro"],
  ["inspecao", "Inspeção"],
  ["licenca", "Licença / autorização"],
  ["manual", "Manual"],
  ["outro", "Outro documento"],
] as const;
const CLASSES_TOM: Record<TomDocumento, { card: string; faixa: string; badge: string; icon: string; texto: string; rotulo: string }> = {
  green: { card: "border-emerald-500/20 bg-emerald-500/[0.035] hover:border-emerald-500/45", faixa: "bg-emerald-400", badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: "bg-emerald-400/10 text-emerald-300", texto: "text-emerald-300", rotulo: "Em dia" },
  amber: { card: "border-amber-400/25 bg-amber-400/[0.035] hover:border-amber-400/50", faixa: "bg-amber-300", badge: "border-amber-400/20 bg-amber-400/10 text-amber-200", icon: "bg-amber-400/10 text-amber-200", texto: "text-amber-200", rotulo: "Atenção" },
  red: { card: "border-rose-400/30 bg-rose-400/[0.045] hover:border-rose-400/55", faixa: "bg-rose-400", badge: "border-rose-400/20 bg-rose-400/10 text-rose-300", icon: "bg-rose-400/10 text-rose-300", texto: "text-rose-300", rotulo: "Crítico" },
  neutral: { card: "border-border/80 bg-background/45 hover:border-border", faixa: "bg-slate-500", badge: "border-border bg-secondary/50 text-muted-foreground", icon: "bg-secondary text-muted-foreground", texto: "text-muted-foreground", rotulo: "Sem validade" },
};

function nomeAeronave(item: CtmRegistro) {
  const matricula = String(item.matricula_registro || item.matricula || "Aeronave");
  const modelo = String(item.modelo || item.fabricante || "");
  return modelo ? `${matricula} · ${modelo}` : matricula;
}
function dataChaveLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
function diasParaVencimento(valor: string | null, hoje: string): number | null {
  if (!valor) return null;
  const partes = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(valor.trim());
  if (!partes) return null;
  const [, ano, mes, dia] = partes.map(Number) as unknown as [number, number, number, number];
  const vencimento = new Date(ano, mes - 1, dia);
  const referencia = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10)));
  if (vencimento.getFullYear() !== ano || vencimento.getMonth() !== mes - 1 || vencimento.getDate() !== dia) return null;
  return Math.round((vencimento.getTime() - referencia.getTime()) / 86_400_000);
}
function dataBr(valor: string | null) {
  if (!valor) return "Sem vencimento";
  const partes = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(valor.trim());
  if (!partes) return valor;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}
function tomDoDocumento(dias: number | null): TomDocumento {
  if (dias === null) return "neutral";
  if (dias <= 45) return "red";
  if (dias <= 60) return "amber";
  return "green";
}
function textoVencimento(dias: number | null) {
  if (dias === null) return "Sem data de vencimento";
  if (dias < 0) return `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}
function nomeTipoDocumento(valor: string | null) {
  return TIPOS_DOCUMENTO.find(([key]) => key === valor)?.[1] || (valor ? valor.replace(/[_-]/g, " ") : "Documento técnico");
}
function tamanhoLegivel(valor: number | null) {
  if (!valor || valor < 0) return "Tamanho indisponível";
  if (valor < 1024 * 1024) return `${Math.max(1, Math.round(valor / 1024))} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CtmDocumentosAeronave({ aeronaveId, aeronaves, onSelecionarAeronave, podeEditar }: Props) {
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<CtmDocumentoAeronave[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroDocumento>("todos");
  const [dialogFormulario, setDialogFormulario] = useState(false);
  const [editando, setEditando] = useState<CtmDocumentoAeronave | null>(null);
  const [form, setForm] = useState<FormDocumento>(FORMULARIO_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exclusaoPendente, setExclusaoPendente] = useState<CtmDocumentoAeronave | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [preview, setPreview] = useState<{ documento: CtmDocumentoAeronave; url: string } | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState("");
  const hoje = dataChaveLocal(new Date());
  const previewUrl = preview?.url ?? null;
  const aeronaveSelecionada = aeronaves.find((item) => String(item.id) === aeronaveId);

  const carregar = useCallback(async (silencioso = false) => {
    if (!aeronaveId) { setDocumentos([]); setCarregando(false); return; }
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro("");
    try {
      const resposta = await buscarCtmDocumentosAeronave(aeronaveId);
      setDocumentos(Array.isArray(resposta.documentos) ? resposta.documentos : []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os documentos desta aeronave.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [aeronaveId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const documentosVisuais = useMemo<DocumentoVisual[]>(() => documentos.map((documento) => {
    const diasRestantes = diasParaVencimento(documento.data_validade, hoje);
    const tom = tomDoDocumento(diasRestantes);
    const limiteAlerta = Math.max(0, Number(documento.dias_alerta ?? 30));
    return { ...documento, diasRestantes, tom, alertaAtivo: diasRestantes !== null && diasRestantes <= limiteAlerta };
  }), [documentos, hoje]);
  const resumo = useMemo(() => ({
    total: documentosVisuais.length,
    emDia: documentosVisuais.filter((item) => !item.arquivado && item.tom === "green").length,
    atencao: documentosVisuais.filter((item) => !item.arquivado && item.tom === "amber").length,
    criticos: documentosVisuais.filter((item) => !item.arquivado && item.tom === "red").length,
  }), [documentosVisuais]);
  const visiveis = useMemo(() => documentosVisuais.filter((item) => {
    if(filtro==="arquivados")return !!item.arquivado;
    if(item.arquivado)return false;
    if (filtro === "em_dia") return item.tom === "green";
    if (filtro === "atencao") return item.tom === "amber";
    if (filtro === "criticos") return item.tom === "red";
    return true;
  }), [documentosVisuais, filtro]);

  const abrirNovo = () => { setEditando(null); setForm(FORMULARIO_VAZIO); setArquivo(null); setDialogFormulario(true); };
  const abrirEdicao = (item: CtmDocumentoAeronave) => {
    setEditando(item);
    setForm({ nome: item.nome, descricao: item.descricao || "", tipo_documento: item.tipo_documento || "outro", data_validade: item.data_validade?.slice(0, 10) || "", dias_alerta: String(item.dias_alerta ?? 30) });
    setArquivo(null);
    setDialogFormulario(true);
  };
  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!aeronaveId) return;
    if (!form.nome.trim()) { toast({ title: "Informe o nome do documento", variant: "destructive" }); return; }
    const dias = Number(form.dias_alerta);
    if (!Number.isInteger(dias) || dias < 0 || dias > 3650) { toast({ title: "Prazo de alerta inválido", description: "Use um número de dias entre 0 e 3.650.", variant: "destructive" }); return; }
    if (!editando && !arquivo) { toast({ title: "Selecione um arquivo PDF ou imagem", variant: "destructive" }); return; }
    if (arquivo && arquivo.size > TAMANHO_MAXIMO) { toast({ title: "Arquivo acima do limite", description: "O limite por arquivo é de 25 MB.", variant: "destructive" }); return; }
    const payload: CtmDocumentoAeronavePayload = { nome: form.nome.trim(), descricao: form.descricao.trim() || null, tipo_documento: form.tipo_documento, data_validade: form.data_validade || null, dias_alerta: dias };
    setSalvando(true);
    try {
      if (editando) {
        await atualizarCtmDocumentoAeronave(aeronaveId, editando.id, payload);
        toast({ title: "Documento atualizado", description: "Vencimento e regra de alerta salvos." });
      } else if (arquivo) {
        await enviarCtmDocumentoAeronave(aeronaveId, payload, arquivo);
        toast({ title: "Documento anexado", description: "O arquivo foi armazenado para esta aeronave." });
      }
      setDialogFormulario(false);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };
  const excluir = async () => {
    if (!aeronaveId || !exclusaoPendente) return;
    setExcluindo(true);
    try {
      await excluirCtmDocumentoAeronave(aeronaveId, exclusaoPendente.id);
      toast({ title: "Documento arquivado", description: "Disponível no filtro Arquivados." });
      setExclusaoPendente(null);
      await carregar(true);
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setExcluindo(false);
    }
  };
  const visualizar = async (documento: CtmDocumentoAeronave) => {
    setCarregandoPreview(documento.id);
    try {
      const blob = await carregarArquivoCtmDocumentoAeronave(aeronaveId, documento.id);
      setPreview({ documento, url: URL.createObjectURL(blob) });
    } catch (error) {
      toast({ title: "Falha ao abrir o arquivo", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setCarregandoPreview("");
    }
  };
  const escolherArquivo = (file?: File) => {
    if (!file) { setArquivo(null); return; }
    if (file.size > TAMANHO_MAXIMO) { setArquivo(null); toast({ title: "Arquivo acima do limite", description: "O limite por arquivo é de 25 MB.", variant: "destructive" }); return; }
    if (file.type && file.type !== "application/pdf" && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setArquivo(null);
      toast({ title: "Formato não permitido", description: "Envie um PDF, JPEG, PNG, WebP ou GIF.", variant: "destructive" });
      return;
    }
    setArquivo(file);
    if (!form.nome.trim()) setForm((atual) => ({ ...atual, nome: file.name.replace(/\.[^.]+$/, "") }));
  };

  if (!aeronaveId) return <section className="overflow-hidden rounded-[26px] border border-border bg-card/60 shadow-xl">
    <div className="relative isolate overflow-hidden border-b border-border/70 bg-card dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 p-6 text-foreground dark:text-white sm:p-8"><div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.18),_transparent_50%)]" /><div className="flex items-center gap-3"><span className="rounded-xl border border-border dark:border-white/10 bg-white/10 p-3"><FileCheck2 className="h-6 w-6 text-sky-300" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary dark:text-sky-200/80">CTM · Controle documental</p><h2 className="mt-1 text-xl font-bold">Documentos por aeronave</h2></div></div><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-slate-300">Escolha uma matrícula para abrir os documentos correspondentes. Cada arquivo e vencimento é consultado isoladamente, sem misturar aeronaves.</p></div>
    <div className="p-6 sm:p-8">{aeronaves.length ? <div className="max-w-xl space-y-2"><Label htmlFor="ctm-documentos-aeronave">Selecione a aeronave</Label><select id="ctm-documentos-aeronave" defaultValue="" onChange={(event) => event.target.value && onSelecionarAeronave(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/40"><option value="" disabled>Escolha uma matrícula…</option>{aeronaves.map((item) => <option key={String(item.id)} value={String(item.id)}>{nomeAeronave(item)}</option>)}</select></div> : <p className="text-sm text-muted-foreground">Nenhuma aeronave ativa foi encontrada.</p>}</div>
  </section>;

  const filtroBotao = (id: FiltroDocumento, label: string, quantidade?: number) => <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${filtro === id ? "border-primary/50 bg-primary/10 text-primary shadow-sm" : "border-border/70 bg-background/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>{label}{quantidade !== undefined && <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] tabular-nums">{quantidade}</span>}</button>;

  return <div className="space-y-5">
    <section className="relative isolate overflow-hidden rounded-2xl border border-slate-700/50 bg-card dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 px-4 py-3 text-foreground dark:text-white shadow-md shadow-slate-950/10 sm:px-5 sm:py-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.08),_transparent_48%)]" />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">Documentos da aeronave</h2><p className="mt-0.5 truncate text-xs text-muted-foreground dark:text-slate-300">{aeronaveSelecionada ? nomeAeronave(aeronaveSelecionada) : `Matrícula ${aeronaveId}`} <span className="mx-1 text-slate-600">/</span> arquivos, validade e alertas</p></div>
        <div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-9 gap-2 rounded-lg border-border dark:border-white/15 bg-white/5 px-3 text-xs text-foreground dark:text-white hover:bg-secondary dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"><RefreshCw className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} />Atualizar</Button><Button type="button" disabled={!podeEditar} onClick={abrirNovo} className="h-9 gap-2 rounded-lg bg-sky-400 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-300"><Plus className="h-3.5 w-3.5" />Adicionar documento</Button></div>
      </div>
    </section>

    <section className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-xs font-bold">Faixas de vencimento</p><p className="mt-1 text-[11px] text-muted-foreground">O prazo de alerta pode ser ajustado em cada documento; a cor segue a regra operacional definida.</p></div><div className="flex flex-wrap gap-2"><Legenda tom="green" label="Verde · acima de 60 dias" /><Legenda tom="amber" label="Amarelo · 46–60 dias" /><Legenda tom="red" label="Vermelho · 45 dias ou menos / vencido" /></div></section>

    {erro && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"><span>{erro}</span><Button type="button" variant="outline" size="sm" onClick={() => void carregar()} className="border-rose-400/30">Tentar novamente</Button></div>}

    <section className="overflow-hidden rounded-[24px] border border-border/80 bg-card/45 shadow-xl">
      <div className="flex justify-end border-b border-border/70 p-3 sm:p-4"><div className="flex flex-wrap gap-2">{filtroBotao("todos", "Ativos", documentosVisuais.filter(r=>!r.arquivado).length)}{filtroBotao("em_dia", "Em dia", resumo.emDia)}{filtroBotao("atencao", "Atenção", resumo.atencao)}{filtroBotao("criticos", "Críticos", resumo.criticos)}{filtroBotao("arquivados","Arquivados",documentosVisuais.filter(r=>r.arquivado).length)}</div></div>
      {carregando ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-border/70 bg-secondary/35" />)}</div> : visiveis.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">{visiveis.map((item) => <CartaoDocumento key={item.id} documento={item} podeEditar={podeEditar} onVisualizar={() => void visualizar(item)} onEditar={() => abrirEdicao(item)} onExcluir={() => setExclusaoPendente(item)} visualizando={carregandoPreview === item.id} />)}</div> : <div className="flex flex-col items-center px-5 py-14 text-center"><span className="mb-4 rounded-2xl border border-sky-400/15 bg-sky-400/10 p-4 text-sky-300"><FileCheck2 className="h-7 w-7" /></span>{documentos.length > 0 && <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">Altere o filtro para visualizar outros documentos.</p>}{!documentos.length && podeEditar && <Button type="button" disabled={!podeEditar} onClick={abrirNovo} className="mt-5 gap-2 rounded-xl"><Plus className="h-4 w-4" />Enviar primeiro documento</Button>}</div>}
    </section>

    <Dialog open={dialogFormulario} onOpenChange={(aberto) => { if (!salvando) setDialogFormulario(aberto); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl border-border bg-background text-foreground sm:max-w-xl">
        <form onSubmit={(event) => void salvar(event)}>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-lg"><FileCheck2 className="h-5 w-5 text-primary" />{editando ? "Editar documento" : "Adicionar documento"}</DialogTitle><DialogDescription>{editando ? "Atualize os dados e o vencimento deste documento." : `O arquivo será associado somente à aeronave ${aeronaveSelecionada ? nomeAeronave(aeronaveSelecionada) : aeronaveId}.`}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-5">
            {!editando && <div className="rounded-2xl border border-dashed border-sky-400/30 bg-sky-400/[0.045] p-4"><Label htmlFor="ctm-doc-arquivo" className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold"><UploadCloud className="h-4 w-4 text-sky-300" />Arquivo PDF ou imagem *</Label><Input id="ctm-doc-arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif" required={!editando} onChange={(event) => escolherArquivo(event.target.files?.[0])} className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary" />{arquivo && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{arquivo.name} · {tamanhoLegivel(arquivo.size)}</p>}<p className="mt-2 text-[10px] text-muted-foreground">PDF, JPEG, PNG, WebP ou GIF · até 25 MB</p></div>}
            {editando && <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3"><span className="rounded-lg bg-primary/10 p-2 text-primary">{editando.tipo_arquivo === "application/pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">Arquivo atual: {editando.nome}</p><p className="text-[10px] text-muted-foreground">{editando.tipo_arquivo || "Arquivo"} · {tamanhoLegivel(editando.tamanho_arquivo)}</p></div></div>}
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ctm-doc-nome">Nome do documento *</Label><Input id="ctm-doc-nome" required maxLength={180} value={form.nome} onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))} placeholder="Ex.: Seguro aeronáutico 2026" /></div><div className="space-y-1.5"><Label htmlFor="ctm-doc-tipo">Tipo de documento</Label><select id="ctm-doc-tipo" value={form.tipo_documento} onChange={(event) => setForm((atual) => ({ ...atual, tipo_documento: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring">{TIPOS_DOCUMENTO.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="ctm-doc-validade">Data de vencimento</Label><Input id="ctm-doc-validade" type="date" value={form.data_validade} onChange={(event) => setForm((atual) => ({ ...atual, data_validade: event.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="ctm-doc-alerta">Alertar com quantos dias?</Label><div className="relative"><Input id="ctm-doc-alerta" type="number" min={0} max={3650} step={1} required value={form.dias_alerta} onChange={(event) => setForm((atual) => ({ ...atual, dias_alerta: event.target.value }))} className="pr-14" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">dias</span></div><p className="text-[10px] text-muted-foreground">O alerta do documento aparece dentro deste prazo.</p></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ctm-doc-descricao">Descrição / observações</Label><textarea id="ctm-doc-descricao" rows={3} maxLength={2000} value={form.descricao} onChange={(event) => setForm((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Informações úteis para a equipe de manutenção…" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" /></div></div>
          </div>
          <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setDialogFormulario(false)} disabled={salvando}>Cancelar</Button><Button type="submit" disabled={salvando} className="gap-2">{salvando ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</> : <><CheckCircle2 className="h-4 w-4" />{editando ? "Salvar alterações" : "Enviar documento"}</>}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(preview)} onOpenChange={(aberto) => { if (!aberto) setPreview(null); }}>
      <DialogContent className="flex h-[min(92dvh,900px)] max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 text-foreground">
        <DialogHeader className="flex-row items-center justify-between border-b border-border/70 px-5 py-4 pr-12"><div className="min-w-0"><DialogTitle className="truncate text-base">{preview?.documento.nome || "Pré-visualização"}</DialogTitle><DialogDescription className="mt-1 truncate text-xs">{preview ? `${nomeTipoDocumento(preview.documento.tipo_documento)} · ${dataBr(preview.documento.data_validade)}` : "Arquivo dos documentos da aeronave"}</DialogDescription></div>{preview && <a href={preview.url} download={preview.documento.nome} className="absolute right-12 top-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary"><ArrowDownToLine className="h-4 w-4" />Baixar</a>}</DialogHeader>
        <div className="min-h-0 flex-1 bg-slate-950/90 p-2 sm:p-4">{preview?.url && (preview.documento.tipo_arquivo?.startsWith("image/") ? <div className="flex h-full items-center justify-center overflow-auto"><img src={preview.url} alt={preview.documento.nome} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" /></div> : <iframe src={preview.url} title={`Pré-visualização de ${preview.documento.nome}`} className="h-full w-full rounded-lg bg-white" />)}</div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(exclusaoPendente)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setExclusaoPendente(null); }}>
      <DialogContent className="rounded-2xl border-border bg-background text-foreground sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-400" />Arquivar documento?</DialogTitle><DialogDescription>O arquivo continuará disponível no filtro Arquivados.</DialogDescription></DialogHeader><div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm font-semibold">{exclusaoPendente?.nome}</div><DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={excluindo} onClick={() => setExclusaoPendente(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={excluindo} onClick={() => void excluir()} className="gap-2">{excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{excluindo ? "Arquivando…" : "Arquivar documento"}</Button></DialogFooter></DialogContent>
    </Dialog>
  </div>;
}

function Legenda({ tom, label }: { tom: "green" | "amber" | "red"; label: string }) {
  const cor = { green: "bg-emerald-400", amber: "bg-amber-300", red: "bg-rose-400" }[tom];
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/55 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${cor}`} />{label}</span>;
}
function CartaoDocumento({ podeEditar, documento, onVisualizar, onEditar, onExcluir, visualizando }: { podeEditar: boolean; documento: DocumentoVisual; onVisualizar: () => void; onEditar: () => void; onExcluir: () => void; visualizando: boolean }) {
  const estilo = CLASSES_TOM[documento.tom];
  const ehPdf = documento.tipo_arquivo === "application/pdf";
  const IconeArquivo = ehPdf ? FileText : ImageIcon;
  const diasAlerta = Math.max(0, Number(documento.dias_alerta ?? 30));
  return <article className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${estilo.card}`}>
    <span className={`absolute inset-y-0 left-0 w-1 ${estilo.faixa}`} />
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`rounded-xl p-2.5 ${estilo.icon}`}><IconeArquivo className="h-5 w-5" /></span><div className="min-w-0"><h4 className="truncate text-sm font-bold" title={documento.nome}>{documento.nome}</h4><p className="mt-0.5 truncate text-[10px] capitalize text-muted-foreground">{nomeTipoDocumento(documento.tipo_documento)} <span className="px-1 opacity-50">·</span> {tamanhoLegivel(documento.tamanho_arquivo)}</p></div></div><Badge variant="outline" className={`shrink-0 text-[9px] ${estilo.badge}`}>{estilo.rotulo}</Badge></div>
    {documento.descricao && <p className="mt-3 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-muted-foreground">{documento.descricao}</p>}
    <div className={`mt-4 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/45 px-3 py-2.5 ${!documento.descricao ? "mt-5" : ""}`}><div className="flex min-w-0 items-center gap-2"><CalendarDays className={`h-4 w-4 shrink-0 ${estilo.texto}`} /><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Validade</p><p className="mt-0.5 truncate text-xs font-semibold">{dataBr(documento.data_validade)}</p></div></div><p className={`shrink-0 text-[11px] font-bold ${estilo.texto}`}>{textoVencimento(documento.diasRestantes)}</p></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 text-[10px] ${documento.alertaAtivo ? "font-bold text-amber-300" : "text-muted-foreground"}`}><Clock3 className="h-3.5 w-3.5" />{documento.diasRestantes === null ? `Alerta configurado: ${diasAlerta} dias` : documento.alertaAtivo ? `Alerta ativo · limite ${diasAlerta} dias` : `Alertar ${diasAlerta} dias antes`}</span><span className="text-[9px] text-muted-foreground">Atualizado {documento.atualizado_em ? dataBr(documento.atualizado_em) : "—"}</span></div>
    <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3"><Button type="button" onClick={onVisualizar} disabled={visualizando} className="h-9 flex-1 gap-2 rounded-lg text-xs">{visualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Visualizar arquivo</Button><Button type="button" variant="outline" size="icon" disabled={!podeEditar || !!documento.arquivado} onClick={onEditar} className="h-9 w-9 rounded-lg" aria-label={`Editar ${documento.nome}`} title="Editar dados e vencimento"><Pencil className="h-4 w-4" /></Button><Button type="button" variant="outline" size="icon" disabled={!podeEditar || !!documento.arquivado} onClick={onExcluir} className="h-9 w-9 rounded-lg border-rose-400/20 text-rose-300 hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200" aria-label={`Excluir ${documento.nome}`} title="Excluir documento"><Trash2 className="h-4 w-4" /></Button></div>
  </article>;
}
