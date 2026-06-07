import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { DeviceCard } from '../../components/device/DeviceCard';
import { colors, radius, spacing } from '../../constants/theme';
import { useDevices } from '../../hooks/useDevices';

export default function NetworkDevicesScreen() {
  const router = useRouter();
  const { devices, loading, error, networkId, setNetworkId } = useDevices();

  return (
    <AppScreen>
      <AppHeader title="Network Devices" subtitle="Devices under the new networks/{networkId}/devices Firebase path." onBack={() => router.back()} />

      <Card style={{ borderRadius: radius.lg, backgroundColor: colors.card, marginBottom: spacing.md }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.navy, fontWeight: '900' }}>Network ID</Text>
          <TextInput
            mode="outlined"
            value={networkId}
            autoCapitalize="characters"
            onChangeText={(value) => void setNetworkId(value)}
          />
        </Card.Content>
      </Card>

      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator />
          <Text style={{ color: colors.mutedStrong }}>Loading network devices...</Text>
        </View>
      ) : null}
      {error ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text> : null}
      {!loading && devices.length === 0 ? (
        <Text style={{ color: colors.mutedStrong }}>
          No devices found at networks/{networkId}/devices. Confirm the Gateway is uploading to the new Firebase paths.
        </Text>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onDashboard={() => router.push({ pathname: '/devices/[deviceId]', params: { deviceId: device.id, networkId } })}
          />
        ))}
      </View>
    </AppScreen>
  );
}
