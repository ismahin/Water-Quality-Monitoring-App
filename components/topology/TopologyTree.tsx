import { Text, View } from 'react-native';
import type { TopologyNode } from '../../types/networkDevice';
import { colors, radius, spacing } from '../../constants/theme';
import { formatAgo, formatSignalQuality } from '../../utils/pairingUtils';

type Props = {
  nodes: TopologyNode[];
};

function NodeRow({ node, depth }: { node: TopologyNode; depth: number }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          marginLeft: depth * 18,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text selectable style={{ color: colors.navy, fontSize: 16, fontWeight: '900' }}>
          {depth > 0 ? '└─ ' : ''}
          {node.device_id} {node.role ? `· ${node.role}` : ''}
        </Text>
        <Text style={{ marginTop: 4, color: colors.mutedStrong, fontWeight: '700' }}>
          Parent {node.parent_id || '-'} · Depth {node.depth ?? depth} · {node.online === false ? 'Offline' : node.online === true ? 'Online' : 'Unknown'}
        </Text>
        <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>
          Last seen {formatAgo(node.last_seen_ms)} · Battery {typeof node.battery === 'number' ? `${Math.round(node.battery)}%` : '-'} · Signal {formatSignalQuality(node.rssi)}
        </Text>
      </View>
      {(node.children ?? []).map((child) => (
        <NodeRow key={child.device_id} node={child} depth={depth + 1} />
      ))}
    </View>
  );
}

export function TopologyTree({ nodes }: Props) {
  if (nodes.length === 0) {
    return <Text style={{ color: colors.mutedStrong }}>No topology found for this network.</Text>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {nodes.map((node) => (
        <NodeRow key={node.device_id} node={node} depth={0} />
      ))}
    </View>
  );
}

