import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, History, Loader2, Paperclip, Receipt, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { IndicadorPagina, EtiquetaStatus, EstadoVazio } from "@/components/dashboard/PrimitivosDashboard";
import {
  buscarOpcoesRecibos,
  buscarRecibos,
  cancelarRecibo,
  confirmarReembolsoRecibo,
  criarRecibo,
  enviarAnexoRecibo,
  type CriarReciboPayload,
  type OpcoesRecibos,
  type Recibo as ReciboFinanceiro,
} from "@/lib/colaborador-api";

type TipoEmissao = "cliente_reembolsavel" | "colaborador" | "pagamento";
type Formulario = {
  tipo: TipoEmissao | null;
  natureza_despesa: "aeronave" | "empresa" | "";
  cliente_id: string;
  colaborador_id: string;
  recebedor_nome: string;
  aeronave_id: string;
  rateado: boolean;
  valor: string;
  descricao_servico: string;
  data_emissao: string;
  data_vencimento: string;
  forma_pagamento: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_nome_manual: string;
  numero_documento_anexo: string;
  observacoes: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial = (): Formulario => ({
  tipo: null,
  natureza_despesa: "",
  cliente_id: "",
  colaborador_id: "",
  recebedor_nome: "",
  aeronave_id: "",
  rateado: false,
  valor: "",
  descricao_servico: "",
  data_emissao: hoje(),
  data_vencimento: "",
  forma_pagamento: "",
  categoria_id: "",
  categoria_nome: "",
  categoria_nome_manual: "",
  numero_documento_anexo: "",
  observacoes: "",
});

const opcoesTipo: Array<{ id: TipoEmissao; titulo: string; detalhe: string; icon: typeof Receipt; cor: string; fundo: string }> = [
  { id: "cliente_reembolsavel", titulo: "Recibo de reembolso", detalhe: "Despesa antecipada pela Share para um cotista.", icon: RotateCcw, cor: "text-amber-500", fundo: "bg-amber-500/[.06]" },
  { id: "colaborador", titulo: "Recibo colaborador", detalhe: "Despesa da Share vinculada ao colaborador.", icon: Receipt, cor: "text-primary", fundo: "bg-primary/[.06]" },
  { id: "pagamento", titulo: "Recibo de pagamento", detalhe: "Lançamento simples, sem vínculo com cotista ou colaborador.", icon: FileText, cor: "text-sky-500", fundo: "bg-sky-500/[.06]" },
];
const CATEGORIA_OUTRO_ID = "111124d9-6111-4e11-a1f7-c7477e0fdb89";
const CATEGORIAS_EMPRESA = new Set([
  "88980acf-465f-4a16-8111-d8efaf28365b", "482a2993-28e9-417e-98f5-d00d03ada423",
  "28a599f4-d8de-4969-98aa-58452d49c92e", "0293e29f-526e-4be0-af2e-0e10e73e8a8f",
  "a4d8ed56-9bb2-47e1-93fa-2b786ff280b7", "09defc15-dced-408d-a975-092928374907",
  "82e24a46-a773-4b6e-b2ae-bfd41c04bc5d", CATEGORIA_OUTRO_ID,
]);

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function valorNumerico(valor: string) {
  const limpo = valor.trim();
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo) || 0;
}

