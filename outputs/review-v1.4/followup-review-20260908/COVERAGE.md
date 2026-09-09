# 本轮复审覆盖矩阵

初始计划保留在[检查计划](logs/COVERAGE-plan.md)。

|范围|入口/动作|预期|实际|状态/证据|
|---|---|---|---|---|
|R14-002|腾讯、中国广核及ENT-020与腾讯混合输入全部拒绝；三个拒绝均无结果操作，筛选/方案/窗口不变；单位553正确解析到ENT-020。|原问题验收标准|腾讯、中国广核及ENT-020与腾讯混合输入全部拒绝；三个拒绝均无结果操作，筛选/方案/窗口不变；单位553正确解析到ENT-020。|通过（本轮复现范围）；logs/question-retest.json,logs/rejection-invariants.json,screenshots/03-questions.png|
|R14-012|先降息再加息、两次授信收缩、两次展期均拒绝，状态不变；单阶段-12.5bp/12.5%/30天正确进入表单。|原问题验收标准|先降息再加息、两次授信收缩、两次展期均拒绝，状态不变；单阶段-12.5bp/12.5%/30天正确进入表单。|通过（本轮复现范围）；logs/question-retest.json,screenshots/04-decimal-form.png|
|R14-011|源标题/结论A同时更新4块和jointSnapshot；源B同步时人工标题/结论分别保留，顺序和删除保持；删除后撤销恢复3块；v1冻结、v2独立新增4块且v1字节相同。全删后再次同步和刷新仍0块。|原问题验收标准|源标题/结论A同时更新4块和jointSnapshot；源B同步时人工标题/结论分别保留，顺序和删除保持；删除后撤销恢复3块；v1冻结、v2独立新增4块且v1字节相同。全删后再次同步和刷新仍0块。|通过（本轮复现范围）；logs/source-native-sync.json,logs/per-field-update.json,logs/frozen-revision.json,downloads/renamed-source.html,downloads/frozen-v1-revised-v2.html,logs/delete-all-check.json|
|R14-013|清除筛选→高成本或缺口→报告|并集或明确拒绝|21家应入，仅9家成功|已验证缺陷/P1；logs/or-filter-browser.json|
|R14-014|报告到期/缺口块→HTML|约定精度，无浮点长尾|UI和HTML显示长尾|已验证缺陷/P3；downloads/renamed-source.html|
|九模块导航|Shell切换数据/本体/问数/决策/Agent/报告/M07/M08/驾驶舱|稳定显示可用且无内层重复导航|以navigation-check.json为准，首帧扰动未验证|部分覆盖|
|响应式|1440×900、1280×720、390×844、320×844报告编辑器|编辑器/导出可达|本轮取样截图，未穷举每个模块|部分覆盖；screenshots/11-report-*|
|原审批/模型/资产全链|本轮未改的其他业务路径|保留上一轮限定结论|本轮不重复标通过|未重新验证|
|源码/测试|指纹快照、116项测试、构建|不改业务代码|测试与构建通过；最终指纹独立核对|logs/snapshot-manifest.json；logs/final-qa.json|
