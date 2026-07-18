import React, { useEffect, useState } from 'react';
import { ObjectiveModal, ObjectiveData } from './ObjectiveModal';
import { KeyResultModal, KeyResultData } from './KeyResultModal';

interface Objective extends ObjectiveData {
  id: number;
  created_at: string;
  updated_at: string;
}

interface KeyResult extends KeyResultData {
  id: number;
  created_at: string;
  updated_at: string;
}

export const OkrPage: React.FC = () => {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [krsByObjective, setKrsByObjective] = useState<Record<number, KeyResult[]>>({});
  const [loading, setLoading] = useState(false);

  // Modal 状态
  const [objectiveModal, setObjectiveModal] = useState<{ open: boolean; data: Objective | null }>({
    open: false,
    data: null,
  });
  const [krModal, setKrModal] = useState<{ open: boolean; data: KeyResult | null; objectiveId: number | null }>({
    open: false,
    data: null,
    objectiveId: null,
  });

  // 删除确认
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; type: 'objective' | 'kr' | null; id: number | null }>({
    open: false,
    type: null,
    id: null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [objList, krMap] = await Promise.all([
        window.electronAPI.getObjectives(),
        window.electronAPI.getAllKeyResults(),
      ]);
      setObjectives(objList);
      setKrsByObjective(krMap || {});
    } catch (err) {
      console.error('Failed to load OKR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---- Objective 操作 ----
  const handleSaveObjective = async (data: ObjectiveData) => {
    try {
      if (data.id) {
        await window.electronAPI.updateObjective(data);
      } else {
        await window.electronAPI.createObjective(data);
      }
      setObjectiveModal({ open: false, data: null });
      await load();
    } catch (err) {
      console.error('Save objective failed:', err);
      alert('保存目标失败：' + (err as Error).message);
    }
  };

  const handleDeleteObjective = async (id: number) => {
    try {
      await window.electronAPI.deleteObjective(id);
      setObjectiveModal({ open: false, data: null });
      await load();
    } catch (err) {
      console.error('Delete objective failed:', err);
      alert('删除目标失败：' + (err as Error).message);
    }
  };

  // ---- KR 操作 ----
  const handleSaveKr = async (data: KeyResultData) => {
    try {
      if (data.id) {
        await window.electronAPI.updateKeyResult(data);
      } else {
        await window.electronAPI.createKeyResult(data);
      }
      setKrModal({ open: false, data: null, objectiveId: null });
      await load();
    } catch (err) {
      console.error('Save KR failed:', err);
      alert('保存关键结果失败：' + (err as Error).message);
    }
  };

  const handleDeleteKr = async (id: number) => {
    try {
      await window.electronAPI.deleteKeyResult(id);
      setKrModal({ open: false, data: null, objectiveId: null });
      await load();
    } catch (err) {
      console.error('Delete KR failed:', err);
      alert('删除关键结果失败：' + (err as Error).message);
    }
  };

  // 按 Objective 进度颜色
  const progressColor = (p: number) => {
    if (p >= 70) return 'var(--status-done)';
    if (p >= 30) return 'var(--status-waited)';
    return 'var(--status-wip)';
  };

  return (
    <div className="okr-container">
      <div className="okr-header">
        <h2 className="okr-title">有的放矢 · 目标管理</h2>
        <button
          className="okr-add-btn"
          onClick={() => setObjectiveModal({ open: true, data: null })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          新建目标
        </button>
      </div>

      {loading && <div className="okr-loading">加载中…</div>}

      {!loading && objectives.length === 0 && (
        <div className="okr-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <p className="okr-empty-title">还没有目标</p>
          <p className="okr-empty-desc">点击右上角"新建目标"开始记录你的目标</p>
        </div>
      )}

      <div className="okr-list">
        {objectives.map((obj) => {
          const krs = krsByObjective[obj.id] || [];
          return (
            <div key={obj.id} className="okr-objective">
              <div
                className="okr-objective-main"
                onClick={() => setObjectiveModal({ open: true, data: obj })}
              >
                <div className="okr-objective-head">
                  <h3 className="okr-objective-title">{obj.title}</h3>
                  {obj.quarter && <span className="okr-quarter-badge">{obj.quarter}</span>}
                </div>
                {obj.description && (
                  <p className="okr-objective-desc">{obj.description}</p>
                )}
                <div className="okr-progress-row">
                  <div className="okr-progress-bar">
                    <div
                      className="okr-progress-fill"
                      style={{ width: `${obj.progress}%`, background: progressColor(obj.progress) }}
                    />
                  </div>
                  <span className="okr-progress-text">{obj.progress}%</span>
                </div>
              </div>

              <div className="okr-kr-list">
                {krs.map((kr) => (
                  <div
                    key={kr.id}
                    className="okr-kr-item"
                    onClick={() => setKrModal({ open: true, data: kr, objectiveId: obj.id })}
                  >
                    <div className="okr-kr-bullet" />
                    <span className="okr-kr-title">{kr.title}</span>
                    <div className="okr-kr-progress">
                      <div className="okr-progress-bar small">
                        <div
                          className="okr-progress-fill"
                          style={{ width: `${kr.progress}%`, background: progressColor(kr.progress) }}
                        />
                      </div>
                      <span className="okr-progress-text">{kr.progress}%</span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="okr-add-kr-btn"
                  onClick={() => setKrModal({ open: true, data: null, objectiveId: obj.id })}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  添加关键结果
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {objectiveModal.open && (
        <ObjectiveModal
          objective={objectiveModal.data}
          onClose={() => setObjectiveModal({ open: false, data: null })}
          onSave={handleSaveObjective}
          onDelete={objectiveModal.data?.id
            ? () => handleDeleteObjective(objectiveModal.data!.id!)
            : undefined}
        />
      )}

      {krModal.open && krModal.objectiveId !== null && (
        <KeyResultModal
          kr={krModal.data}
          objectiveId={krModal.objectiveId}
          onClose={() => setKrModal({ open: false, data: null, objectiveId: null })}
          onSave={handleSaveKr}
          onDelete={krModal.data?.id
            ? () => handleDeleteKr(krModal.data!.id!)
            : undefined}
        />
      )}
    </div>
  );
};