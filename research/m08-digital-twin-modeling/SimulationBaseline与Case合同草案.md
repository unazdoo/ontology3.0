# Simulation Baseline 与 Case 合同草案

> 状态：研究建议。实现仅在 `ofw.m08.research.v1` 隔离命名空间验证

## 1. 资源定义

### Simulation Baseline

不可变的事实引用集合和克隆范围。它至少包含 `baselineId`、C033、Published Ontology/数据/事实 Owner 导出、as-of、schema/hash、权限投影和 `immutable=true`。Baseline 本身不拥有事实，也不冒充 T056/Checkpoint。

### Simulation Case

一次 what-if 问题：`caseId + baselineId + parameterSetId + graphId + scope + objective + owner + status`。Case Revision 一旦 READY 不可原地修改。

### Parameter Set

每个参数包含稳定键、类型、单位、范围、默认/来源类别和适用节点。值必须区分：`OBSERVED_REFERENCE`、`USER_SUPPLIED`、`ASSUMED_SYNTHETIC`。研究默认禁止把假设标为事实。

### Model Graph

由精确 Model Version 节点和类型化端口组成的 DAG。每条边检查 type、unit、time grain、as-of/domain compatibility；每个模型必须声明 `sideEffects=[]`。

### Run/Result/Comparison

Run 记录每节点执行和失败传播；Result 是只读模拟输出；Comparison 只保存引用和差异，不复制/覆盖 FACT。

## 2. Baseline 形成与恢复

1. 从 M01/M02/场景 Owner 的精确导出读取事实引用，不复制应用页面状态。
2. 固定 Published Ontology、T007/T008、C017、对象范围、时点和 hash。
3. 验证权限后在 M08 命名空间创建不可变 Baseline manifest。
4. 历史查看保持原身份且只读；克隆恢复/回归必须生成新运行身份。
5. 禁止使用组合 localStorage、历史 snapshot、来源 `scenarioRunId` 或 completed 状态初始化新模拟。
6. Baseline 不含 Action Request、通知、审批、待办或交易运行事实；需要展示时只能引用只读摘要，不能重放。

## 3. 参数合同与一期边界

S005 合成验证参数：

| 参数 | 单位 | 研究范围 | 说明 |
|---|---|---:|---|
| `interestRateBps` | bp | `[-300, 500]` | 利率平移假设 |
| `creditSpreadBps` | bp | `[-200, 1000]` | 信用利差冲击 |
| `ratingNotches` | notch | `[-3, 0]` | 只验证下调，不把合成评级当事实 |
| `liquidityHaircutPct` | % | `[0, 30]` | 流动性折价假设 |
| `redemptionPct` | % | `[0, 50]` | 集中赎回假设 |

真实 S005 缺少久期、利差、评级事件、流动性和现金流数据；因此所有相关字段固定 `evidenceClass=SYNTHETIC_ASSUMED`。参数越界在运行前以 `PARAMETER_OUT_OF_RANGE` 拒绝。

## 4. DAG 校验

运行前必须依次检查：

1. Graph/Node/Model Version 存在且身份唯一；
2. Model Version 不可变，Model/port schema 完整；
3. 必需输入均有 binding，无未知输入；
4. 依赖节点和输出端口存在；
5. source/target type 相同或存在获批转换；
6. 单位维度/币种/比例一致；
7. 时间粒度、as-of 和窗口一致；
8. 图无循环；
9. 模型 domain/feature compatibility 通过；
10. `sideEffects=[]`，运行时无外发能力。

对应拒绝码包括：`MODEL_VERSION_NOT_FOUND`、`DEPENDENCY_NOT_FOUND`、`MODEL_INCOMPATIBLE_TYPE`、`UNIT_MISMATCH`、`TIME_GRAIN_MISMATCH`、`CYCLE_DETECTED`、`FORBIDDEN_MODEL_SIDE_EFFECT`。

## 5. 执行与失败传播

模型按稳定拓扑顺序运行。每节点状态为 `PENDING/RUNNING/SUCCEEDED/FAILED/SKIPPED_UPSTREAM_FAILED`。

- 任一上游失败，所有依赖节点跳过，不使用 stale/default 输出继续计算。
- 独立分支可完成并保留诊断，但必需输出不全时整个 Run `FAILED`。
- 失败 Result `promotable=false`；不能绑定、发布、物化或进入事实域。
- 超时、取消和重试均产生新 Run；历史 Run/Result 不覆盖。
- 错误保留 modelVersion、nodeId、errorCode、message、input hashes 和 evidence。

隔离证据已验证强制失败节点为 `FAILED/FORCED_MODEL_FAILURE`，下游为 `SKIPPED_UPSTREAM_FAILED/UPSTREAM_FAILED`，部分结果不可晋级。

## 6. 单模型与最小复合模型

验证包包含：

1. `GRAPH-SINGLE-MARKET-v1`：不可变 Baseline + Parameter Set -> 市场冲击后的模拟组合；
2. `GRAPH-COMPOSITE-v1`：市场冲击 -> 确定性评价，两节点类型化串联。

两者都只输出 `SIMULATION`；第二节点不会写回真实评价。模型端口使用 `PortfolioSnapshot/CNY/AS_OF` 和 `EvaluationResult/score_0_100/AS_OF`。

## 7. 绝对副作用禁令

Simulation runtime 的能力清单固定为 false：

`actionRequest`、`notification`、`approval`、`todo`、`transaction`、`webhook`、`schedule`、`extendedFunction`。

不仅不调用历史 Action，也不提供可调用这些能力的端点/工具/allowlist。HTTP 服务对这些路径统一返回 `CAPABILITY_NOT_AVAILABLE`。Simulation Action 如未来需要，只能建模为无副作用 declarative delta，不能复用 M01 Action Type 或 M04 C011 身份。

## 8. Result 与 Comparison

Simulation Result 至少固定：`simulationResultId/resultKind=SIMULATION/case/baseline/parameterSet/graph/modelVersions/asOf/outputs/coverage/errors/permission/evidence`，以及 `factWriteAllowed=false/actionWriteAllowed=false`。

Comparison 可比较 baseline、多 Case 或 FACT/PREDICTION/SIMULATION，但 `overwriteAllowed=false`。任何“应用到真实世界”能力都不属于 M08 一期。

## 9. 后置能力

复杂求解器、Monte Carlo 平台、GPU、在线连续模拟、跨组织模型市场、3D、自动优化决策、模拟 Apply、自动交易和历史流程重放全部后置。
