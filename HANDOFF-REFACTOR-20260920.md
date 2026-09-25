# 智财问策 v1.5 原型重构 Handoff（2026-09-20）

## 任务目标

继续在现有 v1.5 原型上做高保真重构和体验优化。当前视觉方向已经确定为“蓝金雾玻璃”，但所有优化都必须服务于业务逻辑和操作闭环，不能按截图重写系统。

重点关注：

- 对象全景、模型与算法、决策中心、本体管理、智能问数的统一体验。
- 对象、时间、范围、版本、数据资产和证据在跨模块操作中保持连续。
- 明确区分事实、预警、模型提示、模拟方案、建议、批准、执行和效果复核。
- 已发布版本、当前正式使用版本、候选试用、草稿和历史记录不能混淆。
- 新增或改动交互不能导致重复导航、无效跳转或页面复杂度继续上升。

## 工作区和约束

- 工作区：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.5`
- 当前分支：`codex/prototype-v1.5.0`
- 活动源码：`designs/prototype-work/v1.5/`
- 预览：`http://127.0.0.1:4594/`
- 静态服务：4592；模型服务：4593。
- 必须先阅读：`AGENTS.md`、本文件、`designs/prototype-work/v1.5/README.md`。
- 不要修改 `designs/prototype-work/v1.4/` 和 `designs/prototype-releases/`。
- 不要改变既有业务数据、对象身份、本体身份、版本指纹和来源数据。
- 不要重置当前工作区，不要覆盖已有未提交修改，不要推送分支。

## 已完成的主要改造

- 已将平台统一为蓝金雾玻璃风格，覆盖首页、数据工程、本体、对象全景、地图、时序、问数、决策、Agent、报告和模型模块。
- 主导航已收敛为一级模块 + 二级入口；重复面包屑、展示性工具条、全局搜索、工作记录、管理员状态和重复“重新读取”行已清理。
- 原品牌脑形 SVG 保留，去除外框和英文副标题，放大并加入神经信号流动、节点闪烁和首页架构路径动效；系统减少动态效果时应停用动画，后台页面应暂停。
- 地图已改为深蓝底图，企业/银行/融资/授信/担保的业务语义仍保留。
- 已发布本体默认进入只读画布，支持精确版本切换、语义结构/数据沿袭、节点侧栏、定义与证据下钻，以及从发布版本创建独立修订草稿。
- 问数、报告、历史会话、模型、地图和弹层中的旧白底及低对比文字已统一适配。
- 报告内嵌屏幕阅读使用深色适配；原报告 HTML、PDF 和打印样式保持原样。
- 模型输入资产采用可逆列式存储，解决连续打开模块时 localStorage 空间不足的问题，数据指纹和业务记录保持不变。

## 关键文件

- 外壳与导航：`composite/s001-e2e-integration/app.js`、`index.html`、`navigation.css`
- 蓝金主题：`composite/shared/blue-gold/`
- iframe 主题注入：`runtime/frame-presentation.mjs`、`runtime/start.mjs`
- 本体已发布画布适配：`runtime/ontology-experience.mjs`、`composite/ontology/published-workspace.js`、`composite/ontology/experience.css`
- 地图：`src/map.js`
- 时序：`src/temporal.js`、`src/temporal.css`
- 模型：`composite/model-center/`、`composite/shared/model-studio.js`
- 决策中心：`composite/integrations/decision-hub.js`、`decision-hub.css`
- 当前精修证据：`outputs/v1.5-verification/glass-refinement-20260919/`
- 精修说明：`outputs/v1.5-verification/glass-refinement-20260919/REPORT.md`

## 新窗口开始时的建议顺序

1. 先阅读 `AGENTS.md`、本 handoff、README 和最新 REPORT。
2. 启动预览，先查看首页、对象全景、已发布本体画布、地图、问数回答、决策中心和报告详情。
3. 用真实页面和路由理解现有状态逻辑，再决定改动范围。
4. 修改后优先验证：本体版本切换/节点详情/创建修订、地图实体关系、问数到决策、模型发布到时序消费、报告阅读和事项闭环。
5. 最后执行单元测试、构建和浏览器回归；新证据写入新的日期目录，不覆盖历史证据。

## 验证命令

在活动源码目录运行：

```sh
npm test
npm run build
npm run verify:current
npm run verify:builder
npm run verify:financing
npm run verify:closure
npm run verify:temporal
npm run verify:glass
```

浏览器回归使用独立 CDP4596，会话不要占用用户当前预览。上一轮结果为：204 项单元测试通过；精修专项 48 个页面/状态通过、颜色问题 0；当前业务回归 37 项通过；原模块补充链路 16 项通过；事项闭环 17 + 11 项通过；响应式/导航专项 93 个检查通过。

## 可直接交给新窗口的指令

请在 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.5` 继续智财问策 v1.5 的原型重构。先阅读 `AGENTS.md`、`HANDOFF-REFACTOR-20260920.md`、`README.md` 和最新 `REPORT.md`，再检查实际页面、路由、状态和跨模块协议。保持蓝金雾玻璃方向，保留原品牌 SVG、业务数据、对象/本体身份、版本和全部有效功能。不要按截图重写，不要修改 v1.4 或 frozen releases。任何新增交互都要说明业务边界、状态变化、返回路径和异常恢复，并补充真实浏览器回归。先给出问题—方案—页面—保留能力，再动手修改。
