import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '../types';

/** 选中的虚拟万里长征项 id 计算公式 */
const SPECIAL_VIRTUAL_BASE = 1000000;

/** 把 special_id 转换为虚拟 id（负数，绝对值 > SPECIAL_VIRTUAL_BASE） */
export const virtualSpecialId = (specialId: number) => -(SPECIAL_VIRTUAL_BASE + specialId);

/** 把虚拟 id 解析回 special_id（如果不是特殊虚拟 id 则返回 null） */
export const realSpecialIdFromVirtual = (virtualId: number): number | null => {
  if (virtualId < 0 && -virtualId > SPECIAL_VIRTUAL_BASE) {
    return -virtualId - SPECIAL_VIRTUAL_BASE;
  }
  return null;
};

interface TaskTagMultiSelectProps {
  allTags: Tag[];
  specials: { id: number; title: string; color?: string }[];
  selectedIds: number[]; // 同时包含真实 tag id（正数）和虚拟 special id（负数）
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
 * 任务标签 + 万里长征 混合下拉
 * - 选中项既可能是真实 tag（正 id），也可能是万里长征（负 id，加偏移量）
 * - 选中万里长征时显示「【万里长征: 名称】」
 * - 选中真实 tag 时显示「名称」
 */
export const TaskTagMultiSelect: React.FC<TaskTagMultiSelectProps> = ({
  allTags,
  specials,
  selectedIds,
  onChange,
  onCreateTag,
  placeholder = '选择标签 / 万里长征',
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

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setKeyword('');
      setCreateOpen(false);
      setCreateError(null);
    }
  }, [open]);

  // 已选中的标签
  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));
  // 已选中的万里长征（虚拟 id → 真实 special id）
  const selectedSpecials = specials.filter((s) => selectedIds.includes(virtualSpecialId(s.id)));

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  const removeChip = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  const filteredTags = allTags.filter((t) =>
    keyword.trim() === '' ? true : t.name.toLowerCase().includes(keyword.trim().toLowerCase())
  );
  const filteredSpecials = specials.filter((s) =>
    keyword.trim() === ''
      ? true
      : s.title.toLowerCase().includes(keyword.trim().toLowerCase()) ||
        `万里长征: ${s.title}`.toLowerCase().includes(keyword.trim().toLowerCase())
  );

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
        if (!selectedIds.includes(newId)) {
          onChange([...selectedIds, newId]);
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
        {selectedTags.length === 0 && selectedSpecials.length === 0 ? (
          <span className="tag-multiselect-placeholder">{placeholder}</span>
        ) : (
          <div className="tag-multiselect-chips">
            {selectedSpecials.map((s) => (
              <span
                key={`sp-${s.id}`}
                className="task-tag-chip tag-multiselect-chip"
                style={{
                  background: `${s.color || '#4a4339'}22`,
                  color: s.color || '#4a4339',
                  borderColor: `${s.color || '#4a4339'}55`,
                }}
              >
                万里长征: {s.title}
                <span
                  className="tag-multiselect-chip-remove"
                  onClick={(e) => removeChip(e, virtualSpecialId(s.id))}
                  title="移除"
                >
                  ×
                </span>
              </span>
            ))}
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
              placeholder="搜索标签或万里长征..."
            />
          </div>

          <div className="tag-multiselect-list">
            {/* 万里长征和标签混合在同一列表中，不再分组 */}
            {filteredSpecials.map((s) => {
              const vid = virtualSpecialId(s.id);
              const checked = selectedIds.includes(vid);
              return (
                <label
                  key={`sp-${s.id}`}
                  className={`tag-multiselect-item ${checked ? 'checked' : ''}`}
                  style={checked ? { background: `${s.color || '#4a4339'}14` } : {}}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(vid)}
                  />
                  <span
                    className="tag-multiselect-dot"
                    style={{ background: s.color || '#4a4339' }}
                  />
                  <span className="tag-multiselect-name">万里长征: {s.title}</span>
                </label>
              );
            })}

            {filteredTags.map((t) => {
              const checked = selectedIds.includes(t.id);
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
                  <span className="tag-multiselect-dot" style={{ background: t.color }} />
                  <span className="tag-multiselect-name">{t.name}</span>
                </label>
              );
            })}

            {filteredTags.length === 0 && filteredSpecials.length === 0 && !createOpen && (
              <div className="tag-multiselect-empty">
                {keyword ? '没有匹配的标签或万里长征' : '暂无标签或万里长征'}
              </div>
            )}
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

/**
 * 把 selectedIds 拆分为：真实 tag id 列表 和 万里长征 id 列表
 */
export function splitSelectedIds(
  selectedIds: number[],
  realSpecialIds: number[]
): { tagIds: number[]; specialIds: number[] } {
  const realSpecialIdSet = new Set(realSpecialIds);
  const tagIds: number[] = [];
  const specialIds: number[] = [];
  for (const id of selectedIds) {
    const realSId = realSpecialIdFromVirtual(id);
    if (realSId !== null && realSpecialIdSet.has(realSId)) {
      specialIds.push(realSId);
    } else {
      tagIds.push(id);
    }
  }
  return { tagIds, specialIds };
}
