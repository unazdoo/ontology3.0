# M08 Digital Twin & Modeling 研究工作区

## 工作树身份

- 工作树：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/m08-digital-twin-modeling-research/`
- 分支：`codex/m08-digital-twin-modeling-research`
- 创建基线提交：`f3c80ba5e5e70929fd0628c798c4878048924bbd`
- 治理参考基线：`v1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
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

根目录：`/Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料/`

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

## 允许与禁止

允许在本工作区创建研究文档、模型接口、隔离试验、确定性计算、模拟夹具和测试。禁止修改其他工作树、平台台账或原始资料；禁止将实验模型发布为平台正式模型；禁止模拟写回真实状态；禁止将 LLM 作为正式模型或数据源；禁止因研究扩大一期范围。

启动时使用同目录的 [START-PROMPT.md](./START-PROMPT.md)。
