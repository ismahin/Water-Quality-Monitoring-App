// TODO: OTA update integration — device handshake, checksum verify, rollback safety.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, ProgressBar, Snackbar } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { getDeviceById } from '../../constants/mockData';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';

export default function FirmwareUpdateScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();
  const id = String(deviceId ?? 'm1');
  const device = getDeviceById(id);
  const [progress, setProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const next = useMemo(() => device?.availableFirmwareVersion ?? '1.0.1', [device]);

  const start = () => {
    setUpdating(true);
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += 0.08;
      setProgress(Math.min(1, p));
      if (p >= 1) {
        clearInterval(t);
        setUpdating(false);
        setSnack('Update complete (mock)');
      }
    }, 220);
  };

  if (!device) {
    return (
      <AppScreen>
        <AppHeader title="Firmware" onBack={() => router.back()} />
        <Text style={{ color: colors.muted }}>Device not found.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title="Firmware update" subtitle={device.name} onBack={() => router.back()} />

      <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.muted }}>Current</Text>
          <Text style={{ fontWeight: '900', color: colors.navy }}>v{device.firmwareVersion}</Text>
          <Text style={{ color: colors.muted, marginTop: spacing.sm }}>Available</Text>
          <Text style={{ fontWeight: '900', color: colors.navy }}>v{next}</Text>
        </Card.Content>
      </Card>

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content>
          <Text style={{ fontWeight: '900', color: colors.navy }}>Changelog</Text>
          <Text style={{ marginTop: spacing.sm, color: colors.muted, lineHeight: 20 }}>
            • Improved LoRa join reliability{'\n'}• Better turbidity filtering{'\n'}• Diagnostics reporting fixes
          </Text>
        </Card.Content>
      </Card>

      <Text style={{ marginTop: spacing.md, color: colors.danger, fontWeight: '800' }}>
        Keep the device powered during update.
      </Text>

      <ProgressBar progress={progress} style={{ marginTop: spacing.md, height: 10, borderRadius: 999 }} />
      <PrimaryButton label={updating ? 'Updating…' : 'Update now'} onPress={start} loading={updating} style={{ marginTop: spacing.lg }} />
      <SecondaryButton
        label="Simulate failure"
        onPress={() => setSnack('Firmware update failed (mock)')}
        style={{ marginTop: spacing.sm }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}
