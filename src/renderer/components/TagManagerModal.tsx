import React, { useState } from 'react';
import { Tag } from '../types';

interface TagManagerModalProps {
  tags: Tag[];
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<Tag | void>;
  onDelete: (id: number) => Promise<void>;
}

/** 预置颜色供用户快速选择 */
const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#d97706',
  '#059669', '#3b82f6', '#8b5cf6',
  '#4a4339', '#6b6357',
];

export const TagManagerModal: React.FC<TagManagerModalProps> = ({ tags, onClose, onCreate, onDelete }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('请输入标签名');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onCreate(name.trim(), color);
      setName('');
      setColor(COLOR_PRESETS[0]);
    } catch (err: any) {
      setError(err?.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('删除此标签？相关任务将自动解除关联。')) return;
    setBusy(true);
    try {
      await onDelete(id);
    } catch (err: any) {
      setError(err?.message || '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="modal-header">
          <h2>标签管理</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>新增标签</label>
            <div className="tag-add-row">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：紧急、重要、跟进"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="modal-btn save"
                onClick={handleAdd}
                disabled={busy || !name.trim()}
              >
                添加
              </button>
            </div>
            <div className="tag-color-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tag-color-dot ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`选择颜色 ${c}`}
                />
              ))}
            </div>
            {error && <div className="tag-error">{error}</div>}
          </div>

          <div className="form-group">
            <label>已有标签</label>
            <div className="tag-list">
              {tags.length === 0 && <div className="task-detail-empty">暂无标签</div>}
              {tags.map((t) => (
                <div key={t.id} className="tag-list-item">
                  <span
                    className="task-tag-chip"
                    style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}
                  >
                    {t.name}
                  </span>
                  <button
                    type="button"
                    className="tag-list-delete"
                    onClick={() => handleDelete(t.id)}
                    disabled={busy}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-btn cancel" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};
