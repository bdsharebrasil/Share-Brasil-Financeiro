import { lazy, Suspense, useEffect, useState } from 'react';
import { Plane, Radio } from 'lucide-react';
import { buscarHistoricoRastreio, type SolicitacaoVooInterna, type VooEmOperacao } from '@/lib/colaborador-api';
import { vooComSinalNoAr } from '@/lib/rastreio';
import HistoricoRastreioVoo from '@/components/dashboard/operacoes/HistoricoRastreioVoo';

const MapaVoo = lazy(() => import('@/components/dashboard/operacoes/VooEmOperacaoMapa'));

export default function AcompanhamentoVooAgendado({ item, voosEmOperacao = [], secao }: { item: SolicitacaoVooInterna; voosEmOperacao?: VooEmOperacao[]; secao?: 'historico' | 'mapa' }) {
  const [historico, setHistorico] = useState<VooEmOperacao | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const vooAoVivo = voosEmOperacao.find((voo) => voo.id === item.id);
  const concluido = ['encerrada', 'concluida', 'cancelada', 'reprovada'].includes(String(item.status).toLowerCase());

  useEffect(() => {
    let ativo = true;
    setHistorico(null);
    setErro('');
    setCarregando(true);
    void buscarHistoricoRastreio(item.id).then((voo) => { if (ativo) setHistorico(voo); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar o histórico de rastreio.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [item.id, item.status, Boolean(vooAoVivo)]);

  const salvo = historico?.id === item.id ? historico : null;
  const voo = concluido ? salvo : vooAoVivo || salvo;
  const aoVivo = !concluido && Boolean(voo && vooComSinalNoAr(voo));
  const temPercurso = Boolean(voo?.trilha?.length);

  const percurso = <aside className="min-w-0 overflow-hidden rounded-xl border border-border" aria-label="Percurso do voo">
    <p className="border-b border-border px-3 py-2 text-[11px] font-semibold">{aoVivo ? 'Rastreio ao vivo' : 'Trajeto percorrido'}</p>
    {voo && (aoVivo || temPercurso) ? <Suspense fallback={<div className="h-[220px] animate-pulse bg-secondary/40" />}><MapaVoo key={`${item.id}-${aoVivo}`} voo={voo} historico={!aoVivo} compacto /></Suspense> : <div className="flex min-h-28 items-center justify-center bg-secondary/15 p-4 text-center text-[11px] text-muted-foreground">{carregando ? 'Carregando percurso…' : 'O percurso aparecerá quando houver posições ADS-B captadas.'}</div>}
  </aside>;

  if (secao === 'mapa') return percurso;

  const detalhes = <div className="min-w-0 space-y-3">
    <div className="grid grid-cols-2 gap-3 text-[11px]">
      <div><p className="text-muted-foreground">Aeronave</p><p className="mt-1 font-semibold">{item.matricula_registro || 'A definir'} · {item.modelo || '—'}</p></div>
      <div><p className="text-muted-foreground">Data</p><p className="mt-1 font-semibold">{item.data_agendada.slice(0, 10).split('-').reverse().join('/')}</p></div>
    </div>
    {carregando && !voo ? <p role="status" className="text-[11px] text-muted-foreground">Carregando histórico…</p> : voo ? <HistoricoRastreioVoo voo={voo} /> : <p role={erro ? 'alert' : 'status'} className="text-[11px] text-muted-foreground">{erro || 'Nenhum percurso ADS-B registrado para este agendamento.'}</p>}
  </div>;

  return <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Histórico e acompanhamento do voo selecionado">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
      <h3 className="flex items-center gap-2 text-xs font-bold"><Plane size={15} className="text-primary" />{aoVivo ? 'Voo ao vivo' : 'Histórico do voo'} {item.numero_voo || ''}</h3>
      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${aoVivo ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-secondary/30 text-muted-foreground'}`}><Radio size={11} />{concluido ? 'Operação encerrada' : aoVivo ? 'Ao vivo' : 'Percurso registrado'}</span>
    </header>
    {secao === 'historico' ? <div className="p-4">{detalhes}</div> : <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">{detalhes}{percurso}</div>}
  </section>;
}
