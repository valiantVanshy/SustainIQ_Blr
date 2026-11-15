// SustainIQ Bengaluru | Author: Vanshika Sharma
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openDatabase(filename) {
  const path = resolve(filename);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      wardId TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted'
        CHECK (status IN ('Submitted', 'In review', 'In progress', 'Resolved')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reports_created ON reports(createdAt DESC);
    CREATE TABLE IF NOT EXISTS report_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      reportId TEXT NOT NULL REFERENCES reports(id),
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  return db;
}
