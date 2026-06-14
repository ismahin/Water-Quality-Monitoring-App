import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, Portal } from 'react-native-paper';
import { CloudOff, CloudCheck } from 'lucide-react-native';
import { NotificationSnackbar } from '../../components/NotificationSnackbar';
import { LoRaStatusCard } from '../../components/LoRaStatusCard';
import { AutoRoleCard } from '../../components/AutoRoleCard';
import { NetworkTree } from '../../components/NetworkTree';
import { colors, modalSurfaceFit, radius, shadows, spacing } from '../../constants/theme';
import { getParentName } from '../../constants/mockData';
import { usesLoraUi, usesWifiUi, isGatewayOrSingle, type GatewayDevice, type SingleDevice } from '../../types/device';
import { formatRelativeTime } from '../../utils/formatTime';
import { useMockApp } from '../../context/MockAppContext';
import { useLiveDevice } from '../../hooks/useLiveDevice';
import { removeDeviceWithWifiReset } from '../../services/firebase/deviceCommandService';
import { isFirebaseConfigured } from '../../constants/env';
import { PENDING_AFTER_DEVICE_REMOVE_SNACKBAR } from '../../constants/appStorageKeys';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { BatteryIndicator } from '../../components/BatteryIndicator';
import { DestructiveButton } from '../../components/DestructiveButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';
import { StatusChip } from '../../components/StatusChip';
import { RemoteCommandControls } from '../../components/RemoteCommandControls';

