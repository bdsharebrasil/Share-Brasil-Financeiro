import { jsPDF } from "jspdf";

type MesCotista = {
  mes: string;
  nome: string;
  total: number;
  fixos: number;
  variaveis: number;
  extras: number;
  naoClassificados: number;
  horas: number | null;
  voos: number | null;
  custoHora: number | null;
};

type CategoriaCotista = { nome: string; valor: number };

export type DadosPdfBalancoCotista = {
  aeronave: string;
  cotista: string;
  percentualSociedade: number | null;
  meses: MesCotista[];
  categorias: CategoriaCotista[];
};

const brl = (centavos: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(centavos / 100);

const quantidade = (valor: number | null, casas = 2) => valor === null
  ? "—"
  : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(valor);

export function baixarPdfBalancoCotista(dados: DadosPdfBalancoCotista) {
  if (!dados.meses.length) throw new Error("Selecione ao menos um mês para gerar o balanço.");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margem = 14;
  const largura = 297 - margem * 2;
  const total = dados.meses.reduce((soma, mes) => soma + mes.total, 0);
  const formatadorMes = (mes: string) => {
    const [ano, numero] = mes.split("-").map(Number);
    return new Date(Date.UTC(ano, numero - 1, 15)).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  const competencias = dados.meses.map((mes) => formatadorMes(mes.mes));

  pdf.setFillColor(15, 61, 110);
  pdf.rect(0, 0, 297, 29, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Balanço financeiro do cotista", margem, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`${dados.aeronave} · ${dados.cotista}`, margem, 21);

  pdf.setTextColor(20, 32, 46);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(`Competências: ${competencias.join(" · ")}`, margem, 39, { maxWidth: largura });
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Total rateado no período: ${brl(total)}`, margem, 47);
  pdf.text(`Participação societária atual: ${dados.percentualSociedade === null ? "não informada" : `${quantidade(dados.percentualSociedade)}%`}`, margem + 90, 47);

  let y = 58;
  const colunas = [
    { texto: "Mês", x: margem, w: 48, align: "left" as const },
    { texto: "Total rateado", x: margem + 48, w: 42, align: "right" as const },
    { texto: "Fixos", x: margem + 90, w: 38, align: "right" as const },
    { texto: "Variáveis", x: margem + 128, w: 40, align: "right" as const },
    { texto: "Extras", x: margem + 168, w: 34, align: "right" as const },
    { texto: "Não classificados", x: margem + 202, w: 40, align: "right" as const },
    { texto: "Horas", x: margem + 242, w: 20, align: "right" as const },
  ];
  const desenharCabecalho = () => {
    pdf.setFillColor(238, 243, 249);
    pdf.rect(margem, y, largura, 9, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(45, 58, 72);
    for (const coluna of colunas) {
      const x = coluna.align === "right" ? coluna.x + coluna.w - 2 : coluna.x + 2;
      pdf.text(coluna.texto, x, y + 6, { align: coluna.align });
    }
    y += 9;
  };
  desenharCabecalho();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  for (const mes of dados.meses) {
    if (y > 185) {
      pdf.addPage();
      y = 18;
      desenharCabecalho();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }
    const valores = [formatadorMes(mes.mes), brl(mes.total), brl(mes.fixos), brl(mes.variaveis), brl(mes.extras), brl(mes.naoClassificados), quantidade(mes.horas)];
    valores.forEach((valor, indice) => {
      const coluna = colunas[indice];
      const x = coluna.align === "right" ? coluna.x + coluna.w - 2 : coluna.x + 2;
      pdf.text(valor, x, y + 5, { align: coluna.align, maxWidth: coluna.w - 3 });
    });
    y += 8;
  }

  y += 8;
  if (y > 178) { pdf.addPage(); y = 20; }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 61, 110);
  pdf.text("Gastos por categoria do cotista", margem, y);
  y += 7;
  pdf.setTextColor(20, 32, 46);
  pdf.setFontSize(8.5);
  const categoriasOrdenadas = [...dados.categorias].sort((a, b) => b.valor - a.valor);
  for (const categoria of categoriasOrdenadas) {
    if (y > 188) { pdf.addPage(); y = 20; }
    const percentual = total ? categoria.valor / total * 100 : 0;
    pdf.setFont("helvetica", "normal");
    pdf.text(categoria.nome, margem + 2, y, { maxWidth: 150 });
    pdf.text(`${brl(categoria.valor)} · ${percentual.toFixed(1)}%`, 297 - margem, y, { align: "right" });
    y += 6;
  }

  pdf.setTextColor(93, 107, 123);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("Valores calculados a partir dos rateios financeiros registrados para o cotista e as competências selecionadas.", margem, 202, { maxWidth: largura });
  const slug = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const sufixo = dados.meses.map((mes) => mes.mes).join("_");
  pdf.save(`balanco-${slug(dados.aeronave)}-${slug(dados.cotista)}-${sufixo}.pdf`);
}
