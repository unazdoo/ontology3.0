# S003 CP12 v1.0.3 原生模块装入全面修正验证证据

- 验证日期：2026-08-16
- Checkpoint ID：`CP-S003-20260816094500000-c03512000012`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP12-v103-native-integration-corrected`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式来源运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP12`
- 验收边界：`acceptanceReady = false`

## 1. 问题矩阵与根因

| 模块 | 基线路由 / 组件 | 修正前 S003 装配偏差 | 根因 | 实际修正 | 影响范围 |
| --- | --- | --- | --- | --- | --- |
| 公共壳 | v1.0.3 场景壳、六模块 iframe、运行快照 | 首页把历史 `15/15` 直接显示为当前运行健康；模块故障时仍可能显示全部确认 | 历史 Checkpoint 完成度与当前运行健康使用同一静态投影 | 新增 `projectionHealth/runtimeHealth`，首页分别展示历史节点、当前健康和阻断原因；`acceptanceReady` 始终为 `false` | 首页、模块状态、验收语义 |
| M02 | `#/resources`、资源目录、数据源详情、管道、质量、资产 | 默认直达 S003 专用工作簿；查看详情由适配器整页重绘 | 私有默认 hash 与整页适配器抢占基线入口 | 默认恢复 `#/resources`；S003 工作簿注册为原生来源记录；详情继续使用基线 Hero、页签、快照、引用、管道、质量与资产生命周期，仅增加企业因子页签 | 数据源目录、详情、因子填报 |
| M02 状态 | 当前 Draft 工作投影 | `browser-projection.v0` 或未知 schema 导致初始化失败，退回静态初始状态 | 没有显式迁移、隔离与恢复回执 | 已知 v0 显式迁移；未知/损坏投影原样保留并标记 incompatible，在同一 `scenarioRunId` 下从正式 Published 输入重建 Draft | 旧浏览器状态、保存/校验/发布 |
| M01 | `#modeling`、`#published`、原生版本/资源/画布 | S003 私有路由、整页重绘；M02 Draft 故障会连带显示“场景资源未装载” | M01 Published 读取错误依赖 M02 当前 Draft 运行时 | S003 模型注册为原生 Published 本体版本；模型配置为版本扩展页签；Published-only 读取独立于 Draft，错误提示展示真实原因 | 本体建模、Published、模型配置 |
| M01 生命周期 | 原生 Published 版本、C008/T019、回退链 | 动态模型升版可能只保留当前投影，C008 仍为空或陈旧；重置可能回退静态 1.0.1 | 当前配置投影未保留上一正式组合，C008 使用固定键 | 记忆 `priorFormalSnapshot`；保留旧版本和回退链；动态重建 Published pointer；S003 C008 按 `scenarioRunId` 隔离；重置继承当前 Published 模型 | 模型升版、正式组合、回退与追溯 |
| M03 | 原问数首页、对话、历史、视图、Agent 配置 | S003 模型详情仍指向废弃私有 hash；非 M01 语义资源也可能生成伪深链 | 适配器覆盖了基线深链但未使用原生 Published 路由 | 模型包打开 M01 `#published/ontology?id=...&version=...`；C035、事实集与 M03 运行证据不伪装成 M01 语义资源链接 | 语义资源、证据详情、跨模块导航 |
| M04 | 通用决策工作区、Action Request、负责人待办 | 非 active / 历史 / 回归状态的写入口和存储隔离不足 | 固定键与状态门未覆盖全部入口 | 状态、视图和 C019/Action Request 按 `scenarioRunId` 隔离；所有非 active 状态 fail-closed；重跑交公共壳 | 决策、待办、副作用安全 |
| M05 | 原 Agent 目录与运行/协作能力 | S003 投影可能使用共享键，坏投影可能覆盖；一期边界不完整 | 场景投影和写门未统一 | 按运行身份命名空间；坏投影原位隔离并只读；保留原 Agent 目录，仅显示一期无专属 Agent 边界 | Agent 目录、投影、运行门禁 |
| M06 | 报告目录、生命周期、定义、生成与正式报告 | 可能继承 S001 融资单位数据、私有跨模块链接或本地生成恢复 runId | S003 状态初始化和导航未完全委托公共壳 | 21 份 S003 报告进入原生目录与生命周期；工作台条件式装入；跨模块导航、恢复、重跑全部委托公共壳；旧投影保留，新投影使用版本化键 | 仪表盘、报告、恢复、重跑 |
| 公共恢复 | C034 查看、克隆恢复、隔离回归 | 模块可自行生成 runId 或重放历史副作用 | 恢复编排未统一收口 | `requestScenarioRestore → cloneRestore` 仅由公共壳生成新 `scenarioRunId`；历史 Action Request、审批、通知和待办不重放 | 快照、恢复、回归 |

