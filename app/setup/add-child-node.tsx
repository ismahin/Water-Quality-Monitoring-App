import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, RadioButton } from 'react-native-paper';
import { getDeviceById } from '../../constants/mockData';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';

export default function AddChildNodeScreen() {
  const router = useRouter();
  const [parentId, setParentId] = useState<'m1' | 'c1'>('m1');
  const parent = getDeviceById(parentId);

  return (
    <AppScreen>
      <AppHeader title="Add child node" onBack={() => router.back()} />

      <SetupStepCard
        step={1}
        totalSteps={4}
        title="Choose parent device"
        description="Pick the gateway or relay that will receive LoRa uplink from this node."
      />

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <RadioButton.Group onValueChange={(v) => setParentId(v as 'm1' | 'c1')} value={parentId}>
            <Pressable onPress={() => setParentId('m1')} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="m1" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: colors.navy }}>M1 Gateway</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Role: Gateway</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setParentId('c1')} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="c1" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: colors.navy }}>C1 Relay</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Role: Relay</Text>
              </View>
            </Pressable>
          </RadioButton.Group>
        </Card.Content>
      </Card>

      {parent && parent.role === 'gateway' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy, marginBottom: spacing.sm }}>Parent signal</Text>
            <SignalStrengthBar type="wifi" rssi={parent.wifiRssi} />
          </Card.Content>
        </Card>
      ) : null}

      {parent && parent.role === 'relay' ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy, marginBottom: spacing.sm }}>Parent LoRa uplink</Text>
            <SignalStrengthBar type="lora" rssi={parent.loraRssi} snr={parent.loraSnr} packetSuccess={parent.packetSuccessPercent} />
          </Card.Content>
        </Card>
      ) : null}

      <PrimaryButton
        label="Scan child node (BLE)"
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          // TODO: BLE scan integration
          router.push('/setup/scan-device');
        }}
      />
      <PrimaryButton
        label="Confirm LoRa module detected"
        style={{ marginTop: spacing.sm }}
        onPress={() => router.push('/setup/lora-pairing')}
      />
    </AppScreen>
  );
}
