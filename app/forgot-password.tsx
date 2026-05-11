import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Card, Snackbar, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing } from '../constants/theme';
import { AppScreen } from '../components/AppScreen';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [snack, setSnack] = useState(false);

  return (
    <LinearGradient colors={['#E0F2FE', '#F8FAFC']} style={{ flex: 1 }}>
      <AppScreen>
        <AppHeader title="Reset password" onBack={() => router.back()} />
        <Text style={{ color: colors.mutedStrong, marginBottom: spacing.md, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>
          Enter your email. This is a UI mock — no email is sent.
        </Text>
        <Card style={{ borderRadius: 24, backgroundColor: '#fff', ...shadows.elevated, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.12)' }}>
          <Card.Content style={{ gap: spacing.md }}>
            <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <PrimaryButton label="Send reset link" onPress={() => setSnack(true)} />
          </Card.Content>
        </Card>
        <Snackbar visible={snack} onDismiss={() => setSnack(false)} duration={2500}>
          Mock: reset link sent.
        </Snackbar>
      </AppScreen>
    </LinearGradient>
  );
}
