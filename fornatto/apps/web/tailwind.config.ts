import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fornatto: {
          brown: '#3D2914',
          'brown-light': '#5C3D1E',
          cream: '#F5E6D3',
          gold: '#C9A227',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;