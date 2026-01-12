/** @type {import('tailwindcss').Config} */
export default {
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
          DEFAULT: "hsl(210, 80%, 55%)",
          hover: "hsl(210, 80%, 65%)",
          light: "hsl(210, 80%, 90%)",
          dark: "hsl(210, 80%, 45%)",
        },
        secondary: "hsl(210, 10%, 45%)",
        background: "hsl(220, 20%, 96%)",
        surface: "hsl(0, 0%, 100%)",
        accent: {
          green: "hsl(142, 76%, 45%)",
          purple: "hsl(262, 80%, 65%)",
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
