import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Plus, UserRound, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { anexarDocumentoLancamento, criarDespesa, editarLancamento, emitirReceita, type CategoriaCaixaShare, type ContaBancaria, type FornecedorLancamento } from "@/lib/financeiro-share-api";
import { buscarOpcoesNotasSaida, enviarAnexoDocumentoSaida, type CategoriaDespesaOpcao } from "@/lib/nfSaidaApi";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { API_BASE } from "@/lib/api";
import type { Lancamento } from "@/components/financeiro-share/tipos";

export type LancamentoEdicao = {
  id: string;
  descricao?: string | null;
  fluxo?: string | null;
  categoriaId?: string | null;
  categoria?: string | null;
  grupoCategoria?: string | null;
  valorCentavos?: number | null;
  data?: string | null;
  prazo?: string | null;
  fornecedorId?: string | null;
  fornecedor?: string | null;
  numeroDoc?: string | null;
  observacoes?: string | null;
  categoriaClienteId?: string | null;
  dataPagamento?: string | null;
  contaBancariaId?: string | null;
  contaBancariaRotulo?: string | null;
  formaPagamento?: string | null;
  comprovanteUrl?: string | null;
  pagoPor?: string | null;
  status?: string | null;
  anexos?: Array<{ id?: string; nome: string; url: string; tipo?: string | null }>;
};

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  categorias: CategoriaCaixaShare[];
  aoCriar: (lancamento: Lancamento) => void;
  somenteDespesa?: boolean;
  fluxoInicial?: "entrada" | "saida";
  somenteEntrada?: boolean;
  fornecedores?: FornecedorLancamento[];
  contasBancarias?: ContaBancaria[];
  lancamentoInicial?: LancamentoEdicao;
};

const FORMAS_BAIXA = ["PIX", "Transferência", "Boleto", "Dinheiro", "Cartão"];

