import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { CalibrationStepCard } from '../../components/CalibrationStepCard';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function CalibrationStartScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Calibration" subtitle="Wizard (mock)" onBack={() => router.back()} />

      <CalibrationStepCard
        title="Why calibration matters"
        subtitle="Buffers drift and fouling change readings. A short wizard restores trust in your charts and alerts."
      >
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          {/* TODO: Backend API integration — persist calibration certificates */}
          This UI simulates stabilization timers only.
        </Text>
      </CalibrationStepCard>

      <Text style={{ marginTop: spacing.lg, fontWeight: '900', color: colors.navy }}>Sensors detected</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
        {['pH', 'TDS', 'Temperature', 'Turbidity'].map((s) => (
          <Chip key={s} icon="check">
            {s}
          </Chip>
        ))}
      </View>

      <Card style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            You will move through buffer steps, solution entry, and a turbidity zero/reference capture.
          </Text>
        </Card.Content>
      </Card>

      <PrimaryButton label="Begin pH calibration" style={{ marginTop: spacing.lg }} onPress={() => router.push('/setup/calibration-ph')} />
    </AppScreen>
  );
}
