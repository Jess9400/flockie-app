import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        flockie: { blue: "#4DA8DA", coral: "#FF6B4A", orange: "#FF6B4A" },
        navy: "#0A2545",
        ink: "#0A2545",
        muted: "#5b6b7d",
        cream: "#F7F3EE",
        "onboarding-green": "#1A8C6A",
      },
      fontFamily: {
        // One font across the whole site (Nunito). `fredoka` and `dm` are kept
        // as aliases pointing at Nunito so existing classes don't need rewriting.
        dm: ["var(--font-nunito)", "system-ui", "sans-serif"],
        fredoka: ["var(--font-nunito)", "system-ui", "sans-serif"],
        nunito: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
