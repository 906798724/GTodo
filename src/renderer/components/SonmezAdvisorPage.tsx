import React from 'react';
import { AdvisorPage, SONMEZ_CONFIG } from './AdvisorPage';

interface SonmezAdvisorPageProps {
  /** 当未配置 API Key 时，跳转到设置页 */
  onGoToSettings: () => void;
}

/**
 * Sonmez 顾问页面（薄壳，转发到通用 AdvisorPage）
 * 保留这个组件是为了不破坏 App.tsx 的引用
 */
export const SonmezAdvisorPage: React.FC<SonmezAdvisorPageProps> = ({ onGoToSettings }) => {
  return <AdvisorPage config={SONMEZ_CONFIG} onGoToSettings={onGoToSettings} />;
};