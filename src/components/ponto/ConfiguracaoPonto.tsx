import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  carregarConfiguracaoPonto,
  salvarConfiguracaoPonto,
  validarReferenciaPonto,
  type ConfiguracaoPonto as DadosConfiguracao,
} from "@/lib/ponto-api";
const campo =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground";
const box = "rounded-xl border border-border bg-card p-4";
const labels: Record<string, string> = {
  dsr_noturno_percentual: "DSR sobre adicional noturno (%)",
  extra_util_percentual: "Adicional de extra em dia útil (%)",
  extra_domingo_feriado_percentual: "Adicional de extra domingo/feriado (%)",
  dsr_extras_percentual: "DSR sobre hora extra (%)",
  banco_fator_util: "Fator de crédito em dia útil",
  banco_fator_domingo_feriado: "Fator de crédito domingo/feriado",
  carga_semanal_limite_min: "Limite semanal em minutos",
  intervalo_curto_remunerado: "Pausa curta computada como trabalho",
  sobreaviso_validado: "Regra de sobreaviso validada pelo DP",
  antecedencia_escala_dias: "Comunicação prévia da escala (dias)",
  ufs_abrangencia: "UFs de abrangência (separadas por vírgula)",
  tolerancia_atraso_min: "Tolerância de atraso (min)",
  pausa_apos_min: "Alertar pausa após (min)",
  intervalo_longo_min: "Intervalo acima de 6 horas (min)",
  intervalo_curto_min: "Intervalo entre 4 e 6 horas (min)",
  noturno_inicio: "Início do período noturno",
  noturno_fim: "Fim do período noturno",
  hora_noturna_min: "Duração da hora noturna (min)",
  adicional_noturno_percentual: "Adicional noturno (%)",
  sobreaviso_fator: "Fator de sobreaviso",
  banco_horas: "Utilizar banco de horas",
  banco_validade_meses: "Prazo do banco (meses)",
  prorrogacao_noturna: "Considerar prorrogação do noturno",
  fechamento_automatico: "Fechar no dia 1 após conferência e aprovação",
};
export default function ConfiguracaoPonto({
  aoErro,
}: {
  aoErro: (e: unknown) => void;
}) {
  const [baseCct, setBaseCct] = useState<any>(null);
  const [dados, setDados] = useState<DadosConfiguracao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState("");
  const [tipo, setTipo] = useState("12X36");
  const [ciclo, setCiclo] = useState<
    Array<{
      tipo: string;
      entrada?: string;
      saida?: string;
      intervalo_min?: number;
    }>
  >([]);
  const [parametros, setParametros] = useState<
    Record<string, string | number | boolean>
  >({});
  const carregar = async () => {
    const d = await carregarConfiguracaoPonto();
    setDados(d);
    setParametros((p) => (Object.keys(p).length ? p : d.referencia_regras));
    setCiclo((c) => (c.length ? c : d.modelos["12X36"]));
  };
  useEffect(() => {
    void carregar().catch(aoErro);
  }, []);
  const salvar = async (
    tipo: "regras" | "escalas" | "vinculos" | "feriados",
    body: unknown,
  ) => {
    if (ocupado) return;
    setOcupado(true);
    setOk("");
    try {
      await salvarConfiguracaoPonto(tipo, body);
      setOk("Configuração registrada no histórico.");
      await carregar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  };
  const enviar = (
    e: FormEvent<HTMLFormElement>,
    tipo: "regras" | "escalas" | "vinculos" | "feriados",
  ) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(f.entries());
    if (tipo === "regras") {
      body.parametros = parametros;
      body.validar = f.get("validar") === "on";
    }
    if (tipo === "feriados")
      body.recorrente_anual = f.get("recorrente_anual") === "on";
    if (tipo === "vinculos")
      body.anuencia_colaborador = f.get("anuencia_colaborador") === "on";
    if (tipo === "escalas") {
      body.tipo = tipoEscala();
      body.ciclo = ciclo;
    }
    void salvar(tipo, body);
  };
  const tipoEscala = () => tipo;
  if (!dados)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando escalas e regras…
      </p>
    );
  return (
    <div className="space-y-4">
      <div className={box}>
        <h2 className="text-sm font-semibold">
          Regras compartilhadas e versionadas
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          O DP cadastra o documento aplicável, o grupo e a vigência uma vez.
          Novas versões validadas entram em vigor para os colaboradores do
          grupo, sem refazer escalas a cada mês. Marcações permanecem
          disponíveis mesmo quando a regra aguarda validação.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {dados.regras.map((r) => (
            <span
              key={r.id}
              className="rounded-lg border border-border px-3 py-2 text-[11px]"
            >
              {r.nome} · {r.vigencia_inicio} a{" "}
              {r.vigencia_fim || "sem término informado"} ·{" "}
              {r.status === "VALIDADA"
                ? "Validada pelo DP"
                : r.status === "REFERENCIA_INTERNA"
                  ? "Referência interna 2026"
                  : "Rascunho"}
              {dados.permissoes.dp && r.status === "RASCUNHO" && (
                <button
                  type="button"
                  className="ml-2 font-semibold text-primary"
                  disabled={ocupado}
                  onClick={() => {
                    setOcupado(true);
                    void validarReferenciaPonto(r.id)
                      .then(carregar)
                      .catch(aoErro)
                      .finally(() => setOcupado(false));
                  }}
                >
                  Validar referência
                </button>
              )}
            </span>
          ))}
        </div>
        {!dados.permissoes.dp && (
          <p className="mt-3 text-xs text-muted-foreground">
            A configuração é restrita ao DP. Você pode acompanhar as escalas e
            aprovar solicitações da sua equipe.
          </p>
        )}
      </div>
      {ok && (
        <p
          role="status"
          className="text-xs text-emerald-700 dark:text-emerald-300"
        >
          {ok}
        </p>
      )}
      {dados.permissoes.dp && (
        <>
          <div className={box}>
            <h3 className="text-sm font-semibold">Bases disponíveis</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              A referência interna 2026 foi preparada com os parâmetros da CCT
              2025, conforme orientação da empresa. O documento original e sua
              vigência permanecem identificados.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dados.bases_cct.map((b) => (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  key={b.nome}
                  onClick={() => {
                    setBaseCct(b);
                    setParametros(b.parametros);
                  }}
                >
                  {b.nome}
                </Button>
              ))}
            </div>
          </div>
          <form
            key={baseCct?.nome || "nova"}
            onSubmit={(e) => enviar(e, "regras")}
            className={box}
          >
            <h3 className="text-sm font-semibold">Cadastrar versão da regra</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Grupo de regras
                <input
                  name="grupo_codigo"
                  defaultValue={baseCct?.grupo_codigo || ""}
                  required
                  minLength={3}
                  placeholder="Ex.: SINEATA-FENASCON"
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Nome / versão
                <input
                  name="nome"
                  defaultValue={baseCct?.nome || ""}
                  required
                  minLength={3}
                  placeholder="CCT e ano de referência"
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Início de vigência
                <input
                  type="date"
                  name="vigencia_inicio"
                  defaultValue={baseCct?.vigencia_inicio || ""}
                  required
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Fim de vigência
                <input
                  type="date"
                  name="vigencia_fim"
                  defaultValue={baseCct?.vigencia_fim || ""}
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground sm:col-span-2 xl:col-span-4">
                Documento e enquadramento aplicável
                <input
                  name="fonte_documento"
                  defaultValue={baseCct?.fonte_documento || ""}
                  required
                  minLength={5}
                  placeholder="Identificação da CCT/ACT, cláusulas e enquadramento do grupo"
                  className={campo}
                />
              </label>
              {Object.entries(parametros).map(([key, value]) => (
                <label
                  key={key}
                  className="space-y-1 text-[11px] text-muted-foreground"
                >
                  {labels[key] || key}
                  {typeof value === "boolean" ? (
                    <span className="flex h-10 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          setParametros((p) => ({
                            ...p,
                            [key]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      Ativar
                    </span>
                  ) : (
                    <input
                      type={
                        typeof value === "number"
                          ? "number"
                          : /^\d{2}:\d{2}$/.test(String(value))
                            ? "time"
                            : "text"
                      }
                      min={0}
                      step={typeof value === "number" ? "any" : undefined}
                      value={String(value)}
                      onChange={(e) =>
                        setParametros((p) => ({
                          ...p,
                          [key]:
                            typeof value === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      className={campo}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex max-w-2xl items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="validar"
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                Valido o enquadramento e as regras para este grupo conforme o
                documento informado. Sem validação, esta versão ficará em
                rascunho.
              </label>
              <Button disabled={ocupado}>Salvar versão</Button>
            </div>
          </form>
          <form onSubmit={(e) => enviar(e, "escalas")} className={box}>
            <h3 className="text-sm font-semibold">Escala recorrente</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Nome
                <input
                  name="nome"
                  required
                  minLength={3}
                  className={campo}
                  placeholder="Nome da escala"
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Modelo
                <select
                  value={tipo}
                  onChange={(e) => {
                    setTipo(e.target.value);
                    setCiclo(
                      dados.modelos[e.target.value].map((d) => ({ ...d })),
                    );
                  }}
                  className={campo}
                >
                  {[
                    ["12X36", "12 × 36"],
                    ["6X1", "6 × 1"],
                    ["5X2", "5 × 2"],
                    ["ROTATIVA", "Turnos rotativos"],
                    ["SOBREAVISO", "Sobreaviso"],
                  ].map(([id, nome]) => (
                    <option key={id} value={id}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {ciclo.map((dia, indice) => (
                <div
                  key={indice}
                  className="grid items-center gap-2 rounded-lg border border-border p-2 sm:grid-cols-[70px_1fr_1fr_1fr_1fr]"
                >
                  <span className="text-xs">Dia {indice + 1}</span>
                  <label className="text-[10px] text-muted-foreground">
                    Situação
                    <select
                      aria-label={`Situação do dia ${indice + 1}`}
                      value={dia.tipo}
                      onChange={(e) =>
                        setCiclo((c) =>
                          c.map((d, i) =>
                            i === indice
                              ? {
                                  ...d,
                                  tipo: e.target.value,
                                  entrada: d.entrada || "08:00",
                                  saida: d.saida || "18:00",
                                  intervalo_min: d.intervalo_min || 0,
                                }
                              : d,
                          ),
                        )
                      }
                      className={campo}
                    >
                      <option value="TRABALHO">Trabalho</option>
                      <option value="FOLGA">Folga</option>
                      <option value="SOBREAVISO">Sobreaviso</option>
                    </select>
                  </label>
                  {["entrada", "saida", "intervalo_min"].map((key) => (
                    <label
                      key={key}
                      className="text-[10px] text-muted-foreground"
                    >
                      {key === "intervalo_min"
                        ? "Intervalo (min)"
                        : key === "entrada"
                          ? "Entrada"
                          : "Saída"}
                      <input
                        aria-label={`${key} do dia ${indice + 1}`}
                        type={key === "intervalo_min" ? "number" : "time"}
                        min={0}
                        value={String((dia as any)[key] ?? "")}
                        disabled={dia.tipo === "FOLGA"}
                        onChange={(e) =>
                          setCiclo((c) =>
                            c.map((d, i) =>
                              i === indice
                                ? {
                                    ...d,
                                    [key]:
                                      key === "intervalo_min"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }
                                : d,
                            ),
                          )
                        }
                        className={campo}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between gap-2">
              {tipo === "ROTATIVA" && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setCiclo((c) => [...c, { tipo: "FOLGA" }])}
                  disabled={ciclo.length >= 62}
                >
                  Adicionar dia ao ciclo
                </Button>
              )}
              <Button disabled={ocupado}>Salvar escala</Button>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              O ciclo se repete a partir da data-base do vínculo. Turnos que
              terminam em horário menor que a entrada atravessam a meia-noite.
            </p>
          </form>
          <form onSubmit={(e) => enviar(e, "vinculos")} className={box}>
            <h3 className="text-sm font-semibold">
              Vincular colaborador à escala e ao grupo
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Colaborador
                <select required name="user_id" className={campo}>
                  <option value="">Selecione</option>
                  {dados.equipe.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.nome_completo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Escala
                <select required name="escala_id" className={campo}>
                  <option value="">Selecione</option>
                  {dados.escalas.map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Regra validada do grupo
                <select required name="regra_id" className={campo}>
                  <option value="">Selecione</option>
                  {dados.regras
                    .filter((r) =>
                      ["VALIDADA", "REFERENCIA_INTERNA"].includes(r.status),
                    )
                    .map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Gestor responsável
                <select required name="gestor_id" className={campo}>
                  <option value="">Selecione</option>
                  {dados.gestores.map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.nome_completo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Data-base (dia 1 do ciclo)
                <input
                  type="date"
                  required
                  name="data_base"
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Início do vínculo
                <input
                  type="date"
                  required
                  name="vigencia_inicio"
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Escala comunicada em
                <input
                  type="date"
                  required
                  name="comunicada_em"
                  className={campo}
                />
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Justificativa de força maior (se necessária)
                <input name="justificativa_escala" className={campo} />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="anuencia_colaborador" />
                Anuência do colaborador em alteração excepcional
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                Fuso da jornada
                <select
                  required
                  name="fuso_horario"
                  defaultValue="America/Cuiaba"
                  className={campo}
                >
                  <option value="America/Cuiaba">Cuiabá (MT)</option>
                  <option value="America/Sao_Paulo">
                    Brasília / São Paulo
                  </option>
                  <option value="America/Manaus">Manaus</option>
                  <option value="America/Rio_Branco">Rio Branco</option>
                  <option value="America/Recife">Recife</option>
                  <option value="America/Belem">Belém</option>
                  <option value="America/Campo_Grande">Campo Grande</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button disabled={ocupado}>Salvar vínculo</Button>
            </div>
          </form>
          <form onSubmit={(e) => enviar(e, "feriados")} className={box}>
            <h3 className="text-sm font-semibold">Calendário de feriados</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Feriados nacionais fixos já estão cadastrados. Inclua datas
              estaduais, municipais e móveis conforme o local de trabalho.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-[11px] text-muted-foreground">
                Data
                <input type="date" name="data" required className={campo} />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Nome
                <input name="nome" required minLength={3} className={campo} />
              </label>
              <label className="text-[11px] text-muted-foreground">
                UF (vazio: nacional)
                <input
                  name="uf"
                  maxLength={2}
                  placeholder="MT"
                  className={campo}
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Município (opcional)
                <input name="municipio" className={campo} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="recorrente_anual" />
                Repetir nesta data nos próximos anos
              </label>
              <Button disabled={ocupado}>Salvar feriado</Button>
            </div>
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">
              {dados.feriados.map((f) => (
                <span
                  key={f.id}
                  className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground"
                >
                  {f.nome} · {f.data.slice(5).split("-").reverse().join("/")} ·{" "}
                  {f.municipio || f.uf || "Nacional"}
                </span>
              ))}
            </div>
          </form>
        </>
      )}
      <section className={box}>
        <h3 className="text-sm font-semibold">Vínculos cadastrados</h3>
        <div className="mt-3 divide-y divide-border">
          {dados.vinculos.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap justify-between gap-2 py-3 text-xs"
            >
              <span>
                {dados.equipe.find((u) => u.id === v.user_id)?.nome_completo ||
                  "Colaborador"}{" "}
                ·{" "}
                {dados.escalas.find((e) => e.id === v.escala_id)?.nome ||
                  "Escala"}
              </span>
              <span className="text-muted-foreground">
                Desde {v.vigencia_inicio} · {v.fuso_horario}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
