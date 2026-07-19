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
  createObjective: (data: any) => ipcRenderer.invoke('create-objective', data),
  updateObjective: (data: any) => ipcRenderer.invoke('update-objective', data),
  deleteObjective: (id: number) => ipcRenderer.invoke('delete-objective', id),
  getKeyResults: (objectiveId: number) => ipcRenderer.invoke('get-key-results', objectiveId),
  getAllKeyResults: () => ipcRenderer.invoke('get-all-key-results'),
  createKeyResult: (data: any) => ipcRenderer.invoke('create-key-result', data),
  updateKeyResult: (data: any) => ipcRenderer.invoke('update-key-result', data),
  deleteKeyResult: (id: number) => ipcRenderer.invoke('delete-key-result', id),
  // 标签
  getTags: () => ipcRenderer.invoke('get-tags'),
  createTag: (name: string, color?: string) => ipcRenderer.invoke('create-tag', name, color),
  updateTag: (id: number, name: string, color?: string) =>
    ipcRenderer.invoke('update-tag', id, name, color),
  deleteTag: (id: number) => ipcRenderer.invoke('delete-tag', id),
  setTaskTags: (taskId: number, tagIds: number[]) => ipcRenderer.invoke('set-task-tags', taskId, tagIds),
  // 归档 Done 列任务（点击「总结」时调用）
  archiveDoneTasks: (date: string) => ipcRenderer.invoke('archive-done-tasks', date),
  // 查询指定日期归档的任务（雁过留痕点击日期时使用）
  getTasksByArchiveDate: (date: string) => ipcRenderer.invoke('get-tasks-by-archive-date', date),
  // 查询某月每天的归档任务数（用于月历显示）
  getMonthArchivedTaskCount: (year: number, month: number) => ipcRenderer.invoke('get-month-archived-task-count', year, month),
  // 专项
  getSpecials: () => ipcRenderer.invoke('get-specials'),
  getSpecial: (id: number) => ipcRenderer.invoke('get-special', id),
  createSpecial: (data: any) => ipcRenderer.invoke('create-special', data),
  updateSpecial: (id: number, data: any) => ipcRenderer.invoke('update-special', id, data),
  deleteSpecial: (id: number) => ipcRenderer.invoke('delete-special', id),
  getTasksBySpecial: (specialId: number) => ipcRenderer.invoke('get-tasks-by-special', specialId),
  setTaskSpecials: (taskId: number, specialIds: number[]) => ipcRenderer.invoke('set-task-specials', taskId, specialIds),
  // 里程碑
  getMilestones: (specialId: number) => ipcRenderer.invoke('get-milestones', specialId),
  createMilestone: (data: any) => ipcRenderer.invoke('create-milestone', data),
  updateMilestone: (id: number, data: any) => ipcRenderer.invoke('update-milestone', id, data),
  deleteMilestone: (id: number) => ipcRenderer.invoke('delete-milestone', id),
  // 任务关联有的放矢（万里长征）
  getTaskSpecials: (taskId: number) => ipcRenderer.invoke('get-task-specials', taskId),
  // 自动归档时间配置
  getArchiveTime: () => ipcRenderer.invoke('get-archive-time'),
  setArchiveTime: (time: string) => ipcRenderer.invoke('set-archive-time', time),
  onTasksUpdated: (callback: () => void) => {
    ipcRenderer.on('tasks-updated', callback);
  },
  /** task-only 模式下关闭独立窗口 */
  closeTaskOnlyWindow: () => ipcRenderer.send('close-task-only-window'),
  refreshTasks: () => ipcRenderer.send('refresh-tasks'),
  setNativeTheme: (isDark: boolean) => ipcRenderer.send('set-native-theme', isDark),
  onSetTheme: (callback: (theme: string) => void) => {
    ipcRenderer.on('set-theme', (_event, theme) => callback(theme));
  },
  onOpenTaskModal: (callback: () => void) => {
    ipcRenderer.on('open-task-modal', callback);
  },
});