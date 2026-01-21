import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Use absolute path to avoid SQLITE_READONLY_DBMOVED errors
const dbPath = path.join(process.cwd(), 'local.db');
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
