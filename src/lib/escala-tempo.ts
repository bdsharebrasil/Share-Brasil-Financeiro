import type { DisponibilidadeTripulacao, EscalaAgendamento, TripulanteAgendamento } from "@/lib/colaborador-api";

export const MIN = 60_000;
export const HORA = 60 * MIN;
export const DIA = 24 * HORA;
export const MIN_APRESENTACAO = 60;  // apresentação antes da decolagem
export const MIN_CORTE = 30;         // corte após o pouso
export const DURACAO_PADRAO_MIN = 120; // usado só quando não há pouso previsto

export const ROTULO_STATUS: Record<string, string> = {
  aviso: "Sob aviso", ferias: "Férias", folga: "Folga", atestado_medico: "Atestado médico",
  treinamento: "Treinamento", acompanhando_manutencao: "Acompanhando manutenção",
};

export type BlocoEscala = {
  id: string;
  vooId?: string;
  tripulanteId: string;
  tripulanteNome: string;
  variante: string;      // "pic" | "sic" | status de indisponibilidade
  titulo: string;
  detalhe: string;
  inicio: number;        // ms UTC
  fim: number;           // ms UTC
  diaInteiro: boolean;
  estimado: boolean;
};

export const diaUtc = (data: string) => Date.parse(`${data.slice(0, 10)}T00:00:00Z`);

export function instanteUtc(data: string, valor?: string | null): number | null {
  if (!valor) return null;
  const texto = String(valor).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    const ms = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  const m = texto.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const ms = Date.parse(`${data.slice(0, 10)}T${m[1].padStart(2, "0")}:${m[2]}:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function montarBlocos(
  escala: EscalaAgendamento[],
  disponibilidades: DisponibilidadeTripulacao[],
  tripulacao: TripulanteAgendamento[],
): BlocoEscala[] {
  const nomes = new Map(tripulacao.map((t) => [t.id, t.nome_completo]));
  const blocos: BlocoEscala[] = [];

  for (const voo of escala) {
    const dataIni = voo.data_agendada.slice(0, 10);
    const dataFim = (voo.data_fim || voo.data_agendada).slice(0, 10);
    const multiDia = dataFim > dataIni;
    const decolagem = instanteUtc(dataIni, voo.horario_previsto_agendamento);
    const inicio = decolagem != null ? decolagem - MIN_APRESENTACAO * MIN : diaUtc(dataIni);

    const corte = instanteUtc(dataFim, voo.horario_corte);
    const pouso = instanteUtc(dataFim, voo.horario_pouso_previsto);
    let fim: number;
    let estimado = false;
    if (corte != null) fim = corte;
    else if (pouso != null) fim = pouso + MIN_CORTE * MIN;
    else if (!multiDia && decolagem != null) { fim = decolagem + (DURACAO_PADRAO_MIN + MIN_CORTE) * MIN; estimado = true; }
    else { fim = diaUtc(dataFim) + DIA; estimado = true; } // viagem de vários dias: até o fim do último dia
    if (fim <= inicio) fim += DIA;

    const rota = `${voo.origem} → ${voo.destino}`;
    ([[voo.piloto_id, "PIC"], [voo.copiloto_id, "SIC"]] as const).forEach(([id, papel]) => {
      if (!id) return;
      blocos.push({
        id: `voo:${voo.id}:${papel}`, vooId: voo.id, tripulanteId: id,
        tripulanteNome: nomes.get(id) || (papel === "PIC" ? voo.piloto_nome : voo.copiloto_nome) || "Tripulante",
        variante: papel.toLowerCase(), titulo: voo.numero_voo || "Voo sem nº", detalhe: `${rota} · ${papel}`,
        inicio, fim, diaInteiro: false, estimado,
      });
    });
  }

  for (const d of disponibilidades) {
    if (d.status === "disponivel") continue; // ausência de bloco = disponível
    const temHora = Boolean(d.hora_inicio && d.hora_fim);
    const inicio = (temHora ? instanteUtc(d.data_inicio, d.hora_inicio) : null) ?? diaUtc(d.data_inicio);
    const fim = (temHora ? instanteUtc(d.data_fim, d.hora_fim) : null) ?? diaUtc(d.data_fim) + DIA;
    blocos.push({
      id: `disp:${d.id}`, tripulanteId: d.tripulante_id, tripulanteNome: nomes.get(d.tripulante_id) || "Tripulante",
      variante: d.status, titulo: ROTULO_STATUS[d.status] || d.status, detalhe: d.observacoes || "",
      inicio, fim, diaInteiro: !temHora, estimado: false,
    });
  }
  return blocos;
}

/** Conflito real por intervalo (e não por dia). */
export function conflitosDoTripulante(blocos: BlocoEscala[], tripulanteId: string, inicio: number, fim: number) {
  return blocos.filter((b) => b.tripulanteId === tripulanteId && b.inicio < fim && inicio < b.fim);
}

/** Coloca blocos sobrepostos lado a lado dentro da coluna. */
export function posicionarColisoes<T extends { inicio: number; fim: number }>(itens: T[]) {
  type Posicionado = T & { lane: number; lanes: number };
  const saida: Posicionado[] = [];
  let grupo: Posicionado[] = [];
  let fimGrupo = -Infinity;
  const fechar = () => {
    const lanes = Math.max(...grupo.map((g) => g.lane)) + 1;
    grupo.forEach((g) => { g.lanes = lanes; });
    saida.push(...grupo);
    grupo = [];
  };
  for (const item of [...itens].sort((a, b) => a.inicio - b.inicio || b.fim - a.fim)) {
    if (grupo.length && item.inicio >= fimGrupo) fechar();
    const ocupadas = new Set(grupo.filter((g) => g.fim > item.inicio).map((g) => g.lane));
    let lane = 0;
    while (ocupadas.has(lane)) lane++;
    grupo.push({ ...item, lane, lanes: 1 });
    fimGrupo = grupo.length === 1 ? item.fim : Math.max(fimGrupo, item.fim);
  }
  if (grupo.length) fechar();
  return saida;
}