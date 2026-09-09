# v1.4 修复复审：当前快照核对与有限复测

## 当前工作区仍可复现的问题

|编号|严重度|本轮实际结果|
|---|---|---|
|R14-002|P1|未登记主体被解析为环保产业，返回4家企业、450.30亿元，显示成功并提供报告/事项操作。|
|R14-003|P1|页面未进入修订草稿，报错 global.OFW_V14_JOINT.openOntology is not a function。本轮未继续验证 applyOwnedRule 路径。|
|R14-006|P2|保存的解析参数和实际表单均为0bp、0%、30天；前两项小数被静默忽略。|
|R14-010|P3|空企业范围下显示“暂无%”。|

本轮复现旧问题4项：P0 0、P1 2、P2 1、P3 1。未新增问题，未关闭上一轮问题；统计仅覆盖本轮抽查。

## 修复快照尚未取得

当前分支 `codex/review-v1.4-ux-20260907`，HEAD仍为 `ba4d6b67696bf2fb3e4ae163d08a8cb9e3b3a568`，与上一轮相同。直接计算87个受Git跟踪的v1.4源码、配置及文档指纹，与HEAD均相同；相关继承运行时和冻结模块的Git差异也为空。当前没有修复差异可审查。

这只能证明当前review快照尚未更新，不能判断其他目录的修复是否有效。REVIEW-PROMPT.md说明该worktree“不自动包含主窗口后续修改”，并要求“不操作其他worktree”。本轮未访问其他worktree或主窗口服务。需要明确修复代码所在目录或提交，才能继续修复验收。

快照证据：[snapshot-check.json](logs/snapshot-check.json)。

## 复测详情

### R14-002 · P1 · 未登记企业被当作全部企业或整个产业作答

类别：问数 / 范围识别。模块：驾驶舱同屏问数。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势`。对象：不存在的Review企业；华南环保集团；ENT-017/018/019/020。

前置：独立Chrome会话，4404入口及4402/4403配套服务，从Shell进入；旧本地记录未复用。

复现步骤：

1. 从 Shell 进入经营驾驶舱的融资与风险态势。
2. 问“华南环保集团融资余额多少”，等待答案完成。

预期：无法识别的主体应拒绝作答或要求选择已登记主体，不得自动扩大范围。

实际：未登记主体被解析为环保产业，返回4家企业、450.30亿元，显示成功并提供报告/事项操作。

影响：错误对象范围生成看似可信的融资总额，可能导致错误报告和错误复核事项。

本轮证据：[03-unknown-enterprise.png](screenshots/03-unknown-enterprise.png)；[03-unknown-enterprise.json](logs/03-unknown-enterprise.json)。

源码依据：[designs/prototype-work/v1.4/src/domain.js:344](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:344)；[designs/prototype-work/v1.4/src/domain.js:366](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:366)；[designs/prototype-work/v1.4/src/domain.js:434](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:434)。

最小修正建议：先完成主体和范围解析；拒绝未被完整解释的专名，不把主体名中的行业词直接当作筛选条件。

验收标准：

- 上述两个输入均明确提示主体未登记，并保持原分析范围。
- 标准企业名称、ENT-ID、已登记别名仍可命中。
- 失败答案没有加入报告/发起事项入口。

### R14-003 · P1 · 本体“规则与指标修订”入口仍报缺失函数

类别：功能闭环 / 本体归属。模块：M01 本体管理。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#module/ontology → 语义资产 / 本体建模`。对象：DRAFT-V14-OPERATIONS-S001；RULE-OPS-FINANCING-PREMIUM；DRAFT-V14-OPERATIONS-S003。

前置：独立Chrome会话，4404入口及4402/4403配套服务，从Shell进入；旧本地记录未复用。

复现步骤：

1. 从 Shell 进入本体管理语义资产目录。
2. 点击融资本体的“规则与指标修订”。

预期：规则应从所属本体修订，验证后携带本体/草稿/规则/版本和对象集进入态势；消费入口使用同一规则。

实际：页面未进入修订草稿，报错 global.OFW_V14_JOINT.openOntology is not a function。本轮未继续验证 applyOwnedRule 路径。

影响：所属本体修订入口不能进入；应用交接和独立规则并行问题本轮未重新验证。

本轮证据：[09-ontology-click.png](screenshots/09-ontology-click.png)；[09-ontology-click.json](logs/09-ontology-click.json)。

