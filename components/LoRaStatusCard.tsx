import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { AlertTriangle, Radio, WifiOff } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../constants/theme';

export type LoRaStatusCardProps = {
  enabled?: boolean;
  ready?: boolean;
  error?: string;
  initialized?: boolean;
  gatewayReady?: boolean;
  frequencyMhz?: number;
  packetCount?: number;
  lastRssi?: number;
  lastSnr?: number;
  lastError?: string;
  childRssi?: number;
  childSnr?: number;
  gatewayRssi?: number;
  gatewaySnr?: number;
  lastPayload?: string;
  showNoPacketMessage?: boolean;
};

function metric(label: string, value: string) {
  return (
    <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
      {label}: {value}
    </Text>
  );
}

export function LoRaStatusCard({
  enabled,
  ready,
  error,
  initialized,
  gatewayReady,
  frequencyMhz,
  packetCount,
  lastRssi,
  lastSnr,
  lastError,
  childRssi,
  childSnr,
  gatewayRssi,
  gatewaySnr,
  lastPayload,
  showNoPacketMessage,
}: LoRaStatusCardProps) {
  const isEnabled = enabled !== false;
  const isReady = ready ?? (initialized === true && gatewayReady === true);
  const effectiveError = error ?? lastError;

  let tone: 'neutral' | 'success' | 'danger' = 'neutral';
  let Icon = Radio;
  let title = 'LoRa';
  let subtitle = '';

  if (!isEnabled) {
    Icon = WifiOff;
    title = 'LoRa Disabled';
    subtitle = 'Single mode active';
  } else if (isReady) {
    Icon = Radio;
    title = 'LoRa Ready';
    subtitle =
      typeof frequencyMhz === 'number'
        ? `SX1278 initialized at ${frequencyMhz} MHz`
        : 'SX1278 initialized and listening';
    tone = 'success';
  } else {
    Icon = AlertTriangle;
    title = 'LoRa Module Error';
    subtitle =
      effectiveError && effectiveError !== 'none'
        ? effectiveError
        : 'Check SX1278 wiring, power, SPI pins, and antenna.';
    tone = 'danger';
  }

  const border =
    tone === 'success'
      ? 'rgba(6, 182, 212, 0.45)'
      : tone === 'danger'
        ? 'rgba(239, 68, 68, 0.4)'
        : colors.border;
  const bg = tone === 'success' ? '#ECFEFF' : tone === 'danger' ? '#FEF2F2' : colors.surfaceMuted;
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
        {isEnabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs }}>
            {metric('Frequency', typeof frequencyMhz === 'number' ? `${frequencyMhz} MHz` : '-')}
            {metric('Packets', typeof packetCount === 'number' ? String(packetCount) : '-')}
            {metric('RSSI', typeof lastRssi === 'number' ? `${lastRssi} dBm` : '-')}
            {metric('SNR', typeof lastSnr === 'number' ? `${lastSnr.toFixed(1)} dB` : '-')}
            {metric('Child RSSI', typeof childRssi === 'number' ? `${childRssi} dBm` : '-')}
            {metric('Child SNR', typeof childSnr === 'number' ? `${childSnr.toFixed(1)} dB` : '-')}
            {metric('Gateway RSSI', typeof gatewayRssi === 'number' ? `${gatewayRssi} dBm` : '-')}
            {metric('Gateway SNR', typeof gatewaySnr === 'number' ? `${gatewaySnr.toFixed(1)} dB` : '-')}
          </View>
        ) : null}
        {showNoPacketMessage && isReady && (!packetCount || packetCount <= 0) ? (
          <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>No LoRa packet received yet.</Text>
        ) : null}
        {lastPayload && isEnabled && isReady ? (
          <Text style={{ color: colors.mutedStrong, fontSize: 11, fontFamily: 'monospace' }} numberOfLines={2}>
            Last payload: {lastPayload}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}
