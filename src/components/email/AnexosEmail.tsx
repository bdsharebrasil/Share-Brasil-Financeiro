import { useMemo, useRef, useState } from "react";
import { Check, FileText, Fuel, Paperclip, Plus, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { AnexoEmail } from "@/lib/colaborador-api";

type Props = {
  anexos: AnexoEmail[];
  selecionados: string[];
  onAlternar: (id: string) => void;
  arquivosNovos?: File[];
  onAdicionarArquivos?: (arquivos: File[]) => void;
  onRemoverArquivo?: (index: number) => void;
};

type Grupo = { chave: string; titulo: string; icone: typeof Receipt; origens: string[] };

const grupos: Grupo[] = [
  { chave: "recibos", titulo: "Recibos", icone: Receipt, origens: ["recibo"] },
  { chave: "despesas", titulo: "Despesas de viagem", icone: FileText, origens: ["relatorio_despesa_viagem"] },
  { chave: "abastecimentos", titulo: "Abastecimentos", icone: Fuel, origens: ["abastecimento"] },
];

export function AnexosEmail({
  anexos,
  selecionados,
  onAlternar,
  arquivosNovos = [],
  onAdicionarArquivos,
  onRemoverArquivo,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length && onAdicionarArquivos) onAdicionarArquivos(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalSelecionado = selecionados.length + arquivosNovos.length;

  const anexosPorGrupo = useMemo(
    () => grupos.map((grupo) => ({ grupo, itens: anexos.filter((anexo) => grupo.origens.includes(anexo.origem)) })),
    [anexos],
  );

  const nomeAnexo = (id: string) => anexos.find((item) => item.id === id)?.nome || id;

  return (
    <div className="flex flex-col gap-2">
      {/* Chips compactos — não empurram mais o corpo da mensagem para baixo */}
      {totalSelecionado > 0 && (
        <div className="flex max-h-16 flex-wrap items-center gap-1.5 overflow-y-auto pr-1">
          {selecionados.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-medium text-sky-300"
            >
              <FileText size={11} />
              <span className="max-w-[140px] truncate">{nomeAnexo(id)}</span>
              <button type="button" onClick={() => onAlternar(id)} className="text-sky-400/70 hover:text-sky-200">
                <X size={11} />
              </button>
            </span>
          ))}
          {arquivosNovos.map((arquivo, index) => (
            <span
              key={`${arquivo.name}-${index}`}
              className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300"
            >
              <FileText size={11} />
              <span className="max-w-[140px] truncate">{arquivo.name}</span>
              {onRemoverArquivo && (
                <button
                  type="button"
                  onClick={() => onRemoverArquivo(index)}
                  className="text-emerald-400/70 hover:text-emerald-200"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 w-fit gap-2 rounded-md border-white/[.08] bg-[#0d1525] text-[10px] font-semibold text-slate-300 hover:bg-white/[.06]"
      >
        <Paperclip size={13} />
        Anexar arquivos
        {totalSelecionado > 0 && (
          <span className="rounded bg-[#1d639f] px-1.5 py-0.5 text-[9px] font-bold text-white">{totalSelecionado}</span>
        )}
      </Button>

      {/* Comando (⌘K) para buscar e anexar — abre por cima, não ocupa espaço fixo no layout */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar recibos, despesas, abastecimentos..." />
        <CommandList>
          <CommandEmpty>Nenhum documento encontrado.</CommandEmpty>

          <CommandGroup heading="Computador">
            <CommandItem
              value="anexar arquivo do computador upload"
              onSelect={() => {
                setOpen(false);
                inputRef.current?.click();
              }}
            >
              <Plus />
              <span>Anexar arquivo do computador</span>
            </CommandItem>
          </CommandGroup>

          {anexosPorGrupo.map(({ grupo, itens }) =>
            itens.length === 0 ? null : (
              <div key={grupo.chave}>
                <CommandSeparator />
                <CommandGroup heading={grupo.titulo}>
                  {itens.map((anexo) => {
                    const marcado = selecionados.includes(anexo.id);
                    const Icone = grupo.icone;
                    return (
                      <CommandItem
                        key={anexo.id}
                        value={`${grupo.titulo} ${anexo.nome}`}
                        onSelect={() => onAlternar(anexo.id)}
                      >
                        {marcado ? <Check className="text-sky-400" /> : <Icone />}
                        <span className="truncate">{anexo.nome}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ),
          )}
        </CommandList>
      </CommandDialog>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
      />
    </div>
  );
}