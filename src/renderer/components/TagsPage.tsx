import React, { useState } from 'react';
import { Tag } from '../types';

interface TagsPageProps {
  tags: Tag[];
  onCreate: (name: string, color: string) => Promise<Tag | void>;
  onUpdate: (id: number, name: string, color: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#d97706',
  '#059669', '#3b82f6', '#8b5cf6',
  '#4a4339', '#6b6357',
];

export const TagsPage: React.FC<TagsPageProps> = ({ tags, onCreate, onUpdate, onDelete }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 编辑态：editingId 持有正在编辑的 tag id
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLOR_PRESETS[0]);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleStartEdit = (t: Tag) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('标签名不能为空');
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      await onUpdate(editingId, trimmed, editColor);
      setEditingId(null);
    } catch (err: any) {
      setEditError(err?.message || '更新失败');
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
    <div className="tags-page">
      <div className="page-header">
        <h1>标签</h1>
        <p className="page-subtitle">管理任务标签</p>
      </div>

      <div className="tags-content">
        <div className="tags-add-section">
          <h2 className="settings-group-title">新增标签</h2>
          <div className="form-group">
            <label>标签名称</label>
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
        </div>

        <div className="tags-list-section">
          <h2 className="settings-group-title">已有标签（{tags.length}）</h2>
          {tags.length === 0 ? (
            <div className="task-detail-empty">暂无标签</div>
          ) : (
            <div className="tag-list">
              {tags.map((t) => {
                const editing = editingId === t.id;
                return (
                  <div key={t.id} className="tag-list-item">
                    {editing ? (
                      <>
                        <div className="tag-color-dot active" style={{ background: editColor, flexShrink: 0 }} />
                        <input
                          type="text"
                          className="tag-edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={20}
                          disabled={busy}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <div className="tag-color-row tag-color-row-inline">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`tag-color-dot ${editColor === c ? 'active' : ''}`}
                              style={{ background: c }}
                              onClick={() => setEditColor(c)}
                              aria-label={`选择颜色 ${c}`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="modal-btn save tag-list-save"
                          onClick={handleSaveEdit}
                          disabled={busy || !editName.trim()}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="modal-btn cancel tag-list-cancel"
                          onClick={handleCancelEdit}
                          disabled={busy}
                        >
                          取消
                        </button>
                        {editError && <span className="tag-error-inline">{editError}</span>}
                      </>
                    ) : (
                      <>
                        <span
                          className="task-tag-chip"
                          style={{
                            background: `${t.color}22`,
                            color: t.color,
                            borderColor: `${t.color}55`,
                          }}
                        >
                          {t.name}
                        </span>
                        <button
                          type="button"
                          className="tag-list-edit"
                          onClick={() => handleStartEdit(t)}
                          disabled={busy}
                          title="编辑"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="tag-list-delete"
                          onClick={() => handleDelete(t.id)}
                          disabled={busy}
                          title="删除"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
