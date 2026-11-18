import { useRef, type DragEvent, type ReactNode } from "react";
import { GripVertical, MoveDown, MoveUp } from "lucide-react";

type ItemIdentificado = { id: string };

type DragReorderProps<T extends ItemIdentificado> = {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: (item: T) => string;
  ariaLabel: string;
  disabled?: boolean;
};

function mover<T>(items: T[], origem: number, destino: number) {
  if (origem < 0 || destino < 0 || origem >= items.length || destino >= items.length || origem === destino) return items;
  const proxima = [...items];
  const [item] = proxima.splice(origem, 1);
  proxima.splice(destino, 0, item);
  return proxima;
}

/** Reordenação por arrastar, com botões de movimento equivalentes para toque e teclado. */
export default function DragReorder<T extends ItemIdentificado>({
  items,
  onReorder,
  renderItem,
  label,
  ariaLabel,
  disabled = false,
}: DragReorderProps<T>) {
  const arrastando = useRef<number | null>(null);

  const iniciarArraste = (event: DragEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    arrastando.current = index;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const soltar = (event: DragEvent<HTMLDivElement>, destino: number) => {
    event.preventDefault();
    const origem = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(origem) || origem === destino) return;
    onReorder(mover(items, origem, destino));
    arrastando.current = null;
  };

  return (
    <div className="pv-reorder" role="list" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="pv-reorder-linha"
          role="listitem"
          onDragOver={(event) => {
            if (arrastando.current !== null) event.preventDefault();
          }}
          onDrop={(event) => soltar(event, index)}
        >
          <button
            type="button"
            className="pv-reorder-alca"
            draggable={!disabled}
            disabled={disabled}
            aria-label={`Arrastar para reordenar: ${label(item)}`}
            title="Arraste para mudar a ordem"
            onDragStart={(event) => iniciarArraste(event, index)}
            onDragEnd={() => { arrastando.current = null; }}
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
          <div className="pv-reorder-conteudo">{renderItem(item, index)}</div>
          <div className="pv-reorder-controles" aria-label={`Posição ${index + 1} de ${items.length}`}>
            <button type="button" disabled={disabled || index === 0} aria-label={`Mover ${label(item)} para cima`} title="Mover para cima" onClick={() => onReorder(mover(items, index, index - 1))}>
              <MoveUp size={15} aria-hidden="true" />
            </button>
            <button type="button" disabled={disabled || index === items.length - 1} aria-label={`Mover ${label(item)} para baixo`} title="Mover para baixo" onClick={() => onReorder(mover(items, index, index + 1))}>
              <MoveDown size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
