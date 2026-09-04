# v1.3.0-rc.1 总装结果

## 当前结果

- 唯一入口：`composite/s001-e2e-integration/index.html`
- 父版本：`v1.2.0-rc.1@e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0`
- 一套 Shell：是；第二套 Shell：无。
- 首页：只展示平台能力架构，无模块目录、场景运行、进度、待办、全局场景切换器或“统一资源目录”。
- 页面继承：M01—M07 均为父版真实工作区，M08 是唯一授权重构页面。
- 当前状态：`acceptanceReady=false`。

## 全链路结果

S001、S002、S004 均通过父版真实页面完成数据冻结、语义合同、基线与模型组合评测、智能问数、M04 硬拒绝、Agent 解释、报告草稿和 Dashboard 候选消费，并继续完成洞察审查、不可变候选、3 个 Shadow 窗口、复评、Release Candidate、Binding 应用和压力模拟。

S003 当前完整周期为：

- Cycle：`CYCLE-S003-OPT-20260902-002`
- DataVersion：`DV-S003-SYN-LONGITUDINAL-20260902-v1-C02`
- Semantic Contract：`SC-S003-MULTIMODEL-20260902-v1-C02`
- 9 个 ModelRun、10 个 BenchmarkRun
- 候选 Model Version：`MV-S003-BLEND-002-021-0.2.0-CANDIDATE`
- Shadow Trial：`SHADOW-TRIAL-002-023`
- Release Candidate：`RC-S003-002-033`
- Dashboard Binding：`CB-S003-DASHBOARD-MULTIMODEL-R1`
- Result Package：`CYCLE-S003-OPT-20260902-002-RESULT-PACKAGE-18`
- 压力模拟：`SIMRES-002-038`
- 最终状态：`BINDING_APPLIED`
- 正式模型指针变化：否；正式事实指针变化：否；外部副作用：0

S005 在真实 M01—M08 页面中形成 9 个模块输出并完成 7 个评价阶段。M07→M08→M07 回传校验对象、Lens、时间、DataVersion、OntologyVersion、Binding、ModelVersion 和 Result Envelope；M06 最终形成待复核报告草稿。S005 模型优化周期也完成 3 个 Shadow 窗口、Release Candidate、Binding 和压力模拟，最终为 `BINDING_APPLIED`。

五场景最终模型周期：

- S001：`RC-S001-002-025`，Binding `APPLIED`，模拟 `RESULT-S001-v1-002-031`
- S002：`RC-S002-002-024`，Binding `APPLIED`，模拟 `RESULT-S002-v1-002-030`
- S003：`RC-S003-002-033`，Binding `APPLIED`，模拟 `SIMRES-002-038`
- S004：`RC-S004-002-024`，Binding `APPLIED`，模拟 `RESULT-S004-v2.1.0-002-030`
- S005：`RC-S005-002-024`，Binding `APPLIED`，模拟 `RESULT-S005-v1-002-030`

## 数据与模型仓

- M02 对 S003 展示 6 类模型就绪数据资产，数据分类为 `SYNTHETIC_DEIDENTIFIED_LONGITUDINAL`，共 21 家企业、8 个观察期、168 条观察。
- 未来信息泄漏行数为 0，非法 Outcome 行数为 0，标签独立性通过。
- M01 登记 10 个逐模型语义绑定，缺失不补零，结果身份保持独立。
- M08 登记 10 个 Python 模型仓，每仓 6 类文件。
- Chrome 实际跑通 `main` 受保护、研发分支、不可变提交、标签、代码发布候选、Python 单元测试和绑定 DataVersion 的模型运行。
- 验证仓最终计数：2 个分支、2 个提交、2 个标签、1 个代码发布候选；Python 结果为 21 个企业。

## 界面整改

- 首页保留 v1.2 能力架构并移除场景运营组件，平台模块作为首屏主体。
- 九个工作区统一为增强对比度的浅色 Shell 侧纵向二级任务导航，文字和点击区域已放大；面包屑位于全局顶栏，移动端为单一选择器，iframe 内重复菜单隐藏。
- M02 的冻结 DataVersion 已进入数据资产目录，M01 的 Semantic Contract 已进入语义资产目录；旧场景提示框数量为 0。
- M02 的跨年度文件已归并为统一数据源快照；已发布管道定义只读，可创建草稿副本，运行记录排版已对齐。M01 已发布本体卡片不显示 S001—S005 场景编号。
- 各模块不提供业务场景/业务范围切换器，资源按数据源、语义资产、对象类型、业务目标等原生目录组织。
- 智能问数保留父版问题并扩展为 51 个推荐问题，按 ALL 与 S001—S005 分类；页签切换不重载，父版与模型问题均保留 5 步动画和 680ms 节奏，并支持取消过期运行。
- 智能问数的集团/产业成本首答、四类 BI 图形和单位553行动申请均已闭环；申请可进入 M04 工作台与运营驾驶舱。
- M07 在同一父版工作区中提供一个 56 对象目录，不显示场景选择器；对象交接时解析对应业务上下文和版本。
- M08 收敛为 5 个连续任务页，删除重复状态条，使用中文评测指标；Python IDE 式模型代码仓可从模型详情穿透到代码、README、Git 状态和运行控制台，长页和内部面板均可滚动。
- S004 已成为 Dashboard 自身登记的第五个真实工作区，提供借款主体、缺失状态、证据和模型结果下钻。
- Dashboard 目录不再提供“模型结果”按钮，多模型结果只在各业务驾驶舱内部按结果身份展示。
- 页面不再展示“v1.3 增量”“同一原型协同”“稳定基线 1.0.2”或 S003 顶部说明层。

## 验证结果

- v1.3 Node 测试：42/42 通过。
- 模型仓 Python 单元测试：30/30 通过。
- Chrome 1440×900：S001—S005 × 10 路由，50/50 通过。
- Chrome 1280×720、390×844：各 10/10 通过。
- 横向溢出、空白页、应用 Console、Page Error、资源错误：均为 0。
- 智能问数场景页签 iframe 重载：0；多标签页自动重载：0；历史后退额外 frame load：0；深链与刷新稳定。
- M08 五个任务页在 1280×720 下均可滚动，代码仓具有可用的内部滚动区域。
- S001—S005 五场景完整优化周期均达到 `BINDING_APPLIED`。
- 本机浏览器：Google Chrome 152.0.7977.65，直接由 Playwright 控制；未使用 Codex 内置浏览器。
- 浏览器证据：`composite/evidence/browser-regression.json`，观察时间 `2026-09-03T18:34:55.063Z`（上海本地日期 2026-09-04）。
- 父版本和冻结目录完整性：通过。

完整文件清单与 SHA-256 位于 `COMPOSITE-MANIFEST.json#artifactInventory`；分类变更见 `ACTUAL-CHANGES.md`，未闭合边界见 `OPEN-ISSUES.md`。

本结果不宣称模型有效性已经正式证明、生产上线完成、用户评审通过或一期验收通过。
