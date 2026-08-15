# v1.0.3 外置 T056 基线快照

本目录登记冻结原型 `v1.0.3` 的唯一不可变基线身份：

`BSL-S001-V103-DE0119608E26`

## 文件

- `T056-baseline-checkpoint.json`：C034 约束下的外置 T056 基线清单。
- `T056-baseline-checkpoint.sha256`：清单的脱离式 SHA-256。
- `verify-baseline.mjs`：校验清单、冻结 manifest、VERSION、历史恢复文件、Git 标签和冻结提交。

## 校验

从项目根目录执行：

```bash
node designs/scenario-checkpoints/baselines/v1.0.3/verify-baseline.mjs
```

校验成功只证明冻结代码基线、外置清单和已登记引用未漂移。M01—M06 的真实导出、校验、恢复、损坏快照、错版本及隔离回归接口仍需各 Owner 提供证据。

## 边界

1. 本目录不复制 M01—M06 的业务真值，清单只锁定 Owner 和稳定引用。
2. 冻结 runtime JSON 仅是 S001 历史原型恢复证据，不是正式快照真源，也不能初始化 S002—S004。
3. 恢复必须克隆为新 `scenarioRunId`；隔离回归不得触发历史 Action Request、通知、审批或待办。
4. 本清单不得原地修改；任何基线内容变化必须生成新的版本和新的 `baselineSnapshotId`。
5. `acceptanceReady=false`。本快照形成不表示模块评审、S001 正式验收或一期验收通过。
