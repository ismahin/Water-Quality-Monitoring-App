import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Dialog, Portal, TextInput } from 'react-native-paper';
import { colors, modalSurfaceFit, radius, shadows, spacing } from '../constants/theme';
import { isFirebaseConfigured } from '../constants/env';
import { sendRemoteCommandAndWait, type RemoteCommandAck, type RemoteCommandName } from '../services/firebase/remoteCommandService';
import { DestructiveButton } from './DestructiveButton';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

type Props = {
  deviceId: string;
  networkId?: string;
};

type ConfirmAction = {
  title: string;
  body: string;
  cmd: RemoteCommandName;
  args?: Record<string, unknown>;
  destructive?: boolean;
};

function ackLabel(ack: RemoteCommandAck | null): string {
  if (!ack) return '';
  const status = ack.status ?? (ack.ok === true ? 'accepted' : ack.ok === false ? 'failed' : 'ack');
  return `${ack.cmd ?? 'command'}: ${status}${ack.message ? ` - ${ack.message}` : ''}`;
}

export function RemoteCommandControls({ deviceId, networkId }: Props) {
  const [intervalMs, setIntervalMs] = useState('30000');
  const [sending, setSending] = useState<RemoteCommandName | null>(null);
  const [lastAck, setLastAck] = useState<RemoteCommandAck | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const runCommand = useCallback(async (cmd: RemoteCommandName, args: Record<string, unknown> = {}) => {
    if (!isFirebaseConfigured()) {
      setMessage('Configure Firebase in .env to send remote commands.');
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSending(cmd);
    setMessage(null);
    setLastAck(null);
    const result = await sendRemoteCommandAndWait({
      deviceId,
      networkId,
      cmd,
      args,
      signal: abortRef.current.signal,
    });
    setSending(null);
    if (result.ok) {
      setLastAck(result.ack);
      setMessage(`Ack received from ${result.sourcePath}.`);
      return;
    }
    if (result.reason === 'aborted') return;
    setMessage(result.message ?? (result.reason === 'timeout' ? 'Remote command timed out. No device ack was received.' : 'Could not send remote command.'));
  }, [deviceId, networkId]);

  const runInterval = useCallback(() => {
    const parsed = Number(intervalMs);
    if (!Number.isFinite(parsed) || parsed < 1000) {
      setMessage('Enter a sample interval of at least 1000 ms.');
      return;
    }
    void runCommand('set_interval', { interval_ms: Math.round(parsed) });
  }, [intervalMs, runCommand]);

  const confirm = useCallback((action: ConfirmAction) => {
    setConfirmAction(action);
  }, []);

  const disabled = !!sending || !deviceId;

  return (
    <>
      <Card
        style={{
          marginTop: spacing.md,
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Remote commands</Text>
          <Text style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }}>
            Commands are written to the device inbox and the network inbox, then confirmed from command acks.
          </Text>

          <PrimaryButton
            label={sending === 'sample_now' ? 'Reading...' : 'Read now'}
            loading={sending === 'sample_now'}
            disabled={disabled}
            onPress={() => void runCommand('sample_now')}
          />

          <View style={{ gap: spacing.sm }}>
            <TextInput
              mode="outlined"
              label="Sample interval (ms)"
              keyboardType="numeric"
              value={intervalMs}
              onChangeText={setIntervalMs}
              disabled={disabled}
            />
            <SecondaryButton
              label={sending === 'set_interval' ? 'Setting...' : 'Set sample interval'}
              disabled={disabled}
              onPress={runInterval}
            />
          </View>

          <SecondaryButton
            label={sending === 'restart' ? 'Restarting...' : 'Restart device'}
            disabled={disabled}
            onPress={() => confirm({
              title: 'Restart device?',
              body: 'The device will reboot and may stop reporting for a short time.',
              cmd: 'restart',
            })}
          />
          <SecondaryButton
            label={sending === 'reset_wifi' ? 'Resetting Wi-Fi...' : 'Reset Wi-Fi'}
            disabled={disabled}
            onPress={() => confirm({
              title: 'Reset Wi-Fi?',
              body: 'This clears saved Wi-Fi credentials. The device will need Wi-Fi provisioning again.',
              cmd: 'reset_wifi',
            })}
          />
          <SecondaryButton
            label={sending === 'reset_pair' ? 'Resetting pairing...' : 'Reset pairing'}
            disabled={disabled}
            onPress={() => confirm({
              title: 'Reset pairing?',
              body: 'This clears the saved LoRa parent/root pairing.',
              cmd: 'reset_pair',
            })}
          />
          <DestructiveButton
            label={sending === 'clear_offline_queue' ? 'Clearing queue...' : 'Clear offline queue'}
            disabled={disabled}
            onPress={() => confirm({
              title: 'Clear offline queue?',
              body: 'This permanently deletes locally stored unsynced data. Firebase will not receive those pending batches.',
              cmd: 'clear_offline_queue',
              destructive: true,
            })}
          />

          {message ? <Text selectable style={{ color: colors.mutedStrong, fontWeight: '700' }}>{message}</Text> : null}
          {lastAck ? <Text selectable style={{ color: colors.success, fontWeight: '800' }}>{ackLabel(lastAck)}</Text> : null}
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={!!confirmAction} onDismiss={() => setConfirmAction(null)} style={modalSurfaceFit}>
          <Dialog.Title>{confirmAction?.title}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: confirmAction?.destructive ? colors.danger : colors.mutedStrong, lineHeight: 22, fontWeight: confirmAction?.destructive ? '800' : '500' }}>
              {confirmAction?.body}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={confirmAction?.destructive ? colors.danger : colors.primary}
              textColor="#fff"
              onPress={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action) void runCommand(action.cmd, action.args ?? {});
              }}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
