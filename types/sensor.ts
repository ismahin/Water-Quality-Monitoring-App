export type SensorKind = 'ph' | 'tds' | 'temperature' | 'turbidity';

export interface SensorSnapshot {
  ph: number;
  tdsPpm: number;
  temperatureC: number;
  turbidityNtu: number;
}

export interface SensorSeriesPoint {
  label: string;
  value: number;
}

export interface SensorThresholds {
  phMin: number;
  phMax: number;
  tdsMaxPpm: number;
  tempMinC: number;
  tempMaxC: number;
  turbidityMaxNtu: number;
}
