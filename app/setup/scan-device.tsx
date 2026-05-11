import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActivityIndicator, Card } from 'react-native-paper';
import { mockBleDevices } from '../../constants/mockData';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { SetupStepCard } from '../../components/SetupStepCard';

export default function ScanDeviceScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setScanning(false), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <AppScreen>
      <AppHeader title="Scan device" onBack={() => router.back()} />

      <SetupStepCard
        step={2}
        totalSteps={6}
        title="Discover nearby hardware"
        description={
          'Mock BLE scan list. ' +
          // TODO: BLE scan integration
          ''
        }
      />

      <View style={{ marginTop: spacing.md, alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.muted, fontWeight: '700' }}>{scanning ? 'Scanning…' : 'Scan complete'}</Text>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {mockBleDevices.map((d) => (
          <Pressable key={d.id} onPress={() => router.push({ pathname: '/setup/wifi-provisioning', params: { name: d.name } })}>
            <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontWeight: '900', color: colors.navy }}>{d.name}</Text>
                  <Text style={{ marginTop: 4, color: colors.muted }}>RSSI {d.rssi} dBm</Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '900' }}>Select</Text>
              </Card.Content>
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <EmptyState variant="blePermission" onPrimaryPress={() => {}} />
      </View>
    </AppScreen>
  );
}
