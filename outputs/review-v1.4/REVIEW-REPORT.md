# v1.4 原型独立 Review 报告

本轮结论：存在阻碍无脚本客户演示的核心问题。P0 0项、P1 5项、P2 4项、P3 1项。可演示已限定范围的本地分析闭环，但不能宣称本体治理、原审批链及跨业务域分析已经整体闭环。

审查固定快照：`codex/review-v1.4-ux-20260907` / `ba4d6b67696bf2fb3e4ae163d08a8cb9e3b3a568`。工作目录 `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review`。从独立服务 `http://127.0.0.1:4404/` 进入平台 Shell；静态/模型端口4402/4403。独立 Chrome 会话，无业务源码修改。

## 按严重度排序的已验证缺陷

|编号|严重度|问题|主要影响|
|---|---|---|---|
|R14-001|P1|合成模型评分被展示为“正式事实”|业务严谨性 / 结果身份|
|R14-002|P1|未登记企业被当作全部企业或整个产业作答|问数 / 范围识别|
|R14-003|P1|本体内规则入口与验证结果回到态势均报错|功能闭环 / 本体归属|
|R14-004|P1|黄灯事项确认交办使用错误版本，反复重试不能生成待办|原审批链 / 数据版本|
|R14-005|P1|切换业务域后保留不兼容对象，空结果仍显示成功|跨模块交接 / 对象范围|
|R14-006|P2|小数降息和授信收缩参数被静默改为0|方案输入 / 语义解析|
|R14-007|P2|集团余额推荐问题只回答板块成本，关键请求指标缺失|功能完整性 / 推荐问题|
|R14-008|P2|报告交接把基准标成压力模拟，目录又回退为候选结果|报告 / 结果身份|
|R14-009|P2|问数超过8条后旧答案无入口可回看或继续处理|历史恢复 / 交互完整性|
|R14-010|P3|无匹配企业时融资成本显示“暂无%”|空状态 / 文案|

### R14-001 · P1 · 合成模型评分被展示为“正式事实”

类别：业务严谨性 / 结果身份。模块：M08 / 投后驾驶舱结果视图。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → #/view/post-investment/overview → 结果视图`。

对象/前置：S005；InvestmentProduct-001 至 004；FACT-S005-BASELINE-READONLY。使用本轮独立服务；通过 M08 的投后目标进入驾驶舱。完整模型流程已另行实际运行至候选消费绑定。

复现步骤：

1. 经营驾驶舱选择“投后评价”，点击“结果视图”。
2. 选择“正式结果”，查看基金A、基金B、基金C及产品池组合的分数、状态和结果ID。
3. 与主页面当前轮次的覆盖率、缺失说明和源码结果构造方式对照。

**预期：** 模拟构造评分必须明确标为演示/合成基准；正式事实须可追溯到确有数据和口径支持的结果。

**实际：** 抽屉显示“4个业务对象 · 正式事实”，分数为62、68、74、80，前三项“已评价”。这些值由 resultSubjects 的 62 + index * 6 生成，置信度也按序号生成，再包装成 resultKind=FACT。主页面同期显示仅5.9%覆盖、很低置信度及大量无法评价。

**用户/业务影响：** 可能把无实际计算依据的评分当成投资评价结论，并通过“加入报告”继续传播。未发生真实交易或正式模型指针修改。

**本轮证据：** [111-post-result-view.png](screenshots/111-post-result-view.png)；[110-post-cockpit-after-binding.png](screenshots/110-post-cockpit-after-binding.png)；[112-post-candidate-results.png](screenshots/112-post-candidate-results.png)。

**源码依据：** [designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:113](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:113)；[designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:190](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs:190)；[designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1700](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1700)。

**最小修正建议：** 将合成基线明确区分为演示身份；正式视图只消费有实际依据的当前结果，缺失时保持无法评价。报告沿用同一身份。

**验收标准：**

- 没有真实证据的基金评分不出现在“正式事实”中。
- 主页面、抽屉、问数和导出对同一对象的结果属性及缺失状态一致。
- 候选、模拟的示例分数始终带有醒目的合成标记和来源。

归属说明：继承的 v1.3.0 运行时问题，在 v1.4 实际消费路径中复现。

### R14-002 · P1 · 未登记企业被当作全部企业或整个产业作答

