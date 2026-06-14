import { off, onValue, ref, serverTimestamp, update, type Unsubscribe } from 'firebase/database';
import { db } from './firebaseClient';
import { safeFirebaseKey } from './schemaV4Paths';

export type RemoteCommandName =
  | 'sample_now'
  | 'set_interval'
  | 'restart'
  | 'reset_wifi'
  | 'reset_pair'
  | 'clear_offline_queue'
  | 'set_id'
  | 'set_role'
  | 'set_wifi'
  | 'factory';

export type RemoteCommandAck = {
  v?: number;
  device_id?: string;
  network_id?: string;
  command_id?: string;
  cmd?: string;
  status?: string;
  ok?: boolean;
  message?: string;
  handled_at_ms?: number;
  fw?: string;
  [key: string]: unknown;
};

export type RemoteCommandResult =
  | { ok: true; commandId: string; ack: RemoteCommandAck; sourcePath: string }
  | { ok: false; commandId: string; reason: 'timeout' | 'firebase_error' | 'aborted'; message?: string };

function requireDb() {
  const instance = db();
  if (!instance) throw new Error('FIREBASE_NOT_CONFIGURED');
  return instance;
}

function commandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function inboxPaths(deviceId: string, networkId?: string): string[] {
  const deviceKey = safeFirebaseKey(deviceId);
  const paths = [`devices/${deviceKey}/commands/inbox`];
  if (networkId) {
    paths.push(`networks/${safeFirebaseKey(networkId)}/devices/${deviceKey}/commands/inbox`);
  }
  return paths;
}

function ackPaths(deviceId: string, networkId?: string): string[] {
  const deviceKey = safeFirebaseKey(deviceId);
  const paths = [`devices/${deviceKey}/commands/acks`];
  if (networkId) {
    paths.push(`networks/${safeFirebaseKey(networkId)}/devices/${deviceKey}/commands/acks`);
  }
  return paths;
}

export async function sendRemoteCommand(params: {
  deviceId: string;
  networkId?: string;
  cmd: RemoteCommandName;
  args?: Record<string, unknown>;
  commandId?: string;
}): Promise<{ commandId: string }> {
  const rtdb = requireDb();
  const id = params.commandId ?? commandId();
  const command = {
    v: 2,
    command_id: id,
    cmd: params.cmd,
    requested: true,
    handled: false,
    args: params.args ?? {},
    source: 'AquaNodeApp',
    created_at: serverTimestamp(),
  };

  const updates: Record<string, unknown> = {};
  inboxPaths(params.deviceId, params.networkId).forEach((path) => {
    updates[`${path}/${safeFirebaseKey(id)}`] = command;
  });
  await update(ref(rtdb), updates);
  return { commandId: id };
}

export function subscribeRemoteCommandAck(params: {
  deviceId: string;
  networkId?: string;
  commandId: string;
  onAck: (ack: RemoteCommandAck, sourcePath: string) => void;
  onError?: (message: string) => void;
}): Unsubscribe {
  let settled = false;
  let rtdb;
  try {
    rtdb = requireDb();
  } catch (error) {
    params.onError?.(error instanceof Error ? error.message : 'Firebase is not configured.');
    return () => {};
  }

  const unsubs = ackPaths(params.deviceId, params.networkId).map((basePath) => {
    const path = `${basePath}/${safeFirebaseKey(params.commandId)}`;
    const ackRef = ref(rtdb, path);
    return onValue(
      ackRef,
      (snapshot) => {
        if (settled) return;
        const value = snapshot.val() as RemoteCommandAck | null;
        if (!value || typeof value !== 'object') return;
        if (value.command_id && value.command_id !== params.commandId) return;
        settled = true;
        params.onAck(value, path);
      },
      (error) => params.onError?.(error.message),
    );
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
    ackPaths(params.deviceId, params.networkId).forEach((basePath) => {
      off(ref(rtdb, `${basePath}/${safeFirebaseKey(params.commandId)}`));
    });
  };
}

export async function sendRemoteCommandAndWait(params: {
  deviceId: string;
  networkId?: string;
  cmd: RemoteCommandName;
  args?: Record<string, unknown>;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<RemoteCommandResult> {
  let id = '';
  try {
    const sent = await sendRemoteCommand(params);
    id = sent.commandId;

    return await new Promise<RemoteCommandResult>((resolve) => {
      let settled = false;
      let unsub: Unsubscribe | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: RemoteCommandResult) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        unsub?.();
        params.signal?.removeEventListener('abort', onAbort);
        resolve(result);
      };
      const onAbort = () => finish({ ok: false, commandId: id, reason: 'aborted' });

      if (params.signal?.aborted) {
        finish({ ok: false, commandId: id, reason: 'aborted' });
        return;
      }

      params.signal?.addEventListener('abort', onAbort);
      timer = setTimeout(
        () => finish({ ok: false, commandId: id, reason: 'timeout', message: 'Remote command timed out. No device ack was received.' }),
        params.timeoutMs ?? 15000,
      );
      unsub = subscribeRemoteCommandAck({
        deviceId: params.deviceId,
        networkId: params.networkId,
        commandId: id,
        onAck: (ack, sourcePath) => finish({ ok: true, commandId: id, ack, sourcePath }),
        onError: (message) => finish({ ok: false, commandId: id, reason: 'firebase_error', message }),
      });
    });
  } catch (error) {
    return {
      ok: false,
      commandId: id,
      reason: 'firebase_error',
      message: error instanceof Error ? error.message : 'Could not send remote command.',
    };
  }
}
