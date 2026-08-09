import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const expoDb = openDatabaseSync('letslearnlanguages.db', {
  // Required for drizzle's useLiveQuery to react to writes (Phase 2 onwards).
  enableChangeListener: true,
});

// SQLite disables foreign key enforcement by default on every new connection.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
