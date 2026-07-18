import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '../types';

interface TagMultiSelectProps {
  allTags: Tag[];
  selectedTagIds: number[];
  onChange: (ids: number[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<Tag | void>;
  placeholder?: string;
}

const DEFAULT_TAG_COLORS = [
  '#ef4444', '#f97316', '#d97706',
  '#059669', '#3b82f6', '#8b5cf6',
  '#4a4339', '#6b6357',
];

/**
 * 标签多选下拉
 * - 点击触发器打开下拉面板
 * - 面板内：搜索 + 复选列表 + 底部「+ 新建标签」入口
 * - 选中后立即回调
 */
export const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  allTags,
  selectedTagIds,
  onChange,
  onCreateTag,
  placeholder = '选择标签',
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 打开后自动聚焦搜索
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setKeyword('');
      setCreateOpen(false);
      setCreateError(null);
    }
  }, [open]);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(keyword.trim().toLowerCase())
  );

  const toggle = (id: number) => {
    onChange(
      selectedTagIds.includes(id)
        ? selectedTagIds.filter((x) => x !== id)
        : [...selectedTagIds, id]
    );
  };

  const removeChip = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onChange(selectedTagIds.filter((x) => x !== id));
  };

  const handleCreate = async () => {
    if (!onCreateTag) return;
    const name = newName.trim();
    if (!name) {
      setCreateError('请输入标签名');
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    try {
      const created = await onCreateTag(name, newColor);
      if (created && (created as Tag).id) {
        const newId = (created as Tag).id;
        if (!selectedTagIds.includes(newId)) {
          onChange([...selectedTagIds, newId]);
        }
      }
      setNewName('');
      setNewColor(DEFAULT_TAG_COLORS[0]);
      setCreateOpen(false);
    } catch (err: any) {
      setCreateError(err?.message || '创建失败');
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="tag-multiselect" ref={rootRef}>
      <button
        type="button"
        className={`tag-multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selectedTags.length === 0 ? (
          <span className="tag-multiselect-placeholder">{placeholder}</span>
        ) : (
          <div className="tag-multiselect-chips">
            {selectedTags.map((t) => (
              <span
                key={t.id}
                className="task-tag-chip tag-multiselect-chip"
                style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}
              >
                {t.name}
                <span
                  className="tag-multiselect-chip-remove"
                  onClick={(e) => removeChip(e, t.id)}
                  title="移除"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <svg
          className="tag-multiselect-arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="tag-multiselect-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="tag-multiselect-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标签..."
            />
          </div>

          <div className="tag-multiselect-list">
            {filteredTags.length === 0 && !createOpen && (
              <div className="tag-multiselect-empty">
                {keyword ? '没有匹配的标签' : '暂无标签'}
              </div>
            )}
            {filteredTags.map((t) => {
              const checked = selectedTagIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`tag-multiselect-item ${checked ? 'checked' : ''}`}
                  style={checked ? { background: `${t.color}14` } : {}}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(t.id)}
                  />
                  <span
                    className="tag-multiselect-dot"
                    style={{ background: t.color }}
                  />
                  <span className="tag-multiselect-name">{t.name}</span>
                  {t.is_preset === 1 && <span className="tag-multiselect-preset">预置</span>}
                </label>
              );
            })}
          </div>

          {onCreateTag && (
            <div className="tag-multiselect-footer">
              {!createOpen ? (
                <button
                  type="button"
                  className="tag-multiselect-create-toggle"
                  onClick={() => setCreateOpen(true)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  新建标签
                </button>
              ) : (
                <div className="tag-multiselect-create-form" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="标签名"
                    maxLength={20}
                    autoFocus
                    disabled={createBusy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setCreateOpen(false);
                        setCreateError(null);
                      }
                    }}
                  />
                  <div className="tag-color-row">
                    {DEFAULT_TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`tag-color-dot ${newColor === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setNewColor(c)}
                      />
                    ))}
                  </div>
                  {createError && <div className="tag-error">{createError}</div>}
                  <div className="tag-inline-actions">
                    <button
                      type="button"
                      className="modal-btn cancel"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={() => {
                        setCreateOpen(false);
                        setCreateError(null);
                      }}
                      disabled={createBusy}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="modal-btn save"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={handleCreate}
                      disabled={createBusy || !newName.trim()}
                    >
                      {createBusy ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
