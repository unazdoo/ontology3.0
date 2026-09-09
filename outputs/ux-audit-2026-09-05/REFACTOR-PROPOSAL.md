# 高保真原型 UX 审查与重构确认方案

审查日期：2026-09-05（Asia/Shanghai）  
状态：**待用户确认，尚未实施应用重构**  
建议范围：基于当前 v1.3.1 建立下一版 UX 候选，修复分析正确性、补齐工作流、统一交互体验。

## 1. 结论与实施边界

目前的问题不主要是缺少模块，而是部分模块之间的对象、筛选范围、模型版本和结果模式没有真正一致。已有导航和上下文栏能显示“同一工作区”，但部分计算、返回、保存和报告逻辑仍各自决定实际处理什么。应先解决这些影响理解和判断的问题，再进行视觉优化。

**建议采用选择性重构，不重写整个平台，不新增生产级基础设施。** 当前版本已经具备单一 Shell、对象探索、建模目标和五个业务驾驶舱，均应保留并完善，不把已实现内容重新列为“待建设”。

本方案中必须区分两类工作：已证实缺陷的修复，以及为了完整体验而提出的设计增强。设计增强不是对现有全部功能失效的判断。

本次明确不做：

- 新增登录、RBAC/ABAC、组织权限、安全策略、权限继承、审计控制台。
- 新增多级审批、发布门禁、合规闸口，或把这些流程设为普通分析的前置条件。
- 建设远程 Git 平台、生产制品仓、真实部署系统、多租户、长期数据库或复杂后端平台。
- 接入真实放款、交易、支付或外部自动执行；所有业务动作保持原型内可操作、可反馈的本地状态。
- 把演示数据或模拟评测包装成真实预测能力，或为填满图表而补造缺失值。
- 为“统一技术栈”全面迁移 React/Vue，或复制整个历史原型目录。

必要的体验保护仍保留：明确对象与数据身份、正式/候选/模拟结果区分、缺失值说明、错误恢复、撤销，以及覆盖草稿或重置本地状态等少数操作的确认。这些是避免误解和误操作的交互，不是权限或治理体系。

## 2. 实际基线与审查覆盖

