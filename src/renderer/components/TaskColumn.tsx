import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Task, Column } from '../types';

interface TaskColumnProps {
  column: Column;
  tasks: Task[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onAddTask?: () => void;
  onShowGtdFlow?: () => void;
}

export const TaskColumn: React.FC<TaskColumnProps> = ({ column, tasks, onView, onEdit, onDelete, onAddTask, onShowGtdFlow }) => {
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
          {onShowGtdFlow && (
            <button className="gtd-flow-btn" onClick={onShowGtdFlow} title="GTD流程图">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
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
                onView={onView}
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
