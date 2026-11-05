import type { Config } from "tailwindcss";

/**
 * Design system data-first.
 *
 * La app es una herramienta, no una landing: densidad alta, líneas visibles,
 * cero decoración. El color no es marca, es función:
 *
 *   accent (azul)   → interacción: foco, selección, orden activo, acción primaria
 *   signal (naranja)→ el dato que vende el producto: negocio SIN sitio web
 *   neutros         → absolutamente todo lo demás
 *
 * Si un elemento no es clickeable y no es una oportunidad, es gris. Sin excepciones.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        wide: "1024px",
      },

      colors: {
        // ── Superficies (neutros fríos) ────────────────────────
        canvas: "#FFFFFF",
        panel: "#FAFAFA",
        "panel-2": "#F4F4F5",

        // ── Líneas: visibles a propósito. Una grilla densa necesita
        //    estructura, no aire. ──────────────────────────────
        line: {
          DEFAULT: "#E4E4E7",
          strong: "#D4D4D8",
        },

        // ── Texto (contraste verificado sobre #FFFFFF) ─────────
        ink: {
          DEFAULT: "#18181B", // 16.8:1
          2: "#52525B", //  7.6:1
          3: "#6E6E78", //  4.9:1
        },

        // ── Interacción ────────────────────────────────────────
        accent: {
          DEFAULT: "#2563EB", // 5.2:1
          hover: "#1D4ED8",
          soft: "#EFF6FF",
          foreground: "#FFFFFF",
        },

        // ── Oportunidad: sin sitio web ─────────────────────────
        signal: {
          DEFAULT: "#C2410C", // 5.9:1
          soft: "#FFF7ED",
        },

        danger: {
          DEFAULT: "#B91C1C",
          soft: "#FEF2F2",
        },

        // ── Aliases shadcn (command / popover / button) ─────────
        background: "#FFFFFF",
        foreground: "#18181B",
        border: "#E4E4E7",
        input: "#E4E4E7",
        ring: "#2563EB",
        popover: "#FFFFFF",
        "popover-foreground": "#18181B",
        primary: { DEFAULT: "#18181B", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F4F4F5", foreground: "#18181B" },
        muted: { DEFAULT: "#F4F4F5", foreground: "#6E6E78" },
        destructive: { DEFAULT: "#B91C1C", foreground: "#FFFFFF" },
      },

      /**
       * Escala compacta. Base 13px: en una herramienta densa el body de 15-17px
       * desperdicia filas. La jerarquía sigue cayendo por peso Y tamaño.
       */
      fontSize: {
        title: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "600" }],
        heading: ["0.9375rem", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],
        subtitle: ["0.875rem", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "500" }],
        body: ["0.8125rem", { lineHeight: "1.45", letterSpacing: "0", fontWeight: "400" }],
        small: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "400" }],
        micro: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.05em", fontWeight: "500" }],
        // Números de KPI: grandes pero no editoriales.
        metric: ["1.375rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
      },

      fontFamily: {
        sans: ["var(--font-ui)", "Manrope", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },

      spacing: {
        // Alturas fijas del chrome. La app ocupa el viewport completo.
        toolbar: "3.25rem",
        statsbar: "2.5rem",
        row: "2.25rem",
      },

      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },

      /** Sombras solo en cosas que flotan: popovers, drawers, tooltips. */
      boxShadow: {
        pop: "0 4px 12px rgba(24,24,27,0.08), 0 1px 3px rgba(24,24,27,0.06)",
        drawer: "0 0 0 1px rgba(24,24,27,0.06), -8px 0 32px rgba(24,24,27,0.10)",
      },

      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in-right": "slide-in-right 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-down": "slide-down 160ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
