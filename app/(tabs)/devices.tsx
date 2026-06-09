import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { NotificationSnackbar } from '../../components/NotificationSnackbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PENDING_AFTER_DEVICE_REMOVE_SNACKBAR } from '../../constants/appStorageKeys';
import type { AquaDevice } from '../../types/device';
import { colors, spacing } from '../../constants/theme';
import { getParentName } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { DeviceStatusCard } from '../../components/DeviceStatusCard';
import { PrimaryButton } from '../../components/PrimaryButton';

type DeviceRow = {
  device: AquaDevice;
  depth: number;
};

function deviceParentId(device: AquaDevice): string | undefined {
  return 'parentId' in device && device.parentId ? device.parentId : undefined;
}

function orderNetworkTree(devices: AquaDevice[]): DeviceRow[] {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const childrenByParent = new Map<string, AquaDevice[]>();
  for (const device of devices) {
    const parentId = deviceParentId(device);
    if (!parentId || parentId === device.id) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(device);
    childrenByParent.set(parentId, list);
  }
  childrenByParent.forEach((items) => items.sort((a, b) => a.id.localeCompare(b.id)));

  const roleOrder = { gateway: 0, relay: 1, child: 2, single: 3 } as const;
  const roots = devices
    .filter((device) => {
      const parentId = deviceParentId(device);
      return !parentId || !byId.has(parentId) || parentId === device.id;
    })
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.id.localeCompare(b.id));

  const rows: DeviceRow[] = [];
  const seen = new Set<string>();
  const walk = (device: AquaDevice, depth: number) => {
    if (seen.has(device.id)) return;
    seen.add(device.id);
    rows.push({ device, depth });
    for (const child of childrenByParent.get(device.id) ?? []) {
      walk(child, depth + 1);
    }
  };

  roots.forEach((device) => walk(device, 0));
  devices
    .filter((device) => !seen.has(device.id))
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.id.localeCompare(b.id))
    .forEach((device) => walk(device, 0));
  return rows;
}

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { devices } = useMockApp();
  const [tabSnackbar, setTabSnackbar] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const m = await AsyncStorage.getItem(PENDING_AFTER_DEVICE_REMOVE_SNACKBAR);
          if (!m || cancelled) return;
          await AsyncStorage.removeItem(PENDING_AFTER_DEVICE_REMOVE_SNACKBAR);
          setTabSnackbar(m);
        } catch {
          /* noop */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const demoDevices = devices.filter((d) => !d.isLive);
  const liveDevices = orderNetworkTree(devices.filter((d) => d.isLive));

  const order: AquaDevice['role'][] = ['gateway', 'relay', 'child', 'single'];
  const demoDevicesFlat = order.flatMap((role) => demoDevices.filter((d) => d.role === role)).map((device) => ({ device, depth: 0 }));

  const sections =
    liveDevices.length > 0
      ? [
          { title: 'Live Network', data: liveDevices },
          { title: 'Demo Devices', data: demoDevicesFlat },
        ].filter((section) => section.data.length > 0)
      : [{ title: 'Demo Devices', data: demoDevicesFlat }];

  const listHeader = (
    <View>
      <AppHeader title="Devices" subtitle={liveDevices.length ? 'Live gateway, relay, and child tree' : 'Grouped by role'} />
      <PrimaryButton label="Add device" onPress={() => router.push('/setup/add-device')} />
    </View>
  );

  const allLiveNames = new Map(devices.filter((d) => d.isLive).map((device) => [device.id, device.name]));

  return (
    <AppScreen scroll={false}>
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(item) => item.device.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl,
        }}
        renderSectionHeader={({ section }) => (
          <Text style={{ marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: '900', color: colors.navy }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md, marginLeft: item.depth * 18 }}>
            <DeviceStatusCard
              device={item.device}
              parentName={
                'parentId' in item.device && item.device.parentId
                  ? allLiveNames.get(item.device.parentId) ?? getParentName(item.device) ?? item.device.parentId
                  : undefined
              }
              onPress={() => router.push(`/device/${item.device.id}`)}
            />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <NotificationSnackbar
        visible={!!tabSnackbar}
        onDismiss={() => setTabSnackbar(null)}
        duration={6000}
        message={tabSnackbar ?? ''}
        style={{ marginBottom: Math.max(insets.bottom, spacing.md) }}
      />
    </AppScreen>
  );
}
