import { Bluetooth, CheckCircle2, Cpu, Lock, Network, Radio, Router, ShieldCheck, Wifi, WifiOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, Dialog, Portal, ProgressBar, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { colors, modalSurfaceFit, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { useDeviceLatest } from '../../hooks/useDeviceLatest';
import { usePairingBle } from '../../hooks/usePairingBle';
import type { WifiScanItem } from '../../types/pairing';
import { DEFAULT_NETWORK_ID } from '../../utils/pairingUtils';

function signalQuality(rssi: number): string {
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -70) return 'Good';
  if (rssi >= -85) return 'Weak';
  return 'Poor';
}

function signalLevel(network: WifiScanItem): number {
  if (typeof network.signal_level === 'number') return Math.max(1, Math.min(4, Math.round(network.signal_level)));
  if (network.rssi >= -55) return 4;
  if (network.rssi >= -67) return 3;
  if (network.rssi >= -75) return 2;
  return 1;
}

function signalIconColor(network: WifiScanItem): string {
  const level = signalLevel(network);
  if (level >= 4) return colors.success;
  if (level === 3) return colors.primary;
  if (level === 2) return colors.warning;
  return colors.mutedStrong;
}

function dedupeWifiNetworks(items: WifiScanItem[]): WifiScanItem[] {
  const map = new Map<string, WifiScanItem>();
  items.forEach((item) => {
    const ssid = item.ssid.trim();
    if (!ssid) return;
    const old = map.get(ssid);
    if (!old || item.rssi > old.rssi) map.set(ssid, { ...item, ssid });
  });
  return Array.from(map.values()).sort((a, b) => b.rssi - a.rssi);
}

function InfoChip({
  icon,
  label,
  value,
  tone = colors.primary,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 12 }}>{label}</Text>
      </View>
      <Text selectable numberOfLines={1} style={{ color: tone, fontWeight: '900', fontSize: 13 }}>{value || '-'}</Text>
    </View>
  );
}

function queueStatusText(size?: number, ready?: boolean): string {
  if (ready === false) return 'Persistent queue not ready; check ESP32 partition/LittleFS.';
  if (ready === true && (size ?? 0) === 0) return 'All cloud data synced.';
  if (ready === true && (size ?? 0) > 0) return 'Stored locally, waiting for Wi-Fi/Firebase.';
  return 'Queue status unknown.';
}

