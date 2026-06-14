import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { SensorMetricCard } from '../../components/device/SensorMetricCard';
import { TopologyTree } from '../../components/topology/TopologyTree';
import { RemoteCommandControls } from '../../components/RemoteCommandControls';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useDeviceLatest } from '../../hooks/useDeviceLatest';
import { useTopology } from '../../hooks/useTopology';
import { DEFAULT_NETWORK_ID, formatAgo } from '../../utils/pairingUtils';

function metric(value?: number, format?: (n: number) => string): string {
  return typeof value === 'number' ? (format ? format(value) : String(value)) : '-';
}

function firstNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => typeof value === 'number');
}

function firstString(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '-';
}

function queueText(size?: number, ready?: boolean): string {
  if (ready === false) return 'Persistent queue not ready; check ESP32 partition/LittleFS.';
  if (ready === true && (size ?? 0) === 0) return 'All cloud data synced.';
  if (ready === true && (size ?? 0) > 0) return 'Stored locally, waiting for Wi-Fi/Firebase.';
  return 'Queue status unknown.';
}

export default function NetworkDeviceDetailScreen() {
  const router = useRouter();
  const { deviceId, networkId: networkParam } = useLocalSearchParams<{ deviceId: string; networkId?: string }>();
  const networkId = String(networkParam ?? DEFAULT_NETWORK_ID);
  const id = String(deviceId);
  const { latest, status, directChildren, error } = useDeviceLatest(networkId, id);
  const { tree } = useTopology(networkId);
  const offlineQueueSize = status?.offline_firebase_queue_size ?? latest?.offline_firebase_queue_size;
  const offlineQueueReady = status?.offline_queue_ready ?? latest?.offline_queue_ready;
  const firmware = firstString(status?.fw, latest?.fw, status?.fw_version, latest?.fw_version, status?.firmware_version, latest?.firmware_version);
  const protocol = status?.protocol ?? latest?.protocol ?? '-';
  const directChildCount = firstNumber(status?.direct_child_count, latest?.direct_child_count) ?? directChildren.length;
  const knownDevices = firstNumber(status?.known_device_count, latest?.known_device_count, latest?.kc, status?.source_known_count, latest?.source_known_count);
  const receivedPackets = firstNumber(status?.rx_direct_count, latest?.rx_direct_count, latest?.rc, status?.source_rx_count, latest?.source_rx_count);
  const transmittedPackets = firstNumber(status?.tx_packet_count, latest?.tx_packet_count, latest?.tc, status?.source_tx_count, latest?.source_tx_count);
  const forwardedPackets = firstNumber(status?.forward_packet_count, latest?.forward_packet_count, latest?.fc, status?.source_forward_count, latest?.source_forward_count);
  const gatewayUploads = firstNumber(status?.gateway_upload_count, latest?.gateway_upload_count);

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
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Firmware: {firmware}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>BLE protocol: {protocol}</Text>
          <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '700' }}>
            Offline Firebase queue: {offlineQueueSize ?? 0} pending batches
          </Text>
          <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '700' }}>
            Offline queue ready: {offlineQueueReady === undefined ? '-' : offlineQueueReady ? 'yes' : 'no'}
          </Text>
          <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '700' }}>
            {queueText(offlineQueueSize, offlineQueueReady)}
          </Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Gateway uplink queue: {status?.gateway_uplink_queue_size ?? status?.gateway_uplink_queue ?? latest?.gateway_uplink_queue_size ?? latest?.gateway_uplink_queue ?? 0}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Pairing cloud queue: {status?.pairing_cloud_queue_size ?? status?.pairing_cloud_queue ?? latest?.pairing_cloud_queue_size ?? latest?.pairing_cloud_queue ?? 0}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Forward queue: {status?.forward_queue_size ?? status?.forward_queue ?? latest?.forward_queue_size ?? 0}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Role: {status?.role ?? latest?.role ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Parent: {status?.parent_id ?? latest?.parent_id ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Root gateway: {status?.root_gateway_id ?? latest?.root_gateway_id ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Route: {status?.route ?? latest?.route ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Lifecycle: {status?.lifecycle_state ?? latest?.lifecycle_state ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Link state: {status?.link_state ?? latest?.link_state ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Direct children: {directChildCount}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Known devices: {knownDevices ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Received packets: {receivedPackets ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Transmitted packets: {transmittedPackets ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Forwarded packets: {forwardedPackets ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Gateway uploads: {gatewayUploads ?? '-'}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Child RSSI/SNR: {metric(firstNumber(status?.child_rssi, latest?.child_rssi))} dBm / {metric(firstNumber(status?.child_snr, latest?.child_snr))}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Gateway RSSI/SNR: {metric(firstNumber(status?.gateway_rssi, latest?.gateway_rssi))} dBm / {metric(firstNumber(status?.gateway_snr, latest?.gateway_snr))}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Last update: {formatAgo(status?.updated_at ?? status?.last_seen_ms ?? latest?.last_seen_ms ?? latest?.last_upload_ms ?? latest?.timestamp)}</Text>
        </Card.Content>
      </Card>

      <RemoteCommandControls deviceId={id} networkId={networkId} />

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
        <Card.Content style={{ gap: spacing.md }}>
          <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Network topology</Text>
          <TopologyTree nodes={tree} />
        </Card.Content>
      </Card>
    </AppScreen>
  );
}
