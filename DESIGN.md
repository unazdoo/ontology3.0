# 智财问策 v1.5 设计语言（DESIGN.md）

> 本文件回答“这个项目最终应该长什么样”，是视觉决策的唯一权威来源。
> “应该怎么工作”见 `.kimi/skills/ui-refactor/SKILL.md`。
> 本文件的数值与 `designs/prototype-work/v1.5/composite/shared/blue-gold/` 的实现保持同步；改设计先改这里，再落到 tokens。

## 1. 产品方向

风格定位：

- 专业、现代、克制的企业级数据分析平台
- 高信息密度、清晰信息层级
- 深色沉浸式分析环境：**蓝金雾玻璃**（blue-gold smoke glass）——深蓝雾面玻璃质感 + 金色点缀
- 数据与业务状态是第一公民，装饰永远服务于阅读和操作

避免：

-  flashy 营销风、过大的 hero 标题、大面积渐变滥用
- 到处都是玻璃拟态导致的层级糊化（玻璃面板用于承载内容，不是装饰）
- 过度卡片嵌套、无目的的装饰元素
- 明显的“AI 味” UI：随意圆角、随意阴影、随意配色、无意义动效

## 2. 颜色

主题作用域：`html[data-ofw-theme="blue-gold"]`。主题只拥有表现层，不拥有业务状态。

### 2.1 文字（ink）

| 角色 | Token | 值 |
| --- | --- | --- |
| 主文字 | `--glass-ink` / `--ink` / `--text-primary` | `#eaf2fc` |
| 次级文字 | `--glass-muted` / `--text-secondary` | `#a9bdd3` |
| 弱化/说明 | `--glass-faint` / `--faint` / `--subtle` | `#8ba2ba` |

### 2.2 线条与边框

| 角色 | Token | 值 |
| --- | --- | --- |
| 常规边框/分割线 | `--glass-line` / `--line` / `--border` | `rgba(188,215,246,.2)` |
| 强调边框 | `--glass-line-strong` / `--line-strong` | `rgba(188,215,246,.35)` |

### 2.3 表面（surface）

| 角色 | Token | 值 |
| --- | --- | --- |
| 主面板 | `--glass-panel` / `--surface` | `rgba(17,36,61,.77)` |
| 次级面板 | `--glass-panel-soft` / `--surface-2` | `rgba(21,43,70,.53)` |
| 实心面板 | `--glass-solid` | `#152c48` |
| 三级表面 | `--surface-3` | `rgba(10,28,48,.5)` |
| 输入框底 | `--glass-input` | `rgba(4,18,37,.46)` |
| 悬停 | `--glass-hover` / `--surface-hover` | `rgba(176,211,249,.12)` |
| 画布（浅） | `--canvas` | `rgba(5,20,39,.35)` |
| 画布（深） | `--canvas-deep` | `rgba(5,20,39,.55)` |

### 2.4 语义色

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 主色/强调（蓝） | `--glass-blue` / `--blue` / `--accent` | `#96c8fa` | 主要操作、链接、聚焦信息 |
| 金色（点缀/预警/琥珀） | `--glass-gold` / `--amber` / `--orange` | `#e6c18a` | 焦点轮廓、强调点缀、预警/注意 |
| 成功/正向（绿） | `--glass-green` / `--green` | `#a0d7bd` | 正常、通过、正向指标 |
| 危险/负向（红） | `--glass-red` / `--red` | `#f2a495` | 错误、风险、负向指标 |
| 辅助（青） | `--teal` | `#98d8cc` | 次要数据系列、辅助标记 |
| 辅助（紫） | `--purple` | `#c5b1e3` | 次要数据系列、分类 |

注意：金色是点缀色，不大面积铺底；蓝色承担主要交互与信息强调。

### 2.5 环境背景

页面环境背景（`body::before`）固定为：

```
radial-gradient(ellipse at 4% 5%, #245f9d36, transparent 55%),
radial-gradient(ellipse at 94% 97%, #92724522, transparent 45%),
linear-gradient(135deg, #071525, #0c213d 52%, #111d2e)
```

地图画布固定为深蓝 `#08182c`；企业/银行/融资/授信/担保的业务语义色沿用原信号色，不因主题改动而改变含义。

### 2.6 焦点与选择

- 焦点轮廓：`2px solid var(--glass-gold)`，`outline-offset: 3px`
- 选区：`background: #83b5e44d; color: #fff`
- 表单控件 `accent-color: #accde8`

## 3. 字体排印

