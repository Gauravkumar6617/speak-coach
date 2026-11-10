import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicRing } from '@/components/mic-ring';
import { ThemedText } from '@/components/themed-text';
import { Button, Icon, Note } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { assess, canTranscribe, chatReply, config, type ChatMessage } from '@/lib/api';
import { useWavRecorder } from '@/lib/recorder';
import { randomTopic } from '@/lib/topics';

const newOpener = () => `Let's have a chat. ${randomTopic().text}`;

export default function Talk() {
  const theme = useTheme();
  const recorder = useWavRecorder();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [opener, setOpener] = useState(newOpener);
  const [turns, setTurns] = useState<ChatMessage[]>([]); // everything after the opener
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const stopping = useRef(false);
  const spokenOpener = useRef('');
  const ready = canTranscribe() && !!config.anthropicKey;

  const say = useCallback((text: string) => {
    const done = () => setSpeaking(false);
    setSpeaking(true);
    Speech.speak(text, { language: config.azureLocale, onDone: done, onStopped: done, onError: done });
  }, []);

  // Speak the opener when the tab is shown (once per opener); stop talking when leaving the tab.
  useFocusEffect(
    useCallback(() => {
      if (spokenOpener.current !== opener) {
        spokenOpener.current = opener;
        say(opener);
      }
      return () => void Speech.stop();
    }, [opener, say]),
  );

  async function begin() {
    setError('');
    Speech.stop(); // let the learner interrupt the coach
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
      const { transcript } = await assess(await recorder.stop());
      if (!transcript.trim()) throw new Error('Nothing was recognized. Hold the phone closer and try again.');
      const next: ChatMessage[] = [...turns, { role: 'user', content: transcript }];
      setTurns(next);
      const reply = await chatReply(opener, next);
      setTurns([...next, { role: 'assistant', content: reply }]);
      say(reply);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      stopping.current = false;
      setState('idle');
    }
  }

  const status =
    !ready ? 'Talk needs the Azure key, Azure region and Claude key in .env.' :
    state === 'recording' ? 'Listening. Tap when you are done.' :
    state === 'busy' ? 'Coach is thinking…' :
    speaking ? 'Coach is speaking. Tap the mic to reply.' :
    'Tap the mic to reply.';

  const bubbles: ChatMessage[] = [{ role: 'assistant', content: opener }, ...turns];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="title">Talk</ThemedText>
        <Button
          compact
          variant="secondary"
          icon={{ ios: 'plus.bubble', android: 'add_comment', web: 'add_comment' }}
          title="New chat"
          disabled={state !== 'idle'}
          onPress={() => {
            setTurns([]);
            setError('');
            setOpener(newOpener());
          }}
        />
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chat}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {bubbles.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={[styles.bubble, styles.mine, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: theme.onPrimary }}>{m.content}</ThemedText>
            </View>
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityHint="Plays this message aloud"
              onPress={() => say(m.content)}
              style={[styles.bubble, styles.theirs, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ flex: 1 }}>{m.content}</ThemedText>
              <Icon name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }} size={16} color={theme.primary} />
            </Pressable>
          ),
        )}
        {error ? <Note>{error}</Note> : null}
      </ScrollView>

      <View style={[styles.dock, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor={ready ? 'textSecondary' : 'bad'} style={{ textAlign: 'center' }}>{status}</ThemedText>
        <MicRing size={132} state={state} disabled={!ready} onPress={state === 'recording' ? finish : begin} onTimeout={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three },
  chat: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: Radius.card },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dock: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
