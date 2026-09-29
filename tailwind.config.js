/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'system-ui', 'sans-serif'],
        animation: {
          blob: "blob 7s infinite",
        },
      keyframes: {
      blob: {
      "0%": { transform: "translate(0px, 0px) scale(1)" },
      "33%": { transform: "translate(30px, -50px) scale(1.1)" },
      "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
      "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        },
      },
      colors: {
        primary: {
          DEFAULT: "hsl(192, 85%, 50%)",
          hover: "hsl(192, 85%, 60%)",
          light: "hsl(192, 80%, 92%)",
          dark: "hsl(192, 85%, 40%)",
        },
        secondary: "hsl(205, 15%, 45%)",
        background: "hsl(210, 25%, 97%)",
        surface: "hsl(0, 0%, 100%)",
        accent: {
          green: "hsl(160, 72%, 42%)",
          purple: "hsl(270, 75%, 62%)",
          amber: "hsl(35, 92%, 55%)",
        },
      },
      borderRadius: {
        container: "1.5rem",
        xl: "1rem",
        '2xl': "1.5rem",
      },
      boxShadow: {
        DEFAULT: "0 4px 12px rgba(0, 0, 0, 0.08)",
        md: "0 8px 16px rgba(0, 0, 0, 0.1)",
        lg: "0 12px 24px rgba(0, 0, 0, 0.12)",
        inner: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
      },
      backdropBlur: {
        xl: "20px",
      },
      gap: {
        section: "3rem",
      },
    },
  },
  plugins: [],
};
