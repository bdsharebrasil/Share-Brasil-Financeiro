import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronLeft,
  CalendarRange,
  FolderOpen,
  MoreVertical,
  Download,
  Edit3,
  Fuel,
  MapPin,
  Plane,
  Plus,
  Search,
  Upload,
  X,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio } from "@/components/dashboard/PrimitivosDashboard";

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

const card =
  "rounded-2xl border border-white/[0.07] bg-[#091827]/90 shadow-[0_18px_50px_rgba(0,0,0,.18)]";

const field =
  "h-11 rounded-xl border border-[#20344d] bg-[#081522] px-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/10";

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const date = (value?: string | null) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "—";

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

export default function ControleAbastecimento({
  aoVoltar,
}: {
  aoVoltar?: () => void;
}) {
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
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(
    null,
  );
  const [buscaCliente, setBuscaCliente] = useState("");

  const load = async () => {
    setLoading(true);

    try {
      const [op, list] = await Promise.all([
        buscarAbastecimentoOpcoes(),
        buscarAbastecimentos(filters),
      ]);

      setOptions(op);
      setRecords(list.abastecimentos);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar os abastecimentos.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const totalLitros = useMemo(
    () =>
      records.reduce((sum, item) => sum + Number(item.litros || 0), 0),
    [records],
  );

  const totalValor = useMemo(
    () =>
      records.reduce((sum, item) => sum + Number(item.valor_total || 0), 0),
    [records],
  );

  const gruposMes = useMemo(() => {
    const grupos: Record<string, Abastecimento[]> = {};

    records.forEach((item) => {
      const mes = (item.data || "sem-data").slice(0, 7);
      (grupos[mes] ||= []).push(item);
    });

    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  const gruposPastas = useMemo(() => {
    const grupos: Record<string, Abastecimento[]> = {};

    records.forEach((item) => {
      const nome =
        item.socio_nome ||
        item.cliente_nome ||
        "Sem cliente ou sócio";

      (grupos[nome] ||= []).push(item);
    });

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [records]);

  const clientesDisponiveis = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nome: string;
        codigo?: string | null;
      }
    >();

    (options?.clientes || []).forEach((cliente) => {
      if (cliente.id && cliente.nome) {
        mapa.set(cliente.id, {
          id: cliente.id,
          nome: cliente.nome,
          codigo: cliente.codigo_cliente,
        });
      }
    });

    records.forEach((item) => {
      const id = item.cliente_id || item.socio_id;
      const nome =
        item.cliente_nome ||
        item.socio_nome ||
        "Cliente sem nome";

      if (id && !mapa.has(id)) {
        mapa.set(id, {
          id,
          nome,
          codigo:
            item.numero_voo ||
            item.numero_comanda ||
            null,
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );
  }, [options, records]);

  const clientesFiltrados = useMemo(
    () =>
      clientesDisponiveis.filter((cliente) =>
        cliente.nome
          .toLowerCase()
          .includes(buscaCliente.toLowerCase()),
      ),
    [clientesDisponiveis, buscaCliente],
  );

  const registrosCliente = useMemo(() => {
    if (!clienteSelecionado) return [];

    let itens = records.filter(
      (item) =>
        item.cliente_id === clienteSelecionado ||
        item.socio_id === clienteSelecionado,
    );

    if (filters.busca) {
      const termo = filters.busca.toLowerCase();

      itens = itens.filter(
        (item) =>
          item.trecho?.toLowerCase().includes(termo) ||
          item.local?.toLowerCase().includes(termo) ||
          item.numero_comanda?.toLowerCase().includes(termo) ||
          item.numero_nf?.toLowerCase().includes(termo),
      );
    }

    if (filters.status) {
      itens = itens.filter(
        (item) => item.status === filters.status,
      );
    }

    return itens.sort(
      (a, b) =>
        new Date(b.data || "").getTime() -
        new Date(a.data || "").getTime(),
    );
  }, [clienteSelecionado, records, filters]);

  const totalLitrosCliente = useMemo(
    () =>
      registrosCliente.reduce(
        (sum, item) => sum + Number(item.litros || 0),
        0,
      ),
    [registrosCliente],
  );

  const totalValorCliente = useMemo(
    () =>
      registrosCliente.reduce(
        (sum, item) => sum + Number(item.valor_total || 0),
        0,
      ),
    [registrosCliente],
  );

  const setField = (
    key: keyof Form,
    value: string | boolean,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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
          .map(([key, value]) => [
            key,
            value == null ? "" : value,
          ]),
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
        valor_total: Number(
          form.valor_total ||
            Number(form.litros || 0) *
              Number(form.valor_unitario || 0),
        ),
        desconto: form.desconto
          ? Number(form.desconto)
          : null,
        voo_emprestado: Boolean(form.voo_emprestado),
      };

      if (editing) {
        await atualizarAbastecimento(editing.id, payload);
      } else {
        await criarAbastecimento(payload);
      }

      setMessage(
        editing
          ? "Abastecimento atualizado."
          : "Abastecimento registrado.",
      );

      closeForm();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o abastecimento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este abastecimento?")) {
      return;
    }

    try {
      await excluirAbastecimento(id);
      setMessage("Abastecimento excluído.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir o abastecimento.",
      );
    }
  };

  const upload = async (
    id: string,
    type: "comanda" | "nota" | "boleto",
    file?: File,
  ) => {
    if (!file) return;

    try {
      await anexarArquivoAbastecimento(id, type, file);
      setMessage("Arquivo anexado.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível anexar o arquivo.",
      );
    }
  };

  const download = async (
    id: string,
    type: "comanda" | "nota" | "boleto",
  ) => {
    try {
      const blob = await baixarArquivoAbastecimento(id, type);
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `abastecimento-${id}-${type}`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível baixar o arquivo.",
      );
    }
  };

  const clienteAtual = clientesDisponiveis.find(
    (cliente) => cliente.id === clienteSelecionado,
  );

  return (
    <div className="min-h-screen bg-[#050b14] px-4 pb-10 pt-4 text-white">
      <div className="mx-auto max-w-[1540px]">

        {/* HEADER PRINCIPAL */}
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-3">
            {aoVoltar && (
              <button
                type="button"
                onClick={aoVoltar}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 transition hover:border-sky-500/30 hover:bg-sky-500/5 hover:text-white"
                title="Voltar"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/[0.08] text-sky-300">
              <Fuel size={21} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-[-0.04em] text-white md:text-2xl">
                  Controle de Abastecimento
                </h1>
              </div>

              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">
                Gestão operacional e financeira dos abastecimentos
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <MiniMetric
              icon={<FolderOpen size={14} />}
              label="Registros"
              value={String(records.length)}
            />

            <MiniMetric
              icon={<Fuel size={14} />}
              label="Litros"
              value={totalLitros.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            />

            <MiniMetric
              icon={<FileText size={14} />}
              label="Total"
              value={money(totalValor)}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>

        {/* ALERTAS */}
        {message && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-400/15 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300">
            <span>{message}</span>

            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-emerald-400/70 hover:text-emerald-200"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-400/15 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400/70 hover:text-red-200"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* TABS */}
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#08131f] p-1.5">
          <TabButton
            active={tab === "registros"}
            icon={<Fuel size={15} />}
            onClick={() => setTab("registros")}
          >
            Histórico de abastecimentos
          </TabButton>

          <TabButton
            active={tab === "fornecedores"}
            icon={<Building2 size={15} />}
            onClick={() => setTab("fornecedores")}
          >
            Fornecedores
          </TabButton>
        </div>

        {tab === "fornecedores" ? (
          <FornecedorTab
            options={options}
            onSaved={() => void load()}
            onError={setError}
          />
        ) : (
          <>
            {formOpen && (
              <div className="mb-6">
                <AbastecimentoForm
                  form={form}
                  options={options}
                  editing={editing}
                  saving={saving}
                  setField={setField}
                  onClose={closeForm}
                  onSave={() => void save()}
                />
              </div>
            )}

            {/* SELEÇÃO DE CLIENTE */}
            {!clienteSelecionado && (
              <>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400">
                      <Building2 size={13} />
                      Carteira de clientes
                    </div>

                    <h2 className="text-2xl font-black tracking-[-0.04em] md:text-3xl">
                      Selecione um cliente
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Escolha um cliente para visualizar o histórico de abastecimentos.
                    </p>
                  </div>

                  <div className="w-full xl:max-w-[360px]">
                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      />

                      <Input
                        value={buscaCliente}
                        onChange={(event) =>
                          setBuscaCliente(event.target.value)
                        }
                        placeholder="Buscar cliente por nome..."
                        className="h-12 rounded-xl border border-white/[0.08] bg-[#091725] pl-11 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>

                {/* CLIENTES */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className="min-h-[148px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#091725]"
                      />
                    ))
                  ) : clientesFiltrados.length ? (
                    clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() =>
                          setClienteSelecionado(cliente.id)
                        }
                        className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0c1c2c] to-[#08131f] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:shadow-[0_15px_40px_rgba(14,165,233,.08)]"
                      >
                        <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-sky-400/[0.04] blur-2xl transition group-hover:bg-sky-400/[0.08]" />

                        <div className="relative">
                          <div className="mb-6 flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-500/[0.07] text-sky-300">
                              <Building2 size={17} />
                            </div>

                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300">
                              <Plane size={10} />
                              {cliente.codigo || "AERONAVES 01"}
                            </span>
                          </div>

                          <div className="truncate text-base font-black uppercase tracking-[-0.03em] text-white">
                            {cliente.nome}
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 transition group-hover:text-sky-400">
                            Ver histórico
                            <ChevronLeft
                              size={12}
                              className="rotate-180"
                            />
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full">
                      <EstadoVazio label="Nenhum cliente encontrado" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* HISTÓRICO DO CLIENTE */}
            {clienteSelecionado && (
              <div className="space-y-5">

                {/* CABEÇALHO DO CLIENTE */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

                  <div>
                    <button
                      type="button"
                      onClick={() => setClienteSelecionado(null)}
                      className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/[0.05] hover:text-sky-300"
                    >
                      <ChevronLeft size={14} />
                      Voltar para clientes
                    </button>

                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-500/[0.07] text-sky-300">
                        <Building2 size={20} />
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-sky-400">
                          Histórico de abastecimentos
                        </p>

                        <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white md:text-3xl">
                          {clienteAtual?.nome || "Cliente selecionado"}
                        </h2>

                        {clienteAtual?.codigo && (
                          <p className="mt-1 text-xs font-mono text-slate-500">
                            {clienteAtual.codigo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      closeForm();
                      setFormOpen(true);
                    }}
                    className="h-11 gap-2 rounded-xl bg-[#258af0] px-5 text-sm font-semibold shadow-[0_8px_25px_rgba(37,138,240,.18)] hover:bg-[#1d78d6]"
                  >
                    <Plus size={16} />
                    Novo registro
                  </Button>
                </div>

                {/* RESUMO DO CLIENTE */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCard
                    icon={<FolderOpen size={16} />}
                    label="Registros encontrados"
                    value={String(registrosCliente.length)}
                  />

                  <SummaryCard
                    icon={<Fuel size={16} />}
                    label="Volume total"
                    value={`${totalLitrosCliente.toLocaleString(
                      "pt-BR",
                      {
                        minimumFractionDigits: 2,
                      },
                    )} L`}
                  />

                  <SummaryCard
                    icon={<FileText size={16} />}
                    label="Valor total"
                    value={money(totalValorCliente)}
                  />
                </div>

                {/* FILTROS + TABELA */}
                <section className={`${card} overflow-hidden`}>

                  <div className="border-b border-white/[0.06] p-4 md:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CalendarRange
                        size={15}
                        className="text-sky-400"
                      />

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-300">
                          Filtros
                        </p>

                        <p className="text-[10px] text-slate-500">
                          Refine os registros exibidos abaixo.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                      <FilterField label="Buscar">
                        <div className="relative">
                          <Search
                            size={15}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                          />

                          <Input
                            value={filters.busca}
                            onChange={(event) =>
                              setFilters({
                                ...filters,
                                busca: event.target.value,
                              })
                            }
                            placeholder="Trecho, local, comanda..."
                            className={`${field} w-full pl-10`}
                          />
                        </div>
                      </FilterField>

                      <FilterField label="Cliente">
                        <select
                          value={filters.cliente_id}
                          onChange={(event) =>
                            setFilters({
                              ...filters,
                              cliente_id: event.target.value,
                            })
                          }
                          className={`${field} w-full`}
                        >
                          <option value="">Todos</option>

                          {options?.clientes.map((client) => (
                            <option
                              key={client.id}
                              value={client.id}
                            >
                              {client.nome ||
                                "Sem razão social"}
                            </option>
                          ))}
                        </select>
                      </FilterField>

                      <FilterField label="Status">
                        <select
                          value={filters.status}
                          onChange={(event) =>
                            setFilters({
                              ...filters,
                              status: event.target.value,
                            })
                          }
                          className={`${field} w-full`}
                        >
                          <option value="">Todos</option>
                          <option value="pendente">
                            Pendente
                          </option>
                          <option value="pago">Pago</option>
                          <option value="cancelado">
                            Cancelado
                          </option>
                        </select>
                      </FilterField>

                      <FilterField label="Ano">
                        <input
                          type="text"
                          value="2026"
                          readOnly
                          className={`${field} w-full`}
                        />
                      </FilterField>
                    </div>
                  </div>

                  {/* TABELA */}
                  <div className="overflow-x-auto">
                    <table className="min-w-[1200px] w-full border-separate border-spacing-0 text-left">
                      <thead>
                        <tr className="bg-[#07121e] text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          <th className="px-5 py-4">Data</th>
                          <th className="px-5 py-4">Voo</th>
                          <th className="px-5 py-4">Trecho</th>
                          <th className="px-5 py-4">Local</th>
                          <th className="px-5 py-4">Comanda</th>
                          <th className="px-5 py-4">N.F.</th>
                          <th className="px-5 py-4">Fornecedor</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">
                            Litros
                          </th>
                          <th className="px-5 py-4 text-right">
                            Valor unit.
                          </th>
                          <th className="px-5 py-4 text-right">
                            Total
                          </th>
                          <th className="px-5 py-4 text-right">
                            Ações
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          Array.from({ length: 6 }).map(
                            (_, index) => (
                              <tr key={index}>
                                <td
                                  colSpan={12}
                                  className="px-5 py-5"
                                >
                                  <div className="h-8 animate-pulse rounded-lg bg-white/[0.025]" />
                                </td>
                              </tr>
                            ),
                          )
                        ) : registrosCliente.length ? (
                          registrosCliente
                            .slice(0, 10)
                            .map((record) => (
                              <AbastecimentoRow
                                key={record.id}
                                record={record}
                                onEdit={editRecord}
                                onDelete={remove}
                                onUpload={upload}
                                onDownload={download}
                              />
                            ))
                        ) : (
                          <tr>
                            <td
                              colSpan={12}
                              className="px-5 py-16 text-center"
                            >
                              <div className="mx-auto flex max-w-sm flex-col items-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-slate-500">
                                  <Fuel size={19} />
                                </div>

                                <p className="text-sm font-semibold text-slate-300">
                                  Nenhum registro encontrado
                                </p>

                                <p className="mt-1 text-xs text-slate-600">
                                  Não existem abastecimentos para os filtros atuais.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-white/[0.06] bg-[#07121e]/60 px-5 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Exibindo{" "}
                      <strong className="text-slate-300">
                        {Math.min(
                          registrosCliente.length,
                          10,
                        )}
                      </strong>{" "}
                      de{" "}
                      <strong className="text-slate-300">
                        {registrosCliente.length}
                      </strong>{" "}
                      registro(s)
                    </span>

                    <span>
                      Valores em BRL
                    </span>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTES VISUAIS
========================================================= */

function TabButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
        active
          ? "border border-sky-400/20 bg-sky-500/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
          : "border border-transparent text-slate-500 hover:bg-white/[0.025] hover:text-slate-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-[110px] rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ${className}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </div>

      <div className="truncate text-sm font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#091725] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>

        <span className="text-sky-400">
          {icon}
        </span>
      </div>

      <div className="truncate text-lg font-black tracking-[-0.03em] text-white">
        {value}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   LINHA DE ABASTECIMENTO
========================================================= */

function AbastecimentoRow({
  record,
  onEdit,
  onDelete,
  onUpload,
  onDownload,
}: {
  record: Abastecimento;
  onEdit: (record: Abastecimento) => void;
  onDelete: (id: string) => void;
  onUpload: (
    id: string,
    type: "comanda" | "nota" | "boleto",
    file?: File,
  ) => void;
  onDownload: (
    id: string,
    type: "comanda" | "nota" | "boleto",
  ) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);

  const pago = record.status === "pago";

  const fileType = record.comanda_url
    ? "comanda"
    : record.nota_url
      ? "nota"
      : "boleto";

  return (
    <tr className="border-b border-white/[0.045] bg-[#091725]/35 transition hover:bg-sky-500/[0.025]">

      <td className="whitespace-nowrap px-5 py-4 text-[11px] font-semibold text-slate-300">
        {date(record.data)}
      </td>

      <td className="px-5 py-4">
        <span className="rounded-md bg-sky-500/[0.06] px-2 py-1 font-mono text-[10px] font-bold text-sky-300">
          {record.numero_voo ||
            record.matricula_registro ||
            "—"}
        </span>
      </td>

      <td className="max-w-[170px] px-5 py-4">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-300">
          {record.trecho || "—"}
        </p>
      </td>

      <td className="max-w-[120px] px-5 py-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">
            {record.local || "—"}
          </span>
        </div>
      </td>

      <td className="px-5 py-4 font-mono text-[10px] text-sky-300">
        {record.numero_comanda || "—"}
      </td>

      <td className="px-5 py-4 font-mono text-[10px] text-sky-300">
        {record.numero_nf || "—"}
      </td>

      <td className="max-w-[140px] px-5 py-4 text-[10px] text-slate-500">
        <p className="truncate">
          {record.fornecedor_apelido ||
            record.fornecedor_nome ||
            "—"}
        </p>
      </td>

      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold ${
            pago
              ? "border-emerald-400/10 bg-emerald-400/[0.07] text-emerald-300"
              : record.status === "cancelado"
                ? "border-red-400/10 bg-red-400/[0.07] text-red-300"
                : "border-amber-400/10 bg-amber-400/[0.07] text-amber-300"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />

          {pago
            ? "Pago"
            : record.status === "cancelado"
              ? "Cancelado"
              : "Pendente"}
        </span>
      </td>

      <td className="px-5 py-4 text-right font-mono text-[10px] font-semibold text-slate-200">
        {Number(record.litros || 0).toLocaleString(
          "pt-BR",
          {
            minimumFractionDigits: 2,
          },
        )}
      </td>

      <td className="px-5 py-4 text-right font-mono text-[10px] text-slate-500">
        {money(record.valor_unitario)}
      </td>

      <td className="px-5 py-4 text-right font-mono text-[10px] font-bold text-emerald-300">
        {money(record.valor_total)}
      </td>

      <td className="relative px-5 py-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setMenuAberto((atual) => !atual)
            }
            aria-label="Abrir ações"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-slate-500 transition hover:border-sky-400/25 hover:bg-sky-500/[0.05] hover:text-white"
          >
            <MoreVertical size={15} />
          </button>

          {menuAberto && (
            <div className="absolute right-4 top-12 z-30 w-48 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a1724] p-1.5 shadow-2xl">

              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onEdit(record);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Edit3 size={13} />
                Editar registro
              </button>

              {record.comanda_url ||
              record.nota_url ||
              record.boleto_url ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    void onDownload(
                      record.id,
                      fileType,
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <Download size={13} />
                  Baixar documento
                </button>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[10px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
                  <Upload size={13} />
                  Anexar comanda

                  <input
                    className="hidden"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(event) => {
                      setMenuAberto(false);

                      void onUpload(
                        record.id,
                        "comanda",
                        event.target.files?.[0],
                      );
                    }}
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  void onDelete(record.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-red-300 transition hover:bg-red-400/[0.07]"
              >
                <X size={13} />
                Excluir registro
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   FORMULÁRIO DE ABASTECIMENTO
========================================================= */

function AbastecimentoForm({
  form,
  options,
  editing,
  saving,
  setField,
  onClose,
  onSave,
}: {
  form: Form;
  options: AbastecimentoOpcoes | null;
  editing: Abastecimento | null;
  saving: boolean;
  setField: (
    key: keyof Form,
    value: string | boolean,
  ) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <section
      className={`${card} overflow-hidden`}
    >
      {/* HEADER FORM */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a1826] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/[0.08] text-sky-400">
              <Fuel size={15} />
            </div>

            <div>
              <p className="text-sm font-bold text-white">
                {editing
                  ? "Editar abastecimento"
                  : "Novo abastecimento"}
              </p>

              <p className="text-[10px] text-slate-500">
                Registre as informações operacionais e financeiras.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
        >
          <X size={15} />
        </button>
      </div>

      {/* CAMPOS */}
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">

        <FormField label="Data">
          <Input
            type="date"
            value={form.data}
            onChange={(event) =>
              setField("data", event.target.value)
            }
            className={field}
          />
        </FormField>

        <FormField label="Local">
          <Input
            placeholder="Local do abastecimento"
            value={form.local}
            onChange={(event) =>
              setField("local", event.target.value)
            }
            className={field}
          />
        </FormField>

        <FormField label="Trecho">
          <Input
            placeholder="Trecho"
            value={form.trecho}
            onChange={(event) =>
              setField("trecho", event.target.value)
            }
            className={field}
          />
        </FormField>

        <FormField label="Combustível">
          <select
            value={form.tipo_combustivel}
            onChange={(event) =>
              setField(
                "tipo_combustivel",
                event.target.value,
              )
            }
            className={field}
          >
            <option>JET A1</option>
            <option>AVGAS</option>
          </select>
        </FormField>

        <FormField label="Aeronave">
          <select
            value={form.aeronave_id}
            onChange={(event) =>
              setField(
                "aeronave_id",
                event.target.value,
              )
            }
            className={field}
          >
            <option value="">Aeronave</option>

            {options?.aeronaves.map((aircraft) => (
              <option
                key={aircraft.id}
                value={aircraft.id}
              >
                {aircraft.matricula_registro} ·{" "}
                {aircraft.modelo}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Cliente cotista">
          <select
            value={form.cliente_id}
            onChange={(event) =>
              setField(
                "cliente_id",
                event.target.value,
              )
            }
            className={field}
          >
            <option value="">
              Cliente cotista
            </option>

            {options?.clientes.map((client) => (
              <option
                key={client.id}
                value={client.id}
              >
                {client.nome || "Sem razão social"}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Sócio">
          <select
            value={form.socio_id}
            onChange={(event) =>
              setField(
                "socio_id",
                event.target.value,
              )
            }
            className={field}
          >
            <option value="">Sócio</option>

            {options?.socios.map((partner) => (
              <option
                key={partner.id}
                value={partner.id}
              >
                {partner.nome}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Fornecedor">
          <select
            value={form.fornecedor_id}
            onChange={(event) =>
              setField(
                "fornecedor_id",
                event.target.value,
              )
            }
            className={field}
          >
            <option value="">Fornecedor</option>

            {options?.fornecedores.map((supplier) => (
              <option
                key={supplier.id}
                value={supplier.id}
              >
                {supplier.apelido ||
                  supplier.nome_completo}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Nº comanda">
          <Input
            placeholder="Nº comanda"
            value={form.numero_comanda}
            onChange={(event) =>
              setField(
                "numero_comanda",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>

        <FormField label="Nº NF">
          <Input
            placeholder="Nº NF"
            value={form.numero_nf}
            onChange={(event) =>
              setField(
                "numero_nf",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>

        <FormField label="Litros">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Litros"
            value={form.litros}
            onChange={(event) =>
              setField(
                "litros",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>

        <FormField label="Valor unitário">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor unitário"
            value={form.valor_unitario}
            onChange={(event) =>
              setField(
                "valor_unitario",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>

        <FormField label="Valor total">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor total"
            value={form.valor_total}
            onChange={(event) =>
              setField(
                "valor_total",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>

        <FormField label="Forma de pagamento">
          <select
            value={form.forma_pagamento}
            onChange={(event) =>
              setField(
                "forma_pagamento",
                event.target.value,
              )
            }
            className={field}
          >
            <option value="">
              Forma de pagamento
            </option>
            <option>Cartão</option>
            <option>Boleto</option>
            <option>Transferência</option>
            <option>Pix</option>
          </select>
        </FormField>

        <FormField label="Status">
          <select
            value={form.status}
            onChange={(event) =>
              setField("status", event.target.value)
            }
            className={field}
          >
            <option value="pendente">
              Pendente
            </option>
            <option value="pago">Pago</option>
            <option value="cancelado">
              Cancelado
            </option>
          </select>
        </FormField>

        <FormField label="Nº voo">
          <Input
            placeholder="Nº voo"
            value={form.numero_voo}
            onChange={(event) =>
              setField(
                "numero_voo",
                event.target.value,
              )
            }
            className={field}
          />
        </FormField>
      </div>

      {/* RODAPÉ */}
      <div className="grid gap-4 border-t border-white/[0.06] bg-[#07121e]/60 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <FormField label="Observações">
          <Textarea
            placeholder="Observações"
            value={form.observacao}
            onChange={(event) =>
              setField(
                "observacao",
                event.target.value,
              )
            }
            className="min-h-[74px] rounded-xl border-[#20344d] bg-[#081522] text-sm text-white placeholder:text-slate-500"
          />
        </FormField>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[10px] text-slate-400">
            <input
              type="checkbox"
              checked={form.voo_emprestado}
              onChange={(event) =>
                setField(
                  "voo_emprestado",
                  event.target.checked,
                )
              }
              className="accent-sky-500"
            />
            Voo emprestado
          </label>

          <Button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="h-11 gap-2 rounded-xl bg-[#258af0] px-5 text-xs font-semibold hover:bg-[#1d78d6]"
          >
            <Plus size={14} />

            {saving
              ? "Salvando..."
              : editing
                ? "Atualizar"
                : "Registrar"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   FORNECEDORES
========================================================= */

function FornecedorTab({
  options,
  onSaved,
  onError,
}: {
  options: AbastecimentoOpcoes | null;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<
    string,
    any
  > | null>(null);

  const [menuAberto, setMenuAberto] = useState<string | null>(
    null,
  );

  const vazio = {
    nome_completo: "",
    apelido: "",
    cidade: "",
    uf: "",
    codigo_icao: "",
    telefone: "",
    preco_avgas: "",
    preco_jet: "",
  };

  const [form, setForm] = useState(vazio);

  const suppliers = (options?.fornecedores || []).filter(
    (supplier) =>
      [
        supplier.nome_completo,
        supplier.apelido,
        supplier.cidade,
        supplier.codigo_icao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const save = async () => {
    if (!form.nome_completo) return;

    setSaving(true);

    try {
      if (editing) {
        await atualizarFornecedorAbastecimento(
          editing.id,
          {
            ...form,
            preco_avgas: Number(
              form.preco_avgas || 0,
            ),
            preco_jet: Number(
              form.preco_jet || 0,
            ),
          },
        );
      } else {
        await criarFornecedorAbastecimento({
          ...form,
          preco_avgas: Number(
            form.preco_avgas || 0,
          ),
          preco_jet: Number(
            form.preco_jet || 0,
          ),
        });
      }

      setForm(vazio);
      setEditing(null);
      setFormOpen(false);
      onSaved();
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o fornecedor.",
      );
    } finally {
      setSaving(false);
    }
  };

  const editar = (supplier: Record<string, any>) => {
    setEditing(supplier);

    setForm({
      ...vazio,
      ...Object.fromEntries(
        Object.entries(supplier)
          .filter(([key]) => key in vazio)
          .map(([key, value]) => [
            key,
            value == null ? "" : String(value),
          ]),
      ),
    });

    setFormOpen(true);
    setMenuAberto(null);
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Excluir este fornecedor?")) {
      return;
    }

    try {
      await excluirFornecedorAbastecimento(id);
      onSaved();
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir o fornecedor.",
      );
    }
  };

  return (
    <div className="space-y-5">

      {/* CABEÇALHO */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-sky-400">
            <MapPin size={13} />
            Base de fornecedores
          </div>

          <h2 className="text-2xl font-black tracking-[-0.04em]">
            Fornecedores de combustível
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {suppliers.length} fornecedor(es)
            encontrado(s)
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(vazio);
            setFormOpen((current) => !current);
          }}
          className="h-11 gap-2 rounded-xl bg-[#258af0] px-5 text-xs font-semibold hover:bg-[#1d78d6]"
        >
          <Plus size={15} />
          Novo fornecedor
        </Button>
      </div>

      {/* FORM FORNECEDOR */}
      {formOpen && (
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-white/[0.06] bg-[#0a1826] px-5 py-4">
            <p className="text-sm font-bold">
              {editing
                ? "Editar fornecedor"
                : "Cadastrar fornecedor"}
            </p>

            <p className="mt-1 text-[10px] text-slate-500">
              Cadastre dados operacionais e preços praticados.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            {(
              [
                [
                  "nome_completo",
                  "Nome do fornecedor",
                ],
                [
                  "apelido",
                  "Nome curto / apelido",
                ],
                ["cidade", "Cidade"],
                ["uf", "UF"],
                ["codigo_icao", "Código ICAO"],
                ["telefone", "Telefone"],
                ["preco_avgas", "Preço AVGAS"],
                ["preco_jet", "Preço JET"],
              ] as Array<
                [keyof typeof vazio, string]
              >
            ).map(([key, label]) => (
              <FormField
                key={key}
                label={label}
              >
                <Input
                  type={
                    key.startsWith("preco")
                      ? "number"
                      : "text"
                  }
                  step={
                    key.startsWith("preco")
                      ? "0.01"
                      : undefined
                  }
                  placeholder={label}
                  value={form[key]}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      [key]: event.target.value,
                    })
                  }
                  className={field}
                />
              </FormField>
            ))}
          </div>

          <div className="flex flex-col justify-end gap-2 border-t border-white/[0.06] bg-[#07121e]/50 p-5 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              className="h-10 rounded-xl border-white/[0.08] bg-transparent text-xs text-slate-300 hover:bg-white/[0.04]"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              disabled={
                saving || !form.nome_completo
              }
              onClick={() => void save()}
              className="h-10 rounded-xl bg-[#258af0] px-5 text-xs font-semibold hover:bg-[#1d78d6]"
            >
              {saving
                ? "Salvando..."
                : editing
                  ? "Atualizar fornecedor"
                  : "Cadastrar fornecedor"}
            </Button>
          </div>
        </section>
      )}

      {/* TABELA FORNECEDORES */}
      <section className={`${card} overflow-hidden`}>

        <div className="border-b border-white/[0.06] bg-[#081522] p-4 md:p-5">
          <div className="relative max-w-xl">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <Input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Buscar por nome, cidade ou ICAO..."
              className={`${field} w-full pl-10`}
            />
          </div>
        </div>

        {suppliers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-white/[0.05] bg-[#07121e] text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">
                  <th className="px-5 py-4">
                    Cidade
                  </th>

                  <th className="px-5 py-4">
                    ICAO
                  </th>

                  <th className="px-5 py-4">
                    Fornecedor
                  </th>

                  <th className="px-5 py-4">
                    Contato
                  </th>

                  <th className="px-5 py-4">
                    Telefone
                  </th>

                  <th className="px-5 py-4 text-right">
                    AVGAS
                  </th>

                  <th className="px-5 py-4 text-right">
                    JET
                  </th>

                  <th className="px-5 py-4 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-white/[0.045] transition hover:bg-sky-500/[0.025]"
                  >
                    <td className="px-5 py-4 text-[10px] font-semibold uppercase text-slate-300">
                      {supplier.cidade || "—"}
                      {supplier.uf
                        ? `-${supplier.uf}`
                        : ""}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-md bg-sky-500/[0.06] px-2 py-1 font-mono text-[10px] font-bold text-sky-300">
                        {supplier.codigo_icao || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-[11px] font-bold uppercase text-white">
                      {supplier.apelido ||
                        supplier.nome_completo}
                    </td>

                    <td className="px-5 py-4 text-[10px] text-slate-500">
                      {supplier.nome_completo ||
                        "—"}
                    </td>

                    <td className="px-5 py-4 text-[10px] text-slate-500">
                      {supplier.telefone || "—"}
                    </td>

                    <td className="px-5 py-4 text-right font-mono text-[10px] text-slate-300">
                      {Number(
                        supplier.preco_avgas || 0,
                      )
                        ? money(
                            Number(
                              supplier.preco_avgas,
                            ),
                          )
                        : "—"}
                    </td>

                    <td className="px-5 py-4 text-right font-mono text-[10px] font-bold text-emerald-300">
                      {Number(
                        supplier.preco_jet || 0,
                      )
                        ? money(
                            Number(
                              supplier.preco_jet,
                            ),
                          )
                        : "—"}
                    </td>

                    <td className="relative px-5 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuAberto(
                              menuAberto ===
                                supplier.id
                                ? null
                                : supplier.id,
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          <MoreVertical
                            size={15}
                          />
                        </button>

                        {menuAberto ===
                          supplier.id && (
                          <div className="absolute right-4 top-12 z-30 w-40 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a1724] p-1.5 shadow-2xl">

                            <button
                              type="button"
                              onClick={() =>
                                editar(
                                  supplier,
                                )
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                            >
                              <Edit3 size={13} />
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuAberto(null);
                                void excluir(
                                  supplier.id,
                                );
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-red-300 transition hover:bg-red-400/[0.07]"
                            >
                              <X size={13} />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EstadoVazio label="Nenhum fornecedor encontrado" />
          </div>
        )}
      </section>
    </div>
  );
}
