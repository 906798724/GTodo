import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // 拖动时使用快速过渡，松手后无过渡（避免回弹）
    transition: isDragging ? 'none' : transition,
    // 拖动时降低被拖元素的透明度，增强视觉层次
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
    // 拖动时禁用过渡的 transform 累积
    cursor: isDragging ? 'grabbing' : 'grab',
    willChange: isDragging ? 'transform' : 'auto',
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const parseDate = (dateString: string): Date => {
    // SQLite 格式 'YYYY-MM-DD HH:MM:SS' 没有时区信息，需要当作本地时间解析
    if (dateString.includes('T') || dateString.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateString)) {
      return new Date(dateString);
    }
    return new Date(dateString.replace(' ', 'T'));
  };

  const formatFullDate = (dateString: string): string => {
    return parseDate(dateString).toLocaleString('zh-CN');
  };

  const formatCreatedAt = (dateString: string | null) => {
    if (!dateString) return null;
    const date = parseDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    // 1 分钟内：刚刚
    if (diffMin < 1) return '刚刚';
    // 1 小时内：xx 分钟前
    if (diffHour < 1) return `${diffMin} 分钟前`;
    // 24 小时内：xx 小时前
    if (diffDay < 1) return `${diffHour} 小时前`;
    // 7 天内：xx 天前
    if (diffDay < 7) return `${diffDay} 天前`;
    // 超过 7 天：显示具体日期
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${task.status} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        {task.created_at && (
          <span className="task-meta-item" title={formatFullDate(task.created_at)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatCreatedAt(task.created_at)}
          </span>
        )}
        {task.description && (
          <span className="task-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            有描述
          </span>
        )}
        {task.expected_date && (
          <span className="task-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formatDate(task.expected_date)}
          </span>
        )}
      </div>
      <div className="task-actions">
        <button className="task-action-btn edit" onClick={() => onEdit(task)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑
        </button>
        <button className="task-action-btn delete" onClick={() => onDelete(task.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除
        </button>
      </div>
    </div>
  );
};