字族：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`

| 角色 | Token | 基准值（≥1800px / ≥2350px 会放大，≤720px 会缩小） |
| --- | --- | --- |
| 正文 | `--glass-type` / `--type-body` | 15px（→16px / 18px；窄屏 14px） |
| 说明/辅助 | `--glass-caption` / `--type-caption` | 13px（→14px / 15px；窄屏 12px） |
| 页面标题 h1 | `--glass-title` / `--type-title` | 30px / 1.35 / 600（→34px / 39px；窄屏 24px） |
| 区块标题 h2 | `--glass-subtitle` / `--type-subtitle` | 19px / 1.45（→21px / 24px；窄屏 18px） |
| 小节标题 h3 | — | 16px / 1.5 |

规则：

- `h1–h4` 颜色为 `--glass-ink`，`letter-spacing: 0`（中文不额外加字距）。
- 正文字号随视口分档缩放（见 tokens.css 的三档媒体查询），不为单页手写任意字号。

## 4. 圆角与阴影

| 角色 | Token | 值 |
| --- | --- | --- |
| 统一圆角 | `--glass-radius` / `--radius` | 10px |
| 常规阴影 | `--shadow` | `0 14px 40px #020a1428` |
| 弹层/浮层阴影 | `--shadow-pop` | `0 22px 70px #01081880` |

- 全平台统一 10px 圆角，不引入 6/8/12 之外的任意圆角值；旧模块通过共享层适配，不逐页新造圆角。
- 阴影克制使用；常规内容面板不叠多层阴影。

## 5. 间距与布局

- 间距基于 4 的倍数：4 / 8 / 12 / 16 / 24 / 32 / 48；不发明任意间距值。
- 导航：单一可折叠两级菜单（一级模块 + 二级入口）。同工作区切换复用页面，跨页面切换保留原画面至目标就绪。不新增重复面包屑、展示性工具条、全局搜索、工作记录、管理员状态行。
- 导航拥有路径指引（wayfinding）；每个页面拥有自己的业务操作。页面内不再渲染重复模块栏（报告/驾驶舱内嵌时隐藏旧 `.module-bar`）。
- 首页架构图按可用高度缩放，不裁切节点；宽屏 `max-width: 1860px`。

## 6. 组件基调

- 空态、加载态、KPI、上下文盒、视图卡、向导、tooltip/popover 等辅助表面：统一 `--glass-panel` 底 + `--glass-line` 边 + `--glass-ink` 文字。
- KPI 数值用 `#ecf4ff`；说明文字用 `#b5c9dd`。
- 历史/会话列表：默认 `#17334ee6` 底；选中态 `#234662` 底 + 金色描边。
- 弹层（maplibre popup 等）：深色底 `#163751`、细边框、6–10px 圆角、阴影 `--shadow-pop`。
- 表格、表单、按钮等遵循共享层；旧白底与低对比文字通过共享层一次性适配，不在页面内局部覆盖。

## 7. 动效

- 品牌脑形 SVG：神经信号流动（`neural-signal` 3.8s）、节点闪烁（`neural-node` 3.8s 分相）、金色延迟信号；首页架构路径流动、中心扫描/脉冲。
- 交互动效：按钮/链接 `transition: background-color/border-color/color 160ms`。
- 强制约束：
  - `prefers-reduced-motion: reduce` 时停用全部动画与过渡。
  - 后台页 `html[data-ofw-page-hidden="true"]` 暂停品牌与架构动画。
  - 不新增持久动画与轮询。

## 8. 响应式

- 断点（以 tokens.css 为准）：
  - 字号缩放：≥1800px、≥2350px 放大；≤720px 缩小。
  - 导航：≤1100px 折叠为可收起侧栏；品牌缩小；≤1399px 压缩导航列宽与字号。
  - 首页：≤1000px 架构图改为单列；≤600px 进一步压缩节点。
- 任何新交互必须在 Desktop / Tablet / Mobile 三档下可用、不溢出、不重复导航。

## 9. 可访问性

- 深色主题下保证文字对比；金色焦点环始终可见。
- 尊重 `prefers-reduced-motion` 与 `data-ofw-low-motion="true"`。
- 表单 `color-scheme: dark`；滚动条细窄低干扰。

## 10. 实施约定

- 共享视觉层：`designs/prototype-work/v1.5/composite/shared/blue-gold/`（`tokens.css` / `index.css` / `shell.css` / `modules.css` / `objects.css` / `refinement.css` / `report-reading.css` / `presentation.js`）。
- iframe 主题注入：`runtime/frame-presentation.mjs`、`runtime/start.mjs`（首次绘制前加载主题；不改写冻结版本源文件；打印规则不参与转换）。
- 关键模块：外壳/导航 `composite/s001-e2e-integration/`；本体 `composite/ontology/` + `runtime/ontology-experience.mjs`；地图 `src/map.js`；时序 `src/temporal.js/.css`；模型 `composite/model-center/` + `composite/shared/model-studio.js`；决策 `composite/integrations/decision-hub.js` + `decision-hub.css`。
- 报告：内嵌屏幕阅读用深色适配；原报告 HTML、PDF、打印样式保持原样。
- 预览 `http://127.0.0.1:4594/`；验证与证据规则见 SKILL.md。

