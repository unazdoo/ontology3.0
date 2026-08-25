# S003 CP13 v1.0.3 原生条件式装入终局验证证据

- 验证日期：2026-08-16
- Checkpoint ID：`CP-S003-20260816105200000-c03513000013`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP13-v103-native-conditional-integration-completed`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式来源运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP13`
- 验收边界：`acceptanceReady = false`

## 1. 问题矩阵、根因与修正

| 模块 | 基线路由 / 组件 | 修正前偏差 | 根因 | CP13 锁定的修正 | 影响范围 |
| --- | --- | --- | --- | --- | --- |
| 公共壳 | v1.0.3 首页、六模块 iframe、C033/C034 | 历史 `15/15` 被误当作当前运行健康；模块页面未实际检查仍可呈现完成态 | 历史 Checkpoint 进度与当前运行健康共用静态状态 | 首页初始保持 `checking`；M01—M06 页面级健康逐项回传后才允许显示健康，阻断真实聚合 | 首页、模块状态、验收语义 |
| M01 | `#modeling`、`#published`、原生画布/版本/资源 | 旧 S001 启动投影可能写入 S003 命名空间；M02 Draft 故障可能连带阻断 Published 只读 | 启动顺序与 Draft/Published 读取耦合 | 显式隔离错配启动投影；Published-only 读取独立于 M02 Draft；动态升版保留上一正式组合和回退链 | 本体导航、Published、C008/T019 |
| M02 | `#/resources`、原生数据源详情/管道/质量/资产 | 默认直达 S003 专用页；详情被整页重绘；旧投影 schema 不兼容后静态回退 | 私有 hash、整页适配器及缺失迁移/隔离语义 | 默认进入原生资源目录；工作簿作为原生来源记录；详情只加逻辑成员和企业因子页签；已知迁移、未知隔离并重建 Draft | 目录、详情、保存/校验/发布 |
| M03 | 原问数首页、对话、历史、视图、Agent 配置 | 不兼容工作投影可能被 React 首次 effect 覆盖；模型深链曾指向私有路由 | 主键读取与初始化写入未分离 | 原主键字节保持不变；恢复投影写入 `workspace/state.recovered.v1`；模型进入 M01 原生 Published 深链 | 问数状态、跨模块导航 |
| M04 | 通用决策工作区、Action Request、待办 | state/view/C019 projection 任一坏记录可能被初始化覆盖；恢复键损坏缺少关闭门 | 主键未预检，恢复键缺少独立校验 | 三类主键先预检；坏记录保留，重建写独立恢复键；恢复键自身损坏时 fail-closed | 决策视图、正式写入、副作用安全 |
| M05 | 原 Agent 目录 | S003 投影可能污染共享键或暗示一期专属 Agent | 场景命名空间和能力边界不完整 | 原 Agent 目录保留；S003 只装入一期无专属 Agent 边界；不重算、不自动建单 | Agent 目录、运行门禁 |
| M06 | 报告目录、生命周期、定义/生成/draft/view/pdf | S003 专页可能短路原生报告能力；stale legacy 健康投影可能覆盖 v2；重置自行生成 runId | 专页优先、健康投影优先级和恢复编排分散 | 21 份报告由原生 Provider 注入；仅 `#/dashboard/s003` 为条件式工作台；v2 健康优先；重置/恢复/重跑统一交公共壳创建新 runId | 报告全生命周期、工作台、恢复 |

## 2. 基线功能保留与 S003 装入方式

- M01—M06 一级入口继续装载 v1.0.3 派生原生页面，未恢复 `scenarios/s003/index.html` 独立产品壳。
- S003 使用 `integration-config.js` 注册场景身份、资源、模块入口、Published 版本、工作台与健康合同。
- S003 数据通过原生资源记录、Provider、版本扩展页签、条件式小组件和最小事件桥接进入基线页面，不替换模块根节点。
- M02 保留资源目录、数据源详情、快照、引用、管道、运行历史、质量和数据资产；企业因子填报只是详情扩展页签。
- M01 保留建模画布、Published 目录、版本、资源与生命周期；风险模型参数归 M01，不进入 M02 管道参数或质量规则。
- M03 保留问数首页、对话、历史、视图和 Agent 配置，只消费 Published 事实。
- M04 保留通用决策工作区，Action Request 仍是唯一标准运行入口；无 S003 专属处置页或多级审批。
- M05 保留 Agent 目录；一期无 S003 专属 Agent。
- M06 保留报告目录和完整生命周期；S003 仪表盘是 M06 条件式工作台，不是第七模块。

