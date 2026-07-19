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
  extends_task_id: number | null; // 扩展自哪个任务（仅做单向引用，不在原任务中回显）
  expected_date: string | null;
  created_at: string;
  completed_at: string | null;
  archived_at: string | null; // 归档时间（点击「总结」后由 Done 列移入雁过留痕）
  tags?: Tag[]; // 关联标签（可选字段，查询时填充）
}

// =====================================================
// 标签（Tag）模型
// =====================================================
export interface Tag {
  id: number;
  name: string;
  color: string;
  is_preset: number; // 1=预置，0=用户自定义
  sort_order: number;
  created_at: string;
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
const SCHEMA_VERSION = 13;

interface Migration {
  fromVersion: number;
  toVersion: number;
  description?: string;
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
  {
    fromVersion: 3,
    toVersion: 4,
    up: (db) => {
      // 新增标签系统：tags 表 + task_tags 关联表
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#4a4339',
          is_preset INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS task_tags (
          task_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (task_id, tag_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id)`);

      // 预置 3 个标签：攻城略地 / 鼎力相助 / 借力打力
      const presets = [
        { name: '攻城略地', color: '#ef4444', sort: 1 },
        { name: '鼎力相助', color: '#3b82f6', sort: 2 },
        { name: '借力打力', color: '#059669', sort: 3 },
      ];
      const now = getLocalTimestamp();
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO tags (name, color, is_preset, sort_order, created_at) VALUES (?, ?, 1, ?, ?)'
      );
      for (const t of presets) {
        stmt.run([t.name, t.color, t.sort, now]);
      }
      stmt.free();
    },
  },
  {
    fromVersion: 4,
    toVersion: 5,
    up: (db) => {
      // 新增 extends_task_id 字段：用于「扩展任务」单向引用
      // 注意：不加外键约束，避免删原任务时级联误删（业务上保留历史记录更安全）
      // 检查列是否存在，避免对 fresh DB（CREATE TABLE 已包含）做重复 ADD
      const info = db.exec(`PRAGMA table_info(tasks)`);
      const columns = info.length > 0 ? info[0].values.map((row: any[]) => row[1]) : [];
      if (!columns.includes('extends_task_id')) {
        db.run(`ALTER TABLE tasks ADD COLUMN extends_task_id INTEGER NULL`);
      }
      db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_extends ON tasks(extends_task_id)`);
    },
  },
  {
    fromVersion: 5,
    toVersion: 6,
    up: (db) => {
      // 新增 archived_at：点击「总结」后归档 Done 列任务到「雁过留痕」
      const info = db.exec(`PRAGMA table_info(tasks)`);
      const columns = info.length > 0 ? info[0].values.map((row: any[]) => row[1]) : [];
      if (!columns.includes('archived_at')) {
        db.run(`ALTER TABLE tasks ADD COLUMN archived_at TEXT NULL`);
      }
      db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived_at)`);
    },
  },
  {
    fromVersion: 6,
    toVersion: 7,
    up: (db) => {
      // 新增专项表：specials 与 task_specials 关联表
      db.run(`
        CREATE TABLE IF NOT EXISTS specials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          color TEXT DEFAULT '#4a4339',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS task_specials (
          task_id INTEGER NOT NULL,
          special_id INTEGER NOT NULL,
          PRIMARY KEY (task_id, special_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_task_specials_special ON task_specials(special_id)`);
    },
  },
  {
    fromVersion: 7,
    toVersion: 8,
    up: (db) => {
      // 新增长期任务的 DDL（截止日期）字段
      const info = db.exec(`PRAGMA table_info(specials)`);
      const columns = info.length > 0 ? info[0].values.map((row: any[]) => row[1]) : [];
      if (!columns.includes('due_date')) {
        db.run(`ALTER TABLE specials ADD COLUMN due_date TEXT NULL`);
      }
    },
  },
  {
    fromVersion: 8,
    toVersion: 9,
    up: (db) => {
      // 新增里程碑表：milestones（属于某个 long-term task / special）
      db.run(`
        CREATE TABLE IF NOT EXISTS milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          special_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          due_date TEXT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_milestones_special ON milestones(special_id)`);
    },
  },
  {
    fromVersion: 9,
    toVersion: 10,
    up: (db) => {
      // GTD 功能：新增 someday 状态和 is_two_minutes 字段
      const info = db.exec(`PRAGMA table_info(tasks)`);
      const columns = info.length > 0 ? info[0].values.map((row: any[]) => row[1]) : [];

      if (!columns.includes('is_two_minutes')) {
        db.run(`ALTER TABLE tasks ADD COLUMN is_two_minutes INTEGER NOT NULL DEFAULT 0`);
      }
    },
  },
  {
    fromVersion: 10,
    toVersion: 11,
    up: (db) => {
      // 移除 is_two_minutes 字段（特性已下线）
      // SQLite 不支持直接 DROP COLUMN，旧表需重建
      const tasksInfo = db.exec(`PRAGMA table_info(tasks)`);
      const columns = tasksInfo.length > 0 ? tasksInfo[0].values.map((row: any[]) => row[1]) : [];

      if (columns.includes('is_two_minutes')) {
        db.run(`
          CREATE TABLE tasks_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'wip', 'waited', 'done')),
            parent_id INTEGER,
            extends_task_id INTEGER,
            expected_date TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            archived_at TEXT
          )
        `);
        db.run(`
          INSERT INTO tasks_new (id, title, description, status, parent_id, extends_task_id, expected_date, created_at, completed_at, archived_at)
          SELECT id, title, description,
            CASE WHEN status = 'someday' THEN 'todo' ELSE status END,
            parent_id, extends_task_id, expected_date, created_at, completed_at, archived_at
          FROM tasks
        `);
        db.run(`DROP TABLE tasks`);
        db.run(`ALTER TABLE tasks_new RENAME TO tasks`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived_at)`);
      }
    },
  },
  {
    fromVersion: 11,
    toVersion: 12,
    description: '创建 task_objectives 和 task_key_results 关联表，支持任务关联有的放矢（OKR）',
    up: (db: any) => {
      // 任务 ↔ Objective（万里长征之目标）多对多关联表
      db.run(`
        CREATE TABLE IF NOT EXISTS task_objectives (
          task_id INTEGER NOT NULL,
          objective_id INTEGER NOT NULL,
          PRIMARY KEY (task_id, objective_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_task_objectives_objective ON task_objectives(objective_id)`);

      // 任务 ↔ Key Result（万里长征之关键结果）多对多关联表
      db.run(`
        CREATE TABLE IF NOT EXISTS task_key_results (
          task_id INTEGER NOT NULL,
          key_result_id INTEGER NOT NULL,
          PRIMARY KEY (task_id, key_result_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (key_result_id) REFERENCES key_results(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_task_key_results_kr ON task_key_results(key_result_id)`);
    },
  },
  {
    fromVersion: 12,
    toVersion: 13,
    description: '「标签」系统不再区分预置/自定义：把原有预置标签标记为普通标签，允许自由编辑/删除',
    up: (db: any) => {
      // 把所有 is_preset=1 的历史预置标签（攻城略地、鼎力相助、借力打力）改为 0
      db.run(`UPDATE tags SET is_preset = 0 WHERE is_preset = 1`);
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

  // 链式执行迁移：从 currentVersion 升到 SCHEMA_VERSION，
  // 每一步严格匹配 fromVersion === currentVersion（已升级后 currentVersion 递增）
  while (getCurrentVersion(db) < SCHEMA_VERSION) {
    const nextVersion = getCurrentVersion(db);
    const migration = MIGRATIONS.find((m) => m.fromVersion === nextVersion);
    if (!migration) {
      console.error(`[Database] No migration found for version ${nextVersion}, aborting at version ${nextVersion}`);
      throw new Error(`Missing migration for schema version ${nextVersion}`);
    }
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
      extends_task_id INTEGER NULL,
      expected_date TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT NULL,
      archived_at TEXT NULL,
      FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // 注：idx_tasks_extends 索引在迁移后创建（fresh DB 也会被下面的 migration 路径覆盖到）
  // 但因为 fresh DB 时 migrations 不一定会走 4→5（在 fromVersion=0 情况下会被跳过），
  // 这里也用 PRAGMA 守护：仅当列存在时才建索引
  const initInfo = db.exec(`PRAGMA table_info(tasks)`);
  const initColumns = initInfo.length > 0 ? initInfo[0].values.map((row: any[]) => row[1]) : [];
  if (initColumns.includes('extends_task_id')) {
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_extends ON tasks(extends_task_id)`);
  }

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

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#4a4339',
      is_preset INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS specials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#4a4339',
      due_date TEXT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_specials (
      task_id INTEGER NOT NULL,
      special_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, special_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_task_specials_special ON task_specials(special_id)`);

  // OKR 关联表（v12）
  db.run(`
    CREATE TABLE IF NOT EXISTS task_objectives (
      task_id INTEGER NOT NULL,
      objective_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, objective_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_objectives_objective ON task_objectives(objective_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_key_results (
      task_id INTEGER NOT NULL,
      key_result_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, key_result_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (key_result_id) REFERENCES key_results(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_key_results_kr ON task_key_results(key_result_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      special_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_date TEXT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_milestones_special ON milestones(special_id)`);

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
  // 已归档（archived_at IS NOT NULL）的任务从主面板排除，仅在「雁过留痕」日历中按日期查看
  const result = db.exec(
    'SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY created_at DESC'
  );
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  const tasks: Task[] = values.map((row: any[]) => {
    const task: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      task[col as keyof Task] = row[index] ?? null;
    });
    return task as Task;
  });

  // 一次性查出所有 task_tag 关联，再按 task_id 分组
  const relResult = db.exec(`
    SELECT tt.task_id, t.id, t.name, t.color, t.is_preset, t.sort_order, t.created_at
    FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
  `);
  const tagsByTask = new Map<number, Tag[]>();
  if (relResult.length > 0) {
    for (const row of relResult[0].values) {
      const taskId = row[0] as number;
      const tag: Tag = {
        id: row[1] as number,
        name: row[2] as string,
        color: row[3] as string,
        is_preset: row[4] as number,
        sort_order: row[5] as number,
        created_at: row[6] as string,
      };
      if (!tagsByTask.has(taskId)) tagsByTask.set(taskId, []);
      tagsByTask.get(taskId)!.push(tag);
    }
  }
  for (const t of tasks) {
    t.tags = tagsByTask.get(t.id) || [];
  }
  return tasks;
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
  const { title, description, status, parent_id, extends_task_id, expected_date } = task;
  const createdAt = getLocalTimestamp();
  db.run(
    'INSERT INTO tasks (title, description, status, parent_id, extends_task_id, expected_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, description || '', status || 'todo', parent_id || null, extends_task_id || null, expected_date || null, createdAt]
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
  const { id, title, description, status, parent_id, extends_task_id, expected_date, completed_at } = task;

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
  if (extends_task_id !== undefined) {
    updates.push('extends_task_id = ?');
    params.push(extends_task_id);
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

/**
 * 归档 Done 列任务
 * - 把指定日期「完成」且尚未归档的任务标记为已归档
 * - 这样 Done 列在查询时自然就不再显示（已归档不参与 status='done' 展示）
 * @param date YYYY-MM-DD
 * @returns 归档的任务数量
 */
export async function archiveDoneTasksForDate(date: string): Promise<number> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  // 「雁过留痕」按任务实际完成日期（completed_at 本地日期）展示，
  // 因此 archived_at 存为完成日期对应时间戳（00:00:00），以便 LIKE 'YYYY-MM-DD%' 正确分组
  const targetLocalDate = date;
  const archiveTimestamp = `${date} 00:00:00`;

  const candidates = db.exec(
    `SELECT id, completed_at FROM tasks
     WHERE status = 'done'
       AND completed_at IS NOT NULL
       AND archived_at IS NULL`
  );
  if (candidates.length === 0) {
    return 0;
  }

  const matchIds: number[] = [];
  for (const row of candidates[0].values) {
    const id = row[0] as number;
    const completedAt = row[1] as string;
    // 解析 completed_at 为本地 Date 对象：
    //  - 'YYYY-MM-DD HH:MM:SS'（无 T，无 Z）：视为本地时间，用 new Date() 直接解析
    //  - 'YYYY-MM-DDTHH:MM:SS[.sss]Z'（ISO 含 Z）：是 UTC 时间，new Date() 解析后需换算本地日期
    let localDate: string;
    try {
      let tsMs: number;
      if (completedAt.includes('T') && (completedAt.endsWith('Z') || completedAt.includes('+') || /\-\d{2}:\d{2}$/.test(completedAt))) {
        // ISO 字符串（带时区信息）
        tsMs = new Date(completedAt).getTime();
      } else if (completedAt.includes('T')) {
        // ISO 但无时区（极少出现），按本地处理
        tsMs = new Date(completedAt).getTime();
      } else {
        // 本地时间戳：'YYYY-MM-DD HH:MM:SS'，将空格替换为 T 后按本地解析
        tsMs = new Date(completedAt.replace(' ', 'T')).getTime();
      }
      if (isNaN(tsMs)) continue;
      const d = new Date(tsMs);
      // 提取本地日期 YYYY-MM-DD
      localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      continue;
    }
    if (localDate === targetLocalDate) {
      matchIds.push(id);
    }
  }

  if (matchIds.length === 0) {
    return 0;
  }

  const placeholders = matchIds.map(() => '?').join(',');
  db.run(
    `UPDATE tasks SET archived_at = ? WHERE id IN (${placeholders})`,
    [archiveTimestamp, ...matchIds]
  );
  saveDatabase();
  return matchIds.length;
}

/**
 * 查询指定日期归档的任务列表（按归档时间倒序）
 * - 用于「雁过留痕」点击日期时显示当日归档 task
 */
export async function getTasksByArchiveDate(date: string): Promise<Task[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec(
    `SELECT * FROM tasks WHERE archived_at LIKE ? ORDER BY archived_at DESC, id DESC`,
    [`${date}%`]
  );
  if (result.length === 0) return [];
  const columns = result[0].columns;
  const tasks: Task[] = result[0].values.map((values: any[]) => {
    const obj: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Task] = values[index] ?? null;
    });
    return obj as Task;
  });

  // 关联标签
  const tagsResult = db.exec(`
    SELECT tt.task_id, t.id, t.name, t.color, t.is_preset, t.sort_order, t.created_at
    FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
  `);
  const tagMap = new Map<number, Tag[]>();
  if (tagsResult.length > 0) {
    for (const row of tagsResult[0].values) {
      const taskId = row[0] as number;
      const tag: Tag = {
        id: row[1],
        name: row[2],
        color: row[3],
        is_preset: row[4],
        sort_order: row[5],
        created_at: row[6],
      };
      if (!tagMap.has(taskId)) tagMap.set(taskId, []);
      tagMap.get(taskId)!.push(tag);
    }
  }
  tasks.forEach((t) => {
    t.tags = tagMap.get(t.id) || [];
  });
  return tasks;
}

