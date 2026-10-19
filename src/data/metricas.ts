import type { RankingCategoria, RankingCotista, SerieMensal } from '../types/financeiro';

export const serieMensal: SerieMensal[] = [
{ mes: 'Jan', horas: 236, voos: 41, custoTotal: 407000, custoHora: 1725, custoFixo: 243000, custoVariavel: 164000 },
{ mes: 'Fev', horas: 218, voos: 38, custoTotal: 407800, custoHora: 1871, custoFixo: 226400, custoVariavel: 181400 },
{ mes: 'Mar', horas: 264, voos: 47, custoTotal: 414600, custoHora: 1570, custoFixo: 243000, custoVariavel: 171600 },
{ mes: 'Abr', horas: 249, voos: 44, custoTotal: 419000, custoHora: 1683, custoFixo: 226400, custoVariavel: 192600 },
{ mes: 'Mai', horas: 271, voos: 49, custoTotal: 416800, custoHora: 1538, custoFixo: 243000, custoVariavel: 173800 },
{ mes: 'Jun', horas: 280, voos: 52, custoTotal: 438200, custoHora: 1565, custoFixo: 243000, custoVariavel: 195200 }];


export const rankingCategorias: RankingCategoria[] = [
{ categoria: 'Custos Fixos', valor: 806400, percentual: 32.2 },
{ categoria: 'Custos Variáveis', valor: 650600, percentual: 26 },
{ categoria: 'Pessoal & Tripulação', valor: 618400, percentual: 24.7 },
{ categoria: 'Manutenção', valor: 428000, percentual: 17.1 }];


export const composicaoCustos: RankingCategoria[] = [
{ categoria: 'Combustível', valor: 285046, percentual: 47 },
{ categoria: 'Hangaragem', valor: 133425, percentual: 22 },
{ categoria: 'Seguro', valor: 90972, percentual: 15 },
{ categoria: 'Taxas', valor: 60648, percentual: 10 },
{ categoria: 'Outros', valor: 36389, percentual: 6 }];


export const rankingCotistas: RankingCotista[] = [
{ cotistaId: 'c5', nome: 'Rodrigo Faria', avatar: 'RF', aeronave: 'PR-XYZ', horas: 46.1, custoHora: 3021, custoMes: 139300, participacao: 25 },
{ cotistaId: 'c1', nome: 'Eduardo Lins', avatar: 'EL', aeronave: 'PS-ABC', horas: 42.5, custoHora: 3313, custoMes: 140800, participacao: 25 },
{ cotistaId: 'c3', nome: 'Carlos Drummond', avatar: 'CD', aeronave: 'PS-ABC', horas: 38.4, custoHora: 3667, custoMes: 140800, participacao: 25 },
{ cotistaId: 'c7', nome: 'Patrícia Costa', avatar: 'PC', aeronave: 'PR-XYZ', horas: 34.8, custoHora: 4003, custoMes: 139300, participacao: 25 },
{ cotistaId: 'c2', nome: 'Ana Beatriz', avatar: 'AB', aeronave: 'PS-ABC', horas: 31.2, custoHora: 4513, custoMes: 140800, participacao: 25 },
{ cotistaId: 'c4', nome: 'Fernanda Moura', avatar: 'FM', aeronave: 'PS-ABC', horas: 29.9, custoHora: 4709, custoMes: 140800, participacao: 25 },
{ cotistaId: 'c8', nome: 'Bruno Alves', avatar: 'BA', aeronave: 'PR-XYZ', horas: 29.5, custoHora: 4722, custoMes: 139300, participacao: 25 },
{ cotistaId: 'c6', nome: 'Marcos Silveira', avatar: 'MS', aeronave: 'PR-XYZ', horas: 27.6, custoHora: 5047, custoMes: 139300, participacao: 25 }];


export const custoHoraCotista = serieMensal.map((s) => ({
  mes: s.mes,
  'PS-ABC': Math.round(s.custoHora * 1.06),
  'PR-XYZ': Math.round(s.custoHora * 0.94)
}));