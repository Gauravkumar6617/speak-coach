import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ACCENT = '#208AEF';
export const RED = '#E5484D';
export const GREEN = '#30A46C';

export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>
      {title ? <ThemedText type="smallBold" themeColor="textSecondary">{title.toUpperCase()}</ThemedText> : null}
      {children}
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value ?? '–'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

export const StatRow = ({ children }: { children: ReactNode }) => <View style={styles.statRow}>{children}</View>;

export function Button({ title, onPress, color = ACCENT, disabled }: { title: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <ThemedText style={{ color: '#fff' }}>{title}</ThemedText>
    </Pressable>
  );
}

export function Note({ children, color = RED }: { children: ReactNode; color?: string }) {
  return (
    <View style={[styles.note, { borderColor: color }]}>
      <ThemedText type="small">{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  note: { borderLeftWidth: 4, paddingLeft: Spacing.two, paddingVertical: Spacing.one },
});
