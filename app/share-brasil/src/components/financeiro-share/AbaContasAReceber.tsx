import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContasAReceber } from '@/hooks/useContasAReceber';
import type { ContaAReceber, StatusContaFinanceira } from './tipos';
import { ModalContaAReceber } from './ModalContaAReceber';

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function estaVencida(conta: ContaAReceber): boolean {
  return conta.status === 'PENDENTE' && new Date(conta.dataVencimento) < new Date();
}

const CORES_STATUS: Record<StatusContaFinanceira, string> = {
  PAGO: 'bg-emerald-100 text-emerald-700',
  PENDENTE: 'bg-amber-100 text-amber-700',
  ATRASADO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-neutral-200 text-neutral-500',
};

export function AbaContasAReceber() {
  const [status, setStatus] = useState<StatusContaFinanceira | 'TODOS'>('TODOS');
  const [contaSelecionada, setContaSelecionada] = useState<ContaAReceber | null>(null);

  const { contas, carregando, erro, darBaixa } = useContasAReceber({
    status: status === 'TODOS' ? undefined : status,
  });

  const totalPendenteVencido = contas.filter(estaVencida).reduce((soma, c) => soma + c.valor, 0);

  return (
    <div className="space-y-4">
      {totalPendenteVencido > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-red-700">
              {formatarMoeda(totalPendenteVencido)} em contas vencidas aguardando recebimento
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contas a receber</CardTitle>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusContaFinanceira | 'TODOS')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendentes</SelectItem>
              <SelectItem value="PAGO">Recebidas</SelectItem>
              <SelectItem value="CANCELADO">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando contas…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma conta a receber encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  contas.map((c) => {
                    const vencida = estaVencida(c);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className={vencida ? 'font-medium text-red-600' : undefined}>
                          {formatarData(c.dataVencimento)}
                        </TableCell>
                        <TableCell>{c.descricao ?? '—'}</TableCell>
                        <TableCell>{c.categoriaNome ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{formatarMoeda(c.valor)}</TableCell>
                        <TableCell>
                          <Badge className={CORES_STATUS[vencida ? 'ATRASADO' : c.status]}>
                            {vencida ? 'ATRASADO' : c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === 'PENDENTE' && (
                            <Button size="sm" variant="outline" onClick={() => setContaSelecionada(c)}>
                              Dar baixa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {contaSelecionada && (
        <ModalContaAReceber
          conta={contaSelecionada}
          aberto
          onFechar={() => setContaSelecionada(null)}
          onConfirmar={async (dados) => {
            await darBaixa(contaSelecionada.id, dados);
            setContaSelecionada(null);
          }}
        />
      )}
    </div>
  );
}
