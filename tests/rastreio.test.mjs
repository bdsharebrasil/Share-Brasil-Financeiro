import test from 'node:test';
import assert from 'node:assert/strict';
import { horarioRastreio, segmentosTrilha, vooComSinalNoAr } from '../src/lib/rastreio.ts';

test('horários D1 sem fuso são UTC e não dependem do fuso do navegador', () => {
  assert.equal(horarioRastreio('2026-11-11 14:25:00'), '14:25 UTC');
  assert.equal(horarioRastreio('2026-11-11T11:25:00-03:00'), '14:25 UTC');
  assert.equal(horarioRastreio('14:25'), '14:25 UTC');
  assert.equal(horarioRastreio(null), '—');
});

test('percurso mantém curvas reais e não inventa retas entre pernas ou lacunas de cobertura', () => {
  const ponto = (lat, minuto, trilha_id = 'p1') => ({ lat, lon: -56, trilha_id, registrado_em: `2026-11-11T12:${minuto}:00Z` });
  const pontos = [ponto(-15, '00'), ponto(-15.1, '01'), ponto(-15.2, '08'), ponto(-15.3, '09', 'p2'), ponto(-15.4, '10', 'p2')];
  const segmentos = segmentosTrilha(pontos);
  assert.equal(segmentos.length, 2);
  assert.equal(segmentos[0].anterior, pontos[0]);
  assert.equal(segmentos[1].ponto, pontos[4]);
});

test('avião no mapa ao vivo exige sinal recente no ar e operação aberta', () => {
  const voo = { status: 'em_voo', rastreio_status: 'ao_vivo', rastreio: { no_solo: false } };
  assert.equal(vooComSinalNoAr(voo), true);
  assert.equal(vooComSinalNoAr({ ...voo, rastreio_status: 'sem_sinal' }), false);
  assert.equal(vooComSinalNoAr({ ...voo, rastreio: { no_solo: true } }), false);
  assert.equal(vooComSinalNoAr({ ...voo, status: 'encerrada' }), false);
});
