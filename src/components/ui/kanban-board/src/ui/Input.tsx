import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/** Field outline: --ui-border-input (3:1), accent ring on focus. */
export const FIELD =
  "w-full rounded-control border border-input bg-surface text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-120 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ui-accent)_22%,transparent)] focus-visible:outline-none";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD, "h-9 px-3 text-sm", className)} {...props} />;
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(FIELD, "min-h-20 resize-none px-3 py-2 text-sm leading-6", className)} {...props} />;
}
