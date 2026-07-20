import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeTheme, Tray, MenuItem } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getTasks, getAllCompletedTasks, createTask, updateTask, deleteTask, getSummary, getMonthSummaries, upsertSummary, deleteSummary, getObjectives, createObjective, updateObjective, deleteObjective, getKeyResults, getAllKeyResults, createKeyResult, updateKeyResult, deleteKeyResult, getTags, createTag, updateTag, deleteTag, setTaskTags, archiveDoneTasksForDate, getTasksByArchiveDate, getMonthArchivedTaskCount, getSpecials, getSpecial, createSpecial, updateSpecial, deleteSpecial, getTasksBySpecial, setTaskSpecials, getMilestones, createMilestone, updateMilestone, deleteMilestone, getTaskSpecialIds } from './database';

let mainWindow: BrowserWindow | null = null;
let taskOnlyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function autoArchiveDoneTasks(): Promise<void> {
  try {
    const today = getTodayDate();
    const count = await archiveDoneTasksForDate(today);
    if (count > 0) {
      console.log(`[AutoArchive] Archived ${count} tasks for ${today}`);
      // 通知主窗口刷新任务列表
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tasks-updated');
      }
    } else {
      console.log(`[AutoArchive] No tasks to archive for ${today}`);
    }
  } catch (err) {
    console.error('[AutoArchive] Failed to auto archive:', err);
  }
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function getArchiveTime(): string {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (config.archiveTime) {
        return config.archiveTime;
      }
    }
  } catch (err) {
    console.error('[Config] Failed to read config:', err);
  }
  return '09:00';
}

function saveArchiveTime(time: string): void {
  try {
    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    config = { ...config, archiveTime: time };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    restartAutoArchiveTimer();
  } catch (err) {
    console.error('[Config] Failed to save config:', err);
  }
}

let archiveTimer: ReturnType<typeof setTimeout> | null = null;

function setupAutoArchiveTimer(): void {
  const scheduleNextArchive = () => {
    if (archiveTimer) {
      clearTimeout(archiveTimer);
    }
    
    const now = new Date();
    const [hours, minutes] = getArchiveTime().split(':').map(Number);
    const todayArchiveTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    let nextArchive = todayArchiveTime;
    
    if (now > todayArchiveTime) {
      nextArchive = new Date(todayArchiveTime.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const delay = nextArchive.getTime() - now.getTime();
    console.log(`[AutoArchive] Next archive scheduled at ${nextArchive.toLocaleString()} (${getArchiveTime()})`);
    
    archiveTimer = setTimeout(() => {
      autoArchiveDoneTasks();
      scheduleNextArchive();
    }, delay);
  };
  
  scheduleNextArchive();
}

function restartAutoArchiveTimer(): void {
  setupAutoArchiveTimer();
}

function createMainWindow() {
  const screen = require('electron').screen;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const iconPath = path.join(__dirname, '../renderer', 'tray-icon.png');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    x: Math.floor((width - 1400) / 2),
    y: Math.floor((height - 800) / 2),
    minWidth: 1000,
    minHeight: 600,
    title: 'GTodo - GTD Todo List',
    backgroundColor: '#ffffff',
    titleBarStyle: 'default',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 让窗口标题栏跟随系统深色模式（仅 Windows 10/11 标题栏覆盖层）
  try {
    if (mainWindow.setTitleBarOverlay) {
      mainWindow.setTitleBarOverlay({
        color: '#ffffff',
        symbolColor: '#1a1a1a',
      });
    }
  } catch (err) {
    // 标题栏覆盖层不可用，忽略
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });

  // 不拦截 minimize：让窗口正常最小化到 Windows 任务栏（fix：之前误调 hide() 缩到系统角标）
  // 用户可通过点击任务栏图标还原窗口，或通过托盘菜单“显示窗口”恢复
  mainWindow.on('minimize', () => {
    // 留空即可：Electron 默认行为就是最小化到任务栏
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      event.preventDefault();
      mainWindow?.webContents.toggleDevTools();
    }
    if (input.key === 'F5' && !input.control && !input.meta) {
      event.preventDefault();
      mainWindow?.webContents.reload();
    }
  });
}

/**
 * 「仅任务弹窗」窗口（Ctrl+Alt+Q 触发）：
 * - 不显示主窗口
 */
