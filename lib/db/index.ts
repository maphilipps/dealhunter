import path from 'path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

import * as schema from './schema';

// Use absolute path to avoid SQLITE_READONLY_DBMOVED errors
const dbPath = path.join(process.cwd(), 'local.db');
const sqlite = new Database(dbPath);

// Load sqlite-vec extension for vector similarity search (DEA-107)
sqliteVec.load(sqlite);

export const db = drizzle(sqlite, { schema });
