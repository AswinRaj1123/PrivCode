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
          bg:        "#0d1117",
          surface:   "#161b22",
          raised:    "#1c2128",
          elevated:  "#21262d",
          hover:     "#292e36",
          border:    "#30363d",
          "border-muted": "#21262d",
          text:      "#e6edf3",
          secondary: "#8b949e",
          muted:     "#6e7681",
          accent:    "#58a6ff",
          "accent-hover": "#79c0ff",
          success:   "#3fb950",
          warning:   "#d29922",
          danger:    "#f85149",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "'Cascadia Code'", "'SF Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