源码依据：[designs/prototype-work/v1.4/composite/integrations/ontology-owned-rules.js:36](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/ontology-owned-rules.js:36)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:391](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:391)；[designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:15](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/composite/integrations/joint-workbench.js:15)。

最小修正建议：补齐本体修订与应用交接函数，以本体规则版本作为唯一消费身份；整合或迁移独立规则页，并显示交接错误。

验收标准：

- 融资和风险本体修订入口均可到达正确草稿。
- 25bp和50bp验证后能回到相同对象集，问数/报告保留同一规则依据。
- 已发布规则不被草稿覆盖；独立UUID规则不再与本体规则并行生效。

### R14-006 · P2 · 小数降息和授信收缩参数被静默改为0

类别：方案输入 / 语义解析。模块：同屏问数 → 融资方案。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势 → 问数/比较方案`。对象：8c7c78b4-eb5f-4ab2-9516-4c2b76f1403f。

前置：独立Chrome会话，4404入口及4402/4403配套服务，从Shell进入；旧本地记录未复用。

复现步骤：

1. 问“未来90天如果降息12.5bp，授信收缩12.5%，展期30天”。
2. 等待成功答案，点击比较方案。

预期：正确读取12.5bp和12.5%，或明确拒绝不支持的小数，不得显示成功后替换成零。

实际：保存的解析参数和实际表单均为0bp、0%、30天；前两项小数被静默忽略。

影响：方案假设与原问题不一致；用户可能保存和比较未按要求测算的方案。参数表可以人工发现，但没有任何忽略提示。

本轮证据：[04-decimal-parameters.png](screenshots/04-decimal-parameters.png)；[04-decimal-parameters.json](logs/04-decimal-parameters.json)。

源码依据：[designs/prototype-work/v1.4/src/domain.js:410](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:410)；[designs/prototype-work/v1.4/src/domain.js:428](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/domain.js:428)。

最小修正建议：支持业务允许的小数精度；未支持表达应阻断并标出无法识别的参数，禁止静默默认。

验收标准：

- 12.5bp及12.5%被准确填入和计算，或两项都有明确拒绝理由。
- 整数50bp/30%仍正常；非法负数和超限值仍阻断。

### R14-010 · P3 · 无匹配企业时融资成本显示“暂无%”

类别：空状态 / 文案。模块：驾驶舱指标栏。

页面：`http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html#dashboard → 融资与风险态势`。对象：空企业范围。

前置：独立Chrome会话，4404入口及4402/4403配套服务，从Shell进入；旧本地记录未复用。

复现步骤：

1. 在态势企业搜索框输入“不存在的Review企业”。
2. 查看加权融资成本。

预期：缺失值使用完整业务文案，如“暂无数据”；无数值时不拼接百分号。

实际：空企业范围下显示“暂无%”。

影响：空状态不够清晰，影响界面可信度；未发现把缺失成本保存为0的情况。

本轮证据：[05-empty-scope.png](screenshots/05-empty-scope.png)；[05-empty-scope.json](logs/05-empty-scope.json)。

源码依据：[designs/prototype-work/v1.4/src/app.js:248](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-v1.4-review/designs/prototype-work/v1.4/src/app.js:248)。

最小修正建议：只对有效数字附加单位，缺失值显示统一空状态。

验收标准：

- 无企业和零余额均显示清晰缺失文案，不出现“暂无%”或NaN。
- 恢复范围后正常显示有效百分比。

## 覆盖边界

本轮正常对照“Shell→态势→未来90天到期问数”实际可用，返回21家、到期847.26亿元。没有把旧测试记录当作本轮结论。1440×900完成交互；1280×720、390×844、320×844对空范围/方案页留存视口证据，未重做全平台布局验证。

其余R14-001/004/005/007/008/009本轮未复测。完整事项/报告/审批/模型闭环、下载校验等未重复运行；没有给这些范围新的通过结论。因为源码未变，本轮未重跑整套npm test。

当前旧快照仍存在演示阻断；修复版本的演示可用性未验证。请明确修复所在目录或提交。

原报告和证据没有覆盖，业务源码未修改。新证据仅在本次子目录。只关闭本轮自建服务及浏览器会话，清理证据见[cleanup.json](logs/cleanup.json)。
