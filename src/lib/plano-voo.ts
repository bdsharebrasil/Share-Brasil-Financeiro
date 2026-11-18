import { chaveNumeroVoo } from "./format";
import type { SolicitacaoVooInterna } from "./colaborador-api";
import type { ContextoVoo, FormularioIcao, RespostaRotas } from "./tipos";

export function vinculosDoAgendamento(voo: SolicitacaoVooInterna): Pick<ContextoVoo, "cliente" | "cotista"> {
  return {
    cliente: voo.cliente_id ? { id: voo.cliente_id, nome: voo.cliente_razao_social, codigo_cliente: voo.codigo_cliente } : null,
    cotista: voo.socio_id ? { id: voo.socio_id, nome: voo.socio_nome || null, codigo_cliente: voo.codigo_cliente } : null,
  };
}

export function localizarAgendamento(voos: SolicitacaoVooInterna[], valor: string) {
  const porId = voos.find(voo => voo.id === valor);
  if (porId) return porId;
  const chave = chaveNumeroVoo(valor);
  const encontrados = voos.filter(voo => voo.numero_voo && chaveNumeroVoo(voo.numero_voo) === chave);
  if (!encontrados.length) throw new Error("Voo não encontrado. Confira o número ou selecione um voo da lista.");
  if (encontrados.length > 1) throw new Error("Há mais de um agendamento com esse número. Selecione o voo pela data e pelo cliente na lista.");
  return encontrados[0]!;
}

/** Horários ISO com fuso são convertidos para UTC; HH:MM já representa o horário do FPL. */
export function horarioFpl(valor: string | null | undefined, data: string) {
  if (!valor) return { data, hora: "" };
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(valor)) {
    const instante = new Date(valor);
    if (!Number.isNaN(instante.getTime())) return { data: instante.toISOString().slice(0, 10), hora: instante.toISOString().slice(11, 16) };
  }
  const hora = /(?:^|[T ])([0-2]\d:[0-5]\d)/.exec(valor)?.[1] ?? "";
  return { data, hora: hora.slice(0, 2) < "24" ? hora : "" };
}

export type RascunhoPlano = {
  formulario: FormularioIcao;
  contexto: ContextoVoo | null;
  coordenadas: Record<string, { lat: number; lon: number; nome: string }>;
  rotaAisweb: RespostaRotas | null;
  minutosReserva: number;
  minutosTaxi: number;
  ventoKt: number;
  combustivelABordo: string;
  consultaAerodromo: string;
  aerodromoAtivo: string;
};

const chaveRascunho = (usuario: string) => `share:plano-voo:v1:${usuario}`;
export function lerRascunho(storage: Pick<Storage, "getItem">, usuario: string): Partial<RascunhoPlano> | null {
  try {
    const registro = JSON.parse(storage.getItem(chaveRascunho(usuario)) ?? "null");
    if (!registro || registro.versao !== 1 || Date.now() - registro.salvoEm > 7 * 86400_000) return null;
    const dados = registro.dados;
    if (!dados || typeof dados.formulario?.adep !== "string" || typeof dados.formulario?.ades !== "string") return null;
    return dados;
  } catch { return null; }
}
export function guardarRascunho(storage: Pick<Storage, "setItem">, usuario: string, dados: RascunhoPlano) {
  try { storage.setItem(chaveRascunho(usuario), JSON.stringify({ versao: 1, salvoEm: Date.now(), dados })); return true; }
  catch { return false; }
}
