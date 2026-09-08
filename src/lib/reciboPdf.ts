import { jsPDF } from "jspdf";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";

export const EMISSOR_SHARE = {
  nome: "SHARE BRASIL SERVICOS AEROPORTUARIOS",
  documento: "CNPJ: 30.898.549/0001-06",
  linhas: [
    "(65) 93618-0312",
    "AV. PRES. ARTHUR BERNARDES, 1457",
    "VÁRZEA GRANDE - 78125-100",
  ],
};

export type DadosReciboPdf = {
  numero: string;
  valor: number;
  descricao: string;
  data: string;
  pagadorNome: string;
  pagadorDocumento?: string | null;
  pagadorEndereco?: string | null;
  pagadorCidade?: string | null;
  pagadorUf?: string | null;
  pagadorLinhas?: Array<string | null | undefined>;
  emissorNome?: string;
  emissorDocumento?: string;
  emissorLinhas?: string[];
  rotuloEmissor?: string;
  rotuloPagador?: string;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function moedaBRL(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function partesData(data: string) {
  const [ano, mes, dia] = String(data || "").slice(0, 10).split("-");

  if (!ano || !mes || !dia) {
    return { dia: "__", mes: "______", ano: "____" };
  }

  return {
    dia: String(Number(dia)),
    mes: MESES[Number(mes) - 1] || "______",
    ano,
  };
}

async function carregarImagem(src: string): Promise<string> {
  const resposta = await fetch(src);

  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a imagem do recibo.");
  }

  const blob = await resposta.blob();
  // O jsPDF pode tentar ler novamente o src em addImage. Um object URL
  // revogado após o onload causa ERR_FILE_NOT_FOUND nesse ponto; a data URL
  // permanece disponível durante toda a geração do documento.
  return await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não foi possível carregar a imagem do recibo."));
    leitor.readAsDataURL(blob);
  });
}

export async function gerarReciboPdf(
  dados: DadosReciboPdf,
): Promise<Blob> {
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const [logo, assinatura] = await Promise.all([
    carregarImagem(logoShare),
    carregarImagem(assinaturaRecibo),
  ]);

  const margem = 18;
  const largura = 210 - margem * 2;
  const valorTexto = moedaBRL(dados.valor);

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

  let y = 40;

  pdf.setFontSize(7.5);
  pdf.setTextColor(110);
  pdf.setFont("helvetica", "normal");

  pdf.text((dados.rotuloEmissor || "RECEBEDOR").toUpperCase(), margem, y);
  pdf.text((dados.rotuloPagador || "PAGADOR").toUpperCase(), 95, y);
  pdf.text("Número do recibo:", 192, y, { align: "right" });

  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);

  const recebedorNome = pdf.splitTextToSize(
    dados.emissorNome || EMISSOR_SHARE.nome,
    68,
  );

  const pagadorNome = pdf.splitTextToSize(
    dados.pagadorNome || "—",
    68,
  );

  pdf.text(recebedorNome, margem, y + 5);
  pdf.text(pagadorNome, 95, y + 5);
  pdf.text(dados.numero || "—", 192, y + 5, {
    align: "right",
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  let yRecebedor = y + 5 + recebedorNome.length * 4.4;

  for (const linha of [
    dados.emissorDocumento || EMISSOR_SHARE.documento,
    ...(dados.emissorLinhas || EMISSOR_SHARE.linhas),
  ]) {
    pdf.text(String(linha), margem, yRecebedor);
    yRecebedor += 4.6;
  }

  let yPagador = y + 5 + pagadorNome.length * 4.4;

  for (const linha of [
    dados.pagadorDocumento,
    dados.pagadorEndereco,
    [dados.pagadorCidade, dados.pagadorUf].filter(Boolean).join(" - "),
    ...(dados.pagadorLinhas || []),
  ].filter(Boolean)) {
    pdf.text(String(linha), 95, yPagador);
    yPagador += 4.6;
  }

  y = Math.max(yRecebedor, yPagador) + 6;

  pdf.setFillColor(231, 234, 237);
  pdf.rect(margem, y, largura, 8, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("DESCRIÇÃO", margem + 4, y + 5.4);

  y += 12;

  pdf.setDrawColor(190);
  pdf.setLineWidth(0.3);
  const descricaoLinhas = pdf.splitTextToSize(dados.descricao || "—", 100);
  const alturaDescricao = Math.max(26, descricaoLinhas.length * 4.5 + 8);
  pdf.rect(margem, y, 108, alturaDescricao);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(35, 55, 100);

  pdf.text(descricaoLinhas, margem + 4, y + 6, { lineHeightFactor: 1.15 });

  pdf.setTextColor(20);

  pdf.rect(margem + 112, y, 24, 10);
  pdf.setFillColor(231, 234, 237);
  pdf.rect(margem + 112, y, 24, 10, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("TOTAL", margem + 124, y + 6.4, {
    align: "center",
  });

  pdf.rect(margem + 136, y, largura - 136, 10);
  pdf.setFontSize(10);
  pdf.text(valorTexto, margem + 141, y + 6.6);

  y += alturaDescricao + 8;

  pdf.setFont("helvetica", "bolditalic");
  pdf.setFontSize(7.5);
  pdf.text(
    pdf.splitTextToSize(
      "Este recibo é emitido em caráter condicional, sendo sua validade e eficácia jurídica condicionadas à regular compensação do valor total",
      largura,
    ),
    margem,
    y,
  );

  const { dia, mes, ano } = partesData(dados.data);

  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  pdf.text("VÁRZEA GRANDE,", 80, y, { align: "right" });
  pdf.text(dia, 92, y, { align: "center" });
  pdf.text("de", 106, y);
  pdf.text(mes, 126, y, { align: "center" });
  pdf.text("de", 148, y);
  pdf.text(ano, 168, y, { align: "center" });

  pdf.setDrawColor(60);
  pdf.line(43, y + 1.5, 80, y + 1.5);
  pdf.line(85, y + 1.5, 99, y + 1.5);
  pdf.line(112, y + 1.5, 140, y + 1.5);
  pdf.line(156, y + 1.5, 180, y + 1.5);

  y += 14;

  pdf.addImage(assinatura, "PNG", 80, y, 50, 18);

  pdf.setDrawColor(60);
  pdf.line(75, y + 19, 135, y + 19);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(20);
  pdf.text("Rolffe de Lima Erbe", 105, y + 25, {
    align: "center",
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text("Gestor Responsável", 105, y + 30, {
    align: "center",
  });

  pdf.addImage(logo, "PNG", 88, y + 35, 34, 12);
  pdf.text("setor financeiro Share Brasil", 105, y + 51, {
    align: "center",
  });

  return pdf.output("blob");
}
