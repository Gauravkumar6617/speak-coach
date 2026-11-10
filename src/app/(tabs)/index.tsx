import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicRing } from '@/components/mic-ring';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Note } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyze, canTranscribe, missingKeys } from '@/lib/api';
import { MAX_SECONDS, useWavRecorder } from '@/lib/recorder';
import { dayStreak } from '@/lib/stats';
import { addSession, loadSessions } from '@/lib/store';
import { randomTopic } from '@/lib/topics';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Practice() {
  const theme = useTheme();
  const recorder = useWavRecorder();
  const [topic, setTopic] = useState(() => randomTopic());
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle');
  const [error, setError] = useState('');
  const [streak, setStreak] = useState(0);
  const stopping = useRef(false);
  const missing = missingKeys();

  useFocusEffect(useCallback(() => void loadSessions().then((s) => setStreak(dayStreak(s))), []));

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

  const hint =
    state === 'busy' ? 'Checking your answer…' :
    state === 'recording' ? 'Listening. Tap when you are done.' :
    `Tap the mic and answer for up to ${MAX_SECONDS} seconds.`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.top}>
          <ThemedText type="headline" themeColor="textSecondary">{greeting()}</ThemedText>
          {streak > 0 && <Chip label={`🔥 ${streak}-day streak`} color="warn" />}
        </View>

        {missing.length > 0 && (
          <Note color={canTranscribe() ? 'warn' : 'bad'}>
            {canTranscribe()
              ? `Add ${missing.join(', ')} to .env to get grammar and vocabulary feedback.`
              : `Add ${missing.join(', ')} to .env. Recording stays off until the Azure key and region are set.`}
          </Note>
        )}

        <View style={styles.topic}>
          <ThemedText type="smallBold" themeColor="primary">{topic.category}</ThemedText>
          <ThemedText type="title">{topic.text}</ThemedText>
          <Button
            compact
            variant="secondary"
            icon={{ ios: 'shuffle', android: 'shuffle', web: 'shuffle' }}
            title="Another topic"
            onPress={() => setTopic(randomTopic(topic))}
            disabled={state !== 'idle'}
          />
        </View>

        <View style={styles.mic}>
          <MicRing state={state} disabled={!canTranscribe()} onPress={state === 'recording' ? finish : begin} onTimeout={finish} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{hint}</ThemedText>
        </View>

        {error ? <Note>{error}</Note> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four, paddingBottom: BottomTabInset + Spacing.four },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topic: { gap: Spacing.three, paddingTop: Spacing.three },
  mic: { flex: 1, justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
});
