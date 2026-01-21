import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.cwd(), 'local.db'),
  },
} satisfies Config;
