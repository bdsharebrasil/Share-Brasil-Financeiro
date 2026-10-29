import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, FileDown, FileText, RefreshCw, Save, Search, Upload, WalletCards } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buscarContasAPagar, buscarContasAReceber } from "@/lib/financeiro-share-api";
import { formatCentavos } from "@/lib/money";
import { carregarArquivoColaborador, colaboradorRequest } from "@/lib/colaborador-api";
import type { ContaAPagar, ContaAReceber } from "@/components/financeiro-share/tipos";

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Constantes (modelos de contrato e padrões visuais)                        */
/* -------------------------------------------------------------------------- */

const STATUS_CONTRATO: StatusContrato[] = ["RASCUNHO", "EM_REVISAO", "ENVIADO", "ASSINADO", "EM_VIGENCIA", "CONCLUIDO", "RESCINDIDO", "CANCELADO"];
const EMPRESA_TIMBRADA = "SHARE BRASIL SERVICOS AEROPORTUARIOS";
const MODELO_TREINAMENTO = `CONTRATO DE CUSTEIO DE TREINAMENTO E COMPROMISSO DE PERMANÊNCIA\n\nTreinamento: {{TITULO}}\n\nPARTES\n\nEMPREGADORA: {{EMPRESA}}, inscrita no CNPJ nº {{CNPJ_EMPRESA}}, com sede em {{ENDERECO_EMPRESA}}, representada na forma de seus atos constitutivos, doravante denominada EMPREGADORA.\n\nEMPREGADO: {{PARTE}}, CPF nº {{CPF_PARTE}}, RG nº {{RG_PARTE}}, CANAC nº {{CANAC_PARTE}}, residente em {{ENDERECO_PARTE}}, doravante denominado EMPREGADO.\n\nAs partes resolvem celebrar o presente contrato, que se regerá pelas cláusulas seguintes.\n\nCLÁUSULA 1ª — DO OBJETO\n1.1. O presente instrumento trata do custeio do treinamento descrito acima e do compromisso de permanência pelo prazo indicado neste instrumento, observadas as condições de ressarcimento aqui pactuadas.\n1.2. Este instrumento é acessório ao vínculo de trabalho vigente e não o altera, não implica novação nem estabelece prazo determinado para o vínculo empregatício.\n\nCLÁUSULA 2ª — DO TREINAMENTO\n2.1. O treinamento será realizado no período de {{DATA_INICIO}} a {{DATA_FIM}}, em centro, local ou modalidade a serem informados pelas partes.\n2.2. O treinamento e seus requisitos deverão ser descritos e comprovados por documentos que poderão integrar este instrumento como anexo.\n2.3. Considera-se conclusão a data do certificado ou documento equivalente que comprove a aprovação, ou, na sua falta, o último dia efetivo de treinamento.\n\nCLÁUSULA 3ª — DAS DESPESAS\n3.1. Poderão ser custeados curso, simulador, instrutores, taxas, exames, certificados, deslocamentos, hospedagem, alimentação e demais despesas diretamente vinculadas, desde que comprovadas.\n3.2. O custo total estimado é de {{VALOR}} {{MOEDA}}. O demonstrativo discriminado e os comprovantes poderão integrar este instrumento como anexo.\n\nCLÁUSULA 4ª — DO COMPROMISSO DE PERMANÊNCIA\n4.1. Após a conclusão do treinamento, o EMPREGADO compromete-se a permanecer prestando serviços à EMPREGADORA pelo prazo mínimo de {{PRAZO_PERMANENCIA}} meses, contado da conclusão efetiva.\n4.2. O compromisso não confere estabilidade e não impede a rescisão do vínculo, observadas as hipóteses e os limites previstos em lei e neste instrumento.\n\nCLÁUSULA 5ª — DO RESSARCIMENTO PROPORCIONAL\n5.1. Nas hipóteses expressamente pactuadas e permitidas pela legislação aplicável, eventual ressarcimento será proporcional ao período restante do compromisso e limitado às despesas efetivamente comprovadas.\n5.2. A memória de cálculo e o demonstrativo das despesas deverão ser apresentados ao EMPREGADO. Nenhum desconto poderá exceder os limites legais.\n\nCLÁUSULA 6ª — DAS HIPÓTESES DE NÃO RESSARCIMENTO\n6.1. Não haverá ressarcimento quando o encerramento decorrer de hipótese legal ou de fato não imputável ao EMPREGADO, conforme detalhamento e validação jurídica das partes.\n\nCLÁUSULA 7ª — DA FORMA DE PAGAMENTO\n7.1. Eventual valor apurado será comunicado por escrito, acompanhado de memória de cálculo e comprovantes, e pago conforme {{FORMA_PAGAMENTO}}, observado o prazo e os limites legais aplicáveis.\n\nCLÁUSULA 8ª — DAS OBRIGAÇÕES\n8.1. O EMPREGADO compromete-se a participar do treinamento com assiduidade e dedicação, comunicar fatos que possam afetar sua conclusão e manter válidas as habilitações exigidas para sua função.\n\nCLÁUSULA 9ª — DAS DISPOSIÇÕES GERAIS\n9.1. Alterações deste instrumento deverão ser formalizadas por escrito. A eventual invalidade de uma disposição não prejudica as demais.\n9.2. Os dados pessoais serão tratados para a execução deste instrumento e o cumprimento de obrigações legais, nos termos da legislação aplicável.\n\nCLÁUSULA 10ª — DO FORO\n10.1. Fica indicado o foro de {{FORO}}, ressalvadas as competências legais inderrogáveis.\n\nE, por estarem de acordo, as partes assinam este instrumento e seus anexos, quando houver, em vias de igual teor.\n\n{{CIDADE_DATA}}\n\nEMPREGADORA: ____________________________________\n{{EMPRESA}} — CNPJ {{CNPJ_EMPRESA}}\n\nEMPREGADO: ______________________________________\n{{PARTE}} — CPF {{CPF_PARTE}}\n\nTESTEMUNHAS\n\n1. __________________________________  CPF: __________________\n2. __________________________________  CPF: __________________\n\nANEXO I — DEMONSTRATIVO DE DESPESAS\nA preencher com a discriminação das despesas efetivamente realizadas e seus comprovantes.`;
const MODELO_GENERICO = `INSTRUMENTO PARTICULAR — {{TITULO}}\n\nPARTES\n\nCONTRATANTE: {{EMPRESA}}, inscrita no CNPJ nº {{CNPJ_EMPRESA}}, com sede em {{ENDERECO_EMPRESA}}.\n\nCONTRATADA: {{PARTE}}, documento nº {{CPF_PARTE}}, com endereço em {{ENDERECO_PARTE}}.\n\nAs partes resolvem celebrar este instrumento, mediante as cláusulas seguintes.\n\nCLÁUSULA 1ª — DO OBJETO\n1.1. {{DESCRICAO}}\n\nCLÁUSULA 2ª — DO PRAZO\n2.1. A vigência inicia-se em {{DATA_INICIO}} e encerra-se em {{DATA_FIM}}, salvo prorrogação ou encerramento formalizado entre as partes.\n\nCLÁUSULA 3ª — DO VALOR E PAGAMENTO\n3.1. O valor indicado para este instrumento é {{VALOR}} {{MOEDA}}. Forma de pagamento: {{FORMA_PAGAMENTO}}.\n\nCLÁUSULA 4ª — DAS OBRIGAÇÕES\n4.1. As partes comprometem-se a cumprir as obrigações descritas neste instrumento e a fornecer as informações e documentos necessários à sua execução.\n\nCLÁUSULA 5ª — DAS DISPOSIÇÕES GERAIS\n5.1. Alterações deverão ser formalizadas por escrito.\n5.2. Os dados pessoais serão tratados para a execução deste instrumento e o cumprimento de obrigações legais.\n\nCLÁUSULA 6ª — DO FORO\n6.1. Fica indicado o foro de {{FORO}}, ressalvadas as competências legais inderrogáveis.\n\nE, por estarem de acordo, as partes assinam este instrumento.\n\n{{CIDADE_DATA}}\n\nCONTRATANTE: _______________________________\n{{EMPRESA}} — CNPJ {{CNPJ_EMPRESA}}\n\nCONTRATADA: ________________________________\n{{PARTE}} — Documento {{CPF_PARTE}}\n\nTESTEMUNHAS\n\n1. __________________________________  CPF: __________________\n2. __________________________________  CPF: __________________`;
const FORM_INICIAL: FormContrato = {
  numero: "", tipo: "CUSTEIO_TREINAMENTO", titulo: "Custeio de treinamento e compromisso de permanência", descricao: "", status: "RASCUNHO", valor: "", moeda: "BRL", forma_pagamento: "", data_assinatura: "", data_inicio: "", data_fim: "", foro: "Várzea Grande/MT", observacoes: "",
};

