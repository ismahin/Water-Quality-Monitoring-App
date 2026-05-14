import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Card, TextInput } from 'react-native-paper';
import { NotificationSnackbar } from '../../components/NotificationSnackbar';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';

export default function AddPondScreen() {
  const router = useRouter();
  const { addPond } = useMockApp();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [snack, setSnack] = useState(false);

  return (
    <AppScreen>
      <AppHeader title="Add pond" subtitle="Create a workspace for devices and alerts" onBack={() => router.back()} />
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
          <TextInput mode="outlined" label="Pond name" value={name} onChangeText={setName} />
          <TextInput mode="outlined" label="Location" value={location} onChangeText={setLocation} />
        </Card.Content>
      </Card>
      <PrimaryButton
        label="Save pond"
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          addPond({
            name: name || 'New Pond',
            location: location || 'Unknown',
            deviceIds: [],
            overallScore: 75,
            healthStatus: 'good',
            activeAlertCount: 0,
            lastSyncAt: new Date().toISOString(),
          });
          setSnack(true);
          setTimeout(() => router.back(), 600);
        }}
      />
      <NotificationSnackbar visible={snack} onDismiss={() => setSnack(false)} message="Pond saved (mock)" />
    </AppScreen>
  );
}
