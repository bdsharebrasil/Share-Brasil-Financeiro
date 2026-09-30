import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronLeft, CalendarRange, FolderOpen, MoreVertical, Download, Edit3, Fuel, MapPin, Plane, Plus, Search, Upload, X, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";
import { anexarArquivoAbastecimento, atualizarAbastecimento, baixarArquivoAbastecimento, buscarAbastecimentoOpcoes, buscarAbastecimentos, criarAbastecimento, criarFornecedorAbastecimento, atualizarFornecedorAbastecimento, excluirAbastecimento, type Abastecimento, type AbastecimentoOpcoes, type FornecedorCombustivel } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const emptyForm = {
  abastecimento_id: "",
  aeronave_id: "",
  data: new Date().toISOString().slice(0, 10),
  tipo_combustivel: "JET A1",
  trecho: "",
  local: "",
  numero_comanda: "",
  numero_nf: "",
  litros: "",
  valor_unitario: "",
  valor_total: "",
  desconto: "",
  fornecedor_id: "",
  status: "pendente",
  observacao: "",
  forma_pagamento: "",
  data_vencimento_boleto: "",
  lancamento_diario_id: "",
  data_pagamento: "",
  voo_emprestado: false,
  numero_voo: "",
};

type Form = typeof emptyForm;

