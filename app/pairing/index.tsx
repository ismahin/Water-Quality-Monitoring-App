import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Card, RadioButton, TextInput } from 'react-native-paper';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { BleDeviceCard } from '../../components/pairing/BleDeviceCard';
import { PairingProgress } from '../../components/pairing/PairingProgress';
import { PairingStepHeader } from '../../components/pairing/PairingStepHeader';
import { ParentDeviceCard } from '../../components/pairing/ParentDeviceCard';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { usePairingWizard } from '../../hooks/usePairingWizard';

const stepNumber = {
  instructions: 1,
  ble: 2,
  info: 2,
  role: 3,
  parent: 4,
  connect: 5,
  test: 6,
  done: 7,
} as const;

export default function PairingWizardScreen() {
  const router = useRouter();
  const { networkId: networkParam } = useLocalSearchParams<{ networkId?: string }>();
  const wizard = usePairingWizard();

  useEffect(() => {
    if (networkParam) wizard.setNetworkId(String(networkParam));
  }, [networkParam]);

  return (
    <AppScreen>
      <AppHeader title="Add Child / Relay Node" subtitle="ESP32-S3 + SX1278 LoRa pairing" onBack={() => { void wizard.disconnect(); router.back(); }} />
      <PairingStepHeader current={stepNumber[wizard.step]} />

      {wizard.error ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: '#FEF2F2' }}>
          <Card.Content>
            <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{wizard.error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {wizard.step === 'instructions' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Add Child / Relay Node</Text>
            {[
              'Turn the existing parent device to Pairing Mode.',
              'Turn the new device to Pairing Mode.',
              'Keep both devices close during pairing.',
              'Make sure Gateway has Wi-Fi for server test.',
            ].map((item) => (
              <Text key={item} style={{ color: colors.mutedStrong, fontWeight: '700' }}>- {item}</Text>
            ))}
            <PrimaryButton
              label="Start BLE Scan"
              loading={wizard.scanning}
              onPress={() => {
                wizard.setStep('ble');
                void wizard.startScan();
              }}
            />
          </Card.Content>
        </Card>
      ) : null}

      {wizard.step === 'ble' ? (
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <PrimaryButton label={wizard.scanning ? 'Scanning...' : 'Rescan'} loading={wizard.scanning} onPress={() => void wizard.startScan()} />
          <Text selectable style={{ color: colors.mutedStrong, lineHeight: 20 }}>{wizard.scanSummary}</Text>
          {wizard.devices.length === 0 && !wizard.scanning ? (
            <Text style={{ color: colors.mutedStrong }}>
              No device found. Make sure the switch is in Pairing Mode and the device is nearby.
            </Text>
          ) : null}
          {wizard.devices.map((device) => (
            <BleDeviceCard
              key={device.id}
              device={device}
              loading={wizard.connecting}
              onConnect={() => {
                void wizard.connect(device.id).then(() => wizard.setStep('info'));
              }}
            />
          ))}
        </View>
      ) : null}

      {wizard.step === 'info' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>New Device</Text>
            <Text style={{ color: colors.mutedStrong }}>Switch mode: {wizard.info?.switch_mode ?? 'Unknown'}</Text>
            <Text style={{ color: colors.mutedStrong }}>LoRa ready: {wizard.info?.lora_ready ? 'Yes' : 'No'}</Text>
            <Text style={{ color: colors.mutedStrong }}>Already paired: {wizard.info?.paired ? 'Yes' : 'No'}</Text>
            <Text style={{ color: colors.mutedStrong }}>Wi-Fi connected: {wizard.info?.wifi_connected ? 'Yes' : 'No'}</Text>
            <TextInput mode="outlined" label="Device ID" value={wizard.deviceId} onChangeText={wizard.setDeviceId} autoCapitalize="characters" />
            <TextInput mode="outlined" label="Network ID" value={wizard.networkId} onChangeText={wizard.setNetworkId} autoCapitalize="characters" />
            <PrimaryButton label="Save Device Identity" disabled={!wizard.deviceId || !wizard.networkId} onPress={() => void wizard.saveIdentity()} />
            <SecondaryButton label="Continue" onPress={() => wizard.setStep('role')} />
          </Card.Content>
        </Card>
      ) : null}

      {wizard.step === 'role' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Select Role</Text>
            <RadioButton.Group onValueChange={(value) => wizard.setRole(value as 'CHILD' | 'RELAY')} value={wizard.role}>
              <RadioButton.Item label="Child - only sends own water quality data" value="CHILD" />
              <RadioButton.Item label="Relay - sends own data and forwards child data" value="RELAY" />
            </RadioButton.Group>
            <PrimaryButton
              label="Scan LoRa Parents"
              onPress={() => {
                wizard.setRole(wizard.role);
                wizard.setStep('parent');
                void wizard.actions.scanParents();
              }}
            />
          </Card.Content>
        </Card>
      ) : null}

      {wizard.step === 'parent' ? (
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <PrimaryButton label="Rescan Parents" onPress={() => void wizard.retryParents()} />
          {wizard.compatibleParents.length === 0 ? (
            <Text style={{ color: colors.mutedStrong }}>
              No parent device found. Put the existing Gateway/Relay device into Pairing Mode and keep it nearby.
            </Text>
          ) : null}
          {wizard.compatibleParents.map((parent) => (
            <ParentDeviceCard
              key={parent.id}
              parent={parent}
              selected={wizard.selectedParent?.id === parent.id}
              onSelect={() => wizard.selectParent(parent)}
            />
          ))}
          <PrimaryButton
            label="Pair Device"
            disabled={!wizard.selectedParent}
            onPress={() => void wizard.pair()}
          />
        </View>
      ) : null}

      {wizard.step === 'connect' || wizard.step === 'test' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Pairing Progress</Text>
            <PairingProgress progress={wizard.progress} />
            {wizard.step === 'test' ? (
              <Text style={{ color: colors.mutedStrong }}>
                Server Test: {wizard.testId ? `Waiting for Firebase confirmation (${wizard.testId})` : 'Waiting for device test packet...'}
              </Text>
            ) : null}
            {wizard.serverTestTimedOut ? (
              <Card style={{ borderRadius: radius.lg, backgroundColor: '#FFFBEB' }}>
                <Card.Content style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.warning, fontWeight: '900' }}>
                    Pairing was saved, but Firebase did not receive test data. Check Gateway Wi-Fi and LoRa range.
                  </Text>
                  <SecondaryButton label="Retry Scan" onPress={() => void wizard.retryParents()} />
                  <SecondaryButton label="Retry Pair" disabled={!wizard.selectedParent} onPress={() => void wizard.pair()} />
                  <PrimaryButton label="Finish Anyway" onPress={wizard.finishAnyway} />
                </Card.Content>
              </Card>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {wizard.step === 'done' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: '#ECFDF5', ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Pairing Successful</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>
              Pairing successful. Your new device is connected and data reached Firebase.
            </Text>
            <Text selectable style={{ color: colors.mutedStrong }}>New device: {wizard.deviceId}</Text>
            <Text selectable style={{ color: colors.mutedStrong }}>Role: {wizard.role}</Text>
            <Text selectable style={{ color: colors.mutedStrong }}>Parent: {wizard.selectedParent?.id ?? '-'}</Text>
            <Text selectable style={{ color: colors.mutedStrong }}>Network: {wizard.networkId}</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>Turn both switches back to Normal Mode.</Text>
            <PrimaryButton
              label="Go to Device Dashboard"
              onPress={() => router.replace({ pathname: '/devices/[deviceId]', params: { deviceId: wizard.deviceId, networkId: wizard.networkId } })}
            />
            <SecondaryButton label="Done" onPress={() => router.replace('/(tabs)/devices')} />
          </Card.Content>
        </Card>
      ) : null}
    </AppScreen>
  );
}