类别：问数 / 范围识别。模块：驾驶舱同屏问数。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势`。

对象/前置：不存在的Review企业；华南环保集团；ENT-017/018/019/020。基准快照、清除筛选，21家企业。

复现步骤：

1. 输入“不存在的Review企业融资余额多少”并发送。
2. 清除筛选，再输入“华南环保集团融资余额多少”。
3. 检查答案的对象集及可用的报告/事项操作。

**预期：** 无法识别的主体应拒绝作答或要求选择已登记主体，不得自动扩大范围。

**实际：** 第一问返回21家企业、融资余额1,411.24亿元；第二问把名称中的“环保”解释为产业，返回4家、450.30亿元。均标为“分析结果”，可加入报告和发起事项。未知企业保护只匹配“公司/单位数字/ENT-数字”。

**用户/业务影响：** 错误对象范围生成看似可信的融资总额，可能导致错误报告和错误复核事项。

**本轮证据：** [36-unknown-entity.png](screenshots/36-unknown-entity.png)；[query-boundaries-verified.json](logs/query-boundaries-verified.json)；[36-unknown-entity.json](logs/36-unknown-entity.json)。

**源码依据：** [designs/prototype-work/v1.4/src/domain.js:344](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:344)；[designs/prototype-work/v1.4/src/domain.js:366](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:366)；[designs/prototype-work/v1.4/src/domain.js:434](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:434)。

**最小修正建议：** 先完成主体和范围解析；拒绝未被完整解释的专名，不把主体名中的行业词直接当作筛选条件。

**验收标准：**

- 上述两个输入均明确提示主体未登记，并保持原分析范围。
- 标准企业名称、ENT-ID、已登记别名仍可命中。
- 失败答案没有加入报告/发起事项入口。

归属说明：v1.4 同屏问数新增解析。

### R14-003 · P1 · 本体内规则入口与验证结果回到态势均报错

类别：功能闭环 / 本体归属。模块：M01 本体管理。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/ontology → 语义资产 / 本体建模`。

对象/前置：DRAFT-V14-OPERATIONS-S001；RULE-OPS-FINANCING-PREMIUM；DRAFT-V14-OPERATIONS-S003。语义资产目录可见融资及债务风险本体的“规则与指标修订”。

复现步骤：

1. 分别点击两类本体的“规则与指标修订”。
2. 绕行“本体建模→经营态势规则修订→融资成本偏离预警”。
3. 运行25bp验证，得到7/21命中，再点“在经营态势查看”。
4. 编辑为50bp重新验证；另进入仍存在的“融资规则验证”独立页。

**预期：** 规则应从所属本体修订，验证后携带本体/草稿/规则/版本和对象集进入态势；消费入口使用同一规则。

**实际：** 两个目录按钮均抛 openOntology is not a function；验证结果应用抛 applyOwnedRule is not a function，页面未给失败提示。独立页仍可使用另一套100bp规则生成独立UUID并筛选地图，未关联本体中的50bp修订。

**用户/业务影响：** 规则治理主链无法完成；用户绕行后会维护两套不同规则，难以确认地图和报告究竟使用哪个本体版本。草稿编辑未覆盖已发布定义，这一隔离检查通过。

**本轮证据：** [50-owned-rule-noop.png](screenshots/50-owned-rule-noop.png)；[54-owned-validation-result.png](screenshots/54-owned-validation-result.png)；[55-owned-rule-apply-noop.png](screenshots/55-owned-rule-apply-noop.png)；[56-rule-edited-50bp.png](screenshots/56-rule-edited-50bp.png)；[58-sandbox-independent.png](screenshots/58-sandbox-independent.png)；[browser-errors.jsonl](logs/browser-errors.jsonl)。

**源码依据：** [designs/prototype-work/v1.4/composite/integrations/ontology-owned-rules.js:36](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/ontology-owned-rules.js:36)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:391](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:391)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:15](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:15)。

**最小修正建议：** 补齐本体修订与应用交接函数，以本体规则版本作为唯一消费身份；整合或迁移独立规则页，并显示交接错误。

**验收标准：**

- 融资和风险本体修订入口均可到达正确草稿。
- 25bp和50bp验证后能回到相同对象集，问数/报告保留同一规则依据。
- 已发布规则不被草稿覆盖；独立UUID规则不再与本体规则并行生效。

