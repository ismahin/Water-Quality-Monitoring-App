import { useLocalSearchParams, useRouter } from 'expo-router';
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
  const { deviceId, ssid } = useLocalSearchParams<{ deviceId?: string; ssid?: string }>();
  const id = String(deviceId ?? '');
  const net = String(ssid ?? '');

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
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.navy, textAlign: 'center' }}>Device connected</Text>
          <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            The device joined your Wi‑Fi network. Telemetry should appear under Firebase Realtime Database.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: spacing.sm }}>
            <Text style={{ color: colors.navy, fontWeight: '800' }}>Device ID</Text>
            <Text style={{ color: colors.mutedStrong }}>{id || '—'}</Text>
            <Text style={{ color: colors.navy, fontWeight: '800', marginTop: spacing.sm }}>SSID</Text>
            <Text style={{ color: colors.mutedStrong }}>{net || '—'}</Text>
            <Text style={{ color: colors.navy, fontWeight: '800', marginTop: spacing.sm }}>Firebase paths</Text>
            <Text style={{ color: colors.mutedStrong, fontFamily: 'monospace', fontSize: 13 }}>
              devices/{id || '{deviceId}'}/latest{'\n'}
              devices/{id || '{deviceId}'}/status
            </Text>
          </View>
        </Card.Content>
      </Card>

      <PrimaryButton label="View live dashboard" style={{ marginTop: spacing.lg }} onPress={() => router.replace('/(tabs)/dashboard')} />
      <PrimaryButton
        label="View device details"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          if (id) router.replace(`/device/${id}`);
        }}
        disabled={!id}
      />
      <SecondaryButton label="Add another device" style={{ marginTop: spacing.sm }} onPress={() => router.replace('/setup/scan-device')} />
      <SecondaryButton label="Select device role (LoRa)" style={{ marginTop: spacing.sm }} onPress={() => router.push('/setup/select-device-role')} />
    </AppScreen>
  );
}
