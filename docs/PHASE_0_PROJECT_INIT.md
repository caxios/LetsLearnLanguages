# Phase 0: Project Initialization & Configuration

> **Goal**: Set up the Expo project, install all dependencies, and configure the development environment.
> **Estimated Effort**: 0.5 day
> **Verification**: `npx expo start` runs without errors and the default tab app renders on a device/emulator.

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Expo Go app on a physical device (optional)
- Android Emulator or iOS Simulator (optional)

---

## Step 0.1 — Create Expo Project

```bash
npx -y create-expo-app@latest ./ --template tabs
```

> This creates an Expo project with file-based routing (Expo Router) and a tab navigation template in the current directory.

### Expected Output
- `app/` directory with tab layout
- `package.json` with Expo dependencies
- `tsconfig.json` with base config
- `app.json` with Expo configuration

---

## Step 0.2 — Install Core Dependencies

### Navigation (verify — should be included with tabs template)
```bash
npx expo install expo-router expo-linking expo-constants
```

### AI & Speech
```bash
npx expo install expo-audio
npm install @google/generative-ai
```

### Database
```bash
npx expo install expo-sqlite
npm install drizzle-orm
npm install -D drizzle-kit
```

### State Management
```bash
npm install zustand @tanstack/react-query
```

### Styling
```bash
npm install nativewind tailwindcss
```

### Utilities
```bash
npm install zod date-fns
npx expo install expo-secure-store expo-haptics expo-file-system
```

---

## Step 0.3 — Configure TypeScript Path Aliases

**`tsconfig.json`** — Update with path aliases for clean imports:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/db/*": ["src/db/*"],
      "@/services/*": ["src/services/*"],
      "@/stores/*": ["src/stores/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/constants/*": ["src/constants/*"]
    }
  }
}
```

---

## Step 0.4 — Configure NativeWind (Tailwind CSS for React Native)

**`tailwind.config.js`** — Create at project root:

```js
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
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        surface: {
          DEFAULT: '#1E1E2E',
          light: '#2A2A3E',
          dark: '#16161F',
        },
        accent: '#F59E0B',
      },
    },
  },
  plugins: [],
};
```

**`global.css`** — Create/update the global CSS file:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`babel.config.js`** — Add NativeWind preset:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

**`metro.config.js`** — Configure Metro for NativeWind:
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## Step 0.5 — Configure Environment Variables

**`.env`** — Create at project root (add to `.gitignore`):
```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx
```

**`.gitignore`** — Ensure `.env` is listed:
```
.env
.env.local
```

> ⚠️ **CAUTION**: For production, API keys should be proxied through a backend server. Embedding keys in the client is acceptable only for development/prototyping.

---

## Step 0.6 — Create Source Directory Structure

Create the following empty directories:

```
src/
├── components/
│   ├── ui/
│   ├── input/
│   ├── evaluation/
│   └── daily/
├── db/
│   ├── migrations/
│   └── repositories/
├── services/
├── stores/
├── hooks/
├── types/
├── utils/
├── constants/
└── providers/
```

---

## Verification Checklist

- [ ] `npx expo start` runs without errors
- [ ] The default tab app renders on device/emulator
- [ ] TypeScript path aliases resolve correctly (no red squiggles in IDE)
- [ ] NativeWind classes work (test with `className="bg-red-500"` on a View)
- [ ] Environment variables are accessible via `process.env.EXPO_PUBLIC_GEMINI_API_KEY`
- [ ] All packages installed without version conflicts
- [ ] `.env` is in `.gitignore`

---

## Next Phase

Once all checks pass → proceed to **[Phase 1: Database Layer](./PHASE_1_DATABASE.md)**
