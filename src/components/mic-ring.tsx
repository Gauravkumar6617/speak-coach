import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ACCENT, RED } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { MAX_SECONDS } from '@/lib/recorder';

const STROKE = 10;

type Props = {
  state: 'idle' | 'recording' | 'busy';
  onPress: () => void;
  onTimeout: () => void;
  disabled?: boolean;
  size?: number;
};

/** Mic button with a countdown ring; calls onTimeout once MAX_SECONDS have passed while recording. */
export function MicRing({ state, onPress, onTimeout, disabled, size: SIZE = 200 }: Props) {
  const theme = useTheme();
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== 'recording') return;
    const started = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) onTimeout();
    }, 200);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when recording starts/stops
  }, [state]);

  const recording = state === 'recording';
  const progress = recording ? Math.min(elapsed / MAX_SECONDS, 1) : 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      disabled={disabled || state === 'busy'}
      onPress={onPress}
      style={[styles.ring, { width: SIZE, height: SIZE, opacity: disabled ? 0.4 : 1 }]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.backgroundSelected} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={recording ? RED : ACCENT}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      {state === 'busy' ? (
        <ActivityIndicator size="large" />
      ) : recording ? (
        <>
          <ThemedText type="subtitle">{Math.max(0, Math.ceil(MAX_SECONDS - elapsed))}s</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Tap to stop</ThemedText>
        </>
      ) : (
        <>
          <ThemedText style={{ fontSize: 48, lineHeight: 56 }}>🎙️</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Tap to speak</ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
