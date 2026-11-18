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
import { aeronauticoDisponivel, provedorAtivo, provedorContingencia, type EstiloMapa } from "./provedor";
import type { PontoRota } from "@/lib/tipos";

const ESTILOS: { id: EstiloMapa; rotulo: string }[] = [
  { id: "padrao", rotulo: "Mapa" },
  { id: "terreno", rotulo: "Terreno" },
  { id: "satelite", rotulo: "Satélite" },
  { id: "aeronautico", rotulo: "Aeronáutico" },
];

interface Props {
  pontos: PontoRota[];
  velocidadeKt: number;
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

export default function MapaRota({ pontos, velocidadeKt, altura, aoAdicionarPonto }: Props) {
  const [modoPonto, setModoPonto] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const marcadores = useRef<maplibregl.Marker[]>([]);
  const [estilo, setEstilo] = useState<EstiloMapa>("padrao");
  const [reguaAtiva, setReguaAtiva] = useState(false);
  const [meteoAtiva, setMeteoAtiva] = useState(false);
  const [urlRadar, setUrlRadar] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<Coordenada[]>([]);
  const [contingencia, setContingencia] = useState(false);
  const [revisaoEstilo, setRevisaoEstilo] = useState(0);
  const [erroBase, setErroBase] = useState(false);
  const [erroRadar, setErroRadar] = useState(false);
  const estiloPronto = useRef(false);
  const enquadramento = useRef("");
  const estiloAplicado = useRef(`${provedorAtivo().id}:padrao`);
  const acoes = useRef({ reguaAtiva, modoPonto, aoAdicionarPonto });
  acoes.current = { reguaAtiva, modoPonto, aoAdicionarPonto };
  const medir = (ponto: Coordenada) => {
    if (acoes.current.modoPonto && acoes.current.aoAdicionarPonto) acoes.current.aoAdicionarPonto(ponto);
    else if (acoes.current.reguaAtiva) setMedidas(atuais => atuais.length >= 2 ? [ponto] : [...atuais, ponto]);
  };
  const [erroMapa, setErroMapa] = useState<string | null>(null);
  const provedor = useMemo(
    () => (contingencia ? provedorContingencia : provedorAtivo()),
    [contingencia],
  );
  const estiloRef = useRef(estilo);
  estiloRef.current = estilo;
  const classeAltura = altura ?? "h-[60vh] min-h-[360px] sm:h-[520px]";

  // Criação do mapa (uma única vez; o estilo é trocado sem recriar o mapa)
  useEffect(() => {
    const alvo = container.current;
    if (!alvo || mapa.current) return;
    let instancia: MapaLibre;
    try {
      instancia = new maplibregl.Map({
        container: alvo,
        style: provedorAtivo().estilo(estiloRef.current),
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
      if (estiloAplicado.current.startsWith("maptiler:") && estiloRef.current !== "aeronautico") setContingencia(true);
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
    if (!meteoAtiva || urlRadar) return;
    setErroRadar(false);
    let vivo = true;
    caminhoRadar().then((url) => {
      if (vivo) { setUrlRadar(url); setErroRadar(!url); }
    });
    return () => {
      vivo = false;
    };
  }, [meteoAtiva, urlRadar]);

  // Rota, pontos, camadas e medições
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    const desenhar = () => {
      if (!estiloPronto.current) return;
      marcadores.current.forEach((m) => m.remove());
      marcadores.current = [];

      // Radar de precipitação
      if (meteoAtiva && urlRadar) {
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
          });
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
  }, [pontos, medidas, meteoAtiva, urlRadar, revisaoEstilo]);

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
          {!aeronauticoDisponivel && <a href="https://geoaisweb.decea.mil.br/" target="_blank" rel="noopener noreferrer" className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent" title="Abrir cartas aeronáuticas no GeoAISWEB">Cartas AISWEB ↗</a>}
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
          <button
            type="button"
            aria-pressed={meteoAtiva}
            onClick={() => setMeteoAtiva((v) => !v)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              meteoAtiva ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Meteorologia
          </button>
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

      {meteoAtiva && (
        <p className="pointer-events-none absolute right-3 top-16 rounded-md bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          {erroRadar ? "Radar indisponível no momento. Desative e tente novamente." : urlRadar ? "Radar de precipitação (imagem meteorológica pública)" : "Carregando imagem de radar…"}
        </p>
      )}

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
