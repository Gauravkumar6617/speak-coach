import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
export type IconName = Extract<SymbolName, object>;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

/** 'good' / 'warn' / 'bad' for a score as a fraction of its maximum. */
export const tone = (value: number | null, max: number): ThemeColor =>
  value === null ? 'textSecondary' : value / max >= 0.75 ? 'good' : value / max >= 0.55 ? 'warn' : 'bad';

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.surface, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface>
      <ThemedText type="headline">{title}</ThemedText>
      {children}
    </Surface>
  );
}

export function ScoreBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const theme = useTheme();
  const t = tone(value, max);
  return (
    <View style={{ gap: Spacing.one }}>
      <View style={styles.between}>
        <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
        <ThemedText type="smallBold" themeColor={t}>
          {value === null ? '–' : `${Math.round(value * 10) / 10} / ${max}`}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${Math.min(1, (value ?? 0) / max) * 100}%`, backgroundColor: theme[t] }]} />
      </View>
    </View>
  );
}

export function Stat({ label, value, color }: { label: string; value: string | number | null | undefined; color?: ThemeColor }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue} themeColor={color}>{value ?? '–'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{label}</ThemedText>
    </View>
  );
}

export const StatRow = ({ children }: { children: ReactNode }) => <View style={styles.statRow}>{children}</View>;

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, compact }: ButtonProps) {
  const theme = useTheme();
  const bg = { primary: theme.primary, secondary: theme.primarySoft, danger: theme.backgroundSelected }[variant];
  const fg = { primary: theme.onPrimary, secondary: theme.primary, danger: theme.bad }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      {icon && <Icon name={icon} size={compact ? 16 : 18} color={fg} />}
      <ThemedText type="headline" style={[{ color: fg }, compact && { fontSize: 15 }]}>{title}</ThemedText>
    </Pressable>
  );
}

export function Chip({ label, color = 'textSecondary' }: { label: string; color?: ThemeColor }) {
  const theme = useTheme();
  return (
    <ThemedText type="smallBold" themeColor={color} style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
      {label}
    </ThemedText>
  );
}

export function Note({ children, color = 'bad' }: { children: ReactNode; color?: ThemeColor }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { borderColor: theme[color], backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small">{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.three },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  stat: { flex: 1, alignItems: 'center', gap: Spacing.half },
  statValue: { fontFamily: Fonts.rounded, fontSize: 26, lineHeight: 32, fontWeight: 700 },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  note: { borderLeftWidth: 4, borderRadius: 10, padding: Spacing.three },
});