/**
 * 获取某月每天归档任务数（用于月历视图）
 * - 返回 Record<本地日期 YYYY-MM-DD, 任务数>
 * - archived_at 可能是本地时间戳 'YYYY-MM-DD HH:MM:SS' 或 ISO 'YYYY-MM-DDTHH:MM:SSZ'
 * - 用 WHERE 区间拿到候选，再用 JS 把 archived_at 转本地日期分组计数
 */
export async function getMonthArchivedTaskCount(
  year: number,
  month: number
): Promise<Record<string, number>> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  // 用月份首尾的 ISO 区间拉候选（覆盖范围足够宽，避免边界遗漏）
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();

  const result = db.exec(
    `SELECT archived_at FROM tasks
     WHERE archived_at IS NOT NULL
       AND archived_at <> ''`
  );
  if (result.length === 0) return {};

  const counts: Record<string, number> = {};
  for (const row of result[0].values) {
    const archivedAt = row[0] as string;
    if (!archivedAt) continue;
    // 解析 archived_at 为本地 Date，提取本地日期 YYYY-MM-DD
    let ts: number;
    try {
      if (archivedAt.includes('T')) {
        ts = new Date(archivedAt).getTime();
      } else {
        // 本地时间戳 'YYYY-MM-DD HH:MM:SS'，把空格替换为 T 当作本地时间解析
        ts = new Date(archivedAt.replace(' ', 'T')).getTime();
      }
      if (isNaN(ts)) continue;
    } catch {
      continue;
    }
    // 仅统计本月内的归档
    if (ts < monthStart || ts >= monthEnd) continue;
    const d = new Date(ts);
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    counts[localDate] = (counts[localDate] || 0) + 1;
  }
  return counts;
}

