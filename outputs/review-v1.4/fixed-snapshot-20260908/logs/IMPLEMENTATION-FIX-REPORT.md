# v1.4 独立 Review 修复与复验

日期：2026-09-08。本报告仅对应本轮实施和新证据。

## 结论

10项全部完成本轮验证：9项实施修复，R14-003在实施窗口已修复，本轮验证确认其闭环可用。没有遗留的本次P1/P2/P3问题。没有提交、合并或部署。

最终独立预览：[http://127.0.0.1:63312/](http://127.0.0.1:63312/)。原4394等服务没有重启；新的运行时身份修复请在这个独立入口查看。预览进程及日志记录在[preview-process.json](preview-process.json)和[preview.log](preview.log)。测试汇总：[verification-summary.json](verification-summary.json)；证据文件指纹：[evidence-manifest.json](evidence-manifest.json)。

实施目录：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`；分支：`codex/prototype-v1.3.1-composite`。开始时v1.3.2、v1.4及已有两个输出目录为未跟踪内容，未回退或覆盖这些成果。修改限于v1.4和本输出目录。

已完整阅读独立审查的REVIEW-REPORT.md、COVERAGE.md和FINDINGS.json。独立审查工作区及证据只读；没有将实施目录回退到审查快照。冻结父文件的45项指纹检查本轮通过。

## 当前复现与逐项验收

“修改前仍存在”由当前源代码对照和本轮操作确认；修改前问数操作及源文件指纹保存在[before/baseline.json](before/baseline.json)。不是每项都留有修改前截图。下表验收均是修改后新运行结果，没有引用旧测试通过记录。

最初启动且保留修改前注册内容的独立运行时，也实际复现了4个62/68/74/80评分被标为正式事实，见[before/retained-original-runtime.json](before/retained-original-runtime.json)；该服务完成取证后已关闭。其页面资源来自实施工作区，证据不冒充修改前整站快照。

|编号|当前实现核对结果|修复、影响范围|本轮验证与证据|剩余限制|
|---|---|---|---|---|
|R14-001 / P1|修改前仍存在：通用模型运行注册把按序号构造的评分包装为FACT。|增加v1.4独立运行注册适配。通用演示基准改为DEMO_BASELINE，删除无实际依据的评分与置信度，保留未评价原因；候选、影子、模拟附合成来源。驾驶舱、问数历史、报告共同沿用身份；缺少置信度不再回填“高”。S003真实历史评分和已登记正式模型定义保持不变。|四个通用业务域的基准API无FACT评分；投后抽屉4对象均无法评价。实际完成模型评测→审查→候选→3个影子窗口→复评→消费绑定→压力模拟，前后基准完全相同。[native/01-synthetic-baseline-no-fact-scores.png](native/01-synthetic-baseline-no-fact-scores.png)、[model/result.json](model/result.json)、[model/state.json](model/state.json)、[model/query.txt](model/query.txt)。|合成候选可演示比较，不能作为正式评价或行动来源。投后实际覆盖不足继续明确展示，未伪造缺失数据。|
|R14-002 / P1|修改前浏览器复现：两个未知企业分别扩大到21家、4家。|同屏问数先完整识别主体，剔除已登记名称后校验剩余专名；企业名称中的行业词不再额外缩小或扩大范围；一个问题中混入未知主体也阻断。|两个报告输入、已知与未知混合输入均失败；失败答案没有报告/事项按钮，原筛选不变。21家企业的规范名、ID及全部登记别名逐一通过。[before/query-boundaries.png](before/query-boundaries.png)、[map-report/01-unknown-subjects-rejected.png](map-report/01-unknown-subjects-rejected.png)、[unit-final.log](unit-final.log)。|仍是登记口径解析，不将无法识别的问题猜测为其他主体。|
|R14-003 / P1|已修复：当前openOntology/applyOwnedRule存在，独立沙盒页签已整合，未为匹配旧报告改回旧实现。|本项只增强本轮回归，没有重写现有本体规则接入。|从平台首页实际点击融资、债务风险本体的目录修订入口；25bp、50bp验证及下游地图/问数/报告；不支持条件阻断；已发布定义前后相同。旧沙盒深链进入所属本体。[owned-rules-browser/result.json](owned-rules-browser/result.json)、[owned-rules-browser/00-native-rule-25-downstream.png](owned-rules-browser/00-native-rule-25-downstream.png)、[owned-rules-browser/02-rule-validation.png](owned-rules-browser/02-rule-validation.png)。|规则应用是草稿验证消费，不等同于发布已生效本体版本。|
|R14-004 / P1|修改前仍存在：原申请保存版本号1.0.0及完整dataAssetId，确认门读取错误字段。|v1.4装配原审批页面时迁移已知的版本号字段到申请自带的完整T007；保留declaredDataVersion和迁移记录。没有更改原质量摘要、放宽三道门、重建申请或改变幂等键。修复详情标题被操作栏挤压的局部布局。|环保测试公司2：填理由、知情确认、实际负责人及修改理由、日期→注入C017硬失败，人工决定和待办均不产生→恢复摘要→重试只生成1条原链路待办→确认承接→开始处理→完成→刷新仍为完成。接收、确认、待办门均引用同一完整T007。[approval/result.json](approval/result.json)、[approval/02-hard-quality-block.json](approval/02-hard-quality-block.json)、[approval/05-completion-persisted.json](approval/05-completion-persisted.json)、[approval/04-original-task-completed.png](approval/04-original-task-completed.png)。|保留既有失败回执，不篡改历史；处理结果是原型内待办记录，不代表外部实际执行。|
|R14-005 / P1|修改前仍存在：原问数交接漏业务域；M07丢弃无法解析ID后回退全目录；新域沿用旧对象。|原答案交接固定来源场景和显式对象集。M07保留未映射ID并显示范围错误，提供清除选择恢复。新业务问题切换到目标域，清除旧域对象和版本；同域范围、对象、时间、数据/本体版本不兼容则阻断。模型目标提供明确范围恢复；空结果区分无命中、无实际评价、未运行、范围或版本错误。|预算3部门进入M07为明确未映射、0结果，刷新后保留，可清除恢复；不伪造部门与现有预算单元映射。贷前答案无设备部门/投资产品ID，不再“0条正式结果成功”。投后及债务目标无设备管理部。版本、时间与ID错配另有单元回归。[native/result.json](native/result.json)、[native/04-budget-explorer-explicit-unmapped.png](native/04-budget-explorer-explicit-unmapped.png)、[native/06-preloan-explicit-no-data.txt](native/06-preloan-explicit-no-data.txt)、[unit-final.log](unit-final.log)。|现有71对象目录未登记这3个精确部门，因此按验收允许的“明确未映射”处理；不扩大目录或编造对应关系。|
|R14-006 / P2|修改前浏览器复现小数被归零。|利率bp、授信收缩支持1位小数，滑块步长同步为0.1；参数提及但无法完整解析即失败，负数、超限或过多精度不回填0。|12.5bp降息、12.5%收缩、30天展期实际进入表单并保存；独立测算验证成本变化；50bp/30%整数通过；负数、12.55、101%和超限降息拒绝。[map-report/02-decimal-plan-applied.png](map-report/02-decimal-plan-applied.png)、[map-report/state.json](map-report/state.json)、[unit-final.log](unit-final.log)。|明确支持1位小数；更多精度需另行确认业务精度后扩展。|
|R14-007 / P2|修改前仍存在：v1.4继承的覆盖模板再次覆盖了原余额指标。|恢复集团余额及成本指标到答案、明细和导出，保留板块成本比较与其他结构口径。使用原融资驾驶舱同日同口径数据。|推荐问题的答案、详情、CSV均包含21,613.387亿元及2.372231%，与原融资驾驶舱一致；继承回归继续覆盖相关问数和下探。[native/02-group-answer-balance-and-cost.png](native/02-group-answer-balance-and-cost.png)、[native/03-group-detail-export.txt](native/03-group-detail-export.txt)、[native/group-query.csv](native/group-query.csv)。|原集团账面口径与联合态势21家合成借款范围不同，不将两者混成一个总额。|
|R14-008 / P2|修改前仍存在：publishReport硬编码simulation，目录读取旧字段；重同步重建非编辑块。|按源证据区分演示基准/方案模拟；补齐规范范围、时间和方案名称，贯通内容块、目录及HTML。记录已导入报告身份，原地同步未编辑文字；保留手工文字、顺序、删除及全删决定。|9家基准报告显示演示基准、无planId；有方案报告显示具体方案。原编辑器实际改文字、下移、删除、导出、返回来源、重同步，结果保持；v1冻结→独立v2→原编辑器各4块，版本文字不串用。[map-report/05-repeat-sync-preserves-edit-order-deletion.png](map-report/05-repeat-sync-preserves-edit-order-deletion.png)、[map-report/native-baseline-edited.html](map-report/native-baseline-edited.html)、[plan-report/result.json](plan-report/result.json)、[plan-report/named-simulation.html](plan-report/named-simulation.html)、[plan-report/draft.json](plan-report/draft.json)。|继续沿用每域一个汇总草稿，不替用户裁决B02。|
|R14-009 / P2|修改前仍存在：保存30条但UI固定显示8条。|增加每次加载8条的历史入口，说明本机30条保存范围；保留成功、失败、取消状态和原答案操作。|实际输入/取消累计30条，全部经按钮可达，刷新后一致。旧基准答案在新方案下恢复原对象、90天及无方案身份；另从已保存的旧模拟答案恢复原方案、30天窗口和9家范围。[map-report/03-thirty-query-history.png](map-report/03-thirty-query-history.png)、[map-report/state.json](map-report/state.json)、[plan-report/00-old-simulation-answer-restores-plan-window-and-scope.png](plan-report/00-old-simulation-answer-restores-plan-window-and-scope.png)。|仍保留最近30条，超过30条按原存储策略滚动保留，页面已明示。|
|R14-010 / P3|修改前仍存在：缺失格式化结果后直接拼接%。|统一百分比缺失格式化；驾驶舱、企业明细、方案比较、报告及HTML仅在有效值时显示单位。320px指标改为两列，避免数值跨格。|不存在的检索范围显示暂无数据，无暂无%/NaN，恢复21家显示2.46%；零余额单元回归缺失成本；4视口验证数值scrollWidth不超过容器。[map-report/06-empty-cost.png](map-report/06-empty-cost.png)、[layout-final/result.json](layout-final/result.json)、[layout-final/map-320.png](layout-final/map-320.png)。|有效的0仍显示0.00%，与缺失值明确区分。|

## 本轮验证

- `npm test`：108/108通过，含新增主体解析、小数、合成结果身份、跨域/时间/版本、零余额回归和45个冻结父文件指纹。
- `npm run build`：成功。保留现有大包体积提示；本轮没有为消除提示进行无关构建重构。
- 原平台继承回归：12条流程通过；独立工作台：25条流程通过，包括地图非空像素、连续缩放、对象下探、保存探索、方案→事项→完成→报告、复核修订、恢复与故障重试。
- 新专项：原审批、原问数/跨域、本体双入口、30条历史/编辑保护、具名方案报告、完整候选模型周期、最终4视口均有独立结果文件。
- Excel专项：原目录9资产、全量记录/字段、实际下载字节与SHA、503失败、同长度但内容改变的SHA失败、恢复后再下载、刷新及返回态势均通过。本轮下载见[cockpit-snapshot-browser/downloaded-snapshot.xlsx](cockpit-snapshot-browser/downloaded-snapshot.xlsx)。
- 1440×900、1280×720、390×844、320×844已检查。原待办详情4视口、新地图指标4视口以及窄屏资产抽屉均有新截图。没有把“页面无横向溢出”单独当成美观验收，还检查了标题和指标的实际容器宽度。

各套件都启动本机空闲端口和独立浏览器上下文，平台专项从`/`进入并实际点击、输入、下探、返回、刷新、下载。保留的独立工作台低层回归使用`/workbench.html`，与平台入口回归分别记录。故障只注入当前测试上下文；没有停止或复用用户的4382/4383/4392/4393/4394服务。各结果JSON记录本轮URL；测试服务在finally中关闭。

### 中间失败的归因

- 产品回归：初版主体校验误拒绝“这家企业”、小写ID和带bp的筛选表达，已修复并补入回归；发现无评分的置信度默认“高”，已一并纠正。原待办详情标题挤压、320px指标拥挤已修正并重拍。
- 测试契约过时：继承测试原先要求基准报告固定为simulation，以及未允许本轮明确授权修改的v1.4继承副本；更新这些断言，不放宽冻结父文件检查。
- 测试操作问题：原审批初次测试改负责人却漏填修改理由，被正常门禁拒绝；后补齐表单。原任务列表已是运营概览，测试改用“查看进展→处理负责人待办”。原问数详情返回、跨模块iframe切换的等待也按实际页面修正。
- 环境/时序：并发启动浏览器时独立地图有一次超过原12秒初始化等待，没有资源或脚本错误；重新独立运行后，25条工作台回归及地图像素检查通过。取消测试改为在取消按钮可用窗口内实际点击。
- 中间日志保留于本目录；带`failure`的旧调试证据不表示最终失败。最终状态以各套件`result.json`及`unit-final.log`为准。

## 设计建议与待业务确认

- D01：建议仍保留。当前结果来源、数据截至和演示属性可追溯；没有以本次缺陷修复为名另行重构首屏。
- D02：只处理本轮验收发现的待办标题和320px指标挤压；未隐藏模型技术身份或重做专业模块。
- B01：投后实际数据覆盖范围仍需业务确认。当前保留实际覆盖不足和无法评价说明，不以合成评分补足。
- B02：报告中心继续保持每业务域一个汇总草稿，联合报告各修订以独立内容块身份保留。未擅自改成每份报告独立编辑器。

本轮已知P1业务严谨性和操作闭环阻断已消除。客户演示仍应基于明确的合成数据与实际历史事实边界；原审批记录、本地复核事项、候选消费绑定和正式发布继续是不同的业务行为。
