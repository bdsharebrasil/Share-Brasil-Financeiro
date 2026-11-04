import { useEffect, useMemo, useState } from "react";
import { Clock3, Globe, MapPin, Shuffle } from "lucide-react";

/**
 * "Seu período em voo": curiosidades geradas a partir dos lançamentos do diário de bordo.
 *
 * - Recebe as etapas (voos) já filtradas pelo pai: do cotista selecionado ou da aeronave.
 * - As horas vêm do próprio balanço (mesmo número da tabela), para não haver divergência.
 * - Todo acesso a campo do voo passa por `lerVoo`. Se o nome de algum campo no seu
 *   objeto for diferente, é SÓ ali que precisa mexer.
 * - Renderiza dentro de `.bcp` (herda as variáveis --bcp-*).
 */

const NM_EM_KM = 1.852;
const CIRCUNFERENCIA_TERRA_KM = 40075;
const SAO_PAULO_RIO_KM = 360;

type Unidade = "km" | "nm";

type VooLido = {
  chave: string;
  origem: string;
  destino: string;
  trecho: string;
  distanciaNm: number;
  horas: number;
  horasNoturnas: number;
  pousos: number;
};

type Props = {
  voos: unknown[];
  /** Horas totais do período (decimal), as mesmas exibidas no comparativo mensal. */
  horas: number | null;
  /** Texto do período, ex.: "janeiro de 2026". */
  periodo: string;
  /** Aeródromos (ICAO) que não devem entrar no ranking de destinos, ex.: a base. */
  ignorarAerodromos?: string[];
};

const numero = (valor: unknown) => {
  const convertido =
    typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};

const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";

function escolher(registro: Record<string, unknown>, ...chaves: string[]) {
  for (const chave of chaves) {
    const valor = registro[chave];
    if (valor !== undefined && valor !== null && valor !== "") return valor;
  }
  return undefined;
}

/** Único ponto de acoplamento com o formato dos dados. */
function lerVoo(bruto: unknown, indice: number): VooLido | null {
  if (!bruto || typeof bruto !== "object") return null;
  const v = bruto as Record<string, unknown>;
  return {
    chave: String(escolher(v, "id") ?? `voo-${indice}`),
    origem: texto(
      escolher(v, "aerodromoPartida", "aerodromo_partida", "origem", "partida"),
    ).toUpperCase(),
    destino: texto(
      escolher(v, "aerodromoChegada", "aerodromo_chegada", "destino", "chegada"),
    ).toUpperCase(),
    trecho: texto(escolher(v, "trecho")),
    distanciaNm: numero(escolher(v, "distanciaNm", "distancia_nm", "distancia")),
    horas: numero(
      escolher(v, "tempoVoo", "tempo_voo", "tempoTotal", "tempo_total", "horas"),
    ),
    horasNoturnas: numero(escolher(v, "horasNoturnas", "horas_noturnas")),
    pousos: numero(escolher(v, "pousos", "pousosTotal", "pousos_total")),
  };
}

const formatar = (valor: number, casas = 0) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

function formatarHoras(decimal: number) {
  const total = Math.max(0, decimal);
  let h = Math.floor(total);
  let m = Math.round((total - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

function useContagem(alvo: number, duracao = 900) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    const reduzido =
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      setValor(alvo);
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const progresso = Math.min(1, (agora - inicio) / duracao);
      setValor(alvo * (1 - Math.pow(1 - progresso, 3)));
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracao]);
  return valor;
}

function AnelTerra({ fracao }: { fracao: number }) {
  const raio = 42;
  const circunferencia = 2 * Math.PI * raio;
  const progresso = fracao >= 1 ? fracao % 1 || 1 : fracao;
  return (
    <svg viewBox="0 0 100 100" className="bcp-cur-anel" aria-hidden="true">
      <circle cx="50" cy="50" r={raio} className="bcp-cur-anel-fundo" />
      <circle
        cx="50"
        cy="50"
        r={raio}
        className="bcp-cur-anel-valor"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - Math.min(1, progresso))}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

