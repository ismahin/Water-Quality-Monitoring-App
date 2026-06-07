import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Dialog, Portal, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { DestructiveButton } from '../../components/DestructiveButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { BleDeviceCard } from '../../components/pairing/BleDeviceCard';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { usePairingBle } from '../../hooks/usePairingBle';

export default function PairingConfigScreen() {
  const router = useRouter();
  const ble = usePairingBle();
  const [deviceId, setDeviceId] = useState('');
  const [networkId, setNetworkId] = useState('POND_001');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [confirmAction, setConfirmAction] = useState<'reset_pair' | 'factory' | null>(null);
  const latest = ble.notifications[0];
  const latestMessage =
    latest && 'message' in latest && typeof latest.message === 'string' ? latest.message : undefined;

  useEffect(() => {
    if (!ble.info) return;
    setDeviceId(ble.info.device_id);
    setNetworkId(ble.info.network_id || 'POND_001');
  }, [ble.info]);

  return (
    <AppScreen>
      <Portal>
        <Dialog visible={confirmAction !== null} onDismiss={() => setConfirmAction(null)}>
          <Dialog.Title>{confirmAction === 'factory' ? 'Factory reset?' : 'Reset LoRa pairing?'}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.mutedStrong, lineHeight: 22 }}>
              {confirmAction === 'factory'
                ? 'This will erase device configuration and restart the device.'
                : 'This will clear only the saved LoRa parent/root pairing.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={colors.danger}
              onPress={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'factory') void ble.actions.factoryReset();
                if (action === 'reset_pair') void ble.actions.resetPairing();
              }}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <AppHeader title="Configure Existing Device" subtitle="Turn the device switch to Pairing Mode" onBack={() => { void ble.disconnect(); router.back(); }} />

      {ble.error ? (
        <Card style={{ borderRadius: radius.lg, backgroundColor: '#FEF2F2', marginBottom: spacing.md }}>
          <Card.Content>
            <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{ble.error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {!ble.connectedDevice ? (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Find device</Text>
              <Text style={{ color: colors.mutedStrong, lineHeight: 21 }}>
                New firmware advertises with a name starting WQM in Pairing Mode, for example WQM4EB580 or WQM_4EB580.
              </Text>
              <PrimaryButton label={ble.scanning ? 'Scanning...' : 'Scan WQMPAIR devices'} loading={ble.scanning} onPress={() => void ble.startScan()} />
              <Text selectable style={{ color: colors.mutedStrong, lineHeight: 20 }}>{ble.scanSummary}</Text>
            </Card.Content>
          </Card>

          {ble.devices.length === 0 && !ble.scanning ? (
            <Text style={{ color: colors.mutedStrong }}>
              No device found. Make sure the switch is in Pairing Mode and the device is nearby.
            </Text>
          ) : null}

          {ble.devices.map((device) => (
            <BleDeviceCard
              key={device.id}
              device={device}
              loading={ble.connecting}
              onConnect={() => void ble.connect(device.id)}
            />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Current configuration</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Device ID: {ble.info?.device_id ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {ble.info?.network_id ?? '-'}</Text>
              <Text style={{ color: colors.mutedStrong }}>Role: {ble.info?.role ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Parent ID: {ble.info?.parent_id || '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Root Gateway ID: {ble.info?.root_gateway_id || '-'}</Text>
              <Text style={{ color: colors.mutedStrong }}>Switch mode: {ble.info?.switch_mode ?? '-'}</Text>
              <Text style={{ color: colors.mutedStrong }}>Paired: {ble.info?.paired ? 'Yes' : 'No'}</Text>
              <Text style={{ color: colors.mutedStrong }}>Wi-Fi connected: {ble.info?.wifi_connected ? 'Yes' : 'No'}</Text>
              <Text style={{ color: colors.mutedStrong }}>LoRa ready: {ble.info?.lora_ready ? 'Yes' : 'No'}</Text>
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Update identity</Text>
              <TextInput mode="outlined" label="Device ID" value={deviceId} onChangeText={setDeviceId} autoCapitalize="characters" />
              <TextInput mode="outlined" label="Network ID" value={networkId} onChangeText={setNetworkId} autoCapitalize="characters" />
              <PrimaryButton label="Save Device ID / Network ID" disabled={!deviceId.trim() || !networkId.trim()} onPress={() => void ble.actions.setIdentity(deviceId.trim(), networkId.trim())} />
              <SecondaryButton label="Refresh Info" onPress={() => void ble.actions.getInfo()} />
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Update Wi-Fi</Text>
              <TextInput mode="outlined" label="Wi-Fi SSID" value={ssid} onChangeText={setSsid} autoCapitalize="none" />
              <TextInput mode="outlined" label="Wi-Fi password" value={password} onChangeText={setPassword} secureTextEntry />
              <PrimaryButton label="Send Wi-Fi Credentials" disabled={!ssid.trim()} onPress={() => void ble.actions.setWifi(ssid.trim(), password, true)} />
            </Card.Content>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <SecondaryButton label="Reset pairing only" onPress={() => setConfirmAction('reset_pair')} />
            <DestructiveButton label="Factory reset" onPress={() => setConfirmAction('factory')} />
            <SecondaryButton label="Disconnect" onPress={() => void ble.disconnect()} />
          </View>

          {latestMessage || latest?.type ? (
            <Text selectable style={{ color: colors.mutedStrong }}>
              Last response: {latest.type}{latestMessage ? ` - ${latestMessage}` : ''}
            </Text>
          ) : null}
        </View>
      )}
    </AppScreen>
  );
}
