// Cores HSL com suporte a modificadores de opacidade (bg-background/50, border-primary/30...)
const hsl = (variavel) => `hsl(var(--${variavel}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: hsl("background"),
        foreground: hsl("foreground"),
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        card: {
          DEFAULT: hsl("card"),
          foreground: hsl("card-foreground"),
          border: hsl("card-border"),
        },
        popover: {
          DEFAULT: hsl("popover"),
          foreground: hsl("popover-foreground"),
          border: hsl("popover-border"),
        },
        primary: {
          DEFAULT: hsl("primary"),
          foreground: hsl("primary-foreground"),
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: hsl("secondary"),
          foreground: hsl("secondary-foreground"),
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: hsl("muted"),
          foreground: hsl("muted-foreground"),
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: hsl("accent"),
          foreground: hsl("accent-foreground"),
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: hsl("destructive"),
          foreground: hsl("destructive-foreground"),
          border: "var(--destructive-border)",
        },
        sidebar: {
          DEFAULT: hsl("sidebar"),
          foreground: hsl("sidebar-foreground"),
          border: hsl("sidebar-border"),
          primary: hsl("sidebar-primary"),
          "primary-foreground": hsl("sidebar-primary-foreground"),
          accent: hsl("sidebar-accent"),
          "accent-foreground": hsl("sidebar-accent-foreground"),
          ring: hsl("sidebar-ring"),
        },
      },
      fontFamily: {
        sans: ["var(--app-font-sans)"],
        mono: ["var(--app-font-mono)"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
    },
  },
  plugins: [],
};
