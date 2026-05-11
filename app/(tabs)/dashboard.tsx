import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Chip, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { mockPhTrend } from '../../constants/mockData';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { formatRelativeTime } from '../../utils/formatTime';
import {
  phStatusLabel,
  tempStatusLabel,
  tdsStatusLabel,
  turbidityStatusLabel,
} from '../../utils/sensorUtils';
import { AppScreen } from '../../components/AppScreen';
import { DeviceStatusCard } from '../../components/DeviceStatusCard';
import { MetricCard } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { SensorChart } from '../../components/SensorChart';
import { StatusChip, type StatusTone } from '../../components/StatusChip';
import { WaterQualityScoreCard } from '../../components/WaterQualityScoreCard';
import { Droplets, Gauge, ThermometerSun, Waves } from 'lucide-react-native';

function toneForPh(ph: number): StatusTone {
  const s = phStatusLabel(ph);
  if (s === 'Normal') return 'success';
  return 'warning';
}

function toneForTds(ppm: number): StatusTone {
  return tdsStatusLabel(ppm) === 'Normal' ? 'success' : 'warning';
}

function toneForTemp(c: number): StatusTone {
  const s = tempStatusLabel(c);
  if (s === 'Comfortable' || s === 'Cool') return 'success';
  if (s === 'Warm') return 'warning';
  return 'danger';
}

function toneForTurb(ntu: number): StatusTone {
  const s = turbidityStatusLabel(ntu);
  if (s === 'Clear' || s === 'Normal') return 'success';
  if (s === 'Slightly Cloudy') return 'warning';
  return 'danger';
}

