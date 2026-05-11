import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { Radio, Router, Wifi } from 'lucide-react-native';
import type { AquaDevice } from '../types/device';
import { usesLoraUi, usesWifiUi } from '../types/device';
import { colors, radius, roleAccent, shadows, spacing } from '../constants/theme';
import { formatRelativeTime } from '../utils/formatTime';
import { BatteryIndicator } from './BatteryIndicator';
import { SignalStrengthBar } from './SignalStrengthBar';
import { StatusChip, type StatusTone } from './StatusChip';

type Props = {
  device: AquaDevice;
  parentName?: string;
  onPress?: () => void;
};

function roleLabel(role: AquaDevice['role']): string {
  switch (role) {
    case 'gateway':
      return 'Gateway';
    case 'single':
      return 'Single';
    case 'relay':
      return 'Relay';
    case 'child':
      return 'Child';
  }
}

export function DeviceStatusCard({ device, parentName, onPress }: Props) {
  const online = device.online === 'online';
  const tone: StatusTone = online ? 'success' : 'danger';
  const accent = roleAccent[device.role];

  const body = (
    <Card
      style={{
        borderRadius: radius.xl,
        ...shadows.soft,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: 4, backgroundColor: accent, position: 'absolute', left: 0, top: 0, bottom: 0 }} />
      <Card.Content style={{ padding: spacing.md, paddingLeft: spacing.md + 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.navy }}>{device.name}</Text>
            <Text style={{ marginTop: 4, color: colors.mutedStrong, fontWeight: '700', fontSize: 13 }}>
              {roleLabel(device.role)}
            </Text>
            {parentName ? (
              <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 12 }}>Parent: {parentName}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <StatusChip label={online ? 'Online' : 'Offline'} tone={tone} />
            <BatteryIndicator percent={device.batteryPercent} compact />
          </View>
        </View>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {usesWifiUi(device) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Wifi size={17} color={colors.primary} />
              <Text style={{ color: colors.navy, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {device.wifiSsid}
              </Text>
            </View>
          ) : null}
          {usesLoraUi(device) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Radio size={17} color={colors.secondary} />
              <Text style={{ color: colors.navy, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                LoRa to {parentName ?? 'parent'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.md }}>
          {usesWifiUi(device) ? (
            <SignalStrengthBar type="wifi" rssi={device.wifiRssi} showLabels={false} />
          ) : usesLoraUi(device) ? (
            <SignalStrengthBar
              type="lora"
              rssi={device.loraRssi}
              snr={device.loraSnr}
              packetSuccess={device.packetSuccessPercent}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Router size={15} color={colors.mutedStrong} />
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '600' }}>Last data</Text>
          </View>
          <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 13 }}>{formatRelativeTime(device.lastDataAt)}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 48 }}>
        {body}
      </Pressable>
    );
  }
  return body;
}
