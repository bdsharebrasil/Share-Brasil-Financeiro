import type { ButtonHTMLAttributes, Ref } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
/** "icon" is a square button for a single icon; give it an aria-label. */
export type ButtonSize = "default" | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-secondary text-ink hover:bg-secondary-hover",
  ghost: "bg-transparent text-ink hover:bg-sunken",
};

const SIZE: Record<ButtonSize, string> = {
  default: "px-4",
  icon: "w-10 px-0 pointer-coarse:w-11 [&>svg]:shrink-0",
};

/** Real button used by the components and the demo page. 40 px tall, 44 px on touch screens. */
export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ref,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-10 items-center whitespace-nowrap justify-center gap-2 rounded-control text-[15px] font-medium transition-[background-color,transform] duration-120 ease-kit-out select-none active:scale-[0.98] disabled:opacity-50 pointer-coarse:h-11 motion-reduce:transition-none motion-reduce:active:scale-100 ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
