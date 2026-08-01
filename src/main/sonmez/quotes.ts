/**
 * 每日金句（"今日一句"）数据源
 *
 * 整合 Sonmez 两本书的结构化要点 + 公网搜集的经典金句，
 * 仅用于在应用首页顶部 Banner 随机展示一句，唤起用户对软技能的思考。
 *
 * 注意：金句仅用于前端展示，不参与 Sonmez 顾问的 RAG 检索。
 */

export interface Quote {
  /** 金句正文 */
  text: string;
  /** 出处书籍（用于扩展元数据，不直接展示） */
  book: 'soft-skills-1' | 'soft-skills-2';
  /** 章节标题（用于扩展元数据，不直接展示） */
  chapterTitle: string;
}

/**
 * 金句库（精选 80+ 条，覆盖职业、自我营销、学习、生产力、理财、健身、精神等主题）
 * 按主题分组，每条含正书名信息（仅前端可在 hover 时扩展展示）。
 */
export const QUOTES: Quote[] = [
  // ============ 职业思维 ============
  { text: '把职业当成自己的生意来经营', book: 'soft-skills-1', chapterTitle: '职业全景' },
  { text: '你所能犯的最大错误就是相信自己是在为别人工作', book: 'soft-skills-1', chapterTitle: '职业篇' },
  { text: '工作是属于公司的，而职业生涯却是属于你自己的', book: 'soft-skills-1', chapterTitle: '职业篇' },
  { text: '把自己当作一个软件企业，把雇主当作企业的一个客户', book: 'soft-skills-1', chapterTitle: '职业篇' },
  { text: '一切都始于习惯，习惯是成为专业人士必不可少的部分', book: 'soft-skills-1', chapterTitle: '成为专业人士' },
  { text: '坚守正道，专业人士必须对工作的优先级做出艰难的抉择', book: 'soft-skills-1', chapterTitle: '成为专业人士' },
  { text: '追求品质，完善自我，你必须不断改善自己的工作品质', book: 'soft-skills-1', chapterTitle: '成为专业人士' },
  { text: '不是提出问题，而是解决问题，相信一切问题都可以解决', book: 'soft-skills-1', chapterTitle: '攀登晋升阶梯' },
  { text: '开发者的价值在于解决问题，而非堆砌代码', book: 'soft-skills-2', chapterTitle: '职业全景' },
  { text: '技术能力是入场券，软技能决定天花板', book: 'soft-skills-2', chapterTitle: '职业全景' },
  { text: '职业路径不是线性的，可以横向扩展', book: 'soft-skills-2', chapterTitle: '职业全景' },

  // ============ 人际关系 ============
  { text: '一旦你贬低他人，削弱他们的成就感，获得的回馈将完全是抓狂和绝望', book: 'soft-skills-1', chapterTitle: '人际交往能力' },
  { text: '在小事情上放弃立场或承认错误，有时候能为你赢得意想不到的尊重', book: 'soft-skills-1', chapterTitle: '人际交往能力' },
  { text: '学会聚精会神地聆听，并指出问题所在以及相关解决方案', book: 'soft-skills-1', chapterTitle: '人际交往能力' },
  { text: '先理解对方需求，再表达自己的方案', book: 'soft-skills-1', chapterTitle: '沟通技巧' },

  // ============ 自我营销 ============
  { text: '自我营销的正确方式就是为他人提供价值', book: 'soft-skills-1', chapterTitle: '自我营销篇' },
  { text: '你也许是世界上最有天赋的软件开发人员，但如果没有人知道你的存在，你也只不过是浮云一片', book: 'soft-skills-1', chapterTitle: '自我营销' },
  { text: '打造成功博客的最大秘诀有且仅有一个——持之以恒', book: 'soft-skills-1', chapterTitle: '创建博客' },
  { text: '品牌需要四大要素：传递的信息、视觉符号、一致性、曝光率', book: 'soft-skills-1', chapterTitle: '打造品牌' },
  { text: '自我营销不是吹嘘，而是让别人知道你能解决什么问题', book: 'soft-skills-1', chapterTitle: '自我营销' },
  { text: '吸引式营销——让潜在的客户主动送上门，而不是你去找他们', book: 'soft-skills-1', chapterTitle: '自由职业' },

  // ============ 学习 ============
  { text: '培养自学能力，筛选出重点，快速突破，动手实践才是王道', book: 'soft-skills-1', chapterTitle: '学习篇' },
  { text: '喜欢读书是一件好事，但不把学到的东西应用到生活当中，那它就没多大用处', book: 'soft-skills-2', chapterTitle: '前言' },
  { text: '如果你真的想改变自己的行为，最好让大脑包裹与萦绕在你想要融入的思想中', book: 'soft-skills-2', chapterTitle: '前言' },
  { text: '在自动化某一个过程之前，你必须知道手动完成这件事情的全过程', book: 'soft-skills-2', chapterTitle: '软件开发过程' },
  { text: '教是最好的学，费曼学习法的核心', book: 'soft-skills-1', chapterTitle: '十步学习法' },
  { text: '先精通一门，再横向扩展', book: 'soft-skills-2', chapterTitle: '技术栈选择' },
  { text: '深耕一个技术栈至少两到三年，频繁切换会阻碍深度积累', book: 'soft-skills-2', chapterTitle: '技术栈选择' },
  { text: '关注技术的底层原理而非框架用法', book: 'soft-skills-2', chapterTitle: '技术栈选择' },
  { text: '基础理论（数据结构、算法、系统）不可跳过', book: 'soft-skills-2', chapterTitle: '自学 vs 正规教育' },
  { text: '用真实项目证明能力，比证书更有说服力', book: 'soft-skills-2', chapterTitle: '自学 vs 正规教育' },

  // ============ 生产力与时间 ============
  { text: '努力工作→辛苦→有价值的东西→带来的幸福感持久；偷懒→愉悦→消费价值的东西→带来的幸福感短暂', book: 'soft-skills-1', chapterTitle: '逃避努力工作' },
  { text: '把大的目标转换为一个个小的计划', book: 'soft-skills-1', chapterTitle: '管好自己' },
  { text: '番茄工作法的本质是专注+休息的节奏，而非计时本身', book: 'soft-skills-1', chapterTitle: '番茄工作法' },
  { text: '批量处理同类任务，比多线程切换更高效', book: 'soft-skills-1', chapterTitle: '生产力提升' },
  { text: '专注力是当代最稀缺的生产力', book: 'soft-skills-1', chapterTitle: '番茄工作法' },
  { text: '时间去哪了？看推送的所谓新闻、看视频、沉迷于刷社交软件', book: 'soft-skills-1', chapterTitle: '时间管理' },
  { text: '任务拆解到五分钟可启动的颗粒度，拖延就消失了', book: 'soft-skills-1', chapterTitle: '拖延症' },

  // ============ 行动力 ============
  { text: '如果你有一个梦想，你最应该做的是脚踏实地马上开始', book: 'soft-skills-2', chapterTitle: '前言' },
  { text: '浪费无数的时间来争论你应该做什么易如反掌，比实际行动容易', book: 'soft-skills-2', chapterTitle: '第一篇 入行' },
  { text: '秘诀就是，你需要亦步亦趋、循序渐进', book: 'soft-skills-2', chapterTitle: '第一篇 入行' },
  { text: '太多的人沿着一个方向执着前行，却不在发轫之始深思熟虑', book: 'soft-skills-2', chapterTitle: '入行' },
  { text: '拥有一份计划永远是至关重要的，你可以不断调整，但没有计划就会随波逐流', book: 'soft-skills-2', chapterTitle: '入行' },

  // ============ 代码与技艺 ============
  { text: '良好的代码结构体现了一个人对技术的奉献精神，而不是敷衍了事', book: 'soft-skills-2', chapterTitle: '结构化代码' },
  { text: '代码本身是用于沟通的，编写通俗易懂的代码才是真正的专业', book: 'soft-skills-2', chapterTitle: '结构化代码' },
  { text: '永远不要陷入对技术的狂热之中，不同的场景需要不同的技术', book: 'soft-skills-1', chapterTitle: '勿陷技术狂热' },
  { text: '专业化等于可靠性加预见性加承担责任', book: 'soft-skills-1', chapterTitle: '专业主义' },

  // ============ 跳槽与面试 ============
  { text: '大量工作岗位来自个人推荐，被推荐时面试官会对你有所偏爱', book: 'soft-skills-1', chapterTitle: '破解面试之道' },
  { text: '即使不换工作也要多面试增加面试经验', book: 'soft-skills-1', chapterTitle: '破解面试之道' },
  { text: '跳槽是最快的涨薪方式，但频繁跳槽会损害长期价值', book: 'soft-skills-1', chapterTitle: '跳槽策略' },
  { text: '职场不是比谁的技术更牛，而是比谁更稀缺', book: 'soft-skills-1', chapterTitle: '跳槽策略' },
  { text: '先做其他工作或无偿工作，再转回开发，这种曲线救国也很有用', book: 'soft-skills-2', chapterTitle: '找到工作' },

  // ============ 创业与自由职业 ============
  { text: '创业要从小处着手，利用业余时间做起来', book: 'soft-skills-1', chapterTitle: '创业' },
  { text: '独立咨询师最大的好处就是赚钱的潜力', book: 'soft-skills-1', chapterTitle: '就业选择' },
  { text: '远程工作的最大挑战是时间管理、自我激励和孤独感', book: 'soft-skills-1', chapterTitle: '远程工作' },

  // ============ 理财 ============
  { text: '先把收入的 20% 存起来，剩下的才是可花的', book: 'soft-skills-1', chapterTitle: '理财基础' },
  { text: '为退休储蓄越早开始，复利的力量越强大', book: 'soft-skills-1', chapterTitle: '理财基础' },
  { text: '不要把所有鸡蛋放在一个篮子里，多元化投资是普通人的护身符', book: 'soft-skills-1', chapterTitle: '投资策略' },
  { text: '尽量少负债，避免消费贷款，但善用低息房贷是合理的', book: 'soft-skills-1', chapterTitle: '债务管理' },
  { text: '金钱买不来幸福，但没钱的生活确实会更痛苦', book: 'soft-skills-1', chapterTitle: '理财心态' },

  // ============ 健身 ============
  { text: '每天必须健身，每天必须健身，每天必须健身', book: 'soft-skills-1', chapterTitle: '健身篇' },
  { text: '久坐是开发者最大的健康敌人，每30分钟起身一次', book: 'soft-skills-1', chapterTitle: '健康与健身' },
  { text: '健身对软件开发人员至关重要，因为它能让你保持高效', book: 'soft-skills-1', chapterTitle: '健身篇' },
  { text: '你吃什么你就是什么，饮食决定体能，体能决定产出', book: 'soft-skills-1', chapterTitle: '饮食与营养' },
  { text: '用头脑赚钱，而不是用时间赚钱', book: 'soft-skills-1', chapterTitle: '职业全景' },

  // ============ 精神与心态 ============
  { text: '假装自己能成功，直到真正成功', book: 'soft-skills-1', chapterTitle: '假装自己能成功' },
  { text: '单凭技术技能既不能成就辉煌的事业，也不能成就灿烂的人生', book: 'soft-skills-2', chapterTitle: '作者介绍' },
  { text: '通过专注于软技能，软件开发人员可以突破玻璃天花板', book: 'soft-skills-2', chapterTitle: '作者介绍' },
  { text: '幸福不是感官刺激，而是一种内心的平静', book: 'soft-skills-2', chapterTitle: '精神篇' },
  { text: '冥想是一种大脑训练，让你能意识到自己何时走神并拉回来', book: 'soft-skills-1', chapterTitle: '精神修炼' },
  { text: '建立积极的心态，从改变最小的习惯开始', book: 'soft-skills-1', chapterTitle: '精神修炼' },
  { text: '目标设定要具体、可衡量、可实现、相关且有时限', book: 'soft-skills-1', chapterTitle: '目标设定' },
  { text: '每天写下三件感恩的事，长期坚持会重塑你的心态', book: 'soft-skills-1', chapterTitle: '精神修炼' },
  { text: '写作是思考的镜子，写下来才能想清楚', book: 'soft-skills-1', chapterTitle: '写作' },
  { text: '当你发现某些东西是人们翘首以盼的，你要么把它找出来，要么把它创造出来', book: 'soft-skills-2', chapterTitle: '前言' },

  // ============ 拖延与意志力 ============
  { text: '拖延是一种逃避负面情绪的机制，不是时间管理问题', book: 'soft-skills-1', chapterTitle: '拖延症' },
  { text: '面对恐惧型拖延，最有效的方法是把任务拆小到不敢为止', book: 'soft-skills-1', chapterTitle: '拖延症' },
  { text: '你不需要意志力，你需要的是系统', book: 'soft-skills-1', chapterTitle: '拖延症' },
  { text: '让正确的事变得容易做，错误的事变得难做', book: 'soft-skills-1', chapterTitle: '拖延症' },

  // ============ 习惯养成 ============
  { text: '培养一个习惯至少需要 30 天，不要在第 10 天就放弃', book: 'soft-skills-1', chapterTitle: '习惯' },
  { text: '把习惯和具体的时间地点绑定，触发条件越明确越容易坚持', book: 'soft-skills-1', chapterTitle: '习惯' },
  { text: '改掉坏习惯的关键是用一个新习惯替代它，而不是单纯戒除', book: 'soft-skills-1', chapterTitle: '习惯' },
  { text: '改掉坏习惯的最好方法之一，就是不要再做一次', book: 'soft-skills-1', chapterTitle: '习惯' },

  // ============ 谈判与表达 ============
  { text: '无论何种谈判场景，谈判的目的都是双赢', book: 'soft-skills-1', chapterTitle: '谈判' },
  { text: '谈判前先做功课，了解对方的真实需求', book: 'soft-skills-1', chapterTitle: '谈判' },
  { text: '永远不要接受第一次报价，那只是起点', book: 'soft-skills-1', chapterTitle: '谈判' },

  // ============ 简历与求职 ============
  { text: '简历不是要罗列你的所有经历，而是要证明你能解决某个问题', book: 'soft-skills-1', chapterTitle: '简历之道' },
  { text: '简历的第一句话决定 HR 是否会继续读', book: 'soft-skills-1', chapterTitle: '简历之道' },
  { text: '简历写的是对方的需求，而不是你的简历', book: 'soft-skills-1', chapterTitle: '简历之道' },

  // ============ 测试与依赖 ============
  { text: '你没有拥有的项目经验，就创造一个', book: 'soft-skills-2', chapterTitle: '找到工作' },
  { text: '不要等到准备好才行动，行动才能让你准备好', book: 'soft-skills-2', chapterTitle: '前言' },
  { text: '把工作当成学习的机会，而不是仅仅当成谋生手段', book: 'soft-skills-2', chapterTitle: '职业规划' },
  { text: '善打组合拳，作品集、博客、社交媒体、内推一起上', book: 'soft-skills-2', chapterTitle: '找到工作' },
];

