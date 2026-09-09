# v1.4 两项修复复审与M07功能审查

## 发现（按严重度）

**R14-013、R14-014在地图降级模式下通过本轮业务复测；正常WebGL仍未验收。M07补查发现P1 1项、P2 2项，P0/P3为0。**

M07可以完成对象调查与报告交接，但比较功能的业务口径和时间说明需要修正。详细使用逻辑另见[M07-USER-GUIDE.md](M07-USER-GUIDE.md)，不是仅有测试步骤。

|编号|严重度|问题|
|---|---|---|
|R14-015|P1|融资成本与短期债务占比被混成同一“共同指标”|
|R14-016|P2|选择无观测区间后，比较页仍沿用旧静态值却标注新时间范围|
|R14-017|P2|默认关系节点重叠导致点选串到相邻对象，中心说明也不一致|

### R14-015 · P1 · 融资成本与短期债务占比被混成同一“共同指标”

类别：M07 指标可比性 / 业务口径。页面：`http://127.0.0.1:4434/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/m07 → 探索工作台 → 对比分析`。

对象：ENT-020；ENT-017；property:ruleMetricValue:%。前置：对象发现选择企业，搜索环保，勾选环保测试公司4和环保测试公司1后进入探索。

复现步骤：

1. 切换到对比分析，选择“规则指标值（%）”。
2. 查看条形/点图的数值，点图的中位数；再切到雷达图。
3. 继续分析→加入报告，查看生成的数据并导出HTML。
4. 与两家对象全貌的“规则指标”和原资源定义核对。

**预期：** 只有业务含义、单位、时间和口径兼容的指标可以进入同一比较。不同规则的数值不能仅因同一属性键和单位相同就计算排序/中位数或混入雷达轴。

**实际：** 公司4的ruleMetricValue=2.880984%表示平均融资成本；公司1的93.545164%表示短期债务余额占比。两者被列为“规则指标值（%）·2/2共同指标”，点图计算中位数48.21%，雷达也自动使用该轴。报告实际导出仍有“公司4/规则指标值”和“公司1/规则指标值”两行，不能识别两个业务指标的区别。

**用户影响：** 可能把短债结构压力与融资利率作高低比较，形成错误的企业优劣或风险判断，并传播到报告。不是小数精度问题。

**证据：** [07-comparison-controls.json](logs/07-comparison-controls.json)；[08-incompatible-rule-metric.json](logs/08-incompatible-rule-metric.json)；[09-radar.json](logs/09-radar.json)；[incompatible-metric-source.json](logs/incompatible-metric-source.json)；[m07-report-transfer.json](logs/m07-report-transfer.json)；[m07-comparison.html](downloads/m07-comparison.html)。

**源码依据（本轮固定副本）：** [designs/prototype-work/v1.4/composite/modules/m07/app.js:1106](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1106)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1125](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1125)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1173](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1173)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1920](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1920)。

**最小修正建议：** 按稳定Metric身份/实际业务定义匹配可比指标，而非仅按属性键及单位。对ruleMetricValue等泛化容器，缺少相同定义时排除或明确分组；图表及报告使用相同检查。

**验收标准：**

- 两家企业不再形成共同的“规则指标值”排序、中位数或雷达轴。
- 平均融资成本2.880984%与2.22838%仍可正常比较；风险评分也保持可比。
- 报告中每个指标名称与来源定义一致，不再把不同口径聚合为同一名称。

归属说明：M07文件与上一轮副本相同，本项为本轮深入操作发现，不断言由本次两项修复新引入。

### R14-016 · P2 · 选择无观测区间后，比较页仍沿用旧静态值却标注新时间范围

类别：M07 时间范围 / 解释与反馈。页面：`http://127.0.0.1:4434/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/m07 → 时序分析 / 对比分析`。

对象：ENT-020；ENT-017；2025-12-31快照；2026-01-01至2026-08-15。前置：两家环保企业的融资及正式风险系列均为2025-12-31单次观测。

复现步骤：

1. 在时序分析把开始日期改为2026-01-01，结束日期保留2026-08-15。
2. 确认融资余额、融资成本、风险系列均显示“无观测”。
3. 切到对比分析，选择风险评分；查看图表日期与数值。

**预期：** 所选区间没有观测时，不得让旧快照值看起来属于该区间。允许保留静态属性，但必须同时显示真实截至日及“不受区间筛选影响”，与区间序列清楚区分。

**实际：** 时序页明确显示当前范围无观测；比较页仍使用23.05/30.52等2025-12-31静态属性，图表却标注2026-01-01至2026-08-15。属性比较不检查时间，系列比较检查时间，用户无法从同一时间栏判断哪些指标受筛选影响。完整时间范围下还存在属性/系列同名融资余额选项。

**用户影响：** 容易把旧快照当作当前所选期间结果，降低跨期比较及导出材料的可靠性。没有发现该操作重算或篡改源值。

