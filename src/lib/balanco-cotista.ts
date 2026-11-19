import { classificarNaturezaCusto, projetarCustoPeriodo } from "../../shared/natureza-custo";
import type { DashboardCotista } from "@/lib/financeiro-share-api";
import { formatCentavos as formatarCentavos } from "./money";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";

/** Valores em centavos. Fonte única de cálculo da tela e do PDF do fechamento. */
type Lancamento = NonNullable<DashboardCotista["lancamentos"]>[number];
type CotistaOperacional = { id: string; nome: string; clienteId: string | null; socioId: string | null; holdingId: string | null; percentualSociedade: number | null };
export type VooBalanco = { id: string; data: string; numero: string | null; numeroSequencial: number | null; trecho: string | null; tempoDep: string | null; tempoPou: string | null; clienteId: string | null; socioId: string | null; horas: number | null; horasVoo: number | null; pousos: number | null; origem: string | null; destino: string | null; consumoEstimadoLitros: number | null; emprestado: boolean; clienteTomadorId: string | null; socioTomadorId: string | null; natureza: string | null; holdingId?: string | null; tempoAc?: string | null; tempoCor?: string | null; distanciaNm?: number | null; comandante?: string | null; copiloto?: string | null };
export function voosDoCotistaComFallback(
  voosDoParticipante: readonly VooBalanco[],
  voosDaAeronave: readonly VooBalanco[],
  idsCotista: { clienteId: string | null; socioId: string | null },
  mesesSelecionados: readonly string[],
): VooBalanco[] {
  const meses = new Set(mesesSelecionados);
  const voosFonte = voosDoParticipante.length
    ? voosDoParticipante
    : voosDaAeronave.filter((voo) => {
        const clienteCorrespondente = Boolean(idsCotista.clienteId) && (
          voo.emprestado
            ? voo.clienteTomadorId === idsCotista.clienteId
            : voo.clienteId === idsCotista.clienteId
        );
        const socioCorrespondente = Boolean(idsCotista.socioId) && (
          voo.emprestado
            ? voo.socioTomadorId === idsCotista.socioId
            : voo.socioId === idsCotista.socioId
        );
        return clienteCorrespondente || socioCorrespondente;
      });

  return voosFonte.filter((voo) => meses.has(String(voo.data ?? "").slice(0, 7)));
}
type Voo = VooBalanco & { percentualAtribuido?: number; compartilhado?: boolean; minutosTotal?: number | null; minutosVoo?: number | null };
type Viagem = { id: string; data: string; numero: string | null; rota: string | null; clienteId: string | null; socioId: string | null; valorCentavos: number | null };
export type BalancoOperacional = {
  versao: 1; aeronaveId: string; inicio: string | null; fim: string | null;
  fontes: { voos: boolean; abastecimentos: boolean; viagens: boolean; cotistas: boolean };
  cotistas: CotistaOperacional[]; voos: Voo[];
  abastecimentos: { id: string; data: string; litros: number | null; clienteId: string | null; socioId: string | null }[];
  viagens: Viagem[];
};
export type DashboardBalanco = DashboardCotista & { balanco_operacional?: BalancoOperacional | null; balanco_escopo?: "aeronave" | "cotista" | "geral" };
export type LinhaLancamento = { id: string; data: string; fornecedor: string; descricao: string; categoria: string; totalCentavos: number; suaParteCentavos: number };

type Registro = Record<string, unknown>;
type Grupo = "fixos" | "variaveis" | "extras" | "naoClassificados";
export type Custo = { total: number; fixos: number; variaveis: number; extras: number; naoClassificados: number };
type Participante = { id: string; nome: string; quota: number | null; holding: boolean; confirmado: boolean };

export function projetarCustos(total: Custo, horasRegistradas: number | null, meses: number, horasProjetadas: number, fatorFixo = 1) {
  return projetarCustoPeriodo(total, horasRegistradas, meses, horasProjetadas, fatorFixo);
}

export const GRUPOS = ["fixos", "variaveis", "extras", "naoClassificados"] as const;
export const NOME_GRUPO: Record<Grupo, string> = { fixos: "Fixos", variaveis: "Variáveis", extras: "Extras", naoClassificados: "Sem natureza informada" };
export const COR_GRUPO: Record<Grupo, string> = { fixos: "#2f6db5", variaveis: "#52794a", extras: "#e8b94a", naoClassificados: "#8291a4" };

