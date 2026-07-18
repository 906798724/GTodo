import React, { useState, useEffect } from 'react';
import { Task, Tag } from '../types';
import { TagMultiSelect } from './TagMultiSelect';

interface TaskModalProps {
  task: Task | null;
  allTags?: Tag[];
  onClose: () => void;
  onSave: (task: Partial<Task>, tagIds?: number[]) => void;
  /** 在弹窗内快速创建新标签（可选） */
  onCreateTag?: (name: string, color: string) => Promise<Tag | void>;
  /** 「扩展任务」模式：新建的任务会关联到这个原任务上 */
  extendsFrom?: Task | null;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  allTags = [],
  onClose,
  onSave,
  onCreateTag,
  extendsFrom = null,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [subtasks, setSubtasks] = useState<{ id: number; title: string; completed: boolean }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setExpectedDate(task.expected_date || '');
      setSelectedTagIds((task.tags || []).map((t) => t.id));
    } else {
      setTitle('');
      setDescription('');
      setExpectedDate('');
      setSubtasks([]);
      setSelectedTagIds([]);
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
      status: task ? task.status : 'todo',
      expected_date: expectedDate || null,
    };

    if (task) {
      updatedTask.id = task.id;
    } else if (extendsFrom) {
      // 「扩展任务」模式：写入 extends_task_id
      updatedTask.extends_task_id = extendsFrom.id;
    }

    onSave(updatedTask, selectedTagIds);

    subtasks.forEach((subtask) => {
      if (subtask.title.trim()) {
        const newSubtask: Partial<Task> = {
          title: subtask.title.trim(),
          description: '',
          status: subtask.completed ? 'done' : 'todo',
          parent_id: task?.id || null,
          extends_task_id: null,
          expected_date: null,
        };
        if (!task) {
          onSave(newSubtask, []);
        }
      }
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>
              {task ? '编辑任务' : extendsFrom ? '扩展任务' : '新建任务'}
            </h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          {!task && extendsFrom && (
            <div className="task-modal-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>
                扩展自：<strong>{extendsFrom.title}</strong>
              </span>
              <span className="task-modal-banner-hint">新任务仅会单向引用此任务，原任务中不会显示关联。</span>
            </div>
          )}
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
              <label>期望完成时间</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>标签</label>
              <TagMultiSelect
                allTags={allTags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
                onCreateTag={onCreateTag}
                placeholder="点击选择标签（可多选）"
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
    </div>
  );
};
