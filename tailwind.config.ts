import type { Config } from "tailwindcss";

// Brand tokens mirror /Users/ms/git/pinka-finance/landing/tailwind.config.ts so
// the app and the marketing site stay visually identical. Keep in sync.
const config: Config = {
  darkMode: ["class"],
  // lib/ contains JSX too (auth.tsx SignIn/VerifiedGate) — without it here its
  // classes get purged and e.g. the login card renders full-width (no max-w-md).
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "2rem", lg: "3rem", xl: "4rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      opacity: {
        "3": "0.03", "4": "0.04", "6": "0.06", "8": "0.08",
        "12": "0.12", "15": "0.15", "18": "0.18", "85": "0.85",
      },
      colors: {
        cream: "#FBF8F3",
        sand: "#F5EFE6",
        sandDeep: "#F0E6D2",
        ink: "#1A1A1A",
        inkSoft: "#3A3A3A",
        inkMuted: "#6B6B6B",
        coral: {
          DEFAULT: "#E85D5D",
          50: "#FDEEEE",
          100: "#FBDADA",
          200: "#F6B5B5",
          300: "#F08F8F",
          400: "#EC7575",
          500: "#E85D5D",
          600: "#D14545",
          700: "#A93535",
          800: "#812828",
          900: "#591B1B",
        },
        teal: {
          DEFAULT: "#0F4C5C",
          50: "#E6EEF1",
          100: "#C0D3DA",
          200: "#92B2BD",
          300: "#6491A0",
          400: "#3F7888",
          500: "#0F4C5C",
          600: "#0C3D4A",
          700: "#092E37",
          800: "#061F25",
          900: "#031012",
        },
        forest: "#2D6A4F",
        rust: "#9B2226",
        border: "rgba(26, 26, 26, 0.12)",
        ring: "#0F4C5C",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 5.5vw + 1rem, 4.75rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2rem, 4vw + 0.75rem, 3.5rem)", { lineHeight: "1.08", letterSpacing: "-0.015em" }],
        "display-md": ["clamp(1.625rem, 2.5vw + 0.75rem, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
      },
      maxWidth: { content: "1200px", hero: "1280px" },
      borderRadius: { lg: "16px", md: "12px", sm: "8px" },
      boxShadow: {
        soft: "0 1px 2px rgba(26,26,26,0.04), 0 4px 14px rgba(26,26,26,0.06)",
        lift: "0 4px 12px rgba(26,26,26,0.06), 0 16px 40px rgba(26,26,26,0.10)",
        coral: "0 8px 24px rgba(232, 93, 93, 0.30)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-in": "fade-in 0.4s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
