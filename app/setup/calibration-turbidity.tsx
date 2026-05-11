import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { CalibrationStepCard } from '../../components/CalibrationStepCard';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function CalibrationTurbidityScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Turbidity calibration" onBack={() => router.back()} />

      <CalibrationStepCard
        title="Zero / reference"
        subtitle="Use clean water for zero, then a stable reference vial if available."
      >
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Mock: tap save to capture a baseline offset for charts and alerts.
        </Text>
      </CalibrationStepCard>

      <PrimaryButton
        label="Save zero / reference"
        style={{ marginTop: spacing.lg }}
        onPress={() => router.push('/setup/calibration-complete')}
      />
    </AppScreen>
  );
}
