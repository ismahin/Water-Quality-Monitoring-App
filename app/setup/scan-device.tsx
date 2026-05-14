import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  requestAndroidBleRuntimePermissions,
  requestAndroidFineLocationRuntimePermission,
} from '../../utils/requestAndroidBlePermissions';
import { openBluetoothSystemSettings } from '../../utils/openBluetoothSystemSettings';
import { ActivityIndicator, Button, Card, Dialog, Portal } from 'react-native-paper';
import { MOCK_PROVISIONING, scanProvisioningDevices, stopScan } from '../../services/provisioning/espProvisioningService';
import { colors, modalSurfaceFit, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';
import {
  clearLastBleProvisioningTarget,
  loadLastBleProvisioningTarget,
  saveLastBleProvisioningTarget,
  type LastBleProvisioningTarget,
} from '../../services/provisioning/lastBleProvisioningTarget';

type DialogAction = { label: string; onPress: () => void; variant?: 'text' | 'contained' };

type ScanDialogState = {
  title: string;
  message: string;
  actions: DialogAction[];
} | null;

function humanizeScanError(raw: string): string {
  const s = raw.replace(/^java\.lang\.Error:\s*/i, '').replace(/^error:\s*/i, '').trim();
  if (!s) return 'Something went wrong while scanning.';
  if (s.length > 240) return `${s.slice(0, 237)}…`;
  return s;
}

export default function ScanDeviceScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string; rssi: number }[]>([]);
  const [dialog, setDialog] = useState<ScanDialogState>(null);
  const [lastTarget, setLastTarget] = useState<LastBleProvisioningTarget | null>(null);

  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    void loadLastBleProvisioningTarget().then(setLastTarget);
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        setDialog({
          title: 'Location needed',
          message: 'Location permission is required for BLE scanning on Android.',
          actions: [
            { label: 'Open settings', variant: 'contained', onPress: () => void Linking.openSettings().finally(() => setDialog(null)) },
            { label: 'Not now', onPress: () => setDialog(null) },
          ],
        });
        return false;
      }
      const fine = await requestAndroidFineLocationRuntimePermission();
      if (!fine.ok) {
        setDialog({
          title: 'Precise location',
          message: fine.message,
          actions: [
            { label: 'Open settings', variant: 'contained', onPress: () => void Linking.openSettings().finally(() => setDialog(null)) },
            { label: 'Not now', onPress: () => setDialog(null) },
          ],
        });
        return false;
      }
    }
    return true;
  }, []);

  const runScan = useCallback(async () => {
    setDialog(null);
    if (isExpoGo && !MOCK_PROVISIONING) {
      setDialog({
        title: 'Expo Go limitation',
        message:
          'BLE provisioning does not run in Expo Go. Create a development build with npx expo prebuild && npx expo run:android, or set EXPO_PUBLIC_MOCK_PROVISIONING=true to preview the UI.',
        actions: [{ label: 'OK', variant: 'contained', onPress: () => setDialog(null) }],
      });
      return;
    }

    const ok = await requestPermissions();
    if (!ok) {
      console.log('[AquaNode][scan-device] Location permission gate failed');
      return;
    }

    const ble = await requestAndroidBleRuntimePermissions();
    if (!ble.ok) {
      setDialog({
        title: 'Bluetooth access',
        message: ble.message,
        actions: [
          { label: 'Open settings', variant: 'contained', onPress: () => void Linking.openSettings().finally(() => setDialog(null)) },
          { label: 'Not now', onPress: () => setDialog(null) },
        ],
      });
      console.log('[AquaNode][scan-device] Android Bluetooth runtime permission gate failed:', ble.message);
      return;
    }

    setScanning(true);
    setItems([]);
    const scanOnce = async () => scanProvisioningDevices('PROV_');

    try {
      console.log('[AquaNode][scan-device] Starting BLE provisioning scan (prefix PROV_)…');
      const found = await scanOnce();
      console.log('[AquaNode][scan-device] Scan finished, devices:', found.length, found.map((d) => d.name));
      setItems(found);
      if (found.length === 0) {
        const persisted = await loadLastBleProvisioningTarget();
        if (persisted) setLastTarget(persisted);
        if (!persisted) {
          setDialog({
            title: 'No devices found',
            message:
              'No ESP32 was found advertising a provisioning name that starts with PROV_. Power the device, confirm it is in BLE provisioning mode, move closer, then try again.',
            actions: [
              { label: 'Rescan', variant: 'contained', onPress: () => setDialog(null) },
              { label: 'Close', onPress: () => setDialog(null) },
            ],
          });
        }
      }
    } catch (e) {
      let lastErr: unknown = e;
      console.log('[AquaNode][scan-device] scanProvisioningDevices threw:', e instanceof Error ? e.message : e);
      const msg = e instanceof Error ? e.message : String(e);
      const low = msg.toLowerCase();
      const isScanNotStarted = low.includes('scan could not be started');

      if (isScanNotStarted) {
        console.log('[AquaNode][scan-device] Retrying scan once after delay (adapter may not be ready yet)…');
        await new Promise((r) => setTimeout(r, 800));
        try {
          const found = await scanOnce();
          console.log('[AquaNode][scan-device] Retry OK, devices:', found.length);
          setItems(found);
          if (found.length === 0) {
            const persisted = await loadLastBleProvisioningTarget();
            if (persisted) setLastTarget(persisted);
            if (!persisted) {
              setDialog({
                title: 'No devices found',
                message:
                  'No ESP32 was found advertising a provisioning name that starts with PROV_. Power the device, confirm it is in BLE provisioning mode, move closer, then try again.',
                actions: [
                  { label: 'Rescan', variant: 'contained', onPress: () => setDialog(null) },
                  { label: 'Close', onPress: () => setDialog(null) },
                ],
              });
            }
          }
          return;
        } catch (e2) {
          console.log('[AquaNode][scan-device] Retry failed:', e2 instanceof Error ? e2.message : e2);
          lastErr = e2;
        }
      }

      const msgFinal = lastErr instanceof Error ? lastErr.message : String(lastErr);
      const lowFinal = msgFinal.toLowerCase();
      if (lowFinal.includes('scan could not be started') || (lowFinal.includes('bluetooth') && (lowFinal.includes('off') || lowFinal.includes('disabled')))) {
        setDialog({
          title: 'Turn on Bluetooth',
          message:
            Platform.OS === 'android'
              ? 'Bluetooth must be on to find your device. Open Settings to enable Bluetooth, then return here and tap Rescan.'
              : 'Bluetooth must be on to find your device. Open the Settings app to enable Bluetooth, then return here and tap Rescan.',
          actions: [
            {
              label: 'Open Settings',
              variant: 'contained',
              onPress: () => void openBluetoothSystemSettings().finally(() => setDialog(null)),
            },
            { label: 'Close', onPress: () => setDialog(null) },
          ],
        });
      } else if (lowFinal.includes('permission') || lowFinal.includes('denied')) {
        setDialog({
          title: 'Permission needed',
          message: humanizeScanError(msgFinal),
          actions: [
            { label: 'Open settings', variant: 'contained', onPress: () => void Linking.openSettings().finally(() => setDialog(null)) },
            { label: 'Close', onPress: () => setDialog(null) },
          ],
        });
      } else {
        setDialog({
          title: 'Scan issue',
          message: humanizeScanError(msgFinal),
          actions: [{ label: 'OK', variant: 'contained', onPress: () => setDialog(null) }],
        });
      }
    } finally {
      setScanning(false);
      stopScan();
    }
  }, [isExpoGo, requestPermissions]);

  useEffect(() => {
    void runScan();
    return () => stopScan();
  }, [runScan]);

  const onRescanFromDialog = useCallback(() => {
    setDialog(null);
    void runScan();
  }, [runScan]);

  return (
    <AppScreen scroll={false}>
      <Portal>
        <Dialog visible={dialog !== null} onDismiss={closeDialog} dismissable style={modalSurfaceFit}>
          {dialog ? (
            <>
              <Dialog.Title style={{ color: colors.navy }} numberOfLines={4}>
                {dialog.title}
              </Dialog.Title>
              <Dialog.ScrollArea style={{ maxHeight: 320 }}>
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  <Text style={{ color: colors.mutedStrong, lineHeight: 22 }}>{dialog.message}</Text>
                </ScrollView>
              </Dialog.ScrollArea>
              <Dialog.Actions style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 }}>
                {dialog.actions.map((a, i) => (
                  <Button
                    key={`${a.label}-${i}`}
                    mode={a.variant === 'contained' ? 'contained' : 'text'}
                    onPress={() => {
                      if (a.label === 'Rescan' && dialog.title === 'No devices found') {
                        onRescanFromDialog();
                        return;
                      }
                      a.onPress();
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </Dialog.Actions>
            </>
          ) : null}
        </Dialog>
      </Portal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={scanning} onRefresh={() => void runScan()} />}
      >
        <AppHeader title="Scan device" onBack={() => router.back()} />

        <SetupStepCard
          step={1}
          totalSteps={6}
          title="Discover nearby device"
          description={
            isExpoGo
              ? 'Expo Go cannot use BLE provisioning. Use a dev build or EXPO_PUBLIC_MOCK_PROVISIONING=true.'
              : 'Turn on Bluetooth and select your device (name looks like PROV_WQM_…).'
          }
        />

        {lastTarget ? (
          <Card
            style={{
              marginTop: spacing.md,
              borderRadius: radius.xl,
              ...shadows.soft,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
          >
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>Resume Wi‑Fi setup</Text>
              <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
                Last device on this phone: <Text style={{ fontWeight: '800', color: colors.navy }}>{lastTarget.deviceName}</Text>.
                If the scan list is empty, the device may already be paired over BLE—open Wi‑Fi provisioning to enter or fix the network password without scanning again.
              </Text>
              <PrimaryButton
                label="Continue to Wi‑Fi"
                onPress={() =>
                  router.push({
                    pathname: '/setup/wifi-provisioning',
                    params: { name: lastTarget.deviceName, rssi: String(lastTarget.rssi) },
                  })
                }
              />
              <SecondaryButton
                label="Forget stored device & scan fresh"
                onPress={() => {
                  void (async () => {
                    await clearLastBleProvisioningTarget();
                    setLastTarget(null);
                    void runScan();
                  })();
                }}
              />
            </Card.Content>
          </Card>
        ) : null}

        <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {scanning ? <ActivityIndicator color={colors.primary} /> : null}
          <Text style={{ color: colors.muted, fontWeight: '700' }}>{scanning ? 'Scanning…' : 'Pull to rescan'}</Text>
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {items.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => {
                void (async () => {
                  await saveLastBleProvisioningTarget(d.name, d.rssi);
                  setLastTarget({
                    deviceName: d.name,
                    rssi: d.rssi,
                    updatedAt: new Date().toISOString(),
                  });
                  router.push({
                    pathname: '/setup/wifi-provisioning',
                    params: { name: d.name, rssi: String(d.rssi) },
                  });
                })();
              }}
            >
              <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
                <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={{ fontWeight: '900', color: colors.navy }}>{d.name}</Text>
                    <Text style={{ marginTop: 4, color: colors.muted }}>RSSI {d.rssi} dBm</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Select</Text>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </View>

        {!scanning && items.length === 0 && dialog === null && !lastTarget ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState variant="noNearbyDevice" onPrimaryPress={() => void runScan()} />
          </View>
        ) : null}

        {!scanning && items.length === 0 && dialog === null && lastTarget ? (
          <Text style={{ marginTop: spacing.lg, color: colors.mutedStrong, lineHeight: 20, paddingHorizontal: spacing.xs }}>
            No PROV_ devices in range right now. Use “Continue to Wi‑Fi” above for {lastTarget.deviceName}, or pull to rescan after putting the board back in provisioning mode.
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Rescan" onPress={() => void runScan()} disabled={scanning} />
        </View>
      </ScrollView>
    </AppScreen>
  );
}
