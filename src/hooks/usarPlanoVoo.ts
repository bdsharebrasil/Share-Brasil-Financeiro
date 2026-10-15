import { useCallback, useEffect, useMemo, useState } from "react";

import { buscarAerodromos, calcularPlanoVoo } from "@/lib/flightplan-api";
import { buscarPainelAgendamento } from "@/lib/colaborador-api";
import {
  calcularCombustivel,
  distanciaKm,
  distanciaNM,
  interpretarCoordenadas,
  proaVerdadeira,
  tempoMinutos,
} from "@/lib/navegacao";
import { horaMinutoParaMinutos } from "@/lib/format";
import type {
  ContextoVoo,
  FormularioIcao,
  PontoRota,
  RespostaRotas,
  Segmento,
  SugestaoVoo,
} from "@/lib/tipos";

const FORMULARIO_INICIAL: FormularioIcao = {
  identificacao: "",
  regraVoo: "I",
  tipoVoo: "N",
  numeroAeronaves: "1",
  tipoAeronave: "",
  esteira: "L",
  equipamento: "",
  adep: "",
  dataVoo: new Date().toISOString().slice(0, 10),
  eobt: "",
  velocidade: "",
  nivel: "",
  rota: "",
  ades: "",
  eet: "",
  alternado1: "",
  alternado2: "",
  outrasInformacoes: "",
  autonomia: "",
  pessoasABordo: "",
  radioEmergencia: "",
  sobrevivencia: "",
  coletes: "",
  botes: "",
  corAeronave: "",
  observacoes: "",
  piloto: "",
};

const ESTEIRA_POR_TIPO: Record<string, FormularioIcao["esteira"]> = {
  PISTAO: "L",
  TURBOELICE: "L",
  JATO: "M",
};

