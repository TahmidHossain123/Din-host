const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('./config');

if (!fs.existsSync(config.DB_DIR)) {
  fs.mkdirSync(config.DB_DIR, { recursive: true });
}

const dbPath = path.join(config.DB_DIR, 'dinhost.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');

  // Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Websites Table with logo_url
  db.run(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subdomain TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      logo_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration: add column if upgrading from earlier db
  db.run(`ALTER TABLE sites ADD COLUMN logo_url TEXT DEFAULT ''`, () => {});
});

module.exports = db;
