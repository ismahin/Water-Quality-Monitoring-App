import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, Snackbar } from 'react-native-paper';
import { getDeviceById, mockPhTrend } from '../../constants/mockData';
import type { SensorKind } from '../../types/sensor';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { seriesMinMaxAvg } from '../../utils/sensorUtils';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SensorChart } from '../../components/SensorChart';

const ranges = ['1H', '24H', '7D', '30D'] as const;

export default function SensorHistoryScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();
  const id = String(deviceId ?? 'm1');
  const device = getDeviceById(id);
  const [range, setRange] = useState<(typeof ranges)[number]>('24H');
  const [sensor, setSensor] = useState<SensorKind>('ph');
  const [snack, setSnack] = useState(false);

  const series = useMemo(() => {
    // Mock series per sensor (simple transforms)
    const base = mockPhTrend();
    if (sensor === 'ph') return base;
    if (sensor === 'tds') return base.map((p) => ({ ...p, value: p.value * 48 }));
    if (sensor === 'temperature') return base.map((p) => ({ ...p, value: 26 + p.value * 0.35 }));
    return base.map((p) => ({ ...p, value: 10 + p.value * 2.2 }));
  }, [sensor]);

  const stats = useMemo(() => seriesMinMaxAvg(series), [series]);

  if (!device) {
    return (
      <AppScreen>
        <AppHeader title="Sensor history" onBack={() => router.back()} />
        <Text style={{ color: colors.muted }}>Device not found.</Text>
      </AppScreen>
    );
  }

  const suffix = sensor === 'tds' ? ' ppm' : sensor === 'temperature' ? ' °C' : sensor === 'turbidity' ? ' NTU' : '';

  return (
    <AppScreen>
      <AppHeader title="Sensor history" subtitle={device.name} onBack={() => router.back()} />

      <Text style={{ fontWeight: '900', color: colors.navy, marginBottom: spacing.sm }}>Time range</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ranges.map((r) => (
          <Chip key={r} selected={range === r} onPress={() => setRange(r)}>
            {r}
          </Chip>
        ))}
      </View>

      <Text style={{ fontWeight: '900', color: colors.navy, marginTop: spacing.lg, marginBottom: spacing.sm }}>Sensor</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['ph', 'tds', 'temperature', 'turbidity'] as const).map((s) => (
          <Chip key={s} selected={sensor === s} onPress={() => setSensor(s)}>
            {s.toUpperCase()}
          </Chip>
        ))}
      </View>

      <Card style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content>
          <SensorChart data={series} height={200} ySuffix={suffix} />
        </Card.Content>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <Card style={{ flex: 1, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>Min</Text>
            <Text style={{ marginTop: 6, fontWeight: '900', color: colors.navy }}>{stats.min.toFixed(2)}</Text>
          </Card.Content>
        </Card>
        <Card style={{ flex: 1, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>Avg</Text>
            <Text style={{ marginTop: 6, fontWeight: '900', color: colors.navy }}>{stats.avg.toFixed(2)}</Text>
          </Card.Content>
        </Card>
        <Card style={{ flex: 1, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>Max</Text>
            <Text style={{ marginTop: 6, fontWeight: '900', color: colors.navy }}>{stats.max.toFixed(2)}</Text>
          </Card.Content>
        </Card>
      </View>

      <PrimaryButton label="Export CSV (mock)" style={{ marginTop: spacing.lg }} onPress={() => setSnack(true)} />
      <Snackbar visible={snack} onDismiss={() => setSnack(false)} duration={2000}>
        Export queued (mock)
      </Snackbar>
    </AppScreen>
  );
}
