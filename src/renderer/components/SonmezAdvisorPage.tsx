import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ConfirmModal } from './ConfirmModal';

interface SonmezConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SonmezMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface SonmezAdvisorPageProps {
  /** 当未配置 API Key 时，跳转到设置页 */
  onGoToSettings: () => void;
}

/** 示例问题（空状态展示，引导用户开始对话） */
const EXAMPLE_QUESTIONS = [
  '我是个工作 3 年的后端开发，想转管理岗，但担心脱离技术，该怎么选？',
  '最近总是拖延，明明知道该做什么却开始不了，有什么具体方法？',
  '怎么和产品经理沟通需求变更，既不撕破脸又能保护开发时间？',
  '我想开始写技术博客，但不知道写什么，怎么开始？',
];

export const SonmezAdvisorPage: React.FC<SonmezAdvisorPageProps> = ({ onGoToSettings }) => {
  const [conversations, setConversations] = useState<SonmezConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SonmezMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /** 流式接收中的文本（最终回答，实时展示） */
  const [streamingText, setStreamingText] = useState('');
  /** 流式接收中的思维链（思考模式下的推理过程，可折叠查看） */
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 确认弹窗状态 */
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  /** 当前流式请求的 requestId，用于过滤事件 */
  const activeRequestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // -------- 初始化：加载会话列表 + API Key 状态 --------
  useEffect(() => {
    (async () => {
      try {
        const [convs, hasKey] = await Promise.all([
          window.electronAPI.sonmez.getConversations(),
          window.electronAPI.sonmez.hasApiKey(),
        ]);
        setConversations(convs || []);
        setHasApiKey(!!hasKey);
        // 自动选中第一个会话
        if (convs && convs.length > 0) {
          setCurrentConvId(convs[0].id);
        }
      } catch (err) {
        console.error('[Sonmez] init failed:', err);
      }
    })();
  }, []);

  // -------- 流式事件监听 --------
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      window.electronAPI.sonmez.onStreamStart((payload) => {
        activeRequestIdRef.current = payload.requestId;
        setStreamingText('');
        setStreamingReasoning('');
        setError(null);
      })
    );

    unsubs.push(
      window.electronAPI.sonmez.onStreamChunk((payload) => {
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
      window.electronAPI.sonmez.onStreamDone((payload) => {
        if (payload.requestId !== activeRequestIdRef.current) return;
        // 把 assistant 消息加入列表
        const newMsg: SonmezMessage = {
          id: `tmp-${Date.now()}`,
          conversation_id: payload.conversationId,
          role: 'assistant',
          content: payload.fullText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setStreamingText('');
        setStreamingReasoning('');
        setIsLoading(false);
        activeRequestIdRef.current = null;
        // 刷新会话列表（标题可能已更新）
        window.electronAPI.sonmez.getConversations().then(setConversations).catch(() => {});
      })
    );

    unsubs.push(
      window.electronAPI.sonmez.onStreamError((payload) => {
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
  }, []);

  // -------- 切换会话时加载消息 --------
  useEffect(() => {
    if (!currentConvId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const msgs = await window.electronAPI.sonmez.getMessages(currentConvId);
        setMessages(msgs || []);
        setError(null);
      } catch (err) {
        console.error('[Sonmez] load messages failed:', err);
        setMessages([]);
      }
    })();
  }, [currentConvId]);

  // -------- 自动滚动到底部 --------
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingText, streamingReasoning]);

  // -------- 新建会话 --------
  const handleNewConversation = useCallback(async () => {
    try {
      const conv = await window.electronAPI.sonmez.createConversation('');
      setConversations((prev) => [conv, ...prev]);
      setCurrentConvId(conv.id);
      setInput('');
      setError(null);
      inputRef.current?.focus();
    } catch (err) {
      console.error('[Sonmez] create conversation failed:', err);
    }
  }, []);

  // -------- 删除会话 --------
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
            await window.electronAPI.sonmez.deleteConversation(id);
            const remaining = conversations.filter((c) => c.id !== id);
            setConversations(remaining);
            if (currentConvId === id) {
              setCurrentConvId(remaining.length > 0 ? remaining[0].id : null);
            }
          } catch (err) {
            console.error('[Sonmez] delete conversation failed:', err);
          }
        },
      });
    },
    [conversations, currentConvId]
  );

  // -------- 重命名会话 --------
  const handleRenameConversation = useCallback(
    async (id: string, oldTitle: string) => {
      const newTitle = prompt('修改会话标题：', oldTitle);
      if (newTitle === null) return;
      try {
        await window.electronAPI.sonmez.renameConversation(id, newTitle.trim());
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
        );
      } catch (err) {
        console.error('[Sonmez] rename conversation failed:', err);
      }
    },
    []
  );

  // -------- 清空所有会话 --------
  const handleClearAll = useCallback(async () => {
    setConfirmState({
      open: true,
      title: '清空所有会话',
      message: '确定清空所有会话吗？此操作不可撤销。',
      confirmText: '清空',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, open: false }));
        try {
          await window.electronAPI.sonmez.clearConversations();
          setConversations([]);
          setCurrentConvId(null);
          setMessages([]);
        } catch (err) {
          console.error('[Sonmez] clear conversations failed:', err);
        }
      },
    });
  }, []);

  // -------- 发送消息 --------
  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = (messageText ?? input).trim();
      if (!text || isLoading) return;

      if (!hasApiKey) {
        setError('请先在「设置 → Sonmez」中配置 DeepSeek API Key');
        return;
      }

      // 如果没有当前会话，先创建一个
      let convId = currentConvId;
      if (!convId) {
        try {
          const conv = await window.electronAPI.sonmez.createConversation('');
          convId = conv.id;
          setConversations((prev) => [conv, ...prev]);
          setCurrentConvId(conv.id);
        } catch (err) {
          console.error('[Sonmez] create conversation failed:', err);
          return;
        }
      }

      // 乐观插入用户消息
      const userMsg: SonmezMessage = {
        id: `tmp-user-${Date.now()}`,
        conversation_id: convId,
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
        await window.electronAPI.sonmez.sendMessage(convId, text);
        // 实际的消息列表更新由 onStreamDone 回调处理
      } catch (err) {
        console.error('[Sonmez] send message failed:', err);
        setError(`发送失败：${(err as Error).message}`);
        setIsLoading(false);
      }
    },
    [input, isLoading, hasApiKey, currentConvId]
  );

  // -------- 键盘快捷键：Enter 发送，Shift+Enter 换行 --------
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

  return (
    <div className="sonmez-page">
      {/* 左侧：会话列表 */}
      <aside className="sonmez-sidebar">
        <div className="sonmez-sidebar-header">
          <button
            className="sonmez-new-btn"
            onClick={handleNewConversation}
            title="新建对话"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建对话
          </button>
          {conversations.length > 0 && (
            <button
              className="sonmez-clear-btn"
              onClick={handleClearAll}
              title="清空全部会话"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        <div className="sonmez-conv-list">
          {conversations.length === 0 ? (
            <div className="sonmez-conv-empty">暂无会话</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`sonmez-conv-item ${currentConvId === conv.id ? 'active' : ''}`}
                onClick={() => setCurrentConvId(conv.id)}
              >
                <div className="sonmez-conv-title">
                  {conv.title || '新对话'}
                </div>
                <div className="sonmez-conv-actions">
                  <button
                    className="sonmez-conv-action"
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
                    className="sonmez-conv-action"
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
      <div className="sonmez-chat">
        {/* 顶部状态栏 */}
        <div className="sonmez-chat-header">
          <div className="sonmez-chat-title">
            <div className="sonmez-avatar">S</div>
            <div>
              <div className="sonmez-name">Sonmez</div>
              <div className="sonmez-subtitle">
                基于《软技能》两本书的 AI 顾问
              </div>
            </div>
          </div>
          {hasApiKey ? (
            <div className="sonmez-status sonmez-status-ok">API 已配置</div>
          ) : (
            <button className="sonmez-status sonmez-status-warn" onClick={onGoToSettings}>
              未配置 API Key，点击设置
            </button>
          )}
        </div>

        {/* 消息流 */}
        <div className="sonmez-messages">
          {messages.length === 0 && !streamingText && (
            <div className="sonmez-welcome">
              <div className="sonmez-welcome-avatar">S</div>
              <h2>你好，我是 Sonmez</h2>
              <p>
                我可以基于《软技能：代码之外的生存指南》和《软技能2：软件开发者职业生涯指南》
                两本书，帮你解答职业规划、学习、生产力、沟通等方面的困惑。
              </p>
              <div className="sonmez-quote">
                <span className="sonmez-quote-text">"你不必成为最厉害的程序员，才能成为最厉害的软件开发者。"</span>
              </div>
              <div className="sonmez-examples">
                {EXAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    className="sonmez-example-item"
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
            <div key={msg.id} className={`sonmez-msg sonmez-msg-${msg.role}`}>
              <div className="sonmez-msg-avatar">
                {msg.role === 'user' ? '你' : 'S'}
              </div>
              <div className="sonmez-msg-body">
                <div className="sonmez-msg-meta">
                  {msg.role === 'user' ? '你' : 'Sonmez'} · {formatDate(msg.created_at)}
                </div>
                <div className="sonmez-msg-content">
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <div className="sonmez-msg-text">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 流式接收中的临时消息 */}
          {(streamingText || streamingReasoning) && (
            <div className="sonmez-msg sonmez-msg-assistant">
              <div className="sonmez-msg-avatar">S</div>
              <div className="sonmez-msg-body">
                <div className="sonmez-msg-meta">
                  Sonmez · {streamingReasoning && !streamingText ? '思考中…' : '输入中…'}
                </div>
                {streamingReasoning && (
                  <details className="sonmez-reasoning" open={!streamingText}>
                    <summary className="sonmez-reasoning-summary">
                      思维链（思考模式）
                    </summary>
                    <div className="sonmez-reasoning-content">
                      <MarkdownRenderer content={streamingReasoning} />
                    </div>
                  </details>
                )}
                {streamingText && (
                  <div className="sonmez-msg-content">
                    <MarkdownRenderer content={streamingText} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 加载中（流未开始） */}
          {isLoading && !streamingText && !streamingReasoning && (
            <div className="sonmez-msg sonmez-msg-assistant">
              <div className="sonmez-msg-avatar">S</div>
              <div className="sonmez-msg-body">
                <div className="sonmez-msg-content">
                  <div className="sonmez-typing">
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
        {error && <div className="sonmez-error">{error}</div>}

        {/* 输入框 */}
        <div className="sonmez-input-area">
          <textarea
            ref={inputRef}
            className="sonmez-input"
            placeholder={hasApiKey ? '输入你的问题…（Enter 发送，Shift+Enter 换行）' : '请先配置 API Key'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <button
            className="sonmez-send-btn"
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