/** Padrões visuais compartilhados (mesmo sistema do DashboardGestorResumo). */
const PAINEL = "rounded-xl border border-border bg-card shadow-sm";
const SELECT = "h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CAMPO = "h-9 text-xs";
const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const TONS = {
  receber: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pagar: "bg-red-500/10 text-red-700 dark:text-red-400",
  alerta: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  primario: "bg-primary/10 text-primary",
} as const;

/* -------------------------------------------------------------------------- */
/*  Utilitários                                                               */
/* -------------------------------------------------------------------------- */

const NOVA_PARTE = (papel: string, tipoPessoa: "FISICA" | "JURIDICA"): ParteFormulario => ({ papel, tipo_pessoa: tipoPessoa, nome: "", documento: "", email: "", telefone: "", endereco: "", dados_adicionais: {} });
const DATA_LOCAL = () => { const data = new Date(); return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
const formatarData = (valor?: string | null) => { if (!valor) return "—"; const data = new Date(`${valor.slice(0, 10)}T12:00:00`); return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR"); };
const valorEmCentavos = (valor: string): number | null => { const bruto = valor.trim().replace(/\s/g, ""); if (!bruto) return null; const numero = bruto.includes(",") ? Number(bruto.replace(/\./g, "").replace(",", ".")) : Number(bruto); return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) : null; };
const statusAberto = (status: string) => !["PAGO", "RECEBIDO", "CANCELADO"].includes(String(status).toUpperCase());

async function gerarPdfDaPrevia(elemento: HTMLElement, nomeArquivo: string) {
  await document.fonts.ready;
  await Promise.all(Array.from(elemento.querySelectorAll("img")).map((imagem) => imagem.decode()));

  const textoOriginal = elemento.querySelector<HTMLElement>(".contrato-print-body");
  if (!textoOriginal) throw new Error("Não foi possível localizar o texto do contrato.");
  const segmentos = (textoOriginal.textContent || "").match(/[\s\S]*?(?:\n{2,}|$)/g)?.filter(Boolean) || [""];
  const cabecalhoOriginal = elemento.querySelector<HTMLElement>(".contrato-print-header");
  const rodapeOriginal = elemento.querySelector<HTMLElement>("footer");
  const larguraCss = elemento.getBoundingClientRect().width;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const margem = 12;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margem * 2;
  const alturaUtil = pdf.internal.pageSize.getHeight() - margem * 2;
  const alturaCss = larguraCss * alturaUtil / larguraUtil;
  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;top:0;left:-10000px;width:${larguraCss}px;z-index:-1;pointer-events:none`;
  document.body.appendChild(stage);

  try {
    let indiceSegmento = 0;
    let numeroPagina = 0;
    while (indiceSegmento < segmentos.length || numeroPagina === 0) {
      const pagina = elemento.cloneNode(false) as HTMLElement;
      pagina.removeAttribute("id");
      pagina.style.setProperty("position", "relative", "important");
      pagina.style.setProperty("width", `${larguraCss}px`, "important");
      pagina.style.setProperty("max-width", "none", "important");
      pagina.style.setProperty("height", `${alturaCss}px`, "important");
      pagina.style.setProperty("min-height", "0", "important");
      pagina.style.setProperty("margin", "0", "important");
      pagina.style.setProperty("overflow", "hidden", "important");
      pagina.style.setProperty("box-shadow", "none", "important");
      if (numeroPagina === 0 && cabecalhoOriginal) pagina.appendChild(cabecalhoOriginal.cloneNode(true));
      const corpo = textoOriginal.cloneNode(false) as HTMLElement;
      corpo.textContent = "";
      pagina.appendChild(corpo);
      stage.appendChild(pagina);

      const estiloPagina = getComputedStyle(pagina);
      const limiteInferior = pagina.getBoundingClientRect().bottom
        - Number.parseFloat(estiloPagina.paddingBottom || "0")
        - Number.parseFloat(estiloPagina.borderBottomWidth || "0")
        - (rodapeOriginal ? rodapeOriginal.getBoundingClientRect().height + Number.parseFloat(getComputedStyle(rodapeOriginal).marginTop || "0") : 0);

      while (indiceSegmento < segmentos.length) {
        const segmento = segmentos[indiceSegmento];
        const textoAnterior = corpo.textContent || "";
        corpo.textContent = textoAnterior + segmento;
        if (corpo.getBoundingClientRect().bottom > limiteInferior) {
          corpo.textContent = textoAnterior;
          if (textoAnterior) break;

          let minimo = 1;
          let maximo = segmento.length;
          let tamanhoValido = 0;
          while (minimo <= maximo) {
            const meio = Math.floor((minimo + maximo) / 2);
            corpo.textContent = segmento.slice(0, meio);
            if (corpo.getBoundingClientRect().bottom <= limiteInferior) {
              tamanhoValido = meio;
              minimo = meio + 1;
            } else maximo = meio - 1;
          }
          if (!tamanhoValido) throw new Error("Não foi possível ajustar um trecho do contrato à página A4.");
          if (tamanhoValido < segmento.length) {
            const limitePalavra = Math.max(segmento.lastIndexOf(" ", tamanhoValido - 1), segmento.lastIndexOf("\n", tamanhoValido - 1));
            if (limitePalavra > 0) tamanhoValido = limitePalavra + 1;
          }
          corpo.textContent = segmento.slice(0, tamanhoValido);
          segmentos[indiceSegmento] = segmento.slice(tamanhoValido);
          break;
        }
        indiceSegmento += 1;
      }

      if (indiceSegmento >= segmentos.length && rodapeOriginal) pagina.appendChild(rodapeOriginal.cloneNode(true));
      const canvas = await html2canvas(pagina, { backgroundColor: "#ffffff", imageTimeout: 15_000, logging: false, scale: 2, useCORS: true });
      if (!canvas.width || !canvas.height) throw new Error("Não foi possível renderizar uma página do contrato.");
      if (numeroPagina > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", margem, margem, larguraUtil, alturaUtil, undefined, "FAST");
      numeroPagina += 1;
      pagina.remove();
    }
  } finally {
    stage.remove();
  }

  pdf.save(nomeArquivo);
}

/* -------------------------------------------------------------------------- */
/*  Blocos de interface reutilizáveis                                         */
/* -------------------------------------------------------------------------- */

function Painel({ titulo, descricao, acao, className = "", children }: { titulo: string; descricao?: string; acao?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <section className={`${PAINEL} min-w-0 ${className}`}>
      <div className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${children ? "border-b border-border" : ""}`}>
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {children}
    </section>
  );
}

