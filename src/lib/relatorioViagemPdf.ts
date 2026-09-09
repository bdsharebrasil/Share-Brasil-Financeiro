
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist";

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

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function numero(value: unknown): number {
  const resultado = Number(value);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}

function dinheiro(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero(value));
}

function numeroFormatado(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  if (!value) {
    return "—";
  }

  const partes = value
    .slice(0, 10)
    .split("-");

  if (partes.length !== 3) {
    return value;
  }

  const [ano, mes, dia] = partes;

  if (!ano || !mes || !dia) {
    return value;
  }

  return `${dia}/${mes}/${ano}`;
}

function calcularDias(
  inicio?: string | null,
  fim?: string | null,
): number {
  if (!inicio || !fim) {
    return 1;
  }

  const inicioMs = Date.parse(
    `${inicio}T00:00:00Z`,
  );

  const fimMs = Date.parse(
    `${fim}T00:00:00Z`,
  );

  if (
    !Number.isFinite(inicioMs) ||
    !Number.isFinite(fimMs) ||
    fimMs < inicioMs
  ) {
    return 1;
  }

  return (
    Math.floor(
      (fimMs - inicioMs) /
        86_400_000,
    ) + 1
  );
}

function normalizarPagador(
  value?: string | null,
): string {
  const normalizado = String(
    value ?? "",
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
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
      return value
        ? String(value).replace(
            /_/g,
            " ",
          )
        : "—";
  }
}