归属说明：本快照新增本体接入尚未完成。

### R14-004 · P1 · 黄灯事项确认交办使用错误版本，反复重试不能生成待办

类别：原审批链 / 数据版本。模块：M04 原决策工作台。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/decision → 决策工作台`。

对象/前置：S003-ENT-018；AR-S003-CAND-S003-RUN-20260817163000000-c02200000001-S003-ENT-018-S003_RISK_FOLLOW_UP-2025-12-31-1.1.0。原有环保测试公司2黄灯事项处于待人工判断；未注入服务故障。

复现步骤：

1. 打开环保测试公司2事项，点击“确认并交办”。
2. 填写理由、知情确认、负责人、截止日，核对提交内容并确认。
3. 等待质量读取结束，再点击“重试提交”。
4. 打开“查看追溯”，对比接收前和确认前的精确数据版本。

**预期：** 在相同固定数据版本上重新核验；通过后生成独立待办。若确需修复数据，应提供可到达的具体恢复入口。

**实际：** 接收门引用 S003-T007-FORMAL-CANDIDATE-20251231-v1，确认门却查询“1.0.0”，返回“C017无法定位请求引用的精确数据版本”，人工确认不保存。累计3次回执均阻断。seed同时保存 dataVersion=1.0.0 和 dataAssetId=完整T007。

**用户/业务影响：** 原有债务风险审批行动链不能完成；本地分析复核事项的成功不能替代该链。阻断本身保护了错误执行，但恢复建议无法消除版本传递错误。

**本轮证据：** [126-original-assignment-settled.png](screenshots/126-original-assignment-settled.png)；[127-original-assignment-retry-failed.png](screenshots/127-original-assignment-retry-failed.png)；[128-original-audit.png](screenshots/128-original-audit.png)；[128-original-audit.json](logs/128-original-audit.json)。

**源码依据：** [designs/prototype-releases/v1.1.0/scenarios/s003/resources/m04/decision-inbox.v3.json:409](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-releases/v1.1.0/scenarios/s003/resources/m04/decision-inbox.v3.json:409)。

**最小修正建议：** 确认门使用申请固定的完整数据资产版本ID，区分版本号与数据身份；保留现有质量阻断及幂等机制。

**验收标准：**

- 环保测试公司2接收门与确认门读取同一完整T007身份。
- 数据质量合格时产生且只产生一条待办，刷新可追溯。
- 真实质量故障仍阻断，恢复后重试不会重复交办。

归属说明：继承的冻结审批资源/消费链；本轮在 v1.4 Shell 复现。

### R14-005 · P1 · 切换业务域后保留不兼容对象，空结果仍显示成功

类别：跨模块交接 / 对象范围。模块：M03 → M07 / M08 / Agent。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/query → 带入探索 → 其他业务域问题/模型目标`。

对象/前置：dept-equipment；dept-technology；dept-safety；S004；S005；InvestmentProduct-001 至 004。从投后驾驶舱切入智能问数；也在新的浏览器上下文、同一独立服务上进行了对照。

复现步骤：

1. 问“2025年三个部门的费用预算执行率和剩余空间分别是多少”，答案包含3个部门。
2. 点击“带入探索”，检查对象范围。
3. 回问数点新会话，选“哪些借款主体需要优先人工复核”。
4. 进入投后模型目标，再切债务风险模型目标，检查当前对象与时间。

**预期：** 跨域应验证对象身份兼容性并明确重置或提示；带入探索要保留可映射的原对象，不可默默扩大为全目录。

**实际：** 预算结果跳到M07显示全部71对象。Shell仍保存S005 + dept-equipment等预算对象；M08投后/债务目标显示“设备管理部”，贷前问题显示“成功、0条正式结果”。新的浏览器上下文中也复现0条：其回答固定的scenarioId为S004，对象集却来自当前S005模型产品。说明该问题还会由服务当前业务域的默认范围触发，不能仅归因于预算操作。

**用户/业务影响：** 用户可能把错误范围造成的空结果理解为无风险；模型目标、Agent与查询对象跨域错配，跨模块分析连续性中断。

