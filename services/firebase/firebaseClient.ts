import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { isFirebaseConfigured } from '../../constants/env';
import { getFirebaseWebOptions } from './firebaseConfig';

let appInstance: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!appInstance) {
    const options = getFirebaseWebOptions();
    appInstance = getApps().length === 0 ? initializeApp(options) : getApp();
  }
  return appInstance;
}

export function getFirebaseDb(): Database | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getDatabase(app);
}

/** Realtime Database accessor — call as `db()` (returns `null` when env not configured). */
export { getFirebaseApp as app, getFirebaseDb as db };
