import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Iris violet is the brand; red appears only while recording; green/amber/red only for scores.
export const Colors = {
  light: {
    text: '#14162B',
    textSecondary: '#5D6178',
    background: '#F5F6FA',
    backgroundElement: '#FFFFFF', // surfaces
    backgroundSelected: '#E6E8F0', // tracks, hairlines, chips
    primary: '#5B4BDB',
    primarySoft: '#ECEAFD',
    onPrimary: '#FFFFFF',
    record: '#E5484D',
    good: '#1F9D6B',
    warn: '#B86E00',
    bad: '#D93D42',
    highlight: '#FFE9B8',
  },
  dark: {
    text: '#ECEDF5',
    textSecondary: '#9A9EB8',
    background: '#0D0F1C',
    backgroundElement: '#181B2E',
    backgroundSelected: '#2A2E47',
    primary: '#8B7FF5',
    primarySoft: '#26224D',
    onPrimary: '#0D0F1C',
    record: '#FF6369',
    good: '#3DD68C',
    warn: '#F5B83D',
    bad: '#FF6369',
    highlight: '#5C4410',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded' },
  default: { sans: 'normal', rounded: 'normal' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { card: 18, hero: 24, button: 14, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Height the tab bar covers. On iPhones with a home indicator the bar is taller than BottomTabInset by the bottom safe area. */
export function useTabInset() {
  const { bottom } = useSafeAreaInsets();
  return BottomTabInset + (Platform.OS === 'ios' ? bottom : 0);
}
