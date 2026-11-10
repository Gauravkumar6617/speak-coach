import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicRing } from '@/components/mic-ring';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Note } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyze, canTranscribe, missingKeys } from '@/lib/api';
import { MAX_SECONDS, useWavRecorder } from '@/lib/recorder';
import { addSession } from '@/lib/store';
import { randomTopic } from '@/lib/topics';

export default function Practice() {
  const theme = useTheme();
  const recorder = useWavRecorder();
  const [topic, setTopic] = useState(() => randomTopic());
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle');
  const [error, setError] = useState('');
  const stopping = useRef(false);
  const missing = missingKeys();

  async function begin() {
    setError('');
    try {
      await recorder.start();
      setState('recording');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function finish() {
    if (stopping.current) return;
    stopping.current = true;
    setState('busy');
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

        <MicRing
          state={state}
          disabled={!canTranscribe()}
          onPress={state === 'recording' ? finish : begin}
          onTimeout={finish}
        />

        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {state === 'busy' ? 'Analyzing your answer…' : `Answer for up to ${MAX_SECONDS} seconds.`}
        </ThemedText>
        {error ? <Note>{error}</Note> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
});
