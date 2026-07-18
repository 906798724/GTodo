import React from 'react';
import { Task, Tag } from '../types';

interface TaskDetailModalProps {
  task: Task;
  allTasks: Task[]; // 用于解析「扩展自」原任务标题
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  /** 点击「扩展任务」时调用，App 收到后打开 TaskModal 扩展模式 */
  onExtend: (task: Task) => void;
  /** 点击「扩展自」原任务链接时调用，App 收到后跳到该任务详情 */
  onViewTask: (task: Task) => void;
}

/**
 * 任务详情查看弹窗（只读）
 * - 标签只展示，不支持在此修改（修改请用「编辑」入口）
 * - 「扩展任务」按钮：基于当前任务新建关联任务
 * - 「扩展自」链接：跳到原任务详情
 */
export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  allTasks,
  onClose,
  onEdit,
  onDelete,
  onExtend,
  onViewTask,
}) => {
  const sourceTask = task.extends_task_id
    ? allTasks.find((t) => t.id === task.extends_task_id) || null
    : null;
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const d = new Date(dateString.includes('T') ? dateString : dateString.replace(' ', 'T'));
    return d.toLocaleString('zh-CN');
  };

  const tags: Tag[] = task.tags || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>任务详情</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="task-detail-title">{task.title}</div>

          <div className="task-detail-tags">
            {tags.length > 0 ? (
              tags.map((t) => (
                <span
                  key={t.id}
                  className="task-tag-chip"
                  style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}
                >
                  {t.name}
                </span>
              ))
            ) : (
              <span className="task-detail-empty">（无标签，可在编辑中添加）</span>
            )}
          </div>

          <div className="task-detail-field">
            <div className="task-detail-label">描述</div>
            <div className="task-detail-value task-detail-desc">
              {task.description ? task.description : <span className="task-detail-empty">（无描述）</span>}
            </div>
          </div>

          <div className="task-detail-field">
            <div className="task-detail-label">期望完成时间</div>
            <div className="task-detail-value">{task.expected_date || '—'}</div>
          </div>

          {sourceTask && (
            <div className="task-detail-field">
              <div className="task-detail-label">扩展自</div>
              <div className="task-detail-value">
                <button
                  type="button"
                  className="task-source-link"
                  onClick={() => onViewTask(sourceTask)}
                  title="查看原任务详情"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="task-source-link-title">{sourceTask.title}</span>
                </button>
              </div>
            </div>
          )}

          <div className="task-detail-field">
            <div className="task-detail-label">创建时间</div>
            <div className="task-detail-value">{formatDate(task.created_at)}</div>
          </div>

          {task.completed_at && (
            <div className="task-detail-field">
              <div className="task-detail-label">完成时间</div>
              <div className="task-detail-value">{formatDate(task.completed_at)}</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="modal-btn danger"
            onClick={() => {
              if (window.confirm('确定要删除这个任务吗？此操作无法撤销。')) {
                onDelete(task.id);
                onClose();
              }
            }}
          >
            删除
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="modal-btn extend"
            onClick={() => onExtend(task)}
            title="基于此任务新建一个关联任务"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            扩展任务
          </button>
          <button type="button" className="modal-btn cancel" onClick={onClose}>关闭</button>
          <button
            type="button"
            className="modal-btn save"
            onClick={() => {
              onClose();
              // 等待关闭动画结束再打开编辑弹窗
              setTimeout(() => onEdit(task), 50);
            }}
          >
            编辑
          </button>
        </div>
      </div>
    </div>
  );
};
