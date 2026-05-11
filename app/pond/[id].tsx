import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getPondById } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { NetworkTree } from '../../components/NetworkTree';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { StatusChip, type StatusTone } from '../../components/StatusChip';
import { SectionTitle } from '../../components/SectionTitle';
import { WaterQualityScoreCard } from '../../components/WaterQualityScoreCard';
import { formatRelativeTime } from '../../utils/formatTime';

export default function PondDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { devices, alerts } = useMockApp();
  const pond = getPondById(String(id));

  if (!pond) {
    return (
      <AppScreen>
        <AppHeader title="Pond" onBack={() => router.back()} />
        <Text style={{ color: colors.mutedStrong }}>Pond not found (mock).</Text>
      </AppScreen>
    );
  }

  const pondDevices = devices.filter((d) => pond.deviceIds.includes(d.id));
  const root = pondDevices.find((d) => d.role === 'gateway') ?? pondDevices[0];
  const pondAlerts = alerts.filter((a) => a.pondId === pond.id).slice(0, 4);
  return (
    <AppScreen>
      <AppHeader title={pond.name} subtitle={pond.location} onBack={() => router.back()} />

      <WaterQualityScoreCard
        score={pond.overallScore}
        statusLabel={pond.healthStatus === 'good' ? 'Good' : pond.healthStatus === 'warning' ? 'Watch' : 'Critical'}
        statusTone={pond.healthStatus === 'good' ? 'success' : pond.healthStatus === 'warning' ? 'warning' : 'danger'}
        summaryLine={
          pond.healthStatus === 'good'
            ? 'Pond is tracking in a healthy range.'
            : pond.healthStatus === 'warning'
              ? 'Review sensors and downstream nodes soon.'
              : 'Immediate attention recommended for this pond.'
        }
        tips={['Review turbidity on downstream nodes.', 'Keep aeration consistent during heat spikes.']}
      />

      <SectionTitle title="Node map" />
      <Card
        style={{
          marginTop: spacing.sm,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.mutedStrong, lineHeight: 22, fontSize: 15 }}>
            Map placeholder — drop pins for gateways, relays, and children.{'\n'}
            {/* TODO: Backend API integration — map tiles & node positions */}
          </Text>
        </Card.Content>
      </Card>

      <SectionTitle title="Device network" />
      {root ? (
        <View style={{ marginTop: spacing.sm }}>
          <NetworkTree root={root} allDevices={pondDevices} />
        </View>
      ) : null}

      <SectionTitle title="Sensor summary" />
      <Card
        style={{
          marginTop: spacing.sm,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: 8 }}>
          {pondDevices.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.navy, fontWeight: '800' }}>{d.name}</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>
                pH {d.sensors.ph.toFixed(2)} · TDS {Math.round(d.sensors.tdsPpm)}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <SectionTitle title="Recent alerts" />
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {pondAlerts.map((a) => {
          const chipTone: StatusTone =
            a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info';
          return (
            <Pressable key={a.id} onPress={() => router.push({ pathname: '/alerts/alert-details', params: { id: a.id } })}>
              <Card
                style={{
                  borderRadius: radius.xl,
                  ...shadows.soft,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>{a.title}</Text>
                    <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
                      {formatRelativeTime(a.createdAt)}
                    </Text>
                  </View>
                  <StatusChip
                    label={a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                    tone={chipTone}
                  />
                </Card.Content>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <PrimaryButton label="Add Device" onPress={() => router.push('/setup/add-device')} />
        <SecondaryButton label="Add Child Node" onPress={() => router.push('/setup/add-child-node')} />
        <SecondaryButton label="Set Thresholds" onPress={() => router.push('/alerts/thresholds')} />
        <SecondaryButton
          label="View History"
          onPress={() => router.push({ pathname: '/device/sensor-history', params: { deviceId: root?.id ?? 'm1' } })}
        />
      </View>
    </AppScreen>
  );
}
