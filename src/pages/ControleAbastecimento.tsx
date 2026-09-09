import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronLeft, CalendarRange, FolderOpen, MoreVertical, Download, Edit3, Fuel, MapPin, Plane, Plus, Search, Upload, X, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { anexarArquivoAbastecimento, atualizarAbastecimento, baixarArquivoAbastecimento, buscarAbastecimentoOpcoes, buscarAbastecimentos, criarAbastecimento, criarFornecedorAbastecimento, atualizarFornecedorAbastecimento, excluirFornecedorAbastecimento, excluirAbastecimento, type Abastecimento, type AbastecimentoOpcoes } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const emptyForm = {
  cliente_id: "",
  socio_id: "",
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
  banco: "",
  voo_emprestado: false,
  numero_voo: "",
};

type Form = typeof emptyForm;

export default function ControleAbastecimento({ aoVoltar }: { aoVoltar?: () => void }) {
  const [tab, setTab] = useState<"registros" | "fornecedores">("registros");
  const [options, setOptions] = useState<AbastecimentoOpcoes | null>(null);
  const [records, setRecords] = useState<Abastecimento[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [filters, setFilters] = useState({
    inicio: "",
    fim: "",
    aeronave_id: "",
    cliente_id: "",
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

  const totalLitros = useMemo(() => records.reduce((sum, item) => sum + Number(item.litros || 0), 0), [records]);
  const totalValor = useMemo(() => records.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [records]);

  const clientesDisponiveis = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; codigo?: string | null }>();
    (options?.clientes || []).forEach((cliente) => {
      if (cliente.id && cliente.nome) {
        mapa.set(cliente.id, { id: cliente.id, nome: cliente.nome, codigo: cliente.codigo_cliente });
      }
    });

    records.forEach((item) => {
      const id = item.cliente_id || item.socio_id;
      const nome = item.cliente_nome || item.socio_nome || "Cliente sem nome";
      if (id && !mapa.has(id)) {
        mapa.set(id, { id, nome, codigo: item.numero_voo || item.numero_comanda || null });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [options, records]);

  const clientesFiltrados = useMemo(() => clientesDisponiveis.filter((cliente) => cliente.nome.toLowerCase().includes(buscaCliente.toLowerCase())), [clientesDisponiveis, buscaCliente]);

  const registrosCliente = useMemo(() => {
    if (!clienteSelecionado) return [];
    let itens = records.filter((item) => item.cliente_id === clienteSelecionado || item.socio_id === clienteSelecionado);
    if (filters.busca) {
      const termo = filters.busca.toLowerCase();
      itens = itens.filter((item) => item.trecho?.toLowerCase().includes(termo) || item.local?.toLowerCase().includes(termo) || item.numero_comanda?.toLowerCase().includes(termo) || item.numero_nf?.toLowerCase().includes(termo));
    }
    if (filters.status) {
      itens = itens.filter((item) => item.status === filters.status);
    }
    return itens.sort((a, b) => new Date(b.data || "").getTime() - new Date(a.data || "").getTime());
  }, [clienteSelecionado, records, filters]);

  const totalLitrosCliente = useMemo(() => registrosCliente.reduce((sum, item) => sum + Number(item.litros || 0), 0), [registrosCliente]);
  const totalValorCliente = useMemo(() => registrosCliente.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [registrosCliente]);

  const setField = (key: keyof Form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const editRecord = (item: Abastecimento) => {
    setEditing(item);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(
        Object.entries(item)
          .filter(([key]) => key in emptyForm)
          .map(([key, value]) => [key, value == null ? "" : value])
      ),
    } as Form);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.data || !form.local) {
      setError("Informe a data e o local do abastecimento.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        litros: Number(form.litros || 0),
        valor_unitario: Number(form.valor_unitario || 0),
        valor_total: Number(form.valor_total || Number(form.litros || 0) * Number(form.valor_unitario || 0)),
        desconto: form.desconto ? Number(form.desconto) : null,
        voo_emprestado: Boolean(form.voo_emprestado),
      };

      if (editing) {
        await atualizarAbastecimento(editing.id, payload);
      } else {
        await criarAbastecimento(payload);
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

  const upload = async (id: string, type: "comanda" | "nota" | "boleto", file?: File) => {
    if (!file) return;
    try {
      await anexarArquivoAbastecimento(id, type, file);
      setMessage("Arquivo anexado.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível anexar o arquivo.");
    }
  };

  const download = async (id: string, type: "comanda" | "nota" | "boleto") => {
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

  const clienteAtual = clientesDisponiveis.find((cliente) => cliente.id === clienteSelecionado);

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
        <div className="flex items-center gap-2">
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

      {/* MÉTRICAS RÁPIDAS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Registros" value={String(records.length)} icon={<FolderOpen size={14} />} />
        <StatTile label="Volume Total" value={`${totalLitros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} L`} icon={<Fuel size={14} />} />
        <StatTile label="Valor Total" value={money(totalValor)} icon={<FileText size={14} />} accent="text-emerald-400" className="col-span-2 sm:col-span-1" />
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
              <AbastecimentoForm form={form} options={options} editing={editing} saving={saving} setField={setField} onClose={closeForm} onSave={() => void save()} />
            </div>
          )}

          {!clienteSelecionado ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Selecione um cliente</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Escolha um cliente para visualizar o histórico de abastecimentos.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                  <Search size={13} className="text-muted-foreground" />
                  <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar cliente..." className="w-48 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)
                ) : clientesFiltrados.length ? (
                  clientesFiltrados.map((cliente) => (
                    <button key={cliente.id} type="button" onClick={() => setClienteSelecionado(cliente.id)} className={`${card} group relative flex flex-col p-4 text-left transition-all hover:border-primary/50 hover:bg-card`}>
                      <div className="mb-4 flex items-start justify-between">
                        <span className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Building2 size={16} />
                        </span>
                        <span className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[9px] font-bold text-muted-foreground">
                          {cliente.codigo || "CÓDIGO GERAL"}
                        </span>
                      </div>
                      <h3 className="truncate text-sm font-bold text-foreground">{cliente.nome}</h3>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                        <span>Ver histórico</span>
                        <ChevronLeft size={12} className="rotate-180 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full">
                    <EstadoVazio label="Nenhum cliente encontrado" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setClienteSelecionado(null)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <ChevronLeft size={14} /> Voltar para clientes
                </button>
                <Button type="button" onClick={() => { closeForm(); setFormOpen(true); }} className="h-9 gap-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-extrabold">
                  <Plus size={13} /> Novo registro
                </Button>
              </div>

              {/* RESUMO DO CLIENTE */}
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

                <div className="overflow-x-auto">
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
                        registrosCliente.map((record) => (
                          <AbastecimentoRow key={record.id} record={record} onEdit={editRecord} onDelete={remove} onUpload={upload} onDownload={download} />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado para este cliente.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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

function AbastecimentoRow({ record, onEdit, onDelete, onUpload, onDownload }: { record: Abastecimento; onEdit: (record: Abastecimento) => void; onDelete: (id: string) => void; onUpload: (id: string, type: "comanda" | "nota" | "boleto", file?: File) => void; onDownload: (id: string, type: "comanda" | "nota" | "boleto") => void }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pago = record.status === "pago";
  const fileType = record.comanda_url ? "comanda" : record.nota_url ? "nota" : "boleto";

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
              {record.comanda_url || record.nota_url || record.boleto_url ? (
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

function AbastecimentoForm({ form, options, editing, saving, setField, onClose, onSave }: { form: Form; options: AbastecimentoOpcoes | null; editing: Abastecimento | null; saving: boolean; setField: (key: keyof Form, value: string | boolean) => void; onClose: () => void; onSave: () => void }) {
  const aeronaves = Array.isArray(options?.aeronaves) ? options.aeronaves : [];
  const clientes = Array.isArray(options?.clientes) ? options.clientes : [];
  const socios = Array.isArray(options?.socios) ? options.socios : [];
  const fornecedores = Array.isArray(options?.fornecedores) ? options.fornecedores : [];

  return (
    <section className={`${card} p-5 space-y-4`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? "Editar abastecimento" : "Novo abastecimento"}</h3>
        <button type="button" onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Data *</span><input type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Local *</span><input placeholder="Local" value={form.local} onChange={(e) => setField("local", e.target.value)} className="campo" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Trecho</span><input placeholder="Trecho" value={form.trecho} onChange={(e) => setField("trecho", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Combustível</span><select value={form.tipo_combustivel} onChange={(e) => setField("tipo_combustivel", e.target.value)} className="campo"><option>JET A1</option><option>AVGAS</option></select></label>

        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Aeronave</span><select value={form.aeronave_id} onChange={(e) => setField("aeronave_id", e.target.value)} className="campo"><option value="">Selecionar aeronave</option>{aeronaves.map((a) => <option key={a.id} value={a.id}>{a.matricula_registro} · {a.modelo}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Cliente cotista</span><select value={form.cliente_id} onChange={(e) => setField("cliente_id", e.target.value)} className="campo"><option value="">Selecionar cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Sócio</span><select value={form.socio_id} onChange={(e) => setField("socio_id", e.target.value)} className="campo"><option value="">Selecionar sócio</option>{socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Fornecedor</span><select value={form.fornecedor_id} onChange={(e) => setField("fornecedor_id", e.target.value)} className="campo"><option value="">Selecionar fornecedor</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>{f.apelido || f.nome_completo}</option>)}</select></label>

        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Nº Comanda</span><input placeholder="Comanda" value={form.numero_comanda} onChange={(e) => setField("numero_comanda", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Nº NF</span><input placeholder="NF" value={form.numero_nf} onChange={(e) => setField("numero_nf", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Litros</span><input type="number" step="0.01" value={form.litros} onChange={(e) => setField("litros", e.target.value)} className="campo font-mono" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Valor Unitário</span><input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setField("valor_unitario", e.target.value)} className="campo font-mono" /></label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="h-9">Cancelar</Button>
        <Button type="button" disabled={saving} onClick={onSave} className="h-9 bg-primary text-primary-foreground font-bold">{saving ? "Salvando..." : "Salvar abastecimento"}</Button>
      </div>
    </section>
  );
}

function FornecedorTab({ options, onSaved, onError }: { options: AbastecimentoOpcoes | null; onSaved: () => void; onError: (msg: string) => void }) {
  const [query, setQuery] = useState("");
  const suppliers = (options?.fornecedores || []).filter((s) => [s.nome_completo, s.apelido, s.cidade, s.codigo_icao].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search size={13} className="text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar fornecedor..." className="w-64 bg-transparent text-xs outline-none text-foreground" />
        </div>
      </div>

      <section className={`${card} overflow-hidden p-4`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">ICAO</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3 text-right">Preço AVGAS</th>
                <th className="px-4 py-3 text-right">Preço JET</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {suppliers.length ? (
                suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-primary/5">
                    <td className="px-4 py-3">{s.cidade || "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">{s.codigo_icao || "—"}</td>
                    <td className="px-4 py-3 font-bold">{s.apelido || s.nome_completo}</td>
                    <td className="px-4 py-3 font-mono">{s.telefone || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(s.preco_avgas || 0) ? money(Number(s.preco_avgas)) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">{Number(s.preco_jet || 0) ? money(Number(s.preco_jet)) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum fornecedor encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}