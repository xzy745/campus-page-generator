/**
 * 数据库层：统一管理两个 SQLite 数据库的连接与初始化。
 *
 * 数据库 1 — data/users.db       用户登录信息
 * 数据库 2 — data/generations.db   AI 生成记录
 */
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');

// 确保 data 目录存在
require('fs').mkdirSync(DATA_DIR, { recursive: true });

// ─── 数据库 1：用户 ──────────────────────────────────
const usersDb = new Database(path.join(DATA_DIR, 'users.db'));
usersDb.pragma('journal_mode = WAL');
usersDb.pragma('foreign_keys = ON');

usersDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,   -- SHA-256 哈希
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// ─── 数据库 2：生成记录 ──────────────────────────────
const generationsDb = new Database(path.join(DATA_DIR, 'generations.db'));
generationsDb.pragma('journal_mode = WAL');
generationsDb.pragma('foreign_keys = ON');

generationsDb.exec(`
  CREATE TABLE IF NOT EXISTS generations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt     TEXT    NOT NULL,
    html       TEXT    NOT NULL,
    model      TEXT    NOT NULL DEFAULT 'deepseek-chat',
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = { usersDb, generationsDb };
