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

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { devices, registeredDevices } = useMockApp();
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

  const liveIds = new Set(registeredDevices.map((r) => r.deviceId));
  const demoDevices = devices.filter((d) => !liveIds.has(d.id));
  const liveDevices = devices.filter((d) => liveIds.has(d.id));

  const order: AquaDevice['role'][] = ['gateway', 'relay', 'child', 'single'];
  const demoDevicesFlat = order.flatMap((role) => demoDevices.filter((d) => d.role === role));

  const sections =
    liveDevices.length > 0
      ? [{ title: 'Live Devices', data: liveDevices }, { title: 'Demo Devices', data: demoDevicesFlat }]
      : [{ title: 'Demo Devices', data: demoDevicesFlat }];

  const listHeader = (
    <View>
      <AppHeader title="Devices" subtitle={liveDevices.length ? 'Live + demo hardware' : 'Grouped by role'} />
      <PrimaryButton label="Add device" onPress={() => router.push('/setup/add-device')} />
    </View>
  );

  return (
    <AppScreen scroll={false}>
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(item) => item.id}
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
          <View style={{ marginBottom: spacing.md }}>
            <DeviceStatusCard
              device={item}
              parentName={'parentId' in item ? getParentName(item) : undefined}
              onPress={() => router.push(`/device/${item.id}`)}
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
