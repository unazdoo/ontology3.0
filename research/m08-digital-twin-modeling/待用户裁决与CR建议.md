# M08 待用户裁决与 CR 建议

> 状态：研究建议。编号为 M08 提案号，不是已登记平台 CR

## 1. P0：正式立项前必须裁决

| 提案 | 类型 | 待裁决问题 | 推荐 | 未裁决影响 |
|---|---|---|---|---|
| `CR-M08-001` | 平台 CR | 是否新增 Modeling Objective、Candidate Model、Experiment、Evaluation Run、Model Version、Submission、Review、Release Candidate、Model Binding 一级资源及正式编号 | 批准资源分层；禁止把 Candidate/Version/Release 合并 | 无法形成正式公共模块合同 |
| `CR-M08-002` | Owner CR | 正式 Model Version、Release Pointer、Evaluation Run/Result 的唯一 Owner | Model Version/运行归 M08；发布治理由平台公共层监督；业务 target 归场景 Owner | M08 只能停留在 research namespace |
| `CR-M08-003` | 跨模块 CR | Model Binding 如何在 M01 语义目标与 M08 模型侧之间拆责；与 T019 的关系 | 双回执 Binding；M01 仍唯一写 T019；Binding pointer 不等于 T019 | 无法正式把模型输出绑定 Ontology |
| `CR-M08-004` | 用户+平台 CR | S003 D094/C035 特例保留还是迁入通用 M08 Run/Result | 一期保留 grandfathered M01 特例；未来单独迁移，不静默复用 | 可能破坏既有用户裁决和 S003 证据 |
| `CR-M08-005` | 基线 CR | 四场景组合何时正式冻结并成为 M08 source product baseline | 先收敛 rc.10 与总控/Checkpoint，冻结后 M08 再 rebase | `rebaseRequired=true`，正式立项硬阻断 |
| `DEC-M08-001` | 用户裁决 | M08 是否从“公共模块研究”升格为正式模块 | 只在上述 P0 合同和基线关闭后批准 | 当前不得宣称 M08 已立项 |

用户最新方向已提出：后续实施和新增研究拟统一以 `v1.1.0` 为活动基线，`v1.0.3` 保留为只读历史父版本、迁移来源和回退基线。该方向已用于隔离原型 `m08-s001-v1.1.0-research.1`，仍需总控正式 VERSION、Checkpoint 和完整性清单回写后，才能关闭 `CR-M08-005`。

## 2. P1：一期生产化前必须裁决

| 提案 | 类型 | 待裁决问题 | 推荐 |
|---|---|---|---|
| `CR-M08-006` | 三态合同 | FACT/PREDICTION/SIMULATION 的身份、权限、存储、保留和视觉语义 | 资源身份+权限+lineage 三重隔离；视觉仅辅助 |
| `CR-M08-007` | M07/M06 | M07 Lens 和 M06 报告如何消费预测/模拟 | 扩展只读 source envelope；两者不拥有或重算结果 |
| `CR-M08-008` | M04 | 是否接受预测/模拟来源发起行动 | 一期硬拒绝 `sourceResultKind!=FACT`；未来需独立人工桥 |
| `CR-M08-009` | M02 | Training/Evaluation/Feature Set、exact transaction、质量和脱敏映射交付合同 | M02 拥有数据/特征 lineage；M08 只读精确版本 |
| `CR-M08-010` | 发布门 | 自动 Check/Metric 与人工 Review 的关系 | 人工批准是 Release Candidate 强制硬门；自动检查不能替代 |
| `CR-M08-011` | 模拟资源 | Simulation Baseline/Case/Parameter/Graph/Run/Result 是否进入平台正式资源目录 | 批准独立资源；Baseline 引用 Owner 导出，不冒充 T056 |
| `CR-M08-012` | 副作用 | Simulation Action/Event 是否可复用 M01 Action Type | 不复用；只允许无副作用 declarative delta，runtime 无外发能力 |
| `CR-M08-013` | 审计 | Run/Result 日志、错误、输入/输出和保留期 | Run/Result 自身不可变；不能只依赖不保证全量的 inference history |
| `CR-M08-014` | 结果物化 | 预测结果是否允许物化为 Ontology Property | 默认独立 Result Object；物化需 M01/M02/M08 原子合同，事实/预测列分离 |

## 3. S005 用户裁决

| 提案 | 待裁决内容 | 当前默认 |
|---|---|---|
| `DEC-S005-M08-001` | 评价目标、target/label、ground truth、评价频率 | 未确认；只做工程适配比较 |
| `DEC-S005-M08-002` | 产品分类、基准、同类组和最低历史 | 未确认；不做相对表现/排名 |
| `DEC-S005-M08-003` | 硬门、UNKNOWN/NA、权重、维度、等级、风险灯和置信度 | 缺失不重分权；不输出正式总分 |
| `DEC-S005-M08-004` | 利率/利差/评级/流动性/赎回参数范围和业务含义 | 当前全部为合成接口假设 |
| `DEC-S005-M08-005` | 哪些真实产品可进入无前视回放及所需权限 | 当前未授权，仓库无真实轨迹 |
| `DEC-S005-M08-006` | 脱敏等级、HMAC/密钥 Owner、精确日期/金额是否可入库 | 当前只提交合成值，不使用无密钥伪名替代强匿名 |

## 4. 治理回写建议

`CR-M08-015`：总控当前仍主要登记 rc.1，组合本地已为 rc.10；阶段主文档未完整回写 D094-D099/C034-C035。建议先由总控统一当前组合状态、正式冻结门和新模块编号，再登记 M08 合同。M08 不修改这些只读文档。

## 5. 建议裁决顺序

1. 冻结当前四场景组合并明确 source product baseline；
2. 决定 M08 是否正式立项和一级资源；
3. 裁决 Model Version/Release/Run Owner；
4. 裁决 Binding/T019 和 S003 特例；
5. 裁决三态、M04 拒绝、M07/M06 消费和 Simulation 资源；
6. 裁决 M02 特征/评估集交付和脱敏；
7. 裁决 S005 业务目标/方法；
8. 真实无前视回放后再讨论产品化和验收。

## 6. 当前正式立项门结论

**不满足。** 主要硬阻断是产品基线未正式冻结、`rebaseRequired=true`、资源/Owner/Binding/三态合同未裁决、S005 target/label 未确认。29/29 测试和机器证据 PASS 只关闭“隔离合同可以被确定性实现”的技术问题，不关闭任何用户裁决、模块评审、生产可用或一期验收门。
