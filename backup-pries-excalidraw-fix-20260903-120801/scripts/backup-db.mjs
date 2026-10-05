#!/usr/bin/env node
/**
 * Snapshot the live Supabase data to local files.
 *
 * Why this exists: `supabase db dump` shells out to pg_dump inside Docker,
 * and pg_dump/Docker are not installed here. This needs nothing but Node and
 * the `pg` driver.
 *
 * Scope is deliberately data-only. The schema already lives in
 * `db/migrations/`; what a migration can destroy is the rows.
 *
 * Usage:
 *   1. Supabase Dashboard -> Project Settings -> Database -> Connection string
 *      -> URI. Copy it and replace [YOUR-PASSWORD] with the database password.
 *   2. Put it in .env.local (which is gitignored) as:
 *        SUPABASE_DB_URL=postgresql://postgres:...@...supabase.com:5432/postgres
 *   3. npm run backup:db
 *
 * Output: db/backups/<timestamp>/
 *   <table>.json   every row, as JSON
 *   <table>.sql    INSERT statements for restoring
 *   manifest.json  row counts and the time it ran
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/**
 * Tables to snapshot, in restore order (parents before children).
 * `auth.users` is included because profiles/lessons/messages all reference
 * it — restoring rows without the users they point at would fail.
 */
const TABLES = [
  { schema: 'auth', name: 'users', orderBy: 'created_at' },
  { schema: 'public', name: 'profiles', orderBy: 'created_at' },
  { schema: 'public', name: 'lessons', orderBy: 'created_at' },
  { schema: 'public', name: 'messages', orderBy: 'created_at' },
  { schema: 'storage', name: 'objects', orderBy: 'created_at' },
];

async function loadDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  // Fall back to .env.local so the password never has to touch the shell.
  try {
    const raw = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/);
      if (match) return match[1].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // no .env.local — fall through to the error below
  }
  return null;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`;

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function toInsertStatements(table, columns, rows) {
  if (rows.length === 0) return `-- ${table}: no rows\n`;

  const colList = columns.map((c) => `"${c}"`).join(', ');
  const lines = rows.map((row) => {
    const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
    return `INSERT INTO ${table} (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`;
  });
  return `-- ${table}: ${rows.length} row(s)\n${lines.join('\n')}\n`;
}

async function main() {
  const connectionString = await loadDbUrl();
  if (!connectionString) {
    console.error(
      'Missing SUPABASE_DB_URL.\n\n' +
        'Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI,\n' +
        'replace [YOUR-PASSWORD] with your database password, then add to .env.local:\n\n' +
        '  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres\n',
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    // Supabase terminates TLS with a cert this client does not have pinned.
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'db', 'backups', stamp);
  await fs.mkdir(outDir, { recursive: true });

  await client.connect();
  console.log(`Connected. Writing to db/backups/${stamp}/\n`);

  const manifest = { takenAt: new Date().toISOString(), tables: {} };
  const combined = [
    '-- Data-only restore script.',
    '-- Apply the migrations in db/migrations/ first, then run this.',
    '-- Statements use ON CONFLICT DO NOTHING, so re-running is safe.',
    '',
    'BEGIN;',
    '',
  ];

  for (const { schema, name, orderBy } of TABLES) {
    const qualified = `${schema}.${name}`;
    try {
      const { rows, fields } = await client.query(
        `SELECT * FROM ${qualified} ORDER BY ${orderBy} NULLS LAST`,
      );
      const columns = fields.map((f) => f.name);

      await fs.writeFile(
        path.join(outDir, `${schema}.${name}.json`),
        JSON.stringify(rows, null, 2),
        'utf8',
      );

      const sql = toInsertStatements(qualified, columns, rows);
      await fs.writeFile(path.join(outDir, `${schema}.${name}.sql`), sql, 'utf8');
      combined.push(sql);

      manifest.tables[qualified] = rows.length;
      console.log(`  ${qualified.padEnd(20)} ${String(rows.length).padStart(5)} row(s)`);
    } catch (error) {
      manifest.tables[qualified] = `ERROR: ${error.message}`;
      console.warn(`  ${qualified.padEnd(20)} skipped — ${error.message}`);
    }
  }

  combined.push('', 'COMMIT;', '');
  await fs.writeFile(path.join(outDir, 'restore.sql'), combined.join('\n'), 'utf8');
  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  await client.end();
  console.log(`\nDone. Snapshot: db/backups/${stamp}/`);
  console.log('Restore with db/backups/<stamp>/restore.sql after applying migrations.');
}

main().catch((error) => {
  console.error('\nBackup failed:', error.message);

  // The direct host (db.<ref>.supabase.co) is IPv6-only on newer projects.
  // On a network without IPv6, getaddrinfo returns nothing at all.
  const directHost = /getaddrinfo ENOTFOUND (db\.([a-z0-9]+)\.supabase\.co)/i.exec(
    error.message ?? '',
  );
  if (directHost) {
    console.error(
      `\n${directHost[1]} has no IPv4 address, and this machine has no IPv6.\n` +
        'Use the Session pooler instead — Dashboard -> Project Settings ->\n' +
        'Database -> Connection string -> "Session pooler". It looks like:\n\n' +
        `  postgresql://postgres.${directHost[2]}:<password>` +
        '@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n' +
        'Note the username carries the project ref after a dot.\n',
    );
  }

  process.exit(1);
});
