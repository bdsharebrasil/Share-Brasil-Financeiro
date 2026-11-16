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
  Check,
  CalendarDays,
  Coffee,
  FileText,
  History,
  LogIn,
  LogOut,
  Undo2,
  Wallet,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CalendarioPonto from "@/components/ponto/CalendarioPonto";
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
  const [espelhoAberto, setEspelhoAberto] = useState(false);
  const [secaoPessoal, setSecaoPessoal] = useState("registro");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
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
  const atual = { linha: linhaAtual };
  const espelhoDoMes = espelho?.competencia === mes ? espelho : null;
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
  const etapasPonto = [
    {
      acao: "entrada",
      nome: "Entrada",
      icone: LogIn,
      horario: linhaAtual?.entrada_hora,
      desabilitado: Boolean(linhaAtual?.entrada_hora),
    },
    {
      acao: "inicio_almoco",
      nome: "Iniciar intervalo",
      icone: Coffee,
      horario: linhaAtual?.inicio_almoco,
      desabilitado:
        !linhaAtual?.entrada_hora ||
        Boolean(linhaAtual?.inicio_almoco) ||
        Boolean(linhaAtual?.saida_hora),
    },
    {
      acao: "fim_almoco",
      nome: "Retornar do intervalo",
      icone: Undo2,
      horario: linhaAtual?.fim_almoco,
      desabilitado:
        !linhaAtual?.inicio_almoco ||
        Boolean(linhaAtual?.fim_almoco) ||
        Boolean(linhaAtual?.saida_hora),
    },
    {
      acao: "saida",
      nome: "Saída",
      icone: LogOut,
      horario: linhaAtual?.saida_hora,
      desabilitado:
        !linhaAtual?.entrada_hora || Boolean(linhaAtual?.saida_hora),
    },
  ];
  const proximaAcao = etapasPonto.find(
    (etapa) => !etapa.horario && !etapa.desabilitado,
  )?.acao;

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
            onChange={(e) => {
              if (e.target.value) {
                setMes(e.target.value);
                setDiaSelecionado(null);
              }
            }}
            className={`${campo} max-w-44`}
          />
          <Button
            variant="outline"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            <RefreshCw size={14} />
            <span className="sr-only">Atualizar ponto</span>
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
          <Tabs value={secaoPessoal} onValueChange={setSecaoPessoal}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList
                aria-label="Meu ponto"
                className="h-auto max-w-full justify-start overflow-x-auto"
              >
                <TabsTrigger value="registro" className="gap-2">
                  <Clock3 size={14} />
                  Registrar ponto
                </TabsTrigger>
                <TabsTrigger value="justificativas" className="gap-2">
                  <CalendarDays size={14} />
                  Justificativas e ajustes
                </TabsTrigger>
                <TabsTrigger value="saldos" className="gap-2">
                  <Wallet size={14} />
                  Saldos do mês
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-2">
                  <History size={14} />
                  Minhas solicitações
                </TabsTrigger>
              </TabsList>
              <Button
                variant="outline"
                onClick={() => setEspelhoAberto(true)}
                disabled={!espelho || espelho.competencia !== mes}
              >
                <FileText size={14} className="mr-2" />
                Ver espelho
              </Button>
            </div>
            <TabsContent value="registro" className="mt-4 space-y-4">
              {contexto.elegivel && (
                <section className={painel}>
                  <CabecalhoSecao
                    icon={<Clock3 size={15} />}
                    title="Registrar ponto"
                    detail={`${dataPonto(contexto.hoje)} · ${contexto.fuso_horario}`}
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {etapasPonto.map((etapa) => {
                      const Icone = etapa.icone;
                      const concluida = Boolean(etapa.horario);
                      const proxima = etapa.acao === proximaAcao;
                      const situacao = concluida
                        ? "Registrada"
                        : proxima
                          ? "Próxima"
                          : etapa.desabilitado
                            ? "Aguardando"
                            : "Disponível";
                      return (
                        <button
                          key={etapa.acao}
                          type="button"
                          disabled={ocupado || etapa.desabilitado}
                          aria-label={`${etapa.nome}, ${situacao.toLowerCase()}${concluida ? ` às ${etapa.horario}` : ""}`}
                          onClick={() => void marcar(etapa.acao)}
                          className={`flex min-h-28 flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                            concluida
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : proxima
                                ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/15 hover:bg-primary/10"
                                : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                concluida
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : proxima
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {concluida ? <Check size={16} /> : <Icone size={16} />}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                concluida
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : proxima
                                    ? "bg-primary/15 text-primary"
                                    : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {situacao}
                            </span>
                          </div>
                          <div className="mt-4">
                            <p className="text-sm font-medium">{etapa.nome}</p>
                            <p
                              className={`mt-1 font-mono text-lg font-semibold ${
                                concluida
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {etapa.horario || "--:--"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
              <p className="text-xs text-muted-foreground">
                Use as etapas acima para registrar sua jornada. Para justificar
                uma ausência ou corrigir um horário, acesse Justificativas e
                ajustes.
              </p>
            </TabsContent>
            <TabsContent value="justificativas" className="mt-4">
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
                <CalendarioPonto
                  mes={mes}
                  hoje={contexto.hoje}
                  selecionado={diaSelecionado}
                  dias={espelho?.competencia === mes ? espelho.dias : []}
                  solicitacoes={
                    espelho?.competencia === mes ? espelho.solicitacoes : []
                  }
                  mudarMes={(valor) => {
                    setMes(valor);
                    setDiaSelecionado(null);
                  }}
                  selecionar={setDiaSelecionado}
                />
                {diaSelecionado && espelho?.competencia === mes ? (
                  <div className="space-y-4">
                    <section className={painel}>
                      <h2 className="text-sm font-semibold">
                        Dia selecionado · {dataPonto(diaSelecionado)}
                      </h2>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          ["Entrada", "entrada_hora"],
                          ["Intervalo", "inicio_almoco"],
                          ["Retorno", "fim_almoco"],
                          ["Saída", "saida_hora"],
                        ].map(([nome, chave]) => (
                          <div key={chave}>
                            <p className="text-[11px] text-muted-foreground">
                              {nome}
                            </p>
                            <p className="mt-1 font-mono text-sm">
                              {espelho.dias.find(
                                (d) => d.data === diaSelecionado,
                              )?.linha?.[chave] || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                    {contexto.elegivel && (
                      <FormularioSolicitacao
                        key={diaSelecionado}
                        data={diaSelecionado}
                        ocupado={ocupado}
                        enviar={(f) =>
                          executar(
                            () => solicitarPonto(f),
                            "Solicitação enviada ao gestor.",
                          )
                        }
                      />
                    )}
                    <ListaSolicitacoes
                      solicitacoes={espelho.solicitacoes.filter(
                        (s) => s.data_referencia === diaSelecionado,
                      )}
                      nome="Solicitações deste dia"
                      abrirAnexo={(id) =>
                        void executar(
                          () => baixarAnexoSolicitacaoPonto(id),
                          "Arquivo disponível para download.",
                        )
                      }
                    />
                  </div>
                ) : (
                  <section
                    className={`${painel} flex min-h-64 flex-col items-center justify-center text-center`}
                  >
                    <CalendarDays
                      size={28}
                      className="mb-3 text-muted-foreground"
                    />
                    <h2 className="text-sm font-semibold">
                      Selecione um dia no calendário
                    </h2>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Consulte os horários e escolha o que deseja enviar:
                      justificativa de falta, atestado ou ajuste de ponto.
                    </p>
                  </section>
                )}
              </div>
            </TabsContent>
            <TabsContent value="saldos" className="mt-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Saldos de {mes.split("-").reverse().join("/")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Acompanhe as horas do mês e o saldo do banco após os
                  fechamentos.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  [
                    "Trabalhado no mês",
                    horasPonto(espelhoDoMes?.totais.trabalhados_min),
                  ],
                  ["Banco oficial", horasPonto(espelhoDoMes?.banco.saldo_min)],
                  [
                    "Banco vencido a liquidar",
                    horasPonto(espelhoDoMes?.banco.vencido_a_liquidar_min),
                  ],
                  [
                    "Noturno reduzido",
                    horasPonto(espelhoDoMes?.totais.noturnos_reduzidos_min),
                  ],
                  [
                    "Sobreaviso equivalente",
                    horasPonto(espelhoDoMes?.totais.sobreaviso_equivalente_min),
                  ],
                ].map(([nome, valor]) => (
                  <div key={nome} className={painel}>
                    <p className="text-[11px] text-muted-foreground">{nome}</p>
                    <p className="mt-2 font-mono text-2xl font-semibold">
                      {valor}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              {espelhoDoMes && (
                <ListaSolicitacoes
                  solicitacoes={espelhoDoMes.solicitacoes}
                  abrirAnexo={(id) =>
                    void executar(
                      () => baixarAnexoSolicitacaoPonto(id),
                      "Arquivo disponível para download.",
                    )
                  }
                />
              )}
            </TabsContent>
          </Tabs>
          <Dialog open={espelhoAberto} onOpenChange={setEspelhoAberto}>
            <DialogContent
              className="max-h-[90dvh] max-w-6xl overflow-y-auto bg-background"
              aria-describedby={undefined}
            >
              <DialogHeader>
                <DialogTitle>Meu espelho de ponto</DialogTitle>
              </DialogHeader>
              {espelho && espelho.competencia === mes && (
                <EspelhoPonto
                  dados={espelho}
                  mostrarOcorrencias={contexto.permissoes.gestor}
                  conferir={
                    contexto.elegivel && !ocupado
                      ? () =>
                          void executar(
                            () => acaoFechamentoPonto(mes, "conferir"),
                            "Seu espelho foi conferido e enviado ao gestor.",
                          )
                      : undefined
                  }
                />
              )}
            </DialogContent>
          </Dialog>
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
          {detalhe && <EspelhoPonto dados={detalhe} mostrarOcorrencias />}
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
  data,
  ocupado,
  enviar,
}: {
  data: string;
  ocupado: boolean;
  enviar: (form: FormData) => Promise<void>;
}) {
  const [tipo, setTipo] = useState("CORRECAO");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await enviar(form);
  };
  return (
    <form onSubmit={(e) => void submit(e)} className={painel}>
      <h2 className="text-sm font-semibold">O que deseja solicitar?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Solicitação para {dataPonto(data)} · enviada para análise do gestor.
      </p>
      <input type="hidden" name="data_referencia" value={data} />
      <input type="hidden" name="tipo" value={tipo} />
      <Tabs
        value={tipo}
        onValueChange={(valor) => {
          setTipo(valor);
          setDiaInteiro(true);
        }}
        className="mt-4"
      >
        <TabsList
          aria-label="Tipo de solicitação"
          className="h-auto w-full flex-wrap justify-start gap-1"
        >
          {[
            ["CORRECAO", "Ajustar horário"],
            ["ATESTADO", "Enviar atestado"],
            ["DISPENSA", "Justificar falta"],
            ["HORA_EXTRA", "Hora extra"],
            ["COMPENSACAO", "Compensação"],
          ].map(([valor, nome]) => (
            <TabsTrigger key={valor} value={valor}>
              {nome}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent key={tipo} value={tipo}>
          <div className="mt-4 grid items-end gap-3 sm:grid-cols-2">
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
              <div className="space-y-3 sm:col-span-2">
                {["ATESTADO", "DISPENSA"].includes(tipo) && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={diaInteiro}
                      onChange={(e) => setDiaInteiro(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Dia inteiro
                  </label>
                )}
                {["ATESTADO", "DISPENSA"].includes(tipo) && diaInteiro ? (
                  <>
                    <input type="hidden" name="minutos" value="1440" />
                    <p className="text-[11px] text-muted-foreground">
                      A duração será limitada à jornada prevista para este dia,
                      após aprovação.
                    </p>
                  </>
                ) : (
                  <label className="block space-y-1 text-[11px] text-muted-foreground">
                    Duração em minutos
                    <input
                      key={tipo}
                      type="number"
                      name="minutos"
                      min={1}
                      max={1440}
                      required
                      defaultValue={60}
                      className={campo}
                    />
                  </label>
                )}
              </div>
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
        </TabsContent>
      </Tabs>
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
