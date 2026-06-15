/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bg:      '#07080f',
        accent:  '#5b8dee',
        accentV: '#8b6cf7',
        accentC: '#38bdf8',
        real:    '#4ade80',
        fake:    '#f87171',
        t1:      '#f0f2f8',
        t2:      '#9eaabb',   /* was #8b96a8 — brighter secondary text */
        t3:      '#6b7a94',   /* was #4a5568 — brighter muted text */
      },
    },
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
}
