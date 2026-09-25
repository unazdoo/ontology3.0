---
name: ui-refactor
description: Use this skill when redesigning, refactoring or polishing frontend UI in this project (智财问策 v1.5 prototype). Preserve existing business logic, data identities, routes and functionality while improving visual hierarchy, consistency, responsiveness and usability within the established 蓝金雾玻璃 (blue-gold smoke glass) direction.
---

# UI Refactor Workflow（智财问策 v1.5）

## 适用范围

本 skill 约束在 `designs/prototype-work/v1.5/` 活动源码上的一切高保真重构、视觉优化与体验调整。开始任何工作前，必须先阅读：

1. 仓库根 `AGENTS.md`
2. 仓库根 `HANDOFF-REFACTOR-20260920.md`
3. `designs/prototype-work/v1.5/README.md`
4. 仓库根 `DESIGN.md`（设计语言的唯一权威定义）
5. `outputs/v1.5-verification/` 下最新日期的 `REPORT.md`

## Core principles

1. 保留全部现有业务逻辑、API 行为、路由、数据结构和本地存储协议，除非用户明确要求。
2. 不改变既有业务数据、对象身份、本体身份、版本指纹和来源数据；受保护资源中的 v1.4 字样是原始身份，禁止批量改名。
3. 不修改 `designs/prototype-work/v1.4/` 和 `designs/prototype-releases/`。
4. 不按截图重写系统；视觉优化必须服务于业务逻辑和操作闭环。
5. 优先复用现有组件、工具函数和依赖，不重复造组件，不擅自引入新 UI 框架。
6. 保持全应用视觉一致性；共享视觉层统一收敛在 `composite/shared/blue-gold/`。
7. 主题只拥有表现层，永远不拥有业务状态。

## 业务边界（每次新增/改动交互都要回答）

- 对象、时间、范围、版本、数据资产和证据在跨模块操作中必须保持连续。
- 明确区分：事实、预警、模型提示、模拟方案、建议、批准、执行、效果复核。
- 明确区分：已发布版本、当前正式使用版本、候选试用、草稿、历史记录，不能混淆。
- 新增交互不能导致重复导航、无效跳转或页面复杂度上升。
- 动手前先输出：问题 → 方案 → 涉及页面 → 保留能力，再改代码。
- 任何新增交互要说明：业务边界、状态变化、返回路径、异常恢复。

## Before editing

先检查，不编辑：

- `package.json`、项目结构、全局 CSS / 主题（`composite/shared/blue-gold/`）
- 外壳与导航 `composite/s001-e2e-integration/`（`app.js`、`index.html`、`navigation.css`）
- iframe 主题注入 `runtime/frame-presentation.mjs`、`runtime/start.mjs`
- 代表性页面：首页、对象全景、已发布本体画布、地图、问数、决策中心、报告详情、模型中心、时序
- 真实页面与路由中的现有状态逻辑

识别：重复 UI 模式、间距/字号/颜色不一致、信息层级弱、响应式问题、应共享的组件。

产出一份简短的 UI 重构计划（问题—方案—页面—保留能力），再动手。

## Design implementation 优先级

1. 全局 design tokens（`composite/shared/blue-gold/tokens.css`，勿新增随意色值）
2. 字体排印
3. 布局与间距
4. 共享组件
5. 导航
6. 页面级组件
7. 响应式行为（Desktop / Tablet / Mobile）
8. 微交互

避免：

- 过度渐变、过度圆角卡片、过度阴影、无目的的装饰元素
- 不一致的图标风格、不必要的动画、任意颜色、任意间距值
- 不必要的组件抽象、明显的“AI 味” UI
- 持久动画与轮询；动画须遵从 `prefers-reduced-motion`，后台页（`data-ofw-page-hidden`）须暂停

优先克制、专业、面向产品（数据密集型、企业级分析平台）的 UI。

## Refactoring strategy

增量工作，一次不要同时大改十几个页面。每个页面：

1. 检查当前实现与真实路由状态
2. 识别可复用组件
3. 重构该页面
4. 验证功能（版本切换、对象连续性、事项闭环等不受影响）
5. 运行 lint / 单测 / build
6. 用浏览器实际查看渲染结果（预览 `http://127.0.0.1:4594/`）
7. 修复视觉回归
8. 再进入下一个页面

## Visual verification

有意义的 UI 改动之后：

- 运行应用，检查桌面与移动布局
- 优先验证关键链路：本体版本切换/节点详情/创建修订、地图实体关系、问数到决策、模型发布到时序消费、报告阅读、事项闭环
- 检查溢出、间距、对齐、信息层级、颜色对比
- 有参考截图时对照截图，先按维度做视觉审查（层级/排印/间距节奏/对齐/密度/色彩层级/组件一致性/留白/响应式/AI 味模式），指出问题后逐项修正

修复可见缺陷后再继续。

## 验证命令（活动源码目录内）

```sh
npm test
npm run build
npm run verify:current   # 浏览器回归用独立 CDP4596 会话，不占用用户预览 4594
npm run verify:builder
npm run verify:financing
npm run verify:closure
npm run verify:temporal
npm run verify:glass
```

新证据写入 `outputs/v1.5-verification/` 下新的日期目录，不覆盖历史证据。完成后关闭临时测试浏览器与服务器，保留用户预览。不要推送分支。

## Completion criteria

任务仅当满足以下条件才算完成：

- 功能保持完整，业务数据/身份/指纹未变
- 设计在全应用视觉一致，共享组件被复用
- 响应式布局工作正常
- 无明显视觉回归
- 单测 / build / 浏览器回归通过，证据已归档
