import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // MarketHub brand — trustworthy teal, distinct from typical marketplace orange/yellow
        brand: {
          50: "#effcf9",
          100: "#c9f6ec",
          200: "#94edd9",
          300: "#57dac0",
          400: "#28bfa5",
          500: "#0fa38b",
          600: "#0a8271",
          700: "#0b685c",
          800: "#0d534a",
          900: "#0d443e",
        },
        accent: {
          400: "#ffb020",
          500: "#f59a00",
          600: "#d67f00",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
