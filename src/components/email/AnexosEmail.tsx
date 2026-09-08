import { useMemo, useRef, useState } from "react";
import { Check, FileText, Fuel, Paperclip, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import type { AnexoEmail } from "@/lib/colaborador-api";

type Props = {
  anexos: AnexoEmail[];
  selecionados: string[];
  onAlternar: (id: string) => void;
  arquivosNovos?: File[];
  onAdicionarArquivos?: (arquivos: File[]) => void;
  onRemoverArquivo?: (index: number) => void;
};

type Grupo = { chave: string; titulo: string; descricao: string; icone: typeof Receipt; origens: string[] };
const grupos: Grupo[] = [
  { chave: "recibos", titulo: "Recibos", descricao: "Busque recibos criados no sistema", icone: Receipt, origens: ["recibo"] },
  { chave: "despesas", titulo: "Despesas de viagem", descricao: "Busque relatórios de despesa de viagem", icone: FileText, origens: ["relatorio_despesa_viagem"] },
  { chave: "abastecimentos", titulo: "Abastecimentos", descricao: "Documentos de abastecimento", icone: Fuel, origens: ["abastecimento"] },
];

export function AnexosEmail({ anexos, selecionados, onAlternar, arquivosNovos = [], onAdicionarArquivos, onRemoverArquivo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buscas, setBuscas] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length && onAdicionarArquivos) onAdicionarArquivos(files);
    if (inputRef.current) inputRef.current.value = "";
  };
  const anexosPorGrupo = useMemo(() => grupos.reduce<Record<string, AnexoEmail[]>>((acc, grupo) => {
    const termo = (buscas[grupo.chave] || "").trim().toLowerCase();
    acc[grupo.chave] = anexos.filter((anexo) => grupo.origens.includes(anexo.origem) && (!termo || `${anexo.nome} ${anexo.tipo_arquivo || ""}`.toLowerCase().includes(termo)));
    return acc;
  }, {}), [anexos, buscas]);

  return <div className="space-y-3">
    <div className="grid gap-2 md:grid-cols-3">
      {grupos.map((grupo) => {
        const Icone = grupo.icone;
        const aberto = Boolean(abertos[grupo.chave]);
        const lista = anexosPorGrupo[grupo.chave] || [];
        return <div key={grupo.chave} className={`rounded-xl border p-3 transition-colors ${aberto ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card/30"}`}>
          <button type="button" onClick={() => setAbertos((atual) => ({ ...atual, [grupo.chave]: !aberto }))} className="flex w-full items-center gap-2 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icone size={15} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-xs">{grupo.titulo}</strong><span className="block truncate text-[10px] text-muted-foreground">{grupo.descricao}</span></span>
            <span className="text-[10px] text-muted-foreground">{lista.length}</span>
          </button>
          {aberto && <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
            <div className="relative"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={buscas[grupo.chave] || ""} onChange={(event) => setBuscas((atual) => ({ ...atual, [grupo.chave]: event.target.value }))} placeholder={`Buscar em ${grupo.titulo.toLowerCase()}`} className="h-8 w-full rounded-lg border border-border/50 bg-background/60 pl-8 pr-8 text-[11px] outline-none focus:border-primary/50" />{buscas[grupo.chave] && <button type="button" onClick={() => setBuscas((atual) => ({ ...atual, [grupo.chave]: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={12} /></button>}</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">{lista.length === 0 ? <p className="p-2 text-center text-[10px] text-muted-foreground">Nenhum documento encontrado.</p> : lista.slice(0, 10).map((anexo) => { const marcado = selecionados.includes(anexo.id); return <button key={anexo.id} type="button" onClick={() => onAlternar(anexo.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left ${marcado ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 hover:bg-muted/50"}`}><span className="flex h-6 w-6 items-center justify-center rounded-md bg-background">{marcado ? <Check size={12} /> : <FileText size={12} />}</span><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{anexo.nome}</span></button>; })}</div>
          </div>}
        </div>;
      })}
    </div>
    {arquivosNovos.length > 0 && <div className="space-y-1.5"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Novos arquivos</p>{arquivosNovos.map((arquivo, index) => <div key={`${arquivo.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5"><FileText size={13} className="text-primary" /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{arquivo.name}</span>{onRemoverArquivo && <button type="button" onClick={() => onRemoverArquivo(index)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>}</div>)}</div>}
    {onAdicionarArquivos && <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"><Plus size={14} /> Anexar arquivo do computador</button>}
    <input ref={inputRef} type="file" multiple onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt" />
  </div>;
}
