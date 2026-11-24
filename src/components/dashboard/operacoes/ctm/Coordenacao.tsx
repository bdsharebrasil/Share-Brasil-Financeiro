import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Calculator,
  CalendarClock,
  ClipboardList,
  History,
  Landmark,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colaboradorRequest, type CtmRegistro as Linha } from "@/lib/colaborador-api";
import { formatarMoeda } from "@/components/dashboard/ComponentesDashboard";

const raiz = "/api/ctm/coordenacao";
const nome: Record<string, string> = {
  numero: "Número",
  oas_numero: "OAS vinculada",
  os_oficina: "OS da oficina",
  ordem_servico_id: "RAS vinculado",
  p_n_instalado: "P/N instalado",
  s_n_instalado: "S/N instalado",
  p_n_removido: "P/N removido",
  s_n_removido: "S/N removido",
  numero_da_peça: "P/N",
  numero_de_serie: "S/N",
  observacoes: "Observações",
  descricao: "Descrição",
  tipo_manutencao: "Tipo de manutenção",
  tipo_rateio: "Critério de rateio",
  total_pecas: "Custo de peças (R$)",
  total_mao_obra: "Mão de obra (R$)",
  relatorio_voo_de: "Uso desde",
  relatorio_voo_ate: "Uso até",
  valor_unitario: "Preço unitário (R$)",
  data_saida: "Saída da oficina",
  data_leitura: "Data da leitura dos contadores",
  base_legal: "Referência técnica e revisão",
  tipo_controle: "Controle",
  data_de_conformidade: "Data do cumprimento",
  metodo_de_conformidade: "Referência da execução",
  data_troca: "Data da troca",
  percentual: "Cota fixa",
  horas: "Horas de uso",
  pending: "Pendente",
  urgent: "Urgente",
  complied: "Cumprida",
  not_applicable: "Não aplicável",
  open: "Aberto",
  in_analysis: "Em avaliação",
  in_maintenance: "Em manutenção",
  resolved: "Corrigido",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};
