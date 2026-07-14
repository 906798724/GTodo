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
