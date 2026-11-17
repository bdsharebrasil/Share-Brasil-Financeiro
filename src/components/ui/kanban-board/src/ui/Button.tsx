import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
/** sm 32 px, md 36 px, lg 40 px. icon and icon-sm are square; give them an aria-label. */
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-subtle text-ink hover:bg-active",
  outline: "border border-line bg-surface text-ink hover:bg-hover",
  ghost: "bg-transparent text-muted hover:bg-hover hover:text-ink",
  danger: "bg-danger text-danger-fg hover:opacity-90",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-[15px]",
  icon: "size-9 [&>svg]:size-[18px]",
  "icon-sm": "size-7 rounded-[8px] [&>svg]:size-4",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
};

/** The one button. Native <button>, visible focus ring, pressed scale off with reduced motion. */
export function Button({ variant = "secondary", size = "md", className, type = "button", ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none",
        "transition-[background-color,color,opacity,transform] duration-120 ease-ui-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100",
        "[&>svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
