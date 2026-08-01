/**
 * 轻量 Markdown 渲染器
 *
 * 支持：
 * - 代码块（```...```）
 * - 行内代码（`...`）
 * - 加粗（**...**）
 * - 无序列表（- ... / * ...）
 * - 有序列表（1. ...）
 * - 标题（# ## ###）
 * - 段落（含换行）
 *
 * 不引入 react-markdown 等依赖，保持包体积最小。
 * 输出为 React 节点数组，由调用方包在容器里。
 */
import React from 'react';

interface MarkdownProps {
  content: string;
}

/** 转义 HTML 特殊字符，防止注入 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 渲染行内格式（行内代码、加粗） */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 正则：匹配 `code` 或 **bold**
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-code-${i}`} className="md-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${i}`} className="md-strong">
          {token.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export const MarkdownRenderer: React.FC<MarkdownProps> = ({ content }) => {
  if (!content) return null;

  const blocks: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let keyIdx = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束的 ```
      blocks.push(
        <pre key={`pre-${keyIdx++}`} className="md-code-block">
          {lang && <code className="md-code-lang">{lang}</code>}
          <code className="md-code-content">{escapeHtml(codeLines.join('\n'))}</code>
        </pre>
      );
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
      blocks.push(
        <Tag key={`h-${keyIdx++}`} className={`md-heading md-h${level}`}>
          {renderInline(text, `h-${keyIdx}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // 无序列表
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${keyIdx++}`} className="md-list md-ul">
          {items.map((item, idx) => (
            <li key={`li-${keyIdx}-${idx}`} className="md-li">
              {renderInline(item, `ul-li-${keyIdx}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${keyIdx++}`} className="md-list md-ol">
          {items.map((item, idx) => (
            <li key={`oli-${keyIdx}-${idx}`} className="md-li">
              {renderInline(item, `ol-li-${keyIdx}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 段落（连续非空行合并）
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={`p-${keyIdx++}`} className="md-paragraph">
          {paraLines.map((line, idx) => (
            <React.Fragment key={`pf-${keyIdx}-${idx}`}>
              {renderInline(line, `p-${keyIdx}-${idx}`)}
              {idx < paraLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return <div className="md-container">{blocks}</div>;
};
