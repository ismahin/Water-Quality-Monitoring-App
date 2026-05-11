import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Divider } from 'react-native-paper';
import { CloudOff, CloudCheck } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getDeviceById, getParentName } from '../../constants/mockData';
import { usesLoraUi, usesWifiUi } from '../../types/device';
import { formatRelativeTime } from '../../utils/formatTime';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { BatteryIndicator } from '../../components/BatteryIndicator';
import { DestructiveButton } from '../../components/DestructiveButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';
import { StatusChip } from '../../components/StatusChip';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const device = getDeviceById(String(id));

  if (!device) {
    return (
      <AppScreen>
        <AppHeader title="Device" onBack={() => router.back()} />
        <Text style={{ color: colors.mutedStrong }}>Device not found.</Text>
      </AppScreen>
    );
  }

  const parentName = 'parentId' in device ? getParentName(device) : undefined;
  const showCloudStrip =
    usesWifiUi(device) && device.online === 'online' && device.role === 'gateway';

  return (
    <AppScreen>
      <AppHeader title={device.name} subtitle={`Role: ${device.role}`} onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusChip label={device.online === 'online' ? 'Online' : 'Offline'} tone={device.online === 'online' ? 'success' : 'danger'} />
        <BatteryIndicator percent={device.batteryPercent} />
      </View>

      {showCloudStrip ? (
        <Card
          style={{
            marginTop: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: device.cloudOnline ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.45)',
            backgroundColor: device.cloudOnline ? '#ECFDF5' : '#FFFBEB',
            ...shadows.soft,
          }}
        >
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {device.cloudOnline ? (
              <CloudCheck size={22} color={colors.success} />
            ) : (
              <CloudOff size={22} color={colors.warning} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>
                {device.cloudOnline ? 'Cloud sync active' : 'Wi‑Fi OK · Cloud unreachable'}
              </Text>
              <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }}>
                {device.cloudOnline
                  ? 'Telemetry is uploading on schedule.'
                  : 'Gateway is on your LAN but the cloud endpoint is not reachable (mock).'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {usesWifiUi(device) ? (
        <Card
          style={{
            marginTop: spacing.md,
            borderRadius: radius.xl,
            ...shadows.soft,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Wi‑Fi</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>SSID: {device.wifiSsid}</Text>
            <SignalStrengthBar type="wifi" rssi={device.wifiRssi} showLabels={false} />
            {device.role !== 'gateway' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Cloud: {device.cloudOnline ? 'Online' : 'Offline'}
              </Text>
            ) : null}
            {device.role === 'gateway' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                LoRa gateway: {device.loraGatewayEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {usesLoraUi(device) ? (
        <Card
          style={{
            marginTop: spacing.md,
            borderRadius: radius.xl,
            ...shadows.soft,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>LoRa uplink</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Parent: {parentName ?? device.parentId}</Text>
            <SignalStrengthBar
              type="lora"
              rssi={device.loraRssi}
              snr={device.loraSnr}
              packetSuccess={device.packetSuccessPercent}
            />
            {device.role === 'relay' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Child nodes: {device.childDeviceIds.length}</Text>
            ) : null}
            {device.role === 'child' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Last packet: {formatRelativeTime(device.lastDataAt)}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <Card
        style={{
          marginTop: spacing.md,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: 8 }}>
          <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Sensors</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>pH {device.sensors.ph.toFixed(2)}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>TDS {Math.round(device.sensors.tdsPpm)} ppm</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Temp {device.sensors.temperatureC.toFixed(1)} °C</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Turbidity {Math.round(device.sensors.turbidityNtu)} NTU</Text>
          <Divider style={{ marginVertical: spacing.sm }} />
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
            Calibration: {device.calibrationStatus}{' '}
            {device.calibrationDueAt ? `(due ${new Date(device.calibrationDueAt).toLocaleDateString()})` : ''}
          </Text>
        </Card.Content>
      </Card>

      {device.role === 'gateway' ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton label="View Network Tree" onPress={() => router.push({ pathname: '/device/network-tree', params: { deviceId: device.id } })} />
          <SecondaryButton label="Add Child Node" onPress={() => router.push('/setup/add-child-node')} />
          <SecondaryButton label="Run Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <SecondaryButton label="Sensor Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Firmware Update" onPress={() => router.push({ pathname: '/device/firmware-update', params: { deviceId: device.id } })} />
          <DestructiveButton label="Remove device" onPress={() => {}} />
        </View>
      ) : null}

      {device.role === 'relay' ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton label="Add Child Under This Relay" onPress={() => router.push('/setup/add-child-node')} />
          <SecondaryButton label="LoRa Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { deviceId: device.id } })} />
          <SecondaryButton label="Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <DestructiveButton label="Remove / Re-pair" onPress={() => {}} />
        </View>
      ) : null}

      {device.role === 'child' ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="LoRa Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { deviceId: device.id } })} />
          <SecondaryButton label="Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
        </View>
      ) : null}

      {device.role === 'single' ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="Sensor Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <SecondaryButton label="Firmware Update" onPress={() => router.push({ pathname: '/device/firmware-update', params: { deviceId: device.id } })} />
        </View>
      ) : null}
    </AppScreen>
  );
}
