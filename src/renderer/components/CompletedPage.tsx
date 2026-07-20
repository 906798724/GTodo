import React, { useState, useMemo } from 'react';
import { Task, Tag } from '../types';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';

interface CompletedPageProps {
  tasks: Task[];
  tags: Tag[];
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onExtend: (task: Task) => void;
  onViewTask: (task: Task) => void;
}

const PAGE_SIZE = 10;

export const CompletedPage: React.FC<CompletedPageProps> = ({ tasks, tags, onEdit, onDelete, onExtend, onViewTask }) => {
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (selectedTagId !== null) {
      result = result.filter((task) => {
        if (!task.tags) return false;
        return task.tags.some((tag) => tag.id === selectedTagId);
      });
    }

    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart);
      startDate.setHours(0, 0, 0, 0);
      result = result.filter((task) => {
        if (!task.completed_at) return false;
        const completedDate = new Date(task.completed_at);
        return completedDate >= startDate;
      });
    }

    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter((task) => {
        if (!task.completed_at) return false;
        const completedDate = new Date(task.completed_at);
        return completedDate <= endDate;
      });
    }

    return result.sort((a, b) => {
      const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [tasks, selectedTagId, dateRangeStart, dateRangeEnd]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const groupedTasks = useMemo(() => {
    return paginatedTasks.reduce((groups, task) => {
      const date = task.completed_at ? formatDate(task.completed_at) : '未知日期';
      if (!groups[date]) groups[date] = [];
      groups[date].push(task);
      return groups;
    }, {} as Record<string, Task[]>);
  }, [paginatedTasks]);

  const clearFilters = () => {
    setSelectedTagId(null);
    setDateRangeStart('');
    setDateRangeEnd('');
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const hasFilters = selectedTagId !== null || dateRangeStart || dateRangeEnd;

  return (
    <div className="completed-page">
      <div className="completed-page-header">
        <h2>告一段落</h2>
        <span className="completed-page-count">共 {filteredTasks.length} 个任务</span>
      </div>

      <div className="completed-page-filters">
        <div className="filter-group">
          <label className="filter-label">标签</label>
          <select
            className="filter-select"
            value={selectedTagId ?? ''}
            onChange={(e) => {
              setSelectedTagId(e.target.value ? Number(e.target.value) : null);
              setCurrentPage(1);
            }}
          >
            <option value="">全部标签</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">开始日期</label>
          <input
            type="date"
            className="filter-date"
            value={dateRangeStart}
            onChange={(e) => {
              setDateRangeStart(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">结束日期</label>
          <input
            type="date"
            className="filter-date"
            value={dateRangeEnd}
            onChange={(e) => {
              setDateRangeEnd(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {hasFilters && (
          <button className="filter-clear" onClick={clearFilters}>
            清除筛选
          </button>
        )}
      </div>

      <div className="completed-page-content">
        {Object.keys(groupedTasks).length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="16 10 10 16 8 14"/>
            </svg>
            <p>暂无已完成任务</p>
          </div>
        ) : (
          <div className="completed-groups">
            {Object.keys(groupedTasks).map((date) => (
              <div key={date} className="completed-group">
                <div className="completed-group-date">{date}</div>
                <div className="completed-group-tasks">
                  {groupedTasks[date].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onView={(t) => setViewingTask(t)}
                      onEdit={(t) => onEdit(t)}
                      onDelete={(id) => onDelete(id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="completed-page-pagination">
          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="pagination-info">
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          allTasks={tasks}
          onClose={() => setViewingTask(null)}
          onEdit={(t) => { setViewingTask(null); onEdit(t); }}
          onDelete={(id) => { setViewingTask(null); onDelete(id); }}
          onExtend={(t) => { setViewingTask(null); onExtend(t); }}
          onViewTask={onViewTask}
        />
      )}
    </div>
  );
};