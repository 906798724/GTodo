import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';

interface SummaryModalProps {
  doneTasks?: Task[];
  initialContent?: string;
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (date: string, content: string) => void | Promise<void>;
  onDelete?: (date: string) => void | Promise<void>;
  archivedTasks?: Task[];
  onViewTask?: (task: Task) => void;
  onDateChange?: (date: string) => void;
}



const todayStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

export const SummaryModal: React.FC<SummaryModalProps> = ({
  doneTasks = [],
  initialContent = '',
  initialDate,
  onClose,
  onSave,
  onDelete,
  archivedTasks = [],
  onViewTask,
  onDateChange,
}) => {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [date, setDate] = useState(initialDate || todayStr);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isToday = date === todayStr;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate && newDate !== date) {
      setDate(newDate);
      onDateChange && onDateChange(newDate);
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(date, content.trim());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!content.trim() || deleting || !onDelete) return;
    if (!window.confirm('确定要删除这条总结吗？此操作不可撤销。')) return;
    setDeleting(true);
    try {
      await onDelete(date);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="summary-header-left">
            <h2>{isToday ? '今日总结' : '总结'}</h2>
            <input
              type="date"
              className="summary-date-picker"
              value={date}
              onChange={handleDateChange}
              max={todayStr}
              title="选择总结日期"
            />
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 雁过留痕打开时：侧边展示当日已归档的 task */}
          {archivedTasks.length > 0 && (
            <div className="summary-archived-panel">
              <div className="summary-archived-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8v13H3V8"/>
                  <path d="M1 3h22v5H1z"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                当日已完成 task（{archivedTasks.length}）
              </div>
              <ul className="summary-archived-list">
                {archivedTasks.map((t) => (
                  <li
                    key={t.id}
                    className="summary-archived-item"
                    onClick={() => onViewTask && onViewTask(t)}
                    title="点击查看任务详情"
                  >
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doneTasks.length > 0 && (
            <div className="summary-archived-panel">
              <div className="summary-archived-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Done 列已完成任务（{doneTasks.length}）
              </div>
              <ul className="summary-archived-list">
                {doneTasks.map((t) => (
                  <li
                    key={t.id}
                    className="summary-archived-item"
                    onClick={() => onViewTask && onViewTask(t)}
                    title="点击查看任务详情"
                  >
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-group">
            <label>总结内容</label>
            <textarea
              ref={textareaRef}
              className="summary-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写点啥都行，3 句话起步……&#10;&#10;示例：&#10;✅ 已完成：需求评审、bug 修复&#10;🚧 进行中：接口联调&#10;💡 下一步：明天上线"
              rows={10}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn cancel" onClick={onClose}>
            取消
          </button>
          {content.trim() && onDelete && (
            <button
              type="button"
              className="modal-btn delete"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '删除总结'}
            </button>
          )}
          <button
            type="button"
            className="modal-btn save"
            onClick={handleSubmit}
            disabled={!content.trim() || saving}
          >
            {saving ? '保存中...' : '保存总结'}
          </button>
        </div>
      </div>
    </div>
  );
};
