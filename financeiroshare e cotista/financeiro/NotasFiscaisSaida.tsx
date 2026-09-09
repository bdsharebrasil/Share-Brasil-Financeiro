import React from 'react';
import { FileSignature, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { notasSaida } from '../../data/operacional';
import type { StatusNota } from '../../types/operacional';
import { formatBRL, formatData } from '../../utils/format';

const ETAPAS: {id: StatusNota;label: string;}[] = [
{ id: 'RASCUNHO', label: 'Rascunho' },
{ id: 'AGUARDANDO_CONFERENCIA', label: 'Ag. Conferência' },
{ id: 'ENVIADO', label: 'Enviado' },
{ id: 'ASSINADO', label: 'Assinado' },
{ id: 'FINALIZADO', label: 'Finalizado' }];


const CLASSES: Record<StatusNota, string> = {
  RASCUNHO: 'bg-muted text-muted-foreground border-border',
  AGUARDANDO_CONFERENCIA: 'bg-warning-soft text-warning border-warning/30',
  ENVIADO: 'bg-brand-soft text-brand border-brand/30',
  ASSINADO: 'bg-brand-soft text-brand border-brand/30',
  FINALIZADO: 'bg-success-soft text-success border-success/30'
};

export function NotasFiscaisSaida() {
  const total = notasSaida.reduce((s, n) => s + n.valor, 0);
  const finalizadas = notasSaida.filter((n) => n.status === 'FINALIZADO').length;

  return (
    <SectionCard
      titulo="Nota fiscal de saída e recibos"
      descricao={`${notasSaida.length} documentos · ${formatBRL(total)} · ${finalizadas} finalizados`}
      Icon={FileSignature}
      acoes={
      <Button
        size="sm"
        onClick={() =>
        toast.success('Documento criado', {
          description: 'Novo recibo de saída em rascunho.'
        })
        }>
        
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Emitir documento
        </Button>
      }
      semPadding>
      
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-3">
        {ETAPAS.map((e, i) =>
        <React.Fragment key={e.id}>
            {i > 0 ? <span className="text-muted-foreground">›</span> : null}
            <span className="num rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {e.label} · {notasSaida.filter((n) => n.status === e.id).length}
            </span>
          </React.Fragment>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Aeronave</TableHead>
              <TableHead className="whitespace-nowrap">Emissão</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notasSaida.map((n) =>
            <TableRow key={n.id}>
                <TableCell>
                  <p className="num text-sm font-semibold text-card-foreground">{n.numero}</p>
                  <p className="num text-xs text-muted-foreground">
                    {n.id} · {n.competencia}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-card-foreground">{n.destinatario}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{n.categoria}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="num text-[10px]">
                    {n.aeronave}
                  </Badge>
                </TableCell>
                <TableCell className="num whitespace-nowrap text-sm">
                  {formatData(n.emissao)}
                </TableCell>
                <TableCell className="num text-right text-sm font-bold text-card-foreground">
                  {formatBRL(n.valor)}
                </TableCell>
                <TableCell>
                  <span
                  className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${CLASSES[n.status]}`}>
                  
                    {ETAPAS.find((e) => e.id === n.status)?.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                  toast.info('Documento aberto', { description: `${n.numero} · ${n.destinatario}` })
                  }>
                  
                    Visualizar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>);

}