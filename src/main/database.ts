import initSqlJs from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export type TaskStatus = 'todo' | 'wip' | 'waited' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  parent_id: number | null;
  expected_date: string | null;
  created_at: string;
  completed_at: string | null;
}

// =====================================================
// 每日总结（Summary）模型
// =====================================================
export interface Summary {
  date: string;        // YYYY-MM-DD（本地日期，作为主键）
  content: string;     // 总结内容
  updated_at: string;  // 更新时间戳
}

// =====================================================
// OKR 模型
// =====================================================
export interface Objective {
  id: number;
  title: string;
  description: string;
  quarter: string;        // 例如 "2026-Q3"
  progress: number;       // 0-100（由关联 KR 自动汇总，允许手动覆盖）
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  progress: number;       // 0-100
  sort_order: number;
  created_at: string;
  updated_at: string;
}

let db: any = null;

// 解析 wasm 文件路径，兼容开发模式和生产模式
function resolveWasmPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    // 开发模式：从源码 node_modules 加载
    return path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  // 生产模式：asarUnpack 会将 wasm 拷贝到 resources 目录
  return path.join(process.resourcesPath, 'sql-wasm.wasm');
}

// 数据库文件存放在用户数据目录（卸载重装不会丢失）
function getDbPath(): string {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'gtodo.db');
}

// =====================================================
// 数据库 Schema 版本管理
// =====================================================
// 每次数据库结构变更时：
//   1. 增加 SCHEMA_VERSION
//   2. 在 MIGRATIONS 数组中添加对应的迁移函数
// 旧的数据库会在启动时自动应用所有未执行的迁移
const SCHEMA_VERSION = 3;

interface Migration {
  fromVersion: number;
  toVersion: number;
  up: (db: any) => void;
}

const MIGRATIONS: Migration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    up: (db) => {
      // 新增每日总结表：date 为本地日期（YYYY-MM-DD）作为主键
      db.run(`
        CREATE TABLE IF NOT EXISTS summaries (
          date TEXT PRIMARY KEY,
          content TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    fromVersion: 2,
    toVersion: 3,
    up: (db) => {
      // 新增 OKR 表：objectives 与 key_results
      db.run(`
        CREATE TABLE IF NOT EXISTS objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          quarter TEXT NOT NULL DEFAULT '',
          progress INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS key_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objective_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          progress INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
        )
      `);
    },
  },
];

// 获取当前数据库版本（通过 PRAGMA user_version）
function getCurrentVersion(db: any): number {
  try {
    const result = db.exec('PRAGMA user_version');
    if (result.length === 0 || result[0].values.length === 0) {
      return 0;
    }
    return result[0].values[0][0] as number;
  } catch (err) {
    return 0;
  }
}

// 设置数据库版本
function setCurrentVersion(db: any, version: number): void {
  db.run(`PRAGMA user_version = ${version}`);
}

// 执行所有待执行的迁移
function runMigrations(db: any): void {
  const currentVersion = getCurrentVersion(db);
  console.log(`[Database] Current schema version: ${currentVersion}, target: ${SCHEMA_VERSION}`);

  if (currentVersion >= SCHEMA_VERSION) {
    return; // 已经是最新版本
  }

  // 按顺序执行迁移
  for (const migration of MIGRATIONS) {
    if (migration.fromVersion >= currentVersion && migration.toVersion <= SCHEMA_VERSION) {
      try {
        console.log(`[Database] Running migration ${migration.fromVersion} -> ${migration.toVersion}`);
        migration.up(db);
        setCurrentVersion(db, migration.toVersion);
      } catch (err) {
        console.error(`[Database] Migration failed: ${migration.fromVersion} -> ${migration.toVersion}`, err);
        throw err;
      }
    }
  }

  // 如果是全新数据库，直接设置版本
  if (currentVersion === 0) {
    setCurrentVersion(db, SCHEMA_VERSION);
  }
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => resolveWasmPath(),
  });

  const dbPath = getDbPath();

  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(data));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'wip', 'waited', 'done')),
      parent_id INTEGER NULL,
      expected_date TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT NULL,
      FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS summaries (
      date TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      quarter TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS key_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objective_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    )
  `);

  // 应用数据库迁移
  runMigrations(db);

  saveDatabase();
}

function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const dbPath = getDbPath();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

export async function getTasks(): Promise<Task[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec('SELECT * FROM tasks ORDER BY created_at DESC');
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map((row: any[]) => {
    const task: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      task[col as keyof Task] = row[index] ?? null;
    });
    return task as Task;
  });
}

