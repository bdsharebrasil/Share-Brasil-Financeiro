import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronDown,
  CalendarRange,
  FolderOpen,
  MoreVertical,
  Download,
  Edit3,
  FileText,
  Fuel,
  MapPin,
  Plane,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import {
  anexarArquivoAbastecimento,
  atualizarAbastecimento,
  baixarArquivoAbastecimento,
  buscarAbastecimentoOpcoes,
  buscarAbastecimentos,
  criarAbastecimento,
  criarFornecedorAbastecimento,
  atualizarFornecedorAbastecimento,
  excluirFornecedorAbastecimento,
  excluirAbastecimento,
  type Abastecimento,
  type AbastecimentoOpcoes,
} from "@/lib/colaborador-api";

const card = "rounded-lg border border-border bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]";
const field = "h-9 rounded-md border-border/80 bg-background/70 px-3 text-xs text-foreground placeholder:text-muted-foreground";
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const emptyForm = {
  cliente_id: "", socio_id: "", aeronave_id: "", data: new Date().toISOString().slice(0, 10), tipo_combustivel: "JET A1", trecho: "", local: "", numero_comanda: "", numero_nf: "", litros: "", valor_unitario: "", valor_total: "", desconto: "", fornecedor_id: "", status: "pendente", observacao: "", forma_pagamento: "", data_vencimento_boleto: "", lancamento_diario_id: "", data_pagamento: "", banco: "", voo_emprestado: false, numero_voo: "",
};

type Form = typeof emptyForm;