export function NovoLancamentoShareDialog({ aberto, aoFechar, categorias, aoCriar, somenteDespesa = false, fluxoInicial, somenteEntrada = false, fornecedores = [], contasBancarias = [], lancamentoInicial }: Props) {
  const editando = Boolean(lancamentoInicial);
  const temBaixaEditavel = Boolean(editando && (lancamentoInicial?.dataPagamento || ["PAGO", "RECEBIDO"].includes(String(lancamentoInicial?.status ?? "").toUpperCase())));
  const [salvando, setSalvando] = useState(false);
  const [fluxo, setFluxo] = useState("saida");
  const [grupoDespesa, setGrupoDespesa] = useState("DESPESAS EMPRESA");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [categoriaClienteId, setCategoriaClienteId] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("nenhuma");
  const [formaPagamento, setFormaPagamento] = useState("nenhuma");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [pagoPor, setPagoPor] = useState("");
  const [categoriasCliente, setCategoriasCliente] = useState<CategoriaDespesaOpcao[]>([]);
  const [imagens, setImagens] = useState<File[]>([]);
  const [inputImagemKey, setInputImagemKey] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    void buscarOpcoesNotasSaida().then((opcoes) => setCategoriasCliente(opcoes.categoriasDespesa ?? [])).catch(() => setCategoriasCliente([]));
  }, [aberto]);

  useEffect(() => {
    if (somenteDespesa) setFluxo("saida");
    else if (somenteEntrada) setFluxo("entrada");
    else if (fluxoInicial) setFluxo(fluxoInicial);
  }, [somenteDespesa, somenteEntrada, fluxoInicial]);

  useEffect(() => {
    if (!aberto || !lancamentoInicial) return;
    setFluxo(String(lancamentoInicial.fluxo ?? fluxoInicial ?? "saida").toLowerCase() === "entrada" ? "entrada" : "saida");
    setDescricao(lancamentoInicial.descricao ?? "");
    setCategoriaId(lancamentoInicial.categoriaId ?? "");
    setValor(lancamentoInicial.valorCentavos != null ? (lancamentoInicial.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
    setDataEmissao((lancamentoInicial.data ?? "").slice(0, 10));
    setDataVencimento((lancamentoInicial.prazo ?? "").slice(0, 10));
    setFornecedorId(lancamentoInicial.fornecedorId ?? "");
    setFornecedor(lancamentoInicial.fornecedor ?? "");
    setNumeroDoc(lancamentoInicial.numeroDoc ?? "");
    setObservacoes(lancamentoInicial.observacoes ?? "");
    setCategoriaClienteId(lancamentoInicial.categoriaClienteId ?? "");
    setDataPagamento((lancamentoInicial.dataPagamento ?? "").slice(0, 10));
    setContaBancariaId(lancamentoInicial.contaBancariaId || "nenhuma");
    setFormaPagamento(lancamentoInicial.formaPagamento || "nenhuma");
    setComprovanteUrl(lancamentoInicial.comprovanteUrl ?? "");
    setPagoPor(lancamentoInicial.pagoPor ?? "");
    setImagens([]);
    if (lancamentoInicial.grupoCategoria) setGrupoDespesa(lancamentoInicial.grupoCategoria);
  }, [aberto, fluxoInicial, lancamentoInicial]);

  const gruposCategoria = useMemo(() => {
    const mapa = new Map<string, CategoriaCaixaShare[]>();
    const categoriasVisiveis = fluxo === "saida" ? categorias.filter((categoria) => (categoria.grupo || "").trim().toUpperCase() === grupoDespesa) : categorias;
    categoriasVisiveis.forEach((categoria) => {
      const grupo = categoria.grupo || "OUTRAS";
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), categoria]);
    });
    return [...mapa.entries()];
  }, [categorias, fluxo, grupoDespesa]);

  const limpar = () => {
    setFluxo("saida"); setGrupoDespesa("DESPESAS EMPRESA"); setDescricao(""); setCategoriaId(""); setValor("");
    setDataEmissao(new Date().toISOString().slice(0, 10)); setDataVencimento("");
    setFornecedor(""); setFornecedorId(""); setNumeroDoc(""); setObservacoes(""); setCategoriaClienteId("");
    setDataPagamento(""); setContaBancariaId("nenhuma"); setFormaPagamento("nenhuma"); setComprovanteUrl(""); setPagoPor(""); setImagens([]);
  };

  const salvar = async () => {
    const categoria = categorias.find((item) => item.id === categoriaId);
    const fornecedorSelecionado = fornecedores.find((item) => item.id === fornecedorId);
    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!descricao.trim()) return toast.error("Informe a descrição do lançamento.");
    if (!categoria) return toast.error("Selecione a categoria do caixa Share.");
    if (fluxo === "saida" && (categoria.grupo || "").trim().toUpperCase() !== grupoDespesa) return toast.error("Selecione uma categoria da natureza escolhida.");
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return toast.error("Informe um valor válido.");

    setSalvando(true);
    try {
      const payload = {
        descricao: descricao.trim(),
        fluxo: fluxo === "entrada" ? "ENTRADA" : "SAIDA",
        tipo_caixa: "SHARE",
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        grupo_categoria: fluxo === "saida" ? grupoDespesa : categoria.grupo,
        valor_total: valorNumerico,
        data_emissao: dataEmissao || null,
        data_vencimento: dataVencimento || null,
        fornecedor_id: fornecedorId || null,
        fornecedor: (fornecedorSelecionado?.nome ?? fornecedor).trim() || null,
        fornecedor_nome: (fornecedorSelecionado?.nome ?? fornecedor).trim() || null,
        numero_doc: numeroDoc.trim() || null,
        periodicidade: categoria.classificacao,
        observacoes: observacoes.trim() || null,
        categoria_cliente_id: categoriaClienteId || null,
      };
      const lancamento = editando
        ? await editarLancamento(lancamentoInicial!.id, {
          ...payload, valor_centavos: Math.round(valorNumerico * 100), data: dataEmissao || null,
          data_vencimento: dataVencimento || null, categoria_id: categoria.id,
          ...(temBaixaEditavel ? {
            data_pagamento: dataPagamento || null,
            conta_bancaria_id: contaBancariaId === "nenhuma" ? null : contaBancariaId,
            forma_pagamento: formaPagamento === "nenhuma" ? null : formaPagamento,
            comprovante_url: comprovanteUrl.trim() || null,
            pago_por: pagoPor.trim() || null,
          } : {}),
        })
        : await (fluxo === "entrada" ? emitirReceita : criarDespesa)(payload);
      const errosUpload: string[] = [];
      for (const imagem of imagens) {
        try {
          const enviado = await enviarAnexoDocumentoSaida(imagem, imagem.name, { origem: "lancamento", documentoId: lancamento.id });
          await anexarDocumentoLancamento(lancamento.id, { nome: imagem.name, url: enviado.url, tipo: imagem.type || "image/*" });
        } catch { errosUpload.push(imagem.name); }
      }
      if (errosUpload.length) toast.error(`Lançamento salvo, mas não foi possível anexar: ${errosUpload.join(", ")}. Edite o lançamento para tentar novamente.`);
      else toast.success(editando ? "Lançamento atualizado." : "Lançamento do caixa Share registrado.");
      aoCriar(lancamento);
      limpar();
      aoFechar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) aoFechar(); }}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card p-4 shadow-2xl sm:w-full sm:p-6">
        <DialogHeader>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro Share · Caixa próprio</p>
          <DialogTitle className="text-xl font-bold tracking-[-.03em]">{editando ? "Editar lançamento" : somenteDespesa ? "Nova conta a pagar" : "Novo lançamento"}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Despesas e entradas da própria Share Brasil. Lançamentos de cotista não entram aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          {fluxo === "saida" && <section className="space-y-2 sm:col-span-2">
            <Label>Natureza da despesa</Label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: "DESPESAS EMPRESA", label: "Despesas da empresa", Icon: Building2 }, { value: "DESPESAS PARTICULARES", label: "Despesas particulares", Icon: UserRound }].map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={grupoDespesa === value} onClick={() => { setGrupoDespesa(value); setCategoriaId(""); }} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${grupoDespesa === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}><Icon size={16} />{label}</button>)}
            </div>
            <p className="text-[11px] text-muted-foreground">Lançamento interno, sem vínculo ou rateio de cotista.</p>
          </section>}
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input className="h-11" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} placeholder="Ex.: Aluguel da sede — setembro" />
          </div>

          {!somenteDespesa && !somenteEntrada && <div className="space-y-2">
            <Label>Fluxo</Label>
            <Select value={fluxo} onValueChange={(proximoFluxo) => { setFluxo(proximoFluxo); setCategoriaId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saida">Saída (despesa)</SelectItem>
                <SelectItem value="entrada">Entrada (receita)</SelectItem>
              </SelectContent>
            </Select>
          </div>}

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input className="h-11 font-mono text-base" inputMode="decimal" value={valor} onChange={(evento) => setValor(evento.target.value)} placeholder="0,00" aria-label="Valor em reais" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {gruposCategoria.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma categoria configurada para este tipo de despesa.</div>}
                {gruposCategoria.map(([grupo, itens]) => (
                  <div key={grupo}>
                    <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{grupo}</p>
                    {itens.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de emissão</Label>
            <Input type="date" value={dataEmissao} onChange={(evento) => setDataEmissao(evento.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Vencimento</Label>
            <Input type="date" value={dataVencimento} onChange={(evento) => setDataVencimento(evento.target.value)} />
          </div>

          {temBaixaEditavel && <section className="grid gap-4 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2 sm:grid-cols-2" aria-label="Dados da baixa">
            <div className="sm:col-span-2"><h3 className="text-sm font-semibold">Dados da baixa</h3><p className="text-xs text-muted-foreground">Edite os dados do pagamento já registrado.</p></div>
            <div className="space-y-2"><Label>Data do pagamento</Label><Input type="date" value={dataPagamento} onChange={(evento) => setDataPagamento(evento.target.value)} /></div>
            <div className="space-y-2"><Label>Conta bancária</Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent><SelectItem value="nenhuma">Não informada</SelectItem>{contaBancariaId !== "nenhuma" && !contasBancarias.some((conta) => conta.id === contaBancariaId) && <SelectItem value={contaBancariaId}>{lancamentoInicial?.contaBancariaRotulo || contaBancariaId}</SelectItem>}{contasBancarias.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` • ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}><SelectTrigger><SelectValue placeholder="Selecione a forma" /></SelectTrigger>
                <SelectContent><SelectItem value="nenhuma">Não informada</SelectItem>{formaPagamento !== "nenhuma" && !FORMAS_BAIXA.includes(formaPagamento) && <SelectItem value={formaPagamento}>{formaPagamento}</SelectItem>}{FORMAS_BAIXA.map((forma) => <SelectItem key={forma} value={forma}>{forma}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Pago por</Label><Input value={pagoPor} onChange={(evento) => setPagoPor(evento.target.value)} placeholder="Responsável pelo pagamento" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Link do comprovante</Label><Input type="url" value={comprovanteUrl} onChange={(evento) => setComprovanteUrl(evento.target.value)} placeholder="https://..." /></div>
          </section>}

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <SearchableCombobox items={fornecedores.map((item) => ({ id: item.id, label: `${item.nome}${item.cidade ? ` · ${item.cidade}` : ""}` }))} value={fornecedorId} onChange={(id, label) => { setFornecedorId(id); setFornecedor(label.split(" · ")[0]); }} placeholder="Selecione o fornecedor" searchPlaceholder="Buscar fornecedor..." emptyMessage="Nenhum fornecedor encontrado." clearable />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Categoria do cliente</Label>
            <Select value={categoriaClienteId || "nenhuma"} onValueChange={(value) => setCategoriaClienteId(value === "nenhuma" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria do cliente (opcional)" /></SelectTrigger>
              <SelectContent className="max-h-[320px]"><SelectItem value="nenhuma">Sem categoria de cliente</SelectItem>
                {categoriasCliente.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Documento / NF</Label>
            <Input value={numeroDoc} onChange={(evento) => setNumeroDoc(evento.target.value)} placeholder="Número do documento" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Imagens e documentos</Label>
            {lancamentoInicial?.anexos?.length ? <div className="flex flex-wrap gap-2">{lancamentoInicial.anexos.map((anexo, index) => <a key={anexo.id ?? `${anexo.url}-${index}`} href={anexo.url.startsWith("/") ? `${API_BASE}${anexo.url}` : anexo.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs underline">{anexo.nome}</a>)}</div> : null}
            {imagens.map((arquivo, index) => <div key={`${arquivo.name}-${arquivo.lastModified}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="truncate">{arquivo.name}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${arquivo.name}`} onClick={() => setImagens((atuais) => atuais.filter((_, i) => i !== index))}><X size={15} /></Button></div>)}
            <div className="flex items-center gap-2">
              <input key={inputImagemKey} type="file" accept="image/*" multiple className="sr-only" id="imagens-lancamento" onChange={(evento) => { const novos = Array.from(evento.target.files ?? []); const invalidos = novos.filter((arquivo) => !arquivo.type.startsWith("image/") || arquivo.size > 20 * 1024 * 1024); if (invalidos.length) toast.error("Selecione imagens de até 20 MB cada."); setImagens((atuais) => [...atuais, ...novos.filter((arquivo) => arquivo.type.startsWith("image/") && arquivo.size <= 20 * 1024 * 1024)]); setInputImagemKey((key) => key + 1); }} />
              <Button type="button" variant="outline" className="gap-2" onClick={() => document.getElementById("imagens-lancamento")?.click()}><ImagePlus size={16} />{imagens.length ? "Adicionar mais imagens" : "Adicionar imagem"}<Plus size={15} /></Button>
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP etc. · até 20 MB por imagem</span>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} />
          </div>
        </div>

        <DialogFooter className="sticky bottom-[-1rem] -mx-4 mt-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:bottom-[-1.5rem] sm:-mx-6 sm:px-6">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvando} className="min-h-10">Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="min-h-10 gap-2">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {editando ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
