import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ACCENT, Button, Card, Note, RED } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyze, canTranscribe, missingKeys } from '@/lib/api';
import { MAX_SECONDS, useWavRecorder } from '@/lib/recorder';
import { addSession } from '@/lib/store';
import { randomTopic } from '@/lib/topics';

const SIZE = 200;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function Practice() {
  const theme = useTheme();
  const recorder = useWavRecorder();
  const [topic, setTopic] = useState(() => randomTopic());
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const startedAt = useRef(0);
  const stopping = useRef(false);
  const missing = missingKeys();

  async function begin() {
    setError('');
    try {
      await recorder.start();
      startedAt.current = Date.now();
      setElapsed(0);
      setState('recording');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function finish() {
    if (stopping.current) return;
    stopping.current = true;
    setState('analyzing');
    try {
      const session = await analyze(await recorder.stop(), topic);
      await addSession(session);
      setTopic(randomTopic(topic));
      router.push({ pathname: '/session/[id]', params: { id: session.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      stopping.current = false;
      setState('idle');
    }
  }

  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) finish();
    }, 200);
    return () => clearInterval(id);
  });

  const progress = state === 'recording' ? Math.min(elapsed / MAX_SECONDS, 1) : 0;
  const center =
    state === 'analyzing' ? <ActivityIndicator size="large" /> :
    state === 'recording' ? (
      <>
        <ThemedText type="subtitle">{Math.max(0, Math.ceil(MAX_SECONDS - elapsed))}s</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Tap to stop</ThemedText>
      </>
    ) : (
      <>
        <ThemedText style={{ fontSize: 48, lineHeight: 56 }}>🎙️</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Tap to speak</ThemedText>
      </>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <ThemedText type="subtitle">Speak Coach</ThemedText>

        {missing.length > 0 && (
          <Note>
            Missing in .env: {missing.join(', ')}.
            {!canTranscribe() && ' Without the Azure key and region the app cannot transcribe your speech, so recording is disabled.'}
          </Note>
        )}

        <Card title={topic.category}>
          <ThemedText style={{ fontSize: 20, lineHeight: 28 }}>{topic.text}</ThemedText>
          <Button title="New topic" onPress={() => setTopic(randomTopic(topic))} disabled={state !== 'idle'} />
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state === 'recording' ? 'Stop recording' : 'Start recording'}
          disabled={state === 'analyzing' || !canTranscribe()}
          onPress={state === 'recording' ? finish : begin}
          style={[styles.ring, { opacity: canTranscribe() ? 1 : 0.4 }]}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.backgroundSelected} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={state === 'recording' ? RED : ACCENT}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - (state === 'idle' ? 1 : progress))}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          {center}
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {state === 'analyzing' ? 'Analyzing your answer…' : `Answer for up to ${MAX_SECONDS} seconds.`}
        </ThemedText>
        {error ? <Note>{error}</Note> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  ring: { width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
