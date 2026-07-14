import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [expectedDate, setExpectedDate] = useState('');
  const [subtasks, setSubtasks] = useState<{ id: number; title: string; completed: boolean }[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setExpectedDate(task.expected_date || '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setExpectedDate('');
      setSubtasks([]);
    }
  }, [task]);

  const handleAddSubtask = () => {
    setSubtasks([...subtasks, { id: Date.now(), title: '', completed: false }]);
  };

  const handleRemoveSubtask = (id: number) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const handleUpdateSubtask = (id: number, field: 'title' | 'completed', value: string | boolean) => {
    setSubtasks(
      subtasks.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updatedTask: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      status,
      expected_date: expectedDate || null,
    };

    if (task) {
      updatedTask.id = task.id;
    }

    onSave(updatedTask);

    subtasks.forEach((subtask) => {
      if (subtask.title.trim()) {
        const newSubtask: Partial<Task> = {
          title: subtask.title.trim(),
          description: '',
          status: subtask.completed ? 'done' : 'todo',
          parent_id: task?.id || null,
          expected_date: null,
        };
        if (!task) {
          onSave(newSubtask);
        }
      }
    });

    onClose();
  };

  if (!task && !title && !description && subtasks.length === 0) {
    // 新建模式下立即显示
    // 仅在父组件没有控制 modal 显示时才隐藏
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? '编辑任务' : '新建任务'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>任务标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述（可选）"
            />
          </div>
          <div className="form-group">
            <label>状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">📝 Todo</option>
              <option value="wip">⚡ WIP</option>
              <option value="waited">⏳ Waited</option>
              <option value="done">✅ Done</option>
            </select>
          </div>
          <div className="form-group">
            <label>期望完成时间</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
          <div className="subtasks-section">
            <div className="subtasks-title">子任务</div>
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="subtask-item">
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={(e) => handleUpdateSubtask(subtask.id, 'completed', e.target.checked)}
                />
                <input
                  type="text"
                  value={subtask.title}
                  onChange={(e) => handleUpdateSubtask(subtask.id, 'title', e.target.value)}
                  placeholder="子任务标题"
                />
                <button type="button" onClick={() => handleRemoveSubtask(subtask.id)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-subtask-btn" onClick={handleAddSubtask}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              添加子任务
            </button>
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-btn cancel" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="modal-btn save">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
