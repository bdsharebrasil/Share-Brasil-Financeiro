import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

/* ============================================================================
 * TIPOS
 * ========================================================================== */

export type DespesaPdf = {
  data?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  valor?: number | string | null;
  pago_por?: string | null;
};

export type AnexoPdf = {
  nome_arquivo: string;
  tipo_arquivo?: string | null;
  indice_despesa?: number | string | null;
  arquivo: Blob;
};

export type RelatorioPdf = {
  numero_relatorio?: string | null;
  numero_voo?: string | null;
  cliente_nome?: string | null;
  aeronave_matricula?: string | null;
  rota?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  nome_tripulante?: string | null;
  nome_tripulante_2?: string | null;
  observacoes?: string | null;
  despesas?: DespesaPdf[] | null;
  total_valor?: number | string | null;
  anexos?: AnexoPdf[] | null;
};

/**
 * Despesa já ordenada, com:
 * - indiceOriginal: posição no array recebido (é a que `indice_despesa` do anexo referencia)
 * - numero: posição exibida na tabela (1, 2, 3...), usada também nos comprovantes
 */
type ItemDespesa = {
  despesa: DespesaPdf;
  indiceOriginal: number;
  numero: number;
};

type CaixaDestino = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

/* ============================================================================
 * CONSTANTES
 * ========================================================================== */

const LARGURA_CANVAS_COMPROVANTE = 794;
const ALTURA_CANVAS_COMPROVANTE = 1123;

/**
 * Densidade de pixels dos comprovantes.
 * 3 => ~288 DPI no A4 (bom equilíbrio nitidez x memória, inclusive em celular/iPad).
 * Se for usar só em desktop e quiser ainda mais nitidez, pode subir para 4.
 */
const ESCALA_COMPROVANTE = 3;

/** Escala do html2canvas para a página principal do relatório. */
const ESCALA_RELATORIO = 3;

const AREA_COMPROVANTE = {
  x: 38,
  y: 245,
  largura: 718,
  altura: 760,
};

const LARGURA_MAXIMA_CONTEUDO = 680;
const ALTURA_MAXIMA_CONTEUDO = 720;

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function numero(value: unknown): number {
  const resultado = Number(value);
  return Number.isFinite(resultado) ? resultado : 0;
}

function dinheiro(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero(value));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

function dataBr(value?: string | null): string {
  if (!value) return "—";

  const partes = value.slice(0, 10).split("-");
  if (partes.length !== 3) return value;

  const [ano, mes, dia] = partes;
  if (!ano || !mes || !dia) return value;

  return `${dia}/${mes}/${ano}`;
}

/**
 * Ordena as despesas por data (estável) e devolve cada uma com
 * o índice original e o número de exibição.
 */
function prepararItens(despesas: DespesaPdf[]): ItemDespesa[] {
  return despesas
    .map((despesa, indiceOriginal) => ({
      despesa,
      indiceOriginal,
      data: Date.parse(`${despesa.data?.slice(0, 10) ?? ""}T00:00:00Z`),
    }))
    .sort((a, b) => {
      const aValida = Number.isFinite(a.data);
      const bValida = Number.isFinite(b.data);

      if (aValida && bValida) {
        return a.data - b.data || a.indiceOriginal - b.indiceOriginal;
      }
      if (aValida) return -1;
      if (bValida) return 1;

      return a.indiceOriginal - b.indiceOriginal;
    })
    .map(({ despesa, indiceOriginal }, posicao) => ({
      despesa,
      indiceOriginal,
      numero: posicao + 1,
    }));
}

/**
 * Converte o `indice_despesa` do anexo em índice válido do array original.
 * Retorna null se estiver ausente ou fora do intervalo.
 */
function resolverIndiceOriginal(
  valor: number | string | null | undefined,
  totalDespesas: number,
): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const indice = Number(valor);

  if (!Number.isInteger(indice) || indice < 0 || indice >= totalDespesas) {
    return null;
  }

  return indice;
}

