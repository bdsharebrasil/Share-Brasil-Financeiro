import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import type { StatusLancamento } from '../../types/financeiro';

const MAPA: Record<
  StatusLancamento,
  {label: string;classes: string;Icon: React.ElementType;}> =
{
  EM_ABERTO: {
    label: 'Em Aberto',
    classes: 'bg-warning-soft text-warning border-warning/30',
    Icon: Clock
  },
  PAGO: {
    label: 'Pago',
    classes: 'bg-success-soft text-success border-success/30',
    Icon: CheckCircle2
  },
  RECEBIDO: {
    label: 'Recebido',
    classes: 'bg-success-soft text-success border-success/30',
    Icon: CheckCircle2
  },
  EM_ATRASO: {
    label: 'Em Atraso',
    classes: 'bg-danger-soft text-danger border-danger/30',
    Icon: AlertTriangle
  },
  AGUARDANDO_REEMBOLSO: {
    label: 'Aguardando Reembolso',
    classes: 'bg-brand-soft text-brand border-brand/30',
    Icon: RotateCcw
  },
  REEMBOLSADO: {
    label: 'Reembolsado',
    classes: 'bg-success-soft text-success border-success/30',
    Icon: RotateCcw
  },
  PAGO_DIRETAMENTE: {
    label: 'Pago Diretamente',
    classes: 'bg-success-soft text-success border-success/30',
    Icon: CheckCircle2
  },
  CANCELADO: {
    label: 'Cancelado',
    classes: 'bg-muted text-muted-foreground border-border',
    Icon: XCircle
  }
};

export function StatusBadge({ status }: {status: StatusLancamento;}) {
  const { label, classes, Icon } = MAPA[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${classes}`}>
      
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>);

}