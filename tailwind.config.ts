import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#143D30",
          fg: "#FFFFFF",
        },
        secondary: "#84CC16",
        accent: "#6EE7B7",
        surface: {
          DEFAULT: "#FFFFFF",
          elevated: "#F1F5F9",
        },
        bg: {
          light: "#F8FAFC",
          dark: "#0F172A",
        },
        border: "#E2E8F0",
        muted: "#64748B",
        body: "#1E293B",
        warning: {
          DEFAULT: "#F59E0B",
          fg: "#92400E",
        },
        error: "#E11D48",
        // Reserved maximum-visibility accent — Save/Follow search only. See brand rule §6.
        gold: {
          DEFAULT: "#FFD700",
          hover: "#F0CC00",
          active: "#E6C200",
          edge: "#C9A600",
          "edge-hover": "#B89600",
          fg: "#3A2F08",
          ring: "#065F46",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
