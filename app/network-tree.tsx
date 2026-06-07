import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { AppScreen } from '../components/AppScreen';
import { TopologyTree } from '../components/topology/TopologyTree';
import { colors, spacing } from '../constants/theme';
import { useTopology } from '../hooks/useTopology';
import { DEFAULT_NETWORK_ID } from '../utils/pairingUtils';

export default function NetworkTopologyScreen() {
  const router = useRouter();
  const { networkId: networkParam } = useLocalSearchParams<{ networkId?: string }>();
  const networkId = String(networkParam ?? DEFAULT_NETWORK_ID);
  const { tree, loading, error } = useTopology(networkId);

  return (
    <AppScreen>
      <AppHeader title="Network Tree" subtitle={`Topology for ${networkId}`} onBack={() => router.back()} />
      {loading ? <ActivityIndicator style={{ marginBottom: spacing.md }} /> : null}
      {error ? <Text selectable style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text> : null}
      <TopologyTree nodes={tree} />
    </AppScreen>
  );
}