export function usePlanoVoo() {
  const [contexto, setContexto] = useState<ContextoVoo | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoVoo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioIcao>(FORMULARIO_INICIAL);

  const [coordenadas, setCoordenadas] = useState<Record<string, { lat: number; lon: number; nome: string }>>({});
  const [rotaAisweb, setRotaAisweb] = useState<RespostaRotas | null>(null);
  const [minutosReserva, setMinutosReserva] = useState(45);
  const [minutosTaxi, setMinutosTaxi] = useState(10);
  const [ventoKt, setVentoKt] = useState(0);
  const [combustivelABordo, setCombustivelABordo] = useState<string>("");

  const atualizar = useCallback(<C extends keyof FormularioIcao>(campo: C, valor: FormularioIcao[C]) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }, []);

  const resetar = useCallback(() => {
    setContexto(null);
    setFormulario({ ...FORMULARIO_INICIAL, dataVoo: new Date().toISOString().slice(0, 10) });
    setCoordenadas({});
    setRotaAisweb(null);
    setMinutosReserva(45);
    setMinutosTaxi(10);
    setVentoKt(0);
    setCombustivelABordo("");
    setErro(null);
  }, []);

  useEffect(() => {
    let ativo = true;
    void buscarPainelAgendamento("2000-01-01", "2099-12-31").then((painel) => {
      if (!ativo) return;
      setSugestoes(painel.agendamentos.filter((item) => item.numero_voo).map((item) => ({
        numero_voo: item.numero_voo!,
        origem: item.origem,
        destino: item.destino,
        data_agendada: item.data_agendada,
        status: item.status,
        matricula_registro: item.matricula_registro,
        modelo: item.modelo,
      })));
    }).catch(() => {
      if (ativo) setSugestoes([]);
    });
    return () => { ativo = false; };
  }, []);

  const buscarVoo = useCallback(async (numeroVoo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const painel = await buscarPainelAgendamento("2000-01-01", "2099-12-31");
      const solicitacao = painel.agendamentos.find((item) => item.numero_voo?.toUpperCase() === numeroVoo.trim().toUpperCase());
      if (!solicitacao) throw new Error("Voo não encontrado nas solicitações de reserva.");
      const aeronave = painel.aeronaves.find((item) => item.id === solicitacao.aeronave_id) ?? null;
      const piloto = painel.tripulacao.find((item) => item.id === solicitacao.piloto_id) ?? null;
      const copiloto = painel.tripulacao.find((item) => item.id === solicitacao.copiloto_id) ?? null;
      const contexto: ContextoVoo = {
        solicitacao: {
          id: solicitacao.id,
          numero_voo: solicitacao.numero_voo,
          origem: solicitacao.origem,
          destino: solicitacao.destino,
          data_agendada: solicitacao.data_agendada,
          horario_previsto_agendamento: solicitacao.horario_previsto_agendamento,
          dias_duracao: solicitacao.dias_duracao,
          numero_passageiros: solicitacao.numero_passageiros,
          status: solicitacao.status,
          observacoes: solicitacao.observacoes ?? null,
        },
        aeronave: aeronave ? {
          id: aeronave.id,
          matricula_registro: aeronave.matricula_registro,
          fabricante: aeronave.fabricante,
          modelo: aeronave.modelo,
          tipo_aeronave: aeronave.tipo_aeronave,
          consumo_combustivel: Number(aeronave.consumo_combustivel) || null,
          velocidade_cruzeiro: aeronave.velocidade_cruzeiro,
          performance_velocidade_cruzeiro_kt: aeronave.performance_velocidade_cruzeiro_kt,
          performance_categoria: aeronave.performance_categoria,
          base: aeronave.base,
          ano: aeronave.ano,
        } : null,
        cliente: null,
        cotista: null,
        tripulacao: {
          piloto: piloto ? { id: piloto.id, canac: piloto.canac, nome_completo: piloto.nome_completo, tipo_licenca: piloto.tipo_licenca } : null,
          copiloto: copiloto ? { id: copiloto.id, canac: copiloto.canac, nome_completo: copiloto.nome_completo, tipo_licenca: copiloto.tipo_licenca } : null,
        },
        passageiros: solicitacao.numero_passageiros || 0,
        fonte: "agendamento",
      };
      setContexto(contexto);
      const velocidade = (aeronave?.performance_velocidade_cruzeiro_kt ?? Number(aeronave?.velocidade_cruzeiro)) || null;
      setFormulario((atual) => ({
        ...atual,
        identificacao: solicitacao.numero_voo ?? atual.identificacao,
        adep: solicitacao.origem.toUpperCase(),
        ades: solicitacao.destino.toUpperCase(),
        dataVoo: solicitacao.data_agendada?.slice(0, 10) || atual.dataVoo,
        eobt: (solicitacao.horario_previsto_agendamento ?? "").slice(0, 5),
        tipoAeronave: aeronave?.modelo ?? atual.tipoAeronave,
        esteira: ESTEIRA_POR_TIPO[aeronave?.tipo_aeronave?.toUpperCase() ?? ""] ?? atual.esteira,
        velocidade: velocidade ? `N${String(Math.round(velocidade)).padStart(4, "0")}` : atual.velocidade,
        pessoasABordo: String(solicitacao.numero_passageiros || ""),
        piloto: piloto?.nome_completo ?? atual.piloto,
        outrasInformacoes: aeronave?.matricula_registro
          ? `REG/${aeronave.matricula_registro.replace("-", "")} TYP/${aeronave.modelo ?? ""}`.trim()
          : atual.outrasInformacoes,
      }));
    } catch (e) {
      setContexto(null);
      setErro(e instanceof Error ? e.message : "Falha ao consultar o voo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const icaosDeInteresse = useMemo(
    () =>
      [formulario.adep, formulario.ades, formulario.alternado1, formulario.alternado2]
        .map((v) => v.trim().toUpperCase())
        .filter((v) => /^[A-Z]{4}$/.test(v)),
    [formulario.adep, formulario.ades, formulario.alternado1, formulario.alternado2],
  );

  // Coordenadas dos aeródromos (D1 via Worker)
  useEffect(() => {
    let ativo = true;
    const pendentes = icaosDeInteresse.filter((icao) => !coordenadas[icao]);
    if (!pendentes.length) return;
    (async () => {
      for (const icao of pendentes) {
        try {
          const { aerodromos } = await buscarAerodromos();
          const achado = aerodromos.find((a) => a.id === icao);
          const coord = interpretarCoordenadas(achado?.coordenadas);
          if (ativo && achado && coord) {
            setCoordenadas((atual) => ({ ...atual, [icao]: { ...coord, nome: achado.name } }));
          }
        } catch {
          /* aeródromo sem coordenada cadastrada */
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, [icaosDeInteresse, coordenadas]);

  const consultarRotaAisweb = useCallback(async () => {
    const adep = formulario.adep.toUpperCase();
    const ades = formulario.ades.toUpperCase();
    if (!/^[A-Z]{4}$/.test(adep) || !/^[A-Z]{4}$/.test(ades)) return;
    setCarregando(true);
    setErro(null);
    try {
      const velocidadeConsulta = Number(formulario.velocidade.replace(/[^\d]/g, "")) || Number(contexto?.aeronave?.performance_velocidade_cruzeiro_kt) || Number(contexto?.aeronave?.velocidade_cruzeiro) || 120;
      const consumoConsulta = Number(contexto?.aeronave?.consumo_combustivel) || 36;
      const dados = await calcularPlanoVoo({
        adep,
        ades,
        speed: velocidadeConsulta,
        fuelBurn: consumoConsulta,
        reserveMin: minutosReserva,
        aircraftId: contexto?.aeronave?.id,
      });
      const resposta: RespostaRotas = {
        adep,
        ades,
        routes: [{ route: dados.flightplan.route, source: dados.flightplan.route_source }],
        preferred_available: dados.flightplan.route_source === "AISWEB/DECEA",
        source: dados.flightplan.route_source,
      };
      setRotaAisweb(resposta);
      setCoordenadas((atual) => ({
        ...atual,
        [adep]: { lat: dados.departure.lat, lon: dados.departure.lon, nome: dados.departure.name },
        [ades]: { lat: dados.destination.lat, lon: dados.destination.lon, nome: dados.destination.name },
      }));
      atualizar("rota", dados.flightplan.route);
    } catch (e) {
      setRotaAisweb(null);
      setErro(e instanceof Error ? e.message : "Falha ao consultar rotas.");
    } finally {
      setCarregando(false);
    }
  }, [formulario.adep, formulario.ades, formulario.velocidade, contexto, atualizar, minutosReserva]);

  const pontos: PontoRota[] = useMemo(() => {
    const lista: PontoRota[] = [];
    const adicionar = (icao: string, tipo: PontoRota["tipo"]) => {
      const coord = coordenadas[icao.toUpperCase()];
      if (coord) lista.push({ nome: icao.toUpperCase(), lat: coord.lat, lon: coord.lon, tipo });
    };
    adicionar(formulario.adep, "adep");
    adicionar(formulario.ades, "ades");
    if (formulario.alternado1) adicionar(formulario.alternado1, "alternado");
    if (formulario.alternado2) adicionar(formulario.alternado2, "alternado");
    return lista;
  }, [formulario.adep, formulario.ades, formulario.alternado1, formulario.alternado2, coordenadas]);

  const velocidadeKt = useMemo(() => {
    const numerico = Number(formulario.velocidade.replace(/[^\d]/g, ""));
    if (numerico > 0) return numerico;
    const perf = contexto?.aeronave?.performance_velocidade_cruzeiro_kt;
    if (perf) return Number(perf);
    const cadastrada = contexto?.aeronave?.velocidade_cruzeiro;
    return cadastrada ? Number(cadastrada) : 0;
  }, [formulario.velocidade, contexto]);

  const velocidadeSolo = Math.max(velocidadeKt - ventoKt, 1);

  const segmentos: Segmento[] = useMemo(() => {
    const principais = pontos.filter((p) => p.tipo === "adep" || p.tipo === "ades");
    const lista: Segmento[] = [];
    principais.forEach((ponto, indice) => {
      const anterior = principais[indice - 1];
      if (!anterior) {
        lista.push({
          seq: 1,
          de: ponto.nome,
          para: ponto.nome,
          lat: ponto.lat,
          lon: ponto.lon,
          distanciaNM: 0,
          distanciaKm: 0,
          proaVerdadeira: 0,
          minutos: 0,
        });
        return;
      }
      const nm = distanciaNM(anterior, ponto);
      lista.push({
        seq: indice + 1,
        de: anterior.nome,
        para: ponto.nome,
        lat: ponto.lat,
        lon: ponto.lon,
        distanciaNM: nm,
        distanciaKm: distanciaKm(anterior, ponto),
        proaVerdadeira: proaVerdadeira(anterior, ponto),
        minutos: tempoMinutos(nm, velocidadeSolo),
      });
    });
    return lista;
  }, [pontos, velocidadeSolo]);

  const distanciaTotalNM = segmentos.reduce((soma, s) => soma + s.distanciaNM, 0);
  const minutosVoo = segmentos.reduce((soma, s) => soma + (s.minutos ?? 0), 0);

  const consumoHora = Number(contexto?.aeronave?.consumo_combustivel ?? 0);
  const combustivel = useMemo(
    () =>
      calcularCombustivel({
        minutosVoo,
        consumoPorHora: consumoHora,
        minutosReserva,
        minutosTaxi,
        combustivelABordo: combustivelABordo ? Number(combustivelABordo) : undefined,
      }),
    [minutosVoo, consumoHora, minutosReserva, minutosTaxi, combustivelABordo],
  );

  // EET e autonomia em HH:MM alimentam os itens 16 e 19 do FPL
  useEffect(() => {
    if (minutosVoo > 0) {
      const h = Math.floor(minutosVoo / 60);
      const m = Math.round(minutosVoo % 60);
      setFormulario((atual) => ({ ...atual, eet: `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}` }));
    }
  }, [minutosVoo]);

  return {
    contexto,
    sugestoes,
    carregando,
    erro,
    formulario,
    atualizar,
    resetar,
    buscarVoo,
    coordenadas,
    pontos,
    segmentos,
    distanciaTotalNM,
    minutosVoo,
    velocidadeKt,
    velocidadeSolo,
    ventoKt,
    setVentoKt,
    minutosReserva,
    setMinutosReserva,
    minutosTaxi,
    setMinutosTaxi,
    combustivelABordo,
    setCombustivelABordo,
    combustivel,
    consumoHora,
    rotaAisweb,
    consultarRotaAisweb,
    horaMinutoParaMinutos,
  };
}
