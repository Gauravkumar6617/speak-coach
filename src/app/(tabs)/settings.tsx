import * as Sharing from 'expo-sharing';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui';
import { Radius, Spacing, useTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { config } from '@/lib/api';
import { deleteAllSessions, sessionsFile } from '@/lib/store';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ paddingHorizontal: Spacing.three }}>{title}</ThemedText>
      <View style={[styles.group, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, ok, first }: { label: string; value: string; ok: boolean; first?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.backgroundSelected }]}>
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      <ThemedText themeColor={ok ? 'textSecondary' : 'bad'} numberOfLines={1} style={{ maxWidth: '55%' }}>{value}</ThemedText>
    </View>
  );
}

function Action({ label, icon, onPress, danger, first }: { label: string; icon: IconName; onPress: () => void; danger?: boolean; first?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.bad : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.6 : 1 },
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.backgroundSelected },
      ]}>
      <Icon name={icon} size={18} color={color} />
      <ThemedText style={{ color, flex: 1 }}>{label}</ThemedText>
    </Pressable>
  );
}

const secret = (v: string) => (v ? `Set (…${v.slice(-4)})` : 'Missing');

export default function Settings() {
  const theme = useTheme();
  const tabInset = useTabInset();

  async function exportJson() {
    if (!sessionsFile.exists) return Alert.alert('Nothing to export yet', 'Record a session on the Practice tab first.');
    await Sharing.shareAsync(sessionsFile.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export sessions' });
  }

  function deleteAll() {
    Alert.alert('Delete all sessions?', 'Your scores, streak and history will be removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => deleteAllSessions() },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: tabInset + Spacing.four }]}>
        <ThemedText type="title">Settings</ThemedText>

        <Group title="Speech recognition (Azure)">
          <Row first label="Key" value={secret(config.azureKey)} ok={!!config.azureKey} />
          <Row label="Region" value={config.azureRegion || 'Missing'} ok={!!config.azureRegion} />
          <Row label="Language" value={config.azureLocale} ok />
        </Group>

        <Group title="Feedback (Claude)">
          <Row first label="Key" value={secret(config.anthropicKey)} ok={!!config.anthropicKey} />
          <Row label="Feedback model" value={config.anthropicModel} ok />
          <Row label="Talk model" value={config.anthropicFastModel} ok />
        </Group>

        <ThemedText type="small" themeColor="textSecondary" style={{ paddingHorizontal: Spacing.three }}>
          Keys are read from the .env file when the app is built. After changing .env, restart the dev server or rebuild.
        </ThemedText>

        <Group title="Your data">
          <Action first label="Export sessions as JSON" icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }} onPress={exportJson} />
          <Action danger label="Delete all sessions" icon={{ ios: 'trash', android: 'delete', web: 'delete' }} onPress={deleteAll} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.four },
  group: { borderRadius: Radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 14 },
});