---

## 附录 A：Phase 1 设计地基（2026-09-20）

本附录是 Phase 1 的产出，作为后续逐页“去覆盖化”的依据。原则：只增不改既有 token 值，不删覆盖（覆盖在页面接入组件后逐条回退）。

### A.1 新增 token（`blue-gold/tokens.css`）

| 类别 | 变量 | 值 / 说明 |
| --- | --- | --- |
| 间距 | `--space-1..8` | 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 |
| 圆角 | `--radius-sm / --radius-lg / --radius-pill` | 6px / 14px / 999px（`--radius` 仍为 10px） |
| 阴影 | `--shadow-sm` | `0 4px 14px #02101f22`（`--shadow`、`--shadow-pop` 沿用） |
| 层级 | `--z-nav / --z-drawer / --z-modal / --z-toast` | 20 / 60 / 80 / 100 |
| 覆盖/焦点 | `--glass-scrim` / `--focus-ring` | `rgba(0,13,32,.52)` / `2px solid var(--glass-gold)` |
| 图表系列 | `--chart-1..6` | blue / gold / green / teal / purple / red（复用语义色，无新色） |
| 主操作 | `--action-primary-bg / -ink / -border` | 蓝渐变 / 深墨文字 / 边（teal 主色收敛为蓝，金色只做点缀/焦点） |

### A.2 圆角归并（原生 9 档 → 4 档）

| 原生值 | 归入 | 说明 |
| --- | --- | --- |
| 2 / 3 / 4 px | `--radius-sm`(6px) | 小控件、标签 |
| 5 / 6 / 7 px | `--radius-sm`(6px) | 近似合并 |
| 8 / 9 px | `--radius`(10px) | 标准卡片/面板 |
| 10 px | `--radius`(10px) | 标准 |
| 999 px | `--radius-pill`(999px) | badge / progress / pill / series-legend 等 |

### A.3 原生高频硬编码色 → token 映射

| 原生色 | 角色 | 映射 token |
| --- | --- | --- |
| `#172536` `#27394b` `#405469` | 墨（深色文字/标题） | `--glass-ink` 族（深色主题下为亮色文字，语义反向，接入时以 token 为准） |
| `#f7f9fb` `#f9fbfc` `#f8fafc` `#f6f8fa` `#f4f7fa` | 纸（亮面板底） | `--glass-panel` / `--glass-panel-soft` |
| `#e8d0a9` | 金（强调/指标值） | `--glass-gold` |
| `#b5dacb` `#9cceaf` | 绿（正向） | `--glass-green` |
| `#e6bcb9` | 红（负向/错误） | `--glass-red` |
| `#315f91` `#6b8caf` | 蓝（链接/边框/信号） | `--glass-blue` / `--glass-line-strong` |
| `#087f91` `#167d8d` `#0990a3` | teal（旧主操作色） | 收敛为 `--glass-blue`（主操作）；teal 仅保留为 `--chart-4` |
| `#8795a2` `#9fb6cc` `#aebdcb` | 灰（次级文字） | `--glass-muted` / `--glass-faint` |
| `#dbe4df` `#d7dfe6` `#dce3eb` … | 浅线（边框） | `--glass-line` |

> 说明：原生为亮色主题，文字色深、面板色浅；蓝金为深色主题，方向相反。替换时以“语义角色”对应 token，而非字面明暗直接搬值。

### A.4 断点收敛规范（5 档）

| 档位 | 阈值 | 用途 |
| --- | --- | --- |
| 手机 | ≤720px | 单列、缩小字号/导航折叠 |
| 平板 | ≤1100px | 导航折叠为侧栏、栅格列数减少 |
| 桌面 | ≤1399px | 压缩导航列宽/字号 |
| 大屏 | ≥1800px | 字号/间距放大、栅格列数增加 |
| 超大屏 | ≥2350px | 字号进一步放大 |

历史分散阈值（500/600/650/900/1000/1050/1600 等）在逐页接入时归并到最近的规范档。

### A.5 共享组件类（`blue-gold/components.css`）

`.ofw-card` `.ofw-panel`（卡片/面板）、`.ofw-btn`（`--primary/--danger/--text`）、`.ofw-badge`（`--green/--amber/--red`）、`.ofw-table`、`.ofw-field`、`.ofw-modal`（+`.ofw-modal-scrim`）、`.ofw-empty`。
Phase 2 外壳优先接入，Phase 3 各主链路页逐页接入并回退对应 `modules.css`/`objects.css` 覆盖。

### A.6 Phase 2a — 外壳样式内化（2026-09-20）

