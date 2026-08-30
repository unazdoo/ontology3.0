# M08 来源登记

## Palantir 本地参考

| 来源 | 重点研究 | 限制 |
|---|---|---|
| `Palantir Foundry 2022 操作系统演示说明.docx` | Digital Twin & Modeling、Modeling Objective、模型绑定、Vertex 和 Simulation | 历史演示，不代表当前可用性 |
| `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4` | 候选模型比较、模型输出绑定、模拟案例和复合模型流程 | 只作交互和机制参考 |
| `Palantir_Foundry_21_Launch_1080p_bilingual_hardsub.mp4` | Foundry 平台能力演进 | 必须与当前官方文档核对 |
| `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4` | 模型属性与 Ontology 类型边界 | 不改变本项目 M01 Owner |
| `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4` | 发布治理、安全和变更 | 不自动形成平台裁决 |

补充历史参考（README 优先读取，但不在上表正式登记范围）：

| 来源 | 用途 | 证据边界 |
|---|---|---|
| `Palantir_Speedrun_E2E_Workflow_Course_Content.docx` | Branch/Proposal、Object/API binding、Action 与 Workflow Lineage | 二次整理；不作为 M08 当前能力证据 |

已核对媒体元数据与本地二次整理件 hash，详见《Palantir建模与数字孪生能力对照.md》。本地 DOCX/视频均只读，未复制或修改。

原始资料位置：本机 Palantir 参考资料目录（只读，不纳入仓库）

## 官方研究要求

优先检索 Palantir 当前官方文档，核对：

- Modeling Objectives、Model assets、experiments、evaluation 和 deployment；
- 模型输入输出与 Ontology 的绑定；
- batch/online inference、monitoring、lineage、permissions；
- Digital Twin、Vertex、simulation 或当前对应能力；
- Branch、review、publish、rollback 和 SDK/API；
- 当前产品名称、许可、限制和弃用情况。

每项引用必须登记 URL、更新时间、检索日期、可借鉴机制和不适用于本项目的部分。

## 当前官方文档登记（检索日 2026-08-24）

页面不显示逐页编辑日期；更新时间记录 HTTP `Last-Modified`/站点构建元数据，模型页面多为 `2026-08-20 18:05:14-16 GMT`，Ontology `18:05:17 GMT`，Vertex `18:05:22 GMT`。这些时间不等于内容实际编辑日。

| 主题 | URL | 当前能力/限制 |
|---|---|---|
| Model / Objective | `https://www.palantir.com/docs/foundry/model-integration/models/`；`https://www.palantir.com/docs/foundry/model-integration/objectives/` | Model/Version、Objective、Submission、Release、Deployment 生命周期 |
| Experiments / Evaluations | `https://www.palantir.com/docs/foundry/model-integration/experiments/`；`https://www.palantir.com/docs/foundry/model-integration/evaluations/` | 参数、指标、图表和精确版本评估 |
| Automatic evaluation / Dashboard | `https://www.palantir.com/docs/foundry/evaluate-models/model-evaluation-automatic/`；`https://www.palantir.com/docs/foundry/evaluate-models/review-model-metrics/` | 同 transaction 公平比较；自动评估当前单表输入限制 |
| Review / Checks / Release | `https://www.palantir.com/docs/foundry/manage-models/review-model/`；`https://www.palantir.com/docs/foundry/manage-models/set-up-checks/`；`https://www.palantir.com/docs/foundry/manage-models/release-model/` | 人工协作；checks 当前不强制阻断 release；Staging/Production 发布 |
| Ontology model integration | `https://www.palantir.com/docs/foundry/integrate-models/model-asset-osdk/`；`https://www.palantir.com/docs/foundry/ontology/models/` | Object/ObjectSet 输入、wrapper Function、属性语义输出 |
| Vertex / Scenario | `https://www.palantir.com/docs/foundry/vertex/overview/`；`https://www.palantir.com/docs/foundry/vertex/scenarios-overview/`；`https://www.palantir.com/docs/foundry/vertex/chained-models/` | 数字孪生、what-if、时间序列；chaining 标 Sunset |
| Branching | `https://www.palantir.com/docs/foundry/global-branching/overview/` | 隔离开发、测试、评审、合并；不等同 Release 管理 |
| Scenario/Actions | `https://www.palantir.com/docs/foundry/workshop/scenarios-concepts/`；`https://www.palantir.com/docs/foundry/workshop/scenarios-apply/`；`https://www.palantir.com/docs/foundry/action-types/side-effects-overview/` | Scenario 可 Apply 写回；Action 可能通知/Webhook；M08 必须禁用 |

当前官方能力与历史演示冲突时，文档登记为“当前能力”，本地视频/DOCX 登记为“历史参考”，不互相覆盖。

## 当前项目依据

- 平台总控及 M01—M06 主文档；
- 当前组合 Foundation、Checkpoint、场景身份和模块边界；
- S003 已有确定性风险评分引擎，可作为“模型真值不能由页面副本维护”的反例与经验；
- S005 评价方法和快照数据，可作为首个 Modeling Objective 与模拟验证；
- M07 对象/时序/空间 Lens，用于展示而非拥有模拟真值。

## 证据分类

必须区分：官方当前能力、本地历史演示、本项目现有确定性逻辑、模型实验结果、模拟结果、设计建议和待裁决合同。

## M08 验证制品

| 制品 | 身份/限制 |
|---|---|
| `validation/fixtures/s005-synthetic.v1.json` | 合成/缩放夹具；不含 S005 原始业务值 |
| `validation/src/` | 确定性模型治理、Binding、DAG、模拟和 HTTP 只读服务 |
| `validation/test/` | 29 项正向/负向测试 |
| `validation/evidence/technical-validation-summary.json` | `overallStatus=PASSED`；内部证据，不是验收结论 |
