import { Plane } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { chaveNumeroVoo, formatarData } from "@/lib/format";
import type { SugestaoVoo } from "@/lib/tipos";

interface Props {
  carregando: boolean;
  erro: string | null;
  resumo: string | null;
  sugestoes: SugestaoVoo[];
  selecionado?: string;
  aoRecarregar?: () => void;
  aoBuscar: (idOuNumero: string) => void;
}

export function BuscaVoo({ carregando, erro, resumo, sugestoes, selecionado, aoBuscar, aoRecarregar }: Props) {
  const vooSelecionado = sugestoes.find(voo => voo.id === selecionado);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label htmlFor="numero-voo" className="mb-2 block text-xs font-semibold text-muted-foreground">Número do voo</label>
      <SearchableCombobox
        id="numero-voo"
        icon={<Plane size={16} />}
        value={selecionado ?? ""}
        selectedLabel={vooSelecionado ? [vooSelecionado.numero_voo, vooSelecionado.cliente, resumo].filter(Boolean).join(" · ") : undefined}
        items={sugestoes.map(voo => ({
          id: voo.id,
          label: [voo.numero_voo, voo.cliente, `${voo.origem} → ${voo.destino}`, formatarData(voo.data_agendada), voo.matricula_registro].filter(Boolean).join(" · "),
        }))}
        onChange={id => aoBuscar(id)}
        placeholder={carregando ? "Carregando voos…" : "Selecione um voo"}
        searchPlaceholder="Buscar número, cliente, data ou matrícula…"
        filterItem={(item, busca) => chaveNumeroVoo(item.label).includes(chaveNumeroVoo(busca))}
        emptyMessage="Nenhum voo encontrado. Confira o número informado."
        disabled={carregando}
        wrapItemLabels
        wrapSelectedLabel
        className="h-auto min-h-11 py-2 text-left"
      />
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {erro && !sugestoes.length && aoRecarregar && <button type="button" disabled={carregando} onClick={aoRecarregar} className="mt-2 text-sm font-semibold text-primary">Tentar carregar voos</button>}
      {resumo && !erro && <p className="mt-3 text-sm text-primary">Voo selecionado · {resumo}</p>}
    </div>
  );
}
