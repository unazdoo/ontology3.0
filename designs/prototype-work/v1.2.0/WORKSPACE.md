# v1.2.0 总装原型工作区

本工作区只用于把 M07、M08、S005 以及 M08 通用 Objective 能力和 S003 只读持续优化研究链汇入一套可走查原型，不承担正式项目实施。

## 工作区身份

- 工作树：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.2.0`
- 分支：`codex/prototype-v1.2.0-composite`
- 候选版本：`v1.2.0-rc.1`
- 底座标签：`prototype-v1.1.0-frozen`
- 底座提交：`a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716`
- 父版本：`v1.1.0`
- 基线快照：`BSL-OFW-V110-94ABD0E991B7`
- 状态：唯一总装候选入口已物化；品牌与首页保持 v1.1.0 基线，S005 六评价域和真实模块事件链、M08 Objective-first 工作台、S003 持续优化研究链及模块消费者已接入；候选完整回归已通过
- `acceptanceReady = false`

冻结目录 `designs/prototype-releases/v1.1.0/` 仅作只读来源，不得原地修改。

## 与正式实施的边界

正式实施继续使用 `implementation-v1.1.x` 及其模块工作树。总装原型中的页面、交互、资源和状态变化不会自动进入正式实施，也不会自动修改 API、数据库、服务、Foundation 或 CI。

用户完成总装原型走查并明确裁决后，必须另行形成“原型差异转实施清单”，再由相应模块 Owner 在实施分支落地。

## 输入交付包

三个来源分支已提交并由总控导入自己的最小包：

1. `integration-exports/v1.2.0-rc.1/m07/`
2. `integration-exports/v1.2.0-rc.1/m08/`
3. `integration-exports/v1.2.0-rc.1/s005/`

实际来源提交和总装导入提交登记在 `INTEGRATION-SOURCES.json`，独立复跑结果登记在 `PACKAGE-VERIFICATION.json`。

交付包不得包含整套 v1.1.0 副本、第二平台 Shell、绝对符号链接、归档截图、原始敏感资料或正式实施代码。

## 合并顺序

1. 核验三个交付提交、清单、哈希和测试。
2. 接入 canonical M07：`moduleId=m07`、`route=#module/m07`、`workspace-v2`。
3. 接入 M08 modeling，并适配 canonical M07 的双向交接。
4. 接入 `S005 / S005-v1` 场景包，不复制第二套 Shell。
5. 最后修改共享 Shell、模块注册、场景注册、VERSION 和 manifest。
6. 生成唯一入口后执行 M01 至 M08、仪表盘、S001 至 S005 和三档视口回归。

## S005 当前总装合同

S005 使用同一平台 Shell 和同一五字段场景身份，当前链路为：

`M02 来源/版本/质量交付 -> M01 身份、Wind fund_type、分类和口径候选 -> 统一 evaluation run/result -> M03 合规与市场横评只读消费 -> M04 not_applicable/read_only -> M05 交易与风险只读解释 -> M07 对象/关系/时序探索 -> M08 候选预测/模拟 -> M06 报告、复核、历史比较 -> Dashboard 当前 run 汇总`。

- 七阶段只接受模块返回的可验证结果事件，并由评价引擎调用 `updateS005Stage`；页面跳转、查询参数、资源登记和 `SERIES_INPUT_UNAVAILABLE` 都不计完成。
- M07 在打开 M08 的同一消息中携带原子探索结果包；没有该结果包时宿主拒绝推进和跳转。
- M08 返回独立的 `simulationStatus`。真实评价、预测和模拟保持分离；隔离合成输入标记为 `SYNTHETIC_RESEARCH_ONLY`，事实覆盖率增量、Action 写入和副作用均为 0。
- M04 对 S005 明确为 `not_applicable/read_only`，不创建 Action、提醒、审批、待办或交易。
- Dashboard 只接受当前 `scenarioRunId` 对应的 evaluation run/result，并按产品自身表现、财务公司实际投资结果、固定收益风险、管理与运行质量、持续准入合规、选择与执行六域展示状态、指标、覆盖率、结论、缺失原因和证据下钻。
- 数据不足保持 `null`，并显示部分评价、观察期不足或无法评价；周快照不换算为日频 Sharpe，模拟结果不替代事实。
- 重置 S005 后生成新 run 并回到 0/7；旧 evaluation run/result/module outputs 留档，S001 至 S004 不变。