const rotulo = (v: string) => nome[v] || v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const dia = (v: unknown) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const aviso = (e: unknown) => (e instanceof Error ? e.message : "Falha ao acessar o CTM.");
const base = (id: string) => raiz + "/aeronaves/" + encodeURIComponent(id);
const select = "rounded-xl border border-input bg-background p-2 text-sm";
type Campo = { nome: string; tipo: string; opcoes?: string[]; obrigatorio: boolean };
function useDados<T>(path: string, ativo = true, intervalo?: number) {
  return useQuery({
    queryKey: [path],
    queryFn: () => colaboradorRequest<T>(path),
    enabled: ativo,
    refetchInterval: intervalo,
  });
}
function Historico({ path, id }: { path: string; id?: string }) {
  const q = useDados<{ eventos: Linha[] }>(path);
  if (!q.data) return <p>{q.isError ? aviso(q.error) : "Carregando histórico…"}</p>;
  const eventos = q.data.eventos.filter((e) => !id || e.registro_id === id);
  return (
    <div className="space-y-2">
      {eventos.map((e) => (
        <details key={e.registro_id + "-" + e.versao} className="rounded border p-2 text-xs">
          <summary>
            {e.data} UTC · {e.acao} · {e.responsavel} · {e.motivo || "Novo registro"}
          </summary>
          {[
            ["Antes", e.anterior],
            ["Depois", e.posterior],
          ].map(
            ([k, json]) =>
              json && (
                <div key={k}>
                  <strong>{k}</strong>
                  <dl>
                    {Object.entries(JSON.parse(json))
                      .filter(([, v]) => v != null)
                      .map(([campo, v]) => (
                        <div key={campo}>
                          {rotulo(campo)}: {String(v)}
                        </div>
                      ))}
                  </dl>
                </div>
              ),
          )}
        </details>
      ))}
      {!eventos.length && <p>Nenhuma alteração posterior ao cadastro.</p>}
    </div>
  );
}
export function Cadastro({
  aeronave,
  modulo,
  titulo,
  novo,
  matricula,
  ras,
  atualizar,
  criarAoAbrir,
  aoAbrirCriacao,
}: {
  aeronave: string;
  modulo: string;
  titulo: string;
  novo: string;
  matricula?: string;
  ras: Linha[];
  atualizar: () => void;
  criarAoAbrir: boolean;
  aoAbrirCriacao: () => void;
}) {
  const path = base(aeronave) + "/registros/" + modulo;
  const q = useDados<{ registros: Linha[]; campos: Campo[]; podeEditar: boolean }>(path);
  const [row, setRow] = useState<Linha | null>(null);
  const [arquivo, setArquivo] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [busca, setBusca] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const { toast } = useToast();
  const dados = q.data;

  useEffect(() => {
    if (!criarAoAbrir || !dados?.podeEditar) return;
    setRow({});
    aoAbrirCriacao();
  }, [criarAoAbrir, dados?.podeEditar, aoAbrirCriacao]);

  function abrir(registro: Linha, arquivar = false) {
    setRow({ ...registro });
    setArquivo(arquivar);
    setMotivo("");
    setErro("");
  }
  async function salvar() {
    if (!row || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const valores = Object.fromEntries(
        dados!.campos.map((campo) => [
          campo.nome,
          campo.tipo === "date" && row[campo.nome] ? String(row[campo.nome]).slice(0, 10) : row[campo.nome],
        ]),
      );
      await colaboradorRequest(path + (row.id ? "/" + encodeURIComponent(row.id) : ""), {
        method: arquivo ? "DELETE" : row.id ? "PATCH" : "POST",
        body: JSON.stringify({ dados: valores, versao: row.versao, motivo }),
      });
      setRow(null);
      toast({ title: arquivo ? "Registro arquivado" : "Registro salvo" });
      atualizar();
    } catch (e) {
      setErro(aviso(e));
    } finally {
      setOcupado(false);
    }
  }

  if (!dados)
    return (
      <section className="rounded-2xl border bg-card p-5 text-sm" role="status">
        {q.isError ? (
          <>
            {aviso(q.error)}{" "}
            <Button variant="link" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </>
        ) : (
          "Carregando registros…"
        )}
      </section>
    );

  const leitura = !dados.podeEditar || row?.bloqueado;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = dados.registros.filter((registro) =>
    dados.campos.some((campo) =>
      String(registro[campo.nome] ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    ),
  );
  const resumo = dados.campos.filter((campo) => campo.nome !== "ordem_servico_id").slice(0, 5);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4">
        <label className="relative mr-auto min-w-40 flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar em {titulo.toLowerCase()}</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            className="rounded-xl pl-9"
            placeholder="Buscar registros"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setHistorico(true)}>
          <History size={15} /> Histórico
        </Button>
        <Button className="gap-2 rounded-xl" disabled={!dados.podeEditar || ocupado} onClick={() => abrir({})}>
          <Plus size={16} /> {novo}
        </Button>
      </header>

      {!dados.podeEditar && (
        <p className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          Perfil de consulta. Para cadastrar ou editar, é preciso ter acesso de CTM, Operações ou gestão autorizada.
        </p>
      )}

      {visiveis.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {resumo.map((campo) => (
                  <th scope="col" className="px-4 py-3 font-medium" key={campo.nome}>
                    {rotulo(campo.nome)}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((registro) => (
                <tr className="border-t border-border/60 transition-colors hover:bg-muted/30" key={registro.id}>
                  {resumo.map((campo, indice) => (
                    <td
                      className={indice === 0 ? "px-4 py-3 font-semibold" : "px-4 py-3 text-muted-foreground"}
                      key={campo.nome}
                    >
                      {campo.tipo === "date"
                        ? dia(registro[campo.nome])
                        : campo.opcoes && registro[campo.nome]
                          ? rotulo(registro[campo.nome])
                          : String(registro[campo.nome] ?? "—")}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => abrir(registro)}>
                      {registro.bloqueado || !dados.podeEditar ? "Detalhes" : "Editar"}
                    </Button>
                    {dados.podeEditar && !registro.bloqueado && (
                      <Button size="sm" variant="ghost" onClick={() => abrir(registro, true)}>
                        Arquivar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid justify-items-center gap-2 px-5 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList size={22} />
          </span>
          <h3 className="font-semibold">{termo ? "Nenhum resultado encontrado" : "Nenhum registro para esta aeronave"}</h3>
          {termo ? (
            <Button variant="link" onClick={() => setBusca("")}>
              Limpar busca
            </Button>
          ) : (
            dados.podeEditar && (
              <Button variant="link" onClick={() => abrir({})}>
                Cadastrar primeiro registro
              </Button>
            )
          )}
        </div>
      )}

      <Dialog open={historico} onOpenChange={setHistorico}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico · {titulo}</DialogTitle>
            <DialogDescription>{matricula || "Aeronave selecionada"}</DialogDescription>
          </DialogHeader>
          <Historico path={base(aeronave) + "/historico/" + modulo} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(row)}
        onOpenChange={(aberto) => {
          if (!aberto && !ocupado) setRow(null);
        }}
      >
        {row && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {arquivo ? "Arquivar registro" : row.id ? (leitura ? "Detalhes do registro" : "Editar registro") : novo}
              </DialogTitle>
              <DialogDescription>
                {matricula || "Aeronave selecionada"}
                {arquivo && " · O registro ficará disponível no histórico."}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void salvar();
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {!arquivo &&
                dados.campos.map((campo) => {
                  const chave = campo.nome;
                  const desabilitado = leitura || ocupado;
                  const valor = row[chave] ?? "";
                  const alterar = (valor: string) => setRow({ ...row, [chave]: valor });
                  const opcoes =
                    chave === "ordem_servico_id"
                      ? ras.map((relatorio) => ({ id: relatorio.id, nome: relatorio.numero || relatorio.id }))
                      : campo.opcoes?.map((opcao) => ({ id: opcao, nome: rotulo(opcao) }));
                  const longo = ["observacoes", "descricao", "notas", "aplicabilidade", "metodo_de_conformidade"].includes(
                    chave,
                  );
                  return (
                    <label key={chave} className={longo ? "grid gap-1.5 text-sm sm:col-span-2" : "grid gap-1.5 text-sm"}>
                      <span>
                        {rotulo(chave)} {campo.obrigatorio && <span className="text-primary">*</span>}
                      </span>
                      {opcoes ? (
                        <select
                          className={select + " h-10 w-full"}
                          required={campo.obrigatorio}
                          disabled={desabilitado}
                          value={valor}
                          onChange={(e) => alterar(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {valor && !opcoes.some((opcao) => opcao.id === valor) && (
                            <option value={valor}>{rotulo(String(valor))}</option>
                          )}
                          {opcoes.map((opcao) => (
                            <option key={opcao.id} value={opcao.id}>
                              {opcao.nome}
                            </option>
                          ))}
                        </select>
                      ) : longo ? (
                        <Textarea
                          className="rounded-xl"
                          value={valor}
                          disabled={desabilitado}
                          required={campo.obrigatorio}
                          onChange={(e) => alterar(e.target.value)}
                        />
                      ) : (
                        <Input
                          className="rounded-xl"
                          type={campo.tipo}
                          value={campo.tipo === "date" ? String(valor).slice(0, 10) : valor}
                          disabled={desabilitado}
                          required={campo.obrigatorio}
                          step="any"
                          min={campo.tipo === "number" ? 0 : undefined}
                          onChange={(e) => alterar(e.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              {row.id && !leitura && (
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  Motivo {arquivo ? "do arquivamento" : "da alteração"}
                  <Textarea className="rounded-xl" value={motivo} required onChange={(e) => setMotivo(e.target.value)} />
                </label>
              )}
              {erro && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {erro}
                </p>
              )}
              <DialogFooter className="border-t pt-3 sm:col-span-2">
                <Button type="button" variant="outline" disabled={ocupado} onClick={() => setRow(null)}>
                  Fechar
                </Button>
                {!leitura && (
                  <Button type="submit" disabled={ocupado}>
                    {ocupado ? "Salvando…" : arquivo ? "Confirmar arquivamento" : "Salvar registro"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
const proximos: Record<string, string[]> = {
  open: ["in_analysis"],
  in_analysis: ["in_analysis", "in_maintenance", "resolved"],
  in_maintenance: ["in_analysis", "in_maintenance", "resolved"],
  resolved: ["in_analysis"],
};
export function useReportesCtm(aeronave: string) {
  return useDados<{ registros: Linha[]; podeEditar: boolean }>(
    raiz + "/reportes?aeronave_id=" + encodeURIComponent(aeronave),
    !!aeronave,
    60000,
  );
}

export function Reportes({ aeronave }: { aeronave: string }) {
  const q = useReportesCtm(aeronave);
  const cliente = useQueryClient();
  const [edit, setEdit] = useState<Linha | null>(null);
  const [historico, setHistorico] = useState<Linha | null>(null);
  const [status, setStatus] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const { toast } = useToast();
  const linhas = q.data?.registros.filter((registro) => String(registro.aeronave_id) === aeronave);
  const path = base(aeronave) + "/historico/reportes";

  async function salvar() {
    if (!edit || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await colaboradorRequest(base(aeronave) + "/registros/reportes/" + encodeURIComponent(edit.id), {
        method: "PATCH",
        body: JSON.stringify({ versao: edit.versao, status, motivo }),
      });
      setEdit(null);
      toast({ title: "Acompanhamento atualizado" });
      void q.refetch();
      void cliente.invalidateQueries({ queryKey: [path] });
    } catch (e) {
      setErro(aviso(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="space-y-3">
      {q.isError && (
        <p role="alert" className="rounded-xl border bg-card p-4 text-sm">
          {aviso(q.error)}{" "}
          <Button variant="link" onClick={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {q.isPending && (
        <p role="status" className="rounded-xl border bg-card p-4 text-sm">
          Carregando reportes…
        </p>
      )}
      {linhas?.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-2xl border bg-card p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BellRing size={22} />
          </span>
          <h3 className="font-semibold">Nenhum reporte para esta aeronave</h3>
        </div>
      )}
      {linhas?.map((registro) => (
        <article key={registro.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {rotulo(registro.status)}
            </span>
            <span
              className={
                ["high", "critical"].includes(registro.severidade)
                  ? "rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
                  : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              Severidade {rotulo(registro.severidade)}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{dia(registro.data_relatorio)}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium">{registro.descricao}</p>
          <p className="mt-1 text-xs text-muted-foreground">{registro.criado_por_nome}</p>
          {registro.acao_corretiva && (
            <blockquote className="mt-3 rounded-r-xl border-l-2 border-primary/40 bg-muted/30 p-3 text-sm">
              {registro.acao_corretiva}
            </blockquote>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {q.data?.podeEditar && proximos[registro.status] && (
              <Button
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setEdit(registro);
                  setMotivo("");
                  setErro("");
                  setStatus(proximos[registro.status][0]);
                }}
              >
                {registro.status === "resolved" ? "Reabrir avaliação" : "Atualizar acompanhamento"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => setHistorico(registro)}>
              <History size={14} /> Histórico
            </Button>
          </div>
        </article>
      ))}
      <Dialog
        open={Boolean(historico)}
        onOpenChange={(aberto) => {
          if (!aberto) setHistorico(null);
        }}
      >
        {historico && (
          <DialogContent className="max-h-[90dvh] overflow-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Histórico do reporte</DialogTitle>
              <DialogDescription>{historico.matricula_registro}</DialogDescription>
            </DialogHeader>
            <Historico path={path} id={historico.id} />
          </DialogContent>
        )}
      </Dialog>
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(aberto) => {
          if (!aberto && !ocupado) setEdit(null);
        }}
      >
        {edit && (
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Atualizar acompanhamento</DialogTitle>
              <DialogDescription>{edit.matricula_registro}</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void salvar();
              }}
            >
              <label className="grid gap-1.5 text-sm">
                Situação
                <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {proximos[edit.status].map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {rotulo(opcao)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                Avaliação ou ação corretiva
                <Textarea
                  required
                  maxLength={5000}
                  className="rounded-xl"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              {erro && (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={ocupado}>
                  Salvar acompanhamento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
function Grade({ titulos, linhas, vazio }: { titulos: string[]; linhas: ReactNode[][]; vazio: string }) {
  if (!linhas.length) return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{vazio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {titulos.map((t) => (
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((row, i) => (
            <tr className="border-t border-border/60 transition-colors hover:bg-muted/30" key={i}>
              {row.map((v, j) => (
                <td
                  className={j === 0 ? "px-4 py-3 font-semibold tabular-nums" : "px-4 py-3 text-muted-foreground tabular-nums"}
                  key={j}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Secao({
  icone: Icone,
  titulo,
  descricao,
  acao,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/70 p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icone size={18} />
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="font-semibold">{titulo}</h2>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}
function Metricas({ itens, colunas = "md:grid-cols-4" }: { itens: [string, string][]; colunas?: string }) {
  return (
    <dl className={"grid grid-cols-2 gap-3 " + colunas}>
      {itens.map(([nome, valor]) => (
        <div key={nome} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <dt className="text-xs text-muted-foreground">{nome}</dt>
          <dd className="mt-1 truncate text-base font-semibold tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Previsoes({
  aeronave,
  resumido = false,
  abrirCompleto,
}: {
  aeronave: string;
  resumido?: boolean;
  abrirCompleto?: () => void;
}) {
  const q = useDados<{ horas: number | null; media: number | null; itens: Linha[] }>(
    base(aeronave) + "/previsoes",
    !!aeronave,
  );
  if (!q.data)
    return (
      <div
        role={q.isError ? "alert" : "status"}
        className="rounded-2xl border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-sm"
      >
        {q.isError ? (
          <>
            {aviso(q.error)}{" "}
            <Button variant="link" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </>
        ) : (
          "Carregando previsões…"
        )}
      </div>
    );
  const itens = resumido ? q.data.itens.slice(0, 4) : q.data.itens;
  return (
    <Secao
      icone={CalendarClock}
      titulo="Próximas manutenções e trocas"
      descricao="Vencimentos por calendário ou estimativa pelo uso da aeronave"
      acao={
        abrirCompleto && (
          <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={abrirCompleto}>
            Ver previsões <ArrowRight size={14} />
          </Button>
        )
      }
    >
      <div className="border-b border-border/70 p-4 sm:p-5">
        <Metricas
          colunas="md:grid-cols-3"
          itens={[
            ["Horas de célula", q.data.horas == null ? "Sem leitura" : num(q.data.horas) + " h"],
            ["Utilização média (90 dias)", q.data.media == null ? "Sem base" : num(q.data.media) + " h/dia"],
            ["Itens monitorados", String(q.data.itens.length)],
          ]}
        />
      </div>
      <Grade
        vazio="Nenhuma previsão calculada para esta aeronave."
        titulos={["Item", "Próxima data", "Horas restantes", "Ciclos restantes", "Limite em ciclos", "Limite em pousos"]}
        linhas={itens.map((r) => [
          r.item,
          r.data ? (
            <span className="flex flex-wrap items-center gap-2">
              {dia(r.data)}
              <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] font-medium">
                {r.estimada ? "Estimada pelo uso" : "Calendário"}
              </span>
            </span>
          ) : (
            "Sem previsão"
          ),
          r.saldo == null ? "—" : num(r.saldo),
          r.ciclos ?? "—",
          r.limite_ciclos ?? "—",
          r.limite_pousos ?? "—",
        ])}
      />
    </Secao>
  );
}
export function Custos({ aeronave, ordens }: { aeronave: string; ordens: Linha[] }) {
  const [sel, setSel] = useState(""),
    [cat, setCat] = useState("");
  const id = sel || ordens[0]?.id;
  const divisao = useDados<Linha>(base(aeronave) + "/rateio/" + id, !!id);
  const financeiro = useDados<{ registros: Linha[] }>(base(aeronave) + "/financeiro", !!aeronave);
  const pecas = useDados<{ registros: Linha[] }>(base(aeronave) + "/registros/pecas", !!aeronave);
  const categorias = [
    ...new Set((financeiro.data?.registros || []).map((r) => String(r.categoria_nome || "Sem categoria"))),
  ].sort();
  const categoria = cat || categorias.find((c) => /manuten/i.test(c)) || "";
  const rateios = (financeiro.data?.registros || []).filter(
    (r) => String(r.categoria_nome || "Sem categoria") === categoria,
  );
  const totalPecas = ordens.reduce((soma, ordem) => soma + Number(ordem.total_pecas ?? 0), 0);
  const totalMaoObra = ordens.reduce((soma, ordem) => soma + Number(ordem.total_mao_obra ?? 0), 0);
  return (
    <div className="space-y-4">
      <Metricas
        itens={[
          ["Ordens de serviço", String(ordens.length)],
          ["Peças em OS", formatarMoeda(totalPecas)],
          ["Mão de obra em OS", formatarMoeda(totalMaoObra)],
          ["Total em OS", formatarMoeda(totalPecas + totalMaoObra)],
        ]}
      />
      <GraficoCustos ordens={ordens} />
      <Secao
        icone={Boxes}
        titulo="Histórico de preços das peças"
        descricao="Trocas com preço unitário, quantidade e fornecedor"
      >
        {pecas.isError ? (
          <p role="alert" className="p-5 text-sm text-destructive">
            {aviso(pecas.error)}
          </p>
        ) : pecas.isPending ? (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            Carregando peças…
          </p>
        ) : (
          <Grade
            vazio="Nenhuma troca de peça registrada para esta aeronave."
            titulos={["Troca", "Peça", "P/N instalado", "Fornecedor", "Quantidade", "Unitário", "Total"]}
            linhas={(pecas.data?.registros || []).map((r) => [
              dia(r.data_troca),
              r.descricao,
              r.p_n_instalado || "—",
              r.fornecedor || "—",
              r.quantidade ?? "—",
              r.valor_unitario == null ? "—" : formatarMoeda(r.valor_unitario),
              r.valor_unitario == null || r.quantidade == null ? "—" : formatarMoeda(r.quantidade * r.valor_unitario),
            ])}
          />
        )}
      </Secao>
      <Secao
        icone={Calculator}
        titulo="Prévia do rateio"
        descricao="Divisão estimada entre as cotas ativas da OAS selecionada"
        acao={
          ordens.length ? (
            <select
              className={select + " h-10 w-full sm:w-72"}
              aria-label="Selecionar OAS"
              value={id || ""}
              onChange={(e) => setSel(e.target.value)}
            >
              {ordens.map((o) => (
                <option value={o.id} key={o.id}>
                  OAS {o.numero} · {o.objetivo}
                </option>
              ))}
            </select>
          ) : undefined
        }
      >
        {!id ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma OAS disponível para calcular o rateio.</p>
        ) : divisao.isError ? (
          <p role="alert" className="p-5 text-sm text-destructive">
            {aviso(divisao.error)}
          </p>
        ) : divisao.isPending ? (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            Calculando rateio…
          </p>
        ) : divisao.data?.linhas ? (
          <Grade
            vazio="Nenhuma cota ativa para este rateio."
            titulos={[
              "Cotista",
              divisao.data.uso ? "Horas no período" : "Cota fixa (%)",
              "Participação (%)",
              "Valor previsto",
            ]}
            linhas={divisao.data.linhas.map((r: Linha) => [
              r.nome,
              num(divisao.data!.uso ? r.base / 60 : r.base),
              num(r.percentual),
              formatarMoeda(r.centavos / 100),
            ])}
          />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">{divisao.data?.aviso}</p>
        )}
      </Secao>
      <Secao
        icone={Landmark}
        titulo="Rateios registrados no Financeiro"
        descricao="Despesas da categoria selecionada divididas entre os cotistas"
        acao={
          <label className="flex w-full items-center gap-2 text-xs text-muted-foreground sm:w-auto">
            Categoria
            <select
              className={select + " h-10 min-w-0 flex-1 sm:w-64 sm:flex-none"}
              value={categoria}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="">Selecione</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {financeiro.isError ? (
          <p role="alert" className="p-5 text-sm text-destructive">
            {aviso(financeiro.error)}
          </p>
        ) : financeiro.isPending ? (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            Carregando rateios…
          </p>
        ) : (
          <Grade
            vazio="Nenhum rateio registrado nesta categoria."
            titulos={["Emissão", "Cotista", "Origem", "Despesa", "Situação", "Valor rateado"]}
            linhas={rateios.map((r) => [
              dia(r.competencia),
              r.cotista,
              String(r.dominio).startsWith("HOLD") ? "Holding" : "Cliente",
              r.descricao_despesa,
              r.status,
              formatarMoeda(r.valor_rateado_centavos / 100),
            ])}
          />
        )}
      </Secao>
    </div>
  );
}

export function GraficoCustos({ ordens, indisponivel }: { ordens: Linha[]; indisponivel?: boolean }) {
  const reduzirMovimento = useReducedMotion();
  const meses = new Map<string, { mes: string; pecas: number; servicos: number }>();
  for (const ordem of ordens) {
    if (!ordem.data_entrada || (ordem.total_pecas == null && ordem.total_mao_obra == null)) continue;
    const chave = String(ordem.data_entrada).slice(0, 7);
    const mes = meses.get(chave) ?? { mes: chave.split("-").reverse().join("/"), pecas: 0, servicos: 0 };
    mes.pecas += Number(ordem.total_pecas ?? 0);
    mes.servicos += Number(ordem.total_mao_obra ?? 0);
    meses.set(chave, mes);
  }
  const dados = [...meses]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([, mes]) => mes);
  return (
    <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Custos de manutenção</h2>
      <p className="mt-1 text-xs text-muted-foreground">Peças e mão de obra por mês de entrada na oficina</p>
      {indisponivel || !dados.length ? (
        <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          {indisponivel
            ? "Custos indisponíveis no momento."
            : "Informe o custo de peças ou mão de obra em uma ordem de serviço para preencher o gráfico."}
        </p>
      ) : (
        <div className="mt-4 h-64 min-w-0" aria-label="Gráfico de custos mensais em reais">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ left: 4, right: 6 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="4 4" />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} fontSize={11} />
              <YAxis
                width={55}
                axisLine={false}
                tickLine={false}
                fontSize={11}
                tickFormatter={(valor) => Intl.NumberFormat("pt-BR", { notation: "compact" }).format(valor)}
              />
              <Tooltip
                formatter={(valor) => formatarMoeda(Number(valor))}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="pecas"
                name="Peças"
                fill="#258fd0"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
                isAnimationActive={!reduzirMovimento}
              />
              <Bar
                dataKey="servicos"
                name="Mão de obra"
                fill="#57b498"
                radius={[5, 5, 0, 0]}
                maxBarSize={36}
                isAnimationActive={!reduzirMovimento}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
