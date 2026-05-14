import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { AlertTriangle, Radio, WifiOff } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../constants/theme';

export type LoRaStatusCardProps = {
  enabled: boolean;
  initialized: boolean;
  gatewayReady: boolean;
  frequencyMhz?: number;
  packetCount?: number;
  lastRssi?: number;
  lastSnr?: number;
  lastError?: string;
  lastPayload?: string;
};

export function LoRaStatusCard({
  enabled,
  initialized,
  gatewayReady,
  frequencyMhz,
  packetCount,
  lastRssi,
  lastSnr,
  lastError,
  lastPayload,
}: LoRaStatusCardProps) {
  let tone: 'neutral' | 'success' | 'danger' = 'neutral';
  let Icon = Radio;
  let title = 'LoRa';
  let subtitle = '';

  if (!enabled) {
    Icon = WifiOff;
    title = 'LoRa Disabled';
    subtitle = 'Single mode active';
    tone = 'neutral';
  } else if (initialized && gatewayReady) {
    Icon = Radio;
    title = 'LoRa Gateway Ready';
    subtitle =
      typeof frequencyMhz === 'number'
        ? `SX1278 initialized at ${frequencyMhz} MHz`
        : 'SX1278 initialized — gateway listening';
    tone = 'success';
  } else {
    Icon = AlertTriangle;
    title = 'LoRa Module Error';
    subtitle =
      lastError && lastError !== 'none' ? lastError : 'Check SX1278 wiring, 3.3V, GND, NSS, RST, DIO0, SPI pins and antenna.';
    tone = 'danger';
  }

  const border =
    tone === 'success'
      ? 'rgba(6, 182, 212, 0.45)'
      : tone === 'danger'
        ? 'rgba(239, 68, 68, 0.4)'
        : colors.border;
  const bg =
    tone === 'success' ? '#ECFEFF' : tone === 'danger' ? '#FEF2F2' : colors.surfaceMuted;
  const iconColor = tone === 'success' ? colors.secondary : tone === 'danger' ? colors.danger : colors.mutedStrong;

  return (
    <Card style={{ borderRadius: radius.lg, ...shadows.soft, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Icon size={26} color={iconColor} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>{title}</Text>
            <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }}>{subtitle}</Text>
          </View>
        </View>
        {enabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs }}>
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
              Frequency: {typeof frequencyMhz === 'number' ? `${frequencyMhz} MHz` : '—'}
            </Text>
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
              Packets: {typeof packetCount === 'number' ? packetCount : '—'}
            </Text>
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
              RSSI: {typeof lastRssi === 'number' ? `${lastRssi} dBm` : '—'}
            </Text>
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
              SNR: {typeof lastSnr === 'number' ? `${lastSnr.toFixed(1)} dB` : '—'}
            </Text>
          </View>
        ) : null}
        {lastPayload && enabled && gatewayReady ? (
          <Text style={{ color: colors.mutedStrong, fontSize: 11, fontFamily: 'monospace' }} numberOfLines={2}>
            Last payload: {lastPayload}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}
