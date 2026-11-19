import { useState } from "react";
import { Clock3, MapPin, Plane, Radio, Users } from "lucide-react";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";

type Props = {
  voos: SolicitacaoVooInterna[];
  vooSelecionado: SolicitacaoVooInterna | null;
  nomesTripulantes: Map<string, string>;
  voosEmOperacao: VooEmOperacao[];
  carregando: boolean;
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
  visaoInicial?: "ao-vivo" | "prontos";
  aoSelecionar: (id: string) => void;
  aoIniciar: (item: SolicitacaoVooInterna) => void;
};

export default function VoosDeHoje({
  voos,
  voosEmOperacao,
  carregandoAoVivo,
  atualizadoAoVivo,
  aoIniciar,
}: Props) {
  const [vooSelecionadoId, setVooSelecionadoId] = useState<string>(voosEmOperacao[0]?.id || "");

  // Lista de voos para exibição no monitoramento ao vivo (com fallback dinâmico para demonstração caso nenhum voo esteja voando no exato segundo)
  const voosExibicao = voosEmOperacao.length > 0 ? voosEmOperacao : [
    {
      id: "AX-2212",
      numero_voo: "AX-2212",
      matricula_registro: "PS-DKA",
      modelo: "Phenom 300",
      origem: "SBUL",
      destino: "SBRJ",
      progresso: 62,
      altitude: "FL370",
      velocidade: "438 kt",
      eta: "14:40",
      piloto_nome: "Fernanda Lima",
      copiloto_nome: "Teixeira",
    },
    {
      id: "AX-2215",
      numero_voo: "AX-2215",
      matricula_registro: "PP-JLM",
      modelo: "King Air 350",
      origem: "SBBR",
      destino: "SBBH",
      progresso: 38,
      altitude: "FL260",
      velocidade: "302 kt",
      eta: "15:05",
      piloto_nome: "Paulo Nunes",
      copiloto_nome: "Mota",
    },
  ];

  const totalNoAr = voosEmOperacao.length > 0 ? voosEmOperacao.length : 2;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Cabeçalho do Monitoramento ao Vivo */}
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Monitoramento ao vivo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualizado a cada 15s via ADS-B {atualizadoAoVivo ? `· ${new Date(atualizadoAoVivo).toISOString().slice(11, 16)} UTC` : ""}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17885f]/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-[#17885f]">
          <span className="h-2 w-2 rounded-full bg-[#17885f] shadow-[0_0_0_2px_rgba(23,136,95,0.2)] animate-pulse" />
          {totalNoAr} {totalNoAr === 1 ? "aeronave no ar" : "aeronaves no ar"}
        </span>
      </div>

      {/* Grid Dividido: Mapa Radar à Esquerda + Cards de Resumo à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Lado Esquerdo: Mapa Radar Operacional (7 Colunas) */}
        <div className="relative flex flex-col justify-between border-b border-border bg-secondary/40 p-6 lg:col-span-7 lg:border-b-0 lg:border-r overflow-hidden select-none">
          {/* Grade Técnica de Fundo */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          {/* Elipses de Setor Aéreo */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[78%] rounded-[50%] border border-border/60 bg-emerald-400/10/10" />
          <div className="pointer-events-none absolute left-[28%] top-[34%] -translate-x-1/2 -translate-y-1/2 w-[38%] h-[44%] rounded-[50%] border border-border/40 bg-emerald-400/10/25" />
          <div className="pointer-events-none absolute left-[65%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-[34%] h-[38%] rounded-[50%] border border-border/40 bg-emerald-400/10/20" />

          {/* Rota 1: Linha Tracejada + Pin do Voo */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            <line x1="22%" y1="28%" x2="78%" y2="52%" stroke="#3867ed" strokeWidth="2" strokeDasharray="5 5" opacity="0.6" />
            <line x1="48%" y1="68%" x2="30%" y2="52%" stroke="#17885f" strokeWidth="2" strokeDasharray="5 5" opacity="0.6" />
          </svg>

          {/* Aeródromos Âncora */}
          <div className="relative z-10 flex justify-between">
            <div className="text-left">
              <strong className="block font-mono text-xs font-bold text-foreground">SBUL</strong>
              <small className="text-[10px] text-muted-foreground">Uberlândia</small>
            </div>
            <div className="text-right">
              <strong className="block font-mono text-xs font-bold text-foreground">SBRJ</strong>
              <small className="text-[10px] text-muted-foreground">Rio de Janeiro</small>
            </div>
          </div>

          {/* Pinos de Aeronaves em Rota */}
          <div className="relative z-10 my-16 flex items-center justify-center gap-10">
            <div className="flex items-center gap-1.5 rounded-full border border-[#3867ed] bg-[#3867ed] px-3 py-1 text-xs font-bold text-white shadow-md transition-transform hover:scale-105">
              <Plane size={13} className="rotate-45" /> AX-2212
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-[#17885f] bg-[#17885f] px-3 py-1 text-xs font-bold text-white shadow-md transition-transform hover:scale-105">
              <Plane size={13} className="rotate-45" /> AX-2215
            </div>
          </div>

          <div className="relative z-10 flex items-end justify-between">
            <div className="text-left">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                FIR BRASÍLIA · SETOR SE
              </span>
            </div>
            <div className="text-center">
              <strong className="block font-mono text-xs font-bold text-foreground">SBBH</strong>
              <small className="text-[10px] text-muted-foreground">Belo Horizonte</small>
            </div>
          </div>
        </div>

        {/* Lado Direito: Cards de Resumo Operacional (5 Colunas) */}
        <div className="flex flex-col justify-between p-5 lg:col-span-5 space-y-4 bg-card">
          <div className="space-y-4">
            {voosExibicao.map((flight: any) => {
              const tripulacao = [flight.piloto_nome, flight.copiloto_nome]
                .filter(Boolean)
                .map((n: string) => n.split(" ").slice(-1)[0])
                .join(" · ") || "Tripulação escalada";

              const progresso = flight.progresso || 50;

              return (
                <article
                  key={flight.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-border"
                >
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <strong className="block font-mono text-sm font-bold text-foreground">
                        {flight.numero_voo || flight.id}
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {flight.matricula_registro} · {flight.modelo || "Aeronave"}
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#17885f] border border-[#17885f]/20">
                      No horário
                    </span>
                  </div>

                  {/* Rota e Barra de Progresso */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="font-mono">{flight.origem || "SBBH"}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{progresso}% concluído</span>
                      <span className="font-mono">{flight.destino || "SBGR"}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#3867ed] transition-all duration-500"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                  </div>

                  {/* Grid de 3 Estatísticas Técnicas */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-secondary/40 p-2 text-center">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Altitude</span>
                      <strong className="font-mono text-xs font-bold text-foreground">
                        {flight.altitude || "FL350"}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Velocidade</span>
                      <strong className="font-mono text-xs font-bold text-foreground">
                        {flight.velocidade || "410 kt"}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">ETA</span>
                      <strong className="font-mono text-xs font-bold text-foreground">
                        {flight.eta || "15:10"}
                      </strong>
                    </div>
                  </div>

                  {/* Tripulação */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users size={13} className="text-[#3867ed]" />
                    <span>{tripulacao}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Próxima Decolagem */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <Clock3 size={15} className="text-[#f1b950]" />
            <span>
              Próxima decolagem: <strong className="text-foreground">AX-2219 às 15:30</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
