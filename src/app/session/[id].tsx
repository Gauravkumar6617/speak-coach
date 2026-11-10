import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, GREEN, Note, RED, Stat, StatRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Session } from '@/lib/stats';
import { loadSessions } from '@/lib/store';

const round = (n: number | null) => (n === null ? null : Math.round(n));

export default function Feedback() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    loadSessions().then((all) => setS(all.find((x) => x.id === id) ?? null));
  }, [id]);

  if (s === undefined) return null;
  if (s === null) return <ThemedText style={styles.page}>Session not found.</ThemedText>;
  const f = s.feedback;
  const m = s.metrics;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <ThemedText type="small" themeColor="textSecondary">
        {s.category} · {new Date(s.createdAt).toLocaleString()}
      </ThemedText>
      <ThemedText style={{ fontSize: 20, lineHeight: 28, fontWeight: 600 }}>{s.topic}</ThemedText>

      {s.feedbackError ? <Note>{s.feedbackError}</Note> : null}

      {f && (
        <Card title="Scores (0-9)">
          <StatRow>
            <Stat label="Band" value={f.overallBand} />
            <Stat label="Grammar" value={f.grammarScore} />
            <Stat label="Vocabulary" value={f.vocabularyScore} />
            <Stat label="Coherence" value={f.coherenceScore} />
          </StatRow>
          {f.summary ? <ThemedText>{f.summary}</ThemedText> : null}
        </Card>
      )}

      <Card title="Transcript">
        <ThemedText>{s.pron.transcript || '(empty)'}</ThemedText>
      </Card>

      {f?.corrected ? (
        <Card title="Corrected version">
          <ThemedText>{f.corrected}</ThemedText>
        </Card>
      ) : null}

      {f && f.issues.length > 0 && (
        <Card title={`Mistakes (${f.issues.length})`}>
          {f.issues.map((i, k) => (
            <View key={k} style={styles.item}>
              <ThemedText>
                <ThemedText style={{ color: RED, textDecorationLine: 'line-through' }}>{i.wrong}</ThemedText>
                {'  →  '}
                <ThemedText style={{ color: GREEN, fontWeight: 700 }}>{i.right}</ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {i.type ? `${i.type}: ` : ''}{i.why}
              </ThemedText>
            </View>
          ))}
        </Card>
      )}

      <Card title="Pronunciation (0-100)">
        <StatRow>
          <Stat label="Overall" value={round(s.pron.overall)} />
          <Stat label="Accuracy" value={round(s.pron.accuracy)} />
          <Stat label="Fluency" value={round(s.pron.fluency)} />
          <Stat label="Complete" value={round(s.pron.completeness)} />
        </StatRow>
        {s.pron.weakWords.length > 0 && (
          <>
            <ThemedText type="smallBold">Weakest words</ThemedText>
            <View style={styles.chips}>
              {s.pron.weakWords.map((w, k) => (
                <ThemedText key={k} type="small" style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
                  {w.word} {Math.round(w.accuracy)}
                </ThemedText>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card title="Pace and fluency">
        <StatRow>
          <Stat label="Words/min" value={m.wpm} />
          <Stat label="Pauses ≥0.6s" value={m.pauseCount} />
          <Stat label="Longest" value={m.pauseCount ? `${m.longestPause}s` : '–'} />
          <Stat label="Fillers" value={m.fillerTotal} />
        </StatRow>
        <ThemedText type="small" themeColor="textSecondary">
          {m.fillerTotal
            ? Object.entries(m.fillers).map(([w, n]) => `${w} ×${n}`).join(', ')
            : 'No fillers detected.'}{' '}
          Filler counts are approximate: speech recognition often hides “um” and “uh”.
        </ThemedText>
      </Card>

      {f && f.vocabularyUpgrades.length > 0 && (
        <Card title="Vocabulary upgrades">
          {f.vocabularyUpgrades.map((u, k) => (
            <View key={k} style={styles.item}>
              <ThemedText>
                {u.original} → <ThemedText style={{ fontWeight: 700 }}>{u.better}</ThemedText>
              </ThemedText>
              {u.example ? <ThemedText type="small" themeColor="textSecondary">“{u.example}”</ThemedText> : null}
            </View>
          ))}
        </Card>
      )}

      {f && f.tips.length > 0 && (
        <Card title="Tips">
          {f.tips.map((t, k) => (
            <ThemedText key={k}>• {t}</ThemedText>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  item: { gap: Spacing.half, paddingVertical: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: 8, overflow: 'hidden' },
});
