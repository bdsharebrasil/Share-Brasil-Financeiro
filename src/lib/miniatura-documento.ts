// Renderiza somente a primeira página, localmente, sem enviar documentos a terceiros.
let tarefasAtivas = 0;
const fila: Array<() => void> = [];
async function vaga() {
  if (tarefasAtivas >= 2)
    await new Promise<void>((resolve) => fila.push(resolve));
  else tarefasAtivas++;
}
function liberar() {
  const proxima = fila.shift();
  if (proxima) proxima();
  else tarefasAtivas--;
}
export async function criarMiniaturaPdf(blob: Blob): Promise<string> {
  await vaga();
  let tarefa: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  try {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    tarefa = pdfjs.getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
      isEvalSupported: false,
    });
    const documento = await tarefa.promise;
    const pagina = await documento.getPage(1);
    const original = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({
      scale: Math.min(320 / original.width, 400 / original.height),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) throw new Error("miniatura_indisponivel");
    await pagina.render({
      canvasContext,
      canvas,
      viewport,
      background: "rgb(255,255,255)",
    }).promise;
    return canvas.toDataURL("image/png");
  } finally {
    try {
      await tarefa?.destroy();
    } finally {
      liberar();
    }
  }
}