外部模块集成清单为 `resources/integration/v103-baseline-extension-inventory.v4.json`：

- 清单 ID：`S003-V103-BASELINE-MODULE-INTEGRATION-20260816-CP13`
- 文件数：`41`
- 清单文件 SHA-256：`f0b9e9964bc1e25b14c8628f37037436c0c38c2e337265758f5ec6b0d9da6db7`
- 集成树 SHA-256：`2f4d73ae079e156b730e862679e5462096984b67ee55d36cfe2a4a1003d36055`

## 3. M01 语义版本口径

- `resources/m01/model-package.v1.json` 是根包，`packageVersion = 1.0.0`，不得标记为 `1.0.1`。
- `resources/m01/published-pointer.v1.json` 自身 `pointerVersion = 1.0.0`。
- 当前正式模型 `1.0.1` 仅来自 `published-pointer.v1.json.activeTarget.publishedSnapshot.packageVersion`；其上一正式根包为 `previousTarget.packageVersion = 1.0.0`。
- CP13 浏览器中的动态发布 `1.0.2` 是测试工作投影，用于验证历史保留和 C008 更新，不写回上述不可变 Published 文件，也不提升为正式事实。

## 4. 旧投影迁移与隔离策略

1. 已知 `ofw.s003.browser-projection.v0` 显式迁移到当前结构，并保留迁移回执。
2. 未知 schema 或损坏的 M02 Draft 原记录不删除、不覆盖；标记 incompatible 后从正式 Published 输入重建同一 `scenarioRunId` 下的新 Draft。
3. M03 原工作投影保持原字节，重建内容写入独立逻辑键 `workspace/state.recovered.v1`。
4. M04 state、view、C019 projection 原主键均先预检；不兼容记录保留，重建分别写入 `.recovered.v1`；恢复记录自身损坏时禁止覆盖并 fail-closed。
5. M01 错配的旧 S001 启动投影显式记入恢复历史，再按当前 S003 场景上下文重建；M02 Draft 故障不阻断正式 Published 只读。
6. 历史 Checkpoint、Published 事实、报告、Action Request、通知和负责人待办不删除、不覆盖；历史查看、恢复、回归和重跑不得重放副作用。

## 5. 自动化与静态验证

- Node 自动化：`207 / 207` 通过，`0` 失败。
- M02 `verify-static.mjs`：通过。
- JavaScript `node --check` 与仓内 Babel React/JSX 解析：通过。
- `git diff --check`：通过。
- v1.0.3 冻结目录差异：`0`；冻结树未写入。
- CP01—CP12 manifest 与 sidecar 保持不可变，CP13 仅追加新清单、入口和证据。

## 6. 真实 Chromium 验证

### 6.1 CP13 全树与页面级健康（11 / 11）

- 结果：`evidence/browser-cp13/20260816T104940531Z-f98ae7af/browser-cp13-results.json`
- SHA-256：`be7ff1285b1951f0885538961e52ae70ea08afd2ce11d09fddb4d5d481623930`
- Chromium：`149.0.7827.55`
- 覆盖：首页健康门、M02 原生详情、M03/M04 不兼容投影、M01 旧启动投影与动态 Published、M06 原生路由/v2 健康优先/统一重置、模块失败回传、S001 六模块隔离。
- 错误预算：`console=0 / page=0 / request=0 / HTTP>=400=0`。

### 6.2 兼容、恢复与副作用（10 / 10）

- 结果：`evidence/browser-cp12/20260816T102927794Z-ca987471/browser-cp12-results.json`
- SHA-256：`47820b6fc2c9f10b5d185cfc8f33643793d7ab8a59f6886f9f11cc8b332718f0`
- 覆盖：干净态、legacy v0、未知 schema、M02 Draft/M01 Published 解耦、M01—M06 原生导航、S001 隔离、历史查看、克隆恢复、隔离回归、快速重跑。
- 错误预算：`console=0 / page=0 / request=0 / HTTP>=400=0`。

### 6.3 原生页面和企业穿透（4 / 4）