## 2. 基线功能保留方式

- M01—M06 一级入口继续装载 v1.0.3 派生原生页面，不返回 `scenarios/s003/index.html`。
- M01 保留建模首页、草稿、Published 目录、版本选择、资源列表、画布、数据与消费、更新与回退、记录与证据。
- M02 保留数据资源目录、卡片/列表切换、数据源详情、快照、引用、数据管道、运行历史、质量与数据资产。
- M03 保留原问数首页、对话、历史会话、问数视图和 Agent 配置。
- M04 保留通用决策工作区；S003 不新增专属处置页或多级审批。
- M05 保留原 Agent 目录；一期仅增加“无专属 Agent”能力边界提示。
- M06 保留报告目录、定义、生成、核验、发布和生命周期；S003 工作台是条件式导航项，不是第七模块。

## 3. S003 配置化装入方式

- 场景注册：`scenarios/s003/integration-config.js`。
- 场景身份：`S003 / S003-v1 / S003-RUN-20260815133000000-c03503000001`。
- 模块装入：资源记录、原生 Published 版本、版本扩展页签、原工作区只读投影、条件式边界卡、M06 场景工作台。
- 跨模块操作：复用 `ontology3.0-scenario-shell-v1` 与 v1.0.3 既有 C033/C034 语义；不建立 S003 私有一级壳或私有交接频道。
- 外部模块集成清单：`resources/integration/v103-baseline-extension-inventory.v3.json`，`treeSha256=e75f7cd7b549be4fc2ba9692c7af2041dc66818289c836ceb9cea6276f7b0050`。

## 4. 旧投影迁移与隔离

1. `ofw.s003.browser-projection.v0`：显式迁移到 v1，形成 `migrate-known-schema / completed` 回执。
2. 未知 schema 或内容损坏：原始 raw 保留在恢复回执，状态标记 `isolated-rebuilt`，不得静默当作从未形成。
3. 新 Draft 从正式 Published 模型、人工输入和同轮权威资源重建，继续使用原 `scenarioRunId` 与命名空间。
4. 历史 Checkpoint、Published 事实、报告、Action Request 和待办不删除、不覆盖。
5. 单模块 Draft 故障只阻断该模块写操作；M01 Published、M03/M06 正式只读资源不被无关草稿连带阻断。

## 5. 自动化验证

- Node 自动化：`197 / 197` 通过，`0` 失败。
- M02 静态验证：`verify-static.mjs` 通过；`方案B2.html` 唯一入口构建哈希前缀 `8ec0c8705512`。
- `node --check`：公共壳、M01、M02、M03 及 CP12 浏览器脚本通过。
- `git diff --check`：通过。
- v1.0.3 冻结树：与修正前保护性哈希逐文件一致；汇总清单 SHA-256 为 `9e5be9d04b059e720c9fa3f5be32e7a9b09da65f487c4611eefc539fda1cdd14`。
- CP01—CP11：与修正前保护性哈希逐文件一致；汇总清单 SHA-256 为 `382773b691405c2c42eb4e71762109322d85b8a2ef69f92f7c6762a4c518db2f`。

## 6. 真实 Chromium 回归

### 6.1 运行兼容与副作用（10 / 10）

