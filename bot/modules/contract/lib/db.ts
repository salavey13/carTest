import Database from 'better-sqlite3-multiple-ciphers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_DB_PATH = 'workspace/store/contracts.db';

let db: Database.Database | null = null;

function resolvedDbPath(): string {
  return path.resolve(process.env.CONTRACTS_DB_PATH ?? DEFAULT_DB_PATH);
}

/** chmod 600 на файл БД и его WAL/SHM-спутники (ПДн — ограничить доступ к файлу). */
function lockDownFiles(dbPath: string): void {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      if (fs.existsSync(f)) fs.chmodSync(f, 0o600);
    } catch {
      /* chmod может не поддерживаться (напр. некоторые FS) — не критично */
    }
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  const p = resolvedDbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  db = new Database(p);

  // ── Шифрование at-rest (152-ФЗ ст.19, паспортные данные) ──────────────────
  // Если задан CONTRACTS_DB_KEY — БД шифруется (SQLCipher через multiple-ciphers).
  // Ключ ДОЛЖЕН быть задан в проде (.env тенанта, chmod 600). Без ключа БД
  // открывается без шифрования — допустимо ТОЛЬКО для dev/тестов (мок).
  const key = process.env.CONTRACTS_DB_KEY;
  if (key) {
    // M2: ключ SQLCipher должен быть ASCII 0x20-0x7E (непечатаемые/Unicode = ошибка pragma).
    if (!/^[\x20-\x7E]*$/.test(key)) {
      throw new Error(
        'CONTRACTS_DB_KEY содержит недопустимые символы (только ASCII 0x20-0x7E)',
      );
    }
    db.pragma(`key='${key.replace(/'/g, "''")}'`);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CONTRACTS_DB_KEY не задан в production — БД с паспортными данными должна быть зашифрована (152-ФЗ).',
    );
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Авто-применение схемы (CREATE TABLE IF NOT EXISTS — безопасно повторять)
  const schemaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'db',
    'schema.sql',
  );
  db.exec(fs.readFileSync(schemaPath, 'utf8'));

  // M4: идемпотентный runner миграций (db/migrations/*.sql по имени файла)
  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'db',
    'migrations',
  );
  applyMigrations(db, migrationsDir);

  lockDownFiles(p);
  return db;
}

/** Идемпотентный runner миграций из db/migrations/*.sql. */
function applyMigrations(database: Database.Database, migrationsDir: string): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const already = database.prepare(
      `SELECT 1 FROM schema_migrations WHERE filename = ?`,
    ).get(file);
    if (already) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // SQLite ALTER TABLE ADD COLUMN не идемпотентен → ловим «duplicate column name»
    const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      try {
        database.exec(stmt);
      } catch (e) {
        const msg = String((e as Error).message ?? '');
        if (!msg.includes('duplicate column name') && !msg.includes('already exists')) {
          throw e;
        }
      }
    }
    database.prepare(`INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)`).run(file);
  }
}

/** SQLite — всегда доступна (путь задан или дефолтный). */
export function dbConfigured(): boolean {
  return true;
}