function pondScoreUi(health: 'good' | 'warning' | 'critical'): {
  label: string;
  tone: StatusTone;
  summary: string;
} {
  if (health === 'good') {
    return {
      label: 'Good',
      tone: 'success',
      summary: 'Pond is tracking in a healthy range.',
    };
  }
  if (health === 'warning') {
    return {
      label: 'Watch',
      tone: 'warning',
      summary: 'Review sensors and downstream nodes soon.',
    };
  }
  return {
    label: 'Critical',
    tone: 'danger',
    summary: 'Immediate attention recommended for this pond.',
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, ponds, devices, alerts } = useMockApp();
  const [pondId, setPondId] = useState('pond-a');
  const pond = useMemo(() => ponds.find((p) => p.id === pondId) ?? ponds[0], [pondId, ponds]);
  const pondDevices = useMemo(() => devices.filter((d) => pond.deviceIds.includes(d.id)), [devices, pond.deviceIds]);
  const gateway = useMemo(() => {
    const ids = pond.deviceIds;
    return (
      devices.find((d) => ids.includes(d.id) && d.role === 'gateway') ??
      devices.find((d) => ids.includes(d.id) && d.role === 'single') ??
      devices.find((d) => ids.includes(d.id))
    );
  }, [devices, pond.deviceIds]);

  const net = useMemo(
    () => ({
      gateways: pondDevices.filter((d) => d.role === 'gateway').length,
      relays: pondDevices.filter((d) => d.role === 'relay').length,
      children: pondDevices.filter((d) => d.role === 'child').length,
      singles: pondDevices.filter((d) => d.role === 'single').length,
      active: pondDevices.filter((d) => d.online === 'online').length,
    }),
    [pondDevices],
  );

  const pondAlerts = useMemo(() => alerts.filter((a) => a.pondId === pond.id && !a.resolved).slice(0, 3), [alerts, pond.id]);
  const scoreUi = useMemo(() => pondScoreUi(pond.healthStatus), [pond.healthStatus]);

  const s = gateway?.sensors;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fabBottom = Math.max(insets.bottom, spacing.md) + 56;
  const scrollBottomPad = fabBottom + spacing.xl;

  return (
    <AppScreen contentStyle={{ paddingBottom: scrollBottomPad }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy, letterSpacing: -0.5 }}>
        {greeting}, {user.firstName}
      </Text>
      <Text style={{ marginTop: 6, color: colors.mutedStrong, fontWeight: '700', fontSize: 15 }}>Welcome back</Text>

      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 13 }}>Pond</Text>
        <Pressable
          onPress={() => setPondId((id) => (id === 'pond-a' ? 'pond-b' : 'pond-a'))}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.soft,
          }}
        >
          <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>{pond.name}</Text>
          <ChevronDown size={18} color={colors.mutedStrong} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <WaterQualityScoreCard
          score={pond.overallScore}
          statusLabel={scoreUi.label}
          statusTone={scoreUi.tone}
          summaryLine={scoreUi.summary}
          tips={['Keep turbidity under 25 NTU for best clarity.', 'Schedule calibration before seasonal swings.']}
        />
      </View>

      <SectionTitle title="Live metrics" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {s ? (
          <>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Gauge size={20} color={colors.primary} />}
                title="pH"
                value={s.ph.toFixed(2)}
                statusLabel="Normal"
                statusTone={toneForPh(s.ph)}
                trendDelta={0.04}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Droplets size={20} color={colors.primary} />}
                title="TDS"
                value={`${Math.round(s.tdsPpm)}`}
                unit="ppm"
                statusLabel="Normal"
                statusTone={toneForTds(s.tdsPpm)}
                trendDelta={-6}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<ThermometerSun size={20} color={colors.primary} />}
                title="Temperature"
                value={s.temperatureC.toFixed(1)}
                unit="°C"
                statusLabel="Warm"
                statusTone={toneForTemp(s.temperatureC)}
                trendDelta={0.2}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Waves size={20} color={colors.primary} />}
                title="Turbidity"
                value={`${Math.round(s.turbidityNtu)}`}
                unit="NTU"
                statusLabel="Slightly Cloudy"
                statusTone={toneForTurb(s.turbidityNtu)}
                trendDelta={1.2}
              />
            </View>
          </>
        ) : null}
      </View>

      <SectionTitle title="Gateway status" />
      {gateway ? (
        <DeviceStatusCard device={gateway} onPress={() => router.push(`/device/${gateway.id}`)} />
      ) : null}

      <SectionTitle title="Network summary" />
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Gateways</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.gateways}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Relays</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.relays}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Children</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.children}</Text>
          </View>
          {net.singles > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Single devices</Text>
              <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.singles}</Text>
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>Active nodes</Text>
            <Text style={{ color: colors.primary, fontWeight: '900' }}>{net.active}</Text>
          </View>
        </Card.Content>
      </Card>

      <SectionTitle title="Latest alerts" actionLabel="See all" onActionPress={() => router.push('/(tabs)/alerts')} />
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: spacing.md }}>
          {pondAlerts.length === 0 ? (
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>No active alerts. Great work.</Text>
          ) : (
            pondAlerts.map((a) => (
              <Pressable key={a.id} onPress={() => router.push({ pathname: '/alerts/alert-details', params: { id: a.id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>{a.title}</Text>
                    <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                      {a.description}
                    </Text>
                    <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
                      {formatRelativeTime(a.createdAt)}
                    </Text>
                  </View>
                  <StatusChip
                    label={a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                    tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}
                  />
                </View>
              </Pressable>
            ))
          )}
          <Chip
            icon="plus"
            mode="flat"
            onPress={() => router.push('/setup/add-device')}
            style={{ backgroundColor: colors.surfaceMuted, alignSelf: 'flex-start' }}
            textStyle={{ fontWeight: '800', color: colors.primary }}
          >
            Quick add: gateway or single device
          </Chip>
        </Card.Content>
      </Card>

      <SectionTitle title="pH trend" />
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content>
          <SensorChart data={mockPhTrend()} height={170} />
        </Card.Content>
      </Card>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          right: spacing.md,
          bottom: fabBottom,
          backgroundColor: colors.primary,
        }}
        color="#fff"
        onPress={() => router.push('/setup/add-device')}
      />
    </AppScreen>
  );
}
