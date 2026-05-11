import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator, Checkbox } from 'react-native-paper';
import { colors, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { CalibrationStepCard } from '../../components/CalibrationStepCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';

export default function CalibrationPhScreen() {
  const router = useRouter();
  const [rinse, setRinse] = useState(false);
  const [buffer7, setBuffer7] = useState(false);
  const [stabilizing, setStabilizing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!buffer7) return undefined;
    setStabilizing(true);
    const t = setTimeout(() => {
      setStabilizing(false);
      setSaved(true);
    }, 1400);
    return () => clearTimeout(t);
  }, [buffer7]);

  return (
    <AppScreen>
      <AppHeader title="pH calibration" onBack={() => router.back()} />

      <CalibrationStepCard title="pH buffer sequence" subtitle="Follow the steps in order. This is a mock stabilization timer.">
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Checkbox status={rinse ? 'checked' : 'unchecked'} onPress={() => setRinse((v) => !v)} />
            <Text style={{ color: colors.navy, fontWeight: '700', flex: 1 }}>Rinse probe in distilled water</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Checkbox status={buffer7 ? 'checked' : 'unchecked'} onPress={() => setBuffer7((v) => !v)} />
            <Text style={{ color: colors.navy, fontWeight: '700', flex: 1 }}>Place in pH 7.00 buffer</Text>
          </View>
          {stabilizing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ActivityIndicator />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Stabilizing reading…</Text>
            </View>
          ) : null}
          {saved ? <Text style={{ color: colors.success, fontWeight: '900' }}>Saved calibration point</Text> : null}
        </View>
      </CalibrationStepCard>

      <Text style={{ marginTop: spacing.lg, color: colors.muted, lineHeight: 20 }}>
        Optional: repeat for pH 4.00 / 10.00 buffers for two-point slope refinement (mock).
      </Text>

      <PrimaryButton
        label="Continue to TDS"
        style={{ marginTop: spacing.lg }}
        onPress={() => router.push('/setup/calibration-tds')}
        disabled={!saved}
      />
      <SecondaryButton label="Back" style={{ marginTop: spacing.sm }} onPress={() => router.back()} />
    </AppScreen>
  );
}