function calcularDias(inicio?: string | null, fim?: string | null): number {
  if (!inicio || !fim) return 1;

  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const fimMs = Date.parse(`${fim}T00:00:00Z`);

  if (
    !Number.isFinite(inicioMs) ||
    !Number.isFinite(fimMs) ||
    fimMs < inicioMs
  ) {
    return 1;
  }

  return Math.floor((fimMs - inicioMs) / 86_400_000) + 1;
}

function normalizarPagador(value?: string | null): string {
  const normalizado = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  switch (normalizado) {
    case "tripulante_1":
    case "tripulante1":
      return "Tripulante 1";

    case "tripulante_2":
    case "tripulante2":
      return "Tripulante 2";

    case "cliente":
    case "client":
      return "Cliente";

    case "share":
    case "sharebrasil":
    case "share_brasil":
      return "Share Brasil";

    default:
      return value ? String(value).replace(/_/g, " ") : "—";
  }
}

function categoriaNormalizada(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ----------------------------------------------------------------------------
 * Helpers de texto para canvas
 * -------------------------------------------------------------------------- */

function truncarTexto(
  context: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
): string {
  if (context.measureText(texto).width <= larguraMax) {
    return texto;
  }

  let cortado = texto;

  while (
    cortado.length > 1 &&
    context.measureText(`${cortado}…`).width > larguraMax
  ) {
    cortado = cortado.slice(0, -1);
  }

  return `${cortado}…`;
}

function quebrarTexto(
  context: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
  maxLinhas: number,
): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;

    if (context.measureText(tentativa).width <= larguraMax) {
      atual = tentativa;
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }

  if (atual) linhas.push(atual);
  if (linhas.length === 0) linhas.push("");

  if (linhas.length > maxLinhas) {
    const visiveis = linhas.slice(0, maxLinhas - 1);
    const resto = linhas.slice(maxLinhas - 1).join(" ");
    visiveis.push(truncarTexto(context, resto, larguraMax));
    return visiveis;
  }

  return linhas.map((linha) => truncarTexto(context, linha, larguraMax));
}

/* ----------------------------------------------------------------------------
 * Helpers de qualidade de imagem
 * -------------------------------------------------------------------------- */

function liberarCanvas(canvas: HTMLCanvasElement): void {
  // Libera a memória do bitmap imediatamente (importante em celular/iPad).
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Calcula a posição e o tamanho (em pixels reais do canvas) de um conteúdo
 * centralizado na área do comprovante. Valores inteiros evitam serrilhado
 * por posicionamento em subpixel.
 */
function caixaCentralizada(
  larguraCss: number,
  alturaCss: number,
): CaixaDestino {
  const largura = Math.max(1, Math.round(larguraCss * ESCALA_COMPROVANTE));
  const altura = Math.max(1, Math.round(alturaCss * ESCALA_COMPROVANTE));

  const x = Math.round(
    (AREA_COMPROVANTE.x + (AREA_COMPROVANTE.largura - larguraCss) / 2) *
      ESCALA_COMPROVANTE,
  );

  const y = Math.round(
    (AREA_COMPROVANTE.y + (AREA_COMPROVANTE.altura - alturaCss) / 2) *
      ESCALA_COMPROVANTE,
  );

  return { x, y, largura, altura };
}

/**
 * Reduz uma imagem em etapas de 50% (muito mais nítido do que reduzir
 * de uma vez só) até o tamanho final.
 */
function redimensionarComQualidade(
  origem: HTMLImageElement,
  larguraDestino: number,
  alturaDestino: number,
): HTMLCanvasElement {
  let fonte: CanvasImageSource = origem;
  let larguraAtual = origem.naturalWidth || origem.width;
  let alturaAtual = origem.naturalHeight || origem.height;

  const intermediarios: HTMLCanvasElement[] = [];

  while (larguraAtual / 2 >= larguraDestino) {
    const proximo = document.createElement("canvas");
    proximo.width = Math.max(1, Math.floor(larguraAtual / 2));
    proximo.height = Math.max(1, Math.floor(alturaAtual / 2));

    const ctx = proximo.getContext("2d");
    if (!ctx) break;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fonte, 0, 0, proximo.width, proximo.height);

    fonte = proximo;
    larguraAtual = proximo.width;
    alturaAtual = proximo.height;
    intermediarios.push(proximo);
  }

  const final = document.createElement("canvas");
  final.width = larguraDestino;
  final.height = alturaDestino;

  const ctxFinal = final.getContext("2d");

  if (!ctxFinal) {
    throw new Error("Não foi possível preparar a imagem do comprovante.");
  }

  ctxFinal.imageSmoothingEnabled = true;
  ctxFinal.imageSmoothingQuality = "high";
  ctxFinal.drawImage(fonte, 0, 0, larguraDestino, alturaDestino);

  for (const intermediario of intermediarios) {
    liberarCanvas(intermediario);
  }

  return final;
}