// =====================================================
// 专项 CRUD
// =====================================================

interface Special {
  id: number;
  title: string;
  description: string;
  color: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getSpecials(): Promise<Special[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec('SELECT * FROM specials ORDER BY sort_order ASC, id ASC');
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((values: any[]) => {
    const obj: Partial<Special> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Special] = values[index] ?? null;
    });
    return obj as Special;
  });
}

export async function getSpecial(id: number): Promise<Special | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec('SELECT * FROM specials WHERE id = ?', [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const columns = result[0].columns;
  const values = result[0].values[0];
  const obj: Partial<Special> = {};
  columns.forEach((col: string, index: number) => {
    obj[col as keyof Special] = values[index] ?? null;
  });
  return obj as Special;
}

export async function createSpecial(data: {
  title: string;
  description?: string;
  color?: string;
  due_date?: string | null;
}): Promise<Special> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const now = getLocalTimestamp();
  const result = db.run(
    'INSERT INTO specials (title, description, color, due_date, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    [data.title, data.description || '', data.color || '#4a4339', data.due_date || null, now, now]
  );
  const id = result.lastInsertRowid as number;
  return {
    id,
    title: data.title,
    description: data.description || '',
    color: data.color || '#4a4339',
    due_date: data.due_date || null,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function updateSpecial(
  id: number,
  data: { title?: string; description?: string; color?: string; due_date?: string | null }
): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const now = getLocalTimestamp();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }
  if (data.due_date !== undefined) {
    updates.push('due_date = ?');
    params.push(data.due_date);
  }
  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.run(`UPDATE specials SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteSpecial(id: number): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.run('DELETE FROM specials WHERE id = ?', [id]);
}

export async function getTasksBySpecial(specialId: number): Promise<Task[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec(
    `SELECT t.* FROM tasks t JOIN task_specials ts ON t.id = ts.task_id WHERE ts.special_id = ? AND t.archived_at IS NULL ORDER BY t.created_at DESC`,
    [specialId]
  );
  if (result.length === 0) return [];
  const columns = result[0].columns;
  const tasks: Task[] = result[0].values.map((values: any[]) => {
    const obj: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Task] = values[index] ?? null;
    });
    return obj as Task;
  });

  const tagMap = new Map<number, Tag[]>();
  const tagsResult = db.exec(`
    SELECT tt.task_id, t.id, t.name, t.color, t.is_preset, t.sort_order, t.created_at
    FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
    WHERE tt.task_id IN (SELECT task_id FROM task_specials WHERE special_id = ?)
  `, [specialId]);
  if (tagsResult.length > 0) {
    for (const row of tagsResult[0].values) {
      const taskId = row[0] as number;
      const tag: Tag = {
        id: row[1],
        name: row[2],
        color: row[3],
        is_preset: row[4],
        sort_order: row[5],
        created_at: row[6],
      };
      if (!tagMap.has(taskId)) tagMap.set(taskId, []);
      tagMap.get(taskId)!.push(tag);
    }
  }
  tasks.forEach((t) => {
    t.tags = tagMap.get(t.id) || [];
  });
  return tasks;
}

export async function setTaskSpecials(taskId: number, specialIds: number[]): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.run('DELETE FROM task_specials WHERE task_id = ?', [taskId]);
  if (specialIds.length > 0) {
    const placeholders = specialIds.map(() => '(?, ?)').join(', ');
    const params: number[] = [];
    for (const sid of specialIds) {
      params.push(taskId, sid);
    }
    db.run(`INSERT INTO task_specials (task_id, special_id) VALUES ${placeholders}`, params);
  }
}

// =====================================================
// 有的放矢（OKR）任务关联
// =====================================================

/** 获取任务关联的所有万里长征 ID */
export async function getTaskSpecialIds(taskId: number): Promise<number[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(`SELECT special_id FROM task_specials WHERE task_id = ?`, [taskId]);
  if (result.length === 0) return [];
  return result[0].values.map((row: any[]) => row[0] as number);
}

/** 获取任务关联的所有 Objective ID */
export async function getTaskObjectiveIds(taskId: number): Promise<number[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(`SELECT objective_id FROM task_objectives WHERE task_id = ?`, [taskId]);
  if (result.length === 0) return [];
  return result[0].values.map((row: any[]) => row[0] as number);
}

/** 获取任务关联的所有 Key Result ID */
export async function getTaskKeyResultIds(taskId: number): Promise<number[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(`SELECT key_result_id FROM task_key_results WHERE task_id = ?`, [taskId]);
  if (result.length === 0) return [];
  return result[0].values.map((row: any[]) => row[0] as number);
}

/** 设置任务关联的 Objective（覆盖式写入），同时返回变化的事务函数 */
export async function setTaskObjectives(taskId: number, objectiveIds: number[]): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  db.run('DELETE FROM task_objectives WHERE task_id = ?', [taskId]);
  if (objectiveIds.length > 0) {
    const placeholders = objectiveIds.map(() => '(?, ?)').join(', ');
    const params: number[] = [];
    for (const oid of objectiveIds) params.push(taskId, oid);
    db.run(`INSERT INTO task_objectives (task_id, objective_id) VALUES ${placeholders}`, params);
  }
}

/** 设置任务关联的 Key Result（覆盖式写入） */
export async function setTaskKeyResults(taskId: number, keyResultIds: number[]): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  db.run('DELETE FROM task_key_results WHERE task_id = ?', [taskId]);
  if (keyResultIds.length > 0) {
    const placeholders = keyResultIds.map(() => '(?, ?)').join(', ');
    const params: number[] = [];
    for (const krid of keyResultIds) params.push(taskId, krid);
    db.run(`INSERT INTO task_key_results (task_id, key_result_id) VALUES ${placeholders}`, params);
  }
}

/** 获取某个 Objective 下的所有未归档任务 */
export async function getTasksByObjective(objectiveId: number): Promise<Task[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(
    `SELECT t.* FROM tasks t JOIN task_objectives tobj ON t.id = tobj.task_id WHERE tobj.objective_id = ? AND t.archived_at IS NULL ORDER BY t.created_at DESC`,
    [objectiveId]
  );
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((values: any[]) => {
    const obj: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Task] = values[index] ?? null;
    });
    return obj as Task;
  });
}

/** 获取某个 Key Result 下的所有未归档任务 */
export async function getTasksByKeyResult(keyResultId: number): Promise<Task[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(
    `SELECT t.* FROM tasks t JOIN task_key_results tkr ON t.id = tkr.task_id WHERE tkr.key_result_id = ? AND t.archived_at IS NULL ORDER BY t.created_at DESC`,
    [keyResultId]
  );
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((values: any[]) => {
    const obj: Partial<Task> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Task] = values[index] ?? null;
    });
    return obj as Task;
  });
}

// =====================================================
// 里程碑 CRUD
// =====================================================

interface Milestone {
  id: number;
  special_id: number;
  title: string;
  description: string;
  due_date: string | null;
  completed: number;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getMilestones(specialId: number): Promise<Milestone[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  // 按 due_date 升序排列；NULL 排到末尾（COALESCE -> 高值），这样时间线是按时间顺序
  const result = db.exec(
    `SELECT * FROM milestones WHERE special_id = ?
     ORDER BY (due_date IS NULL) ASC, due_date ASC, id ASC`,
    [specialId]
  );
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((values: any[]) => {
    const obj: Partial<Milestone> = {};
    columns.forEach((col: string, index: number) => {
      obj[col as keyof Milestone] = values[index] ?? null;
    });
    return obj as Milestone;
  });
}

export async function getMilestone(id: number): Promise<Milestone | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const result = db.exec('SELECT * FROM milestones WHERE id = ?', [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const columns = result[0].columns;
  const values = result[0].values[0];
  const obj: Partial<Milestone> = {};
  columns.forEach((col: string, index: number) => {
    obj[col as keyof Milestone] = values[index] ?? null;
  });
  return obj as Milestone;
}

export async function createMilestone(data: {
  special_id: number;
  title: string;
  description?: string;
  due_date?: string | null;
}): Promise<Milestone> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const now = getLocalTimestamp();
  const result = db.run(
    `INSERT INTO milestones
     (special_id, title, description, due_date, completed, completed_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, 0, ?, ?)`,
    [data.special_id, data.title, data.description || '', data.due_date || null, now, now]
  );
  const id = result.lastInsertRowid as number;
  saveDatabase();
  return {
    id,
    special_id: data.special_id,
    title: data.title,
    description: data.description || '',
    due_date: data.due_date || null,
    completed: 0,
    completed_at: null,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function updateMilestone(
  id: number,
  data: {
    title?: string;
    description?: string;
    due_date?: string | null;
    completed?: boolean;
  }
): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  const now = getLocalTimestamp();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.due_date !== undefined) {
    updates.push('due_date = ?');
    params.push(data.due_date);
  }
  if (data.completed !== undefined) {
    updates.push('completed = ?');
    params.push(data.completed ? 1 : 0);
    if (data.completed) {
      updates.push('completed_at = ?');
      params.push(now);
    } else {
      updates.push('completed_at = ?');
      params.push(null);
    }
  }
  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.run(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`, params);
  saveDatabase();
}

