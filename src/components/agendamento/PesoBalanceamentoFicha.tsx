import { ACAO_CONCLUIDA, ACAO_A_REALIZAR } from "./agendamentoVisual";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PenLine, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buscarPesoBalanceamentoVoo,
  salvarPesoBalanceamentoVoo,
  type ConfiguracaoPesoBalanceamento,
  type ItemCarregamento,
  type PontoEnvelopePeso,
  type PesoBalanceamentoContexto,
  type SolicitacaoVooInterna,
} from "@/lib/colaborador-api";

const input = "h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
const cell = "min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
type Fase = "decolagem" | "pouso" | "zero_fuel";
type ResultadoFase = { fase: Fase; rotulo: string; peso: number; momento: number; cg: number; dentroEnvelope: boolean; dentroPeso: boolean; limitePeso: number };

const uid = () => Math.random().toString(36).slice(2, 10);
const n = (valor: unknown) => {
  if (valor === null || valor === undefined || String(valor).trim() === "") return NaN;
  const numero = Number(String(valor).replace(",", "."));
  return Number.isFinite(numero) ? numero : NaN;
};
const fmt = (valor: number, casas = 1) => Number.isFinite(valor) ? valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) : "—";
const naoNulo = (valor: number | null | undefined) => valor !== null && valor !== undefined && Number.isFinite(Number(valor));

function pontosEnvelope(config: ConfiguracaoPesoBalanceamento | null): PontoEnvelopePeso[] {
  const entrada = config?.envelope_pontos ?? config?.envelope_pontos_json;
  let valor: unknown = entrada;
  if (typeof entrada === "string") {
    try { valor = JSON.parse(entrada); } catch { return []; }
  }
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => ({ peso_kg: Number(item?.peso_kg), cg_estacao: Number(item?.cg_estacao) }))
    .filter((item) => Number.isFinite(item.peso_kg) && item.peso_kg > 0 && Number.isFinite(item.cg_estacao));
}

