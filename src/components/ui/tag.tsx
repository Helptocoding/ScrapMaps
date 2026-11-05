import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Etiquetas. Regla única: **fondo = clickeable**.
 *
 *  - `Tag variant="dot"`   → punto + texto. Estado (completada, fallida…).
 *  - `Tag variant="plain"` → solo texto. Metadato inerte (categoría en la fila).
 *  - `Chip`                → pill con fondo. Siempre es un botón.
 */

type TagVariant = "dot" | "plain";
type TagTone = "neutral" | "signal" | "accent" | "danger" | "muted";

const TONE_TEXT: Record<TagTone, string> = {
  neutral: "text-ink",
  signal: "text-signal",
  accent: "text-accent",
  danger: "text-danger",
  muted: "text-ink-3",
};

const TONE_DOT: Record<TagTone, string> = {
  neutral: "bg-ink",
  signal: "bg-signal",
  accent: "bg-accent",
  danger: "bg-danger",
  muted: "bg-ink-3",
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  tone?: TagTone;
}

export function Tag({ variant = "dot", tone = "neutral", className, children, ...props }: TagProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-small", TONE_TEXT[tone], className)}
      {...props}
    >
      {variant === "dot" ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}

export const Chip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center rounded border border-line bg-canvas px-2 py-1 text-small text-ink-2",
        "transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink",
        "disabled:opacity-50 disabled:hover:bg-canvas",
        className,
      )}
      {...props}
    />
  ),
);
Chip.displayName = "Chip";

/** Label micro en mayúsculas. Encabezados de columna, labels de campo, secciones. */
export function MicroLabel({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-micro uppercase text-ink-3", className)} {...props}>
      {children}
    </span>
  );
}