/**
 * 基于日期 + 字符串哈希 的确定性随机数生成器
 * 保证同一天多次打开返回同一条金句
 * 次日自动切换
 */
function hashStringToInt(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; // 转 32 位整数
  }
  return Math.abs(hash);
}

/**
 * 取今日日期字符串（YYYY-MM-DD）
 * 暴露为独立函数便于测试和复用
 */
export function getTodayDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 根据 seed（日期字符串）选择一条金句
 * 同一 seed 总是返回同一条；seed 变化后切换
 */
export function pickQuoteBySeed(seed: string): Quote {
  if (QUOTES.length === 0) {
    throw new Error('QUOTES is empty');
  }
  const idx = hashStringToInt(seed) % QUOTES.length;
  return QUOTES[idx];
}

/**
 * 获取今日金句（用于 Banner 自动展示）
 */
export function getTodaysQuote(): Quote {
  return pickQuoteBySeed(getTodayDateString());
}

/**
 * 随机换一条（排除当前）
 * @param exclude 当前展示中的金句（避免换到同一条）
 */
export function getRandomQuote(exclude?: Quote): Quote {
  if (QUOTES.length <= 1) return QUOTES[0];
  let next: Quote;
  // 至多尝试 10 次避免极端情况下死循环
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * QUOTES.length);
    next = QUOTES[idx];
    if (!exclude || next.text !== exclude.text) {
      return next;
    }
  }
  return next!;
}