**本轮证据：** [71-budget-to-explorer.png](screenshots/71-budget-to-explorer.png)；[75-preloan-empty-detail.png](screenshots/75-preloan-empty-detail.png)；[90-post-models.png](screenshots/90-post-models.png)；[114-risk-model-code-entry.png](screenshots/114-risk-model-code-entry.png)；[156-clean-preloan-control.png](screenshots/156-clean-preloan-control.png)；[clean-preloan-context.json](logs/clean-preloan-context.json)。

**源码依据：** [designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1102](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1102)；[designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:930](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:930)；[designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:838](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:838)；[designs/prototype-work/v1.4/composite/shared/workflow.js:29](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/shared/workflow.js:29)。

**最小修正建议：** 交接时携带来源业务域及规范对象ID，按目标域校验范围；无兼容对象时显示范围不兼容及恢复入口。新业务问题不得默认套用另一域的对象集。

**验收标准：**

- 预算答案带入M07后要么显示对应3部门，要么明确说明当前目录无映射，不能自动显示71对象当作交接成功。
- 贷前查询不使用预算部门或投资产品ID作为范围。
- 投后和债务风险目标不显示设备管理部；空结果区分无命中、未运行和范围错误。

归属说明：继承集成的交接和范围选择逻辑；v1.4客户路径实际暴露。

### R14-006 · P2 · 小数降息和授信收缩参数被静默改为0

类别：方案输入 / 语义解析。模块：同屏问数 → 融资方案。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势 → 问数/比较方案`。

对象/前置：8c7c78b4-eb5f-4ab2-9516-4c2b76f1403f。任意有效企业范围，本轮为4家环保企业。

复现步骤：

1. 输入“未来90天如果降息12.5bp，授信收缩12.5%，展期30天”。
2. 等答案完成后点“比较方案”。

**预期：** 正确读取12.5bp和12.5%，或明确拒绝不支持的小数，不得显示成功后替换成零。

**实际：** 成功答案保存 parameters={rateBps:0,creditHaircut:0,extensionDays:30}；表单显示0bp、0%，预览不体现用户的利率和授信变化。解析正则只接受整数，未匹配时回填0。

**用户/业务影响：** 方案假设与原问题不一致；用户可能保存和比较未按要求测算的方案。参数表可以人工发现，但没有任何忽略提示。

**本轮证据：** [140-decimal-scenario.png](screenshots/140-decimal-scenario.png)；[141-decimal-parameters-zero.png](screenshots/141-decimal-parameters-zero.png)；[query-boundaries-verified.json](logs/query-boundaries-verified.json)。

**源码依据：** [designs/prototype-work/v1.4/src/domain.js:410](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:410)；[designs/prototype-work/v1.4/src/domain.js:428](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:428)。

**最小修正建议：** 支持业务允许的小数精度；未支持表达应阻断并标出无法识别的参数，禁止静默默认。

**验收标准：**

- 12.5bp及12.5%被准确填入和计算，或两项都有明确拒绝理由。
- 整数50bp/30%仍正常；非法负数和超限值仍阻断。

归属说明：v1.4新增语义参数解析。

### R14-007 · P2 · 集团余额推荐问题只回答板块成本，关键请求指标缺失

类别：功能完整性 / 推荐问题。模块：M03 原问数工作台。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/query → 问数工作台`。

对象/前置：s001-group-cost；group-overview。新会话，点击平台提供的第1个融资推荐问题。

复现步骤：

1. 点击“集团当前融资余额和平均融资成本分别是多少？”
2. 查看回答详情和导出的CSV。

**预期：** 同时返回集团融资余额及平均融资成本，注明同一数据截至日、单位与依据。

**实际：** 实际回答“集团融资成本与产业板块对比”，只有成本和板块差异，没有集团余额。详情及导出仍缺余额；推荐项映射到通用group-overview模板。

**用户/业务影响：** 用户需要另找驾驶舱获取余额；推荐问题本身不兑现承诺，现场演示容易出现答非所问。

**本轮证据：** [68b-query-finance-answer.png](screenshots/68b-query-finance-answer.png)；[69-original-query-detail.png](screenshots/69-original-query-detail.png)；[original-finance-query.csv](downloads/original-finance-query.csv)。

