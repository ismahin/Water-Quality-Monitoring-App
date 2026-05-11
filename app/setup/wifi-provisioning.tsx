import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator, Card, RadioButton, TextInput } from 'react-native-paper';
import { mockWifiNetworks } from '../../constants/mockData';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';

type Phase = 'pick' | 'sending' | 'success';

export default function WifiProvisioningScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const deviceName = useMemo(() => String(name ?? 'WQM_A1B2C3'), [name]);
  const [ssid, setSsid] = useState(mockWifiNetworks[0]);
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('pick');

  const connect = () => {
    setPhase('sending');
    // TODO: Wi-Fi provisioning integration
    setTimeout(() => setPhase('success'), 1600);
  };

  return (
    <AppScreen>
      <AppHeader title="Wi‑Fi provisioning" onBack={() => router.back()} />

      <SetupStepCard
        step={3}
        totalSteps={6}
        title="Connect to Wi‑Fi"
        description={`Selected device: ${deviceName}`}
      />

      <Text style={{ marginTop: spacing.md, color: colors.warning, fontWeight: '800' }}>
        ESP32 devices support 2.4 GHz Wi‑Fi. 5 GHz networks will not be shown.
      </Text>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Nearby 2.4 GHz networks</Text>
          <RadioButton.Group onValueChange={setSsid} value={ssid}>
            {mockWifiNetworks.map((n) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <RadioButton value={n} />
                <Text>{n}</Text>
              </View>
            ))}
          </RadioButton.Group>
          <TextInput mode="outlined" label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        </Card.Content>
      </Card>

      {phase === 'sending' ? (
        <View style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Sending Wi‑Fi credentials securely…</Text>
        </View>
      ) : null}

      {phase === 'success' ? (
        <Card style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content style={{ gap: 6 }}>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Device connected</Text>
            <Text style={{ color: colors.muted }}>SSID: {ssid}</Text>
            <Text style={{ color: colors.muted }}>Wi‑Fi RSSI: -54 dBm</Text>
            <Text style={{ color: colors.muted }}>IP: 192.168.1.142 (placeholder)</Text>
            <Text style={{ color: colors.muted }}>Cloud: online</Text>
          </Card.Content>
        </Card>
      ) : null}

      <PrimaryButton
        label={phase === 'success' ? 'Continue' : 'Connect device'}
        onPress={() => {
          if (phase === 'success') router.push('/setup/provisioning-success');
          else connect();
        }}
        style={{ marginTop: spacing.lg }}
        disabled={phase === 'sending'}
      />
    </AppScreen>
  );
}
