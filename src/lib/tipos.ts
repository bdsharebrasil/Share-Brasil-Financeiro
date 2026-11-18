export interface Solicitacao {
  id: string;
  numero_voo: string | null;
  origem: string;
  destino: string;
  data_agendada: string;
  horario_previsto_agendamento: string | null;
  dias_duracao: number | null;
  numero_passageiros: number | null;
  status: string | null;
  observacoes: string | null;
  voo_emprestado?: string | null;
}

export interface AeronaveContexto {
  id: string;
  matricula_registro: string;
  fabricante: string | null;
  modelo: string | null;
  tipo_aeronave: string | null;
  numero_serie?: string | null;
  ano?: string | null;
  base?: string | null;
  consumo_combustivel: number | null;
  velocidade_cruzeiro: string | number | null;
  numero_motores?: number | null;
  nome_proprietario?: string | null;
  performance_velocidade_cruzeiro_kt?: number | null;
  performance_nivel_cruzeiro_max_ft?: number | null;
  performance_categoria?: string | null;
}

export interface Tripulante {
  id: string;
  canac: string | null;
  nome_completo: string | null;
  tipo_licenca?: string | null;
}

export interface ContextoVoo {
  solicitacao: Solicitacao;
  aeronave: AeronaveContexto | null;
  cliente: { id: string; nome: string | null; codigo_cliente: string | null } | null;
  cotista: { id: string; nome: string | null; codigo_cliente: string | null } | null;
  tripulacao: { piloto: Tripulante | null; copiloto: Tripulante | null };
  passageiros: number;
  fonte: string;
}

export interface SugestaoVoo {
  id: string;
  cliente?: string | null;
  numero_voo: string;
  origem: string;
  destino: string;
  data_agendada: string | null;
  status: string | null;
  matricula_registro?: string | null;
  modelo?: string | null;
}

export interface AerodromoResumo {
  id: string;
  label: string;
  name: string;
  coordenadas: string | null;
}

export interface RotaSugerida {
  route: string;
  level?: string;
  type?: string;
  remarks?: string;
  source?: string;
}

export interface RespostaRotas {
  adep: string;
  ades: string;
  routes: RotaSugerida[];
  preferred_available: boolean;
  source: "AISWEB/DECEA" | "fallback" | string;
  warning?: string;
}

export interface PontoRota {
  nome: string;
  lat: number;
  lon: number;
  tipo: "adep" | "ades" | "alternado" | "ponto";
}

export interface Segmento {
  seq: number;
  de: string;
  para: string;
  lat: number;
  lon: number;
  distanciaNM: number;
  distanciaKm: number;
  proaVerdadeira: number;
  minutos: number | null;
}

/** Formulário ICAO FPL (itens 7 a 19). */
export interface FormularioIcao {
  identificacao: string;
  regraVoo: "I" | "V" | "Y" | "Z";
  tipoVoo: "S" | "N" | "G" | "M" | "X";
  numeroAeronaves: string;
  tipoAeronave: string;
  esteira: "L" | "M" | "H" | "J";
  equipamento: string;
  adep: string;
  dataVoo: string;
  eobt: string;
  velocidade: string;
  nivel: string;
  rota: string;
  ades: string;
  eet: string;
  alternado1: string;
  alternado2: string;
  outrasInformacoes: string;
  autonomia: string;
  pessoasABordo: string;
  radioEmergencia: string;
  sobrevivencia: string;
  coletes: string;
  botes: string;
  corAeronave: string;
  observacoes: string;
  piloto: string;
}
