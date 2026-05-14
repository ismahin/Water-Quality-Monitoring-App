import { Pressable, Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import { Radio, Router, Wifi } from 'lucide-react-native';
import type { AquaDevice } from '../types/device';
import { usesLoraUi, usesWifiUi, type GatewayDevice, type SingleDevice } from '../types/device';
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

function firebaseModeLabel(device: AquaDevice): string {
  if (usesWifiUi(device)) {
    const d = device as SingleDevice | GatewayDevice;
    if (d.firebaseRole) return d.firebaseRole;
  }
  return roleLabel(device.role).toUpperCase();
}

function wifiDeviceTagline(device: AquaDevice): string | null {
  if (!usesWifiUi(device)) return null;
  const d = device as SingleDevice | GatewayDevice;
  if (d.role === 'gateway') {
    if (d.loraGatewayEnabled) return 'LoRa Gateway Ready';
    if (d.loraEnabled === true) return 'LoRa Module Error';
    return 'Gateway (LoRa off)';
  }
  if (d.loraEnabled === false) return 'Standalone Wi-Fi Device';
  if (d.role === 'single' && d.firebaseRole === 'GATEWAY') return 'LoRa Gateway Ready';
  return null;
}

export function DeviceStatusCard({ device, parentName, onPress }: Props) {
  const onlineLabel = device.online === 'online' ? 'Online' : device.online === 'warning' ? 'Stale' : 'Offline';
  const tone: StatusTone = device.online === 'online' ? 'success' : device.online === 'warning' ? 'warning' : 'danger';
  const accent = roleAccent[device.role];
  const modeLabel = firebaseModeLabel(device);
  const tagline = wifiDeviceTagline(device);
  const cmd =
    usesWifiUi(device) && (device as SingleDevice | GatewayDevice).commandStream
      ? (device as SingleDevice | GatewayDevice).commandStream
      : null;

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
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip
                compact
                style={{
                  backgroundColor: modeLabel === 'GATEWAY' ? '#CFFAFE' : '#E0F2FE',
                  height: 28,
                }}
                textStyle={{ fontSize: 11, fontWeight: '800', color: colors.navy }}
              >
                {modeLabel}
              </Chip>
              {tagline ? (
                <Chip
                  compact
                  style={{ backgroundColor: colors.surfaceMuted, height: 28 }}
                  textStyle={{ fontSize: 11, fontWeight: '700', color: colors.mutedStrong }}
                >
                  {tagline}
                </Chip>
              ) : null}
            </View>
            {parentName ? (
              <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 12 }}>Parent: {parentName}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <StatusChip label={onlineLabel} tone={tone} />
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
          {usesWifiUi(device) && cmd ? (
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>
              Command stream: {cmd === 'connected' ? 'Connected' : cmd === 'disconnected' ? 'Disconnected' : cmd}
            </Text>
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
