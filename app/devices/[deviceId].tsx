import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { SensorMetricCard } from '../../components/device/SensorMetricCard';
import { TopologyTree } from '../../components/topology/TopologyTree';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useDeviceLatest } from '../../hooks/useDeviceLatest';
import { useTopology } from '../../hooks/useTopology';
import { DEFAULT_NETWORK_ID, formatAgo } from '../../utils/pairingUtils';

function metric(value?: number, format?: (n: number) => string): string {
  return typeof value === 'number' ? (format ? format(value) : String(value)) : '-';
}

export default function NetworkDeviceDetailScreen() {
  const router = useRouter();
  const { deviceId, networkId: networkParam } = useLocalSearchParams<{ deviceId: string; networkId?: string }>();
  const networkId = String(networkParam ?? DEFAULT_NETWORK_ID);
  const id = String(deviceId);
  const { latest, status, directChildren, error } = useDeviceLatest(networkId, id);
  const { tree } = useTopology(networkId);

  return (
    <AppScreen>
      <AppHeader title={id} subtitle={`Network ${networkId}`} onBack={() => router.back()} />
      {error ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <SensorMetricCard label="pH" value={metric(latest?.ph, (n) => n.toFixed(2))} />
        <SensorMetricCard label="TDS" value={metric(latest?.tds, (n) => `${Math.round(n)} ppm`)} />
        <SensorMetricCard label="Temperature" value={metric(latest?.temperature, (n) => `${n.toFixed(1)} C`)} />
        <SensorMetricCard label="Turbidity" value={metric(latest?.turbidity, (n) => `${Math.round(n)} NTU`)} />
        <SensorMetricCard label="Battery" value={metric(status?.battery ?? latest?.battery, (n) => `${Math.round(n)}%`)} />
      </View>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Network stats</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Role: {status?.role ?? latest?.role ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Parent: {status?.parent_id ?? latest?.parent_id ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Root gateway: {status?.root_gateway_id ?? latest?.root_gateway_id ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Route: {latest?.route ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Direct children: {directChildren.length}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Known devices: {latest?.kc ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Received packets: {latest?.rc ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Transmitted packets: {latest?.tc ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Forwarded packets: {latest?.fc ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Last update: {formatAgo(status?.last_seen_ms ?? latest?.last_seen_ms ?? latest?.timestamp)}</Text>
        </Card.Content>
      </Card>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
        <Card.Content style={{ gap: spacing.md }}>
          <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Network topology</Text>
          <TopologyTree nodes={tree} />
        </Card.Content>
      </Card>
    </AppScreen>
  );
}
