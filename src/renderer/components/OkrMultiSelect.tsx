import React, { useState, useRef, useEffect } from 'react';

export interface Objective {
  id: number;
  title: string;
}

export interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
}

interface OkrMultiSelectProps {
  allObjectives: Objective[];
  allKeyResults: KeyResult[];
  selectedObjectiveIds: number[];
  selectedKeyResultIds: number[];
  onChangeObjectives: (ids: number[]) => void;
  onChangeKeyResults: (ids: number[]) => void;
  placeholder?: string;
}

/**
 * 有的放矢（OKR）多选下拉
 * - 选择 Objective（目标）
 * - 选择 Key Result（关键结果），选中 KR 自动选其 Objective
 * 样式复用 .tag-multiselect-* 体系
 */
export const OkrMultiSelect: React.FC<OkrMultiSelectProps> = ({
  allObjectives,
  allKeyResults,
  selectedObjectiveIds,
  selectedKeyResultIds,
  onChangeObjectives,
  onChangeKeyResults,
  placeholder = '选择有的放矢',
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<'obj' | 'kr'>('obj');

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

  const toggleObjective = (id: number) => {
    if (selectedObjectiveIds.includes(id)) {
      const newObjIds = selectedObjectiveIds.filter((x) => x !== id);
      onChangeObjectives(newObjIds);
      // 取消 Objective 时联动取消其下所有 KR
      const krUnderObj = allKeyResults.filter((kr) => kr.objective_id === id).map((kr) => kr.id);
      onChangeKeyResults(selectedKeyResultIds.filter((kid) => !krUnderObj.includes(kid)));
    } else {
      onChangeObjectives([...selectedObjectiveIds, id]);
    }
  };

  const toggleKeyResult = (id: number) => {
    const kr = allKeyResults.find((k) => k.id === id);
    if (!kr) return;

    if (selectedKeyResultIds.includes(id)) {
      onChangeKeyResults(selectedKeyResultIds.filter((x) => x !== id));
    } else {
      onChangeKeyResults([...selectedKeyResultIds, id]);
      // 选中 KR 自动选其 Objective
      if (!selectedObjectiveIds.includes(kr.objective_id)) {
        onChangeObjectives([...selectedObjectiveIds, kr.objective_id]);
      }
    }
  };

  const filteredObjs = allObjectives.filter((o) =>
    keyword.trim() === '' ? true : o.title.toLowerCase().includes(keyword.toLowerCase())
  );
  const filteredKRs = allKeyResults.filter((kr) => {
    if (keyword.trim() === '') {
      // 仅显示已选 Objective 下或已选 KR 对应的
      return selectedObjectiveIds.includes(kr.objective_id) || selectedKeyResultIds.includes(kr.id);
    }
    if (!kr.title.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (selectedObjectiveIds.includes(kr.objective_id)) return true;
    if (selectedKeyResultIds.includes(kr.id)) return true;
    return false;
  });

  // 选中的标签显示
  const selectedObjs = allObjectives.filter((o) => selectedObjectiveIds.includes(o.id));
  const selectedKRs = allKeyResults.filter((kr) => selectedKeyResultIds.includes(kr.id));

  return (
    <div className="tag-multiselect" ref={rootRef}>
      <button
        type="button"
        className={`tag-multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedObjs.length === 0 && selectedKRs.length === 0 ? (
          <span className="tag-multiselect-placeholder">{placeholder}</span>
        ) : (
          <div className="tag-multiselect-chips">
            {selectedObjs.map((o) => (
              <span
                key={`obj-${o.id}`}
                className="task-tag-chip tag-multiselect-chip"
                style={{ background: '#6366f122', color: '#6366f1', borderColor: '#6366f155' }}
              >
                目标 · {o.title}
                <span
                  className="tag-multiselect-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleObjective(o.id);
                  }}
                  title="移除"
                >
                  ×
                </span>
              </span>
            ))}
            {selectedKRs.map((kr) => (
              <span
                key={`kr-${kr.id}`}
                className="task-tag-chip tag-multiselect-chip"
                style={{ background: '#8b5cf622', color: '#8b5cf6', borderColor: '#8b5cf655' }}
              >
                KR · {kr.title}
                <span
                  className="tag-multiselect-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleKeyResult(kr.id);
                  }}
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
          <div className="okr-tab-bar">
            <div
              className={`okr-tab ${tab === 'obj' ? 'active' : ''}`}
              onClick={() => setTab('obj')}
            >
              目标 ({selectedObjs.length})
            </div>
            <div
              className={`okr-tab ${tab === 'kr' ? 'active' : ''}`}
              onClick={() => setTab('kr')}
            >
              关键结果 ({selectedKRs.length})
            </div>
          </div>
          <div className="tag-multiselect-search">
            <input
              ref={inputRef}
              type="text"
              placeholder={tab === 'obj' ? '搜索目标...' : '搜索关键结果...'}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="tag-multiselect-list">
            {tab === 'obj' ? (
              filteredObjs.length === 0 ? (
                <div className="tag-multiselect-empty">暂无目标（请到「有的放矢」页面新建）</div>
              ) : (
                filteredObjs.map((o) => {
                  const checked = selectedObjectiveIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`tag-multiselect-item ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleObjective(o.id)}
                      />
                      <span className="tag-multiselect-dot" style={{ backgroundColor: '#6366f1' }} />
                      <span className="tag-multiselect-name">{o.title}</span>
                    </label>
                  );
                })
              )
            ) : filteredKRs.length === 0 ? (
              <div className="tag-multiselect-empty">
                {selectedObjectiveIds.length === 0 && selectedKeyResultIds.length === 0
                  ? '请先选择目标，再勾选其下的关键结果'
                  : '所选目标下暂无关键结果'}
              </div>
            ) : (
              filteredKRs.map((kr) => {
                const checked = selectedKeyResultIds.includes(kr.id);
                const parentObj = allObjectives.find((o) => o.id === kr.objective_id);
                return (
                  <label
                    key={kr.id}
                    className={`tag-multiselect-item ${checked ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKeyResult(kr.id)}
                    />
                    <span className="tag-multiselect-dot" style={{ backgroundColor: '#8b5cf6' }} />
                    <span className="tag-multiselect-name">
                      {kr.title}
                      {parentObj && (
                        <span className="okr-parent-hint"> · {parentObj.title}</span>
                      )}
                    </span>
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
