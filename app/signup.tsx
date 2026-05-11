import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing } from '../constants/theme';
import { useMockApp } from '../context/MockAppContext';
import { PrimaryButton } from '../components/PrimaryButton';

export default function SignupScreen() {
  const router = useRouter();
  const { setMockLoggedIn } = useMockApp();
  const [name, setName] = useState('Rafiqul');
  const [email, setEmail] = useState('rafiqul@example.com');
  const [phone, setPhone] = useState('+880 1700 000000');
  const [password, setPassword] = useState('password');
  const [confirm, setConfirm] = useState('password');
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    setLoading(true);
    setTimeout(async () => {
      await setMockLoggedIn(true);
      setLoading(false);
      router.replace('/(tabs)/dashboard');
    }, 500);
  };

  return (
    <LinearGradient colors={['#E0F2FE', '#F8FAFC']} style={{ flex: 1, padding: spacing.lg, paddingTop: 56 }}>
      <Text style={{ fontSize: 30, fontWeight: '900', color: colors.navy, letterSpacing: -0.5 }}>Create account</Text>
      <Text style={{ color: colors.mutedStrong, marginTop: 8, marginBottom: spacing.lg, fontSize: 16, lineHeight: 24, fontWeight: '600' }}>
        Mock signup navigates straight to your dashboard.
      </Text>

      <Card style={{ borderRadius: 24, backgroundColor: '#fff', ...shadows.elevated, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.12)' }}>
        <Card.Content style={{ gap: spacing.md }}>
          <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} />
          <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput mode="outlined" label="Phone" value={phone} onChangeText={setPhone} />
          <TextInput mode="outlined" label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TextInput mode="outlined" label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <PrimaryButton label="Create account" onPress={signup} loading={loading} />
          <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Already have an account? Login</Text>
          </Pressable>
        </Card.Content>
      </Card>
    </LinearGradient>
  );
}
