/**
 * Tailwind config for user-web.
 *
 * Brand palette: unified with admin-web's indigo scale so the two
 * apps visually belong to the same product. See
 * `apps/admin-web/src/theme/tokens.css` `--px-brand-*` block.
 *
 * darkMode: 'class' — toggled by `lib/theme.tsx` via the `dark` class
 * on `<html>`. System/light/dark modes are all supported.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef0ff',
          100: '#dfe2ff',
          200: '#c4c9ff',
          300: '#a4a9ff',
          400: '#8087ff',
          500: '#5b5bff',
          600: '#4444e6',
          700: '#3333bf',
          800: '#242496',
          900: '#1a1a70',
        },
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
