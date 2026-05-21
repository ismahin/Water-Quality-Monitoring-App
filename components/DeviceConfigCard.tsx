import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../constants/theme';
import type { UniversalDeviceConfig } from '../types/universalDevice';

type Props = {
  config?: Partial<UniversalDeviceConfig> | null;
};

function row(label: string, value?: string | number | boolean) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text style={{ color: colors.mutedStrong, fontWeight: '700', flex: 1 }}>{label}</Text>
      <Text selectable style={{ color: colors.navy, fontWeight: '900', flex: 1, textAlign: 'right' }}>
        {value === undefined || value === null || value === '' ? '-' : String(value)}
      </Text>
    </View>
  );
}

export function DeviceConfigCard({ config }: Props) {
  return (
    <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Device config</Text>
        {row('Device ID', config?.deviceId)}
        {row('Network ID', config?.networkId)}
        {row('Parent ID', config?.parentId)}
        {row('Root gateway', config?.rootGatewayId)}
        {row('Gateway uplink', config?.gatewayUplinkEnabled)}
        {row('Relay enabled', config?.relayEnabled)}
        {row('Sample interval', config?.sampleIntervalMs ? `${config.sampleIntervalMs} ms` : undefined)}
      </Card.Content>
    </Card>
  );
}
