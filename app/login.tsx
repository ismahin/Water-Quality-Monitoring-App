import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing } from '../constants/theme';
import { useMockApp } from '../context/MockAppContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';

export default function LoginScreen() {
  const router = useRouter();
  const { setMockLoggedIn } = useMockApp();
  const [email, setEmail] = useState('rafiqul@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setTimeout(async () => {
      await setMockLoggedIn(true);
      setLoading(false);
      router.replace('/(tabs)/dashboard');
    }, 450);
  };

  return (
    <LinearGradient colors={['#E0F2FE', '#F8FAFC']} style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
      <Text style={{ fontSize: 30, fontWeight: '900', color: colors.navy, marginBottom: 8, letterSpacing: -0.5 }}>Welcome back</Text>
      <Text style={{ color: colors.mutedStrong, marginBottom: spacing.lg, fontSize: 16, lineHeight: 24, fontWeight: '600' }}>
        Sign in to manage ponds and devices.
      </Text>

      <Card style={{ borderRadius: 24, backgroundColor: '#fff', ...shadows.elevated, borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.12)' }}>
        <Card.Content style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
          <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput mode="outlined" label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <PrimaryButton label="Login" onPress={login} loading={loading} />
          <SecondaryButton
            label="Continue with Google (coming soon)"
            onPress={() => {}}
            disabled
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.push('/forgot-password')}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/signup')}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Create account</Text>
            </Pressable>
          </View>
        </Card.Content>
      </Card>
    </LinearGradient>
  );
}