/* ============================================================================
 * TOTAIS
 * ========================================================================== */

function calcularTotaisCategoria(
  despesas: DespesaPdf[],
): Record<string, number> {
  const totais: Record<string, number> = {
    "Combustível": 0,
    Hospedagem: 0,
    Alimentação: 0,
    Transporte: 0,
    Outros: 0,
  };

  for (const despesa of despesas) {
    const categoria = categoriaNormalizada(despesa.categoria);
    const valor = numero(despesa.valor);

    if (categoria.includes("combust")) {
      totais["Combustível"] += valor;
    } else if (categoria.includes("hosped")) {
      totais["Hospedagem"] += valor;
    } else if (categoria.includes("aliment")) {
      totais["Alimentação"] += valor;
    } else if (categoria.includes("transport")) {
      totais["Transporte"] += valor;
    } else {
      totais["Outros"] += valor;
    }
  }

  return totais;
}

function calcularTotaisPagador(
  despesas: DespesaPdf[],
): Record<string, number> {
  const totais: Record<string, number> = {
    "Tripulante 1": 0,
    "Tripulante 2": 0,
    Cliente: 0,
    "Share Brasil": 0,
  };

  for (const despesa of despesas) {
    const pagador = normalizarPagador(despesa.pago_por);
    const valor = numero(despesa.valor);

    if (totais[pagador] !== undefined) {
      totais[pagador] += valor;
    }
  }

  return totais;
}

/* ============================================================================
 * PÁGINA PRINCIPAL
 * ========================================================================== */