- 结果：`evidence/browser-surface/20260816T102948990Z-d398429c/browser-surface-results.json`
- SHA-256：`d67106d403527a2c9c946c1aef2fd76e728507fda4d3a34b4d67a150a8ae8a0d`
- M02：默认原生资源目录；工作簿详情保留 `detail-hero / tabs / detail-grid`；企业因子填报保留 119 个选择控件。
- M01：原生 Published 版本与模型配置页签；45 个权重输入、22 个因子系数输入、8 个阈值边界输入。
- M03：模型包真实穿透到 M01 原生 Published 路由。
- M06：21 家企业评分明细、报告穿透及同一 `scenarioRunId`；未混入 S001 融资单位内容。

截图 SHA-256：

- `m02-detail.png`：`6e8be7764cf086bcf5646d2e426bb851470dd1fc3b1b5b962fbe2149780a79c7`
- `m01-published-config.png`：`da2185d0f5f9bcfe9d7512c1cdf81e5aab978e82ee2c8d831e948652649b7498`
- `m03-to-m01-deep-link.png`：`e2661c978bc2e767017e6c2ba71a7a87516eae49b601c8b4618e42e3599e95d5`
- `m06-dashboard-report.png`：`36c5931f78bd6b413067cf0ce44d87c1147fbc7238ac7a698dbc1826be2a774a`

### 6.4 修正前失败证据保留

- 早期失败结果继续保留于 `evidence/browser-cp13/20260816T103742191Z-2234f1aa/browser-cp13-results.json`，SHA-256 为 `d0de536d494f255753eb1ae4973c085d191925fa46162aa1f1648f908e6638d3`。
- 该次运行真实记录 M04 不兼容投影恢复超时（`1 / 2` 通过），没有被删除、改写或伪装成成功；修正后的 `11 / 11` 结果使用新的证据目录和运行 ID。
- 对应失败截图 `m04-incompatible-projections.png` 的 SHA-256 为 `2fb3e3559078a9d5681e62e972dc26cfd2f6fdf975fbf3b54bbb7e45d1d6f58d`。

## 7. M01—M06 逐模块结论

| 模块 | 结果 | 锁定结论 |
| --- | --- | --- |
| M01 | 通过 | 原生导航、画布、Published、版本与资源保留；正式只读与 M02 Draft 解耦；动态升版保留历史组合 |
| M02 | 通过 | 默认原生资源目录；工作簿复用原生详情结构；因子为扩展页签；管道/质量/资产能力保留 |
| M03 | 通过 | 原问数首页、对话、历史、视图和 Agent 配置保留；不兼容原投影不被覆盖；只消费 Published |
| M04 | 通过 | 通用决策工作区保留；三类投影独立恢复；非 active 和坏恢复记录 fail-closed |
| M05 | 通过 | 原 Agent 目录保留；一期无专属 Agent；禁止重算和自动创建 Action Request |
| M06 | 通过 | 原报告目录、Provider 和生命周期保留；工作台条件式装入；恢复/重置/重跑委托公共壳 |

## 8. S001 非回归与不可变保护

- CP13 浏览器用例真实打开 S001 首页和 M01—M06，六模块均保持 S001 上下文且未出现 S003 条件装入资源。
- S003 历史、恢复、回归、重跑不会改写 S001 固定状态键、Action Request、待办或报告。
- `designs/prototype-releases/v1.0.3/` 差异为 `0`。
- CP01—CP12 的 manifest、sidecar、来源运行和历史证据保持不变。

## 9. 尚存限制与验收边界

- 当前是浏览器原型、本地数据夹具与版本化证据，不是生产数据库、消息总线、组织权限或外部通知联调。
- 一期不建设多用户、经办/审批权限、多级审批、S003 专属 Agent 或专属处置页面。
- CP13 不把浏览器测试产生的 Draft、动态 `1.0.2`、恢复、回归或重跑投影提升为正式 Published 事实。
- Checkpoint 自身 manifest 不能纳入自身代码树哈希；CP13 通过独立 entry、manifest、sidecar 和 evidence 完成封存。
- 封存后的复验结果只能作为 post-seal 追加证据，不反向改写 CP13。
- `acceptanceReady` 继续为 `false`；仍待用户正式验收和总控受控汇入。