export function CuriosidadesVooCotista({
  voos,
  horas,
  periodo,
  ignorarAerodromos = [],
}: Props) {
  const [unidade, setUnidade] = useState<Unidade>("km");
  const [indiceFato, setIndiceFato] = useState(0);
  const chaveIgnorados = ignorarAerodromos.join("|");

  const dados = useMemo(() => {
    const lidos = voos
      .map(lerVoo)
      .filter((voo): voo is VooLido => voo !== null);
    const ignorados = new Set(
      chaveIgnorados ? chaveIgnorados.split("|").map((s) => s.toUpperCase()) : [],
    );

    // O trecho já vem como "CUIABÁ x USINAS ITAMARATI": aproveitamos para dar nome ao ICAO.
    const nomes = new Map<string, string>();
    for (const voo of lidos) {
      const partes = voo.trecho.split(/\s+x\s+/i);
      if (partes.length === 2) {
        if (voo.origem && !nomes.has(voo.origem)) nomes.set(voo.origem, partes[0]);
        if (voo.destino && !nomes.has(voo.destino)) nomes.set(voo.destino, partes[1]);
      }
    }

    const visitas = new Map<string, number>();
    for (const voo of lidos) {
      if (!voo.destino || ignorados.has(voo.destino)) continue;
      visitas.set(voo.destino, (visitas.get(voo.destino) ?? 0) + 1);
    }
    const destinos = [...visitas.entries()]
      .map(([icao, quantidade]) => ({
        icao,
        nome: nomes.get(icao) ?? "",
        quantidade,
      }))
      .sort(
        (a, b) => b.quantidade - a.quantidade || a.icao.localeCompare(b.icao),
      )
      .slice(0, 5);

    const distanciaNm = lidos.reduce((s, v) => s + v.distanciaNm, 0);
    const horasVoo = lidos.reduce((s, v) => s + v.horas, 0);
    const horasNoturnas = lidos.reduce((s, v) => s + v.horasNoturnas, 0);
    const pousos = lidos.reduce((s, v) => s + v.pousos, 0);
    const maisLongo = lidos.reduce<VooLido | null>(
      (maior, voo) =>
        voo.distanciaNm > (maior?.distanciaNm ?? 0) ? voo : maior,
      null,
    );

    return {
      quantidade: lidos.length,
      destinos,
      distanciaNm,
      horasVoo,
      horasNoturnas,
      pousos,
      maisLongo,
    };
  }, [voos, chaveIgnorados]);

  const horasExibidas = horas ?? dados.horasVoo;
  const distanciaKm = dados.distanciaNm * NM_EM_KM;
  const distanciaNaUnidade = unidade === "km" ? distanciaKm : dados.distanciaNm;
  const fracaoTerra = distanciaKm / CIRCUNFERENCIA_TERRA_KM;
  const campeao = dados.destinos[0];
  const maximoVisitas = campeao?.quantidade ?? 1;

  const horasAnimadas = useContagem(horasExibidas);
  const distanciaAnimada = useContagem(distanciaNaUnidade);

  const fatos = useMemo(() => {
    const lista: string[] = [];
    const nomeDistancia = (nm: number) =>
      unidade === "km"
        ? `${formatar(nm * NM_EM_KM)} km`
        : `${formatar(nm)} NM`;
    if (dados.maisLongo) {
      const { trecho, origem, destino, distanciaNm } = dados.maisLongo;
      lista.push(
        `Seu trecho mais longo foi ${trecho || `${origem} → ${destino}`}, com ${nomeDistancia(distanciaNm)}.`,
      );
    }
    if (dados.horasVoo > 0 && dados.horasNoturnas > 0) {
      lista.push(
        `${formatar((dados.horasNoturnas / dados.horasVoo) * 100)}% do seu tempo de voo foi à noite.`,
      );
    }
    if (dados.quantidade > 0 && horasExibidas > 0) {
      lista.push(
        `Cada etapa durou em média ${formatarHoras(horasExibidas / dados.quantidade)}.`,
      );
    }
    if (dados.pousos > 0) {
      lista.push(`Foram ${formatar(dados.pousos)} pousos no período.`);
    }
    if (distanciaKm >= SAO_PAULO_RIO_KM) {
      lista.push(
        `Dá ${formatar(distanciaKm / SAO_PAULO_RIO_KM, 1)} vezes o trajeto São Paulo–Rio de Janeiro (≈ ${SAO_PAULO_RIO_KM} km em linha reta).`,
      );
    }
    return lista;
  }, [dados, distanciaKm, horasExibidas, unidade]);

  if (!dados.quantidade && !horasExibidas) return null;

  const fatoAtual = fatos.length ? fatos[indiceFato % fatos.length] : null;
  const voltas = fracaoTerra >= 1;

  return (
    <section className="bcp-cur" aria-label="Seu período em voo">
      <style>{CSS_CURIOSIDADES}</style>
      <header className="bcp-cur-topo">
        <div>
          <span className="bcp-cur-etiqueta">Seu período em voo</span>
          <h3>{periodo}</h3>
        </div>
        <div className="bcp-cur-unidade bcp-no-print" role="group" aria-label="Unidade de distância">
          {(["km", "nm"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unidade === u}
              onClick={() => setUnidade(u)}
            >
              {u === "km" ? "km" : "milhas náuticas"}
            </button>
          ))}
        </div>
      </header>

      <div className="bcp-cur-grade">
        <article className="bcp-cur-card">
          <span className="bcp-cur-icone"><Clock3 size={16} aria-hidden="true" /></span>
          <p className="bcp-cur-rotulo">Tempo de voo</p>
          <strong className="bcp-cur-numero">{formatarHoras(horasAnimadas)}</strong>
          <p className="bcp-cur-legenda">
            {dados.quantidade > 0
              ? `${formatar(dados.quantidade)} ${dados.quantidade === 1 ? "etapa" : "etapas"} · ${formatar(horasExibidas / 24, 1)} dia(s) no ar`
              : "Sem etapas detalhadas no período"}
          </p>
        </article>

        <article className="bcp-cur-card">
          <span className="bcp-cur-icone"><Globe size={16} aria-hidden="true" /></span>
          <p className="bcp-cur-rotulo">Distância percorrida</p>
          {distanciaKm > 0 ? (
            <div className="bcp-cur-distancia">
              <div>
                <strong className="bcp-cur-numero">
                  {formatar(distanciaAnimada)}
                  <small>{unidade === "km" ? " km" : " NM"}</small>
                </strong>
                <p className="bcp-cur-legenda">
                  {voltas
                    ? `${formatar(fracaoTerra, 1)} voltas ao redor da Terra`
                    : `${formatar(fracaoTerra * 100, 1)}% de uma volta ao redor da Terra`}
                </p>
              </div>
              <div className="bcp-cur-anel-caixa">
                <AnelTerra fracao={fracaoTerra} />
                <span>{voltas ? `${formatar(fracaoTerra, 1)}×` : `${formatar(fracaoTerra * 100)}%`}</span>
              </div>
            </div>
          ) : (
            <p className="bcp-cur-legenda">Nenhuma distância registrada nas etapas deste período.</p>
          )}
        </article>

        <article className="bcp-cur-card">
          <span className="bcp-cur-icone"><MapPin size={16} aria-hidden="true" /></span>
          <p className="bcp-cur-rotulo">Destino mais visitado</p>
          {campeao ? (
            <>
              <strong className="bcp-cur-destino">{campeao.nome || campeao.icao}</strong>
              <p className="bcp-cur-legenda">
                {campeao.nome ? `${campeao.icao} · ` : ""}
                {campeao.quantidade} {campeao.quantidade === 1 ? "pouso" : "pousos"}
              </p>
              {dados.destinos.length > 1 && (
                <ol className="bcp-cur-ranking">
                  {dados.destinos.slice(1).map((d, i) => (
                    <li key={d.icao}>
                      <span className="bcp-cur-posicao">{i + 2}º</span>
                      <span className="bcp-cur-nome" title={d.nome || d.icao}>{d.nome || d.icao}</span>
                      <span className="bcp-cur-barra">
                        <i style={{ width: `${(d.quantidade / maximoVisitas) * 100}%` }} />
                      </span>
                      <span className="bcp-cur-qtd">{d.quantidade}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="bcp-cur-legenda">Sem destinos registrados no período.</p>
          )}
        </article>
      </div>

      {fatoAtual && (
        <footer className="bcp-cur-fato" aria-live="polite">
          <p><b>Você sabia?</b> {fatoAtual}</p>
          {fatos.length > 1 && (
            <button
              type="button"
              className="bcp-no-print"
              onClick={() => setIndiceFato((atual) => atual + 1)}
            >
              <Shuffle size={13} aria-hidden="true" /> Outra curiosidade
            </button>
          )}
        </footer>
      )}
    </section>
  );
}

const CSS_CURIOSIDADES = `
.bcp .bcp-cur{border:1px solid var(--bcp-border);border-radius:14px;background:var(--bcp-card);padding:18px;display:flex;flex-direction:column;gap:16px;min-width:0}
.bcp .bcp-cur-topo{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.bcp .bcp-cur-etiqueta{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--bcp-heading)}
.bcp .bcp-cur-topo h3{font-size:18px;font-weight:650;margin-top:3px;text-transform:capitalize}
.bcp .bcp-cur-unidade{display:inline-flex;padding:3px;border-radius:9px;background:var(--bcp-soft);gap:2px}
.bcp .bcp-cur-unidade button{border:0;background:none;padding:6px 11px;border-radius:7px;font-size:12px;color:var(--bcp-muted)}
.bcp .bcp-cur-unidade button[aria-pressed="true"]{background:var(--bcp-card);color:var(--bcp-fg);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.bcp .bcp-cur-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.bcp .bcp-cur-card{position:relative;display:flex;flex-direction:column;gap:4px;min-width:0;padding:16px;border-radius:12px;background:var(--bcp-soft)}
.bcp .bcp-cur-icone{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--bcp-card);color:var(--bcp-accent);margin-bottom:6px}
.bcp .bcp-cur-rotulo{font-size:12px;color:var(--bcp-muted)}
.bcp .bcp-cur-numero{font-size:30px;line-height:1.15;font-weight:650;letter-spacing:-.6px;font-variant-numeric:tabular-nums}
.bcp .bcp-cur-numero small{font-size:15px;font-weight:500;color:var(--bcp-muted);letter-spacing:0}
.bcp .bcp-cur-destino{font-size:22px;line-height:1.2;font-weight:650;letter-spacing:-.3px;overflow-wrap:anywhere}
.bcp .bcp-cur-legenda{font-size:12px;color:var(--bcp-muted);line-height:1.5}
.bcp .bcp-cur-distancia{display:flex;align-items:center;justify-content:space-between;gap:10px}
.bcp .bcp-cur-anel-caixa{position:relative;width:64px;height:64px;flex-shrink:0}
.bcp .bcp-cur-anel-caixa>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:650;font-variant-numeric:tabular-nums}
.bcp .bcp-cur-anel{width:100%;height:100%}
.bcp .bcp-cur-anel-fundo{fill:none;stroke:var(--bcp-border);stroke-width:8}
.bcp .bcp-cur-anel-valor{fill:none;stroke:var(--bcp-accent);stroke-width:8;stroke-linecap:round}
.bcp .bcp-cur-ranking{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:7px}
.bcp .bcp-cur-ranking li{display:grid;grid-template-columns:22px minmax(0,1fr) 56px 20px;align-items:center;gap:8px;font-size:12px}
.bcp .bcp-cur-posicao{color:var(--bcp-muted);font-size:11px}
.bcp .bcp-cur-nome{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bcp .bcp-cur-barra{height:5px;border-radius:4px;background:var(--bcp-border);overflow:hidden}
.bcp .bcp-cur-barra i{display:block;height:100%;background:var(--bcp-accent);opacity:.65;border-radius:4px}
.bcp .bcp-cur-qtd{text-align:right;color:var(--bcp-muted);font-variant-numeric:tabular-nums}
.bcp .bcp-cur-fato{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:10px;border:1px dashed var(--bcp-border);font-size:13px}
.bcp .bcp-cur-fato p{min-width:0;flex:1 1 260px}
.bcp .bcp-cur-fato b{color:var(--bcp-accent);font-weight:600}
.bcp .bcp-cur-fato button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bcp-border);background:var(--bcp-card);border-radius:8px;padding:7px 11px;font-size:12px}
.bcp .bcp-cur-fato button:hover{background:var(--bcp-soft)}
@container(max-width:900px){.bcp .bcp-cur-grade{grid-template-columns:repeat(2,minmax(0,1fr))}.bcp .bcp-cur-grade>:last-child{grid-column:1 / -1}}
@container(max-width:560px){.bcp .bcp-cur{padding:14px}.bcp .bcp-cur-grade{grid-template-columns:minmax(0,1fr)}.bcp .bcp-cur-numero{font-size:26px}}
@media(prefers-reduced-motion:no-preference){.bcp .bcp-cur-anel-valor{transition:stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)}}
`;
