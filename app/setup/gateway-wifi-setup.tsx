import { Lock, Wifi } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { BleDeviceCard } from '../../components/pairing/BleDeviceCard';
import { PairingProgress } from '../../components/pairing/PairingProgress';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { useDeviceLatest } from '../../hooks/useDeviceLatest';
import { usePairingBle } from '../../hooks/usePairingBle';
import type { PairingProgressState, WifiScanItem } from '../../types/pairing';
import { DEFAULT_NETWORK_ID } from '../../utils/pairingUtils';

function signalQuality(rssi: number): string {
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -70) return 'Good';
  if (rssi >= -85) return 'Weak';
  return 'Poor';
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

export default function GatewayWifiSetupScreen() {
  const router = useRouter();
  const ble = usePairingBle();
  const { addRegisteredDevice } = useMockApp();
  const [deviceId, setDeviceId] = useState('');
  const [networkId, setNetworkId] = useState(DEFAULT_NETWORK_ID);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [wifiNetworks, setWifiNetworks] = useState<WifiScanItem[]>([]);
  const [wifiScanRequested, setWifiScanRequested] = useState(false);
  const [wifiScanAliasTried, setWifiScanAliasTried] = useState(false);
  const [wifiScanDone, setWifiScanDone] = useState(false);
  const [wifiScanUnavailable, setWifiScanUnavailable] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<WifiScanItem | null>(null);
  const [manualSsid, setManualSsid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [wifiSent, setWifiSent] = useState(false);
  const [wifiConnected, setWifiConnected] = useState(false);
  const [wifiIp, setWifiIp] = useState<string | null>(null);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [infoTimedOut, setInfoTimedOut] = useState(false);
  const [infoRequestCount, setInfoRequestCount] = useState(0);
  const [firebaseTimedOut, setFirebaseTimedOut] = useState(false);
  const fallbackDeviceId = ble.connectedDevice?.name?.startsWith('WQMPAIR_')
    ? ble.connectedDevice.name.slice('WQMPAIR_'.length)
    : ble.connectedDevice?.name ?? '';
  const effectiveDeviceId = deviceId || fallbackDeviceId;
  const { latest, status } = useDeviceLatest(networkId, effectiveDeviceId || '-');

  const latestNotification = ble.notifications[0];
  const firebaseSeen = !!latest || !!status;
  const selectedSsid = selectedWifi?.ssid ?? manualSsid.trim();
  const selectedSecure = selectedWifi ? selectedWifi.secure : true;

  useEffect(() => {
    if (!ble.info) return;
    setDeviceId(ble.info.device_id);
    setNetworkId(ble.info.network_id || DEFAULT_NETWORK_ID);
    setInfoTimedOut(false);
  }, [ble.info]);

  const requestInfo = async () => {
    setInfoTimedOut(false);
    setInfoRequestCount((prev) => prev + 1);
    await ble.actions.getInfo();
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

  useEffect(() => {
    if (!ble.info || wifiScanRequested || wifiScanDone) return;
    setWifiScanRequested(true);
    setWifiScanAliasTried(false);
    void ble.actions.scanWifi();
  }, [ble.actions, ble.info, wifiScanDone, wifiScanRequested]);

  useEffect(() => {
    if (!wifiScanRequested || wifiScanDone) return;
    const timer = setTimeout(() => {
      if (!wifiScanAliasTried) {
        setWifiScanAliasTried(true);
        void ble.actions.scanWifi(true);
        return;
      }
      setWifiScanUnavailable(true);
      setWifiScanDone(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [ble.actions, wifiScanAliasTried, wifiScanDone, wifiScanRequested]);

  useEffect(() => {
    if (!latestNotification) return;
    if (latestNotification.type === 'wifi_scan') {
      if (latestNotification.ok && Array.isArray(latestNotification.items)) {
        const networks = dedupeWifiNetworks(latestNotification.items);
        setWifiNetworks(networks);
        setWifiScanUnavailable(false);
        setWifiScanDone(true);
        if (!selectedWifi && !manualSsid.trim() && networks.length > 0) setSelectedWifi(networks[0]);
      } else {
        setWifiScanUnavailable(true);
        setWifiScanDone(true);
      }
    }
    if (latestNotification.type === 'wifi_result') {
      if (latestNotification.ok === false) {
        setWifiError(latestNotification.message ?? 'Wi-Fi connection failed. Please check the password and try again.');
        setWifiConnected(false);
        return;
      }
      if (latestNotification.stage === 'connected') {
        setWifiConnected(true);
        setWifiIp(typeof latestNotification.ip === 'string' ? latestNotification.ip : null);
      }
    }
    if (latestNotification.type === 'set_id' && latestNotification.ok) setIdentitySaved(true);
  }, [latestNotification, manualSsid, selectedWifi]);

  useEffect(() => {
    if (!wifiConnected) {
      setFirebaseTimedOut(false);
      return;
    }
    if (firebaseSeen) {
      setFirebaseTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setFirebaseTimedOut(true), 30000);
    return () => clearTimeout(timer);
  }, [firebaseSeen, wifiConnected]);

  useEffect(() => {
    if (!wifiConnected || !firebaseSeen || !effectiveDeviceId) return;
    void addRegisteredDevice(effectiveDeviceId, {
      name: effectiveDeviceId,
      networkId,
      roleHint: 'GATEWAY',
      rootGatewayId: effectiveDeviceId,
      parentId: '',
      bleConfigName: ble.connectedDevice?.name ?? `WQM${effectiveDeviceId}`,
    });
  }, [addRegisteredDevice, ble.connectedDevice?.name, effectiveDeviceId, firebaseSeen, networkId, wifiConnected]);

  const progress = useMemo<PairingProgressState>(
    () => ({
      bleConnected: !!ble.connectedDevice,
      infoLoaded: !!ble.info,
      wifiScanDone,
      wifiSent,
      wifiConnected,
      serverTestConfirmed: firebaseSeen,
      error: wifiError ?? (firebaseTimedOut ? 'Wi-Fi connected, but server test was not confirmed. Check Firebase settings.' : undefined),
    }),
    [ble.connectedDevice, ble.info, firebaseSeen, firebaseTimedOut, identitySaved, wifiConnected, wifiError, wifiScanDone, wifiSent],
  );

  const advancedProgress = useMemo<PairingProgressState>(
    () => ({
      bleConnected: !!ble.connectedDevice,
      infoLoaded: !!ble.info,
      identitySaved,
    }),
    [ble.connectedDevice, ble.info, identitySaved],
  );

  const connectDisabled = !ble.connectedDevice || !selectedSsid || (selectedSecure && !password);

  const refreshWifi = async () => {
    setWifiScanRequested(true);
    setWifiScanAliasTried(false);
    setWifiScanDone(false);
    setWifiScanUnavailable(false);
    await ble.actions.scanWifi();
  };

  const saveIdentity = async () => {
    if (!deviceId.trim() || !networkId.trim()) return;
    setIdentitySaved(false);
    await ble.actions.setIdentity(deviceId.trim(), networkId.trim());
  };

  const sendWifi = async () => {
    if (connectDisabled) return;
    setWifiError(null);
    setWifiSent(true);
    await ble.actions.setWifi(selectedSsid, password, true);
  };

  const resetForAnother = async () => {
    await ble.disconnect();
    router.replace('/setup/gateway-wifi-setup');
  };

  return (
    <AppScreen>
      <AppHeader
        title="Add Single / Gateway Device"
        subtitle="Connect by BLE and send Wi-Fi credentials"
        onBack={() => {
          void ble.disconnect();
          router.back();
        }}
      />

      {ble.error ? (
        <Card style={{ borderRadius: radius.lg, backgroundColor: '#FEF2F2', marginBottom: spacing.md }}>
          <Card.Content>
            <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{ble.error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {!ble.connectedDevice ? (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Turn the device switch to Pairing Mode.</Text>
              <Text style={{ color: colors.mutedStrong, lineHeight: 21 }}>
                The blue LED should blink while the device advertises as WQMPAIR_WQM...
              </Text>
              <PrimaryButton label={ble.scanning ? 'Scanning...' : 'Scan WQM devices'} loading={ble.scanning} onPress={() => void ble.startScan()} />
              <Text selectable style={{ color: colors.mutedStrong, lineHeight: 20 }}>{ble.scanSummary}</Text>
            </Card.Content>
          </Card>

          {ble.devices.length === 0 && !ble.scanning ? (
            <Text style={{ color: colors.mutedStrong }}>
              No device found. Make sure the switch is in Pairing Mode and the blue LED is blinking.
            </Text>
          ) : null}

          {ble.devices.map((device) => (
            <BleDeviceCard key={device.id} device={device} loading={ble.connecting} onConnect={() => void ble.connect(device.id)} />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Device info</Text>
              {!ble.info ? (
                <>
                  <Text style={{ color: colors.mutedStrong }}>Loading device info...</Text>
                  {infoTimedOut ? (
                    <>
                      <Text style={{ color: colors.warning, fontWeight: '800' }}>
                        Device connected, but info was not received. Keep the device nearby and tap Retry.
                      </Text>
                      <SecondaryButton label="Retry device info" onPress={() => void requestInfo()} />
                      <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
                        Check Serial Monitor. You should see BLE RX command: {'{"cmd":"info"}'}.
                      </Text>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text selectable style={{ color: colors.mutedStrong }}>Device ID: {ble.info.device_id}</Text>
                  <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {ble.info.network_id || DEFAULT_NETWORK_ID}</Text>
                  <Text style={{ color: colors.mutedStrong }}>Role: {ble.info.role}</Text>
                  <Text style={{ color: colors.mutedStrong }}>Switch mode: {ble.info.switch_mode}</Text>
                  <Text style={{ color: colors.mutedStrong }}>Wi-Fi connected: {ble.info.wifi_connected ? 'Yes' : 'No'}</Text>
                  <Text style={{ color: colors.mutedStrong }}>LoRa ready: {ble.info.lora_ready ? 'Yes' : 'No'}</Text>
                  <Text style={{ color: colors.mutedStrong }}>Paired: {ble.info.paired ? 'Yes' : 'No'}</Text>
                </>
              )}
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Wi-Fi networks</Text>
                <SecondaryButton label="Refresh Wi-Fi List" onPress={() => void refreshWifi()} />
              </View>

              {wifiScanUnavailable ? (
                <Text style={{ color: colors.warning, fontWeight: '800' }}>
                  Wi-Fi scan is not available in this firmware. Enter SSID manually.
                </Text>
              ) : null}

              {wifiScanDone && wifiNetworks.length === 0 ? (
                <Text style={{ color: colors.mutedStrong }}>
                  No Wi-Fi networks found. Tap Refresh or enter SSID manually.
                </Text>
              ) : null}

              {wifiNetworks.map((network) => {
                const selected = selectedWifi?.ssid === network.ssid;
                return (
                  <Pressable
                    key={network.ssid}
                    onPress={() => {
                      setSelectedWifi(network);
                      setManualSsid('');
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      backgroundColor: selected ? '#EEF6FF' : colors.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <Wifi size={22} color={selected ? colors.primary : colors.mutedStrong} />
                    <View style={{ flex: 1 }}>
                      <Text selectable style={{ color: colors.navy, fontWeight: '900' }}>{network.ssid}</Text>
                      <Text style={{ color: colors.mutedStrong }}>{signalQuality(network.rssi)} ({network.rssi} dBm)</Text>
                    </View>
                    {network.secure ? <Lock size={18} color={colors.mutedStrong} /> : null}
                  </Pressable>
                );
              })}

              <TextInput
                mode="outlined"
                label="Enter SSID manually"
                value={manualSsid}
                onChangeText={(value) => {
                  setManualSsid(value);
                  if (value.trim()) setSelectedWifi(null);
                }}
                autoCapitalize="none"
              />

              {selectedSsid ? (
                <Text selectable style={{ color: colors.navy, fontWeight: '900' }}>Selected network: {selectedSsid}</Text>
              ) : null}

              <TextInput
                mode="outlined"
                label="Wi-Fi password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                right={<TextInput.Icon icon={passwordVisible ? 'eye-off' : 'eye'} onPress={() => setPasswordVisible((prev) => !prev)} />}
              />
              {!selectedSecure && selectedSsid ? (
                <Text style={{ color: colors.mutedStrong }}>This network is open, so the password is optional.</Text>
              ) : null}
              {!ble.info ? (
                <Text style={{ color: colors.warning, fontWeight: '800' }}>
                  Device info is still loading. Wi-Fi can be tested using fallback device ID {effectiveDeviceId || 'unknown'} and network {networkId}.
                </Text>
              ) : null}
              <PrimaryButton label="Connect to Wi-Fi" disabled={connectDisabled} onPress={() => void sendWifi()} />
            </Card.Content>
          </Card>

          {__DEV__ ? (
            <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
              <Card.Content style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setDebugOpen((prev) => !prev)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>BLE Debug</Text>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>{debugOpen ? 'Hide' : 'Show'}</Text>
                </Pressable>
                {debugOpen ? (
                  <>
                    <Text selectable style={{ color: colors.mutedStrong }}>Connected device name: {ble.debug.connectedDeviceName ?? '-'}</Text>
                    <Text selectable style={{ color: colors.mutedStrong }}>Connected device ID: {ble.debug.connectedDeviceId ?? '-'}</Text>
                    <Text style={{ color: colors.mutedStrong }}>Service UUID found: {ble.debug.serviceFound ? 'Yes' : 'No'}</Text>
                    <Text style={{ color: colors.mutedStrong }}>RX characteristic found: {ble.debug.rxFound ? 'Yes' : 'No'}</Text>
                    <Text style={{ color: colors.mutedStrong }}>TX characteristic found: {ble.debug.txFound ? 'Yes' : 'No'}</Text>
                    <Text style={{ color: colors.mutedStrong }}>TX monitor started: {ble.debug.txMonitorStarted ? 'Yes' : 'No'}</Text>
                    <Text selectable style={{ color: colors.mutedStrong }}>Last command sent: {ble.debug.lastCommand ?? '-'}</Text>
                    <Text selectable style={{ color: colors.mutedStrong }}>Last raw response: {ble.debug.lastRawResponse ?? '-'}</Text>
                    <Text selectable style={{ color: colors.mutedStrong }}>Last decoded response: {ble.debug.lastDecodedResponse ?? '-'}</Text>
                    <Text selectable style={{ color: colors.danger }}>Last error: {ble.debug.lastError ?? '-'}</Text>
                  </>
                ) : null}
              </Card.Content>
            </Card>
          ) : null}

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Pressable
                onPress={() => setAdvancedOpen((prev) => !prev)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Advanced Settings</Text>
                <Text style={{ color: colors.primary, fontWeight: '900' }}>{advancedOpen ? 'Hide' : 'Show'}</Text>
              </Pressable>
              {advancedOpen ? (
                <>
                  <TextInput mode="outlined" label="Rename Device ID" value={deviceId} onChangeText={setDeviceId} autoCapitalize="characters" />
                  <TextInput mode="outlined" label="Change Network ID" value={networkId} onChangeText={setNetworkId} autoCapitalize="characters" />
                  <PrimaryButton label="Save Identity" disabled={!deviceId.trim() || !networkId.trim()} onPress={() => void saveIdentity()} />
                  <PairingProgress progress={advancedProgress} />
                </>
              ) : null}
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Setup progress</Text>
              <PairingProgress progress={progress} />
              {wifiIp ? <Text selectable style={{ color: colors.mutedStrong }}>Device IP: {wifiIp}</Text> : null}
              {wifiConnected && !firebaseSeen && !firebaseTimedOut ? (
                <Text style={{ color: colors.warning, fontWeight: '800' }}>
                  Wi-Fi connected. Waiting for Firebase data at networks/{networkId}/devices/{deviceId}/latest or status.
                </Text>
              ) : null}
            </Card.Content>
          </Card>

          {wifiConnected && firebaseSeen ? (
            <Card style={{ borderRadius: radius.xl, backgroundColor: '#ECFDF5', ...shadows.soft }}>
              <Card.Content style={{ gap: spacing.md }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 20 }}>Device connected successfully</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Device ID: {effectiveDeviceId}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {networkId}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Wi-Fi SSID: {selectedSsid}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>IP address: {wifiIp ?? '-'}</Text>
                <Text style={{ color: colors.success, fontWeight: '900' }}>Firebase status: Connected</Text>
                <Text style={{ color: colors.mutedStrong }}>Role: Single/Gateway</Text>
                <Text style={{ color: colors.navy, fontWeight: '900' }}>Turn the device switch back to Normal Mode.</Text>
                <PrimaryButton label="Go to Dashboard" onPress={() => router.replace({ pathname: '/devices/[deviceId]', params: { deviceId: effectiveDeviceId, networkId } })} />
                <SecondaryButton label="Add Another Device" onPress={() => void resetForAnother()} />
                <SecondaryButton label="Done" onPress={() => router.replace('/(tabs)/devices')} />
              </Card.Content>
            </Card>
          ) : null}
        </View>
      )}
    </AppScreen>
  );
}
