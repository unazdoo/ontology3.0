# v1.4 未提交修复快照独立复审

## 仍需处理的发现

**本轮结论：原10项中9项的原缺陷验证通过，R14-002部分修复；另发现2项问题。当前P0 0、P1 1、P2 2、P3 0。尚不建议自由提问式客户演示。**

这里的“9项通过”只关闭原问题的明确复现范围，不代表没有关联回归。报告同步新增回归R14-011、复合参数遗漏R14-012单独记录，避免与已修复的小数/结果身份问题混淆。

|编号|严重度|问题|状态|
|---|---|---|---|
|R14-002|P1|未知主体简称仍被忽略，并返回全体21家企业数据|部分修复，仍有可复现遗漏|
|R14-011|P2|联合报告改名保存后，内容块标题和来源快照仍停留在初次生成状态|本轮新增回归|
|R14-012|P2|复合方案只采纳第一个同类参数，后续步骤被静默丢弃|本轮补充发现|

### R14-002 · P1 · 未知主体简称仍被忽略，并返回全体21家企业数据

类别：问数主体识别 / 业务严谨性。模块：经营驾驶舱 → 融资与风险态势 → 同屏问数。

实际页面：`http://127.0.0.1:4414/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard；内嵌 /workbench.html?embedded=1#view=workbench`。

对象：腾讯；中国广核；ENT-001 至 ENT-021。前置：独立浏览器新会话，基准快照，清除筛选显示21家企业；这两个名称均未登记在该工作台的企业名称、ID及别名集合内。

复现步骤：

1. 输入“腾讯的融资余额是多少”，发送并等待答案完成。
2. 滚动问数面板，查看回答及定位结果/加入报告/发起事项入口。
3. 再问“中国广核融资余额多少”，核对答案对象集。

**预期：** 未登记主体或简称必须要求选择已登记对象，或明确拒绝；失败不改变范围，不生成可向下游传播的结果。

**实际：** 两问均返回成功：21家企业、融资余额1,411.24亿元、90天到期847.26亿元，并保留报告和事项按钮。腾讯答案结果ID首次为748c3624-2120-4624-b042-0e28a4118663，中国广核为8b4422e8-8b18-4af9-82c8-04ceeff9e9cc。原“华南环保集团”“不存在的Review企业”和已知/未知混合公司输入现在能正确拒绝，但新校验仍只识别公司、集团、企业或特定ID外形，没有校验剩余主体词。

**用户/业务影响：** 用户可能把整个组合的余额误认为指定公司的数据，并继续形成报告或复核事项。此为原P1根本风险的残留，阻碍自由提问演示。

**本轮证据：** [20-unknown-answer-visible.png](screenshots/20-unknown-answer-visible.png)；[20-unknown-answer-visible.json](logs/20-unknown-answer-visible.json)；[additional-boundaries.json](logs/additional-boundaries.json)；[subject-decimal.json](logs/subject-decimal.json)。

**源码依据（本次固定快照）：** [designs/prototype-work/v1.4/src/domain.js:385](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:385)；[designs/prototype-work/v1.4/src/domain.js:415](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:415)。

**最小修正建议：** 完成主体槽位和整句消费检查后再查询；对于未消费的名称文本拒绝或让用户选择。避免继续仅增加公司后缀正则。

**验收标准：**

- 上述两个简称输入均拒绝或要求明确选主体，范围不变且无报告/事项入口。
- 规范名称、大小写ENT-ID、登记别名仍能正常解析；通用集团/全部企业问题不受影响。
- 已知主体与未知简称混合输入也不能只返回已知部分。

原R14-002精确复现输入通过，但完整主体识别验收未通过。

### R14-011 · P2 · 联合报告改名保存后，内容块标题和来源快照仍停留在初次生成状态

类别：报告同步 / 来源一致性。模块：联合报告 → 原报告内容块编辑器 → HTML导出。

实际页面：`http://127.0.0.1:4414/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/report；联合分析报告及报告目录`。

对象：743ac90e-26ce-4691-8b47-9493b1c8a01c；RULE-OPS-FINANCING-PREMIUM；7家企业/90天/演示基准。前置：从25bp本体规则应用进入态势，7家企业；问数结果加入报告。此时内容块已自动导入，用户尚未修改原编辑器。

复现步骤：

1. 把联合报告标题改为“复审-25bp规则基准报告-改名”，结论改为“独立复审最新结论：这是25bp规则范围的基准报告。”并保存。
2. 点击“在报告中心整理”，再打开原内容块编辑器。
3. 核对4个内容块标题、结论及jointSnapshot；导出HTML。
4. 再次同步同一报告，确认问题仍存在。

**预期：** 用户未在目标编辑器改过的标题应跟随源报告更新；追溯快照应明确对应同一最新草稿或其固定版本。目标端的人工编辑、顺序及删除决定仍受保护。

