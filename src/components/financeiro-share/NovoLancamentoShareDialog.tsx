import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarDespesa, editarLancamento, emitirReceita, type CategoriaCaixaShare, type FornecedorLancamento } from "@/lib/financeiro-share-api";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
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
  lancamentoInicial?: LancamentoEdicao;
};

export function NovoLancamentoShareDialog({ aberto, aoFechar, categorias, aoCriar, somenteDespesa = false, fluxoInicial, somenteEntrada = false, fornecedores = [], lancamentoInicial }: Props) {
  const editando = Boolean(lancamentoInicial);
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
    setFornecedor(""); setFornecedorId(""); setNumeroDoc(""); setObservacoes("");
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
        numero_doc: numeroDoc.trim() || null,
        periodicidade: categoria.classificacao,
        observacoes: observacoes.trim() || null,
      };
      const lancamento = editando
        ? await editarLancamento(lancamentoInicial!.id, { ...payload, valor_centavos: Math.round(valorNumerico * 100), data: dataEmissao || null, data_vencimento: dataVencimento || null, categoria_id: categoria.id })
        : await (fluxo === "entrada" ? emitirReceita : criarDespesa)(payload);
      toast.success(editando ? "Lançamento atualizado." : "Lançamento do caixa Share registrado.");
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

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <SearchableCombobox items={fornecedores.map((item) => ({ id: item.id, label: `${item.nome}${item.cidade ? ` · ${item.cidade}` : ""}` }))} value={fornecedorId} onChange={(id, label) => { setFornecedorId(id); setFornecedor(label.split(" · ")[0]); }} placeholder="Selecione o fornecedor" searchPlaceholder="Buscar fornecedor..." emptyMessage="Nenhum fornecedor encontrado." clearable />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Documento / NF</Label>
            <Input value={numeroDoc} onChange={(evento) => setNumeroDoc(evento.target.value)} placeholder="Número do documento" />
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
