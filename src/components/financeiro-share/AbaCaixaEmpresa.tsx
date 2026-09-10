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
  EM_ABERTO: 'border border-amber-400/25 bg-amber-500/15 text-amber-300',
  PAGO: 'border border-emerald-400/25 bg-emerald-500/15 text-emerald-300',
  RECEBIDO: 'border border-emerald-400/25 bg-emerald-500/15 text-emerald-300',
  PENDENTE: 'border border-amber-400/25 bg-amber-500/15 text-amber-300',
  ATRASADO: 'border border-red-400/25 bg-red-500/15 text-red-300',
  EM_ATRASO: 'border border-red-400/25 bg-red-500/15 text-red-300',
  CANCELADO: 'border border-slate-400/20 bg-slate-500/15 text-slate-300',
};

function formatarStatus(status: StatusLancamento) {
  return status.replace(/_/g, ' ');
}

export function AbaCaixaEmpresa() {
  const [fluxo, setFluxo] = useState<FluxoLancamento | 'TODOS'>('TODOS');

  const { lancamentos, carregando, erro } = useCaixaEmpresa({
    fluxo: fluxo === 'TODOS' ? undefined : fluxo,
  });

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-sm">Movimentações do caixa</CardTitle><p className="mt-1 text-[10px] text-muted-foreground">Lançamentos próprios da Share Brasil</p></div>
          <Select value={fluxo} onValueChange={(v) => setFluxo(v as FluxoLancamento | 'TODOS')}>
            <SelectTrigger className="w-full sm:w-40">
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
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>N doc</TableHead><TableHead>Fornecedor</TableHead><TableHead>Fluxo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.length === 0 ? <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow> : lancamentos.map((l) => (
                      <TableRow key={l.id}><TableCell className="whitespace-nowrap text-muted-foreground">{formatarData(l.data)}</TableCell><TableCell className="font-medium">{l.descricao}</TableCell><TableCell>{l.documento ?? '—'}</TableCell><TableCell>{l.fornecedor ?? '—'}</TableCell><TableCell><Badge variant={l.fluxo === 'ENTRADA' ? 'default' : 'secondary'}>{l.fluxo === 'ENTRADA' ? 'Entrada' : 'Saída'}</Badge></TableCell><TableCell className={`text-right font-medium ${l.fluxo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{formatarMoeda(l.valorCentavos)}</TableCell><TableCell><Badge className={CORES_STATUS[l.status]}>{formatarStatus(l.status)}</Badge></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {lancamentos.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p> : lancamentos.map((l) => (
                  <article key={l.id} className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{l.descricao}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatarData(l.data)} · {l.fornecedor ?? 'Sem fornecedor'}</p></div><span className={`shrink-0 text-sm font-bold ${l.fluxo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{formatarMoeda(l.valorCentavos)}</span></div><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={l.fluxo === 'ENTRADA' ? 'default' : 'secondary'}>{l.fluxo === 'ENTRADA' ? 'Entrada' : 'Saída'}</Badge><Badge className={CORES_STATUS[l.status]}>{formatarStatus(l.status)}</Badge>{l.documento && <span className="text-[10px] text-muted-foreground">Doc. {l.documento}</span>}</div></article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
