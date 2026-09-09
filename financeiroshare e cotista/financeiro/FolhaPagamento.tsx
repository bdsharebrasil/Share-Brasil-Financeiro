import React, { useState } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { folhaPagamento } from '../../data/operacional';
import type { StatusFolha } from '../../types/operacional';
import { formatBRL, formatData } from '../../utils/format';

const ROTULO: Record<StatusFolha, {label: string;classes: string;}> = {
  EM_ABERTO: { label: 'Em Aberto', classes: 'bg-warning-soft text-warning border-warning/30' },
  PAGO: { label: 'Pago', classes: 'bg-success-soft text-success border-success/30' },
  EM_ATRASO: { label: 'Em Atraso', classes: 'bg-danger-soft text-danger border-danger/30' }
};

export function FolhaPagamento() {
  const [status, setStatus] = useState<Record<string, StatusFolha>>(
    Object.fromEntries(folhaPagamento.map((c) => [c.id, c.status]))
  );

  const total = folhaPagamento.reduce(
    (s, c) => s + c.salarioBase + c.encargos + c.beneficios,
    0
  );
  const pendente = folhaPagamento.
  filter((c) => status[c.id] !== 'PAGO').
  reduce((s, c) => s + c.salarioBase + c.encargos + c.beneficios, 0);

  function darBaixa(id: string, nome: string) {
    setStatus((s) => ({ ...s, [id]: 'PAGO' }));
    toast.success('Salário liquidado', { description: `${nome} · baixa registrada no caixa.` });
  }

  return (
    <SectionCard
      titulo="Pagamento de salários"
      descricao={`Folha de Jun/2026 · total ${formatBRL(total)} · ${formatBRL(pendente)} pendente`}
      Icon={Users}
      acoes={
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
        toast.info('Folha exportada', { description: 'Arquivo de remessa bancária gerado.' })
        }>
        
          Gerar remessa
        </Button>
      }
      semPadding>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead className="text-right">Salário base</TableHead>
              <TableHead className="text-right">Encargos</TableHead>
              <TableHead className="text-right">Benefícios</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="whitespace-nowrap">Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folhaPagamento.map((c) => {
              const atual = status[c.id];
              const totalLinha = c.salarioBase + c.encargos + c.beneficios;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-brand-soft text-[11px] text-brand">
                          {c.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-card-foreground">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.cargo}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="num text-[10px]">
                      {c.aeronave}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-right text-sm">
                    {formatBRL(c.salarioBase)}
                  </TableCell>
                  <TableCell className="num text-right text-sm text-muted-foreground">
                    {formatBRL(c.encargos)}
                  </TableCell>
                  <TableCell className="num text-right text-sm text-muted-foreground">
                    {formatBRL(c.beneficios)}
                  </TableCell>
                  <TableCell className="num text-right text-sm font-bold text-card-foreground">
                    {formatBRL(totalLinha)}
                  </TableCell>
                  <TableCell className="num whitespace-nowrap text-sm">
                    {formatData(c.vencimento)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${ROTULO[atual].classes}`}>
                      
                      {ROTULO[atual].label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {atual === 'PAGO' ?
                    <span className="text-xs text-muted-foreground">Liquidado</span> :

                    <Button size="xs" onClick={() => darBaixa(c.id, c.nome)}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Dar Baixa
                      </Button>
                    }
                  </TableCell>
                </TableRow>);

            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>);

}