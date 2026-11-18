import { horarioRastreio } from '@/lib/rastreio';
import type { VooEmOperacao } from '@/lib/colaborador-api';

function diaTrecho(valor: string | null | undefined): string | null {
  const data = valor?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return data ? `${data[3]}/${data[2]}` : null;
}

export default function HistoricoRastreioVoo({ voo }: { voo: VooEmOperacao }) {
  const pontos = voo.trilha || [];
  const eventos = voo.eventos_rastreio || [];
  return <div className="space-y-3 text-[10px]">
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5"><p className="text-muted-foreground">Primeiro sinal captado</p><p className="mt-1 font-mono font-semibold">{horarioRastreio(pontos[0]?.registrado_em || eventos.find((e) => e.tipo === 'SINAL_RECEBIDO')?.ocorrido_em)}</p></div>
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5"><p className="text-muted-foreground">Último sinal captado</p><p className="mt-1 font-mono font-semibold">{horarioRastreio(pontos.slice(-1)[0]?.registrado_em)}</p></div>
    </div>
    {eventos.length > 0 && <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60"><ol className="divide-y divide-border/60">{eventos.map((evento) => <li key={evento.id} className="flex items-start justify-between gap-3 px-3 py-2"><span>{evento.tipo === 'SINAL_RECEBIDO' ? 'Sinal recebido no mapa' : evento.tipo === 'EM_SOLO_ADSB' ? 'Em solo confirmado por ADS-B' : 'Perda de sinal · possível pouso'}</span><time dateTime={evento.ocorrido_em} title={`Detectado em ${evento.detectado_em}`} className="shrink-0 font-mono">{horarioRastreio(evento.ocorrido_em)}</time></li>)}</ol></div>}
    {voo.pernas.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="mb-2 text-left font-semibold">Horários registrados pela tripulação · UTC</caption><thead className="text-muted-foreground"><tr>{['Trecho', 'AC', 'DEP', 'POU', 'COR'].map((titulo) => <th key={titulo} className="px-1 py-1 font-medium">{titulo}</th>)}</tr></thead><tbody>{voo.pernas.map((perna) => <tr key={perna.id} className="border-t border-border/60"><td className="whitespace-nowrap px-1 py-2 font-mono"><span className="mr-2 text-muted-foreground">{diaTrecho(perna.horario_ac || perna.horario_dep || perna.horario_pouso || perna.horario_corte || voo.horario_previsto_agendamento) ?? '—'}</span>{perna.origem} → {perna.destino}</td>{[perna.horario_ac, perna.horario_dep, perna.horario_pouso, perna.horario_corte].map((valor, i) => <td key={i} className="whitespace-nowrap px-1 py-2 font-mono">{horarioRastreio(valor).replace(' UTC', '')}</td>)}</tr>)}</tbody></table></div>}
    <p className="text-muted-foreground">{voo.historico_disponivel === false ? 'Histórico de rastreio indisponível no momento.' : pontos.length ? 'O percurso mostra os pontos efetivamente captados. Perda de sinal pode indicar pouso ou falta de cobertura; não altera o horário POU.' : 'Nenhum percurso ADS-B registrado para este agendamento.'}</p>
  </div>;
}
