import { horarioRastreio } from '@/lib/rastreio';
import type { VooEmOperacao } from '@/lib/colaborador-api';

function diaTrecho(valor: string | null | undefined): string | null {
  const data = valor?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return data ? `${data[3]}/${data[2]}` : null;
}

function dataHoraRastreio(valor: string | null | undefined): string {
  if (!valor) return '—';
  const texto = valor.trim().replace(' ', 'T');
  const normalizado = /Z|[+-]\d{2}:?\d{2}$/i.test(texto) ? texto : `${texto}Z`;
  const data = new Date(normalizado);
  if (Number.isNaN(data.getTime())) return horarioRastreio(valor);
  return `${data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${horarioRastreio(valor)}`;
}

export default function HistoricoRastreioVoo({ voo }: { voo: VooEmOperacao }) {
  const pontos = voo.trilha || [];
  const todosEventos = voo.eventos_rastreio || [];
  const ultimaPerda = todosEventos.filter((evento) => evento.tipo === 'SINAL_PERDIDO')
    .reduce<(typeof todosEventos)[number] | null>((atual, evento) => {
      if (!atual || Date.parse(evento.ocorrido_em) > Date.parse(atual.ocorrido_em)) return evento;
      return atual;
    }, null);
  const eventos = todosEventos.filter((evento) => evento.tipo !== 'SINAL_PERDIDO' || evento.id === ultimaPerda?.id)
    .sort((a, b) => Date.parse(a.ocorrido_em) - Date.parse(b.ocorrido_em));
  return <div className="space-y-3 text-[10px]">
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5"><p className="text-muted-foreground">Primeiro sinal captado</p><p className="mt-1 font-mono font-semibold">{dataHoraRastreio(pontos[0]?.registrado_em || eventos.find((e) => e.tipo === 'SINAL_RECEBIDO')?.ocorrido_em)}</p></div>
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5"><p className="text-muted-foreground">Último sinal captado</p><p className="mt-1 font-mono font-semibold">{dataHoraRastreio(pontos.slice(-1)[0]?.registrado_em || eventos.slice(-1)[0]?.ocorrido_em)}</p></div>
    </div>
    {eventos.length > 0 && <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60"><ol className="divide-y divide-border/60">{eventos.map((evento) => <li key={evento.id} className="flex items-start justify-between gap-3 px-3 py-2"><span>{evento.tipo === 'SINAL_RECEBIDO' ? 'Sinal recebido no mapa' : evento.tipo === 'EM_SOLO_ADSB' ? 'Em solo confirmado por ADS-B' : 'Perda de sinal · possível pouso'}</span><time dateTime={evento.ocorrido_em} title={`Detectado em ${evento.detectado_em}`} className="shrink-0 text-right font-mono">{dataHoraRastreio(evento.ocorrido_em)}</time></li>)}</ol></div>}
    {voo.pernas.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Horários das pernas do voo (UTC)</caption><thead className="text-muted-foreground"><tr>{['Trecho', 'AC', 'DEP', 'POU', 'COR'].map((titulo) => <th key={titulo} className="px-1 py-1 font-medium">{titulo}</th>)}</tr></thead><tbody>{voo.pernas.map((perna) => <tr key={perna.id} className="border-t border-border/60"><td className="whitespace-nowrap px-1 py-2 font-mono"><span className="mr-2 text-muted-foreground">{diaTrecho(perna.horario_ac || perna.horario_dep || perna.horario_pouso || perna.horario_corte || voo.horario_previsto_agendamento) ?? '—'}</span>{perna.origem} → {perna.destino}</td>{[{valor: perna.horario_ac, nome: perna.horario_ac_usuario_nome, userId: perna.horario_ac_user_id}, {valor: perna.horario_dep, nome: perna.horario_dep_usuario_nome, userId: perna.horario_dep_user_id}, {valor: perna.horario_pouso, nome: perna.horario_pouso_usuario_nome, userId: perna.horario_pouso_user_id}, {valor: perna.horario_corte, nome: perna.horario_corte_usuario_nome, userId: perna.horario_corte_user_id}].map(({valor, nome, userId}, i) => <td key={i} className="px-1 py-2 align-top font-mono"><span className="whitespace-nowrap">{horarioRastreio(valor).replace(' UTC', '')}</span>{valor ? <span className="mt-1 block max-w-40 break-words text-[9px] text-muted-foreground">{nome || (userId ? 'Usuário não identificado' : 'Sem autoria registrada')}</span> : null}</td>)}</tr>)}</tbody></table></div>}
  </div>;
}
