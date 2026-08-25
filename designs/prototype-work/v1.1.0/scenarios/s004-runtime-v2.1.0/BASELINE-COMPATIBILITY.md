# S004 基线兼容性说明（运行时 v2.1.0）

## 固定绑定

```text
baselineVersion = v1.0.3
foundationBaselineVersion = 1.0.3
baselineSnapshotId = BSL-S001-V103-DE0119608E26
scenarioId = S004
scenarioVersion = S004-v2.1.0
```

`baselineVersion` 是场景和对外证据使用的正式值；`foundationBaselineVersion` 仅用于兼容现有 C034 Foundation v1 的无 `v` 版本字段。两者由 `ofw-baseline-module-adapter.js` 统一校验和映射。

## 六模块入口与参数化边界

| 模块 | S004 运行时入口 | v1.0.3 来源入口 / 内部路由 | 入口策略 |
|---|---|---|---|
| M01 | `prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html` | 同左（`#modeling`） | 冻结入口 |
| M02 | `prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-modules/m02-data-engineering.html` | `prototype-releases/v1.0.3/data-engineering-prototype-review/review-v3/方案B2.html`（`#/resources`） | 已登记的受限参数化入口；原件摘要、60 个非等价 diff block 和 M02-P01—P28 受控变更登记在 `PATCH-REGISTRY.md` |
| M03 | `prototype-releases/v1.0.3/intelligent-query-prototype/review-next/conversation-workspace/index.html` | 同左（`#/ask`） | 冻结入口 |
| M04 | `prototype-releases/v1.0.3/decision-center-prototype/review-v2/action-portfolio.html` | 同左（`#workbench`） | 冻结入口 |
| M05 | `prototype-releases/v1.0.3/agent-application/Agent应用.html` | 同左（`#/agents`） | 冻结入口 |
| M06 | `prototype-releases/v1.0.3/report-center/review-lifecycle/index.html` | 同左（`#lifecycle`） | 冻结入口 |

M02 是唯一允许的运行时参数化例外：它保留 v1.0.3 数据工程页面、路由和交互，再由 v1.1.0 适配层注入 S004 数据投影；它不是新的私有模块实现。M01、M03、M04、M05、M06 直接使用清单中的 v1.0.3 冻结入口。M04 的正式入口是 `review-v2/action-portfolio.html`，不得回退到旧的决策中心根入口。

S004 运行时不加载 `scenarios/s004/module-views/*.js`，也不以私有 `module-frame.html` 作为 M01—M06 主体。

## 运行时适配边界

- v1.0.3 发布目录只读。
- 公共 Shell 使用 v1.1.0 运行层，但继续使用 v1.0.3 的模块入口和内部路由。
- S004 只提供场景配置、身份、数据投影、状态边界和存储适配。
- M03 完整页面保留，S004 状态为 `not_applicable`，不产生正式问数 Run。
- M04 完整页面保留，S004 队列为空，不产生 Action Request、审批、通知或待办。
- Agent 不能直接读工作簿、选择最新数据、重算正式 Metric、发布报告或创建行动。

## 冻结目录与清单审计

截至 2026-08-16，在 S004 工作树执行了以下只读检查：

```text
git diff --quiet -- designs/prototype-releases/v1.0.3       -> PASS
git diff --cached --quiet -- designs/prototype-releases/v1.0.3 -> PASS
git status -- designs/prototype-releases/v1.0.3             -> 无记录
```

`scenario.manifest.json` 的六项入口 SHA-256 清单通过运行时测试；M02 同时通过原件摘要和 `PATCH-REGISTRY.md` 关联校验。该审计不等同于整个工作树干净：旧 S004 工作区的 Checkpoint/资料改动仍按历史范围单独保留，不属于本运行时目录的基线改写。

## 验证结果

