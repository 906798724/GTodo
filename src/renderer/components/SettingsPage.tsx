import React, { useState, useEffect } from 'react';
import { Toast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

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
  // Sonmez 顾问：API Key 与模型配置
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [model, setModel] = useState('deepseek-v4-flash');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; type: 'success' | 'info' | 'error' }>({
    open: false,
    message: '',
    type: 'info',
  });
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    // 加载已存储的配置
    (async () => {
      try {
        const [masked, m, url, thinking] = await Promise.all([
          window.electronAPI.sonmez.getApiKeyMasked(),
          window.electronAPI.sonmez.getModel(),
          window.electronAPI.sonmez.getBaseUrl(),
          window.electronAPI.sonmez.getThinkingEnabled(),
        ]);
        setApiKeyMasked(masked || '');
        setModel(m || 'deepseek-v4-flash');
        setBaseUrl(url || 'https://api.deepseek.com');
        setThinkingEnabled(!!thinking);
      } catch (err) {
        console.error('[Settings] load sonmez config failed:', err);
      }
    })();
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setToast({ open: true, message: '请输入 API Key', type: 'error' });
      return;
    }
    setApiKeySaving(true);
    try {
      await window.electronAPI.sonmez.saveApiKey(apiKeyInput.trim());
      const masked = await window.electronAPI.sonmez.getApiKeyMasked();
      setApiKeyMasked(masked || '');
      setApiKeyInput('');
      setApiKeyEditing(false);
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (err) {
      setToast({ open: true, message: '保存失败：' + (err as Error).message, type: 'error' });
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleClearApiKey = async () => {
    setConfirmState({
      open: true,
      title: '清除 API Key',
      message: '确定清除已保存的 API Key 吗？',
      confirmText: '清除',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, open: false }));
        try {
          await window.electronAPI.sonmez.saveApiKey('');
          setApiKeyMasked('');
        } catch (err) {
          setToast({ open: true, message: '清除失败：' + (err as Error).message, type: 'error' });
        }
      },
    });
  };

  const handleModelChange = async (value: string) => {
    setModel(value);
    try {
      await window.electronAPI.sonmez.setModel(value);
    } catch (err) {
      console.error('[Settings] save model failed:', err);
    }
  };

  const handleBaseUrlChange = async (value: string) => {
    setBaseUrl(value);
    try {
      await window.electronAPI.sonmez.setBaseUrl(value);
    } catch (err) {
      console.error('[Settings] save baseUrl failed:', err);
    }
  };

  const handleThinkingToggle = async (enabled: boolean) => {
    setThinkingEnabled(enabled);
    try {
      await window.electronAPI.sonmez.setThinkingEnabled(enabled);
    } catch (err) {
      console.error('[Settings] save thinkingEnabled failed:', err);
    }
  };

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
          <h2 className="settings-group-title">Sonmez</h2>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">DeepSeek API Key</div>
              <div className="settings-row-desc">
                用于调用 DeepSeek 大模型，Key 会通过系统密钥链加密存储，仅本机可用
              </div>
            </div>
            <div className="sonmez-apikey-actions">
              {!apiKeyEditing && apiKeyMasked ? (
                <>
                  <span className="sonmez-apikey-masked">{apiKeyMasked}</span>
                  <button
                    className="sonmez-apikey-btn"
                    onClick={() => setApiKeyEditing(true)}
                  >
                    修改
                  </button>
                  <button
                    className="sonmez-apikey-btn sonmez-apikey-btn-danger"
                    onClick={handleClearApiKey}
                  >
                    清除
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    className="sonmez-apikey-input"
                    placeholder="sk-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="sonmez-apikey-btn sonmez-apikey-btn-primary"
                    onClick={handleSaveApiKey}
                    disabled={apiKeySaving}
                  >
                    {apiKeySaving ? '保存中…' : '保存'}
                  </button>
                  {apiKeyEditing && (
                    <button
                      className="sonmez-apikey-btn"
                      onClick={() => {
                        setApiKeyEditing(false);
                        setApiKeyInput('');
                      }}
                    >
                      取消
                    </button>
                  )}
                  {apiKeySaved && <span className="sonmez-apikey-saved">已保存</span>}
                </>
              )}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">模型</div>
              <div className="settings-row-desc">
                deepseek-v4-flash 速度更快（推荐）；deepseek-v4-pro 推理能力更强（但延迟更高、费用更贵）
              </div>
            </div>
            <select
              className="sonmez-model-select"
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="deepseek-v4-flash">deepseek-v4-flash（推荐）</option>
              <option value="deepseek-v4-pro">deepseek-v4-pro</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">思考模式</div>
              <div className="settings-row-desc">
                开启后模型会先进行思维链推理再给出最终回答，答案更准确但响应更慢；关闭则直接快速回答
              </div>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => handleThinkingToggle(e.target.checked)}
              />
              <span className="settings-switch-slider"></span>
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">API 基础地址</div>
              <div className="settings-row-desc">
                默认为官方地址，可改为第三方兼容服务（如 Azure 代理）
              </div>
            </div>
            <input
              type="text"
              className="sonmez-baseurl-input"
              value={baseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder="https://api.deepseek.com"
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

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
        onConfirm={() => confirmState.onConfirm()}
        onClose={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
      <Toast
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
};
