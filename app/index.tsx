import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMockApp } from '../context/MockAppContext';

export default function SplashScreen() {
  const router = useRouter();
  const { hydrated, mockLoggedIn, hasCompletedOnboarding } = useMockApp();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.92, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, [opacity, scale]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      if (mockLoggedIn) {
        router.replace('/(tabs)/dashboard');
        return;
      }
      if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
        return;
      }
      router.replace('/login');
    }, 2000);
    return () => clearTimeout(t);
  }, [hydrated, hasCompletedOnboarding, mockLoggedIn, router]);

  return (
    <LinearGradient colors={['#0EA5E9', '#06B6D4']} style={styles.gradient}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <View style={styles.droplet}>
            <View style={styles.inner} />
          </View>
        </Animated.View>
        <Text style={styles.title}>AquaNode</Text>
        <Text style={styles.subtitle}>Smart Water Quality Monitoring</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  droplet: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  inner: {
    width: 72,
    height: 72,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  title: { marginTop: 22, fontSize: 34, fontWeight: '900', color: '#fff' },
  subtitle: { marginTop: 10, fontSize: 15, color: 'rgba(255,255,255,0.92)', fontWeight: '600' },
});
