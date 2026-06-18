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
      },
      fontFamily: { dm: ["var(--font-dm-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;
