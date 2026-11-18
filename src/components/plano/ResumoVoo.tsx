import { Dado } from "./Secao";
import { formatarData } from "@/lib/format";
import { horarioFpl } from "@/lib/plano-voo";
import type { ContextoVoo, FormularioIcao, PernaPlanoVoo } from "@/lib/tipos";

export function ResumoVoo({ contexto, perna, formulario }: { contexto: ContextoVoo; perna?: PernaPlanoVoo; formulario?: FormularioIcao }) {
  const { solicitacao, aeronave, cliente, cotista, tripulacao } = contexto;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      <Dado rotulo="Voo" valor={solicitacao.numero_voo ?? "—"} />
      <Dado rotulo="Aeronave" valor={aeronave?.matricula_registro ?? "—"} />
      <Dado rotulo="Modelo" valor={`${aeronave?.fabricante ?? ""} ${aeronave?.modelo ?? ""}`.trim() || "—"} />
      <Dado rotulo="Tipo" valor={aeronave?.tipo_aeronave ?? "—"} />
      <Dado rotulo="Cliente" valor={cliente?.nome || cotista?.nome || "—"} />
      <Dado rotulo="Cotista" valor={cotista?.nome ?? "—"} />
      <Dado rotulo="Código" valor={cotista?.codigo_cliente ?? cliente?.codigo_cliente ?? "—"} />
      <Dado rotulo="Rota" valor={`${formulario?.adep || perna?.origem || solicitacao.origem} → ${formulario?.ades || perna?.destino || solicitacao.destino}`} />
      <Dado
        rotulo="Piloto"
        valor={tripulacao.piloto ? `${tripulacao.piloto.nome_completo ?? ""} · ${tripulacao.piloto.canac ?? ""}` : "—"}
      />
      <Dado
        rotulo="Copiloto"
        valor={tripulacao.copiloto ? `${tripulacao.copiloto.nome_completo ?? ""} · ${tripulacao.copiloto.canac ?? ""}` : "—"}
      />
      <Dado rotulo="Passageiros" valor={perna ? perna.numero_passageiros : contexto.passageiros || "—"} />
      <Dado rotulo="Data" valor={formatarData(formulario?.dataVoo || perna?.data || solicitacao.data_agendada)} />
      <Dado rotulo="EOBT (UTC)" valor={(formulario?.eobt ?? horarioFpl(perna ? perna.horario_dep || perna.horario_ac : solicitacao.horario_previsto_agendamento, perna?.data || solicitacao.data_agendada).hora) || "—"} />
      <Dado rotulo="Status" valor={solicitacao.status ?? "—"} />
    </div>
  );
}
