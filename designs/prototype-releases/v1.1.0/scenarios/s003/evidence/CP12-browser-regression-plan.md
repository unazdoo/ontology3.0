# S003 CP12 浏览器回归测试方案与执行口径

> 本文件是 CP12 前置测试方案与证据格式，不是 Checkpoint，也不表示 CP12 已创建。
> 生产代码、Published 指针、历史 `scenarioRunId` 和既有 Checkpoint 均不由本脚本修改。

## 1. 运行入口

- S003：`http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home`
- S001 隔离回归：`http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S001#home`
- 静态服务根：`designs/prototype-work/v1.1.0`
- Playwright：`/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules/playwright`

生产代码稳定后执行：

```bash
python3 -m http.server 4333 --directory designs/prototype-work/v1.1.0
node designs/prototype-work/v1.1.0/scenarios/s003/scripts/browser-cp12.cjs \
  --base-url 'http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home'
```

只查看测试清单，不启动浏览器：

```bash
node designs/prototype-work/v1.1.0/scenarios/s003/scripts/browser-cp12.cjs --list
```

## 2. 稳定选择器

| 用途 | 选择器 / 读取方式 |
|---|---|
| 当前场景 | `.scenario-workspace` |
| M01—M06 一级入口 | `.nav-item[data-route="#module/<id>"]` |
| 原生模块 iframe | `#module-frame` |
| iframe 场景身份 | `#module-frame[data-scenario-id="S003"]` |
| S003 运行状态 | `window.S003Store.getRuntimeSnapshot()` |
| S003 正式资源 | `window.S003Store.getPublishedResourceSnapshot()` |
| 公共壳当前身份 | `window.S001_STORE.getScenarioContext()` |
| Checkpoint 清单 | `window.S003Store.getBundle().checkpoints` |

模块路径断言：

| 模块 | 允许路径 | 页面关键文本 |
|---|---|---|
| M02 数据工程 | `data-engineering-prototype-review/review-v3/方案B2.html` | 数据工程、调节因子 |
| M01 本体管理 | `ontology-management-review/canvas-first/index.html` | 本体建模（默认页保持基线原生）；S003 模型另走原生 Published 深链 |
| M03 智能问数 | `intelligent-query-prototype/review-next/conversation-workspace/index.html` | 智能问数、Published |
| M04 决策中心 | `decision-center-prototype/index.html` 或 `review-v2/action-portfolio.html` | 决策中心、待我决策 |
| M05 Agent 应用 | `agent-application/Agent应用.html` | Agent、一期不建设专属 Agent |
| M06 报告中心 | `report-center/review-lifecycle/index.html` | 报告中心、S003 |

所有模块必须继续在 v1.0.3 派生原生页面中运行；路径不得回到
`scenarios/s003/index.html` 或场景独立运行页。

## 3. 十组运行兼容用例

1. **干净态**：正式运行身份、Published 权威模式和运行健康均正常。
2. **legacy v0**：把合法 M02 Draft 的 `projectionSchemaVersion` 改为
   `ofw.s003.browser-projection.v0`；刷新后必须显示 `migrated`，形成
   `migrate-known-schema / completed` 恢复回执。
3. **未知 schema**：注入 `ofw.s003.browser-projection.v999`；原始记录必须写入恢复回执，
   当前 Draft 从正式输入重建为 `isolated-rebuilt`。
4. **M02 Draft 异常 / M01 Published**：在 M02 Draft 中注入未知企业；M02 被隔离重建，
   M01 Published `1.0.1` 和 active pointer 仍可独立读取。
5. **M01—M06 原生导航**：逐一点击公共壳一级导航，校验 iframe 路径、关键文本和 S003 身份。
6. **S001 无泄漏**：S003 快速重跑后切换 S001，S001 仍使用 `S001-RUN-*`；三个 S001 固定键保持原值。
7. **历史查看无副作用**：历史模式下确认决策必须被拒绝。
8. **克隆恢复无副作用**：新 `scenarioRunId`、`status=restored`，确认决策必须被拒绝。
9. **隔离回归无副作用**：`status=regression`、`authorityMode=isolated-regression`、
   `projectionOnly=true`，确认决策必须被拒绝。
10. **快速重跑无副作用**：`authorityMode=published-runtime`、`projectionOnly=true`，
    M04 正式消费与确认必须被拒绝。

恢复和回归用例从当前已加载的 Checkpoint 逆序选择第一个通过精确哈希门的节点；如没有可恢复节点，
用例失败，不静默降低为历史查看。

## 4. 副作用核验

每个操作前后递归扫描浏览器存储，比较：

- `actionRequestId`；
- `todoId`；
- `notificationId`；
- `approvalId`；
- `actionRequestCreated/todoCreated/notificationSent/approvalCreated/dispatchTriggered=true`；
- S001 固定状态、视图和 C019 键。

允许恢复、回归和重跑形成新的隔离 M01/M02/M04/M06 投影键，但不得新增上述业务副作用身份或真值。

## 5. 浏览器错误预算

每组用例均独立创建 BrowserContext，并强制：

- `console error = 0`；
- `page error = 0`；
- 非主动导航取消的 `requestfailed = 0`；
- `HTTP >= 400 = 0`。

主动导航产生的 `ERR_ABORTED/NS_BINDING_ABORTED` 单独记录为
`ignoredAbortedRequests`，不计为应用请求错误。

## 6. 原生页面与穿透补充用例

另执行 `scripts/browser-s003-surface.cjs`，覆盖：

1. M02 默认资源目录、S003 工作簿原生详情结构与 119 个企业因子选择控件；
2. M01 原生 Published 本体版本、模型配置页签、45 个权重输入、22 个因子系数输入和 8 个阈值边界输入；
3. M03 模型包“查看详情”真实打开 M01 `published/ontology` 原生深链；
4. M06 场景工作台、21 家企业评分明细和企业报告穿透，并验证无 S001 融资内容泄漏。

## 7. 证据输出

脚本执行后写入唯一目录：

```text
evidence/browser-cp12/<UTC时间>-<随机后缀>/
├── browser-cp12-results.json
├── clean-state.png
├── legacy-v0.png
├── unknown-schema.png
├── m02-draft-m01-published.png
├── native-navigation.png
├── s001-isolation.png
├── historical-no-side-effects.png
├── restore-no-side-effects.png
├── regression-no-side-effects.png
└── rerun-no-side-effects.png
```

结果 JSON 固定记录 Git HEAD、浏览器版本、入口 URL、每组用例详情、截图、错误明细和汇总计数。
只有十组全部通过且四类错误均为 0，才可由后续流程把该次结果纳入 CP12；本脚本本身不创建 CP12。

原生页面与穿透补充证据写入：

```text
evidence/browser-surface/<UTC时间>-<随机后缀>/
├── browser-surface-results.json
├── m02-detail.png
├── m01-published-config.png
├── m03-to-m01-deep-link.png
└── m06-dashboard-report.png
```

CP12 必须同时引用十组运行兼容结果和四组原生页面/穿透结果；任一失败均不得形成 CP12。
