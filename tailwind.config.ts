import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1712',
        panel: '#16211A',
        paneledge: '#2A3A2C',
        chalk: '#F3EFE6',
        chalkdim: '#B9C2B8',
        amber: '#E7A339',
      },
      fontFamily: {
        display: ['Oswald', 'Arial Narrow', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