**实际：** 源报告的title/notes已保存；4个内容块仍显示“企业融资与风险分析报告 · 指标名”，而结论已更新。jointSnapshot.title和notes仍是初次生成的默认标题及97.43亿元等旧摘要。再次同步后仍旧，导出HTML也缺少源报告新名称。后续手工文字、下移及删除可以保留，问题只在源草稿更新与未编辑标题/来源快照同步。

**用户/业务影响：** 多份分析进入汇总草稿后仍使用相同通用标题，用户无法用自己保存的名称定位内容；内容和来源快照呈现不同修订状态，增加复核成本。没有发现数值、方案或已冻结v1被覆盖。

**本轮证据：** [09-report-renamed.png](screenshots/09-report-renamed.png)；[10-native-baseline-title.png](screenshots/10-native-baseline-title.png)；[renamed-report-handoff.json](logs/renamed-report-handoff.json)；[18-resync-edit-protection.png](screenshots/18-resync-edit-protection.png)；[renamed-baseline-native.html](downloads/renamed-baseline-native.html)。

**源码依据（本次固定快照）：** [designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:246](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:246)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:254](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:254)。

**最小修正建议：** 按字段记录是否被人工修改：未编辑标题及对应来源草稿快照随保存更新，人工标题/文字、顺序和删除继续保留。冻结版本维持独立不可变身份。

**验收标准：**

- 首次生成后仅在联合报告改名，原内容块和HTML立即显示新源标题。
- 源notes与来源快照版本一致，或明确标出正在引用的历史版本。
- 目标端手工改过的标题/文字、下移、删除及全删不因同步丢失，v1/v2仍独立。

原R14-008的基准/模拟身份及目录范围已修复；本问题是新增原地同步分支带来的标题/快照遗漏。

### R14-012 · P2 · 复合方案只采纳第一个同类参数，后续步骤被静默丢弃

类别：方案解析 / 不支持输入处理。模块：同屏问数 → 比较方案。

实际页面：`http://127.0.0.1:4414/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard；融资与风险态势`。

对象：8ac24a9b-c25c-42a5-9108-cad1d7402504；78e06d07-0fca-4737-81f5-ce7e2a801829。前置：21家企业基准范围。当前方案表单每种参数仅有一个值。

复现步骤：

1. 输入“如果先降息12.5bp再加息25bp，未来90天到期多少？”。
2. 在成功答案点“比较方案”，查看浮息利率变化。
3. 另问“如果授信收缩12.5%后再收缩20%，未来90天资金缺口多少？”，查看解析参数。

**预期：** 当前不支持分阶段假设时应明确拒绝并要求单次变动；若支持则完整表达各阶段及时间。不允许悄悄采用第一个匹配值。

**实际：** 两问均标成功。第一问只记录rateBps=-12.5，后续加息25bp消失，表单也只显示-12.5bp；第二问只记录creditHaircut=12.5，后续20%消失。正则exec仅取首个值，后续检查只检查有没有匹配，不检查是否有未消费参数。

**用户/业务影响：** 用户看见成功反馈，却得到与输入假设不同的方案；参数确认表有机会发现差异，因此定P2。未保存或执行这些复合方案。

**本轮证据：** [additional-boundaries.json](logs/additional-boundaries.json)；[14-multi-rate-ignored.png](screenshots/14-multi-rate-ignored.png)；[14-multi-rate-ignored.json](logs/14-multi-rate-ignored.json)。

**源码依据（本次固定快照）：** [designs/prototype-work/v1.4/src/domain.js:428](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:428)；[designs/prototype-work/v1.4/src/domain.js:432](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:432)。

**最小修正建议：** 检查同类参数出现次数和剩余文本；多阶段或冲突参数明确拒绝。无需本轮新增多阶段建模功能。

**验收标准：**

- 两个复合输入均提示暂不支持并要求单阶段假设，不生成成功方案结果。
- 单阶段12.5bp/12.5%和整数50bp/30%保持正确解析和计算。
- 重复/冲突的利率、授信和展期参数都有一致处理。

原R14-006小数归零已修复；本项覆盖原测试之外的同类参数重复输入。

## 修复逐项复验

