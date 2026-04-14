import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import path from 'path';
import { db } from './index';

async function main() {
  console.log('[DB] Running migrations...');

  // Guards against duplicate primary key errors when the internal sequence
  // for drizzle.__drizzle_migrations is behind the current max(id).
  await db.execute(sql`
    DO $$
    DECLARE seq_name text;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) THEN
        SELECT pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id') INTO seq_name;
        IF seq_name IS NOT NULL THEN
          EXECUTE format(
            'SELECT setval(%L, COALESCE((SELECT MAX(id) FROM drizzle.__drizzle_migrations), 0) + 1, false)',
            seq_name
          );
        END IF;
      END IF;
    END $$;
  `);

  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('[DB] Migrations complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('[DB] Migration failed:', err);
  process.exit(1);
});
