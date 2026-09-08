import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, FileDown, FilePlus2, FileText, Folder, FolderOpen, Paperclip, Plane, Plus, Save, Send, Trash2, Upload, Users, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import {
  atualizarRelatorioDespesaViagem,
  buscarOpcoesRelatorioViagem,
  buscarRelatoriosDespesaViagem,
  criarRelatorioDespesaViagem,
  decidirAprovacaoRelatorio,
  enviarAnexoRelatorio,
  enviarDespesaAoCliente,
  enviarPdfRelatorio,
  enviarRelatorioParaAprovacao,
  excluirAnexoRelatorio,
  finalizarRelatorioDespesaViagem,
  type OpcoesRelatorioViagem,
  type RelatorioDespesaViagem as Relatorio,
} from "@/lib/colaborador-api";

type Despesa = { id: string; data: string; categoria: string; descricao: string; valor: number; observacoes: string };
type Formulario = {
  numero_relatorio: string;
  numero_voo: string;
  cliente_id: string;
  socio_id: string;
  aeronave_id: string;
  rota: string;
  data_inicio: string;
  data_fim: string;
  quantidade_dias: string;
  tripulacao_id: string;
  nome_tripulante: string;
  tripulante_id_2: string;
  nome_tripulante_2: string;
  observacoes: string;
};
const categorias = ["Alimentação", "Hospedagem", "Transporte", "Combustível", "Outros"];
const vazioFormulario = (): Formulario => ({ numero_relatorio: "", numero_voo: "", cliente_id: "", socio_id: "", aeronave_id: "", rota: "", data_inicio: new Date().toISOString().slice(0, 10), data_fim: new Date().toISOString().slice(0, 10), quantidade_dias: "1", tripulacao_id: "", nome_tripulante: "", tripulante_id_2: "", nome_tripulante_2: "", observacoes: "" });
const novaDespesa = (): Despesa => ({ id: crypto.randomUUID(), data: new Date().toISOString().slice(0, 10), categoria: "Alimentação", descricao: "", valor: 0, observacoes: "" });
function moeda(valor: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0); }
function dataBr(data?: string | null) { if (!data) return "—"; const [ano, mes, dia] = data.slice(0, 10).split("-"); return ano && mes && dia ? `${dia}/${mes}/${ano}` : data; }
function statusLabel(status?: string) { return ({ rascunho: "Rascunho", finalizado: "Finalizado", aguardando_aprovacao: "Aguardando aprovação", ajuste_necessario: "Ajuste necessário", aprovado: "Aprovado", enviado_cliente: "Enviado ao cliente" } as Record<string, string>)[status || ""] || status || "Rascunho"; }
function statusClass(status?: string) { return status === "aprovado" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : status === "ajuste_necessario" ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : status === "aguardando_aprovacao" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-border bg-secondary/50 text-muted-foreground"; }

export default function RelatorioDespesaViagem({ aoVoltar }: { aoVoltar?: () => void }) {
  const [opcoes, setOpcoes] = useState<OpcoesRelatorioViagem>({ clientes: [], aeronaves: [], tripulantes: [], voos: [], socios: [] });
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [form, setForm] = useState<Formulario>(vazioFormulario);
  const [despesas, setDespesas] = useState<Despesa[]>([novaDespesa()]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [anexando, setAnexando] = useState(false);
  const [aba, setAba] = useState<"lista" | "editor">("lista");
  const [visaoLista, setVisaoLista] = useState<"finalizados" | "rascunhos">("finalizados");
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);
  const [comentarioTripulacao, setComentarioTripulacao] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try { const [options, reports] = await Promise.all([buscarOpcoesRelatorioViagem(), buscarRelatoriosDespesaViagem()]); setOpcoes({ clientes: Array.isArray(options?.clientes) ? options.clientes : [], aeronaves: Array.isArray(options?.aeronaves) ? options.aeronaves : [], tripulantes: Array.isArray(options?.tripulantes) ? options.tripulantes : [], voos: Array.isArray(options?.voos) ? options.voos : [], socios: Array.isArray(options?.socios) ? options.socios : [] }); setRelatorios(Array.isArray(reports?.relatorios) ? reports.relatorios : []); }
    catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível carregar os relatórios." }); }
    finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); }, []);
  const total = useMemo(() => despesas.reduce((soma, item) => soma + (Number(item.valor) || 0), 0), [despesas]);
  const clienteSelecionado = opcoes.clientes.find((item) => item.id === form.cliente_id);
  const aeronaveSelecionada = opcoes.aeronaves.find((item) => item.id === form.aeronave_id);
  const tripulantes = opcoes.tripulantes.map((item) => ({ id: item.id, label: `${item.nome_completo} · ${item.canac || item.origem}` }));
  const setCampo = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const iniciarNovo = () => { setRelatorio(null); setForm(vazioFormulario()); setDespesas([novaDespesa()]); setMensagem(null); setAba("editor"); };
  const abrirRelatorio = (item: Relatorio) => {
    setRelatorio(item); setForm({ numero_relatorio: item.numero_relatorio || "", numero_voo: item.numero_voo || "", cliente_id: item.cliente_id || "", socio_id: item.socio_id || "", aeronave_id: item.aeronave_id || "", rota: item.rota || "", data_inicio: item.data_inicio || "", data_fim: item.data_fim || "", quantidade_dias: String(item.quantidade_dias || 1), tripulacao_id: item.tripulacao_id || "", nome_tripulante: item.nome_tripulante || "", tripulante_id_2: item.tripulante_id_2 || "", nome_tripulante_2: item.nome_tripulante_2 || "", observacoes: item.observacoes || "" });
    setDespesas((Array.isArray(item.despesas) ? item.despesas : []).map((despesa: Partial<Despesa>) => ({ id: despesa.id || crypto.randomUUID(), data: despesa.data || "", categoria: despesa.categoria || "Outros", descricao: despesa.descricao || "", valor: Number(despesa.valor) || 0, observacoes: despesa.observacoes || "" })) || [novaDespesa()]); setMensagem(null); setAba("editor");
  };
  const payload = () => ({ ...form, quantidade_dias: Number(form.quantidade_dias) || 1, despesas: despesas.map(({ id: _id, ...item }) => ({ ...item, valor: Number(item.valor) || 0 })), matricula_aeronave: aeronaveSelecionada?.matricula_registro || null, total_tripulante_1: total, total_tripulante_2: form.tripulante_id_2 ? total : 0 });
  const salvar = async (silencioso = false) => {
    setSalvando(true); setMensagem(null);
    try { const resposta = relatorio ? await atualizarRelatorioDespesaViagem(relatorio.id, payload()) : await criarRelatorioDespesaViagem(payload()); setRelatorio(resposta.relatorio); setRelatorios((atuais) => [resposta.relatorio, ...atuais.filter((item) => item.id !== resposta.relatorio.id)]); if (!silencioso) setMensagem({ tipo: "ok", texto: "Relatório salvo com sucesso." }); return resposta.relatorio; }
    catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível salvar o relatório." }); return null; }
    finally { setSalvando(false); }
  };
  const gerarPdf = async (item: Relatorio) => {
    const documento = new jsPDF(); documento.setFont("helvetica", "bold"); documento.setFontSize(16); documento.text("RELATÓRIO DE DESPESA DE VIAGEM", 18, 20); documento.setFontSize(10); documento.setFont("helvetica", "normal");
    const linhas = [`Número: ${item.numero_relatorio}`, `Voo: ${item.numero_voo || "Não informado"}`, `Cliente: ${item.cliente_nome || clienteSelecionado?.razao_social || "Não informado"}`, `Aeronave: ${item.aeronave_matricula || aeronaveSelecionada?.matricula_registro || "Não informado"}`, `Período: ${dataBr(item.data_inicio)} a ${dataBr(item.data_fim)}`, `Tripulante 1: ${item.nome_tripulante || form.nome_tripulante}`, `Tripulante 2: ${item.nome_tripulante_2 || form.nome_tripulante_2 || "Não informado"}`]; linhas.forEach((linha, index) => documento.text(linha, 18, 34 + index * 7));
    let y = 94; documento.setFont("helvetica", "bold"); documento.text("Despesas", 18, y); y += 8; documento.setFont("helvetica", "normal"); despesas.forEach((despesa) => { const texto = `${dataBr(despesa.data)} · ${despesa.categoria} · ${despesa.descricao || "Sem descrição"} — ${moeda(despesa.valor)}`; documento.text(texto.slice(0, 115), 18, y); y += 6; if (y > 275) { documento.addPage(); y = 20; } }); documento.setFont("helvetica", "bold"); documento.text(`Total: ${moeda(total)}`, 18, Math.min(y + 6, 285)); if (item.observacoes) { documento.setFont("helvetica", "normal"); documento.text(`Observações: ${item.observacoes}`.slice(0, 115), 18, Math.min(y + 14, 292)); }
    const blob = documento.output("blob"); const arquivo = new File([blob], `relatorio-${item.numero_relatorio}.pdf`, { type: "application/pdf" }); const resposta = await enviarPdfRelatorio(item.id, arquivo); setRelatorio((atual) => atual ? { ...atual, pdf_url: resposta.pdf_url } : atual); return resposta;
  };
  const finalizar = async () => { const salvo = await salvar(true); if (!salvo) return; setSalvando(true); try { const resposta = await finalizarRelatorioDespesaViagem(salvo.id); setRelatorio(resposta.relatorio); setRelatorios((atuais) => atuais.map((item) => item.id === salvo.id ? resposta.relatorio : item)); await gerarPdf(resposta.relatorio); setMensagem({ tipo: "ok", texto: "Relatório finalizado e PDF salvo no armazenamento." }); } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível finalizar o relatório." }); } finally { setSalvando(false); } };
  const enviarAprovacao = async (pos: 1 | 2) => { if (!relatorio) return; setSalvando(true); try { const resposta = await enviarRelatorioParaAprovacao(relatorio.id, pos); setRelatorio(resposta.relatorio); setRelatorios((atuais) => atuais.map((item) => item.id === relatorio.id ? resposta.relatorio : item)); setMensagem({ tipo: "ok", texto: `Relatório enviado para aprovação do tripulante ${pos}.` }); } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível enviar para aprovação." }); } finally { setSalvando(false); } };
  const enviarCliente = async () => { if (!relatorio) return; try { await enviarDespesaAoCliente(relatorio.id); setMensagem({ tipo: "ok", texto: "O envio ao cliente será habilitado na segunda etapa do fluxo." }); } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível iniciar o envio." }); } };
  const uploadAnexo = async (event: React.ChangeEvent<HTMLInputElement>) => { const arquivo = event.target.files?.[0]; if (!arquivo || !relatorio) return; setAnexando(true); try { const resposta = await enviarAnexoRelatorio(relatorio.id, arquivo); setRelatorio((atual) => atual ? { ...atual, anexos: [...(atual.anexos || []), resposta.anexo] } : atual); setMensagem({ tipo: "ok", texto: "Nota fiscal anexada." }); } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível anexar a nota." }); } finally { setAnexando(false); event.target.value = ""; } };
  const removerAnexo = async (id: string) => { if (!relatorio) return; try { await excluirAnexoRelatorio(relatorio.id, id); setRelatorio((atual) => atual ? { ...atual, anexos: (atual.anexos || []).filter((item) => item.id !== id) } : atual); } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível remover o anexo." }); } };
  const atualizarDespesa = (id: string, campo: keyof Despesa, valor: string | number) => setDespesas((atuais) => atuais.map((item) => item.id === id ? { ...item, [campo]: valor } : item));
  const aprovado = relatorio?.status === "aprovado";
  const bloqueado = Boolean(relatorio && ["aguardando_aprovacao", "aprovado", "enviado_cliente"].includes(relatorio.status));

  if (aba === "lista") return <BibliotecaRelatorios
    carregando={carregando}
    clientes={opcoes.clientes}
    clienteAberto={clienteAberto}
    onAbrirCliente={setClienteAberto}
    onAbrirRelatorio={abrirRelatorio}
    onNovoRelatorio={iniciarNovo}
    onVoltarPastas={() => setClienteAberto(null)}
    relatorios={relatorios}
    visao={visaoLista}
    onMudarVisao={(visao) => { setVisaoLista(visao); setClienteAberto(null); }}
  />;


  return <div className="route-enter space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-3"><Button type="button" variant="ghost" size="icon" onClick={() => { setAba("lista"); void carregar(); }} aria-label="Voltar para relatórios"><ArrowLeft size={18} /></Button><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · Relatório de viagem</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{relatorio?.numero_relatorio || "Novo relatório de despesa"}</h1><p className="mt-1 text-sm text-muted-foreground">Preencha os dados da viagem, lance as despesas e anexe as notas fiscais.</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void salvar()} disabled={salvando || bloqueado} className="gap-2"><Save size={15} /> Salvar rascunho</Button>{relatorio && <Button type="button" onClick={() => void finalizar()} disabled={salvando || bloqueado} className="gap-2"><CheckCircle2 size={15} /> Finalizar relatório</Button>}</div></div>{mensagem && <Feedback {...mensagem} />}
      {relatorio && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3"><Badge className={statusClass(relatorio.status)}>{statusLabel(relatorio.status)}</Badge><span className="text-xs text-muted-foreground">Última atualização: {dataBr(relatorio.atualizado_em)}</span>{relatorio.pdf_url && <a href={relatorio.pdf_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><FileDown size={14} /> Abrir PDF</a>}</div>}
      <Card><CardHeader><CardTitle className="text-base">Informações da viagem</CardTitle><CardDescription>Todos os seletores de consulta usam busca para localizar rapidamente os cadastros.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Campo label="Número do relatório"><Input value={form.numero_relatorio} onChange={(e) => setCampo("numero_relatorio", e.target.value)} placeholder="Gerado automaticamente se vazio" disabled={bloqueado} /></Campo><Campo label="Número do voo"><SearchableCombobox items={opcoes.voos.map((item) => ({ id: item.numero_voo, label: `${item.numero_voo} · ${dataBr(item.data_agendada)}` }))} value={form.numero_voo} onChange={(valor) => setCampo("numero_voo", valor)} placeholder="Busque pelo número do voo..." searchPlaceholder="Buscar voo..." allowFreeText disabled={bloqueado} /></Campo><Campo label="Cliente"><SearchableCombobox items={opcoes.clientes.map((item) => ({ id: item.id, label: `${item.razao_social || "Cliente sem razão social"}${item.codigo_cliente ? ` · ${item.codigo_cliente}` : ""}` }))} value={form.cliente_id} onChange={(valor) => setCampo("cliente_id", valor)} placeholder="Selecione um cliente..." searchPlaceholder="Buscar cliente..." disabled={bloqueado} /></Campo><Campo label="Sócio / cotista"><SearchableCombobox items={opcoes.socios.map((item) => ({ id: item.id, label: item.nome }))} value={form.socio_id} onChange={(valor) => setCampo("socio_id", valor)} placeholder="Selecione um sócio..." searchPlaceholder="Buscar sócio..." disabled={bloqueado} /></Campo><Campo label="Aeronave" required><SearchableCombobox items={opcoes.aeronaves.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${item.fabricante} ${item.modelo}` }))} value={form.aeronave_id} onChange={(valor) => setCampo("aeronave_id", valor)} placeholder="Selecione a aeronave..." searchPlaceholder="Buscar matrícula ou modelo..." disabled={bloqueado} /></Campo><Campo label="Trecho / rota" required><Input value={form.rota} onChange={(e) => setCampo("rota", e.target.value)} placeholder="Ex.: SBPF — SBGR — SBPF" disabled={bloqueado} /></Campo><Campo label="Tripulante 1" required><SearchableCombobox items={tripulantes} value={form.tripulacao_id} onChange={(valor, label) => { setCampo("tripulacao_id", valor); setCampo("nome_tripulante", label.split(" · ")[0]); }} placeholder="Selecione o comandante..." searchPlaceholder="Buscar tripulante..." disabled={bloqueado} /></Campo><Campo label="Tripulante 2"><SearchableCombobox items={tripulantes.filter((item) => item.id !== form.tripulacao_id)} value={form.tripulante_id_2} onChange={(valor, label) => { setCampo("tripulante_id_2", valor); setCampo("nome_tripulante_2", label.split(" · ")[0]); }} placeholder="Adicionar segundo tripulante..." searchPlaceholder="Buscar tripulante..." disabled={bloqueado} /></Campo><Campo label="Data início" required><Input type="date" value={form.data_inicio} onChange={(e) => setCampo("data_inicio", e.target.value)} disabled={bloqueado} /></Campo><Campo label="Data fim" required><Input type="date" value={form.data_fim} onChange={(e) => setCampo("data_fim", e.target.value)} disabled={bloqueado} /></Campo><Campo label="Quantidade de dias"><Input type="number" min={1} value={form.quantidade_dias} onChange={(e) => setCampo("quantidade_dias", e.target.value)} disabled={bloqueado} /></Campo><div className="md:col-span-2"><Campo label="Observações"><Textarea value={form.observacoes} onChange={(e) => setCampo("observacoes", e.target.value)} placeholder="Informações complementares da viagem..." disabled={bloqueado} /></Campo></div></CardContent></Card>
      <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Despesas lançadas</CardTitle><CardDescription>Registre cada comprovante separadamente.</CardDescription></div><Button type="button" variant="outline" size="sm" onClick={() => setDespesas((atuais) => [...atuais, novaDespesa()])} disabled={bloqueado} className="gap-1.5"><Plus size={14} /> Adicionar despesa</Button></CardHeader><CardContent className="space-y-3">{despesas.map((despesa, index) => <div key={despesa.id} className="grid gap-3 rounded-xl border border-border/70 bg-background/30 p-3 md:grid-cols-[130px_160px_1fr_130px_auto]"><Campo label={index === 0 ? "Data" : undefined}><Input type="date" value={despesa.data} onChange={(e) => atualizarDespesa(despesa.id, "data", e.target.value)} disabled={bloqueado} /></Campo><Campo label={index === 0 ? "Categoria" : undefined}><SearchableCombobox items={categorias.map((item) => ({ id: item, label: item }))} value={despesa.categoria} onChange={(valor) => atualizarDespesa(despesa.id, "categoria", valor)} placeholder="Categoria" searchPlaceholder="Buscar categoria..." disabled={bloqueado} /></Campo><Campo label={index === 0 ? "Descrição" : undefined}><Input value={despesa.descricao} onChange={(e) => atualizarDespesa(despesa.id, "descricao", e.target.value)} placeholder="Ex.: refeição da tripulação" disabled={bloqueado} /></Campo><Campo label={index === 0 ? "Valor" : undefined}><Input type="number" min={0} step="0.01" value={despesa.valor} onChange={(e) => atualizarDespesa(despesa.id, "valor", Number(e.target.value))} disabled={bloqueado} /></Campo><div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label="Remover despesa" onClick={() => setDespesas((atuais) => atuais.length > 1 ? atuais.filter((item) => item.id !== despesa.id) : atuais)} disabled={bloqueado}><Trash2 size={16} className="text-rose-300" /></Button></div></div>)}<div className="flex items-center justify-between border-t border-border pt-4"><span className="text-sm font-semibold text-muted-foreground">Total do relatório</span><span className="text-xl font-extrabold text-primary">{moeda(total)}</span></div></CardContent></Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Paperclip size={16} /> Notas fiscais e anexos</CardTitle><CardDescription>Imagens e PDFs ficam em share/relatorio_despesa_viagem/anexos_notas/.</CardDescription></CardHeader><CardContent><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5 text-sm font-semibold text-primary hover:bg-primary/10"><Upload size={17} /> {anexando ? "Enviando..." : "Anexar nota fiscal"}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void uploadAnexo(event)} disabled={!relatorio || anexando} /></label>{!relatorio && <p className="mt-3 text-xs text-muted-foreground">Salve o rascunho antes de anexar arquivos.</p>}<div className="mt-4 space-y-2">{(relatorio?.anexos || []).map((anexo) => <div key={anexo.id} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2"><Paperclip size={14} className="shrink-0 text-primary" /><a href={anexo.url_arquivo} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs hover:text-primary hover:underline">{anexo.nome_arquivo}</a><span className="text-[10px] text-muted-foreground">{anexo.tamanho_arquivo ? `${Math.round(anexo.tamanho_arquivo / 1024)} KB` : ""}</span><Button type="button" variant="ghost" size="icon" onClick={() => void removerAnexo(anexo.id)} disabled={bloqueado} aria-label="Remover anexo"><X size={14} /></Button></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users size={16} /> Aprovação da tripulação</CardTitle><CardDescription>Se houver dois tripulantes, cada envio gera uma aprovação independente.</CardDescription></CardHeader><CardContent className="space-y-3"><AprovacaoLinha pos={1} nome={relatorio?.nome_tripulante || form.nome_tripulante} status={relatorio?.status_aprovacao_tripulante} enviado={relatorio?.enviado_para_tripulante_em} onEnviar={() => void enviarAprovacao(1)} disabled={!relatorio || !["finalizado", "ajuste_necessario", "aguardando_aprovacao"].includes(relatorio.status) || salvando || aprovado} /><AprovacaoLinha pos={2} nome={relatorio?.nome_tripulante_2 || form.nome_tripulante_2} status={relatorio?.status_aprovacao_tripulante_2} enviado={relatorio?.enviado_para_tripulante_2_em} onEnviar={() => void enviarAprovacao(2)} disabled={!relatorio?.tripulante_id_2 || !["finalizado", "ajuste_necessario", "aguardando_aprovacao"].includes(relatorio.status) || salvando || aprovado} />{(relatorio?.observacoes_aprovacao_tripulante || relatorio?.observacoes_aprovacao_tripulante_2) && <div className="rounded-lg border border-rose-400/25 bg-rose-400/5 p-3 text-xs"><p className="font-bold text-rose-300">Ajustes solicitados pela tripulação</p>{relatorio.observacoes_aprovacao_tripulante && <p className="mt-2 text-muted-foreground"><strong>Tripulante 1:</strong> {relatorio.observacoes_aprovacao_tripulante}</p>}{relatorio.observacoes_aprovacao_tripulante_2 && <p className="mt-2 text-muted-foreground"><strong>Tripulante 2:</strong> {relatorio.observacoes_aprovacao_tripulante_2}</p>}</div>}<Textarea value={comentarioTripulacao} onChange={(e) => setComentarioTripulacao(e.target.value)} placeholder="Observações internas sobre a conferência..." disabled={bloqueado} />{aprovado && <div className="flex justify-end"><Button type="button" variant="outline" disabled onClick={() => void enviarCliente()} className="gap-2"><Send size={15} /> Enviar despesa ao cliente</Button></div>}</CardContent></Card></div>
    </div>;
}

type BibliotecaRelatoriosProps = {
  carregando: boolean;
  clientes: OpcoesRelatorioViagem["clientes"];
  clienteAberto: string | null;
  onAbrirCliente: (id: string) => void;
  onAbrirRelatorio: (relatorio: Relatorio) => void;
  onNovoRelatorio: () => void;
  onVoltarPastas: () => void;
  relatorios: Relatorio[];
  visao: "finalizados" | "rascunhos";
  onMudarVisao: (visao: "finalizados" | "rascunhos") => void;
};

function BibliotecaRelatorios({ carregando, clientes, clienteAberto, onAbrirCliente, onAbrirRelatorio, onNovoRelatorio, onVoltarPastas, relatorios, visao, onMudarVisao }: BibliotecaRelatoriosProps) {
  const relatoriosFinalizados = relatorios.filter((item) => item.status !== "rascunho");
  const rascunhos = relatorios.filter((item) => item.status === "rascunho");
  const pastas = useMemo(() => {
    const pastaPorCliente = new Map(clientes.map((cliente) => [cliente.id, { id: cliente.id, nome: cliente.razao_social || "Cliente sem razão social", codigo: cliente.codigo_cliente || "", relatorios: [] as Relatorio[] }]));
    relatoriosFinalizados.forEach((item) => {
      const id = item.cliente_id || "sem-cliente";
      const pasta = pastaPorCliente.get(id) || { id, nome: item.cliente_nome || "Cliente não identificado", codigo: "", relatorios: [] as Relatorio[] };
      pasta.relatorios.push(item);
      pastaPorCliente.set(id, pasta);
    });
    return Array.from(pastaPorCliente.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, relatoriosFinalizados]);
  const pastaAtual = pastas.find((pasta) => pasta.id === clienteAberto);

  return <section className="route-enter space-y-6">
    <div className="flex flex-col gap-5 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · Despesas</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Relatório de despesa de viagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize os relatórios por cliente e acompanhe os lançamentos em elaboração.</p>
      </div>
      <Button type="button" onClick={onNovoRelatorio} className="gap-2 self-start lg:self-auto"><Plus size={16} /> Criar novo</Button>
    </div>

    <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Relatórios de viagem">
      <button type="button" role="tab" aria-selected={visao === "finalizados"} onClick={() => onMudarVisao("finalizados")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${visao === "finalizados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Folder size={15} /> Relatórios finalizados <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{relatoriosFinalizados.length}</span></button>
      <button type="button" role="tab" aria-selected={visao === "rascunhos"} onClick={() => onMudarVisao("rascunhos")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${visao === "rascunhos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><FileText size={15} /> Rascunhos <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{rascunhos.length}</span></button>
    </div>

    {carregando ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton h-36 rounded-2xl" />)}</div> : visao === "rascunhos" ? <ListaRelatorios relatorios={rascunhos} vazio="Não há rascunhos no momento." onAbrir={onAbrirRelatorio} /> : clienteAberto && pastaAtual ? <div className="space-y-4">
      <div className="flex items-center gap-3"><Button type="button" size="icon" variant="ghost" onClick={onVoltarPastas} aria-label="Voltar para as pastas"><ArrowLeft size={17} /></Button><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Pasta de cliente</p><h2 className="text-lg font-bold">{pastaAtual.nome}</h2></div></div>
      <ListaRelatorios relatorios={pastaAtual.relatorios} vazio="Esta pasta ainda não possui relatórios finalizados." onAbrir={onAbrirRelatorio} />
    </div> : <div className="space-y-4">
      <div><h2 className="text-sm font-bold">Pastas de clientes</h2><p className="mt-1 text-xs text-muted-foreground">Selecione uma pasta para ver os relatórios finalizados daquele cliente.</p></div>
      {pastas.length === 0 ? <EstadoVazioPastas /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pastas.map((pasta) => <button key={pasta.id} type="button" onClick={() => onAbrirCliente(pasta.id)} className="group relative min-h-36 overflow-hidden rounded-2xl border border-border bg-card/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/5"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" /><div className="relative flex h-full flex-col justify-between"><div className="relative w-fit"><Folder className="fill-primary/20 text-primary" size={52} strokeWidth={1.6} /><Plane className="absolute bottom-2 left-4 text-primary" size={15} strokeWidth={2} /></div><div><p className="truncate text-xs font-bold uppercase tracking-wide">{pasta.nome}</p>{pasta.codigo && <p className="mt-1 text-[10px] text-muted-foreground">Cliente {pasta.codigo}</p>}<p className="mt-2 text-xs text-muted-foreground">{pasta.relatorios.length} {pasta.relatorios.length === 1 ? "relatório finalizado" : "relatórios finalizados"}</p></div></div></button>)}</div>}
    </div>}
  </section>;
}

function ListaRelatorios({ relatorios, vazio, onAbrir }: { relatorios: Relatorio[]; vazio: string; onAbrir: (relatorio: Relatorio) => void }) {
  if (relatorios.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center"><FilePlus2 className="mx-auto text-muted-foreground" size={28} /><p className="mt-3 text-sm font-semibold">{vazio}</p></div>;
  return <div className="space-y-2">{relatorios.map((item) => <button key={item.id} type="button" onClick={() => onAbrir(item)} className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card/70 px-4 py-4 text-left transition-colors hover:border-primary/45 hover:bg-card sm:flex-row sm:items-center"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={18} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-bold">{item.numero_relatorio || "Sem número"}</p><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{[item.numero_voo && `Voo ${item.numero_voo}`, item.rota, `${dataBr(item.data_inicio)} a ${dataBr(item.data_fim)}`].filter(Boolean).join(" · ")}</p></div><div className="shrink-0 text-sm font-bold text-primary">{moeda(Number(item.total_valor) || item.despesas.reduce((total, despesa) => total + (Number(despesa.valor) || 0), 0))}</div></button>)}</div>;
}

function EstadoVazioPastas() { return <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center"><FolderOpen className="mx-auto text-muted-foreground" size={30} /><p className="mt-3 text-sm font-semibold">Nenhum cliente cadastrado</p><p className="mt-1 text-xs text-muted-foreground">As pastas aparecem automaticamente quando houver clientes disponíveis.</p></div>; }

function Campo({ label, required, children }: { label?: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-1.5">{label && <Label className="text-xs font-semibold text-muted-foreground">{label}{required && <span className="ml-1 text-rose-300">*</span>}</Label>}{children}</div>; }
function Feedback({ tipo, texto }: { tipo: "ok" | "erro"; texto: string }) { return <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${tipo === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>{tipo === "ok" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{texto}</div>; }
function AprovacaoLinha({ pos, nome, status, enviado, onEnviar, disabled }: { pos: 1 | 2; nome?: string | null; status?: string | null; enviado?: string | null; onEnviar: () => void; disabled: boolean }) { const aprovado = status === "aprovado"; const reprovado = status === "reprovado"; return <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-bold">Tripulante {pos}</p><p className="truncate text-xs text-muted-foreground">{nome || "Não informado"}</p>{enviado && <p className="mt-1 text-[10px] text-muted-foreground">Enviado em {dataBr(enviado)}</p>}</div><Badge className={aprovado ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : reprovado ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-border bg-secondary/50 text-muted-foreground"}>{aprovado ? "Conferido como correto" : reprovado ? "Não aprovado" : "Pendente"}</Badge><Button type="button" size="sm" variant="outline" onClick={onEnviar} disabled={disabled} className="gap-1.5"><Send size={13} /> Enviar para aprovação tripulação</Button></div>; }
