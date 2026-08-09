import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const OPENAI_KEY = 'openai_api_key';
const GEMINI_KEY = 'gemini_api_key';
const INPUT_METHOD_KEY = 'preferred_input_method';

// SecureStore throws on platforms where the keychain is unavailable (e.g. web).
// A settings read failing must not leave the app stuck with isLoaded === false.
async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

interface SettingsState {
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  preferredInputMethod: 'voice' | 'text';
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setApiKey: (service: 'openai' | 'gemini', key: string) => Promise<void>;
  setPreferredInputMethod: (method: 'voice' | 'text') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  openaiApiKey: null,
  geminiApiKey: null,
  preferredInputMethod: 'text',
  isLoaded: false,

  loadSettings: async () => {
    const [openaiKey, geminiKey, inputMethod] = await Promise.all([
      readSecure(OPENAI_KEY),
      readSecure(GEMINI_KEY),
      readSecure(INPUT_METHOD_KEY),
    ]);

    set({
      openaiApiKey: openaiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || null,
      geminiApiKey: geminiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null,
      preferredInputMethod: (inputMethod as 'voice' | 'text') || 'text',
      isLoaded: true,
    });
  },

  setApiKey: async (service, key) => {
    const storeKey = service === 'openai' ? OPENAI_KEY : GEMINI_KEY;
    await SecureStore.setItemAsync(storeKey, key);

    if (service === 'openai') {
      set({ openaiApiKey: key });
    } else {
      set({ geminiApiKey: key });
    }
  },

  setPreferredInputMethod: (method) => {
    // Fire-and-forget persistence; an unhandled rejection here would crash in dev.
    SecureStore.setItemAsync(INPUT_METHOD_KEY, method).catch(() => {});
    set({ preferredInputMethod: method });
  },
}));
