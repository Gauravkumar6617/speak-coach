import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Icon, Section, Stat, StatRow, Surface, tone } from '@/components/ui';
import { Fonts, Radius, Spacing, useTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { averageBand, bandSeries, dayStreak, mistakeTypes, type Session } from '@/lib/stats';
import { deleteSession, loadSessions } from '@/lib/store';

function BandChart({ values, width }: { values: number[]; width: number }) {
  const theme = useTheme();
  const h = 150;
  const left = 22;
  const x = (i: number) => left + (i * (width - left - 8)) / Math.max(values.length - 1, 1);
  const y = (v: number) => 10 + ((9 - v) * (h - 20)) / 9;
  return (
    <Svg width={width} height={h} accessibilityLabel={`Band over time, latest ${values[values.length - 1]}`}>
      {[0, 3, 6, 9].map((v) => (
        <Line key={v} x1={left} x2={width} y1={y(v)} y2={y(v)} stroke={theme.backgroundSelected} strokeDasharray={v ? '3 4' : undefined} />
      ))}
      {[0, 3, 6, 9].map((v) => (
        <SvgText key={`t${v}`} x={0} y={y(v) + 4} fontSize={11} fill={theme.textSecondary}>{v}</SvgText>
      ))}
      <Polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        stroke={theme.primary}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 3} fill={theme.primary} stroke={theme.backgroundElement} strokeWidth={2} />
      ))}
    </Svg>
  );
}

export default function Report() {
  const theme = useTheme();
  const tabInset = useTabInset();
  const [chartWidth, setChartWidth] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const reload = useCallback(() => void loadSessions().then(setSessions), []);
  useFocusEffect(reload);

  const bands = bandSeries(sessions);
  const mistakes = mistakeTypes(sessions);
  const maxMistakes = Math.max(1, ...mistakes.map((m) => m.count));
  const avg = averageBand(sessions);

  const header = (
    <View style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
      <ThemedText type="title">Progress</ThemedText>
      <Surface>
        <StatRow>
          <Stat label="sessions" value={sessions.length} />
          <Stat label="day streak" value={dayStreak(sessions)} color="warn" />
          <Stat label="average band" value={avg} color={tone(avg, 9)} />
        </StatRow>
      </Surface>

      {sessions.length === 0 ? (
        <Surface style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
          <Icon name={{ ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' }} size={36} color={theme.primary} />
          <ThemedText type="headline">No sessions yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Answer a topic on the Practice tab. Your scores and common mistakes will appear here.
          </ThemedText>
        </Surface>
      ) : (
        <>
          <Section title="Band over time">
            {bands.length >= 2 ? (
              <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                {chartWidth > 0 && <BandChart values={bands} width={chartWidth} />}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">The chart appears after two sessions with feedback.</ThemedText>
            )}
          </Section>
          <Section title="Most common mistakes">
            {mistakes.length ? (
              mistakes.map((m) => (
                <View key={m.type} style={{ gap: Spacing.one }}>
                  <View style={styles.between}>
                    <ThemedText type="small">{m.type[0].toUpperCase() + m.type.slice(1)}</ThemedText>
                    <ThemedText type="smallBold" themeColor="textSecondary">{m.count}</ThemedText>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                    <View style={[styles.bar, { width: `${(m.count / maxMistakes) * 100}%`, backgroundColor: theme.primary }]} />
                  </View>
                </View>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">No mistakes recorded yet.</ThemedText>
            )}
          </Section>
          <View style={styles.between}>
            <ThemedText type="headline">Past sessions</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Swipe left to delete</ThemedText>
          </View>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.page, { paddingBottom: tabInset + Spacing.three }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        renderItem={({ item }) => {
          const band = item.feedback?.overallBand ?? null;
          return (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={40}
              renderRightActions={() => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete session"
                  onPress={() => deleteSession(item.id).then(reload)}
                  style={[styles.delete, { backgroundColor: theme.bad }]}>
                  <Icon name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={20} color="#fff" />
                </Pressable>
              )}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={styles.badgeText} themeColor={tone(band, 9)}>{band ?? '–'}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText numberOfLines={1} style={{ fontWeight: 600 }}>{item.topic}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, {item.metrics.wpm} wpm
                  </ThemedText>
                </View>
                <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} color={theme.textSecondary} />
              </Pressable>
            </ReanimatedSwipeable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.card },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: Fonts.rounded, fontSize: 18, lineHeight: 22, fontWeight: 700 },
  delete: { justifyContent: 'center', alignItems: 'center', width: 72, borderRadius: Radius.card, marginLeft: Spacing.two },
});
