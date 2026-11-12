import { CameraView, useCameraPermissions } from 'expo-camera';
import type { RefObject } from 'react';
import { Linking, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

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
        // Once the user denies, the OS won't show the prompt again; send them to Settings instead of silently doing nothing.
        onPress={permission?.canAskAgain === false ? () => Linking.openSettings() : requestPermission}
        style={[styles.box, border, styles.empty, { backgroundColor: theme.backgroundSelected }, style]}>
        <Icon name={{ ios: 'person.crop.square', android: 'video_camera_front', web: 'video_camera_front' }} size={22} color={theme.primary} />
        <ThemedText type="small" themeColor="primary" style={{ textAlign: 'center' }}>Show my face</ThemedText>
      </Pressable>
    );

  return (
    <View style={[styles.box, border, style]}>
      {/* Mount only while visible: toggling `active` on a mounted view can leave the preview stuck, and an unmounted view frees the camera for the other tab. */}
      {active && <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
        // ponytail: no pictureSize, the iOS '640x480' preset was the prime suspect for the stuck camera; photos are full size. Resize before upload if Claude calls get slow.
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 96, height: 128, borderRadius: Radius.button, overflow: 'hidden', borderWidth: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
});