export async function deleteMilestone(id: number): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.run('DELETE FROM milestones WHERE id = ?', [id]);
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

// =====================================================
// 标签（Tag）CRUD
// =====================================================

/** 获取所有标签（按 sort_order 升序） */
export async function getTags(): Promise<Tag[]> {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec('SELECT * FROM tags ORDER BY is_preset DESC, sort_order ASC, id ASC');
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => mapRow<Tag>(cols, row));
}

/** 新增标签（用户自定义） */
export async function createTag(name: string, color: string = '#4a4339'): Promise<Tag> {
  if (!db) throw new Error('Database not initialized');
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('标签名不能为空');
  // 取最大 sort_order + 1
  const r = db.exec('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM tags');
  const maxSort = (r[0]?.values[0]?.[0] as number) || 0;
  const now = getLocalTimestamp();
  try {
    db.run(
      'INSERT INTO tags (name, color, is_preset, sort_order, created_at) VALUES (?, ?, 0, ?, ?)',
      [trimmed, color, maxSort + 1, now]
    );
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      throw new Error('标签名已存在');
    }
    throw err;
  }
  saveDatabase();
  const out = db.exec('SELECT * FROM tags WHERE name = ?', [trimmed]);
  return mapRow<Tag>(out[0].columns, out[0].values[0]);
}

