import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Divider, List, Switch } from 'react-native-paper';
import { colors, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    notificationsEnabled,
    setNotificationsEnabled,
    tempUnit,
    setTempUnit,
    tdsUnit,
    setTdsUnit,
    themePref,
    setThemePref,
    logout,
  } = useMockApp();

  return (
    <AppScreen contentStyle={{ paddingBottom: spacing.xxl }}>
      <AppHeader title="Settings" subtitle="Preferences and account" />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Account</List.Subheader>
        <List.Item title="Name" titleStyle={{ fontWeight: '700' }} description={user.firstName} descriptionStyle={{ color: colors.mutedStrong }} />
        <List.Item title="Email" titleStyle={{ fontWeight: '700' }} description={user.email} descriptionStyle={{ color: colors.mutedStrong }} />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Ponds & devices</List.Subheader>
        <List.Item title="Ponds" titleStyle={{ fontWeight: '700' }} description="Manage pond workspaces" onPress={() => router.push('/(tabs)/ponds')} />
        <List.Item title="Devices" titleStyle={{ fontWeight: '700' }} description="Roles, parents, diagnostics" onPress={() => router.push('/(tabs)/devices')} />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Notifications</List.Subheader>
        <List.Item
          title="Push alerts"
          titleStyle={{ fontWeight: '700' }}
          right={() => <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Units</List.Subheader>
        <List.Item
          title="Temperature"
          titleStyle={{ fontWeight: '700' }}
          description={tempUnit === 'C' ? '°C' : '°F'}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
        />
        <List.Item
          title="TDS"
          titleStyle={{ fontWeight: '700' }}
          description={tdsUnit === 'ppm' ? 'ppm' : 'EC (mock)'}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setTdsUnit(tdsUnit === 'ppm' ? 'ec' : 'ppm')}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Data sync</List.Subheader>
        <List.Item title="Sync status" titleStyle={{ fontWeight: '700' }} description="Mock: Active" descriptionStyle={{ color: colors.mutedStrong }} />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>App theme</List.Subheader>
        <List.Item
          title="Theme preference"
          titleStyle={{ fontWeight: '700' }}
          description={themePref}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setThemePref(themePref === 'light' ? 'system' : 'light')}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Support</List.Subheader>
        <List.Item title="Help & Support" titleStyle={{ fontWeight: '700' }} onPress={() => {}} />
        <List.Item title="About AquaNode" titleStyle={{ fontWeight: '700' }} description="v1.0.0 UI prototype" descriptionStyle={{ color: colors.mutedStrong }} />
      </List.Section>

      <View style={{ paddingVertical: spacing.xl }}>
        <List.Item
          title="Logout"
          titleStyle={{ color: colors.danger, fontWeight: '900' }}
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </View>
      <Text style={{ color: colors.mutedStrong, marginBottom: spacing.xxl, lineHeight: 20, fontSize: 13 }}>
        AquaNode is a UI-first prototype. Real cloud sync is not enabled.
      </Text>
    </AppScreen>
  );
}
