# v1.4 后续修复独立复审

## 发现（按严重度）

**上轮3项（R14-002/011/012）在本轮复现范围内通过。补查发现P1 1项、P3 1项；P0/P2为0。** 当前仍有会改变业务对象范围的问数逻辑问题，不建议把原型视为自由问数已完整验收。

|编号|严重度|问题|
|---|---|---|
|R14-013|P1|“或”条件被按“且”执行，漏掉12家应纳入的企业|
|R14-014|P3|报告金额直接显示二进制浮点长尾，HTML导出同样未格式化|

### R14-013 · P1 · “或”条件被按“且”执行，漏掉12家应纳入的企业

类别：筛选语义 / 业务范围与决策严谨性。模块：经营驾驶舱 → 融资与风险态势 → 同屏问数。

页面：`http://127.0.0.1:4424/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard；内嵌/workbench.html?embedded=1#view=workbench`。

对象：ENT-001至ENT-021；e96be55b-51d5-4d7b-8e1f-f779f4c9f4e7。前置：基准快照、90天窗口、清除全部筛选；高成本沿用当前默认定义：融资成本偏离>0bp。

复现步骤：

1. 从独立服务/进入Shell，打开经营驾驶舱的融资与风险态势。
2. 清除筛选，确认21家企业、基准快照、90天。
3. 输入“找出高成本或有资金缺口的企业”，等待回答，滚动查看结果。
4. 比较答案对象集与逐企满足“成本偏离>0bp 或 缺口>0”的并集；对照“且”表达。

**预期：** 按“或”计算并集；如不支持该组合，明确拒绝并保持原范围，不得形成成功结果。

**实际：** 整句校验接受“或”，但解析只设置highCost=true和gapOnly=true，过滤器固定用&&连接。浏览器显示成功、9家企业、余额119.55亿元、到期72.89亿元、缺口29.55亿元，结果与“且”相同。本快照实际并集为21家，漏掉12家；ENT-007虽然不是高成本企业，但缺口28105百万元（281.05亿元），应被“或”纳入却被排除。ENT-020成本偏离23.0984bp、缺口0，也被排除。

**用户影响：** 错误范围会低估需要关注的融资和资金缺口；成功答案可继续加入报告/发起事项。本轮已实际把该9家结果交入报告，证明错误范围可以传播。属于影响业务判断的P1。

**本轮证据：** [05-or-filter-result.png](screenshots/05-or-filter-result.png)；[05-or-filter-result.json](logs/05-or-filter-result.json)；[or-filter-browser.json](logs/or-filter-browser.json)；[or-filter-omissions.json](logs/or-filter-omissions.json)；[logical-filter-calculation.json](logs/logical-filter-calculation.json)。

**源码依据（本轮固定副本）：** [designs/prototype-work/v1.4/src/domain.js:368](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:368)；[designs/prototype-work/v1.4/src/domain.js:470](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:470)；[designs/prototype-work/v1.4/src/domain.js:310](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot/designs/prototype-work/v1.4/src/domain.js:310)。

**最小修正建议：** 在解析结果中保留条件的连接语义并执行一致；若当前仅支持条件交集，检测到此类“或”组合时明确拒绝。无需为此引入开放式问答或整体重构。

**验收标准：**

- 本快照同样前置下，“或”返回21家（包含ENT-007/020）；“且”返回9家。若不支持“或”，应拒绝且范围/方案/窗口不变。
- “或”的报告与事项沿用正确并集；拒绝答案无报告/事项按钮。
- 已登记多主体选择、单条件筛选、未知主体拒绝和单阶段参数保持可用。

上轮R14-002/R14-012的精确复现已通过；本项是相邻语义范围问题，不把它描述为这次修复必然新引入。

### R14-014 · P3 · 报告金额直接显示二进制浮点长尾，HTML导出同样未格式化

