import React, { useState, useRef, useEffect } from 'react';

interface Special {
  id: number;
  title: string;
  color?: string;
}

interface SpecialMultiSelectProps {
  allSpecials: Special[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}

/**
 * 万里长征多选下拉（不带新建功能，因为万里长征是在专门的页面管理的）
 * 样式复用与 TagMultiSelect 一致的 .tag-multiselect-* 体系
 */
export const SpecialMultiSelect: React.FC<SpecialMultiSelectProps> = ({
  allSpecials,
  selectedIds,
  onChange,
  placeholder = '选择万里长征',
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
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
    }
  }, [open]);

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const removeChip = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  const filtered = allSpecials.filter((s) =>
    keyword.trim() === '' ? true : s.title.toLowerCase().includes(keyword.toLowerCase())
  );
  const selectedSpecials = allSpecials.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="tag-multiselect" ref={rootRef}>
      <button
        type="button"
        className={`tag-multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedSpecials.length === 0 ? (
          <span className="tag-multiselect-placeholder">{placeholder}</span>
        ) : (
          <div className="tag-multiselect-chips">
            {selectedSpecials.map((s) => (
              <span
                key={s.id}
                className="task-tag-chip tag-multiselect-chip"
                style={{ background: `${s.color || '#4a4339'}22`, color: s.color || '#4a4339', borderColor: `${s.color || '#4a4339'}55` }}
              >
                【万里长征: {s.title}】
                <span
                  className="tag-multiselect-chip-remove"
                  onClick={(e) => removeChip(e, s.id)}
                  title="移除"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <svg className="tag-multiselect-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="tag-multiselect-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="tag-multiselect-search">
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索万里长征..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="tag-multiselect-list">
            {filtered.length === 0 ? (
              <div className="tag-multiselect-empty">暂无万里长征（请到「万里长征」页面新建）</div>
            ) : (
              filtered.map((s) => {
                const checked = selectedIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`tag-multiselect-item ${checked ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                    />
                    <span
                      className="tag-multiselect-dot"
                      style={{ backgroundColor: s.color || '#4a4339' }}
                    />
                    <span className="tag-multiselect-name">{s.title}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
