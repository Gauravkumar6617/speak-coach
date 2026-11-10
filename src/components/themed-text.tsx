import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'headline' | 'default' | 'small' | 'smallBold';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

// Type scale: 13 / 16 / 17 / 28 / 56. Rounded numerals for scores.
const styles = StyleSheet.create({
  display: { fontFamily: Fonts.rounded, fontSize: 56, lineHeight: 60, fontWeight: 800, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700, letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  default: { fontSize: 16, lineHeight: 23, fontWeight: 400 },
  small: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
});