function createTaskOnlyWindow() {
  if (taskOnlyWindow && !taskOnlyWindow.isDestroyed()) {
    if (!taskOnlyWindow.isVisible()) taskOnlyWindow.show();
    taskOnlyWindow.focus();
    return;
  }

  const screen = require('electron').screen;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const winW = 720;
  const winH = 760;

  taskOnlyWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.floor((width - winW) / 2),
    y: Math.floor((height - winH) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    title: 'GTodo - 新建任务',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加载主页 URL，带 query 让主页进入 task-only 模式
  if (process.env.NODE_ENV === 'development') {
    taskOnlyWindow.loadURL('http://localhost:3000/?mode=task-only');
  } else {
    taskOnlyWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { mode: 'task-only' },
    });
  }

  taskOnlyWindow.on('closed', () => {
    taskOnlyWindow = null;
  });
}

function applyNativeTheme(isDark: boolean) {
  // 设置系统菜单栏/标题栏主题
  nativeTheme.themeSource = isDark ? 'dark' : 'light';

  // 更新窗口标题栏覆盖层（仅 Windows）
  try {
    if (mainWindow && mainWindow.setTitleBarOverlay) {
      mainWindow.setTitleBarOverlay({
        color: isDark ? '#1a1a1a' : '#ffffff',
        symbolColor: isDark ? '#f5f5f5' : '#1a1a1a',
      });
    }
  } catch (err) {
    // 标题栏覆盖层不可用，忽略
  }
}

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';
  // 在 Windows 上不设置任何应用菜单——设置入口已移到侧边栏底部
  const template: Electron.MenuItemConstructorOptions[] = isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' as const },
      { type: 'separator' as const },
      { role: 'services' as const },
      { type: 'separator' as const },
      { role: 'hide' as const },
      { role: 'hideOthers' as const },
      { role: 'unhide' as const },
      { type: 'separator' as const },
      { role: 'quit' as const }
    ]
  }] : [];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function setupGlobalShortcut() {
  // Ctrl+Shift+B → 显示主窗口（沿用旧行为）
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    console.log('[Shortcut] Triggered: CommandOrControl+Shift+B');
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl+Alt+Q → 弹出独立的「仅任务弹窗」窗口（不显示主窗口）
  const altQRet = globalShortcut.register('CommandOrControl+Alt+Q', () => {
    console.log('[Shortcut] Triggered: CommandOrControl+Alt+Q');
    createTaskOnlyWindow();
  });

  if (altQRet) {
    console.log('Global shortcut registered: CommandOrControl+Alt+Q');
  } else {
    console.log('Failed to register shortcut: CommandOrControl+Alt+Q');
  }
}

function setupTray() {
  const iconPath = path.join(__dirname, '../renderer', 'tray-icon.png');
  if (!fs.existsSync(iconPath)) {
    console.warn('[Tray] Icon not found:', iconPath);
    return;
  }
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: '快速添加',
      accelerator: 'CommandOrControl+Alt+Q',
      click: () => {
        if (!mainWindow) {
          createMainWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        setTimeout(() => {
          mainWindow?.webContents.send('open-task-modal');
        }, 100);
      },
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          path: app.getPath('exe'),
        });
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        mainWindow?.destroy();
        mainWindow = null;
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('GTodo');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await initDatabase();
    setupAutoArchiveTimer();
    createMainWindow();
    setupApplicationMenu();
    setupGlobalShortcut();
    setupTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-tasks', async () => {
  return await getTasks();
});

ipcMain.handle('get-all-completed-tasks', async () => {
  return await getAllCompletedTasks();
});

ipcMain.handle('create-task', async (_event, task) => {
  return await createTask(task);
});

ipcMain.handle('update-task', async (_event, task) => {
  return await updateTask(task);
});

ipcMain.handle('delete-task', async (_event, id) => {
  return await deleteTask(id);
});

// 每日总结 IPC
ipcMain.handle('get-summary', async (_event, date: string) => {
  return await getSummary(date);
});

ipcMain.handle('get-month-summaries', async (_event, year: number, month: number) => {
  return await getMonthSummaries(year, month);
});

ipcMain.handle('upsert-summary', async (_event, date: string, content: string) => {
  return await upsertSummary(date, content);
});

