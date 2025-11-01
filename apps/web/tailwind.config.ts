import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f6f8ff",
          100: "#e7ecff",
          200: "#c9d4ff",
          300: "#a9bbff",
          400: "#889fff",
          500: "#6f86f7",
          600: "#5566d6",
          700: "#424fb0",
          800: "#323c87",
          900: "#262d67",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, .08)",
      },
    },
  },
  plugins: [animate],
};

export default config;