function dentroPoligono(ponto: { peso: number; cg: number }, vertices: PontoEnvelopePeso[]) {
  if (vertices.length < 3) return false;
  const x = ponto.cg;
  const y = ponto.peso;
  let dentro = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = { x: vertices[j].cg_estacao, y: vertices[j].peso_kg };
    const b = { x: vertices[i].cg_estacao, y: vertices[i].peso_kg };
    const area = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    const naAresta = Math.abs(area) < 1e-7 && x >= Math.min(a.x, b.x) - 1e-7 && x <= Math.max(a.x, b.x) + 1e-7 && y >= Math.min(a.y, b.y) - 1e-7 && y <= Math.max(a.y, b.y) + 1e-7;
    if (naAresta) return true;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

function envelopeGeometriaValida(vertices: PontoEnvelopePeso[]) {
  if (vertices.length < 3 || new Set(vertices.map((ponto) => `${ponto.cg_estacao}:${ponto.peso_kg}`)).size < 3) return false;
  const areaDobrada = vertices.reduce((soma, ponto, indice) => {
    const proximo = vertices[(indice + 1) % vertices.length];
    return soma + ponto.cg_estacao * proximo.peso_kg - proximo.cg_estacao * ponto.peso_kg;
  }, 0);
  return Math.abs(areaDobrada) >= 1e-6;
}

function problemasConfiguracao(config: ConfiguracaoPesoBalanceamento | null, pontos: PontoEnvelopePeso[]) {
  const problemas: string[] = [];
  if (!config) return ["A aeronave não possui configuração CTM cadastrada."];
  if (!(config.validado === true || config.validado === 1)) problemas.push("A configuração técnica não está validada.");
  if (!Number.isFinite(Number(config.peso_vazio_padrao)) || Number(config.peso_vazio_padrao) <= 0) problemas.push("Peso básico vazio inválido ou ausente.");
  if (!Number.isFinite(Number(config.braco_cg_padrao))) problemas.push("Braço/estação do peso básico ausente.");
  if (!Number.isFinite(Number(config.peso_maximo_decolagem)) || Number(config.peso_maximo_decolagem) <= 0) problemas.push("Peso máximo de decolagem ausente.");
  if (!Number.isFinite(Number(config.peso_maximo_pouso)) || Number(config.peso_maximo_pouso) <= 0) problemas.push("Peso máximo de pouso ausente.");
  if (!Number.isFinite(Number(config.peso_maximo_sem_combustivel)) || Number(config.peso_maximo_sem_combustivel) <= 0) problemas.push("Peso máximo zero combustível ausente.");
  if (!Number.isFinite(Number(config.cg_limite_dianteiro)) || !Number.isFinite(Number(config.cg_limite_traseiro)) || Number(config.cg_limite_dianteiro) >= Number(config.cg_limite_traseiro)) problemas.push("Limites de CG em estação ausentes ou inválidos.");
  if (!Number.isFinite(Number(config.mac_comprimento)) || Number(config.mac_comprimento) <= 0 || !Number.isFinite(Number(config.lemac_distancia)) || Number(config.lemac_distancia) <= 0) problemas.push("MAC/LEMAC inválidos (zero ou ausentes); requer revisão técnica.");
  // MAC e LEMAC iguais a zero identificam configuração técnica ainda não revisada.
  if (pontos.length < 3) problemas.push("Envelope aprovado sem pelo menos 3 vértices válidos.");
  else if (!envelopeGeometriaValida(pontos)) problemas.push("Os vértices do envelope não formam um polígono válido.");
  return problemas;
}

function itensPadrao(passageiros: string[], piloto?: string | null, copiloto?: string | null): ItemCarregamento[] {
  const base: ItemCarregamento[] = [];
  if (piloto) base.push({ id: uid(), descricao: `Piloto · ${piloto}`, peso: null, braco: null });
  if (copiloto) base.push({ id: uid(), descricao: `Copiloto · ${copiloto}`, peso: null, braco: null });
  passageiros.forEach((nome) => base.push({ id: uid(), descricao: nome, categoria: "passageiro", peso: null, braco: null }));
  base.push({ id: uid(), descricao: "Bagagem dianteira", peso: null, braco: null });
  base.push({ id: uid(), descricao: "Bagagem traseira", peso: null, braco: null });
  return base;
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span>{children}</label>;
}

function Limite({ label, valor, unidade = "kg" }: { label: string; valor: number | null | undefined; unidade?: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2"><span className="text-[10px] text-muted-foreground">{label}</span><strong className="text-[11px]">{valor === null || valor === undefined ? "—" : `${fmt(Number(valor), 2)} ${unidade}`}</strong></div>;
}

function GraficoEnvelope({ pontos, fases, avaliavel, motivo }: { pontos: PontoEnvelopePeso[]; fases: ResultadoFase[]; avaliavel: boolean; motivo: string }) {
  const largura = 660; const altura = 340; const margem = { esquerda: 66, direita: 24, topo: 24, baixo: 54 };
  if (!envelopeGeometriaValida(pontos)) return <section className="rounded-2xl border border-border/70 bg-secondary/[.12] p-4"><h3 className="text-xs font-bold">Envelope de peso × estação CG</h3><p className="mt-2 text-[11px] text-amber-200">Não avaliável/configuração incompleta: não há polígono de envelope aprovado válido com pelo menos 3 pontos.</p></section>;
  const fasesValidas = fases.filter((fase) => Number.isFinite(fase.cg) && Number.isFinite(fase.peso));
  const xs = [...pontos.map((p) => p.cg_estacao), ...fasesValidas.map((p) => p.cg)];
  const ys = [...pontos.map((p) => p.peso_kg), ...fasesValidas.map((p) => p.peso)];
  const xMin = Math.min(...xs); const xMax = Math.max(...xs); const yMin = Math.min(...ys); const yMax = Math.max(...ys);
  const xPad = Math.max((xMax - xMin) * 0.12, 0.15); const yPad = Math.max((yMax - yMin) * 0.12, 20);
  const domainXMin = xMin - xPad; const domainXMax = xMax + xPad; const domainYMin = Math.max(0, yMin - yPad); const domainYMax = yMax + yPad;
  const px = (x: number) => margem.esquerda + ((x - domainXMin) / Math.max(domainXMax - domainXMin, 1e-6)) * (largura - margem.esquerda - margem.direita);
  const py = (y: number) => altura - margem.baixo - ((y - domainYMin) / Math.max(domainYMax - domainYMin, 1e-6)) * (altura - margem.topo - margem.baixo);
  const poligono = pontos.map((p) => `${px(p.cg_estacao)},${py(p.peso_kg)}`).join(" ");
  const paleta: Record<Fase, string> = { decolagem: "#38bdf8", pouso: "#fb923c", zero_fuel: "#c084fc" };
  const linhasY = Array.from({ length: 5 }, (_, i) => domainYMin + ((domainYMax - domainYMin) * i) / 4);
  const linhasX = Array.from({ length: 5 }, (_, i) => domainXMin + ((domainXMax - domainXMin) * i) / 4);
  return <section className="rounded-2xl border border-border/70 bg-secondary/[.12] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-bold">Envelope aprovado · estação CG × peso</h3><p className="mt-1 text-[10px] text-muted-foreground">Polígono definido pela documentação aprovada da matrícula. Eixo horizontal: m/estação · vertical: kg.</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${avaliavel ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{avaliavel ? "Avaliável" : "Não avaliável"}</span></div>
    <div className="mt-3 overflow-x-auto"><svg role="img" aria-label="Gráfico bidimensional do envelope de peso e centro de gravidade" viewBox={`0 0 ${largura} ${altura}`} className="min-w-[560px] w-full"><rect x={margem.esquerda} y={margem.topo} width={largura - margem.esquerda - margem.direita} height={altura - margem.topo - margem.baixo} fill="transparent" />
      {linhasY.map((v) => <g key={`y${v}`}><line x1={margem.esquerda} x2={largura - margem.direita} y1={py(v)} y2={py(v)} stroke="currentColor" opacity=".12" /><text x={margem.esquerda - 8} y={py(v) + 4} textAnchor="end" fill="currentColor" opacity=".65" fontSize="10">{fmt(v, 0)}</text></g>)}
      {linhasX.map((v) => <g key={`x${v}`}><line x1={px(v)} x2={px(v)} y1={margem.topo} y2={altura - margem.baixo} stroke="currentColor" opacity=".08" /><text x={px(v)} y={altura - margem.baixo + 18} textAnchor="middle" fill="currentColor" opacity=".65" fontSize="10">{fmt(v, 2)}</text></g>)}
      <polygon points={poligono} fill="#34d399" fillOpacity=".16" stroke="#34d399" strokeWidth="2.5" />
      {pontos.map((p, i) => <circle key={`v${i}`} cx={px(p.cg_estacao)} cy={py(p.peso_kg)} r="3.5" fill="#34d399"><title>{`Vértice ${i + 1}: ${fmt(p.cg_estacao, 2)} m/estação, ${fmt(p.peso_kg, 1)} kg`}</title></circle>)}
      {fasesValidas.map((fase) => <g key={fase.fase}><circle cx={px(fase.cg)} cy={py(fase.peso)} r="7" fill={paleta[fase.fase]} stroke={fase.dentroEnvelope && fase.dentroPeso ? "#052e16" : "#7f1d1d"} strokeWidth="2"><title>{`${fase.rotulo}: ${fmt(fase.cg, 2)} m/estação; ${fmt(fase.peso, 1)} kg — ${fase.dentroEnvelope && fase.dentroPeso ? "dentro" : "fora"}`}</title></circle><text x={px(fase.cg) + 9} y={py(fase.peso) - 8} fill={paleta[fase.fase]} fontSize="10" fontWeight="700">{fase.fase === "decolagem" ? "DEP" : fase.fase === "pouso" ? "POU" : "ZFW"}</text></g>)}
      <text x={(margem.esquerda + largura - margem.direita) / 2} y={altura - 10} textAnchor="middle" fill="currentColor" fontSize="11">Estação do centro de gravidade (m/estação)</text><text transform={`translate(16 ${(margem.topo + altura - margem.baixo) / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize="11">Peso (kg)</text>
    </svg></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground"><span className="text-emerald-300">■ Envelope aprovado</span><span className="text-sky-300">● Decolagem</span><span className="text-orange-300">● Pouso</span><span className="text-purple-300">● Zero combustível</span></div>{motivo && <p className="mt-2 text-[10px] text-amber-200">{motivo}</p>}</section>;
}

function SimulacaoAeronave({ itens, fuelArm, fases }: { itens: ItemCarregamento[]; fuelArm: number; fases: ResultadoFase[] }) {
  const estacoes = [...itens.map((item) => item.braco === null || String(item.braco).trim() === "" ? Number.NaN : n(item.braco)).filter(Number.isFinite), fuelArm].filter(Number.isFinite);
  const fasesValidas = fases.filter((fase) => Number.isFinite(fase.cg) && Number.isFinite(fase.peso));
  if (!estacoes.length) return <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-[10px] text-muted-foreground">Informe as estações para posicionar cargas na simulação da aeronave.</div>;
  const min = Math.min(...estacoes); const max = Math.max(...estacoes); const x = (station: number) => 80 + ((station - min) / Math.max(max - min, 0.01)) * 440;
  return <section className="rounded-2xl border border-border/70 bg-secondary/[.12] p-4"><div><h3 className="text-xs font-bold">Simulação de posições e CG</h3><p className="mt-1 text-[10px] text-muted-foreground">Posições relativas às estações informadas. As marcas de CG mostram a diferença entre fases.</p></div><div className="mt-2 overflow-x-auto"><svg viewBox="0 0 600 160" className="min-w-[500px] w-full" role="img" aria-label="Simulação esquemática de aeronave e posições dos itens carregados"><path d="M52 82 L174 76 L280 78 L408 69 L510 70 L548 78 L510 86 L408 88 L280 84 L174 87 Z" fill="currentColor" opacity=".12" stroke="currentColor" strokeOpacity=".45"/><path d="M262 79 L317 36 L342 37 L326 80 L390 82 L420 71 L434 72 L420 84 L390 86 L326 87 L342 126 L317 127 L262 86 L188 88 L170 99 L159 98 L170 84 L188 77 Z" fill="currentColor" opacity=".18" stroke="currentColor" strokeOpacity=".45"/><path d="M55 80 H548" stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 5"/>
      {itens.filter((item) => Number.isFinite(n(item.braco))).map((item, i) => <g key={item.id}><line x1={x(n(item.braco))} x2={x(n(item.braco))} y1={i % 2 ? 56 : 104} y2="80" stroke="#38bdf8" strokeWidth="1.5"/><circle cx={x(n(item.braco))} cy={80} r="4" fill="#38bdf8"><title>{`${item.descricao} · ${fmt(n(item.braco), 2)} m/estação`}</title></circle><text x={x(n(item.braco))} y={i % 2 ? 51 : 119} textAnchor="middle" fill="currentColor" fontSize="8">{item.descricao.slice(0, 15)}</text></g>)}
      {Number.isFinite(fuelArm) && <g><circle cx={x(fuelArm)} cy="80" r="5" fill="#fbbf24"/><text x={x(fuelArm)} y="66" textAnchor="middle" fill="#fbbf24" fontSize="8">Combustível</text></g>}
      {fasesValidas.map((fase, i) => <g key={fase.fase}><line x1={x(fase.cg)} x2={x(fase.cg)} y1={93 + i * 11} y2={104 + i * 11} stroke={fase.dentroEnvelope && fase.dentroPeso ? "#34d399" : "#f87171"} strokeWidth="3"/><text x={x(fase.cg)} y={140 + i * 6} textAnchor="middle" fill={fase.dentroEnvelope && fase.dentroPeso ? "#34d399" : "#f87171"} fontSize="8">{fase.fase === "decolagem" ? "DEP" : fase.fase === "pouso" ? "POU" : "ZFW"} CG {fmt(fase.cg, 2)}</text></g>)}
    </svg></div></section>;
}

export default function PesoBalanceamentoFicha({ item, aberto: abertoControlado, aoAlterarAberto }: { item: SolicitacaoVooInterna; aberto?: boolean; aoAlterarAberto?: (aberto: boolean) => void }) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoControlado ?? abertoInterno;
  const setAberto = aoAlterarAberto ?? setAbertoInterno;
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [contexto, setContexto] = useState<PesoBalanceamentoContexto | null>(null);
  const [itens, setItens] = useState<ItemCarregamento[]>([]);
  const [litros, setLitros] = useState("");
  const [combustivelKgEntrada, setCombustivelKgEntrada] = useState("");
  const [consumoPrevisto, setConsumoPrevisto] = useState("");
  const [bracoFuel, setBracoFuel] = useState("");
  const [pesoVazio, setPesoVazio] = useState("");
  const [bracoVazio, setBracoVazio] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [assinatura, setAssinatura] = useState("");

  const ficha = contexto?.ficha ?? null;
  const somenteLeitura = ficha?.status === "FINALIZADA";
  const config = contexto?.configuracao ?? null;
  const passageiros = contexto?.solicitacao.passageiros ?? item.passageiros ?? [];
  const envelope = useMemo(() => pontosEnvelope(config), [config]);
  const problemasSetup = useMemo(() => problemasConfiguracao(config, envelope), [config, envelope]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setCarregando(true);
    setErro("");
    buscarPesoBalanceamentoVoo(item.id)
      .then((dados) => {
        if (!ativo) return;
        setContexto(dados);
        const salva = dados.ficha;
        setPesoVazio(String(dados.configuracao?.peso_vazio_padrao ?? ""));
        setBracoVazio(String(dados.configuracao?.braco_cg_padrao ?? ""));
        setLitros(salva?.fuel_litros != null ? String(salva.fuel_litros) : "");
        setCombustivelKgEntrada(salva?.fuel_kg != null ? String(salva.fuel_kg) : "");
        setConsumoPrevisto(String((salva?.snapshot_limites?.consumo_estimado_combustivel_kg as number | string | undefined) ?? ""));
        setBracoFuel(salva?.fuel_braco != null ? String(salva.fuel_braco) : "");
        setObservacoes(salva?.observacoes ?? "");
        setAssinatura(salva?.assinatura_nome ?? dados.piloto?.nome ?? "");
        const nomes = dados.solicitacao.passageiros ?? item.passageiros ?? [];
        if (salva?.itens_carregamento?.length) {
          let indicePassageiro = 0;
          const linhas = salva.itens_carregamento.map((linha) => {
            const descricao = String(linha.descricao ?? "");
            const passageiro = String(linha.categoria ?? "").toLowerCase() === "passageiro" || /^Passageiro(?::|\s)/i.test(descricao);
            if (!passageiro) return linha;
            const descricaoLegada = descricao.replace(/^Passageiro(?::|\s)+/i, "").trim();
            const nome = nomes.find((nomeAtual) => nomeAtual.toLocaleLowerCase("pt-BR") === descricaoLegada.toLocaleLowerCase("pt-BR")) || nomes[indicePassageiro];
            indicePassageiro += 1;
            return { ...linha, categoria: "passageiro", descricao: nome || descricaoLegada };
          });
          setItens(linhas);
        } else {
          setItens(itensPadrao(nomes, dados.piloto?.nome, dados.copiloto?.nome));
        }
      })
      .catch((causa) => { if (ativo) setErro(causa instanceof Error ? causa.message : "Não foi possível carregar a ficha."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [aberto, item.id, item.passageiros]);

  const fuelKg = combustivelKgEntrada.trim() ? n(combustivelKgEntrada) : Number.NaN;
  const vazioPeso = pesoVazio.trim() ? n(pesoVazio) : Number.NaN;
  const vazioArm = bracoVazio.trim() ? n(bracoVazio) : Number.NaN;
  const fuelArmValue = bracoFuel.trim() ? n(bracoFuel) : Number.NaN;
  const momentoVazio = vazioPeso * vazioArm;
  const pesoItens = itens.reduce((soma, linha) => { const peso = linha.peso === null || String(linha.peso).trim() === "" ? Number.NaN : n(linha.peso); return soma + (Number.isFinite(peso) ? peso : 0); }, 0);
  const momentoItens = itens.reduce((soma, linha) => { const peso = linha.peso === null || String(linha.peso).trim() === "" ? Number.NaN : n(linha.peso); const braco = linha.braco === null || String(linha.braco).trim() === "" ? Number.NaN : n(linha.braco); return soma + (Number.isFinite(peso) && Number.isFinite(braco) ? peso * braco : 0); }, 0);
  const fuelConsumido = consumoPrevisto.trim() ? n(consumoPrevisto) : Number.NaN;
  const pesoZfw = vazioPeso + pesoItens;
  const momentoZfw = momentoVazio + momentoItens;
  const pesoDep = pesoZfw + fuelKg;
  const momentoCombustivelDep = Number.isFinite(fuelKg) && fuelKg > 0 && Number.isFinite(fuelArmValue) ? fuelKg * fuelArmValue : 0;
  const momentoDep = momentoZfw + momentoCombustivelDep;
  const pesoPou = pesoDep - fuelConsumido;
  const combustivelPouso = Number.isFinite(fuelKg) && Number.isFinite(fuelConsumido) ? Math.max(0, fuelKg - fuelConsumido) : NaN;
  const momentoPou = momentoZfw + (combustivelPouso > 0 && Number.isFinite(fuelArmValue) ? combustivelPouso * fuelArmValue : 0);
  const litrosOk = !litros.trim() || (Number.isFinite(n(litros)) && n(litros) >= 0);
  const consumivelOk = Number.isFinite(fuelKg) && fuelKg > 0 && Number.isFinite(fuelConsumido) && fuelConsumido >= 0 && fuelConsumido <= fuelKg && litrosOk;

  const resultados = useMemo(() => {
    if (![pesoDep, pesoPou, pesoZfw, momentoDep, momentoPou, momentoZfw].every(Number.isFinite) || pesoDep <= 0 || pesoPou <= 0 || pesoZfw <= 0) return [];
    const decolagem = { fase: "decolagem" as const, rotulo: "Decolagem", peso: pesoDep, momento: momentoDep, cg: momentoDep / pesoDep, limitePeso: Number(config?.peso_maximo_decolagem) };
    const pouso = { fase: "pouso" as const, rotulo: "Pouso", peso: pesoPou, momento: momentoPou, cg: momentoPou / pesoPou, limitePeso: Number(config?.peso_maximo_pouso) };
    const zero = { fase: "zero_fuel" as const, rotulo: "Zero combustível", peso: pesoZfw, momento: momentoZfw, cg: momentoZfw / pesoZfw, limitePeso: Number(config?.peso_maximo_sem_combustivel) };
    return [decolagem, pouso, zero].map((fase) => ({ ...fase, dentroEnvelope: dentroPoligono({ peso: fase.peso, cg: fase.cg }, envelope), dentroPeso: Number.isFinite(fase.limitePeso) && fase.peso <= fase.limitePeso }));
  }, [pesoDep, pesoPou, pesoZfw, momentoDep, momentoPou, momentoZfw, config, envelope]);

  const itensPassageiros = itens.filter((linha) => String(linha.categoria ?? "").toLowerCase() === "passageiro");
  const nomesPendentes = [...passageiros];
  for (const linha of itensPassageiros) {
    const nome = linha.descricao.trim().toLocaleLowerCase("pt-BR");
    const indice = nomesPendentes.findIndex((esperado) => esperado.toLocaleLowerCase("pt-BR") === nome);
    if (indice >= 0) nomesPendentes.splice(indice, 1);
  }
  const passageirosNaFichaOk = nomesPendentes.length === 0 && itensPassageiros.length === passageiros.length && passageiros.length === Number(contexto?.solicitacao.numero_passageiros ?? item.numero_passageiros);
  const itensObrigatoriosPendentes = itens.filter((linha) => {
    const requerido = String(linha.categoria ?? "").toLowerCase() === "passageiro" || /^Piloto(?:\s|$|·)/i.test(linha.descricao) || /^Copiloto(?:\s|$|·)/i.test(linha.descricao) || linha.peso !== null || linha.braco !== null;
    const peso = linha.peso === null || String(linha.peso).trim() === "" ? Number.NaN : n(linha.peso);
    const braco = linha.braco === null || String(linha.braco).trim() === "" ? Number.NaN : n(linha.braco);
    return requerido && (!linha.descricao.trim() || !Number.isFinite(peso) || peso <= 0 || !Number.isFinite(braco));
  });
  const camposOperacionaisPendentes = (litros.trim() !== "" && (!Number.isFinite(n(litros)) || n(litros) < 0)) || (Number.isFinite(fuelKg) && fuelKg > 0 && !Number.isFinite(fuelArmValue)) || !Number.isFinite(vazioPeso) || vazioPeso <= 0 || !Number.isFinite(vazioArm);
  const motivoNaoAvaliavel = problemasSetup.length ? problemasSetup.join(" ") : !passageirosNaFichaOk ? "A lista de passageiros nominados da ficha deve corresponder à solicitação." : itensObrigatoriosPendentes.length ? "Informe peso individual e estação (m/estação) de cada passageiro e tripulante." : !consumivelOk ? "Informe a massa real do combustível e o consumo previsto; o consumo não pode superar o combustível de decolagem." : camposOperacionaisPendentes ? "Informe combustível, consumo estimado e estações necessárias para avaliar todas as fases." : !resultados.length ? "Os dados atuais não permitem calcular as três fases do voo." : "";
  const avaliavel = !motivoNaoAvaliavel && resultados.length === 3;
  const capacidadeFuel = Number(config?.capacidade_combustivel_util);
  const capacidadeFuelOk = !Number.isFinite(capacidadeFuel) || capacidadeFuel <= 0 || fuelKg <= capacidadeFuel;
  const dentroLimites: boolean | null = avaliavel ? resultados.every((fase) => fase.dentroEnvelope && fase.dentroPeso) && capacidadeFuelOk : null;
  const mensagemStatus = dentroLimites === true ? "Dentro do envelope e dos limites de peso em todas as fases" : dentroLimites === false ? (capacidadeFuelOk ? "Fora do envelope ou dos limites de peso" : "Combustível excede a capacidade utilizável") : "Não avaliável/configuração incompleta";

  const atualizarItem = (id: string, campo: keyof ItemCarregamento, valor: string) => setItens((atual) => atual.map((linha) => (linha.id === id ? { ...linha, [campo]: campo === "descricao" ? valor : valor === "" ? null : n(valor) } : linha)));

  const salvar = async (finalizar: boolean) => {
    if (finalizar && dentroLimites !== true) {
      setErro("Não é possível finalizar: a aeronave ou a ficha não está tecnicamente avaliável dentro do envelope aprovado.");
      return;
    }
    if (!config) {
      setErro("Aeronave sem configuração de peso e balanceamento cadastrada no CTM.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const resposta = await salvarPesoBalanceamentoVoo(item.id, {
        peso_balanceamento_id: config.id,
        data_voo: contexto?.solicitacao.data_agendada || item.data_agendada,
        numero_voo: contexto?.solicitacao.numero_voo || item.numero_voo,
        piloto_responsavel: assinatura || contexto?.piloto?.nome || "Piloto",
        assinatura_nome: assinatura || contexto?.piloto?.nome || null,
        peso_vazio_kg: Number.isFinite(vazioPeso) ? vazioPeso : null,
        braco_vazio: Number.isFinite(vazioArm) ? vazioArm : null,
        momento_vazio: Number.isFinite(momentoVazio) ? momentoVazio : null,
        itens_carregamento: itens,
        fuel_litros: litros.trim() && Number.isFinite(n(litros)) ? n(litros) : null,
        fuel_kg: Number.isFinite(fuelKg) ? fuelKg : null,
        fuel_braco: Number.isFinite(fuelArmValue) ? fuelArmValue : null,
        fuel_momento: Number.isFinite(momentoCombustivelDep) ? momentoCombustivelDep : null,
        peso_total_kg: Number.isFinite(pesoDep) ? pesoDep : null,
        momento_total: Number.isFinite(momentoDep) ? momentoDep : null,
        cg_calculado: Number.isFinite(pesoDep) && pesoDep > 0 ? momentoDep / pesoDep : null,
        peso_maximo_decolagem: config.peso_maximo_decolagem,
        peso_maximo_pouso: config.peso_maximo_pouso,
        peso_maximo_sem_combustivel: config.peso_maximo_sem_combustivel,
        cg_limite_dianteiro: config.cg_limite_dianteiro,
        cg_limite_traseiro: config.cg_limite_traseiro,
        dentro_dos_limites: dentroLimites,
        status: finalizar ? "FINALIZADA" : "RASCUNHO",
        snapshot_limites: { ...config, envelope_pontos: envelope, consumo_estimado_combustivel_kg: Number.isFinite(fuelConsumido) ? fuelConsumido : null },
        observacoes,
      });
      setContexto((atual) => (atual ? { ...atual, ficha: resposta.ficha } : atual));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível salvar a ficha.");
    } finally {
      setSalvando(false);
    }
  };

  return <>
    <Button type="button" variant="outline" onClick={() => setAberto(true)} className={cn("h-9 gap-2 text-[11px] font-bold", abertoControlado !== undefined && "hidden", somenteLeitura ? ACAO_CONCLUIDA : [ACAO_A_REALIZAR, "dark:bg-[rgba(2,7,44,0.16)] dark:text-[rgba(176,235,216,1)] dark:border-[rgba(11,34,151,0.63)]"])}><Scale size={13} /> {somenteLeitura ? "Ver ficha concluída" : "Gerar peso e balanceamento"}</Button>
    <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-h-[100dvh] w-full max-w-5xl overscroll-contain overflow-y-auto rounded-t-3xl rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[92dvh] sm:w-[96vw] sm:rounded-2xl sm:p-6">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Scale size={17} className="text-primary" /> Ficha de peso e balanceamento {somenteLeitura && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">Finalizada</span>}</DialogTitle></DialogHeader>
      {carregando ? <div className="flex items-center justify-center gap-2 py-14 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Carregando contexto do voo e da aeronave…</div> : <div className={`space-y-4 ${somenteLeitura ? "pointer-events-none opacity-90" : ""}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Campo label="Aeronave"><input className={input} value={contexto?.solicitacao.matricula_registro || item.matricula_registro || ""} readOnly /></Campo><Campo label="Modelo"><input className={input} value={contexto?.solicitacao.modelo || item.modelo || ""} readOnly /></Campo><Campo label="Data"><input className={input} value={new Date(`${contexto?.solicitacao.data_agendada || item.data_agendada}T00:00:00`).toLocaleDateString("pt-BR")} readOnly /></Campo><Campo label="Piloto"><input className={input} value={contexto?.piloto?.nome || ""} readOnly /></Campo><Campo label="Licença (CANAC)"><input className={input} value={contexto?.piloto?.canac || ""} readOnly /></Campo><Campo label="Voo nº"><input className={input} value={contexto?.solicitacao.numero_voo || item.numero_voo || "Pendente"} readOnly /></Campo></div>
        <section className="rounded-2xl border border-border/70 bg-secondary/[.12] p-4"><strong className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Limites técnicos · CG em estação física</strong><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Limite label="Peso máximo de decolagem" valor={config?.peso_maximo_decolagem} /><Limite label="Peso máximo de pouso" valor={config?.peso_maximo_pouso} /><Limite label="Peso máximo zero combustível" valor={config?.peso_maximo_sem_combustivel} /><Limite label="CG dianteiro" valor={config?.cg_limite_dianteiro} unidade="m/estação" /><Limite label="CG traseiro" valor={config?.cg_limite_traseiro} unidade="m/estação" /><Limite label="Capacidade de combustível utilizável" valor={config?.capacidade_combustivel_util} unidade="kg" /></div><p className="mt-2 text-[9px] text-muted-foreground">CG = momento (kg × m/estação) ÷ peso (kg). A decisão usa o envelope aprovado em peso × estação, sem converter CG em %MAC.</p></section>
        <div className="overflow-x-auto rounded-xl border border-border/70"><table className="w-full min-w-[680px] text-xs"><thead className="bg-secondary/[.18] text-[9px] uppercase tracking-[.12em] text-muted-foreground"><tr><th className="p-2 text-left">Carga / passageiro nominado</th><th className="p-2 text-left">Peso individual (kg)</th><th className="p-2 text-left">Braço / estação (m/estação)</th><th className="p-2 text-right">Momento (kg × m)</th><th /></tr></thead><tbody><tr className="border-t border-border/60"><td className="p-2">Peso básico vazio</td><td className="p-2"><input aria-label="Peso básico vazio em kg" className={cell} value={pesoVazio} readOnly /></td><td className="p-2"><input aria-label="Estação do peso básico vazio em metros" className={cell} value={bracoVazio} readOnly /></td><td className="p-2 text-right font-semibold">{fmt(momentoVazio)}</td><td /></tr><tr className="border-t border-border/60 bg-background/40"><td className="p-2">Combustível de decolagem</td><td className="p-2"><input aria-label="Massa de combustível de decolagem em kg" className={cell} value={combustivelKgEntrada} onChange={(e) => setCombustivelKgEntrada(e.target.value)} placeholder="Massa real (kg)" inputMode="decimal" /><small className="text-[9px] text-muted-foreground">Volume medido (L, opcional):</small><input aria-label="Volume de combustível medido em litros" className={`${cell} mt-1`} value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="Litros" inputMode="decimal" /></td><td className="p-2"><input aria-label="Estação do combustível" className={cell} value={bracoFuel} onChange={(e) => setBracoFuel(e.target.value)} placeholder="m/estação" inputMode="decimal" /></td><td className="p-2 text-right font-semibold">{fmt(fuelKg * fuelArmValue)}</td><td /></tr>{itens.map((linha) => <tr key={linha.id} className="border-t border-border/60"><td className="p-2"><input aria-label="Descrição nominada da carga" className={cell} value={linha.descricao} readOnly={String(linha.categoria ?? "").toLowerCase() === "passageiro"} onChange={(e) => atualizarItem(linha.id, "descricao", e.target.value)} /></td><td className="p-2"><input aria-label={`Peso individual de ${linha.descricao} em kg`} className={cell} value={linha.peso ?? ""} onChange={(e) => atualizarItem(linha.id, "peso", e.target.value)} placeholder="kg" inputMode="decimal" /></td><td className="p-2"><input aria-label={`Estação de ${linha.descricao}`} className={cell} value={linha.braco ?? ""} onChange={(e) => atualizarItem(linha.id, "braco", e.target.value)} placeholder="m/estação" inputMode="decimal" /></td><td className="p-2 text-right font-semibold">{fmt(n(linha.peso) * n(linha.braco))}</td><td className="p-2 text-right"><button type="button" aria-label={`Excluir ${linha.descricao}`} onClick={() => setItens((atual) => atual.filter((i) => i.id !== linha.id))} className="rounded-lg border border-border p-1.5 text-red-300"><Trash2 size={12} /></button></td></tr>)}</tbody></table></div>
        {!somenteLeitura && <Button type="button" variant="outline" onClick={() => setItens((atual) => [...atual, { id: uid(), descricao: "Nova carga", peso: null, braco: null }])} className="h-8 gap-2 text-[10px]"><Plus size={12} /> Adicionar carga</Button>}
        <div className="grid gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[.04] p-3 sm:grid-cols-3"><Campo label="Consumo previsto até pouso (kg) · informado manualmente"><input className={input} type="number" min="0" step="any" value={consumoPrevisto} onChange={(e) => setConsumoPrevisto(e.target.value)} placeholder="Sem estimativa presumida" /></Campo><div className="text-[10px] text-muted-foreground sm:col-span-2">O peso de pouso e o CG usam o combustível restante após esse consumo. Zero combustível exclui todo o combustível. Informe uma estimativa operacional; o sistema não presume consumo.</div></div>
        <div className="grid gap-2 sm:grid-cols-3">{resultados.map((fase) => <div key={fase.fase} className={`rounded-xl border p-3 ${fase.dentroPeso && fase.dentroEnvelope ? "border-emerald-400/25 bg-emerald-400/[.05]" : "border-red-400/30 bg-red-400/[.06]"}`}><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{fase.rotulo}</p><p className="mt-1 text-xs font-semibold">{fmt(fase.peso)} kg · CG {fmt(fase.cg, 2)} m/estação</p><p className={`mt-1 text-[9px] ${fase.dentroPeso && fase.dentroEnvelope ? "text-emerald-300" : "text-red-200"}`}>{fase.dentroPeso ? "Peso dentro do máximo" : `Peso acima do máximo (${fmt(fase.limitePeso, 0)} kg)`} · {fase.dentroEnvelope ? "dentro do polígono" : "fora do polígono"}</p></div>)}</div>
        <GraficoEnvelope pontos={envelope} fases={resultados} avaliavel={avaliavel} motivo={motivoNaoAvaliavel} />
        <SimulacaoAeronave itens={itens} fuelArm={fuelArmValue} fases={resultados} />
        <div className={`flex flex-col gap-2 rounded-xl border p-3 text-[11px] sm:flex-row sm:items-center sm:justify-between ${dentroLimites === true ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : dentroLimites === false ? "border-red-400/40 bg-red-400/10 text-red-200" : "border-amber-400/40 bg-amber-400/10 text-amber-100"}`}><span className="flex items-center gap-2 font-bold">{dentroLimites === true ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{mensagemStatus}</span><span>Dep {fmt(pesoDep)} kg / CG {fmt(pesoDep > 0 ? momentoDep / pesoDep : NaN, 2)} · Pou {fmt(pesoPou)} kg / CG {fmt(pesoPou > 0 ? momentoPou / pesoPou : NaN, 2)} · ZFW {fmt(pesoZfw)} kg / CG {fmt(pesoZfw > 0 ? momentoZfw / pesoZfw : NaN, 2)}</span></div>
        {problemasSetup.some((texto) => texto.includes("MAC/LEMAC") || texto.includes("validada")) && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-[10px] text-amber-100">A configuração técnica específica da matrícula ainda não foi revisada e validada. O cálculo final fica bloqueado até a inclusão dos dados aprovados e validação do responsável técnico.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><Campo label="Observações"><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações operacionais" className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary" /></Campo><Campo label="Assinatura do tripulante"><input className={input} value={assinatura} onChange={(e) => setAssinatura(e.target.value)} placeholder="Nome do tripulante" /><small className="mt-1 block text-[9px] text-muted-foreground">O uso desta ficha não substitui verificação, julgamento ou assinatura técnica exigida.</small></Campo></div>
        {erro && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-[10px] text-red-200">{erro}</div>}
      </div>}
      {!carregando && <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0">{somenteLeitura ? <Button type="button" variant="outline" onClick={() => setAberto(false)} className="h-9 text-[10px]">Fechar</Button> : <><Button type="button" variant="outline" onClick={() => void salvar(false)} disabled={salvando} className="h-11 w-full gap-2 rounded-xl text-xs sm:w-auto">Salvar rascunho</Button><Button type="button" onClick={() => void salvar(true)} disabled={salvando || dentroLimites !== true} className="h-11 w-full gap-2 rounded-xl text-xs sm:w-auto">{salvando ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} Finalizar e assinar</Button></>}</div>}
    </DialogContent></Dialog>
  </>;
}
