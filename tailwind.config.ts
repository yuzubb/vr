import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#0b0e14',
        panel: '#12161f',
        edge: '#1e2530',
        signal: '#4ade80',
        warn: '#fbbf24',
        muted: '#6b7686',
      },
    },
  },
  plugins: [],
};
export default config;
