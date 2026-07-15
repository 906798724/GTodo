import React, { useEffect, useState, useMemo } from 'react';

interface Summary {
  date: string;
  content: string;
  updated_at: string;
}

interface ArchiveCalendarProps {
  refreshKey: number;
  onOpenDay: (date: string, summary: Summary | null) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** 取总结前两行作为预览（去除空行） */
const previewOf = (content: string, maxChars: number = 60): string => {
  if (!content) return '';
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const joined = lines.slice(0, 2).join(' / ');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '…' : joined;
};

export const ArchiveCalendar: React.FC<ArchiveCalendarProps> = ({ refreshKey, onOpenDay }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);

  // 构建当月日历网格（6 行 × 7 列）
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    // 周一为一周的起始日：周日(0) -> 6，其他 -> -1
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: Date | null; key: string }[] = [];
    // 前置空格
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, key: `pad-${i}` });
    }
    // 当月日期
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), key: `${year}-${month}-${d}` });
    }
    // 补齐到 6 行
    while (cells.length < 42) {
      cells.push({ date: null, key: `pad-end-${cells.length}` });
    }
    return cells;
  }, [year, month]);

  // 加载当月总结
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.electronAPI
      .getMonthSummaries(year, month)
      .then((rows: Summary[]) => {
        if (!cancelled) setSummaries(rows);
      })
      .catch((err: Error) => {
        console.error('Failed to load month summaries:', err);
        if (!cancelled) setSummaries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, refreshKey]);

  const summaryByDate = useMemo(() => {
    const map = new Map<string, Summary>();
    summaries.forEach((s) => map.set(s.date, s));
    return map;
  }, [summaries]);

  const goPrev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const isToday = (date: Date) => {
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  };

  const formatKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <div className="archive-container">
      <div className="archive-header">
        <button className="archive-nav-btn" onClick={goPrev} title="上个月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="archive-title">
          {year} 年 {month + 1} 月
        </h2>
        <button className="archive-nav-btn" onClick={goNext} title="下个月">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div className="archive-spacer" />
        <span className="archive-stats">
          本月 {summaries.length} 条总结
        </span>
      </div>

      <div className="archive-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="archive-weekday">{w}</div>
        ))}
      </div>

      <div className="archive-grid">
        {grid.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="archive-cell empty" />;
          }
          const key = formatKey(cell.date);
          const summary = summaryByDate.get(key);
          const hasSummary = !!summary;
          return (
            <button
              key={cell.key}
              type="button"
              className={`archive-cell ${hasSummary ? 'has-summary' : ''} ${isToday(cell.date) ? 'today' : ''}`}
              onClick={() => onOpenDay(key, summary || null)}
              title={hasSummary ? `${key}：${previewOf(summary.content, 80)}` : key}
            >
              <span className="archive-day-num">{cell.date.getDate()}</span>
              {hasSummary && (
                <span className="archive-day-preview">{previewOf(summary.content)}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <div className="archive-loading">加载中…</div>}
    </div>
  );
};