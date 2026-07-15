import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskColumn } from './components/TaskColumn';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { ConfirmModal } from './components/ConfirmModal';
import { SummaryModal } from './components/SummaryModal';
import { ArchiveCalendar } from './components/ArchiveCalendar';
import { OkrPage } from './components/OkrPage';
import { Task, TaskStatus, COLUMNS } from './types';
import './styles/main.css';

declare global {
  interface Window {
    electronAPI: {
      getTasks: () => Promise<Task[]>;
      createTask: (task: Omit<Task, 'id' | 'created_at' | 'completed_at'>) => Promise<Task>;
      updateTask: (task: Partial<Task> & { id: number }) => Promise<Task>;
      deleteTask: (id: number) => Promise<void>;
      getSummary: (date: string) => Promise<{ date: string; content: string; updated_at: string } | null>;
      getMonthSummaries: (year: number, month: number) => Promise<{ date: string; content: string; updated_at: string }[]>;
      upsertSummary: (date: string, content: string) => Promise<{ date: string; content: string; updated_at: string }>;
      deleteSummary: (date: string) => Promise<void>;
      getObjectives: () => Promise<any[]>;
      getObjective: (id: number) => Promise<any>;
      createObjective: (data: any) => Promise<any>;
      updateObjective: (data: any) => Promise<any>;
      deleteObjective: (id: number) => Promise<void>;
      getKeyResults: (objectiveId: number) => Promise<any[]>;
      getAllKeyResults: () => Promise<Record<number, any[]>>;
      createKeyResult: (data: any) => Promise<any>;
      updateKeyResult: (data: any) => Promise<any>;
      deleteKeyResult: (id: number) => Promise<void>;
      onTasksUpdated: (callback: () => void) => void;
      onSetTheme: (callback: (theme: string) => void) => void;
      onMenuAction: (callback: (action: string) => void) => void;
    };
  }
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; taskId: number | null }>({
    open: false,
    taskId: null,
  });
  const [currentPage, setCurrentPage] = useState<'home' | 'okr' | 'archived'>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [todaySummary, setTodaySummary] = useState('');
  const [initialSummaryDate, setInitialSummaryDate] = useState<string | undefined>(undefined);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);

  // 当前日期（YYYY-MM-DD，本地时间）
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem('gtodo-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    loadTasks();
    window.electronAPI.onTasksUpdated(loadTasks);

    // 监听主进程菜单触发的设置主题事件
    window.electronAPI.onSetTheme((newTheme: string) => {
      if (newTheme === 'system') {
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const t = sysDark ? 'dark' : 'light';
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
        localStorage.removeItem('gtodo-theme');
      } else {
        setTheme(newTheme as 'light' | 'dark');
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('gtodo-theme', newTheme);
      }
    });
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('gtodo-theme', newTheme);
    // 通知主进程同步菜单栏和标题栏主题
    if ((window as any).electronAPI.setNativeTheme) {
      (window as any).electronAPI.setNativeTheme(newTheme === 'dark');
    }
  };

  const loadTasks = async () => {
    try {
      const loadedTasks = await window.electronAPI.getTasks();
      setTasks(loadedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleDragStart = (event: { active: { id: number | string } }) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setSelectedTask(task);
      setActiveId(task.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setSelectedTask(null);

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string | number;
    const overTask = tasks.find((t) => t.id === overId);
    const overColumn = COLUMNS.find((c) => c.id === overId);

    let newStatus: TaskStatus = activeTask.status;

    if (overColumn) {
      newStatus = overColumn.id;
    } else if (overTask) {
      newStatus = overTask.status;
    }

    if (newStatus !== activeTask.status) {
      const updatedTask: Partial<Task> & { id: number } = {
        id: activeTask.id,
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      };

      window.electronAPI.updateTask(updatedTask).then(loadTasks);
    } else {
      const tasksInColumn = tasks.filter((t) => t.status === activeTask.status);
      const oldIndex = tasksInColumn.findIndex((t) => t.id === active.id);
      const newIndex = overTask ? tasksInColumn.findIndex((t) => t.id === overTask.id) : tasksInColumn.length - 1;

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(tasksInColumn, oldIndex, newIndex);
        reordered.forEach((t, index) => {
          window.electronAPI.updateTask({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            parent_id: t.parent_id,
            expected_date: t.expected_date,
            completed_at: t.completed_at,
          });
        });
        loadTasks();
      }
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setConfirmDelete({ open: true, taskId: id });
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete.taskId !== null) {
      await window.electronAPI.deleteTask(confirmDelete.taskId);
      loadTasks();
    }
    setConfirmDelete({ open: false, taskId: null });
  };

  const handleSave = async (taskData: Partial<Task>) => {
    if ('id' in taskData && taskData.id) {
      await window.electronAPI.updateTask(taskData as Partial<Task> & { id: number });
    } else {
      await window.electronAPI.createTask(taskData as Omit<Task, 'id' | 'created_at' | 'completed_at'>);
    }
    loadTasks();
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status && t.parent_id === null);
  };

  return (
    <div className="app-container">
      <header className="header"></header>

      <div className="main-content">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
              title="主页"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {!sidebarCollapsed && <span>主页</span>}
            </button>
            <button
              className={`sidebar-item ${currentPage === 'okr' ? 'active' : ''}`}
              onClick={() => setCurrentPage('okr')}
              title="OKR"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              {!sidebarCollapsed && <span>OKR</span>}
            </button>
            <button
              className={`sidebar-item ${currentPage === 'archived' ? 'active' : ''}`}
              onClick={() => setCurrentPage('archived')}
              title="雁过留痕"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {!sidebarCollapsed && <span>雁过留痕</span>}
            </button>
          </nav>
          <div className="sidebar-divider"></div>
          <button className="sidebar-item sidebar-add" onClick={() => (window as any).electronAPI.openQuickInput()} title="快速添加 (Ctrl+Shift+0)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {!sidebarCollapsed && <span>快速添加</span>}
          </button>
          <button
            className={`sidebar-item ${settingsOpen ? 'active' : ''}`}
            onClick={() => setSettingsOpen(true)}
            title="设置"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {!sidebarCollapsed && <span>设置</span>}
          </button>
          <button className="sidebar-collapse" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <path d="M15 18l-6-6 6-6"/>
              ) : (
                <path d="M9 18l6-6-6-6"/>
              )}
            </svg>
          </button>
        </aside>

        <div className="content-area">
          {currentPage === 'home' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="boards-container">
                {COLUMNS.map((column) => (
                  <TaskColumn
                    key={column.id}
                    column={column}
                    tasks={getTasksByStatus(column.id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddTask={column.id === 'todo' ? handleAddTask : undefined}
                    onSummary={column.id === 'done' ? () => setSummaryOpen(true) : undefined}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeId && selectedTask ? (
                  <div className="drag-overlay">
                    <TaskCard task={selectedTask} onEdit={() => {}} onDelete={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {currentPage === 'okr' && (
            <OkrPage />
          )}

          {currentPage === 'archived' && (
            <ArchiveCalendar
              refreshKey={archiveRefreshKey}
              onOpenDay={(date, summary) => {
                setSummaryOpen(true);
                // 通过 setTimeout 让 SummaryModal 挂载后再覆盖初始值
                setTimeout(() => {
                  setTodaySummary(summary?.content || '');
                  setInitialSummaryDate(date);
                }, 0);
              }}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        open={confirmDelete.open}
        title="删除任务"
        message="确定要删除这个任务吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDelete({ open: false, taskId: null })}
      />

      {summaryOpen && (
        <SummaryModal
          doneTasks={initialSummaryDate === todayDateStr ? getTasksByStatus('done') : []}
          initialContent={todaySummary}
          initialDate={initialSummaryDate || todayDateStr}
          onClose={() => {
            setSummaryOpen(false);
            setInitialSummaryDate(undefined);
          }}
          onSave={async (date, content) => {
            try {
              await window.electronAPI.upsertSummary(date, content);
              setArchiveRefreshKey((k) => k + 1);
              if (date === todayDateStr) {
                setTodaySummary(content);
              }
              setSummaryOpen(false);
              setInitialSummaryDate(undefined);
            } catch (err) {
              console.error('Failed to save summary:', err);
              alert('保存总结失败：' + (err as Error).message);
            }
          }}
        />
      )}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>设置</h2>
              <button className="modal-close" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-row">
                <div className="settings-row-label">
                  <div className="settings-row-title">深色模式</div>
                  <div className="settings-row-desc">切换应用为深色主题</div>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                  />
                  <span className="settings-switch-slider"></span>
                </label>
              </div>
              <div className="settings-row">
                <div className="settings-row-label">
                  <div className="settings-row-title">快速添加快捷键</div>
                  <div className="settings-row-desc">在任意位置唤起快速添加窗口</div>
                </div>
                <kbd className="settings-kbd">Ctrl + Alt + Q</kbd>
              </div>
              <div className="settings-row">
                <div className="settings-row-label">
                  <div className="settings-row-title">开发者工具</div>
                  <div className="settings-row-desc">打开调试面板</div>
                </div>
                <kbd className="settings-kbd">F12</kbd>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn save" onClick={() => setSettingsOpen(false)}>
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
