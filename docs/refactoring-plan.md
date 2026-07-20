# FutureOS 体验优化重构方案

> 版本：v1.0 | 日期：2026-07-20
> 目标：解决当前"效果不好"的五个核心痛点，按优先级排列，每项给出问题定位、改动范围、具体实现路径和验收标准。

---

## P0：流式生成体验（修"丑"）

### 问题

`ThoughtStream` 组件把 AI 返回的原始 JSON（`{"theme":"GPU","learning":{"title":...`）逐字打在屏幕上，用户看到的是一堆花括号和转义字符在滚动，等生成完才突然跳成正常界面。

### 涉及文件

- `src/app/page.tsx` — `ThoughtStream` 组件、`handleStart`、`handleComplete`
- `src/app/api/mission/start/stream/route.ts`
- `src/app/api/mission/complete/stream/route.ts`
- `src/services/mission/mission.service.ts` — `streamStart`、`streamComplete`

### 方案

**策略：后端流式解析 + 前端分阶段渲染**

1. 后端改造（`streamStart` / `streamComplete`）：
   - 在 SSE 流中不再透传原始 delta，改为后端累积 JSON 并实时解析已完成的字段。
   - 定义分阶段事件协议：
     ```
     event: phase
     data: {"phase": "theme", "value": "GPU"}

     event: phase
     data: {"phase": "learning_title", "value": "GPU：并行计算的引擎"}

     event: delta
     data: {"field": "learning_content", "chunk": "图形处理器（GPU）是一种..."}

     event: phase
     data: {"phase": "questions_ready", "value": 3}

     event: done
     data: {}
     ```
   - 实现方式：后端维护一个 `acc` 字符串，每收到一个 delta 就尝试用正则/增量 JSON parser 提取 `learning.content` 字段已生成的部分，通过 `field: learning_content` 事件推送给前端。

2. 前端改造（`page.tsx`）：
   - 删除 `ThoughtStream` 组件（裸 JSON 展示）。
   - 新增 `MissionGenerating` 组件：
     - 阶段一（0-1s）：显示骨架屏 + "教练正在为你备课…" 文案 + 呼吸动画。
     - 阶段二（收到 `learning_content` delta）：渐进渲染 Markdown 阅读材料（打字机效果，但内容是正常文字而非 JSON）。
     - 阶段三（收到 `done`）：淡入完整 Mission 卡片（含题目）。
   - Review 流式同理：渐进渲染 `summary` → `strength` → `weakness` → `suggestion`。

3. 降级策略：
   - 如果流式连接失败，fallback 到非流式 `POST /api/mission/start`，前端显示全屏 loading spinner（不超过 8s）。

### 验收标准

- 用户点击"开始一场 Mission"后，1s 内看到有意义的中文内容（非 JSON）。
- 生成过程中无花括号、引号、转义字符出现。
- 网络断开时不白屏，显示友好错误提示。

---

## P1：Learning 内容深度（修"空"）

### 问题

seed 里每个概念只有 2-3 句话（约 80-120 字），prompt 写了"可直接使用概念资料"，`max_tokens: 1500` 要同时装 Learning + 3 道题的 JSON。实际生成的阅读材料经常就是 seed 描述换个说法，远达不到"5-10 分钟阅读"。

### 涉及文件

- `src/prompts/index.ts` — `buildMissionPrompt`
- `src/services/ai/openai-compatible.provider.ts` — `max_tokens` 配置
- `prisma/seed.mjs` — 概念描述（可选扩充）
- `src/services/ai/types.ts` — 输出结构定义

### 方案

**策略：Prompt 重写 + Token 预算提升 + 输出结构拆分**

1. Prompt 重写（`buildMissionPrompt`）：
   ```
   【Task】为上述概念生成一次每日 Mission。

   Learning 要求（严格遵守）：
   - 字数：800-1200 字（中文），约 5-8 分钟阅读
   - 结构：① 一句话定义 → ② 核心机制/原理（用类比解释）→ ③ 一个真实案例（2024-2026年）→ ④ 一个反直觉视角或常见误解 → ⑤ 与用户已学主题的交叉点（若有）
   - 禁止：直接复述概念资料原文；禁止"总之""综上所述"等套话
   - 语气：像一位懂行的朋友在咖啡馆给你讲，不是教科书

   Thinking 固定 3 题：
   - EXPLAIN：用自己的话解释核心机制（考理解）
   - REASON：给一个假设情境，要求推理结果（考推理）
   - CONNECT：要求与另一个领域/概念建立联系（考连接）
   每题应具体、有场景感，不要"请解释什么是XXX"这种百科式提问。
   ```

2. Token 预算调整：
   - `max_tokens` 从 1500 → 3000（Learning 800-1200 字 ≈ 1200-1800 tokens + 3 题 ≈ 400 tokens + JSON 结构开销）。
   - 在 `CompatibleConfig` 中按 taskType 区分：Mission 生成用 3000，Review 用 1500，Verify 用 500。

