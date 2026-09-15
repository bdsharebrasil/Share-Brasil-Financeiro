import { jsPDF } from "jspdf";
import type { CotistaRecibo } from "@/lib/colaborador-api";

type ItemDemonstrativoPdf = {
  numero_voo?: string | null;
  numero_sequencial?: number | null;
  data: string;
  hora?: string | null;
  operacao?: string | null;
  origem?: string | null;
  destino?: string | null;
  matricula?: string | null;
  valor: number;
  cotistaId: string;
  nomeCotista: string;
  percentual: number;
  valorRateado: number;
};

type GrupoResumo = { nome: string; valor: number; percentual: number; operacoes: number };

const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
const dataPt = (valor: string) => {
  const iso = String(valor || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return valor || "-";
};
const texto = (valor: unknown, fallback = "-") => String(valor ?? "").trim() || fallback;

function linhasDoVoo(linha: any, cotistas: CotistaRecibo[]): ItemDemonstrativoPdf[] {
  const total = Number(linha.valor) || 0;
  const rateios = linha.percentuaisCotistas
    ? Object.entries(linha.percentuaisCotistas as Record<string, number>)
        .map(([cotistaId, percentual]) => ({ cotistaId, percentual: Number(percentual) || 0 }))
        .filter((item) => item.percentual > 0)
    : [{ cotistaId: linha.cotistaId, percentual: 100 }];
  return rateios.map(({ cotistaId, percentual }) => {
    const cotista = cotistas.find((item) => item.id === cotistaId);
    return {
      ...linha,
      cotistaId,
      nomeCotista: cotista?.nome || linha.nomeCotista || "Cotista não informado",
      percentual,
      valorRateado: total * percentual / 100,
    };
  });
}

export function gerarDemonstrativoPdf(args: {
  tipo: string;
  numeroDocumento?: string | null;
  competencia?: string | null;
  aeronave?: string | null;
  linhas: any[];
  cotistas: CotistaRecibo[];
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margem = 12;
  const largura = 297 - margem * 2;
  const todos = args.linhas.flatMap((linha) => linhasDoVoo(linha, args.cotistas));
  const total = todos.reduce((soma, linha) => soma + Number(linha.valorRateado || 0), 0);
  const grupos = new Map<string, GrupoResumo>();
  for (const linha of todos) {
    const atual = grupos.get(linha.cotistaId) || { nome: linha.nomeCotista, valor: 0, percentual: 0, operacoes: 0 };
    atual.valor += linha.valorRateado;
    atual.operacoes += 1;
    grupos.set(linha.cotistaId, atual);
  }
  for (const grupo of grupos.values()) grupo.percentual = total ? grupo.valor / total * 100 : 0;

  pdf.setFillColor(8, 83, 126);
  pdf.rect(0, 0, 297, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("DEMONSTRATIVO DE RATEIO POR VOO", margem, 11);
  pdf.setFontSize(8);
  pdf.text(`TARIFA ${texto(args.tipo).toUpperCase()}`, 297 - margem, 11, { align: "right" });

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(9);
  pdf.text(`Documento: ${texto(args.numeroDocumento)}`, margem, 27);
  pdf.text(`Competência: ${texto(args.competencia)}`, margem + 72, 27);
  pdf.text(`Aeronave: ${texto(args.aeronave)}`, margem + 145, 27);
  pdf.text(`Total: ${moeda(total)}`, 297 - margem, 27, { align: "right" });

  let y = 34;
  const colunas = [
    ["Voo", margem, 18], ["Data", margem + 18, 23], ["Hora", margem + 41, 18],
    ["Origem", margem + 59, 19], ["Destino", margem + 78, 19], ["Matrícula", margem + 97, 25],
    ["Cotista", margem + 122, 66], ["%", margem + 188, 20], ["Valor", margem + 208, largura - 208],
  ] as const;
  pdf.setFillColor(226, 232, 240);
  pdf.rect(margem, y, largura, 8, "F");
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  for (const [label, x] of colunas) pdf.text(label, x + 2, y + 5.3);
  y += 8;
  pdf.setFont("helvetica", "normal");
  for (const linha of todos) {
    if (y > 190) {
      pdf.addPage();
      y = 18;
    }
    if (Math.round((y - 34) / 7) % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margem, y, largura, 7, "F");
    }
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(7.5);
    const valores = [
      texto(linha.numero_voo || linha.numero_sequencial), dataPt(linha.data), texto(linha.hora),
      texto(linha.origem), texto(linha.destino), texto(linha.matricula), texto(linha.nomeCotista),
      `${Number(linha.percentual || 0).toFixed(2)}%`, moeda(linha.valorRateado),
    ];
    valores.forEach((valor, index) => {
      const [, x, width] = colunas[index];
      const max = Math.max(8, Math.floor(width / 1.8));
      pdf.text(valor.slice(0, max), x + 2, y + 4.7, index === 7 || index === 8 ? { align: "right" } : undefined);
    });
    y += 7;
  }

  y += 8;
  if (y > 185) { pdf.addPage(); y = 18; }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(8, 83, 126);
  pdf.text("RESUMO POR COTISTA", margem, y);
  y += 7;
  pdf.setFontSize(8.5);
  for (const grupo of grupos.values()) {
    pdf.setTextColor(30, 41, 59);
    pdf.text(`${grupo.nome} · ${grupo.operacoes} voo(s)`, margem + 4, y);
    pdf.setTextColor(8, 83, 126);
    pdf.text(`${moeda(grupo.valor)} / ${grupo.percentual.toFixed(2)}%`, 297 - margem, y, { align: "right" });
    y += 6;
  }
  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Gerado pelo Share Brasil Financeiro · Os percentuais representam o rateio de cada operação.", margem, 204);
  return pdf.output("blob");
}

export function demonstrativoPdfFile(args: Parameters<typeof gerarDemonstrativoPdf>[0], nome = "demonstrativo-rateado.pdf") {
  return new File([gerarDemonstrativoPdf(args)], nome, { type: "application/pdf" });
}

export type { ItemDemonstrativoPdf };
