import { ArrowUpRight, Check, Coffee, Loader2, LogIn, LogOut, Undo2 } from "lucide-react";
import "./registro-ponto.css";

type AcaoPonto = "entrada" | "inicio_almoco" | "fim_almoco" | "saida";
type LinhaPonto = Record<string, string> | null;

export default function AcoesRegistroPonto({
  linha,
  ocupado,
  marcando,
  onMarcar,
}: {
  linha: LinhaPonto;
  ocupado: boolean;
  marcando?: string | null;
  onMarcar: (acao: AcaoPonto) => void;
}) {
  const etapas = [
    { acao: "entrada" as const, nome: "Iniciar ponto", icone: LogIn, tom: "entrada",
      horario: linha?.entrada_hora, desabilitado: Boolean(linha?.entrada_hora),
      comando: "Registrar entrada", espera: "Aguardando entrada" },
    { acao: "inicio_almoco" as const, nome: "Iniciar pausa", icone: Coffee, tom: "pausa",
      horario: linha?.inicio_almoco,
      desabilitado: !linha?.entrada_hora || Boolean(linha?.inicio_almoco) || Boolean(linha?.saida_hora),
      comando: "Registrar pausa", espera: "Após a entrada" },
    { acao: "fim_almoco" as const, nome: "Retornar ao trabalho", icone: Undo2, tom: "retorno",
      horario: linha?.fim_almoco,
      desabilitado: !linha?.inicio_almoco || Boolean(linha?.fim_almoco) || Boolean(linha?.saida_hora),
      comando: "Registrar retorno", espera: "Após iniciar a pausa" },
    { acao: "saida" as const, nome: "Registrar saída", icone: LogOut, tom: "saida",
      horario: linha?.saida_hora,
      desabilitado: !linha?.entrada_hora || Boolean(linha?.saida_hora),
      comando: "Encerrar jornada", espera: "Após a entrada" },
  ];
  const proximaAcao = etapas.find((etapa) => !etapa.horario && !etapa.desabilitado)?.acao;
  const estado = linha?.saida_hora ? "Jornada encerrada"
    : linha?.inicio_almoco && !linha?.fim_almoco ? "Em pausa"
    : linha?.entrada_hora ? "Em jornada" : "Pronto para começar";
  const tomEstado = linha?.saida_hora ? "saida"
    : linha?.inicio_almoco && !linha?.fim_almoco ? "pausa" : "entrada";
  return (
    <div className="ponto-registro">
      <p className="ponto-situacao" data-tom={tomEstado} role="status">
        <span aria-hidden="true" />{estado}
      </p>
      <div className="ponto-acoes">
        {etapas.map((etapa) => {
          const Icone = etapa.icone;
          const concluida = Boolean(etapa.horario);
          const proxima = etapa.acao === proximaAcao;
          const registrando = ocupado && marcando === etapa.acao;
          const situacao = registrando ? "Registrando…" : concluida ? "Registrado"
            : linha?.saida_hora ? "Não utilizado" : proxima ? "Próxima ação"
            : etapa.desabilitado ? "Aguardando" : "Disponível";
          return (
            <button key={etapa.acao} type="button" className="ponto-acao"
              data-tom={etapa.tom} data-estado={concluida ? "concluida" : proxima ? "proxima" : etapa.desabilitado ? "aguardando" : "disponivel"}
              aria-label={`${etapa.nome}, ${situacao.toLowerCase()}${concluida ? ` às ${etapa.horario}` : ""}`}
              aria-current={proxima ? "step" : undefined}
              aria-busy={registrando || undefined}
              disabled={ocupado || etapa.desabilitado}
              onClick={() => onMarcar(etapa.acao)}>
              <span className="ponto-acao-topo">
                <span className="ponto-acao-icone"><Icone size={20} aria-hidden="true" /></span>
                <span className="ponto-acao-selo">
                  {concluida && <Check size={12} aria-hidden="true" />}{situacao}
                </span>
              </span>
              <span className="ponto-acao-nome">{etapa.nome}</span>
              <span className="ponto-acao-hora">{etapa.horario || "—:—"}</span>
              <span className="ponto-acao-rodape">
                {registrando ? <><Loader2 size={15} className="ponto-girando" aria-hidden="true" />Registrando…</>
                  : concluida ? "Horário confirmado"
                  : linha?.saida_hora ? "Jornada encerrada"
                  : etapa.desabilitado ? etapa.espera
                  : <>{etapa.comando}<ArrowUpRight size={16} aria-hidden="true" /></>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
