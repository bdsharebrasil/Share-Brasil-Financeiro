import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type DespesaPdf = {
  data?: string;
  categoria?: string;
  descricao?: string;
  valor?: number;
  pago_por?: string;
};

export type RelatorioPdf = {
  numero_relatorio?: string;
  numero_voo?: string;
  cliente_nome?: string;
  aeronave_matricula?: string;
  rota?: string;
  data_inicio?: string;
  data_fim?: string;
  nome_tripulante?: string;
  nome_tripulante_2?: string;
  observacoes?: string;
  despesas?: DespesaPdf[];
  total_valor?: number;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] || char));

const dateBr = (value?: string) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const money = (value: unknown) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(Number(value) || 0);

export async function gerarPdfRelatorioViagem(report: RelatorioPdf): Promise<Blob> {
  const despesas = Array.isArray(report.despesas) ? report.despesas : [];
  const rows = despesas.map((item) => `
    <tr>
      <td>${escapeHtml(item.categoria || "Outros")}</td>
      <td>${escapeHtml(dateBr(item.data))}</td>
      <td>${escapeHtml(item.descricao || "Sem descrição")}</td>
      <td class="right">${escapeHtml(money(item.valor))}</td>
      <td>${escapeHtml(item.pago_por || "—")}</td>
    </tr>`).join("");
  const days = report.data_inicio && report.data_fim
    ? Math.max(1, Math.floor((Date.parse(`${report.data_fim}T00:00:00Z`) - Date.parse(`${report.data_inicio}T00:00:00Z`)) / 86400000) + 1)
    : 1;
  const node = document.createElement("div");
  node.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#333;z-index:-1";
  node.innerHTML = `
    <style>
      *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif}
      .page{width:794px;min-height:1123px;border:3px solid #22c55e;padding:38px;background:#fff}
      .header{text-align:center;border-bottom:3px solid #22c55e;padding-bottom:20px;margin-bottom:26px}
      .logo{width:76px;height:76px;object-fit:contain;margin-bottom:8px}.title{color:#1e3a8a;font-size:23px;font-weight:700;margin:0 0 8px}
      .number{font-size:15px;font-weight:700}.info{margin:18px 0 25px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 24px}
      .field{font-size:12px;line-height:1.45}.field b{color:#1e3a8a}.section{color:#1e3a8a;font-size:16px;font-weight:700;margin:18px 0 10px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:7px;text-align:left;vertical-align:top}th{background:#e8e8e8;color:#1e3a8a}.right{text-align:right}
      .total{display:flex;justify-content:space-between;border-top:2px solid #22c55e;margin-top:18px;padding-top:10px;color:#1e3a8a;font-size:15px;font-weight:700}
      .notes{border:1px solid #bbb;padding:12px;font-size:11px;min-height:50px}.footer{text-align:right;margin-top:32px;padding-top:12px;border-top:1px solid #999;color:#666;font-size:10px}
    </style>
    <div class="page">
      <div class="header"><img class="logo" src="/logo.share.png" alt="Share Brasil" />
        <h1 class="title">Relatório de Despesa de Viagem</h1>
        <div class="number">${escapeHtml(report.numero_relatorio || "N/A")}</div>
      </div>
      <div class="info"><div class="grid">
        <div class="field"><b>Cliente:</b> ${escapeHtml(report.cliente_nome || "N/A")}</div>
        <div class="field"><b>Aeronave:</b> ${escapeHtml(report.aeronave_matricula || "N/A")}</div>
        <div class="field"><b>Voo:</b> ${escapeHtml(report.numero_voo || "Não informado")}</div>
        <div class="field"><b>Período:</b> ${dateBr(report.data_inicio)} a ${dateBr(report.data_fim)} (${days} dias)</div>
        <div class="field"><b>Tripulante 1:</b> ${escapeHtml(report.nome_tripulante || "N/A")}</div>
        <div class="field"><b>Tripulante 2:</b> ${escapeHtml(report.nome_tripulante_2 || "Não informado")}</div>
        <div class="field"><b>Trecho:</b> ${escapeHtml(report.rota || "N/A")}</div>
      </div></div>
      <div class="section">Detalhes das Despesas</div>
      <table><thead><tr><th>Categoria</th><th>Data</th><th>Descrição</th><th>Valor (R$)</th><th>Pago por</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nenhuma despesa lançada.</td></tr>'}</tbody></table>
      <div class="total"><span>Total da viagem</span><span>${escapeHtml(money(report.total_valor))}</span></div>
      ${report.observacoes ? `<div class="section">Observações</div><div class="notes">${escapeHtml(report.observacoes)}</div>` : ""}
      <div class="footer">Share Brasil · Relatório gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
    </div>`;
  document.body.appendChild(node);
  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    let offset = 0;
    while (offset < imageHeight) {
      if (offset) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, -offset, pageWidth, imageHeight);
      offset += pageHeight;
    }
    return pdf.output("blob");
  } finally {
    node.remove();
  }
}
