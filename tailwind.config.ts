import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#0F172A",
          panel: "#1E293B",
          panelSoft: "#23314A",
          border: "#334155",
          primary: "#3B82F6",
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          text: "#E5EEF9",
          muted: "#94A3B8",
        },
      },
      boxShadow: {
        premium: "0 24px 70px rgba(2, 6, 23, 0.38)",
        glow: "0 0 0 1px rgba(59, 130, 246, 0.18), 0 18px 48px rgba(15, 23, 42, 0.38)",
      },
      animation: {
        "fade-up": "fadeUp 0.42s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
