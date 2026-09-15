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
  const largura = 297 - margem * 2; // 273mm livres
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

  // Cabeçalho institucional do PDF
  pdf.setFillColor(8, 83, 126);
  pdf.rect(0, 0, 297, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("DEMONSTRATIVO DE RATEIO POR VOO", margem, 11);
  pdf.setFontSize(8);
  pdf.text(`TARIFA ${texto(args.tipo).toUpperCase()}`, 297 - margem, 11, { align: "right" });

  // Metadados do Faturamento
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(9);
  pdf.text(`Documento: ${texto(args.numeroDocumento)}`, margem, 27);
  pdf.text(`Competência: ${texto(args.competencia)}`, margem + 65, 27);
  pdf.text(`Aeronave: ${texto(args.aeronave)}`, margem + 125, 27);
  pdf.text(`Total Geral: ${moeda(total)}`, 297 - margem, 27, { align: "right" });

  let y = 34;

  // Redistribuição das larguras aproveitando os 273mm disponíveis na folha deitada
  // Estrutura: [Label, X_Inicial, Largura_Coluna, Alinhamento]
  const colunas = [
    ["Voo", margem, 20, "left"],
    ["Data", margem + 20, 25, "left"],
    ["Hora", margem + 45, 18, "left"],
    ["Origem", margem + 63, 20, "left"],
    ["Destino", margem + 83, 20, "left"],
    ["Matrícula", margem + 103, 22, "left"],
    ["Cotista", margem + 125, 90, "left"],
    ["%", margem + 215, 18, "right"],
    ["Valor", margem + 233, 40, "right"]
  ] as const;

  // Renderização da Barra de Títulos da Tabela
  pdf.setFillColor(226, 232, 240);
  pdf.rect(margem, y, largura, 8, "F");
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  
  colunas.forEach(([label, x, width, align]) => {
    const posX = align === "right" ? x + width - 2 : x + 2;
    pdf.text(label, posX, y + 5.5, { align });
  });
  
  y += 8;
  pdf.setFont("helvetica", "normal");
  
  // Renderização das linhas de dados do faturamento
  for (const linha of todos) {
    if (y > 185) {
      pdf.addPage();
      y = 18;
    }
    
    // Efeito zebra para legibilidade
    if (Math.round((y - 34) / 7) % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margem, y, largura, 7, "F");
    }
    
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(8);
    
    const valores = [
      texto(linha.numero_voo || linha.numero_sequencial), 
      dataPt(linha.data), 
      texto(linha.hora),
      texto(linha.origem), 
      texto(linha.destino), 
      texto(linha.matricula), 
      texto(linha.nomeCotista),
      `${Number(linha.percentual || 0).toFixed(2)}%`, 
      moeda(linha.valorRateado),
    ];

    valores.forEach((valor, index) => {
      const [, x, width, align] = colunas[index];
      // Define limite de caracteres proporcional à coluna para não transbordar
      const maxChar = Math.max(8, Math.floor(width / 1.6));
      const valorCortado = valor.length > maxChar ? valor.slice(0, maxChar) + "..." : valor;
      
      const posX = align === "right" ? x + width - 2 : x + 2;
      pdf.text(valorCortado, posX, y + 4.7, { align });
    });
    y += 7;
  }

  // Bloco de Resumo por Cotistas (Footer Dinâmico)
  y += 8;
  if (y > 180) { 
    pdf.addPage(); 
    y = 18; 
  }
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(8, 83, 126);
  pdf.text("RESUMO DE FECHAMENTO POR COTISTA", margem, y);
  y += 7;
  
  pdf.setFontSize(9);
  for (const grupo of grupos.values()) {
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${grupo.nome} · (${grupo.operacoes} pouso(s) / perna(s))`, margem + 2, y);
    
    pdf.setTextColor(8, 83, 126);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${moeda(grupo.valor)}  [ ${grupo.percentual.toFixed(2)}% ]`, 297 - margem, y, { align: "right" });
    y += 6.5;
  }
  
  // Nota de Rodapé
  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("Gerado automaticamente pelo Módulo Share Brasil Financeiro · As tarifas refletem estritamente os pousos coletados.", margem, 204);
  
  return pdf.output("blob");
}

export function demonstrativoPdfFile(args: Parameters<typeof gerarDemonstrativoPdf>[0], nome = "demonstrativo-rateado.pdf") {
  return new File([gerarDemonstrativoPdf(args)], nome, { type: "application/pdf" });
}

export type { ItemDemonstrativoPdf };
