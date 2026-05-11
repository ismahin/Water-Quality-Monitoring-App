import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AquaDevice } from '../types/device';
import { NodeCard } from './NodeCard';

type Props = {
  root: AquaDevice;
  allDevices: AquaDevice[];
};

function childrenOf(parentId: string, all: AquaDevice[]): AquaDevice[] {
  return all.filter((d) => 'parentId' in d && d.parentId === parentId);
}

function buildSubtree(rootId: string, all: AquaDevice[]): AquaDevice[] {
  const out: AquaDevice[] = [];
  const walk = (id: string) => {
    const kids = childrenOf(id, all);
    for (const k of kids) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(rootId);
  return out;
}

export function NetworkTree({ root, allDevices }: Props) {
  const router = useRouter();
  const ordered = [root, ...buildSubtree(root.id, allDevices)];

  return (
    <View>
      {ordered.map((d, idx) => (
        <NodeCard
          key={d.id}
          device={d}
          depth={idx === 0 ? 0 : 1}
          isLast={idx === ordered.length - 1}
          onPress={() => router.push(`/device/${d.id}`)}
        />
      ))}
    </View>
  );
}
