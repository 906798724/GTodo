# GTodo

一款基于 GTD 方法论的 Windows 桌面 Todo 应用，基于 Electron + React 构建。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Electron](https://img.shields.io/badge/Electron-28.3.3-47848F)
![React](https://img.shields.io/badge/React-18.2-61DAFB)
![Platform](https://img.shields.io/badge/platform-Windows-0078D4)

## 功能特性

### 看板视图（主页）
- 经典 GTD 四列看板：**Todo / WIP / Waited / Done**
- 任务卡片支持拖拽改状态、编辑标题/描述/期望完成时间
- 子任务勾选
- 过期/超期提醒：Todo 列中创建超过 7 天的任务以红色脉冲高亮
- 一键插入 Done 列任务到「今日总结」模板

### OKR 目标管理
- 在【OKR】菜单创建 Objective（目标）+ Key Results（关键结果）
- 进度条可视化（蓝/橙/绿三色映射进度区间）
- 季度标记（自动填入当前季度，如 `2026-Q3`）

### 每日总结
- Done 列右上角「总结」按钮：低心理负担的 3 段式模板（已完成 / 进行中 / 下一步）
- 一键插入 Done 列任务为已完成清单
- 总结持久化到 SQLite（用户数据目录，不随安装包丢失）

### 雁过留痕（历史日历）
- 顶部菜单【雁过留痕】切换为月历视图
- 写过总结的日期高亮显示当日摘要预览
- 点击任意日期可重新进入该日总结的编辑界面

### 设置
- 侧边栏底部「设置」按钮
- 深色模式开关（iOS 风格 switch）
- 快捷键说明（F12 开发者工具 / Ctrl+Alt+Q 快速添加）

### 主题
- 浅色：暖灰米色调，长时间使用不刺眼
- 深色：纯黑 + 蓝色高亮

### 其他
- 系统托盘（点击唤起窗口 / 右键菜单）
- 开机自启动（托盘菜单切换）
- 全局快捷键 `Ctrl+Shift+B` 或 `Ctrl+Alt+Q` 唤起快速添加弹窗

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+B` | 全局唤起快速添加窗口 |
| `Ctrl+Alt+Q` | 全局唤起快速添加窗口（备选） |
| `F12` | 打开开发者工具 |
| `F5` | 刷新窗口 |

> ⚠️ 原计划使用 `Ctrl+Shift+0` 作为快速添加快捷键，但该组合在 Windows 上被 NVIDIA ShadowPlay / OneNote 等程序占用，已弃用。

## 技术栈

- **运行时**：Electron 28.3.3
- **UI**：React 18 + TypeScript
- **数据库**：SQLite（via sql.js，本地 wasm）
- **拖拽**：`@dnd-kit`
- **打包**：electron-builder + NSIS
- **样式**：原生 CSS + CSS Variables（无 UI 框架依赖）

## 项目结构

```
src/
├── main/                 # Electron 主进程
│   ├── index.ts          # 应用入口、窗口/菜单/托盘/快捷键/IPC 注册
│   ├── database.ts       # SQLite 数据库 + Schema 迁移管理
│   └── preload.ts        # contextBridge 暴露 IPC API
└── renderer/             # 渲染进程（React）
    ├── App.tsx           # 根组件 + 路由（home/okr/archived/settings）
    ├── components/       # 业务组件
    │   ├── TaskColumn.tsx       # 看板列
    │   ├── TaskCard.tsx         # 任务卡片
    │   ├── TaskModal.tsx        # 任务编辑弹窗
    │   ├── ConfirmModal.tsx     # 通用确认弹窗
    │   ├── SummaryModal.tsx     # 每日总结编辑
    │   ├── ArchiveCalendar.tsx  # 历史月历视图
    │   ├── OkrPage.tsx          # OKR 主页面
    │   ├── ObjectiveModal.tsx   # 目标编辑
    │   └── KeyResultModal.tsx   # 关键结果编辑
    ├── styles/main.css   # 全局样式（CSS Variables 主题）
    ├── quick-input.html  # 快速添加弹窗 HTML
    └── index.html        # 主窗口 HTML

scripts/
└── prepare-build.ps1     # 打包环境准备脚本

AGENTS.md                 # AI 助手 / 工具必须遵守的硬约束
```

## 数据存储

| 路径 | 用途 |
|------|------|
| `C:\Program Files\GTodo\` | 程序文件（exe、asar、wasm） |
| `%APPDATA%\GTodo\gtodo.db` | 主数据库（任务、总结、OKR） |

数据库 Schema 版本：`v3`

- **v1**：tasks 表
- **v2**（v1→v2 迁移）：summaries 表
- **v3**（v2→v3 迁移）：objectives + key_results 表

所有 schema 变更通过 `MIGRATIONS` 数组管理，老用户升级时自动应用迁移。

## 开发

### 环境要求
- Node.js ≥ 18
- Windows 10/11

### 安装依赖
```bash
npm install
```

### 启动开发模式
```bash
npm run dev
```
- 同时启动 webpack-dev-server（http://localhost:3000）和 Electron 主进程
- 主进程文件改动需重启 Electron；渲染进程文件改动自动热更新

### 打包
```bash
# 生成 NSIS 安装包（推荐）
npm run pack

# 仅生成解压目录（用于便携测试）
npm run pack:dir
```

打包产物位于 `release/`：
- `GTodo-Setup-1.0.0.exe`：NSIS 安装包
- `win-unpacked/`：解压后的应用目录

### 打包准备（新机器 / 缓存清理后）
```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-build.ps1
```
该脚本会从 npmmirror 拉取 electron-builder 必要的缓存（cache、native_modules 等），跳过 macOS 目录。

## 已知限制

- 当前仅打包 Windows x64 版本
- sql.js 为内存数据库，启动时需加载整个 db 文件；任务量极大时可能影响启动速度（>10k 任务级别）
- 全局快捷键 `Ctrl+Shift+B` 在某些浏览器（如 Chrome 收藏夹）可能与之冲突

## 许可

MIT