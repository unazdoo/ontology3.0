# v1.4 复审后补充修复

本轮处理独立复审的R14-002残留P1、R14-011及R14-012两个P2。此前“原10项全部解决”的结论范围过宽：未知简称及源报告改名没有被当时的测试覆盖。本轮保留原证据，补充修改前复现与修改后验证。

## 实施位置

- 工作区：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`
- 分支：`codex/prototype-v1.3.1-composite`；修复仍在未提交、未跟踪的`designs/prototype-work/v1.4/`目录中，HEAD不能代表修复版本。
- 已完整读取`prototype-v1.4-review/outputs/review-v1.4/fixed-snapshot-20260908/REVIEW-REPORT.md`。审查工作区及固定快照只读，未同步覆盖、提交、合并或部署。
- 本轮修改4个产品文件：`src/domain.js`、`src/app.js`、`composite/integrations/joint-workbench.js`、`composite/shared/report-editor.js`；新增两个专项测试文件。
- 修改前文件指纹和工作区状态：[baseline.json](baseline.json)。修复后的逐文件指纹：[source-manifest.json](source-manifest.json)。复审应按本轮指纹取新副本，不应使用旧HEAD或上轮快照。
- 独立预览：[http://127.0.0.1:52958/](http://127.0.0.1:52958/)，从平台首页进入；未停止或复用其他窗口服务。源码清单摘要为`86ce8aadad13a56222584ac8e117917619f5f78492524a65e7830283d5fb308d`。相对本次复审固定快照的4文件差异见[implementation.diff](implementation.diff)。

## 逐项结果

|编号|修改前复现|修改内容|本轮验收结果与证据|
|---|---|---|---|
|R14-002 / P1|腾讯、中国广核均返回21家；ENT-020与腾讯混合输入只返回已知1家。|删除依赖公司/集团/企业后缀的保护逻辑。完整扫描已登记主体、别名、银行、支持的业务表达及已解析参数；任何未识别文本均拒绝，不忽略未知简称或未支持的限定词。|两个原复现输入及已知/未知混合输入均失败，筛选、方案、窗口不变，无报告/事项入口。21家规范名、全部别名及大小写ENT-ID通过；集团、全部企业、环保范围和推荐问题正常。新增8组未知名称×6种句式及后缀/不支持指令边界。[修改前](before/result.json)、[修改后](after/result.json)、[边界截图](after/01-subject-and-parameter-boundaries.png)。|
|R14-012 / P2|降息后加息只记录-12.5bp；两次收缩只记录12.5%；两次展期只记录30天。|每类利率、授信收缩、展期最多出现一次；重复、冲突及明确分阶段表达拒绝。剩余数字或未解析参数同样不得静默忽略。没有新增多阶段建模或擅自合并为净变化。|报告中的两个复合输入及重复展期均显示暂不支持，不能生成成功方案。单阶段12.5bp/12.5%表单正确；12.5bp/12.5%及50bp/30%实际测算成本变化通过。重复同值、第二项缺值、无关键词第二数值、混合阶段等边界拒绝。[修改前参数](before/result.json)、[单阶段表单](after/02-single-stage-decimals.png)、[单元回归](unit-final.log)。|
|R14-011 / P2|改名后4块标题仍为默认标题，jointSnapshot保留旧标题/结论；HTML缺新名称。|按title/text分别记录上次源字段与人工修改状态；未编辑字段跟随源草稿保存，人工字段不覆盖。jointSnapshot随同一草稿更新。兼容旧块，从原fingerprint恢复比较依据，避免旧版过时快照误判。源报告复核时同步冻结状态，已冻结源版本不被同ID新内容覆盖，新修订独立导入。|仅改源标题/结论后4块、快照及HTML立即一致。目标只改标题时结论更新；只改结论时标题更新；下移、删除、全删、重复同步和刷新均保留。返回来源保留最新结论；v1冻结后v2独立，v1块不变。[改名后快照](after/renamed-report.json)、[HTML](after/renamed-report.html)、[按字段保护](after/04-per-field-edit-order-deletion-protection.png)、[v1/v2](after/05-frozen-v1-independent-v2.png)、[全删刷新](after/07-delete-all-and-refresh.png)。|

## 测试与证据

- `npm test`：114/114通过，其中原108项及新增6组测试。新测试内部包含多组名称/句式、同类参数、迁移、分字段编辑、冻结与删除边界。45项冻结父文件指纹继续检查。
- 独立浏览器专项：从平台`/`进入，实际点击、输入、保存、下探、返回、刷新、下载；修改前3组取证，修改后10组检查通过。服务及浏览器均独立，本轮结果记录实际端口。[before/result.json](before/result.json)、[after/result.json](after/result.json)、[browser.log](browser.log)。
- 1440×900、1280×720、390×844、320×844原报告编辑器均实际检查；无页面横向溢出，导出按钮可达，已人工查看截图。[320px](after/06-report-320.png)、[1440px](after/06-report-1440.png)。
- 本体所属规则专项重新运行，9组检查通过，覆盖25bp/50bp问数和报告消费，确认新的整句校验未破坏已验证业务主线。[规则结果](owned-rules-browser/result.json)、[rules.log](rules.log)。
- `npm run build`成功，保留既有大包体积提示。[build.log](build.log)。

中间新增测试出现两处测试断言问题：无疑问词的未知主体输入先得到口径错误提示，已将整句校验前移以优先定位未识别主体；VM数组跨上下文原型不同导致深比较失败，改为本地数组比较。没有为通过测试放宽主体识别或参数约束。中间日志保留，最终以`unit-final.log`和各专项`result.json`为准。

## 范围与限制

本轮三项在上述复现和新增边界范围内均修复、验证通过。它不是对任意自然语言、角色权限、多用户或跨设备流程的穷举证明。问数仍是登记业务口径解析器：未识别表达将明确拒绝，需使用已登记主体和单阶段假设。仍保留每业务域一个报告汇总草稿策略，没有借机整体重构。

没有重新把原审批、候选发布、Excel下载等未改代码的上轮通过结果记为本轮浏览器结论；它们由本次全量单元测试及独立复审既有结论提供限定范围的回归依据。自由问数的两项已知简称P1在本轮被阻断，但不再给出“任意自由提问均无风险”的笼统保证。
