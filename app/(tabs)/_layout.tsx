import { Link, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  freeInput: { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
  topics: { ios: 'text.book.closed.fill', android: 'menu_book', web: 'menu_book' },
  review: { ios: 'note.text', android: 'note', web: 'note' },
} as const;

/** Bar height above the system inset; the inset is added on top of this. */
const TAB_BAR_HEIGHT = 60;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // Android draws edge to edge, so the gesture pill or the three-button
        // navigation bar covers the tab bar unless it grows by the inset. The
        // old fixed 85/20 happened to clear an iPhone home indicator and clipped
        // the labels everywhere else.
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        // Otherwise the bar rides up on top of the keyboard and eats the room
        // the input needs.
        tabBarHideOnKeyboard: true,
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
        name="topics"
        options={{
          title: '주제별 연습',
          tabBarIcon: ({ color }) => <SymbolView name={ICONS.topics} size={26} tintColor={color} />,
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
