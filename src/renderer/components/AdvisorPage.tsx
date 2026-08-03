import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ConfirmModal } from './ConfirmModal';

export type AdvisorType = 'sonmez' | 'bob';

interface AdvisorConversation {
  id: string;
  title: string;
  advisor_type: AdvisorType;
  created_at: string;
  updated_at: string;
}

interface AdvisorMessage {
  id: string;
  conversation_id: string;
  advisor_type: AdvisorType;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface AdvisorConfig {
  /** 角色类型 */
  type: AdvisorType;
  /** 显示名（顶部 + 消息头） */
  displayName: string;
  /** 头像字母 */
  avatarLetter: string;
  /** 顶部副标题 */
  subtitle: string;
  /** 空状态描述 */
  welcomeDescription: string;
  /** 示例问题（4 条） */
  exampleQuestions: string[];
  /** 头像主题色（用于侧边栏头像 / 顶部 / 消息气泡） */
  themeColor: string;
}

interface AdvisorPageProps {
  config: AdvisorConfig;
  onGoToSettings: () => void;
}

/**
 * 通用数字人顾问对话页（Sonmez / Bob 大叔共用）
 *
 * 通过 config 区分角色：
 * - 不同的 API 调用（sonmez.* vs bob.*）
 * - 不同的 UI 主题色与文案
 * - 共用所有流式逻辑、消息渲染、会话管理
 */
export const AdvisorPage: React.FC<AdvisorPageProps> = ({ config, onGoToSettings }) => {
  // 选择对应 API namespace
  const api = config.type === 'bob' ? window.electronAPI.bob : window.electronAPI.sonmez;

  const [conversations, setConversations] = useState<AdvisorConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const activeRequestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化：加载会话列表 + API Key 状态
  useEffect(() => {
    (async () => {
      try {
        const [convs, hasKey] = await Promise.all([
          api.getConversations(),
          window.electronAPI.sonmez.hasApiKey(),
        ]);
        setConversations(convs || []);
        setHasApiKey(!!hasKey);
        if (convs && convs.length > 0) {
          setCurrentConvId(convs[0].id);
        }
      } catch (err) {
        console.error(`[${config.type}] init failed:`, err);
      }
    })();
  }, [api, config.type]);

  // 流式事件监听
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      api.onStreamStart((payload) => {
        activeRequestIdRef.current = payload.requestId;
        setStreamingText('');
        setStreamingReasoning('');
        setError(null);
      })
    );

    unsubs.push(
      api.onStreamChunk((payload) => {
        if (payload.requestId !== activeRequestIdRef.current) return;
        if (payload.delta) {
          setStreamingText((prev) => prev + payload.delta);
        }
        if (payload.reasoning) {
          setStreamingReasoning((prev) => prev + payload.reasoning);
        }
      })
    );