function montarHtmlRelatorio(
  report: RelatorioPdf,
  itens: ItemDespesa[],
): HTMLDivElement {
  const node = document.createElement("div");
  const despesas = itens.map((item) => item.despesa);

  const totalCalculado = despesas.reduce(
    (total, despesa) => total + numero(despesa.valor),
    0,
  );

  const total = numero(report.total_valor) || totalCalculado;
  const dias = calcularDias(report.data_inicio, report.data_fim);
  const totaisCategoria = calcularTotaisCategoria(despesas);
  const totaisPagador = calcularTotaisPagador(despesas);

  const rows = itens
    .map(
      ({ despesa, numero: numeroItem }) => `
        <tr>
          <td class="num">${numeroItem}</td>
          <td>${escapeHtml(despesa.categoria || "Outros")}</td>
          <td>${escapeHtml(dataBr(despesa.data))}</td>
          <td>${escapeHtml(despesa.descricao || "Sem descrição")}</td>
          <td class="valor">${escapeHtml(dinheiro(despesa.valor))}</td>
          <td>${escapeHtml(normalizarPagador(despesa.pago_por))}</td>
        </tr>
      `,
    )
    .join("");

  const linhasResumo = (totais: Record<string, number>) =>
    Object.entries(totais)
      .map(
        ([nome, valor]) => `
          <div class="summary-row">
            <span>${escapeHtml(nome)}</span>
            <strong>${escapeHtml(dinheiro(valor))}</strong>
          </div>
        `,
      )
      .join("");

  const categoriaCards = linhasResumo(totaisCategoria);
  const pagadorCards = linhasResumo(totaisPagador);

  const observacoes = report.observacoes?.trim();

  node.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px",
    "background:#ffffff",
    "color:#1f2937",
    "z-index:-1",
  ].join(";");

  node.innerHTML = `
    <style>
      * { box-sizing: border-box; }

      .pdf-page {
        width: 794px;
        background: #ffffff;
        color: #1f2937;
        padding: 34px 38px;
        font-family: Arial, Helvetica, sans-serif;
      }

      .header {
        position: relative;
        text-align: center;
        border-bottom: 3px solid #22c55e;
        padding: 8px 0 18px;
        margin-bottom: 22px;
      }

      .logo {
        position: absolute;
        left: 0;
        top: 0;
        width: 105px;
        height: 70px;
        object-fit: contain;
        object-position: left center;
      }

      .title {
        margin: 12px 0 5px;
        color: #1e3a8a;
        font-size: 23px;
        line-height: 1.2;
        font-weight: 700;
      }

      .number {
        color: #374151;
        font-size: 14px;
        font-weight: 700;
      }

      .info { margin-bottom: 20px; }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px 24px;
      }

      .info-item {
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 11px;
        line-height: 1.45;
      }

      .info-label {
        color: #1e3a8a;
        font-weight: 700;
      }

      .section-title {
        margin: 18px 0 9px;
        color: #1e3a8a;
        font-size: 15px;
        line-height: 1.2;
        font-weight: 700;
      }

      table {
        width: 100%;
        max-width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 10px;
      }

      th, td {
        overflow-wrap: anywhere;
        word-break: break-word;
        border: 1px solid #b9b9b9;
        padding: 6px;
        vertical-align: top;
      }

      th {
        background: #eef0f2;
        color: #1e3a8a;
        font-weight: 700;
        text-align: left;
      }

      .num {
        text-align: center;
        font-weight: 700;
        color: #1e3a8a;
      }

      .valor {
        text-align: right;
        white-space: nowrap;
      }

      .summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 20px;
        page-break-inside: avoid;
      }

      .summary-card {
        border: 1px solid #c5c5c5;
        border-radius: 8px;
        padding: 12px;
        background: #ffffff;
      }

      .summary-card-title {
        padding-bottom: 8px;
        margin-bottom: 9px;
        border-bottom: 2px solid #22c55e;
        color: #1e3a8a;
        font-size: 12px;
        font-weight: 700;
      }

      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 7px;
        color: #374151;
        font-size: 10px;
      }

      .summary-row span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .summary-row strong {
        color: #111827;
        white-space: nowrap;
      }

      .grand-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 17px;
        padding-top: 10px;
        border-top: 2px solid #22c55e;
        color: #1e3a8a;
        font-size: 14px;
        font-weight: 700;
        page-break-inside: avoid;
      }

      .grand-total-value { color: #16a34a; }

      .observacoes {
        margin-top: 19px;
        page-break-inside: avoid;
      }

      .observacoes-box {
        overflow-wrap: anywhere;
        border: 1px solid #c5c5c5;
        border-left: 4px solid #22c55e;
        border-radius: 5px;
        padding: 10px 12px;
        color: #374151;
        font-size: 10px;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      .footer {
        margin-top: 25px;
        padding-top: 9px;
        border-top: 1px solid #cfcfcf;
        color: #6b7280;
        text-align: right;
        font-size: 9px;
      }
    </style>

    <div class="pdf-page">

      <div class="header">
        <img class="logo" src="/logo.share.png" alt="Share Brasil" />

        <div class="title">Relatório de Despesa de Viagem</div>

        <div class="number">
          ${escapeHtml(report.numero_relatorio || "N/A")}
        </div>
      </div>

      <div class="info">
        <div class="info-grid">

          <div class="info-item">
            <span class="info-label">Cliente:</span>
            ${escapeHtml(report.cliente_nome || "N/A")}
          </div>

          <div class="info-item">
            <span class="info-label">Aeronave:</span>
            ${escapeHtml(report.aeronave_matricula || "N/A")}
          </div>

          <div class="info-item">
            <span class="info-label">Voo:</span>
            ${escapeHtml(report.numero_voo || "Não informado")}
          </div>

          <div class="info-item">
            <span class="info-label">Período:</span>
            ${escapeHtml(
              `${dataBr(report.data_inicio)} a ${dataBr(report.data_fim)} (${dias} ${
                dias === 1 ? "dia" : "dias"
              })`,
            )}
          </div>

          <div class="info-item">
            <span class="info-label">Tripulante 1:</span>
            ${escapeHtml(report.nome_tripulante || "N/A")}
          </div>

          ${
            report.nome_tripulante_2?.trim()
              ? `
            <div class="info-item">
              <span class="info-label">Tripulante 2:</span>
              ${escapeHtml(report.nome_tripulante_2.trim())}
            </div>
          `
              : ""
          }

          <div class="info-item">
            <span class="info-label">Trecho:</span>
            ${escapeHtml(report.rota || "N/A")}
          </div>

        </div>
      </div>

      <div class="section-title">Relação das Despesas</div>

      <table>
        <colgroup>
          <col style="width:6%" />
          <col style="width:16%" />
          <col style="width:11%" />
          <col style="width:35%" />
          <col style="width:16%" />
          <col style="width:16%" />
        </colgroup>

        <thead>
          <tr>
            <th style="text-align:center">Nº</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Pago por</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows ||
            `<tr><td colspan="6">Nenhuma despesa lançada.</td></tr>`
          }
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-card">
          <div class="summary-card-title">Total por categoria</div>
          ${categoriaCards}
        </div>

        <div class="summary-card">
          <div class="summary-card-title">Total por pagador</div>
          ${pagadorCards}
        </div>
      </div>

      <div class="grand-total">
        <span>Total das despesas</span>
        <span class="grand-total-value">${escapeHtml(dinheiro(total))}</span>
      </div>

      ${
        observacoes
          ? `
            <div class="observacoes">
              <div class="section-title">Observações</div>
              <div class="observacoes-box">${escapeHtml(observacoes)}</div>
            </div>
          `
          : ""
      }

      <div class="footer">
        Share Brasil · Relatório gerado em
        ${new Date().toLocaleDateString("pt-BR")}
      </div>

    </div>
  `;

  return node;
}