外壳样式不再依赖 v1.1/v1.2 表现层。新增 `composite/s001-e2e-integration/shell-base.css`（dark 原生，token 化），承载 app.js 实际渲染的全部外壳/首页/模块容器/浮层样式与关键帧；`index.html` 已移除 v1.1 type-scale + v1.2 styles 两个 link，改引 `./shell-base.css`。本地 `styles.css`/`navigation.css` 覆盖微调和 `blue-gold/` 覆盖层暂保留（Phase 2b 起逐步收敛）。

外壳字号变量 `--ofw-type-10..24` 已内联进 shell-base.css（原 v1.1 type-scale）。

### A.7 Phase 2b — 外壳去覆盖化（2026-09-21）

外壳 chrome（platform-shell / global-nav / primary-nav / nav-item / primary-children / nav-fold-control / nav-foot / global-topbar / shell-main / module-view / frame-stage / 抽屉 / 弹层 / toast）现由 `composite/s001-e2e-integration/shell-base.css` 作为**唯一作者源**，dark 原生、token 化、无 `!important`。

- 真实布局：桌面 ≥1101px 为横向顶部导航（75px：品牌 232px + 一级模块自适应 + 折叠钮 37px；二级入口为展开的横条）；窄屏 ≤720px 为左侧 52px 图标竖栏，展开时 236px 覆盖；折叠态保持顶栏、隐藏文字。
- `navigation.css` 已不再被 `index.html` 加载（其窄屏/侧栏规则已并入 shell-base.css 窄屏块）。
- `blue-gold/shell.css` 与 `blue-gold/refinement.css` 中的外壳 chrome `!important` 覆盖已删除（外壳大屏放大、中等屏紧凑、品牌脑描边等已迁入 shell-base.css 对应媒体查询）；两者现仅保留模块级与演示控件规则。
- `styles.css` 收缩为**首页内容专属**（home-capability 面板/入口、classic-architecture 架构环等），并已 dark 化为 token 原生；其原有外壳 chrome 亮色规则全部移除。
- 契约测试锚点：`shell-contract.test.mjs` 引用 `./shell-base.css`。

> **Phase 2b 已完成并验证（2026-09-21）**：shell-base.css 409 行（含首页容器查询缩放），shell.css 59→6 行、refinement.css 68→27 行、styles.css 203→61 行（亮色硬编码清零）。关键修复：`.shell-main` 用高特异性选择器（`html[data-ofw-module="shell"][data-ofw-theme]`）无条件单行，压过 `shared/experience.css:177` 残留的 58px topbar 行（外壳 topbar 已由 `topbarMarkup()` 返回空而废弃）。验证：204 单测 + build + verify:glass（48 页/状态 + 四视口 + 动效）+ verify:current（37 项）全过。证据：`outputs/v1.5-verification/phase2b-shell-20260921/`。

### A.8 Phase 3 — 业务页收敛到组件层（进行中）

继承模块（query/m07 部分/dashboard 等 frozen 源）DOM 类名不可改，收敛路径是 **components.css 的 Inherited-module class aliases**：用 `:is()` 把继承类名映射到 `.ofw-card/.ofw-btn/.ofw-badge` 同一组件定义（带 `!important` 压 frozen 亮色基），再删 modules.css/refinement.css 中的重复覆盖。取值一律按浏览器实测计算值对齐，保证删覆盖后视觉零变化。

- **3a query（2026-09-22 完成）**：components.css 增别名段（卡片/ui-button/ui-badge/场景 tab/KPI 亮色），modules.css 删 9 条重复、refinement.css 删 1 条。blue-gold 层 `!important` 332→278。204 单测 + glass + current 全过。
- **3b m07（v1.5 自有模块）**：可直接改源 `composite/modules/m07/styles.css`（1331 行亮色硬编码），接入 `.ofw-*` 组件并删原生亮色值，收敛空间更大。

组件别名段是后续每页收敛的固定范式：先实测该页计算值 → 在 components.css 加/复用别名 → 删对应覆盖 → 四项验证。

### A.9 Phase 3b–3f 完成 + 审查修复（2026-09-22）

v1.5 自有模块样式表全部 dark 原生 token 化：m07、model-center(+studio)、dashboard、decision-hub、temporal、src（联合态势）、model-result-view。blue-gold 覆盖层 `!important` 332→180。审查修复后：`experience.css` 删除 23 行遗留外壳 chrome（只被外壳引用）；shell-base.css 修正 `.global-nav` z-index 为 `--z-nav`、`.frame-stage>.module-frame{grid-area:1/1}` 恢复切换叠放、`.primary-children` 自带深色背景、清理死规则（topbar/nav-foot/user-account 等 topbarMarkup 恒空的类）；外壳与 dashboard 样式 link 版本号升至 20260922-01。