export default function ControleAbastecimento({ aoVoltar }: { aoVoltar?: () => void }) {
  const [tab, setTab] = useState<"registros" | "fornecedores">("registros");
  const [options, setOptions] = useState<AbastecimentoOpcoes | null>(null);
  const [records, setRecords] = useState<Abastecimento[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [files, setFiles] = useState<Record<"comanda" | "nota" | "boleto" | "comprovante", File | null>>({ comanda: null, nota: null, boleto: null, comprovante: null });
  const [persistedRecordId, setPersistedRecordId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [filters, setFilters] = useState({
    inicio: "",
    fim: "",
    aeronave_id: "",
    fornecedor_id: "",
    status: "",
    valor_min: "",
    valor_max: "",
    busca: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [op, list] = await Promise.all([buscarAbastecimentoOpcoes(), buscarAbastecimentos(filters)]);
      setOptions({
        clientes: Array.isArray(op?.clientes) ? op.clientes : [],
        socios: Array.isArray(op?.socios) ? op.socios : [],
        aeronaves: Array.isArray(op?.aeronaves) ? op.aeronaves : [],
        fornecedores: Array.isArray(op?.fornecedores) ? op.fornecedores : [],
        diarios: Array.isArray(op?.diarios) ? op.diarios : [],
        aerodromos: Array.isArray(op?.aerodromos) ? op.aerodromos : [],
      });
      setRecords(Array.isArray(list?.abastecimentos) ? list.abastecimentos : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os abastecimentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const cotistasDisponiveis = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; quantidade: number }>();
    (options?.clientes || []).forEach((cotista) => {
      if (cotista.id) mapa.set(cotista.id, { id: cotista.id, nome: cotista.nome || "Cotista sem nome", quantidade: 0 });
    });
    (options?.socios || []).forEach((cotista) => {
      if (cotista.id && !mapa.has(cotista.id)) mapa.set(cotista.id, { id: cotista.id, nome: cotista.nome || "Cotista sem nome", quantidade: 0 });
    });
    records.forEach((item) => {
      const id = item.cliente_id || item.socio_id;
      if (!id) return;
      const atual = mapa.get(id);
      if (atual) atual.quantidade += 1;
      else mapa.set(id, { id, nome: item.cliente_nome || item.socio_nome || "Cotista sem nome", quantidade: 1 });
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [options, records]);

  const cotistasFiltrados = useMemo(() => cotistasDisponiveis.filter((cotista) => cotista.nome.toLowerCase().includes(buscaCliente.toLowerCase())), [cotistasDisponiveis, buscaCliente]);

  const registrosCliente = useMemo(() => {
    if (!clienteSelecionado) return [];
    let itens = records.filter((item) => item.cliente_id === clienteSelecionado || item.socio_id === clienteSelecionado);
    if (filters.busca) {
      const termo = filters.busca.toLowerCase();
      itens = itens.filter((item) => item.trecho?.toLowerCase().includes(termo) || item.local?.toLowerCase().includes(termo) || item.numero_comanda?.toLowerCase().includes(termo) || item.numero_nf?.toLowerCase().includes(termo));
    }
    if (filters.status) itens = itens.filter((item) => item.status === filters.status);
    return itens.sort((a, b) => new Date(b.data || "").getTime() - new Date(a.data || "").getTime());
  }, [clienteSelecionado, records, filters]);

  const registrosClientePorMes = useMemo(() => {
    const grupos = new Map<string, Abastecimento[]>();
    registrosCliente.forEach((item) => {
      const mes = String(item.data || "").slice(0, 7) || "sem-data";
      grupos.set(mes, [...(grupos.get(mes) || []), item]);
    });
    return Array.from(grupos.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [registrosCliente]);

  const nomeClienteSelecionado = cotistasDisponiveis.find((cotista) => cotista.id === clienteSelecionado)?.nome || "Cotista";

  const totalLitrosCliente = useMemo(() => registrosCliente.reduce((sum, item) => sum + Number(item.litros || 0), 0), [registrosCliente]);
  const totalValorCliente = useMemo(() => registrosCliente.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [registrosCliente]);

  const setField = (key: keyof Form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setPersistedRecordId(null);
    setFiles({ comanda: null, nota: null, boleto: null, comprovante: null });
    setForm(emptyForm);
  };

  const editRecord = (item: Abastecimento) => {
    setEditing(item);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(
        Object.entries(item)
          .filter(([key]) => key in emptyForm)
          .map(([key, value]) => [key, key === "voo_emprestado" ? Boolean(value) : value == null ? "" : String(value)])
      ),
    } as Form);
    setFiles({ comanda: null, nota: null, boleto: null, comprovante: null });
    setPersistedRecordId(item.id);
    setFormOpen(true);
  };

  const save = async () => {
    const litros = Number(form.litros);
    const valorTotal = Number(form.valor_total || litros * Number(form.valor_unitario || 0));
    if (!form.data || !form.local || !form.aeronave_id || !Number.isFinite(litros) || litros <= 0 || !Number.isFinite(valorTotal) || valorTotal <= 0) {
      setError("Informe data, local, aeronave, litros e valor total válidos.");
      return;
    }
    if (form.status === "pago" && !form.data_pagamento) {
      setError("Informe a data do pagamento para um abastecimento pago.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        abastecimento_id: undefined,
        litros,
        valor_unitario: Number(form.valor_unitario || valorTotal / litros),
        valor_total: valorTotal,
        desconto: form.desconto ? Number(form.desconto) : null,
        voo_emprestado: Boolean(form.voo_emprestado),
      };

      let recordId = editing?.id || persistedRecordId;
      if (recordId) {
        await atualizarAbastecimento(recordId, payload);
      } else {
        const created = await criarAbastecimento(payload);
        recordId = created.id;
        setPersistedRecordId(recordId);
      }
      if (!recordId) throw new Error("O Worker não retornou o ID do abastecimento.");

      const failedUploads: string[] = [];
      for (const type of ["comanda", "nota", "boleto", "comprovante"] as const) {
        const file = files[type];
        if (!file) continue;
        try {
          await anexarArquivoAbastecimento(recordId, type, file);
          setFiles((current) => ({ ...current, [type]: null }));
        } catch {
          failedUploads.push(type);
        }
      }

      if (failedUploads.length) {
        setError(`Abastecimento salvo. Não foi possível enviar: ${failedUploads.join(", ")}.`);
        await load();
        return;
      }

      setMessage(editing ? "Abastecimento atualizado." : "Abastecimento registrado.");
      closeForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o abastecimento.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este abastecimento?")) return;
    try {
      await excluirAbastecimento(id);
      setMessage("Abastecimento excluído.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o abastecimento.");
    }
  };

  const upload = async (id: string, type: "comanda" | "nota" | "boleto" | "comprovante", file?: File) => {
    if (!file) return;
    try {
      await anexarArquivoAbastecimento(id, type, file);
      setMessage("Arquivo anexado.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível anexar o arquivo.");
    }
  };

  const download = async (id: string, type: "comanda" | "nota" | "boleto" | "comprovante") => {
    try {
      const blob = await baixarArquivoAbastecimento(id, type);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `abastecimento-${id}-${type}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível baixar o arquivo.");
    }
  };

  return (
    <div className="diario-bordo route-enter space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <IndicadorPagina>Operações / Controle de Abastecimento</IndicadorPagina>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">
            <Fuel className="text-primary" size={26} /> Controle de Abastecimento
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Gestão operacional e financeira dos abastecimentos de combustível.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {aoVoltar && (
            <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-1.5 text-[10px]">
              <ChevronLeft size={13} /> Voltar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="h-9 gap-1.5 text-[10px]">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </div>

      {/* ALERTAS */}
      {(message || error) && (
        <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
          {error || message}
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/20 px-3 pt-2 rounded-t-xl">
        <button type="button" onClick={() => setTab("registros")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${tab === "registros" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Fuel size={13} className="mr-1.5 inline" /> Histórico de abastecimentos
        </button>
        <button type="button" onClick={() => setTab("fornecedores")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${tab === "fornecedores" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Building2 size={13} className="mr-1.5 inline" /> Fornecedores
        </button>
      </div>

      {tab === "fornecedores" ? (
        <FornecedorTab options={options} onSaved={() => void load()} onError={setError} />
      ) : (
        <>
          {formOpen && (
            <div className="mb-6">
              <AbastecimentoForm form={form} options={options} editing={editing} saving={saving} files={files} setFiles={setFiles} setField={setField} onClose={closeForm} onSave={() => void save()} />
            </div>
          )}

          {!clienteSelecionado ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Cotistas</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Todos os cotistas cadastrados aparecem aqui. A organização mensal fica dentro do perfil.</p>
                </div>
                <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 sm:w-auto">
                  <Search size={13} className="text-muted-foreground" />
                  <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar cotista..." className="w-full bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground sm:w-48" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)
                ) : cotistasFiltrados.length ? (
                  cotistasFiltrados.map((item) => (
                    <button key={item.id} type="button" onClick={() => setClienteSelecionado(item.id)} className={`${card} group relative flex flex-col p-4 text-left transition-all hover:border-primary/50 hover:bg-card`}>
                      <div className="mb-4 flex items-start justify-between">
                        <span className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Building2 size={16} />
                        </span>
                        <span className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[9px] font-bold text-muted-foreground">
                          {item.quantidade} registro{item.quantidade === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h3 className="truncate text-sm font-bold text-foreground">{item.nome}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{item.quantidade ? `${item.quantidade} abastecimento${item.quantidade === 1 ? "" : "s"}` : "Nenhum abastecimento ainda"}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                        <span>Ver histórico</span>
                        <ChevronLeft size={12} className="rotate-180 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full">
                    <EstadoVazio label="Nenhum cotista encontrado" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setClienteSelecionado(null)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <ChevronLeft size={14} /> Voltar para cotistas
                </button>
                <Button type="button" onClick={() => { closeForm(); setFormOpen(true); }} className="h-9 gap-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-extrabold">
                  <Plus size={13} /> Novo registro
                </Button>
              </div>

              {/* RESUMO DO COTISTA */}
              <div className="mb-1"><h2 className="text-lg font-bold">{nomeClienteSelecionado}</h2><p className="text-xs text-muted-foreground">Histórico separado por mês</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Registros encontrados" value={String(registrosCliente.length)} icon={<FolderOpen size={14} />} />
                <StatTile label="Volume total" value={`${totalLitrosCliente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} L`} icon={<Fuel size={14} />} />
                <StatTile label="Valor total" value={money(totalValorCliente)} icon={<FileText size={14} />} accent="text-emerald-400" />
              </div>

              {/* FILTROS E TABELA */}
              <section className={`${card} overflow-hidden p-4`}>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Buscar</span>
                    <input value={filters.busca} onChange={(e) => setFilters({ ...filters, busca: e.target.value })} placeholder="Trecho, local, comanda..." className="campo" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                    <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="campo">
                      <option value="">Todos</option>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </label>
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Voo / Matrícula</th>
                        <th className="px-4 py-3">Trecho</th>
                        <th className="px-4 py-3">Local</th>
                        <th className="px-4 py-3">Comanda</th>
                        <th className="px-4 py-3">N.F.</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Litros</th>
                        <th className="px-4 py-3 text-right">Valor Unit.</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-foreground">
                      {registrosCliente.length ? (
                        registrosClientePorMes.map(([mes, registros]) => (
                          <Fragment key={mes}>
                            <tr><td colSpan={11} className="border-y border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-primary">{mes === "sem-data" ? "Sem data" : new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} · {registros.length} registro{registros.length === 1 ? "" : "s"}</td></tr>
                            {registros.map((record) => <AbastecimentoRow key={record.id} record={record} onEdit={editRecord} onDelete={remove} onUpload={upload} onDownload={download} />)}
                          </Fragment>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado para este cliente.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">
                  {registrosCliente.length ? registrosClientePorMes.map(([mes, registros]) => <section key={mes} className="space-y-2"><h3 className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary">{mes === "sem-data" ? "Sem data" : new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>{registros.map((record) => <AbastecimentoCard key={record.id} record={record} onEdit={editRecord} onDelete={remove} onUpload={upload} onDownload={download} />)}</section>) : <EstadoVazio label="Nenhum registro encontrado para este cotista." />}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, icon, accent = "text-foreground", className = "" }: { label: string; value: string; icon?: ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`${card} p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className={`truncate text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function AbastecimentoCard({ record, onEdit, onDelete, onUpload, onDownload }: { record: Abastecimento; onEdit: (record: Abastecimento) => void; onDelete: (id: string) => void; onUpload: (id: string, type: "comanda" | "nota" | "boleto" | "comprovante", file?: File) => void; onDownload: (id: string, type: "comanda" | "nota" | "boleto" | "comprovante") => void }) {
  const pago = record.status === "pago";
  const fileType = record.comanda_url ? "comanda" : record.nota_url ? "nota" : record.boleto_url ? "boleto" : "comprovante";
  return <article className="rounded-xl border border-border/70 bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[10px] font-bold text-primary">{record.numero_voo || record.matricula_registro || "Abastecimento"}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{record.trecho || "Trecho não informado"}</p></div><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pago ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : record.status === "cancelado" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-400/30 bg-amber-400/10 text-amber-400"}`}>{pago ? "Pago" : record.status === "cancelado" ? "Cancelado" : "Pendente"}</span></div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]"><div><span className="block text-[9px] text-muted-foreground">Data / local</span><strong>{date(record.data)} · {record.local || "—"}</strong></div><div><span className="block text-[9px] text-muted-foreground">Volume</span><strong className="font-mono">{Number(record.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} L</strong></div><div><span className="block text-[9px] text-muted-foreground">Comanda / NF</span><strong className="font-mono">{record.numero_comanda || "—"} · {record.numero_nf || "—"}</strong></div><div><span className="block text-[9px] text-muted-foreground">Total</span><strong className="font-mono text-emerald-400">{money(record.valor_total)}</strong></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(record)} className="min-h-9 flex-1 rounded-lg border border-primary/30 px-3 py-2 text-[10px] font-bold text-primary">Editar</button>{record.comanda_url || record.nota_url || record.boleto_url ? <button type="button" onClick={() => void onDownload(record.id, fileType)} className="min-h-9 rounded-lg border border-border px-3 py-2 text-[10px] font-bold">Baixar</button> : <label className="flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border px-3 py-2 text-[10px] font-bold"><Upload size={12} className="mr-1" /> Anexar<input className="hidden" type="file" accept="application/pdf,image/*" onChange={(event) => void onUpload(record.id, "comanda", event.target.files?.[0])} /></label>}<button type="button" onClick={() => void onDelete(record.id)} className="min-h-9 rounded-lg border border-destructive/30 px-3 py-2 text-[10px] font-bold text-destructive">Excluir</button></div></article>;
}

function AbastecimentoRow({ record, onEdit, onDelete, onUpload, onDownload }: { record: Abastecimento; onEdit: (record: Abastecimento) => void; onDelete: (id: string) => void; onUpload: (id: string, type: "comanda" | "nota" | "boleto" | "comprovante", file?: File) => void; onDownload: (id: string, type: "comanda" | "nota" | "boleto" | "comprovante") => void }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pago = record.status === "pago";
  const fileType = record.comanda_url ? "comanda" : record.nota_url ? "nota" : record.boleto_url ? "boleto" : "comprovante";

  return (
    <tr className="border-b border-border/60 bg-card/40 hover:bg-primary/5">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{date(record.data)}</td>
      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{record.numero_voo || record.matricula_registro || "—"}</td>
      <td className="px-4 py-3 font-mono text-xs">{record.trecho || "—"}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground"><div className="flex items-center gap-1"><MapPin size={12} />{record.local || "—"}</div></td>
      <td className="px-4 py-3 font-mono text-xs">{record.numero_comanda || "—"}</td>
      <td className="px-4 py-3 font-mono text-xs">{record.numero_nf || "—"}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pago ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : record.status === "cancelado" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-400/30 bg-amber-400/10 text-amber-400"}`}>
          {pago ? "Pago" : record.status === "cancelado" ? "Cancelado" : "Pendente"}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">{Number(record.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} L</td>
      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{money(record.valor_unitario)}</td>
      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-400">{money(record.valor_total)}</td>
      <td className="relative px-4 py-3 text-right">
        <div className="flex justify-end">
          <button type="button" onClick={() => setMenuAberto(!menuAberto)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground">
            <MoreVertical size={14} />
          </button>
          {menuAberto && (
            <div className="absolute right-4 top-10 z-20 w-40 flex flex-col rounded-xl border border-border bg-card p-1 text-left shadow-xl">
              <button type="button" onClick={() => { setMenuAberto(false); onEdit(record); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary">
                <Edit3 size={13} /> Editar
              </button>
              {record.comanda_url || record.nota_url || record.boleto_url || record.comprovante_url ? (
                <button type="button" onClick={() => { setMenuAberto(false); void onDownload(record.id, fileType); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary">
                  <Download size={13} /> Baixar arquivo
                </button>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary">
                  <Upload size={13} /> Anexar comanda
                  <input className="hidden" type="file" accept="application/pdf,image/*" onChange={(e) => { setMenuAberto(false); void onUpload(record.id, "comanda", e.target.files?.[0]); }} />
                </label>
              )}
              <button type="button" onClick={() => { setMenuAberto(false); void onDelete(record.id); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10">
                <X size={13} /> Excluir
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AbastecimentoForm({ form, options, editing, saving, files, setFiles, setField, onClose, onSave }: { form: Form; options: AbastecimentoOpcoes | null; editing: Abastecimento | null; saving: boolean; files: Record<"comanda" | "nota" | "boleto" | "comprovante", File | null>; setFiles: React.Dispatch<React.SetStateAction<Record<"comanda" | "nota" | "boleto" | "comprovante", File | null>>>; setField: (key: keyof Form, value: string | boolean) => void; onClose: () => void; onSave: () => void }) {
  const aeronaves = Array.isArray(options?.aeronaves) ? options.aeronaves : [];
  const fornecedores = Array.isArray(options?.fornecedores) ? options.fornecedores : [];
  const diarios = (options?.diarios || []).filter((diario: any) => diario.aeronave_id === form.aeronave_id);
  const addFile = (type: "comanda" | "nota" | "boleto" | "comprovante", file?: File) => setFiles((current) => ({ ...current, [type]: file || null }));

  return (
    <section className={`${card} p-5 space-y-4`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? "Editar abastecimento" : "Novo abastecimento"}</h3>
        <button type="button" onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Aeronave *</span><SearchableCombobox items={aeronaves.map((a) => ({ id: a.id, label: `${a.matricula_registro} · ${a.fabricante || ""} ${a.modelo || ""}` }))} value={form.aeronave_id} onChange={(value) => { setField("aeronave_id", value); setField("lancamento_diario_id", ""); setField("abastecimento_id", ""); setField("numero_voo", ""); setField("trecho", ""); }} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave encontrada." icon={<Plane size={14} />} /></div>
        <div className="space-y-1"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Número do voo</span><SearchableCombobox items={diarios.filter((d: any) => d.numero_voo).map((d: any) => ({ id: d.id, label: `${d.numero_voo} · ${date(d.data_registro)} · ${d.trecho || `${d.aerodromo_partida} X ${d.aerodromo_chegada}`}` }))} value={form.lancamento_diario_id} onChange={(value) => { const diario = diarios.find((item: any) => item.id === value) as any; setField("lancamento_diario_id", value); if (!diario) return; setField("numero_voo", diario.numero_voo || ""); setField("data", String(diario.data_registro || "").slice(0, 10)); setField("trecho", diario.trecho || `${diario.aerodromo_partida || ""} X ${diario.aerodromo_chegada || ""}`); setField("local", diario.local_combustivel || diario.aerodromo_partida || ""); setField("voo_emprestado", Boolean(diario.voo_emprestado)); setField("abastecimento_id", diario.abastecimento_id || ""); setField("numero_comanda", diario.abastecimento_numero_comanda || ""); setField("numero_nf", diario.abastecimento_numero_nf || ""); setField("litros", diario.abastecimento_litros == null ? "" : String(diario.abastecimento_litros)); setField("valor_unitario", diario.abastecimento_valor_unitario == null ? "" : String(diario.abastecimento_valor_unitario)); setField("valor_total", diario.abastecimento_valor_total == null ? "" : String(diario.abastecimento_valor_total)); setField("desconto", diario.abastecimento_desconto == null ? "" : String(diario.abastecimento_desconto)); setField("fornecedor_id", diario.abastecimento_fornecedor_id || ""); setField("tipo_combustivel", diario.abastecimento_tipo_combustivel || form.tipo_combustivel); }} placeholder={form.aeronave_id ? "Selecione o voo (opcional)" : "Selecione primeiro a aeronave"} searchPlaceholder="Buscar número do voo" emptyMessage="Nenhum voo encontrado para a aeronave." icon={<Plane size={14} />} disabled={!form.aeronave_id} clearable /></div>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Data *</span><input type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} className="campo font-mono" /></label>
        <div className="space-y-1"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Local / aeródromo *</span><SearchableCombobox items={(options?.aerodromos || []).map((a: any) => ({ id: a.id, label: `${a.designativo_icao || a.id} · ${a.nome || ""}` }))} value={form.local} onChange={(value) => setField("local", value)} placeholder="Selecione o aeródromo" searchPlaceholder="Buscar ICAO ou nome" emptyMessage="Nenhum aeródromo encontrado." icon={<MapPin size={14} />} /></div>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Trecho</span><input readOnly placeholder="Preenchido pelo número do voo" value={form.trecho} className="campo font-mono bg-muted/30" /></label>
        <div className="space-y-1"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Fornecedor</span><SearchableCombobox items={fornecedores.map((f) => ({ id: f.id, label: `${f.nome_fornecedor} · ${f.nome_cidade}${f.codigo_icao ? ` · ${f.codigo_icao}` : ""}` }))} value={form.fornecedor_id} onChange={(value) => setField("fornecedor_id", value)} placeholder="Selecione o fornecedor" searchPlaceholder="Buscar fornecedor" emptyMessage="Nenhum fornecedor de combustível encontrado." icon={<Building2 size={14} />} /></div>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Combustível</span><select value={form.tipo_combustivel} onChange={(e) => setField("tipo_combustivel", e.target.value)} className="campo"><option>JET A1</option><option>AVGAS</option></select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Nº Comanda</span><input placeholder="Comanda" value={form.numero_comanda} onChange={(e) => setField("numero_comanda", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Nº NF</span><input placeholder="NF" value={form.numero_nf} onChange={(e) => setField("numero_nf", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Litros</span><input type="number" step="0.01" value={form.litros} onChange={(e) => setField("litros", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Valor Unitário</span><input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setField("valor_unitario", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Desconto (R$)</span><input type="number" step="0.01" value={form.desconto} onChange={(e) => setField("desconto", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Valor Total (R$) *</span><input type="number" step="0.01" value={form.valor_total} onChange={(e) => setField("valor_total", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Pagamento</span><select value={form.status} onChange={(e) => setField("status", e.target.value)} className="campo"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Forma de pagamento</span><select value={form.forma_pagamento} onChange={(e) => setField("forma_pagamento", e.target.value)} className="campo"><option value="">Selecionar</option><option value="PIX">PIX</option><option value="Cartão de crédito">Cartão de crédito</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option><option value="Dinheiro">Dinheiro</option></select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Vencimento do boleto</span><input type="date" value={form.data_vencimento_boleto} onChange={(e) => setField("data_vencimento_boleto", e.target.value)} className="campo font-mono" /></label>
        {form.status === "pago" && <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Data do pagamento</span><input type="date" value={form.data_pagamento} onChange={(e) => setField("data_pagamento", e.target.value)} className="campo font-mono" /></label>}
        <label className="flex items-center gap-2 pt-6 text-[10px] font-bold uppercase text-muted-foreground"><input type="checkbox" checked={Boolean(form.voo_emprestado)} onChange={(e) => setField("voo_emprestado", e.target.checked)} />Voo emprestado</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["comanda", "nota", "boleto", "comprovante"] as const).map((type) => {
          const existingUrl = type === "comanda" ? editing?.comanda_url : type === "nota" ? editing?.nota_url : type === "boleto" ? editing?.boleto_url : editing?.comprovante_url;
          const labels = { comanda: "Comanda", nota: "Nota fiscal", boleto: "Boleto", comprovante: "Comprovante" };
          return <AnexosDinamicos key={type} file={files[type]} onFileChange={(file) => addFile(type, file || undefined)} existingUrl={existingUrl} existingName={existingUrl ? `${labels[type]} já anexado` : null} label={labels[type]} description="PDF ou imagem" />;
        })}
      </div>

      <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Observações</span><textarea value={form.observacao} onChange={(e) => setField("observacao", e.target.value)} className="campo min-h-20 resize-y" /></label>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="h-9">Cancelar</Button>
        <Button type="button" disabled={saving} onClick={onSave} className="h-9 bg-primary text-primary-foreground font-bold">{saving ? "Salvando..." : "Salvar abastecimento"}</Button>
      </div>
    </section>
  );
}

type FornecedorForm = { nome_cidade: string; codigo_icao: string; nome_fornecedor: string; pessoa_contato: string; telefone: string; preco_avgas: string; preco_jet: string };
const emptyFornecedor: FornecedorForm = { nome_cidade: "", codigo_icao: "", nome_fornecedor: "", pessoa_contato: "", telefone: "", preco_avgas: "", preco_jet: "" };

function FornecedorCard({ supplier, onEdit }: { supplier: FornecedorCombustivel; onEdit: (supplier: FornecedorCombustivel) => void }) {
  return <article className="rounded-xl border border-border/70 bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold">{supplier.nome_fornecedor}</p><p className="mt-1 font-mono text-[9px] text-primary">{supplier.codigo_icao || "ICAO não informado"}</p></div><span className="text-right text-[10px] font-semibold text-muted-foreground">{supplier.nome_cidade || "Cidade não informada"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div><span className="block text-[9px] text-muted-foreground">Telefone</span><strong className="font-mono">{supplier.telefone || "—"}</strong></div><div><span className="block text-[9px] text-muted-foreground">AVGAS / JET</span><strong className="font-mono text-emerald-400">{Number(supplier.preco_avgas || 0) ? money(Number(supplier.preco_avgas)) : "—"} · {Number(supplier.preco_jet || 0) ? money(Number(supplier.preco_jet)) : "—"}</strong></div></div><button type="button" onClick={() => onEdit(supplier)} className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-primary"><Edit3 size={12} /> Editar fornecedor</button></article>;
}

function FornecedorTab({ options, onSaved, onError }: { options: AbastecimentoOpcoes | null; onSaved: () => void; onError: (msg: string) => void }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FornecedorForm>(emptyFornecedor);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const suppliers = (options?.fornecedores || []).filter((supplier) => [supplier.nome_fornecedor, supplier.nome_cidade, supplier.codigo_icao, supplier.pessoa_contato].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));
  const setField = (key: keyof FornecedorForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const editSupplier = (supplier: FornecedorCombustivel) => {
    setEditingId(supplier.id);
    setForm({ nome_cidade: supplier.nome_cidade, codigo_icao: supplier.codigo_icao || "", nome_fornecedor: supplier.nome_fornecedor, pessoa_contato: supplier.pessoa_contato || "", telefone: supplier.telefone || "", preco_avgas: supplier.preco_avgas == null ? "" : String(supplier.preco_avgas), preco_jet: supplier.preco_jet == null ? "" : String(supplier.preco_jet) });
    setFormOpen(true);
  };
  const closeForm = () => { setForm(emptyFornecedor); setEditingId(null); setFormOpen(false); };
  const saveSupplier = async () => {
    if (!form.nome_cidade.trim() || !form.nome_fornecedor.trim()) { onError("Informe a cidade e o nome do fornecedor."); return; }
    const precoAvgas = form.preco_avgas.trim() ? Number(form.preco_avgas) : null;
    const precoJet = form.preco_jet.trim() ? Number(form.preco_jet) : null;
    if ([precoAvgas, precoJet].some((preco) => preco != null && (!Number.isFinite(preco) || preco < 0))) { onError("Informe preços válidos e não negativos."); return; }
    const payload = { nome_cidade: form.nome_cidade.trim(), codigo_icao: form.codigo_icao.trim().toUpperCase() || null, nome_fornecedor: form.nome_fornecedor.trim(), pessoa_contato: form.pessoa_contato.trim() || null, telefone: form.telefone.trim() || null, preco_avgas: precoAvgas, preco_jet: precoJet };
    setSaving(true);
    try {
      if (editingId) await atualizarFornecedorAbastecimento(editingId, payload);
      else await criarFornecedorAbastecimento(payload);
      closeForm();
      onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 sm:w-auto">
          <Search size={13} className="text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar fornecedor..." className="w-full bg-transparent text-xs outline-none text-foreground sm:w-64" />
        </div>
        <Button type="button" onClick={() => { closeForm(); setFormOpen(true); }} className="h-9 gap-1.5"><Plus size={13} /> Novo fornecedor</Button>
      </div>

      {formOpen && <section className={`${card} space-y-3 p-4`}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{editingId ? "Editar fornecedor" : "Novo fornecedor"}</h3><button type="button" onClick={closeForm} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"><X size={14} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Cidade *</span><input value={form.nome_cidade} onChange={(event) => setField("nome_cidade", event.target.value)} className="campo" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">ICAO</span><input maxLength={4} value={form.codigo_icao} onChange={(event) => setField("codigo_icao", event.target.value)} className="campo font-mono uppercase" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Fornecedor *</span><input value={form.nome_fornecedor} onChange={(event) => setField("nome_fornecedor", event.target.value)} className="campo" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Pessoa de contato</span><input value={form.pessoa_contato} onChange={(event) => setField("pessoa_contato", event.target.value)} className="campo" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Telefone</span><input value={form.telefone} onChange={(event) => setField("telefone", event.target.value)} className="campo" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Preço AVGAS</span><input type="number" min="0" step="0.01" value={form.preco_avgas} onChange={(event) => setField("preco_avgas", event.target.value)} className="campo font-mono" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Preço JET</span><input type="number" min="0" step="0.01" value={form.preco_jet} onChange={(event) => setField("preco_jet", event.target.value)} className="campo font-mono" /></label>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button><Button type="button" disabled={saving} onClick={() => void saveSupplier()}>{saving ? "Salvando..." : "Salvar fornecedor"}</Button></div>
      </section>}

      <section className={`${card} overflow-hidden p-4`}>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead><tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Cidade</th><th className="px-4 py-3">ICAO</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3 text-right">Preço AVGAS</th><th className="px-4 py-3 text-right">Preço JET</th><th className="px-4 py-3">Ações</th></tr></thead>
            <tbody className="text-foreground">{suppliers.length ? suppliers.map((supplier) => <tr key={supplier.id} className="border-b border-border/60 hover:bg-primary/5"><td className="px-4 py-3">{supplier.nome_cidade || "—"}</td><td className="px-4 py-3 font-mono font-bold text-primary">{supplier.codigo_icao || "—"}</td><td className="px-4 py-3 font-bold">{supplier.nome_fornecedor}</td><td className="px-4 py-3">{supplier.pessoa_contato || "—"}</td><td className="px-4 py-3 font-mono">{supplier.telefone || "—"}</td><td className="px-4 py-3 text-right font-mono">{supplier.preco_avgas != null ? money(Number(supplier.preco_avgas)) : "—"}</td><td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">{supplier.preco_jet != null ? money(Number(supplier.preco_jet)) : "—"}</td><td className="px-4 py-3"><button type="button" onClick={() => editSupplier(supplier)} className="inline-flex items-center gap-1 font-semibold text-primary"><Edit3 size={12} /> Editar</button></td></tr>) : <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum fornecedor encontrado.</td></tr>}</tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">{suppliers.length ? suppliers.map((supplier) => <FornecedorCard key={supplier.id} supplier={supplier} onEdit={editSupplier} />) : <EstadoVazio label="Nenhum fornecedor encontrado." />}</div>
      </section>
    </div>
  );
}
