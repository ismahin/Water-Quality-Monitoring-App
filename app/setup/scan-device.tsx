import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Button, Card, Dialog, Portal } from 'react-native-paper';
import { Bluetooth, Radio } from 'lucide-react-native';
import {
  requestAndroidBleRuntimePermissions,
  requestAndroidFineLocationRuntimePermission,
} from '../../utils/requestAndroidBlePermissions';
import { openBluetoothSystemSettings } from '../../utils/openBluetoothSystemSettings';
import { MOCK_PROVISIONING, scanProvisioningDevices, stopScan } from '../../services/provisioning/espProvisioningService';
import { MOCK_BLE_CONFIG, parseDeviceIdFromConfigName, scanConfigDevices } from '../../services/ble/bleConfigService';
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

type ScanMode = 'provision' | 'config';
type ScanItem = { id: string; name: string; rssi: number; transport: 'ble' | 'ble-config' };
type DialogAction = { label: string; onPress: () => void; variant?: 'text' | 'contained' };
type ScanDialogState = { title: string; message: string; actions: DialogAction[] } | null;

function humanizeScanError(raw: string): string {
  const s = raw.replace(/^java\.lang\.Error:\s*/i, '').replace(/^error:\s*/i, '').trim();
  if (!s) return 'Something went wrong while scanning.';
  if (s.length > 240) return `${s.slice(0, 237)}...`;
  return s;
}

