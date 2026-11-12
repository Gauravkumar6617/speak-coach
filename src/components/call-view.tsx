import type { CameraView } from 'expo-camera';
import type { RefObject } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachAvatar, type Mood } from '@/components/avatar';
import { MicRing } from '@/components/mic-ring';
import { SelfView } from '@/components/self-view';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  mood: Mood;
  coachLine: string;
  myLine?: string;
  status: string;
  state: 'idle' | 'recording' | 'busy';
  ready: boolean;
  onMic: () => void;
  onTimeout: () => void;
  cameraRef?: RefObject<CameraView | null>;
  /** Interview mode: several interviewers on top instead of the coach; `speaker` is the one talking. */
  panel?: { name: string; role: string }[];
  speaker?: number;
};

const STAGE = '#141729';

/** Full-screen video-call layout: coach on the top half, the learner's live camera on the bottom half. */
export function CallView({ visible, onClose, mood, coachLine, myLine, status, state, ready, onMic, onTimeout, cameraRef, panel, speaker = 0 }: Props) {
  const { width, height } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.6, height * 0.22); // leaves room for the caption under it

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: STAGE }]}>
        <SafeAreaView edges={['top']} style={[styles.half, styles.coach]}>
          {panel ? (
            <View style={styles.panel}>
              {panel.map((p, i) => (
                <View key={p.name} style={[styles.seat, i === speaker && styles.seatOn]}>
                  <CoachAvatar mood={i === speaker ? mood : 'idle'} size={avatarSize * 0.5} />
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>{p.name}</ThemedText>
                  <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.role}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <CoachAvatar mood={mood} size={avatarSize} />
          )}
          <Caption label={panel ? panel[speaker].name : 'Coach'} text={coachLine} at="bottom" />
          <Pressable accessibilityRole="button" accessibilityLabel="Exit full screen" onPress={onClose} style={styles.close}>
            <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} color="#fff" />
          </Pressable>
        </SafeAreaView>

        <View style={styles.half}>
          <SelfView active={visible} recording={state === 'recording'} style={styles.camera} cameraRef={cameraRef} />
          {myLine ? <Caption label="You" text={myLine} at="top" /> : null}
          <SafeAreaView edges={['bottom']} style={styles.controls}>
            <ThemedText type="small" style={styles.status}>{status}</ThemedText>
            <MicRing size={96} state={state} disabled={!ready} onPress={onMic} onTimeout={onTimeout} />
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

function Caption({ label, text, at }: { label: string; text: string; at: 'top' | 'bottom' }) {
  return (
    <View style={[styles.caption, { [at]: Spacing.three }]}>
      <ThemedText type="smallBold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</ThemedText>
      <ThemedText numberOfLines={6} style={{ color: '#fff' }}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 2 },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coach: { paddingBottom: 120 },
  panel: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.two },
  seat: { flex: 1, alignItems: 'center', gap: 2, padding: Spacing.two, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
  seatOn: { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.08)' }, // caption height, so the avatar centres above it
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: undefined, height: undefined, borderRadius: 0, borderWidth: 0 },
  close: {
    position: 'absolute',
    top: Spacing.six,
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  caption: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.three },
  status: { color: '#fff', textAlign: 'center', paddingHorizontal: Spacing.three },
});
