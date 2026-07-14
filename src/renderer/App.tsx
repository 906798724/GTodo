import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskColumn } from './components/TaskColumn';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Task, TaskStatus, COLUMNS } from './types';
import './styles/main.css';

declare global {
  interface Window {
    electronAPI: {
      getTasks: () => Promise<Task[]>;
      createTask: (task: Omit<Task, 'id' | 'created_at' | 'completed_at'>) => Promise<Task>;
      updateTask: (task: Partial<Task> & { id: number }) => Promise<Task>;
      deleteTask: (id: number) => Promise<void>;
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
      <header className="header">
        <div className="header-title">
          <span>📋</span>
          <h1>GTodo</h1>
        </div>
        <div className="header-right">
          <div className="header-shortcut">
            <span>快速添加:</span>
            <kbd>Ctrl</kbd>
            <span>+</span>
            <kbd>Shift</kbd>
            <span>+</span>
            <kbd>B</kbd>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="切换主题">
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
        </div>
      </header>

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
    </div>
  );
};

export default App;
