# CP22 · 成员单位接口人行动路由验证

## 节点身份

- Checkpoint：`CP-S003-20260817220000000-c02222000022`
- 父基线：`v1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式来源运行：`S003-RUN-20260817163000000-c02200000001`
- `acceptanceReady=false`

## 本节点锁定内容

- M01 模型配置仅保留配置总览、调节因子、评分权重和风险分档；企业因子取值继续由独立 T053 输入快照提供。
- 21 家企业的正式评分分布为绿灯 16、黄灯 4、红灯 1、黑灯 0；黄/红/黑按亮灯形成 5 条一企一预警。
- 4 条预警已有 Action Request，3 条等待对应成员单位接口人确认，1 条已由接口人确认并形成负责人待办，另 1 条仍保留为驾驶舱待提交预警候选。
- Action Request 的提交人为集团债务风险管理人员，决策收件人为对应成员单位债务风险接口人；接口人和负责人待办承接人不混同。
- M01—M06 使用 v1.0.3 原生模块路径和公共壳，通过 S003 配置注册、数据投影和条件式适配装入。
- 旧版 Draft / 工作投影隔离保留；历史报告、Action Request、通知、审批和待办不被覆盖或重放。

## 验证范围

1. 干净状态进入 S003，公共壳和 M01—M06 默认入口可用。
2. 旧版 projectionSchemaVersion 不兼容时原位保留并隔离，Published 只读资源仍可消费。
3. M02 默认进入基线数据资源目录；企业债务风险评估模版详情保留概览、快照历史、下载、管道和质量结构。
4. M01 已发布模型可只读展示，模型配置四页签可读取，草稿故障不阻断其他模块。
5. M03 问数、M04 通用决策工作台、M05 Agent 目录和 M06 报告生命周期均沿用基线原生结构。
6. 仪表盘展示评分分布、企业明细、报告穿透、亮灯预警和模型配置入口。
7. 驾驶舱提交后，申请直达成员单位接口人；接口人确认并分办后才形成负责人待办。
8. 历史查看、克隆恢复、隔离回归和快速重跑创建新运行身份且无历史副作用。
9. S001 v1.0.3 冻结树差异为 0，浏览器 console/page/request/HTTP 错误预算为 0。

## 机器证据

- 浏览器结果：`evidence/browser-cp22/20260817T220000000Z-member-unit-routing/browser-cp22-results.json`
- 集成清单：`resources/integration/v103-baseline-extension-inventory.v16.json`
- 定向测试：`scenarios/s003/tests/current-risk-action-routing.test.js`、`scenarios/s003/tests/state-persistence.test.js`
- 生成器校验：`build-report-assets-v9.cjs --check`、`build-agent-position-v7.cjs --check`、`build-baseline-extension-inventory.cjs --check --v16`

## 运行语义

查看历史快照使用原 `scenarioRunId` 且只读；从快照恢复、回归或快速重跑均克隆版本化状态并创建新的 `scenarioRunId`，不得对历史 Action Request、审批、通知或待办产生外发副作用。
