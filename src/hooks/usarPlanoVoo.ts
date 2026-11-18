import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buscarAerodromos, buscarRotaer, calcularPlanoVoo } from "@/lib/flightplan-api";
import { supabase } from "@/lib/supabase";
import { codigoAerodromoValido, formularioDaPerna, ordenarPernas, pernaInicial, pernaPodePlanejar, guardarRascunho, lerRascunho, localizarAgendamento, vinculosDoAgendamento, horarioFpl, type RascunhoPlano } from "@/lib/plano-voo";
import { buscarPainelAgendamento, buscarPernasPlanoVoo } from "@/lib/colaborador-api";
import {
  calcularCombustivel,
  distanciaKm,
  distanciaNM,
  interpretarCoordenadas,
  proaVerdadeira,
  tempoMinutos,
} from "@/lib/navegacao";
import { chaveNumeroVoo, horaMinutoParaMinutos } from "@/lib/format";
import type {
  ContextoVoo,
  FormularioIcao,
  PontoRota,
  PernaPlanoVoo,
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

  const [pernas, setPernas] = useState<PernaPlanoVoo[]>([]);
  const [pernaSelecionadaId, setPernaSelecionadaId] = useState("");
  const [formulariosPorPerna, setFormulariosPorPerna] = useState<Record<string, FormularioIcao>>({});
  const [consultaAerodromo, setConsultaAerodromo] = useState("");
  const [aerodromoAtivo, setAerodromoAtivo] = useState("");
  const [usuario, setUsuario] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(true);
  const [revisaoVoos, setRevisaoVoos] = useState(0);
  const [revisaoPlano, setRevisaoPlano] = useState(0);
  const consulta = useRef(0);
  const painelRef = useRef<Awaited<ReturnType<typeof buscarPainelAgendamento>> | null>(null);

  const restaurar = useCallback((dados: Partial<RascunhoPlano> | null) => {
    consulta.current += 1;
    setRevisaoPlano(r => r + 1);
    setFormulario({ ...FORMULARIO_INICIAL, dataVoo: new Date().toISOString().slice(0, 10), ...dados?.formulario });
    const contextoSalvo = dados?.contexto;
    const agendamento = painelRef.current?.agendamentos.find(item => item.id === contextoSalvo?.solicitacao.id);
    setContexto(contextoSalvo ? { ...contextoSalvo, ...(agendamento ? vinculosDoAgendamento(agendamento) : {}) } : null);
    setCoordenadas(dados?.coordenadas ?? {});
    setRotaAisweb(dados?.rotaAisweb ?? null);
    setPernas(ordenarPernas(dados?.pernas ?? []));
    setPernaSelecionadaId(dados?.pernaSelecionadaId ?? "");
    setFormulariosPorPerna(dados?.formulariosPorPerna ?? {});
    setMinutosReserva(dados?.minutosReserva ?? 45);
    setMinutosTaxi(dados?.minutosTaxi ?? 10);
    setVentoKt(dados?.ventoKt ?? 0);
    setCombustivelABordo(dados?.combustivelABordo ?? "");
    setConsultaAerodromo(dados?.consultaAerodromo ?? "");
    setAerodromoAtivo(dados?.aerodromoAtivo ?? "");
    setErro(null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    let eventoRecebido = false;
    let usuarioCarregado: string | null | undefined;
    const carregarUsuario = (id: string | null) => {
      if (!ativo || usuarioCarregado === id) return;
      if (usuarioCarregado !== undefined) {
        painelRef.current = null;
        setSugestoes([]);
        setRevisaoVoos(r => r + 1);
      }
      usuarioCarregado = id;
      let dados: Partial<RascunhoPlano> | null = null;
      try { if (id) dados = lerRascunho(window.localStorage, id); } catch { /* Armazenamento indisponível. */ }
      restaurar(dados);
      setUsuario(id);
      setPronto(true);
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (!eventoRecebido) carregarUsuario(data.session?.user.id ?? null);
    }).catch(() => { if (!eventoRecebido) carregarUsuario(null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "TOKEN_REFRESHED" || evento === "USER_UPDATED") return;
      eventoRecebido = true;
      carregarUsuario(sessao?.user.id ?? null);
    });
    return () => { ativo = false; consulta.current += 1; subscription.unsubscribe(); };
  }, [restaurar]);

  useEffect(() => {
    if (!pronto || !usuario) return;
    try { guardarRascunho(window.localStorage, usuario, { pernas, pernaSelecionadaId, formulariosPorPerna, formulario, contexto, coordenadas, rotaAisweb, minutosReserva, minutosTaxi, ventoKt, combustivelABordo, consultaAerodromo, aerodromoAtivo }); } catch { /* O formulário continua disponível sem armazenamento local. */ }
  }, [pronto, usuario, pernas, pernaSelecionadaId, formulariosPorPerna, formulario, contexto, coordenadas, rotaAisweb, minutosReserva, minutosTaxi, ventoKt, combustivelABordo, consultaAerodromo, aerodromoAtivo]);

  const atualizar = useCallback(<C extends keyof FormularioIcao>(campo: C, valor: FormularioIcao[C]) => {
    if (campo === "adep" || campo === "ades") {
      consulta.current += 1;
      setCarregando(false);
      setRotaAisweb(null);
    }
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }, []);

  const resetar = useCallback(() => restaurar(null), [restaurar]);
  const abrirSalvo = useCallback((payload: Record<string, any>) => {
    restaurar({
      ...payload,
      formulario: { ...FORMULARIO_INICIAL, identificacao: payload.numero_voo ?? "", adep: payload.adep ?? "", ades: payload.ades ?? "", dataVoo: payload.data_voo ?? FORMULARIO_INICIAL.dataVoo, eobt: payload.eobt ?? "", ...payload.form },
      rotaAisweb: payload.rota ?? null,
    });
  }, [restaurar]);

  useEffect(() => {
    let ativo = true;
    setCarregandoSugestoes(true);
    void buscarPainelAgendamento("2000-01-01", "2099-12-31").then((painel) => {
      if (!ativo) return;
      painelRef.current = painel;
      setContexto(atual => {
        const agendamento = painel.agendamentos.find(item => item.id === atual?.solicitacao.id);
        return atual && agendamento ? { ...atual, ...vinculosDoAgendamento(agendamento) } : atual;
      });
      setSugestoes(painel.agendamentos.filter((item) => item.numero_voo).sort((a, b) => a.numero_voo!.localeCompare(b.numero_voo!, "pt-BR", { numeric: true, sensitivity: "base" })).map((item) => ({
        id: item.id,
        cliente: item.cliente_razao_social || item.socio_nome,
        numero_voo: item.numero_voo!,
        origem: item.origem,
        destino: item.destino,
        data_agendada: item.data_agendada,
        status: item.status,
        matricula_registro: item.matricula_registro,
        modelo: item.modelo,
      })));
    }).catch(() => {
      if (ativo) { setSugestoes([]); setErro("Não foi possível carregar a lista de voos. Tente novamente."); }
    }).finally(() => { if (ativo) setCarregandoSugestoes(false); });
    return () => { ativo = false; };
  }, [revisaoVoos]);

  const buscarVoo = useCallback(async (numeroVoo: string) => {
    const sequencia = ++consulta.current;
    setCarregando(true);
    setErro(null);
    try {
      const painel = painelRef.current ?? await buscarPainelAgendamento("2000-01-01", "2099-12-31").catch(() => { throw new Error("Não foi possível consultar os voos. Tente novamente."); });
      if (sequencia !== consulta.current) return;
      const solicitacao = localizarAgendamento(painel.agendamentos, numeroVoo);
      const dadosPernas = await buscarPernasPlanoVoo(solicitacao.id).catch(() => { throw new Error("Não foi possível carregar os trechos deste voo. Tente buscar novamente."); });
      if (sequencia !== consulta.current) return;
      const pernasDoVoo = ordenarPernas(dadosPernas.pernas);
      const selecionada = pernaInicial(pernasDoVoo);
      if (pernasDoVoo.length && !selecionada) throw new Error("Os trechos deste voo estão cancelados ou com origem e destino incompletos. Revise as pernas cadastradas.");
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
        ...vinculosDoAgendamento(solicitacao),
        tripulacao: {
          piloto: piloto ? { id: piloto.id, canac: piloto.canac, nome_completo: piloto.nome_completo, tipo_licenca: piloto.tipo_licenca } : null,
          copiloto: copiloto ? { id: copiloto.id, canac: copiloto.canac, nome_completo: copiloto.nome_completo, tipo_licenca: copiloto.tipo_licenca } : null,
        },
        passageiros: solicitacao.numero_passageiros || 0,
        fonte: "agendamento",
      };
      setContexto(contexto);
      const velocidade = (aeronave?.performance_velocidade_cruzeiro_kt ?? Number(aeronave?.velocidade_cruzeiro)) || null;
      const horario = horarioFpl(solicitacao.horario_previsto_agendamento, solicitacao.data_agendada?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      const atual = { ...FORMULARIO_INICIAL };
      setRotaAisweb(null);
      setConsultaAerodromo("");
      setAerodromoAtivo("");
      const base: FormularioIcao = {
        ...atual,
        identificacao: solicitacao.numero_voo ?? atual.identificacao,
        adep: solicitacao.origem.toUpperCase(),
        ades: solicitacao.destino.toUpperCase(),
        dataVoo: horario.data,
        eobt: horario.hora,
        tipoAeronave: aeronave?.modelo ?? atual.tipoAeronave,
        esteira: ESTEIRA_POR_TIPO[aeronave?.tipo_aeronave?.toUpperCase() ?? ""] ?? atual.esteira,
        velocidade: velocidade ? `N${String(Math.round(velocidade)).padStart(4, "0")}` : atual.velocidade,
        pessoasABordo: String(solicitacao.numero_passageiros || ""),
        piloto: piloto?.nome_completo ?? atual.piloto,
        outrasInformacoes: aeronave?.matricula_registro
          ? `REG/${aeronave.matricula_registro.replace("-", "")} TYP/${aeronave.modelo ?? ""}`.trim()
          : atual.outrasInformacoes,
      };
      setPernas(pernasDoVoo);
      setPernaSelecionadaId(selecionada?.id ?? "");
      setFormulariosPorPerna({});
      setFormulario(selecionada ? formularioDaPerna(base, selecionada, pernasDoVoo[0]?.id === selecionada.id && selecionada.data.slice(0, 10) === solicitacao.data_agendada.slice(0, 10) ? solicitacao.horario_previsto_agendamento : null) : base);
    } catch (e) {
      if (sequencia !== consulta.current) return;
      setErro(e instanceof Error ? e.message : "Falha ao consultar o voo.");
    } finally {
      if (sequencia === consulta.current) setCarregando(false);
    }
  }, []);

  const selecionarPerna = useCallback((id: string) => {
    const perna = pernas.find(p => p.id === id);
    if (!perna || !pernaPodePlanejar(perna) || id === pernaSelecionadaId) return;
    consulta.current += 1;
    setCarregando(false);
    setFormulariosPorPerna(atual => ({ ...atual, ...(pernaSelecionadaId ? { [pernaSelecionadaId]: formulario } : {}) }));
    setFormulario(formulariosPorPerna[id] ?? formularioDaPerna(formulario, perna,
      pernas[0]?.id === id && perna.data.slice(0, 10) === contexto?.solicitacao.data_agendada.slice(0, 10) ? contexto?.solicitacao.horario_previsto_agendamento : null));
    setPernaSelecionadaId(id);
    setRotaAisweb(null);
    setConsultaAerodromo("");
    setAerodromoAtivo(perna.origem.trim().toUpperCase());
    setErro(null);
  }, [pernas, pernaSelecionadaId, formulario, formulariosPorPerna, contexto]);

  const icaosDeInteresse = useMemo(
    () =>
      [formulario.adep, formulario.ades, formulario.alternado1, formulario.alternado2]
        .map((v) => v.trim().toUpperCase())
        .filter(codigoAerodromoValido),
    [formulario.adep, formulario.ades, formulario.alternado1, formulario.alternado2],
  );

  // Uma consulta resolve todos os aeródromos, sem cancelar a atualização a cada coordenada.
  useEffect(() => {
    let ativo = true;
    const pendentes = icaosDeInteresse.filter(icao => !coordenadas[icao]);
    if (!pendentes.length) return;
    void (async () => {
      const { aerodromos } = await buscarAerodromos().catch(() => ({ aerodromos: [] }));
      const novas: typeof coordenadas = {};
      await Promise.all(pendentes.map(async icao => {
        const achado = aerodromos.find(a => a.id.toUpperCase() === icao);
        const coord = interpretarCoordenadas(achado?.coordenadas);
        if (achado && coord) { novas[icao] = { ...coord, nome: achado.name }; return; }
        try {
          const { airport } = await buscarRotaer(icao);
          const lat = airport.coordinates?.lat, lon = airport.coordinates?.lng;
          if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) novas[icao] = { lat, lon, nome: airport.name || icao };
        } catch { /* A ficha pode ficar indisponível; não inventa coordenadas. */ }
      }));
      if (ativo) setCoordenadas(atual => ({ ...novas, ...atual }));
    })();
    return () => { ativo = false; };
  }, [icaosDeInteresse, revisaoPlano]);

  const consultarRotaAisweb = useCallback(async (adepInformado?: string, adesInformado?: string) => {
    const adep = (adepInformado ?? formulario.adep).trim().toUpperCase();
    const ades = (adesInformado ?? formulario.ades).trim().toUpperCase();
    if (!codigoAerodromoValido(adep) || !codigoAerodromoValido(ades)) return;
    const sequencia = ++consulta.current;
    setFormulario((atual) => ({ ...atual, adep, ades }));
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
      if (sequencia !== consulta.current) return;
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
      if (sequencia !== consulta.current) return;
      setRotaAisweb(null);
      setErro("Não foi possível consultar a rota. Confira os aeródromos e tente novamente.");
    } finally {
      if (sequencia === consulta.current) setCarregando(false);
    }
  }, [formulario.adep, formulario.ades, formulario.velocidade, contexto, atualizar, minutosReserva]);

  const pontos: PontoRota[] = useMemo(() => {
    const lista: PontoRota[] = [];
    const adicionar = (icao: string, tipo: PontoRota["tipo"]) => {
      const codigo = icao.trim().toUpperCase();
      const coord = coordenadas[codigo];
      if (coord) lista.push({ nome: codigo, lat: coord.lat, lon: coord.lon, tipo });
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
    pronto,
    pernas, pernaSelecionadaId, selecionarPerna, formulariosPorPerna,
    pernaSelecionada: pernas.find(p => p.id === pernaSelecionadaId),
    icaosDoVoo: [...new Set([...icaosDeInteresse, ...pernas.flatMap(p => [p.origem.trim().toUpperCase(), p.destino.trim().toUpperCase()])].filter(codigoAerodromoValido))],
    carregandoSugestoes,
    recarregarVoos: () => setRevisaoVoos(r => r + 1),
    consultaAerodromo, setConsultaAerodromo,
    aerodromoAtivo, setAerodromoAtivo,
    abrirSalvo,
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
