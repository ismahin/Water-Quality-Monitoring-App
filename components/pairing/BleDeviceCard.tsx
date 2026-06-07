import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import type { PairingBleDevice } from '../../types/pairing';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { PrimaryButton } from '../PrimaryButton';

type Props = {
  device: PairingBleDevice;
  loading?: boolean;
  onConnect: () => void;
};

export function BleDeviceCard({ device, loading, onConnect }: Props) {
  return (
    <Card style={{ borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.soft }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>{device.name}</Text>
        <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Device ID: {device.deviceId}</Text>
        <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>RSSI: {device.rssi} dBm</Text>
        <PrimaryButton label="Connect" loading={loading} disabled={loading} onPress={onConnect} />
      </Card.Content>
    </Card>
  );
}