function Campo({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={`min-w-0 space-y-1 ${className}`}><Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>{children}</div>;
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <legend className="px-1.5 text-xs font-semibold text-primary">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function CamposParte({ parte, alterar, juridica = false }: { parte: ParteFormulario; alterar: (campo: keyof ParteFormulario, valor: string) => void; juridica?: boolean }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Campo label={juridica ? "Razão social" : "Nome completo"}><Input value={parte.nome} onChange={(evento) => alterar("nome", evento.target.value)} className={CAMPO} /></Campo>
    <Campo label={juridica ? "CNPJ" : "CPF"}><Input value={parte.documento} onChange={(evento) => alterar("documento", evento.target.value)} className={CAMPO} /></Campo>
    <Campo label="E-mail"><Input type="email" value={parte.email} onChange={(evento) => alterar("email", evento.target.value)} className={CAMPO} /></Campo>
    <Campo label="Telefone"><Input value={parte.telefone} onChange={(evento) => alterar("telefone", evento.target.value)} className={CAMPO} /></Campo>
    <Campo label="Endereço" className="sm:col-span-2"><Input value={parte.endereco} onChange={(evento) => alterar("endereco", evento.target.value)} className={CAMPO} /></Campo>
  </div>;
}

function Esqueleto() {
  return <span className="skeleton block h-6 w-28 max-w-full rounded-md" aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/*  Página                                                                    */
/* -------------------------------------------------------------------------- */

export default function MenuGestor() {
  const [aba, setAba] = useState("previsao");
  return <div className="route-enter mx-auto w-full min-w-0 max-w-[1480px] space-y-4 pb-8">
    <header className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness size={20} /></span>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">Gestor</h1>
        <p className="truncate text-xs text-muted-foreground">Caixa da empresa, previsão financeira e contratos.</p>
      </div>
    </header>
    <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 shadow-sm sm:w-fit">
        <TabsTrigger value="previsao" className="shrink-0 gap-2 rounded-md px-3 py-1.5 text-xs"><CalendarDays size={14} /> Previsão financeira</TabsTrigger>
        <TabsTrigger value="contratos" className="shrink-0 gap-2 rounded-md px-3 py-1.5 text-xs"><FileText size={14} /> Contratos</TabsTrigger>
      </TabsList>
      <TabsContent value="previsao" className="mt-0"><PrevisaoFinanceira /></TabsContent>
      <TabsContent value="contratos" className="mt-0"><Contratos /></TabsContent>
    </Tabs>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*  Previsão financeira                                                       */
/* -------------------------------------------------------------------------- */

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

  return <div className="space-y-4">
    <Painel
      titulo="Previsão de caixa — 90 dias"
      descricao="Estimativa baseada somente nas contas a pagar e a receber ainda abertas no D1."
      acao={
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar(true)} disabled={atualizando} className="h-8 w-full gap-2 text-xs sm:w-auto">
          <RefreshCw size={13} className={atualizando ? "animate-spin" : ""} /> {atualizando ? "Atualizando…" : "Atualizar"}
        </Button>
      }
    />

    {erro && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{erro}</div>}

    <div className="grid gap-3 sm:grid-cols-3" aria-busy={carregando}>
      <CartaoPrevisao titulo="Entradas previstas" valor={carregando ? null : formatCentavos(previsao.entradas)} detalhe="Em aberto, vencimento até 90 dias" icone={<ArrowDownRight size={16} />} tomIcone={TONS.receber} />
      <CartaoPrevisao titulo="Saídas previstas" valor={carregando ? null : formatCentavos(previsao.saidas)} detalhe="Em aberto, vencimento até 90 dias" icone={<ArrowUpRight size={16} />} tomIcone={TONS.alerta} />
      <CartaoPrevisao titulo="Saldo projetado" valor={carregando ? null : formatCentavos(previsao.saldo)} detalhe="Entradas menos saídas cadastradas" icone={<WalletCards size={16} />} tomIcone={previsao.saldo < 0 ? TONS.pagar : TONS.primario} tomValor={previsao.saldo < 0 ? "text-red-700 dark:text-red-400" : "text-foreground"} />
    </div>

    {(previsao.vencidasReceber + previsao.vencidasPagar) > 0 && (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
        <strong>Atenção a vencimentos anteriores:</strong> {previsao.vencidasReceber} conta(s) a receber ({formatCentavos(previsao.valorVencidoReceber)}) e {previsao.vencidasPagar} conta(s) a pagar ({formatCentavos(previsao.valorVencidoPagar)}). Confirme o status antes de usar esta projeção.
      </div>
    )}

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] xl:items-start">
      <Painel titulo="Fluxo por faixa" descricao="Entradas e saídas abertas, agrupadas por prazo de vencimento">
        {carregando ? (
          <div className="space-y-4 p-4" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="skeleton block h-14 rounded-lg" />)}</div>
        ) : (
          <div className="divide-y divide-border">
            {previsao.faixas.map((faixa) => (
              <div key={faixa.titulo} className="space-y-2 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{faixa.titulo} <span className="ml-1 font-normal text-muted-foreground">· {faixa.contas} conta(s)</span></p>
                  <p className={`text-xs font-bold tabular-nums ${faixa.saldo < 0 ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>Saldo {formatCentavos(faixa.saldo)}</p>
                </div>
                <LinhaBarra rotulo="Entradas" valor={faixa.entradas} max={maxBarra} cor="bg-emerald-500" />
                <LinhaBarra rotulo="Saídas" valor={faixa.saidas} max={maxBarra} cor="bg-amber-500" />
              </div>
            ))}
          </div>
        )}
      </Painel>

      <section className="min-w-0 rounded-xl border border-primary/20 bg-primary/[.04] p-3 shadow-sm sm:p-4">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">Leitura estratégica</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Sinal operacional derivado dos títulos registrados; não inclui recorrências ainda não cadastradas.</p>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground">{carregando ? "Calculando…" : estrategia}</p>
        <p className="mt-3 rounded-lg border border-border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          A previsão não substitui a conferência do caixa bancário, a conciliação nem a validação de cada título. Contas sem data de vencimento e movimentos futuros ainda não cadastrados ficam fora do cálculo.
        </p>
      </section>
    </div>
  </div>;
}

function LinhaBarra({ rotulo, valor, max, cor }: { rotulo: string; valor: number; max: number; cor: string }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
      <span className="text-[11px] text-muted-foreground">{rotulo}</span>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${rotulo}: ${formatCentavos(valor)}`}>
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${cor}`} style={{ width: `${(valor / max) * 100}%` }} />
      </div>
      <span className="min-w-[6rem] text-right text-[11px] font-medium tabular-nums text-foreground sm:min-w-[7rem]">{formatCentavos(valor)}</span>
    </div>
  );
}

function CartaoPrevisao({ titulo, valor, detalhe, icone, tomIcone, tomValor = "text-foreground" }: { titulo: string; valor: string | null; detalhe: string; icone: ReactNode; tomIcone: string; tomValor?: string }) {
  return (
    <div className={`${PAINEL} flex min-w-0 items-center gap-3 p-3 sm:p-3.5`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tomIcone}`}>{icone}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{titulo}</p>
        <div className={`mt-0.5 truncate text-lg font-bold leading-tight tabular-nums tracking-tight ${tomValor}`} title={valor ?? undefined}>{valor === null ? <Esqueleto /> : valor}</div>
        <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Contratos                                                                 */
/* -------------------------------------------------------------------------- */

function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesContrato>({ empresa: null, colaboradores: [], cotistas: [] });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
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
  const salvarComoPdf = async () => {
    const elemento = document.getElementById("contrato-preview");
    if (!elemento) { toast.error("Não foi possível localizar a prévia do contrato."); return; }
    setGerandoPdf(true);
    try {
      const baseNome = (form.numero.trim() || form.titulo || "contrato")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "contrato";
      await gerarPdfDaPrevia(elemento, `contrato-${baseNome}.pdf`);
      toast.success("PDF do contrato salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF do contrato.");
    } finally { setGerandoPdf(false); }
  };
  const atribuirForm = (campo: keyof FormContrato, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const atribuirParte = (setParte: (parte: ParteFormulario | ((atual: ParteFormulario) => ParteFormulario)) => void, campo: keyof ParteFormulario, valor: string) => setParte((atual) => ({ ...atual, [campo]: valor }));

  return <div className="space-y-4">
    {/* A prévia é sempre "papel branco": o PDF e a impressão não dependem do tema. */}
    <style>{`.contrato-preview{position:relative;overflow:hidden;border:1px solid #174f78}.contrato-preview::before,.contrato-preview::after{content:"";position:absolute;z-index:0;pointer-events:none;left:-8%;width:116%;height:128px;background:radial-gradient(120% 100% at 0% 0%,transparent 0 48%,#000b67 49% 57%,#123b96 58% 66%,#007ac7 67% 75%,transparent 76%)}.contrato-preview::before{top:-56px}.contrato-preview::after{bottom:-56px;transform:rotate(180deg);transform-origin:center}.contrato-preview> *{position:relative;z-index:1}`}</style>

    <Painel
      titulo="Contratos"
      descricao="Minutas editáveis vinculadas ao cadastro de colaborador ou cotista."
      acao={
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando} className="h-8 w-full gap-2 text-xs sm:w-auto">
          <RefreshCw size={13} className={carregando ? "animate-spin" : ""} /> Atualizar lista
        </Button>
      }
    />

    <div className="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
      {/* Lista de contratos */}
      <aside className={`${PAINEL} no-print min-w-0 space-y-2.5 p-3 xl:sticky xl:top-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight text-foreground">Contratos salvos</h3>
          <Button type="button" size="sm" onClick={novoContrato} className="h-8 gap-1.5 text-xs"><FileText size={13} /> Novo</Button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar contrato" className={`${CAMPO} pl-8`} />
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto xl:max-h-[70vh]">
          {carregando ? (
            <div className="space-y-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="skeleton block h-14 rounded-lg" />)}</div>
          ) : contratosFiltrados.length ? contratosFiltrados.map((contrato) => (
            <button
              type="button"
              key={contrato.id}
              onClick={() => editarContrato(contrato)}
              aria-current={contratoId === contrato.id}
              className={`w-full min-w-0 rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${FOCO} ${contratoId === contrato.id ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/50"}`}
            >
              <span className="block truncate text-xs font-semibold text-foreground">{contrato.titulo}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{contrato.numero || contrato.id.slice(0, 8)} · {contrato.status.replace(/_/g, " ")}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{contrato.partes.find((parte) => parte.papel !== "CONTRATANTE")?.nome || contrato.tipo}</span>
            </button>
          )) : <p className="py-5 text-center text-xs text-muted-foreground">Nenhum contrato cadastrado.</p>}
        </div>
      </aside>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-2 2xl:items-start">
        {/* Formulário */}
        <section className={`${PAINEL} no-print min-w-0 space-y-4 p-3 sm:p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold tracking-tight text-foreground">{contratoId ? "Editar contrato" : "Novo contrato"}</h3>
              <p className="text-[11px] text-muted-foreground">Campos e partes ficam salvos no D1.</p>
            </div>
            <Button type="button" onClick={() => void salvarContrato()} disabled={salvando} size="sm" className="h-8 shrink-0 gap-2 text-xs"><Save size={14} />{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tipo de contrato"><select value={form.tipo} onChange={(evento) => atribuirForm("tipo", evento.target.value)} className={SELECT}><option value="CUSTEIO_TREINAMENTO">Custeio de treinamento e permanência</option><option value="PRESTACAO_SERVICO">Prestação de serviços</option><option value="CONFIDENCIALIDADE">Confidencialidade</option><option value="OUTRO">Outro</option></select></Campo>
            <Campo label="Vínculo"><select value={tipoVinculo} onChange={(evento) => { const tipo = evento.target.value as TipoVinculo; setTipoVinculo(tipo); setParticipanteId(""); setContratoTrabalhoId(""); setCotistaId(""); setParteContratada(NOVA_PARTE("CONTRATADA", "FISICA")); }} className={SELECT}><option value="COLABORADOR">Colaborador</option><option value="COTISTA">Cotista</option></select></Campo>
            <Campo label="Título" className="sm:col-span-2"><Input value={form.titulo} onChange={(evento) => atribuirForm("titulo", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Nº interno (opcional)"><Input value={form.numero} onChange={(evento) => atribuirForm("numero", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Status"><select value={form.status} onChange={(evento) => atribuirForm("status", evento.target.value)} className={SELECT}>{STATUS_CONTRATO.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></Campo>
            <Campo label={tipoVinculo === "COLABORADOR" ? "Selecionar colaborador" : "Selecionar cotista"} className="sm:col-span-2"><select value={participanteId} onChange={(evento) => selecionarVinculo(tipoVinculo, evento.target.value)} className={SELECT}><option value="">Preencher manualmente</option>{tipoVinculo === "COLABORADOR" ? opcoes.colaboradores.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.cargo ? ` · ${item.cargo}` : ""}</option>) : opcoes.cotistas.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.empresa ? ` · ${item.empresa}` : ""}</option>)}</select></Campo>
          </div>

          <Grupo titulo="Contratante">
            <CamposParte parte={parteEmpresa} alterar={(campo, valor) => atribuirParte(setParteEmpresa, campo, valor)} juridica />
          </Grupo>

          <Grupo titulo={tipoVinculo === "COLABORADOR" ? "Colaborador / contratado" : "Cotista / contratado"}>
            <CamposParte parte={parteContratada} alterar={(campo, valor) => atribuirParte(setParteContratada, campo, valor)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="RG"><Input value={String(parteContratada.dados_adicionais.rg || "")} onChange={(evento) => setParteContratada((atual) => ({ ...atual, dados_adicionais: { ...atual.dados_adicionais, rg: evento.target.value } }))} className={CAMPO} /></Campo>
              <Campo label="CANAC"><Input value={String(parteContratada.dados_adicionais.canac || "")} onChange={(evento) => setParteContratada((atual) => ({ ...atual, dados_adicionais: { ...atual.dados_adicionais, canac: evento.target.value } }))} className={CAMPO} /></Campo>
            </div>
          </Grupo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Valor"><Input value={form.valor} onChange={(evento) => atribuirForm("valor", evento.target.value)} placeholder="0,00" inputMode="decimal" className={CAMPO} /></Campo>
            <Campo label="Moeda"><select value={form.moeda} onChange={(evento) => atribuirForm("moeda", evento.target.value)} className={SELECT}><option value="BRL">BRL — Real</option><option value="USD">USD — Dólar</option><option value="EUR">EUR — Euro</option></select></Campo>
            <Campo label="Forma de pagamento"><Input value={form.forma_pagamento} onChange={(evento) => atribuirForm("forma_pagamento", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Foro"><Input value={form.foro} onChange={(evento) => atribuirForm("foro", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Data de assinatura"><Input type="date" value={form.data_assinatura} onChange={(evento) => atribuirForm("data_assinatura", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Início"><Input type="date" value={form.data_inicio} onChange={(evento) => atribuirForm("data_inicio", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Término"><Input type="date" value={form.data_fim} onChange={(evento) => atribuirForm("data_fim", evento.target.value)} className={CAMPO} /></Campo>
            <Campo label="Descrição / objeto"><Input value={form.descricao} onChange={(evento) => atribuirForm("descricao", evento.target.value)} className={CAMPO} /></Campo>
          </div>

          <Campo label="Texto editável da minuta"><Textarea value={textoContrato} onChange={(evento) => setTextoContrato(evento.target.value)} className="min-h-[280px] resize-y font-mono text-[11px] leading-5" /></Campo>

          <div className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
            <Label htmlFor="contrato-arquivos" className="mb-2 flex items-center gap-2 text-xs font-semibold"><Upload size={13} /> Anexos do contrato</Label>
            <input id="contrato-arquivos" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" disabled={salvando} onChange={(evento) => setArquivosPendentes(Array.from(evento.target.files || []))} className="block w-full min-w-0 text-[11px] text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-primary" />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Os anexos selecionados serão enviados junto ao salvamento. Com cotista selecionado no cadastro, também ficam registrados em contrato_cotista.</p>
            {arquivosPendentes.length > 0 && <p className="mt-2 text-[11px] font-medium text-primary">{arquivosPendentes.length} arquivo(s) pronto(s) para envio.</p>}
            {anexos.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {anexos.map((anexo) => (
                  <li key={anexo.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-foreground">{anexo.nome}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void baixarAnexo(anexo)} className="h-7 shrink-0 text-[11px]">Baixar</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Campo label="Observações internas"><Textarea value={form.observacoes} onChange={(evento) => atribuirForm("observacoes", evento.target.value)} className="min-h-16 text-xs" /></Campo>

          {tipoVinculo === "COLABORADOR" && (
            <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
              O contrato será relacionado ao registro existente em <code className="rounded bg-muted px-1 py-0.5 text-foreground">contratos_trabalho</code>, quando houver. A página não cria um segundo vínculo empregatício.
            </p>
          )}
        </section>

        {/* Pré-visualização */}
        <section className="min-w-0 space-y-3 2xl:sticky 2xl:top-4">
          <div className={`${PAINEL} no-print flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold tracking-tight text-foreground">Pré-visualização timbrada</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">Substitua os campos entre colchetes, revise a minuta e salve uma cópia em PDF.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void salvarComoPdf()} disabled={gerandoPdf} className="h-8 w-full shrink-0 gap-2 text-xs sm:w-auto"><FileDown size={14} /> {gerandoPdf ? "Gerando PDF…" : "Salvar em PDF"}</Button>
          </div>

          <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-muted/40 p-2 sm:p-4">
            <article id="contrato-preview" className="contrato-preview mx-auto min-h-[900px] w-full max-w-[780px] border border-[#174f78] bg-white p-7 pb-20 pt-20 text-slate-900 shadow-sm sm:p-10 sm:pb-20 sm:pt-20">
              <header className="contrato-print-header mb-7 flex items-center justify-between gap-4 border-b border-[#174f78] pb-4"><img src="/logo.share.png" alt="Share Brasil" className="h-14 max-w-[220px] object-contain object-left" /><div className="text-right text-[9px] leading-4 text-slate-600"><p className="font-bold text-[#174f78]">{EMPRESA_TIMBRADA}</p></div></header>
              <div className="contrato-print-body whitespace-pre-wrap break-words font-serif text-[11px] leading-6 text-slate-800">{textoPreview}</div>
              <footer className="mt-8 border-t border-[#174f78]/30 pt-3 text-center text-[8px] text-slate-500">Documento editável — conferir dados, anexos e validade jurídica antes da assinatura.</footer>
            </article>
          </div>

          <p className="no-print text-[11px] leading-relaxed text-muted-foreground">
            A minuta editável é baseada no exemplo enviado e deve ser revisada pelo jurídico antes de assinatura. O texto salvo e as partes são armazenados em <code className="rounded bg-muted px-1 py-0.5 text-foreground">contratos</code> e <code className="rounded bg-muted px-1 py-0.5 text-foreground">contrato_partes</code>; arquivos anexos em <code className="rounded bg-muted px-1 py-0.5 text-foreground">contrato_anexos</code>.
          </p>
        </section>
      </div>
    </div>
  </div>;
}