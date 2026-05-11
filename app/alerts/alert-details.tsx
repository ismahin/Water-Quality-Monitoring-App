import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Divider } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import type { AlertTimelineEvent } from '../../types/alert';
import { formatRelativeTime } from '../../utils/formatTime';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StatusChip, type StatusTone } from '../../components/StatusChip';

function mockTimeline(): AlertTimelineEvent[] {
  return [
    { id: 't1', label: 'Threshold crossed', time: new Date(Date.now() - 40 * 60 * 1000).toLocaleTimeString() },
    { id: 't2', label: 'Second sample confirmed', time: new Date(Date.now() - 35 * 60 * 1000).toLocaleTimeString() },
    { id: 't3', label: 'Alert created', time: new Date(Date.now() - 30 * 60 * 1000).toLocaleTimeString() },
  ];
}

export default function AlertDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, markAlertResolved } = useMockApp();
  const alert = alerts.find((a) => a.id === String(id));
  const dev = alert ? getDeviceById(alert.deviceId) : undefined;

  if (!alert) {
    return (
      <AppScreen>
        <AppHeader title="Alert" onBack={() => router.back()} />
        <Text style={{ color: colors.mutedStrong }}>Alert not found.</Text>
      </AppScreen>
    );
  }

  const tone: StatusTone =
    alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info';

  return (
    <AppScreen>
      <AppHeader title="Alert details" onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: colors.navy }}>{alert.title}</Text>
        <StatusChip
          label={alert.severity === 'critical' ? 'Critical' : alert.severity === 'warning' ? 'Warning' : 'Info'}
          tone={tone}
        />
      </View>
      <Text style={{ marginTop: 8, color: colors.mutedStrong, fontWeight: '700' }}>{dev?.name}</Text>
      <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, fontWeight: '700' }}>
        {formatRelativeTime(alert.createdAt)} · {new Date(alert.createdAt).toLocaleString()}
      </Text>

      <Card
        style={{
          marginTop: spacing.lg,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Timeline</Text>
          {mockTimeline().map((e, idx) => (
            <View key={e.id}>
              {idx > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : null}
              <Text style={{ color: colors.navy, fontWeight: '800' }}>{e.label}</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: 12, marginTop: 4, fontWeight: '600' }}>{e.time}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {alert.readingValue ? (
        <Card
          style={{
            marginTop: spacing.md,
            borderRadius: radius.xl,
            ...shadows.soft,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Sensor reading</Text>
            <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 17, fontWeight: '800' }}>{alert.readingValue}</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card
        style={{
          marginTop: spacing.md,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Recommended fix</Text>
          <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, lineHeight: 22, fontSize: 15 }}>{alert.suggestedAction}</Text>
        </Card.Content>
      </Card>

      <PrimaryButton
        label={alert.resolved ? 'Resolved' : 'Mark as resolved'}
        disabled={alert.resolved}
        onPress={() => markAlertResolved(alert.id)}
        style={{ marginTop: spacing.lg }}
      />
    </AppScreen>
  );
}
