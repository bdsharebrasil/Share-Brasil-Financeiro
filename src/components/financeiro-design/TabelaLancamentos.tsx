import { CheckCircle2, FileText, Filter, Inbox } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  formatarBRL,
  formatarData,
} from "./lancamento-tabela";

interface TabelaLancamentosProps {
  itens: LancamentoTabela[];
  filtros: FiltrosTabela;
  onFiltrar: (f: FiltrosTabela) => void;
  onDarBaixa: (lancamento: LancamentoTabela) => void;
  acoes?: React.ReactNode;
  titulo?: string;
  carregando?: boolean;
}

const PENDENTES = ["EM_ABERTO", "EM_ATRASO", "PENDENTE", "ATRASADO"];

export function TabelaLancamentos({
  itens,
  filtros,
  onFiltrar,
  onDarBaixa,
  acoes,
  titulo = "Tabela de lançamentos",
  carregando = false,
}: TabelaLancamentosProps) {
  const total = itens.reduce((s, l) => s + l.valor, 0);

  return (
    <SectionCard
      titulo={titulo}
      descricao={carregando ? "Carregando…" : `${itens.length} registros · total ${formatarBRL(total)}`}
      Icon={FileText}
      acoes={acoes}
      semPadding
    >
      <div className="border-b border-border px-5 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Filtros
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <Input
            value={filtros.busca}
            onChange={(e) => onFiltrar({ ...filtros, busca: e.target.value })}
            placeholder="Buscar descrição ou fornecedor"
            aria-label="Buscar lançamentos"
            className="h-9 rounded-xl"
          />
          <select
            value={filtros.status}
            onChange={(e) => onFiltrar({ ...filtros, status: e.target.value })}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Filtrar por status"
          >
            <option value="TODOS">Todos os status</option>
            <option value="EM_ABERTO">Em aberto</option>
            <option value="EM_ATRASO">Em atraso</option>
            <option value="PAGO">Pago</option>
            <option value="RECEBIDO">Recebido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <select
            value={filtros.grupo}
            onChange={(e) => onFiltrar({ ...filtros, grupo: e.target.value })}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Filtrar por grupo"
          >
            <option value="TODOS">Todos os grupos</option>
            <option value="DESPESA">Despesa</option>
            <option value="RECEITA">Receita</option>
          </select>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-card-foreground">Nenhum lançamento encontrado</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Ajuste os filtros ou registre um novo lançamento.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Nº / Descrição</TableHead>
                <TableHead className="whitespace-nowrap">Categoria</TableHead>
                <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                <TableHead className="whitespace-nowrap text-right">Valor</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((l) => {
                const pendente = PENDENTES.includes(l.status);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate text-sm font-medium text-card-foreground">{l.descricao}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {l.id} · {l.fornecedor}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-card-foreground">{l.categoriaNome}</p>
                      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                        {l.grupoCategoria}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm">
                      {formatarData(l.dataVencimento)}
                      {l.dataPagamento && (
                        <span className="block text-[11px] text-emerald-600">
                          pago {formatarData(l.dataPagamento)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap text-right font-mono text-sm font-semibold ${
                        l.fluxo === "ENTRADA" ? "text-emerald-600" : "text-card-foreground"
                      }`}
                    >
                      {l.fluxo === "ENTRADA" ? "+" : "−"} {formatarBRL(l.valor)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {pendente ? (
                        <Button size="sm" variant="outline" onClick={() => onDarBaixa(l)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Dar Baixa
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Liquidado</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
