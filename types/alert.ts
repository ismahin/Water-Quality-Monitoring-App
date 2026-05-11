export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AquaAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  deviceId: string;
  pondId: string;
  createdAt: string;
  suggestedAction: string;
  resolved: boolean;
  sensorKind?: 'ph' | 'tds' | 'temperature' | 'turbidity';
  readingValue?: string;
}

export interface AlertTimelineEvent {
  id: string;
  label: string;
  time: string;
}
