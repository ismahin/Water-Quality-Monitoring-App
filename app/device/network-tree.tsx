import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { NetworkTree } from '../../components/NetworkTree';

export default function NetworkTreeScreen() {
  const router = useRouter();
  const { deviceId, gatewayId } = useLocalSearchParams<{ deviceId?: string; gatewayId?: string }>();
  const { devices, getNetworkTree } = useMockApp();
  const rootId = String(gatewayId ?? deviceId ?? 'm1');
  const liveTree = getNetworkTree(rootId);
  const root = liveTree[0] ?? getDeviceById(rootId);
  const allDevices = liveTree.length ? liveTree : devices;

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
      <AppHeader title="Network tree" subtitle={root.isLive ? 'Live Firebase network' : 'Demo network'} onBack={() => router.back()} />
      <View style={{ marginTop: spacing.sm }}>
        <NetworkTree root={root} allDevices={allDevices} />
      </View>
    </AppScreen>
  );
}
