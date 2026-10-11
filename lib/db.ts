import { createClient, type Client } from "@libsql/client";

// Local dev uses a SQLite file. In production point TURSO_DATABASE_URL (and
// TURSO_AUTH_TOKEN) at a hosted libSQL/Turso database.
const globalForDb = globalThis as unknown as {
  __db?: Client;
  __dbReady?: Promise<unknown>;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    played_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'live',
    target INTEGER NOT NULL DEFAULT 20,
    win_by INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    team TEXT NOT NULL CHECK (team IN ('A','B')),
    PRIMARY KEY (game_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    grp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS events_game ON events (game_id)`,
];

export async function getDb(): Promise<Client> {
  globalForDb.__db ??= createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const client = globalForDb.__db;
  globalForDb.__dbReady ??= client.batch(SCHEMA, "write");
  await globalForDb.__dbReady;
  return client;
}
