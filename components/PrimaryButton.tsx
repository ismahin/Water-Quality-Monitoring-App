import { Button } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import { layout, radius } from '../constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, loading, disabled, style }: Props) {
  return (
    <Button
      mode="contained"
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      style={[{ borderRadius: radius.lg, minHeight: layout.buttonMinHeight }, style]}
      contentStyle={{ minHeight: layout.buttonMinHeight - 2 }}
      labelStyle={{ fontWeight: '700', fontSize: 15 }}
    >
      {label}
    </Button>
  );
}
