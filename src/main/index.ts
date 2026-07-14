import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeTheme } from 'electron';
import path from 'path';
import { initDatabase, getTasks, createTask, updateTask, deleteTask } from './database';

let mainWindow: BrowserWindow | null = null;
let quickInputWindow: BrowserWindow | null = null;

function createMainWindow() {
  const screen = require('electron').screen;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
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
  if (quickInputWindow) {
    quickInputWindow.focus();
    return;
  }

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
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
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
    }] : []),
    {
      label: '主页',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('show-home');
        }
      }
    },
    {
      label: 'OKR',
      submenu: [
        {
          label: '查看 OKR',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-okr');
            }
          }
        },
        { type: 'separator' },
        {
          label: '新建目标 (Objective)',
          accelerator: 'CommandOrControl+Shift+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-objective');
            }
          }
        },
        {
          label: '新建关键结果 (Key Result)',
          accelerator: 'CommandOrControl+Shift+K',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-key-result');
            }
          }
        }
      ]
    },
    {
      label: '已归档task',
      submenu: [
        {
          label: '查看归档列表',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-archived');
            }
          }
        },
        { type: 'separator' },
        {
          label: '清空归档',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('clear-archived');
            }
          }
        }
      ]
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function setupGlobalShortcut() {
  const shortcuts = ['CommandOrControl+Shift+B', 'CommandOrControl+Alt+B'];

  for (const shortcut of shortcuts) {
    const ret = globalShortcut.register(shortcut, () => {
      createQuickInputWindow();
    });

    if (ret) {
      console.log(`Global shortcut registered: ${shortcut}`);
      break;
    } else {
      console.log(`Failed to register shortcut: ${shortcut}`);
    }
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createMainWindow();
  setupApplicationMenu();
  setupGlobalShortcut();

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

ipcMain.on('close-quick-input', () => {
  if (quickInputWindow) {
    quickInputWindow.close();
    quickInputWindow = null;
  }
});

ipcMain.on('refresh-tasks', () => {
  if (mainWindow) {
    mainWindow.webContents.send('tasks-updated');
  }
});

ipcMain.on('set-native-theme', (_event, isDark: boolean) => {
  applyNativeTheme(isDark);
});