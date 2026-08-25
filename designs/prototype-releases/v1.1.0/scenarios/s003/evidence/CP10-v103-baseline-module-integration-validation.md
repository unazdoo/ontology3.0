# S003 CP10 v1.0.3 基线模块装入验证证据

- 验证日期：2026-08-16
- Checkpoint ID：`CP-S003-20260816055945000-c03510000010`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP10-v103-baseline-module-integration-completed`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式 Published 运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP10`
- 入口：`runtime/cp10-entry.v1.html`
- 验收状态：`acceptanceReady = false`

## 封存结论

CP10 封存的是“v1.0.3 六模块真实实现 + S003 配置化/条件式适配”的技术完成状态。
S003 不拥有第二套产品壳；`scenarios/s003/index.html` 只跳转到 v1.0.3 派生公共壳。
M01—M06 继续保留原模块导航、画布、队列、对话、生命周期和通用合同，S003 只在
`scenarioId = S003` 及指定子路由成立时装入场景资源或只读投影。

冻结目录 `designs/prototype-releases/v1.0.3/` 未修改。CP10 仍绑定已经形成正式
C035、Published 风险事实、报告和决策证据的原运行
`S003-RUN-20260815133000000-c03503000001`，不会把浏览器快速重跑产生的工作投影
冒充为正式 Published 运行。

## v1.0.3 继承与模块装入

| 层级/模块 | 保留的基线能力 | S003 条件式装入 | 边界 |
| --- | --- | --- | --- |
| 公共壳 | v1.0.3 首页、场景流程、M01—M06 导航、上下文交接 | 配置注册 S003，携带独立三元身份和 Published 资源 | 不复制 S001 运行身份或融资业务定义 |
| M01 本体管理 | 原建模、Published、版本与画布 | S003 风险模型配置和 Published 子路由 | Metric、Rule、Action Type、系数、权重、阈值仍归 M01 |
| M02 数据工程 | 原数据资源、管道、运行与质量页 | 工作簿、快照、企业因子填报、候选资产与运行适配 | 不在管道或质量规则中计算评分 |
| M03 智能问数 | 原问数首页、对话、历史、视图与 Agent 配置 | 同轮 Published 风险事实只读投影 | 工作投影和 Draft 均 fail-closed |
| M04 决策中心 | 原通用决策工作台、Action Request 与待办 | 把已确认的 S003 候选装入通用状态 | 无专属路由；人工确认后才创建副作用 |
| M05 Agent 应用 | 原 Agent 目录、运行与协作 | 一期无专属 Agent 的边界卡 | 不重算评分、不改配置、不自动建单 |
| M06 报告中心 | 原报告目录、生成、核验与发布生命周期 | 风险总览、21 家明细、企业报告、配置、运行、重跑与快照工作台 | 工作台归 M06，不新增第七模块 |

v1.1.0 公共壳和 M01—M06 外部集成文件由
`resources/integration/v103-baseline-extension-inventory.v1.json` 逐文件记录 SHA-256；
CP10 只引用该包内清单，不把 S003 包外路径直接写入 Checkpoint `codeRefs`。

## 自动化与静态验证

- Foundation 与 S003 全量测试：`153 / 153` 通过，`0` 失败。
- v1.0.3 完整性校验：`9` 个组件、`15` 个入口通过。
- 冻结目录差异：`git diff -- designs/prototype-releases/v1.0.3` 为 `0`。
- `git diff --check`：通过。
- M02 `build-standalone.mjs`：通过，生成唯一入口 `方案B2.html`。
- M02 `verify-static.mjs`：通过，数据作业台的来源、运行、资产、只读回执与失败恢复边界完整。
- 外部集成文件清单复核：`build-baseline-extension-inventory.cjs --check` 通过。

## 浏览器端到端证据

| 证据 | 验证内容 |
| --- | --- |
| `evidence/browser-cp10/01-s003-home.png` | S003 从 v1.0.3 派生公共壳进入，公共导航与场景身份同时显示 |
| `evidence/browser-cp10/02-dashboard-report.png` | M06 风险总览、21 家企业明细和报告入口 |
| `evidence/browser-cp10/03-enterprise-report.png` | 单家企业报告穿透及同轮次证据身份 |
| `evidence/browser-cp10/04-m03-native-projection.png` | M03 原问数工作台与 S003 Published 只读投影并存 |
| `evidence/browser-cp10/05-m04-generic-workbench.png` | M04 明示通用决策工作区，无 S003 专属处置路由 |
| `evidence/browser-cp10/06-m04-action-todo.png` | 既有 Action Request 与负责人待办在通用框架内展示 |
| `evidence/browser-cp10/07-rerun-confirmation.png` | 快速重跑明确创建新轮次并返回仪表盘 |
| `evidence/browser-cp10/08-rerun-new-run.png` | 新 runId 仅形成工作投影，M03/M04/正式报告消费继续阻断 |
| `evidence/browser-cp10/09-s001-regression.png` | 默认 S001 首页及原公共路径无 S003 内容泄漏 |

浏览器验证期间未观察到 console error 或 page error。S003 风险分布为 21 家企业：
绿 16、黄 4、红 1、黑 0；企业报告可从评分明细穿透。

## 快速重跑与副作用隔离

- 来源正式运行：`S003-RUN-20260815133000000-c03503000001`。
- 浏览器验证新运行：`S003-RUN-20260816055516782-f90f2fe7b46d`。
- 新运行使用独立命名空间，只形成 M01、M02、M06 工作投影；没有 M04 命名空间键。
- 新运行 `decisions = []`，不包含历史 Action Request 或负责人待办。
- 权威成功指针继续指向原正式 Published 运行。
- `restored`、`historical-readonly`、`regression`、`closed` 在服务层和状态层均禁止
  创建 Action Request、审批、通知、负责人待办或外部派发。
- 历史查看保留原 `scenarioRunId`；克隆恢复、隔离回归和快速重跑均创建新
  `scenarioRunId`，不得覆盖 CP01—CP09 或历史证据。

## CP10 快照语义

CP10 新增且不覆盖 CP09。它锁定：

- `baselineVersion = 1.0.3` 与 `baselineSnapshotId = BSL-S001-V103-DE0119608E26`；
- `scenarioId = S003`、`scenarioVersion = S003-v1` 与正式来源 `scenarioRunId`；
- v1.1.0 公共壳、M01—M06 条件式适配文件清单及 S003 包内代码树；
- M01—M06 精确导出版本、数据、人工输入、评估时点、质量版本和 Published 指针；
- 配置、C035/Published 结果、报告、决策、测试夹具、功能开关和浏览器证据；
- 历史只读、克隆恢复和隔离回归所需的 fail-closed 语义。

## 验收边界

CP10 表示 S003 技术实施、总装、联调和回归验证已完成。它不代表用户已经验收、
平台总控已经批准汇入、v1.1.0 已经冻结或其他场景已经完成。`acceptanceReady` 必须继续为
`false`，直至用户和总控完成后续受控确认。
