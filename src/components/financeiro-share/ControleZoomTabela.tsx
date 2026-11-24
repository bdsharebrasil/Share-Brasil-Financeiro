import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export const ZOOM_TABELA = [70, 80, 90, 100, 110, 125, 150];

export function useZoomTabela(chaveArmazenamento: string) {
  const [zoom, setZoom] = useState<number>(() => {
    const salvo = Number(window.localStorage.getItem(chaveArmazenamento));
    return ZOOM_TABELA.includes(salvo) ? salvo : 100;
  });

  function definir(novo: number) {
    setZoom(novo);
    window.localStorage.setItem(chaveArmazenamento, String(novo));
  }

  function alterar(passo: number) {
    const indice = ZOOM_TABELA.indexOf(zoom);
    definir(ZOOM_TABELA[Math.min(ZOOM_TABELA.length - 1, Math.max(0, indice + passo))]);
  }

  return { zoom, definir, alterar };
}

export function ControleZoomTabela({ zoom, alterar, restaurar }: {
  zoom: number;
  alterar: (passo: number) => void;
  restaurar: () => void;
}) {
  return (
    <div role="group" aria-label="Tamanho da tabela" style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button type="button" className="erp-btn erp-btn-icone" aria-label="Diminuir tabela" title="Diminuir tabela" disabled={zoom === ZOOM_TABELA[0]} onClick={() => alterar(-1)}>
        <ZoomOut size={17} aria-hidden="true" />
      </button>
      <button type="button" className="erp-btn erp-btn-texto" title="Restaurar tamanho padrão" aria-label="Restaurar tamanho padrão" onClick={restaurar} style={{ minWidth: 52 }}>
        {zoom}%
      </button>
      <button type="button" className="erp-btn erp-btn-icone" aria-label="Aumentar tabela" title="Aumentar tabela" disabled={zoom === ZOOM_TABELA[ZOOM_TABELA.length - 1]} onClick={() => alterar(1)}>
        <ZoomIn size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
