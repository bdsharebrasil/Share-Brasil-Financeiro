import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  Bell,
  Clock3,
  FileCheck2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CabecalhoSecao,
  IndicadorPagina,
} from "@/components/dashboard/ComponentesDashboard";
import EspelhoPonto, { EtiquetaPonto } from "@/components/ponto/EspelhoPonto";
import ConfiguracaoPonto from "@/components/ponto/ConfiguracaoPonto";
import {
  acaoFechamentoPonto,
  baixarAnexoSolicitacaoPonto,
  baixarComprovantePonto,
  capturarLocalizacaoPonto,
  carregarEspelhoPonto,
  carregarGestaoPonto,
  contextoPonto,
  dataPonto,
  decidirSolicitacaoPonto,
  horasPonto,
  mensagemErroPonto,
  registrarPonto,
  rotulosPonto,
  solicitarPonto,
  type ComprovantePonto,
  type ContextoPonto,
  type EspelhoPonto as DadosEspelho,
  type MembroPonto,
  type SolicitacaoPonto,
} from "@/lib/ponto-api";
const campo =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground";
const painel = "rounded-xl border border-border bg-card p-4";
type Aba = "meu" | "vivo" | "pedidos" | "configuracao" | "fechamento";
export default function PontoProfissional({
  gestaoInicial = false,
}: {
  gestaoInicial?: boolean;
}) {
  const [contexto, setContexto] = useState<ContextoPonto | null>(null);
  const [aba, setAba] = useState<Aba>(gestaoInicial ? "vivo" : "meu");
  const [mes, setMes] = useState(
    new Date().toLocaleDateString("sv-SE").slice(0, 7),
  );
  const [linhaAtual, setLinhaAtual] = useState<Record<string, string> | null>(
    null,
  );
  const [espelho, setEspelho] = useState<DadosEspelho | null>(null);
  const [equipe, setEquipe] = useState<MembroPonto[]>([]);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [comprovante, setComprovante] = useState<ComprovantePonto | null>(null);
  const [pedido, setPedido] = useState<{
    solicitacao: SolicitacaoPonto;
    nome: string;
  } | null>(null);
  const [detalhe, setDetalhe] = useState<DadosEspelho | null>(null);
  const sequencia = useRef(0);
  useEffect(() => {
    let ativo = true;
    void contextoPonto()
      .then((r) => {
        if (!ativo) return;
        setContexto(r);
        setLinhaAtual(r.linha_atual);
        setMes(r.hoje.slice(0, 7));
        if (gestaoInicial && !r.permissoes.gestor) setAba("meu");
        if (!r.elegivel && r.permissoes.gestor) setAba("vivo");
      })
      .catch((e) => {
        if (ativo) setErro(mensagemErroPonto(e));
      });
    return () => {
      ativo = false;
    };
  }, [gestaoInicial]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible")
        void contextoPonto()
          .then((r) => {
            setLinhaAtual(r.linha_atual);
            setContexto((atual) =>
              atual?.hoje === r.hoje &&
              atual.fuso_horario === r.fuso_horario &&
              atual.elegivel === r.elegivel
                ? atual
                : r,
            );
          })
          .catch(() => undefined);
    }, 60000);
    return () => clearInterval(t);
  }, []);
  const carregar = useCallback(async () => {
    if (!contexto) return;
    const id = ++sequencia.current;
    setCarregando(true);
    try {
      if (aba === "meu") {
        const [r, c] = await Promise.all([
          carregarEspelhoPonto(mes),
          contextoPonto(),
        ]);
        if (id === sequencia.current) {
          setEspelho(r);
          setLinhaAtual(c.linha_atual);
        }
      } else if (contexto.permissoes.gestor && aba !== "configuracao") {
        const r = await carregarGestaoPonto(mes);
        if (id === sequencia.current) setEquipe(r.equipe);
      }
      if (id === sequencia.current) setErro("");
    } catch (e) {
      if (id === sequencia.current) setErro(mensagemErroPonto(e));
    } finally {
      if (id === sequencia.current) setCarregando(false);
    }
  }, [contexto, mes, aba]);
  useEffect(() => {
    void carregar();
    const evento = () => {
      if (document.visibilityState === "visible") void carregar();
    };
    const timer = setInterval(evento, 30000);
    window.addEventListener("ponto:atualizado", evento);
    document.addEventListener("visibilitychange", evento);
    return () => {
      clearInterval(timer);
      sequencia.current++;
      window.removeEventListener("ponto:atualizado", evento);
      document.removeEventListener("visibilitychange", evento);
    };
  }, [carregar]);
  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setMensagem("");
    try {
      await acao();
      setMensagem(sucesso);
      await carregar();
    } catch (e) {
      setErro(mensagemErroPonto(e));
    } finally {
      setOcupado(false);
    }
  };
  const hoje = espelho?.dias.find((d) => d.data === contexto?.hoje);
  const aberta = espelho?.dias.find(
    (d) =>
      d.data <= (contexto?.hoje || "") &&
      d.linha?.entrada_hora &&
      !d.linha?.saida_hora,
  );
  const atual = linhaAtual ? { linha: linhaAtual } : aberta || hoje;
  const marcar = (acao: string) =>
    executar(async () => {
      const geo = await capturarLocalizacaoPonto();
      const r = await registrarPonto(acao, geo);
      setComprovante(r.comprovante);
    }, "Marcação registrada com horário do servidor.");
  const abas: Array<{ id: Aba; nome: string; icon: typeof Clock3 }> = [
    { id: "meu", nome: "Meu ponto", icon: Clock3 },
    ...(contexto?.permissoes.gestor
      ? [
          { id: "vivo" as Aba, nome: "Ao vivo", icon: Activity },
          { id: "pedidos" as Aba, nome: "Solicitações", icon: Bell },
          { id: "fechamento" as Aba, nome: "Fechamento", icon: FileCheck2 },
          {
            id: "configuracao" as Aba,
            nome: "Escalas e regras",
            icon: Settings2,
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <IndicadorPagina>Gestão de jornada</IndicadorPagina>
          <h1 className="mt-1 text-2xl font-semibold">Ponto e jornada</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Marcações, escalas recorrentes, aprovações e espelho mensal.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="competencia-ponto">
            Competência
          </label>
          <input
            id="competencia-ponto"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={`${campo} max-w-44`}
          />
          <Button
            variant="outline"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </header>
      <nav
        className="flex gap-1 overflow-x-auto border-b border-border pb-2"
        aria-label="Seções do ponto"
      >
        {abas.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => setAba(a.id)}
            aria-current={aba === a.id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${aba === a.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <a.icon size={14} />
            {a.nome}
          </button>
        ))}
      </nav>
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300"
        >
          {erro}
        </div>
      )}
      {mensagem && (
        <p
          role="status"
          className="text-xs text-emerald-700 dark:text-emerald-300"
        >
          {mensagem}
        </p>
      )}
      {!contexto && !erro && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando permissões…
        </p>
      )}
      {aba === "meu" && contexto && (
        <>
          {!contexto.elegivel && (
            <p className={painel}>
              Seu departamento não utiliza marcação de ponto. Os registros
              antigos, quando existentes, continuam disponíveis para consulta.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [
                "Trabalhado no mês",
                horasPonto(espelho?.totais.trabalhados_min),
              ],
              ["Banco oficial", horasPonto(espelho?.banco.saldo_min)],
              [
                "Banco vencido a liquidar",
                horasPonto(espelho?.banco.vencido_a_liquidar_min),
              ],
              [
                "Noturno reduzido",
                horasPonto(espelho?.totais.noturnos_reduzidos_min),
              ],
              [
                "Sobreaviso equivalente",
                horasPonto(espelho?.totais.sobreaviso_equivalente_min),
              ],
            ].map(([nome, valor]) => (
              <div key={nome} className={painel}>
                <p className="text-[11px] text-muted-foreground">{nome}</p>
                <p className="mt-2 font-mono text-2xl font-semibold">{valor}</p>
              </div>
            ))}
          </div>
          {contexto.elegivel && (
            <section className={painel}>
              <CabecalhoSecao
                icon={<Clock3 size={15} />}
                title="Registrar ponto"
                detail={`${dataPonto(contexto.hoje)} · ${contexto.fuso_horario}`}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {[
                  ["entrada", "Entrada", Boolean(atual?.linha?.entrada_hora)],
                  [
                    "inicio_almoco",
                    "Iniciar intervalo",
                    !atual?.linha?.entrada_hora ||
                      Boolean(atual?.linha?.inicio_almoco) ||
                      Boolean(atual?.linha?.saida_hora),
                  ],
                  [
                    "fim_almoco",
                    "Retornar do intervalo",
                    !atual?.linha?.inicio_almoco ||
                      Boolean(atual?.linha?.fim_almoco) ||
                      Boolean(atual?.linha?.saida_hora),
                  ],
                  [
                    "saida",
                    "Saída",
                    !atual?.linha?.entrada_hora ||
                      Boolean(atual?.linha?.saida_hora),
                  ],
                ].map(([acao, nome, desabilitado]) => (
                  <Button
                    key={String(acao)}
                    variant="outline"
                    disabled={
                      ocupado ||
                      Boolean(desabilitado) ||
                      mes !== contexto.hoje.slice(0, 7)
                    }
                    onClick={() => void marcar(String(acao))}
                  >
                    {nome}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                A localização é solicitada para cada marcação. Horários não são
                editados diretamente; use uma solicitação de correção.
              </p>
              {comprovante && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 p-3 text-xs">
                  <span>
                    {rotulosPonto[comprovante.tipo]} ·{" "}
                    {new Date(comprovante.registrado_em).toLocaleTimeString(
                      "pt-BR",
                      { timeZone: comprovante.fuso_horario },
                    )}{" "}
                    ·{" "}
                    {comprovante.geolocalizacao_status === "INFORMADA"
                      ? `${comprovante.latitude?.toFixed(5)}, ${comprovante.longitude?.toFixed(5)}`
                      : "Sem localização disponível"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => baixarComprovantePonto(comprovante)}
                  >
                    Baixar registro
                  </Button>
                </div>
              )}
            </section>
          )}
          {espelho && (
            <EspelhoPonto
              dados={espelho}
              conferir={
                contexto.elegivel
                  ? () =>
                      void executar(
                        () => acaoFechamentoPonto(mes, "conferir"),
                        "Seu espelho foi conferido e enviado ao gestor.",
                      )
                  : undefined
              }
            />
          )}
          {contexto.elegivel && (
            <FormularioSolicitacao
              hoje={contexto.hoje}
              ocupado={ocupado}
              enviar={(f) =>
                executar(
                  () => solicitarPonto(f),
                  "Solicitação enviada ao gestor.",
                )
              }
            />
          )}
          {espelho && (
            <ListaSolicitacoes
              solicitacoes={espelho.solicitacoes}
              abrirAnexo={(id) =>
                void executar(
                  () => baixarAnexoSolicitacaoPonto(id),
                  "Arquivo disponível para download.",
                )
              }
            />
          )}
        </>
      )}
      {aba === "vivo" && contexto?.permissoes.gestor && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <CabecalhoSecao
            icon={<Activity size={15} />}
            title="Operação ao vivo"
            detail="Atualização a cada 30 segundos. Alertas calculados pela escala de cada colaborador."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/30">
                <tr>
                  {[
                    "Colaborador",
                    "Escala",
                    "Entrada / pausa",
                    "Trabalhado",
                    "Alertas",
                  ].map((t) => (
                    <th
                      key={t}
                      className="px-4 py-3 font-medium text-muted-foreground"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {equipe.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {m.nome_exibicao || m.nome_completo}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {m.departamento}
                      </p>
                    </td>
                    <td className="px-4">
                      {m.hoje?.escala
                        ? `${m.hoje.escala.entrada || "Folga"} ${m.hoje.escala.saida || ""}`
                        : "A definir"}
                    </td>
                    <td className="whitespace-nowrap px-4 font-mono">
                      {m.hoje?.linha?.entrada_hora || "—"} /{" "}
                      {m.hoje?.linha?.inicio_almoco || "—"}
                    </td>
                    <td className="px-4 font-mono">
                      {horasPonto(m.hoje?.trabalhados_min)}
                    </td>
                    <td className="min-w-48 px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.hoje?.alertas.map((a) => (
                          <EtiquetaPonto key={a} valor={a} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!equipe.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum colaborador nos departamentos ou vínculos sob sua gestão.
            </p>
          )}
        </section>
      )}
      {aba === "pedidos" && contexto?.permissoes.gestor && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            Aprovações distribuídas no mês
          </h2>
          {equipe.map((m) => (
            <ListaSolicitacoes
              key={m.id}
              nome={m.nome_exibicao || m.nome_completo}
              solicitacoes={m.solicitacoes}
              decidir={(s) =>
                setPedido({ solicitacao: s, nome: m.nome_completo })
              }
              abrirAnexo={(id) =>
                void executar(
                  () => baixarAnexoSolicitacaoPonto(id),
                  "Arquivo disponível para download.",
                )
              }
            />
          ))}
          {!equipe.length && (
            <p className={painel}>
              Nenhuma solicitação da equipe neste período.
            </p>
          )}
        </div>
      )}
      {aba === "configuracao" && contexto?.permissoes.gestor && (
        <ConfiguracaoPonto aoErro={(e) => setErro(mensagemErroPonto(e))} />
      )}
      {aba === "fechamento" && contexto?.permissoes.gestor && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <CabecalhoSecao
            icon={<FileCheck2 size={15} />}
            title="Fechamento colaborativo"
            detail="Colaborador confere, gestor aprova e DP recebe o espelho. O fechamento automático no dia 1 respeita as regras validadas."
          />
          <div className="divide-y divide-border">
            {equipe.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <h3 className="text-sm font-medium">
                    {m.nome_exibicao || m.nome_completo}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <EtiquetaPonto
                      valor={m.fechamento?.status || "EM_CONFERENCIA"}
                    />
                    <span className="text-xs text-muted-foreground">
                      {m.pendencias.length} pendência(s) · Banco do mês:{" "}
                      {horasPonto(m.totais.banco_min)}
                      {m.banco.vencido_a_liquidar_min > 0
                        ? ` · Vencido a liquidar: ${horasPonto(m.banco.vencido_a_liquidar_min)}`
                        : ""}
                    </span>
                  </div>
                  {m.pendencias.length > 0 && (
                    <p className="mt-2 max-w-xl text-[10px] text-muted-foreground">
                      {m.pendencias
                        .slice(0, 3)
                        .map((x) => {
                          const [data, alerta] = x.split(": ");
                          return `${dataPonto(data)} · ${rotulosPonto[alerta] || alerta}`;
                        })
                        .join(" / ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void executar(
                        async () =>
                          setDetalhe(await carregarEspelhoPonto(mes, m.id)),
                        "",
                      )
                    }
                  >
                    Ver espelho
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      ocupado ||
                      m.fechamento?.status !== "CONFERIDO" ||
                      m.pendencias.length > 0
                    }
                    onClick={() =>
                      void executar(
                        () => acaoFechamentoPonto(mes, "aprovar", m.id),
                        "Espelho aprovado pelo gestor.",
                      )
                    }
                  >
                    Aprovar
                  </Button>
                  {contexto.permissoes.dp && (
                    <Button
                      size="sm"
                      disabled={
                        ocupado || m.fechamento?.status !== "APROVADO_GESTOR"
                      }
                      onClick={() =>
                        void executar(
                          () => acaoFechamentoPonto(mes, "fechar", m.id),
                          "Competência fechada e banco atualizado.",
                        )
                      }
                    >
                      Fechar pelo DP
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog
        open={Boolean(detalhe)}
        onOpenChange={(v) => {
          if (!v) setDetalhe(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-6xl overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Espelho da equipe</DialogTitle>
          </DialogHeader>
          {detalhe && <EspelhoPonto dados={detalhe} />}
        </DialogContent>
      </Dialog>
      {pedido && (
        <DecisaoSolicitacao
          pedido={pedido.solicitacao}
          nome={pedido.nome}
          ocupado={ocupado}
          fechar={() => setPedido(null)}
          salvar={(status, motivo, minutos) =>
            void executar(async () => {
              await decidirSolicitacaoPonto(
                pedido.solicitacao.id,
                status,
                motivo,
                minutos,
              );
              setPedido(null);
            }, "Decisão registrada no histórico.")
          }
        />
      )}
    </div>
  );
}
function FormularioSolicitacao({
  hoje,
  ocupado,
  enviar,
}: {
  hoje: string;
  ocupado: boolean;
  enviar: (form: FormData) => Promise<void>;
}) {
  const [tipo, setTipo] = useState("CORRECAO");
  const ref = useRef<HTMLFormElement>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await enviar(form);
  };
  return (
    <form ref={ref} onSubmit={(e) => void submit(e)} className={painel}>
      <h2 className="text-sm font-semibold">Solicitar ajuste ou autorização</h2>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Tipo
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={campo}
          >
            {[
              "CORRECAO",
              "ATESTADO",
              "DISPENSA",
              "HORA_EXTRA",
              "COMPENSACAO",
            ].map((t) => (
              <option key={t} value={t}>
                {rotulosPonto[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Data
          <input
            type="date"
            name="data_referencia"
            required
            defaultValue={hoje}
            className={campo}
          />
        </label>
        {tipo === "CORRECAO" ? (
          <>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Marcação
              <select name="campo" className={campo}>
                <option value="entrada_hora">Entrada</option>
                <option value="inicio_almoco">Início do intervalo</option>
                <option value="fim_almoco">Retorno do intervalo</option>
                <option value="saida_hora">Saída</option>
              </select>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Horário correto
              <input
                type="time"
                name="horario_corrigido"
                required
                className={campo}
              />
            </label>
          </>
        ) : (
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Duração em minutos
            <input
              type="number"
              name="minutos"
              min={1}
              max={1440}
              required
              defaultValue={tipo === "ATESTADO" ? 1440 : 60}
              className={campo}
            />
          </label>
        )}
        <label className="space-y-1 text-[11px] text-muted-foreground sm:col-span-2">
          Justificativa
          <textarea
            name="justificativa"
            required
            minLength={5}
            maxLength={4000}
            className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground"
          />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Comprovante (até 10 MB)
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="w-full py-2 text-xs"
          />
        </label>
        <Button type="submit" disabled={ocupado}>
          {ocupado ? "Enviando…" : "Enviar ao gestor"}
        </Button>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Para um atestado do dia inteiro, informe 1.440 minutos; o abono será
        limitado à jornada prevista. Anexos ficam restritos ao colaborador e
        gestores autorizados.
      </p>
    </form>
  );
}
function ListaSolicitacoes({
  solicitacoes,
  nome,
  decidir,
  abrirAnexo,
}: {
  solicitacoes: SolicitacaoPonto[];
  nome?: string;
  decidir?: (s: SolicitacaoPonto) => void;
  abrirAnexo: (id: string) => void;
}) {
  return (
    <section className={painel}>
      <h2 className="text-sm font-semibold">{nome || "Minhas solicitações"}</h2>
      {!solicitacoes.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhuma solicitação neste mês.
        </p>
      )}
      <div className="mt-3 divide-y divide-border">
        {solicitacoes.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {dataPonto(s.data_referencia)} · {rotulosPonto[s.tipo]}
                {s.minutos > 0 ? ` · ${horasPonto(s.minutos)}` : ""}
                {s.horario_corrigido ? ` · ${s.horario_corrigido}` : ""}
              </p>
              <p className="mt-1 max-w-xl whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {s.justificativa}
              </p>
              {s.motivo_rejeicao && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                  {s.motivo_rejeicao}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <EtiquetaPonto valor={s.status} />
              {(s.anexo_id || s.origem_tipo === "AUSENCIA_LEGADA") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => abrirAnexo(s.id)}
                >
                  Comprovante
                </Button>
              )}
              {decidir && s.status === "PENDENTE" && (
                <Button size="sm" onClick={() => decidir(s)}>
                  Analisar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function DecisaoSolicitacao({
  pedido,
  nome,
  ocupado,
  fechar,
  salvar,
}: {
  pedido: SolicitacaoPonto;
  nome: string;
  ocupado: boolean;
  fechar: () => void;
  salvar: (status: string, motivo: string, minutos: number) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [minutos, setMinutos] = useState(pedido.minutos);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !ocupado) fechar();
      }}
    >
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Analisar solicitação</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          {nome} · {dataPonto(pedido.data_referencia)} ·{" "}
          {rotulosPonto[pedido.tipo]}
        </p>
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
          {pedido.justificativa}
        </p>
        {pedido.tipo !== "CORRECAO" && (
          <label className="space-y-1 text-xs">
            Duração autorizada em minutos
            <input
              type="number"
              min={1}
              max={1440}
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
              className={campo}
            />
          </label>
        )}
        <label className="space-y-1 text-xs">
          Parecer (obrigatório para rejeitar)
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-xs"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={ocupado} onClick={fechar}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={ocupado || motivo.trim().length < 5}
            onClick={() => salvar("REJEITADA", motivo, minutos)}
          >
            Rejeitar
          </Button>
          <Button
            disabled={ocupado || (pedido.tipo !== "CORRECAO" && minutos <= 0)}
            onClick={() => salvar("APROVADA", motivo, minutos)}
          >
            Aprovar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
