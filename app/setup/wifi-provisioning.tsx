import type { ESPWifiList } from '@orbital-systems/react-native-esp-idf-provisioning';
import { ESPWifiAuthMode } from '@orbital-systems/react-native-esp-idf-provisioning';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Button, Card, Checkbox, Dialog, Portal, ProgressBar, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { ErrorState } from '../../components/ErrorState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';
import { colors, modalSurfaceFit, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import type { ProvisioningPhase } from '../../hooks/useProvisioning';
import { useProvisioning } from '../../hooks/useProvisioning';
import { scanWifiNetworksForDevice } from '../../services/provisioning/espProvisioningService';
import {
  clearLastBleProvisioningTarget,
  saveLastBleProvisioningTarget,
} from '../../services/provisioning/lastBleProvisioningTarget';

/** Default POP used by firmware / provisioning; not shown in UI */
const DEFAULT_POP = '12345678';

function wifiBarsFromRssi(rssi: number): number {
  if (rssi >= -50) return 4;
  if (rssi >= -60) return 3;
  if (rssi >= -70) return 2;
  if (rssi >= -80) return 1;
  return 0;
}

function WifiSignalBars({ rssi }: { rssi: number }) {
  const n = wifiBarsFromRssi(rssi);
  const heights = [4, 7, 10, 13];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            backgroundColor: i < n ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function authLabel(auth: ESPWifiAuthMode): string {
  switch (auth) {
    case ESPWifiAuthMode.open:
      return 'Open';
    case ESPWifiAuthMode.wep:
      return 'WEP';
    case ESPWifiAuthMode.wpa2Enterprise:
      return 'Enterprise';
    case ESPWifiAuthMode.wpa2Psk:
      return 'WPA2';
    case ESPWifiAuthMode.wpaPsk:
      return 'WPA';
    case ESPWifiAuthMode.wpaWpa2Psk:
      return 'WPA/WPA2';
    case ESPWifiAuthMode.wpa3Psk:
      return 'WPA3';
    case ESPWifiAuthMode.wpa2Wpa3Psk:
      return 'WPA2/WPA3';
    default:
      return 'Secured';
  }
}

function provisioningProgressFraction(phase: ProvisioningPhase): number {
  switch (phase) {
    case 'connectingDevice':
      return 0.25;
    case 'sendingCredentials':
      return 0.5;
    case 'waitingForWifi':
      return 0.85;
    case 'success':
      return 1;
    case 'wrongPassword':
      return 0.45;
    case 'apNotFound':
    case 'timeout':
    case 'bleDisconnected':
    case 'error':
      return 0.75;
    default:
      return 0;
  }
}

function provisioningPhaseLabel(phase: ProvisioningPhase): string {
  switch (phase) {
    case 'connectingDevice':
      return 'Connecting to device…';
    case 'sendingCredentials':
      return 'Sending Wi‑Fi credentials…';
    case 'waitingForWifi':
      return 'Waiting for device to join Wi‑Fi…';
    case 'success':
      return 'Finishing…';
    case 'wrongPassword':
      return 'Wrong password — try again.';
    case 'apNotFound':
      return 'Network not found.';
    case 'timeout':
      return 'Timed out.';
    case 'bleDisconnected':
      return 'Bluetooth disconnected.';
    case 'error':
      return 'Something went wrong.';
    default:
      return '';
  }
}

function provisioningFailureCopy(
  phase: ProvisioningPhase,
  technicalMessage: string | null,
): { title: string; message: string } | null {
  switch (phase) {
    case 'wrongPassword':
      return {
        title: 'Wrong Wi-Fi password',
        message:
          'The network password was not accepted. Check the password for this Wi‑Fi, then tap Try again to reconnect.',
      };
    case 'apNotFound':
      return {
        title: 'Network not found',
        message: 'Wi-Fi network not found. Make sure the SSID is correct and the device is in range.',
      };
    case 'timeout':
      return {
        title: 'Connection timed out',
        message: 'Device could not connect to Wi-Fi. Please check password and signal.',
      };
    case 'bleDisconnected':
      return {
        title: 'Device disconnected',
        message: 'Device disconnected. Move closer and retry.',
      };
    case 'error':
      return {
        title: 'Provisioning failed',
        message: technicalMessage?.trim() ? technicalMessage : 'Something went wrong. Please try again.',
      };
    default:
      return null;
  }
}

export default function WifiProvisioningScreen() {
  const router = useRouter();
  const { name, rssi } = useLocalSearchParams<{ name?: string; rssi?: string }>();
  const { addRegisteredDevice } = useMockApp();
  const deviceName = useMemo(() => String(name ?? 'PROV_WQM_UNKNOWN'), [name]);

  useEffect(() => {
    const n = deviceName.trim();
    if (n.startsWith('PROV_') && n !== 'PROV_WQM_UNKNOWN') {
      const r = parseInt(String(rssi ?? '-70'), 10);
      void saveLastBleProvisioningTarget(n, Number.isFinite(r) ? r : -70);
    }
  }, [deviceName, rssi]);

  const [password, setPassword] = useState('');
  const [networks, setNetworks] = useState<ESPWifiList[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<ESPWifiList | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [scanPhase, setScanPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const passwordRef = useRef<{ focus: () => void } | null>(null);

  const { phase, errorMessage, lastSuccess, runProvision } = useProvisioning();
  const handledSuccess = useRef(false);

  const effectiveSsid = manualMode ? manualSsid.trim() : (selectedNetwork?.ssid ?? '').trim();

  const modalNeedsPassword = useMemo(() => {
    if (!effectiveSsid) return false;
    if (manualMode) return true;
    return selectedNetwork !== null && selectedNetwork.auth !== ESPWifiAuthMode.open;
  }, [manualMode, selectedNetwork, effectiveSsid]);

  const loadNetworks = useCallback(async () => {
    setScanError(null);
    setScanPhase('loading');
    try {
      const list = await scanWifiNetworksForDevice(deviceName, DEFAULT_POP);
      setNetworks(list);
      setScanPhase('idle');
      setSelectedNetwork((prev) => {
        if (!prev) return null;
        const still = list.find((n) => n.ssid === prev.ssid);
        return still ?? null;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const deviceNotAdvertising = msg.includes('Could not find this device over Bluetooth');
      if (deviceNotAdvertising) {
        console.warn('[AquaNode][wifi-provisioning] Wi‑Fi list: device not reachable over BLE', { deviceName });
      } else {
        console.error('[AquaNode][wifi-provisioning] Wi‑Fi scan failed:', e);
      }
      setScanError(msg);
      setScanPhase('error');
      setNetworks([]);
    }
  }, [deviceName]);

  useEffect(() => {
    void loadNetworks();
  }, [deviceName, loadNetworks]);

  useEffect(() => {
    handledSuccess.current = false;
  }, [deviceName]);

  useEffect(() => {
    if (
      phase === 'wrongPassword' ||
      phase === 'apNotFound' ||
      phase === 'timeout' ||
      phase === 'bleDisconnected' ||
      phase === 'error'
    ) {
      setPassword('');
      if (phase === 'wrongPassword') {
        setPasswordModalVisible(true);
        requestAnimationFrame(() => passwordRef.current?.focus());
      }
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'success' || !lastSuccess || handledSuccess.current) return;
    handledSuccess.current = true;
    void (async () => {
      try {
        await addRegisteredDevice(lastSuccess.deviceId, { bleProvisionName: deviceName });
        await clearLastBleProvisioningTarget();
      } finally {
        setPassword('');
        router.replace({
          pathname: '/setup/provisioning-success',
          params: { deviceId: lastSuccess.deviceId, ssid: lastSuccess.ssid },
        });
      }
    })();
  }, [phase, lastSuccess, addRegisteredDevice, router]);

  const handleModalConnect = useCallback(async () => {
    if (modalNeedsPassword && !password.trim()) return;
    handledSuccess.current = false;
    setPasswordModalVisible(false);
    await runProvision({ deviceName, pop: DEFAULT_POP, ssid: effectiveSsid, password: password.trim() });
  }, [modalNeedsPassword, password, deviceName, effectiveSsid, runProvision]);

  const provisioningBusy =
    phase === 'connectingDevice' ||
    phase === 'sendingCredentials' ||
    phase === 'waitingForWifi' ||
    phase === 'success';

  /** Keep the bar visible through failures so progress does not flash away mid-flow */
  const showProgressUi =
    phase === 'connectingDevice' ||
    phase === 'sendingCredentials' ||
    phase === 'waitingForWifi' ||
    phase === 'success' ||
    phase === 'wrongPassword' ||
    phase === 'apNotFound' ||
    phase === 'timeout' ||
    phase === 'bleDisconnected' ||
    phase === 'error';

  const failureCopy = provisioningFailureCopy(phase, errorMessage);

  const setManual = (on: boolean) => {
    setManualMode(on);
    if (on) {
      setSelectedNetwork(null);
    }
  };

  const selectFromList = (n: ESPWifiList) => {
    setManualMode(false);
    setManualSsid('');
    setSelectedNetwork(n);
    setPassword('');
    setPasswordModalVisible(true);
  };

  const openModalForManual = () => {
    if (!manualSsid.trim()) return;
    setPassword('');
    setPasswordModalVisible(true);
  };

  const connectButtonLabel = phase === 'wrongPassword' ? 'Try again' : 'Connect';

  const progressFraction = provisioningProgressFraction(phase);
  const progressCaption = provisioningPhaseLabel(phase);

  return (
    <AppScreen>
      <AppHeader title="Wi‑Fi" onBack={() => router.back()} />

      <SetupStepCard
        step={2}
        totalSteps={6}
        title="Connect to Wi‑Fi"
        description={`${deviceName}\nPick a network below; secured networks open a password prompt.`}
      />

      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '900', color: colors.navy }}>Networks</Text>
        <SecondaryButton
          label={scanPhase === 'loading' ? '…' : 'Refresh'}
          onPress={() => void loadNetworks()}
          disabled={scanPhase === 'loading' || provisioningBusy}
        />
      </View>

      {scanPhase === 'loading' ? (
        <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Scanning from device…</Text>
        </View>
      ) : null}

      {scanError ? (
        <Card
          style={{
            marginTop: spacing.sm,
            borderRadius: radius.lg,
            ...shadows.soft,
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.35)',
          }}
        >
          <Card.Content style={{ paddingVertical: spacing.sm }}>
            <Text style={{ fontWeight: '800', color: colors.navy }}>Could not load networks</Text>
            <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13 }}>{scanError}</Text>
            <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 12 }}>
              Stay near the device and ensure it is still in provisioning mode, then tap Refresh.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {!scanError && scanPhase !== 'loading' && networks.length === 0 ? (
        <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 13 }}>No networks yet. Tap Refresh.</Text>
      ) : null}

      <Card
        style={{
          marginTop: spacing.sm,
          borderRadius: radius.lg,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          maxHeight: 240,
          overflow: 'hidden',
        }}
      >
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {networks.map((n, index) => {
            const selected = !manualMode && selectedNetwork?.ssid === n.ssid;
            return (
              <Pressable key={`${n.ssid}-${n.bssid ?? index}`} onPress={() => selectFromList(n)} disabled={provisioningBusy}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: 8,
                    paddingHorizontal: spacing.sm,
                    borderBottomWidth: index < networks.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : 'transparent',
                  }}
                >
                  <WifiSignalBars rssi={n.rssi} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 14 }} numberOfLines={1}>
                      {n.ssid}
                    </Text>
                    <Text style={{ marginTop: 2, color: colors.muted, fontSize: 11 }}>
                      {n.rssi} dBm · {authLabel(n.auth)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.lg, ...shadows.soft, backgroundColor: colors.surfaceMuted }}>
        <Card.Content style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
          <Checkbox.Item
            mode="android"
            label="Other network (hidden SSID)"
            status={manualMode ? 'checked' : 'unchecked'}
            onPress={() => setManual(!manualMode)}
            style={{ paddingVertical: 0 }}
          />
          {manualMode ? (
            <TextInput mode="outlined" dense label="SSID" value={manualSsid} onChangeText={setManualSsid} autoCapitalize="none" />
          ) : null}
          {manualMode ? (
            <PrimaryButton
              label="Enter password"
              onPress={openModalForManual}
              disabled={!manualSsid.trim() || provisioningBusy}
              style={{ marginTop: spacing.xs }}
            />
          ) : null}
        </Card.Content>
      </Card>

      {showProgressUi ? (
        <Card style={{ marginTop: spacing.lg, borderRadius: radius.lg, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Progress</Text>
            <ProgressBar progress={progressFraction} color={colors.primary} style={{ height: 8, borderRadius: 4 }} />
            {progressCaption ? (
              <Text style={{ color: colors.mutedStrong, fontSize: 13, marginTop: 4 }}>{progressCaption}</Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {failureCopy ? <ErrorState title={failureCopy.title} message={failureCopy.message} tone="danger" /> : null}

      <Portal>
        <Dialog
          visible={passwordModalVisible}
          onDismiss={() => !provisioningBusy && setPasswordModalVisible(false)}
          style={modalSurfaceFit}
        >
          <Dialog.Title numberOfLines={2}>{modalNeedsPassword ? 'Wi‑Fi password' : 'Connect'}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.mutedStrong, marginBottom: spacing.sm, fontSize: 13, flexShrink: 1 }}>
              Network:{' '}
              <Text style={{ fontWeight: '800', color: colors.navy }} selectable={false}>
                {effectiveSsid || '—'}
              </Text>
            </Text>
            {modalNeedsPassword ? (
              <TextInput
                ref={(instance: { focus: () => void } | null) => {
                  passwordRef.current = instance;
                }}
                mode="outlined"
                label="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                disabled={provisioningBusy}
              />
            ) : (
              <Text style={{ color: colors.mutedStrong, fontSize: 13 }}>Open network — no password.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPasswordModalVisible(false)} disabled={provisioningBusy}>
              Cancel
            </Button>
            <Button mode="contained" onPress={() => void handleModalConnect()} disabled={provisioningBusy || (modalNeedsPassword && !password.trim())}>
              {connectButtonLabel}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </AppScreen>
  );
}
