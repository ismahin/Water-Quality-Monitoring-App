import type { FirebaseOptions } from 'firebase/app';
import { isFirebaseConfigured, readFirebaseWebConfig } from '../../constants/env';

/** Use after `isFirebaseConfigured()` is true. */
export function getFirebaseWebOptions(): FirebaseOptions {
  const opts = readFirebaseWebConfig();
  if (!opts) {
    throw new Error('Firebase options unavailable; check isFirebaseConfigured() first.');
  }
  return opts;
}

export { isFirebaseConfigured };
