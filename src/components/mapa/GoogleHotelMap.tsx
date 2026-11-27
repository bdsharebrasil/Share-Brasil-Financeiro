import { useEffect, useMemo, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

const DEFAULT_BRASIL_CENTER = { lat: -15.793889, lng: -47.882778 };

export interface GoogleHotelMapProps {
  nome: string;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface LocatedPlace {
  lat: number;
  lng: number;
  title: string;
  formattedAddress?: string;
}

function isQuotaError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
  return (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("OVER_QUERY_LIMIT") ||
    message.includes("QuotaExceeded") ||
    message.includes("429")
  );
}

function HotelMarkerLookup({
  query,
  fallbackTitle,
}: {
  query: string;
  fallbackTitle: string;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const loadingStatus = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [placeInfo, setPlaceInfo] = useState<LocatedPlace | null>(null);
  const [searching, setSearching] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
      setLookupError("Falha de autenticação ou cota no Google Maps Platform.");
      setSearching(false);
    }
  }, [loadingStatus]);

  useEffect(() => {
    if (!placesLib || !query) return;
    let active = true;
    setSearching(true);
    setLookupError(null);

    void placesLib.Place.searchByText({
      textQuery: query,
      fields: ["displayName", "formattedAddress", "location"],
      language: "pt-BR",
      region: "BR",
      maxResultCount: 1,
    })
      .then((response) => {
        if (!active) return;
        const first = response?.places?.[0];
        const loc = first?.location;
        if (!loc) {
          setPlaceInfo(null);
          setLookupError("Localização exata não encontrada para este endereço.");
          return;
        }
        const coords = { lat: loc.lat(), lng: loc.lng() };
        setPlaceInfo({
          ...coords,
          title: first.displayName || fallbackTitle,
          formattedAddress: first.formattedAddress || undefined,
        });
        setInfoOpen(true);
        if (map) {
          map.panTo(coords);
          map.setZoom(15);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isQuotaError(error)) {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
        }
        setPlaceInfo(null);
        setLookupError("Não foi possível localizar o endereço no Google Maps.");
      })
      .finally(() => {
        if (active) setSearching(false);
      });

    return () => {
      active = false;
    };
  }, [placesLib, query, fallbackTitle, map]);

  return (
    <>
      {placeInfo && (
        <>
          <AdvancedMarker
            ref={markerRef}
            position={{ lat: placeInfo.lat, lng: placeInfo.lng }}
            title={placeInfo.title}
            onClick={() => setInfoOpen((prev) => !prev)}
          >
            <Pin
              background="#0969a8"
              borderColor="#074d7d"
              glyphColor="#ffffff"
            />
          </AdvancedMarker>
          {infoOpen && marker && (
            <InfoWindow
              anchor={marker}
              maxWidth={260}
              onCloseClick={() => setInfoOpen(false)}
            >
              <div className="space-y-1 text-slate-900">
                <p className="text-xs font-bold leading-snug">
                  {placeInfo.title}
                </p>
                {placeInfo.formattedAddress && (
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {placeInfo.formattedAddress}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </>
      )}

      {(searching || lookupError) && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <div className="rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            {searching ? "Buscando endereço no Google Maps…" : lookupError}
          </div>
        </div>
      )}
    </>
  );
}

export function GoogleHotelMap({
  nome,
  endereco,
  cidade,
  uf,
}: GoogleHotelMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const query = useMemo(() => {
    const cityPart = [cidade, uf].filter(Boolean).join(" - ");
    return [nome, endereco, cityPart, "Brasil"].filter(Boolean).join(", ");
  }, [nome, endereco, cidade, uf]);

  if (!apiKey) {
    return (
      <div className="flex h-[340px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-center">
        <MapPin className="h-6 w-6 text-primary" />
        <p className="text-sm font-semibold text-foreground">
          Chave do Google Maps não configurada
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Defina <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> no
          ambiente para visualizar a localização do hotel no mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-border bg-secondary/30">
      <APIProvider
        apiKey={apiKey}
        libraries={["places", "marker"]}
        language="pt-BR"
        region="BR"
      >
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={DEFAULT_BRASIL_CENTER}
          defaultZoom={4}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
        >
          <HotelMarkerLookup query={query} fallbackTitle={nome} />
        </GoogleMapView>
      </APIProvider>
    </div>
  );
}
