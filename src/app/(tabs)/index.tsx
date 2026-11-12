import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicRing } from '@/components/mic-ring';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Note } from '@/components/ui';
import { Spacing, useTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyze, canTranscribe, config, goalTopic, missingKeys } from '@/lib/api';
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
  const tabInset = useTabInset();
  const recorder = useWavRecorder();
  const [topic, setTopic] = useState(() => randomTopic());
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle');
  const [error, setError] = useState('');
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState('');
  const [making, setMaking] = useState(false);
  const stopping = useRef(false);
  const missing = missingKeys();

  async function fromGoal(g: string, previous?: string) {
    setError('');
    setMaking(true);
    try {
      setTopic(await goalTopic(g, previous));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMaking(false);
    }
  }

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
      if (!topic.goal) setTopic(randomTopic(topic)); // keep a goal task so it can be tried again
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
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: tabInset + Spacing.four }]} keyboardShouldPersistTaps="handled">
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
          <ThemedText type="title" style={topic.goal ? styles.task : undefined}>{topic.text}</ThemedText>
          {topic.tip ? <Note color="primary">Tip: {topic.tip}</Note> : null}
          <View style={styles.row}>
            <Button
              compact
              variant="secondary"
              icon={{ ios: 'shuffle', android: 'shuffle', web: 'shuffle' }}
              title={topic.goal ? (making ? 'Creating…' : 'Another task') : 'Another topic'}
              onPress={() => (topic.goal ? fromGoal(topic.goal, topic.text) : setTopic(randomTopic(topic)))}
              disabled={state !== 'idle' || making}
            />
            {topic.goal ? (
              <Button compact variant="secondary" title="Random topics" onPress={() => setTopic(randomTopic())} disabled={state !== 'idle' || making} />
            ) : null}
          </View>
        </View>

        <View style={styles.goal}>
          <ThemedText type="smallBold" themeColor="textSecondary">Or practise your own goal</ThemedText>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            placeholder="e.g. start a conversation with someone new and sound confident"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Button
            compact
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            title={making && !topic.goal ? 'Creating…' : 'Create task'}
            onPress={() => fromGoal(goal.trim())}
            disabled={!goal.trim() || !config.anthropicKey || state !== 'idle' || making}
          />
        </View>

        <View style={styles.mic}>
          <MicRing size={160} state={state} disabled={!canTranscribe() || making} onPress={state === 'recording' ? finish : begin} onTimeout={finish} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{hint}</ThemedText>
        </View>

        {error ? <Note>{error}</Note> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topic: { gap: Spacing.three, paddingTop: Spacing.three },
  task: { fontSize: 21, lineHeight: 28 }, // goal tasks run to two sentences
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  goal: { gap: Spacing.two },
  input: { borderRadius: 14, padding: Spacing.three, minHeight: 64, fontSize: 16, textAlignVertical: 'top' },
  mic: { flex: 1, justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
});
