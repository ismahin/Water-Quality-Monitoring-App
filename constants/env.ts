import type { FirebaseOptions } from 'firebase/app';

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

export type FirebaseEnvKey = (typeof REQUIRED_KEYS)[number];

function missingKeys(): FirebaseEnvKey[] {
  return REQUIRED_KEYS.filter((k) => {
    const v = process.env[k];
    return typeof v !== 'string' || v.trim() === '';
  });
}

/**
 * Returns Firebase web config from Expo public env, or null if incomplete.
 * In development, throws with a clear message so misconfiguration is obvious early.
 */
export function readFirebaseWebConfig(): FirebaseOptions | null {
  const missing = missingKeys();
  if (missing.length === 0) {
    return {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!.trim(),
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!.trim(),
      databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL!.trim(),
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!.trim(),
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!.trim(),
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!.trim(),
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!.trim(),
    };
  }

  if (__DEV__) {
    throw new Error(
      `AquaNode Firebase env is incomplete. Missing: ${missing.join(', ')}.\n` +
        'Copy .env.example to .env in the project root and set all EXPO_PUBLIC_FIREBASE_* values, then restart Expo.',
    );
  }

  return null;
}

export function isFirebaseConfigured(): boolean {
  return missingKeys().length === 0;
}

export function getFirebaseConfigErrorMessage(): string | null {
  const missing = missingKeys();
  if (missing.length === 0) return null;
  return `Missing Firebase configuration: ${missing.join(', ')}. Copy .env.example to .env and set values.`;
}

export function readPublicBooleanEnv(key: string, fallback = false): boolean {
  const value = process.env[key];
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

export const MOCK_PROVISIONING_ENV = readPublicBooleanEnv('EXPO_PUBLIC_MOCK_PROVISIONING', false);
export const MOCK_BLE_CONFIG_ENV = readPublicBooleanEnv('EXPO_PUBLIC_MOCK_BLE_CONFIG', false);
