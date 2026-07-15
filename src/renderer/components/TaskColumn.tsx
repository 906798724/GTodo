import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Task, Column } from '../types';

interface TaskColumnProps {
  column: Column;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onAddTask?: () => void;
  onSummary?: () => void;
}

export const TaskColumn: React.FC<TaskColumnProps> = ({ column, tasks, onEdit, onDelete, onAddTask, onSummary }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="column">
      <div className="column-header">
        <div className="column-title">
          <span>{column.icon}</span>
          <h2>{column.title}</h2>
        </div>
        <div className="column-header-right">
          {onSummary && (
            <button className="summary-btn" onClick={onSummary} title="今日总结">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>总结</span>
            </button>
          )}
          {onAddTask && (
            <button className="add-task-btn" onClick={onAddTask}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
          <span className="column-count">{tasks.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`column-content ${isOver ? 'is-over' : ''}`}
      >
        {tasks.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p>暂无任务</p>
          </div>
        ) : (
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
};
