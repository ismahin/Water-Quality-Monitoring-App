import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator, Card, Checkbox } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { usesLoraUi, usesWifiUi } from '../../types/device';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

type Check = { key: string; label: string; ok: boolean };

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();
  const id = String(deviceId ?? 'm1');
  const device = getDeviceById(id);
  const [running, setRunning] = useState(false);

  const baseline = useMemo<Check[]>(() => {
    if (!device) return [];
    const rows: Check[] = [
      { key: 'sensors', label: 'Sensors detected', ok: true },
      { key: 'battery', label: 'Battery okay', ok: device.batteryPercent > 15 },
      { key: 'fw', label: 'Firmware up to date', ok: !device.availableFirmwareVersion },
    ];
    if (usesWifiUi(device)) {
      rows.push({ key: 'wifi', label: 'Wi‑Fi connected', ok: device.online === 'online' || device.online === 'warning' });
      rows.push({ key: 'cloud', label: 'Cloud reachable', ok: device.cloudOnline });
    }
    if (usesLoraUi(device)) {
      rows.push({ key: 'lora', label: 'LoRa module detected', ok: true });
    } else if (device.role === 'gateway') {
      rows.push({ key: 'loraG', label: 'LoRa gateway enabled', ok: device.loraGatewayEnabled });
    }
    return rows;
  }, [device]);

  const [checks, setChecks] = useState<Check[]>(baseline);

  useEffect(() => {
    setChecks(baseline);
  }, [baseline]);

  const run = () => {
    setRunning(true);
    setChecks(baseline.map((c) => ({ ...c, ok: false })));
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setChecks(baseline.map((c, idx) => ({ ...c, ok: idx < i ? baseline[idx]?.ok ?? false : false })));
      if (i >= baseline.length) {
        clearInterval(t);
        setRunning(false);
        setChecks(baseline);
      }
    }, 420);
  };

  if (!device) {
    return (
      <AppScreen>
        <AppHeader title="Diagnostics" onBack={() => router.back()} />
        <Text style={{ color: colors.muted }}>Device not found.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title="Diagnostics" subtitle={device.name} onBack={() => router.back()} />

      <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          {checks.map((c) => (
            <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Checkbox status={c.ok ? 'checked' : 'unchecked'} disabled />
              <Text style={{ color: colors.navy, fontWeight: '700', flex: 1 }}>{c.label}</Text>
            </View>
          ))}
          {running ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              <ActivityIndicator />
              <Text style={{ color: colors.muted }}>Running checks…</Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      <PrimaryButton label="Run Diagnostics" onPress={run} loading={running} style={{ marginTop: spacing.lg }} />

      <Card style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Suggestions</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>• Turbidity sensor signal is noisy</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            • LoRa RSSI is fair. Consider moving device higher.
          </Text>
        </Card.Content>
      </Card>
    </AppScreen>
  );
}
