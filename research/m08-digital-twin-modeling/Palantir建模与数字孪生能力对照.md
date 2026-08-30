# Palantir 建模与数字孪生能力对照

> 检索日期：2026-08-24（Asia/Shanghai）
> 状态：研究对照，不代表 Palantir 采购、许可判断或 M08 产品设计已获批准

## 1. 证据分层

本研究严格区分四类证据：

1. **本地历史视频**：Palantir 2021/2022/2023 演示机制，只证明当时画面和口播；视频中的数据均为 notional。
2. **本地二次整理 DOCX**：便于按章节和时间定位，但作者元数据为 OpenAI Codex 或 python-docx，不是 Palantir 官方原件。
3. **Palantir 当前官方文档**：用于判断截至检索日仍公开的产品资源、限制、弃用和迁移方向。
4. **本项目建议**：借鉴资源治理原则，不复制 Palantir 品牌、页面、RID、权限实现或内部架构。

官方页面不显示逐页作者编辑日期。本文“更新时间”记录 HTTP `Last-Modified`/站点构建元数据：模型页多为 `2026-08-20 18:05:14-16 GMT`，Ontology 为 `18:05:17 GMT`，Vertex 为 `18:05:22 GMT`；它不等于内容实际编辑日。浏览器 `document.lastModified` 对应北京时间 2026-08-21 02:05 左右。

## 2. 本地历史资料核对

| 来源 | 媒体事实 | 历史能力证据 | 当前使用边界 |
|---|---|---|---|
| `Palantir Foundry 2022 操作系统演示说明.docx` | 9,615,564 bytes；SHA-256 `0559970f34cc8564473392ef82af1cd93be305d9c98b882a169a5603d89f2c96`；26 页渲染核验 | §5.2 Modeling Objective、图17 候选比较、§5.3 Ontology I/O 绑定、§7.2 Case Study/串联模型 | 二次整理；以视频和当前官网复核 |
| `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4` | 48:58.368；1920x1080；SHA-256 `90be32d50960fb3be2d6d70166620deb9425484c2588f931d89d622fbdb8b61c` | 28:30 Objective；31:00 RF/SVM/Linear Regression 同屏指标；32:30 I/O 映射；43:30/44:30 Vertex 场景 | 2022 历史参考，不视为当前 UI/GA |
| `Palantir_Foundry_21_Launch_1080p_bilingual_hardsub.mp4` | 31:08.950；1920x1080；SHA-256 `89c5ede891b2cf494e683cbfb3d80541e05461ef1c4d2484d96343d46ba3b8f5` | Ontology+Simulation Engine、Modeling Objective、批量场景和优化 | 画面含 Roadmap/2021，不作当前承诺 |
| `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4` | 18:32.630；1920x1080；SHA-256 `d07e174270634acd9410af77a2d8ce4748a21a10805918d5fa702ab242eff4bb` | 模型与业务对象、Actions、外部系统写回和复用 API | 只借“业务语义是复用边界”；写回不进入 M08 模拟 |
| `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4` | 30:39.298；1920x1080；SHA-256 `94c0da9798122c4e7d1fafe266fd504c1aa62fd77ec2545b6120efba95708aec` | 单一事实源、领域建模、接口复用、保护核心、双向追溯 | 不改变本项目 M01 Owner |
| `Palantir_Speedrun_E2E_Workflow_Course_Content.docx` | README 补充资料；8,911,715 bytes；SHA-256 `005b28b4f467f02a06e3c5b9c04881149d094dfa561e21a45db18374c8760c3b`；94 页渲染 | Branch/Proposal、Object/API binding、Action 修改 Object、Workflow Lineage | 不在 SOURCE-REGISTER 表内；仅作补充历史参考 |

## 3. 当前官方能力

