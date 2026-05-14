import type { ViewStyle } from 'react-native';
import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export const colors = {
  primary: '#0EA5E9',
  secondary: '#06B6D4',
  navy: '#0F172A',
  muted: '#64748B',
  /** Slightly darker for small UI text (contrast on white). */
  mutedStrong: '#475569',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  /** Subtle cool wash for sections */
  surfaceMuted: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.06)',
} as const;

/** Left accent on device cards / tree by role */
export const roleAccent = {
  gateway: '#0EA5E9',
  relay: '#06B6D4',
  child: '#14B8A6',
  single: '#6366F1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  /** Auth / hero cards */
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const layout = {
  buttonMinHeight: 52,
  hitSlop: 12,
} as const;

/**
 * Paper `Dialog` `style`. Also set a moderate `borderRadius`: MD3 Dialog defaults to
 * `7 * theme.roundness`, which with our card roundness becomes huge and turns the dialog
 * into a capsule so title/actions look outside the white surface.
 */
export const modalSurfaceFit: ViewStyle = {
  alignSelf: 'center',
  width: '92%',
  maxWidth: 560,
  borderRadius: radius.lg,
};

const fontConfig = {
  bodyLarge: { fontFamily: 'System' },
  bodyMedium: { fontFamily: 'System' },
  titleLarge: { fontFamily: 'System', fontWeight: '600' as const },
  titleMedium: { fontFamily: 'System', fontWeight: '600' as const },
};

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: '#E0F2FE',
    secondary: colors.secondary,
    secondaryContainer: '#CFFAFE',
    background: colors.background,
    surface: colors.card,
    surfaceVariant: colors.surfaceMuted,
    outline: colors.border,
    error: colors.danger,
    onPrimary: '#FFFFFF',
    onSurface: colors.navy,
    onSurfaceVariant: colors.mutedStrong,
    onBackground: colors.navy,
  },
  roundness: radius.lg,
  fonts: configureFonts({ config: fontConfig }),
};
