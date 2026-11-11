import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, Note, ScoreBar, Section, Stat, StatRow, Surface, tone } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Session } from '@/lib/stats';
import { loadSessions } from '@/lib/store';

const clean = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Transcript with the weakest-pronounced words highlighted in place. */
function Transcript({ text, weak }: { text: string; weak: Set<string> }) {
  const theme = useTheme();
  return (
    <ThemedText>
      {text.split(/(\s+)/).map((part, i) =>
        weak.has(clean(part)) ? (
          <ThemedText key={i} style={{ backgroundColor: theme.highlight, fontWeight: 600 }}>{part}</ThemedText>
        ) : (
          part
        ),
      )}
    </ThemedText>
  );
}

export default function Feedback() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    loadSessions().then((all) => setS(all.find((x) => x.id === id) ?? null));
  }, [id]);

  if (s === undefined) return null;
  if (s === null)
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ThemedText>This session was deleted.</ThemedText>
      </View>
    );

  const f = s.feedback;
  const m = s.metrics;
  const p = s.pron;
  const weak = new Set(p.weakWords.map((w) => clean(w.word)));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" themeColor="primary">{s.category}</ThemedText>
        <ThemedText type="headline">{s.topic}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{new Date(s.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</ThemedText>
      </View>

      {s.feedbackError ? <Note color="warn">{s.feedbackError}</Note> : null}

      {f && (
        <Surface style={{ borderRadius: Radius.hero, padding: Spacing.four }}>
          <View style={styles.hero}>
            <ThemedText type="display" themeColor={tone(f.overallBand, 9)}>{f.overallBand ?? '–'}</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="headline">Speaking band</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">IELTS-style estimate out of 9</ThemedText>
            </View>
          </View>
          {f.summary ? <ThemedText>{f.summary}</ThemedText> : null}
          <ScoreBar label="Grammar" value={f.grammarScore} max={9} />
          <ScoreBar label="Vocabulary" value={f.vocabularyScore} max={9} />
          <ScoreBar label="Coherence" value={f.coherenceScore} max={9} />
        </Surface>
      )}

      <Section title="What you said">
        <Transcript text={p.transcript || '(nothing recognized)'} weak={weak} />
        {weak.size > 0 && (
          <ThemedText type="small" themeColor="textSecondary">Highlighted words were hard to understand.</ThemedText>
        )}
      </Section>

      {f?.corrected ? (
        <Section title="A more natural version">
          <ThemedText>{f.corrected}</ThemedText>
        </Section>
      ) : null}

      {f && f.issues.length > 0 && (
        <Section title={`Mistakes to fix (${f.issues.length})`}>
          {f.issues.map((i, k) => (
            <View key={k} style={[styles.item, k > 0 && { borderTopWidth: 1, borderColor: theme.backgroundSelected }]}>
              {i.type ? <ThemedText type="smallBold" themeColor="textSecondary">{i.type}</ThemedText> : null}
              <ThemedText themeColor="bad" style={{ textDecorationLine: 'line-through' }}>{i.wrong}</ThemedText>
              <ThemedText themeColor="good" style={{ fontWeight: 600 }}>{i.right}</ThemedText>
              {i.why ? <ThemedText type="small" themeColor="textSecondary">{i.why}</ThemedText> : null}
            </View>
          ))}
        </Section>
      )}

      <Section title="Pronunciation">
        <ScoreBar label="Overall" value={p.overall} max={100} />
        <ScoreBar label="Accuracy" value={p.accuracy} max={100} />
        <ScoreBar label="Fluency" value={p.fluency} max={100} />
        {p.completeness !== null && <ScoreBar label="Completeness" value={p.completeness} max={100} />}
        {p.weakWords.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Practise these words</ThemedText>
            <View style={styles.chips}>
              {p.weakWords.slice(0, 12).map((w, k) => (
                <Chip key={k} label={`${w.word} ${Math.round(w.accuracy)}`} color={tone(w.accuracy, 100)} />
              ))}
            </View>
          </View>
        )}
      </Section>

      <Section title="Pace and flow">
        <StatRow>
          <Stat label="words / min" value={m.wpm} />
          <Stat label={m.pauseCount ? `pauses, longest ${m.longestPause}s` : 'long pauses'} value={m.pauseCount} />
          <Stat label="fillers" value={m.fillerTotal} />
        </StatRow>
        <ThemedText type="small" themeColor="textSecondary">
          {m.fillerTotal ? `${Object.entries(m.fillers).map(([w, n]) => `“${w}” ×${n}`).join(', ')}. ` : ''}
          Natural conversation is about 120–160 words a minute. Filler counts are approximate, because speech
          recognition often drops “um” and “uh”.
        </ThemedText>
      </Section>

      {f && f.vocabularyUpgrades.length > 0 && (
        <Section title="Stronger words">
          {f.vocabularyUpgrades.map((u, k) => (
            <View key={k} style={[styles.item, k > 0 && { borderTopWidth: 1, borderColor: theme.backgroundSelected }]}>
              <ThemedText>
                <ThemedText themeColor="textSecondary">{u.original} → </ThemedText>
                <ThemedText themeColor="primary" style={{ fontWeight: 600 }}>{u.better}</ThemedText>
              </ThemedText>
              {u.example ? <ThemedText type="small" themeColor="textSecondary">“{u.example}”</ThemedText> : null}
            </View>
          ))}
        </Section>
      )}

      {f?.confidentPhrases?.length ? (
        <Section title="Sound more confident">
          {f.confidentPhrases.map((r, k) => (
            <View key={k} style={[styles.item, k > 0 && { borderTopWidth: 1, borderColor: theme.backgroundSelected }]}>
              <ThemedText themeColor="textSecondary">You said: “{r.said}”</ThemedText>
              <ThemedText themeColor="primary" style={{ fontWeight: 600 }}>Say instead: “{r.sayInstead}”</ThemedText>
              {r.why ? <ThemedText type="small" themeColor="textSecondary">{r.why}</ThemedText> : null}
            </View>
          ))}
        </Section>
      ) : null}

      {f && f.tips.length > 0 && (
        <Section title="Try next time">
          {f.tips.map((t, k) => (
            <View key={k} style={styles.tip}>
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <ThemedText style={{ flex: 1 }}>{t}</ThemedText>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  item: { gap: Spacing.half, paddingTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tip: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
