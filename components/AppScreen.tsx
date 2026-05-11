import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

export function AppScreen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: Props) {
  const pad = { paddingHorizontal: spacing.md, paddingBottom: spacing.xl };
  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ flexGrow: 1 }, pad, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
      <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}
