# S003 CP09 运行编排验证证据

- 验证日期：2026-08-15
- Checkpoint ID：`CP-S003-20260815193000000-c03509000009`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP09-runtime-operations-completed`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式 C035 运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP09`
- 入口：`runtime/cp09-entry.v1.html`

## 封存范围

CP09 在 CP08 统一场景壳之后封存 C034 运行编排桥接。它锁定历史查看、克隆恢复、隔离回归、
快速重评和返回正式运行的统一场景语义，且不新增一级模块、不改变 M01—M06 Owner 边界，
不把浏览器可丢弃投影冒充为 Published 事实或正式报告。

本节点使用同一正式 C035 `scenarioRunId` 作为当前证据来源。历史查看保留该原始身份；
克隆恢复、隔离回归和快速重评均由 C034 产生新的 `scenarioRunId`、操作身份和隔离命名空间。
回归默认为演练模式，历史 Action Request、审批、通知、负责人待办及外部派发全部关闭。

## 运行操作矩阵

| 操作 | 入口 | 新 runId | 消费/副作用边界 |
| --- | --- | --- | --- |
| 历史查看 | `viewHistorical` | 否，保留来源 runId | 只读展示来源清单、锁定资源和证据；不得编辑或重放副作用 |
| 克隆恢复 | `cloneRestore` | 是 | 克隆版本化模块状态到独立命名空间；不把历史结果登记为新成功运行 |
| 隔离回归 | `createRegression` | 是 | `isolated-regression` / 演练模式；M03、M04、正式报告和外发均阻断 |
| 快速重评 | `beginRerun` | 是 | 仅形成 `published-runtime` 工作投影；未导出正式 C035/Published 证据前不得下游消费 |
| 返回正式运行 | 场景工作台 | 否 | 只恢复最近一次正式 Published 成功指针，不覆盖恢复/回归历史 |

## 运行身份和边界

- `scenarioId = S003`
- `scenarioVersion = S003-v1`
- `baselineVersion = 1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- 操作身份统一使用 `OP-S003-<17位UTC时间>-<12位小写十六进制>`。
- 每次运行写入 `scenarioRunId`、`scenarioVersion`、`baselineVersion`、模型、人工输入和模块恢复引用。
- 动态投影、localStorage、DOM 和临时 JSON 只用于当前浏览器工作投影，不作为正式快照真源。
- M03/M04/正式报告仅接受 `published-evidence + immutable raw`；`published-runtime`、回归和历史漂移均 fail-closed。
- 快速重评失败保留上一正式成功指针；C034 成功回执失败时回滚已落盘投影，避免伪成功深链。

## CP07 / CP08 历史证据处理

CP07 和 CP08 是此前已封存的不可变证据。后续运行编排和场景壳代码新增了持久化、投影校验与
历史视图逻辑，因此当前源码树相对于两份清单记录的 `treeSha256` 已发生漂移：

- CP07 原始代码树：`32aa279622652fb529ce9318b0057bbe72cd8984f10193bb125be7732966762f`。
- CP08 原始代码树：`a47c2c9dc8eaa609faa6d27b470652a083d38b0b62d98cbbf1237b15f44370eb`。
- 漂移只影响历史代码树精确恢复资格；CP07/CP08 清单、sidecar、验证证据和业务制品不作任何改写。
- 当前加载器和投影服务将漂移节点降级为 `evidence-only`，保留原 `scenarioRunId`、资源哈希和
  证据引用；不得以当前代码补写历史快照。

## M01—M06 快照提供方与恢复接口

| 模块 | Owner | CP09 锁定内容 | 恢复方式 |
| --- | --- | --- | --- |
| M01 | 本体管理；业务 Owner 为财务公司 | Published RiskModel、权威指针和 C035/Published 风险事实 | 通过模块导出引用克隆，不重算历史结果 |
| M02 | 数据工程；人工输入 Owner 为财务公司 | 来源、T053 输入快照、管道、质量和正式候选数据资产 | 克隆数据/输入版本，兼容性夹具仍不可消费 |
| M03 | 智能问数 | 查询运行时和同轮结果引用 | 仅在精确 Published 证据下恢复只读消费 |
| M04 | 决策中心 | 通用 Action Request 绑定、决策运行和结果 | 恢复候选状态；回归禁止确认和副作用 |
| M05 | Agent 应用 | 一期无专属 Agent 的能力边界 | 只恢复边界声明，不写入评分、决策或报告 |
| M06 | 报告中心 | 报告合同、清单、内容和 HTML 制品 | 正式运行可穿透；工作投影/回归仅预览 |

平台公共层提供 Checkpoint 目录、清单校验、操作幂等和恢复编排；M01—M06 仍各自拥有模块
状态与证据，不以复制页面状态替代快照真源。

## 自动化验证

- `node --test ../../foundation/ofw-scenario-foundation.test.cjs tests/*.test.js`：`140 / 140` 通过。
- `node --check data.js && node --check state.js && node --check app.js`：通过。
- `node --check domain/checkpoint-service.js && node --check domain/checkpoint-projection.js`：通过。
- `git diff --check`：通过。
- CP09 代码树哈希由 `scripts/create-checkpoint-v2.cjs` 按 `codeRefs` 规范化排序后生成。
- CP09 清单和 JSON sidecar 使用 `wx` 不可覆盖写入；证据 sidecar 与本 Markdown 内容一致。

## S001 v1.0.3 非回归

- 父基线固定为 `1.0.3 / BSL-S001-V103-DE0119608E26`。
- S001 v1.0.3 冻结目录、公共壳、历史运行快照和既有证据未修改。
- S003 仅使用独立 `scenarioId`、`scenarioVersion`、`scenarioRunId`、工作目录、端口、数据命名空间和证据目录。

CP09 表示 S003 v1.1.0 运行编排与恢复边界完成封存，不改变 S001 验收状态，不替代平台总控复核。