3. 输出结构优化（可选，P1.5）：
   - 将 Mission 生成拆为两次调用：第一次只生成 Learning（`max_tokens: 2500`），第二次基于 Learning 生成 3 题（`max_tokens: 800`）。
   - 好处：避免长 JSON 截断风险；Learning 质量更稳定。
   - 代价：多一次 API 调用，延迟 +2-3s（可用流式掩盖）。

4. Seed 描述扩充（可选）：
   - 将 seed 中每个概念的 `description` 从 2-3 句扩充到 5-6 句（增加一个关键数据点 + 一个产业关联），给 AI 更多素材。
   - 不强制，因为 Prompt 已要求 AI 自行扩展。

### 验收标准

- 生成的 Learning 内容 ≥ 600 字（中文），包含至少一个具体案例。
- 3 道题目各有场景感，非"请解释 XXX 是什么"。
- 连续 5 次生成无 JSON 截断（questions 数组完整、content 非空）。

---

## P2：世界模型图谱（修"平"）

### 问题

概念图谱用 `sqrt(n)` 网格布局，80+ 节点等间距排成方阵，看不出聚类、层级或关联强度。不像"世界模型"，像一张点阵图。

### 涉及文件

- `src/app/world/page.tsx` — 整个页面重写
- `package.json` — 已有 `reactflow@11.11.4` 依赖（当前未使用）

### 方案

**策略：用 ReactFlow 替换手写 SVG，力导向布局 + 分类聚类**

1. 布局引擎：
   - 引入 `d3-force`（或用 ReactFlow 自带的 dagre 布局）做力导向计算。
   - 按 `category` 分组，同组节点间斥力小、异组斥力大，自然形成聚类。
   - 已掌握节点（LEARNED/MASTERED）固定在内圈，未掌握在外圈。

2. 视觉层级：
   - 节点大小：按 degree（关联数）映射，范围 12-28px。
   - 节点颜色：按 category 着色（AI=蓝、Robotics=绿、Semiconductor=橙、Finance=紫、Infrastructure=灰）。
   - 已掌握：实心 + 微光；学习中：半透明；未接触：虚线边框。
   - 边：保留关系颜色，但默认 opacity 0.2，hover 节点时高亮关联边（opacity 0.8）。

3. 交互：
   - 支持缩放、拖拽、框选。
   - 点击节点：右侧面板展示详情（复用现有 `NodeDetailView`）。
   - 双击节点：跳转到该概念的 Mission（如果已学过则显示历史 Learning）。
   - 顶部增加 category 筛选 chips。

4. 性能：
   - 80 节点 + 120 边，ReactFlow 无压力。
   - 布局计算在 `useMemo` 中完成，只在数据变化时重算。

### 验收标准

- 打开世界页面，能一眼看出 5-6 个概念聚类（AI、机器人、半导体、金融、基础设施）。
- 已掌握节点与未掌握节点视觉区分明显。
- 点击节点有详情面板，hover 有高亮关联。
- 页面可缩放拖拽，不卡顿。

---

## P3：能力评分质量感知（修"假"）

### 问题

`evidenceToDeltas` 只判断"有没有答"，不判断"答得好不好"。500 字深度分析和"不知道"拿到相同的 +2。AI Review 已经给出了 strength/weakness 评价，但评分系统完全没用上。

### 涉及文件

- `src/services/cognitive/cognitive.service.ts` — `evidenceToDeltas`
- `src/prompts/index.ts` — `buildReviewPrompt`
- `src/services/ai/types.ts` — `ReviewAIOutput` 类型
- `src/services/mission/mission.service.ts` — `completeMission` 中调用 deltas 的位置

### 方案

**策略：让 AI Review 同时输出能力评分，替代固定 delta**

1. 扩展 Review 输出结构：
   ```json
   {
     "summary": "...",
     "strength": ["...", "..."],
     "weakness": ["...", "..."],
     "suggestion": ["...", "..."],
     "abilityDeltas": {
       "understand": 3,
       "reason": 1,
       "connect": 2,
       "predict": 2,
       "update": 1
     }
   }
   ```
   - 每个维度 delta 范围：-1 ~ +3（doc 12 §7 约束）。
   - Prompt 中增加评分指引：
     ```
     abilityDeltas 评分规则：
     - 该维度对应题目回答 ≥3 句且有独立见解 → +3
     - 回答正确但平淡（复述为主）→ +2
     - 回答简短或偏题 → +1
     - 未作答或完全错误 → 0
     - predict 维度：预测具体、可验证、有置信度理由 → +3；泛泛而谈 → +1
     - update 维度：连续天数 ≥3 额外 +1（由系统注入，AI 不管）
     ```

2. 修改 `completeMission`：
   - 优先使用 `review.abilityDeltas`（AI 评分）。
   - 如果 AI 返回的 deltas 解析失败或缺失，fallback 到现有 `evidenceToDeltas`（机械评分）。
   - `update` 维度的连续天数加成仍由系统计算，叠加在 AI 评分之上。

3. 前端反馈：
   - 完成 Mission 后，在 Review 卡片中展示各维度 delta：`理解 +3 | 推理 +1 | 连接 +2`。
   - 用绿色小箭头 + 数字，让用户知道"这次哪里练到了"。

