import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

export function createDatabase(filename = ':memory:'): SqliteDatabase {
  const database = new Database(filename);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  initializeSchema(database);
  return database;
}

function initializeSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      corpus TEXT NOT NULL CHECK (corpus IN ('user', 'evaluation')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
      provenance TEXT NOT NULL CHECK (provenance IN ('human-authored', 'imported')),
      source_reference TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_items_fts USING fts5(
      item_id UNINDEXED,
      corpus UNINDEXED,
      revision UNINDEXED,
      title,
      content,
      tokenize = 'unicode61'
    );
  `);
}

export function closeDatabase(database: SqliteDatabase): void {
  database.close();
}
