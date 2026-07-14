const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (task) => ipcRenderer.invoke('create-task', task),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  closeQuickInput: () => ipcRenderer.send('close-quick-input'),
  onTasksUpdated: (callback) => ipcRenderer.on('tasks-updated', callback),
});