    unsubs.push(
      api.onStreamDone((payload) => {
        if (payload.requestId !== activeRequestIdRef.current) return;
        const newMsg: AdvisorMessage = {
          id: `tmp-${Date.now()}`,
          conversation_id: payload.conversationId,
          advisor_type: config.type,
          role: 'assistant',
          content: payload.fullText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setStreamingText('');
        setStreamingReasoning('');
        setIsLoading(false);
        activeRequestIdRef.current = null;
        api.getConversations().then(setConversations).catch(() => {});
      })
    );

    unsubs.push(
      api.onStreamError((payload) => {
        if (payload.requestId !== activeRequestIdRef.current) return;
        setError(payload.error || '请求失败');
        setStreamingText('');
        setIsLoading(false);
        activeRequestIdRef.current = null;
      })
    );

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch (_) {
          // ignore
        }
      });
    };
  }, [api, config.type]);

  // 切换会话时加载消息
  useEffect(() => {
    if (!currentConvId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const msgs = await api.getMessages(currentConvId);
        setMessages(msgs || []);
        setError(null);
      } catch (err) {
        console.error(`[${config.type}] load messages failed:`, err);
        setMessages([]);
      }
    })();
  }, [api, currentConvId]);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingText, streamingReasoning]);

  // 新建会话
  const handleNewConversation = useCallback(async () => {
    try {
      const conv = await api.createConversation('');
      setConversations((prev) => [conv, ...prev]);
      setCurrentConvId(conv.id);
      setInput('');
      setError(null);
      inputRef.current?.focus();
    } catch (err) {
      console.error(`[${config.type}] create conversation failed:`, err);
    }
  }, [api]);

  // 删除会话
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      setConfirmState({
        open: true,
        title: '删除会话',
        message: '确定删除这个会话吗？所有消息将一并删除。',
        confirmText: '删除',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmState((s) => ({ ...s, open: false }));
          try {
            await api.deleteConversation(id);
            const remaining = conversations.filter((c) => c.id !== id);
            setConversations(remaining);
            if (currentConvId === id) {
              setCurrentConvId(remaining.length > 0 ? remaining[0].id : null);
            }
          } catch (err) {
            console.error(`[${config.type}] delete conversation failed:`, err);
          }
        },
      });
    },
    [api, conversations, currentConvId]
  );

  // 重命名会话
  const handleRenameConversation = useCallback(
    async (id: string, oldTitle: string) => {
      const newTitle = prompt('修改会话标题：', oldTitle);
      if (newTitle === null) return;
      try {
        await api.renameConversation(id, newTitle.trim());
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
        );
      } catch (err) {
        console.error(`[${config.type}] rename conversation failed:`, err);
      }
    },
    [api]
  );

  // 清空所有会话
  const handleClearAll = useCallback(async () => {
    setConfirmState({
      open: true,
      title: '清空所有会话',
      message: `确定清空所有 ${config.displayName} 会话吗？此操作不可撤销。`,
      confirmText: '清空',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, open: false }));
        try {
          await api.clearConversations();
          setConversations([]);
          setCurrentConvId(null);
          setMessages([]);
        } catch (err) {
          console.error(`[${config.type}] clear conversations failed:`, err);
        }
      },
    });
  }, [api, config.displayName]);

  // 发送消息
  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = (messageText ?? input).trim();
      if (!text || isLoading) return;

      if (!hasApiKey) {
        setError('请先在「设置 → 数字人顾问」中配置 DeepSeek API Key');
        return;
      }

      // 如果没有当前会话，先创建一个
      let convId = currentConvId;
      if (!convId) {
        try {
          const conv = await api.createConversation('');
          convId = conv.id;
          setConversations((prev) => [conv, ...prev]);
          setCurrentConvId(conv.id);
        } catch (err) {
          console.error(`[${config.type}] create conversation failed:`, err);
          return;
        }
      }

      // 乐观插入用户消息
      const userMsg: AdvisorMessage = {
        id: `tmp-user-${Date.now()}`,
        conversation_id: convId,
        advisor_type: config.type,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);
      setStreamingText('');
      setStreamingReasoning('');
      setError(null);

      try {
        await api.sendMessage(convId, text);
      } catch (err) {
        console.error(`[${config.type}] send message failed:`, err);
        setError(`发送失败：${(err as Error).message}`);
        setIsLoading(false);
      }
    },
    [api, config.type, input, isLoading, hasApiKey, currentConvId]
  );

  // 键盘快捷键：Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts.replace(' ', 'T'));
      if (isNaN(d.getTime())) return ts;
      const now = new Date();
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return isToday ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
    } catch {
      return ts;
    }
  };

  // 为不同角色注入 CSS 变量（主题色）
  const themeStyle: React.CSSProperties = {
    ['--advisor-theme' as string]: config.themeColor,
  };

  return (
    <div className="advisor-page" data-advisor={config.type} style={themeStyle}>
      {/* 左侧：会话列表 */}
      <aside className="advisor-sidebar">
        <div className="advisor-sidebar-header">
          <button className="advisor-new-btn" onClick={handleNewConversation} title="新建对话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建对话
          </button>
          {conversations.length > 0 && (
            <button className="advisor-clear-btn" onClick={handleClearAll} title="清空全部会话">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        <div className="advisor-conv-list">
          {conversations.length === 0 ? (
            <div className="advisor-conv-empty">暂无会话</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`advisor-conv-item ${currentConvId === conv.id ? 'active' : ''}`}
                onClick={() => setCurrentConvId(conv.id)}
              >
                <div className="advisor-conv-title">{conv.title || '新对话'}</div>
                <div className="advisor-conv-actions">
                  <button
                    className="advisor-conv-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameConversation(conv.id, conv.title);
                    }}
                    title="重命名"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="advisor-conv-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    title="删除"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 右侧：对话区 */}
      <div className="advisor-chat">
        {/* 顶部状态栏 */}
        <div className="advisor-chat-header">
          <div className="advisor-chat-title">
            <div className="advisor-avatar">{config.avatarLetter}</div>
            <div>
              <div className="advisor-name">{config.displayName}</div>
              <div className="advisor-subtitle">{config.subtitle}</div>
            </div>
          </div>
          {hasApiKey ? (
            <div className="advisor-status advisor-status-ok">API 已配置</div>
          ) : (
            <button className="advisor-status advisor-status-warn" onClick={onGoToSettings}>
              未配置 API Key，点击设置
            </button>
          )}
        </div>

        {/* 消息流 */}
        <div className="advisor-messages">
          {messages.length === 0 && !streamingText && (
            <div className="advisor-welcome">
              <div className="advisor-welcome-avatar">{config.avatarLetter}</div>
              <h2>你好，我是 {config.displayName}</h2>
              <p>{config.welcomeDescription}</p>
              <div className="advisor-examples">
                {config.exampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="advisor-example-item"
                    onClick={() => handleSend(q)}
                    disabled={!hasApiKey || isLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`advisor-msg advisor-msg-${msg.role}`}>
              <div className="advisor-msg-avatar">
                {msg.role === 'user' ? '你' : config.avatarLetter}
              </div>
              <div className="advisor-msg-body">
                <div className="advisor-msg-meta">
                  {msg.role === 'user' ? '你' : config.displayName} · {formatDate(msg.created_at)}
                </div>
                <div className="advisor-msg-content">
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <div className="advisor-msg-text">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 流式接收中的临时消息 */}
          {(streamingText || streamingReasoning) && (
            <div className="advisor-msg advisor-msg-assistant">
              <div className="advisor-msg-avatar">{config.avatarLetter}</div>
              <div className="advisor-msg-body">
                <div className="advisor-msg-meta">
                  {config.displayName} · {streamingReasoning && !streamingText ? '思考中…' : '输入中…'}
                </div>
                {streamingReasoning && (
                  <details className="advisor-reasoning" open={!streamingText}>
                    <summary className="advisor-reasoning-summary">思维链（思考模式）</summary>
                    <div className="advisor-reasoning-content">
                      <MarkdownRenderer content={streamingReasoning} />
                    </div>
                  </details>
                )}
                {streamingText && (
                  <div className="advisor-msg-content">
                    <MarkdownRenderer content={streamingText} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 加载中 */}
          {isLoading && !streamingText && !streamingReasoning && (
            <div className="advisor-msg advisor-msg-assistant">
              <div className="advisor-msg-avatar">{config.avatarLetter}</div>
              <div className="advisor-msg-body">
                <div className="advisor-msg-content">
                  <div className="advisor-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 错误提示 */}
        {error && <div className="advisor-error">{error}</div>}

        {/* 输入框 */}
        <div className="advisor-input-area">
          <textarea
            ref={inputRef}
            className="advisor-input"
            placeholder={hasApiKey ? '输入你的问题…（Enter 发送，Shift+Enter 换行）' : '请先配置 API Key'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <button
            className="advisor-send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !hasApiKey}
            title="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
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
    </div>
  );
};

/**
 * Sonmez 角色配置
 */
export const SONMEZ_CONFIG: AdvisorConfig = {
  type: 'sonmez',
  displayName: 'Sonmez',
  avatarLetter: 'S',
  subtitle: '基于《软技能》两本书的 AI 顾问',
  welcomeDescription:
    '我可以基于《软技能：代码之外的生存指南》和《软技能2：软件开发者职业生涯指南》两本书，帮你解答职业规划、学习、生产力、沟通等方面的困惑。',
  exampleQuestions: [
    '我是个工作 3 年的后端开发，想转管理岗，但担心脱离技术，该怎么选？',
    '最近总是拖延，明明知道该做什么却开始不了，有什么具体方法？',
    '怎么和产品经理沟通需求变更，既不撕破脸又能保护开发时间？',
    '我想开始写技术博客，但不知道写什么，怎么开始？',
  ],
  themeColor: '#6366f1',
};

/**
 * Bob 大叔角色配置
 */
export const BOB_CONFIG: AdvisorConfig = {
  type: 'bob',
  displayName: 'Bob 大叔',
  avatarLetter: 'B',
  subtitle: '基于《程序员的职业素养》的 AI 顾问',
  welcomeDescription:
    '我是 Robert C. Martin（Bob 大叔），我将基于《程序员的职业素养》（The Clean Coder）一书与你对话。我专注于专业主义、工程实践、代码质量与团队协作——帮你成为一个真正专业的程序员。',
  exampleQuestions: [
    '老板要求我承诺一个我做不到的日期，我该怎么拒绝？',
    '团队都说 TDD 浪费时间，但我感觉确实有好处，应该怎么坚持？',
    '我总是被加塞紧急任务，正常迭代被打断，有什么办法？',
    '我想成为技术 leader，但不知怎么在团队中建立技术影响力。',
  ],
  themeColor: '#10b981',
};