/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          primary: '#6366f1',
          secondary: '#22d3ee',
          dark: '#1e1e2e',
          light: '#f8fafc',
        }
      }
    },
  },
  plugins: [],
}
