/**
 * 数据库 2：生成记录存储。
 * 所有「写库」动作都走这里的函数，调用方 await 即可。
 */
const { generationsDb } = require('./db');

// 预编译语句（性能最优，防 SQL 注入）
const stmtInsert = generationsDb.prepare(`
  INSERT INTO generations (prompt, html, model, created_at)
  VALUES (?, ?, ?, ?)
`);

const stmtList = generationsDb.prepare(`
  SELECT id, prompt, model, created_at, length(html) AS html_size
  FROM generations
  ORDER BY created_at DESC
  LIMIT ?
`);

const stmtGet = generationsDb.prepare(`
  SELECT * FROM generations WHERE id = ?
`);

const stmtCount = generationsDb.prepare(`
  SELECT COUNT(*) AS total FROM generations
`);

/**
 * 记录一次 AI 生成。
 * @param {{ prompt: string, html: string, model: string, createdAt: string }} record
 * @returns {{ id: number }}
 */
function saveGeneration(record) {
  const info = stmtInsert.run(
    record.prompt,
    record.html,
    record.model,
    record.createdAt
  );
  console.log(`📝 [store] 已入库: prompt=「${record.prompt.slice(0, 40)}…」 html=${record.html.length}B → id=${info.lastInsertRowid}`);
  return { id: info.lastInsertRowid };
}

/**
 * 分页查询生成记录列表（不含 html 正文，仅元信息）。
 * @param {number} limit
 * @returns {Array}
 */
function listGenerations(limit = 20) {
  return stmtList.all(limit);
}

/**
 * 按 id 取一条完整记录（含 html）。
 * @param {number} id
 * @returns {object|undefined}
 */
function getGeneration(id) {
  return stmtGet.get(id);
}

// 预编译删除语句
const stmtDelete = generationsDb.prepare('DELETE FROM generations WHERE id = ?');

/**
 * 删除一条生成记录。
 * @param {number} id
 * @returns {boolean} 是否删除成功
 */
function deleteGeneration(id) {
  const info = stmtDelete.run(id);
  if (info.changes > 0) {
    console.log(`🗑 [store] 已删除记录 id=${id}`);
    return true;
  }
  return false;
}

/**
 * 生成总数。
 * @returns {number}
 */
function countGenerations() {
  return stmtCount.get().total;
}

module.exports = { saveGeneration, listGenerations, getGeneration, countGenerations, deleteGeneration };
