# M06 S002 基线适配备注

`report-center/review-lifecycle/index.html` 运行时仍以 v1.0.3 报告中心生命周期页为主入口。当前入口只加载一个场景适配器：

1. `report-center/review-lifecycle/s002-adapter.js`：在 `data.js` 后注入 S002 fact package、C008/C017/C019/C011 只读投影、场景路由归一化、预算上下文和带逐项标识的监督明细。
   场景副本的 `app.js` 只在 v1.0.3 原生报告生命周期和驾驶舱函数中切换 S002 路由、存储键、报告定义/模板引用，并加入六维预算筛选；下钻继续使用基线详情抽屉，生命周期处理、主 DOM 锚点和交互语义保持不变。
   当前事实投影将 `RULE-003` 固定为“成本占收比异常”（`MET-001`，`costToRevenue >= 100%`），复用 `HIT-003-2025-AQ / AR-S002-003` 及“费用管理优化核查”；跨年计提配对只保留为质量核验披露，不占用五项正式 Rule，也不生成 Action。
   驾驶舱首屏按预算执行、成本效率、项目余额、年末占用、供应商价格和申报合理性六类切换，只展示当前选中类型的一条重点事项；五个监督主题、完整 Rule、明细和行动仍通过 v1.0.3 既有页签、抽屉与 Action 草稿入口下钻。报告正文直接使用六章预算监督内容，自动核验继续沿用基线两步交互，并在完成后回显 `426/426` 覆盖结果。
   适配器按 URL 中的 `scenarioId + scenarioVersion + scenarioRunId` 读取精确 M06 Owner 命名空间：仅当 Owner 已形成 `reportBuilt=true` 且报告状态为 `draft` 时投影“草稿待复核”；仅当 `dashboardPublished=true` 且 Dashboard Version 状态为 `published` 时显示驾驶舱已发布。不会据静态示例补造成功状态，且始终保持正式报告集合为空、`t049Ref=null`。
2. `../../s002-adapter.js`：已停止作为运行时脚本，仅保留在 S002 目录中作为纠偏前历史证据；它曾在基线 `app.js` 后插入另一套预算主题摘要和明细筛选表。

该停用记录已写入 M06 `ADAPTER-MANIFEST.json` 和 Checkpoint 证据；运行时不再出现双适配或重复主题投影。v1.0.3 源目录未改写。
