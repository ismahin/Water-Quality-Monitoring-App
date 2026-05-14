import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { NotificationSnackbar } from '../../components/NotificationSnackbar';
import { mockSignalHistory } from '../../constants/mockData';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { loraQualityFromMetrics } from '../../utils/statusUtils';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SensorChart } from '../../components/SensorChart';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';

export default function LoraSignalTestScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();
  const id = String(deviceId ?? 'c2');
  const [live, setLive] = useState(false);
  const [rssi, setRssi] = useState(-89);
  const [snr, setSnr] = useState(7.8);
  const [pkt, setPkt] = useState(96);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [snack, setSnack] = useState(false);

  const quality = useMemo(() => loraQualityFromMetrics({ rssi, snr, packetSuccess: pkt }), [pkt, rssi, snr]);

  useEffect(() => {
    if (!live) return undefined;
    timer.current = setInterval(() => {
      setRssi((v) => Math.min(-70, Math.max(-110, v + (Math.random() - 0.5) * 4)));
      setSnr((v) => Math.min(12, Math.max(1, v + (Math.random() - 0.5) * 0.8)));
      setPkt((v) => Math.min(99, Math.max(80, v + (Math.random() - 0.5) * 2)));
    }, 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live]);

  return (
    <AppScreen>
      <AppHeader title="LoRa signal test" subtitle={`Installation mode · ${id.toUpperCase()}`} onBack={() => router.back()} />

      <Card style={{ borderRadius: radius.xxl, ...shadows.card, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.md }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Live metrics (mock)</Text>
          <Text style={{ color: colors.muted }}>RSSI: {rssi.toFixed(0)} dBm</Text>
          <Text style={{ color: colors.muted }}>SNR: {snr.toFixed(1)} dB</Text>
          <Text style={{ color: colors.muted }}>Packet success: {pkt.toFixed(0)}%</Text>
          <Text style={{ color: colors.primary, fontWeight: '900' }}>Recommended: {quality}</Text>

          <View style={{ marginTop: spacing.md }}>
            <SignalStrengthBar type="lora" rssi={rssi} snr={snr} packetSuccess={pkt} />
          </View>
        </Card.Content>
      </Card>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Guidance</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>• Move higher for better antenna clearance</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>• Avoid metal enclosure near antenna</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            • Current position is good for stable data transfer
          </Text>
        </Card.Content>
      </Card>

      <Text style={{ marginTop: spacing.lg, fontWeight: '900', color: colors.navy }}>Signal history</Text>
      <SensorChart data={mockSignalHistory()} height={150} ySuffix=" dBm" />

      <PrimaryButton
        label={live ? 'Stop live test' : 'Start live test'}
        onPress={() => setLive((v) => !v)}
        style={{ marginTop: spacing.md }}
      />
      <SecondaryButton label="Save position" style={{ marginTop: spacing.sm }} onPress={() => setSnack(true)} />

      <NotificationSnackbar visible={snack} onDismiss={() => setSnack(false)} duration={2000} message="Saved install position (mock)" />
    </AppScreen>
  );
}
