import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ErroApi } from "@/lib/api";
import {
  calcularCombustivel,
  distanciaKm,
  distanciaNM,
  interpretarCoordenadas,
  proaVerdadeira,
  tempoMinutos,
} from "@/lib/navegacao";
import { horaMinutoParaMinutos } from "@/lib/formato";
import type {
  ContextoVoo,
  FormularioIcao,
  PontoRota,
  RespostaRotas,
  Segmento,
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
  dataVoo: "",
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

export function usarPlanoVoo() {
  const [contexto, setContexto] = useState<ContextoVoo | null>(null);
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

  const buscarVoo = useCallback(async (numeroVoo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await api.contextoVoo(numeroVoo);
      setContexto(dados);
      const aeronave = dados.aeronave;
      const velocidade =
        aeronave?.performance_velocidade_cruzeiro_kt ??
        (aeronave?.velocidade_cruzeiro ? Number(aeronave.velocidade_cruzeiro) : null);
      setFormulario((atual) => ({
        ...atual,
        identificacao: dados.solicitacao.numero_voo ?? atual.identificacao,
        adep: (dados.solicitacao.origem ?? "").toUpperCase(),
        ades: (dados.solicitacao.destino ?? "").toUpperCase(),
        dataVoo: dados.solicitacao.data_agendada?.slice(0, 10) ?? "",
        eobt: (dados.solicitacao.horario_previsto_agendamento ?? "").slice(0, 5),
        tipoAeronave: aeronave?.modelo ?? atual.tipoAeronave,
        esteira: ESTEIRA_POR_TIPO[aeronave?.tipo_aeronave ?? ""] ?? atual.esteira,
        velocidade: velocidade ? `N${String(Math.round(velocidade)).padStart(4, "0")}` : atual.velocidade,
        pessoasABordo: String(dados.passageiros || ""),
        piloto: dados.tripulacao.piloto?.nome_completo ?? atual.piloto,
        outrasInformacoes: aeronave?.matricula_registro
          ? `REG/${aeronave.matricula_registro.replace("-", "")} TYP/${aeronave.modelo ?? ""}`.trim()
          : atual.outrasInformacoes,
      }));
    } catch (e) {
      setContexto(null);
      setErro(
        e instanceof ErroApi && e.status === 404
          ? "Voo não encontrado nas solicitações de reserva."
          : e instanceof ErroApi && e.status === 401
            ? "Sessão não autenticada. Entre no sistema Share Brasil para consultar os voos."
            : e instanceof Error
              ? e.message
              : "Falha ao consultar o voo.",
      );
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
          const { aerodromos } = await api.aerodromos(icao);
          const achado = aerodromos.find((a) => a.id === icao) ?? aerodromos[0];
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
    try {
      const dados = await api.rotas(adep, ades);
      setRotaAisweb(dados);
      const primeira = dados.routes[0];
      if (primeira) atualizar("rota", primeira.route);
    } catch (e) {
      setRotaAisweb(null);
      setErro(e instanceof Error ? e.message : "Falha ao consultar rotas.");
    }
  }, [formulario.adep, formulario.ades, atualizar]);

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
    carregando,
    erro,
    formulario,
    atualizar,
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
