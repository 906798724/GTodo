import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { DndContext, DragEndEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Special {
  id: number;
  title: string;
  description: string;
  color: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Milestone {
  id: number;
  special_id: number;
  title: string;
  description: string;
  due_date: string | null;
  completed: number;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const SpecialPage: React.FC<{ onCreateTask?: (specialId: number) => void }> = ({ onCreateTask }) => {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [tasksBySpecial, setTasksBySpecial] = useState<Map<number, Task[]>>(new Map());
  const [milestonesBySpecial, setMilestonesBySpecial] = useState<Map<number, Milestone[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // 长期任务表单状态
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<Special | null>(null);
  const [specialTitle, setSpecialTitle] = useState('');
  const [specialDescription, setSpecialDescription] = useState('');
  const [specialDueDate, setSpecialDueDate] = useState('');

  // 里程碑表单状态
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneForSpecialId, setMilestoneForSpecialId] = useState<number | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as number;

    const oldIndex = specials.findIndex((s) => s.id === activeId);
    const newIndex = specials.findIndex((s) => s.id === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(specials, oldIndex, newIndex);
    setSpecials(reordered);

    try {
      for (let i = 0; i < reordered.length; i++) {
        await window.electronAPI.updateSpecial(reordered[i].id, {
          sort_order: i,
        });
      }
    } catch (err) {
      console.error('Failed to update special sort order:', err);
      await loadSpecials();
    }
  };

  const SortableSpecialCard: React.FC<{ special: Special; tasks: Task[]; milestones: Milestone[] }> = ({
    special,
    tasks,
    milestones,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: special.id,
    });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 1,
      cursor: 'grab',
    };

    const dueStatus = getDueStatus(special.due_date);
    const completed = completedCount(milestones);
    const total = totalCount(milestones);

    return (
      <div
        key={special.id}
        className="special-card"
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
      >
        <div className="special-card-header">
          <h3>{special.title}</h3>
          <div className="special-card-actions">
            <button
              type="button"
              className="special-action-btn"
              onClick={() => onCreateTask?.(special.id)}
              title="创建关联任务"
              disabled={busy}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button
              type="button"
              className="special-action-btn"
              onClick={() => handleOpenSpecialForm(special)}
              title="编辑"
              disabled={busy}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              type="button"
              className="special-action-btn"
              onClick={() => handleDeleteSpecial(special.id)}
              title="删除"
              disabled={busy}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        {special.description && (
          <p className="special-card-desc">{special.description}</p>
        )}
        <div className="special-card-meta">
          {dueStatus && (
            <span className={`special-due ${dueStatus.className}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {dueStatus.label}
            </span>
          )}
          <span className="special-task-count">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {tasks.length} 个任务
          </span>
          {total > 0 && (
            <span className="special-progress">
              里程碑 {completed}/{total}
            </span>
          )}
        </div>

        {/* 里程碑区块 - 时间线布局 */}
        <div className="special-milestones">
          <div className="milestones-header">
            <span className="milestones-title">里程碑时间线</span>
            <button
              type="button"
              className="milestone-add-btn"
              onClick={() => handleOpenMilestoneForm(special.id)}
              disabled={busy}
            >
              + 添加
            </button>
          </div>
          {milestones.length === 0 ? (
            <div className="milestones-empty">暂无里程碑，点击右上角添加</div>
          ) : (
            <div className="milestone-timeline">
              {milestones.map((m, idx) => {
                const isLast = idx === milestones.length - 1;
                const mDue = m.due_date ? getDueStatus(m.due_date, m.completed === 1) : null;
                return (
                  <div
                    key={m.id}
                    className={`timeline-node ${m.completed === 1 ? 'is-completed' : ''}`}
                  >
                    <div className="timeline-rail">
                      <button
                        type="button"
                        className="timeline-dot"
                        onClick={() => handleToggleMilestone(m)}
                        disabled={busy}
                        title={m.completed === 1 ? '标记为未完成' : '标记为已完成'}
                      >
                        {m.completed === 1 && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                      {!isLast && <div className="timeline-line" />}
                    </div>
                    <div className="timeline-card">
                      <div className="timeline-card-header">
                        <span className="timeline-title">{m.title}</span>
                        <div className="timeline-card-actions">
                          <button
                            type="button"
                            className="milestone-action-btn"
                            onClick={() => handleOpenMilestoneForm(special.id, m)}
                            title="编辑"
                            disabled={busy}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="milestone-action-btn"
                            onClick={() => handleDeleteMilestone(m.id)}
                            title="删除"
                            disabled={busy}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {m.description && (
                        <p className="timeline-desc">{m.description}</p>
                      )}
                      {m.due_date && (
                        <div className="timeline-meta">
                          <span className="timeline-date">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            {m.due_date}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const loadSpecials = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getSpecials();
      setSpecials(data);
      const taskMap = new Map<number, Task[]>();
      const milestoneMap = new Map<number, Milestone[]>();
      for (const s of data) {
        const [tasks, milestones] = await Promise.all([
          window.electronAPI.getTasksBySpecial(s.id),
          window.electronAPI.getMilestones(s.id),
        ]);
        taskMap.set(s.id, tasks);
        milestoneMap.set(s.id, milestones);
      }
      setTasksBySpecial(taskMap);
      setMilestonesBySpecial(milestoneMap);
    } catch (err) {
      console.error('Failed to load specials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpecials();
  }, []);

  // ============ 长期任务 CRUD ============
  const handleOpenSpecialForm = (special?: Special) => {
    if (special) {
      setEditingSpecial(special);
      setSpecialTitle(special.title);
      setSpecialDescription(special.description);
      setSpecialDueDate(special.due_date || '');
    } else {
      setEditingSpecial(null);
      setSpecialTitle('');
      setSpecialDescription('');
      setSpecialDueDate('');
    }
    setError(null);
    setShowSpecialForm(true);
  };

  const handleCloseSpecialForm = () => {
    setShowSpecialForm(false);
    setEditingSpecial(null);
    setSpecialTitle('');
    setSpecialDescription('');
    setSpecialDueDate('');
    setError(null);
  };

  const handleSubmitSpecial = async () => {
    if (!specialTitle.trim()) {
      setError('请输入长期任务名称');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (editingSpecial) {
        await window.electronAPI.updateSpecial(editingSpecial.id, {
          title: specialTitle.trim(),
          description: specialDescription.trim(),
          due_date: specialDueDate || null,
        });
      } else {
        await window.electronAPI.createSpecial({
          title: specialTitle.trim(),
          description: specialDescription.trim(),
          due_date: specialDueDate || null,
        });
      }
      handleCloseSpecialForm();
      await loadSpecials();
    } catch (err: any) {
      setError(err?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSpecial = async (id: number) => {
    if (!window.confirm('删除此长期任务？相关任务和里程碑将自动解除关联。')) return;
    setBusy(true);
    try {
      await window.electronAPI.deleteSpecial(id);
      await loadSpecials();
    } catch (err: any) {
      setError(err?.message || '删除失败');
    } finally {
      setBusy(false);
    }
  };

  // ============ 里程碑 CRUD ============
  const handleOpenMilestoneForm = (specialId: number, milestone?: Milestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForSpecialId(specialId);
      setMilestoneTitle(milestone.title);
      setMilestoneDescription(milestone.description);
      setMilestoneDueDate(milestone.due_date || '');
    } else {
      setEditingMilestone(null);
      setMilestoneForSpecialId(specialId);
      setMilestoneTitle('');
      setMilestoneDescription('');
      setMilestoneDueDate('');
    }
    setError(null);
    setShowMilestoneForm(true);
  };

  const handleCloseMilestoneForm = () => {
    setShowMilestoneForm(false);
    setEditingMilestone(null);
    setMilestoneForSpecialId(null);
    setMilestoneTitle('');
    setMilestoneDescription('');
    setMilestoneDueDate('');
    setError(null);
  };

  const handleSubmitMilestone = async () => {
    if (!milestoneTitle.trim()) {
      setError('请输入里程碑名称');
      return;
    }
    if (milestoneForSpecialId === null) {
      setError('未选择长期任务');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (editingMilestone) {
        await window.electronAPI.updateMilestone(editingMilestone.id, {
          title: milestoneTitle.trim(),
          description: milestoneDescription.trim(),
          due_date: milestoneDueDate || null,
        });
      } else {
        await window.electronAPI.createMilestone({
          special_id: milestoneForSpecialId,
          title: milestoneTitle.trim(),
          description: milestoneDescription.trim(),
          due_date: milestoneDueDate || null,
        });
      }
      handleCloseMilestoneForm();
      await loadSpecials();
    } catch (err: any) {
      setError(err?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    if (!window.confirm('删除此里程碑？')) return;
    setBusy(true);
    try {
      await window.electronAPI.deleteMilestone(id);
      await loadSpecials();
    } catch (err: any) {
      setError(err?.message || '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMilestone = async (milestone: Milestone) => {
    setBusy(true);
    try {
      await window.electronAPI.updateMilestone(milestone.id, {
        completed: milestone.completed === 1 ? false : true,
      });
      await loadSpecials();
    } catch (err: any) {
      setError(err?.message || '更新失败');
    } finally {
      setBusy(false);
    }
  };

  // ============ 工具函数 ============
  const getDueStatus = (dueDate: string | null, completed: boolean = false) => {
    if (!dueDate) return null;
    if (completed) return { label: '已完成', className: 'completed' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return { label: `已逾期 ${-diffDays} 天`, className: 'overdue' };
    if (diffDays === 0) return { label: '今天到期', className: 'today' };
    if (diffDays <= 3) return { label: `${diffDays} 天后`, className: 'soon' };
    return { label: `${diffDays} 天后`, className: 'future' };
  };

  const completedCount = (milestones: Milestone[]) => milestones.filter((m) => m.completed === 1).length;
  const totalCount = (milestones: Milestone[]) => milestones.length;

  return (
    <div className="special-page">
      <div className="okr-header">
        <h2 className="okr-title">万里长征</h2>
        <button
          type="button"
          className="okr-add-btn"
          onClick={() => handleOpenSpecialForm()}
          disabled={busy}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          新建长征路线
        </button>
      </div>

      <div className="special-content">
        {loading ? (
          <div className="empty-state">
            <p>加载中...</p>
          </div>
        ) : specials.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <p>暂无万里长征</p>
            <p className="empty-hint">点击上方「新建万里长征」创建第一个万里长征</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={specials.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="special-list">
                {specials.map((special) => {
                  const tasks = tasksBySpecial.get(special.id) || [];
                  const milestones = milestonesBySpecial.get(special.id) || [];
                  return (
                    <SortableSpecialCard
                      key={special.id}
                      special={special}
                      tasks={tasks}
                      milestones={milestones}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 长期任务弹窗 */}
      {showSpecialForm && (
        <div className="modal-overlay" onClick={handleCloseSpecialForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div className="modal-header">
              <h2>{editingSpecial ? '编辑万里长征' : '新建万里长征'}</h2>
              <button className="modal-close" onClick={handleCloseSpecialForm}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>万里长征名称</label>
                <input
                  type="text"
                  value={specialTitle}
                  onChange={(e) => setSpecialTitle(e.target.value)}
                  placeholder="例如：产品发布、项目调研"
                  maxLength={50}
                  disabled={busy}
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={specialDescription}
                  onChange={(e) => setSpecialDescription(e.target.value)}
                  placeholder="添加万里长征描述（可选）"
                  rows={3}
                  maxLength={200}
                  disabled={busy}
                />
              </div>
              <div className="form-group">
                <label>DDL（截止日期）</label>
                <input
                  type="date"
                  value={specialDueDate}
                  onChange={(e) => setSpecialDueDate(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && <div className="tag-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-btn cancel" onClick={handleCloseSpecialForm} disabled={busy}>取消</button>
              <button
                type="button"
                className="modal-btn save"
                onClick={handleSubmitSpecial}
                disabled={busy || !specialTitle.trim()}
              >
                {editingSpecial ? '保存修改' : '创建万里长征'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 里程碑弹窗 */}
      {showMilestoneForm && (
        <div className="modal-overlay" onClick={handleCloseMilestoneForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div className="modal-header">
              <h2>{editingMilestone ? '编辑里程碑' : '新建里程碑'}</h2>
              <button className="modal-close" onClick={handleCloseMilestoneForm}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>里程碑名称</label>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="例如：完成原型设计、发布 v1.0"
                  maxLength={50}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmitMilestone();
                    }
                  }}
                  disabled={busy}
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={milestoneDescription}
                  onChange={(e) => setMilestoneDescription(e.target.value)}
                  placeholder="添加里程碑描述（可选）"
                  rows={2}
                  maxLength={200}
                  disabled={busy}
                />
              </div>
              <div className="form-group">
                <label>DDL（截止日期）</label>
                <input
                  type="date"
                  value={milestoneDueDate}
                  onChange={(e) => setMilestoneDueDate(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && <div className="tag-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-btn cancel" onClick={handleCloseMilestoneForm} disabled={busy}>取消</button>
              <button
                type="button"
                className="modal-btn save"
                onClick={handleSubmitMilestone}
                disabled={busy || !milestoneTitle.trim()}
              >
                {editingMilestone ? '保存修改' : '创建里程碑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};