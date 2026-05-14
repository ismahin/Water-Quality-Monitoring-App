import { StyleSheet, Text, View } from 'react-native';
import { Snackbar, useTheme, type SnackbarProps } from 'react-native-paper';

export type NotificationSnackbarProps = Omit<SnackbarProps, 'children'> & {
  message: string;
};

/**
 * Snackbar with wrapping message text. Plain string children in Paper Snackbar
 * can overflow the pill on long lines; this keeps copy inside the surface.
 */
export function NotificationSnackbar({ message, contentStyle, ...rest }: NotificationSnackbarProps) {
  const theme = useTheme();
  return (
    <Snackbar {...rest} contentStyle={[{ minWidth: 0, flexShrink: 1 }, contentStyle]}>
      <View style={styles.shell}>
        <Text style={[styles.body, { color: theme.colors.inverseOnSurface }]}>{message}</Text>
      </View>
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  shell: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
  },
});
