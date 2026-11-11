import { CameraView, useCameraPermissions } from 'expo-camera';
import type { RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { active: boolean; recording: boolean; style?: ViewStyle; cameraRef?: RefObject<CameraView | null> };

/** Live front-camera mirror. No video is recorded; the Talk tab takes one still per answer through `cameraRef`. */
export function SelfView({ active, recording, style, cameraRef }: Props) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const border = { borderColor: recording ? theme.record : theme.backgroundSelected };

  if (!permission?.granted)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={requestPermission}
        style={[styles.box, border, styles.empty, { backgroundColor: theme.backgroundSelected }, style]}>
        <Icon name={{ ios: 'person.crop.square', android: 'video_camera_front', web: 'video_camera_front' }} size={22} color={theme.primary} />
        <ThemedText type="small" themeColor="primary" style={{ textAlign: 'center' }}>Show my face</ThemedText>
      </Pressable>
    );

  return (
    <View style={[styles.box, border, style]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mute
        active={active}
        animateShutter={false}
        // A small still keeps the upload fast and the image cheap for Claude to read.
        pictureSize={Platform.OS === 'ios' ? '640x480' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 96, height: 128, borderRadius: Radius.button, overflow: 'hidden', borderWidth: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
});