export default function ControleAbastecimento({ aoVoltar }: { aoVoltar?: () => void }) {
  const [tab, setTab] = useState<"registros" | "fornecedores">("registros");
  const [options, setOptions] = useState<AbastecimentoOpcoes | null>(null);
  const [records, setRecords] = useState<Abastecimento[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filters, setFilters] = useState({ inicio: "", fim: "", aeronave_id: "", cliente_id: "", fornecedor_id: "", status: "", valor_min: "", valor_max: "", busca: "" });
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
      setOptions(op);
      setRecords(list.abastecimentos);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os abastecimentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totalLitros = useMemo(() => records.reduce((sum, item) => sum + Number(item.litros || 0), 0), [records]);
  const totalValor = useMemo(() => records.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [records]);
  const gruposMes = useMemo(() => { const grupos: Record<string, Abastecimento[]> = {}; records.forEach((item) => { const mes = (item.data || "sem-data").slice(0, 7); (grupos[mes] ||= []).push(item); }); return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a)); }, [records]);
  const gruposPastas = useMemo(() => { const grupos: Record<string, Abastecimento[]> = {}; records.forEach((item) => { const nome = item.socio_nome || item.cliente_nome || "Sem cliente ou sócio"; (grupos[nome] ||= []).push(item); }); return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)); }, [records]);
  const clientesDisponiveis = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; codigo?: string | null }>();
    (options?.clientes || []).forEach((cliente) => {
      if (cliente.id && cliente.nome) mapa.set(cliente.id, { id: cliente.id, nome: cliente.nome, codigo: cliente.codigo_cliente });
    });
    records.forEach((item) => {
      const id = item.cliente_id || item.socio_id;
      const nome = item.cliente_nome || item.socio_nome || "Cliente sem nome";
      if (id && !mapa.has(id)) mapa.set(id, { id, nome, codigo: item.numero_voo || item.numero_comanda || null });
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [options, records]);
  const clientesFiltrados = useMemo(() => clientesDisponiveis.filter((cliente) => cliente.nome.toLowerCase().includes(buscaCliente.toLowerCase())), [clientesDisponiveis, buscaCliente]);
  const registrosCliente = useMemo(() => {
    if (!clienteSelecionado) return [];
    let itens = records.filter((item) => item.cliente_id === clienteSelecionado || item.socio_id === clienteSelecionado);
    
    // Aplicar filtros
    if (filters.busca) {
      const termo = filters.busca.toLowerCase();
      itens = itens.filter((item) => 
        (item.trecho?.toLowerCase().includes(termo)) ||
        (item.local?.toLowerCase().includes(termo)) ||
        (item.numero_comanda?.toLowerCase().includes(termo)) ||
        (item.numero_nf?.toLowerCase().includes(termo))
      );
    }
    if (filters.status) {
      itens = itens.filter((item) => item.status === filters.status);
    }
    
    return itens.sort((a, b) => new Date(b.data || "").getTime() - new Date(a.data || "").getTime());
  }, [clienteSelecionado, records, filters]);
  const setField = (key: keyof Form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const editRecord = (item: Abastecimento) => {
    setEditing(item);
    setForm({ ...emptyForm, ...Object.fromEntries(Object.entries(item).filter(([key]) => key in emptyForm).map(([key, value]) => [key, value == null ? "" : value])) } as Form);
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
      const payload = { ...form, litros: Number(form.litros || 0), valor_unitario: Number(form.valor_unitario || 0), valor_total: Number(form.valor_total || Number(form.litros || 0) * Number(form.valor_unitario || 0)), desconto: form.desconto ? Number(form.desconto) : null, voo_emprestado: Boolean(form.voo_emprestado) };
      if (editing) await atualizarAbastecimento(editing.id, payload);
      else await criarAbastecimento(payload);
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

  return (
    <div className="!mb-[-30px] !ml-[-26px] !mr-[-26px] !mt-[-30px] min-h-screen !bg-[#050714] px-4 py-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <div className="!ml-[19px] !mr-[-24px] !mt-[18px] mb-6 flex w-full gap-[27px] rounded-xl border border-transparent bg-transparent !px-[14px] !py-[6px] leading-[23px] text-sm font-light">
          <button
            type="button"
            onClick={() => setTab("registros")}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-base font-semibold transition ${tab === "registros" ? "border-[#23a7ff] bg-[#0f233a] text-white shadow-inner shadow-[#1f6fff]/20" : "border-transparent bg-transparent text-slate-300 hover:text-white"}`}
          >
            <Fuel size={16} /> Histórico de abastecimentos
          </button>
          <button
            type="button"
            onClick={() => setTab("fornecedores")}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-base font-semibold transition ${tab === "fornecedores" ? "border-[#23a7ff] bg-[#0f233a] text-white shadow-inner shadow-[#1f6fff]/20" : "border-transparent bg-transparent text-slate-300 hover:text-white"}`}
          >
            <Building2 size={16} /> Fornecedores
          </button>
        </div>

        {tab === "fornecedores" ? <FornecedorTab options={options} onSaved={() => void load()} onError={setError} /> : (
          <>
            {formOpen && <AbastecimentoForm form={form} options={options} editing={editing} saving={saving} setField={setField} onClose={closeForm} onSave={() => void save()} />}

            {!clienteSelecionado && <>
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="!ml-[40px] !mr-[40px]">
                  <h1 className="flex items-center gap-2 text-3xl font-black tracking-[-0.04em] text-white"><Building2 size={26} className="text-[#3ba6ff]" /> Selecione um Cliente</h1>
                  <p className="mt-1 text-sm text-slate-400">{clientesFiltrados.length} cliente(s) disponível(is)</p>
                </div>

                <div className="w-full max-w-[320px]">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={buscaCliente}
                      onChange={(event) => setBuscaCliente(event.target.value)}
                      placeholder="Buscar cliente por nome..."
                      className="!mx-[-30px] h-10 w-full rounded-lg border border-[#20344d] bg-[#0a1727] !pl-[67px] text-sm text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 grid gap-[20px] px-[21px] py-[13px] md:grid-cols-2 xl:grid-cols-3">
                {clientesFiltrados.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => setClienteSelecionado(cliente.id)}
                    className="group min-h-[132px] rounded-xl border border-[#1a2d42] bg-[#0d1d2d] p-4 text-left transition hover:border-[#36a7ff] hover:bg-[#10253b]"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a6fa6] bg-[#122b42] text-[#7ec3ff]">
                        <Building2 size={15} />
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-md border border-[#1d3e5f] bg-[#0a1e33] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-sky-200">
                        <Plane size={10} /> {cliente.codigo || "AERONAVES 01"}
                      </span>
                    </div>

                    <div className="truncate text-base font-black uppercase leading-tight tracking-[-0.03em] text-white">
                      {cliente.nome}
                    </div>
                  </button>
                ))}
              </div>
            </>}

            {clienteSelecionado && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <button 
                      onClick={() => setClienteSelecionado(null)} 
                      className="mb-3 flex items-center gap-2 text-sky-400 hover:text-sky-300 transition"
                    >
                      <ChevronLeft size={16} /> Voltar
                    </button>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400">Histórico de abastecimentos</p>
                    <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">
                      {clientesDisponiveis.find((c) => c.id === clienteSelecionado)?.nome || "Cliente selecionado"}
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                      {clientesDisponiveis.find((c) => c.id === clienteSelecionado)?.codigo ? `• ${clientesDisponiveis.find((c) => c.id === clienteSelecionado)?.codigo}` : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#1a2d42] bg-[#071827] p-0">
                  <div className="flex flex-col gap-4 border-b border-[#1a2d42] p-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Buscar</span>
                        <div className="relative">
                          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input value={filters.busca} onChange={(event) => setFilters({ ...filters, busca: event.target.value })} placeholder="Trecho, local, comanda..." className="h-11 w-full rounded-xl border border-[#20344d] bg-[#0a1727] pl-9 text-sm text-white placeholder:text-slate-400" />
                        </div>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Cliente</span>
                        <select value={filters.cliente_id} onChange={(event) => setFilters({ ...filters, cliente_id: event.target.value })} className="h-11 w-full rounded-xl border border-[#20344d] bg-[#0a1727] px-3 text-sm text-white">
                          <option value="">Todos</option>
                          {options?.clientes.map((client) => <option key={client.id} value={client.id}>{client.nome || "Sem razão social"}</option>)}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Mês</span>
                        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="h-11 w-full rounded-xl border border-[#20344d] bg-[#0a1727] px-3 text-sm text-white">
                          <option value="">Todos</option>
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ano</span>
                        <input type="text" value="2026" readOnly className="h-11 w-full rounded-xl border border-[#20344d] bg-[#0a1727] px-3 text-sm text-white" />
                      </label>
                    </div>

                    <Button type="button" onClick={() => { closeForm(); setFormOpen(true); }} className="h-12 gap-2 bg-[#2d8cff] px-6 text-base font-semibold text-white hover:bg-[#1f78f2]">
                      <Plus size={16} /> Novo Registro
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[1200px] w-full border-separate border-spacing-0 text-left">
                      <thead>
                        <tr className="bg-[#081d2c] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          <th className="px-4 py-4">Data</th>
                          <th className="px-4 py-4">Voo</th>
                          <th className="px-4 py-4">Trecho</th>
                          <th className="px-4 py-4">Local</th>
                          <th className="px-4 py-4">Comanda</th>
                          <th className="px-4 py-4">N.F.</th>
                          <th className="px-4 py-4">Fornecedor</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4 text-right">Litros</th>
                          <th className="px-4 py-4 text-right">Valor unit.</th>
                          <th className="px-4 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrosCliente.length ? (
                          registrosCliente.slice(0, 10).map((record) => (
                            <tr key={record.id} className="border-t border-[#1a2d42] bg-[#071827] text-sm text-slate-200">
                              <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-300">{date(record.data)}</td>
                              <td className="px-4 py-4 font-mono text-xs font-semibold text-sky-300">{record.numero_voo || record.matricula_registro || "—"}</td>
                              <td className="max-w-[180px] px-4 py-4 text-slate-300">{record.trecho || "—"}</td>
                              <td className="px-4 py-4 text-slate-300">{record.local || "—"}</td>
                              <td className="px-4 py-4 font-mono text-xs text-sky-300">{record.numero_comanda || "—"}</td>
                              <td className="px-4 py-4 font-mono text-xs text-sky-300">{record.numero_nf || "—"}</td>
                              <td className="px-4 py-4 text-slate-300">{record.fornecedor_apelido || record.fornecedor_nome || "—"}</td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${record.status === "pago" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                                  {record.status === "pago" ? "Pago" : record.status || "Pendente"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-sm text-slate-200">{Number(record.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-4 text-right font-mono text-sm text-slate-200">{money(record.valor_unitario)}</td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => editRecord(record)} className="rounded-lg border border-[#20344d] bg-transparent p-2 text-slate-300 hover:border-sky-400 hover:text-white"><Edit3 size={14} /></button>
                                  <button type="button" onClick={() => remove(record.id)} className="rounded-lg border border-[#20344d] bg-transparent p-2 text-slate-300 hover:border-red-400 hover:text-red-300"><X size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                              Nenhum registro para este cliente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label}</span>{children}</label>;
}

function AbastecimentoRow({ record, onEdit, onDelete, onUpload, onDownload }: { record: Abastecimento; onEdit: (record: Abastecimento) => void; onDelete: (id: string) => void; onUpload: (id: string, type: "comanda" | "nota" | "boleto", file?: File) => void; onDownload: (id: string, type: "comanda" | "nota" | "boleto") => void }) {
  const [menuAberto, setMenuAberto] = useState(false); const pago = record.status === "pago"; const fileType = record.comanda_url ? "comanda" : record.nota_url ? "nota" : "boleto";
  return <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/25"><td className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold">{date(record.data)}</td><td className="px-4 py-3"><span className="font-mono text-[9px] font-bold text-primary">{record.numero_voo || record.matricula_registro || "—"}</span></td><td className="max-w-[145px] px-4 py-3"><p className="line-clamp-2 text-[10px] font-medium leading-tight">{record.trecho || "—"}</p></td><td className="max-w-[110px] px-4 py-3 text-[10px] text-muted-foreground">{record.local}</td><td className="px-4 py-3 font-mono text-[10px] text-primary">{record.numero_comanda || "—"}</td><td className="px-4 py-3 font-mono text-[10px] text-primary">{record.numero_nf || "—"}</td><td className="max-w-[125px] px-4 py-3 text-[10px] text-muted-foreground"><p className="truncate">{record.fornecedor_apelido || record.fornecedor_nome || "—"}</p></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${pago ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{pago ? "Pago" : record.status || "Pendente"}</span></td><td className="px-4 py-3 text-right font-mono text-[10px] font-semibold">{Number(record.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td><td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground">{money(record.valor_unitario)}</td><td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-emerald-300">{money(record.valor_total)}</td><td className="relative px-4 py-3"><div className="flex justify-end"><button type="button" onClick={() => setMenuAberto((atual) => !atual)} aria-label="Abrir ações" className="rounded-lg border border-border/70 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><MoreVertical size={15} /></button>{menuAberto && <div className="absolute right-3 top-10 z-20 w-44 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"><button type="button" onClick={() => { setMenuAberto(false); onEdit(record); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] hover:bg-secondary"><Edit3 size={13} /> Editar registro</button>{record.comanda_url || record.nota_url || record.boleto_url ? <button type="button" onClick={() => { setMenuAberto(false); void onDownload(record.id, fileType); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] hover:bg-secondary"><Download size={13} /> Baixar documento</button> : <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[10px] hover:bg-secondary"><Upload size={13} /> Anexar comanda<input className="hidden" type="file" accept="application/pdf,image/*" onChange={(event) => { setMenuAberto(false); void onUpload(record.id, "comanda", event.target.files?.[0]); }} /></label>}<button type="button" onClick={() => { setMenuAberto(false); void onDelete(record.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] text-red-300 hover:bg-red-400/10"><X size={13} /> Excluir registro</button></div>}</div></td></tr>;
}

function AbastecimentoForm({ form, options, editing, saving, setField, onClose, onSave }: { form: Form; options: AbastecimentoOpcoes | null; editing: Abastecimento | null; saving: boolean; setField: (key: keyof Form, value: string | boolean) => void; onClose: () => void; onSave: () => void }) {
  return <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-xs font-bold">{editing ? "Editar abastecimento" : "Novo abastecimento"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Registre as informações operacionais e financeiras.</p></div><button type="button" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-secondary"><X size={15} /></button></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"><Input type="date" value={form.data} onChange={(event) => setField("data", event.target.value)} className={field} /><Input placeholder="Local do abastecimento" value={form.local} onChange={(event) => setField("local", event.target.value)} className={field} /><Input placeholder="Trecho" value={form.trecho} onChange={(event) => setField("trecho", event.target.value)} className={field} /><select value={form.tipo_combustivel} onChange={(event) => setField("tipo_combustivel", event.target.value)} className={field}><option>JET A1</option><option>AVGAS</option></select><select value={form.aeronave_id} onChange={(event) => setField("aeronave_id", event.target.value)} className={field}><option value="">Aeronave</option>{options?.aeronaves.map((aircraft) => <option key={aircraft.id} value={aircraft.id}>{aircraft.matricula_registro} · {aircraft.modelo}</option>)}</select><select value={form.cliente_id} onChange={(event) => setField("cliente_id", event.target.value)} className={field}><option value="">Cliente cotista</option>{options?.clientes.map((client) => <option key={client.id} value={client.id}>{client.nome || "Sem razão social"}</option>)}</select><select value={form.socio_id} onChange={(event) => setField("socio_id", event.target.value)} className={field}><option value="">Sócio</option>{options?.socios.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select><select value={form.fornecedor_id} onChange={(event) => setField("fornecedor_id", event.target.value)} className={field}><option value="">Fornecedor</option>{options?.fornecedores.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.apelido || supplier.nome_completo}</option>)}</select><Input placeholder="Nº comanda" value={form.numero_comanda} onChange={(event) => setField("numero_comanda", event.target.value)} className={field} /><Input placeholder="Nº NF" value={form.numero_nf} onChange={(event) => setField("numero_nf", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Litros" value={form.litros} onChange={(event) => setField("litros", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Valor unitário" value={form.valor_unitario} onChange={(event) => setField("valor_unitario", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Valor total" value={form.valor_total} onChange={(event) => setField("valor_total", event.target.value)} className={field} /><select value={form.forma_pagamento} onChange={(event) => setField("forma_pagamento", event.target.value)} className={field}><option value="">Forma de pagamento</option><option>Cartão</option><option>Boleto</option><option>Transferência</option><option>Pix</option></select><select value={form.status} onChange={(event) => setField("status", event.target.value)} className={field}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select><Input placeholder="Nº voo" value={form.numero_voo} onChange={(event) => setField("numero_voo", event.target.value)} className={field} /></div><div className="grid gap-3 px-4 pb-4 md:grid-cols-[1fr_auto]"><Textarea placeholder="Observações" value={form.observacao} onChange={(event) => setField("observacao", event.target.value)} className="min-h-[40px] border-border/80 bg-background/70 text-xs" /><div className="flex items-center gap-3"><label className="flex items-center gap-2 whitespace-nowrap text-[10px] text-muted-foreground"><input type="checkbox" checked={form.voo_emprestado} onChange={(event) => setField("voo_emprestado", event.target.checked)} /> Voo emprestado</label><Button type="button" disabled={saving} onClick={onSave} className="h-9 gap-2 text-xs"><Plus size={13} /> {saving ? "Salvando..." : editing ? "Atualizar" : "Registrar"}</Button></div></div></section>;
}

function FornecedorTab({ options, onSaved, onError }: { options: AbastecimentoOpcoes | null; onSaved: () => void; onError: (message: string) => void }) {
  const [formOpen, setFormOpen] = useState(false); const [query, setQuery] = useState(""); const [saving, setSaving] = useState(false); const [editing, setEditing] = useState<Record<string, any> | null>(null); const [menuAberto, setMenuAberto] = useState<string | null>(null); const vazio = { nome_completo: "", apelido: "", cidade: "", uf: "", codigo_icao: "", telefone: "", preco_avgas: "", preco_jet: "" }; const [form, setForm] = useState(vazio);
  const suppliers = (options?.fornecedores || []).filter((supplier) => [supplier.nome_completo, supplier.apelido, supplier.cidade, supplier.codigo_icao].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));
  const save = async () => { if (!form.nome_completo) return; setSaving(true); try { if (editing) await atualizarFornecedorAbastecimento(editing.id, { ...form, preco_avgas: Number(form.preco_avgas || 0), preco_jet: Number(form.preco_jet || 0) }); else await criarFornecedorAbastecimento({ ...form, preco_avgas: Number(form.preco_avgas || 0), preco_jet: Number(form.preco_jet || 0) }); setForm(vazio); setEditing(null); setFormOpen(false); onSaved(); } catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível salvar o fornecedor."); } finally { setSaving(false); } };
  const editar = (supplier: Record<string, any>) => { setEditing(supplier); setForm({ ...vazio, ...Object.fromEntries(Object.entries(supplier).filter(([key]) => key in vazio).map(([key, value]) => [key, value == null ? "" : String(value)])) }); setFormOpen(true); setMenuAberto(null); };
  const excluir = async (id: string) => { if (!window.confirm("Excluir este fornecedor?")) return; try { await excluirFornecedorAbastecimento(id); onSaved(); } catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível excluir o fornecedor."); } };
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-.03em]"><MapPin size={18} className="text-primary" /> Fornecedores de combustível</h2><p className="mt-1 text-xs text-muted-foreground">{suppliers.length} fornecedor(es) encontrado(s)</p></div><Button type="button" onClick={() => { setEditing(null); setForm(vazio); setFormOpen((current) => !current); }} className="h-9 gap-2 text-xs"><Plus size={14} /> Novo fornecedor</Button></div>{formOpen && <section className={`${card} border-primary/20 p-4`}><p className="mb-3 text-xs font-bold">{editing ? "Editar fornecedor" : "Cadastrar fornecedor"}</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{([['nome_completo','Nome do fornecedor'],['apelido','Nome curto / apelido'],['cidade','Cidade'],['uf','UF'],['codigo_icao','Código ICAO'],['telefone','Telefone'],['preco_avgas','Preço AVGAS'],['preco_jet','Preço JET']] as Array<[keyof typeof vazio, string]>).map(([key, label]) => <Input key={key} type={key.startsWith("preco") ? "number" : "text"} step={key.startsWith("preco") ? "0.01" : undefined} placeholder={label} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={field} />)}</div><div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-9 text-xs">Cancelar</Button><Button type="button" disabled={saving || !form.nome_completo} onClick={() => void save()} className="h-9 text-xs">{saving ? "Salvando..." : editing ? "Atualizar fornecedor" : "Cadastrar fornecedor"}</Button></div></section>}<section className={`${card} overflow-hidden`}><div className="border-b border-border p-3"><div className="relative max-w-xl"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, cidade ou ICAO..." className={`${field} w-full pl-9`} /></div></div>{suppliers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-border bg-background/30 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Cidade</th><th className="px-5 py-3">ICAO</th><th className="px-5 py-3">Fornecedor</th><th className="px-5 py-3">Contato</th><th className="px-5 py-3">Telefone</th><th className="px-5 py-3 text-right">AVGAS</th><th className="px-5 py-3 text-right">JET</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id} className="border-b border-border/70 last:border-0 hover:bg-secondary/25"><td className="px-5 py-4 text-[10px] font-semibold uppercase">{supplier.cidade || "—"}{supplier.uf ? `-${supplier.uf}` : ""}</td><td className="px-5 py-4 font-mono text-[10px] text-primary">{supplier.codigo_icao || "—"}</td><td className="px-5 py-4 text-[11px] font-bold uppercase">{supplier.apelido || supplier.nome_completo}</td><td className="px-5 py-4 text-[10px] text-muted-foreground">{supplier.nome_completo || "—"}</td><td className="px-5 py-4 text-[10px] text-muted-foreground">{supplier.telefone || "—"}</td><td className="px-5 py-4 text-right font-mono text-[10px]">{Number(supplier.preco_avgas || 0) ? money(Number(supplier.preco_avgas)) : "—"}</td><td className="px-5 py-4 text-right font-mono text-[10px] font-bold text-emerald-300">{Number(supplier.preco_jet || 0) ? money(Number(supplier.preco_jet)) : "—"}</td><td className="relative px-5 py-4"><div className="flex justify-end"><button type="button" onClick={() => setMenuAberto(menuAberto === supplier.id ? null : supplier.id)} className="rounded-lg border border-border/70 p-1.5 text-muted-foreground hover:bg-secondary"><MoreVertical size={15} /></button>{menuAberto === supplier.id && <div className="absolute right-4 top-10 z-20 w-40 rounded-xl border border-border bg-popover p-1.5 shadow-xl"><button type="button" onClick={() => editar(supplier)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] hover:bg-secondary"><Edit3 size={13} /> Editar</button><button type="button" onClick={() => { setMenuAberto(null); void excluir(supplier.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] text-red-300 hover:bg-red-400/10"><X size={13} /> Excluir</button></div>}</div></td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhum fornecedor encontrado" />}</section></div>;
}
