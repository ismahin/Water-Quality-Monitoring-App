import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import type { AlertSeverity } from '../../types/alert';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { formatRelativeTime } from '../../utils/formatTime';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { StatusChip, type StatusTone } from '../../components/StatusChip';

type Filter = 'all' | AlertSeverity;

function sevTone(s: AlertSeverity): StatusTone {
  if (s === 'critical') return 'danger';
  if (s === 'warning') return 'warning';
  return 'info';
}

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts } = useMockApp();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  return (
    <AppScreen>
      <AppHeader title="Alerts" subtitle="Prioritized for fast response" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => {
          const selected = filter === f;
          return (
            <Chip
              key={f}
              mode="flat"
              selected={selected}
              onPress={() => setFilter(f)}
              style={{
                backgroundColor: selected ? '#E0F2FE' : colors.surfaceMuted,
                borderRadius: radius.md,
              }}
              textStyle={{
                fontWeight: '800',
                color: selected ? colors.primary : colors.mutedStrong,
                fontSize: 13,
              }}
            >
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </Chip>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/alerts/thresholds')} style={{ marginTop: spacing.md, paddingVertical: 4 }}>
        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 15 }}>Set thresholds</Text>
      </Pressable>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {filtered.map((a) => {
          const dev = getDeviceById(a.deviceId);
          return (
            <Pressable key={a.id} onPress={() => router.push({ pathname: '/alerts/alert-details', params: { id: a.id } })}>
              <Card
                style={{
                  borderRadius: radius.xl,
                  ...shadows.soft,
                  backgroundColor: colors.card,
                  opacity: a.resolved ? 0.55 : 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Card.Content style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <Text style={{ flex: 1, fontWeight: '900', color: colors.navy, fontSize: 16 }}>{a.title}</Text>
                    <StatusChip
                      label={a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                      tone={sevTone(a.severity)}
                    />
                  </View>
                  <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>{dev?.name ?? 'Device'}</Text>
                  <Text style={{ color: colors.mutedStrong, fontSize: 13, fontWeight: '700' }}>{formatRelativeTime(a.createdAt)}</Text>
                  <Text style={{ color: colors.navy, lineHeight: 22, fontSize: 14 }}>{a.suggestedAction}</Text>
                </Card.Content>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}
