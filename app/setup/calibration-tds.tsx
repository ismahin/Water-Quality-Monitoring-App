import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native-paper';
import { colors, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { CalibrationStepCard } from '../../components/CalibrationStepCard';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function CalibrationTdsScreen() {
  const router = useRouter();
  const [ppm, setPpm] = useState('342');

  return (
    <AppScreen>
      <AppHeader title="TDS calibration" onBack={() => router.back()} />

      <CalibrationStepCard
        title="Standard solution"
        subtitle="Place the probe in a known ppm solution and enter the label value."
      >
        <TextInput mode="outlined" label="Solution ppm" keyboardType="number-pad" value={ppm} onChangeText={setPpm} />
      </CalibrationStepCard>

      <PrimaryButton
        label="Save calibration"
        style={{ marginTop: spacing.lg }}
        onPress={() => router.push('/setup/calibration-turbidity')}
      />
    </AppScreen>
  );
}
