/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B1020',
        surface: '#151C30',
        elevated: '#1E2842',
        primary: '#9B87FF',
        success: '#42D6B0',
        warning: '#FFBF69',
        danger: '#FF6B86',
        main: '#F5F7FF',
        muted: '#A8B2CC',
        border: '#2B3654',
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