/* ============================================================================
 * COMPROVANTE - BASE
 * ========================================================================== */

function criarCanvasComprovante(
  item: ItemDespesa | null,
  anexo: AnexoPdf,
  paginaAtual?: number,
  totalPaginas?: number,
): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar o comprovante.");
  }

  canvas.width = LARGURA_CANVAS_COMPROVANTE * ESCALA_COMPROVANTE;
  canvas.height = ALTURA_CANVAS_COMPROVANTE * ESCALA_COMPROVANTE;

  context.scale(ESCALA_COMPROVANTE, ESCALA_COMPROVANTE);

  context.fillStyle = "#ffffff";
  context.fillRect(
    0,
    0,
    LARGURA_CANVAS_COMPROVANTE,
    ALTURA_CANVAS_COMPROVANTE,
  );

  const despesa = item?.despesa;

  /* --------------------------------------------------------------------------
   * CABEÇALHO
   * ------------------------------------------------------------------------ */

  context.textBaseline = "alphabetic";

  context.fillStyle = "#1e3a8a";
  context.font = "bold 22px Arial";
  context.fillText("Comprovante Anexado", 38, 45);

  context.fillStyle = "#555555";
  context.font = "12px Arial";

  context.fillText(
    item ? `Item Nº ${item.numero}` : "Item não identificado",
    38,
    69,
  );

  context.fillText(
    truncarTexto(context, `Arquivo: ${anexo.nome_arquivo}`, 718),
    38,
    88,
  );

  if (paginaAtual !== undefined && totalPaginas !== undefined) {
    const textoPagina = `Página ${paginaAtual} de ${totalPaginas}`;
    const larguraTexto = context.measureText(textoPagina).width;
    context.fillText(textoPagina, 756 - larguraTexto, 69);
  }

  context.strokeStyle = "#22c55e";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(38, 105);
  context.lineTo(756, 105);
  context.stroke();

  /* --------------------------------------------------------------------------
   * INFORMAÇÕES DA DESPESA
   * ------------------------------------------------------------------------ */

  const inicioY = 135;
  const corRotulo = "#1e3a8a";
  const corTexto = "#333333";

  const rotulo = (texto: string, x: number, y: number) => {
    context.fillStyle = corRotulo;
    context.font = "bold 12px Arial";
    context.fillText(texto, x, y);
  };

  const valorTexto = (
    texto: string,
    x: number,
    y: number,
    larguraMax: number,
  ) => {
    context.fillStyle = corTexto;
    context.font = "12px Arial";
    context.fillText(truncarTexto(context, texto, larguraMax), x, y);
  };

  // Linha 1: Descrição (até 2 linhas) | Categoria | Data
  rotulo("Descrição", 38, inicioY);
  rotulo("Categoria", 300, inicioY);
  rotulo("Data", 530, inicioY);

  context.fillStyle = corTexto;
  context.font = "12px Arial";

  const linhasDescricao = quebrarTexto(
    context,
    despesa ? despesa.descricao || "Sem descrição" : "Despesa não identificada",
    240,
    2,
  );

  linhasDescricao.forEach((linha, i) => {
    context.fillText(linha, 38, inicioY + 20 + i * 15);
  });

  valorTexto(
    despesa ? despesa.categoria || "Outros" : "—",
    300,
    inicioY + 20,
    215,
  );
  valorTexto(despesa ? dataBr(despesa.data) : "—", 530, inicioY + 20, 220);

  // Linha 2: Valor | Pago por
  rotulo("Valor", 38, inicioY + 60);
  rotulo("Pago por", 300, inicioY + 60);

  valorTexto(despesa ? dinheiro(despesa.valor) : "—", 38, inicioY + 80, 240);
  valorTexto(
    despesa ? normalizarPagador(despesa.pago_por) : "—",
    300,
    inicioY + 80,
    215,
  );

  /* --------------------------------------------------------------------------
   * ÁREA DO COMPROVANTE
   * ------------------------------------------------------------------------ */

  context.strokeStyle = "#d1d5db";
  context.lineWidth = 1;
  context.strokeRect(
    AREA_COMPROVANTE.x,
    AREA_COMPROVANTE.y,
    AREA_COMPROVANTE.largura,
    AREA_COMPROVANTE.altura,
  );

  return { canvas, context };
}

