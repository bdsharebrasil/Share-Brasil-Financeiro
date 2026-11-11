import type { VooEmOperacao, PontoRastreio } from './colaborador-api';

export function vooComSinalNoAr(voo: VooEmOperacao): boolean {
  return voo.status !== 'encerrada' && voo.rastreio_status === 'ao_vivo' && Boolean(voo.rastreio && !voo.rastreio.no_solo);
}

export function horarioRastreio(valor: string | null | undefined): string {
  if (!valor) return '—';
  const texto = valor.trim().replace(' ', 'T');
  const normalizado = /^\d{1,2}:\d{2}/.test(texto) ? `1970-01-01T${texto.length === 5 ? `${texto}:00` : texto}Z` : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`;
  const data = new Date(normalizado);
  return Number.isNaN(data.getTime()) ? '—' : `${data.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false })} UTC`;
}

/** Não desenha uma reta fictícia entre pernas diferentes ou em lacunas de cobertura. */
export function segmentosTrilha(pontos: PontoRastreio[]) {
  return pontos.slice(1).flatMap((ponto, i) => {
    const anterior = pontos[i];
    if (anterior.trilha_id && ponto.trilha_id && anterior.trilha_id !== ponto.trilha_id) return [];
    const intervalo = Date.parse(ponto.registrado_em || '') - Date.parse(anterior.registrado_em || '');
    if (Number.isFinite(intervalo) && (intervalo > 180_000 || intervalo < 0)) return [];
    if (![anterior.lat, anterior.lon, ponto.lat, ponto.lon].every(Number.isFinite)) return [];
    return [{ anterior, ponto }];
  });
}
