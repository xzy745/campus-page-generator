/**
 * 数据库 1：用户认证（注册 / 登录）。
 * 密码用 SHA-256 哈希存储，不存明文。
 */
const crypto = require('crypto');
const { usersDb } = require('./db');

// 预编译语句
const stmtFind = usersDb.prepare('SELECT * FROM users WHERE username = ?');
const stmtInsert = usersDb.prepare('INSERT INTO users (username, password) VALUES (?, ?)');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * 注册新用户。
 * @returns {{ ok: boolean, error?: string }}
 */
function register(username, password) {
  if (!username || !password) return { ok: false, error: '用户名和密码不能为空' };
  if (username.length < 2) return { ok: false, error: '用户名至少 2 个字符' };
  if (password.length < 4) return { ok: false, error: '密码至少 4 位' };

  const existing = stmtFind.get(username);
  if (existing) return { ok: false, error: '该用户名已被注册' };

  stmtInsert.run(username, sha256(password));
  console.log(`👤 [auth] 新用户注册: ${username}`);
  return { ok: true };
}

/**
 * 登录校验。
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
function login(username, password) {
  if (!username || !password) return { ok: false, error: '用户名和密码不能为空' };

  const user = stmtFind.get(username);
  if (!user) return { ok: false, error: '用户名或密码错误' };

  if (user.password !== sha256(password)) {
    return { ok: false, error: '用户名或密码错误' };
  }

  console.log(`🔑 [auth] 用户登录: ${username}`);
  return {
    ok: true,
    user: { id: user.id, username: user.username, createdAt: user.created_at },
  };
}

module.exports = { register, login };
