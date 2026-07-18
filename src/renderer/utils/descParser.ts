/**
 * 描述内容解析工具
 * 用于从 task.description 中提取图片缩略图、首段纯文本预览等
 */

const IMG_EXT_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i;

/** URL 形态的判定（含 data:image） */
const URL_REGEX = /(https?:\/\/[^\s)]+|file:\/\/[^\s)]+|data:image\/[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=]+)/i;

/** 提取描述中**第一张**图片 URL（按顺序：先 Markdown 图片，再裸 URL） */
export function extractFirstImage(desc: string): string | null {
  if (!desc) return null;
  const mdMatch = desc.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  if (mdMatch) return mdMatch[1];
  const urlMatches = desc.match(/https?:\/\/[^\s)]+|file:\/\/[^\s)]+|data:image\/[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=]+/g);
  if (urlMatches) {
    for (const u of urlMatches) {
      if (IMG_EXT_REGEX.test(u) || u.startsWith('data:image/')) return u;
    }
  }
  return null;
}

/**
 * 把描述渲染成「首段纯文本」预览（用于卡片文字预览，去掉图片 / 链接）
 * - 去掉 Markdown 图片 `![alt](url)` -> ""
 * - 把 Markdown 链接 `[text](url)` 替换为 `text`
 * - 去掉多余空行，截断到 maxChars
 */
export function descPreviewText(desc: string, maxChars: number = 80): string {
  if (!desc) return '';
  const stripped = desc
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>~#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) + '…' : stripped;
}
