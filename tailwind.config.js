/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'background': '#1a1a2e',
        'card': '#16213e',
        'accent': '#0f3460',
        'text-primary': '#e4e4e4',
        'text-muted': '#8a8a9e',
        'border': '#2a2a4e',
        'danger': '#e94560',
        'danger-hover': '#ff5c79',
      }
    },
  },
  plugins: [],
}