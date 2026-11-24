import type { ConfiguracaoPesoBalanceamento, PontoEnvelopePeso } from "@/lib/colaborador-api";

type Fase = "decolagem" | "pouso" | "zero_fuel";
type PontoFase = { fase: Fase; rotulo: string; peso: number; cg: number; dentroEnvelope: boolean; dentroPeso: boolean };
const fmt = (valor: number, casas = 1) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function pontosEnvelope(
  config: Pick<ConfiguracaoPesoBalanceamento, "envelope_pontos" | "envelope_pontos_json"> | null,
): PontoEnvelopePeso[] {
  const entrada = config?.envelope_pontos ?? config?.envelope_pontos_json;
  let valor: unknown = entrada;
  if (typeof entrada === "string") {
    try {
      valor = JSON.parse(entrada);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(valor)) return [];
  if (
    valor.some((item) => item?.peso_kg == null || item.peso_kg === "" || item?.cg_estacao == null || item.cg_estacao === "")
  )
    return [];
  return valor
    .map((item) => ({ peso_kg: Number(item?.peso_kg), cg_estacao: Number(item?.cg_estacao) }))
    .filter((item) => Number.isFinite(item.peso_kg) && item.peso_kg > 0 && Number.isFinite(item.cg_estacao));
}

export function envelopeGeometriaValida(vertices: PontoEnvelopePeso[]) {
  if (vertices.length < 3 || new Set(vertices.map((ponto) => `${ponto.cg_estacao}:${ponto.peso_kg}`)).size < 3) return false;
  const areaDobrada = vertices.reduce((soma, ponto, indice) => {
    const proximo = vertices[(indice + 1) % vertices.length];
    return soma + ponto.cg_estacao * proximo.peso_kg - proximo.cg_estacao * ponto.peso_kg;
  }, 0);
  return Math.abs(areaDobrada) >= 1e-6;
}

export function GraficoEnvelope({
  pontos,
  fases = [],
  avaliavel,
  motivo,
  pesoVazio,
  titulo = "Envelope de centro de gravidade",
}: {
  pontos: PontoEnvelopePeso[];
  fases?: PontoFase[];
  avaliavel: boolean;
  motivo?: string;
  pesoVazio?: { peso: number; cg: number };
  titulo?: string;
}) {
  const largura = 660;
  const altura = 340;
  const margem = { esquerda: 66, direita: 24, topo: 24, baixo: 54 };
  if (!envelopeGeometriaValida(pontos))
    return (
      <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold">{titulo}</h3>
        <p className="mt-3 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          {motivo || "Cadastre os vértices do envelope de peso e CG da matrícula para exibir o gráfico."}
        </p>
      </section>
    );
  const fasesValidas = fases.filter((fase) => Number.isFinite(fase.cg) && Number.isFinite(fase.peso));
  const vazio =
    pesoVazio && Number.isFinite(pesoVazio.cg) && Number.isFinite(pesoVazio.peso) && pesoVazio.peso > 0
      ? pesoVazio
      : undefined;
  const xs = [...pontos.map((p) => p.cg_estacao), ...fasesValidas.map((p) => p.cg), ...(vazio ? [vazio.cg] : [])];
  const ys = [...pontos.map((p) => p.peso_kg), ...fasesValidas.map((p) => p.peso), ...(vazio ? [vazio.peso] : [])];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = Math.max((xMax - xMin) * 0.12, 0.15);
  const yPad = Math.max((yMax - yMin) * 0.12, 20);
  const domainXMin = xMin - xPad;
  const domainXMax = xMax + xPad;
  const domainYMin = Math.max(0, yMin - yPad);
  const domainYMax = yMax + yPad;
  const px = (x: number) =>
    margem.esquerda +
    ((x - domainXMin) / Math.max(domainXMax - domainXMin, 1e-6)) * (largura - margem.esquerda - margem.direita);
  const py = (y: number) =>
    altura -
    margem.baixo -
    ((y - domainYMin) / Math.max(domainYMax - domainYMin, 1e-6)) * (altura - margem.topo - margem.baixo);
  const poligono = pontos.map((p) => `${px(p.cg_estacao)},${py(p.peso_kg)}`).join(" ");
  const paleta: Record<Fase, string> = { decolagem: "#38bdf8", pouso: "#fb923c", zero_fuel: "#c084fc" };
  const linhasY = Array.from({ length: 5 }, (_, i) => domainYMin + ((domainYMax - domainYMin) * i) / 4);
  const linhasX = Array.from({ length: 5 }, (_, i) => domainXMin + ((domainXMax - domainXMin) * i) / 4);
  return (
    <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{titulo}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estação do CG no eixo horizontal e peso em kg no eixo vertical
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[9px] font-bold ${avaliavel ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-200"}`}
        >
          {avaliavel ? "Avaliável" : "Não avaliável"}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg
          role="img"
          aria-label="Gráfico bidimensional do envelope de peso e centro de gravidade"
          viewBox={`0 0 ${largura} ${altura}`}
          className="min-w-[420px] w-full"
        >
          <rect
            x={margem.esquerda}
            y={margem.topo}
            width={largura - margem.esquerda - margem.direita}
            height={altura - margem.topo - margem.baixo}
            fill="transparent"
          />
          {linhasY.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={py(v)}
                y2={py(v)}
                stroke="currentColor"
                opacity=".12"
              />
              <text x={margem.esquerda - 8} y={py(v) + 4} textAnchor="end" fill="currentColor" opacity=".65" fontSize="10">
                {fmt(v, 0)}
              </text>
            </g>
          ))}
          {linhasX.map((v) => (
            <g key={`x${v}`}>
              <line x1={px(v)} x2={px(v)} y1={margem.topo} y2={altura - margem.baixo} stroke="currentColor" opacity=".08" />
              <text
                x={px(v)}
                y={altura - margem.baixo + 18}
                textAnchor="middle"
                fill="currentColor"
                opacity=".65"
                fontSize="10"
              >
                {fmt(v, 2)}
              </text>
            </g>
          ))}
          <polygon points={poligono} fill="#268fd0" fillOpacity=".14" stroke="#268fd0" strokeWidth="2.5" />
          {pontos.map((p, i) => (
            <circle key={`v${i}`} cx={px(p.cg_estacao)} cy={py(p.peso_kg)} r="3.5" fill="#268fd0">
              <title>{`Vértice ${i + 1}: ${fmt(p.cg_estacao, 2)} m/estação, ${fmt(p.peso_kg, 1)} kg`}</title>
            </circle>
          ))}
          {vazio && (
            <circle cx={px(vazio.cg)} cy={py(vazio.peso)} r="6" fill="#b97816">
              <title>
                Peso básico vazio: {fmt(vazio.peso)} kg · CG {fmt(vazio.cg, 3)} m
              </title>
            </circle>
          )}
          {fasesValidas.map((fase) => (
            <g key={fase.fase}>
              <circle
                cx={px(fase.cg)}
                cy={py(fase.peso)}
                r="7"
                fill={paleta[fase.fase]}
                stroke={fase.dentroEnvelope && fase.dentroPeso ? "#052e16" : "#7f1d1d"}
                strokeWidth="2"
              >
                <title>{`${fase.rotulo}: ${fmt(fase.cg, 2)} m/estação; ${fmt(fase.peso, 1)} kg — ${fase.dentroEnvelope && fase.dentroPeso ? "dentro" : "fora"}`}</title>
              </circle>
              <text x={px(fase.cg) + 9} y={py(fase.peso) - 8} fill={paleta[fase.fase]} fontSize="10" fontWeight="700">
                {fase.fase === "decolagem" ? "DEP" : fase.fase === "pouso" ? "POU" : "ZFW"}
              </text>
            </g>
          ))}
          <text
            x={(margem.esquerda + largura - margem.direita) / 2}
            y={altura - 10}
            textAnchor="middle"
            fill="currentColor"
            fontSize="11"
          >
            Estação do centro de gravidade (m/estação)
          </text>
          <text
            transform={`translate(16 ${(margem.topo + altura - margem.baixo) / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="currentColor"
            fontSize="11"
          >
            Peso (kg)
          </text>
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground">
        <span className="text-primary">■ Envelope cadastrado</span>
        {vazio && <span className="text-amber-700 dark:text-amber-300">● Peso básico vazio</span>}
        {fasesValidas.map((fase) => (
          <span key={fase.fase}>
            <span style={{ color: paleta[fase.fase] }}>●</span> {fase.rotulo}
          </span>
        ))}
      </div>
      {motivo && <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200">{motivo}</p>}
    </section>
  );
}
