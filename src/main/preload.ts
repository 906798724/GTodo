import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (task: any) => ipcRenderer.invoke('create-task', task),
  updateTask: (task: any) => ipcRenderer.invoke('update-task', task),
  deleteTask: (id: number) => ipcRenderer.invoke('delete-task', id),
  onTasksUpdated: (callback: () => void) => {
    ipcRenderer.on('tasks-updated', callback);
  },
  closeQuickInput: () => ipcRenderer.send('close-quick-input'),
  refreshTasks: () => ipcRenderer.send('refresh-tasks'),
  setNativeTheme: (isDark: boolean) => ipcRenderer.send('set-native-theme', isDark),
  onSetTheme: (callback: (theme: string) => void) => {
    ipcRenderer.on('set-theme', (_event, theme) => callback(theme));
  },
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },
});