|原编号|本轮判定|实际操作结果|证据|
|---|---|---|---|
|R14-001|通过（原缺陷范围）|合成基准无分数/置信度，不标正式事实；候选/模拟带合成来源；完整模型周期前后基准相同。|[01-synthetic-baseline-no-fact-scores.png](snapshot/outputs/fixes-v1.4/native/01-synthetic-baseline-no-fact-scores.png)；[state.json](snapshot/outputs/fixes-v1.4/model/state.json)|
|R14-002|部分修复|原全称及混合未知主体拒绝；无后缀简称仍忽略，见残留P1。|[subject-decimal.json](logs/subject-decimal.json)；[additional-boundaries.json](logs/additional-boundaries.json)|
|R14-003|通过（原缺陷范围）|双本体入口、25/50bp、编辑验证、应用到地图/问数/报告、草稿发布隔离、旧独立页迁移均实际验证。|[result.json](existing-tests/owned-rules-browser/result.json)；[07-rule25-validation.png](screenshots/07-rule25-validation.png)；[08-rule25-map.png](screenshots/08-rule25-map.png)|
|R14-004|通过（原缺陷范围）|完整T007一致；硬质量故障阻断；恢复后双击重试仅1待办；承接→处理→完成→刷新仍完成。|[result.json](snapshot/outputs/fixes-v1.4/approval/result.json)；[05-completion-persisted.json](snapshot/outputs/fixes-v1.4/approval/05-completion-persisted.json)|
|R14-005|通过（原缺陷范围）|预算3部门明确未映射/0结果，刷新保留并可清除；贷前无旧域ID，不再0条正式成功；模型目标无设备管理部。|[result.json](snapshot/outputs/fixes-v1.4/native/result.json)；[06-preloan-explicit-no-data.txt](snapshot/outputs/fixes-v1.4/native/06-preloan-explicit-no-data.txt)|
|R14-006|通过（原缺陷范围）|单阶段小数正确解析为-12.5bp/12.5%，步长0.1；保存后成本从2.88%变为2.77%。复合参数新问题单列R14-012。|[subject-decimal.json](logs/subject-decimal.json)；[03-decimal-form.png](screenshots/03-decimal-form.png)；[04-decimal-plan-saved.png](screenshots/04-decimal-plan-saved.png)|
|R14-007|通过（原缺陷范围）|集团推荐答案、详情、实际CSV包含21,613.387亿元及2.372231%。|[02-group-answer-balance-and-cost.png](snapshot/outputs/fixes-v1.4/native/02-group-answer-balance-and-cost.png)；[group-query.csv](snapshot/outputs/fixes-v1.4/native/group-query.csv)|
|R14-008|通过原身份/保护问题；有新增回归|基准demo与具名simulation一致；文字、顺序和删除经再次同步保留；改名/来源快照遗漏单列R14-011。|[renamed-report-handoff.json](logs/renamed-report-handoff.json)；[plan-revision-native.json](logs/plan-revision-native.json)；[plan-v1-v2-native.html](downloads/plan-v1-v2-native.html)|
|R14-009|通过（原缺陷范围）|实际累计30条，经加载按钮全部可达；刷新仍30条；旧基准和旧模拟答案恢复自身对象、窗口与方案。|[history-check.json](logs/history-check.json)；[21-thirty-history.png](screenshots/21-thirty-history.png)；[22-thirty-history-refreshed.png](screenshots/22-thirty-history-refreshed.png)；[23-old-simulation-restored.png](screenshots/23-old-simulation-restored.png)|
|R14-010|通过（原缺陷范围）|空范围暂无数据，无暂无%/NaN；恢复后有效百分比正常；四尺寸取样。|[05-empty-cost.png](screenshots/05-empty-cost.png)；[06-empty-1280.png](screenshots/06-empty-1280.png)；[06-empty-390.png](screenshots/06-empty-390.png)；[06-empty-320.png](screenshots/06-empty-320.png)|

## 输入快照与隔离

本轮只读输入来自 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`，分支 `codex/prototype-v1.3.1-composite`。其HEAD为 `0eed1d6322631d6fcdeca6fb1c23d01a5d5ee9ca`，v1.4是未跟踪、未提交内容，HEAD不代表本轮修复。

按用户明确提供的实施目录建立新快照于 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/snapshot`。记录111个v1.4文件指纹，复制时与输入一致；运行依赖在快照内安装。未覆盖`ba4d6b67`目录业务代码，没有修改实施目录、提交、合并或部署。原review及旧快照复测报告保留。

主审查从独立`http://127.0.0.1:4414/`进入Shell，配套4412/4413；独立Chrome会话`review-v14-fixed-20260908`。既有回归脚本也在本次快照内新启临时端口和浏览器上下文，输出在本目录内的snapshot/outputs或existing-tests，未复用实施窗口63312及主窗口4382/4383/4392/4393/4394服务。

修复方FIX-REPORT仅用于定位，不作为本次结论。副本见[IMPLEMENTATION-FIX-REPORT.md](logs/IMPLEMENTATION-FIX-REPORT.md)。逐文件快照见[snapshot-manifest.json](logs/snapshot-manifest.json)，差异见[implementation.diff](logs/implementation.diff)。最终[source-integrity.json](logs/source-integrity.json)确认实施源码未变、快照业务源码未被本轮测试修改，45条父版本指纹一致。

