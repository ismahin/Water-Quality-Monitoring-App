import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';

export default function ProvisioningSuccessScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Provisioning" onBack={() => router.back()} />

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
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.navy, textAlign: 'center' }}>
            Device connected
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            Next, choose how this hardware will operate on your network.
          </Text>
        </Card.Content>
      </Card>

      <PrimaryButton label="Select device role" style={{ marginTop: spacing.lg }} onPress={() => router.push('/setup/select-device-role')} />
      <SecondaryButton label="Back to dashboard" style={{ marginTop: spacing.sm }} onPress={() => router.replace('/(tabs)/dashboard')} />
    </AppScreen>
  );
}
