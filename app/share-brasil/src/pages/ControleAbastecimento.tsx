import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
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
  const [filters, setFilters] = useState({ inicio: "", fim: "", aeronave_id: "", cliente_id: "", fornecedor_id: "", busca: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="route-enter space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <IndicadorPagina>Operações / Controle de combustível</IndicadorPagina>
          <h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[29px]">Abastecimentos</h1>
          <p className="mt-1 text-xs text-muted-foreground">Histórico operacional, documentos e pagamentos de combustível.</p>
        </div>
        <div className="flex gap-2">
          {aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-2 border-border bg-card px-3 text-xs"><ChevronLeft size={14} /> Voltar</Button>}
          {tab === "registros" && <><Button type="button" variant="outline" onClick={() => window.print()} className="h-9 gap-2 border-border bg-card px-3 text-xs"><Download size={14} /> Exportar PDF</Button><Button type="button" onClick={() => { closeForm(); setFormOpen(true); }} className="h-9 gap-2 px-3 text-xs"><Plus size={14} /> Novo registro</Button></>}
        </div>
      </div>

      {(message || error) && <div className={`rounded-md border px-3 py-2.5 text-xs ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || message}</div>}

      <div className="flex gap-1 border-b border-border">
        <button type="button" onClick={() => setTab("registros")} className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] ${tab === "registros" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Fuel size={13} /> Histórico de abastecimentos</button>
        <button type="button" onClick={() => setTab("fornecedores")} className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] ${tab === "fornecedores" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Building2 size={13} /> Fornecedores</button>
      </div>

      {tab === "fornecedores" ? <FornecedorTab options={options} onSaved={() => void load()} onError={setError} /> : <>
        {formOpen && <AbastecimentoForm form={form} options={options} editing={editing} saving={saving} setField={setField} onClose={closeForm} onSave={() => void save()} />}
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-border p-3 md:p-4">
            <div className="grid gap-3 xl:grid-cols-[1.65fr_.8fr_.8fr_.8fr_auto] xl:items-end">
              <FilterField label="Buscar"><div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={filters.busca} onChange={(event) => setFilters({ ...filters, busca: event.target.value })} placeholder="Trecho, local, fornecedor, comanda, NF, número do voo..." className={`${field} w-full pl-9`} /></div></FilterField>
              <FilterField label="Cliente"><select value={filters.cliente_id} onChange={(event) => setFilters({ ...filters, cliente_id: event.target.value })} className={`${field} w-full`}><option value="">Todos</option>{options?.clientes.map((client) => <option key={client.id} value={client.id}>{client.nome || "Sem razão social"}</option>)}</select></FilterField>
              <FilterField label="Mês"><Input type="month" value={filters.inicio.slice(0, 7)} onChange={(event) => setFilters({ ...filters, inicio: event.target.value ? `${event.target.value}-01` : "", fim: "" })} className={`${field} w-full`} /></FilterField>
              <FilterField label="Aeronave"><select value={filters.aeronave_id} onChange={(event) => setFilters({ ...filters, aeronave_id: event.target.value })} className={`${field} w-full`}><option value="">Todas</option>{options?.aeronaves.map((aircraft) => <option key={aircraft.id} value={aircraft.id}>{aircraft.matricula_registro}</option>)}</select></FilterField>
              <Button type="button" onClick={() => void load()} className="h-9 gap-2 px-4 text-xs"><Search size={13} /> Aplicar</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border bg-secondary/15 px-4 py-2.5 text-[10px] text-muted-foreground"><span><strong className="mr-1 text-foreground">{records.length}</strong> registros</span><span><strong className="mr-1 text-foreground">{totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong> litros</span><span><strong className="mr-1 text-foreground">{money(totalValor)}</strong> valor total</span></div>
          {loading ? <p className="p-7 text-center text-xs text-muted-foreground">Carregando registros...</p> : records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1170px] text-left"><thead><tr className="border-b border-border bg-background/30 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Voo</th><th className="px-4 py-3">Trecho</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Comanda</th><th className="px-4 py-3">N.F.</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Litros</th><th className="px-4 py-3 text-right">Valor unit.</th><th className="px-4 py-3 text-right">Valor total</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{records.map((record) => <AbastecimentoRow key={record.id} record={record} onEdit={editRecord} onDelete={remove} onUpload={upload} onDownload={download} />)}</tbody></table></div> : <EstadoVazio label="Nenhum abastecimento encontrado" />}
        </section>
      </>}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label}</span>{children}</label>;
}

function AbastecimentoRow({ record, onEdit, onDelete, onUpload, onDownload }: { record: Abastecimento; onEdit: (record: Abastecimento) => void; onDelete: (id: string) => void; onUpload: (id: string, type: "comanda" | "nota" | "boleto", file?: File) => void; onDownload: (id: string, type: "comanda" | "nota" | "boleto") => void }) {
  const paid = record.status === "pago";
  const fileType = record.comanda_url ? "comanda" : record.nota_url ? "nota" : "boleto";
  return <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/25"><td className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold">{date(record.data)}</td><td className="px-4 py-3"><span className="font-mono text-[9px] font-bold text-primary">{record.numero_voo || record.matricula_registro || "—"}</span></td><td className="max-w-[145px] px-4 py-3"><p className="line-clamp-2 text-[10px] font-medium leading-tight">{record.trecho || "—"}</p></td><td className="max-w-[110px] px-4 py-3 text-[10px] text-muted-foreground">{record.local}</td><td className="px-4 py-3 font-mono text-[10px] text-primary">{record.numero_comanda || "—"}</td><td className="px-4 py-3 font-mono text-[10px] text-primary">{record.numero_nf || "—"}</td><td className="max-w-[125px] px-4 py-3 text-[10px] text-muted-foreground"><p className="truncate">{record.fornecedor_apelido || record.fornecedor_nome || "—"}</p></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${paid ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{paid ? "Pago" : "Pendente"}</span></td><td className="px-4 py-3 text-right font-mono text-[10px] font-semibold">{Number(record.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td><td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground">{money(record.valor_unitario)}</td><td className="px-4 py-3 text-right font-mono text-[10px] font-bold text-emerald-300">{money(record.valor_total)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(record)} aria-label="Editar abastecimento" className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Edit3 size={14} /></button>{record.comanda_url || record.nota_url || record.boleto_url ? <button type="button" onClick={() => void onDownload(record.id, fileType)} aria-label="Baixar documento" className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Download size={14} /></button> : <label className="cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Upload size={14} /><input className="hidden" type="file" accept="application/pdf,image/*" onChange={(event) => void onUpload(record.id, "comanda", event.target.files?.[0])} /></label>}<button type="button" onClick={() => void onDelete(record.id)} aria-label="Excluir abastecimento" className="rounded p-1.5 text-muted-foreground hover:bg-red-400/10 hover:text-red-300"><X size={14} /></button></div></td></tr>;
}

function AbastecimentoForm({ form, options, editing, saving, setField, onClose, onSave }: { form: Form; options: AbastecimentoOpcoes | null; editing: Abastecimento | null; saving: boolean; setField: (key: keyof Form, value: string | boolean) => void; onClose: () => void; onSave: () => void }) {
  return <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-xs font-bold">{editing ? "Editar abastecimento" : "Novo abastecimento"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Registre as informações operacionais e financeiras.</p></div><button type="button" onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-secondary"><X size={15} /></button></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"><Input type="date" value={form.data} onChange={(event) => setField("data", event.target.value)} className={field} /><Input placeholder="Local do abastecimento" value={form.local} onChange={(event) => setField("local", event.target.value)} className={field} /><Input placeholder="Trecho" value={form.trecho} onChange={(event) => setField("trecho", event.target.value)} className={field} /><select value={form.tipo_combustivel} onChange={(event) => setField("tipo_combustivel", event.target.value)} className={field}><option>JET A1</option><option>AVGAS</option></select><select value={form.aeronave_id} onChange={(event) => setField("aeronave_id", event.target.value)} className={field}><option value="">Aeronave</option>{options?.aeronaves.map((aircraft) => <option key={aircraft.id} value={aircraft.id}>{aircraft.matricula_registro} · {aircraft.modelo}</option>)}</select><select value={form.cliente_id} onChange={(event) => setField("cliente_id", event.target.value)} className={field}><option value="">Cliente cotista</option>{options?.clientes.map((client) => <option key={client.id} value={client.id}>{client.nome || "Sem razão social"}</option>)}</select><select value={form.socio_id} onChange={(event) => setField("socio_id", event.target.value)} className={field}><option value="">Sócio</option>{options?.socios.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select><select value={form.fornecedor_id} onChange={(event) => setField("fornecedor_id", event.target.value)} className={field}><option value="">Fornecedor</option>{options?.fornecedores.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.apelido || supplier.nome_completo}</option>)}</select><Input placeholder="Nº comanda" value={form.numero_comanda} onChange={(event) => setField("numero_comanda", event.target.value)} className={field} /><Input placeholder="Nº NF" value={form.numero_nf} onChange={(event) => setField("numero_nf", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Litros" value={form.litros} onChange={(event) => setField("litros", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Valor unitário" value={form.valor_unitario} onChange={(event) => setField("valor_unitario", event.target.value)} className={field} /><Input type="number" min="0" step="0.01" placeholder="Valor total" value={form.valor_total} onChange={(event) => setField("valor_total", event.target.value)} className={field} /><select value={form.forma_pagamento} onChange={(event) => setField("forma_pagamento", event.target.value)} className={field}><option value="">Forma de pagamento</option><option>Cartão</option><option>Boleto</option><option>Transferência</option><option>Pix</option></select><select value={form.status} onChange={(event) => setField("status", event.target.value)} className={field}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select><Input placeholder="Nº voo" value={form.numero_voo} onChange={(event) => setField("numero_voo", event.target.value)} className={field} /></div><div className="grid gap-3 px-4 pb-4 md:grid-cols-[1fr_auto]"><Textarea placeholder="Observações" value={form.observacao} onChange={(event) => setField("observacao", event.target.value)} className="min-h-[40px] border-border/80 bg-background/70 text-xs" /><div className="flex items-center gap-3"><label className="flex items-center gap-2 whitespace-nowrap text-[10px] text-muted-foreground"><input type="checkbox" checked={form.voo_emprestado} onChange={(event) => setField("voo_emprestado", event.target.checked)} /> Voo emprestado</label><Button type="button" disabled={saving} onClick={onSave} className="h-9 gap-2 text-xs"><Plus size={13} /> {saving ? "Salvando..." : editing ? "Atualizar" : "Registrar"}</Button></div></div></section>;
}

function FornecedorTab({ options, onSaved, onError }: { options: AbastecimentoOpcoes | null; onSaved: () => void; onError: (message: string) => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome_completo: "", apelido: "", cidade: "", uf: "", codigo_icao: "", telefone: "", preco_avgas: "", preco_jet: "" });
  const suppliers = (options?.fornecedores || []).filter((supplier) => [supplier.nome_completo, supplier.apelido, supplier.cidade, supplier.codigo_icao].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));
  const save = async () => { if (!form.nome_completo) return; setSaving(true); try { await criarFornecedorAbastecimento({ ...form, preco_avgas: Number(form.preco_avgas || 0), preco_jet: Number(form.preco_jet || 0) }); setForm({ nome_completo: "", apelido: "", cidade: "", uf: "", codigo_icao: "", telefone: "", preco_avgas: "", preco_jet: "" }); setFormOpen(false); onSaved(); } catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível cadastrar o fornecedor."); } finally { setSaving(false); } };
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-.03em]"><MapPin size={18} className="text-primary" /> Fornecedores de Combustível</h2><p className="mt-1 text-xs text-muted-foreground">{suppliers.length} de {options?.fornecedores.length || 0} fornecedor(es)</p></div><Button type="button" onClick={() => setFormOpen((current) => !current)} className="h-9 gap-2 text-xs"><Plus size={14} /> Novo fornecedor</Button></div>{formOpen && <section className={`${card} p-4`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Input placeholder="Nome do fornecedor" value={form.nome_completo} onChange={(event) => setForm({ ...form, nome_completo: event.target.value })} className={field} /><Input placeholder="Nome curto / apelido" value={form.apelido} onChange={(event) => setForm({ ...form, apelido: event.target.value })} className={field} /><Input placeholder="Cidade" value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} className={field} /><Input placeholder="UF" maxLength={2} value={form.uf} onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase() })} className={field} /><Input placeholder="Código ICAO" value={form.codigo_icao} onChange={(event) => setForm({ ...form, codigo_icao: event.target.value.toUpperCase() })} className={field} /><Input placeholder="Telefone" value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} className={field} /><Input type="number" step="0.01" placeholder="Preço AVGAS" value={form.preco_avgas} onChange={(event) => setForm({ ...form, preco_avgas: event.target.value })} className={field} /><Input type="number" step="0.01" placeholder="Preço JET" value={form.preco_jet} onChange={(event) => setForm({ ...form, preco_jet: event.target.value })} className={field} /></div><div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-9 border-border bg-card text-xs">Cancelar</Button><Button type="button" disabled={saving || !form.nome_completo} onClick={() => void save()} className="h-9 text-xs">{saving ? "Salvando..." : "Cadastrar fornecedor"}</Button></div></section>}<section className={`${card} overflow-hidden`}><div className="border-b border-border p-3"><div className="relative max-w-xl"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, cidade ou ICAO..." className={`${field} w-full pl-9`} /></div></div>{suppliers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border bg-background/30 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Cidade</th><th className="px-5 py-3">ICAO</th><th className="px-5 py-3">Fornecedor</th><th className="px-5 py-3">Contato</th><th className="px-5 py-3">Telefone</th><th className="px-5 py-3 text-right">AVGAS (R$)</th><th className="px-5 py-3 text-right">JET (R$)</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id} className="border-b border-border/70 last:border-0 hover:bg-secondary/25"><td className="px-5 py-4 text-[10px] font-semibold uppercase">{supplier.cidade || "—"}{supplier.uf ? `-${supplier.uf}` : ""}</td><td className="px-5 py-4 font-mono text-[10px] text-primary">{supplier.codigo_icao || "—"}</td><td className="px-5 py-4 text-[11px] font-bold uppercase">{supplier.apelido || supplier.nome_completo}</td><td className="px-5 py-4 text-[10px] text-muted-foreground">{supplier.nome_completo || "—"}</td><td className="px-5 py-4 text-[10px] text-muted-foreground">{supplier.telefone || "—"}</td><td className="px-5 py-4 text-right font-mono text-[10px]">{Number(supplier.preco_avgas || 0) ? money(Number(supplier.preco_avgas)) : "—"}</td><td className="px-5 py-4 text-right font-mono text-[10px] font-bold text-emerald-300">{Number(supplier.preco_jet || 0) ? money(Number(supplier.preco_jet)) : "—"}</td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhum fornecedor encontrado" />}</section></div>;
}