工作目录：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`。

虽然工作目录名带有 v1.3.0，实际 HEAD 已为：

```text
0eed1d6322631d6fcdeca6fb1c23d01a5d5ee9ca
feat(prototype): assemble v1.3.1 palantir-aligned refactor
```

正式审查对象为 `designs/prototype-work/v1.3.1/`。v1.3.0 只作为继承运行时和历史对照，不把其已修复问题当成当前缺陷。已有用户服务运行的是旧入口；审查另启临时端口上的 v1.3.1 隔离服务，未重置或停止用户服务。

| 检查项 | 已完成范围 | 不能由此推断的结论 |
| --- | --- | --- |
| 本地 Palantir 资料 | 提取并检索 4 份 DOCX；系统截图文档的 23 张图片完成 OCR | 没有逐帧观看/转写目录内 4 个 MP4；OCR 不等同于视觉审美审查 |
| 官方资料 | 核对对象探索、保存探索、Workshop 变量、Agent 应用状态、建模目标/评测、管道预览等文档 | 不将 Palantir 的权限、生产部署与治理要求自动纳入本原型 |
| 代码审查 | Shell/状态、M01-M06 集成层、M07、M08、Dashboard，以及继承关系和测试 | 未逐行审查所有冻结历史 HTML、第三方库和业务数据文件 |
| 浏览器覆盖 | 首页、M01-M08、Dashboard，共 10 个入口 × 3 个视口，共 30 个页面状态 | 是入口覆盖，不是 30 条完整端到端业务流程 |
| 视口 | 1440×900、1280×720、390×844 | 未实测 Safari、真实手机和触屏拖动 |
| 定向交互 | 7 组正常/异常流程复现；4 个提取原函数的受控用例 | 受控函数用例与真实 UI 复现分别标注，不混用 |
| 既有测试 | v1.3.1：17/17；共享 v1.3.0 运行时/仓库等测试：42/42 | 现有测试通过不等同于上下文、分析含义和交互验收通过 |

正常入口扫描未捕获 console/page error，页面级横向溢出检查通过，但定向检查仍发现内部表格操作不可稳定到达。截图已保存；本次工具环境不能直接读取图像像素进行视觉判断，因此布局判断主要来自 DOM 文本、尺寸、滚动关系及实际点击，未宣称完成逐像素审美验收。正式重构验收需补人工或可用图像查看工具的截图复核。

证据位于本报告同目录的 `evidence/`：

- `summary.json`：30 个入口/视口的汇总；各 `{宽度}-{模块}.json/.png` 为对应快照。
- `flows.json`：7 组浏览器交互结果，包括成功对照和故障注入。
- `contracts.json`：4 个受控函数用例。
- `saved-exploration-wrong-scope.png`、`decision-reachability-390.png` 等为定向截图。
- `audit.mjs`、`flows.mjs`、`contracts.mjs` 为审查脚本副本，保留了审查时的绝对路径和临时输出目录，不属于应用实现。

## 3. 已证实的问题

P1：优先修复，会使用户看到错误对象、错误结果、错误数值或错误分析范围。  
P2：影响操作效率、可达性、恢复能力或一致性；应在本轮 UX 重构中解决。

### F01 / P1：模型回传可能把 A 对象结果标成 B 对象

**证据：原函数受控复现。** 请求返回 B 对象的候选结果，候选中 B 的 score 为 12，同时模拟结果只有 A 的 score 73。`explorationReturnPayload()` 实际优先读取模拟包，在对象匹配失败后取第一条记录，输出变成了“B / SIMULATION / 73 / HIGH”。同时数据版本和语义版本被写为传入对象的版本。

这不是 UI 样式问题，而是结果身份与数值失去对应。受控用例证明当前分支存在该行为，不表示本次已经通过正常 UI 操作产生了这组特定数据。

定位：[model-center/app.js:715](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:715)，尤其第 717、729 行。

修复目标：按用户选定的结果模式、对象 ID、运行、模型版本及输入上下文精确读取；找不到时显示“当前对象无此结果”，允许继续查看已有结果或运行当前对象，不回退为另一对象，也不重写来源版本。

### F02 / P1：选中的模型版本与展示指标可能不一致，指标单位也会失真

**证据：原函数受控复现与代码审查。** 同一模型 v1 的 prAuc=.4、v2 的 prAuc=.8，选择 v1 时返回了 .8。原因是先取最近一份比较结果，再使用 `modelId 匹配 OR versionId 匹配`，而不是精确定位被选版本。

`metricValue('mae', 0.4)` 又会输出 `40%`，因为格式化仅依据数值是否小于等于 1；比较差值对所有指标都使用 `×100` 和 `pp`，不能正确处理原始误差、金额和计数。

定位：[model-center/app.js:480](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:480)、[app.js:189](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:189)、[app.js:517](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:517)。

修复目标：精确绑定版本与评测上下文；给指标定义类型、单位、方向和差值格式。可在页面并列查看不同口径结果，但不同口径时说明差异，不生成误导性的优劣判断或强制发布审批。

### F03 / P1：模型目标在跨模块返回后发生回跳

**证据：浏览器复现。** 从默认 S005 工作区进入模型，选择“债务风险智能监测”S003，再点击主导航进入问数后返回模型，标题变为“投后评价与产品选择”。Shell 的 `activeScenarioId` 仍为 S005，而 `comparisonRef` 已指向 S003。

定位：[model-center/app.js:910](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:910)、[state.js:231](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/state.js:231)、[Shell app.js:591](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/app.js:591)。

修复目标：明确业务域、目标、对象与模块导航的状态职责；目标选择原子更新工作上下文，跨模块返回恢复同一目标和页签。不能用残留 comparisonRef 代替实际目标状态。

### F04 / P1：保存探索后无法恢复原筛选，对象与对象集可互相矛盾

**证据：浏览器复现。** 搜索“环保”得到 2 个对象，保存探索；随后搜索“银行”，再打开该探索，实际对象集变为 9 个银行相关对象，当前对象仍是“环保测试公司1”。保存内容中的 filters 没有被恢复。

定位：[M07 app.js:1263](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/app.js:1263)、[app.js:1303](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/app.js:1303)。

修复目标：保存/恢复完整探索定义，区分筛选对象集与显式勾选对象集；恢复筛选、当前对象、Lens、时间、图表、展开与视图状态。对象已不存在或已被过滤时应说明并让用户选择，不静默拼接新旧状态。官方保存探索同时保留对象集与可视化/布局设置，这一点可直接借鉴。[R02]

### F05 / P1：缺失值及非数值属性进入数值比较，显示为 0

**证据：浏览器与原函数用例。** M07 打开单位553并进入对比时，“空间位置”“来源编码”作为 3/3 覆盖的共同指标出现，数值表中均为 0。`valueForMetric` 对 null 返回 0；相关检测使用 `Number.isFinite(Number(value))`，也会接受空串和布尔值。

定位：[M07 app.js:1050](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/app.js:1050)、[app.js:1068](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/app.js:1068)。

同类代码风险：时序空点被转为 0；雷达图缺失值贴到中心；偶数样本的中位数取较低的中间值；对比取前 8 个、雷达取前 4 个，但用户无法清楚控制被截取范围。这些是代码审查发现，未全部分别执行浏览器复现。

修复目标：以属性类型和显式数值规则判断可比较性，缺失与 0 严格区分；同指标去重、统一单位；显示有效覆盖数、样本范围及缺失原因。常规图表优先复用成熟库和公共格式化函数，不新增手写统计逻辑。

### F06 / P1：新增模型结果问数与 Agent 未完整使用界面上下文

**证据：代码审查。** 集成层的 `queryRows` 主要对整个场景结果排序，没有将当前对象集/时间筛选实际应用到取数；`queryWorkspacePatch` 又将当前对象改为答案第一行，将时间改为数据截至日期。`agentDrawer` 默认选候选结果第一条，而非当前聚焦对象。上下文栏显示的选择与实际消费可能不同。

定位：[native-module-integrations.js:775](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/integrations/native-module-integrations.js:775)、[第 836 行](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/integrations/native-module-integrations.js:836)、[第 1461 行](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/integrations/native-module-integrations.js:1461)。

范围限定：这是新增模型结果消费路径的缺陷，不等于现有 51 个推荐问题或全部冻结问数页面都不正确。

修复目标：明确“当前对象 / 当前对象集 / 全域”查询范围，默认沿用当前工作状态；生成回答不自动改变全局选中对象，用户点击结果或选择“用这些结果继续分析”时再更新。Agent 解释应默认处理当前对象，并使引用可返回相应证据。[R03][R04]

### F07 / P1：模型报告草稿使用候选结果，但标签可以显示正式结果

**证据：浏览器与代码审查。** 当前上下文为正式结果时点击报告的“将当前上下文加入报告”，得到“结果未就绪 / 当前没有可写入报告草稿的候选结果”。草稿生成函数固定读取 `normalizedSubjects()` 的候选结果默认值，而上下文摘要使用当前模式。

M07 的“加入报告”说明为“把当前视图与证据交给报告中心”，但新增草稿主要保存一段对象/时间上下文标签和候选 Top5 摘要，并未形成图表、分析文本、证据组成的可编辑内容块。这部分是跨模块内容能力缺口。

定位：[native-module-integrations.js:1531](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/integrations/native-module-integrations.js:1531)、[第 1551 行](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/integrations/native-module-integrations.js:1551)、[M07 app.js:93](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/app.js:93)。

修复目标：根据当前模式读取真实存在的结果；加入报告的是当前答案/表格/图表与其证据快照，支持编辑、排序、删除、撤销和预览。既有正式报告目录及阅读能力保留，不把本问题扩大为“所有报告不可用”。

### F08 / P2：决策明细操作在窄屏不稳定可达

**证据：浏览器几何检查与点击。** 1440 宽外层视口下，内部 iframe 为 1000px，表格最小宽度 1120px，操作按钮位于 x≈1161；桌面自动滚动后点击成功。390 宽时容器仅 346px，内容宽 1220px，按钮仍在 x≈1153，且纵向位于初始可见区之外；普通 Playwright 点击在 2200ms 内未完成。

这证明“页面没有横向溢出”不足以保证内部主动作可达；不能据此声称桌面所有操作都不可用。

定位：[M04 注册入口](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/data.js:40)，及证据中的 `.portfolio-decision-table`、`.record-table`、`.screen-stage` 祖先滚动链。

修复目标：桌面表格保留紧凑扫描体验并固定操作区；窄屏改为可展开列表/详情页，主动作可见、可点击，不依靠嵌套横纵滚动寻找按钮。

### F09 / P2：加载失败后仍显示“服务正常”和“正在读取”

**证据：浏览器故障注入。** 中断隔离模型 API 后，Shell 仍显示“服务正常”，M08 同时出现 `LOAD_FAILED` 和“正在读取模型目标”。

定位：[Shell app.js:264](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/app.js:264)。

修复目标：统一 loading/ready/empty/error/cancelled 状态；失败结束加载，保留已有内容/草稿，显示受影响范围和重试入口。不需要为此建设监控平台或 SLA 仪表盘。

### F10 / P2：文案清理隐藏了部分演示数据身份

**证据：代码审查。** Shell 全局替换“演示数据”为“业务数据”、“合成预览”为“结果预览”，而运行数据本身仍可能是 synthetic。其他位置虽保留技术证据，用户在主要视图中仍可能误解结果来源。

定位：[Shell app.js:730](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/app.js:730)。

修复目标：去掉反复出现的工程说明和整屏警告，但保留简短明确的“示例数据/模拟结果”标识及可展开来源。不依赖全 DOM 文本替换掩盖来源，也不增加安全确认。

### F11 / P2：模型确认弹窗缺少一致的键盘与焦点处理

**证据：代码审查。** M08 自建确认弹窗的渲染/事件逻辑没有 dialog 语义、初始聚焦、焦点约束、Escape 关闭及关闭后焦点恢复。M07 的保存使用原生 dialog，应保留其已有机制。

定位：[model-center/app.js:1010](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/model-center/app.js:1010)。

修复目标：统一轻量弹窗/抽屉组件和键盘行为。先减少不必要弹窗，再完善真正需要的少量确认，不以“可访问性改造”为由增加操作步骤。

### F12 / P2：跨模块下钻的对象覆盖不完整

**证据：资源检查与版本自述。** M07 当前 56 个对象中，S003 只有 1 个评估上下文和 3 家企业；Dashboard 可查看 21 家企业结果。因此部分在驾驶舱出现的企业还不能获得同等完整的对象探索体验。

定位：[M07 portfolio.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/modules/m07/resources/portfolio.json)、[OPEN-ISSUES.md:12](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/OPEN-ISSUES.md:12)。

修复目标：现有演示业务结果中可点击的对象都能进入最小可用对象详情；只补用已有数据可以支持的属性、关系和时序，缺失部分显示“暂无”，不另设资源审批作为前置。

## 4. 结构性风险与需继续验证项

M01-M06 通过冻结 v1.1.0 页面加集成层运行，并不是六个原生 v1.3.1 页面。大量挂载、二次渲染、全局文案替换和延迟同步提高了状态分叉及样式覆盖的维护成本。这是由依赖结构推导的风险，不等于所有 iframe 或所有注入逻辑都必须删除。

定位：[data.js:4](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/data.js:4)、[Shell app.js:1043](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/s001-e2e-integration/app.js:1043)。

建议保留稳定嵌入边界，把已发生分叉的上下文、结果选择、格式化、内容回传和常用交互收敛到少数公共模块。只有旧页面阻碍核心交互时，才在新候选目录中替换该业务区域。

以下列入实施前置复核，不列为已经复现的故障：

- M07 复制的是当前 iframe 链接；独立打开后能否回到完整 Shell 并继续跨模块操作，需要补实际新标签页测试。
- 快速切换业务域、对象或结果模式时，较慢的旧请求是否会覆盖新选择，需要补延迟/乱序测试。
- M01/M02 的映射、预览与消费路径需要用用户操作逐步验证，不能仅凭目录和状态卡片判定完成。
- 图谱/地图的拖拽、缩放、触屏选择及密集标签重叠，需要图像可视化复核和真实交互测试。
- 本轮读取所有模块入口，但没有对每个业务域的每个子页做穷举组合测试。

## 5. 应保留的现有能力

- 单一 Shell、统一主导航及首页三域结构；首页已有可点击功能入口，不再把首页重做成营销落地页。
- 已有 `WorkspaceContext` 思路，以及模块内筛选/视图切换不重载 iframe 的实现。
- 问数 51 个推荐问题、业务主题、五步回答反馈、取消能力、既有融资分析图表和单位553行动链路。
- 已实测问数草稿在“问数 → 本体 → 问数”后仍保留，重构不能破坏。
- M07 的发现/探索分层及六个 Lens，原生保存 dialog、对象/关系/时序基础资源。
- M08 的业务目标分组、正式/候选/补充模型区分，以及可用的 Python 编辑、测试和运行能力。
- 既有五个业务域、正式报告与债务风险 21 家企业正式结果；S005 的真实缺失指标继续显示无法评价。
- 已有历史版本和回归基线。不为本次重构修改冻结目录或重置用户已有服务。

## 6. Palantir 借鉴方式

| 原则 | 本地资料/官方依据 | 本原型应如何落地 |
| --- | --- | --- |
| 以业务对象组织工作 | Foundry 2022 说明第 190-213 段；[R01] | 对象详情连接属性、关系、时序、结果、证据与本地业务动作 |
| 筛选必须驱动分析输入 | Speedrun 第 331-337、370-372、423 段；[R03] | 表格、图表、问数和详情共享同一个被解析的对象集/当前对象 |
| 保存的是完整探索 | 系统截图中的搜索、Compare、Save；[R02] | 恢复筛选定义、视图设置和分析上下文；静态演示数据下结果保持一致 |
| Agent 是工作流中的能力 | Agents Guide 第 199-229 段；[R04] | 默认读取当前选择，产生可复用内容，点击引用返回对象/证据 |
| 模型围绕问题及统一评测组织 | Foundry 2022 说明第 227-238 段；[R05][R06] | 先展示问题与业务结果，再比较精确版本和评测口径，代码按需下钻 |
| 预览与输出分开表达 | Speedrun 管道章节；[R07][R08] | 用户能看到输入样本、处理结果及下游使用，不把预览成功冒充完整运行成功 |

这些原则不要求照搬 Palantir 的安全、权限、代码分支审批和生产部署页面。保留对用户理解结果必要的身份信息，减少不产生演示价值的流程负担。

## 7. 整体体验设计

### 7.1 信息架构

不新增平台层级，保留当前主导航与品牌。页面优先呈现可用工作区，每个模块保持“主任务 + 当前选择 + 下一步”三个层次。

- 跨模块层：业务域/建模目标、对象集、当前对象、时间、结果视图、对比参照、来源。
- 模块内层：搜索、页签/Lens、表格排序、展开状态、滚动位置、编辑草稿。
- 技术详情层：模型/数据/语义版本、运行 ID、原始证据，按需展开。

M01/M02 的目录、定义及配置页不强塞与其无关的“当前单个对象/结果模式”工具条；在进入对象预览、资产消费或分析时再显示相关上下文。减少各页面重复的跳转按钮、说明块和状态卡片。

### 7.2 工作上下文规则

沿用现有状态模块，明确业务域和目标引用；不把 `activeObject`、`comparisonRef` 和 `activeScenarioId` 当作互相替代的隐式来源。

- “只是导航”保持已有分析范围；“明确切换业务目标”同时更新目标与兼容上下文。
- 当前对象不属于当前筛选时，应明确显示未选中或提示该对象在筛选外，不能让图表悄悄读取另一个对象集。
- 生成问数回答不会自动重设全局筛选；采用答案中的对象集需要用户明确点击。
- 结果模式切换读取相应包；未运行/无覆盖显示明确空态，不回退到候选、模拟或第一条记录。
- 时间控件区分“观察期”“数据截至”和“预测期”。数据只有时点快照时应显示不支持区间分析，不伪装成已按时间筛选。
- 保存的探索记录定义和视图状态；报告记录可重现的内容/结果快照，两者不能混为一段标题字符串。
- 跨业务域发生不兼容时，以非阻断说明和显式清除/重新选择处理，不引入审批。

### 7.3 分析与动作

标准主线为：

```text
发现对象 / 从驾驶舱下钻
  -> 查看对象与证据
  -> 问数、比较、时序或模型分析
  -> 把当前结果加入报告，或形成原型内行动事项
  -> 查看事项/报告结果
  -> 返回原对象、原筛选和原分析位置