## 实际闭环与无发现范围

- 原审批链：环保测试公司2 `S003-ENT-018` → 修改负责人及原因/日期 → 注入质量硬失败，无决定/待办 → 恢复后重试 → 单个待办 `TD-8830646743` → 承接 → 开始处理 → 完成 → 刷新。接收、确认、待办门均使用完整T007，历史故障回执保留。此为本地原审批记录，不代表真实外部执行。
- 本体链：S001与S003所属本体修订入口 → 原规则编辑器 → 25bp/50bp或缺口验证 → 地图 → 问数 → 报告保留同一规则/草稿/数据身份。已发布定义未被草稿覆盖，旧独立规则入口迁入所属本体。
- 报告链：小数方案保存 → 问数固定快照 → 切基准及180天后恢复旧30天方案答案 → 报告v1 → 复核冻结 → 独立v2 → 原编辑器 → 具名方案HTML。v1、v2各4块，结论独立；早先基准报告手工文字、排序、删除重同步后保留。源标题/来源快照更新的新增缺陷见R14-011，不能把这条链当作报告全部通过。
- 模型链：投后数据构建/质量/冻结 → 模型合同 → Benchmark/Challenger → 洞察审查 → 不可变候选 → 3个影子窗口 → 复评 → Release Candidate → 消费绑定校验/人工确认 → 驾驶舱候选与模拟。前后演示基准相同、无正式评分，候选/模拟带合成来源，不提升为正式事实。
- 历史恢复：本轮真实输入累计30条问数，加载更早记录后可访问全部30条，刷新仍可访问。旧答案使用自己的窗口/方案，不套用当前假设。
- 数据链：原资产目录 → 84笔借款5页（20/20/20/20/4）→ 实际Excel下载。逐字段核验11表/9资产/300记录无差异；40,094字节、SHA-256与登记一致。503及同长度损坏文件均被阻断且允许恢复重试。

未发现问题只限以上实际动作：明确未知全称拒绝；单阶段12.5bp/12.5%保存及计算；本体两个交接函数；原审批质量阻断/恢复幂等；预算未知映射显式提示；原融资问数余额与成本输出；基准与具名模拟标识；手工报告编辑保护；30条历史；缺失百分比格式。

## 自动检查、独立计算与限制

- 本轮`npm ci`成功，`npm test`108/108，`npm run build`成功，仅保留既有大包体积提示。未因测试全绿而停止独立边界操作，本轮残留/新增问题未被该测试集覆盖。
- 原审批、原问数/跨域、模型周期、本体规则专项均为本次快照中新执行，见[approval-run.log](logs/approval-run.log)、[native-run.log](logs/native-run.log)、[model-run.log](logs/model-run.log)、[rules-test-run.log](logs/rules-test-run.log)。
- 快照浏览器专项首次8条通过，最终窄屏返回地图等待12秒超时（记录显示map-ready=true、无pageerror）。原始失败证据保留，不能说首次套件全通过。关闭主审查浏览器后串行重跑全部10条通过，见[串行重试](existing-tests/serial-retry/cockpit-snapshot-browser/result.json)。该次超时归为并行运行下的等待不稳定，不据此认定业务功能缺陷。
- 独立Decimal核算本金141,124百万元、加权成本2.4566589722%、90天到期84,725.80百万元、逐企正缺口33,864.784百万元，与页面舍入结果相符。实下Excel与9资产全部字段、84借款UI分页比对无差异，见[download-validation.json](logs/download-validation.json)。
- 主会话在1440×900进行操作，1280×720、390×844、320×844检查空范围、数值及窄屏资产；审批详情和规则相关视口由本轮新运行专项留证。主会话无产品pageerror；iframe切换中引用失效、局部动作等待超时为控制脚本记录，不混入产品发现。

本轮未穷举所有页面、所有业务措辞、全部模型代码运算/编辑发布、角色权限、多人/跨设备持久化、真实银行或消息执行。五业务域涉及本次修复的代表路径已检查；未重做所有未变化的Agent配置、正式报告全文核验及M07每个Lens。原D01/D02设计建议和B01投后实际覆盖、B02每域汇总草稿策略仍保留，均不计入当前缺陷数。

## 演示判断

本轮修复已消除原审批和本体入口的现场阻断，固定路径演示明显更完整。未知主体简称仍会静默返回全组合数据，属于误导判断的P1，应在自由提问演示前修复。复合参数输入及报告改名同步也需按本报告验收；不能采纳修复报告“没有遗留本次P1/P2/P3”的整体结论。

业务源码保持原样，所有测试状态和故障模拟隔离于本轮服务/浏览器。清理与完整性最终核验见[final-qa.json](logs/final-qa.json)。
