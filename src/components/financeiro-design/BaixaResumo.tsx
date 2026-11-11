import { CalendarDays, CheckCircle2, FileText } from 'lucide-react';
import './baixa-dialog.css';

export function BaixaResumo({ descricao, detalhe, valor, rotuloValor = 'Total desta baixa', vencimento, categoria, situacao }: {
  descricao: string; detalhe?: string; valor: string; rotuloValor?: string;
  vencimento: string; categoria: string; situacao: string;
}) {
  return <section className="baixa-resumo" aria-label="Resumo da baixa">
    <div className="baixa-resumo-topo">
      <div><h3>{descricao}</h3>{detalhe && <p>{detalhe}</p>}</div>
      <div className="baixa-resumo-valor"><span>{rotuloValor}</span><strong>{valor}</strong></div>
    </div>
    <dl className="baixa-resumo-fatos">
      {[[CalendarDays, 'Vencimento', vencimento], [FileText, 'Categoria', categoria], [CheckCircle2, 'Situação', situacao]].map(([Icon, label, value]) => {
        const Simbolo = Icon as typeof CalendarDays;
        return <div key={String(label)}><Simbolo size={16} aria-hidden="true"/><div><dt>{String(label)}</dt><dd>{String(value)}</dd></div></div>;
      })}
    </dl>
  </section>;
}
