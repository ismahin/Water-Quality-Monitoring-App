import { Dimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../constants/theme';
import type { SensorSeriesPoint } from '../types/sensor';

type Props = {
  data: SensorSeriesPoint[];
  height?: number;
  ySuffix?: string;
};

export function SensorChart({ data, height = 180, ySuffix = '' }: Props) {
  const screenW = Dimensions.get('window').width;
  const chartWidth = Math.max(260, screenW - spacingScreen);

  return (
    <View style={{ alignItems: 'center' }}>
      <LineChart
        data={{
          labels: data.map((d) => d.label),
          datasets: [{ data: data.map((d) => d.value) }],
        }}
        width={chartWidth}
        height={height}
        yAxisSuffix={ySuffix}
        chartConfig={{
          backgroundGradientFrom: colors.card,
          backgroundGradientTo: colors.card,
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: colors.primary,
          },
        }}
        bezier
        style={{ borderRadius: 16, marginVertical: 8 }}
      />
    </View>
  );
}

const spacingScreen = 64;
