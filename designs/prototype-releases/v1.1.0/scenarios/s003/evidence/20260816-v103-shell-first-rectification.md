# S003 以 v1.0.3 壳为主体的总装整改证据

- 验证日期：2026-08-16
- 场景：`S003 / S003-v1` · 原型 `1.1.0` · 父基线 `1.0.3 / BSL-S001-V103-DE0119608E26`
- 服务方式：`http://127.0.0.1:4333/scenarios/s003/`（服务根 `prototype-work/v1.1.0`）

## 整改前提（用户确认的方向）

以 v1.0.3 壳为主体，S003 场景真实装入并跑通端到端流程；实现效果不得是简单套壳。
整改前的问题：S003 自建场景壳为容器、基线模块页被注入 CSS 剥离外壳、场景上下文投递至
模块侧不监听的私有频道 `ontology3.0-s003-handoff-v1`，模块页面不参与场景链路。

## 整改内容

1. **壳为主体**：M01—M06 一级导航与首页模块卡主入口直达 v1.0.3 基线模块帧，
   结构与 v1.0.3 壳 `renderModule` 同构（`module-view > frame-stage > iframe`）；
   删除模块适配头与 `moduleFrameAdapterCss` 注入（`app.js` 中
   `moduleFrameAdapterCss` / `s003-module-adapter` / `display:none!important` 均不再出现），
   基线模块保留自身完整导航、工作区、队列、画布与生命周期。
2. **真实机制**：场景上下文改经 `ontology3.0-s001-handoff-v1` 公共交接频道投递
   （canvas-first `app.js:17`、方案B2 `:761` 监听同一频道）；本体管理接收 C033
   场景上下文信封（`acceptScenarioContextEnvelope` 接受或结构化拒绝并形成回执），
   数据工程接收场景上下文本体（其 manifest `scenarioContextRequiredBefore` 声明
   发布操作前必须具备该上下文）。URL 参数注入补齐 `formedAt/status` 等合同字段。
3. **S003 降级为扩展**：风险总览、企业明细、因子填报、配置、运行报告、问数决策、
   快照与 Agent 边界视图收敛为 M06 仪表盘场景扩展（`view-scene-*` 动作），
   不再替换任何模块主路径。
4. **壳视觉对齐**：`global-nav/global-topbar/top-title/scenario-workspace/top-actions/
   flow-trigger/top-action/user-account` 与 1080/820/560 响应式断点按
   `s001-e2e-integration/styles.css` 口径移植，S003 组件样式仅作用于仪表盘扩展。

## 验证结果

- `node --test ../../foundation/ofw-scenario-foundation.test.cjs tests/*.test.js`：
  `145 / 145` 通过（Foundation 12 + 场景 133）。
- `node --check app.js data.js`：通过；`git diff --check`：通过。
- 服务侧校验：`/scenarios/s003/`、`app.js`、`data.js`、`state.js`、`styles.css` 均 200；
  服务出的 `app.js` 含 `ontology3.0-s001-handoff-v1` 且不再含私有频道与适配 CSS；
  M01 帧地址（含场景参数与 `#modeling`）返回 200。
- 壳测试新增断言：一级入口全部 `open-module-adapter` + `baselineModuleId`；
  投递仅面向 M01/M02 且 M01 为 C033 信封；无 CSS 改写注入。

## 未完成项（如实登记）

- 本轮内置浏览器 webview 故障（`browser guest not attached`），自动化浏览器走查
  （模块帧装载画面、C033 信封回执可视化、跨模块往返）未能在证据中截图固化；
  已改为用户浏览器人工走查入口 `http://127.0.0.1:4333/scenarios/s003/`。
- M01 基线页面对非 S001 信封的接受结果取决于其 `scenarioContextEnvelopeIssues`
  校验（可能结构化拒绝并保留回执）；该结果属于模块 Owner 侧合同行为，
  S003 侧如实呈现，不在场景包内改写模块校验规则。

本证据不改变 CP01—CP09 历史清单与哈希；本轮整改登记为 v1.1.0 工作区后续变更。