function offlineQueueStatusText(size?: number, ready?: boolean): string {
  if (ready === false) return 'Persistent queue not ready; check ESP32 partition/LittleFS.';
  if (ready === true && (size ?? 0) === 0) return 'All cloud data synced.';
  if (ready === true && (size ?? 0) > 0) return 'Stored locally, waiting for Wi-Fi/Firebase.';
  return 'Queue status unknown.';
}

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    devices,
    isRegisteredLiveDevice,
    removeRegisteredDevice,
    firebaseRtdbConnected,
    getLiveSnapshot,
  } = useMockApp();
  const deviceId = String(id);
  const device = devices.find((d) => d.id === deviceId);

  const isRegisteredOwnLive = isRegisteredLiveDevice(deviceId);
  const isLive = !!device?.isLive || isRegisteredOwnLive;
  const live = useLiveDevice(isRegisteredOwnLive ? deviceId : undefined, firebaseRtdbConnected, device?.networkId);
  const snap = getLiveSnapshot(deviceId);
  const remoteNetworkId = device?.networkId ?? live.status?.network_id ?? live.latest?.network_id;

  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [removeSending, setRemoveSending] = useState(false);
  const [offlineRemoveVisible, setOfflineRemoveVisible] = useState(false);
  const [firebasePathsVisible, setFirebasePathsVisible] = useState(false);
  const [errorSnackbar, setErrorSnackbar] = useState<string | null>(null);

  const removeInProgressRef = useRef(false);
  const removeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      removeAbortRef.current?.abort();
      removeAbortRef.current = null;
    };
  }, [deviceId]);

  const openRemoveConfirm = useCallback(() => {
    if (!isLive) {
      setErrorSnackbar('Remote remove with Wi‑Fi reset applies to provisioned devices under Live Devices.');
      return;
    }
    if (!isFirebaseConfigured()) {
      setErrorSnackbar('Configure Firebase in .env to send a reset command to this device.');
      return;
    }
    setRemoveConfirmVisible(true);
  }, [isLive]);

  const runConfirmedRemove = useCallback(async () => {
    if (removeInProgressRef.current) return;
    removeInProgressRef.current = true;
    removeAbortRef.current?.abort();
    removeAbortRef.current = new AbortController();
    const signal = removeAbortRef.current.signal;

    setRemoveConfirmVisible(false);
    setRemoveSending(true);
    try {
      const result = await removeDeviceWithWifiReset(deviceId, {
        signal,
        networkId: remoteNetworkId,
      });
      if (!result.ok && result.reason === 'aborted') {
        return;
      }
      if (result.ok && result.acked) {
        await AsyncStorage.setItem(
          PENDING_AFTER_DEVICE_REMOVE_SNACKBAR,
          'Device removed. It is ready for provisioning again.',
        );
        await removeRegisteredDevice(deviceId);
        router.replace('/(tabs)/devices');
        return;
      }
      if (result.reason === 'firebase_error') {
        setErrorSnackbar('Could not send reset command. Check Firebase permissions and network.');
        return;
      }
      if (result.reason === 'timeout') {
        setOfflineRemoveVisible(true);
      }
    } catch {
      setErrorSnackbar('Something went wrong while removing the device.');
    } finally {
      removeInProgressRef.current = false;
      setRemoveSending(false);
    }
  }, [deviceId, remoteNetworkId, removeRegisteredDevice, router]);

  const removeLocallyOnly = useCallback(async () => {
    if (removeInProgressRef.current) return;
    removeInProgressRef.current = true;
    setOfflineRemoveVisible(false);
    try {
      await AsyncStorage.setItem(
        PENDING_AFTER_DEVICE_REMOVE_SNACKBAR,
        'Device removed locally. Reset may not have reached the device.',
      );
      await removeRegisteredDevice(deviceId);
      router.replace('/(tabs)/devices');
    } catch {
      setErrorSnackbar('Could not remove device from this phone.');
    } finally {
      removeInProgressRef.current = false;
    }
  }, [deviceId, removeRegisteredDevice, router]);

  const goToReprovisionWifi = useCallback(() => {
    router.push('/setup/gateway-wifi-setup');
  }, [router]);

  if (!device) {
    return (
      <AppScreen>
        <AppHeader title="Device" onBack={() => router.back()} />
        <Text style={{ color: colors.mutedStrong }}>Device not found.</Text>
      </AppScreen>
    );
  }

  const parentName = 'parentId' in device ? getParentName(device) ?? device.parentId : undefined;
  const topologyRootId = device.rootGatewayId || device.gatewayId || device.id;
  const topologyRoot = devices.find((d) => d.id === topologyRootId) ?? device;
  const topologyDevices = devices.filter(
    (d) => d.id === topologyRoot.id || d.rootGatewayId === topologyRoot.id || d.gatewayId === topologyRoot.id || d.parentId === topologyRoot.id,
  );
  const showCloudStrip =
    usesWifiUi(device) &&
    (device.role === 'gateway'
      ? device.online === 'online' || device.online === 'warning'
      : isLive || device.online === 'online' || device.online === 'warning');

  const ip = live.latest?.ip ?? live.status?.ip ?? (isGatewayOrSingle(device) ? (device as SingleDevice | GatewayDevice).ip : undefined);
  const firebaseReady = isFirebaseConfigured();
  const liveW = isLive && isGatewayOrSingle(device) ? (device as SingleDevice | GatewayDevice) : null;
  const liveAny = isLive ? device : null;
  const offlineQueueSize = liveAny?.offlineFirebaseQueueSize ?? live.status?.offline_firebase_queue_size ?? live.latest?.offline_firebase_queue_size;
  const offlineQueueReady = liveAny?.offlineQueueReady ?? live.status?.offline_queue_ready ?? live.latest?.offline_queue_ready;
  const bleProtocol = liveAny?.bleProtocol ?? live.status?.protocol ?? live.latest?.protocol ?? '-';
  const firmwareVersion = live.status?.fw || live.latest?.fw || live.status?.fw_version || live.latest?.fw_version || live.status?.firmware_version || live.latest?.firmware_version || device.firmwareVersion || 'v3.2.17';
  const removeRoleWarning =
    device.role === 'gateway'
      ? 'Removing this gateway will disconnect child and relay nodes from the app until another gateway receives them.'
      : device.role === 'relay'
        ? 'Removing this relay may stop downstream child nodes from reaching the gateway.'
        : device.role === 'child'
          ? 'Removing this child will reset its Wi-Fi/config and return it to setup mode.'
          : 'This will remove the device from your app and reset its saved Wi-Fi.';

  return (
    <AppScreen>
      <AppHeader
        title={isLive ? deviceId : device.name}
        subtitle={
          isLive
            ? liveW?.firebaseRole
              ? `${liveW.firebaseRole} · ${device.name}`
              : 'Live Firebase device'
            : `Role: ${device.role}`
        }
        onBack={() => router.back()}
      />
      {isLive ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
          <Chip compact style={{ backgroundColor: '#DCFCE7' }} textStyle={{ fontWeight: '800', color: colors.success, fontSize: 11 }}>
            Live Firebase
          </Chip>
          <Chip compact style={{ backgroundColor: '#E0F2FE' }} textStyle={{ fontWeight: '800', fontSize: 11, color: colors.navy }}>
            {device.universalRole ?? liveW?.firebaseRole ?? device.role.toUpperCase()}
          </Chip>
          {liveW?.telemetryStale ? (
            <Chip compact style={{ backgroundColor: '#FEF3C7' }} textStyle={{ fontWeight: '800', fontSize: 11, color: colors.warning }}>
              Stale telemetry
            </Chip>
          ) : null}
        </View>
      ) : null}

      {isLive && !firebaseReady ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Firebase not configured</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>
              Add EXPO_PUBLIC_FIREBASE_* keys to .env (see .env.example) and restart the dev server.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {isLive && firebaseReady && live.error ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Firebase</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>{live.error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {isLive && firebaseReady && live.loading ? (
        <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator />
          <Text style={{ color: colors.mutedStrong }}>Loading Firebase data…</Text>
        </View>
      ) : null}

      {isLive && firebaseReady && !live.error && !live.latest && !live.status && !live.loading ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Waiting for first data</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>
              Waiting for first snapshot at devices/{deviceId}/latest or devices/{deviceId}/status…
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {isLive && liveW?.removeRequested ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Removal requested</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>
              Device was removed and needs provisioning again.
            </Text>
          </Card.Content>
        </Card>
      ) : null}
      {isLive && liveW?.reprovisionRequired ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Re-provision required</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>
              Device was removed and needs provisioning again.
            </Text>
          </Card.Content>
        </Card>
      ) : null}
      {isLive && liveW?.commandStream === 'disconnected' && (liveW?.online === 'online' || liveW?.online === 'warning') ? (
        <Card style={{ marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)' }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Command stream</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong }}>
              Device is online, but command stream may be disconnected. Remove command may be delayed.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusChip
          label={device.online === 'online' ? 'Online' : device.online === 'warning' ? 'Stale data' : 'Offline'}
          tone={device.online === 'online' ? 'success' : device.online === 'warning' ? 'warning' : 'danger'}
        />
        <BatteryIndicator percent={device.batteryPercent} />
      </View>

      {showCloudStrip ? (
        <Card
          style={{
            marginTop: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: device.cloudOnline ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.45)',
            backgroundColor: device.cloudOnline ? '#ECFDF5' : '#FFFBEB',
            ...shadows.soft,
          }}
        >
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {device.cloudOnline ? (
              <CloudCheck size={22} color={colors.success} />
            ) : (
              <CloudOff size={22} color={colors.warning} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>
                {device.cloudOnline ? 'Firebase listener active' : 'Firebase disconnected'}
              </Text>
              <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }}>
                {isLive
                  ? device.cloudOnline
                    ? 'Realtime Database connection is up; telemetry updates when the device uploads.'
                    : 'App is not connected to the Realtime Database server (.info/connected).'
                  : device.cloudOnline
                    ? 'Telemetry is uploading on schedule.'
                    : 'Gateway is on your LAN but the cloud endpoint is not reachable (mock).'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {isLive ? (
        <View style={{ marginTop: spacing.md }}>
          <AutoRoleCard
            role={device.universalRole ?? liveW?.firebaseRole ?? device.role.toUpperCase()}
            hardwareMode={String(device.hardwareMode ?? liveW?.hardwareMode ?? '')}
            gatewayUplinkEnabled={device.gatewayUplinkEnabled ?? liveW?.gatewayUplinkEnabled}
            relayEnabled={device.relayEnabled ?? liveW?.relayEnabled}
          />
        </View>
      ) : null}

      {usesWifiUi(device) ? (
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Wi‑Fi status</Text>
            {isLive && liveW ? (
              <>
                <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                  Connected: {liveW.wifiConnected === true ? 'Yes' : liveW.wifiConnected === false ? 'No' : 'Unknown'}
                </Text>
                <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>SSID: {device.wifiSsid}</Text>
                <SignalStrengthBar type="wifi" rssi={device.wifiRssi} showLabels />
                {ip ? (
                  <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>IP: {ip}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>SSID: {device.wifiSsid}</Text>
                <SignalStrengthBar type="wifi" rssi={device.wifiRssi} showLabels={false} />
                {isLive && ip ? <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>IP: {ip}</Text> : null}
                {device.role !== 'gateway' ? (
                  <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                    Cloud: {device.cloudOnline ? 'Online' : 'Offline'}
                  </Text>
                ) : null}
                {device.role === 'gateway' && !isLive ? (
                  <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                    LoRa gateway: {device.loraGatewayEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                ) : null}
              </>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {isLive && liveW ? (
        <>
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
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Mode status</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Hardware mode: {liveW.hardwareMode ?? liveW.firebaseRole ?? '—'}
              </Text>
              {liveW.role === 'single' || liveW.firebaseRole === 'SINGLE' ? (
                <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
                  This device is running as a standalone Wi‑Fi water-quality monitor (Single Device Mode).
                </Text>
              ) : (
                <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
                  This device is running as a LoRa Gateway and standalone monitor (Gateway Mode · LoRa Gateway + Wi‑Fi uplink).
                </Text>
              )}
            </Card.Content>
          </Card>

          <View style={{ marginTop: spacing.md }}>
            <LoRaStatusCard
              enabled={liveW.loraEnabled === true}
              initialized={liveW.loraInitialized === true}
              gatewayReady={liveW.loraGatewayReady === true}
              frequencyMhz={liveW.loraFrequencyMhz}
              packetCount={liveW.loraPacketCount}
              lastRssi={liveW.lastLoraRssi}
              lastSnr={liveW.lastLoraSnr}
              lastError={liveW.loraLastError}
              lastPayload={liveW.lastLoraPayload}
            />
          </View>

          {liveW.role === 'gateway' && liveW.loraEnabled === true ? (
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
              <Card.Content style={{ gap: spacing.sm }}>
                <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>LoRa RF (child uplink)</Text>
                {/* TODO: graph child packet history when LoRa child pairing ships */}
                <Text style={{ color: colors.mutedStrong, fontSize: 12, lineHeight: 18 }}>
                  LoRa link is confirmed only after packet count increases. Module ready ≠ active RF link to a child.
                </Text>
                <SignalStrengthBar
                  type="lora"
                  rssi={liveW.lastLoraRssi ?? -120}
                  snr={liveW.lastLoraSnr ?? 0}
                  packetSuccess={100}
                  loraAwaitingChildPackets={(liveW.loraPacketCount ?? 0) === 0 && liveW.loraGatewayReady === true}
                />
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
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Command stream</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                {liveW.commandStream === 'connected'
                  ? 'Command Stream Connected'
                  : liveW.commandStream === 'disconnected'
                    ? 'Command Stream Disconnected'
                    : liveW.commandStream ?? '—'}
              </Text>
              <Text style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }}>
                Command stream lets the app send remove / reset commands to the device (e.g. reset Wi‑Fi).
              </Text>
            </Card.Content>
          </Card>

          <Card
            style={{
              marginTop: spacing.md,
              borderRadius: radius.xl,
              ...shadows.soft,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: offlineQueueReady === false ? 'rgba(239,68,68,0.35)' : colors.border,
            }}
          >
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Firmware / queues</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Firmware: {firmwareVersion}</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>BLE protocol: {bleProtocol}</Text>
              <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '600' }}>
                Offline Firebase queue: {offlineQueueSize ?? 0} pending batches
              </Text>
              <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '600' }}>
                Offline queue ready: {offlineQueueReady === undefined ? '-' : offlineQueueReady ? 'yes' : 'no'}
              </Text>
              <Text style={{ color: offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '700' }}>
                {offlineQueueStatusText(offlineQueueSize, offlineQueueReady)}
              </Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Gateway uplink queue: {liveAny?.gatewayUplinkQueueSize ?? live.status?.gateway_uplink_queue_size ?? live.status?.gateway_uplink_queue ?? live.latest?.gateway_uplink_queue_size ?? live.latest?.gateway_uplink_queue ?? 0}
              </Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Pairing cloud queue: {liveAny?.pairingCloudQueueSize ?? live.status?.pairing_cloud_queue_size ?? live.status?.pairing_cloud_queue ?? live.latest?.pairing_cloud_queue_size ?? live.latest?.pairing_cloud_queue ?? 0}
              </Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Forward queue: {liveAny?.forwardQueueSize ?? liveAny?.forwardQueue ?? live.status?.forward_queue_size ?? live.latest?.forward_queue_size ?? 0}
              </Text>
            </Card.Content>
          </Card>
        </>
      ) : null}

      {isLive ? (
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Parent / root / network</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Network: {device.networkId || '-'}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Parent: {device.parentId || '-'}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Root gateway: {device.rootGatewayId || device.gatewayId || '-'}</Text>
            {device.route ? <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Route: {device.route}</Text> : null}
            {device.forwardedBy ? <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Forwarded by: {device.forwardedBy}</Text> : null}
          </Card.Content>
        </Card>
      ) : null}

      {isLive ? (
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Network topology</Text>
            <NetworkTree root={topologyRoot} allDevices={topologyDevices.length ? topologyDevices : [topologyRoot]} />
          </Card.Content>
        </Card>
      ) : null}

      {usesLoraUi(device) ? (
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>LoRa uplink</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Parent: {parentName ?? device.parentId}</Text>
            {device.forwardedBy ? <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Forwarded by: {device.forwardedBy}</Text> : null}
            {device.route ? <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Route: {device.route}</Text> : null}
            <SignalStrengthBar
              type="lora"
              rssi={device.loraRssi}
              snr={device.loraSnr}
              packetSuccess={device.packetSuccessPercent}
            />
            {device.role === 'relay' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Child nodes: {device.childDeviceIds.length}</Text>
            ) : null}
            {device.role === 'child' ? (
              <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
                Last packet: {formatRelativeTime(device.lastDataAt)}
              </Text>
            ) : null}
            <LoRaStatusCard
              enabled
              ready={device.loraStatus !== 'error'}
              childRssi={device.childRssi}
              childSnr={device.childSnr}
              gatewayRssi={device.gatewayRssi}
              gatewaySnr={device.gatewaySnr}
              lastRssi={device.loraRssi}
              lastSnr={device.loraSnr}
              error={device.loraLastError}
              packetCount={device.isLive ? 1 : 0}
              showNoPacketMessage={!device.isLive}
            />
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
        <Card.Content style={{ gap: 8 }}>
          <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Sensors</Text>
          {device.pendingFirstTelemetry ? (
            <Text style={{ color: colors.warning, fontWeight: '700' }}>
              {device.lifecycleLabel ?? 'Waiting for first data'}
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>pH {device.pendingFirstTelemetry ? '--' : device.sensors.ph.toFixed(2)}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>TDS {device.pendingFirstTelemetry ? '--' : `${Math.round(device.sensors.tdsPpm)} ppm`}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Temp {device.pendingFirstTelemetry ? '--' : `${device.sensors.temperatureC.toFixed(1)} C`}</Text>
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Turbidity {device.pendingFirstTelemetry ? '--' : `${Math.round(device.sensors.turbidityNtu)} NTU`}</Text>
          {isLive && liveW?.sensorStatus ? (
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>Sensor status: {liveW.sensorStatus}</Text>
          ) : null}
          <Divider style={{ marginVertical: spacing.sm }} />
          <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>
            Calibration:{' '}
            {isLive && liveW?.firebaseCalibrationStatus
              ? liveW.firebaseCalibrationStatus
              : `${device.calibrationStatus}${
                  device.calibrationDueAt ? ` (due ${new Date(device.calibrationDueAt).toLocaleDateString()})` : ''
                }`}
          </Text>
        </Card.Content>
      </Card>

      {isLive && firebaseReady ? (
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Firebase</Text>
            <Text style={{ color: colors.mutedStrong, fontSize: 13 }}>
              Last update (app receive time): {snap?.receivedAt ? formatRelativeTime(snap.receivedAt) : '—'}
            </Text>
            <Text style={{ color: colors.mutedStrong, fontSize: 12, fontFamily: 'monospace' }}>
              devices/{deviceId}/latest{'\n'}devices/{deviceId}/status
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {isLive && firebaseReady ? (
        <RemoteCommandControls deviceId={deviceId} networkId={remoteNetworkId} />
      ) : null}

      {device.role === 'gateway' && !isLive ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="Run Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <SecondaryButton label="Sensor Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Firmware Update" onPress={() => router.push({ pathname: '/device/firmware-update', params: { deviceId: device.id } })} />
          <DestructiveButton label="Remove device" onPress={openRemoveConfirm} />
        </View>
      ) : null}

      {device.role === 'relay' && !isLive ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="LoRa Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { deviceId: device.id } })} />
          <SecondaryButton label="Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <DestructiveButton label="Remove / Re-pair" onPress={openRemoveConfirm} />
        </View>
      ) : null}

      {device.role === 'child' && !isLive ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="LoRa Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { deviceId: device.id } })} />
          <SecondaryButton label="Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
        </View>
      ) : null}

      {device.role === 'single' && !isLive ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SecondaryButton label="Sensor Calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <SecondaryButton label="Firmware Update" onPress={() => router.push({ pathname: '/device/firmware-update', params: { deviceId: device.id } })} />
        </View>
      ) : null}

      {isLive && usesWifiUi(device) ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton label="Refresh" onPress={() => void live.refresh()} />
          <SecondaryButton
            label="Configure Device"
            onPress={() => router.push('/setup/pairing-config')}
          />
          <SecondaryButton label="Re-provision Wi‑Fi" onPress={goToReprovisionWifi} />
          <SecondaryButton label="View Firebase paths" onPress={() => setFirebasePathsVisible(true)} />
          <SecondaryButton label="View Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { gatewayId: device.rootGatewayId || device.id, deviceId: device.id } })} />
          <SecondaryButton label="Diagnostics" onPress={() => router.push({ pathname: '/device/diagnostics', params: { deviceId: device.id } })} />
          <SecondaryButton label="Sensor calibration" onPress={() => router.push('/setup/calibration-start')} />
          <SecondaryButton label="Firmware update" onPress={() => router.push({ pathname: '/device/firmware-update', params: { deviceId: device.id } })} />
          <DestructiveButton label="Remove device" onPress={openRemoveConfirm} />
        </View>
      ) : null}

      {isLive && usesLoraUi(device) ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton
            label="Configure Device"
            onPress={() => router.push('/setup/pairing-config')}
          />
          <SecondaryButton label="View Signal Test" onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { gatewayId: device.rootGatewayId || device.gatewayId, deviceId: device.id } })} />
          <DestructiveButton label="Remove device" onPress={openRemoveConfirm} />
        </View>
      ) : null}

      <Portal>
        <Dialog visible={removeConfirmVisible} onDismiss={() => setRemoveConfirmVisible(false)} style={modalSurfaceFit}>
          <Dialog.Title>Remove device?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.warning, fontWeight: '800', lineHeight: 20, marginBottom: spacing.sm }}>
              {removeRoleWarning}
            </Text>
            <Text style={{ color: colors.mutedStrong, lineHeight: 22 }}>
              This will remove the device from your app and reset its saved Wi‑Fi. The device will return to provisioning mode.
            </Text>
            {liveW?.role === 'gateway' || liveW?.firebaseRole === 'GATEWAY' ? (
              <Text style={{ color: colors.warning, fontWeight: '700', marginTop: spacing.sm, lineHeight: 20 }}>
                If this device is in Gateway mode, child nodes will stop reporting through this gateway.
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveConfirmVisible(false)}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.danger} textColor="#fff" onPress={() => void runConfirmedRemove()}>
              Remove device
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={removeSending} dismissable={false} style={modalSurfaceFit}>
          <Dialog.Title>Removing…</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ActivityIndicator />
              <Text style={{ flex: 1, color: colors.mutedStrong, lineHeight: 20 }}>Sending reset command to device…</Text>
            </View>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={firebasePathsVisible} onDismiss={() => setFirebasePathsVisible(false)} style={modalSurfaceFit}>
          <Dialog.Title>Firebase paths</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.mutedStrong, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}>
              devices/{deviceId}/latest{'\n'}
              devices/{deviceId}/status{'\n'}
              devices/{deviceId}/commands/inbox/{'{commandId}'}{'\n'}
              devices/{deviceId}/commands/acks/{'{commandId}'}{'\n'}
              networks/{remoteNetworkId ?? '{networkId}'}/devices/{deviceId}/commands/inbox/{'{commandId}'}{'\n'}
              networks/{remoteNetworkId ?? '{networkId}'}/devices/{deviceId}/commands/acks/{'{commandId}'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFirebasePathsVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={offlineRemoveVisible} onDismiss={() => setOfflineRemoveVisible(false)} style={modalSurfaceFit}>
          <Dialog.Title>No confirmation</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.mutedStrong, lineHeight: 22 }}>
              Device did not confirm reset. It may be offline. Remove locally anyway?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOfflineRemoveVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={() => void removeLocallyOnly()}>
              Remove locally
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <NotificationSnackbar
        visible={!!errorSnackbar}
        onDismiss={() => setErrorSnackbar(null)}
        duration={6000}
        message={errorSnackbar ?? ''}
      />
    </AppScreen>
  );
}
