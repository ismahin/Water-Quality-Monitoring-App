import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function CalibrationCompleteScreen() {
  const router = useRouter();
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

  return (
    <AppScreen>
      <AppHeader title="Calibration complete" onBack={() => router.replace('/(tabs)/dashboard')} />

      <Card style={{ borderRadius: radius.xxl, ...shadows.card, backgroundColor: colors.card }}>
        <Card.Content style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 color={colors.success} size={38} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.navy, textAlign: 'center' }}>
            Sensors calibrated (mock)
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            Next calibration due: {due}
          </Text>
        </Card.Content>
      </Card>

      <PrimaryButton label="Return to device" style={{ marginTop: spacing.lg }} onPress={() => router.replace('/device/m1')} />
    </AppScreen>
  );
}
