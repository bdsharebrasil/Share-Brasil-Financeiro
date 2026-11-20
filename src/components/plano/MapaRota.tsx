import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapaLibre } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  arcoCirculoMaximo,
  distanciaKm,
  distanciaNM,
  proaVerdadeira,
  tempoMinutos,
  type Coordenada,
} from "@/lib/navegacao";
import { formatarNumero, formatarProa, minutosParaHoraMinuto } from "@/lib/format";
import { aeronauticoDisponivel, provedorContingencia, type EstiloMapa } from "./provedor";
import type { PontoRota } from "@/lib/tipos";
import { CardExpand } from "@/components/ui/card-expand/Component";
import { Checkbox } from "@/components/ui/checkbox";
import { buscarCartas, type ChartResponse } from "@/lib/flightplan-api";

type CamadaMeteorologica = "temperatura" | "nuvens" | "vento" | "chuva" | "pressao" | "visibilidade";

const CAMADAS_METEOROLOGICAS: { id: CamadaMeteorologica; rotulo: string }[] = [
  { id: "temperatura", rotulo: "Temperatura" },
  { id: "nuvens", rotulo: "Nuvens" },
  { id: "vento", rotulo: "Vento" },
  { id: "chuva", rotulo: "Chuva" },
  { id: "pressao", rotulo: "Pressão" },
  { id: "visibilidade", rotulo: "Visibilidade" },
];

const ESTILOS: { id: EstiloMapa; rotulo: string }[] = [
  { id: "padrao", rotulo: "Mapa" },
  { id: "terreno", rotulo: "Terreno" },
  { id: "satelite", rotulo: "Satélite" },
  { id: "aeronautico", rotulo: "Aeronáutico" },
];

interface Props {
  pontos: PontoRota[];
  velocidadeKt: number;
  icaos?: string[];
  /** Classe de altura do mapa (permite mapa maior na consulta rápida). */
  altura?: string;
  /** Quando informado, exibe o botão de incluir pontos clicando no mapa. */
  aoAdicionarPonto?: (coordenada: Coordenada) => void;
}

/** Radar de precipitação público (RainViewer) — usado apenas como camada visual. */
async function caminhoRadar(): Promise<string | null> {
  try {
    const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!r.ok) return null;
    const dados = (await r.json()) as {
      host?: string;
      radar?: { past?: { path: string }[] };
    };
    const quadros = dados.radar?.past ?? [];
    const ultimo = quadros[quadros.length - 1];
    if (!dados.host || !ultimo) return null;
    return `${dados.host}${ultimo.path}/256/{z}/{x}/{y}/2/1_1.png`;
  } catch {
    return null;
  }
}

