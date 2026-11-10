import * as Speech from 'expo-speech';
import { useFocusEffect } from 'expo-router';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicRing } from '@/components/mic-ring';
import { ThemedText } from '@/components/themed-text';
import { ACCENT, Button, Note } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { assess, canTranscribe, chatReply, config, type ChatMessage } from '@/lib/api';
import { useWavRecorder } from '@/lib/recorder';
import { randomTopic } from '@/lib/topics';

const newOpener = () => `Let's have a chat. ${randomTopic().text}`;
const say = (text: string) => Speech.speak(text, { language: config.azureLocale });

export default function Talk() {
  const theme = useTheme();
  const recorder = useWavRecorder();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [opener, setOpener] = useState(newOpener);
  const [turns, setTurns] = useState<ChatMessage[]>([]); // everything after the opener
  const [state, setState] = useState<'idle' | 'recording' | 'busy'>('idle');
  const [error, setError] = useState('');
  const stopping = useRef(false);
  const ready = canTranscribe() && !!config.anthropicKey;

  const spokenOpener = useRef('');

  // Speak the opener when the tab is shown (once per opener); stop talking when leaving the tab.
  useFocusEffect(
    useCallback(() => {
      if (spokenOpener.current !== opener) {
        spokenOpener.current = opener;
        say(opener);
      }
      return () => void Speech.stop();
    }, [opener]),
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
      if (!transcript.trim()) throw new Error('I did not catch that. Try again a little louder.');
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

  const bubbles: ChatMessage[] = [{ role: 'assistant', content: opener }, ...turns];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Talk</ThemedText>
        <Button
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
        {bubbles.map((m, i) => {
          const mine = m.role === 'user';
          return (
            <ThemedText
              key={i}
              onPress={mine ? undefined : () => say(m.content)}
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: ACCENT, color: '#fff' }
                  : { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement },
              ]}>
              {m.content}
              {mine ? '' : '  🔊'}
            </ThemedText>
          );
        })}
        {!ready && <Note>Talk needs the Azure key, Azure region and Claude key in .env.</Note>}
        {error ? <Note>{error}</Note> : null}
      </ScrollView>

      <View style={styles.mic}>
        <MicRing size={140} state={state} disabled={!ready} onPress={state === 'recording' ? finish : begin} onTimeout={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three },
  chat: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  bubble: { maxWidth: '85%', padding: Spacing.three, borderRadius: 16, overflow: 'hidden' },
  mic: { paddingTop: Spacing.two, paddingBottom: BottomTabInset + Spacing.two },
});
