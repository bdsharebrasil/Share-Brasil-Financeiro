import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, History, Loader2, Receipt, RotateCcw, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type TipoEmissao = "cliente_direto" | "cliente_reembolsavel" | "colaborador";
type Formulario = {
  tipo: TipoEmissao | null;
  cliente_id: string;
  colaborador_id: string;
  aeronave_id: string;
  rateado: boolean;
  nome_pagador: string;
  documento_pagador: string;
  endereco_pagador: string;
  cidade_pagador: string;
  uf: string;
  valor: string;
  descricao_servico: string;
  data_emissao: string;
  data_vencimento: string;
  forma_pagamento: string;
  grupo_categoria: string;
  tipo_despesa: "fixo" | "variável";
  observacoes: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial = (): Formulario => ({
  tipo: null,
  cliente_id: "",
  colaborador_id: "",
  aeronave_id: "",
  rateado: false,
  nome_pagador: "",
  documento_pagador: "",
  endereco_pagador: "",
  cidade_pagador: "",
  uf: "",
  valor: "",
  descricao_servico: "",
  data_emissao: hoje(),
  data_vencimento: "",
  forma_pagamento: "",
  grupo_categoria: "",
  tipo_despesa: "variável",
  observacoes: "",
});

const opcoesTipo: Array<{ id: TipoEmissao; titulo: string; detalhe: string; icon: typeof Receipt; cor: string }> = [
  { id: "cliente_direto", titulo: "Cliente paga direto", detalhe: "Registra a despesa no caixa do cliente e gera o rateio quando aplicável.", icon: Users, cor: "text-violet-500" },
  { id: "cliente_reembolsavel", titulo: "Cliente reembolsável", detalhe: "A Share antecipa a despesa e acompanha o reembolso do cliente.", icon: RotateCcw, cor: "text-amber-500" },
  { id: "colaborador", titulo: "Colaborador", detalhe: "Registra pagamento da Share para um colaborador, sem rateio de cotistas.", icon: Receipt, cor: "text-primary" },
];

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
  const [opcoes, setOpcoes] = useState<OpcoesRecibos>({ clientes: [], colaboradores: [], aeronaves: [], cotistas: [] });
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

  const alterar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const selecionarTipo = (tipo: TipoEmissao) => {
    setErro("");
    setMensagem("");
    const proximo = tipo === form.tipo ? null : tipo;
    setForm({ ...inicial(), tipo: proximo, grupo_categoria: proximo === "cliente_reembolsavel" ? "DESPESAS REEMBOLSÁVEIS" : proximo === "cliente_direto" ? "CAIXA CLIENTE" : "DESPESAS EMPRESA" });
  };

  const selecionarCliente = (clienteId: string) => {
    const cliente = opcoes.clientes.find((item) => item.id === clienteId);
    setForm((atual) => ({
      ...atual,
      cliente_id: clienteId,
      nome_pagador: cliente?.razao_social || atual.nome_pagador,
      documento_pagador: cliente?.cnpj || "",
      endereco_pagador: cliente?.endereco || "",
      cidade_pagador: cliente?.cidade || "",
      uf: cliente?.uf || "",
    }));
  };

  const podeEmitir = Boolean(
    form.tipo && form.nome_pagador.trim() && form.descricao_servico.trim() && valorNumerico(form.valor) > 0 &&
    (form.tipo === "colaborador" ? form.colaborador_id : (form.rateado ? form.aeronave_id : form.cliente_id))
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
      let boletoUrl: string | undefined;
      if (arquivo) boletoUrl = (await enviarAnexoRecibo(arquivo)).url;
      const payload: CriarReciboPayload = {
        beneficiario_tipo: form.tipo === "colaborador" ? "colaborador" : "cliente",
        reembolsavel: form.tipo === "cliente_reembolsavel",
        rateado: form.tipo !== "colaborador" && form.rateado,
        aeronave_id: form.aeronave_id || null,
        cliente_id: form.cliente_id || null,
        colaborador_id: form.colaborador_id || null,
        nome_pagador: form.nome_pagador.trim(),
        documento_pagador: form.documento_pagador.trim() || null,
        endereco_pagador: form.endereco_pagador.trim() || null,
        cidade_pagador: form.cidade_pagador.trim() || null,
        uf_pagador: form.uf.trim() || null,
        valor: valorNumerico(form.valor),
        descricao_servico: form.descricao_servico.trim(),
        data_emissao: form.data_emissao,
        data_vencimento: form.data_vencimento || null,
        forma_pagamento: form.forma_pagamento || null,
        grupo_categoria: form.grupo_categoria || null,
        tipo_despesa: form.tipo === "colaborador" ? form.tipo_despesa : null,
        boleto_url: boletoUrl,
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
          <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">Emita recibos para clientes ou colaboradores e mantenha o rateio e o reembolso vinculados ao movimento financeiro.</p>
        </div>
        <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-2 rounded-sm text-[11px]"><ArrowLeft size={14} /> Voltar ao financeiro</Button>
      </header>

      <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
        <div className="border-b border-border bg-secondary/20 px-5 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em]">Tipo de emissão <sup className="text-primary">*</sup></p>
          <p className="mt-1 text-[11px] text-muted-foreground">Escolha como a despesa será registrada antes de preencher os dados do recibo.</p>
        </div>
        <div className="grid gap-2.5 p-5 md:grid-cols-3">
          {opcoesTipo.map((opcao) => {
            const ativo = form.tipo === opcao.id;
            const Icon = opcao.icon;
            return <button key={opcao.id} type="button" onClick={() => selecionarTipo(opcao.id)} aria-pressed={ativo} className={`flex items-start gap-3 rounded-sm border p-4 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/[.08]" : "border-border bg-secondary/[.12] hover:border-primary/35"}`}><span className={`mt-0.5 grid h-5 w-5 place-content-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}>{ativo && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold">{opcao.titulo}</span><span className="mt-1 block text-[10px] leading-5 text-muted-foreground">{opcao.detalhe}</span></span><Icon className={ativo ? opcao.cor : "text-muted-foreground/60"} size={17} /></button>;
          })}
        </div>

        {form.tipo && <div className="border-t border-border px-5 py-5">
          <div className="mb-5 flex items-center gap-2 rounded-sm border border-primary/25 bg-primary/[.06] px-3.5 py-2.5 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><strong>{tipoSelecionado?.titulo}</strong><span className="text-muted-foreground">· {form.tipo === "cliente_reembolsavel" ? "A Share fará o desembolso inicial." : form.tipo === "cliente_direto" ? "O cliente será o pagador direto." : "O pagamento sai do caixa Share."}</span></div>
          <div className="grid gap-4 md:grid-cols-2">
            {form.tipo !== "colaborador" ? <Campo label="Cliente" obrigatorio><select value={form.cliente_id} onChange={(e) => selecionarCliente(e.target.value)} className="campo"><option value="">Selecione o cliente</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.razao_social}</option>)}</select></Campo> : <Campo label="Colaborador" obrigatorio><select value={form.colaborador_id} onChange={(e) => alterar("colaborador_id", e.target.value)} className="campo"><option value="">Selecione o colaborador</option>{opcoes.colaboradores.map((colaborador) => <option key={colaborador.id} value={colaborador.id}>{colaborador.nome_exibicao || colaborador.nome_completo}</option>)}</select></Campo>}
            <Campo label="Data de emissão" obrigatorio><input type="date" value={form.data_emissao} onChange={(e) => alterar("data_emissao", e.target.value)} className="campo" /></Campo>
            <Campo label="Nome do pagador" obrigatorio><input value={form.nome_pagador} onChange={(e) => alterar("nome_pagador", e.target.value)} placeholder="Nome ou razão social" className="campo" /></Campo>
            <Campo label="CPF ou CNPJ"><input value={form.documento_pagador} onChange={(e) => alterar("documento_pagador", e.target.value)} placeholder="Documento do pagador" className="campo" /></Campo>
            <Campo label="Descrição do serviço" obrigatorio className="md:col-span-2"><input value={form.descricao_servico} onChange={(e) => alterar("descricao_servico", e.target.value)} placeholder="Ex.: Reembolso de despesas operacionais" className="campo" /></Campo>
            <Campo label="Valor" obrigatorio><input inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>
            <Campo label="Vencimento"><input type="date" value={form.data_vencimento} onChange={(e) => alterar("data_vencimento", e.target.value)} className="campo" /></Campo>
            <Campo label="Forma de pagamento"><select value={form.forma_pagamento} onChange={(e) => alterar("forma_pagamento", e.target.value)} className="campo"><option value="">Não informada</option><option>PIX</option><option>Transferência bancária</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option></select></Campo>
            <Campo label="Grupo de categoria"><input value={form.grupo_categoria} onChange={(e) => alterar("grupo_categoria", e.target.value)} className="campo" /></Campo>
            {form.tipo === "colaborador" && <Campo label="Tipo da despesa" obrigatorio><select value={form.tipo_despesa} onChange={(e) => alterar("tipo_despesa", e.target.value as "fixo" | "variável")} className="campo"><option value="fixo">Fixo</option><option value="variável">Variável</option></select></Campo>}
            <Campo label="Anexo (boleto ou comprovante)"><input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="campo file:mr-3 file:rounded-sm file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-primary" /></Campo>
            <Campo label="Endereço" className="md:col-span-2"><input value={form.endereco_pagador} onChange={(e) => alterar("endereco_pagador", e.target.value)} className="campo" /></Campo>
            <Campo label="Cidade"><input value={form.cidade_pagador} onChange={(e) => alterar("cidade_pagador", e.target.value)} className="campo" /></Campo>
            <Campo label="UF"><input maxLength={2} value={form.uf} onChange={(e) => alterar("uf", e.target.value.toUpperCase())} className="campo" /></Campo>
            <Campo label="Observações" className="md:col-span-2"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} className="campo min-h-20 resize-y" placeholder="Informações complementares do recibo" /></Campo>
          </div>

          {form.tipo !== "colaborador" && <div className="mt-5 rounded-sm border border-border bg-secondary/[.12] p-4">
            <label className="flex cursor-pointer items-start gap-3"><Checkbox checked={form.rateado} onCheckedChange={(checked) => alterar("rateado", checked === true)} /><span><span className="block text-[11px] font-bold">Ratear entre cotistas da aeronave</span><span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">Cria as linhas de rateio usando os percentuais cadastrados para a aeronave.</span></span></label>
            {form.rateado && <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2"><Campo label="Aeronave" obrigatorio><select value={form.aeronave_id} onChange={(e) => alterar("aeronave_id", e.target.value)} className="campo"><option value="">Selecione a aeronave</option>{opcoes.aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}{aeronave.modelo ? ` · ${aeronave.modelo}` : ""}</option>)}</select></Campo><div className="rounded-sm border border-border bg-background/30 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Prévia do rateio</p>{form.aeronave_id ? cotistas.length ? <><div className="mt-2 space-y-1.5">{cotistas.map((cotista) => <p key={cotista.id} className="flex justify-between gap-3 text-[11px]"><span className="truncate">{cotista.nome}</span><strong className="font-mono">{cotista.percentual_sociedade}%</strong></p>)}</div><p className={`mt-2 border-t border-border pt-2 text-[10px] ${totalRateio === 100 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>Total cadastrado: {totalRateio}%</p></> : <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">Não há cotistas cadastrados para esta aeronave.</p> : <p className="mt-2 text-[10px] text-muted-foreground">Selecione uma aeronave para consultar os cotistas.</p>}</div></div>}
          </div>}

          {erro && <div role="alert" className="mt-5 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-5 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => setHistorico((atual) => !atual)} className="h-9 gap-2 rounded-sm text-[11px]"><History size={14} /> {historico ? "Ocultar histórico" : "Histórico de recibos"}</Button><Button type="button" onClick={emitir} disabled={salvando || !podeEmitir} className="h-9 gap-2 rounded-sm px-5 text-[11px]">{salvando ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Emitir recibo</Button></div>
        </div>}
      </section>

      {historico && <section className="overflow-hidden rounded-sm border border-border bg-card/60"><div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5 py-3"><p className="text-[11px] font-bold uppercase tracking-[.16em]">Recibos recentes</p><span className="text-[10px] text-muted-foreground">{recibos.length} registro(s)</span></div>{carregando ? <div className="space-y-2 p-4"><div className="skeleton h-12 rounded-sm" /><div className="skeleton h-12 rounded-sm" /></div> : recibos.length ? <div className="divide-y divide-border/60">{recibos.map((recibo) => <div key={recibo.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-[11px]">{recibo.numero_recibo}</strong><EtiquetaStatus tone={tomStatus(recibo.status)}>{rotuloStatus(recibo.status)}</EtiquetaStatus></div><p className="mt-1 truncate text-[11px] font-bold">{recibo.nome_pagador} · {recibo.descricao_servico}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{dataBr(recibo.data_emissao)} · {recibo.tipo_recibo.replace(/_/g, " ")}</p></div><div className="flex items-center gap-3"><strong className="font-mono text-[11px]">{moeda(recibo.valor)}</strong>{recibo.status === "aguardando_reembolso" && <Button type="button" variant="outline" onClick={() => void confirmarReembolso(recibo.id)} className="h-8 gap-1.5 rounded-sm px-2.5 text-[10px]"><CheckCircle2 size={13} /> Confirmar</Button>}{recibo.status !== "cancelado" && recibo.status !== "reembolsado" && <Button type="button" variant="ghost" onClick={() => void cancelar(recibo.id)} className="h-8 gap-1.5 rounded-sm px-2.5 text-[10px] text-red-600 hover:text-red-700 dark:text-red-300"><XCircle size={13} /> Cancelar</Button>}</div></div>)}</div> : <EstadoVazio label="Nenhum recibo emitido" />}</section>}
      {carregando && !historico && <p className="sr-only">Carregando dados de emissão</p>}
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}
