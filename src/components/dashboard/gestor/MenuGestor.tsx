import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, FileText, Printer, RefreshCw, Save, Search, Upload, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AbaCaixaEmpresa } from "@/components/financeiro-share/AbaCaixaEmpresa";
import { buscarContasAPagar, buscarContasAReceber } from "@/lib/financeiro-share-api";
import { formatCentavos } from "@/lib/money";
import { carregarArquivoColaborador, colaboradorRequest } from "@/lib/colaborador-api";
import type { ContaAPagar, ContaAReceber } from "@/components/financeiro-share/tipos";

type StatusContrato = "RASCUNHO" | "EM_REVISAO" | "ENVIADO" | "ASSINADO" | "EM_VIGENCIA" | "CONCLUIDO" | "RESCINDIDO" | "CANCELADO";
type ParteContrato = {
  id?: string;
  papel: string;
  tipo_pessoa: "FISICA" | "JURIDICA";
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  representante_nome?: string;
  representante_documento?: string;
  representante_cargo?: string;
  dados_adicionais?: Record<string, unknown>;
  ordem?: number;
};
type AnexoContrato = { id: string; nome: string; tipo: string | null; arquivo_url: string };
type Contrato = {
  id: string;
  numero: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  status: StatusContrato;
  valor_centavos: number | null;
  moeda: string;
  forma_pagamento: string | null;
  data_assinatura: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  aeronave_id: string | null;
  dados_adicionais: Record<string, unknown>;
  documento_url: string | null;
  foro: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  partes: ParteContrato[];
  anexos: AnexoContrato[];
};
type ParteFormulario = Omit<ParteContrato, "id" | "ordem" | "dados_adicionais"> & { dados_adicionais: Record<string, unknown> };
type EmpresaContrato = { id: string; razao_social: string | null; cnpj: string | null; endereco: string | null };
type ColaboradorOpcao = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  canac: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  contratos_trabalho_id: string | null;
  cargo: string | null;
};
type CotistaOpcao = {
  id: string;
  cotista_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  empresa: string | null;
};
type OpcoesContrato = { empresa: EmpresaContrato | null; colaboradores: ColaboradorOpcao[]; cotistas: CotistaOpcao[] };
type FormContrato = {
  numero: string;
  tipo: string;
  titulo: string;
  descricao: string;
  status: StatusContrato;
  valor: string;
  moeda: string;
  forma_pagamento: string;
  data_assinatura: string;
  data_inicio: string;
  data_fim: string;
  foro: string;
  observacoes: string;
};
type TipoVinculo = "COLABORADOR" | "COTISTA";

