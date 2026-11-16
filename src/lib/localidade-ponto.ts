import { useEffect, useState } from "react";

type RespostaNominatim = {
  address?: Record<string, string>;
};

const cache = new Map<string, Promise<string | null>>();

function buscarCidade(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "10",
    "accept-language": "pt-BR",
  }).toString();
  return fetch(url)
    .then((resposta) => (resposta.ok ? (resposta.json() as Promise<RespostaNominatim>) : null))
    .then((dados) => {
      const endereco = dados?.address;
      if (!endereco) return null;
      const cidade =
        endereco.city ||
        endereco.town ||
        endereco.municipality ||
        endereco.village ||
        endereco.county;
      const uf = endereco["ISO3166-2-lvl4"]?.split("-")[1];
      return [cidade, uf].filter(Boolean).join(" - ") || null;
    })
    .catch(() => null);
}

export function cidadePorCoordenadas(latitude: number, longitude: number) {
  const chave = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  let consulta = cache.get(chave);
  if (!consulta) {
    consulta = buscarCidade(latitude, longitude);
    cache.set(chave, consulta);
  }
  return consulta;
}

export function useLocalidadePonto(latitude?: number | null, longitude?: number | null) {
  const [localidade, setLocalidade] = useState<string | null>(null);
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    let ativo = true;
    void cidadePorCoordenadas(latitude, longitude).then((cidade) => {
      if (ativo)
        setLocalidade(cidade ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    });
    return () => {
      ativo = false;
    };
  }, [latitude, longitude]);
  return localidade;
}