/** 删除标签（v13 起所有标签均可自由删除，不再区分预置/自定义） */
export async function deleteTag(id: number): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  const r = db.exec('SELECT id FROM tags WHERE id = ?', [id]);
  if (r.length === 0 || r[0].values.length === 0) return;
  db.run('DELETE FROM tags WHERE id = ?', [id]);
  saveDatabase();
}

/** 更新标签名称/颜色（v13 起所有标签均可自由编辑） */
export async function updateTag(id: number, name: string, color?: string): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('标签名不能为空');
  try {
    if (color !== undefined) {
      db.run('UPDATE tags SET name = ?, color = ? WHERE id = ?', [trimmed, color, id]);
    } else {
      db.run('UPDATE tags SET name = ? WHERE id = ?', [trimmed, id]);
    }
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      throw new Error('标签名已存在');
    }
    throw err;
  }
  saveDatabase();
}

/** 重置某 task 的标签集合（先清后插） */
export async function setTaskTags(taskId: number, tagIds: number[]): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  db.run('DELETE FROM task_tags WHERE task_id = ?', [taskId]);
  const stmt = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  for (const tid of tagIds) {
    if (typeof tid === 'number' && Number.isFinite(tid)) {
      stmt.run([taskId, tid]);
    }
  }
  stmt.free();
  saveDatabase();
}