/* ============================================================================
 * COMPROVANTE - IMAGEM
 * ========================================================================== */

async function gerarPaginaImagem(
  anexo: AnexoPdf,
  item: ItemDespesa | null,
): Promise<HTMLCanvasElement> {
  const { canvas, context } = criarCanvasComprovante(item, anexo);

  const url = URL.createObjectURL(anexo.arquivo);

  try {
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const elemento = new Image();

      elemento.onload = () => resolve(elemento);
      elemento.onerror = () =>
        reject(new Error("Não foi possível carregar a imagem do comprovante."));

      elemento.src = url;
    });

    const larguraOriginal = imagem.naturalWidth || imagem.width;
    const alturaOriginal = imagem.naturalHeight || imagem.height;

    if (larguraOriginal <= 0 || alturaOriginal <= 0) {
      throw new Error("O comprovante possui dimensões inválidas.");
    }

    // Em px de layout; imagens pequenas não são ampliadas além do tamanho natural.
    const escala = Math.min(
      LARGURA_MAXIMA_CONTEUDO / larguraOriginal,
      ALTURA_MAXIMA_CONTEUDO / alturaOriginal,
      1,
    );

    const caixa = caixaCentralizada(
      larguraOriginal * escala,
      alturaOriginal * escala,
    );

    // Redução em etapas, direto para o tamanho final em pixels reais.
    const pronta = redimensionarComQualidade(
      imagem,
      caixa.largura,
      caixa.altura,
    );

    // Desenha em pixels reais (sem escala do contexto) => cópia 1:1.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(pronta, caixa.x, caixa.y);

    liberarCanvas(pronta);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ============================================================================
 * COMPROVANTE - PDF
 * ========================================================================== */

