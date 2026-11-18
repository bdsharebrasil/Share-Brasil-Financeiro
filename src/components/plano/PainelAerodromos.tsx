import { useEffect, useMemo, useState } from "react";

import { API_ORIGIN } from "@/lib/api";
import {
  buscarAerodromos,
  buscarCartas,
  buscarClima,
  buscarNotams,
  buscarRotaer,
  buscarSol,
} from "@/lib/flightplan-api";

interface Carta {
  title?: string;
  tipo?: string;
  descricao?: string;
  url?: string;
}

interface Notam {
  id: string;
  number?: string | null;
  type?: string | null;
  message?: string;
  start?: string | null;
  end?: string | null;
}

interface DadosAerodromo {
  meteorologia?: { metar?: string; taf?: string; source?: string } | undefined;
  notams?: Notam[] | undefined;
  cartas?: Carta[] | undefined;
  solar?: { date?: string; sunrise?: string; sunset?: string }[] | undefined;
  ficha?: any;
  erros: string[];
  carregando: boolean;
}

const VAZIO: DadosAerodromo = { erros: [], carregando: true };

function urlCarta(url: string, baixar = false) {
  return `${API_ORIGIN}/api/charts/preview?url=${encodeURIComponent(url)}${baixar ? "&download=1" : ""}`;
}

async function carregar(icao: string): Promise<DadosAerodromo> {
  const erros: string[] = [];
  const tentar = async <T,>(rotulo: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      erros.push(`${rotulo} indisponível no momento. Tente atualizar as informações.`);
      return undefined;
    }
  };

  const [met, notam, cartas, solar, rotaer] = await Promise.all([
    tentar("Meteorologia", () => buscarClima(icao)),
    tentar("NOTAM", () => buscarNotams(icao)),
    tentar("Cartas", () => buscarCartas(icao)),
    tentar("Nascer/pôr do sol", () => buscarSol(icao)),
    tentar("Ficha do aeródromo", () => buscarRotaer(icao)),
  ]);

  return {
    meteorologia: met as DadosAerodromo["meteorologia"],
    notams: ((notam as any)?.notams ?? []) as Notam[],
    cartas: ((cartas as any)?.charts ?? []) as Carta[],
    solar: ((solar as any)?.solar ?? []) as DadosAerodromo["solar"],
    ficha: (rotaer as any)?.airport ?? null,
    erros,
    carregando: false,
  };
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

const CATEGORIAS = ["Todas", "REA", "Visual", "IFR", "Aeródromo", "Outras"] as const;
type Categoria = (typeof CATEGORIAS)[number];

/** Classifica a carta pelo texto publicado pelo AISWEB (sem inventar informação). */
function categoriaCarta(c: Carta): Categoria {
  const t = `${c.tipo ?? ""} ${c.title ?? ""} ${c.descricao ?? ""}`.toUpperCase();
  if (/\bREA\b|ROTA ESPECIAL|ESPECIAL DE AERONAVES/.test(t)) return "REA";
  if (/\bADC\b|\bAPDC\b|\bGMC\b|\bPDC\b|AERODROME CHART|ESTACIONAMENTO|P[ÁA]TIO/.test(t)) return "Aeródromo";
  if (/\bVAC\b|VISUAL|\bVFR\b|\bREH\b|\bCIRCUITO\b/.test(t)) return "Visual";
  if (/\bIAC\b|\bSID\b|\bSTAR\b|\bIFR\b|\bENRC?\b|\bARC\b|\bILS\b|RNAV|\bVOR\b|\bNDB\b|APPROACH|APROXIMA/.test(t))
    return "IFR";
  return "Outras";
}

