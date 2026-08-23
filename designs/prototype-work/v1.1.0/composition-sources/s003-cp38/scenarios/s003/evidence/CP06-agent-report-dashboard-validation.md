# CP06 工作台与正式报告联合验证

- 形成时间：2026-08-15T15:19:00.000Z
- 父基线：`1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 场景版本：`S003-v1`
- 原型版本：`1.1.0`
- 权威运行：`S003-RUN-20260815133000000-c03503000001`
- Checkpoint 节点：`agent-report-dashboard-completed`

## 联合验证结论

- S003 工作台保持在 M06 场景能力内，未新增第七个一级模块。
- M05 一期保持“无专属 Agent”；评分、报告生成和业务写入均不由 Agent 重算或代办。
- 工作台已展示 21 家企业及绿 16、黄 4、红 1、黑 0 的 Published C035 风险分布。
- “运行与报告”视图展示当前成功运行、21 份企业报告和上一成功运行保护说明。
- 从风险总览可穿透至 `S003-ENT-020` 正式报告；报告展示 23.05 分、红灯、15 项指标、6 项调节因子、关键风险、人工确认状态及完整版本身份。
- 报告页面显示 `scenarioId=S003`、`scenarioVersion=S003-v1`、`prototypeVersion=1.1.0` 和精确 `scenarioRunId`。
- 报告清单、内容集和 HTML/打印制品均为不可变资源，并以独立内容哈希和制品哈希追溯。
- 报告生成未新增 Action Request、负责人待办、通知或审批；CP05 已人工确认的 1 条决策状态仅作为只读报告内容引用。

## 浏览器只读联调

- 地址：`http://127.0.0.1:4333/scenarios/s003/`
- 页面标题：`S003 债务风险监测 · 智财问策`
- 风险总览：21 家；平均分 52.23；绿 16、黄 4、红 1、黑 0。
- 运行与报告：`21 / 21` 份；HTML / Print；当前运行与报告运行身份一致。
- 报告穿透：`#report/S003-ENT-020`；企业“环保测试公司4”；红灯；最终分 23.05。
- 浏览器控制台 warning/error：0。

## 自动验证

- `node --check data.js state.js app.js`：通过。
- `node --check domain/report-service.js scripts/build-report-assets.cjs`：通过。
- `node scripts/build-report-assets.cjs --check`：通过。
- `node --test tests/*.test.js`：68 / 68 通过。
- Draft、错误场景身份、错误 runId、事实不一致和不可变资源覆盖均由测试阻断。

## UI 与报告资源哈希

- `646b28b5fdf7d121d0eff66da6b7eb779e6920b3e14f9527727f42b2c1d3b239  index.html`
- `a67bba643479f746dec6276959e7bf67bdc64bc5298519ad4004335391f5230a  app.js`
- `77e89e86c6ce7902ab32f23e2888090444169e2f880a67e9891a0f4ae9563e88  data.js`
- `9f21864b571d14d6a212842dfed0e4edd40023cbc7eee681ced073ce7179e221  state.js`
- `5ca25b2ac6315f6bdde788830c015c75d74542dff2f59f7bf17183394436e9f6  styles.css`
- `9c66af15d0e854d0950ae62c58c3bf75641a0c53a17cf22fc99d7b75a5c00f3a  domain/report-service.js`
- `7c6e732bcdefa4105341e83642ef98401cb96a3d997ee355759f676c2b003af0  scripts/build-report-assets.cjs`
- `0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d  resources/m06/report-manifest.v1.json`
- `ffa14290df718b0283df9714a7d519d1a74f75c1ee6d506ea60a7dca75835df6  resources/m06/report-contents.v1.json`
- `25d4d254055bcd598de62c9a2c2dd789430ac5918fdc48adfc5500dcd4808a8b  resources/m06/report-artifacts.v1.json`
- `792e3aa55b648319929de679dc2795c68bb13e40b557c9d9e7e4605c5dc77e5e  evidence/CP06-report-validation.md`

## 恢复与非回归边界

- CP06 历史查看只读使用原 `scenarioRunId`。
- 从 CP06 恢复时必须克隆为新的 `scenarioRunId` 和隔离命名空间，不得覆盖当前报告或 CP01—CP05。
- 回归运行默认关闭历史 Action Request、审批、通知、待办和外发重放。
- CP06 不修改 S001 v1.0.3 冻结基线，也不改变 M01—M06 资源 Owner。
