import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { analisarTextoHolerite, type HoleriteLido } from './holerite-parser'

export async function lerHoleritePdf(arquivo: Blob): Promise<HoleriteLido | null> {
  GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
  const documento = await getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise
  try {
    const paginas: string[] = []
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero)
      const conteudo = await pagina.getTextContent()
      const itens = conteudo.items as Array<{ str?: string; hasEOL?: boolean }>
      paginas.push(itens.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join(''))
    }
    return analisarTextoHolerite(paginas.join('\n'))
  } finally {
    await documento.destroy()
  }
}
