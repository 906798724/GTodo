import React, { useEffect, useState, useCallback } from 'react';

interface Quote {
  text: string;
  book: string;
  chapterTitle: string;
}

/**
 * 首页顶部每日金句 Banner
 *
 * - 初次加载：拉取今日金句（按日期 seed，同一天稳定）
 * - "换一条"按钮：拉取随机金句（排除当前）
 * - 关闭按钮：当日隐藏（次日自动恢复）
 * - 切换淡入淡出动画
 */
export const DailyQuoteBanner: React.FC = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  // 加载今日金句
  useEffect(() => {
    (async () => {
      try {
        const q = await window.electronAPI.sonmez.getDailyQuote();
        setQuote(q);
      } catch (err) {
        console.error('[DailyQuote] failed to load:', err);
      }
    })();
  }, []);

  const refreshQuote = useCallback(async () => {
    setFading(true);
    try {
      const q = await window.electronAPI.sonmez.getRandomQuote(quote ?? undefined);
      setQuote(q);
    } catch (err) {
      console.error('[DailyQuote] failed to refresh:', err);
    } finally {
      setTimeout(() => setFading(false), 50);
    }
  }, [quote]);

  if (!visible || !quote) return null;

  return (
    <div className={`daily-quote-banner ${fading ? 'fading' : ''}`}>
      <div className="daily-quote-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
      </div>
      <div className="daily-quote-text">{quote.text}</div>
      <div className="daily-quote-actions">
        <button
          className="daily-quote-refresh"
          onClick={refreshQuote}
          title="换一条"
          aria-label="换一条"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <button
          className="daily-quote-close"
          onClick={() => setVisible(false)}
          title="今日不再显示"
          aria-label="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