| 主题 | 当前官方文档（检索日 2026-08-24） | 当前能力与限制 | M08 借鉴 |
|---|---|---|---|
| Model 资源 | [Model integration overview](https://www.palantir.com/docs/foundry/model-integration/overview/)、[Models](https://www.palantir.com/docs/foundry/model-integration/models/) | Model 可封装 ML、预测、优化、物理模型或业务规则；包含 artifact 与 adapter，具备版本、血缘、安全和审计 | 区分 Candidate 与不可变 Model Version |
| Modeling Objective | [Objectives](https://www.palantir.com/docs/foundry/model-integration/objectives/) | Objective 是业务问题 interface；Submission 是某模型版本的不可变副本；Release 是带环境标签、版本号和说明的生产候选；Deployment 消费 Release | 目标、候选、提交、评审、发布指针必须分资源 |
| Experiment / Evaluation | [Experiments](https://www.palantir.com/docs/foundry/model-integration/experiments/)、[Evaluations](https://www.palantir.com/docs/foundry/model-integration/evaluations/) | Experiment 记录训练 job 的指标/参数；Evaluation 记录精确模型版本对测试数据的指标、图、表 | M08 Experiment 固定模型/数据/环境/作者；Evaluation 不与训练实验混写 |
| 公平比较 | [Automatic evaluation](https://www.palantir.com/docs/foundry/evaluate-models/model-evaluation-automatic/)、[Evaluation dashboard](https://www.palantir.com/docs/foundry/evaluate-models/review-model-metrics/) | 每个 Submission×Evaluation Dataset 可生成推理/指标；选择具体 dataset transaction 比跨 transaction 更准确；自动评估当前仅支持单表输入 | 固定精确 evaluation transaction、evaluator 和 metric schema |
| MetricSet 迁移 | [MetricSet reference](https://www.palantir.com/docs/foundry/evaluate-models/metric-sets-reference/) | `foundry_ml` 自 2025-10-31 弃用；MetricSet 标 planned deprecation，新实现建议 Experiments；Experiments 尚非所有 chart metric 的完整替代 | 不照搬 2022 dataset-backed Model/MetricSet 实现 |
| 人工评审 | [Checks](https://www.palantir.com/docs/foundry/manage-models/set-up-checks/)、[Review](https://www.palantir.com/docs/foundry/manage-models/review-model/)、[Release](https://www.palantir.com/docs/foundry/manage-models/release-model/) | 支持审批/驳回/评论/附件和 reviewer groups；**当前并不强制所有 checks 通过才可 release** | M08 自定义“人工批准是发布候选硬门”合同 |
| Batch / Live | [Batch deployment](https://www.palantir.com/docs/foundry/manage-models/set-up-batch/)、[Live deployment](https://www.palantir.com/docs/foundry/manage-models/set-up-live/) | Batch 输出数据集；Live 提供可扩缩 REST endpoint，均可跟随环境 Release；直接 Batch 仅单表输入 | 一期只验证绑定和批式确定性调用，不建在线端点/GPU 平台 |
| 推理追溯 | [Model inference history](https://www.palantir.com/docs/foundry/manage-models/model-inference-history/) | 可记录用户、请求、Objective/Model/Version、I/O/error；官方明确 ledger 写失败不重试，不能保证全部请求入账 | M08 强审计不能只依赖推理历史；Run/Result 自身必须不可变 |
| Ontology 绑定 | [Integrate models with Ontology](https://www.palantir.com/docs/foundry/integrate-models/model-asset-osdk/)、[Models in the Ontology](https://www.palantir.com/docs/foundry/ontology/models/) | Model adapter 可接 Object/ObjectSet；应用可通过 wrapper Function 使用模型；输出按对象属性语义呈现 | 应用消费稳定 Binding/Function，而非具体模型 endpoint |
| Global Branching | [Global Branching](https://www.palantir.com/docs/foundry/global-branching/overview/) | 支持跨应用隔离修改、端到端测试、评审后合并；与 release management 互补 | 研究隔离和发布环境是两种不同控制面 |
| Vertex | [Vertex overview](https://www.palantir.com/docs/foundry/vertex/overview/)、[Scenarios](https://www.palantir.com/docs/foundry/vertex/scenarios-overview/)、[Scenario options](https://www.palantir.com/docs/foundry/vertex/scenarios-options/) | 区分 current/predicted/proposed，支持 baseline、override、时间窗口和模型传播 | 借鉴 baseline/override/compare，不借品牌和 UI |
| 复合模型迁移 | [Chained models](https://www.palantir.com/docs/foundry/vertex/chained-models/) | Vertex 直接 model chaining 标 **Sunset**，当前建议 model→Function→function-backed Action | M08 自建类型化 DAG；不得把旧链路当当前一期实现基线 |
| Workshop Scenario | [Scenario concepts](https://www.palantir.com/docs/foundry/workshop/scenarios-concepts/)、[Temporary scenario](https://www.palantir.com/docs/foundry/ontology/temporary-scenario/)、[Apply scenario](https://www.palantir.com/docs/foundry/workshop/scenarios-apply/) | Scenario 是 Ontology 差异 fork；可临时或持久；官方 Apply 可事务写回 Ontology，模型结果本身不会 Apply | M08 禁用整个 Apply 路径，只保留不可变差异与只读比较 |
| Action 副作用 | [Action overview](https://www.palantir.com/docs/foundry/action-types/overview/)、[Side effects](https://www.palantir.com/docs/foundry/action-types/side-effects-overview/) | Action 可修改 Ontology 并触发通知/Webhook/外部系统；通知失败时编辑仍可能成功 | 模拟运行时不能持有真实 Action/通知/Webhook 能力 |

## 4. 历史参考与当前能力冲突

1. 2022 画面的 Model Library 仍可映射到当前 Objective/Submission/Release/Deployment 资源链，但不能假设 UI、名称或发布行为不变。
2. 2022 的直接 Vertex 模型串联当前已 Sunset；M08 只借“有向依赖和输出传播”语义，自建 DAG 校验。
3. 2022 模型输出绑定思想仍成立，但当前更适合通过 Model Function/Ontology SDK 形成稳定应用合同，不能暴露 live endpoint。
4. 当前 Palantir Scenario 允许 Apply；本项目禁令更严格，模拟没有任何写回入口。
5. 当前 Objective checks 不是硬发布门；M08 必须在合同中强制人工批准。

## 5. 可借鉴与明确不适用

可借鉴：Objective-first、不可变 Model Version/Submission、精确数据 transaction、统一评估、人工评审、Release 指针、Function 封装、Scenario fork/diff、baseline 对比、血缘和权限。

不适用：Palantir RID/品牌/UI、商业许可推断、旧 `foundry_ml`、Sunset chaining、Scenario Apply、自动跟随 Production Release、把 inference history 当强审计、把 Function-backed Action 引入 M08 隔离运行时。
