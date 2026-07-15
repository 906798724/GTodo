import React, { useState, useEffect } from 'react';

export interface ObjectiveData {
  id?: number;
  title: string;
  description: string;
  quarter: string;
  progress: number;
  sort_order: number;
}

interface ObjectiveModalProps {
  objective: ObjectiveData | null;
  onClose: () => void;
  onSave: (data: ObjectiveData) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

// 自动生成当前季度（如 "2026-Q3"）
const currentQuarter = (): string => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
};

export const ObjectiveModal: React.FC<ObjectiveModalProps> = ({ objective, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quarter, setQuarter] = useState(currentQuarter());
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (objective) {
      setTitle(objective.title);
      setDescription(objective.description || '');
      setQuarter(objective.quarter || currentQuarter());
      setProgress(objective.progress || 0);
    } else {
      setTitle('');
      setDescription('');
      setQuarter(currentQuarter());
      setProgress(0);
    }
  }, [objective]);

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...(objective || {}),
        title: title.trim(),
        description: description.trim(),
        quarter: quarter.trim() || currentQuarter(),
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        sort_order: objective?.sort_order || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('确认删除这个目标？\n关联的关键结果也会被删除。')) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal objective-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{objective?.id ? '编辑目标' : '新建目标'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form
          className="modal-body"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <div className="form-group">
            <label>目标 Objective</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：打造高效的产品迭代体系"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="为什么这个目标重要？要达成什么样的结果？"
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>季度</label>
              <input
                type="text"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="2026-Q3"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>进度 {progress}%</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="modal-footer">
            {objective?.id && onDelete && (
              <button
                type="button"
                className="modal-btn danger"
                onClick={handleDelete}
                disabled={saving}
              >
                删除
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="modal-btn cancel" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="modal-btn save" disabled={!title.trim() || saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};