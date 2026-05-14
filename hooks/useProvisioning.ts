import { useCallback, useState } from 'react';
import {
  provisionDevice,
  type ProvisionDeviceParams,
  type ProvisioningErrorCode,
  type ProvisioningResult,
  normalizeProvisioningError,
} from '../services/provisioning/espProvisioningService';

export type ProvisioningPhase =
  | 'idle'
  | 'connectingDevice'
  | 'sendingCredentials'
  | 'waitingForWifi'
  | 'success'
  | 'wrongPassword'
  | 'apNotFound'
  | 'timeout'
  | 'bleDisconnected'
  | 'error';

function failureCodeToPhase(code: ProvisioningErrorCode): ProvisioningPhase {
  switch (code) {
    case 'WIFI_AUTH_ERROR':
      return 'wrongPassword';
    case 'WIFI_AP_NOT_FOUND':
      return 'apNotFound';
    case 'PROVISION_TIMEOUT':
      return 'timeout';
    case 'BLE_DISCONNECTED':
      return 'bleDisconnected';
    default:
      return 'error';
  }
}

export interface UseProvisioningState {
  phase: ProvisioningPhase;
  errorMessage: string | null;
  errorCode: ProvisioningErrorCode | null;
  lastSuccess: { deviceId: string; ssid: string } | null;
  runProvision: (params: ProvisionDeviceParams) => Promise<void>;
  reset: () => void;
}

export function useProvisioning(): UseProvisioningState {
  const [phase, setPhase] = useState<ProvisioningPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ProvisioningErrorCode | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ deviceId: string; ssid: string } | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setErrorMessage(null);
    setErrorCode(null);
    setLastSuccess(null);
  }, []);

  const runProvision = useCallback(async (params: ProvisionDeviceParams) => {
    setErrorMessage(null);
    setErrorCode(null);
    setLastSuccess(null);
    setPhase('connectingDevice');
    try {
      const result: ProvisioningResult = await provisionDevice(params, {
        onPhase: (p) => setPhase(p),
      });
      if (result.ok) {
        setLastSuccess({ deviceId: result.deviceId, ssid: result.ssid });
        setPhase('success');
      } else {
        setErrorCode(result.code);
        setErrorMessage(result.message);
        setPhase(failureCodeToPhase(result.code));
      }
    } catch (e) {
      const f = normalizeProvisioningError(e);
      console.error('[AquaNode][useProvisioning] runProvision exception:', e);
      if (e instanceof Error && e.stack) console.error('[AquaNode][useProvisioning] stack:', e.stack);
      setErrorCode(f.code);
      setErrorMessage(f.message);
      setPhase(failureCodeToPhase(f.code));
    }
  }, []);

  return { phase, errorMessage, errorCode, lastSuccess, runProvision, reset };
}
