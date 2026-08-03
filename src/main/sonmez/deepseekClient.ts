import { BrowserWindow } from 'electron';
import { loadApiKey, getModel, getBaseUrl, getThinkingEnabled } from './apiKeyStore';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  /** 收到一个文本片段（最终回答） */
  onChunk: (delta: string) => void;
  /** 收到一段思维链片段（思考模式下的推理过程，可选展示） */
  onReasoningChunk?: (delta: string) => void;
  /** 流式结束，给出完整文本 */
  onDone: (fullText: string, fullReasoning: string) => void;
  /** 出错 */
  onError: (err: Error) => void;
}

/**
 * 调用 DeepSeek Chat Completions API（流式）
 *
 * 兼容 DeepSeek V4 API（2026-07 更新）：
 * - 模型：deepseek-v4-flash / deepseek-v4-pro
 * - 思考模式：thinking 参数控制，默认关闭以获得更快响应
 * - 流式响应：delta.content 为最终回答，delta.reasoning_content 为思维链
 *
 * @param messages 完整对话消息（含 system prompt）
 * @param senderWindow 用于推送流式片段到渲染进程的窗口
 * @param requestId 本次请求的唯一 ID（渲染进程用于关联流）
 * @param eventPrefix 事件名前缀（如 'sonmez' / 'bob'），用于区分多角色
 * @param callbacks 回调
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  senderWindow: BrowserWindow | null,
  requestId: string,
  eventPrefix: 'sonmez' | 'bob' = 'sonmez',
  callbacks: StreamCallbacks
): Promise<void> {
  const apiKey = loadApiKey();
  if (!apiKey) {
    const err = new Error('未配置 DeepSeek API Key，请到「设置 → 数字人顾问」中填写');
    callbacks.onError(err);
    return;
  }

  const model = getModel();
  const baseUrl = getBaseUrl();
  const thinkingEnabled = getThinkingEnabled();

  // 兼容两种路径：官方文档为 /chat/completions，OpenAI SDK 兼容为 /v1/chat/completions
  // 两者均可用，这里对齐官方文档（不带 /v1）
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  // 构造请求体
  // 注意：思考模式下 temperature / top_p 不生效（不会报错但无效），故仅在非思考模式时传
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    max_tokens: 4096,
  };

  if (thinkingEnabled) {
    requestBody.thinking = { type: 'enabled' };
    requestBody.reasoning_effort = 'high';
  } else {
    requestBody.thinking = { type: 'disabled' };
    requestBody.temperature = 0.7;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    callbacks.onError(new Error(`网络请求失败：${(err as Error).message}`));
    return;
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.text();
      detail = errBody;
    } catch (_) {
      // ignore
    }
    callbacks.onError(
      new Error(`DeepSeek API 返回 ${response.status} ${response.statusText}${detail ? `：${detail}` : ''}`)
    );
    return;
  }

  if (!response.body) {
    callbacks.onError(new Error('DeepSeek API 未返回响应体'));
    return;
  }

  // 解析 SSE 流
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let fullReasoning = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 按 \n\n 分隔事件
      const events = buffer.split('\n\n');
      // 最后一段可能不完整，留到下次
      buffer = events.pop() || '';

      for (const evt of events) {
        const lines = evt.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') {
            callbacks.onDone(fullText, fullReasoning);
            return;
          }
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta;

            // 思考模式：思维链内容（reasoning_content）
            const reasoningDelta: string = delta?.reasoning_content || '';
            if (reasoningDelta) {
              fullReasoning += reasoningDelta;
              if (callbacks.onReasoningChunk) {
                callbacks.onReasoningChunk(reasoningDelta);
              }
              if (senderWindow && !senderWindow.isDestroyed()) {
                senderWindow.webContents.send(`${eventPrefix}-stream-chunk`, {
                  requestId,
                  delta: '',
                  reasoning: reasoningDelta,
                });
              }
            }

            // 最终回答内容（content）
            const contentDelta: string = delta?.content || '';
            if (contentDelta) {
              fullText += contentDelta;
              callbacks.onChunk(contentDelta);
              if (senderWindow && !senderWindow.isDestroyed()) {
                senderWindow.webContents.send(`${eventPrefix}-stream-chunk`, {
                  requestId,
                  delta: contentDelta,
                  reasoning: '',
                });
              }
            }
          } catch (err) {
            // 单条解析失败不中断整体
            console.warn(`[${eventPrefix}] Failed to parse SSE chunk:`, data, err);
          }
        }
      }
    }
    // 流自然结束（无 [DONE]）
    callbacks.onDone(fullText, fullReasoning);
  } catch (err) {
    callbacks.onError(new Error(`流式读取失败：${(err as Error).message}`));
  }
}

/**
 * 非流式调用（备用，目前未使用，保留供未来降级场景）
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('未配置 DeepSeek API Key');

  const model = getModel();
  const baseUrl = getBaseUrl();
  const thinkingEnabled = getThinkingEnabled();
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    max_tokens: 4096,
  };

  if (thinkingEnabled) {
    requestBody.thinking = { type: 'enabled' };
    requestBody.reasoning_effort = 'high';
  } else {
    requestBody.thinking = { type: 'disabled' };
    requestBody.temperature = 0.7;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek API ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const json: any = await response.json();
  return json?.choices?.[0]?.message?.content || '';
}
