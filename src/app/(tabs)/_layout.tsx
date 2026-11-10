import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.primarySoft}
      tintColor={colors.primary}
      labelStyle={{ selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Practice</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="mic.fill" md="mic" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="talk">
        <NativeTabs.Trigger.Label>Talk</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" md="forum" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label>Report</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
