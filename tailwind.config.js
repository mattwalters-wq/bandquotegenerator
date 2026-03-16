/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        dark: { bg: "#0f172a", card: "#1a1a2e", table: "#16213e", tableAlt: "#0f3460", input: "#1e293b" },
        accent: "#e94560",
      },
    },
  },
  plugins: [],
};
