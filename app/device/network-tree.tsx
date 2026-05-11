import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { NetworkTree } from '../../components/NetworkTree';

/**
 * Pass `deviceId` as the tree root (usually a gateway). Example: `/device/network-tree?deviceId=m1`
 */
export default function NetworkTreeScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();
  const { devices } = useMockApp();
  const rootId = String(deviceId ?? 'm1');
  const root = getDeviceById(rootId);

  if (!root) {
    return (
      <AppScreen>
        <AppHeader title="Network tree" onBack={() => router.back()} />
        <Text style={{ color: colors.muted }}>Root device not found.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title="Network tree" subtitle="Tap a node for details" onBack={() => router.back()} />
      <View style={{ marginTop: spacing.sm }}>
        <NetworkTree root={root} allDevices={devices} />
      </View>
    </AppScreen>
  );
}
