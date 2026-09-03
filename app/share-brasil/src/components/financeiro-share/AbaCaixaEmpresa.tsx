import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCaixaEmpresa } from '@/hooks/useCaixaEmpresa';
import type { FluxoLancamento, StatusLancamento } from './tipos';

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const CORES_STATUS: Record<StatusLancamento, string> = {
  PAGO: 'bg-emerald-100 text-emerald-700',
  PENDENTE: 'bg-amber-100 text-amber-700',
  CANCELADO: 'bg-neutral-200 text-neutral-500',
};

export function AbaCaixaEmpresa() {
  const [fluxo, setFluxo] = useState<FluxoLancamento | 'TODOS'>('TODOS');

  const { lancamentos, carregando, erro, saldoCentavos, totalEntradasCentavos, totalSaidasCentavos } =
    useCaixaEmpresa({ fluxo: fluxo === 'TODOS' ? undefined : fluxo });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="border-b border-border/50 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${saldoCentavos >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatarMoeda(saldoCentavos)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/50 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">{formatarMoeda(totalEntradasCentavos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/50 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">{formatarMoeda(totalSaidasCentavos)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-muted/20">
          <div><CardTitle className="text-sm">Movimentações do caixa</CardTitle><p className="mt-1 text-[10px] text-muted-foreground">Lançamentos próprios da Share Brasil</p></div>
          <Select value={fluxo} onValueChange={(v) => setFluxo(v as FluxoLancamento | 'TODOS')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Fluxo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="ENTRADA">Entradas</SelectItem>
              <SelectItem value="SAIDA">Saídas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando lançamentos…</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Fluxo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhum lançamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  lancamentos.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatarData(l.data)}</TableCell>
                      <TableCell className="font-medium">{l.descricao}</TableCell>
                      <TableCell>{l.categoria}</TableCell>
                      <TableCell>{l.fornecedor ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={l.fluxo === 'ENTRADA' ? 'default' : 'secondary'}>
                          {l.fluxo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          l.fluxo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatarMoeda(l.valorCentavos)}
                      </TableCell>
                      <TableCell>
                        <Badge className={CORES_STATUS[l.status]}>{l.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