- 结果：`evidence/browser-cp12/20260816T091616108Z-b9ebfde9/browser-cp12-results.json`
- SHA-256：`66d9c4fab8a5acaf8fac0d265b09fe869ddb33160a7bbf5890b84b2a02f6ee28`
- Chromium：`149.0.7827.55`
- 覆盖：干净态、legacy v0、未知 schema、M02 Draft/M01 Published 解耦、M01—M06 原生导航、S001 隔离、历史查看、克隆恢复、隔离回归、快速重跑。
- 错误预算：`console=0 / page=0 / request=0 / HTTP>=400=0`。

### 6.2 原生页面与穿透（4 / 4）

- 结果：`evidence/browser-surface/20260816T093259315Z-95d411b9/browser-surface-results.json`
- SHA-256：`e862681ffbcd4d383f08c0e0e378a7d7caa9d7ffea290102a84e7463f40b0927`
- M02：默认资源目录；S003 工作簿详情保留 `detail-hero / tabs / detail-grid`；企业因子填报 119 个选择控件。
- M01：原生 Published 版本与模型配置页签；45 个权重输入、22 个因子系数输入、8 个阈值边界输入。
- M03：模型包详情真实打开 M01 原生 Published 深链。
- M06：风险工作台、21 家企业评分明细、企业报告穿透与同一 `scenarioRunId`；未出现 S001 融资单位内容。
- 截图：
  - `m02-detail.png`：`85cc8971be3efd3de25cba572335121203b2fdb88df461027acac47975b3f0d5`
  - `m01-published-config.png`：`da2185d0f5f9bcfe9d7512c1cdf81e5aab978e82ee2c8d831e948652649b7498`
  - `m03-to-m01-deep-link.png`：`e2661c978bc2e767017e6c2ba71a7a87516eae49b601c8b4618e42e3599e95d5`
  - `m06-dashboard-report.png`：`f7ed67fc4cc1bce73503ff794a4d8d44a829f11d0c54bdfe86420bc44ade2603`

## 7. M01—M06 逐模块结论

| 模块 | 结果 | 关键证据 |
| --- | --- | --- |
| M01 | 通过 | 默认原生建模页；Published 版本可见；配置页签可写；Draft 故障不阻断正式只读；动态升版保留旧正式组合 |
| M02 | 通过 | 默认原生目录；工作簿原生详情；因子扩展页签；管道/质量/资产能力保留；不计算风险模型参数 |
| M03 | 通过 | 原问数工作台、历史、视图和 Agent 配置保留；Published-only；模型深链进入 M01 原生路由 |
| M04 | 通过 | 通用决策工作区；Action Request 唯一入口；非 active 和工作投影禁止正式写入 |
| M05 | 通过 | 原 Agent 目录；一期无专属 Agent；非 active/坏投影只读，禁止重算和自动建单 |
| M06 | 通过 | 原报告目录和生命周期；S003 工作台条件式装入；21 份报告及企业穿透；恢复/重跑委托公共壳 |

## 8. S001 非回归与冻结保护

- S001 默认入口仍使用 `S001-RUN-*`，未混入 S003 运行历史。
- S001 状态、视图与 C019 三个固定键在 S003 重跑、历史、恢复和回归前后保持原值。
- S001 报告中心不显示 S003 工作台；S003 不复制 S001 融资指标、规则、Action 或报告内容。
- `designs/prototype-releases/v1.0.3/` 差异为 0。

## 9. 尚存限制与验收边界

- 当前是浏览器原型与本地版本化证据，不是生产数据库、生产消息、真实组织权限或外部通知联调。
- 一期不建设多用户、经办/审批权限、多级审批、S003 专属 Agent 或专属处置页面。
- CP12 不把浏览器测试产生的 Draft、恢复、回归或重跑投影提升为正式 Published 事实。
- CP12 是终端快照，不能把自身 manifest 纳入自身代码树哈希；运行中的快照页继续列出其形成前的 CP01—CP11，CP12 通过独立 entry、manifest 和 evidence 查看。
- `acceptanceReady` 继续为 `false`；仍需用户正式验收和总控受控汇入。