function textoDetalhe(valor: unknown): string {
  if (valor == null || valor === "") return "";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return String(valor);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

// Dados públicos, com prazo curto e consultas simultâneas compartilhadas entre as abas.
const consultas = new Map<string, { atualizadoEm: number; dados: DadosAerodromo }>();
const pendentes = new Map<string, Promise<DadosAerodromo>>();
async function consultar(icao: string, forcar: boolean) {
  const salvo = consultas.get(icao);
  if (!forcar && salvo && Date.now() - salvo.atualizadoEm < 120_000) return salvo.dados;
  const emCurso = pendentes.get(icao);
  if (emCurso) return emCurso;
  const promessa = carregar(icao).then(dados => {
    consultas.delete(icao);
    consultas.set(icao, { atualizadoEm: Date.now(), dados });
    if (consultas.size > 40) consultas.delete(consultas.keys().next().value!);
    return dados;
  }).finally(() => pendentes.delete(icao));
  pendentes.set(icao, promessa);
  return promessa;
}

export function PainelAerodromos({ icaos, selecionado, aoSelecionar }: { icaos: string[]; selecionado?: string; aoSelecionar?: (icao: string) => void }) {
  const lista = useMemo(() => Array.from(new Set(icaos.map(i => i.trim().toUpperCase()).filter(i => /^[A-Z]{4}$/.test(i)))), [icaos]);
  const [codigo, setCodigo] = useState("");
  const preferido = selecionado ?? codigo;
  const ativo = lista.includes(preferido) ? preferido : lista[0] ?? "";
  const [resultado, setResultado] = useState<{ icao: string; dados: DadosAerodromo } | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [categoria, setCategoria] = useState<Categoria>("Todas");
  const [buscaCarta, setBuscaCarta] = useState("");

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    setResultado({ icao: ativo, dados: VAZIO });
    void consultar(ativo, revisao > 0).then(dados => {
      if (vivo) setResultado({ icao: ativo, dados });
    });
    return () => { vivo = false; };
  }, [ativo, revisao]);

  if (!lista.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Informe ADEP, ADES ou alternados para consultar meteorologia, NOTAM, ficha e cartas.
      </p>
    );
  }

  const dados = resultado?.icao === ativo ? resultado.dados : VAZIO;
  const ficha = dados?.ficha;
  const pistas: any[] = Array.isArray(ficha?.['runways']) ? ficha!['runways'] : [];
  const freqs: any[] = Array.isArray(ficha?.['frequencies']) ? ficha!['frequencies'] : [];
  const rawFicha = ficha?.['raw_data']?.['rotaer'] ?? ficha?.['raw_data'] ?? {};
  const detalhesFicha = [
    ["Restrições", ficha?.['restrictions']],
    ["Procedimentos operacionais", ficha?.['operational']?.['opea']],
    ["Obstáculos", ficha?.['operational']?.['obstacles']],
    ["Iluminação", ficha?.['operational']?.['other_lighting']],
    ["Energia secundária", ficha?.['operational']?.['secondary_power']],
    ["Regulamentos locais", ficha?.['operational']?.['local_regulations']],
    ["Contato", ficha?.['contact']],
    ...Object.entries(rawFicha).filter(([chave, valor]) =>
      !["icao", "icaoCode", "AeroCode", "name", "nome", "city", "cidade", "state", "uf", "elevation", "altitude", "coordinates", "coordenadas", "runways", "pistas", "frequencies", "frequencias"].includes(chave)
      && valor != null && valor !== "",
    ).map(([chave, valor]) => [chave, valor] as [string, unknown]),
  ].map(([rotulo, valor]) => [String(rotulo), textoDetalhe(valor)] as const).filter(([, valor]) => valor);
  const sol = dados?.solar?.[0];
  const termoCarta = buscaCarta.trim().toUpperCase();
  const cartasFiltradas = (dados?.cartas ?? []).filter((c) => {
    const okCategoria = categoria === "Todas" || categoriaCarta(c) === categoria;
    const texto = `${c.tipo ?? ""} ${c.title ?? ""} ${c.descricao ?? ""}`.toUpperCase();
    return okCategoria && (!termoCarta || texto.includes(termoCarta));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {lista.map((icao) => (
          <button
            key={icao}
            type="button"
            aria-pressed={icao === ativo}
            onClick={() => { setCodigo(icao); aoSelecionar?.(icao); setCategoria("Todas"); setBuscaCarta(""); }}
            className={`rounded-lg px-3 py-2 font-mono text-xs font-semibold transition-colors ${
              icao === ativo
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {icao}
          </button>
        ))}
        <button type="button" disabled={dados?.carregando} onClick={() => setRevisao(r => r + 1)} className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Atualizar informações</button>
      </div>

      {dados?.carregando && <p className="text-sm text-muted-foreground">Consultando AISWEB/DECEA…</p>}

      {dados && !dados.carregando && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="METAR · AISWEB/DECEA">
              <p className="break-words font-mono text-xs text-foreground">
                {dados.meteorologia?.metar || "Sem METAR disponível."}
              </p>
            </Bloco>
            <Bloco titulo="TAF · AISWEB/DECEA">
              <p className="break-words font-mono text-xs text-foreground">
                {dados.meteorologia?.taf || "Sem TAF disponível."}
              </p>
            </Bloco>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="Aeródromo">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Nome</dt>
                  <dd className="truncate text-foreground">{ficha?.['name'] ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cidade / UF</dt>
                  <dd className="truncate text-foreground">
                    {[ficha?.['city'], ficha?.['state']].filter(Boolean).join(" / ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Elevação</dt>
                  <dd className="font-mono text-foreground">{ficha?.['elevation'] ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coordenadas</dt>
                  <dd className="font-mono text-foreground">
                    {ficha?.['coordinates']
                      ? `${Number(ficha['coordinates'].lat).toFixed(4)}, ${Number(ficha['coordinates'].lng).toFixed(4)}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nascer do sol</dt>
                  <dd className="font-mono text-foreground">{sol?.sunrise || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pôr do sol</dt>
                  <dd className="font-mono text-foreground">{sol?.sunset || "—"}</dd>
                </div>
              </dl>
            </Bloco>

            <Bloco titulo="Pistas e frequências">
              {pistas.length === 0 && freqs.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem dados de pista publicados na consulta.</p>
              )}
              <ul className="space-y-1 font-mono text-xs text-foreground">
                {pistas.map((p, i) => (
                  <li key={i} className="truncate">
                    {[p?.ident ?? p?.designacao ?? p?.rwy, p?.length ?? p?.comprimento, p?.width ?? p?.largura, p?.surface ?? p?.piso]
                      .filter(Boolean)
                      .join(" · ") || JSON.stringify(p).slice(0, 80)}
                  </li>
                ))}
                {freqs.map((f, i) => (
                  <li key={`f${i}`} className="truncate text-muted-foreground">
                    {[f?.type ?? f?.tipo ?? f?.servico, f?.frequency ?? f?.freq ?? f?.frequencia]
                      .filter(Boolean)
                      .join(" ") || JSON.stringify(f).slice(0, 80)}
                  </li>
                ))}
              </ul>
            </Bloco>
          </div>

          {detalhesFicha.length > 0 && (
            <details className="rounded-lg border border-border bg-background p-3">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">Dados adicionais publicados pelo AISWEB/ROTAER</summary>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {detalhesFicha.map(([rotulo, valor], i) => (
                  <div key={`${rotulo}-${i}`} className="min-w-0 rounded-md border border-border/70 p-2">
                    <dt className="text-[10px] font-semibold uppercase text-muted-foreground">{rotulo}</dt>
                    <dd className="mt-1 break-words whitespace-pre-wrap font-mono text-xs text-foreground">{valor}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <Bloco titulo={`NOTAM (${dados.notams?.length ?? 0})`}>
            {dados.notams?.length ? (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {dados.notams.map((n) => (
                  <li key={n.id} className="rounded border border-border p-2">
                    <p className="font-mono text-[11px] text-primary">
                      {[n.number, n.type].filter(Boolean).join(" · ")}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-xs text-foreground">{n.message}</p>
                    {(n.start || n.end) && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {n.start ?? "—"} → {n.end ?? "—"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum NOTAM em vigor retornado.</p>
            )}
          </Bloco>

          <Bloco titulo={`Cartas (${cartasFiltradas.length} de ${dados.cartas?.length ?? 0})`}>
            <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex flex-wrap gap-1">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoria(cat)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      categoria === cat
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                value={buscaCarta}
                onChange={(e) => setBuscaCarta(e.target.value)}
                placeholder="Pesquisar carta"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary sm:w-48"
              />
            </div>
            {cartasFiltradas.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {cartasFiltradas.map((c, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-border p-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-foreground">{c.title || "Carta"}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {[c.tipo, c.descricao].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {c.url && (
                      <span className="flex shrink-0 gap-1">
                        <a
                          href={urlCarta(c.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
                        >
                          Ver
                        </a>
                        <a
                          href={urlCarta(c.url, true)}
                          className="rounded border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground"
                        >
                          Baixar
                        </a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dados.cartas?.length
                  ? "Nenhuma carta corresponde ao filtro escolhido."
                  : "Nenhuma carta retornada para este aeródromo."}
              </p>
            )}
          </Bloco>

          {dados.erros.length > 0 && (
            <p className="text-[11px] text-muted-foreground">Não retornado pelo AISWEB: {dados.erros.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