/**
 * Renderiza cada página do PDF anexado já no tamanho final (em pixels reais)
 * e entrega uma a uma ao callback, para não manter todas na memória.
 */
async function gerarPaginasPdf(
  anexo: AnexoPdf,
  item: ItemDespesa | null,
  aoGerarPagina: (canvas: HTMLCanvasElement) => void,
): Promise<void> {
  GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

  const buffer = await anexo.arquivo.arrayBuffer();

  const documento = await getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  try {
    for (
      let paginaNumero = 1;
      paginaNumero <= documento.numPages;
      paginaNumero += 1
    ) {
      const pagina = await documento.getPage(paginaNumero);

      // Tamanho natural da página (em pontos), já considerando rotação.
      const viewportBase = pagina.getViewport({ scale: 1 });

      // Como é vetorial, a página pode ser ajustada (inclusive ampliada)
      // para ocupar a área do comprovante.
      const escalaLayout = Math.min(
        LARGURA_MAXIMA_CONTEUDO / viewportBase.width,
        ALTURA_MAXIMA_CONTEUDO / viewportBase.height,
      );

      const caixa = caixaCentralizada(
        viewportBase.width * escalaLayout,
        viewportBase.height * escalaLayout,
      );

      // Renderiza exatamente no tamanho final, em pixels reais do canvas.
      const viewport = pagina.getViewport({
        scale: caixa.largura / viewportBase.width,
      });

      const origem = document.createElement("canvas");
      origem.width = Math.max(1, Math.round(viewport.width));
      origem.height = Math.max(1, Math.round(viewport.height));

      const origemContext = origem.getContext("2d");

      if (!origemContext) {
        throw new Error("Não foi possível preparar a página do PDF.");
      }

      origemContext.fillStyle = "#ffffff";
      origemContext.fillRect(0, 0, origem.width, origem.height);

      await pagina.render({
        canvas: origem,
        canvasContext: origemContext,
        viewport,
      }).promise;

      const { canvas, context } = criarCanvasComprovante(
        item,
        anexo,
        paginaNumero,
        documento.numPages,
      );

      // Recentraliza com a altura real do canvas renderizado (evita desvio de 1px).
      const x = caixa.x;
      const y = Math.round(
        (AREA_COMPROVANTE.y * ESCALA_COMPROVANTE) +
          (AREA_COMPROVANTE.altura * ESCALA_COMPROVANTE - origem.height) / 2,
      );

      // Cópia 1:1, sem reamostragem.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(origem, x, y);

      liberarCanvas(origem);
      pagina.cleanup();

      aoGerarPagina(canvas);
    }
  } finally {
    await documento.destroy();
  }
}

/* ============================================================================
 * ADICIONAR CANVAS AO PDF
 * ========================================================================== */

function adicionarCanvasAoPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  formato: "PNG" | "JPEG",
  qualidadeJpeg: number,
  tolerancia: number,
): void {
  const imagem =
    formato === "PNG"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", qualidadeJpeg);

  const compressao = formato === "PNG" ? "FAST" : undefined;

  const proporcao = PAGE_WIDTH_MM / canvas.width;
  const altura = canvas.height * proporcao;

  /*
   * Pequenos excessos (arredondamento de fontes/bordas do html2canvas)
   * não devem gerar uma segunda página quase vazia.
   */
  if (altura <= PAGE_HEIGHT_MM + tolerancia) {
    pdf.addImage(
      imagem,
      formato,
      0,
      0,
      PAGE_WIDTH_MM,
      Math.min(altura, PAGE_HEIGHT_MM),
      undefined,
      compressao,
    );
    return;
  }

  /*
   * Conteúdo maior que uma página A4: divide verticalmente.
   */
  let offset = 0;

  while (offset < altura - 1) {
    if (offset > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imagem,
      formato,
      0,
      -offset,
      PAGE_WIDTH_MM,
      altura,
      undefined,
      compressao,
    );

    offset += PAGE_HEIGHT_MM;
  }
}

/* ============================================================================
 * PDF PRINCIPAL
 * ========================================================================== */

export async function gerarPdfRelatorioViagem(
  report: RelatorioPdf,
): Promise<Blob> {
  const despesas = Array.isArray(report.despesas) ? report.despesas : [];
  const anexos = Array.isArray(report.anexos) ? report.anexos : [];

  /*
   * Fonte única de verdade: a mesma lista ordenada e numerada
   * alimenta a tabela do relatório E os comprovantes.
   */
  const itens = prepararItens(despesas);

  const itemPorIndiceOriginal = new Map<number, ItemDespesa>(
    itens.map((item) => [item.indiceOriginal, item]),
  );

  /*
   * Vincula cada anexo à sua despesa (pelo índice ORIGINAL)
   * e ordena os anexos na mesma sequência da tabela.
   */
  const anexosOrdenados = anexos
    .map((anexo, ordem) => {
      const indiceOriginal = resolverIndiceOriginal(
        anexo.indice_despesa,
        despesas.length,
      );

      const item =
        indiceOriginal === null
          ? null
          : (itemPorIndiceOriginal.get(indiceOriginal) ?? null);

      return { anexo, ordem, item };
    })
    .sort(
      (a, b) =>
        (a.item?.numero ?? Number.MAX_SAFE_INTEGER) -
          (b.item?.numero ?? Number.MAX_SAFE_INTEGER) || a.ordem - b.ordem,
    );

  const node = montarHtmlRelatorio(report, itens);

  document.body.appendChild(node);

  try {
    // Aguarda o navegador montar o conteúdo.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    // Aguarda a logo carregar.
    const imagens = Array.from(node.querySelectorAll("img"));

    await Promise.all(
      imagens.map(async (imagem) => {
        if (imagem.complete) return;

        await new Promise<void>((resolve) => {
          imagem.addEventListener("load", () => resolve(), { once: true });
          imagem.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );

    const canvas = await html2canvas(node, {
      scale: ESCALA_RELATORIO,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    // Página(s) do relatório: PNG mantém o texto nítido (tolerância maior por causa do html2canvas).
    adicionarCanvasAoPdf(pdf, canvas, "PNG", 1, 4);
    liberarCanvas(canvas);

    // Cada comprovante começa obrigatoriamente em uma nova página.
    for (const { anexo, item } of anexosOrdenados) {
      const ehPdf =
        Boolean(anexo.tipo_arquivo?.toLowerCase().includes("pdf")) ||
        anexo.nome_arquivo.toLowerCase().endsWith(".pdf");

      if (ehPdf) {
        // Páginas de PDF (texto/vetor): PNG, sem borrar as letras.
        await gerarPaginasPdf(anexo, item, (pagina) => {
          pdf.addPage();
          adicionarCanvasAoPdf(pdf, pagina, "PNG", 1, 0.5);
          liberarCanvas(pagina);
        });
      } else {
        // Fotos: JPEG de alta qualidade (PNG ficaria pesado demais).
        const pagina = await gerarPaginaImagem(anexo, item);

        pdf.addPage();
        adicionarCanvasAoPdf(pdf, pagina, "JPEG", 0.98, 0.5);
        liberarCanvas(pagina);
      }
    }

    return pdf.output("blob");
  } finally {
    node.remove();
  }
}
