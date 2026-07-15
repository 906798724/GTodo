import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (task: any) => ipcRenderer.invoke('create-task', task),
  updateTask: (task: any) => ipcRenderer.invoke('update-task', task),
  deleteTask: (id: number) => ipcRenderer.invoke('delete-task', id),
  // 每日总结
  getSummary: (date: string) => ipcRenderer.invoke('get-summary', date),
  getMonthSummaries: (year: number, month: number) => ipcRenderer.invoke('get-month-summaries', year, month),
  upsertSummary: (date: string, content: string) => ipcRenderer.invoke('upsert-summary', date, content),
  deleteSummary: (date: string) => ipcRenderer.invoke('delete-summary', date),
  // OKR
  getObjectives: () => ipcRenderer.invoke('get-objectives'),
  getObjective: (id: number) => ipcRenderer.invoke('get-objective', id),
  createObjective: (data: any) => ipcRenderer.invoke('create-objective', data),
  updateObjective: (data: any) => ipcRenderer.invoke('update-objective', data),
  deleteObjective: (id: number) => ipcRenderer.invoke('delete-objective', id),
  getKeyResults: (objectiveId: number) => ipcRenderer.invoke('get-key-results', objectiveId),
  getAllKeyResults: () => ipcRenderer.invoke('get-all-key-results'),
  createKeyResult: (data: any) => ipcRenderer.invoke('create-key-result', data),
  updateKeyResult: (data: any) => ipcRenderer.invoke('update-key-result', data),
  deleteKeyResult: (id: number) => ipcRenderer.invoke('delete-key-result', id),
  onTasksUpdated: (callback: () => void) => {
    ipcRenderer.on('tasks-updated', callback);
  },
  closeQuickInput: () => ipcRenderer.send('close-quick-input'),
  openQuickInput: () => ipcRenderer.send('open-quick-input'),
  refreshTasks: () => ipcRenderer.send('refresh-tasks'),
  setNativeTheme: (isDark: boolean) => ipcRenderer.send('set-native-theme', isDark),
  onSetTheme: (callback: (theme: string) => void) => {
    ipcRenderer.on('set-theme', (_event, theme) => callback(theme));
  },
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },
});