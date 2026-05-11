import { useRouter } from 'expo-router';
import { SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AquaDevice } from '../../types/device';
import { colors, spacing } from '../../constants/theme';
import { getParentName } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { DeviceStatusCard } from '../../components/DeviceStatusCard';
import { PrimaryButton } from '../../components/PrimaryButton';

function groupTitle(role: AquaDevice['role']): string {
  switch (role) {
    case 'gateway':
      return 'Gateway / Mother';
    case 'relay':
      return 'Relay Nodes';
    case 'child':
      return 'Child Nodes';
    case 'single':
      return 'Single Devices';
  }
}

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { devices } = useMockApp();

  const order: AquaDevice['role'][] = ['gateway', 'relay', 'child', 'single'];
  const sections = order
    .map((role) => ({
      title: groupTitle(role),
      data: devices.filter((d) => d.role === role),
    }))
    .filter((s) => s.data.length > 0);

  const listHeader = (
    <View>
      <AppHeader title="Devices" subtitle="Grouped by role" />
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
    </AppScreen>
  );
}