**证据：** [13-temporal-no-observation.json](logs/13-temporal-no-observation.json)；[14-comparison-outside-snapshot.json](logs/14-comparison-outside-snapshot.json)；[15-current-period-old-risk.json](logs/15-current-period-old-risk.json)；[incompatible-metric-source.json](logs/incompatible-metric-source.json)。

**源码依据（本轮固定副本）：** [designs/prototype-work/v1.4/composite/modules/m07/app.js:1115](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1115)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1125](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1125)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1206](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1206)。

**最小修正建议：** 给属性和序列指标显示不同来源类型/截至日；静态属性与当前区间不一致时明确提示，或仅允许区间内的对应观测参加时间比较。

**验收标准：**

- 所选2026区间下，2025快照不能无提示地显示为区间结果。
- 静态快照/区间最新观测的同名选项可区分，报告带真实截至日。
- 信息科技费用筛到2025-03-31仍能显示实际观测25.3%，不会把年末105.4%套入一季度。

归属说明：M07文件与上一轮副本相同，本项为本轮深入操作发现，不断言由本次两项修复新引入。

### R14-017 · P2 · 默认关系节点重叠导致点选串到相邻对象，中心说明也不一致

类别：M07 关系图可操作性 / 状态理解。页面：`http://127.0.0.1:4434/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/m07 → 关系网络`。

对象：ENT-020；financing::s001.loanbook.553；financing::s001.owner.001。前置：1440×900，环保公司4为图的中心；初始6节点5关系，原对象集包含公司4/公司1。

复现步骤：

1. 切关系网络，观察左上相邻的融资明细集合和负责人节点。
2. 点击融资明细圆心位置，核对上方当前对象和左侧对象集。
3. 对照图中“中心对象”与标题“以…为中心展开业务关系”。

**预期：** 节点圆心及标签有可区分的点击区域；选择哪个对象应清晰可预期。图中心与当前选择不同，应分别命名。

**实际：** 两个节点圆形和文字重叠。本轮两次对融资明细节点区域的鼠标点选均选到负责人001，对象集随之从2变3。截图中标题写“以负责人001为中心”，图上中心对象仍是环保公司4。通过明细节点的加号可展开到9节点8关系，但不能消除默认点选的歧义。

**用户影响：** 容易误选、意外扩大范围，并把负责人带入只接受企业的模型；本轮M08随后明确拒绝含负责人的混合集合。用户不易判断是数据范围还是模型发生问题。

**证据：** [07-current-m07.png](screenshots/07-current-m07.png)；[18-selected-loanbook.json](logs/18-selected-loanbook.json)；[19-expanded-loanbook.json](logs/19-expanded-loanbook.json)；[28-model-handoff.json](logs/28-model-handoff.json)；[browser-actions.jsonl](logs/browser-actions.jsonl)；[browser-results.jsonl](logs/browser-results.jsonl)。

**源码依据（本轮固定副本）：** [designs/prototype-work/v1.4/composite/modules/m07/app.js:878](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:878)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:727](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:727)；[designs/prototype-work/v1.4/composite/modules/m07/app.js:1254](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/outputs/review-v1.4/m07-review-20260909/snapshot/designs/prototype-work/v1.4/composite/modules/m07/app.js:1254)。

**最小修正建议：** 为节点及文字加入最小间距/碰撞处理，确保圆心命中自身；图标题区分“关系中心”和“当前节点”，集合增加时给出明确反馈。

**验收标准：**

- 1440/1280及窄屏下，明细和负责人节点不重叠，分别点击各自圆心能选对对象。
- 选中相邻节点时标题与中心标识不矛盾。
- 选择集合外节点后集合数量变化可见，交接前能识别混入的对象类型。

归属说明：M07文件与上一轮副本相同，本项为本轮深入操作发现，不断言由本次两项修复新引入。

## 上轮两项复验

|编号|结果|实际验证|证据|
|---|---|---|---|
|R14-013|通过（地图降级模式下的业务核验）|或/或者/OR三个输入均拒绝，范围、活动方案、窗口及报告/事项数量不变；答案无下游操作。并集仍未实现，不把拒绝称作并集功能完成。|[or-fix-retest.json](logs/or-fix-retest.json)；[29-or-fix-fallback.json](logs/29-or-fix-fallback.json)|
|R14-014|通过（编辑/预览/实际HTML，地图降级模式）|编辑与预览数值相同；HTML含7.161、1.408、5.838亿元且无原长尾。源rows/jointSnapshot未改变。|[format-fix-retest.json](logs/format-fix-retest.json)；[format-download-validation.json](logs/format-download-validation.json)；[formatted-report.html](downloads/formatted-report.html)|

“拒绝OR”是当前功能边界，**并集尚未实现**。不以业务拒绝成功宣称自由自然语言已全部支持；不以降级模式成功宣称正常WebGL已通过。