// 生成本地时间戳（YYYY-MM-DD HH:MM:SS），避免 UTC 时区问题
function getLocalTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 解析本地时间字符串为 Date 对象
function parseLocalTimestamp(timestamp: string): Date {
  // SQLite CURRENT_TIMESTAMP 格式为 'YYYY-MM-DD HH:MM:SS'，当作本地时间解析
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  return new Date(normalized);
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'completed_at'>): Promise<Task> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const { title, description, status, parent_id, expected_date } = task;
  // 使用本地时间戳而非 UTC 的 CURRENT_TIMESTAMP
  const createdAt = getLocalTimestamp();
  db.run(
    'INSERT INTO tasks (title, description, status, parent_id, expected_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description || '', status || 'todo', parent_id || null, expected_date || null, createdAt]
  );
  const result = db.exec('SELECT * FROM tasks ORDER BY id DESC LIMIT 1');
  const columns = result[0].columns;
  const values = result[0].values[0];
  const newTask: Partial<Task> = {};
  columns.forEach((col: string, index: number) => {
    newTask[col as keyof Task] = values[index] ?? null;
  });
  saveDatabase();
  return newTask as Task;
}

export async function updateTask(task: Partial<Task> & { id: number }): Promise<Task> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const { id, title, description, status, parent_id, expected_date, completed_at } = task;

  // 动态构建 UPDATE 语句，只更新提供的字段（避免 undefined 导致的 sql.js 错误）
  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (parent_id !== undefined) {
    updates.push('parent_id = ?');
    params.push(parent_id);
  }
  if (expected_date !== undefined) {
    updates.push('expected_date = ?');
    params.push(expected_date);
  }
  if (completed_at !== undefined) {
    updates.push('completed_at = ?');
    params.push(completed_at);
  }

  if (updates.length > 0) {
    params.push(id);
    db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const result = db.exec('SELECT * FROM tasks WHERE id = ?', [id]);
  if (result.length === 0) {
    throw new Error('Task not found');
  }
  const columns = result[0].columns;
  const values = result[0].values[0];
  const updatedTask: Partial<Task> = {};
  columns.forEach((col: string, index: number) => {
    updatedTask[col as keyof Task] = values[index] ?? null;
  });
  saveDatabase();
  return updatedTask as Task;
}

export async function deleteTask(id: number): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.run('DELETE FROM tasks WHERE id = ?', [id]);
  saveDatabase();
}

// =====================================================
// 每日总结 CRUD
// =====================================================

/** 获取单日总结 */
export async function getSummary(date: string): Promise<Summary | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec('SELECT date, content, updated_at FROM summaries WHERE date = ?', [date]);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  const row = result[0].values[0];
  return { date: row[0] as string, content: row[1] as string, updated_at: row[2] as string };
}

/** 获取某月所有有总结的日期（含摘要预览） */
export async function getMonthSummaries(year: number, month: number): Promise<Summary[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const result = db.exec(
    'SELECT date, content, updated_at FROM summaries WHERE date LIKE ? ORDER BY date DESC',
    [prefix + '%']
  );
  if (result.length === 0) {
    return [];
  }
  return result[0].values.map((row: any[]) => ({
    date: row[0] as string,
    content: row[1] as string,
    updated_at: row[2] as string,
  }));
}

/** 新增或更新某日总结 */
export async function upsertSummary(date: string, content: string): Promise<Summary> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const updatedAt = getLocalTimestamp();
  db.run(
    `INSERT INTO summaries (date, content, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [date, content, updatedAt]
  );
  saveDatabase();
  const result = await getSummary(date);
  return result as Summary;
}

/** 删除某日总结 */
export async function deleteSummary(date: string): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.run('DELETE FROM summaries WHERE date = ?', [date]);
  saveDatabase();
}

// =====================================================
// OKR CRUD
// =====================================================

/** 获取所有 Objective（按 sort_order + id 升序） */
export async function getObjectives(): Promise<Objective[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec('SELECT * FROM objectives ORDER BY sort_order ASC, id ASC');
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => mapRow<Objective>(cols, row));
}

/** 获取单个 Objective */
export async function getObjective(id: number): Promise<Objective | null> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec('SELECT * FROM objectives WHERE id = ?', [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return mapRow<Objective>(result[0].columns, result[0].values[0]);
}

/** 新增 Objective */
export async function createObjective(o: Omit<Objective, 'id' | 'created_at' | 'updated_at'>): Promise<Objective> {
  if (!db) throw new Error('Database not initialized');
  const now = getLocalTimestamp();
  db.run(
    `INSERT INTO objectives (title, description, quarter, progress, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [o.title, o.description || '', o.quarter || '', o.progress || 0, o.sort_order || 0, now, now]
  );
  const result = db.exec('SELECT * FROM objectives ORDER BY id DESC LIMIT 1');
  saveDatabase();
  return mapRow<Objective>(result[0].columns, result[0].values[0]);
}

