import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "sans-serif"],
        heading: ["var(--font-libre-franklin)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
        italic: ["var(--font-source-sans)", "sans-serif"],
      },
      colors: {
        ventia: {
          volt: "#2F7CF4",
          aqua: "#5ACAF0",
          marino: "#184373",
          cielo: "#C8ECFD",
          luma: "#9EBEFA",
          noche: "#182432",
          blue: "#182432",
        },
      },
    },
  },
  plugins: [],
};

export default config;