function categoriaNormalizada(
  value?: string | null,
): string {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

/* ============================================================================
 * TOTAIS
 * ========================================================================== */

function calcularTotaisCategoria(
  despesas: DespesaPdf[],
): Record<string, number> {
  const totais: Record<
    string,
    number
  > = {
    "Combustível": 0,
    Hospedagem: 0,
    Alimentação: 0,
    Transporte: 0,
    Outros: 0,
  };

  for (const despesa of despesas) {
    const categoria =
      categoriaNormalizada(
        despesa.categoria,
      );

    const valor = numero(
      despesa.valor,
    );

    if (
      categoria.includes(
        "combust",
      )
    ) {
      totais["Combustível"] +=
        valor;
    } else if (
      categoria.includes(
        "hosped",
      )
    ) {
      totais["Hospedagem"] +=
        valor;
    } else if (
      categoria.includes(
        "aliment",
      )
    ) {
      totais["Alimentação"] +=
        valor;
    } else if (
      categoria.includes(
        "transport",
      )
    ) {
      totais["Transporte"] +=
        valor;
    } else {
      totais["Outros"] +=
        valor;
    }
  }

  return totais;
}

function calcularTotaisPagador(
  despesas: DespesaPdf[],
): Record<string, number> {
  const totais: Record<
    string,
    number
  > = {
    "Tripulante 1": 0,
    "Tripulante 2": 0,
    Cliente: 0,
    "Share Brasil": 0,
  };

  for (const despesa of despesas) {
    const pagador =
      normalizarPagador(
        despesa.pago_por,
      );

    const valor = numero(
      despesa.valor,
    );

    if (
      totais[pagador] !==
      undefined
    ) {
      totais[pagador] +=
        valor;
    }
  }

  return totais;
}

/* ============================================================================
 * PÁGINA PRINCIPAL
 * ========================================================================== */

function montarHtmlRelatorio(
  report: RelatorioPdf,
  despesas: DespesaPdf[],
): HTMLDivElement {
  const node =
    document.createElement(
      "div",
    );

  const totalCalculado =
    despesas.reduce(
      (total, despesa) =>
        total +
        numero(despesa.valor),
      0,
    );

  const total =
    numero(
      report.total_valor,
    ) || totalCalculado;

  const dias =
    calcularDias(
      report.data_inicio,
      report.data_fim,
    );

  const totaisCategoria =
    calcularTotaisCategoria(
      despesas,
    );

  const totaisPagador =
    calcularTotaisPagador(
      despesas,
    );

  const rows =
    despesas
      .map(
        (item) => `
          <tr>
            <td>
              ${escapeHtml(
                item.categoria ||
                  "Outros",
              )}
            </td>

            <td>
              ${escapeHtml(
                dataBr(
                  item.data,
                ),
              )}
            </td>

            <td>
              ${escapeHtml(
                item.descricao ||
                  "Sem descrição",
              )}
            </td>

            <td class="valor">
              ${escapeHtml(
                dinheiro(
                  item.valor,
                ),
              )}
            </td>

            <td>
              ${escapeHtml(
                normalizarPagador(
                  item.pago_por,
                ),
              )}
            </td>
          </tr>
        `,
      )
      .join("");

  const categoriaCards =
    Object.entries(
      totaisCategoria,
    )
      .map(
        ([nome, valor]) => `
          <div class="summary-row">
            <span>${escapeHtml(
              nome,
            )}</span>

            <strong>
              ${escapeHtml(
                dinheiro(valor),
              )}
            </strong>
          </div>
        `,
      )
      .join("");

  const pagadorCards =
    Object.entries(
      totaisPagador,
    )
      .map(
        ([nome, valor]) => `
          <div class="summary-row">
            <span>${escapeHtml(
              nome,
            )}</span>

            <strong>
              ${escapeHtml(
                dinheiro(valor),
              )}
            </strong>
          </div>
        `,
      )
      .join("");

  const observacoes =
    report.observacoes?.trim();

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
      * {
        box-sizing: border-box;
      }

      .pdf-page {
        width: 794px;
        background: #ffffff;
        color: #1f2937;
        padding: 34px 38px;
        font-family:
          Arial,
          Helvetica,
          sans-serif;
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

      .info {
        margin-bottom: 20px;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px 24px;
      }

      .info-item {
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
        border-collapse: collapse;
        font-size: 10px;
      }

      th,
      td {
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

      .grand-total-value {
        color: #16a34a;
      }

      .observacoes {
        margin-top: 19px;
        page-break-inside: avoid;
      }

      .observacoes-box {
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

        <img
          class="logo"
          src="/logo.share.png"
          alt="Share Brasil"
        />

        <div class="title">
          Relatório de Despesa de Viagem
        </div>

        <div class="number">
          ${escapeHtml(
            report.numero_relatorio ||
              "N/A",
          )}
        </div>

      </div>

      <div class="info">
        <div class="info-grid">

          <div class="info-item">
            <span class="info-label">
              Cliente:
            </span>
            ${escapeHtml(
              report.cliente_nome ||
                "N/A",
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Aeronave:
            </span>
            ${escapeHtml(
              report.aeronave_matricula ||
                "N/A",
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Voo:
            </span>
            ${escapeHtml(
              report.numero_voo ||
                "Não informado",
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Período:
            </span>
            ${escapeHtml(
              `${dataBr(
                report.data_inicio,
              )} a ${dataBr(
                report.data_fim,
              )} (${dias} ${
                dias === 1
                  ? "dia"
                  : "dias"
              })`,
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Tripulante 1:
            </span>
            ${escapeHtml(
              report.nome_tripulante ||
                "N/A",
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Tripulante 2:
            </span>
            ${escapeHtml(
              report.nome_tripulante_2 ||
                "Não informado",
            )}
          </div>

          <div class="info-item">
            <span class="info-label">
              Trecho:
            </span>
            ${escapeHtml(
              report.rota ||
                "N/A",
            )}
          </div>

        </div>
      </div>

      <div class="section-title">
        Relação das Despesas
      </div>

      <table>
        <thead>
          <tr>
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
            `
              <tr>
                <td colspan="5">
                  Nenhuma despesa lançada.
                </td>
              </tr>
            `
          }
        </tbody>
      </table>

      <div class="summary">

        <div class="summary-card">

          <div class="summary-card-title">
            Total por categoria
          </div>

          ${categoriaCards}

        </div>

        <div class="summary-card">

          <div class="summary-card-title">
            Total por pagador
          </div>

          ${pagadorCards}

        </div>

      </div>

      <div class="grand-total">
        <span>
          Total das despesas
        </span>

        <span class="grand-total-value">
          ${escapeHtml(
            dinheiro(total),
          )}
        </span>
      </div>

      ${
        observacoes
          ? `
            <div class="observacoes">

              <div class="section-title">
                Observações
              </div>

              <div class="observacoes-box">
                ${escapeHtml(
                  observacoes,
                )}
              </div>

            </div>
          `
          : ""
      }

      <div class="footer">
        Share Brasil · Relatório gerado em
        ${new Date().toLocaleDateString(
          "pt-BR",
        )}
      </div>

    </div>
  `;

  return node;
}

/* ============================================================================
 * COMPROVANTE - BASE
 * ========================================================================== */

function criarCanvasComprovante(
  indice: number,
  anexo: AnexoPdf,
  despesa?: DespesaPdf,
  paginaAtual?: number,
  totalPaginas?: number,
): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width = 794;
  canvas.height = 1123;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Não foi possível preparar o comprovante.",
    );
  }

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  /* --------------------------------------------------------------------------
   * CABEÇALHO
   * ------------------------------------------------------------------------ */

  context.fillStyle =
    "#1e3a8a";

  context.font =
    "bold 22px Arial";

  context.fillText(
    "Comprovante Anexado",
    38,
    45,
  );

  context.fillStyle =
    "#555555";

  context.font =
    "12px Arial";

  context.fillText(
    `Item Nº ${indice + 1}`,
    38,
    69,
  );

  context.fillText(
    `Arquivo: ${anexo.nome_arquivo}`,
    38,
    88,
  );

  if (
    paginaAtual !==
      undefined &&
    totalPaginas !==
      undefined
  ) {
    context.fillText(
      `Página ${paginaAtual} de ${totalPaginas}`,
      570,
      69,
    );
  }

  context.strokeStyle =
    "#22c55e";

  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(38, 105);
  context.lineTo(756, 105);
  context.stroke();

  /* --------------------------------------------------------------------------
   * INFORMAÇÕES
   * ------------------------------------------------------------------------ */

  const inicioY = 135;

  context.fillStyle =
    "#1e3a8a";

  context.font =
    "bold 12px Arial";

  context.fillText(
    "Descrição",
    38,
    inicioY,
  );

  context.fillText(
    "Categoria",
    300,
    inicioY,
  );

  context.fillText(
    "Data",
    530,
    inicioY,
  );

  context.fillStyle =
    "#333333";

  context.font =
    "12px Arial";

  context.fillText(
    despesa?.descricao ||
      "Sem descrição",
    38,
    inicioY + 20,
  );

  context.fillText(
    despesa?.categoria ||
      "Outros",
    300,
    inicioY + 20,
  );

  context.fillText(
    dataBr(
      despesa?.data,
    ),
    530,
    inicioY + 20,
  );

  context.fillStyle =
    "#1e3a8a";

  context.font =
    "bold 12px Arial";

  context.fillText(
    "Valor",
    38,
    inicioY + 60,
  );

  context.fillText(
    "Pago por",
    300,
    inicioY + 60,
  );

  context.fillStyle =
    "#333333";

  context.font =
    "12px Arial";

  context.fillText(
    dinheiro(
      despesa?.valor,
    ),
    38,
    inicioY + 80,
  );

  context.fillText(
    normalizarPagador(
      despesa?.pago_por,
    ),
    300,
    inicioY + 80,
  );

  /* --------------------------------------------------------------------------
   * ÁREA DO COMPROVANTE
   * ------------------------------------------------------------------------ */

  context.strokeStyle =
    "#d1d5db";

  context.lineWidth = 1;

  context.strokeRect(
    38,
    245,
    718,
    760,
  );

  return {
    canvas,
    context,
  };
}

/* ============================================================================
 * COMPROVANTE - IMAGEM
 * ========================================================================== */

async function gerarPaginaImagem(
  anexo: AnexoPdf,
  indice: number,
  despesa?: DespesaPdf,
): Promise<HTMLCanvasElement> {
  const {
    canvas,
    context,
  } =
    criarCanvasComprovante(
      indice,
      anexo,
      despesa,
    );

  const url =
    URL.createObjectURL(
      anexo.arquivo,
    );

  try {
    const imagem =
      await new Promise<HTMLImageElement>(
        (
          resolve,
          reject,
        ) => {
          const elemento =
            new Image();

          elemento.onload = () =>
            resolve(
              elemento,
            );

          elemento.onerror =
            () =>
              reject(
                new Error(
                  "Não foi possível carregar a imagem do comprovante.",
                ),
              );

          elemento.src = url;
        },
      );

    const larguraOriginal =
      imagem.naturalWidth ||
      imagem.width;

    const alturaOriginal =
      imagem.naturalHeight ||
      imagem.height;

    if (
      larguraOriginal <= 0 ||
      alturaOriginal <= 0
    ) {
      throw new Error(
        "O comprovante possui dimensões inválidas.",
      );
    }

    const larguraMaxima =
      680;

    const alturaMaxima =
      720;

    const escala =
      Math.min(
        larguraMaxima /
          larguraOriginal,
        alturaMaxima /
          alturaOriginal,
        1,
      );

    const largura =
      larguraOriginal *
      escala;

    const altura =
      alturaOriginal *
      escala;

    const x =
      (canvas.width -
        largura) /
      2;

    const y =
      245 +
      (760 - altura) /
        2;

    context.drawImage(
      imagem,
      x,
      y,
      largura,
      altura,
    );

    return canvas;
  } finally {
    URL.revokeObjectURL(
      url,
    );
  }
}

/* ============================================================================
 * COMPROVANTE - PDF
 * ========================================================================== */

async function gerarPaginasPdf(
  anexo: AnexoPdf,
  indice: number,
  despesa?: DespesaPdf,
): Promise<HTMLCanvasElement[]> {
  GlobalWorkerOptions.workerSrc =
    "/pdf.worker.mjs";

  const buffer =
    await anexo.arquivo.arrayBuffer();

  const documento =
    await getDocument({
      data: new Uint8Array(
        buffer,
      ),
    }).promise;

  const paginas: HTMLCanvasElement[] =
    [];

  try {
    for (
      let paginaNumero = 1;
      paginaNumero <=
      documento.numPages;
      paginaNumero += 1
    ) {
      const pagina =
        await documento.getPage(
          paginaNumero,
        );

      const viewport =
        pagina.getViewport({
          scale: 1.5,
        });

      const origem =
        document.createElement(
          "canvas",
        );

      origem.width =
        Math.ceil(
          viewport.width,
        );

      origem.height =
        Math.ceil(
          viewport.height,
        );

      const origemContext =
        origem.getContext("2d");

      if (!origemContext) {
        throw new Error(
          "Não foi possível preparar a página do PDF.",
        );
      }

      await pagina.render({
        canvasContext:
          origemContext,
        viewport,
      }).promise;

      const {
        canvas,
        context,
      } =
        criarCanvasComprovante(
          indice,
          anexo,
          despesa,
          paginaNumero,
          documento.numPages,
        );

      const larguraMaxima =
        680;

      const alturaMaxima =
        720;

      const escala =
        Math.min(
          larguraMaxima /
            origem.width,
          alturaMaxima /
            origem.height,
          1,
        );

      const largura =
        origem.width *
        escala;

      const altura =
        origem.height *
        escala;

      context.drawImage(
        origem,
        (canvas.width -
          largura) /
          2,
        245 +
          (760 - altura) /
            2,
        largura,
        altura,
      );

      paginas.push(canvas);
    }

    return paginas;
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
): void {
  const pageWidth = 210;
  const pageHeight = 297;

  const imagem =
    canvas.toDataURL(
      "image/jpeg",
      0.96,
    );

  const proporcao =
    pageWidth / canvas.width;

  const altura =
    canvas.height *
    proporcao;

  /*
   * Normalmente os comprovantes têm exatamente 1123px,
   * portanto ocupam uma página A4 inteira.
   */
  if (
    altura <=
    pageHeight + 0.5
  ) {
    pdf.addImage(
      imagem,
      "JPEG",
      0,
      0,
      pageWidth,
      altura,
    );

    return;
  }

  /*
   * Caso uma página seja maior que A4,
   * ela será dividida sem gerar uma página vazia.
   */
  let offset = 0;

  while (
    offset <
    altura - 0.5
  ) {
    if (offset > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imagem,
      "JPEG",
      0,
      -offset,
      pageWidth,
      altura,
    );

    offset +=
      pageHeight;
  }
}

/* ============================================================================
 * PDF PRINCIPAL
 * ========================================================================== */

export async function gerarPdfRelatorioViagem(
  report: RelatorioPdf,
): Promise<Blob> {
  const despesas =
    Array.isArray(
      report.despesas,
    )
      ? report.despesas
      : [];

  const anexos =
    Array.isArray(
      report.anexos,
    )
      ? report.anexos
      : [];

  const node =
    montarHtmlRelatorio(
      report,
      despesas,
    );

  document.body.appendChild(
    node,
  );

  try {
    /*
     * Aguarda o navegador terminar
     * de montar o conteúdo.
     */
    await new Promise<void>(
      (resolve) => {
        requestAnimationFrame(
          () => resolve(),
        );
      },
    );

    /*
     * Aguarda a logo carregar.
     */
    const imagens =
      Array.from(
        node.querySelectorAll(
          "img",
        ),
      );

    await Promise.all(
      imagens.map(
        async (imagem) => {
          if (
            imagem.complete
          ) {
            return;
          }

          await new Promise<void>(
            (resolve) => {
              imagem.addEventListener(
                "load",
                () => resolve(),
                {
                  once: true,
                },
              );

              imagem.addEventListener(
                "error",
                () => resolve(),
                {
                  once: true,
                },
              );
            },
          );
        },
      ),
    );

    const canvas =
      await html2canvas(
        node,
        {
          scale: 2,
          useCORS: true,
          backgroundColor:
            "#ffffff",
          logging: false,
          imageTimeout: 15000,
        },
      );

    const pdf =
      new jsPDF({
        unit: "mm",
        format: "a4",
        orientation:
          "portrait",
      });

    /*
     * O conteúdo principal é colocado
     * começando na primeira página.
     */
    adicionarCanvasPrincipal(
      pdf,
      canvas,
    );

    /*
     * Cada comprovante começa
     * obrigatoriamente em uma nova página.
     */
    for (const anexo of anexos) {
      const indice = Math.max(
        0,
        Number(
          anexo.indice_despesa,
        ) || 0,
      );

      const despesa =
        despesas[indice];

      const ehPdf =
        Boolean(
          anexo.tipo_arquivo
            ?.toLowerCase()
            .includes("pdf"),
        ) ||
        anexo.nome_arquivo
          .toLowerCase()
          .endsWith(".pdf");

      if (ehPdf) {
        const paginas =
          await gerarPaginasPdf(
            anexo,
            indice,
            despesa,
          );

        for (
          const pagina of paginas
        ) {
          pdf.addPage();

          adicionarCanvasAoPdf(
            pdf,
            pagina,
          );
        }
      } else {
        const pagina =
          await gerarPaginaImagem(
            anexo,
            indice,
            despesa,
          );

        pdf.addPage();

        adicionarCanvasAoPdf(
          pdf,
          pagina,
        );
      }
    }

    return pdf.output(
      "blob",
    );
  } finally {
    node.remove();
  }
}

/* ============================================================================
 * PDF PRINCIPAL
 * ========================================================================== */

function adicionarCanvasPrincipal(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
): void {
  const pageWidth = 210;
  const pageHeight = 297;

  const imagem =
    canvas.toDataURL(
      "image/jpeg",
      0.98,
    );

  const proporcao =
    pageWidth / canvas.width;

  const altura =
    canvas.height *
    proporcao;

  /*
   * O ponto importante aqui:
   *
   * Se o conteúdo couber em uma página,
   * ele NÃO cria uma segunda página.
   *
   * Isso elimina a página branca que
   * acontecia por diferenças de poucos
   * pixels entre 1123px e A4.
   */
  if (
    altura <=
    pageHeight + 1
  ) {
    pdf.addImage(
      imagem,
      "JPEG",
      0,
      0,
      pageWidth,
      altura,
    );

    return;
  }

  /*
   * Para relatórios maiores,
   * divide o conteúdo verticalmente.
   */
  let offset = 0;

  while (
    offset <
    altura - 1
  ) {
    if (offset > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imagem,
      "JPEG",
      0,
      -offset,
      pageWidth,
      altura,
    );

    offset +=
      pageHeight;
  }
}