**源码依据：** [designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js:139](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js:139)；[designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/data.jsx:404](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-releases/v1.1.0/intelligent-query-prototype/review-next/conversation-workspace/data.jsx:404)。

**最小修正建议：** 让该推荐意图返回已请求的两项指标，或将推荐文案收窄为现有能力；不必重写整个问数模块。

**验收标准：**

- 答案、详情和CSV均含余额与成本，数值与同口径驾驶舱一致。
- 结构占比等其他推荐问题逐项对应实际输出指标。

归属说明：继承的推荐问题/模板映射。

### R14-008 · P2 · 报告交接把基准标成压力模拟，目录又回退为候选结果

类别：报告 / 结果身份。模块：M06 联合报告 → 原内容块编辑器。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/report → 联合分析报告 / 报告目录`。

对象/前置：f319a40a-3215-4395-a40d-6807a4b32ba8；DEMO_BASELINE；planId=null。由基准答案生成报告；本轮用“有哪些担保关系”的21家基准答案。

复现步骤：

1. 在基准答案点“加入报告”，核对固定依据没有模拟方案。
2. 点“在报告中心整理”，查看目录卡片并打开内容块编辑器。
3. 检查内容块和原始快照的结果属性。

**预期：** 保持“演示基准”与“方案模拟”区别，目录正确显示对象数、方案身份和对应结果类型。

**实际：** 源快照为DEMO_BASELINE、planId=null，4个内容块一律resultMode=simulation，显示“压力模拟”。目录将同一联合报告写成“模型监测草稿/当前业务范围/未聚焦单个对象/候选结果”。原因包括硬编码simulation及目录只读objectSet/object/resultMode旧字段。

**用户/业务影响：** 基准与模拟的口径被混淆，用户难以确认报告采用哪组假设。数值快照和手工文字本轮未被重同步覆盖。

**本轮证据：** [171-baseline-report-identity.png](screenshots/171-baseline-report-identity.png)；[172-baseline-in-pressure-editor.png](screenshots/172-baseline-in-pressure-editor.png)；[149-native-report-resync-catalog.png](screenshots/149-native-report-resync-catalog.png)；[baseline-report-mislabeled.json](logs/baseline-report-mislabeled.json)。

**源码依据：** [designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:173](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:173)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:225](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:225)；[designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1656](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/native-module-integrations.js:1656)。

**最小修正建议：** 按快照实际结果类型映射报告身份，补齐目录对规范上下文字段的读取；继续保留人工修改保护。

**验收标准：**

- 无方案的基准报告显示“演示基准”，有方案显示具体模拟方案。
- 目录显示固定21家或9家范围，结果属性与编辑器/导出一致。
- 重复同步仍保留人工文字、排序和删除决策。

归属说明：v1.4联合报告与继承编辑器的接口适配。

### R14-009 · P2 · 问数超过8条后旧答案无入口可回看或继续处理

类别：历史恢复 / 交互完整性。模块：驾驶舱同屏问数。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势 → 问数`。

对象/前置：4053c894-f5b3-401f-808f-d4e4a8dea985；本轮共13条同屏查询。连续完成至少9次查询，成功、失败和取消均计入显示数量。

复现步骤：

1. 先问“找出高成本且有资金缺口的企业”。
2. 继续提交至少8次其他问题或取消。
3. 向上/下滚动问数列表，寻找最早答案及历史入口；刷新复查。

**预期：** 保留可访问的历史列表或加载更多，让用户恢复旧答案范围、生成报告和复核来源。

**实际：** 存储保留13条查询，但UI只渲染最近8条，最早的9家企业答案已无法通过界面找到；没有历史/更多入口。源码保存上限30条，渲染却固定slice(0,8)。

**用户/业务影响：** 一段较长演示或分析后无法回看最初依据，也无法对原答案继续发起事项或生成报告。数据尚在本机，但用户访问路径丢失。

**本轮证据：** [164-query-history-limited.png](screenshots/164-query-history-limited.png)；[164-query-history-limited.json](logs/164-query-history-limited.json)；[browser-results.jsonl](logs/browser-results.jsonl)。

**源码依据：** [designs/prototype-work/v1.4/src/app.js:349](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/app.js:349)；[designs/prototype-work/v1.4/src/app.js:1061](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/app.js:1061)。

**最小修正建议：** 为同屏问数增加历史入口或分页/加载更多，显示保存范围及上限。

