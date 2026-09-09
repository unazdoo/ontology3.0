# 修复快照独立复审覆盖矩阵

初始计划见[检查计划](logs/COVERAGE-plan.md)。判定仅覆盖所列实际操作，完整发现见[报告](REVIEW-REPORT.md)。

|编号/范围|入口与关键操作|预期|实际结果|状态|证据|
|---|---|---|---|---|---|
|R14-001|合成基准无分数/置信度，不标正式事实；候选/模拟带合成来源；完整模型周期前后基准相同。|模拟构造评分必须明确标为演示/合成基准；正式事实须可追溯到确有数据和口径支持的结果。|合成基准无分数/置信度，不标正式事实；候选/模拟带合成来源；完整模型周期前后基准相同。|通过（原缺陷范围）|snapshot/outputs/fixes-v1.4/native/01-synthetic-baseline-no-fact-scores.png；snapshot/outputs/fixes-v1.4/model/state.json|
|R14-002|原全称及混合未知主体拒绝；无后缀简称仍忽略，见残留P1。|无法识别的主体应拒绝作答或要求选择已登记主体，不得自动扩大范围。|原全称及混合未知主体拒绝；无后缀简称仍忽略，见残留P1。|部分修复|logs/subject-decimal.json；logs/additional-boundaries.json|
|R14-003|双本体入口、25/50bp、编辑验证、应用到地图/问数/报告、草稿发布隔离、旧独立页迁移均实际验证。|规则应从所属本体修订，验证后携带本体/草稿/规则/版本和对象集进入态势；消费入口使用同一规则。|双本体入口、25/50bp、编辑验证、应用到地图/问数/报告、草稿发布隔离、旧独立页迁移均实际验证。|通过（原缺陷范围）|existing-tests/owned-rules-browser/result.json；screenshots/07-rule25-validation.png；screenshots/08-rule25-map.png|
|R14-004|完整T007一致；硬质量故障阻断；恢复后双击重试仅1待办；承接→处理→完成→刷新仍完成。|在相同固定数据版本上重新核验；通过后生成独立待办。若确需修复数据，应提供可到达的具体恢复入口。|完整T007一致；硬质量故障阻断；恢复后双击重试仅1待办；承接→处理→完成→刷新仍完成。|通过（原缺陷范围）|snapshot/outputs/fixes-v1.4/approval/result.json；snapshot/outputs/fixes-v1.4/approval/05-completion-persisted.json|
|R14-005|预算3部门明确未映射/0结果，刷新保留并可清除；贷前无旧域ID，不再0条正式成功；模型目标无设备管理部。|跨域应验证对象身份兼容性并明确重置或提示；带入探索要保留可映射的原对象，不可默默扩大为全目录。|预算3部门明确未映射/0结果，刷新保留并可清除；贷前无旧域ID，不再0条正式成功；模型目标无设备管理部。|通过（原缺陷范围）|snapshot/outputs/fixes-v1.4/native/result.json；snapshot/outputs/fixes-v1.4/native/06-preloan-explicit-no-data.txt|
|R14-006|单阶段小数正确解析为-12.5bp/12.5%，步长0.1；保存后成本从2.88%变为2.77%。复合参数新问题单列R14-012。|正确读取12.5bp和12.5%，或明确拒绝不支持的小数，不得显示成功后替换成零。|单阶段小数正确解析为-12.5bp/12.5%，步长0.1；保存后成本从2.88%变为2.77%。复合参数新问题单列R14-012。|通过（原缺陷范围）|logs/subject-decimal.json；screenshots/03-decimal-form.png；screenshots/04-decimal-plan-saved.png|
|R14-007|集团推荐答案、详情、实际CSV包含21,613.387亿元及2.372231%。|同时返回集团融资余额及平均融资成本，注明同一数据截至日、单位与依据。|集团推荐答案、详情、实际CSV包含21,613.387亿元及2.372231%。|通过（原缺陷范围）|snapshot/outputs/fixes-v1.4/native/02-group-answer-balance-and-cost.png；snapshot/outputs/fixes-v1.4/native/group-query.csv|
|R14-008|基准demo与具名simulation一致；文字、顺序和删除经再次同步保留；改名/来源快照遗漏单列R14-011。|保持“演示基准”与“方案模拟”区别，目录正确显示对象数、方案身份和对应结果类型。|基准demo与具名simulation一致；文字、顺序和删除经再次同步保留；改名/来源快照遗漏单列R14-011。|通过原身份/保护问题；有新增回归|logs/renamed-report-handoff.json；logs/plan-revision-native.json；downloads/plan-v1-v2-native.html|
|R14-009|实际累计30条，经加载按钮全部可达；刷新仍30条；旧基准和旧模拟答案恢复自身对象、窗口与方案。|保留可访问的历史列表或加载更多，让用户恢复旧答案范围、生成报告和复核来源。|实际累计30条，经加载按钮全部可达；刷新仍30条；旧基准和旧模拟答案恢复自身对象、窗口与方案。|通过（原缺陷范围）|logs/history-check.json；screenshots/21-thirty-history.png；screenshots/22-thirty-history-refreshed.png；screenshots/23-old-simulation-restored.png|
|R14-010|空范围暂无数据，无暂无%/NaN；恢复后有效百分比正常；四尺寸取样。|缺失值使用完整业务文案，如“暂无数据”；无数值时不拼接百分号。|空范围暂无数据，无暂无%/NaN；恢复后有效百分比正常；四尺寸取样。|通过（原缺陷范围）|screenshots/05-empty-cost.png；screenshots/06-empty-1280.png；screenshots/06-empty-390.png；screenshots/06-empty-320.png|
|R14-011|联合报告改名→保存→原编辑器→导出|未人工修改的标题/来源保持一致|标题与来源快照滞留|已验证缺陷/P2|logs/renamed-report-handoff.json|
|R14-012|问复合利率/授信→比较方案|完整解析或拒绝|只取第一个参数|已验证缺陷/P2|logs/additional-boundaries.json|
|资产及下载|目录→5页借款→Excel→故障重试|全量正确且可恢复|300记录/84UI行一致，故障阻断|已实现（本轮范围）|logs/download-validation.json|
|继承与源码|未提交快照→前后指纹→45父文件|固定修复对象且不改源码|前后无改动，45父指纹一致|已核对|logs/source-integrity.json|
|响应式|1440/1280/390/320主会话及审批/本体专项|关键操作可见/可滚动|本轮取样未发现新增布局缺陷；首次地图等待超时单列|部分覆盖|screenshots/06-empty-*；screenshots/28-asset-390.png；screenshots/29-asset-320.png|
|其余原能力|M07/Agent/报告中心原内容|继承能力不丢失|与本次修复相关交接已查，未重做全部旧流程|部分覆盖|详见报告限制|

修复输入为实施目录未提交文件，不能用0eed1d63或ba4d6b67单独重建本轮代码；请以snapshot-manifest.json及保留快照复现。
