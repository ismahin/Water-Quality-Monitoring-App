import { Pressable, Text, View } from 'react-native';
import { Cpu, Radio, Router, Waypoints } from 'lucide-react-native';
import type { AquaDevice } from '../types/device';
import { usesLoraUi, usesWifiUi } from '../types/device';
import { colors, radius, roleAccent, shadows, spacing } from '../constants/theme';
import { formatRelativeTime } from '../utils/formatTime';
import { BatteryIndicator } from './BatteryIndicator';
import { loraQualityFromMetrics, wifiQualityFromRssi } from '../utils/statusUtils';

type Props = {
  device: AquaDevice;
  depth: number;
  isLast: boolean;
  onPress?: () => void;
};

function RoleIcon({ role }: { role: AquaDevice['role'] }) {
  const c = roleAccent[role];
  switch (role) {
    case 'gateway':
      return <Router size={18} color={c} />;
    case 'relay':
      return <Waypoints size={18} color={c} />;
    case 'child':
      return <Cpu size={18} color={c} />;
    case 'single':
      return <Radio size={18} color={c} />;
  }
}

export function NodeCard({ device, depth, isLast, onPress }: Props) {
  const online = device.online === 'online';
  const accent = roleAccent[device.role];
  const signal =
    usesWifiUi(device) ? wifiQualityFromRssi(device.wifiRssi) : usesLoraUi(device)
      ? loraQualityFromMetrics({
          rssi: device.loraRssi,
          snr: device.loraSnr,
          packetSuccess: device.packetSuccessPercent,
        })
      : 'Good';

  const content = (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <View
          style={{
            width: 2,
            flex: 1,
            backgroundColor: depth === 0 ? 'transparent' : '#CBD5E1',
            borderRadius: 2,
          }}
        />
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: online ? colors.success : colors.danger,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
        <View
          style={{
            width: 2,
            flex: 1,
            backgroundColor: isLast ? 'transparent' : '#CBD5E1',
            borderRadius: 2,
          }}
        />
      </View>
      <View style={{ flex: 1, paddingBottom: spacing.md, paddingLeft: spacing.sm }}>
        <View
          style={{
            borderRadius: radius.xl,
            backgroundColor: colors.card,
            padding: spacing.md,
            ...shadows.soft,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: accent,
            minHeight: 88,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RoleIcon role={device.role} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>{device.name}</Text>
                <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' }}>
                  {signal} link
                </Text>
              </View>
            </View>
            <BatteryIndicator percent={device.batteryPercent} compact />
          </View>
          <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' }}>
            Last seen {formatRelativeTime(device.lastSeenAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={4} style={{ minHeight: 48 }}>
        {content}
      </Pressable>
    );
  }
  return content;
}
