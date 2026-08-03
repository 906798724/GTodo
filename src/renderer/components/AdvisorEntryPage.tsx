import React from 'react';
import type { AdvisorConfig } from './AdvisorPage';

interface AdvisorEntryPageProps {
  advisors: AdvisorConfig[];
  onSelectAdvisor: (advisorType: 'sonmez' | 'bob') => void;
}

/**
 * 数字人顾问入口选择页
 *
 * 用户进来时，先看到两位顾问的"名片"，再选择要对话谁
 * - Sonmez：偏务实生活化
 * - Bob 大叔：偏原则纪律、工程实践
 */
export const AdvisorEntryPage: React.FC<AdvisorEntryPageProps> = ({ advisors, onSelectAdvisor }) => {
  return (
    <div className="advisor-entry-page">
      <div className="advisor-entry-header">
        <h1 className="advisor-entry-title">问道</h1>
        <p className="advisor-entry-subtitle">
          两位大师，各有专长。根据你的困惑选择一位开始问道。
        </p>
        <div className="advisor-entry-divider">道可道，非常道</div>
      </div>
      <div className="advisor-entry-grid">
        {advisors.map((advisor) => (
          <div
            key={advisor.type}
            className="advisor-entry-card"
            data-advisor={advisor.type}
            onClick={() => onSelectAdvisor(advisor.type)}
            style={{ ['--advisor-theme' as string]: advisor.themeColor }}
          >
            <div className="advisor-entry-avatar">{advisor.avatarLetter}</div>
            <div className="advisor-entry-card-title">{advisor.displayName}</div>
            <div className="advisor-entry-card-desc">
              {advisor.type === 'sonmez'
                ? '《软技能》作者，务实派。'
                : '《程序员的职业素养》作者，强原则。'}
            </div>
            <ul className="advisor-entry-card-tags">
              {advisor.type === 'sonmez' ? (
                <>
                  <li>职业规划</li>
                  <li>生活方式</li>
                  <li>自我营销</li>
                  <li>理财 / 健康</li>
                </>
              ) : (
                <>
                  <li>专业主义</li>
                  <li>工程实践</li>
                  <li>TDD / 测试</li>
                  <li>协作纪律</li>
                </>
              )}
            </ul>
            <button
              className="advisor-entry-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAdvisor(advisor.type);
              }}
            >
              开始对话 →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};