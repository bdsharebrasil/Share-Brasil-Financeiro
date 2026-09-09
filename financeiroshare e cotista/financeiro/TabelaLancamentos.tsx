import React from 'react';
import { CheckCircle2, FileText, Filter, Inbox } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { StatusBadge } from './StatusBadge';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
'../ui/Table';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { aeronaves } from '../../data/financeiro';
import {
  opcoesFiltroAeronave,
  opcoesFiltroGrupo,
  opcoesFiltroStatus } from
'../../data/opcoes';
import type { Lancamento, StatusLancamento } from '../../types/financeiro';
import type { FiltrosLancamento } from '../../hooks/useLancamentos';
import { formatBRL, formatData } from '../../utils/format';

const RATEIO_LABEL: Record<string, string> = {
  FIXO: 'Fixo',
  VARIAVEL_POR_HORA: 'Var. por hora',
  VARIAVEL_POR_VOO: 'Var. por voo',
  EXTRA: 'Extra'
};

interface TabelaLancamentosProps {
  itens: Lancamento[];
  filtros: FiltrosLancamento;
  onFiltrar: (f: FiltrosLancamento) => void;
  onDarBaixa: (lancamento: Lancamento) => void;
  acoes?: React.ReactNode;
  titulo?: string;
}

const PENDENTES: StatusLancamento[] = ['EM_ABERTO', 'EM_ATRASO', 'AGUARDANDO_REEMBOLSO'];

export function TabelaLancamentos({
  itens,
  filtros,
  onFiltrar,
  onDarBaixa,
  acoes,
  titulo = 'Tabela de lançamentos'
}: TabelaLancamentosProps) {
  const total = itens.reduce((s, l) => s + l.valor, 0);

  return (
    <SectionCard
      titulo={titulo}
      descricao={`${itens.length} registros · total ${formatBRL(total)}`}
      Icon={FileText}
      acoes={acoes}
      semPadding>
      
      <div className="border-b border-border px-5 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Filtros
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={filtros.busca}
            onChange={(e) => onFiltrar({ ...filtros, busca: e.target.value })}
            placeholder="Buscar descrição, fornecedor ou nº"
            aria-label="Buscar lançamentos"
            className="h-9 rounded-xl" />
          
          <SearchableCombobox
            compacto
            items={opcoesFiltroStatus}
            value={filtros.status}
            onChange={(id) =>
            onFiltrar({ ...filtros, status: id as StatusLancamento | 'TODOS' })
            }
            ariaLabel="Filtrar por status"
            searchPlaceholder="Buscar status…" />
          
          <SearchableCombobox
            compacto
            items={opcoesFiltroAeronave}
            value={filtros.aeronaveId}
            onChange={(id) => onFiltrar({ ...filtros, aeronaveId: id })}
            ariaLabel="Filtrar por aeronave"
            searchPlaceholder="Buscar aeronave…" />
          
          <SearchableCombobox
            compacto
            items={opcoesFiltroGrupo}
            value={filtros.grupo}
            onChange={(id) => onFiltrar({ ...filtros, grupo: id })}
            ariaLabel="Filtrar por grupo de categoria"
            searchPlaceholder="Buscar grupo…" />
          
        </div>
      </div>

      {itens.length === 0 ?
      <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-card-foreground">Nenhum lançamento encontrado</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Ajuste os filtros ou registre um novo lançamento de despesa.
          </p>
        </div> :

      <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Nº / Descrição</TableHead>
                <TableHead className="whitespace-nowrap">Categoria</TableHead>
                <TableHead className="whitespace-nowrap">Aeronave</TableHead>
                <TableHead className="whitespace-nowrap">Rateio</TableHead>
                <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                <TableHead className="whitespace-nowrap text-right">Valor</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((l) => {
              const aeronave = aeronaves.find((a) => a.id === l.aeronaveId);
              const pendente = PENDENTES.includes(l.status);
              return (
                <TableRow key={l.id}>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {l.descricao}
                      </p>
                      <p className="num truncate text-xs text-muted-foreground">
                        {l.id} · {l.fornecedor}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-card-foreground">{l.categoriaNome}</p>
                      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                        {l.grupoCategoria}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="num text-[10px]">
                        {aeronave?.prefixo}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {RATEIO_LABEL[l.tipoRateio]}
                      <span className="block text-[11px]">
                        {l.periodicidade.charAt(0) + l.periodicidade.slice(1).toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="num whitespace-nowrap text-sm">
                      {formatData(l.dataVencimento)}
                      {l.dataPagamento &&
                    <span className="block text-[11px] text-success">
                          pago {formatData(l.dataPagamento)}
                        </span>
                    }
                    </TableCell>
                    <TableCell
                    className={`num whitespace-nowrap text-right text-sm font-semibold ${
                    l.fluxo === 'RECEITA' ? 'text-success' : 'text-card-foreground'}`
                    }>
                    
                      {l.fluxo === 'RECEITA' ? '+' : '−'} {formatBRL(l.valor)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {pendente ?
                    <Button size="xs" onClick={() => onDarBaixa(l)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Dar Baixa
                        </Button> :

                    <span className="text-xs text-muted-foreground">Liquidado</span>
                    }
                    </TableCell>
                  </TableRow>);

            })}
            </TableBody>
          </Table>
        </div>
      }
    </SectionCard>);

}