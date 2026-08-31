# v1.2.0-rc.1 总装结果

## 当前结果

- 唯一走查入口：`composite/s001-e2e-integration/index.html`
- 总装方式：在只读 v1.1.0 底座上增量挂载候选资产，不复制冻结产品树。
- 平台结构：一个 Shell、一套一级导航、M01 至 M08 与仪表盘共九个业务工作区。
- 场景结构：S001 至 S005 作为统一资源目录中的业务属性与筛选条件，不提供第二套场景壳。
- 品牌与首页：使用 v1.1.0 冻结版脑网络标识、三能力域架构、领域详情和信息层级；M07、M08、S005 与统一资源目录均为增量扩展。
- 仪表盘：保留 v1.1.0 的 S001、S002 与 S003 正式 FACT 驾驶舱；S003“模型与运行”增量改为 M08 消费端，在同一目录加入 S005 六评价域驾驶舱；S005 只读取当前 `scenarioRunId` 的 evaluation run/result，不读取固定评价 fixture。
- 模块入口：模块页直接进入业务内容，不再显示场景资源选择或加载条；首页统一目录负责检索，资源上下文随入口自动传递。
- S005 链路：`M02 -> M01 -> M03 -> M04 -> M05 -> M07 -> M08 -> M06 -> Dashboard` 已由实际模块结果事件贯通；当前浏览器证据记录 0/7 至 7/7、Dashboard 同 run 更新以及重置后新 run 回到 0/7。
- M08 / S003 链路：Objective 目录可在全部目标和当前场景间切换，S003 已真实跑通 Benchmark、结构化 AI Insight、A/B/C 候选、三窗口 Shadow Trial、Release Candidate、Binding、21 家企业固定数据试算、Dashboard 正式/候选/差异和 M07/M03/M05/M06 消费；M04 对非 FACT 硬拒绝。
- 回归记录：`COMPOSITE-REGRESSION-MATRIX.json` 共 36 项，36/36 passed；artifact inventory 已记录 94 个候选文件的大小和 SHA-256，最终候选校验 20/20 passed。
- 当前状态：`acceptanceReady=false`。该状态表示总装候选已完成本轮技术回归，不表示正式实施、发布、用户评审或一期验收结论。

## 已物化合同

- M01 至 M06 继续相对引用 `prototype-v1.1.0-frozen`。
- Dashboard 使用候选增量入口 `composite/dashboard/index.html`，其 `sourceEntry` 指向冻结 Dashboard；S001、S002 和 S003 正式 FACT 保持基线，S003 只增量增加 M08 消费端，S005 只增加投后评价内容，不引入第二平台 Shell。
- M07 的唯一身份为 `moduleId=m07`、`route=#module/m07`、`canonicalImplementation=workspace-v2`。
- M08 的唯一身份为 `resourceOwnerId=M08`、`moduleId=modeling`、`route=#module/modeling`。
- M08 采用 Objective-first 动态工作台，支持全部目标/当前场景切换和 `FORECAST`、`CLASSIFICATION`、`SCORING`、`OPTIMIZATION` 四类；Simulation 是使用方式，不是 Objective 生命周期阶段。
- S003 注册 `MO-S003-DEBT-RISK-EARLY-WARNING-v1`。`S003-M01-DEBT-RISK-PKG@1.0.2` 只作为不可变 sourceRef/version/SHA 基线，M08 研究身份不复用归档 S003 run。
- M07、宿主和 M08 使用 `scenarioId`、`scenarioVersion`、`scenarioRunId`、`formedAt`、`status` 五字段交接。
- S005 的七阶段只接受模块回传的可验证结果事件并调用 `updateS005Stage`；资源登记、查询参数、页面跳转、`completeAll()` 或 `SERIES_INPUT_UNAVAILABLE` 均不计完成。
- M07 把对象、Lens、系列、时间范围、数据/语义/Binding 版本和证据组成原子探索结果包，并与 `OFW_M07_OPEN_M08` 一次提交；缺少包络或任一字段漂移时宿主拒绝推进和跳转，完整谱系随 module output 留档。
- M08 返回独立 `simulationStatus`，并将 Objective、Revision、Binding、Release、Model、对象、Lens、时间和版本谱系写入候选结果。本轮实际交接固定使用 `SYNTHETIC_CANDIDATE_SIMULATION`，结果为 `SIMULATION / SUCCEEDED`；输入分类为 `SYNTHETIC_RESEARCH_ONLY`，服务必须显式证明不含来源业务值、事实写入和 Action 写入为 false、副作用为 0，缺字段时失败关闭。
- 统一 evaluation run/result 在 M01 后形成；M03、M04、M05、M07、M08、M06 必须引用当前 `evaluationResultId`，stale 结果不能推进。M04 对 S005 明确为 `not_applicable/read_only`，不创建 Action、提醒、审批、待办或交易，也不能提交 `metricUpdates`。
- M06 形成报告草稿和待复核记录；首次运行明确标记无历史可比，后续 run 的历史比较必须精确引用上一 `scenarioRunId/evaluationResultId`，不把草稿或待复核状态写成已发布/已完成评审。
- 六评价域为产品自身表现、财务公司实际投资结果、固定收益风险、管理与运行质量、持续准入合规、选择与执行。每域列出状态、指标、覆盖率、结论、缺失原因和证据下钻。
- TWR、MWR/XIRR、已实现/未实现收益、现金流、费用、Sharpe、Sortino、Calmar、信息比率、波动、最大回撤/恢复、久期、评级迁移、集中度、流动性、Carry/Roll-down/曲线/信用/选择/择时归因，以及下一可得 NAV、实际 NAV、滑点和结算状态均进入评价指标合同；无证据值保持 `null` 和缺失原因，不补零、不伪造。
- S001 至 S004 的归档身份只读；S005 使用 `S005 / S005-v1` 和按轮次动态生成的 `scenarioRunId`。
- 当前场景重置只处理 S005 当前轮次，上一轮 evaluation run/result/module outputs 进入本地历史，四个归档场景保持不变。
- M01 至 M08 与仪表盘各登记 S001 至 S005 资源；未登记能力显式显示状态，不回退到其他场景数据。
- `CR-V120-001` 与 `CR-V120-002` 已在候选适配层形成可执行实现和证据，仍待平台总控确认，不代表用户裁决或正式合同生效；源交付包保持不变。
- `CR-M08-S003-MODEL-OWNER-MIGRATION` 只登记 M01 Published 语义与 M08 Objective/Model Version/Release/Binding 的未来权属迁移，不增加审批页或阻断本候选。

