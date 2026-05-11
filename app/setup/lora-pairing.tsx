import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator, Card } from 'react-native-paper';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';

const steps = [
  'Checking LoRa module',
  'Sending pairing request',
  'Waiting for parent response',
  'Sending demo data',
  'Confirming cloud update',
] as const;

export default function LoraPairingScreen() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return undefined;
    const t = setInterval(() => {
      setActive((s) => {
        if (s >= steps.length - 1) {
          clearInterval(t);
          setDone(true);
          return s;
        }
        return s + 1;
      });
    }, 900);
    return () => clearInterval(t);
  }, [done]);

  const label = useMemo(() => {
    if (done) return 'C2 successfully connected under C1 Relay';
    return steps[active] ?? '';
  }, [active, done]);

  return (
    <AppScreen>
      <AppHeader title="LoRa pairing" onBack={() => router.back()} />

      <SetupStepCard
        step={3}
        totalSteps={5}
        title="Secure LoRa join"
        description={
          'Mock pairing sequence with timed steps. ' +
          // TODO: LoRa pairing integration
          ''
        }
      />

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.md }}>
          {steps.map((s, idx) => {
            const complete = done || idx < active;
            const current = !done && idx === active;
            return (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {complete ? (
                  <CheckCircle2 color={colors.success} size={22} />
                ) : current ? (
                  <ActivityIndicator />
                ) : (
                  <Circle color={colors.border} size={22} />
                )}
                <Text style={{ color: colors.navy, fontWeight: '800', flex: 1 }}>{s}</Text>
              </View>
            );
          })}
        </Card.Content>
      </Card>

      <Text style={{ marginTop: spacing.lg, color: colors.navy, fontWeight: '900', fontSize: 16 }}>{label}</Text>

      <PrimaryButton
        label={done ? 'Finish' : 'Pairing…'}
        disabled={!done}
        style={{ marginTop: spacing.lg }}
        onPress={() => router.replace('/(tabs)/devices')}
      />
    </AppScreen>
  );
}