export default function GatewayWifiSetupScreen() {
  const router = useRouter();
  const ble = usePairingBle();
  const { addRegisteredDevice } = useMockApp();
  const [deviceId, setDeviceId] = useState('');
  const [networkId, setNetworkId] = useState(DEFAULT_NETWORK_ID);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [wifiNetworks, setWifiNetworks] = useState<WifiScanItem[]>([]);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiScanRequested, setWifiScanRequested] = useState(false);
  const [wifiScanDone, setWifiScanDone] = useState(false);
  const [wifiScanUnavailable, setWifiScanUnavailable] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<WifiScanItem | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [wifiSent, setWifiSent] = useState(false);
  const [wifiConnected, setWifiConnected] = useState(false);
  const [wifiStatusConfirmed, setWifiStatusConfirmed] = useState(false);
  const [wifiIp, setWifiIp] = useState<string | null>(null);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [infoTimedOut, setInfoTimedOut] = useState(false);
  const [infoRequestCount, setInfoRequestCount] = useState(0);
  const [firebaseTimedOut, setFirebaseTimedOut] = useState(false);
  const [handledWifiScanKey, setHandledWifiScanKey] = useState('');
  const [handledWifiResultKey, setHandledWifiResultKey] = useState('');
  const fallbackDeviceId = ble.connectedDevice?.name?.startsWith('WQMPAIR_')
    ? ble.connectedDevice.name.slice('WQMPAIR_'.length)
    : ble.connectedDevice?.name ?? '';
  const effectiveDeviceId = deviceId || fallbackDeviceId;
  const { latest, status } = useDeviceLatest(networkId, effectiveDeviceId || '-');

  const latestWifiScanNotification = useMemo(
    () => ble.notifications.find((notification) => notification.type === 'wifi_scan'),
    [ble.notifications],
  );
  const latestWifiResultNotification = useMemo(
    () => ble.notifications.find((notification) => notification.type === 'wifi_result'),
    [ble.notifications],
  );
  const firebaseSeen = !!latest || !!status;
  const selectedSsid = selectedWifi?.ssid ?? manualSsid.trim();
  const selectedSecure = selectedWifi ? selectedWifi.secure !== false : true;
  const connectingInModal = wifiSent && !wifiConnected;
  const setupComplete = wifiConnected && wifiStatusConfirmed && firebaseSeen;
  const setupProgressValue = setupComplete ? 1 : wifiStatusConfirmed ? 0.78 : wifiConnected ? 0.58 : wifiSent ? 0.34 : 0.12;
  const setupStatusText = setupComplete
    ? 'Device added and server acknowledgement received.'
    : wifiStatusConfirmed
      ? 'Wi-Fi connected. Waiting for server acknowledgement...'
      : wifiConnected
        ? 'Device ACK received. Verifying Wi-Fi status...'
        : wifiSent
        ? 'Sending Wi-Fi credentials and waiting for device ACK...'
        : 'Select a Wi-Fi network to continue.';

  useEffect(() => {
    if (!ble.info) return;
    setDeviceId(ble.info.deviceId);
    setNetworkId(ble.info.networkId || DEFAULT_NETWORK_ID);
    setInfoTimedOut(false);
  }, [ble.info]);

  const requestInfo = async () => {
    setInfoTimedOut(false);
    setInfoRequestCount((prev) => prev + 1);
    try {
      await ble.actions.getInfo();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not request device info.';
      console.warn('[BLE INFO] Request failed:', message);
      if (ble.connectedDevice) ble.setError(message);
    }
  };

  useEffect(() => {
    if (!ble.connectedDevice || ble.info) {
      setInfoTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setInfoTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [ble.connectedDevice, ble.info, infoRequestCount]);

  useEffect(() => {
    if (!ble.connectedDevice || ble.info) return;
    const retry2 = setTimeout(() => {
      if (!ble.info) void requestInfo();
    }, 2000);
    const retry3 = setTimeout(() => {
      if (!ble.info) void requestInfo();
    }, 5000);
    return () => {
      clearTimeout(retry2);
      clearTimeout(retry3);
    };
  }, [ble.connectedDevice, ble.info]);

  const startWifiScan = useCallback(async () => {
    if (!ble.connectedDevice) {
      setWifiError('BLE device is disconnected. Go back and reconnect the device.');
      setWifiScanning(false);
      return;
    }
      console.log('[WIFI UI] Sending Wi-Fi scan command: {"v":2,"cmd_id":"app_...","cmd":"scan_wifi","args":{}}');
    setWifiScanRequested(true);
    setWifiScanning(true);
    setWifiScanUnavailable(false);
    setWifiError(null);
    try {
      await ble.actions.scanWifi(false);
    } catch (error) {
      setWifiScanning(false);
      setWifiError(error instanceof Error ? error.message : 'Could not send Wi-Fi scan command.');
    }
  }, [ble.actions, ble.connectedDevice]);

  useEffect(() => {
    if (setupStep !== 2 || wifiScanRequested || wifiScanDone) return;
    void startWifiScan();
  }, [setupStep, startWifiScan, wifiScanDone, wifiScanRequested]);

  useEffect(() => {
    if (!latestWifiScanNotification || latestWifiScanNotification.type !== 'wifi_scan') return;
    const key = JSON.stringify({
      ok: latestWifiScanNotification.ok,
      message: latestWifiScanNotification.message,
      count: latestWifiScanNotification.count,
      total_found: latestWifiScanNotification.total_found,
      items: latestWifiScanNotification.items,
    });
    if (key === handledWifiScanKey) return;
    setHandledWifiScanKey(key);
      setWifiScanning(false);
      if (latestWifiScanNotification.ok === false) {
        setWifiError(latestWifiScanNotification.message ?? 'Wi-Fi scan failed. Tap Refresh to try again.');
        setWifiScanUnavailable(true);
        setWifiScanDone(true);
        return;
      }
      if (Array.isArray(latestWifiScanNotification.items)) {
        const networks = dedupeWifiNetworks(latestWifiScanNotification.items);
        console.log('[WIFI UI] Parsed Wi-Fi scan networks:', networks.length, networks.map((network) => network.ssid).join(', '));
        setWifiNetworks(networks);
        setWifiScanUnavailable(false);
        setWifiError(null);
        setWifiScanDone(true);
        if (!selectedWifi && !manualSsid.trim() && networks.length > 0) setSelectedWifi(networks[0]);
      } else {
        setWifiScanUnavailable(true);
        setWifiScanDone(true);
      }
  }, [handledWifiScanKey, latestWifiScanNotification, manualSsid, selectedWifi]);

  useEffect(() => {
    if (!latestWifiResultNotification || latestWifiResultNotification.type !== 'wifi_result') return;
    const key = JSON.stringify(latestWifiResultNotification);
    if (key === handledWifiResultKey) return;
    setHandledWifiResultKey(key);
      if (latestWifiResultNotification.ok === false) {
        setWifiError(latestWifiResultNotification.message ?? 'Wi-Fi connection failed. Please check the password and try again.');
        setWifiSent(false);
        setWifiConnected(false);
        setWifiStatusConfirmed(false);
        return;
      }
      if (latestWifiResultNotification.stage === 'connected') {
        setWifiConnected(true);
        setWifiStatusConfirmed(true);
        setWifiIp(typeof latestWifiResultNotification.ip === 'string' ? latestWifiResultNotification.ip : null);
        setPasswordModalVisible(false);
        setTimeout(() => void requestInfo(), 1000);
      }
  }, [handledWifiResultKey, latestWifiResultNotification]);

  useEffect(() => {
    if (!wifiConnected) {
      setWifiStatusConfirmed(false);
      return;
    }
    if (ble.info?.wifiConnected) setWifiStatusConfirmed(true);
  }, [ble.info?.wifiConnected, wifiConnected]);

  useEffect(() => {
    if (!wifiConnected || wifiStatusConfirmed || !ble.connectedDevice) return;
    const timer = setInterval(() => {
      void requestInfo();
    }, 3000);
    return () => clearInterval(timer);
  }, [ble.connectedDevice, wifiConnected, wifiStatusConfirmed]);

  useEffect(() => {
    if (!wifiStatusConfirmed) {
      setFirebaseTimedOut(false);
      return;
    }
    if (firebaseSeen) {
      setFirebaseTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setFirebaseTimedOut(true), 30000);
    return () => clearTimeout(timer);
  }, [firebaseSeen, wifiStatusConfirmed]);

  useEffect(() => {
    if (!setupComplete || !effectiveDeviceId) return;
    void addRegisteredDevice(effectiveDeviceId, {
      name: effectiveDeviceId,
      networkId,
      roleHint: 'GATEWAY',
      rootGatewayId: effectiveDeviceId,
      parentId: '',
      bleConfigName: ble.connectedDevice?.name ?? `WQM${effectiveDeviceId}`,
    });
  }, [addRegisteredDevice, ble.connectedDevice?.name, effectiveDeviceId, networkId, setupComplete]);

  useEffect(() => {
    if (setupComplete) setSuccessModalVisible(true);
  }, [setupComplete]);

  const connectDisabled = !ble.connectedDevice || !selectedSsid || (selectedSecure && !password);

  const refreshWifi = async () => {
    setWifiError(null);
    setWifiNetworks([]);
    setHandledWifiScanKey('');
    setWifiScanRequested(false);
    setWifiScanDone(false);
    setWifiScanUnavailable(false);
    await startWifiScan();
  };

  const sendWifi = async () => {
    if (connectDisabled) return;
    setWifiError(null);
    setWifiSent(true);
    setWifiConnected(false);
    setWifiStatusConfirmed(false);
    setSuccessModalVisible(false);
    await ble.actions.setWifi(selectedSsid, password, true);
  };

  const openWifiPasswordModal = (network: WifiScanItem) => {
    setSelectedWifi(network);
    setManualSsid('');
    setPassword('');
    setWifiError(null);
    setPasswordModalVisible(true);
  };

  const openManualWifiModal = () => {
    setSelectedWifi(null);
    setManualSsid('');
    setPassword('');
    setWifiError(null);
    setPasswordModalVisible(true);
  };

  const resetWifiStepState = () => {
    setWifiNetworks([]);
    setWifiScanning(false);
    setWifiScanRequested(false);
    setWifiScanDone(false);
    setWifiScanUnavailable(false);
    setSelectedWifi(null);
    setManualSsid('');
    setPassword('');
    setWifiSent(false);
    setWifiConnected(false);
    setWifiStatusConfirmed(false);
    setWifiIp(null);
    setWifiError(null);
    setFirebaseTimedOut(false);
    setHandledWifiScanKey('');
    setHandledWifiResultKey('');
    setPasswordModalVisible(false);
    setSuccessModalVisible(false);
  };

  const disconnectAndRescan = async () => {
    resetWifiStepState();
    setSetupStep(1);
    await ble.disconnect();
    await ble.startScan();
  };

  const goToWifiStep = () => {
    resetWifiStepState();
    setSetupStep(2);
  };

  if (setupStep === 1) {
    return (
      <AppScreen scroll={false} contentStyle={{ paddingBottom: 0 }}>
        <AppHeader
          title="Add device"
          subtitle="Scan and connect to your WQMPAIR device"
          wizardStep={{ current: 1, total: 2 }}
          onBack={() => {
            void ble.disconnect();
            router.back();
          }}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        >
          {ble.error ? (
            <Card style={{ borderRadius: radius.lg, backgroundColor: '#FEF2F2' }}>
              <Card.Content>
                <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{ble.error}</Text>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>BLE device scan</Text>
                  <Text style={{ color: colors.mutedStrong, marginTop: 4 }}>Put the device in Pairing Mode. It should advertise as WQMPAIR_.</Text>
                </View>
                <SecondaryButton label={ble.scanning ? 'Scanning...' : 'Scan'} disabled={ble.scanning || ble.connecting} onPress={() => void ble.startScan()} />
              </View>

              <View
                style={{
                  maxHeight: 300,
                  minHeight: 170,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surfaceMuted,
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.sm, gap: spacing.sm }}>
                  {ble.devices.length === 0 ? (
                    <View style={{ minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                      <Bluetooth size={30} color={colors.mutedStrong} />
                      <Text style={{ color: colors.mutedStrong, textAlign: 'center' }}>
                        {ble.scanning ? 'Scanning for nearby WQMPAIR devices...' : 'No BLE devices found yet. Tap Scan.'}
                      </Text>
                    </View>
                  ) : null}

                  {ble.devices.map((device) => {
                    const connected = ble.connectedDevice?.id === device.id;
                    return (
                      <View
                        key={device.id}
                        style={{
                          borderWidth: 1,
                          borderColor: connected ? colors.primary : colors.border,
                          borderRadius: radius.md,
                          backgroundColor: connected ? '#EEF6FF' : colors.card,
                          padding: spacing.sm,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                          <Bluetooth size={20} color={connected ? colors.success : colors.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text selectable numberOfLines={1} style={{ color: colors.navy, fontWeight: '900' }}>{device.name}</Text>
                          <Text numberOfLines={1} style={{ color: colors.mutedStrong, fontWeight: '700', fontSize: 12 }}>
                            {device.deviceId} - {device.rssi} dBm
                          </Text>
                        </View>
                        {connected ? (
                          <SecondaryButton label="Disconnect" disabled={ble.connecting} onPress={() => void disconnectAndRescan()} />
                        ) : (
                          <PrimaryButton label="Connect" loading={ble.connecting} disabled={ble.connecting || !!ble.connectedDevice} onPress={() => void ble.connect(device.id)} />
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <Text selectable style={{ color: colors.mutedStrong, lineHeight: 20 }}>{ble.scanSummary}</Text>
            </Card.Content>
          </Card>

          {ble.connectedDevice ? (
            <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
              <Card.Content style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Connected device</Text>
                    <Text selectable numberOfLines={1} style={{ color: colors.success, fontWeight: '800', marginTop: 4 }}>
                      {ble.connectedDevice.name}
                    </Text>
                  </View>
                  <SecondaryButton label="Disconnect" disabled={ble.connecting} onPress={() => void disconnectAndRescan()} />
                </View>

                {!ble.info ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={{ color: colors.mutedStrong }}>Loading device information...</Text>
                    {fallbackDeviceId ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <InfoChip icon={<Cpu size={14} color={colors.primary} />} label="Device ID" value={fallbackDeviceId} />
                        <InfoChip icon={<Network size={14} color={colors.primary} />} label="Network" value={networkId || DEFAULT_NETWORK_ID} />
                      </View>
                    ) : null}
                    {infoTimedOut ? (
                      <>
                        <Text style={{ color: colors.warning, fontWeight: '800' }}>Device info was not received yet.</Text>
                        <SecondaryButton label="Retry info" onPress={() => void requestInfo()} />
                      </>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <InfoChip icon={<Cpu size={14} color={colors.primary} />} label="Device ID" value={ble.info.deviceId} />
                    <InfoChip icon={<Network size={14} color={colors.primary} />} label="Network" value={ble.info.networkId || DEFAULT_NETWORK_ID} />
                    <InfoChip icon={<Router size={14} color={colors.primary} />} label="Role" value={ble.info.role} />
                    <InfoChip icon={<ShieldCheck size={14} color={colors.primary} />} label="Mode" value={ble.info.switchMode} />
                    <InfoChip icon={<Cpu size={14} color={colors.primary} />} label="Firmware" value={ble.info.fw ?? 'v3.2.17'} />
                    <InfoChip icon={<Bluetooth size={14} color={colors.primary} />} label="BLE protocol" value={ble.info.protocol ?? '-'} />
                    <InfoChip
                      icon={<Radio size={14} color={ble.info.loraReady ? colors.success : colors.warning} />}
                      label="LoRa"
                      value={ble.info.loraReady ? 'Ready' : 'Not ready'}
                      tone={ble.info.loraReady ? colors.success : colors.warning}
                    />
                    <InfoChip
                      icon={ble.info.wifiConnected ? <Wifi size={14} color={colors.success} /> : <WifiOff size={14} color={colors.mutedStrong} />}
                      label="Wi-Fi"
                      value={ble.info.wifiConnected ? 'Connected' : 'Not connected'}
                      tone={ble.info.wifiConnected ? colors.success : colors.mutedStrong}
                    />
                    <InfoChip
                      icon={<Network size={14} color={ble.info.offlineQueueReady === false ? colors.danger : colors.primary} />}
                      label="Offline queue"
                      value={`${ble.info.offlineFirebaseQueueSize ?? 0} pending`}
                      tone={ble.info.offlineQueueReady === false ? colors.danger : colors.primary}
                    />
                    <InfoChip
                      icon={<ShieldCheck size={14} color={ble.info.offlineQueueReady === false ? colors.danger : colors.primary} />}
                      label="Queue ready"
                      value={ble.info.offlineQueueReady === undefined ? '-' : ble.info.offlineQueueReady ? 'yes' : 'no'}
                      tone={ble.info.offlineQueueReady === false ? colors.danger : colors.primary}
                    />
                    <InfoChip icon={<Network size={14} color={colors.primary} />} label="Gateway uplink queue" value={String(ble.info.gatewayUplinkQueueSize ?? 0)} />
                    <InfoChip icon={<Network size={14} color={colors.primary} />} label="Pairing cloud queue" value={String(ble.info.pairingCloudQueueSize ?? 0)} />
                    <InfoChip icon={<Network size={14} color={colors.primary} />} label="Forward queue" value={String(ble.info.forwardQueueSize ?? 0)} />
                    <Text style={{ color: ble.info.offlineQueueReady === false ? colors.danger : colors.mutedStrong, fontWeight: '800', lineHeight: 20 }}>
                      {queueStatusText(ble.info.offlineFirebaseQueueSize, ble.info.offlineQueueReady)}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
          }}
        >
          <PrimaryButton label="Step 2: Wi-Fi connection" disabled={!ble.connectedDevice} onPress={goToWifiStep} />
          {!ble.connectedDevice ? (
            <Text style={{ color: colors.mutedStrong, textAlign: 'center', fontWeight: '700' }}>Connect a BLE device to continue.</Text>
          ) : null}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title="Add Single / Gateway Device"
        subtitle="Connect by BLE and send Wi-Fi credentials"
        wizardStep={{ current: 2, total: 2 }}
        onBack={() => setSetupStep(1)}
      />

      {!ble.connectedDevice ? (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: '#FEF2F2', ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <Text style={{ color: colors.danger, fontWeight: '900', fontSize: 18 }}>BLE device disconnected</Text>
              <Text style={{ color: colors.mutedStrong }}>Go back to Step 1 and reconnect the device before setting up Wi-Fi.</Text>
              <PrimaryButton label="Back to BLE scan" onPress={() => setSetupStep(1)} />
            </Card.Content>
          </Card>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Wi-Fi networks</Text>
                <SecondaryButton label={wifiScanning ? 'Scanning...' : 'Refresh'} disabled={wifiScanning} onPress={() => void refreshWifi()} />
              </View>

              {wifiScanUnavailable ? (
                <Text style={{ color: colors.warning, fontWeight: '800' }}>
                  Wi-Fi scan is not available in this firmware. Enter SSID manually.
                </Text>
              ) : null}

              {wifiScanDone && wifiNetworks.length === 0 ? (
                <Text style={{ color: colors.mutedStrong }}>
                  No Wi-Fi networks found. Tap Refresh or add a network manually.
                </Text>
              ) : null}

              <View
                style={{
                  maxHeight: 390,
                  minHeight: 230,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surfaceMuted,
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.sm, gap: spacing.sm }}>
                  {wifiNetworks.length === 0 ? (
                    <View style={{ minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                      <Wifi size={32} color={colors.mutedStrong} />
                      <Text style={{ color: colors.mutedStrong, textAlign: 'center' }}>
                        {wifiScanning ? 'Scanning nearby Wi-Fi networks...' : 'Wi-Fi networks will appear here.'}
                      </Text>
                    </View>
                  ) : null}

                  {wifiNetworks.map((network) => {
                    return (
                      <Pressable
                        key={network.ssid}
                        onPress={() => openWifiPasswordModal(network)}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: radius.md,
                          padding: spacing.md,
                          backgroundColor: colors.card,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        <Wifi size={24} color={signalIconColor(network)} strokeWidth={1.8 + signalLevel(network) * 0.35} />
                        <View style={{ flex: 1 }}>
                          <Text selectable numberOfLines={1} style={{ color: colors.navy, fontWeight: '900' }}>{network.ssid}</Text>
                          <Text style={{ color: colors.mutedStrong }}>
                            {network.secure === false ? 'Open' : 'Locked/Secured'} - {network.rssi} dBm - {signalQuality(network.rssi)}
                          </Text>
                        </View>
                        {network.secure === false ? null : <Lock size={18} color={colors.mutedStrong} />}
                      </Pressable>
                    );
                  })}

                  <SecondaryButton label="Add network manually" disabled={!ble.connectedDevice} onPress={openManualWifiModal} />
                </ScrollView>
              </View>
            </Card.Content>
          </Card>

          {(wifiSent || wifiConnected) ? (
            <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
              <Card.Content style={{ gap: spacing.md }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Connection progress</Text>
                <ProgressBar progress={setupProgressValue} color={setupComplete ? colors.success : colors.primary} style={{ height: 10, borderRadius: 999 }} />
                <Text style={{ color: firebaseTimedOut ? colors.warning : colors.mutedStrong, fontWeight: '800' }}>
                  {firebaseTimedOut ? 'Wi-Fi connected, but server acknowledgement was not received yet.' : setupStatusText}
                </Text>
                {selectedSsid ? <Text selectable style={{ color: colors.mutedStrong }}>SSID: {selectedSsid}</Text> : null}
                {wifiIp ? <Text selectable style={{ color: colors.mutedStrong }}>Device IP: {wifiIp}</Text> : null}
              </Card.Content>
            </Card>
          ) : null}
        </View>
      )}
      <Portal>
        <Dialog visible={passwordModalVisible} dismissable={!connectingInModal} onDismiss={() => setPasswordModalVisible(false)} style={modalSurfaceFit}>
          <Dialog.Title>Connect to Wi-Fi</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {selectedWifi ? <Wifi size={24} color={signalIconColor(selectedWifi)} strokeWidth={1.8 + signalLevel(selectedWifi) * 0.35} /> : null}
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.navy, fontWeight: '900', fontSize: 17 }}>{selectedSsid || 'Wi-Fi network'}</Text>
                  {selectedWifi ? (
                    <Text style={{ color: colors.mutedStrong }}>
                      {selectedWifi.secure === false ? 'Open' : 'Locked/Secured'} - {selectedWifi.rssi} dBm
                    </Text>
                  ) : (
                    <Text style={{ color: colors.mutedStrong }}>Manual network</Text>
                  )}
                </View>
              </View>

              {!selectedWifi ? (
                <TextInput
                  mode="outlined"
                  label="Network name"
                  value={manualSsid}
                  onChangeText={setManualSsid}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : null}

              {selectedSecure ? (
                <TextInput
                  mode="outlined"
                  label="Wi-Fi password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  right={<TextInput.Icon icon={passwordVisible ? 'eye-off' : 'eye'} onPress={() => setPasswordVisible((prev) => !prev)} />}
                />
              ) : (
                <Text style={{ color: colors.mutedStrong }}>This network is open, so no password is required.</Text>
              )}

              {wifiError ? <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{wifiError}</Text> : null}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <SecondaryButton label="Cancel" disabled={connectingInModal} style={{ flex: 1 }} onPress={() => setPasswordModalVisible(false)} />
                <PrimaryButton
                  label={connectingInModal ? 'Connecting...' : wifiError ? 'Reconnect' : 'Connect'}
                  disabled={connectDisabled}
                  loading={connectingInModal}
                  style={{ flex: 1 }}
                  onPress={() => void sendWifi()}
                />
              </View>
            </View>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={successModalVisible} dismissable={false} style={modalSurfaceFit}>
          <Dialog.Content>
            <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.md }}>
              <View style={{ width: 72, height: 72, borderRadius: 28, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={42} color={colors.success} />
              </View>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 22, textAlign: 'center' }}>Device added successfully</Text>
              <Text style={{ color: colors.mutedStrong, textAlign: 'center', lineHeight: 21 }}>
                Wi-Fi connected, device acknowledgement received, and app server check completed.
              </Text>
              <View style={{ width: '100%', gap: spacing.sm }}>
                <Text selectable style={{ color: colors.mutedStrong }}>Device ID: {effectiveDeviceId}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {networkId}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Wi-Fi SSID: {selectedSsid}</Text>
              </View>
              <PrimaryButton
                label="Go to Dashboard"
                style={{ width: '100%' }}
                onPress={() => router.replace({ pathname: '/devices/[deviceId]', params: { deviceId: effectiveDeviceId, networkId } })}
              />
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </AppScreen>
  );
}
