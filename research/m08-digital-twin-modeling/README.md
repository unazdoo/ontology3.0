# M08 Digital Twin & Modeling 研究工作区

## 工作树身份

- 工作树：当前仓库的 `codex/m08-digital-twin-modeling-research` 工作树
- 分支：`codex/m08-digital-twin-modeling-research`
- 创建基线提交：`f3c80ba5e5e70929fd0628c798c4878048924bbd`
- 治理参考基线：`v1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 活动实现基线：`v1.1.0`
- 活动实现基线快照：`BSL-OFW-V110-94ABD0E991B7`（只读来源）
- 预期产品来源：当前四场景组合版本正式冻结后的产品基线
- `baselineStatus = 待正式冻结`
- `rebaseRequired = true`
- `acceptanceReady = false`
- 建议隔离端口：`4357`
- 建议研究命名空间：`ofw.m08.research.v1`

M08 是平台公共模型治理、数字孪生和隔离模拟能力研究，不是 S005 私有模型页面。

## 模块定位

建议研究两个顶层工作区：

### 模型中心

- Modeling Objective / 业务建模目标；
- 候选模型、实验、训练/评估数据与指标；
- 候选比较、人工评审、发布和回退；
- 模型输入输出与 Ontology 对象属性的类型绑定；
- 批量或在线运行、质量和使用反馈。

### 数字孪生与模拟

- 真实基线快照和孪生对象网络；
- Simulation Case、参数集和功能开关；
- 单模型与复合模型图；
- 时间回放、影响传播、结果比较和敏感性分析；
- 隔离运行、恢复和历史结果只读。

真实状态、预测结果和模拟结果必须使用不同资源身份。模拟不得写回 T019、覆盖真实业务状态或触发历史 Action、通知、审批、待办或交易。

## 参考资料

原始资料位置：本机 Palantir 参考资料目录（只读，不纳入仓库）

优先读取：

- `Palantir Foundry 2022 操作系统演示说明.docx`
- `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4`
- `Palantir_Foundry_21_Launch_1080p_bilingual_hardsub.mp4`
- `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4`
- `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4`
- `Palantir_Speedrun_E2E_Workflow_Course_Content.docx`

重点研究 ML Workspace、Model Library / Modeling Objective、模型候选比较、Ontology 类型绑定、Vertex、Simulation Case 和复合模型。必须同时核对 Palantir 当前官方文档，不把 2022 演示自动视为当前产品状态。

## 首个验证方向

S005 可验证：

- 投后评价 Modeling Objective；
- 多种评价模型候选比较；
- 利率上行、信用利差扩大、评级下调、流动性折价和集中赎回等隔离模拟；
- 产品、管理人、发行人和持仓对象上的模型输出绑定；
- 模拟前后评价、风险灯和建议动作的只读比较。

模型和模拟资源必须保持通用，不得把债券基金字段写死为平台基础结构。

## 一期最小化原则

一期只研究并验证：

1. 一个 Modeling Objective；
2. 两至三个候选模型的版本化比较；
3. 输入、输出、评估指标、作者、环境和证据；
4. 人工评审、发布候选和回退语义；
5. 一个 Ontology 输入输出绑定合同草案；
6. 一个不可变基线快照和少量 Simulation Case；
7. 单模型或最小两模型串联；
8. 真实、预测、模拟三类结果清晰隔离；
9. 结果可复算、可解释和可回链。

一期默认后置：自动调参平台、任意训练代码托管、实时在线推理、GPU 集群管理、大规模 3D 孪生、复杂求解器市场、跨组织模型共享、自动交易和模拟结果自动执行。

## Owner 边界

- M01：Ontology 对象类型、属性、Metric、Rule、Action Type 和 Published 语义；
- M02：训练/运行数据版本、质量、特征来源和可复现摘要；
- M08：Modeling Objective、模型候选、实验、评审、模型版本、模拟案例和隔离运行；
- M07：模型/模拟结果的对象、时序、空间和关系 Lens；
- M04：真实行动申请、人工确认和负责人待办；
- M05：Agent 配置与运行，不替代确定性模型；
- M06：正式模型/模拟报告和证据展示；
- 平台公共层：场景、Checkpoint、身份、权限和发布治理。

模型输出如何绑定 Ontology、正式模型版本 Owner 和发布指针均需总控裁决，本工作区不得静默确定。

## 预期研究制品

1. `Palantir建模与数字孪生能力对照.md`
2. `当前平台模型能力与缺口矩阵.md`
3. `M08资源模型草案.md`
4. `ModelingObjective与候选比较合同.md`
5. `模型输入输出Ontology绑定合同草案.md`
6. `SimulationBaseline与Case合同草案.md`
7. `真实预测模拟三态隔离规则.md`
8. `S005压力情景验证设计.md`
9. `一期范围与后置能力.md`
10. `待用户裁决与CR建议.md`
11. `Quiver-M07-M08跨模块案例.md`
12. `M07-M08全链路体验重构.md`
13. `Objective输入输出与消费适配设计.md`

当前已形成的制品均为研究/候选状态：

- [Palantir建模与数字孪生能力对照.md](./Palantir建模与数字孪生能力对照.md)
- [当前平台模型能力与缺口矩阵.md](./当前平台模型能力与缺口矩阵.md)
- [M08资源模型草案.md](./M08资源模型草案.md)
- [ModelingObjective与候选比较合同.md](./ModelingObjective与候选比较合同.md)
- [模型输入输出Ontology绑定合同草案.md](./模型输入输出Ontology绑定合同草案.md)
- [SimulationBaseline与Case合同草案.md](./SimulationBaseline与Case合同草案.md)
- [真实预测模拟三态隔离规则.md](./真实预测模拟三态隔离规则.md)
- [S005压力情景验证设计.md](./S005压力情景验证设计.md)
- [一期范围与后置能力.md](./一期范围与后置能力.md)
- [待用户裁决与CR建议.md](./待用户裁决与CR建议.md)
- [Quiver-M07-M08跨模块案例.md](./Quiver-M07-M08跨模块案例.md)
- [M07-M08全链路体验重构.md](./M07-M08全链路体验重构.md)
- [Objective输入输出与消费适配设计.md](./Objective输入输出与消费适配设计.md)

## 隔离技术验证（研究证据）

验证包位于 [`validation/`](./validation/)，固定命名空间 `ofw.m08.research.v1`，默认端口 `4357`。它使用零依赖 Node.js、合成 S005 夹具和独立内存运行，不读取当前组合 localStorage、运行编号或历史快照。

```bash
cd research/m08-digital-twin-modeling/validation
npm test
npm run evidence
npm start
```

当前证据：43/43 自动测试通过，`evidence/technical-validation-summary.json` 为 `overallStatus=PASSED`。证据覆盖四类 Objective Registry、Object Type 兼容发现、通用 Binding schema 与单位漂移拒绝、M07/M03/M05/M06 Consumer Projection、M04 非事实硬拒绝、候选公平比较、人工评审硬门、无 endpoint Binding、M07 精确上下文进入 Simulation Run、单模型/复合模拟、三态隔离、DAG 校验和副作用禁用。内部 PASS 不代表用户评审、M07/M08 正式立项、模型生产可用或一期验收。

## 当前研究结论

- Palantir 当前官方文档仍公开 Modeling Objective、Experiments、Evaluations、Ontology model integration、Vertex Scenario 和 Global Branching；Vertex 直接 chained models 已标记 Sunset，Objective checks 当前并非强制 release 门，MetricSet/`foundry_ml` 已进入弃用迁移路径。
- M08 可借鉴 Objective-first、不可变 Model Version/Submission、精确评估 transaction、人工评审、Function/Binding、Baseline/Scenario diff 和血缘治理；不复制 Palantir UI、品牌、RID、Endpoint、Scenario Apply 或 Action 副作用。
- S003 C035 继续作为 M01 特例；S005 当前只能以合成数据验证工程适配，不能宣称预测准确率或业务最优。
- 正式立项门当前不满足：组合未正式冻结、`rebaseRequired=true`、`acceptanceReady=false`，且多项 Owner/合同/用户裁决待关闭。

## v1.1.0 活动基线对齐（用户最新方向）

本轮集成原型按以下实施假设落地：

- 后续实施与新增研究的活动实现基线：`v1.1.0`；
- `v1.0.3`：只读历史父版本、迁移来源和回退基线；
- M08 S001 隔离入口：`designs/m08-s001-v1.1.0-integrated/`；
- 原型版本：`m08-s001-v1.1.0-baseline-additive.5`；
- 集成端口：`4358`；研究命名空间仍为 `ofw.m08.research.v1`。

当前基线增量修订为 `m08-s001-v1.1.0-baseline-additive.5`：实现和视觉基于 v1.1.0 活动实现基线，保留 M01–M06 canonical 页面和父壳交接；M07 探索分析与 M08 模型与模拟作为两个独立研究模块增量挂载。M08 采用 Objective-first 目录和工作区，四类 Objective 共用输入输出合同、Binding 校验、Consumer Projection 和 Result Envelope；M07 不再跳入固定利率 Case。M07 使用 `ofw.m07.research.v1`，M08 及 4357 服务使用 `ofw.m08.research.v1`。两者均未正式立项。

## 允许与禁止

允许在本工作区创建研究文档、模型接口、隔离试验、确定性计算、模拟夹具和测试。禁止修改其他工作树、平台台账或原始资料；禁止将实验模型发布为平台正式模型；禁止模拟写回真实状态；禁止将 LLM 作为正式模型或数据源；禁止因研究扩大一期范围。

启动时使用同目录的 [START-PROMPT.md](./START-PROMPT.md)。
