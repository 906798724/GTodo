import React, { useState, useEffect } from 'react';

export interface KeyResultData {
  id?: number;
  objective_id: number;
  title: string;
  progress: number;
  sort_order: number;
}

interface KeyResultModalProps {
  kr: KeyResultData | null;
  objectiveId: number;
  onClose: () => void;
  onSave: (data: KeyResultData) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

export const KeyResultModal: React.FC<KeyResultModalProps> = ({ kr, objectiveId, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (kr) {
      setTitle(kr.title);
      setProgress(kr.progress || 0);
    } else {
      setTitle('');
      setProgress(0);
    }
  }, [kr]);

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...(kr || {}),
        objective_id: kr?.objective_id || objectiveId,
        title: title.trim(),
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        sort_order: kr?.sort_order || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('确认删除这个关键结果？')) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal kr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{kr?.id ? '编辑关键结果' : '新建关键结果'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form
          className="modal-body"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <div className="form-group">
            <label>关键结果 Key Result</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：发布 3 个新版本；用户满意度达到 90%"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>完成进度 {progress}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </div>
          <div className="modal-footer">
            {kr?.id && onDelete && (
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