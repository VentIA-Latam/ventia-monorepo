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
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-libre-franklin)", "sans-serif"],
        italic: ["var(--font-source-sans)", "sans-serif"],
      },
      colors: {
        ventia: {
          blue: "#182432", 
        },
      },
    },
  },
  plugins: [],
};

export default config;
