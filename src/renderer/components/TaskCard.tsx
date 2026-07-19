import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Tag } from '../types';
import { extractFirstImage } from '../utils/descParser';

interface TaskCardProps {
  task: Task;
  onView: (task: Task) => void;   // 点击卡片查看详情
  onEdit: (task: Task) => void;   // 右侧编辑按钮
  onDelete: (id: number) => void; // 右侧删除按钮
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onView, onEdit, onDelete }) => {
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
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  // 描述悬浮预览：hover ⓘ 图标时显示完整描述
  const [descHover, setDescHover] = useState(false);
  const [descAnchor, setDescAnchor] = useState<{ x: number; y: number } | null>(null);
  const hasDescription = !!(task.description && task.description.trim());

  // 提取首张图片（用于 tooltip 内展示）
  const firstImage = hasDescription ? extractFirstImage(task.description) : null;

  const handleDescEnter = (e: React.MouseEvent) => {
    setDescAnchor({ x: e.clientX, y: e.clientY });
    setDescHover(true);
  };
  const handleDescLeave = () => {
    setDescHover(false);
    setDescAnchor(null);
  };
  const handleDescMove = (e: React.MouseEvent) => {
    if (descHover) setDescAnchor({ x: e.clientX, y: e.clientY });
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

    if (diffMin < 1) return '刚刚';
    if (diffHour < 1) return `${diffMin} 分钟前`;
    if (diffDay < 1) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCompletedAt = (dateString: string | null) => {
    if (!dateString) return null;
    const date = parseDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚完成';
    if (diffHour < 1) return `${diffMin} 分钟前完成`;
    if (diffDay < 1) return `${diffHour} 小时前完成`;
    if (diffDay < 7) return `${diffDay} 天前完成`;
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    }) + ' 完成';
  };

  const isOverdue = () => {
    if (task.status !== 'todo' || !task.created_at) return false;
    const date = parseDate(task.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    return diffDays >= 7;
  };

  const tags: Tag[] = task.tags || [];

  // 描述悬浮预览：固定定位 + 鼠标坐标锚定
  const previewMaxWidth = 360;
  const previewLeft = descAnchor ? Math.min(descAnchor.x + 14, window.innerWidth - previewMaxWidth - 20) : 0;
  const previewTop = descAnchor ? descAnchor.y + 14 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${task.status} ${isDragging ? 'dragging' : ''} ${isOverdue() ? 'overdue' : ''}`}
    >
      {/* 主体内容区（点击查看详情 + 拖动手柄） */}
      <div
        className="task-card-main"
        onClick={(e) => {
          // 防止点击 description / tags 等子元素时触发详情
          if ((e.target as HTMLElement).closest('.task-desc-preview, .task-tag-chip')) return;
          onView(task);
        }}
        {...attributes}
        {...listeners}
      >
        <div className="task-title">
        {task.title}
      </div>

        {hasDescription && (
          <div className="task-desc-icon-only" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="task-desc-info-btn"
              onMouseEnter={handleDescEnter}
              onMouseLeave={handleDescLeave}
              onMouseMove={handleDescMove}
              onClick={(e) => e.stopPropagation()}
              title="悬浮查看描述"
              aria-label="查看描述详情"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </div>
        )}

        {tags.length > 0 && (
          <div className="task-tags" onClick={(e) => e.stopPropagation()}>
            {tags.map((t) => (
              <span
                key={t.id}
                className="task-tag-chip"
                style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}
                title={t.name}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

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
          {task.completed_at && (
            <span className="task-meta-item" title={formatFullDate(task.completed_at)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {formatCompletedAt(task.completed_at)}
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
      </div>

      {/* 右侧竖向操作按钮列 */}
      <div className="task-actions-vertical">
        <button
          className="task-action-btn edit"
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          title="编辑"
          aria-label="编辑"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          className="task-action-btn delete"
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          title="删除"
          aria-label="删除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      {/* 描述详情 tooltip：hover ⓘ 图标时显示 */}
      {hasDescription && descHover && descAnchor && (
        <div
          className="task-desc-tooltip"
          style={{ left: previewLeft, top: previewTop, maxWidth: previewMaxWidth }}
        >
          <div className="task-desc-tooltip-title">描述详情</div>
          {firstImage && (
            <div className="task-desc-tooltip-image">
              <img src={firstImage} alt="" />
            </div>
          )}
          <div className="task-desc-tooltip-content">{task.description}</div>
        </div>
      )}
    </div>
  );
};