ipcMain.handle('delete-summary', async (_event, date: string) => {
  return await deleteSummary(date);
});

ipcMain.handle('get-archive-time', () => {
  return getArchiveTime();
});

ipcMain.handle('set-archive-time', (_event, time: string) => {
  saveArchiveTime(time);
});

// OKR IPC
ipcMain.handle('get-objectives', async () => await getObjectives());
ipcMain.handle('create-objective', async (_event, data: any) => await createObjective(data));
ipcMain.handle('update-objective', async (_event, data: any) => await updateObjective(data));
ipcMain.handle('delete-objective', async (_event, id: number) => await deleteObjective(id));

ipcMain.handle('get-key-results', async (_event, objectiveId: number) => await getKeyResults(objectiveId));
ipcMain.handle('get-all-key-results', async () => await getAllKeyResults());
ipcMain.handle('create-key-result', async (_event, data: any) => await createKeyResult(data));
ipcMain.handle('update-key-result', async (_event, data: any) => await updateKeyResult(data));
ipcMain.handle('delete-key-result', async (_event, id: number) => await deleteKeyResult(id));

// 标签 IPC
ipcMain.handle('get-tags', async () => await getTags());
ipcMain.handle('create-tag', async (_event, name: string, color?: string) => await createTag(name, color));
ipcMain.handle('update-tag', async (_event, id: number, name: string, color?: string) =>
  await updateTag(id, name, color)
);
ipcMain.handle('delete-tag', async (_event, id: number) => await deleteTag(id));
ipcMain.handle('set-task-tags', async (_event, taskId: number, tagIds: number[]) => await setTaskTags(taskId, tagIds));

// 归档 Done 列任务（点击「总结」时调用）
ipcMain.handle('archive-done-tasks', async (_event, date: string) => {
  return await archiveDoneTasksForDate(date);
});

// 查询指定日期归档的任务（雁过留痕点击日期时使用）
ipcMain.handle('get-tasks-by-archive-date', async (_event, date: string) => {
  return await getTasksByArchiveDate(date);
});

// 查询某月每天的归档任务数（用于月历显示）
ipcMain.handle('get-month-archived-task-count', async (_event, year: number, month: number) => {
  return await getMonthArchivedTaskCount(year, month);
});

// 专项 IPC
ipcMain.handle('get-specials', async () => await getSpecials());
ipcMain.handle('get-special', async (_event, id: number) => await getSpecial(id));
ipcMain.handle('create-special', async (_event, data: any) => await createSpecial(data));
ipcMain.handle('update-special', async (_event, id: number, data: any) => await updateSpecial(id, data));
ipcMain.handle('delete-special', async (_event, id: number) => await deleteSpecial(id));
ipcMain.handle('get-tasks-by-special', async (_event, specialId: number) => await getTasksBySpecial(specialId));
ipcMain.handle('set-task-specials', async (_event, taskId: number, specialIds: number[]) => await setTaskSpecials(taskId, specialIds));

// 里程碑 IPC
ipcMain.handle('get-milestones', async (_event, specialId: number) => await getMilestones(specialId));
ipcMain.handle('create-milestone', async (_event, data: any) => await createMilestone(data));
ipcMain.handle('update-milestone', async (_event, id: number, data: any) => await updateMilestone(id, data));
ipcMain.handle('delete-milestone', async (_event, id: number) => await deleteMilestone(id));

// 任务关联有的放矢（万里长征）IPC
ipcMain.handle('get-task-specials', async (_event, taskId: number) => await getTaskSpecialIds(taskId));

ipcMain.on('close-task-only-window', () => {
  if (taskOnlyWindow && !taskOnlyWindow.isDestroyed()) {
    // 先通知主窗口刷新任务列表
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tasks-updated');
      console.log('[IPC] tasks-updated sent from close-task-only-window');
    }
    taskOnlyWindow.close();
    taskOnlyWindow = null;
  }
});

ipcMain.on('refresh-tasks', () => {
  console.log('[IPC] refresh-tasks received, sending tasks-updated to mainWindow');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tasks-updated');
    console.log('[IPC] tasks-updated sent successfully');
  } else {
    console.log('[IPC] mainWindow is null or destroyed');
  }
});

ipcMain.on('set-native-theme', (_event, isDark: boolean) => {
  applyNativeTheme(isDark);
});