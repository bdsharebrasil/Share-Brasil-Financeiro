import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarLancamentoShare, type CategoriaCaixaShare, type ContaBancaria, type LancamentoShare } from "@/lib/financeiro-share-api";

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  categorias: CategoriaCaixaShare[];
  contas: ContaBancaria[];
  aoCriar: (lancamento: LancamentoShare) => void;
};

const FORMAS_PAGAMENTO = ["PIX", "TED", "BOLETO", "CARTÃO DE CRÉDITO", "DÉBITO AUTOMÁTICO", "DINHEIRO"];

export function NovoLancamentoShareDialog({ aberto, aoFechar, categorias, contas, aoCriar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [fluxo, setFluxo] = useState("saida");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [contaBancaria, setContaBancaria] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const gruposCategoria = useMemo(() => {
    const mapa = new Map<string, CategoriaCaixaShare[]>();
    categorias.forEach((categoria) => {
      const grupo = categoria.grupo || "OUTRAS";
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), categoria]);
    });
    return [...mapa.entries()];
  }, [categorias]);

  const limpar = () => {
    setFluxo("saida"); setDescricao(""); setCategoriaId(""); setValor("");
    setDataEmissao(new Date().toISOString().slice(0, 10)); setDataVencimento(""); setDataPagamento("");
    setFormaPagamento(""); setContaBancaria(""); setFornecedor(""); setNumeroDoc(""); setObservacoes("");
  };

  const salvar = async () => {
    const categoria = categorias.find((item) => item.id === categoriaId);
    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!descricao.trim()) return toast.error("Informe a descrição do lançamento.");
    if (!categoria) return toast.error("Selecione a categoria do caixa Share.");
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return toast.error("Informe um valor válido.");

    setSalvando(true);
    try {
      const { lancamento } = await criarLancamentoShare({
        descricao: descricao.trim(),
        fluxo,
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        grupo_categoria: categoria.grupo,
        valor_total: valorNumerico,
        data_emissao: dataEmissao || null,
        data_vencimento: dataVencimento || null,
        data_pagamento: dataPagamento || null,
        status: dataPagamento ? "pago" : "pendente",
        forma_pagamento: formaPagamento || null,
        conta_bancaria: contaBancaria || null,
        fornecedor_nome: fornecedor.trim() || null,
        numero_doc: numeroDoc.trim() || null,
        periodicidade: categoria.classificacao,
        observacoes: observacoes.trim() || null,
      });
      toast.success("Lançamento do caixa Share registrado.");
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
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-[-.02em]">Novo lançamento · Caixa Share</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Despesas e entradas da própria Share Brasil. Lançamentos de cotista não entram aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(evento) => setDescricao(evento.target.value)} placeholder="Ex.: Aluguel sede setembro" />
          </div>

          <div className="space-y-2">
            <Label>Fluxo</Label>
            <Select value={fluxo} onValueChange={setFluxo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saida">Saída (despesa)</SelectItem>
                <SelectItem value="entrada">Entrada (receita)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(evento) => setValor(evento.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
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
            <Label>Pagamento</Label>
            <Input type="date" value={dataPagamento} onChange={(evento) => setDataPagamento(evento.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((forma) => <SelectItem key={forma} value={forma}>{forma}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta bancária</Label>
            <Select value={contaBancaria} onValueChange={setContaBancaria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {contas.map((conta) => (
                  <SelectItem key={conta.id} value={conta.banco}>
                    {conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={(evento) => setFornecedor(evento.target.value)} placeholder="Nome do fornecedor" />
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

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Salvar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
