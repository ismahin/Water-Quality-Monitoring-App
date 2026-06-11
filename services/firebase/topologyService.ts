import { onValue, ref, type Unsubscribe } from 'firebase/database';
import type { TopologyNode } from '../../types/networkDevice';
import { buildTopologyTree, normalizeRole, safeKey, toNumber, toStringValue } from '../../utils/pairingUtils';
import { getFirebaseDb } from './firebaseClient';

function normalizeTopologyNode(key: string, raw: unknown): TopologyNode {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    device_id: toStringValue(o.device_id) ?? key,
    role: normalizeRole(o.role),
    parent_id: toStringValue(o.parent_id),
    root_gateway_id: toStringValue(o.root_gateway_id),
    depth: toNumber(o.depth),
    route: toStringValue(o.route),
    online: typeof o.online === 'boolean' ? o.online : undefined,
    last_seen_ms: toNumber(o.last_seen_ms ?? o.last_upload_ms ?? o.timestamp),
    battery: toNumber(o.battery),
    rssi: toNumber(o.rssi ?? o.last_lora_rssi ?? o.child_rssi),
    snr: toNumber(o.snr ?? o.last_lora_snr ?? o.child_snr),
    pair_stage: toStringValue(o.pair_stage),
    pair_confirmed: typeof o.pair_confirmed === 'boolean' ? o.pair_confirmed : undefined,
    telemetry_received: typeof o.telemetry_received === 'boolean' ? o.telemetry_received : undefined,
    lifecycle_state: toStringValue(o.lifecycle_state),
    message: toStringValue(o.message),
  };
}

export function subscribeTopology(
  networkId: string,
  callback: (tree: TopologyNode[], flat: Record<string, TopologyNode>) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) {
    callback([], {});
    onError?.('Firebase is not configured.');
    return () => {};
  }

  return onValue(
    ref(db, `networks/${safeKey(networkId)}/topology`),
    (snap) => {
      const raw = (snap.val() as Record<string, unknown> | null) ?? {};
      const flat = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, normalizeTopologyNode(key, value)]));
      callback(buildTopologyTree(flat), flat);
    },
    (error) => onError?.(error.message),
  );
}
