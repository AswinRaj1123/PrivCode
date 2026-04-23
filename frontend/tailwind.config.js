/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PrivCode design tokens
        pc: {
          bg: "rgb(var(--pc-bg) / <alpha-value>)",
          surface: "rgb(var(--pc-surface) / <alpha-value>)",
          raised: "rgb(var(--pc-raised) / <alpha-value>)",
          elevated: "rgb(var(--pc-elevated) / <alpha-value>)",
          hover: "rgb(var(--pc-hover) / <alpha-value>)",
          border: "rgb(var(--pc-border) / <alpha-value>)",
          "border-muted": "rgb(var(--pc-border-muted) / <alpha-value>)",
          text: "rgb(var(--pc-text) / <alpha-value>)",
          secondary: "rgb(var(--pc-secondary) / <alpha-value>)",
          muted: "rgb(var(--pc-muted) / <alpha-value>)",
          accent: "rgb(var(--pc-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--pc-accent-hover) / <alpha-value>)",
          success: "rgb(var(--pc-success) / <alpha-value>)",
          warning: "rgb(var(--pc-warning) / <alpha-value>)",
          danger: "rgb(var(--pc-danger) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "'Cascadia Code'", "'SF Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