## 实际提交清单

- 候选治理：`VERSION.json`、`WORKSPACE.md`、`PACKAGE-VERIFICATION.json`、`CONTRACT-CHANGE-REQUESTS.json`、`MODULE-REGISTRY.json`、`SCENARIO-REGISTRY.json`。
- 总装记录：`COMPOSITE-MANIFEST.json`、`COMPOSITE-REGRESSION-MATRIX.json`、`ASSEMBLY-RESULT.md`。
- 唯一 Shell：`composite/s001-e2e-integration/`。
- Dashboard 候选增量：`composite/dashboard/`。
- M07 候选：`composite/modules/m07/`。
- M08 候选及本地计算服务：`composite/modules/modeling/`。
- S003 M07 资源、共享消费者和统一启动：`composite/modules/m07/resources/s003.json`、`composite/modules/modeling/consumer/`、`composite/start-candidate.mjs`。
- S005 场景运行适配：`composite/scenarios/s005/`。
- S001 至 S005 统一资源目录：`composite/resources/catalog.js`。
- 静态、合同与状态测试：`composite/tests/`、各候选模块和场景目录内的 `tests/`。
- 浏览器证据与三档视口截图：`composite/evidence/`。

候选资产的逐文件大小和 SHA-256 由 `composite/tests/refresh-manifest.mjs` 写入 `COMPOSITE-MANIFEST.json`，该清单是实际文件提交明细。

## 已执行校验

- 完整 Node 回归：123/123。
- 品牌、首页与直接模块入口合同：5/5；Dashboard 完整合同：12/12。
- S005 evaluation engine：8/8；模块工作台：3/3；宿主状态、S003/S005 原子 M07/M08 谱系与重置：9/9。
- M07 实际 payload 到 M08 bridge 的跨包执行测试：2/2。
- 候选状态、实际事件链与重置隔离：6/6。
- 统一资源目录：4/4，覆盖 9 模块 x 5 场景共 45 项资源。
- M07 候选合同：8/8。
- M08 候选静态合同：6/6；确定性计算与合同验证：59/59；共享消费者：3/3；统一启动器：1/1。
- S005 基础运行合同：3/3。
- 浏览器回归证据：36/36；覆盖 1440x900、1280x720、390x844。S005 Dashboard 当前 run 为六域、34 项指标，证据下钻可用，固定 fixture 结果读取为 false；S003 已覆盖全部 Objective、候选比较、三成熟窗口、Dashboard 差异、M07 返回和共享消费者。
- 实际链证据：M02 1/7、M01 2/7、M03 合规 3/7、M03 市场横评 4/7、M04 5/7、M05/M07 保持 5/7、M08 6/7、M06 7/7；随后 Dashboard 使用同一 run，重置返回 0/7。
- 页面走查期间：候选页应用错误 0、页面错误层 0、失败资源请求 0、外部地图请求 0；高风险 DOM 观察器已移除。
- v1.1.0 发布完整性和 T056 基线校验继续通过。
- regression recorder、artifact inventory 刷新和最终静态候选校验均已执行；`acceptanceReady` 仍保持 false，等待总装走查和明确的实施转交裁决。

## 仍未闭合

- S005 当前五个 `InvestmentProduct` 对象仍没有可见的受治理真实时序系列，因此 TWR、XIRR、日频风险指标、NAV 和固定收益归因等事实评价继续显示缺失原因。M08 已通过隔离合成候选输入完成实际交接，但该 `SIMULATION` 结果不会替代事实、提高 factual coverage 或写回 Action。证据：`composite/evidence/browser-regression.json#handoff` 与 `#s005Boundaries`。
- S002 与 S004 尚未登记 M07 多视图数据包。统一目录可以筛选和查看这些登记状态，进入模块时明确显示不可用且不回退其他场景。S003 已登记 M07 数据包和 M08 Objective。证据：`composite/resources/catalog.js`。
- S003 Benchmark 为 synthetic 脱敏纵向数据，只证明合同和计算链可复算，不证明模型有效性；候选 C 仍因未来90日到期债务集中度缺 M01 语义和 M02 历史数据而保持 `DATA_REQUIRED`。
- S003 模型 Owner 迁移仍待平台治理裁决；当前只实现研究边界，不形成 Published 模型、生产 Binding 或 T019 模型登记。
- M08 页面操作依赖候选本地计算服务；本次因 4357/4358 已被其他工作树占用，走查服务使用 `127.0.0.1:4359`。这不是正式服务或 API 集成。
- 当前候选不形成 Published 本体、Metric、Rule 或 T019；周快照不换算日频 Sharpe，预测/模拟结果不替代真实结果。
- 总装范围不包含正式服务、API、数据库、Foundation、CI 或实施分支变更；候选结果不会自动进入这些范围。

本文件只记录候选总装的结构、合同与证据状态，不扩张为模块评审、场景验收、生产联调或一期验收结论。
