import { off, onValue, ref, serverTimestamp, set, update } from 'firebase/database';
import { db } from './firebaseClient';

/**
 * RTDB instance when Firebase is configured (`db` is `getFirebaseDb` from firebaseClient).
 */
function requireDb() {
  const instance = db();
  if (!instance) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  return instance;
}

export type RemoveDeviceResult =
  | { ok: true; acked: true; commandId: string }
  | { ok: false; acked: false; commandId: string; reason: 'timeout' | 'firebase_error' | 'aborted' };

export type ResetWifiAckWait = 'accepted' | 'timeout' | 'aborted';

/**
 * Writes `devices/{deviceId}/commands/reset_wifi` for ESP32 REST stream / SDK listeners.
 * Does not delete the device node.
 */
export async function sendResetWifiCommand(deviceId: string): Promise<{ commandId: string }> {
  const commandId = `remove_${Date.now()}`;
  await set(ref(requireDb(), `devices/${deviceId}/commands/reset_wifi`), {
    requested: true,
    command_id: commandId,
    reason: 'removed_from_app',
    requested_by: 'mobile_app',
    requested_at: serverTimestamp(),
  });
  return { commandId };
}

/**
 * Resolves when `reset_wifi_ack` matches `command_id` and `status === "accepted"`, on timeout, or when `signal` aborts.
 */
export function waitForResetWifiAck(
  deviceId: string,
  commandId: string,
  timeoutMs = 10000,
  signal?: AbortSignal,
): Promise<ResetWifiAckWait> {
  return new Promise((resolve) => {
    let rtdb;
    try {
      rtdb = requireDb();
    } catch {
      resolve('timeout');
      return;
    }

    const ackRef = ref(rtdb, `devices/${deviceId}/commands/reset_wifi_ack`);
    let settled = false;
    let unsub: (() => void) | undefined;

    const finish = (out: ResetWifiAckWait) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub?.();
      off(ackRef);
      unsub = undefined;
      signal?.removeEventListener('abort', onAbort);
      resolve(out);
    };

    const onAbort = () => finish('aborted');

    if (signal?.aborted) {
      resolve('aborted');
      return;
    }
    signal?.addEventListener('abort', onAbort);

    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    unsub = onValue(ackRef, (snapshot) => {
      if (settled) return;
      const value = snapshot.val() as { command_id?: unknown; status?: unknown } | null;

      if (
        value &&
        typeof value === 'object' &&
        value.command_id === commandId &&
        value.status === 'accepted'
      ) {
        finish('accepted');
      }
    });
  });
}

/**
 * Sends reset Wi‑Fi command, waits for ACK (default 10s), updates `app_state` on success.
 * Caller removes local registration only after `ok && acked`.
 * Pass `signal` (e.g. AbortController from screen unmount) to stop listening without waiting full timeout.
 */
export async function removeDeviceWithWifiReset(
  deviceId: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<RemoveDeviceResult> {
  try {
    const { commandId } = await sendResetWifiCommand(deviceId);
    if (options?.signal?.aborted) {
      return { ok: false, acked: false, commandId, reason: 'aborted' };
    }

    const waitResult = await waitForResetWifiAck(deviceId, commandId, options?.timeoutMs ?? 10000, options?.signal);

    if (waitResult === 'aborted') {
      return { ok: false, acked: false, commandId, reason: 'aborted' };
    }

    if (waitResult === 'accepted') {
      try {
        await update(ref(requireDb(), `devices/${deviceId}/app_state`), {
          removed: true,
          removed_at: serverTimestamp(),
          remove_command_id: commandId,
        });
      } catch (e) {
        console.error('[AquaNode] app_state remove flags failed', e);
      }
      return { ok: true, acked: true, commandId };
    }

    return { ok: false, acked: false, commandId, reason: 'timeout' };
  } catch (error) {
    console.error('removeDeviceWithWifiReset failed', error);
    return {
      ok: false,
      acked: false,
      commandId: '',
      reason: 'firebase_error',
    };
  }
}
