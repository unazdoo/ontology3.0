# S003 CP21：v1.0.3 原生装入与 v7 报告浏览器回归

- 形成时间：2026-08-17T19:30:00.000Z
- 父基线：v1.0.3 / BSL-S001-V103-DE0119608E26
- 场景身份：S003 / S003-v1
- 正式来源 scenarioRunId：S003-RUN-20260815133000000-c03503000001
- prototypeVersion：1.1.0
- acceptanceReady：false

## 本轮锁定内容

- v1.0.3 六模块原生入口、导航、列表、详情、画布、生命周期与通用操作保持可用；S003 仅通过配置注册、条件式适配和数据驱动资源装入。
- 仪表盘风险分档增加绿灯、黄灯、红灯、黑灯颜色—分档—业务含义图例，并保留产业风险与集团共性薄弱指标独立分析和下钻。
- 21 家企业正式报告切换为 M06 v7 内容 / 制品 / 清单，评分、风险分档、因子系数、行动状态和 scenarioRunId 与 C035 同轮结果保持一致。
- M05 报告伴读场景配置切换为 v5；不重算评分、不创建 Action Request、不替代人工确认。
- 历史报告、形成时复核、当前跨模块核验和下载 HTML 均保持同源报告内容；旧版本 v1—v6 保留不可变。
- 旧版或不兼容 Draft 投影原位保留为 incompatible projection，从正式 Published 输入重建当前工作投影；不清空浏览器数据、不覆盖历史证据、不跨运行消费。

## 真实 Chromium 回归

证据文件：`evidence/browser-cp21/20260817T193000000Z-7741b424/browser-cp19-results.json`

| 用例 | 结果 |
|---|---|
| shell-and-modules | PASS |
| m02-native | PASS |
| m01-canvas | PASS |
| m01-published-config | PASS |
| m03-m04-m05 | PASS |
| dashboard-and-report | PASS |
| dashboard-action-and-config | PASS |
| old-projection-compatibility | PASS |
| quick-rerun-and-history | PASS |
| s001-isolation | PASS |

- Chromium 用例：10 / 10
- console error：0
- page error：0
- request error：0
- HTTP 4xx/5xx：0
- M02 数据源目录、数据源详情、快照下载、管道节点和鼠标滚轮缩放：通过
- M01 本体画布节点、Published 配置、数据沿袭详情和鼠标滚轮缩放：通过
- M03 推荐问题、问数答案和历史会话：通过
- M04 通用决策工作台、Action Request、负责人待办和报告下钻：通过
- M05 Agent 目录与报告伴读边界：通过
- M06 仪表盘、正式报告、目录滚动、问答清空、自动核验、HTML 下载、报告定义和模板下载：通过
- 旧投影兼容、快速重跑、历史查看、克隆恢复、回归隔离和 S001 非回归：通过

## Node 合同回归

- `node --test` 全量：300 / 300 passed
- S003 业务与资源测试：报告 v7 确定性、C035 逐户评分一致、报告正文可读性、历史链、M01—M06 合同和场景隔离全部通过。

## 资源哈希

- `c9a34e667fad7df98b759a621d2f4f3b877b311d4b90eba70899130c3160c744` · `resources/integration/v103-baseline-extension-inventory.v12.json`
- `02db37c4cd68cea2811a7282612e8d6baacaaa7dbc9b340e2e6833bb6d230dfd` · `resources/m06/report-contents.v7.json`
- `56560ccd114ee45801b1fa8b2394c9bd905161fcb6efb404c0d2ddb263e860ce` · `resources/m06/report-artifacts.v7.json`
- `09bf2888ff119149fa2b2fbab1d6aa2679c930490a05362d5576ec2c6f87c8ff` · `resources/m06/report-manifest.v7.json`
- `42198af1edeb0c678a3dde7b57de1d5c8071e1a6cf883599c3ced7e6e7fd9416` · `resources/m06/report-history-index.v2.json`
- `b42c32118d2592b7d17a05066ab23a00cb70c5d59885adfc14937270eee7c2d5` · `resources/m05/agent-position.v5.json`
- `8ed471d3f1ce5473fc496cf6669ef8dd6f590651dce0b99aaee6c625bf212236` · `evidence/browser-cp21/20260817T193000000Z-7741b424/browser-cp19-results.json`

## 边界

- CP01—CP20、S001 v1.0.3 冻结目录和既有历史证据保持不可变。
- CP21 不把浏览器工作投影提升为正式 Published 事实，不创建新的 Action Request、审批、通知或负责人待办。
- `acceptanceReady` 继续为 `false`，仍待用户正式验收和总控受控汇入。
