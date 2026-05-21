import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';

export default function LoraPairingScreen() {
  const router = useRouter();
  const { parentId, gatewayId, childId, networkId } = useLocalSearchParams<{
    parentId?: string;
    gatewayId?: string;
    childId?: string;
    networkId?: string;
  }>();
  const { getGatewayChildren } = useMockApp();
  const gateway = String(gatewayId ?? 'M1');
  const child = childId ? String(childId) : undefined;
  const children = getGatewayChildren(gateway);
  const childSeen = child ? children.some((d) => d.id === child || d.sourceId === child) : children.length > 0;

  const steps = useMemo(
    () => [
      { title: 'Connect parent/config if needed', done: !!parentId },
      { title: 'Configure child over CFG_ BLE', done: !!child || childSeen },
      { title: 'Wait for LoRa test packet', done: childSeen },
      { title: 'Confirm data reached gateway Firebase', done: childSeen },
      { title: 'Calibration placeholder', done: false },
    ],
    [child, childSeen, parentId],
  );

  return (
    <AppScreen>
      <AppHeader title="LoRa pairing" subtitle={`Gateway ${gateway}`} onBack={() => router.back()} />

      <SetupStepCard
        step={3}
        totalSteps={5}
        title="Staged LoRa join"
        description="Configure the child over BLE, then confirm its packet arrives under the gateway Firebase children path."
      />

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.md }}>
          {steps.map((s) => (
            <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {s.done ? <CheckCircle2 color={colors.success} size={22} /> : <Circle color={colors.border} size={22} />}
              <Text style={{ color: colors.navy, fontWeight: '800', flex: 1 }}>{s.title}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: childSeen ? '#ECFDF5' : '#FFFBEB', borderWidth: 1, borderColor: childSeen ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)' }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.navy, fontWeight: '900' }}>{childSeen ? 'Child node connected' : 'Waiting for gateway data'}</Text>
          <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
            {childSeen
              ? `Gateway ${gateway} has received at least one child/relay packet.`
              : `No child packet has appeared at devices/${gateway}/children yet.`}
          </Text>
          <Text selectable style={{ color: colors.mutedStrong, fontFamily: 'monospace', fontSize: 12 }}>
            devices/{gateway}/children/{child ?? '{childId}'}/latest
          </Text>
        </Card.Content>
      </Card>

      <PrimaryButton
        label="Configure Child Node"
        style={{ marginTop: spacing.lg }}
        onPress={() =>
          router.push({
            pathname: '/setup/scan-device',
            params: {
              mode: 'config',
              targetRole: 'child',
              parentId: String(parentId ?? ''),
              rootGatewayId: gateway,
              networkId: String(networkId ?? 'POND_001'),
            },
          })
        }
      />
      <SecondaryButton
        label="Open Signal Test"
        style={{ marginTop: spacing.sm }}
        onPress={() => router.push({ pathname: '/setup/lora-signal-test', params: { gatewayId: gateway, deviceId: child ?? '' } })}
      />
      <SecondaryButton label="Finish" style={{ marginTop: spacing.sm }} onPress={() => router.replace('/(tabs)/devices')} />
    </AppScreen>
  );
}
