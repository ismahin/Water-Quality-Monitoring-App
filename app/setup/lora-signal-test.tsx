import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { formatRelativeTime } from '../../utils/formatTime';
import { loraQualityFromMetrics } from '../../utils/statusUtils';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { LoRaStatusCard } from '../../components/LoRaStatusCard';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';

export default function LoraSignalTestScreen() {
  const router = useRouter();
  const { deviceId, gatewayId } = useLocalSearchParams<{ deviceId?: string; gatewayId?: string }>();
  const { getGatewayChildren, devices } = useMockApp();
  const id = String(deviceId ?? '');
  const gateway = String(gatewayId ?? devices.find((d) => d.role === 'gateway' && d.isLive)?.id ?? 'M1');
  const liveNodes = getGatewayChildren(gateway);
  const node = useMemo(() => {
    if (id) return liveNodes.find((d) => d.id === id || d.sourceId === id) ?? devices.find((d) => d.id === id);
    return liveNodes[0];
  }, [devices, id, liveNodes]);

  const rssi = node?.childRssi ?? node?.gatewayRssi ?? ('loraRssi' in (node ?? {}) ? (node as { loraRssi?: number }).loraRssi : undefined);
  const snr = node?.childSnr ?? node?.gatewaySnr ?? ('loraSnr' in (node ?? {}) ? (node as { loraSnr?: number }).loraSnr : undefined);
  const packetSuccess = 'packetSuccessPercent' in (node ?? {}) ? (node as { packetSuccessPercent?: number }).packetSuccessPercent ?? 0 : 0;
  const quality =
    typeof rssi === 'number' && typeof snr === 'number'
      ? loraQualityFromMetrics({ rssi, snr, packetSuccess: packetSuccess || 100 })
      : 'No packets';

  return (
    <AppScreen>
      <AppHeader title="LoRa signal test" subtitle={node ? node.id : `Gateway ${gateway}`} onBack={() => router.back()} />

      {node ? (
        <>
          <LoRaStatusCard
            enabled
            ready={node.loraStatus !== 'error'}
            childRssi={node.childRssi}
            childSnr={node.childSnr}
            gatewayRssi={node.gatewayRssi}
            gatewaySnr={node.gatewaySnr}
            lastRssi={rssi}
            lastSnr={snr}
            packetCount={node.isLive ? 1 : 0}
            error={node.loraLastError}
            showNoPacketMessage={!node.isLive}
          />

          <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>Live signal</Text>
              <Text style={{ color: colors.mutedStrong }}>Recommended: {quality}</Text>
              <Text style={{ color: colors.mutedStrong }}>Last seen: {formatRelativeTime(node.lastDataAt)}</Text>
              {typeof rssi === 'number' && typeof snr === 'number' ? (
                <SignalStrengthBar type="lora" rssi={rssi} snr={snr} packetSuccess={packetSuccess || 100} />
              ) : null}
            </Card.Content>
          </Card>
        </>
      ) : (
        <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' }}>
          <Card.Content>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>No LoRa packet received yet.</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong, lineHeight: 20 }}>
              Waiting for a child packet under devices/{gateway}/children.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <SecondaryButton label="Back to devices" onPress={() => router.replace('/(tabs)/devices')} />
      </View>
    </AppScreen>
  );
}
