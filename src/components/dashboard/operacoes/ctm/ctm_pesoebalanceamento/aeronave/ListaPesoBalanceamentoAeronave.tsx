import { Pencil, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/dashboard/ComponentesDashboard";
import { type AeronaveAgendamento, type ConfiguracaoPesoBalanceamento, type PontoEnvelopePeso } from "@/lib/colaborador-api";

type Props = { configuracoes: ConfiguracaoPesoBalanceamento[]; aeronaves: AeronaveAgendamento[]; abrir: (config?: ConfiguracaoPesoBalanceamento) => void };
function envelopeDa(config: ConfiguracaoPesoBalanceamento): PontoEnvelopePeso[] {
  let valor: unknown = config.envelope_pontos ?? config.envelope_pontos_json;
  if (typeof valor === "string") { try { valor = JSON.parse(valor); } catch { return []; } }
  return Array.isArray(valor) ? valor.filter((ponto) => Number.isFinite(Number(ponto?.peso_kg)) && Number(ponto.peso_kg) > 0 && Number.isFinite(Number(ponto?.cg_estacao))) : [];
}
function avaliavel(config: ConfiguracaoPesoBalanceamento) {
  return (config.validado === true || config.validado === 1) && envelopeDa(config).length >= 3 && Number(config.mac_comprimento) > 0 && Number(config.lemac_distancia) > 0;
}
export default function ListaPesoBalanceamentoAeronave({ configuracoes, aeronaves, abrir }: Props) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card/65">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex items-center gap-3"><div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary"><Scale size={17} /></div><div><h2 className="text-sm font-extrabold">Peso e Balanceamento da Aeronave</h2><p className="text-[10px] text-muted-foreground">Configuração técnica e envelope específico de cada matrícula.</p></div></div><Button onClick={() => abrir()} className="h-9 gap-2 text-xs"><Plus size={14} /> Nova configuração</Button></div>
    {configuracoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-border text-[9px] uppercase tracking-[.12em] text-muted-foreground"><tr><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Peso vazio</th><th className="px-4 py-3">MTOW</th><th className="px-4 py-3">Limites CG</th><th className="px-4 py-3">Envelope / avaliação</th><th className="px-4 py-3">Responsável técnico</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{configuracoes.map((item) => {
      const pontos = envelopeDa(item);
      const tecnicoOk = avaliavel(item);
      return <tr key={item.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><strong>{item.matricula_registro || aeronaves.find((a) => a.id === item.aeronave_id)?.matricula_registro || "—"}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{item.modelo || "Modelo não informado"}</span></td><td className="px-4 py-3">{Number(item.peso_vazio_padrao).toLocaleString("pt-BR")} kg</td><td className="px-4 py-3">{Number(item.peso_maximo_decolagem).toLocaleString("pt-BR")} kg</td><td className="px-4 py-3">{item.cg_limite_dianteiro} — {item.cg_limite_traseiro}<span className="block text-[9px] text-muted-foreground">m/estação</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${tecnicoOk ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{tecnicoOk ? `Validado · ${pontos.length} vértices` : "Não avaliável/configuração incompleta"}</span>{!tecnicoOk && <span className="mt-1 block text-[9px] text-muted-foreground">{pontos.length} vértice(s) · validado={String(item.validado ?? 0)} · MAC {item.mac_comprimento || "—"} m · LEMAC {item.lemac_distancia || "—"} m</span>}</td><td className="px-4 py-3 text-muted-foreground">{item.responsavel_tecnico || "Não informado"}</td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => abrir(item)} className="h-8 gap-1.5 text-[10px]"><Pencil size={12} /> Editar</Button></td></tr>;
    })}</tbody></table></div> : <EstadoVazio label="Nenhuma configuração cadastrada. Cadastre os dados de AFM/manual/relatório aprovados para a matrícula; não use valores genéricos." />}
  </section>;
}
