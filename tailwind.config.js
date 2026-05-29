/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        newsIn: {
          '0%':   { opacity: '0', transform: 'translateX(calc(100% + 1rem)) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        newsBar: {
          '0%':   { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        flashGreen: {
          '0%,100%': { color: 'inherit' },
          '50%':     { color: '#34d399' },
        },
        flashRed: {
          '0%,100%': { color: 'inherit' },
          '50%':     { color: '#f87171' },
        },
      },
      animation: {
        ticker:    'ticker 50s linear infinite',
        'news-in': 'newsIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'news-bar': 'newsBar linear forwards',
      },
    },
  },
  plugins: [],
}