export const obj = (v: unknown): Registro => (v && typeof v === "object" ? (v as Registro) : {});
const txt = (v: unknown) => String(v ?? "").trim();
export const norm = (v: unknown) => txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const idKey = (v: unknown) => txt(v).toLowerCase();
export const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nullable = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
export const cents = (v: unknown) => Math.round(n(v));
const mes = (v: unknown) => txt(v).slice(0, 7);
const validaMes = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const dividir = (a: number | null, b: number | null) => (a === null || b === null || b <= 0 ? null : a / b);
const custoVazio = (): Custo => ({ total: 0, fixos: 0, variaveis: 0, extras: 0, naoClassificados: 0 });
const somarCusto = (a: Custo, b: Custo) => { for (const k of Object.keys(a) as (keyof Custo)[]) a[k] += b[k]; return a; };

export const money = (v: unknown) => (v == null ? "—" : formatarCentavos(cents(v)));
export const fmt = (v: unknown, dec = 2) => (v == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: dec }).format(n(v)));
export const pct = (v: number | null) => (v === null ? "—" : `${fmt(v)}%`);
export const horas = (v: number | null) => {
  if (v === null) return "—";
  const m = Math.round(Math.abs(v) * 60);
  return `${v < 0 ? "−" : ""}${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};
export const compacto = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v / 100);

export const vooCompartilhado = (v: VooBalanco) => !v.emprestado && ["TR - TRASLADO", "VT - VOO TESTE"].includes(norm(v.natureza));
export const horasAtribuidas = (v: Voo) => v.horas === null ? null : v.horas * ((v.percentualAtribuido ?? 100) / 100);
const medidaAtribuida = (v: Voo, valor: number | null | undefined) => valor == null ? null : valor * ((v.percentualAtribuido ?? 100) / 100);

const classificar = classificarNaturezaCusto;

export function somarMedida<T>(itens: T[], valor: (t: T) => number | null, disponivel: boolean): number | null {
  if (!disponivel || itens.some((t) => valor(t) === null)) return null;
  return itens.reduce((s, t) => s + (valor(t) ?? 0), 0);
}

function montarCadastro(cotistas: CotistaAeronave[], op?: BalancoOperacional | null) {
  const participantes = new Map<string, Participante>();
  const aliases = new Map<string, string | null>();
  const nomes = new Map<string, string | null>();
  const clientes = new Map<string, string | null>();
  const socios = new Map<string, string | null>();
  const holdings = new Map<string, string | null>();
  function add(map: Map<string, string | null>, key: unknown, id: string) {
    const k = idKey(key);
    if (!k) return;
    map.set(k, !map.has(k) || map.get(k) === id ? id : null);
  }
  if (op?.fontes.cotistas) {
    for (const c of op.cotistas) {
      participantes.set(c.id, { id: c.id, nome: c.nome, quota: c.percentualSociedade, holding: Boolean(c.socioId || c.holdingId), confirmado: true });
      add(aliases, c.id, c.id); add(aliases, c.clienteId, c.id); add(aliases, c.socioId, c.id);
      add(clientes, c.clienteId, c.id); add(clientes, c.id, c.id); add(socios, c.socioId, c.id); add(nomes, c.nome, c.id);
      add(holdings, c.holdingId, c.id);
    }
  } else {
    for (const c of cotistas) {
      const id = txt(c.id);
      if (!id) continue;
      const q = nullable(obj(c).percentual_sociedade);
      participantes.set(id, { id, nome: c.nome || id, quota: q, holding: Boolean(c.eh_holding || c.socio_id), confirmado: true });
      [id, c.cliente_id, c.socio_id, ...(c.cotista_ids ?? [])].forEach((a) => add(aliases, a, id));
      add(clientes, c.cliente_id, id); add(socios, c.socio_id, id); add(nomes, c.nome, id);
      add(holdings, c.holding_id, id);
    }
  }
  function desconhecido(key: string, nome: unknown) {
    if (!participantes.has(key)) participantes.set(key, { id: key, nome: txt(nome) || "Sem cotista vinculado", quota: null, holding: false, confirmado: false });
    return key;
  }
  /** Procura sem criar participante novo. */
  const procurar = (valor: unknown, nome?: unknown): string | null => {
    const k = idKey(valor) || idKey(nome);
    return aliases.get(k) || (!aliases.has(k) ? nomes.get(k) : null) || null;
  };
  function resolver(id: unknown, nome?: unknown) {
    const k = idKey(id);
    if (k) return aliases.get(k) || desconhecido(`sem-vinculo:${k}`, nome || id);
    const label = idKey(nome);
    return (aliases.has(label) ? aliases.get(label) : nomes.get(label)) || desconhecido(`sem-vinculo:nome:${label}`, nome);
  }
  function operacional(clienteId: string | null, socioId: string | null, holdingId?: string | null) {
    // Campos tipados separadamente evitam colisões entre cliente.id e hold_socios.id.
    const c = clienteId ? clientes.get(idKey(clienteId)) : null;
    const s = socioId ? socios.get(idKey(socioId)) : null;
    if (clienteId && socioId && c !== s) return desconhecido("operacao:sem-vinculo", "Operação sem cotista vinculado");
    // Uma holding com vários sócios não identifica sozinha o usuário do voo.
    return s || c || (!clienteId && !socioId && holdingId ? holdings.get(idKey(holdingId)) : null)
      || desconhecido("operacao:sem-vinculo", "Operação sem cotista vinculado");
  }
  return {
    participantes, resolver, operacional, procurar,
    nome: (valor: unknown) => {
      const id = procurar(valor);
      return id ? participantes.get(id)?.nome || txt(valor) : txt(valor) || "Não informado";
    },
  };
}

export function montarBalanco(d: DashboardBalanco, cotistas: CotistaAeronave[], selecionados: string[]) {
  const meses = [...new Set(selecionados.filter(validaMes))].sort();
  const seleciona = new Set(meses);
  const op = d.balanco_operacional?.versao === 1 ? d.balanco_operacional : null;
  const cadastro = montarCadastro(cotistas, op);
  const porMes = new Map(meses.map((m) => [m, custoVazio()]));
  const custosCotista = new Map<string, Map<string, Custo>>();
  const linhasCotista = new Map<string, Map<string, LinhaLancamento>>();
  const categorias = new Map<string, { total: number; cotistas: Map<string, number> }>();
  const despesas = (d.lancamentos ?? []).filter((l) => seleciona.has(mes(l.dataEmissao || l.data)) && !["CANCELADO", "CANCELADA"].includes(norm(l.status)) && norm(l.fluxo) === "SAIDA");

  function adicionar(l: Lancamento, valor: number, grupo: Grupo, cotista: string, m: string) {
    const categoria = l.categoria || "Sem categoria";
    const geral = porMes.get(m)!;
    geral.total += valor; geral[grupo] += valor;
    let individual = custosCotista.get(cotista);
    if (!individual) { individual = new Map(meses.map((mm) => [mm, custoVazio()])); custosCotista.set(cotista, individual); }
    const custo = individual.get(m)!;
    custo.total += valor; custo[grupo] += valor;
    const cat = categorias.get(categoria) ?? { total: 0, cotistas: new Map() };
    cat.total += valor; cat.cotistas.set(cotista, (cat.cotistas.get(cotista) ?? 0) + valor); categorias.set(categoria, cat);
    const linhas = linhasCotista.get(cotista) ?? new Map<string, LinhaLancamento>();
    const atual = linhas.get(String(l.id));
    if (atual) atual.suaParteCentavos += valor;
    else linhas.set(String(l.id), { id: String(l.id), data: txt(l.dataEmissao || l.data).slice(0, 10), fornecedor: l.fornecedor || "—", descricao: l.descricao, categoria, totalCentavos: cents(l.valorCentavos), suaParteCentavos: valor });
    linhasCotista.set(cotista, linhas);
  }

  let diferencasRateio = 0;
  for (const l of despesas) {
    const raw = obj(l);
    const m = mes(l.dataEmissao || l.data);
    if (l.rateios?.length) {
      let rateado = 0;
      for (const r of l.rateios) {
        const valor = cents(r.valorCentavos);
        rateado += valor;
        adicionar(l, valor, classificar({ ...raw, ...obj(r), tipoRateio: obj(r).tipoRateio || raw.tipoRateio }), cadastro.resolver(r.cotistaId, r.cotista), m);
      }
      const diferenca = cents(l.valorCentavos) - rateado;
      if (diferenca) { diferencasRateio++; adicionar(l, diferenca, classificar(raw), cadastro.resolver("diferenca-rateio", "Diferença não atribuída"), m); }
    } else {
      // Rateios de holding vêm como linhas individuais com participanteId no backend.
      adicionar(l, cents(l.valorCentavos), classificar(raw), cadastro.resolver(raw.participanteId, raw.participanteNome), m);
    }
  }

  const horasComPrecisao = (minutos: number | null | undefined, registradas: number | null) =>
    minutos != null && Number.isFinite(minutos) && minutos >= 0 ? minutos / 60 : registradas;
  const voos = (op?.voos ?? []).filter((v) => seleciona.has(mes(v.data))).map((v) => ({
    ...v,
    horas: horasComPrecisao(v.minutosTotal, v.horas),
    horasVoo: horasComPrecisao(v.minutosVoo, v.horasVoo),
  }));
  const viagens = (op?.viagens ?? []).filter((v) => seleciona.has(mes(v.data)));
  const abastecimentos = (op?.abastecimentos ?? []).filter((a) => seleciona.has(mes(a.data)));
  const donoVoo = (v: Voo) => (v.emprestado ? cadastro.operacional(v.clienteTomadorId, v.socioTomadorId) : cadastro.operacional(v.clienteId, v.socioId, v.holdingId));
  const voosPorCotista = new Map<string, Voo[]>();
  const cotistasAtivos = [...cadastro.participantes.values()].filter((p) => p.confirmado && p.quota !== null && p.quota > 0);
  const voosSemVinculo: Voo[] = [];
  for (const v of voos) {
    // O diário limpa o titular de TR/VT por serem operações compartilhadas.
    // Divide igualmente entre cotistas ativos, preservando a duração física da etapa.
    const donos = vooCompartilhado(v) && cotistasAtivos.length ? cotistasAtivos.map((p) => p.id) : [donoVoo(v)];
    if (donos.includes("operacao:sem-vinculo")) voosSemVinculo.push(v);
    for (const id of donos) {
      const list = voosPorCotista.get(id) ?? [];
      list.push({ ...v, percentualAtribuido: 100 / donos.length, compartilhado: vooCompartilhado(v) });
      voosPorCotista.set(id, list);
    }
  }
  const viagensPorCotista = new Map<string, Viagem[]>();
  for (const v of viagens) { const id = cadastro.operacional(v.clienteId, v.socioId); const list = viagensPorCotista.get(id) ?? []; list.push(v); viagensPorCotista.set(id, list); }
  const fonteVoos = Boolean(op?.fontes.voos);
  const fonteViagens = Boolean(op?.fontes.viagens);
  const mediasAntigas = new Map((d.medias_mensais ?? []).map((m) => [m.mes, m]));
  const mensais = meses.map((m) => {
    const lista = voos.filter((v) => mes(v.data) === m);
    const viagensMes = viagens.filter((v) => mes(v.data) === m);
    const ab = abastecimentos.filter((v) => mes(v.data) === m);
    const custo = porMes.get(m)!;
    const antigo = mediasAntigas.get(m);
    const h = fonteVoos ? somarMedida(lista, (v) => v.horas, true) : antigo ? n(antigo.horas_voadas) : null;
    const consumo = somarMedida(lista, (v) => v.consumoEstimadoLitros, fonteVoos);
    const litros = somarMedida(ab, (a) => a.litros, Boolean(op?.fontes.abastecimentos));
    return {
      mes: m, nome: rotuloMesCotista(m), ...custo, horas: h,
      voos: fonteVoos ? lista.length : antigo ? n(antigo.total_voos) : null,
      pousos: fonteVoos ? somarMedida(lista, (v) => v.pousos, true) : antigo ? n(antigo.total_pousos) : null,
      horasVoo: somarMedida(lista, (v) => v.horasVoo, fonteVoos),
      distanciaNm: somarMedida(lista, (v) => v.distanciaNm ?? null, fonteVoos),
      diasVoo: fonteVoos ? new Set(lista.map((v) => v.data.slice(0, 10))).size : null,
      custoHora: dividir(custo.total, h), consumo, litros,
      consumoHora: dividir(consumo, h), abastecidoHora: dividir(litros, h),
      gastoViagens: somarMedida(viagensMes, (v) => v.valorCentavos, fonteViagens),
      relatorios: fonteViagens ? viagensMes.length : null,
    };
  });

  const total = mensais.reduce((s, m) => somarCusto(s, m), custoVazio());
  const totalHoras = somarMedida(mensais, (m) => m.horas, true);
  const totalViagens = somarMedida(viagens, (v) => v.valorCentavos, fonteViagens);
  const consumo = somarMedida(voos, (v) => v.consumoEstimadoLitros, fonteVoos);
  const litros = somarMedida(abastecimentos, (a) => a.litros, Boolean(op?.fontes.abastecimentos));
  const acertos = new Map<string, { pagoCentavos: number; devidoCentavos: number; saldoCentavos: number }>();
  for (const s of d.saldos ?? []) {
    const id = cadastro.procurar(obj(s).cotistaId || s.cotista, s.cotista);
    if (!id) continue;
    const a = acertos.get(id) ?? { pagoCentavos: 0, devidoCentavos: 0, saldoCentavos: 0 };
    a.pagoCentavos += cents(s.totalPagoCentavos); a.devidoCentavos += cents(s.totalDevidoCentavos); a.saldoCentavos += cents(s.saldoCentavos);
    acertos.set(id, a);
  }
  const compensacoes = Object.entries(d.matrizCompensacao ?? {}).flatMap(([credor, devedores]) =>
    Object.entries(devedores).filter(([, valor]) => n(valor) > 0).map(([devedor, valor]) => ({
      credorId: cadastro.procurar(credor), devedorId: cadastro.procurar(devedor),
      credor: cadastro.nome(credor), devedor: cadastro.nome(devedor), valorCentavos: cents(valor),
    })),
  );

  const participantes = [...cadastro.participantes.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => {
    const lista = voosPorCotista.get(p.id) ?? [];
    const relatorios = viagensPorCotista.get(p.id) ?? [];
    const mensal = meses.map((m) => {
      const vs = lista.filter((v) => mes(v.data) === m);
      const custo = custosCotista.get(p.id)?.get(m) ?? custoVazio();
      const h = somarMedida(vs, horasAtribuidas, fonteVoos);
      return { mes: m, nome: rotuloMesCotista(m), ...custo, horas: h, voos: fonteVoos ? vs.length : null, custoHora: dividir(custo.total, h),
        horasVoo: somarMedida(vs, (v) => medidaAtribuida(v, v.horasVoo), fonteVoos),
        distanciaNm: somarMedida(vs, (v) => medidaAtribuida(v, v.distanciaNm), fonteVoos),
        diasVoo: fonteVoos ? new Set(vs.map((v) => v.data.slice(0, 10))).size : null,
      };
    });
    const custo = mensal.reduce((s, m) => somarCusto(s, m), custoVazio());
    const h = somarMedida(lista, horasAtribuidas, fonteVoos);
    const uso = totalHoras !== null && totalHoras > 0 && h !== null ? (h / totalHoras) * 100 : null;
    const quota = p.quota !== null && p.quota >= 0 && p.quota <= 100 ? p.quota : null;
    const referencia = quota === null || totalHoras === null || !fonteVoos ? null : (totalHoras * quota) / 100;
    const destinos = new Map<string, number>();
    lista.forEach((v) => { const destino = txt(v.destino); if (destino) destinos.set(destino, (destinos.get(destino) ?? 0) + 1); });
    const gastoViagem = somarMedida(relatorios, (v) => v.valorCentavos, fonteViagens);
    return {
      ...p, quota, mensal, custo, horas: h, uso, referencia,
      horasParticulares: somarMedida(lista.filter((v) => !v.compartilhado), horasAtribuidas, fonteVoos),
      horasCompartilhadas: somarMedida(lista.filter((v) => v.compartilhado), horasAtribuidas, fonteVoos),
      diferenca: uso === null || quota === null ? null : uso - quota,
      saldoHoras: referencia === null || h === null ? null : referencia - h,
      voos: lista,
      destinos: [...destinos].map(([nome, visitas]) => ({ nome, visitas })).sort((a, b) => b.visitas - a.visitas || a.nome.localeCompare(b.nome)),
      custoHora: dividir(custo.total, h), mediaViagem: dividir(gastoViagem, fonteViagens ? relatorios.length : null),
      numeroViagens: fonteViagens ? relatorios.length : null,
      consumoHora: dividir(somarMedida(lista, (v) => medidaAtribuida(v, v.consumoEstimadoLitros), fonteVoos), h),
      acerto: acertos.get(p.id) ?? null,
      lancamentos: [...(linhasCotista.get(p.id)?.values() ?? [])].sort((a, b) => a.data.localeCompare(b.data)),
    };
  });

  const projecao = totalHoras !== null && totalHoras > 0 && meses.length > 0
    ? [5, 10, 15, 20, 25, 30, 40, 50, 60].map((h) => ({
        horas: h,
        ...projetarCustos(total, totalHoras, meses.length, h)!,
      }))
    : [];
  const entradasHolding = (d.movimentos_holding ?? []).filter((m) => seleciona.has(mes(m.data)) && !m.diretamentePago
    && ["ENTRADA", "APORTE", "ESTORNO"].includes(norm(m.fluxo))
    && ["PAGO", "RECEBIDO", "REEMBOLSADO", "ENTRADA", "APORTE_MENSAL", "RENDIMENTO_BANCARIO"].includes(norm(m.status)));

  return {
    meses, mensais, total, totalHoras, voos,
    totalVoos: somarMedida(mensais, (m) => m.voos, true), totalPousos: somarMedida(mensais, (m) => m.pousos, true),
    participantes,
    categorias: [...categorias].map(([nome, c]) => ({ nome, ...c })).sort((a, b) => b.total - a.total),
    custoHora: dividir(total.total, totalHoras),
    mediaViagem: dividir(totalViagens, fonteViagens ? viagens.length : null), totalViagens, viagens: fonteViagens ? viagens.length : null,
    consumoHora: dividir(consumo, totalHoras), abastecidoHora: dividir(litros, totalHoras), consumo, litros,
    projecao, entradasHolding, compensacoes, fonteVoos, fonteViagens, diferencasRateio, voosSemVinculo,
    aeronave: [...new Set((d.lancamentos ?? []).map((l) => l.aeronaveNome).filter(Boolean))].join(" / ") || "Aeronave",
    nome: cadastro.nome, procurar: cadastro.procurar,
  };
}

export type Balanco = ReturnType<typeof montarBalanco>;
export type ParticipanteBalanco = Balanco["participantes"][number];

export function participanteDoCotista(b: Balanco, cotista: CotistaAeronave | undefined, cotistas: CotistaAeronave[]) {
  if (!cotista) return undefined;
  const ids = [cotista.id, cotista.cliente_id, cotista.socio_id, ...(cotista.cotista_ids ?? [])].filter(Boolean) as string[];
  const nomeUnico = cotistas.filter((c) => norm(c.nome) === norm(cotista.nome)).length === 1;
  return b.participantes.find((p) => ids.includes(p.id) || (nomeUnico && norm(p.nome) === norm(cotista.nome)));
}

export function entradasHoldingNoMes(b: Balanco, holdingId: string, m: string) {
  return b.entradasHolding
    .filter((e) => obj(e).holdingId === holdingId && mes(e.data) === m)
    .reduce((s, e) => s + cents(e.valorCentavos), 0);
}

export const periodoRotulo = (b: Balanco) =>
  b.meses.length > 1 ? `${rotuloMesCotista(b.meses[0])} a ${rotuloMesCotista(b.meses[b.meses.length - 1])}` : rotuloMesCotista(b.meses[0]);

export function categoriasDoParticipante(b: Balanco, p: ParticipanteBalanco) {
  return b.categorias
    .map((c) => ({ nome: c.nome, valor: c.cotistas.get(p.id) ?? 0 }))
    .filter((c) => c.valor > 0)
    .sort((x, y) => y.valor - x.valor);
}

export function destaques(b: Balanco, p: ParticipanteBalanco): string[] {
  const out: string[] = [];
  const total = p.custo.total;
  const cats = categoriasDoParticipante(b, p);
  if (cats[0] && total > 0) out.push(`${cats[0].nome} é o seu maior gasto: ${pct((cats[0].valor / total) * 100)} do total (${money(cats[0].valor)}).`);
  if (total > 0 && p.custo.naoClassificados === 0) out.push(`${pct((p.custo.fixos / total) * 100)} do seu custo é fixo e acontece mesmo sem voar.`);
  if (p.uso != null && p.quota != null) out.push(`Você usou ${pct(p.uso)} das horas da aeronave; sua cota é ${pct(p.quota)}.`);
  const caro = [...p.mensal].sort((a, c) => c.total - a.total)[0];
  if (caro && caro.total > 0) out.push(`O mês mais caro foi ${caro.nome}: ${money(caro.total)}.`);
  const a = b.projecao.find((x) => x.horas === 5), c = b.projecao.find((x) => x.horas === 20);
  if (a && c) out.push(`Na aeronave, a hora voada custa ${money(a.custoHora)} voando 5 h/mês e ${money(c.custoHora)} voando 20 h/mês.`);
  return out;
}