const STATUS_CONTRATO: StatusContrato[] = ["RASCUNHO", "EM_REVISAO", "ENVIADO", "ASSINADO", "EM_VIGENCIA", "CONCLUIDO", "RESCINDIDO", "CANCELADO"];
const EMPRESA_TIMBRADA = "SHARE BRASIL SERVICOS AEROPORTUARIOS";
const MODELO_TREINAMENTO = `CONTRATO DE CUSTEIO DE TREINAMENTO E COMPROMISSO DE PERMANÊNCIA\n\nTreinamento: {{TITULO}}\n\nPARTES\n\nEMPREGADORA: {{EMPRESA}}, inscrita no CNPJ nº {{CNPJ_EMPRESA}}, com sede em {{ENDERECO_EMPRESA}}, representada na forma de seus atos constitutivos, doravante denominada EMPREGADORA.\n\nEMPREGADO: {{PARTE}}, CPF nº {{CPF_PARTE}}, RG nº {{RG_PARTE}}, CANAC nº {{CANAC_PARTE}}, residente em {{ENDERECO_PARTE}}, doravante denominado EMPREGADO.\n\nAs partes resolvem celebrar o presente contrato, que se regerá pelas cláusulas seguintes.\n\nCLÁUSULA 1ª — DO OBJETO\n1.1. O presente instrumento trata do custeio do treinamento descrito acima e do compromisso de permanência pelo prazo indicado neste instrumento, observadas as condições de ressarcimento aqui pactuadas.\n1.2. Este instrumento é acessório ao vínculo de trabalho vigente e não o altera, não implica novação nem estabelece prazo determinado para o vínculo empregatício.\n\nCLÁUSULA 2ª — DO TREINAMENTO\n2.1. O treinamento será realizado no período de {{DATA_INICIO}} a {{DATA_FIM}}, em centro, local ou modalidade a serem informados pelas partes.\n2.2. O treinamento e seus requisitos deverão ser descritos e comprovados por documentos que poderão integrar este instrumento como anexo.\n2.3. Considera-se conclusão a data do certificado ou documento equivalente que comprove a aprovação, ou, na sua falta, o último dia efetivo de treinamento.\n\nCLÁUSULA 3ª — DAS DESPESAS\n3.1. Poderão ser custeados curso, simulador, instrutores, taxas, exames, certificados, deslocamentos, hospedagem, alimentação e demais despesas diretamente vinculadas, desde que comprovadas.\n3.2. O custo total estimado é de {{VALOR}} {{MOEDA}}. O demonstrativo discriminado e os comprovantes poderão integrar este instrumento como anexo.\n\nCLÁUSULA 4ª — DO COMPROMISSO DE PERMANÊNCIA\n4.1. Após a conclusão do treinamento, o EMPREGADO compromete-se a permanecer prestando serviços à EMPREGADORA pelo prazo mínimo de {{PRAZO_PERMANENCIA}} meses, contado da conclusão efetiva.\n4.2. O compromisso não confere estabilidade e não impede a rescisão do vínculo, observadas as hipóteses e os limites previstos em lei e neste instrumento.\n\nCLÁUSULA 5ª — DO RESSARCIMENTO PROPORCIONAL\n5.1. Nas hipóteses expressamente pactuadas e permitidas pela legislação aplicável, eventual ressarcimento será proporcional ao período restante do compromisso e limitado às despesas efetivamente comprovadas.\n5.2. A memória de cálculo e o demonstrativo das despesas deverão ser apresentados ao EMPREGADO. Nenhum desconto poderá exceder os limites legais.\n\nCLÁUSULA 6ª — DAS HIPÓTESES DE NÃO RESSARCIMENTO\n6.1. Não haverá ressarcimento quando o encerramento decorrer de hipótese legal ou de fato não imputável ao EMPREGADO, conforme detalhamento e validação jurídica das partes.\n\nCLÁUSULA 7ª — DA FORMA DE PAGAMENTO\n7.1. Eventual valor apurado será comunicado por escrito, acompanhado de memória de cálculo e comprovantes, e pago conforme {{FORMA_PAGAMENTO}}, observado o prazo e os limites legais aplicáveis.\n\nCLÁUSULA 8ª — DAS OBRIGAÇÕES\n8.1. O EMPREGADO compromete-se a participar do treinamento com assiduidade e dedicação, comunicar fatos que possam afetar sua conclusão e manter válidas as habilitações exigidas para sua função.\n\nCLÁUSULA 9ª — DAS DISPOSIÇÕES GERAIS\n9.1. Alterações deste instrumento deverão ser formalizadas por escrito. A eventual invalidade de uma disposição não prejudica as demais.\n9.2. Os dados pessoais serão tratados para a execução deste instrumento e o cumprimento de obrigações legais, nos termos da legislação aplicável.\n\nCLÁUSULA 10ª — DO FORO\n10.1. Fica indicado o foro de {{FORO}}, ressalvadas as competências legais inderrogáveis.\n\nE, por estarem de acordo, as partes assinam este instrumento e seus anexos, quando houver, em vias de igual teor.\n\n{{CIDADE_DATA}}\n\nEMPREGADORA: ____________________________________\n{{EMPRESA}} — CNPJ {{CNPJ_EMPRESA}}\n\nEMPREGADO: ______________________________________\n{{PARTE}} — CPF {{CPF_PARTE}}\n\nTESTEMUNHAS\n\n1. __________________________________  CPF: __________________\n2. __________________________________  CPF: __________________\n\nANEXO I — DEMONSTRATIVO DE DESPESAS\nA preencher com a discriminação das despesas efetivamente realizadas e seus comprovantes.`;
const MODELO_GENERICO = `INSTRUMENTO PARTICULAR — {{TITULO}}\n\nPARTES\n\nCONTRATANTE: {{EMPRESA}}, inscrita no CNPJ nº {{CNPJ_EMPRESA}}, com sede em {{ENDERECO_EMPRESA}}.\n\nCONTRATADA: {{PARTE}}, documento nº {{CPF_PARTE}}, com endereço em {{ENDERECO_PARTE}}.\n\nAs partes resolvem celebrar este instrumento, mediante as cláusulas seguintes.\n\nCLÁUSULA 1ª — DO OBJETO\n1.1. {{DESCRICAO}}\n\nCLÁUSULA 2ª — DO PRAZO\n2.1. A vigência inicia-se em {{DATA_INICIO}} e encerra-se em {{DATA_FIM}}, salvo prorrogação ou encerramento formalizado entre as partes.\n\nCLÁUSULA 3ª — DO VALOR E PAGAMENTO\n3.1. O valor indicado para este instrumento é {{VALOR}} {{MOEDA}}. Forma de pagamento: {{FORMA_PAGAMENTO}}.\n\nCLÁUSULA 4ª — DAS OBRIGAÇÕES\n4.1. As partes comprometem-se a cumprir as obrigações descritas neste instrumento e a fornecer as informações e documentos necessários à sua execução.\n\nCLÁUSULA 5ª — DAS DISPOSIÇÕES GERAIS\n5.1. Alterações deverão ser formalizadas por escrito.\n5.2. Os dados pessoais serão tratados para a execução deste instrumento e o cumprimento de obrigações legais.\n\nCLÁUSULA 6ª — DO FORO\n6.1. Fica indicado o foro de {{FORO}}, ressalvadas as competências legais inderrogáveis.\n\nE, por estarem de acordo, as partes assinam este instrumento.\n\n{{CIDADE_DATA}}\n\nCONTRATANTE: _______________________________\n{{EMPRESA}} — CNPJ {{CNPJ_EMPRESA}}\n\nCONTRATADA: ________________________________\n{{PARTE}} — Documento {{CPF_PARTE}}\n\nTESTEMUNHAS\n\n1. __________________________________  CPF: __________________\n2. __________________________________  CPF: __________________`;
const FORM_INICIAL: FormContrato = {
  numero: "", tipo: "CUSTEIO_TREINAMENTO", titulo: "Custeio de treinamento e compromisso de permanência", descricao: "", status: "RASCUNHO", valor: "", moeda: "BRL", forma_pagamento: "", data_assinatura: "", data_inicio: "", data_fim: "", foro: "Várzea Grande/MT", observacoes: "",
};
const NOVA_PARTE = (papel: string, tipoPessoa: "FISICA" | "JURIDICA"): ParteFormulario => ({ papel, tipo_pessoa: tipoPessoa, nome: "", documento: "", email: "", telefone: "", endereco: "", dados_adicionais: {} });
const DATA_LOCAL = () => { const data = new Date(); return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
const formatarData = (valor?: string | null) => { if (!valor) return "—"; const data = new Date(`${valor.slice(0, 10)}T12:00:00`); return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR"); };
const valorEmCentavos = (valor: string): number | null => { const bruto = valor.trim().replace(/\s/g, ""); if (!bruto) return null; const numero = bruto.includes(",") ? Number(bruto.replace(/\./g, "").replace(",", ".")) : Number(bruto); return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) : null; };
const statusAberto = (status: string) => !["PAGO", "RECEBIDO", "CANCELADO"].includes(String(status).toUpperCase());

export default function MenuGestor() {
  const [aba, setAba] = useState("caixa");
  return <div className="route-enter space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Dashboard Gestor</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><BriefcaseBusiness size={23} className="text-primary" /> Gestor</h1><p className="mt-1 text-xs text-muted-foreground">Caixa da empresa, previsão financeira e contratos.</p></div>
    </header>
    <Tabs value={aba} onValueChange={setAba} className="space-y-5">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1.5">
        <TabsTrigger value="caixa" className="shrink-0 gap-2 rounded-lg px-3 py-2 text-[11px]"><WalletCards size={14} /> Caixa da empresa</TabsTrigger>
        <TabsTrigger value="previsao" className="shrink-0 gap-2 rounded-lg px-3 py-2 text-[11px]"><CalendarDays size={14} /> Previsão e estratégia financeira</TabsTrigger>
        <TabsTrigger value="contratos" className="shrink-0 gap-2 rounded-lg px-3 py-2 text-[11px]"><FileText size={14} /> Contratos</TabsTrigger>
      </TabsList>
      <TabsContent value="caixa" className="mt-0"><AbaCaixaEmpresa /></TabsContent>
      <TabsContent value="previsao" className="mt-0"><PrevisaoFinanceira /></TabsContent>
      <TabsContent value="contratos" className="mt-0"><Contratos /></TabsContent>
    </Tabs>
  </div>;
}

function PrevisaoFinanceira() {
  const [pagar, setPagar] = useState<ContaAPagar[]>([]);
  const [receber, setReceber] = useState<ContaAReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [contasPagar, contasReceber] = await Promise.all([buscarContasAPagar(), buscarContasAReceber()]);
      setPagar(contasPagar);
      setReceber(contasReceber);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as contas previstas.");
    } finally { setCarregando(false); setAtualizando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const previsao = useMemo(() => {
    const hoje = DATA_LOCAL();
    const inicio = new Date(`${hoje}T00:00:00`);
    const faixas = [0, 1, 2].map((indice) => ({ titulo: ["Até 30 dias", "31–60 dias", "61–90 dias"][indice], entradas: 0, saidas: 0, contas: 0 }));
    let vencidasReceber = 0; let vencidasPagar = 0; let valorVencidoReceber = 0; let valorVencidoPagar = 0;
    const somar = <T extends ContaAPagar | ContaAReceber>(contas: T[], fluxo: "entrada" | "saida") => {
      for (const conta of contas) {
        if (!statusAberto(conta.status)) continue;
        const vencimento = conta.dataVencimento?.slice(0, 10);
        if (!vencimento) continue;
        const data = new Date(`${vencimento}T00:00:00`);
        if (Number.isNaN(data.getTime())) continue;
        const dias = Math.floor((data.getTime() - inicio.getTime()) / 86_400_000);
        const valorCentavos = Math.round(Number(conta.valor || 0) * 100);
        if (dias < 0) {
          if (fluxo === "entrada") { vencidasReceber += 1; valorVencidoReceber += valorCentavos; }
          else { vencidasPagar += 1; valorVencidoPagar += valorCentavos; }
          continue;
        }
        if (dias >= 90) continue;
        const faixa = faixas[Math.floor(dias / 30)];
        if (!faixa) continue;
        if (fluxo === "entrada") faixa.entradas += valorCentavos; else faixa.saidas += valorCentavos;
        faixa.contas += 1;
      }
    };
    somar(receber, "entrada"); somar(pagar, "saida");
    const entradas = faixas.reduce((total, faixa) => total + faixa.entradas, 0);
    const saidas = faixas.reduce((total, faixa) => total + faixa.saidas, 0);
    return { faixas: faixas.map((faixa) => ({ ...faixa, saldo: faixa.entradas - faixa.saidas })), entradas, saidas, saldo: entradas - saidas, vencidasReceber, vencidasPagar, valorVencidoReceber, valorVencidoPagar };
  }, [pagar, receber]);
  const maxBarra = Math.max(1, ...previsao.faixas.flatMap((faixa) => [faixa.entradas, faixa.saidas]));
  const estrategia = previsao.saldo < 0
    ? "As saídas previstas superam as entradas nos próximos 90 dias. Priorize a cobrança dos valores vencidos, confirme os recebimentos previstos e reavalie compromissos adiáveis antes de assumir novas despesas."
    : previsao.saldo > 0
      ? "As entradas registradas superam as saídas previstas nos próximos 90 dias. Confirme os recebimentos e mantenha uma reserva para obrigações futuras antes de destinar o saldo a novas despesas."
      : "Entradas e saídas registradas estão equilibradas nos próximos 90 dias. Acompanhe vencimentos e atualize as contas para manter a projeção útil.";
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-4"><div><h2 className="text-sm font-bold">Previsão de caixa — 90 dias</h2><p className="mt-1 text-xs text-muted-foreground">Estimativa baseada somente nas contas a pagar e a receber ainda abertas no D1.</p></div><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="gap-2 text-xs"><RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button></div>
    {erro && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">{erro}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <CartaoPrevisao titulo="Entradas previstas" valor={carregando ? "—" : formatCentavos(previsao.entradas)} detalhe="Títulos em aberto com vencimento até 90 dias" icone={<ArrowDownRight size={16} />} tom="text-emerald-600 dark:text-emerald-400" />
      <CartaoPrevisao titulo="Saídas previstas" valor={carregando ? "—" : formatCentavos(previsao.saidas)} detalhe="Títulos em aberto com vencimento até 90 dias" icone={<ArrowUpRight size={16} />} tom="text-amber-600 dark:text-amber-400" />
      <CartaoPrevisao titulo="Saldo projetado" valor={carregando ? "—" : formatCentavos(previsao.saldo)} detalhe="Entradas menos saídas cadastradas" icone={<WalletCards size={16} />} tom={previsao.saldo < 0 ? "text-destructive" : "text-primary"} />
    </div>
    {(previsao.vencidasReceber + previsao.vencidasPagar) > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-200"><strong>Atenção a vencimentos anteriores:</strong> {previsao.vencidasReceber} conta(s) a receber ({formatCentavos(previsao.valorVencidoReceber)}) e {previsao.vencidasPagar} conta(s) a pagar ({formatCentavos(previsao.valorVencidoPagar)}). Confirme o status antes de usar esta projeção.</div>}
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <section className="rounded-xl border border-border bg-card/70 p-4"><h3 className="mb-4 text-sm font-bold">Fluxo por faixa</h3>{carregando ? <p className="py-8 text-center text-xs text-muted-foreground">Carregando previsão…</p> : <div className="space-y-5">{previsao.faixas.map((faixa) => <div key={faixa.titulo}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold">{faixa.titulo}</p><p className="text-[10px] text-muted-foreground">{faixa.contas} conta(s) registrada(s)</p></div><p className={`font-mono text-xs font-bold ${faixa.saldo < 0 ? "text-destructive" : "text-foreground"}`}>{formatCentavos(faixa.saldo)}</p></div><div className="space-y-1.5"><div className="flex items-center gap-2"><span className="w-16 text-[9px] text-muted-foreground">Entradas</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(faixa.entradas / maxBarra) * 100}%` }} /></div><span className="w-28 text-right font-mono text-[10px]">{formatCentavos(faixa.entradas)}</span></div><div className="flex items-center gap-2"><span className="w-16 text-[9px] text-muted-foreground">Saídas</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(faixa.saidas / maxBarra) * 100}%` }} /></div><span className="w-28 text-right font-mono text-[10px]">{formatCentavos(faixa.saidas)}</span></div></div></div>)}</div>}</section>
      <section className="rounded-xl border border-primary/20 bg-primary/[.04] p-4"><h3 className="text-sm font-bold">Leitura estratégica</h3><p className="mt-1 text-[10px] text-muted-foreground">Sinal operacional derivado dos títulos registrados; não inclui recorrências ainda não cadastradas.</p><p className="mt-4 text-xs leading-6 text-foreground">{carregando ? "Calculando…" : estrategia}</p><div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-[10px] leading-5 text-muted-foreground">A previsão não substitui a conferência do caixa bancário, a conciliação nem a validação de cada título. Contas sem data de vencimento e movimentos futuros ainda não cadastrados ficam fora do cálculo.</div></section>
    </div>
  </div>;
}

function CartaoPrevisao({ titulo, valor, detalhe, icone, tom }: { titulo: string; valor: string; detalhe: string; icone: ReactNode; tom: string }) {
  return <div className="rounded-xl border border-border bg-card/70 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{titulo}</p><span className={`flex size-8 items-center justify-center rounded-lg bg-primary/10 ${tom}`}>{icone}</span></div><p className={`mt-3 font-mono text-xl font-extrabold ${tom}`}>{valor}</p><p className="mt-1 text-[10px] text-muted-foreground">{detalhe}</p></div>;
}

function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesContrato>({ empresa: null, colaboradores: [], cotistas: [] });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>("COLABORADOR");
  const [participanteId, setParticipanteId] = useState("");
  const [contratoTrabalhoId, setContratoTrabalhoId] = useState("");
  const [cotistaId, setCotistaId] = useState("");
  const [form, setForm] = useState<FormContrato>(FORM_INICIAL);
  const [parteEmpresa, setParteEmpresa] = useState<ParteFormulario>(NOVA_PARTE("CONTRATANTE", "JURIDICA"));
  const [parteContratada, setParteContratada] = useState<ParteFormulario>(NOVA_PARTE("CONTRATADA", "FISICA"));
  const [textoContrato, setTextoContrato] = useState(MODELO_TREINAMENTO);
  const [anexos, setAnexos] = useState<AnexoContrato[]>([]);
  const [arquivosPendentes, setArquivosPendentes] = useState<File[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, cadastros] = await Promise.all([
        colaboradorRequest<Contrato[]>("/api/gestor/contratos"),
        colaboradorRequest<OpcoesContrato>("/api/gestor/contratos/opcoes"),
      ]);
      setContratos(lista);
      setOpcoes(cadastros);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os contratos.");
    } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!contratoId && !parteEmpresa.nome) {
      setParteEmpresa((atual) => ({ ...atual, nome: EMPRESA_TIMBRADA, documento: "", endereco: "" }));
    }
  }, [contratoId, opcoes.empresa, parteEmpresa.nome]);
  useEffect(() => {
    if (contratoId) return;
    if (tipoVinculo === "COTISTA" && textoContrato === MODELO_TREINAMENTO) {
      setTextoContrato(MODELO_GENERICO);
      setForm((atual) => ({ ...atual, tipo: atual.tipo === "CUSTEIO_TREINAMENTO" ? "OUTRO" : atual.tipo, titulo: atual.titulo === FORM_INICIAL.titulo ? "Contrato de cotista" : atual.titulo }));
    } else if (tipoVinculo === "COLABORADOR" && textoContrato === MODELO_GENERICO) {
      setTextoContrato(MODELO_TREINAMENTO);
      setForm((atual) => ({ ...atual, tipo: atual.tipo === "OUTRO" ? "CUSTEIO_TREINAMENTO" : atual.tipo, titulo: atual.titulo === "Contrato de cotista" ? FORM_INICIAL.titulo : atual.titulo }));
    }
  }, [contratoId, tipoVinculo, textoContrato]);

  const contratosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter((contrato) => !termo || [contrato.titulo, contrato.numero, contrato.tipo, ...contrato.partes.map((parte) => parte.nome)].some((campo) => String(campo || "").toLowerCase().includes(termo)));
  }, [busca, contratos]);
  const textoPreview = useMemo(() => {
    const valores: Record<string, string> = {
      "{{TITULO}}": form.titulo || "[TÍTULO DO CONTRATO]",
      "{{EMPRESA}}": EMPRESA_TIMBRADA,
      "{{CNPJ_EMPRESA}}": parteEmpresa.documento || "[CNPJ]",
      "{{ENDERECO_EMPRESA}}": parteEmpresa.endereco || "[ENDEREÇO DA EMPRESA]",
      "{{PARTE}}": parteContratada.nome || (tipoVinculo === "COLABORADOR" ? "[NOME DO COLABORADOR]" : "[NOME DO COTISTA]"),
      "{{CPF_PARTE}}": parteContratada.documento || "[CPF/CNPJ]",
      "{{RG_PARTE}}": String(parteContratada.dados_adicionais.rg || "[RG]"),
      "{{CANAC_PARTE}}": String(parteContratada.dados_adicionais.canac || "[CANAC]"),
      "{{ENDERECO_PARTE}}": parteContratada.endereco || "[ENDEREÇO DA PARTE]",
      "{{VALOR}}": form.valor ? form.valor : "[VALOR]",
      "{{MOEDA}}": form.moeda,
      "{{FORMA_PAGAMENTO}}": form.forma_pagamento || "[FORMA DE PAGAMENTO]",
      "{{DATA_INICIO}}": form.data_inicio ? formatarData(form.data_inicio) : "[DATA DE INÍCIO]",
      "{{DATA_FIM}}": form.data_fim ? formatarData(form.data_fim) : "[DATA DE TÉRMINO]",
      "{{PRAZO_PERMANENCIA}}": String(parteContratada.dados_adicionais.prazo_permanencia_meses || "12"),
      "{{FORO}}": form.foro || "[FORO]",
      "{{CIDADE_DATA}}": `Várzea Grande/MT, ${formatarData(form.data_assinatura || DATA_LOCAL())}`,
      "{{DESCRICAO}}": form.descricao || "[DESCREVER O OBJETO E AS CONDIÇÕES DO CONTRATO]",
    };
    return Object.entries(valores).reduce((texto, [chave, valor]) => texto.split(chave).join(valor), textoContrato);
  }, [form, parteEmpresa, parteContratada, tipoVinculo, textoContrato]);

  const novoContrato = () => {
    setContratoId(null); setTipoVinculo("COLABORADOR"); setParticipanteId(""); setContratoTrabalhoId(""); setCotistaId("");
    setForm({ ...FORM_INICIAL, data_assinatura: DATA_LOCAL() });
    setParteEmpresa({ ...NOVA_PARTE("CONTRATANTE", "JURIDICA"), nome: EMPRESA_TIMBRADA });
    setParteContratada(NOVA_PARTE("CONTRATADA", "FISICA")); setTextoContrato(MODELO_TREINAMENTO); setAnexos([]); setArquivosPendentes([]);
  };
  const editarContrato = (contrato: Contrato) => {
    const dados = contrato.dados_adicionais || {};
    const parteContratadaSalva = contrato.partes.find((parte) => parte.papel === "CONTRATADA") || contrato.partes.find((parte) => parte.papel !== "CONTRATANTE");
    const dadosParte = (parte: ParteContrato | undefined) => parte?.dados_adicionais && typeof parte.dados_adicionais === "object" ? parte.dados_adicionais : {};
    setContratoId(contrato.id);
    setForm({ numero: contrato.numero || "", tipo: contrato.tipo || "OUTRO", titulo: contrato.titulo || "", descricao: contrato.descricao || "", status: contrato.status || "RASCUNHO", valor: contrato.valor_centavos == null ? "" : (contrato.valor_centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), moeda: contrato.moeda || "BRL", forma_pagamento: contrato.forma_pagamento || "", data_assinatura: contrato.data_assinatura || "", data_inicio: contrato.data_inicio || "", data_fim: contrato.data_fim || "", foro: contrato.foro || "", observacoes: contrato.observacoes || "" });
    setTipoVinculo(dados.tipo_vinculo === "COTISTA" ? "COTISTA" : "COLABORADOR");
    setParticipanteId(String(dados.participante_id || dadosParte(parteContratadaSalva).participante_id || ""));
    setContratoTrabalhoId(String(dados.contratos_trabalho_id || dadosParte(parteContratadaSalva).contratos_trabalho_id || ""));
    setCotistaId(String(dados.cotista_id || dadosParte(parteContratadaSalva).cotista_id || ""));
    setParteEmpresa({ ...NOVA_PARTE("CONTRATANTE", "JURIDICA"), nome: EMPRESA_TIMBRADA });
    setParteContratada(parteContratadaSalva ? { papel: "CONTRATADA", tipo_pessoa: parteContratadaSalva.tipo_pessoa, nome: parteContratadaSalva.nome, documento: parteContratadaSalva.documento || "", email: parteContratadaSalva.email || "", telefone: parteContratadaSalva.telefone || "", endereco: parteContratadaSalva.endereco || "", dados_adicionais: dadosParte(parteContratadaSalva) } : NOVA_PARTE("CONTRATADA", "FISICA"));
    setTextoContrato(String(dados.texto_contrato || (contrato.tipo === "CUSTEIO_TREINAMENTO" ? MODELO_TREINAMENTO : MODELO_GENERICO)));
    setAnexos(contrato.anexos || []); setArquivosPendentes([]);
  };
  const selecionarVinculo = (tipo: TipoVinculo, id: string) => {
    setTipoVinculo(tipo); setParticipanteId(id); setContratoTrabalhoId(""); setCotistaId("");
    if (!id) return;
    if (tipo === "COLABORADOR") {
      const colaborador = opcoes.colaboradores.find((item) => item.id === id);
      if (!colaborador) return;
      setContratoTrabalhoId(colaborador.contratos_trabalho_id || "");
      setParteContratada((atual) => ({ ...atual, papel: "CONTRATADA", tipo_pessoa: "FISICA", nome: colaborador.nome, documento: colaborador.cpf || "", email: colaborador.email || "", telefone: colaborador.telefone || "", endereco: [colaborador.endereco, colaborador.cidade, colaborador.uf].filter(Boolean).join(", "), dados_adicionais: { ...atual.dados_adicionais, rg: colaborador.rg || "", canac: colaborador.canac || "" } }));
    } else {
      const cotista = opcoes.cotistas.find((item) => item.id === id);
      if (!cotista) return;
      setCotistaId(cotista.cotista_id);
      setParteContratada((atual) => ({ ...atual, papel: "CONTRATADA", tipo_pessoa: "FISICA", nome: cotista.nome, documento: cotista.cpf || "", email: cotista.email || "", telefone: cotista.telefone || "", endereco: [cotista.endereco, cotista.cidade, cotista.uf].filter(Boolean).join(", "), dados_adicionais: { ...atual.dados_adicionais, empresa_cotista: cotista.empresa || "", socio_id: cotista.id, cotista_id: cotista.cotista_id } }));
    }
  };
  const salvarContrato = async () => {
    if (!form.titulo.trim() || !parteEmpresa.nome.trim() || !parteContratada.nome.trim()) { toast.error("Preencha o título e os dados das duas partes."); return; }
    const valor = valorEmCentavos(form.valor);
    if (form.valor.trim() && valor == null) { toast.error("Informe um valor válido para o contrato."); return; }
    setSalvando(true);
    try {
      const dadosVinculo = { tipo_vinculo: tipoVinculo, participante_id: participanteId || null, contratos_trabalho_id: contratoTrabalhoId || null, cotista_id: cotistaId || null, texto_contrato: textoContrato };
      const payload = {
        numero: form.numero.trim() || null, tipo: form.tipo, titulo: form.titulo.trim(), descricao: form.descricao || null, status: form.status,
        valor_centavos: valor, moeda: form.moeda, forma_pagamento: form.forma_pagamento || null, data_assinatura: form.data_assinatura || null,
        data_inicio: form.data_inicio || null, data_fim: form.data_fim || null, foro: form.foro || null, observacoes: form.observacoes || null,
        dados_adicionais: dadosVinculo,
        partes: [
          { ...parteEmpresa, papel: "CONTRATANTE", ordem: 0 },
          { ...parteContratada, papel: "CONTRATADA", ordem: 1, dados_adicionais: { ...parteContratada.dados_adicionais, ...dadosVinculo } },
        ],
      };
      const resposta = contratoId
        ? await colaboradorRequest<{ id: string }>(`/api/gestor/contratos/${encodeURIComponent(contratoId)}`, { method: "PUT", body: JSON.stringify(payload) })
        : await colaboradorRequest<{ id: string }>("/api/gestor/contratos", { method: "POST", body: JSON.stringify(payload) });
      const id = resposta.id || contratoId;
      if (!id) throw new Error("contrato_nao_salvo");
      setContratoId(id);
      for (const arquivo of arquivosPendentes) {
        const formData = new FormData(); formData.append("arquivo", arquivo, arquivo.name); formData.append("tipo", "ANEXO");
        await colaboradorRequest(`/api/gestor/contratos/${encodeURIComponent(id)}/anexos`, { method: "POST", body: formData });
        setArquivosPendentes((atuais) => atuais.filter((item) => item !== arquivo));
      }
      setArquivosPendentes([]); await carregar();
      const atualizado = await colaboradorRequest<Contrato>(`/api/gestor/contratos/${encodeURIComponent(id)}`);
      editarContrato(atualizado); toast.success("Contrato salvo.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o contrato."); }
    finally { setSalvando(false); }
  };
  const baixarAnexo = async (anexo: AnexoContrato) => {
    try {
      const blob = await carregarArquivoColaborador(anexo.arquivo_url);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = anexo.nome; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível baixar o anexo."); }
  };
  const atribuirForm = (campo: keyof FormContrato, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const atribuirParte = (setParte: (parte: ParteFormulario | ((atual: ParteFormulario) => ParteFormulario)) => void, campo: keyof ParteFormulario, valor: string) => setParte((atual) => ({ ...atual, [campo]: valor }));

  return <div className="space-y-5">
    <style>{`@page{size:A4;margin:12mm}.contrato-preview{position:relative;overflow:hidden;border:1px solid #174f78}.contrato-preview::before,.contrato-preview::after{content:"";position:absolute;z-index:0;pointer-events:none;left:-8%;width:116%;height:128px;background:radial-gradient(120% 100% at 0% 0%,transparent 0 48%,#000b67 49% 57%,#123b96 58% 66%,#007ac7 67% 75%,transparent 76%)}.contrato-preview::before{top:-56px}.contrato-preview::after{bottom:-56px;transform:rotate(180deg);transform-origin:center}.contrato-preview> *{position:relative;z-index:1}@media print{body *{visibility:hidden!important}#contrato-preview,#contrato-preview *{visibility:visible!important}#contrato-preview{position:static!important;display:block!important;left:auto!important;top:auto!important;width:auto!important;max-width:none!important;min-height:0!important;height:auto!important;overflow:visible!important;margin:0!important;border:1px solid #174f78!important;box-shadow:none!important;background:white!important;color:#111!important;break-inside:auto!important;page-break-inside:auto!important}.contrato-print-header{border-bottom:1px solid #174f78!important}.contrato-print-body{font-size:11pt!important;line-height:1.55!important}button,.no-print{display:none!important}}`}</style>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-4"><div><h2 className="text-sm font-bold">Contratos</h2><p className="mt-1 text-xs text-muted-foreground">Minutas editáveis vinculadas ao cadastro de colaborador ou cotista.</p></div><Button type="button" variant="outline" onClick={() => void carregar()} disabled={carregando} className="gap-2 text-xs"><RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar lista</Button></div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-xl border border-border bg-card/60 p-3 no-print"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold">Contratos salvos</h3><Button type="button" size="sm" onClick={novoContrato} className="h-8 gap-1.5 text-[10px]"><FileText size={13} /> Novo</Button></div><div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar contrato" className="h-8 pl-8 text-[10px]" /></div><div className="max-h-[70vh] space-y-1 overflow-y-auto">{carregando ? <p className="py-5 text-center text-[10px] text-muted-foreground">Carregando…</p> : contratosFiltrados.length ? contratosFiltrados.map((contrato) => <button type="button" key={contrato.id} onClick={() => editarContrato(contrato)} className={`w-full rounded-lg border p-3 text-left transition-colors ${contratoId === contrato.id ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border hover:bg-background/70"}`}><span className="block truncate text-[11px] font-bold">{contrato.titulo}</span><span className="mt-1 block truncate text-[9px] text-muted-foreground">{contrato.numero || contrato.id.slice(0, 8)} · {contrato.status.replace(/_/g, " ")}</span><span className="mt-1 block truncate text-[9px] text-muted-foreground">{contrato.partes.find((parte) => parte.papel !== "CONTRATANTE")?.nome || contrato.tipo}</span></button>) : <p className="py-5 text-center text-[10px] text-muted-foreground">Nenhum contrato cadastrado.</p>}</div></aside>
      <div className="grid min-w-0 gap-5 2xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card/60 p-4 no-print">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{contratoId ? "Editar contrato" : "Novo contrato"}</h3><p className="mt-1 text-[10px] text-muted-foreground">Campos e partes ficam salvos no D1.</p></div><Button type="button" onClick={() => void salvarContrato()} disabled={salvando} className="gap-2 text-xs"><Save size={14} />{salvando ? "Salvando…" : "Salvar"}</Button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tipo de contrato"><select value={form.tipo} onChange={(evento) => atribuirForm("tipo", evento.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="CUSTEIO_TREINAMENTO">Custeio de treinamento e permanência</option><option value="PRESTACAO_SERVICO">Prestação de serviços</option><option value="CONFIDENCIALIDADE">Confidencialidade</option><option value="OUTRO">Outro</option></select></Campo>
            <Campo label="Vínculo"><select value={tipoVinculo} onChange={(evento) => { const tipo = evento.target.value as TipoVinculo; setTipoVinculo(tipo); setParticipanteId(""); setContratoTrabalhoId(""); setCotistaId(""); setParteContratada(NOVA_PARTE("CONTRATADA", "FISICA")); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="COLABORADOR">Colaborador</option><option value="COTISTA">Cotista</option></select></Campo>
            <Campo label="Título" className="sm:col-span-2"><Input value={form.titulo} onChange={(evento) => atribuirForm("titulo", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Nº interno (opcional)"><Input value={form.numero} onChange={(evento) => atribuirForm("numero", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Status"><select value={form.status} onChange={(evento) => atribuirForm("status", evento.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs">{STATUS_CONTRATO.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></Campo>
            <Campo label={tipoVinculo === "COLABORADOR" ? "Selecionar colaborador" : "Selecionar cotista"} className="sm:col-span-2"><select value={participanteId} onChange={(evento) => selecionarVinculo(tipoVinculo, evento.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="">Preencher manualmente</option>{tipoVinculo === "COLABORADOR" ? opcoes.colaboradores.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.cargo ? ` · ${item.cargo}` : ""}</option>) : opcoes.cotistas.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.empresa ? ` · ${item.empresa}` : ""}</option>)}</select></Campo>
          </div>
          <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-[10px] font-bold uppercase tracking-[.1em] text-primary">Contratante</legend><CamposParte parte={parteEmpresa} alterar={(campo, valor) => atribuirParte(setParteEmpresa, campo, valor)} juridica /></fieldset>
          <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-[10px] font-bold uppercase tracking-[.1em] text-primary">{tipoVinculo === "COLABORADOR" ? "Colaborador / contratado" : "Cotista / contratado"}</legend><CamposParte parte={parteContratada} alterar={(campo, valor) => atribuirParte(setParteContratada, campo, valor)} /><div className="grid gap-3 sm:grid-cols-2"><Campo label="RG"><Input value={String(parteContratada.dados_adicionais.rg || "")} onChange={(evento) => setParteContratada((atual) => ({ ...atual, dados_adicionais: { ...atual.dados_adicionais, rg: evento.target.value } }))} className="h-9 text-xs" /></Campo><Campo label="CANAC"><Input value={String(parteContratada.dados_adicionais.canac || "")} onChange={(evento) => setParteContratada((atual) => ({ ...atual, dados_adicionais: { ...atual.dados_adicionais, canac: evento.target.value } }))} className="h-9 text-xs" /></Campo></div></fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Valor"><Input value={form.valor} onChange={(evento) => atribuirForm("valor", evento.target.value)} placeholder="0,00" className="h-9 text-xs" /></Campo>
            <Campo label="Moeda"><select value={form.moeda} onChange={(evento) => atribuirForm("moeda", evento.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option value="BRL">BRL — Real</option><option value="USD">USD — Dólar</option><option value="EUR">EUR — Euro</option></select></Campo>
            <Campo label="Forma de pagamento"><Input value={form.forma_pagamento} onChange={(evento) => atribuirForm("forma_pagamento", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Foro"><Input value={form.foro} onChange={(evento) => atribuirForm("foro", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Data de assinatura"><Input type="date" value={form.data_assinatura} onChange={(evento) => atribuirForm("data_assinatura", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Início"><Input type="date" value={form.data_inicio} onChange={(evento) => atribuirForm("data_inicio", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Término"><Input type="date" value={form.data_fim} onChange={(evento) => atribuirForm("data_fim", evento.target.value)} className="h-9 text-xs" /></Campo>
            <Campo label="Descrição / objeto"><Input value={form.descricao} onChange={(evento) => atribuirForm("descricao", evento.target.value)} className="h-9 text-xs" /></Campo>
          </div>
          <Campo label="Texto editável da minuta"><Textarea value={textoContrato} onChange={(evento) => setTextoContrato(evento.target.value)} className="min-h-[320px] resize-y font-mono text-[10px] leading-5" /></Campo>
          <div className="rounded-lg border border-border bg-background/60 p-3"><Label htmlFor="contrato-arquivos" className="mb-2 flex items-center gap-2 text-[10px] font-semibold"><Upload size={13} /> Anexos do contrato</Label><input id="contrato-arquivos" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" disabled={salvando} onChange={(evento) => setArquivosPendentes(Array.from(evento.target.files || []))} className="block w-full text-[10px] file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-[10px] file:font-semibold file:text-primary" /><p className="mt-1 text-[9px] text-muted-foreground">Os anexos selecionados serão enviados junto ao salvamento. Com cotista selecionado no cadastro, também ficam registrados em contrato_cotista.</p>{arquivosPendentes.length > 0 && <p className="mt-2 text-[10px] text-primary">{arquivosPendentes.length} arquivo(s) pronto(s) para envio.</p>}{anexos.length > 0 && <ul className="mt-3 space-y-1 border-t border-border pt-2">{anexos.map((anexo) => <li key={anexo.id} className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate">{anexo.nome}</span><Button type="button" variant="ghost" size="sm" onClick={() => void baixarAnexo(anexo)} className="h-7 shrink-0 text-[9px]">Baixar</Button></li>)}</ul>}</div>
          <Campo label="Observações internas"><Textarea value={form.observacoes} onChange={(evento) => atribuirForm("observacoes", evento.target.value)} className="min-h-16 text-xs" /></Campo>
          {tipoVinculo === "COLABORADOR" && <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] leading-5 text-muted-foreground">O contrato será relacionado ao registro existente em <code>contratos_trabalho</code>, quando houver. A página não cria um segundo vínculo empregatício.</p>}
        </section>
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3 no-print"><div><h3 className="text-sm font-bold">Pré-visualização timbrada</h3><p className="mt-1 text-[10px] text-muted-foreground">Substitua os campos entre colchetes, revise a minuta e imprima em papel ou PDF.</p></div><Button type="button" variant="outline" onClick={() => window.print()} className="gap-2 text-xs"><Printer size={14} /> Imprimir</Button></div>
          <article id="contrato-preview" className="contrato-preview mx-auto min-h-[900px] w-full max-w-[780px] border border-[#174f78] bg-white p-7 pb-20 pt-20 text-slate-900 shadow-sm sm:p-10 sm:pb-20 sm:pt-20">
            <header className="contrato-print-header mb-7 flex items-center justify-between gap-4 border-b border-[#174f78] pb-4"><img src="/logo.share.png" alt="Share Brasil" className="h-14 max-w-[220px] object-contain object-left" /><div className="text-right text-[9px] leading-4 text-slate-600"><p className="font-bold text-[#174f78]">{EMPRESA_TIMBRADA}</p></div></header>
            <div className="contrato-print-body whitespace-pre-wrap break-words font-serif text-[11px] leading-6 text-slate-800">{textoPreview}</div>
            <footer className="mt-8 border-t border-[#174f78]/30 pt-3 text-center text-[8px] text-slate-500">Documento editável — conferir dados, anexos e validade jurídica antes da assinatura.</footer>
          </article>
          <p className="text-[10px] leading-5 text-muted-foreground no-print">A minuta editável é baseada no exemplo enviado e deve ser revisada pelo jurídico antes de assinatura. O texto salvo e as partes são armazenados em <code>contratos</code> e <code>contrato_partes</code>; arquivos anexos em <code>contrato_anexos</code>.</p>
        </section>
      </div>
    </div>
  </div>;
}

function Campo({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-[10px]">{label}</Label>{children}</div>;
}
function CamposParte({ parte, alterar, juridica = false }: { parte: ParteFormulario; alterar: (campo: keyof ParteFormulario, valor: string) => void; juridica?: boolean }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Campo label={juridica ? "Razão social" : "Nome completo"}><Input value={parte.nome} onChange={(evento) => alterar("nome", evento.target.value)} className="h-9 text-xs" /></Campo>
    <Campo label={juridica ? "CNPJ" : "CPF"}><Input value={parte.documento} onChange={(evento) => alterar("documento", evento.target.value)} className="h-9 text-xs" /></Campo>
    <Campo label="E-mail"><Input type="email" value={parte.email} onChange={(evento) => alterar("email", evento.target.value)} className="h-9 text-xs" /></Campo>
    <Campo label="Telefone"><Input value={parte.telefone} onChange={(evento) => alterar("telefone", evento.target.value)} className="h-9 text-xs" /></Campo>
    <Campo label="Endereço" className="sm:col-span-2"><Input value={parte.endereco} onChange={(evento) => alterar("endereco", evento.target.value)} className="h-9 text-xs" /></Campo>
  </div>;
}
