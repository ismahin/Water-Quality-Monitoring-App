import type { SensorSeriesPoint } from '../types/sensor';

export function formatPh(v: number): string {
  return v.toFixed(2);
}

export function formatTds(v: number): string {
  return `${Math.round(v)}`;
}

export function formatTempC(v: number): string {
  return v.toFixed(1);
}

export function formatTurbidity(v: number): string {
  return `${Math.round(v)}`;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function seriesMinMaxAvg(points: SensorSeriesPoint[]): {
  min: number;
  max: number;
  avg: number;
} {
  if (points.length === 0) return { min: 0, max: 0, avg: 0 };
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg };
}

export type PhStatusLabel = 'Acidic' | 'Normal' | 'Alkaline';
export function phStatusLabel(ph: number): PhStatusLabel {
  if (ph < 6.5) return 'Acidic';
  if (ph > 8.5) return 'Alkaline';
  return 'Normal';
}

export function tdsStatusLabel(ppm: number): 'Low' | 'Normal' | 'High' {
  if (ppm < 200) return 'Low';
  if (ppm > 500) return 'High';
  return 'Normal';
}

export function tempStatusLabel(c: number): 'Cool' | 'Comfortable' | 'Warm' | 'Hot' {
  if (c < 22) return 'Cool';
  if (c < 27) return 'Comfortable';
  if (c < 30) return 'Warm';
  return 'Hot';
}

export function turbidityStatusLabel(ntu: number): 'Clear' | 'Normal' | 'Slightly Cloudy' | 'Cloudy' {
  if (ntu <= 5) return 'Clear';
  if (ntu <= 12) return 'Normal';
  if (ntu <= 25) return 'Slightly Cloudy';
  return 'Cloudy';
}
