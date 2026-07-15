# AGENTS.md — 项目硬约束（AI 助手 / 工具必须遵守）

> 本文件列出对本项目进行任何修改时必须遵守的硬约束。
> 任何 AI 助手、自动化工具、代码生成器在改动本项目前都必须先读完本文件，
> 并且**禁止**修改下方「不可变约束」一节中的任何一项。

---

## 1. 不可变约束（禁止修改）

### 1.1 数据库路径必须使用 `app.getPath('userData')`

- 文件：`src/main/database.ts` 中的 `getDbPath()` 函数
- 当前实现：
  ```typescript
  function getDbPath(): string {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    return path.join(userDataDir, 'gtodo.db');
  }
  ```
- **禁止**改为：
  - 安装目录下的 `data/` 子目录（如 `C:\Program Files\GTodo\data\gtodo.db`）
  - exe 同级目录
  - `process.resourcesPath` 下的任何路径
  - 任何需要管理员权限才能写入的路径
- 原因：
  - `Program Files` 目录写入需要 UAC 提权，会导致普通用户无法保存数据
  - NSIS 安装包更新时会覆盖安装目录，造成数据丢失
  - `userData` 路径与安装路径分离，是 Electron + Windows 的最佳实践

### 1.2 应用标识字段禁止修改

- `package.json` 中的 `name` 字段：必须保持为 `GTodo`
- `package.json` 中的 `productName` 字段：必须保持为 `GTodo`
- 原因：
  - `app.getPath('userData')` 在 Windows 上解析为 `%APPDATA%\<name 或 productName>\`
  - 修改这两个字段会导致 userData 路径变化
  - 老用户更新版本后将读取到全新的空数据库，原有任务全部丢失
- 仅 `version` 字段允许递增

### 1.3 数据库 Schema 变更必须通过迁移机制

- 文件：`src/main/database.ts`
- 当前 Schema 版本：`SCHEMA_VERSION = 1`
- **禁止**直接修改 `CREATE TABLE` 语句来变更已有字段
- 任何表结构变更必须：
  1. 递增 `SCHEMA_VERSION`（如 1 → 2）
  2. 在 `MIGRATIONS` 数组中添加对应的迁移规则：
     ```typescript
     {
       fromVersion: 1,
       toVersion: 2,
       up: (db) => {
         db.run('ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT \'medium\'');
       },
     }
     ```
- 原因：
  - 老用户的数据库已存在，`CREATE TABLE IF NOT EXISTS` 不会修改既有表结构
  - 迁移机制会在启动时自动检查 `PRAGMA user_version` 并应用未执行的迁移
  - 保证版本升级时老数据无损保留

---

## 2. 架构背景说明

### 2.1 数据存储位置

| 路径 | 用途 | 安装/更新时是否被触及 |
|------|------|---------------------|
| `C:\Program Files\GTodo\` | 程序文件（exe、asar、wasm） | ✅ 会被覆盖更新 |
| `%APPDATA%\GTodo\gtodo.db` | 主数据库 | ❌ 完全不触及 |
| `%APPDATA%\GTodo\backups\` | 手动/自动备份 | ❌ 完全不触及 |

### 2.2 NSIS 安装包配置要求

`package.json` 的 `electron-builder` 配置中，`nsis` 节点必须包含：

```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "deleteAppDataOnUninstall": false
}
```

- `deleteAppDataOnUninstall: false` 确保用户卸载时数据不丢失，方便重装恢复

### 2.3 已移除的功能（禁止恢复）

- **JSON 导入导出功能已从项目中移除**（用户明确要求）
- 涉及文件：`database.ts`、`index.ts`、`preload.ts`、`DataManageModal.tsx`
- 不要重新添加 `exportToJSON` / `importFromJSON` 函数
- 不要重新添加 `export-to-json` / `import-from-json` IPC handler
- 保留的功能：立即备份、备份历史、恢复备份、删除备份、打开数据文件夹、数据概览

---

## 3. 修改本文件的规则

- 本文件由项目维护者人工管理
- AI 助手**禁止**自行修改或删除本文件内容
- 如需新增约束，必须由项目维护者明确指示添加