**验收标准：**

- 第9至30条历史均可访问；成功/失败/取消状态可区分。
- 旧答案恢复其固定对象、窗口和方案，不套用当前方案。
- 刷新后可继续访问同样历史。

归属说明：v1.4同屏问数显示与存储上限不一致。

### R14-010 · P3 · 无匹配企业时融资成本显示“暂无%”

类别：空状态 / 文案。模块：驾驶舱指标栏。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势`。

对象/前置：空对象集。基准快照，企业检索可用。

复现步骤：

1. 在企业检索中输入不存在的名称。
2. 观察上方加权融资成本，再点“显示全部企业”恢复。

**预期：** 缺失值使用完整业务文案，如“暂无数据”；无数值时不拼接百分号。

**实际：** 0家范围下显示“暂无%”。显示全部后正常恢复2.46%。

**用户/业务影响：** 空状态不够清晰，影响界面可信度；未发现把缺失成本保存为0的情况。

**本轮证据：** [34-empty-search.png](screenshots/34-empty-search.png)；[34-empty-search.json](logs/34-empty-search.json)。

**源码依据：** [designs/prototype-work/v1.4/src/app.js:248](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/app.js:248)。

**最小修正建议：** 只对有效数字附加单位，缺失值显示统一空状态。

**验收标准：**

- 无企业和零余额均显示清晰缺失文案，不出现“暂无%”或NaN。
- 恢复范围后正常显示有效百分比。

归属说明：v1.4指标格式化。

## 覆盖与实际通过范围

详见 [COVERAGE.md](COVERAGE.md)。共20组检查，全部已开展；其中7组的限定检查范围未发现阻断，13组部分实现、存在缺陷或仍有专项未验证。不能将这个统计理解为模块总体通过率。

本轮已验证的完整本地链路：

- 9家企业问数范围 → 保存方案A（降息50bp、授信收缩30%、展期180天）→ 发起事项 → 确认 → 分办 → 跟进 → 完成 → 报告 → 人工复核冻结v1 → 独立修订v2 → 原内容块编辑/排序/删除/撤销/预览 → 实际HTML导出 → 返回固定9家/90天/方案A。报告编辑器的结果身份问题见R14-008，因此仅认可状态、数值快照及操作连续性。
- 已保存探索 → 删除方案A → 从探索恢复原方案A及固定对象集；事项完成后重开、取消，均保留审计记录。
- 数据资产检索 → 融资台账详情 → 字段/五页84条记录 → 快照与血缘 → 浏览器实际下载Excel → HTTP503/同长度损坏文件被阻断 → 恢复文件后成功重试。
- 原正式报告ENT-020 → 第4章定位 → 报告伴读新回答 → 重新运行自动核验，形成新M05运行记录（M05-RUN-1TOU6V5）；当前报告固定正文和23.05分保持不变。这里只认可本轮读取和运行路径，13/13的判定未逐条进行人工数学重审。
- M08投后目标 → 构建79条观察/4对象 → 质量校验 → 冻结 → 模型合同 → Benchmark → Challenger → 洞察审查 → 候选 → 3个影子窗口 → 复评 → Release Candidate → 消费绑定校验/确认 → 驾驶舱候选/模拟读取。此为本地流程完成，结果真实性受R14-001约束，不代表模型有效性或正式金融执行。

以下实际检查范围未发现缺陷：企业/借款/银行/授信/项目/事件/担保/指标输入的代表性下探和返回；地图全球缩放/聚合点击/点选/框选/空框保留/取消/显示全部/刷新；不同范围方案明确提示仅并列比较；非法展期参数被阻断；本体草稿编辑不改变已发布定义；重复报告同步保留手工文字；未知跨期/币种问题拒绝；查询取消不改变范围；数据503重试可恢复。

## 数据、下载与继承复核

- Excel为11张工作表、9资产共300记录，40,094字节，SHA-256 `3a126add6af3787c90cac781f6d42186d41dbcd80e5bc29264845994940ac3b8`，与登记一致；逐个资产逐字段核对无差异。84笔借款UI分页为20/20/20/20/4，ID、金额、利率、起息日、到期日与源数据一致，日期及百分比为正确Excel类型。重试下载字节一致。见 [download-validation.json](logs/download-validation.json)。
- 独立Decimal计算：总本金141,124百万元（1,411.24亿元），加权成本2.4566589722%，90天到期84,725.80百万元，逐企业正向缺口合计33,864.784百万元，与态势显示的四舍五入值一致。没有把跨企业盈余抵销缺口。
- 45条继承清单的父版本指纹符合本worktree v1.3.2；五业务域数据相同，M07的71对象/67关系/39时序字节相同。模块配置唯一变动是本体页面入口迁至v1.4本体封装，不据此判定功能丢失。57项统一资源目录包含原45项与新增12项。见 [inheritance-independent.json](logs/inheritance-independent.json)。
- `npm ci`成功；本轮`npm test`为97项、96通过、1失败。失败为`tests/inheritance.test.mjs:64`对模块配置完全相等的断言，因本体入口路径改变，不是环境故障；应更新契约而不是回退本体接入。原有浏览器脚本会写入旧artifacts/evidence，本轮未直接执行这些覆盖旧图的脚本；改用本报告目录内的实际交互证据。M08流动性模型界面实际触发Python测试，3项通过。
- 本轮浏览器产品异常3条，均为本体缺失函数（R14-003）。控制脚本的短暂iframe切换、严格选择器多匹配与截图超时单独记录，未当作产品缺陷；M07空间图截图关闭动画后获取成功。下载/数据HTTP503为本轮故障注入，与自然异常区分。

## 设计建议与待业务确认

- **D01 · 设计建议：把演示数据属性放在态势首屏的固定位置。** 首屏仅写“基准快照/联合态势”，合成借款说明主要在对象详情和来源面板；证据02-map-1440.png、04-loan-020-1.png。 保留简短“模拟融资数据”标记，并可展开数据截至日与版本，帮助客户区分历史风险评分和合成融资输入。
- **D02 · 设计建议：减少模型与窄屏页面中内部身份对主操作的挤占。** 118-model-code-390.png、163-asset-320.png中多层上下文与长字段增加滚动。数据表已验证可横向滚动，不据此判为裁切缺陷。 优先显示业务对象、状态和下一步；技术身份折叠保留，避免隐藏追溯能力。
- **B01 · 待业务确认：投后客户演示允许的实际数据覆盖范围是什么？** 本轮流程后仅2/34指标可部分评价，覆盖5.9%，且15只候选只列示5只。缺失原因有明确展示，未把覆盖不足本身定为缺陷。
- **B02 · 待业务确认：原内容块编辑器是每业务域一个汇总草稿，还是应按报告/修订独立管理？** v1与v2报告汇入同一S003草稿形成8块，行为可验证，但是否应分拆需要产品决定；本报告只把已确认的结果身份错标列为R14-008。

## 风险、未覆盖与演示判断

建议在修复P1前不要开展自由提问或全平台闭环演示。固定脚本的地图下探、正确整数参数方案、本地事项、快照下载及正式报告阅读可用于受限演示；应明确数据/模型属性。原审批确认与本体规则应用为确定的现场中断点，未登记主体和合成“正式事实”则可能在不报错时误导观众。

未验证：原审批生成待办之后的执行/完成（被R14-004阻断）；本体内规则应用后的真实下游消费（被R14-003阻断）；Agent生产Release发布及兼容多Agent编排完整运行（仅创建、编辑、验证阻断及正式报告伴读/核验运行）；M08全部10模型的实际数据运算、代码提交/标签/正式发布（本轮只读源码，未执行代码编辑）；所有角色权限、多人持久化、真实银行/外部通知、生产数据接入；完整键盘和读屏器审查；每个模块的每个页面在所有尺寸的穷举。未完成项没有记作通过。

1440×900、1280×720、390×844均实际检查，拥挤处补查320×844。窄屏数据表采用容器横向滚动，实测页面宽320、表格约999、容器290，没有据此把正常横向滚动误报为页面溢出。移动布局仍有较长滚动成本，列作设计建议。

所有业务源码保持原样，未提交修复。报告、控制脚本、截图、下载和日志仅写入`outputs/review-v1.4/`；独立浏览器设置与故障模拟未应用到用户主窗口。浏览器及本轮自建服务在证据归档后关闭，保留本地状态证据供复查。