类别：报告可读性 / 数字格式。模块：联合报告 → 原内容块编辑器 → HTML导出。

页面：`http://127.0.0.1:4424/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/report；原报告内容块编辑器`。

对象：ENT-004；ENT-005；ENT-011；fbfbbdf8-f167-4b89-b4b3-5a9d0a172f7d。前置：选择本轮9家成本/缺口交集或其他包含上述企业的90天基准报告。

复现步骤：

1. 将当前结果加入报告，再进入原内容块编辑器。
2. 滚动到“窗口到期本金”和“测算资金缺口”内容块。
3. 查看风电测试公司04/05/11的金额，并导出HTML。

**预期：** 按金额及指标的约定精度显示数值，UI与HTML保持一致；源数值可以保留原计算精度。

**实际：** 窗口到期本金显示“7.1610000000000005 亿元”；缺口还出现“1.4080000000000001”和“5.837999999999999”。导出HTML包含相同长尾。交接时直接以Number除以100，编辑器再将数值转成字符串，没有金额显示格式。

**用户影响：** 增加财务人员阅读和核对负担，报告观感不可信。观察到的是浮点显示误差，未据此认定实际金额计算错误或提升为数据损坏。

**本轮证据：** [08-raw-currency-decimals.png](screenshots/08-raw-currency-decimals.png)；[08-raw-currency-decimals.json](logs/08-raw-currency-decimals.json)；[renamed-source.html](downloads/renamed-source.html)。

**源码依据（本轮固定副本）：** [designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:303](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:303)；[designs/prototype-work/v1.4/composite/shared/report-editor.js:9](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot/designs/prototype-work/v1.4/composite/shared/report-editor.js:9)。

**最小修正建议：** 在统一展示层按金额/利率等指标分别应用约定精度和缺失处理；HTML复用相同格式，不修改原始计算值。

**验收标准：**

- 同一金额在编辑、预览和HTML中无浮点长尾，仍正确标注亿元。
- 金额与百分比使用各自约定精度，零和缺失仍可区分。
- 源快照/数据精度不因显示格式发生变化。

与这轮标题同步是不同问题；本轮在实际非零到期/缺口数据中观察到，未断言由本次修改引入。

## 上轮问题复验

|编号|判定|实际结果|证据|
|---|---|---|---|
|R14-002|通过（本轮复现范围）|腾讯、中国广核及ENT-020与腾讯混合输入全部拒绝；三个拒绝均无结果操作，筛选/方案/窗口不变；单位553正确解析到ENT-020。|[question-retest.json](logs/question-retest.json)；[rejection-invariants.json](logs/rejection-invariants.json)；[03-questions.png](screenshots/03-questions.png)|
|R14-012|通过（本轮复现范围）|先降息再加息、两次授信收缩、两次展期均拒绝，状态不变；单阶段-12.5bp/12.5%/30天正确进入表单。|[question-retest.json](logs/question-retest.json)；[04-decimal-form.png](screenshots/04-decimal-form.png)|
|R14-011|通过（本轮复现范围）|源标题/结论A同时更新4块和jointSnapshot；源B同步时人工标题/结论分别保留，顺序和删除保持；删除后撤销恢复3块；v1冻结、v2独立新增4块且v1字节相同。全删后再次同步和刷新仍0块。|[source-native-sync.json](logs/source-native-sync.json)；[per-field-update.json](logs/per-field-update.json)；[frozen-revision.json](logs/frozen-revision.json)；[renamed-source.html](downloads/renamed-source.html)；[frozen-v1-revised-v2.html](downloads/frozen-v1-revised-v2.html)；[delete-all-check.json](logs/delete-all-check.json)|

## 输入、隔离与覆盖

只读读取 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0` 的未提交v1.4目录。分支 `codex/prototype-v1.3.1-composite`，HEAD `0eed1d6322631d6fcdeca6fb1c23d01a5d5ee9ca` 不代表本次修复。新快照 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/followup-review-20260908/snapshot` 中116个被记录的v1.4文件与实施目录一致；继承依赖来自上一轮保留副本，本轮另核对45条父版本指纹。