### 验收标准

- 两次不同质量的回答（详细 vs 敷衍），能力 delta 有明显差异。
- Review 卡片中可见各维度得分变化。
- AI 评分解析失败时不崩溃，fallback 到机械评分。

---

## P4：完成体验与情绪钩子（修"淡"）

### 问题

完成 Mission 后只有一个绿色卡片写"已完成"，没有成就感。成长页的雷达图和趋势图是静态 SVG，没有动画。一个日频产品缺乏"每天想回来"的情绪驱动。

### 涉及文件

- `src/app/page.tsx` — `CompletedView` 组件
- `src/app/growth/page.tsx` — `RadarChart`、`TrendChart`
- `src/app/globals.css` — 动画定义
- `package.json` — 已有 `framer-motion@12.42.2`（当前未使用）

### 方案

**策略：峰终体验设计 — 完成瞬间的仪式感 + 成长可视化的动态反馈**

1. 完成瞬间（`CompletedView` 重构）：
   - 触发一个轻量 confetti 动画（用 `framer-motion` 或 CSS particles，不引入额外库）。
   - 能力值变化用数字跳动动画展示：`理解 52 → 55 (+3)`，数字从旧值滚动到新值。
   - 显示一句 AI 生成的"今日金句"（从 Review.summary 提取，或让 AI 额外输出一句鼓励）。
   - 连续打卡天数用火焰图标 + 天数展示，≥3 天时火焰变大变色。

2. 成长页动效：
   - 雷达图：首次加载时从中心点动画展开到实际值（`framer-motion` 的 `animate`）。
   - 趋势图：折线从左到右绘制动画（SVG `stroke-dashoffset` 动画）。
   - 统计数字：进入视口时从 0 滚动到实际值（count-up 效果）。

3. 每日回访钩子：
   - 导航栏"今日"tab 旁，如果当天未完成 Mission，显示一个小圆点提醒。
   - 首页顶部增加一行轻量状态条：`Day 7 · 连续 3 天 · 距下次能力突破还差 2 场`。
   - 完成 Mission 后的"再来一场"按钮改为更有吸引力的文案：`趁热打铁，再解锁一个概念 →`。

4. 预测到期提醒：
   - 如果有预测到达 `targetDate`，首页顶部显示一条提示：`你 30 天前关于"HBM 供给偏紧"的预测到期了，去验证 →`。

### 验收标准

- 完成 Mission 瞬间有视觉庆祝（confetti / 数字跳动），持续 2-3s 后自然消失。
- 成长页雷达图有展开动画，趋势图有绘制动画。
- 连续打卡 ≥3 天时有视觉强化（火焰/颜色变化）。
- 有到期预测时首页有提醒入口。

---

## 实施顺序与依赖

```
Week 1: P0（流式体验）+ P1（内容深度）
  └─ P0 和 P1 可并行：P0 改前端渲染 + 后端 SSE 协议；P1 改 Prompt + token 配置
  └─ P1 完成后 P0 的流式内容才有意义（否则流式展示的也是薄内容）

Week 2: P2（世界图谱）
  └─ 独立模块，不依赖 P0/P1
  └─ ReactFlow + d3-force 布局，页面级重写

Week 3: P3（评分质量）+ P4（情绪钩子）
  └─ P3 改 Prompt + 后端逻辑；P4 改前端动效
  └─ P4 的"能力值跳动"依赖 P3 的差异化 delta 才有意义
```

---

## 技术债顺手清理

在重构过程中顺带修复的小问题：

| 问题 | 位置 | 修复 |
|------|------|------|
| `streamStart` 中 `this.startMission()` 会重新 `getLatest` 可能创建新 Mission | `mission.service.ts:98` | 改为直接调用 `missionRepository.setStarted(m.id, ...)` 而非走 `startMission` |
| Review 中 `strength/weakness/suggestion` 存为 JSON 字符串，读取时需 `JSON.parse` | `mission.repository.ts` / `mappers.ts` | 确认 mapper 中有 parse，或改用 Prisma Json 类型 |
| `max_tokens: 1500` 硬编码在 provider 中，无法按任务区分 | `openai-compatible.provider.ts` | 改为 `chat(prompt, opts?: {maxTokens?: number})` |
| 世界页 `positions` 计算在节点数为 0 时 `Math.sqrt(0)` 导致除零 | `world/page.tsx:48` | 加 `if (n === 0) return empty` 守卫（已有但可加固） |
| `DailyStatistics` 无 `@@unique([userId])` 约束，理论上可重复创建 | `schema.prisma:234` | 加 `@@unique([userId])` 或改为 `userId @unique` |

---

## 不改的部分（确认保留）

- 模块化单体架构（ADR-001）：当前规模完全够用，不拆微服务。
- Provider 可替换机制（ADR-004）：设计良好，Mock fallback 是安全网。
- 概念选择算法（Concept Engine）：确定性 + 图遍历 + 去重，逻辑正确。
- 数据库 Schema 整体结构：实体关系清晰，索引合理。
- 预测"用户手写、AI 不代写"的产品原则：保持不变。
