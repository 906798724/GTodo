import React from 'react';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  archiveTime: string;
  onArchiveTimeChange: (time: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onToggleTheme,
  archiveTime,
  onArchiveTimeChange,
}) => {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>设置</h1>
        <p className="page-subtitle">调整应用主题、归档时间等</p>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h2 className="settings-group-title">外观</h2>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">深色模式</div>
              <div className="settings-row-desc">切换应用为深色主题</div>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={onToggleTheme}
              />
              <span className="settings-switch-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">自动化</h2>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">自动归档时间</div>
              <div className="settings-row-desc">每天自动归档 Done 列任务的时间</div>
            </div>
            <input
              type="time"
              className="settings-time-input"
              value={archiveTime}
              onChange={(e) => onArchiveTimeChange(e.target.value)}
            />
          </div>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">快捷键</h2>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">快速添加任务</div>
              <div className="settings-row-desc">在任意位置唤起快速添加窗口</div>
            </div>
            <kbd className="settings-kbd">Ctrl + Alt + Q</kbd>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">显示/隐藏主窗口</div>
              <div className="settings-row-desc">快速显示或隐藏应用主窗口</div>
            </div>
            <kbd className="settings-kbd">Ctrl + Shift + B</kbd>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">开发者工具</div>
              <div className="settings-row-desc">打开调试面板</div>
            </div>
            <kbd className="settings-kbd">F12</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};