import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskColumn } from './components/TaskColumn';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { ConfirmModal } from './components/ConfirmModal';
import { SummaryModal } from './components/SummaryModal';
import { GtdFlowModal } from './components/GtdFlowModal';
import { SpecialPage } from './components/SpecialPage';
import { ArchiveCalendar } from './components/ArchiveCalendar';
import { OkrPage } from './components/OkrPage';
import { TaskDetailModal } from './components/TaskDetailModal';
import { TagsPage } from './components/TagsPage';
import { SettingsPage } from './components/SettingsPage';
import { Task, Tag, TaskStatus, MAIN_COLUMNS } from './types';
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
      createObjective: (data: any) => Promise<any>;
      updateObjective: (data: any) => Promise<any>;
      deleteObjective: (id: number) => Promise<void>;
      getKeyResults: (objectiveId: number) => Promise<any[]>;
      getAllKeyResults: () => Promise<Record<number, any[]>>;
      createKeyResult: (data: any) => Promise<any>;
      updateKeyResult: (data: any) => Promise<any>;
      deleteKeyResult: (id: number) => Promise<void>;
      getTags: () => Promise<Tag[]>;
      createTag: (name: string, color?: string) => Promise<Tag>;
      updateTag: (id: number, name: string, color?: string) => Promise<void>;
      deleteTag: (id: number) => Promise<void>;
      setTaskTags: (taskId: number, tagIds: number[]) => Promise<void>;
      archiveDoneTasks: (date: string) => Promise<number>;
      getTasksByArchiveDate: (date: string) => Promise<Task[]>;
      getMonthArchivedTaskCount: (year: number, month: number) => Promise<Record<string, number>>;
      getSpecials: () => Promise<any[]>;
      getSpecial: (id: number) => Promise<any | null>;
      createSpecial: (data: { title: string; description?: string; color?: string; due_date?: string | null }) => Promise<any>;
      updateSpecial: (id: number, data: { title?: string; description?: string; color?: string; due_date?: string | null }) => Promise<void>;
      deleteSpecial: (id: number) => Promise<void>;
      getTasksBySpecial: (specialId: number) => Promise<Task[]>;
      setTaskSpecials: (taskId: number, specialIds: number[]) => Promise<void>;
      // 任务关联万里长征
      getTaskSpecials: (taskId: number) => Promise<number[]>;
      getMilestones: (specialId: number) => Promise<any[]>;
      createMilestone: (data: any) => Promise<any>;
      updateMilestone: (id: number, data: any) => Promise<void>;
      deleteMilestone: (id: number) => Promise<void>;
      getArchiveTime: () => Promise<string>;
      setArchiveTime: (time: string) => Promise<void>;
      onTasksUpdated: (callback: () => void) => void;
      onSetTheme: (callback: (theme: string) => void) => void;
      onOpenTaskModal: (callback: () => void) => void;
    };
  }
}

