# 组合总装 Checkpoint 登记

平台公共层只登记 Checkpoint 目录、基线绑定、恢复编排和深链；模块业务状态和证据仍由 M01—M06 各自 Owner 导出、校验和恢复。

| 场景 | 当前登记 | 组合处理 |
|---|---|---|
| S001 | v1.0.7 已归档运行快照，`S001-RUN-20260816081748567-705ac89fb83a` | 只读恢复，不作为新场景初始数据 |
| S002 | `scenarios/s002/checkpoints/checkpoint-catalog.json` | 已暂存，待组合导出/恢复与同源回归 |
| S003 | CP38：`scenarios/s003/checkpoints/CP38-performance-and-m04-ux.json` | 已暂存，待风险场景条件适配 |
| S004 | `scenario.manifest.json` 标记 `publicCheckpoint.status=not-created`；组合候选登记 `checkpoints/CP-COMPOSITE-S004-20260821.json` | 仅候选走查登记，不提升为正式 Checkpoint；正式快照仍需 S004 Owner/总控形成 |

## 恢复语义

- 历史查看：保留原 `scenarioRunId`，只读展示；
- 快照恢复：克隆并生成新的 `scenarioRunId`，不覆盖历史；
- 回归运行：隔离模式，禁止重放 Action Request、通知、审批和待办；
- 基线迁移：形成新的 `scenarioVersion`、`scenarioRunId` 和迁移对照，禁止原地换父版本。