export default function MapaRota({ pontos, velocidadeKt, altura, aoAdicionarPonto, icaos = [] }: Props) {
  const [modoPonto, setModoPonto] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const marcadores = useRef<maplibregl.Marker[]>([]);
  const [estilo, setEstilo] = useState<EstiloMapa>("padrao");
  const [reguaAtiva, setReguaAtiva] = useState(false);
  const [meteoAtiva, setMeteoAtiva] = useState(false);
  const [camadasMeteorologicas, setCamadasMeteorologicas] = useState<Set<CamadaMeteorologica>>(new Set(["chuva"]));
  const [cartas, setCartas] = useState<ChartResponse[]>([]);
  const [painelAeronautico, setPainelAeronautico] = useState(false);
  const [urlRadar, setUrlRadar] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<Coordenada[]>([]);
  const [revisaoEstilo, setRevisaoEstilo] = useState(0);
  const [erroBase, setErroBase] = useState(false);
  const [erroRadar, setErroRadar] = useState(false);
  const estiloPronto = useRef(false);
  const enquadramento = useRef("");
  const estiloAplicado = useRef(`${provedorContingencia.id}:padrao`);
  const acoes = useRef({ reguaAtiva, modoPonto, aoAdicionarPonto });
  acoes.current = { reguaAtiva, modoPonto, aoAdicionarPonto };
  const medir = (ponto: Coordenada) => {
    if (acoes.current.modoPonto && acoes.current.aoAdicionarPonto) acoes.current.aoAdicionarPonto(ponto);
    else if (acoes.current.reguaAtiva) setMedidas(atuais => atuais.length >= 2 ? [ponto] : [...atuais, ponto]);
  };
  const [erroMapa, setErroMapa] = useState<string | null>(null);
  const provedor = useMemo(() => provedorContingencia, []);
  const estiloRef = useRef(estilo);
  estiloRef.current = estilo;
  const classeAltura = altura ?? "h-[360px] min-h-[280px] sm:h-[390px]";
  const ultimaCamada = useMemo(() => {
    for (const ordem of ["temperatura", "nuvens", "vento", "chuva", "pressao", "visibilidade"] as CamadaMeteorologica[]) {
      if (camadasMeteorologicas.has(ordem)) return ordem;
    }
    return null;
  }, [camadasMeteorologicas]);
  const centroMeteorologico = useMemo(() => {
    if (!pontos.length) return null;
    return {
      lat: pontos.reduce((soma, ponto) => soma + ponto.lat, 0) / pontos.length,
      lon: pontos.reduce((soma, ponto) => soma + ponto.lon, 0) / pontos.length,
    };
  }, [pontos]);
  const overlayWindy: Record<CamadaMeteorologica, string> = {
    temperatura: "temp",
    nuvens: "clouds",
    vento: "wind",
    chuva: "rain",
    pressao: "pressure",
    visibilidade: "visibility",
  };

  // Criação do mapa (uma única vez; o estilo é trocado sem recriar o mapa)
  useEffect(() => {
    const alvo = container.current;
    if (!alvo || mapa.current) return;
    let instancia: MapaLibre;
    try {
      instancia = new maplibregl.Map({
        container: alvo,
        style: provedorContingencia.estilo(estiloRef.current),
        center: [-47.9, -15.8],
        zoom: 3.4,
        attributionControl: { compact: true },
      });
    } catch {
      setErroMapa("Este navegador não conseguiu abrir o mapa (aceleração gráfica indisponível).");
      return;
    }
    instancia.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    instancia.addControl(new maplibregl.FullscreenControl(), "bottom-right");
    instancia.addControl(new maplibregl.ScaleControl({ unit: "nautical" }), "bottom-left");
    instancia.touchZoomRotate.enable();
    instancia.on("style.load", () => {
      estiloPronto.current = true;
      setRevisaoEstilo(atual => atual + 1);
    });
    instancia.on("error", (evento: { sourceId?: string; error?: { message?: string; status?: number } }) => {
      if (evento.sourceId === "radar") { setErroRadar(true); return; }
      if (evento.sourceId && evento.sourceId !== "base" && !/maptiler/i.test(evento.error?.message ?? "")) return;
      setErroBase(true);
    });
    mapa.current = instancia;

    // Garante o tamanho correto quando o cartão termina de abrir
    const observador = new ResizeObserver(() => instancia.resize());
    observador.observe(alvo);

    return () => {
      observador.disconnect();
      marcadores.current.forEach(m => m.remove());
      marcadores.current = [];
      estiloPronto.current = false;
      enquadramento.current = "";
      instancia.remove();
      mapa.current = null;
    };
  }, []);

  // Troca de estilo / provedor
  useEffect(() => {
    if (!icaos.length) { setCartas([]); return; }
    let ativo = true;
    void Promise.all(icaos.slice(0, 3).map((icao) => buscarCartas(icao).catch(() => ({ charts: [] }))))
      .then((respostas) => {
        if (!ativo) return;
        const unicas = new Map<string, ChartResponse>();
        respostas.forEach((resposta) => (resposta.charts || []).forEach((carta) => {
          if (carta.url) unicas.set(carta.url, carta);
        }));
        setCartas([...unicas.values()]);
      });
    return () => { ativo = false; };
  }, [icaos.join("|")]);

  useEffect(() => {
    if (!mapa.current) return;
    const chave = `${provedor.id}:${estilo}`;
    if (estiloAplicado.current === chave) return;
    estiloAplicado.current = chave;
    estiloPronto.current = false;
    setErroBase(false);
    mapa.current.setStyle(provedor.estilo(estilo), { diff: false });
  }, [estilo, provedor]);

  // Camada de meteorologia (radar de precipitação)
  useEffect(() => {
    if (!meteoAtiva || !camadasMeteorologicas.has("chuva") || urlRadar) return;
    setErroRadar(false);
    let vivo = true;
    caminhoRadar().then((url) => {
      if (vivo) { setUrlRadar(url); setErroRadar(!url); }
    });
    return () => {
      vivo = false;
    };
  }, [meteoAtiva, camadasMeteorologicas, urlRadar]);

  // Rota, pontos, camadas e medições
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    const desenhar = () => {
      if (!estiloPronto.current) return;
      marcadores.current.forEach((m) => m.remove());
      marcadores.current = [];

      // Radar de precipitação
      if (meteoAtiva && camadasMeteorologicas.has("chuva") && urlRadar) {
        if (!instancia.getSource("radar")) {
          instancia.addSource("radar", {
            type: "raster",
            tiles: [urlRadar],
            tileSize: 256,
            attribution: "Radar © RainViewer",
          });
          instancia.addLayer({
            id: "radar-camada",
            type: "raster",
            source: "radar",
            paint: { "raster-opacity": 0.6 },
          }, instancia.getLayer("rota-linha") ? "rota-linha" : undefined);
        }
      } else if (instancia.getLayer("radar-camada")) {
        instancia.removeLayer("radar-camada");
        instancia.removeSource("radar");
      }

      const pontosRota = pontos.filter((ponto) => ponto.tipo !== "alternado");
      const linha: [number, number][] = [];
      for (let i = 0; i < pontosRota.length - 1; i += 1) {
        const a = pontosRota[i]!;
        const b = pontosRota[i + 1]!;
        linha.push(...arcoCirculoMaximo(a, b, 48));
      }

      const geojsonRota = {
        type: "FeatureCollection" as const,
        features: linha.length
          ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: linha } }]
          : [],
      };

      const fonteRota = instancia.getSource("rota") as maplibregl.GeoJSONSource | undefined;
      if (fonteRota) fonteRota.setData(geojsonRota);
      else {
        instancia.addSource("rota", { type: "geojson", data: geojsonRota });
        instancia.addLayer({
          id: "rota-linha",
          type: "line",
          source: "rota",
          paint: { "line-color": "#17c3a2", "line-width": 3.5, "line-opacity": 0.95 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }

      const geojsonRegua = {
        type: "FeatureCollection" as const,
        features:
          medidas.length === 2
            ? [
                {
                  type: "Feature" as const,
                  properties: {},
                  geometry: {
                    type: "LineString" as const,
                    coordinates: arcoCirculoMaximo(medidas[0]!, medidas[1]!, 48),
                  },
                },
              ]
            : [],
      };
      const fonteRegua = instancia.getSource("regua") as maplibregl.GeoJSONSource | undefined;
      if (fonteRegua) fonteRegua.setData(geojsonRegua);
      else {
        instancia.addSource("regua", { type: "geojson", data: geojsonRegua });
        instancia.addLayer({
          id: "regua-linha",
          type: "line",
          source: "regua",
          paint: { "line-color": "#f5a524", "line-width": 2.5, "line-dasharray": [2, 1.5] },
        });
      }

      pontos.forEach((ponto) => {
        const el = document.createElement("div");
        el.className = `marcador marcador--${ponto.tipo}`;
        el.textContent = ponto.nome;
        el.style.pointerEvents = "auto";
        el.addEventListener("click", event => { if (acoes.current.reguaAtiva || acoes.current.modoPonto) { event.stopPropagation(); medir(ponto); } });
        const marcador = new maplibregl.Marker({ element: el })
          .setLngLat([ponto.lon, ponto.lat])
          .addTo(instancia);
        marcadores.current.push(marcador);
      });

      medidas.forEach((ponto) => {
        const el = document.createElement("div");
        el.className = "marcador marcador--regua";
        el.textContent = medidas.indexOf(ponto) === 0 ? "A" : "B";
        el.style.pointerEvents = "none";
        marcadores.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([ponto.lon, ponto.lat]).addTo(instancia),
        );
      });

    };
    desenhar();
  }, [pontos, medidas, meteoAtiva, camadasMeteorologicas, urlRadar, revisaoEstilo]);

  // A câmera acompanha mudanças da rota, nunca cliques da régua ou troca de estilo.
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia || !estiloPronto.current) return;
    const chave = pontos.map(p => `${p.nome}:${p.lat}:${p.lon}`).join("|");
    if (enquadramento.current === chave) return;
    enquadramento.current = chave;
    if (pontos.length >= 2) {
      const limites = new maplibregl.LngLatBounds();
      pontos.forEach(p => limites.extend([p.lon, p.lat]));
      instancia.fitBounds(limites, { padding: 70, maxZoom: 8, duration: 600 });
    } else if (pontos.length === 1) instancia.easeTo({ center: [pontos[0]!.lon, pontos[0]!.lat], zoom: 9 });
  }, [pontos, revisaoEstilo]);

  // Régua de navegação
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    const aoClicar = (evento: maplibregl.MapMouseEvent) => {
      const ponto = { lat: evento.lngLat.lat, lon: evento.lngLat.lng };
      medir(ponto);
    };
    instancia.on("click", aoClicar);
    if (reguaAtiva || modoPonto) instancia.doubleClickZoom.disable();
    else instancia.doubleClickZoom.enable();
    instancia.getCanvas().style.cursor = reguaAtiva || modoPonto ? "crosshair" : "";
    return () => {
      instancia.off("click", aoClicar);
    };
  }, [reguaAtiva, modoPonto, aoAdicionarPonto]);

  const cartaAeronautica = useMemo(() => {
    return cartas.find((carta) => /WAC|WORLD|MUNDIAL|REA|ACFT/.test(`${carta.tipo || ""} ${carta.title || ""}`.toUpperCase())) || cartas[0] || null;
  }, [cartas]);

  const medicao =
    medidas.length === 2
      ? (() => {
          const nm = distanciaNM(medidas[0]!, medidas[1]!);
          return {
            nm,
            km: distanciaKm(medidas[0]!, medidas[1]!),
            proa: proaVerdadeira(medidas[0]!, medidas[1]!),
            minutos: tempoMinutos(nm, velocidadeKt),
            dLat: medidas[1]!.lat - medidas[0]!.lat,
            dLon: medidas[1]!.lon - medidas[0]!.lon,
          };
        })()
      : null;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-border ${classeAltura}`}>
      <div ref={container} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex flex-wrap gap-1 rounded-lg bg-card/90 p-1 backdrop-blur">
          {ESTILOS.filter(item => item.id !== "aeronautico" || aeronauticoDisponivel).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={estilo === item.id}
              onClick={() => setEstilo(item.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                estilo === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {item.rotulo}
            </button>
          ))}
          {!aeronauticoDisponivel && (
            cartaAeronautica?.url
              ? <button type="button" onClick={() => setPainelAeronautico((ativo) => !ativo)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${painelAeronautico ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>Cartas aeronáuticas</button>
              : <a href="https://geoaisweb.decea.mil.br/" target="_blank" rel="noopener noreferrer" className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent" title="Abrir cartas aeronáuticas no GeoAISWEB">Cartas AISWEB ↗</a>
          )}
        </div>

        <div className="pointer-events-auto flex gap-1 rounded-lg bg-card/90 p-1 backdrop-blur">
          {aoAdicionarPonto && (
            <button
              type="button"
              onClick={() => {
                setModoPonto((v) => !v);
                setReguaAtiva(false);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                modoPonto ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Incluir ponto
            </button>
          )}
          <CardExpand
            label="Camadas meteorológicas"
            className="w-[100px] grid-cols-1 gap-0"
            items={[{
              id: "meteorologia",
              title: "Meteorologia",
              summary: <span className={`block text-[10px] ${meteoAtiva ? "text-primary" : "text-muted-foreground"}`}>{meteoAtiva ? `${camadasMeteorologicas.size} camada(s)` : "Desativada"}</span>,
              description: "Escolha quais informações meteorológicas serão exibidas sobre a rota.",
              detail: (
                <div className="grid gap-2 sm:grid-cols-2">
                  {CAMADAS_METEOROLOGICAS.map((camada) => (
                    <label key={camada.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground">
                      <Checkbox
                        checked={camadasMeteorologicas.has(camada.id)}
                        onCheckedChange={(marcada) => {
                          setCamadasMeteorologicas((atuais) => {
                            const proximas = new Set(atuais);
                            if (marcada === true) { proximas.add(camada.id); setMeteoAtiva(true); }
                            else proximas.delete(camada.id);
                            if (proximas.size === 0) setMeteoAtiva(false);
                            return proximas;
                          });
                        }}
                        aria-label={camada.rotulo}
                      />
                      {camada.rotulo}
                    </label>
                  ))}
                </div>
              ),
            }]}
          />
          <button
            type="button"
            aria-pressed={reguaAtiva}
            onClick={() => {
              setReguaAtiva((v) => !v);
              setModoPonto(false);
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              reguaAtiva ? "bg-warning text-warning-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Régua
          </button>
          <button
            type="button"
            onClick={() => setMedidas([])}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            Limpar
          </button>
        </div>
      </div>

      {modoPonto && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-3">
          <p className="rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur">
            Toque no mapa para incluir pontos da rota
          </p>
        </div>
      )}

      {reguaAtiva && medidas.length < 2 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-3">
          <p className="rounded-full bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            {medidas.length ? "Selecione o segundo ponto para medir" : "Selecione dois pontos no mapa para medir"}
          </p>
        </div>
      )}

      {medicao && (
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-card/95 p-3 text-sm backdrop-blur sm:right-auto sm:w-72">
          <Medida rotulo="Distância" valor={`${formatarNumero(medicao.nm)} NM`} />
          <Medida rotulo="Em km" valor={`${formatarNumero(medicao.km)} km`} />
          <Medida rotulo="Proa verdadeira" valor={formatarProa(medicao.proa)} />
          <Medida rotulo="Tempo estimado" valor={minutosParaHoraMinuto(medicao.minutos)} />
          <Medida rotulo="Ponto A · lat, long" valor={`${formatarNumero(medidas[0]!.lat, 4)}, ${formatarNumero(medidas[0]!.lon, 4)}`} />
          <Medida rotulo="Ponto B · lat, long" valor={`${formatarNumero(medidas[1]!.lat, 4)}, ${formatarNumero(medidas[1]!.lon, 4)}`} />
          <Medida rotulo="Δ Lat" valor={`${formatarNumero(medicao.dLat, 3)}°`} />
          <Medida rotulo="Δ Long" valor={`${formatarNumero(medicao.dLon, 3)}°`} />
        </div>
      )}

      {erroBase && !erroMapa && (
        <p role="status" className="absolute left-3 top-24 max-w-[18rem] rounded-md bg-card/95 px-3 py-2 text-xs text-foreground">
          Não foi possível carregar esta base do mapa. Selecione outra visualização.
        </p>
      )}

      {meteoAtiva && ultimaCamada && centroMeteorologico && (
        <div className="absolute bottom-3 right-3 z-[5] hidden w-[min(360px,42vw)] overflow-hidden rounded-lg border border-border bg-card shadow-lg lg:block">
          <iframe
            key={`${ultimaCamada}-${centroMeteorologico.lat}-${centroMeteorologico.lon}`}
            src={`https://embed.windy.com/embed.html?${new URLSearchParams({
              type: "map", location: "coordinates", metricRain: "mm", metricTemp: "°C", metricWind: "kt",
              zoom: "6", overlay: overlayWindy[ultimaCamada], product: "ecmwf", level: "surface",
              lat: String(centroMeteorologico.lat), lon: String(centroMeteorologico.lon),
              detailLat: String(centroMeteorologico.lat), detailLon: String(centroMeteorologico.lon), marker: "true",
            }).toString()}`}
            title={`Camada meteorológica: ${ultimaCamada}`}
            loading="lazy"
            className="h-52 w-full border-0"
          />
        </div>
      )}

      {painelAeronautico && cartaAeronautica?.url && (
        <div className="absolute bottom-3 left-3 right-3 z-[5] max-w-xl rounded-lg border border-border bg-card p-3 shadow-lg sm:right-auto">
          <p className="text-xs font-bold text-foreground">Carta aeronáutica · AISWEB/DECEA</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{cartaAeronautica.title || cartaAeronautica.tipo || "Carta publicada"}</p>
          <a href={cartaAeronautica.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Abrir carta oficial</a>
        </div>
      )}

      {erroMapa && (
        <div className="absolute inset-0 grid place-items-center bg-card/95 p-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{erroMapa}</p>
        </div>
      )}
    </div>
  );
}

function Medida({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="truncate font-mono text-sm font-semibold text-foreground">{valor}</p>
    </div>
  );
}