- M02/C003/C017 定向测试、原生播种、入口 SHA-256、存储隔离、问答、自动核验、跨模块深链和跨借款人配置测试全部通过。完整运行时测试套件当前为 129/129 通过；2026-08-17 补充三视口真实浏览器回归。
- S004 首页：加载成功，无浏览器错误。
- M01—M06：六个模块入口均成功加载，场景参数为 S004；其中 M02 使用已登记参数化入口，其余五项使用 v1.0.3 冻结入口。
- M02 数据资源目录不再展示场景装配说明卡；正式来源名称为“财务报告”。“内容与字段”只展示字段和样例；源文件下载统一位于“快照历史”。财务报告提供三份 PDF，贷前调查合成演示资料包提供包含 11 个 Sheet 的完整 XLSX 下载。
- M02 与 M01 现在使用同一轮次、同一冻结 C003 v2 载荷；来源指纹为演示工作簿实际 SHA-256 `9a6e3502039beef28ebe1fe10bc046cd4bb0e051b35122b2d6aea1c8c235f6d9`、大小 `20294` 字节。M02 初始只声明“已发送 · 结果待核对”，进入页面后仍由原基线联合重读 M01 合同、完整回执、C033 根回执和目标 Draft 绑定，不把种子状态冒充当前会话已验证。
- 已发布数据资产版本包含版本绑定摘要与当前状态摘要；M02 对 M03 只写入 `NOT_APPLICABLE` 空投影，对 M04 只写入空 Action Request 队列投影，不触碰 M06 独立报告可信度键。
- M03：完整 Ask 页面可见。
- M04：完整决策页面可见，待我决策数量为 0。
- S001 默认入口：加载成功，默认场景仍为 S001。
- 1440×900、1280×720、390×844：M01—M06 共 18 个组合均通过同 Origin、同视口检查；外层和 iframe 均未发现横向溢出，且场景标识与模块业务标识均存在。
- M06 在首次进入后切换 M01—M05，再返回 M06：正式 HTML/PDF 链接、报告身份及既有伴读 Run/Result/Session 精确恢复；当前隔离轮次仍可追加新的报告问答与核验 Run，历史记录和正式产物不覆盖。
- M05“从报告请求发起”可切换到 M06 并落在 `#/reports/generate`；导航桥先更新新建 iframe 的加载器 URL，再在真实 M06 文档就绪后交付内部 fragment，不会把模块截停在 `about:blank`。
- M06 当前新内容版本在 `evidence_locked`、`agent_complete`、`draft_ready`、`verification_complete` 和 `human_confirmed` 阶段均保留自己的证据包、草稿及内容身份，不会被历史已发布报告种子覆盖；完成确定性核验和人工确认后停在待发布，正式发布仍需受控授权。
- M05 证据详情在八项状态均真实可定位时显示“S004 闭环已完成 · 当前轮次可继续运行”；旧“当前不可用于新的正式输出”提示不再出现。S004 报告 Agent 与伴读 Agent 均为已启用，Prompt、Skill、工具白名单和 Published 本体绑定可穿透查看。当前 C022/C023 的精确基线默认标题会校正为贷前调查语义，但历史记录及用户自定义标题不被批量改写。
- M06 报告助手使用 24 个问题池，每页显示 6 个并支持刷新；清空会话后推荐问题保留。业务页面隐藏 Agent Session/Run/Result 技术提示。确定性核验通过项只保留标题；规则说明默认收起；重新核验展示四阶段原位进度；核验说明和当前权威数据比较均即时显示业务含义。
- M06 报告阅读层只提取历史正式 HTML 的正文片段，不嵌套整页 HTML；报告正文无“【人工输入】”，风险与授信位置显示“【需人工确认】AI 建议（基于已固化资料与系统事实生成）”。报告生成阶段不直接联网搜索。历史 HTML/PDF 原件未改写；工具栏取消“查看 PDF”并保留下载，基线固定版入口继续提供兼容预览。
- 报告模板目录和详情均暴露 `RT-S004-PREFLIGHT-002-v2.0.0.html`、`.json` 下载地址；DOCX 未自动纳入一期。
- M06 报告定义去重回归通过：定义目录及数量标记均为 1。报告生成页提供 4 个借款人选择项；已就绪借款人可打开原生六步创建向导，未就绪借款人禁用生成并通过场景导航桥进入 M02 `#/resources`，不再停留在报告页。
- M05 报告草稿 Agent 的卡片和详情页使用业务化场景描述，不显示 C022、内部场景绑定编号、权威边界或跨借款人运行参数说明；资源与权限页仍完整提供系统提示词、Skill、工具白名单和 Published 本体绑定。
- 2026-08-17 聚焦回归在 1440×900、1280×720、390×844 均通过：报告定义数、借款人选择、原生向导、数据准备跳转、Agent 详情和资源穿透均正常；外层与 iframe 无横向溢出，控制台无应用错误。390×844 使用 v1.0.3 原生菜单收起动作后完成业务页面检查。
- 存储配额回归：冻结模块写入场景逻辑键时，如同 Origin `localStorage` 配额不足，仅将该逻辑键溢出到同一 `scenarioRunId` 的 `sessionStorage` 隔离区；读取、删除、枚举和事件仍保持原逻辑键语义，不删除或覆盖其他场景状态。该机制只用于原型运行状态，不是 Checkpoint 或正式证据真源。

浏览器中的 sandbox/Babel 仅产生既有警告，不是应用错误。

## 当前交付状态

本目录是新的运行时适配版本，不覆盖 S004 v2.0.1。旧正式报告及 13 份已跟踪 Checkpoint 继续只读保留；20 份旧 V2/V201 Checkpoint 当前仅存在于未跟踪归档，是否恢复到活动目录须由总装裁决。尚未生成新的正式 Checkpoint、正式报告发布指针或验收通过结论。

本次回归证据见 `evidence/runtime-regression-20260817.json`；变更边界见 `GIT-DIFF-SCOPE-AUDIT.md`。两者均为运行时审计资料，不是正式 Checkpoint。

本目录不允许借此修改 v1.0.3 发布文件、公共合同、Owner、Foundation、T019、正式报告或历史 Checkpoint；若总装发现入口、基线字段、事件合同或共享存储键冲突，应暂停合并并形成 CR/Q。
