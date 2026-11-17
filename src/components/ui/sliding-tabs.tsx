import { useId, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export type SlidingTabItem = {
  value: string;
  content: ReactNode;
  disabled?: boolean;
  done?: boolean;
};

export function SlidingTabs({
  value,
  onValueChange,
  ariaLabel,
  items,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  items: SlidingTabItem[];
  className?: string;
}) {
  const pillId = `sliding-tabs-pill-${useId()}`;
  const reduzido = useReducedMotion();
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className={className}>
      <Tabs.List aria-label={ariaLabel} className="sliding-tabs">
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            data-done={item.done || undefined}
            className="sliding-tabs-trigger"
          >
            {item.value === value && (
              <motion.span
                aria-hidden="true"
                layoutId={pillId}
                className="sliding-tabs-pill"
                transition={{ duration: reduzido ? 0 : 0.22, ease: EASE_OUT }}
              />
            )}
            <span className="sliding-tabs-label">{item.content}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
