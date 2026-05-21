import { Chip } from 'react-native-paper';
import { colors } from '../constants/theme';
import type { UniversalRole } from '../types/universalDevice';

type Props = {
  role?: UniversalRole | string;
  compact?: boolean;
};

function styleForRole(role: string): { bg: string; fg: string; label: string } {
  switch (role.toUpperCase()) {
    case 'SINGLE':
      return { bg: '#DBEAFE', fg: '#1D4ED8', label: 'SINGLE' };
    case 'GATEWAY':
      return { bg: '#CFFAFE', fg: '#0E7490', label: 'GATEWAY' };
    case 'RELAY':
      return { bg: '#EDE9FE', fg: '#7C3AED', label: 'RELAY' };
    case 'CHILD':
      return { bg: '#DCFCE7', fg: '#15803D', label: 'CHILD' };
    case 'UNCONFIGURED':
      return { bg: '#F1F5F9', fg: colors.mutedStrong, label: 'UNCONFIGURED' };
    case 'ERROR':
      return { bg: '#FEE2E2', fg: colors.danger, label: 'ERROR' };
    default:
      return { bg: '#F1F5F9', fg: colors.mutedStrong, label: role || 'UNKNOWN' };
  }
}

export function NetworkRoleChip({ role = 'UNCONFIGURED', compact = true }: Props) {
  const s = styleForRole(String(role));
  return (
    <Chip compact={compact} style={{ backgroundColor: s.bg, height: compact ? 28 : undefined }} textStyle={{ color: s.fg, fontWeight: '900', fontSize: compact ? 11 : 13 }}>
      {s.label}
    </Chip>
  );
}