## M08 与 S003 当前总装合同

- M08 提供“全部目标 / 当前场景”范围切换，公共目录可发现 `FORECAST`、`CLASSIFICATION`、`SCORING`、`OPTIMIZATION`；生命周期为目标、合同、Benchmark、AI Insight、候选、人工选择、Release Candidate、Binding、消费跟踪，Simulation 仅是使用方式。
- S003 登记 `MO-S003-DEBT-RISK-EARLY-WARNING-v1`。冻结 `S003-M01-DEBT-RISK-PKG@1.0.2` 仅通过 sourceRef、版本和 SHA-256 作为不可变基线引用，不复制为第二套权威配置。
- synthetic 纵向 Benchmark 只用于高保真研究验证，不证明模型有效性；全部特征满足 `availableAt <= predictionAsOf`，标签不足返回 `INSUFFICIENT_LABELS`，指标保持 `null` 而不是补零。
- AI 只产生结构化 ModelInsight，不计算风险分数、不改标签、本体、数据或 Benchmark，不自动选冠军或发布。候选 C 缺语义与历史数据时保持 `DATA_REQUIRED`。
- Shadow Trial 使用三个标签成熟窗口；封存 Holdout 只在最终 Release Candidate 时使用一次。只有“应用为仪表盘默认候选”保留一次明确人工确认。
- S003 归档 `scenarioRunId` 保持只读；BenchmarkRun、ExperimentRun、ShadowRun 和 recalculation run 使用独立研究身份。
- Dashboard 保留冻结正式 FACT，并作为 M08 消费端提供正式、候选、差异三视图；M03、M05、M06、M07 只读消费同一 Result Envelope，M04 对非 FACT 返回 `NON_FACT_SOURCE_REJECTED`。
- M01/M08 权属迁移仅登记 `CR-M08-S003-MODEL-OWNER-MIGRATION`，不在本候选增加审批流、发布流程或生产迁移。

## 当前门禁

当前只要求最小原型门：包可移植、单一入口、无双层 Shell、身份一致、主要流程可点击、重置隔离、页面和控制台无新增错误。生产安全、权限、性能、审批和验收证据不作为本轮总装前置门。当前自动化 Node 回归为 123/123，M08 静态合同为 6/6、确定性验证为 59/59，Dashboard 合同为 12/12，M07 合同为 8/8，回归矩阵为 36/36；六域 Dashboard、S003 持续优化链、模块消费者、边界、重置、artifact inventory 和冻结完整性校验均已闭合。

当前唯一入口为 `composite/s001-e2e-integration/index.html`；执行证据登记在 `COMPOSITE-REGRESSION-MATRIX.json` 与 `composite/evidence/browser-regression.json`。

统一启动命令：`node composite/start-candidate.mjs`。该命令同时启动 `127.0.0.1:4342` 的统一 Shell 和 `127.0.0.1:4359` 的候选本地确定性计算服务；它不是正式服务或 API。

当前 Dashboard 入口为 `composite/dashboard/index.html`：S001、S002 和 S003 正式 FACT 视图保持冻结基线，S003“模型与运行”增量改为 M08 消费端；S005 作为第四个、读取当前 evaluation run/result 的六评价域驾驶舱进入同一目录。它不是第二套平台 Shell，也不直接读取固定评价 fixture。

模块页不提供额外的场景资源装载器。五场景资源只在首页统一目录中按业务属性检索；选择资源后由宿主自动携带上下文进入对应模块。

候选不得形成 Published 本体、Metric、Rule 或 T019。本轮总装状态不等于模块评审、场景验收、生产技术联调或一期验收通过，`acceptanceReady` 继续为 `false`。
