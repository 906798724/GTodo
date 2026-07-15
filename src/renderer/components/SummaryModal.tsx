import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';

interface SummaryModalProps {
  doneTasks: Task[];
  initialContent?: string;
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (date: string, content: string) => void | Promise<void>;
}

// 引导式模板：3 个维度，每个都提供快捷短语以降低写作心理负担
const TEMPLATE_SECTIONS = [
  {
    icon: '✅',
    label: '已完成',
    hint: '今日搞定的事',
    quickInsert: '✅ 已完成：\n',
  },
  {
    icon: '🚧',
    label: '进行中',
    hint: '还在推进的事',
    quickInsert: '🚧 进行中：\n',
  },
  {
    icon: '💡',
    label: '感悟 / 下一步',
    hint: '一句话即可',
    quickInsert: '💡 下一步：\n',
  },
];

export const SummaryModal: React.FC<SummaryModalProps> = ({ doneTasks, initialContent = '', initialDate, onClose, onSave }) => {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleInsert = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((prev) => prev + (prev ? '\n' : '') + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    // 在文末或已有内容时自动换行
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n');
    const inserted = (needNewlineBefore ? '\n' : '') + text;
    const next = before + inserted + after;
    setContent(next);
    // 恢复光标到插入内容末尾
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleInsertTaskTitles = () => {
    if (doneTasks.length === 0) return;
    const titles = doneTasks.map((t) => `- ${t.title}`).join('\n');
    handleInsert(`✅ 已完成（来自 Done 列）：\n${titles}`);
  };

  const handleSubmit = async () => {
    if (!content.trim() || saving) return;
    const date = initialDate || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    setSaving(true);
    try {
      await onSave(date, content.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>今日总结</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 模板提示区：低心理负担的快速插入 */}
          <div className="summary-hint">
            <div className="summary-hint-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              提示：3 句话就够了
            </div>
            <div className="summary-template-grid">
              {TEMPLATE_SECTIONS.map((sec) => (
                <button
                  key={sec.label}
                  type="button"
                  className="summary-template-chip"
                  onClick={() => handleInsert(sec.quickInsert)}
                  title={`点击插入「${sec.label}」模板`}
                >
                  <span className="summary-template-icon">{sec.icon}</span>
                  <span className="summary-template-label">{sec.label}</span>
                  <span className="summary-template-hint">{sec.hint}</span>
                </button>
              ))}
            </div>
            {doneTasks.length > 0 && (
              <button
                type="button"
                className="summary-insert-done"
                onClick={handleInsertTaskTitles}
                title="将 Done 列任务标题一键插入为已完成清单"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                一键插入 Done 列 {doneTasks.length} 项已完成
              </button>
            )}
          </div>

          <div className="form-group">
            <label>总结内容</label>
            <textarea
              ref={textareaRef}
              className="summary-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写点啥都行，3 句话起步……&#10;&#10;示例：&#10;✅ 已完成：需求评审、bug 修复&#10;🚧 进行中：接口联调&#10;💡 下一步：明天上线"
              rows={10}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="modal-btn save"
            onClick={handleSubmit}
            disabled={!content.trim() || saving}
          >
            {saving ? '保存中...' : '保存总结'}
          </button>
        </div>
      </div>
    </div>
  );
};