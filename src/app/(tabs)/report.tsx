import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ACCENT, Card, RED, Stat, StatRow } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { averageBand, bandSeries, dayStreak, mistakeTypes, type Session } from '@/lib/stats';
import { deleteSession, loadSessions } from '@/lib/store';

function BandChart({ values, width }: { values: number[]; width: number }) {
  const theme = useTheme();
  const h = 140;
  const pad = 20;
  const x = (i: number) => pad + (i * (width - pad - 8)) / Math.max(values.length - 1, 1);
  const y = (v: number) => 8 + ((9 - v) * (h - 16)) / 9;
  return (
    <Svg width={width} height={h}>
      {[0, 3, 6, 9].map((v) => (
        <Line key={v} x1={pad} x2={width} y1={y(v)} y2={y(v)} stroke={theme.backgroundSelected} />
      ))}
      {[0, 3, 6, 9].map((v) => (
        <SvgText key={`t${v}`} x={0} y={y(v) + 4} fontSize={10} fill={theme.textSecondary}>{v}</SvgText>
      ))}
      <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} stroke={ACCENT} strokeWidth={2} fill="none" />
      {values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={ACCENT} />)}
    </Svg>
  );
}

export default function Report() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<Session[]>([]);
  const reload = useCallback(() => void loadSessions().then(setSessions), []);
  useFocusEffect(reload);

  const bands = bandSeries(sessions);
  const mistakes = mistakeTypes(sessions);
  const maxMistakes = Math.max(1, ...mistakes.map((m) => m.count));

  const header = (
    <View style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
      <ThemedText type="subtitle">Report</ThemedText>
      <Card>
        <StatRow>
          <Stat label="Sessions" value={sessions.length} />
          <Stat label="Day streak" value={dayStreak(sessions)} />
          <Stat label="Avg band" value={averageBand(sessions)} />
        </StatRow>
      </Card>
      <Card title="Band over time">
        {bands.length >= 2 ? (
          <BandChart values={bands} width={width - Spacing.three * 4} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">Needs two sessions with feedback.</ThemedText>
        )}
      </Card>
      <Card title="Most common mistakes">
        {mistakes.length ? (
          mistakes.map((m) => (
            <View key={m.type} style={{ gap: Spacing.half }}>
              <ThemedText type="small">{m.type} ({m.count})</ThemedText>
              <View style={[styles.bar, { width: `${(m.count / maxMistakes) * 100}%` }]} />
            </View>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">No mistakes recorded yet.</ThemedText>
        )}
      </Card>
      {sessions.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">Sessions · swipe left to delete</ThemedText>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.page}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        renderItem={({ item }) => (
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={40}
            renderRightActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete session"
                onPress={() => deleteSession(item.id).then(reload)}
                style={styles.delete}>
                <ThemedText style={{ color: '#fff' }}>Delete</ThemedText>
              </Pressable>
            )}>
            <Pressable
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <ThemedText numberOfLines={1}>{item.topic}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.metrics.wpm} wpm
                </ThemedText>
              </View>
              <ThemedText style={styles.band}>{item.feedback?.overallBand ?? '–'}</ThemedText>
            </Pressable>
          </ReanimatedSwipeable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  bar: { height: 10, borderRadius: 5, backgroundColor: ACCENT },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 12 },
  band: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  delete: { backgroundColor: RED, justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: 12, marginLeft: Spacing.two },
});
