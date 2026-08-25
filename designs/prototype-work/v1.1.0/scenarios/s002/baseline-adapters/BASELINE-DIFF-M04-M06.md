# S002 M04-M06 基线适配记录

适配日期：2026-08-15  
最终复验日期：2026-08-17  
父基线：`v1.0.3` · `BSL-S001-V103-DE0119608E26`

## 入口映射

| 模块 | v1.0.3 权威入口 | S002 运行入口 | 适配方式 |
| --- | --- | --- | --- |
| M04 | `decision-center-prototype/index.html` -> `review-v2/action-portfolio.html` | `baseline-adapters/m04/decision-center-prototype/index.html` | 保留 redirect、React shell、workbench/detail/trace/modal；前置写入 S002 请求投影 |
| M05 | `agent-application/Agent应用.html` | `baseline-adapters/m05/agent-application/Agent应用.html` | 保留 Agent 目录、资源、运行、证据、编排；追加预算 Agent/固定证据适配 |
| M06 | `report-center/review-lifecycle/index.html` | `baseline-adapters/m06/report-center/review-lifecycle/index.html` | 保留报告生命周期、阅读器、驾驶舱 Tab、筛选、下钻、报告草稿/发布边界；追加预算事实投影 |

## 运行时保留

- M04 使用基线的提醒、Action Request、人工确认/拒绝、待办和 trace 路由；默认 8 条基础请求形成 3 条确认、1 条拒绝、4 条待决策和 3 条平台内待办。驾驶舱发布不自动增项，预警点击时复用已有事项或幂等补建草稿；外部状态固定为 `not-dispatched`。
- M05 使用基线的 Agent Release、Prompt/Skill/Tool 资源、运行结果、证据包和轻量编排；两条完成运行通过 `confirm-result` 门显示真实结果，不建立审批或通用编排平台。
- M06 使用基线的报告目录、生成向导、草稿复核、正式报告、驾驶舱主题 Tab、筛选和下钻；首屏按六类预警和五个监督主题分层，预算报告采用六章正文，自动核验覆盖 58 项事实、66 个锚点和 426 项适用检查。驾驶舱归 M06，报告保持 `draft`，不冒充 T049。

## 场景适配变更

仅新增 `s002-adapter.js` 投影和场景入口脚本引用，未删除基线节点、按钮或路由。M04 注入六类 Action 和 C017 三道门；M05 注入预算异常分析 Agent、预算报告草稿 Agent、固定证据与完成结果门，并隔离 S002 Agent 存储命名空间；M06 注入五主题预算指标、六类预警、六章预算报告正文、自动核验、明细筛选和数据标识。纠偏前的 M06 根级主题脚本保留为历史证据但已停止运行，避免双适配。

## 证据

逐模块源树哈希、入口哈希和核心 DOM 锚点见 `adaptation-map-m04-m06.json`。源基线目录只读，S002 副本的变化只发生在本场景目录。
