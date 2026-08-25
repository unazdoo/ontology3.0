# S003 CP09 运行编排后续验证证据 v2

- 验证日期：2026-08-16
- 关联 Checkpoint：`CP-S003-20260815193000000-c03509000009`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 原型版本：`1.1.0`
- 正式运行身份保持：`S003-RUN-20260815133000000-c03503000001`

## 封存边界

本证据是 CP09 的新增后续验证，不修改 CP09 manifest、CP09 sidecar、CP09 原始验证证据、
业务制品或历史 `scenarioRunId`。CP09 仍按原始代码树作为不可变历史证据查看；当前代码树只代表
S003 工作区的后续修复状态。

## 当前代码树

按 CP09 `spec-CP09.json` 的 67 个 `codeRefs` 规范化排序重算，当前树哈希为：

`22ed901f7266a6ea69bfbd8b5c816ca47d530c62b9c188c0e5c165ce90a16d98`

CP09 原始封存树哈希仍为：

`c40c8ea6b315b31b02a952c5b1f4ae43aeae55e6f6b5a60ffd029dd43d7a5ed7`

树哈希漂移只登记为后续代码变化，不回写或重签历史快照。

## 后续修复

1. 真实评分引擎的三元 `scenarioIdentity` 在 `normalizeRun` 状态边界补齐 `formedAt/status`，随后仍执行完整 Foundation 上下文校验。
2. CP01 无人工输入时，克隆恢复只形成带完整企业键的 Draft 投影，保留 `snapshot = null`，不得直接评估。
3. 返回静态正式运行时，从 M01 Published 风险事实集补齐报告输入，避免把 Draft 或浏览器工作投影显示为 Published。

上述修复不改变风险模型、因子输入、评分规则、Published 生命周期、M01—M06 Owner 边界或 C034
副作用语义。

## 验证结果

- Foundation 与 S003 全量 Node 测试：`143 / 143` 通过。
- `node --check state.js app.js domain/checkpoint-service.js domain/checkpoint-projection.js`：通过。
- `git diff --check`：通过。
- 浏览器快速重跑、隔离回归和 CP01 克隆恢复均生成新运行身份；历史正式运行可无副作用返回。
- `published-runtime` 工作投影下，M03/M04 正式消费、正式报告制品、深链和导出均保持阻断。
- 未创建新的 Action Request、审批、通知或负责人待办；历史证据未被覆盖。

本证据不提升 CP09 的历史验收状态，也不把浏览器工作投影或当前源码树作为正式 Published
快照真源。
