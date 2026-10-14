import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, formatarMoeda } from "@/components/dashboard/ComponentesDashboard";
import type { AbastecimentoPendenteFinanceiro } from "@/lib/colaborador-api";

export function TabelaAbastecimentosPendentes({
  abastecimentos,
  onEditar,
  formatarData,
}: {
  abastecimentos: AbastecimentoPendenteFinanceiro[];
  onEditar: (id: string) => void;
  formatarData: (valor: string | null | undefined) => string;
}) {
  if (!abastecimentos.length) return <EstadoVazio label="Nenhum abastecimento pré-voo aguardando dados fiscais." />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[950px] border-collapse text-left text-xs">
        <thead className="bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Voo</th>
            <th className="px-4 py-3">Cotista</th>
            <th className="px-4 py-3">Aeronave</th>
            <th className="px-4 py-3">Local / trecho</th>
            <th className="px-4 py-3">Nº NF</th>
            <th className="px-4 py-3">Nota fiscal</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {abastecimentos.map((item) => (
            <tr key={item.id} className="hover:bg-primary/5">
              <td className="whitespace-nowrap px-4 py-3">{formatarData(item.data)}</td>
              <td className="px-4 py-3 font-mono font-bold text-primary">{item.numero_voo || "—"}</td>
              <td className="px-4 py-3">{item.cotista_nome || "Não informado"}</td>
              <td className="px-4 py-3">{item.matricula_registro || "—"}</td>
              <td className="px-4 py-3">{item.local || item.trecho || "—"}</td>
              <td className="px-4 py-3 font-mono">{item.numero_nf?.trim() || <span className="text-amber-600">Pendente</span>}</td>
              <td className="px-4 py-3">{item.nota_url ? "Anexada" : <span className="text-amber-600">Pendente</span>}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(Number(item.valor_total || 0))}</td>
              <td className="px-4 py-3">
                <Button type="button" variant="outline" className="h-8 gap-1.5 text-[10px]" onClick={() => onEditar(item.id)}>
                  <Pencil size={12} /> Completar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