## 本轮确认的使用逻辑与闭环

- 对象发现的类型/文本/质量筛选→预览→勾选2家→探索工作台；点行预览、勾选对象集、当前对象三个状态确实不同。
- 公司4对象全貌的属性/关系/事件/证据四分区实际可用。红灯23.05分与“资源可用”并存，是不同维度，不判为数据质量错误。
- 关系图从6节点5关系展开到9节点8关系；点击外部负责人使集合2变3，随后模型明确拒绝混合类型。操作可以追溯，但节点重叠有R14-017。
- 预算时序把结束日改为2025-03-31得到25.3%实际季度观测；企业单快照移到2026区间得到无观测。持仓B存在79个快照系列，区间内显示实际观测。
- 保存探索→重新加载→打开已保存记录，范围与视图恢复；完整平台链接已复制。保存是配置与数据引用，不是不可变数据备份；未在另一台机器打开测试链接。
- M07比较→报告中心→实际HTML下载→返回来源，保留对象、Lens、时间和来源。问数/驾驶舱入口保留持仓B及4持仓范围；M08目标接收返回位置。没有把入口交接称为全部下游计算闭环。

以上限定路径中，除所列问题，未发现对象发现空结果困住用户、已验证保存记录丢失、报告交接丢掉返回位置或资源缺失被补成0。没有对未覆盖路径作“无问题”结论。

## 环境、证据和自动检查

实施输入：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`，分支`codex/prototype-v1.3.1-composite`，HEAD`0eed1d6322631d6fcdeca6fb1c23d01a5d5ee9ca`不包含未提交修复。本轮复制118个v1.4文件并逐文件记录指纹；继承依赖只读复用本工作区已保存副本。变化仅两处产品文件及两个新测试，M07自身未变化。

服务使用独立4434/4432/4433。未修改实施目录业务源码、未提交、未合并、未部署；不使用实施方50540预览或主窗口4382/4383/4392/4393/4394服务。指南和新证据在本次子目录，旧报告保留。

- 本轮实际`npm test`为120/120；`npm run build`成功，有既有大包体积提示。测试日志不是实施方旧记录，见[npm-test.log](logs/npm-test.log)、[build.log](logs/build.log)。
- agent-browser会话报忙/无响应；CUA隐藏标签启动超时；普通Chrome导航等待超时。专用Headless Shell记录CVDisplayLinkCreateWithCGDisplay错误。本轮随后使用独立CDP进程、实际鼠标操作及100ms状态轮询推进，匹配Chromium153安装在本输出目录内。环境/工具失败没有当作产品缺陷。
- 取得的真实屏幕文件见screenshots/，未取得的截图不作视觉通过依据。前半段使用Headless Shell旧版本完成部分SVG操作，后半段切到匹配版本继续相同快照；会话状态均来自本轮实际操作。手动BeginFrame尝试失败，没有据此产生虚构截图。
- 正常WebGL尝试未得到完整就绪，见[normal-webgl-attempt.json](logs/normal-webgl-attempt.json)。随后只对审查会话中/workbench.html模拟WebGL不可用，走“地图暂不可用”的既有路径。M07地图为SVG，该注入不应用到M07。
- 金额格式独立核验编辑/预览数组一致、源行和jointSnapshot未改变、HTML有7.161/1.408/5.838且无原长尾，见[format-download-validation.json](logs/format-download-validation.json)。

## 覆盖与尚未完成

完整矩阵见[COVERAGE.md](COVERAGE.md)。六种M07视图均实际进入；发现、全貌、关系展开、预算/持仓时序、地图状态、三种比较图、保存恢复和四个交接入口有本轮证据。1440实际截图，1280/390/320在预算时序取DOM、控件和页宽证据；完整逐屏截图链未完成。

未完成：正常驾驶舱WebGL完整渲染；每个Lens的所有键盘/屏幕阅读器检查；关系折叠/缩放的完整视觉回归；复制链接跨机器打开；M08运算及候选结果返回M07全链；所有问数/驾驶舱下游结果；多用户、权限、生产数据接入；其余原模块的全量重验。未验证内容不计通过。

## 使用建议与业务确认

设计建议（不计缺陷数）：把“进入探索”与“继续分析”的职责写清；显示对象集/当前对象/图中心的差异；把“前8个”的集合截取逻辑和“质量≠风险”解释放在近处。具体操作与可用替代路径已写进使用指南。

待业务确认：静态快照是否允许不随时间范围变化；不同来源的比较精度和优劣方向；每域汇总报告的产品策略。本报告没有代替业务方决定，但当前界面必须把实际口径说清。

演示判断：可以按指南演示对象发现、全貌、同口径比较、保存与报告交接；关键决策前应避免通用规则值混比，并核对真实数据截至日。R14-015属于可能误导判断的P1，建议修复后再做自由组合的比较演示。源码及环境收尾见[final-qa.json](logs/final-qa.json)。
