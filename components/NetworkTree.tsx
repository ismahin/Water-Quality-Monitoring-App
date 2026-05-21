import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AquaDevice } from '../types/device';
import { NodeCard } from './NodeCard';

type Props = {
  root: AquaDevice;
  allDevices: AquaDevice[];
};

type TreeRow = { device: AquaDevice; depth: number };

function childrenOf(parentId: string, all: AquaDevice[]): AquaDevice[] {
  return all
    .filter((d) => d.id !== parentId && d.parentId === parentId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildTreeRows(root: AquaDevice, all: AquaDevice[]): TreeRow[] {
  const out: TreeRow[] = [{ device: root, depth: 0 }];
  const seen = new Set([root.id]);
  const walk = (id: string, depth: number) => {
    for (const child of childrenOf(id, all)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push({ device: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(root.id, 1);

  for (const d of all) {
    if (!seen.has(d.id) && d.id !== root.id) {
      const routeDepth = d.route ? Math.max(1, d.route.split('>').length - 1) : 1;
      out.push({ device: d, depth: routeDepth });
    }
  }
  return out;
}

export function NetworkTree({ root, allDevices }: Props) {
  const router = useRouter();
  const ordered = buildTreeRows(root, allDevices);

  return (
    <View>
      {ordered.map((row, idx) => (
        <NodeCard
          key={row.device.id}
          device={row.device}
          depth={row.depth}
          isLast={idx === ordered.length - 1}
          onPress={() => router.push(`/device/${row.device.id}`)}
        />
      ))}
    </View>
  );
}
