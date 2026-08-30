# M08 S001 基线增量验证记录

## 身份

- 实现基线：`v1.1.0` / `BSL-OFW-V110-94ABD0E991B7`
- 治理父版本：`v1.0.3` / `BSL-S001-V103-DE0119608E26`
- frozen release 来源：`integration-composite-v1.1.0/designs/prototype-releases/v1.1.0`
- 场景：`S001 / S001-v1`
- M08 namespace：`ofw.m08.research.v1`
- M07 namespace：`ofw.m07.research.v1`
- M08 服务：`127.0.0.1:4357`

## 已完成的基线核对

- frozen release 的 `s001-e2e-integration/index.html` 与工作树副本 SHA-256 相同：`5dec3c105f555bcc46aceaf54c016591c1a07a04efc08fda472822b3ad99979c`。
- frozen release 的 `styles.css` 与工作树副本 SHA-256 相同：`043b9e79dcee95184c916846364e66fd1d5a8bc8cba3ef21b8f375f87687b4a3`。
- M01–M06 canonical 模块目录从 frozen release 物化；没有用 native projection 替换模块页面。
- M01 入口：`3f83a5e9df12bfbb53c023ad15c0e9a36fc0592d0efb79336ca39ef8a62723a1`，与 frozen release 一致。
- M02 入口：`cc1341a0a46324746a90a65adb5c50eabc95768f9197fe964c0bcc89965c8cf9`，与 frozen release 一致。
- M03 入口：`08f745f264566d1b23ce27c9a256d43a416ef9c430f2b876aa463d9925931e4c`，与 frozen release 一致。
- M04 入口：`c5167e2696bf71fe03a586f439b467bd9564b15ca898cf3e7d44540cb89dacec`，与 frozen release 一致。
- M05 入口：`84f776ea78c24d36412e253ed5a2abf05a7bf52193fec40f545daf666df2784e`，与 frozen release 一致。
- M06 入口：`73ec292346df4ad51a3dc4a9171211e2db21652f03d82c44e445a71f0cc75ed2`，与 frozen release 一致。
- Dashboard 入口：`0e5335a8601eaefdfdfc398e2cbb4c3c3524ed72e160854c4978e94911903220`，与 frozen release 一致。
- 原有 15-step `workflow/order/completeCount` 未增加 M07/M08 步骤；研究状态使用独立 projection。
- 品牌图标继续使用 frozen v1.1.0 的 `brand-mark-ai + brand-brain/brainCircuit`。

## M08 增量核对

- 一级导航新增“模型与模拟”，外层路由为 `#module/modeling`。
- M08 内容页是 `modeling-prototype/content.html`，不包含 `.platform-shell`、`M08_NATIVE_STORE` 或替代平台导航。
- 父壳只向 M08 发送 `deliverScenarioContext` 的只读 envelope：C033、当前投影、精确数据/本体/Binding 引用；M08 可追溯 C033，但绝不把父壳 `scenarioRunId` 当作研究 Run 身份。
- M08 只在上游精确投影存在时启用候选比较；否则显示 `UPSTREAM_PROJECTION_REQUIRED`。
- 4357 请求携带 `scenarioId`、`dataVersionId`、`ontologyVersionId`、`bindingId` 和 projection digest，并在响应中回显 `sourceContext`。
- 人工评审、Binding、Simulation 使用 4357 资源接口；`published=false`、`productionEligible=false`、`t019WriteAllowed=false`、`factWriteAllowed=false`、`actionWriteAllowed=false`。
- M08 状态事件只触发父壳重新读取，不推进生产 workflow，也不创建 M04/M05/M06 资源。

## M07-M08 全链路核对

- 一级导航新增“探索分析”，外层路由为 `#module/exploration`；内容页不包含 `.platform-shell` 或替代状态树。
- M07 以单一任务链组织对象选择、概览、关系、时序、空间不适用和模拟交接；不再暴露 A/B/C 设计方案导航。
- M07 交接包含 ObjectRef、Baseline member、LensRef、SeriesRef、时间范围、观察摘要和数据/本体/Binding 精确版本。
- M08 将交接固定为不可变 input manifest；对象、时间、Case 或版本变化后旧结果显示 stale，返回按钮禁用。
- M08 返回 Simulation Run/Result、对象级影响、组合影响、评价分数和副作用计数；M07 对不匹配上下文显式提示并提供恢复操作。
- 空间 Lens 在无 GeoRef 时显示“不适用”，不加载地图或生成坐标。

## 当前验证结果

- 4357 验证服务测试：`43/43` 通过；`npm run evidence`：`overallStatus=PASSED`。
- baseline shell 静态回归：`5/5` 通过，覆盖 frozen hash、既有 canonical 入口字节一致、M07/M08 增量路由、内容页无第二平台壳和精确交接字段。
- 直接打开基线入口：M01–M06 的导航、页面结构、iframe 适配器和品牌资产保持基线行为。
- 直接进入 M08：内容页加载成功，父壳可读取并发送上下文；M08 内容页自身无控制台 error/warning。基线 M02 iframe 观测层在浏览器工具中仍会产生既有 `MutationObserver.observe` warning，未由 M08 引入。
- 浏览器逐模块回归：M02 `/data-engineering-prototype-review/review-v3/方案B2.html`、M01 `/ontology-management-review/canvas-first/index.html`、M03 `/intelligent-query-prototype/review-next/conversation-workspace/index.html`、M04 `/decision-center-prototype/review-v2/action-portfolio.html`、M05 `/agent-application/Agent应用.html`、M06 `/report-center/review-lifecycle/index.html` 均可从同一父壳打开且无 console error。
- 干净浏览器状态下 M08 正确保持 `UPSTREAM_PROJECTION_REQUIRED`，不会把历史资产目录或旧运行身份误当成本轮 M02/M01 交接；这是预期门禁，不是完成证据。
- 浏览器完整路径已通过：单位553探索 → 12个月时序 → M08 复合压力 → 输入变化 stale → 单位465重跑 → 返回 M07 → 显式恢复结果上下文。
- 1440x900 与 390x844 页面级横向溢出为 0；M07/M08 内容页控制台应用错误为 0。
- Objective 目录覆盖 FORECAST/CLASSIFICATION/SCORING/OPTIMIZATION；Binding 页面无 `InvestmentProduct/InvestmentEvaluation` 硬编码。
- 同一结果已验证 M07 时间/对象视图、M06 报告块、M03 问答证据卡、M05 解释面板和 M04 拒绝态；390x844 下 Binding 与消费者视图内部 `scrollWidth == clientWidth`。

## 尚未宣称

本记录不宣称 M08 正式立项、一期验收、模型生产可用，或 M04/M05/M06 已正式消费 M08 结果。要完成用户验收，必须在干净浏览器状态下实际完成 v1.1.0 S001 的 M02/M01 交接，再验证 M08 gate、4357 sourceContext、研究 Run 和失败恢复；在此之前不把本增量称为“全链路验收通过”。