const App: React.FC = () => {
  // 检测是否处于「仅任务弹窗」模式（用于 Ctrl+Alt+Q 快捷键触发的独立小窗口）
  const urlParams = new URLSearchParams(window.location.search);
  const isTaskOnlyMode = urlParams.get('mode') === 'task-only';

  // 生成本地时间戳（YYYY-MM-DD HH:MM:SS），与主数据库一致，避免时区错位
  const getLocalTimestamp = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [specials, setSpecials] = useState<{ id: number; title: string; color?: string }[]>([]);
  const [initialSpecialIds, setInitialSpecialIds] = useState<number[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  /** 「扩展任务」模式：基于此任务创建新任务 */
  const [extendingFromTask, setExtendingFromTask] = useState<Task | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; taskId: number | null }>({
    open: false,
    taskId: null,
  });
  const [currentPage, setCurrentPage] = useState<'home' | 'okr' | 'special' | 'archived' | 'tags' | 'settings'>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [gtdFlowOpen, setGtdFlowOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [todaySummary, setTodaySummary] = useState('');
  const [initialSummaryDate, setInitialSummaryDate] = useState<string | undefined>(undefined);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [dayArchivedTasks, setDayArchivedTasks] = useState<Task[]>([]);
  const [archiveTime, setArchiveTime] = useState('09:00');

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
    loadTags();
    loadSpecials();
    window.electronAPI.onTasksUpdated(() => {
      loadTasks();
      loadTags();
    });

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

    // 监听快捷键触发的快速添加任务
    window.electronAPI.onOpenTaskModal(() => {
      setEditingTask(null);
      setIsModalOpen(true);
    });

    // task-only 模式：自动打开任务弹窗，数据加载完成后
    if (isTaskOnlyMode) {
      document.body.setAttribute('data-mode', 'task-only');
      // 等到 loadTags/loadTasks 完成后弹窗（用微任务延后即可）
      Promise.resolve().then(() => {
        setEditingTask(null);
        setIsModalOpen(true);
      });
    } else {
      document.body.setAttribute('data-mode', 'normal');
    }

    // 加载自动归档时间设置
    window.electronAPI.getArchiveTime().then(setArchiveTime).catch(console.error);
  }, [isTaskOnlyMode]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('gtodo-theme', newTheme);
    if ((window as any).electronAPI.setNativeTheme) {
      (window as any).electronAPI.setNativeTheme(newTheme === 'dark');
    }
  };

  const loadTasks = async () => {
    try {
      const loadedTasks = await window.electronAPI.getTasks();
      // 为每个任务加载「万里长征」关联，以伪 Tag 形式挂到 task.tags
      // 这样 TaskCard 会自动把「【万里长征: xxx】」渲染成 chip
      const specialsRaw = await window.electronAPI.getSpecials().catch(() => []);
      const specialsById = new Map<number, { title: string; color?: string }>();
      for (const s of specialsRaw) specialsById.set(s.id, { title: s.title, color: s.color });

      for (const t of loadedTasks) {
        try {
          const specialIds = await window.electronAPI.getTaskSpecials(t.id);
          const specTags = (specialIds || [])
            .map((sid: number) => {
              const s = specialsById.get(sid);
              if (!s) return null;
              return {
                id: -(1000000 + sid), // 虚拟 id（负数不与真实 tag id 冲突）
                name: `万里长征: ${s.title}`,
                color: s.color || '#4a4339',
                sort_order: 0,
                created_at: '',
              } as Tag;
            })
            .filter(Boolean) as Tag[];
          t.tags = [...(t.tags || []), ...specTags];
        } catch (_) {
          // ignore individual task special load error
        }
      }
      setTasks(loadedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const loadTags = async () => {
    try {
      const loaded = await window.electronAPI.getTags();
      setTags(loaded);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadSpecials = async () => {
    try {
      const loaded = await window.electronAPI.getSpecials();
      setSpecials(loaded.map((s: any) => ({ id: s.id, title: s.title, color: s.color })));
    } catch (error) {
      console.error('Failed to load specials:', error);
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
    const overColumn = MAIN_COLUMNS.find((c) => c.id === overId);

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
        completed_at: newStatus === 'done' ? getLocalTimestamp() : null,
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
            extends_task_id: t.extends_task_id,
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
    setExtendingFromTask(null);
    setIsModalOpen(true);
  };

  const handleShowGtdFlow = () => {
    setGtdFlowOpen(true);
  };

  const handleCloseGtdFlow = () => {
    setGtdFlowOpen(false);
  };

  const handleView = (task: Task) => {
    setViewingTask(task);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setExtendingFromTask(null);
    setIsModalOpen(true);
  };

  /** 编辑任务时加载万里长征关联 */
  const handleEditWithAssociations = async (task: Task) => {
    try {
      const specialIds = await window.electronAPI.getTaskSpecials(task.id).catch(() => []);
      setInitialSpecialIds(specialIds || []);
      setEditingTask(task);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to load task special:', err);
      setInitialSpecialIds([]);
      setEditingTask(task);
      setIsModalOpen(true);
    }
  };

  /** 「扩展任务」：从详情弹窗触发，关闭详情后打开 TaskModal 扩展模式 */
  const handleExtend = (task: Task) => {
    setViewingTask(null);
    setEditingTask(null);
    setExtendingFromTask(task);
    setIsModalOpen(true);
  };

  /** 「扩展自」链接：跳到原任务详情 */
  const handleViewSource = (source: Task) => {
    setViewingTask(source);
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

  const handleSave = async (taskData: Partial<Task>, selectedIds: number[]) => {
    // 把 selectedIds 拆分为：真实 tag id 和 万里长征 id
    // 负数（绝对值 >= 1000000）且不在数据库 specials 中 → 视为万里长征
    const specialIdsFromSelected: number[] = [];
    const tagIdsFromSelected: number[] = [];
    for (const id of selectedIds) {
      if (id < 0 && -id > 1000000) {
        // 虚拟万里长征 id → 转 real special id
        const realSId = -id - 1000000;
        // 验证此 realSId 确实是万里长征
        if (specials.some((s) => s.id === realSId)) {
          specialIdsFromSelected.push(realSId);
        } else {
          // 万里长征已删除 → 忽略
        }
      } else {
        tagIdsFromSelected.push(id);
      }
    }

    if ('id' in taskData && taskData.id) {
      const updated = await window.electronAPI.updateTask(taskData as Partial<Task> & { id: number });
      // 同步标签
      await window.electronAPI.setTaskTags(updated.id, tagIdsFromSelected);
      // 同步万里长征关联
      await window.electronAPI.setTaskSpecials(updated.id, specialIdsFromSelected);
    } else {
      const created = await window.electronAPI.createTask(taskData as Omit<Task, 'id' | 'created_at' | 'completed_at'>);
      if (tagIdsFromSelected.length > 0) {
        await window.electronAPI.setTaskTags(created.id, tagIdsFromSelected);
      }
      if (specialIdsFromSelected.length > 0) {
        await window.electronAPI.setTaskSpecials(created.id, specialIdsFromSelected);
      }
    }
    loadTasks();
    // task-only 模式下保存后关闭窗口
    if (isTaskOnlyMode) {
      (window as any).electronAPI.closeTaskOnlyWindow?.();
    }
    loadTags();
  };

  const handleSetTaskTags = async (taskId: number, tagIds: number[]) => {
    await window.electronAPI.setTaskTags(taskId, tagIds);
    loadTasks();
  };

  const handleCreateTag = async (name: string, color: string) => {
    const t = await window.electronAPI.createTag(name, color);
    await loadTags();
    return t;
  };

  const handleUpdateTag = async (id: number, name: string, color: string) => {
    await window.electronAPI.updateTag(id, name, color);
    await loadTags();
    await loadTasks(); // 任务上的标签名/色也会变
  };

  const handleDeleteTag = async (id: number) => {
    await window.electronAPI.deleteTag(id);
    await loadTags();
    await loadTasks(); // 任务上的标签可能也被清掉
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status && t.parent_id === null);
  };

  // task-only 模式：只渲染任务弹窗（跳过整个主 UI）
  if (isTaskOnlyMode) {
    return (
      <>
        {isModalOpen && (
          <TaskModal
            task={editingTask}
            allTags={tags}
            allSpecials={specials}
            initialSpecialIds={initialSpecialIds}
            extendsFrom={null}
            onCreateTag={handleCreateTag}
            onClose={() => {
              setIsModalOpen(false);
              setEditingTask(null);
              setInitialSpecialIds([]);
              // 通知主进程关闭 taskOnlyWindow
              (window as any).electronAPI.closeTaskOnlyWindow?.();
            }}
            onSave={handleSave}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      <header className="header"></header>

      <div className="main-content">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
              title="一目了然"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {!sidebarCollapsed && <span>一目了然</span>}
            </button>
            <button
              className={`sidebar-item ${currentPage === 'special' ? 'active' : ''}`}
              onClick={() => setCurrentPage('special')}
              title="万里长征"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              {!sidebarCollapsed && <span>万里长征</span>}
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
            <button
              className={`sidebar-item ${currentPage === 'okr' ? 'active' : ''}`}
              onClick={() => setCurrentPage('okr')}
              title="有的放矢"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              {!sidebarCollapsed && <span>有的放矢</span>}
            </button>
          </nav>
          <div className="sidebar-divider"></div>
          <button
            className={`sidebar-item ${currentPage === 'tags' ? 'active' : ''}`}
            onClick={() => setCurrentPage('tags')}
            title="标签"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            {!sidebarCollapsed && <span>标签</span>}
          </button>
          <button
            className={`sidebar-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
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
                {MAIN_COLUMNS.map((column) => (
                  <TaskColumn
                    key={column.id}
                    column={column}
                    tasks={getTasksByStatus(column.id)}
                    onView={handleView}
                    onEdit={handleEditWithAssociations}
                    onDelete={handleDelete}
                    onAddTask={column.id === 'todo' ? handleAddTask : undefined}
                    onShowGtdFlow={column.id === 'todo' ? handleShowGtdFlow : undefined}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeId && selectedTask ? (
                  <div className="drag-overlay">
                    <TaskCard task={selectedTask} onView={() => {}} onEdit={() => {}} onDelete={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {currentPage === 'okr' && (
            <OkrPage />
          )}

          {currentPage === 'special' && (
            <SpecialPage />
          )}

          {currentPage === 'archived' && (
            <ArchiveCalendar
              refreshKey={archiveRefreshKey}
              onOpenDay={async (date, summary) => {
                // 先打开弹窗（避免 await 时弹窗还没挂载）
                setSummaryOpen(true);
                setTodaySummary(summary?.content || '');
                setInitialSummaryDate(date);
                // 拉取当日归档的 task 列表，弹窗打开后会立刻显示
                try {
                  const archived = await window.electronAPI.getTasksByArchiveDate(date);
                  setDayArchivedTasks(archived || []);
                } catch (err) {
                  console.error('Failed to load archived tasks for', date, err);
                  setDayArchivedTasks([]);
                }
              }}
            />
          )}

          {currentPage === 'tags' && (
            <TagsPage
              tags={tags}
              onCreate={handleCreateTag}
              onUpdate={handleUpdateTag}
              onDelete={handleDeleteTag}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              theme={theme}
              onToggleTheme={toggleTheme}
              archiveTime={archiveTime}
              onArchiveTimeChange={(t) => {
                setArchiveTime(t);
                window.electronAPI.setArchiveTime(t).catch(console.error);
              }}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          allTags={tags}
          allSpecials={specials}
          initialSpecialIds={initialSpecialIds}
          extendsFrom={extendingFromTask}
          onCreateTag={handleCreateTag}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
            setExtendingFromTask(null);
            setInitialSpecialIds([]);
          }}
          onSave={handleSave}
        />
      )}

      {gtdFlowOpen && (
        <GtdFlowModal onClose={handleCloseGtdFlow} />
      )}

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          allTasks={tasks}
          onClose={() => setViewingTask(null)}
          onEdit={(t) => {
            setViewingTask(null);
            handleEditWithAssociations(t);
          }}
          onDelete={(id) => {
            setViewingTask(null);
            handleDelete(id);
          }}
          onExtend={handleExtend}
          onViewTask={handleViewSource}
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
          doneTasks={getTasksByStatus('done')}
          initialContent={todaySummary}
          initialDate={initialSummaryDate || todayDateStr}
          archivedTasks={dayArchivedTasks}
          onViewTask={(t) => {
            // 关闭 summary 弹窗，跳到该 task 详情
            setSummaryOpen(false);
            setInitialSummaryDate(undefined);
            setDayArchivedTasks([]);
            setViewingTask(t);
          }}
          onDateChange={async (date) => {
            // 日期变更时刷新 summary 内容和归档任务
            setInitialSummaryDate(date);
            try {
              const summary = await window.electronAPI.getSummary(date);
              setTodaySummary(summary?.content || '');
              const archived = await window.electronAPI.getTasksByArchiveDate(date);
              setDayArchivedTasks(archived || []);
            } catch (err) {
              console.error('Failed to load date data for', date, err);
              setTodaySummary('');
              setDayArchivedTasks([]);
            }
          }}
          onClose={() => {
            setSummaryOpen(false);
            setInitialSummaryDate(undefined);
            setDayArchivedTasks([]);
          }}
          onSave={async (date, content) => {
            try {
              await window.electronAPI.upsertSummary(date, content);
              const archivedCount = await window.electronAPI.archiveDoneTasks(date);
              if (archivedCount > 0) {
                console.log(`[Summary] Archived ${archivedCount} tasks for ${date}`);
              }
              setArchiveRefreshKey((k) => k + 1);
              if (date === todayDateStr) {
                setTodaySummary(content);
              }
              await loadTasks();
              setSummaryOpen(false);
              setInitialSummaryDate(undefined);
            } catch (err) {
              console.error('Failed to save summary:', err);
              alert('保存总结失败：' + (err as Error).message);
            }
          }}
          onDelete={async (date) => {
            try {
              await window.electronAPI.deleteSummary(date);
              setArchiveRefreshKey((k) => k + 1);
              if (date === todayDateStr) {
                setTodaySummary('');
              }
              setSummaryOpen(false);
              setInitialSummaryDate(undefined);
              setDayArchivedTasks([]);
            } catch (err) {
              console.error('Failed to delete summary:', err);
              alert('删除总结失败：' + (err as Error).message);
            }
          }}
        />
      )}
    </div>
  );
};

export default App;
