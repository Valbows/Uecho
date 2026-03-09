/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/sidepanel/**/*.{html,tsx,ts}',
    './src/popup/**/*.{html,tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1392ec',
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e2ff',
          300: '#89d1ff',
          400: '#51b6ff',
          500: '#1392ec',
          600: '#0b78d4',
          700: '#0960ab',
          800: '#0d518d',
          900: '#114574',
        },
        echo: {
          bg: '#f8fafc',
          surface: '#ffffff',
          border: '#e2e8f0',
          text: '#0f172a',
          'text-secondary': '#64748b',
          'text-muted': '#94a3b8',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          code: '#1e293b',
          'code-bg': '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  plugins: [],
};