/** 更新 Objective */
export async function updateObjective(o: Partial<Objective> & { id: number }): Promise<Objective> {
  if (!db) throw new Error('Database not initialized');
  const now = getLocalTimestamp();
  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];
  if (o.title !== undefined) { updates.push('title = ?'); params.push(o.title); }
  if (o.description !== undefined) { updates.push('description = ?'); params.push(o.description); }
  if (o.quarter !== undefined) { updates.push('quarter = ?'); params.push(o.quarter); }
  if (o.progress !== undefined) { updates.push('progress = ?'); params.push(o.progress); }
  if (o.sort_order !== undefined) { updates.push('sort_order = ?'); params.push(o.sort_order); }
  params.push(o.id);
  db.run(`UPDATE objectives SET ${updates.join(', ')} WHERE id = ?`, params);
  saveDatabase();
  const updated = await getObjective(o.id);
  if (!updated) throw new Error('Objective not found');
  return updated;
}

/** 删除 Objective（级联删除其 KR） */
export async function deleteObjective(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  db.run('DELETE FROM objectives WHERE id = ?', [id]);
  saveDatabase();
}

/** 获取某 Objective 的所有 KR */
export async function getKeyResults(objectiveId: number): Promise<KeyResult[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(
    'SELECT * FROM key_results WHERE objective_id = ? ORDER BY sort_order ASC, id ASC',
    [objectiveId]
  );
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => mapRow<KeyResult>(cols, row));
}

/** 获取所有 KR（按 objective_id 分组） */
export async function getAllKeyResults(): Promise<Record<number, KeyResult[]>> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec('SELECT * FROM key_results ORDER BY objective_id, sort_order ASC, id ASC');
  if (result.length === 0) return {};
  const cols = result[0].columns;
  const map: Record<number, KeyResult[]> = {};
  for (const row of result[0].values) {
    const kr = mapRow<KeyResult>(cols, row);
    if (!map[kr.objective_id]) map[kr.objective_id] = [];
    map[kr.objective_id].push(kr);
  }
  return map;
}

/** 新增 KR */
export async function createKeyResult(kr: Omit<KeyResult, 'id' | 'created_at' | 'updated_at'>): Promise<KeyResult> {
  if (!db) throw new Error('Database not initialized');
  const now = getLocalTimestamp();
  db.run(
    `INSERT INTO key_results (objective_id, title, progress, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [kr.objective_id, kr.title, kr.progress || 0, kr.sort_order || 0, now, now]
  );
  const result = db.exec('SELECT * FROM key_results ORDER BY id DESC LIMIT 1');
  saveDatabase();
  return mapRow<KeyResult>(result[0].columns, result[0].values[0]);
}

/** 更新 KR */
export async function updateKeyResult(kr: Partial<KeyResult> & { id: number }): Promise<KeyResult> {
  if (!db) throw new Error('Database not initialized');
  const now = getLocalTimestamp();
  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];
  if (kr.title !== undefined) { updates.push('title = ?'); params.push(kr.title); }
  if (kr.progress !== undefined) { updates.push('progress = ?'); params.push(kr.progress); }
  if (kr.sort_order !== undefined) { updates.push('sort_order = ?'); params.push(kr.sort_order); }
  params.push(kr.id);
  db.run(`UPDATE key_results SET ${updates.join(', ')} WHERE id = ?`, params);
  saveDatabase();
  const result = db.exec('SELECT * FROM key_results WHERE id = ?', [kr.id]);
  if (result.length === 0) throw new Error('KeyResult not found');
  return mapRow<KeyResult>(result[0].columns, result[0].values[0]);
}

/** 删除 KR */
export async function deleteKeyResult(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  db.run('DELETE FROM key_results WHERE id = ?', [id]);
  saveDatabase();
}

/** 行映射工具 */
function mapRow<T>(cols: string[], row: any[]): T {
  const obj: any = {};
  cols.forEach((c, i) => { obj[c] = row[i] ?? null; });
  return obj as T;
}