function dataBr(valor: string | null) {
  return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

function tomStatus(status: ReciboFinanceiro["status"]) {
  if (status === "emitido" || status === "reembolsado") return "green" as const;
  if (status === "aguardando_reembolso") return "amber" as const;
  if (status === "cancelado") return "red" as const;
  return "neutral" as const;
}

function rotuloStatus(status: ReciboFinanceiro["status"]) {
  return ({ emitido: "Emitido", aguardando_reembolso: "Aguardando reembolso", reembolsado: "Reembolsado", cancelado: "Cancelado" } as Record<string, string>)[status] || status;
}

export default function EmissaoRecibo({ aoVoltar }: { aoVoltar: () => void }) {
  const [form, setForm] = useState<Formulario>(inicial);
  const [opcoes, setOpcoes] = useState<OpcoesRecibos>({ clientes: [], colaboradores: [], aeronaves: [], cotistas: [], categorias: [] });
  const [recibos, setRecibos] = useState<ReciboFinanceiro[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const [dadosOpcoes, dadosRecibos] = await Promise.all([buscarOpcoesRecibos(), buscarRecibos()]);
      setOpcoes(dadosOpcoes);
      setRecibos(dadosRecibos.recibos);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar os dados de emissão.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const cotistas = useMemo(() => form.aeronave_id ? opcoes.cotistas.filter((item) => item.aeronave_id === form.aeronave_id) : [], [form.aeronave_id, opcoes.cotistas]);
  const totalRateio = cotistas.reduce((total, item) => total + Number(item.percentual_sociedade || 0), 0);
  const tipoSelecionado = opcoesTipo.find((item) => item.id === form.tipo);
  const arquivoPreviewUrl = useMemo(() => arquivo ? URL.createObjectURL(arquivo) : "", [arquivo]);

  useEffect(() => () => {
    if (arquivoPreviewUrl) URL.revokeObjectURL(arquivoPreviewUrl);
  }, [arquivoPreviewUrl]);

  const alterar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const selecionarTipo = (tipo: TipoEmissao) => {
    setErro("");
    setMensagem("");
    const proximo = tipo === form.tipo ? null : tipo;
    setForm({ ...inicial(), tipo: proximo });
    setArquivo(null);
  };

  const selecionaCategoria = (id: string, nome: string) => {
    alterar("categoria_id", id);
    alterar("categoria_nome", nome);
  };

  const categoriaValida = form.tipo !== "colaborador" || Boolean(
    form.natureza_despesa && form.categoria_id &&
    (form.natureza_despesa === "aeronave" ? form.aeronave_id : CATEGORIAS_EMPRESA.has(form.categoria_id)) &&
    (form.categoria_id !== CATEGORIA_OUTRO_ID || form.categoria_nome_manual.trim()),
  );
  const podeEmitir = Boolean(
    form.tipo && form.descricao_servico.trim() && valorNumerico(form.valor) > 0 && categoriaValida &&
    (form.tipo === "colaborador" ? form.colaborador_id : form.tipo === "pagamento" ? form.recebedor_nome.trim() : (form.rateado ? form.aeronave_id : form.cliente_id)),
  );

  const emitir = async () => {
    if (!podeEmitir || !form.tipo) {
      setErro("Preencha os campos obrigatórios antes de emitir o recibo.");
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      let anexoId: string | undefined;
      if (arquivo) anexoId = (await enviarAnexoRecibo(arquivo)).id;

      const payload: CriarReciboPayload = {
        tipo_recibo: form.tipo,
        beneficiario_tipo: form.tipo === "colaborador" ? "colaborador" : form.tipo === "pagamento" ? "fornecedor" : "cliente",
        reembolsavel: form.tipo === "cliente_reembolsavel",
        rateado: form.tipo === "cliente_reembolsavel" && form.rateado,
        aeronave_id: form.tipo === "pagamento" ? null : form.aeronave_id || null,
        cliente_id: form.tipo === "cliente_reembolsavel" ? form.cliente_id || null : null,
        colaborador_id: form.tipo === "colaborador" ? form.colaborador_id : null,
        recebedor_nome: form.tipo === "pagamento" ? form.recebedor_nome.trim() : null,
        valor: valorNumerico(form.valor),
        descricao_servico: form.descricao_servico.trim(),
        data_emissao: form.data_emissao,
        data_vencimento: form.tipo === "pagamento" ? null : form.data_vencimento || null,
        forma_pagamento: form.tipo === "pagamento" ? form.forma_pagamento || null : null,
        categoria_movimentacao_id: form.tipo === "colaborador" ? form.categoria_id : null,
        categoria_nome_manual: form.tipo === "colaborador" ? form.categoria_nome_manual.trim() || null : null,
        natureza_despesa: form.tipo === "colaborador" ? form.natureza_despesa : null,
        grupo_categoria: form.tipo === "colaborador" ? (form.natureza_despesa === "aeronave" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA") : null,
        anexo_id: anexoId || null,
        numero_documento_anexo: anexoId ? form.numero_documento_anexo.trim() || null : null,
        observacoes: form.observacoes.trim() || null,
      };
      const resposta = await criarRecibo(payload);
      setRecibos((atual) => [resposta.recibo, ...atual]);
      setMensagem(`Recibo ${resposta.recibo.numero_recibo} emitido com sucesso${resposta.rateio_ids.length ? ` e ${resposta.rateio_ids.length} rateio(s) gerado(s)` : ""}.`);
      setForm(inicial());
      setArquivo(null);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível emitir o recibo.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReembolso = async (id: string) => {
    setErro("");
    try {
      await confirmarReembolsoRecibo(id);
      setRecibos((atual) => atual.map((item) => item.id === id ? { ...item, status: "reembolsado" } : item));
      setMensagem("Reembolso confirmado e entrada criada no caixa Share.");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível confirmar o reembolso.");
    }
  };

  const cancelar = async (id: string) => {
    setErro("");
    try {
      await cancelarRecibo(id);
      setRecibos((atual) => atual.map((item) => item.id === id ? { ...item, status: "cancelado" } : item));
      setMensagem("Recibo cancelado corretamente.");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível cancelar o recibo.");
    }
  };

  return (
    <div className="route-enter mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <IndicadorPagina>Financeiro / Emissão de recibo</IndicadorPagina>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-.04em] md:text-2xl"><Receipt className="text-primary" size={22} /> Emissão de recibo</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">Escolha o tipo de recibo. A forma de pagamento só é informada no recibo simples de pagamento.</p>
        </div>
        <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-2 rounded-sm text-[11px]"><ArrowLeft size={14} /> Voltar ao financeiro</Button>
      </header>

      <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
        <div className="border-b border-border bg-secondary/20 px-5 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em]">Tipo de emissão <sup className="text-primary">*</sup></p>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {opcoesTipo.map((opcao) => {
            const ativo = form.tipo === opcao.id;
            const Icon = opcao.icon;
            return <button key={opcao.id} type="button" onClick={() => selecionarTipo(opcao.id)} aria-pressed={ativo} className={`group flex min-h-[116px] items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${ativo ? `border-primary/60 ${opcao.fundo} shadow-md` : "border-border bg-secondary/[.12] hover:border-primary/35"}`}><span className={`mt-0.5 grid h-5 w-5 place-content-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}>{ativo && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold">{opcao.titulo}</span><span className="mt-1 block text-[10px] leading-5 text-muted-foreground">{opcao.detalhe}</span></span><Icon className={ativo ? opcao.cor : "text-muted-foreground/60"} size={18} /></button>;
          })}
        </div>

        {form.tipo && <div className="border-t border-border px-5 py-5">
          <div className="mb-5 flex items-center gap-2 rounded-sm border border-primary/25 bg-primary/[.06] px-3.5 py-2.5 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><strong>{tipoSelecionado?.titulo}</strong></div>
          <div className="grid gap-4 md:grid-cols-2">
            {form.tipo === "pagamento" ? <Campo label="RECEBEDOR" obrigatorio><input value={form.recebedor_nome} onChange={(e) => alterar("recebedor_nome", e.target.value)} placeholder="Nome do fornecedor ou recebedor" className="campo" /></Campo> : form.tipo !== "colaborador" ? <Campo label="Cliente" obrigatorio><select value={form.cliente_id} onChange={(e) => alterar("cliente_id", e.target.value)} className="campo"><option value="">Selecione o cliente</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.razao_social}</option>)}</select></Campo> : <Campo label="RECEBEDOR" obrigatorio><select value={form.colaborador_id} onChange={(e) => alterar("colaborador_id", e.target.value)} className="campo"><option value="">Selecione o colaborador</option>{opcoes.colaboradores.map((colaborador) => <option key={colaborador.id} value={colaborador.id}>{colaborador.nome_exibicao || colaborador.nome_completo}</option>)}</select></Campo>}
            <Campo label="Data" obrigatorio><input type="date" value={form.data_emissao} onChange={(e) => alterar("data_emissao", e.target.value)} className="campo" /></Campo>
            <div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3 md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">PAGADOR</p></div>
            <Campo label={form.tipo === "pagamento" ? "Descrição" : "Descrição do serviço"} obrigatorio className="md:col-span-2"><input value={form.descricao_servico} onChange={(e) => alterar("descricao_servico", e.target.value)} placeholder={form.tipo === "pagamento" ? "Descrição do pagamento" : "Ex.: Reembolso de despesas operacionais"} className="campo" /></Campo>
            <Campo label="Valor" obrigatorio><input inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>
            {form.tipo !== "pagamento" && <Campo label="Vencimento"><input type="date" value={form.data_vencimento} onChange={(e) => alterar("data_vencimento", e.target.value)} className="campo" /></Campo>}
            {form.tipo === "pagamento" && <Campo label="Forma de pagamento" obrigatorio><select value={form.forma_pagamento} onChange={(e) => alterar("forma_pagamento", e.target.value)} className="campo"><option value="">Selecione</option><option>PIX</option><option>Transferência bancária</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option></select></Campo>}
            {form.tipo === "colaborador" && <>
              <Campo label="Tipo de despesa" obrigatorio><select value={form.natureza_despesa} onChange={(e) => { const natureza = e.target.value as Formulario["natureza_despesa"]; alterar("natureza_despesa", natureza); alterar("categoria_id", ""); alterar("categoria_nome", ""); alterar("categoria_nome_manual", ""); alterar("aeronave_id", ""); }} className="campo"><option value="">Selecione o tipo</option><option value="aeronave">Despesa aeronave</option><option value="empresa">Despesa empresa</option></select></Campo>
              {form.natureza_despesa === "aeronave" && <><Campo label="Categoria" obrigatorio><SearchableCombobox items={opcoes.categorias.filter((item) => item.grupo_categoria.toUpperCase() === "DESPESAS REEMBOLSÁVEIS").map((item) => ({ id: item.id, label: item.nome }))} value={form.categoria_id} onChange={selecionaCategoria} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma despesa reembolsável encontrada." /></Campo><Campo label="Aeronave" obrigatorio><SearchableCombobox items={opcoes.aeronaves.map((aeronave) => ({ id: aeronave.id, label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}` }))} value={form.aeronave_id} onChange={(id) => alterar("aeronave_id", id)} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave encontrada." /></Campo></>}
              {form.natureza_despesa === "empresa" && <Campo label="Categoria" obrigatorio><SearchableCombobox items={opcoes.categorias.filter((item) => CATEGORIAS_EMPRESA.has(item.id)).map((item) => ({ id: item.id, label: item.nome }))} value={form.categoria_id} onChange={selecionaCategoria} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria disponível." /></Campo>}
              {form.natureza_despesa === "empresa" && form.categoria_id === CATEGORIA_OUTRO_ID && <Campo label="Descrição da categoria" obrigatorio className="md:col-span-2"><input value={form.categoria_nome_manual} onChange={(e) => alterar("categoria_nome_manual", e.target.value)} placeholder="Informe a despesa" className="campo" /></Campo>}
            </>}
            <div className="md:col-span-2"><Campo label="Anexo (opcional)"><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="campo file:mr-3 file:rounded-sm file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-primary" /></Campo>{arquivo && <div className="mt-2 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-secondary/[.12] p-3 text-[11px]"><Paperclip size={14} className="text-primary" /><span className="max-w-[260px] truncate font-medium">{arquivo.name}</span><a href={arquivoPreviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><ExternalLink size={13} /> Visualizar</a><Button type="button" variant="ghost" onClick={() => { setArquivo(null); alterar("numero_documento_anexo", ""); }} className="ml-auto h-7 px-2 text-[10px]">Remover</Button></div>}{arquivo && <div className="mt-3 max-w-sm"><Campo label="Número do documento do anexo"><input value={form.numero_documento_anexo} onChange={(e) => alterar("numero_documento_anexo", e.target.value)} placeholder="Ex.: NF 12345, boleto 987..." className="campo" /></Campo></div>}</div>
            <Campo label="Observações" className="md:col-span-2"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} className="campo min-h-20 resize-y" placeholder="Informações complementares do recibo" /></Campo>
          </div>

          {form.tipo !== "colaborador" && form.tipo !== "pagamento" && <div className="mt-5 rounded-sm border border-border bg-secondary/[.12] p-4">
            <label className="flex cursor-pointer items-start gap-3"><Checkbox checked={form.rateado} onCheckedChange={(checked) => alterar("rateado", checked === true)} /><span><span className="block text-[11px] font-bold">Ratear entre cotistas da aeronave</span><span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">Cria as linhas de rateio usando os percentuais cadastrados para a aeronave.</span></span></label>
            {form.rateado && <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2"><Campo label="Aeronave" obrigatorio><select value={form.aeronave_id} onChange={(e) => alterar("aeronave_id", e.target.value)} className="campo"><option value="">Selecione a aeronave</option>{opcoes.aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}{aeronave.modelo ? ` · ${aeronave.modelo}` : ""}</option>)}</select></Campo><div className="rounded-sm border border-border bg-background/30 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Prévia do rateio</p>{form.aeronave_id ? cotistas.length ? <><div className="mt-2 space-y-1.5">{cotistas.map((cotista) => <p key={cotista.id} className="flex justify-between gap-3 text-[11px]"><span className="truncate">{cotista.nome}</span><strong className="font-mono">{cotista.percentual_sociedade}%</strong></p>)}</div><p className={`mt-2 border-t border-border pt-2 text-[10px] ${totalRateio === 100 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>Total cadastrado: {totalRateio}%</p></> : <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">Não há cotistas cadastrados para esta aeronave.</p> : <p className="mt-2 text-[10px] text-muted-foreground">Selecione uma aeronave para consultar os cotistas.</p>}</div></div>}
          </div>}

          {erro && <div role="alert" className="mt-5 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-5 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => setHistorico((atual) => !atual)} className="h-9 gap-2 rounded-sm text-[11px]"><History size={14} /> {historico ? "Ocultar histórico" : "Histórico de recibos"}</Button><Button type="button" onClick={emitir} disabled={salvando || !podeEmitir} className="h-9 gap-2 rounded-sm px-5 text-[11px]">{salvando ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Emitir recibo</Button></div>
        </div>}
      </section>

      {historico && <section className="overflow-hidden rounded-sm border border-border bg-card/60"><div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5 py-3"><p className="text-[11px] font-bold uppercase tracking-[.16em]">Recibos recentes</p><span className="text-[10px] text-muted-foreground">{recibos.length} registro(s)</span></div>{carregando ? <div className="space-y-2 p-4"><div className="skeleton h-12 rounded-sm" /><div className="skeleton h-12 rounded-sm" /></div> : recibos.length ? <div className="divide-y divide-border/60">{recibos.map((recibo) => <div key={recibo.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-[11px]">{recibo.numero_recibo}</strong><EtiquetaStatus tone={tomStatus(recibo.status)}>{rotuloStatus(recibo.status)}</EtiquetaStatus></div><p className="mt-1 truncate text-[11px] font-bold">{recibo.nome_pagador} {recibo.recebedor_nome ? `→ ${recibo.recebedor_nome}` : ""} · {recibo.descricao_servico}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{dataBr(recibo.data_emissao)} · {recibo.tipo_recibo.replace(/_/g, " ")}{recibo.forma_pagamento ? ` · ${recibo.forma_pagamento}` : ""}{recibo.numero_documento_anexo ? ` · Doc. ${recibo.numero_documento_anexo}` : ""}</p>{recibo.anexo_id && <a href={`/api/financeiro/recibos/anexos/${encodeURIComponent(recibo.anexo_id)}/arquivo`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"><Paperclip size={12} /> Visualizar anexo</a>}</div><div className="flex items-center gap-3"><strong className="font-mono text-[11px]">{moeda(recibo.valor)}</strong>{recibo.status === "aguardando_reembolso" && <Button type="button" variant="outline" onClick={() => void confirmarReembolso(recibo.id)} className="h-8 gap-1.5 rounded-sm px-2.5 text-[10px]"><CheckCircle2 size={13} /> Confirmar</Button>}{recibo.status !== "cancelado" && recibo.status !== "reembolsado" && <Button type="button" variant="ghost" onClick={() => void cancelar(recibo.id)} className="h-8 gap-1.5 rounded-sm px-2.5 text-[10px] text-red-600 hover:text-red-700 dark:text-red-300"><XCircle size={13} /> Cancelar</Button>}</div></div>)}</div> : <EstadoVazio label="Nenhum recibo emitido" />}</section>}
      {carregando && !historico && <p className="sr-only">Carregando dados de emissão</p>}
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}
