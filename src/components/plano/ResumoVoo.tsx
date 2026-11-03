import { Dado } from "./Secao";
import { formatarData } from "@/lib/format";
import type { ContextoVoo } from "@/lib/tipos";

export function ResumoVoo({ contexto }: { contexto: ContextoVoo }) {
  const { solicitacao, aeronave, cliente, cotista, tripulacao } = contexto;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      <Dado rotulo="Voo" valor={solicitacao.numero_voo ?? "—"} />
      <Dado rotulo="Aeronave" valor={aeronave?.matricula_registro ?? "—"} />
      <Dado rotulo="Modelo" valor={`${aeronave?.fabricante ?? ""} ${aeronave?.modelo ?? ""}`.trim() || "—"} />
      <Dado rotulo="Tipo" valor={aeronave?.tipo_aeronave ?? "—"} />
      <Dado rotulo="Cliente" valor={cliente?.nome ?? "—"} />
      <Dado rotulo="Cotista" valor={cotista?.nome ?? "—"} />
      <Dado rotulo="Código" valor={cotista?.codigo_cliente ?? cliente?.codigo_cliente ?? "—"} />
      <Dado rotulo="Rota" valor={`${solicitacao.origem} → ${solicitacao.destino}`} />
      <Dado
        rotulo="Piloto"
        valor={tripulacao.piloto ? `${tripulacao.piloto.nome_completo ?? ""} · ${tripulacao.piloto.canac ?? ""}` : "—"}
      />
      <Dado
        rotulo="Copiloto"
        valor={tripulacao.copiloto ? `${tripulacao.copiloto.nome_completo ?? ""} · ${tripulacao.copiloto.canac ?? ""}` : "—"}
      />
      <Dado rotulo="Passageiros" valor={contexto.passageiros || "—"} />
      <Dado rotulo="Data" valor={formatarData(solicitacao.data_agendada)} />
      <Dado rotulo="EOBT (UTC)" valor={(solicitacao.horario_previsto_agendamento ?? "—").slice(0, 5)} />
      <Dado rotulo="Status" valor={solicitacao.status ?? "—"} />
    </div>
  );
}
