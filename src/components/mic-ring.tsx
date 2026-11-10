import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_SECONDS } from '@/lib/recorder';

const STROKE = 6;

type Props = {
  state: 'idle' | 'recording' | 'busy';
  onPress: () => void;
  onTimeout: () => void;
  disabled?: boolean;
  size?: number;
};

/** Filled mic disk inside a countdown ring; calls onTimeout once MAX_SECONDS have passed while recording. */
export function MicRing({ state, onPress, onTimeout, disabled, size = 208 }: Props) {
  const theme = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const R = (size - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const disk = size * 0.64;

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
  const color = recording ? theme.record : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      accessibilityState={{ disabled: disabled || state === 'busy', busy: state === 'busy' }}
      disabled={disabled || state === 'busy'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ring,
        { width: size, height: size, opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={R} fill={recording ? theme.backgroundSelected : theme.primarySoft} />
        {recording && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={C}
            strokeDashoffset={C * Math.min(elapsed / MAX_SECONDS, 1)}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[styles.disk, { width: disk, height: disk, borderRadius: disk / 2, backgroundColor: color }]}>
        {state === 'busy' ? (
          <ActivityIndicator size="large" color={theme.onPrimary} />
        ) : recording ? (
          <>
            <Icon name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }} size={disk * 0.26} color="#fff" />
            <ThemedText style={[styles.seconds, { fontSize: disk * 0.17, lineHeight: disk * 0.22 }]}>
              {Math.max(0, Math.ceil(MAX_SECONDS - elapsed))}
            </ThemedText>
          </>
        ) : (
          <Icon name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }} size={disk * 0.36} color={theme.onPrimary} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  disk: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  seconds: { color: '#fff', fontFamily: Fonts.rounded, fontWeight: 700 },
});
