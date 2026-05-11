import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, RadioButton, Snackbar, TextInput } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function ThresholdsScreen() {
  const router = useRouter();
  const { thresholds, setThresholds } = useMockApp();
  const [scope, setScope] = useState<'pond' | 'device'>('pond');
  const [phMin, setPhMin] = useState(String(thresholds.phMin));
  const [phMax, setPhMax] = useState(String(thresholds.phMax));
  const [tdsMax, setTdsMax] = useState(String(thresholds.tdsMaxPpm));
  const [tMin, setTMin] = useState(String(thresholds.tempMinC));
  const [tMax, setTMax] = useState(String(thresholds.tempMaxC));
  const [ntuMax, setNtuMax] = useState(String(thresholds.turbidityMaxNtu));
  const [snack, setSnack] = useState(false);

  const save = () => {
    setThresholds({
      phMin: Number(phMin),
      phMax: Number(phMax),
      tdsMaxPpm: Number(tdsMax),
      tempMinC: Number(tMin),
      tempMaxC: Number(tMax),
      turbidityMaxNtu: Number(ntuMax),
    });
    setSnack(true);
  };

  return (
    <AppScreen>
      <AppHeader title="Thresholds" subtitle="Mock save — no cloud sync" onBack={() => router.back()} />

      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 16 }}>Apply to</Text>
          <RadioButton.Group onValueChange={(v) => setScope(v as 'pond' | 'device')} value={scope}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="pond" />
              <Text>Whole pond</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="device" />
              <Text>Specific device (mock)</Text>
            </View>
          </RadioButton.Group>
        </Card.Content>
      </Card>

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
        <Card.Content style={{ gap: spacing.md }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>pH</Text>
          <TextInput mode="outlined" label="Min" keyboardType="decimal-pad" value={phMin} onChangeText={setPhMin} />
          <TextInput mode="outlined" label="Max" keyboardType="decimal-pad" value={phMax} onChangeText={setPhMax} />

          <Text style={{ fontWeight: '900', color: colors.navy, marginTop: spacing.sm }}>TDS</Text>
          <TextInput mode="outlined" label="Max ppm" keyboardType="number-pad" value={tdsMax} onChangeText={setTdsMax} />

          <Text style={{ fontWeight: '900', color: colors.navy, marginTop: spacing.sm }}>Temperature</Text>
          <TextInput mode="outlined" label="Min °C" keyboardType="decimal-pad" value={tMin} onChangeText={setTMin} />
          <TextInput mode="outlined" label="Max °C" keyboardType="decimal-pad" value={tMax} onChangeText={setTMax} />

          <Text style={{ fontWeight: '900', color: colors.navy, marginTop: spacing.sm }}>Turbidity</Text>
          <TextInput mode="outlined" label="Max NTU" keyboardType="number-pad" value={ntuMax} onChangeText={setNtuMax} />
        </Card.Content>
      </Card>

      <PrimaryButton label="Save thresholds" onPress={save} style={{ marginTop: spacing.lg }} />
      <Snackbar visible={snack} onDismiss={() => setSnack(false)} duration={2000}>
        Thresholds saved (mock)
      </Snackbar>
    </AppScreen>
  );
}