变化共13个文件：8个产品文件，5个测试文件。除了主体/参数/报告同步，还包含嵌入导航样式与服务装配调整，详见[change-list.json](logs/change-list.json)和[implementation.diff](logs/implementation.diff)。

主会话使用独立4424/4422/4423服务和Chrome会话review-v14-followup-20260908，从/进入Shell。未操作实施目录预览52958/56652、主窗口端口或用户浏览器记录。业务源码未修改，无提交/合并/部署，原审查报告保留。

先阅读修复说明和源码，再以本轮点击、输入、滚动、保存、删除、撤销、刷新、下载核验；实施方测试及截图仅作线索。原说明副本见[后续修复](logs/implementation-followup-20260908.md)和[导航调整](logs/implementation-navigation-paint.md)。

本轮已验证的有限闭环：

- 已登记别名问数 → 1家企业ENT-020 → 单阶段小数参数表单；未知简称/混合名称和复合参数拒绝不改变原范围/方案/窗口。
- 问数结果 → 报告改名A及结论A → 原内容块/来源快照/实际HTML一致 → 分别人工修改标题和结论、排序、删除 → 源改名B及结论B → 仅未编辑字段同步 → 删除/撤销 → v1复核冻结 → 独立v2和HTML导出，v1块不变。这里认可操作和状态连续性；作为输入的OR结果本身存在R14-013，不能被解释为正确业务结论。
- 1440×900操作，1280×720、390×844、320×844报告编辑器取样，导出入口可达。九模块新增导航适配进行稳定显示检查，结果见[navigation-check.json](logs/navigation-check.json)。

对应无发现范围：上述原3项的明确复现、正常别名、单阶段小数、人工字段保护、标题/来源更新、冻结修订均未再发现原问题。未把这些通过扩大为任意自然语言或全部模块功能通过。

## 验证命令与不确定性

- 本轮在复制的v1.4目录运行`npm test`：116/116；`npm run build`成功，有既有大包体积提示。日志为[npm-test.log](logs/npm-test.log)、[build.log](logs/build.log)。未直接照搬修复方的通过记录。新增OR边界未被116项测试覆盖。
- OR核对在浏览器保存全体21行指标后，独立对每行执行“premium>0 || gap>0”，并与实际答案ID逐项对照；缺失12家详见[or-filter-omissions.json](logs/or-filter-omissions.json)。另以源码正常“且”路径做对照，二者当前同为9家，见[logical-filter-calculation.json](logs/logical-filter-calculation.json)。
- 首次白图经浏览器清单确认位于about:blank，不计为原型白屏。独立入口重新打开后Shell及态势有内容；加载时序、旧frame引用、局部等待和控制脚本操作交错导致的中间失败只保留在日志，未包装成产品缺陷。相应结果只以完成后重测证据计入。
- 本轮未运行逐帧延迟图片的导航专项，稳定显示检查不等于首帧闪现完全验收；未穷举全键盘/读屏、所有业务表达、旧存储迁移、权限、多用户、全部M07 Lens/模型运算或原审批完整链。旧字段迁移主要由本轮单元回归覆盖。上一轮未改路径的通过记录仍仅属于上一轮，不记成本轮新闭环。

## 演示判断

上轮三个已知问题在所测路径中确实消除。当前需先处理R14-013，或明确拒绝不支持的逻辑连接，才能避免用户在正常业务筛选中遗漏高缺口企业。报告金额长尾属于较轻的展示问题，可独立修正。

原D01/D02设计建议、B01真实投后数据覆盖及B02每业务域汇总草稿策略继续保留；不因用户说“已修复”而推断这些业务决定已完成。最终源码及服务隔离核验见[final-qa.json](logs/final-qa.json)。
