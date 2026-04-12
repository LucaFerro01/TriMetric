import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { db } from './index';

async function main() {
  console.log('[DB] Running migrations...');
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('[DB] Migrations complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('[DB] Migration failed:', err);
  process.exit(1);
});
