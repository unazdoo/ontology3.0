# 两项修复与M07审查覆盖矩阵

初始计划见[检查计划](logs/COVERAGE-plan.md)。

|ID|模块|入口/操作|预期|实际|状态|本轮证据|
|---|---|---|---|---|---|---|
|C01|R14-013/014|独立Shell→态势降级→问数/报告|拒绝OR、格式一致且不改源值|两项均通过限定业务复测；并集未实现|已验证|logs/or-fix-retest.json；logs/format-download-validation.json|
|C02|正常WebGL|不注入故障进入正常态势|地图有可确认渲染/就绪状态|未取得就绪；再触发既有WebGL不可用路径完成业务验证|未通过验收/未定产品根因|logs/normal-webgl-attempt.json|
|M01|对象发现|企业→环保→预览→勾选两家→进入|区分结果/预览/选择|4个搜索结果中选择2家；对象集2，当前公司4；预览未改选中范围|已验证|logs/01-m07-discovery.json；logs/04-two-enterprise-catalog.json|
|M02|对象全貌|属性/关系/事件/证据四分区|读取固定信息与来源|公司4的75笔来源、5关系、1事件、12证据引用可读|已验证|logs/object360-tabs.json|
|M03|关系图|6节点→点选/展开→9节点|节点可选、关系可追溯|展开有效；节点重叠导致错选，中心文案不一致；折叠/复位未完整验证|部分实现|logs/19-expanded-loanbook.json；screenshots/07-current-m07.png|
|M04|时序|企业单快照→区间无观测；预算季度；持仓B|真实观测、单位和日期一致|企业区间显示无观测；信息科技费用一季度25.3%；持仓B显示79快照中的区间序列；多选上限主要源码核对|部分覆盖|logs/13-temporal-no-observation.json；logs/additional-m07-checks.json|
|M05|地图|对象集→SVG地图→缩放|只显示有坐标对象|地图可进入，缩放状态可保存；2企业有坐标、负责人无坐标；完整框选非本M07能力|部分覆盖|logs/20-spatial.json；logs/saved-link.json|
|M06|比较|两企业→条形/点图/雷达/日期|共同定义与同一时间口径|图形切换有效，但混比规则值及日期不一致；默认前8截取顺序仅源码核对|部分实现|logs/08-incompatible-rule-metric.json；logs/09-radar.json；logs/15-current-period-old-risk.json|
|M07|保存恢复|保存→刷新/重读→打开保存记录→复制链接|状态可恢复|保存记录EXP-MTTLN4HZ恢复对象集、视图和展开状态；已生成完整链接，未在另一台机器打开|已验证限定路径|logs/23-reload-restored.json；logs/saved-link.json|
|M08|报告交接|比较→继续分析→报告→HTML→返回来源|保留对象、视图、证据|报告16行指标及返回URL/上下文保留，返回恢复compare与对象集；错误可比指标也会进入报告|已验证操作链/内容有缺陷|logs/m07-report-transfer.json；downloads/m07-comparison.html；logs/27-return-from-report.json|
|M09|模型交接|M07→M08目标|正确身份/不兼容范围阻断|接收公司4及原视图；含负责人的混合集合被明确拒绝；未执行模型计算及候选返回|部分覆盖|logs/28-model-handoff.json|
|M10|问数/驾驶舱交接|持仓B→两个入口|保持对象/时间/版本|4持仓对象集、holding-02、季度范围及S005版本传入；未继续穷举下游问答/评价|已验证入口和上下文|logs/m07-other-handoffs.json|
|M11|空/跨类型|不存在搜索→清除；贷前/投资类型|空结果可恢复，类型可查|空结果禁用进入探索，清除可恢复；4申请主体、4持仓可查|已验证|logs/additional-m07-checks.json|
|M12|响应式|1440/1280/390/320|页宽不溢出、操作可达|1280/390/320在预算时序取DOM和控件状态，外层/内层均无横向页面溢出；完整逐屏截图链未完成|部分验证|logs/additional-m07-checks.json；logs/33-m07-width-390.json|
|C03|测试和源码|本轮npm test/build；输入指纹|不改业务代码|120/120、构建通过；本轮不是采用实施方旧结果；源完整性收尾核对|已执行|logs/npm-test.log；logs/build.log；logs/snapshot-manifest.json|

截图仅指实际存在文件；DOM、存储和源码证据不冒充截图。正常WebGL与既有降级路径分别记录。
