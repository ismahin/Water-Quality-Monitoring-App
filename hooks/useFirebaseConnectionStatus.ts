import { useEffect, useState } from 'react';
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import { isFirebaseConfigured } from '../constants/env';
import { getFirebaseDb } from '../services/firebase/firebaseClient';

/**
 * True when the Realtime Database client reports a live connection to the server.
 */
export function useFirebaseConnectionStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setConnected(false);
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setConnected(false);
      return;
    }

    const r = ref(db, '.info/connected');
    let unsub: Unsubscribe | undefined;
    try {
      unsub = onValue(r, (snap) => {
        setConnected(snap.val() === true);
      });
    } catch {
      setConnected(false);
    }

    return () => {
      unsub?.();
    };
  }, []);

  return connected;
}
