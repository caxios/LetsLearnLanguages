/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Kept in sync with src/constants/colors.ts (the source of truth).
        primary: {
          50: '#EFEEFF',
          100: '#DEDCFF',
          500: '#8B83FF',
          600: '#6C63FF',
          700: '#4F46E5',
        },
        surface: {
          DEFAULT: '#1A1A2E',
          light: '#25253B',
          dark: '#0F0F1A',
        },
        accent: '#00D4AA',
      },
    },
  },
  plugins: [],
};
