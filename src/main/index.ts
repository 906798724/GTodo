import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeTheme, Tray, MenuItem } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getTasks, createTask, updateTask, deleteTask, getSummary, getMonthSummaries, upsertSummary, deleteSummary, getObjectives, getObjective, createObjective, updateObjective, deleteObjective, getKeyResults, getAllKeyResults, createKeyResult, updateKeyResult, deleteKeyResult } from './database';

let mainWindow: BrowserWindow | null = null;
let quickInputWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

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
    quickInputWindow?.close();
    quickInputWindow = null;
  });

  mainWindow.on('minimize', () => {
    mainWindow?.hide();
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

function createQuickInputWindow() {
  if (quickInputWindow && !quickInputWindow.isDestroyed()) {
    if (!quickInputWindow.isVisible()) quickInputWindow.show();
    quickInputWindow.focus();
    return;
  }
  quickInputWindow = null;

  quickInputWindow = new BrowserWindow({
    width: 520,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const screen = require('electron').screen;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  quickInputWindow.setPosition(Math.floor((width - 520) / 2), Math.floor((height - 280) / 2));

  if (process.env.NODE_ENV === 'development') {
    quickInputWindow.loadURL('http://localhost:3000/quick-input.html');
  } else {
    quickInputWindow.loadFile(path.join(__dirname, '../renderer/quick-input.html'));
  }

  quickInputWindow.on('closed', () => {
    quickInputWindow = null;
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
  // 注意：Ctrl+Shift+0 在 Windows 上常被其他程序（如 NVIDIA ShadowPlay、OneNote、录屏工具）占用
  // 因此跳过它，只注册相对冷门的组合
  const shortcuts = ['CommandOrControl+Shift+B', 'CommandOrControl+Alt+Q'];

  for (const shortcut of shortcuts) {
    const ret = globalShortcut.register(shortcut, () => {
      console.log(`[Shortcut] Triggered: ${shortcut}`);
      createQuickInputWindow();
    });

    if (ret) {
      console.log(`Global shortcut registered: ${shortcut}`);
    } else {
      console.log(`Failed to register shortcut: ${shortcut}`);
    }
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
        createQuickInputWindow();
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
        quickInputWindow?.close();
        quickInputWindow = null;
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

app.whenReady().then(async () => {
  await initDatabase();
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

// OKR IPC
ipcMain.handle('get-objectives', async () => await getObjectives());
ipcMain.handle('get-objective', async (_event, id: number) => await getObjective(id));
ipcMain.handle('create-objective', async (_event, data: any) => await createObjective(data));
ipcMain.handle('update-objective', async (_event, data: any) => await updateObjective(data));
ipcMain.handle('delete-objective', async (_event, id: number) => await deleteObjective(id));

ipcMain.handle('get-key-results', async (_event, objectiveId: number) => await getKeyResults(objectiveId));
ipcMain.handle('get-all-key-results', async () => await getAllKeyResults());
ipcMain.handle('create-key-result', async (_event, data: any) => await createKeyResult(data));
ipcMain.handle('update-key-result', async (_event, data: any) => await updateKeyResult(data));
ipcMain.handle('delete-key-result', async (_event, id: number) => await deleteKeyResult(id));

ipcMain.on('close-quick-input', () => {
  if (quickInputWindow) {
    quickInputWindow.close();
    quickInputWindow = null;
  }
});

ipcMain.on('open-quick-input', () => {
  createQuickInputWindow();
});

ipcMain.on('refresh-tasks', () => {
  if (mainWindow) {
    mainWindow.webContents.send('tasks-updated');
  }
});

ipcMain.on('set-native-theme', (_event, isDark: boolean) => {
  applyNativeTheme(isDark);
});