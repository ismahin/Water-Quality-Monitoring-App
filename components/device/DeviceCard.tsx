import { Pressable, Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import type { NetworkDevice } from '../../types/networkDevice';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { formatAgo, formatSignalQuality } from '../../utils/pairingUtils';
import { PrimaryButton } from '../PrimaryButton';

type Props = {
  device: NetworkDevice;
  onDashboard: () => void;
};

function valueOrDash(value?: number, format?: (n: number) => string): string {
  return typeof value === 'number' ? (format ? format(value) : String(value)) : '-';
}

export function DeviceCard({ device, onDashboard }: Props) {
  const latest = device.latest;
  const status = device.status;
  const onlineLabel = device.online === null ? 'Unknown' : device.online ? 'Online' : 'Offline';
  const signal = formatSignalQuality(status?.rssi ?? latest?.rssi);
  const childStatusLabel =
    status?.pair_stage === 'PAIR_ACCEPTED_WAITING_ACK'
      ? 'Pairing accepted, waiting for child ACK'
      : status?.pair_stage === 'PAIR_SAVED_WAITING_TEST' || (status?.pair_confirmed === true && status?.telemetry_received !== true)
        ? 'Paired, waiting for first data'
        : status?.lifecycle_state === 'ACTIVE' || status?.telemetry_received === true
          ? 'Active'
          : status?.lifecycle_state === 'STALE'
            ? 'Stale'
            : status?.lifecycle_state === 'OFFLINE'
              ? 'Offline'
              : null;

  return (
    <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, ...shadows.soft }}>
      <Card.Content style={{ gap: spacing.md }}>
        <Pressable onPress={onDashboard} accessibilityRole="button">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.navy, fontSize: 18, fontWeight: '900' }}>
                {device.id}
              </Text>
              <Text style={{ marginTop: 4, color: colors.mutedStrong, fontWeight: '700' }}>
                Parent {latest?.parent_id || status?.parent_id || '-'} · Root {latest?.root_gateway_id || status?.root_gateway_id || '-'}
              </Text>
              {childStatusLabel ? (
                <Text style={{ marginTop: 4, color: colors.warning, fontWeight: '800' }}>{childStatusLabel}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Chip compact style={{ backgroundColor: device.online ? '#DCFCE7' : '#FEF3C7' }} textStyle={{ fontWeight: '800', fontSize: 11 }}>
                {onlineLabel}
              </Chip>
              <Chip compact style={{ backgroundColor: '#E0F2FE' }} textStyle={{ fontWeight: '800', fontSize: 11 }}>
                {device.displayRole}
              </Chip>
            </View>
          </View>

          <View style={{ marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>pH {valueOrDash(latest?.ph, (n) => n.toFixed(2))}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>TDS {valueOrDash(latest?.tds, (n) => `${Math.round(n)} ppm`)}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Temp {valueOrDash(latest?.temperature, (n) => `${n.toFixed(1)} C`)}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Turbidity {valueOrDash(latest?.turbidity, (n) => `${Math.round(n)} NTU`)}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Battery {valueOrDash(status?.battery ?? latest?.battery, (n) => `${Math.round(n)}%`)}</Text>
          </View>

          <Text style={{ marginTop: spacing.sm, color: colors.muted, fontSize: 12, fontWeight: '700' }}>
            Last seen {formatAgo(device.lastSeenMs)} · Signal {signal}
            {typeof (status?.rssi ?? latest?.rssi) === 'number' ? ` (${status?.rssi ?? latest?.rssi} dBm)` : ''}
          </Text>
        </Pressable>

        <PrimaryButton label="View Dashboard" onPress={onDashboard} />
      </Card.Content>
    </Card>
  );
}
