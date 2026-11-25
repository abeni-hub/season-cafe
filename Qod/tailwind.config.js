/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#3f5c35',
          deep: '#293d22',
          mid: '#5d7a4c',
          soft: '#a9b99a',
          wash: '#ecefe4',
        },
        clay: {
          DEFAULT: '#b0552f',
          deep: '#8a3f20',
          soft: '#e9c4aa',
          wash: '#f6e9dd',
        },
        paper: {
          DEFAULT: '#f6f1e6',
          deep: '#efe8d7',
        },
        cream: '#fcfaf4',
        beige: '#d3cab5',
        ink: {
          DEFAULT: '#26251f',
          soft: '#49463c',
        },
        muted: '#7c7564',
        line: '#e3dbc9',
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        script: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 18px 40px -24px rgba(41, 61, 34, 0.35)',
        lift: '0 24px 60px -30px rgba(41, 61, 34, 0.45)',
      },
      backgroundImage: {
        'paper-grain':
          'radial-gradient(circle at 12% 18%, rgba(176,85,47,0.06), transparent 42%), radial-gradient(circle at 88% 8%, rgba(63,92,53,0.08), transparent 38%), radial-gradient(circle at 70% 90%, rgba(207,197,174,0.25), transparent 45%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
