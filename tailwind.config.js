/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#faf6f0',
        ink: '#2b2622',
        muted: '#7a6f66',
        line: '#e8dfd4',
        accent: { DEFAULT: '#c2562f', dark: '#9e4323', soft: '#f6e3d9' },
        sage: { DEFAULT: '#5f7a5a', soft: '#e4ece1' },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
