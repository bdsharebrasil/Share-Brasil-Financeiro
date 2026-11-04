export type Grupo = 'fixo' | 'variavel' | 'extra';
type Chave =
  | 'admTrip' | 'hangaragem' | 'manutencaoFixa'
  | 'combustivel' | 'manutencaoHora' | 'taxasVoo' | 'hoteisAlimentacao'
  | 'custosExtras';

type LinhaBalanco = Record<Chave, number> & {
  mes: string;
  horasTotais: number;
  pousos: number;
  distancia: number;
  abastecimentoL: number;
  diasVoo: number;
};

type Balanco = {
  geral: LinhaBalanco[];
  aeronave: string | null;
  cotista: string | null;
  exercicio: string | number | null;
};

export const CATEGORIAS: { chave: Chave; nome: string; grupo: Grupo }[] = [
  { chave: 'admTrip', nome: 'Tripulação e administração', grupo: 'fixo' },
  { chave: 'hangaragem', nome: 'Hangaragem', grupo: 'fixo' },
  { chave: 'manutencaoFixa', nome: 'Manutenção fixa (seguro)', grupo: 'fixo' },
  { chave: 'combustivel', nome: 'Combustível', grupo: 'variavel' },
  { chave: 'manutencaoHora', nome: 'Manutenção por hora voada', grupo: 'variavel' },
  { chave: 'taxasVoo', nome: 'Taxas de voo', grupo: 'variavel' },
  { chave: 'hoteisAlimentacao', nome: 'Hotéis e alimentação', grupo: 'variavel' },
  { chave: 'custosExtras', nome: 'Extras (fora do previsto)', grupo: 'extra' },
];

export const COR_GRUPO: Record<Grupo, string> = { fixo: '#2f6db5', variavel: '#52794a', extra: '#e8b94a' };
export const NOME_GRUPO: Record<Grupo, string> = { fixo: 'Fixos', variavel: 'Variáveis', extra: 'Extras' };

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const hhmm = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

const somaGrupo = (l: LinhaBalanco, g: Grupo) =>
  CATEGORIAS.filter((c) => c.grupo === g).reduce((s, c) => s + l[c.chave], 0);

export function montarResumo(b: Balanco) {
  // Só meses com movimento: out–dez vazios não podem diluir as médias.
  const meses = b.geral.filter((l) => CATEGORIAS.some((c) => l[c.chave] > 0) || l.horasTotais > 0);
  const nMeses = Math.max(1, meses.length);

  const mensal = meses.map((l) => {
    const fixos = somaGrupo(l, 'fixo'), variaveis = somaGrupo(l, 'variavel'), extras = somaGrupo(l, 'extra');
    return { mes: l.mes, fixos, variaveis, extras, total: fixos + variaveis + extras, horas: l.horasTotais, pousos: l.pousos };
  });

  const total = mensal.reduce((s, m) => s + m.total, 0);
  const grupos: Record<Grupo, number> = {
    fixo: mensal.reduce((s, m) => s + m.fixos, 0),
    variavel: mensal.reduce((s, m) => s + m.variaveis, 0),
    extra: mensal.reduce((s, m) => s + m.extras, 0),
  };

  const categorias = CATEGORIAS
    .map((c) => {
      const t = meses.reduce((s, l) => s + l[c.chave], 0);
      return { ...c, total: t, pct: total ? (t / total) * 100 : 0, mediaMes: t / nMeses };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const soma = (k: 'horasTotais' | 'pousos' | 'distancia' | 'abastecimentoL' | 'diasVoo') =>
    meses.reduce((s, l) => s + l[k], 0);
  const horas = soma('horasTotais');
  const distanciaNM = soma('distancia');
  const litros = soma('abastecimentoL');

  // Modelo de projeção: fixo é por mês (dilui com as horas); variável e extra são por hora voada.
  const fixoMes = grupos.fixo / nMeses;
  const variavelHora = horas > 0 ? grupos.variavel / horas : null;
  const extraHora = horas > 0 ? grupos.extra / horas : null;
  const projecao =
    variavelHora === null || extraHora === null
      ? []
      : [1, 2, 3, 5, 10, 15, 20, 30, 45].map((h) => ({
          horas: h,
          fixoHora: fixoMes / h,
          variavelHora,
          extraHora,
          custoHora: fixoMes / h + variavelHora + extraHora,
          custoMes: fixoMes + (variavelHora + extraHora) * h,
        }));

  return {
    cabecalho: { aeronave: b.aeronave, cotista: b.cotista, exercicio: b.exercicio },
    periodo: mensal.length ? `${mensal[0].mes} a ${mensal[mensal.length - 1].mes}` : '',
    nMeses, mensal, total, mediaMes: total / nMeses, grupos, categorias,
    mesMaisCaro: [...mensal].sort((a, b) => b.total - a.total)[0],
    horas, pousos: soma('pousos'), diasVoo: soma('diasVoo'), distanciaNM, litros,
    litrosPorNM: distanciaNM > 0 ? litros / distanciaNM : null,
    custoHoraReal: horas > 0 ? total / horas : null,
    fixoMes, variavelHora, extraHora, projecao,
  };
}
export type Resumo = ReturnType<typeof montarResumo>;

/** Frases curtas para o cliente "bater o olho". */
export function destaques(r: Resumo): string[] {
  const out: string[] = [];
  const top = r.categorias[0];
  if (top) out.push(`${top.nome} é o maior gasto: ${top.pct.toFixed(0)}% do total (${brl(top.total)}).`);
  if (r.total > 0)
    out.push(`${((r.grupos.fixo / r.total) * 100).toFixed(0)}% dos custos são fixos: cerca de ${brl(r.fixoMes)} por mês, voando ou não.`);
  const p1 = r.projecao.find((p) => p.horas === 1), p10 = r.projecao.find((p) => p.horas === 10);
  if (p1 && p10) out.push(`Quanto mais voa, menos cada hora custa: de ${brl(p1.custoHora)} (1 h/mês) para ${brl(p10.custoHora)} (10 h/mês).`);
  if (r.mesMaisCaro) out.push(`O mês mais caro foi ${r.mesMaisCaro.mes}: ${brl(r.mesMaisCaro.total)}.`);
  return out;
}
