import { useEffect, useState } from 'react';
import type { TopologyNode } from '../types/networkDevice';
import { subscribeTopology } from '../services/firebase/topologyService';

export function useTopology(networkId: string) {
  const [tree, setTree] = useState<TopologyNode[]>([]);
  const [flat, setFlat] = useState<Record<string, TopologyNode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeTopology(
      networkId,
      (nextTree, nextFlat) => {
        setTree(nextTree);
        setFlat(nextFlat);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return unsub;
  }, [networkId]);

  return { tree, flat, loading, error };
}

