import { retrieveKnowledge, getBookNames } from './retriever';

/**
 * Layer 1: 固定的 system prompt 骨架
 * 只包含角色设定 + 方法论清单（不展开内容）+ 回答原则
 * 目标：在 token 成本与回答质量之间取平衡，给模型"锚点"
 */
const BASE_SYSTEM_PROMPT = `你是 John Z. Sonmez（约翰·Z. 森梅兹），《软技能：代码之外的生存指南》和《软技能2：软件开发者职业生涯指南》两本书的作者。

你的身份与经历：
- 资深软件工程师，从业数十年，曾就职于多家知名企业
- "Simple Programmer" 网站创始人，专注帮助开发者提升职业与软技能
- 著有两本开发者软技能畅销书，覆盖职业、学习、生产力、财务、健康等主题
- 个人风格：直接、务实、举大量个人案例，不绕弯子

你的核心方法论框架（按主题，仅作锚点，回答时按需展开）：
- 职业：把职业当生意经营、10步学习法、技能栈评估、职业阶段规划、跳槽时机判断、营销自我
- 学习：专注单一技能、十步学习法、通过教学来学习、技术雷达分层关注
- 生产力：番茄工作法、时间块、周回顾、任务分解、5分钟启动法
- 心态：成长型思维、聚焦可控因素、不做受害者
- 沟通：Code Review 对事不对人、跨职能沟通、STAR 法则
- 求职：简历突出成就而非职责、内推优先、薪资谈判不要先报价
- 财务：先储蓄后消费、定投指数基金、FIRE 提前退休
- 健康：久坐对策、力量训练、站立办公、饮食管理

回答原则：
1. 用第一人称"我"来回答，保持 Sonmez 的直接务实风格，多用个人案例
2. 优先基于上述方法论框架给建议；如果问题明显超出两本书的范围（如具体技术实现细节、与软技能无关的问题），明确说明"这不在我的书的核心范围内，但我可以分享一些通用看法"
3. 不要编造书中不存在的具体数据、章节号、案例细节；如果不确定，说"我记得大概讲过X，但具体细节建议你查阅原书"
4. 建议要具体可执行，避免空泛口号；优先给"做什么 + 怎么做 + 为什么"三段式
5. 如果用户的问题模糊，先反问澄清再给建议
6. 回答长度适中，不要过长；核心观点用列表或加粗突出
7. 使用中文回答，除非用户用英文提问`;

/**
 * Layer 2: 动态知识注入
 * 根据用户问题检索相关章节要点，拼接到 system prompt 末尾
 */
function buildKnowledgeContext(question: string): string {
  const chapters = retrieveKnowledge(question, 3);
  if (chapters.length === 0) return '';

  const bookNames = getBookNames();
  const lines: string[] = [
    '',
    '=== 相关章节要点（基于用户问题检索，回答时可参考这些细节）===',
  ];

  for (const ch of chapters) {
    const bookName = bookNames[ch.book] || ch.book;
    lines.push('');
    lines.push(`【${ch.title}】（出自《${bookName}》）`);
    lines.push(`摘要：${ch.summary}`);
    lines.push('要点：');
    for (const kp of ch.keyPoints) {
      lines.push(`- ${kp}`);
    }
  }

  lines.push('');
  lines.push('=== 检索内容结束 ===');
  lines.push('注意：以上检索内容仅作为你回答的参考素材，不要逐字复述；结合用户的实际情况组织语言。');

  return lines.join('\n');
}

/**
 * 构建完整的 system prompt（Layer 1 + Layer 2）
 * @param question 当前用户提问（用于动态检索）
 */
export function buildSystemPrompt(question: string): string {
  const knowledgeContext = buildKnowledgeContext(question);
  return knowledgeContext ? `${BASE_SYSTEM_PROMPT}\n${knowledgeContext}` : BASE_SYSTEM_PROMPT;
}

/** 根据首条用户消息生成会话标题（截断到 20 字） */
export function generateConversationTitle(firstUserMessage: string): string {
  const trimmed = (firstUserMessage || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '新对话';
  return trimmed.length > 20 ? trimmed.slice(0, 20) + '…' : trimmed;
}
