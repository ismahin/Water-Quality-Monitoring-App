import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { formatRelativeTime } from '../../utils/formatTime';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StatusChip, type StatusTone } from '../../components/StatusChip';

function healthTone(h: 'good' | 'warning' | 'critical'): StatusTone {
  if (h === 'good') return 'success';
  if (h === 'warning') return 'warning';
  return 'danger';
}

export default function PondsScreen() {
  const router = useRouter();
  const { ponds } = useMockApp();

  return (
    <AppScreen>
      <AppHeader title="Ponds" subtitle="Organize devices by location" />
      <PrimaryButton label="Add Pond" onPress={() => router.push('/pond/add-pond')} />

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {ponds.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/pond/${p.id}`)} style={{ minHeight: 48 }}>
            <Card
              style={{
                borderRadius: radius.xl,
                ...shadows.soft,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Card.Content style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: colors.navy }}>{p.name}</Text>
                    <Text style={{ marginTop: 4, color: colors.mutedStrong, fontWeight: '600', fontSize: 14 }}>{p.location}</Text>
                  </View>
                  <StatusChip
                    label={p.healthStatus === 'good' ? 'Good' : p.healthStatus === 'warning' ? 'Warning' : 'Critical'}
                    tone={healthTone(p.healthStatus)}
                  />
                </View>
                <View style={{ flexDirection: 'row', marginTop: spacing.md, justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 13 }}>{p.deviceIds.length} devices</Text>
                  <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 13 }}>{p.activeAlertCount} active alerts</Text>
                </View>
                <Text style={{ marginTop: spacing.sm, color: colors.navy, fontWeight: '900', fontSize: 16 }}>
                  Score {p.overallScore}/100
                </Text>
                <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 13, fontWeight: '700' }}>
                  Last sync {formatRelativeTime(p.lastSyncAt)}
                </Text>
              </Card.Content>
            </Card>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
