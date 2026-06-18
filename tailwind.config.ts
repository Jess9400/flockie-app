import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        flockie: { blue: "#4A9FD4", orange: "#E8704E" },
        ink: "#1A1A1A",
        muted: "#6B7280",
        cream: "#FBF8F3",
      },
      fontFamily: { dm: ["var(--font-dm-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;
