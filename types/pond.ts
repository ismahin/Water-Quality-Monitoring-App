export type PondHealthStatus = 'good' | 'warning' | 'critical';

export interface Pond {
  id: string;
  name: string;
  location: string;
  deviceIds: string[];
  overallScore: number;
  healthStatus: PondHealthStatus;
  activeAlertCount: number;
  lastSyncAt: string;
}
