import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import '../global.css';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { initializeAds } from '@/services/ads';
import { QueryProvider } from '@/providers/QueryProvider';
import { useMonetizationStore } from '@/stores/useMonetizationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadMonetization = useMonetizationStore((s) => s.loadMonetization);

  // Pull API keys out of SecureStore / env before any service reads them.
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Quotas start full until this resolves, so a metered action fired in the
  // first frames is allowed — a rare over-grant beats blocking a paying user.
  useEffect(() => {
    loadMonetization();
  }, [loadMonetization]);

  // Warms the AdMob SDK so the first rewarded ad is not the slowest one. A no-op
  // wherever the native module is missing.
  useEffect(() => {
    initializeAds();
  }, []);

  return (
    // React Navigation mounts a provider of its own, but declaring it here makes
    // the insets available everywhere — including inside the bottom sheets, which
    // read them to clear the home indicator and the Android navigation bar.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <DatabaseProvider>
        <QueryProvider>
          <ThemeProvider value={AppTheme}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: Colors.background },
                headerTintColor: Colors.textPrimary,
                headerTitleStyle: { fontFamily: Fonts.headingSemiBold },
                contentStyle: { backgroundColor: Colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="result/[id]" options={{ title: '평가 결과' }} />
              <Stack.Screen name="settings" options={{ title: '설정', presentation: 'modal' }} />
            </Stack>
          </ThemeProvider>
        </QueryProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
