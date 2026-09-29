import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCaixaEmpresa } from '@/hooks/useCaixaEmpresa';
import { gerarReembolso } from '@/lib/financeiro-share-api';
import type { FluxoLancamento, StatusLancamento } from './tipos';

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const CORES_STATUS: Record<StatusLancamento, string> = {
  EM_ABERTO: 'border border-amber-300 bg-amber-100 text-amber-800',
  PAGO: 'border border-emerald-300 bg-emerald-100 text-emerald-800',
  RECEBIDO: 'border border-emerald-300 bg-emerald-100 text-emerald-800',
  PENDENTE: 'border border-amber-300 bg-amber-100 text-amber-800',
  ATRASADO: 'border border-red-300 bg-red-100 text-red-800',
  EM_ATRASO: 'border border-red-300 bg-red-100 text-red-800',
  CANCELADO: 'border border-slate-300 bg-slate-100 text-slate-700',
};

function formatarStatus(status: StatusLancamento) {
  return status.replace(/_/g, ' ');
}

export function AbaCaixaEmpresa() {
  const [fluxo, setFluxo] = useState<FluxoLancamento | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('TODOS');
  const [ordem, setOrdem] = useState('vencimento');

  const { lancamentos, carregando, erro, recarregar } = useCaixaEmpresa({
    fluxo: fluxo === 'TODOS' ? undefined : fluxo,
  });

  const linhas = useMemo(() => lancamentos.filter((l) => {
    const termo = busca.trim().toLowerCase();
    const correspondeBusca = !termo || [l.descricao, l.fornecedor, l.categoria, l.id, l.documento].some((valor) => String(valor ?? '').toLowerCase().includes(termo));
    return correspondeBusca && (status === 'TODOS' || l.status === status);
  }).sort((a, b) => ordem === 'maior' ? b.valorCentavos - a.valorCentavos : ordem === 'menor' ? a.valorCentavos - b.valorCentavos : ordem === 'vencimento-desc' ? (b.prazo ?? '').localeCompare(a.prazo ?? '') : (a.prazo ?? '').localeCompare(b.prazo ?? '')), [lancamentos, busca, status, ordem]);

  async function gerar(lancamento: (typeof lancamentos)[number]) {
    if (!lancamento.cotistaId) return toast.error('Este lançamento não possui cotista vinculado.');
    try {
      await gerarReembolso({ lancamento_origem_id: lancamento.id, cotista_aeronave_id: lancamento.cotistaId, valor_centavos: lancamento.valorCentavos, descricao: lancamento.descricao, data: lancamento.data, data_emissao: lancamento.data, data_vencimento: lancamento.prazo });
      await recarregar();
      toast.success('Reembolso gerado e salvo no D1.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o reembolso.'); }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-sm">Movimentações do caixa</CardTitle><p className="mt-1 text-[10px] text-muted-foreground">Lançamentos próprios da Share Brasil</p></div>
          <div className="flex flex-wrap gap-2">
            <Select value={fluxo} onValueChange={(v) => setFluxo(v as FluxoLancamento | 'TODOS')}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Fluxo" /></SelectTrigger>
              <SelectContent><SelectItem value="TODOS">Todos os fluxos</SelectItem><SelectItem value="ENTRADA">Entradas</SelectItem><SelectItem value="SAIDA">Saídas</SelectItem></SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="EM_ATRASO">Em atraso</SelectItem><SelectItem value="PAGO">Pago / recebido</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="mb-4 grid gap-2 md:grid-cols-[1fr_240px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar descrição, fornecedor, categoria ou documento…" className="h-9 pl-9" aria-label="Buscar movimentações" /></div>
            <select value={ordem} onChange={(event) => setOrdem(event.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm" aria-label="Ordenar movimentações"><option value="vencimento">Vencimento mais próximo</option><option value="vencimento-desc">Vencimento mais distante</option><option value="maior">Maior valor</option><option value="menor">Menor valor</option></select>
          </div>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando lançamentos…</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Documento / emissão</TableHead><TableHead>Descrição</TableHead><TableHead>Fornecedor</TableHead><TableHead>Vencimento</TableHead><TableHead>Fluxo</TableHead><TableHead className="text-right">Valor (R$)</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.length === 0 ? <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow> : linhas.map((l) => (
                      <TableRow key={l.id}><TableCell className="whitespace-nowrap"><p className="font-mono text-xs font-semibold">{l.documento ?? 'Sem número'}</p><p className="text-xs text-muted-foreground">{formatarData(l.data)}</p></TableCell><TableCell className="max-w-[260px]"><p className="truncate font-medium">{l.descricao}</p><p className="truncate text-[11px] text-muted-foreground">{l.categoria}</p></TableCell><TableCell>{l.fornecedor ?? '—'}</TableCell><TableCell className="whitespace-nowrap">{formatarData(l.prazo ?? null)}</TableCell><TableCell><Badge variant={l.fluxo === 'ENTRADA' ? 'default' : 'secondary'}>{l.fluxo === 'ENTRADA' ? 'Entrada' : 'Saída'}</Badge></TableCell><TableCell className={`text-right font-medium ${l.fluxo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{formatarMoeda(l.valorCentavos)}</TableCell><TableCell><Badge className={CORES_STATUS[l.status]}>{formatarStatus(l.status)}</Badge></TableCell><TableCell className="text-right">{l.reembolsavel && l.cotistaId ? <Button size="sm" variant="outline" onClick={() => void gerar(l)}>Gerar reembolso</Button> : '—'}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {linhas.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p> : linhas.map((l) => (
                  <article key={l.id} className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{l.descricao}</p><p className="mt-1 text-[11px] text-muted-foreground">{l.documento ?? 'Sem número'} · {formatarData(l.data)} · venc. {formatarData(l.prazo ?? null)}</p><p className="text-[11px] text-muted-foreground">{l.fornecedor ?? 'Sem fornecedor'}</p></div><span className={`shrink-0 text-sm font-bold ${l.fluxo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{formatarMoeda(l.valorCentavos)}</span></div><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={l.fluxo === 'ENTRADA' ? 'default' : 'secondary'}>{l.fluxo === 'ENTRADA' ? 'Entrada' : 'Saída'}</Badge><Badge className={CORES_STATUS[l.status]}>{formatarStatus(l.status)}</Badge></div></article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
