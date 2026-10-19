export interface LinhaBalanco {
  mes: string;
  admTrip: number;
  hangaragem: number;
  manutencaoFixa: number;
  combustivel: number;
  manutencaoHora: number;
  taxasVoo: number;
  hoteisAlimentacao: number;
  custosExtras: number;
  abastecimentoL: number;
  distancia: number;
  pousos: number;
  horasVoo: number;
  horasTotais: number;
  diasVoo: number;
}

export interface LinhaMedia {
  mes: string;
  admTrip: number;
  hangaragem: number;
  manutencaoFixa: number;
  combustivel: number;
  manutencaoHora: number;
  taxasVoo: number;
  hoteisAlimentacao: number;
  custosExtras: number;
  litros: number;
  valorLitro: number;
  velocidade: number;
  custoHora: number;
  custoKm: number;
  custoDia: number;
}

export interface Balanco {
  titulo: string;
  aeronave: string;
  cotista: string;
  exercicio: string;
  geral: LinhaBalanco[];
  medias: LinhaMedia[];
}