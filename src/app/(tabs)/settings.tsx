import * as Sharing from 'expo-sharing';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, GREEN, RED } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { config } from '@/lib/api';
import { deleteAllSessions, sessionsFile } from '@/lib/store';

function KeyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      <ThemedText style={{ color: value ? GREEN : RED }}>{value ? (secret ? 'Set' : value) : 'Missing'}</ThemedText>
    </View>
  );
}

export default function Settings() {
  const theme = useTheme();

  async function exportJson() {
    if (!sessionsFile.exists) return Alert.alert('Nothing to export', 'Record a session first.');
    await Sharing.shareAsync(sessionsFile.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export sessions' });
  }

  function deleteAll() {
    Alert.alert('Delete all sessions?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => deleteAllSessions() },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <ThemedText type="subtitle">Settings</ThemedText>
        <Card title="Claude">
          <KeyRow label="API key" value={config.anthropicKey} secret />
          <KeyRow label="Model" value={config.anthropicModel} />
        </Card>
        <Card title="Azure Speech">
          <KeyRow label="Key" value={config.azureKey} secret />
          <KeyRow label="Region" value={config.azureRegion} />
          <KeyRow label="Locale" value={config.azureLocale} />
        </Card>
        <ThemedText type="small" themeColor="textSecondary">
          Keys come from the .env file at build time. Edit .env and restart the dev server to change them.
        </ThemedText>
        <Card title="Data">
          <Button title="Export JSON" onPress={exportJson} />
          <Button title="Delete all sessions" color={RED} onPress={deleteAll} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center' },
});
