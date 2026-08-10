import { Link, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  freeInput: { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
  review: { ios: 'arrow.triangle.2.circlepath', android: 'refresh', web: 'refresh' },
} as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 85,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: FontSizes.xs,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontFamily: Fonts.headingSemiBold,
        },
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="설정"
              style={{ marginRight: Spacing.base }}
            >
              {({ pressed }) => (
                <SymbolView
                  name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                  size={24}
                  tintColor={Colors.textSecondary}
                  style={{ opacity: pressed ? 0.5 : 1 }}
                />
              )}
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '오늘의 문장',
          tabBarIcon: ({ color }) => <SymbolView name={ICONS.home} size={26} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="free-input"
        options={{
          title: '자유 입력',
          tabBarIcon: ({ color }) => (
            <SymbolView name={ICONS.freeInput} size={26} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: '복습',
          tabBarIcon: ({ color }) => <SymbolView name={ICONS.review} size={26} tintColor={color} />,
        }}
      />
    </Tabs>
  );
}