```

不是每次都要经过全部模块。已有正式结果应能直接分析；没有结果时给出就近的准备/运行操作，不要求用户手动走完多层技术生命周期。

### 7.4 视觉与控件规范

- 延续现有品牌，以中性背景、清晰分隔和少量语义色组织工作界面；避免整页单一色调、装饰大卡片和卡片套卡片。
- 表格用于比较，列表用于窄屏扫描，抽屉用于短任务，详情页用于长内容，少用反复叠开的模态框。
- 常用工具用现有图标库和 tooltip；视图用 tabs，模式用分段选择，数值用合适的输入控件。
- 主任务按钮位置稳定，长名称可换行或截断并查看全名，状态变化不挤压布局；字体不随屏幕宽度缩放。
- 主界面使用业务名称、单位和缺失原因；技术缩写与 ID 放入证据区，仍可复制和追溯。
- 统一加载、空结果、失败、取消、已保存、可撤销等反馈；慢操作可取消，错误后保留输入。
- 桌面保持紧凑信息密度，390px 下主操作与关键事实完整可达；不要求在手机上复制完整 Python IDE 体验。

## 8. 模块级实施范围

| 模块 | 计划改动 | 用户可验收的结果 |
| --- | --- | --- |
| Shell / 首页 | 修复上下文状态与返回恢复；收敛重复导航；首页保留三域入口，增加轻量最近工作/继续工作入口 | 打开最近分析回到原对象、目标与页签；无第二套导航、无多余说明屏 |
| M02 数据工程 | 保留来源/快照/管道/资产结构；聚合一个来源的历史快照；在详情中贯通样本预览、处理前后差异、运行状态和下游用途 | 从一个来源可走到管道预览、产出样本、本体消费；不需要新权限/发布审批才能演示 |
| M01 本体管理 | 以对象/关系/指标/动作及下游使用组织详情；字段来源与实例预览相邻；短路径打开具体对象 | 看清业务字段从哪里来、如何被使用，并能从定义进入实例；不只浏览版本卡片 |
| M07 对象探索 | 修正保存/恢复、数值类型、缺失处理和对比范围；补齐已出现对象的详情；使搜索、关系、地图、时序真正共享选择 | 保存探索再打开内容一致；选中节点/数据点能关联表格和详情；无数据 Lens 给出清楚空态 |
| M03 智能问数 | 保留已有问法和分析图；明确范围与模式；推荐问题按上下文筛选；回答产出可继续探索的对象和可加入报告的内容块 | 问当前对象只回答当前对象；证据可点；取消不丢输入；加入报告不只是跳转 |
| M08 模型目标 | 修正目标返回、版本/运行匹配、指标单位和回传；默认路径收敛为选目标/版本、运行比较、查看结果、应用到当前原型视图 | 所选版本对应所见指标；候选/模拟回到原对象；技术操作放到高级区，不成为普通分析前置 |
| M04 决策中心 | 修复窄屏操作区；事项列表/详情/行动表单分工；继承来源对象、证据和建议；减少重复确认 | 从问数/对象发起事项后，列表状态与详情同步更新；本地动作可撤销或关闭；不会伪装外部执行 |
| M05 Agent 应用 | 默认读取当前对象/对象集；任务入口与当前工作关联；输入范围可见；输出包含可操作对象、引用和报告内容 | 解释的是当前选中对象；引用打开对应证据；结果能回到原分析页，能形成报告/事项草稿 |
| M06 报告中心 | 正确选择正式/候选/模拟结果；增加轻量内容块编辑、排序、删除/撤销、草稿恢复、预览和本地导出 | 导出的内容与预览一致；新增块保留来源对象/时间/结果身份；不会因模型未跑而禁止编辑已有分析 |
| Dashboard | 保留五个业务域；统一筛选、指标单位、模式切换及下钻；各图表落到对象集/具体对象 | 指标点击不是无关页面跳转；下钻与返回保存条件；找不到对象时有明确反馈 |

表中 M01/M02 部分属于流程细化与完整性验证，而非已证实每条旧路径都存在故障。实施时先实测已有流程，能保留的直接复用。

## 9. 技术改动边界

建议新增 `designs/prototype-work/v1.3.2/` UX 候选；具体版本名随确认确定。保持 v1.1.0、v1.2.0、v1.3.0、v1.3.1 的历史实现和证据不变，不对历史目录做原地补丁。

沿用现有静态页面与 JavaScript、小型本地模型服务，按修改需要增量建立候选文件，而非整树复制。公共逻辑只收敛到以下必要职责，不建设通用平台 SDK：

| 公共职责 | 内容 | 不做什么 |
| --- | --- | --- |
| Workspace 状态 | 目标/对象集/时间/模式的一次性更新、路由恢复、模块订阅 | 新建一套与当前 Store 并存的全局状态 |
| 对象与结果解析 | 对象 ID 对齐、模式选择、版本/运行匹配、缺失反馈 | 用第一条记录或最新结果静默兜底 |
| 指标表达 | 类型、单位、精度、方向、覆盖、差值、缺失值 | 新造一套统计/图表计算引擎 |
| 内容交接 | 问数/图表/模型结果到报告或事项的结构化内容 | 把所有内容缩减为标题/上下文字符串 |
| 公共交互 | 少量表格/列表、抽屉、弹窗、状态反馈和图标工具 | 新建完整设计系统管理后台 |

iframe 本身不是本轮必须移除的对象。先明确挂载/销毁与输入输出边界，消除重复订阅和后置 DOM 文案替换；对旧页面局部无法修好的工作区，再选择性替换。

新候选使用独立的本地存储命名空间，避免覆盖旧原型探索、草稿和运行状态；使用当前演示数据及必要的最小本地快照。不增加服务端长期存储或真实多人协作。

## 10. 分阶段实施与交付

所有阶段均在本方案确认后开始。阶段顺序用于控制回归风险，不是给用户增加业务门禁。

### 阶段 A：先保证“看的是对的”

范围：F01-F07 的上下文与结果正确性、F09 异常状态，及直接相关测试。

交付：精确结果解析、指标类型/单位规则、目标返回恢复、探索保存恢复、问数/Agent/报告一致取数；在少量核心路径上建立断言对象 ID、模式、版本及数值的回归用例。

完成标准：本报告中的已复现用例均由失败转为正确行为；不会以隐藏按钮或跳过相应功能的方式“修复”。

### 阶段 B：把关键业务工作流做完整

范围：跨模块内容交接、M07 对象覆盖、M06 内容块草稿、M04 本地事项反馈，以及 M01/M02 的输入到消费链路。

交付：五个业务域各一条可从入口走到分析、证据、报告/事项并返回的主线；模型高级实验流程仍可访问，但不要求普通用户手动经过审查、Shadow、Release、Binding 等全部中间步骤。

完成标准：主要按钮都有可见的实际结果；“加入报告”新增内容；“发起事项”产生可回看的本地记录；不把加载动画和成功 toast 当作业务结果。

### 阶段 C：统一交互与视觉，再做整体验收

范围：F08、F10-F12 的体验部分，跨模块组件与文案一致性、键盘、移动端、图表/地图/图谱可读性。

交付：桌面紧凑工作布局、窄屏可达动作、统一弹窗/抽屉/反馈、干净的状态文案、截图对照及真实浏览器全流程证据。

完成标准：完成下一节验收矩阵；给出可访问的新候选入口和已知限制清单，由用户评审体验后决定是否替代当前使用入口。未要求上线或分享时不进行生产部署。

## 11. 验收标准

### 11.1 五条业务旅程

| 业务域 | 必须能通过真实 UI 操作完成的旅程 |
| --- | --- |
| S001 融资 | 驾驶舱成本下钻 → 单位553 → 问数/对比 → 查看证据 → 形成本地行动事项 → 回到原单位与筛选 |
| S002 预算 | 选择年度与单位/项目 → 查看预算/执行/占用差异 → 打开异常对应明细 → 加入报告 → 返回原条件 |
| S003 债务风险 | 从 21 家企业中选择任意一家 → 对象详情 → 选择两个明确模型版本对比 → 返回该企业结果 → 形成报告内容 |
| S004 贷前 | 选择调查主体 → 查看资料/财务/关系及缺失 → Agent 解释 → 点击来源 → 形成可编辑报告/本地复核事项 |
| S005 投后 | 进入已有评价轮次 → 查看各评价域与缺失原因 → 模式切换 → 对象/结果解释 → 报告预览；没有真实证据的指标仍为无法评价 |

### 11.2 功能与数据验收

- 候选和模拟同时存在时，回传严格使用选中的模式；对象不匹配绝不借用其他对象分值。
- 同一模型至少两个版本、多个评测上下文交叉测试，选择、指标、来源与差值完全一致。
- 0、null、空串、布尔、字符串编码、百分比、金额、负数、计数分别测试；缺失值不进入覆盖统计或零值图形。
- 查询只针对选定对象集和支持的时间范围；对不支持的时间粒度明确反馈，不悄悄扩大到全域。
- 保存筛选探索后改变当前搜索，再恢复，应恢复原对象集/对象/Lens/时间/设置；显式选择探索也通过同等测试。
- 浏览器返回、前进、刷新，以及从报告/模型返回探索，恢复正确目标、位置、筛选与草稿。
- 加入报告后，内容块中的对象、数值、单位、时间与来源页面一致；编辑/排序/撤销后预览和本地导出一致。
- 事项创建/更新/关闭后的列表、详情和回看入口一致；仅改变本地原型状态，不调用外部执行服务。
- 五个业务域各自测试首次进入、无结果、部分数据和已形成结果，不以一个顺序执行后的“全就绪”状态代表全部用户。
- 快速切换、双击、取消和请求乱序不会写入重复事项或把旧对象结果覆盖到新对象。

### 11.3 交互与视觉验收

- 在 1440×900、1280×720、390×844 下，用普通 click/键盘操作走完关键路径，不能依靠 force click、改 hash 或直接修改 Store 完成验收。
- 内部容器和关键按钮实际可见、可达；不只断言根页面 scrollWidth。移动端详情与主操作无需寻找多层滚动条。
- 弹窗初始聚焦、Tab 顺序、Escape、关闭后焦点恢复正确；有文字或图标名称，不只用颜色表达状态。
- 加载与失败互斥；错误后可重试，取消后无假成功，输入及已完成内容保留。
- 图表、地图、关系图在桌面/窄屏均有可辨识的内容、单位、图例与选择反馈；截图要实际查看，不能只确认文件生成。
- 不保留无效主按钮、复制无意义 ID 代替证据的入口，或“功能介绍卡”代替实际工作区。
- 当前有效的 17/17 与共享 42/42 测试继续通过，并增加本报告缺陷用例及用户旅程测试。历史完整性检查继续通过。

## 12. 本次需要确认的方案

建议确认以下整套范围后开始实施：

1. 以 **v1.3.1 实际代码**为基础，在新候选中做选择性 UX 重构，保留历史版本。
2. 按 **A 正确性 → B 工作流 → C 交互与视觉**顺序完成本方案，不局限于换样式。
3. 覆盖首页/Shell、M01-M08、五个业务驾驶舱，但复用已有稳定功能和本地运行时。
4. 简化普通用户路径中的审批、实验发布等非必要流程；高级能力保留可下钻，不新增权限/安全/治理体系。
5. 以五个业务旅程、正确对象/版本/数值、报告与行动实际反馈、桌面/窄屏可达性作为验收重点。

**当前未获得实施确认。本轮仅新增本报告与审查证据，应用代码、冻结页面、用户已有服务均未修改。**

## 附录 A：本地参考资料

原目录：`/Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料`。

- [Palantir Foundry 2022 操作系统演示说明.docx](</Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料/Palantir Foundry 2022 操作系统演示说明.docx>)：重点第 190-215、227-265 段。该文档为 2022 演示的历史说明，不用于推断当前产品版本。
- [Palantir_Ontology_Driven_Agents_DevCon2_Core_Guide_CN.docx](/Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料/Palantir_Ontology_Driven_Agents_DevCon2_Core_Guide_CN.docx)：重点第 199-229 段，当前选择、引用回链、应用状态和结构化输出。
- [Palantir_Speedrun_E2E_Workflow_Course_Content.docx](/Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料/Palantir_Speedrun_E2E_Workflow_Course_Content.docx)：重点第 331-337、370-372、423、559-575 段，筛选作用于对象集、详情跟随选择、动作默认对象及结果更新。
- [palantir系统截图.docx](/Users/domi/Library/CloudStorage/OneDrive-个人/Palantir资料/palantir系统截图.docx)：23 张嵌入图片已 OCR，辅助辨认搜索/探索、属性映射、比较、保存和地图图层；没有将 OCR 当作像素级布局判断。

段落编号对应本次 DOCX 原始段落提取编号，不是 Word 页码。原始文件未修改；完整视频内容不在本轮已核实覆盖范围内。

## 附录 B：Palantir 官方参考

以下链接在 2026-09-05 核对。只采用官方产品文档，不以社区帖子作为设计依据。引用用于解释产品原则，不表示本项目必须实现文档中的完整生产能力。

- **R01 Ontology overview**：`https://www.palantir.com/docs/foundry/ontology/overview/`。对象、语义与可操作业务能力的共同基础。
- **R02 Object Explorer / Save explorations**：`https://www.palantir.com/docs/foundry/object-explorer/save-explorations/`。保存对象集及可视化/布局设置；关联数据更新时探索结果可以变化。
- **R03 Workshop / Variables**：`https://www.palantir.com/docs/foundry/workshop/concepts-variables/`。以变量连接对象集、用户选择、图表与过滤结果。
- **R04 Agent Studio / Application state**：`https://www.palantir.com/docs/foundry/chatbot-studio/application-state`。明确上下文值如何随应用状态变化，结构化输出如何返回应用；此为实际可访问的文档路径。
- **R05 Create a Modeling Objective**：`https://www.palantir.com/docs/foundry/manage-models/create-a-modeling-objective`。定义建模目标、输入输出以及用于比较的标准评测。
- **R06 Model evaluation**：`https://www.palantir.com/docs/foundry/evaluate-models/model-evaluation/`。在评测数据集/数据范围内比较模型性能，指标可按用例定义。
- **R07 Pipeline Builder / Build a pipeline**：`https://www.palantir.com/docs/foundry/pipeline-builder/management-build/`。构建产出的输出与运行行为。
- **R08 Pipeline Builder / Preview an output**：`https://www.palantir.com/docs/foundry/pipeline-builder/outputs-preview/`。预览用于查看转换效果，不等价于已构建/部署的完整输出。

对原型的具体界面建议是本次审查据此作出的设计判断，并非 Palantir 官方对本项目的评审结论。