export default function ScanDeviceScreen() {
  const router = useRouter();
  const {
    mode: modeParam,
    targetRole,
    parentId,
    rootGatewayId,
    networkId,
  } = useLocalSearchParams<{ mode?: string; targetRole?: string; parentId?: string; rootGatewayId?: string; networkId?: string }>();
  const mode: ScanMode = modeParam === 'config' ? 'config' : 'provision';
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [dialog, setDialog] = useState<ScanDialogState>(null);
  const [lastTarget, setLastTarget] = useState<LastBleProvisioningTarget | null>(null);

  const scanCopy = useMemo(() => {
    if (mode === 'config') {
      return {
        title: 'Scan config device',
        prefix: 'CFG_',
        transport: 'BLE config',
        stepTitle: 'Discover CFG device',
        description: MOCK_BLE_CONFIG
          ? 'Mock CFG scan is enabled for UI testing.'
          : 'Turn on Bluetooth and select a device advertising CFG_.',
      };
    }
    return {
      title: 'Scan device',
      prefix: 'PROV_',
      transport: 'Wi-Fi provisioning',
      stepTitle: 'Discover nearby device',
      description: MOCK_PROVISIONING
        ? 'Mock provisioning scan is enabled for UI testing.'
        : 'Turn on Bluetooth and select your device (name looks like PROV_WQM_...).',
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'provision') void loadLastBleProvisioningTarget().then(setLastTarget);
  }, [mode]);

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
      return false;
    }
    return true;
  }, []);

  const runScan = useCallback(async () => {
    setDialog(null);
    const ok = await requestPermissions();
    if (!ok) return;

    setScanning(true);
    setItems([]);
    try {
      const found =
        mode === 'config'
          ? await scanConfigDevices('CFG_')
          : await scanProvisioningDevices('PROV_');
      setItems(found);
      if (found.length === 0) {
        if (mode === 'provision') {
          const persisted = await loadLastBleProvisioningTarget();
          if (persisted) {
            setLastTarget(persisted);
            return;
          }
        }
        setDialog({
          title: 'No devices found',
          message: `No ESP32 was found advertising ${scanCopy.prefix}. Power the device, move closer, then try again.`,
          actions: [
            { label: 'Rescan', variant: 'contained', onPress: () => void runScan() },
            { label: 'Close', onPress: () => setDialog(null) },
          ],
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const low = msg.toLowerCase();
      if (low.includes('bluetooth') && (low.includes('off') || low.includes('disabled'))) {
        setDialog({
          title: 'Turn on Bluetooth',
          message: 'Bluetooth must be on to find your device. Open Settings, enable Bluetooth, then rescan.',
          actions: [
            { label: 'Open Settings', variant: 'contained', onPress: () => void openBluetoothSystemSettings().finally(() => setDialog(null)) },
            { label: 'Close', onPress: () => setDialog(null) },
          ],
        });
      } else if (low.includes('permission') || low.includes('denied')) {
        setDialog({
          title: 'Permission needed',
          message: humanizeScanError(msg),
          actions: [
            { label: 'Open settings', variant: 'contained', onPress: () => void Linking.openSettings().finally(() => setDialog(null)) },
            { label: 'Close', onPress: () => setDialog(null) },
          ],
        });
      } else {
        setDialog({
          title: 'Scan issue',
          message: humanizeScanError(msg),
          actions: [{ label: 'OK', variant: 'contained', onPress: () => setDialog(null) }],
        });
      }
    } finally {
      setScanning(false);
      if (mode === 'provision') stopScan();
    }
  }, [mode, requestPermissions, scanCopy.prefix]);

  useEffect(() => {
    void runScan();
    return () => {
      if (mode === 'provision') stopScan();
    };
  }, [runScan, mode]);

  const selectDevice = useCallback(
    (d: ScanItem) => {
      if (mode === 'config') {
        router.push({
          pathname: '/setup/config-device',
          params: {
            deviceName: d.name,
            deviceId: parseDeviceIdFromConfigName(d.name),
            rssi: String(d.rssi),
            targetRole,
            parentId,
            rootGatewayId,
            networkId,
          },
        });
        return;
      }
      void (async () => {
        await saveLastBleProvisioningTarget(d.name, d.rssi);
        setLastTarget({ deviceName: d.name, rssi: d.rssi, updatedAt: new Date().toISOString() });
        router.push({
          pathname: '/setup/wifi-provisioning',
          params: { name: d.name, rssi: String(d.rssi) },
        });
      })();
    },
    [mode, networkId, parentId, rootGatewayId, router, targetRole],
  );

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
                  <Button key={`${a.label}-${i}`} mode={a.variant === 'contained' ? 'contained' : 'text'} onPress={a.onPress}>
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
        <AppHeader title={scanCopy.title} subtitle={scanCopy.transport} onBack={() => router.back()} />

        <SetupStepCard step={1} totalSteps={mode === 'config' ? 3 : 6} title={scanCopy.stepTitle} description={scanCopy.description} />

        {mode === 'provision' && lastTarget ? (
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
              <Text style={{ fontWeight: '900', color: colors.navy }}>Resume Wi-Fi setup</Text>
              <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
                Last device on this phone: <Text style={{ fontWeight: '800', color: colors.navy }}>{lastTarget.deviceName}</Text>.
              </Text>
              <PrimaryButton
                label="Continue to Wi-Fi"
                onPress={() =>
                  router.push({
                    pathname: '/setup/wifi-provisioning',
                    params: { name: lastTarget.deviceName, rssi: String(lastTarget.rssi) },
                  })
                }
              />
              <SecondaryButton
                label="Forget stored device and scan fresh"
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
          <Text style={{ color: colors.muted, fontWeight: '700' }}>{scanning ? 'Scanning...' : 'Pull to rescan'}</Text>
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {items.map((d) => (
            <Pressable key={d.id} onPress={() => selectDevice(d)}>
              <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                      {mode === 'config' ? <Bluetooth color={colors.primary} size={22} /> : <Radio color={colors.primary} size={22} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '900', color: colors.navy }}>{d.name}</Text>
                      <Text style={{ marginTop: 4, color: colors.muted }}>
                        RSSI {d.rssi} dBm - {d.transport}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Connect</Text>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </View>

        {!scanning && items.length === 0 && dialog === null && (mode === 'config' || !lastTarget) ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState variant="noNearbyDevice" onPrimaryPress={() => void runScan()} />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Rescan" onPress={() => void runScan()} disabled={scanning} />
        </View>
      </ScrollView>
    </AppScreen>
  );
}
