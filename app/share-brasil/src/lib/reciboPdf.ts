import { jsPDF } from "jspdf";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";

export const EMISSOR_SHARE = {
  nome: "SHARE BRASIL SERVIÇOS AERONÁUTICOS",
  documento: "CNPJ: 30.898.549/0001-06",
  linhas: ["(65) 93618-0312", "AV. PRESIDENTE ARTHUR BERNARDES, 1457", "VÁRZEA GRANDE - 78125-100"],
};

export type DadosReciboPdf = {
  numero: string;
  valor: number;
  descricao: string;
  data: string;
  pagadorNome: string;
  pagadorDocumento?: string | null;
  pagadorLinhas?: Array<string | null | undefined>;
  emissorNome?: string;
  emissorDocumento?: string;
  emissorLinhas?: string[];
  rotuloPagador?: string;
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function moedaBRL(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function partesData(data: string) {
  const iso = String(data || "").slice(0, 10);
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return { dia: "__", mes: "______", ano: "____" };
  return { dia: String(Number(dia)), mes: MESES[Number(mes) - 1] || "______", ano };
}

async function carregarImagem(src: string) {
  const resposta = await fetch(src);
  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(url); resolve(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível carregar a imagem do recibo.")); };
    imagem.src = url;
  });
}

/** Layout oficial padronizado de todos os recibos da Share Brasil. */
export async function gerarReciboPdf(dados: DadosReciboPdf): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const [logo, assinatura] = await Promise.all([carregarImagem(logoShare), carregarImagem(assinaturaRecibo)]);
  const margem = 18;
  const largura = 210 - margem * 2;
  const valorTexto = moedaBRL(dados.valor);

  // Cabeçalho
  pdf.addImage(logo, "PNG", margem, 10, 42, 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("RECIBO", 105, 22, { align: "center" });
  pdf.setLineWidth(0.4);
  pdf.line(92, 23.6, 118, 23.6);

  pdf.setDrawColor(30);
  pdf.setLineWidth(0.6);
  pdf.rect(150, 14, 42, 12);
  pdf.setFontSize(13);
  pdf.text(valorTexto, 171, 22, { align: "center" });

  // Emissor / Pagador / Número
  let y = 40;
  pdf.setFontSize(7.5);
  pdf.setTextColor(110);
  pdf.setFont("helvetica", "normal");
  pdf.text("EMISSOR", margem, y);
  pdf.text((dados.rotuloPagador || "PAGADOR").toUpperCase(), 95, y);
  pdf.text("Número do recibo:", 192, y, { align: "right" });

  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  const emissorNome = pdf.splitTextToSize(dados.emissorNome || EMISSOR_SHARE.nome, 68);
  pdf.text(emissorNome, margem, y + 5);
  const pagadorNome = pdf.splitTextToSize(dados.pagadorNome || "—", 68);
  pdf.text(pagadorNome, 95, y + 5);
  pdf.text(dados.numero || "—", 192, y + 5, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  let yEmissor = y + 5 + emissorNome.length * 4.4;
  for (const linha of [dados.emissorDocumento || EMISSOR_SHARE.documento, ...(dados.emissorLinhas || EMISSOR_SHARE.linhas)]) {
    pdf.text(String(linha), margem, yEmissor);
    yEmissor += 4.6;
  }
  let yPagador = y + 5 + pagadorNome.length * 4.4;
  for (const linha of [dados.pagadorDocumento, ...(dados.pagadorLinhas || [])].filter(Boolean)) {
    pdf.text(String(linha), 95, yPagador);
    yPagador += 4.6;
  }

  // Descrição
  y = Math.max(yEmissor, yPagador) + 6;
  pdf.setFillColor(231, 234, 237);
  pdf.rect(margem, y, largura, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("DESCRIÇÃO", margem + 4, y + 5.4);

  y += 12;
  pdf.setDrawColor(190);
  pdf.setLineWidth(0.3);
  pdf.rect(margem, y, 108, 26);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(35, 55, 100);
  pdf.text(pdf.splitTextToSize(dados.descricao || "—", 100), margem + 4, y + 6);
  pdf.setTextColor(20);

  pdf.rect(margem + 112, y, 24, 10);
  pdf.setFillColor(231, 234, 237);
  pdf.rect(margem + 112, y, 24, 10, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("TOTAL", margem + 124, y + 6.4, { align: "center" });
  pdf.rect(margem + 136, y, largura - 136, 10);
  pdf.setFontSize(10);
  pdf.text(valorTexto, margem + 141, y + 6.6);

  // Cláusula
  y += 34;
  pdf.setFont("helvetica", "bolditalic");
  pdf.setFontSize(7.5);
  pdf.text("Para maior clareza, firmo(amos) o presente recibo para que produza os seus efeitos legais, dando plena e rasa quitação.", margem, y);

  // Local e data
  const { dia, mes, ano } = partesData(dados.data);
  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("VÁRZEA GRANDE,", 62, y);
  pdf.text(dia, 92, y, { align: "center" });
  pdf.text("de", 104, y);
  pdf.text(mes, 120, y, { align: "center" });
  pdf.text("de", 137, y);
  pdf.text(ano, 150, y, { align: "center" });
  pdf.setDrawColor(60);
  pdf.setLineWidth(0.3);
  pdf.line(85, y + 1.5, 100, y + 1.5);
  pdf.line(110, y + 1.5, 131, y + 1.5);
  pdf.line(142, y + 1.5, 158, y + 1.5);

  // Assinatura e rodapé: a assinatura fica acima da linha, como no recibo oficial.
  y += 14;
  pdf.addImage(assinatura, "PNG", 80, y, 50, 18);
  pdf.setDrawColor(60);
  pdf.setLineWidth(0.3);
  pdf.line(75, y + 19, 135, y + 19);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(20);
  pdf.text("Rolffe de Lima Erbe", 105, y + 25, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text("Gestor Responsável", 105, y + 30, { align: "center" });
  pdf.addImage(logo, "PNG", 88, y + 35, 34, 12);
  pdf.text("setor financeiro Share Brasil", 105, y + 51, { align: "center" });

  return pdf.output("blob");
}
