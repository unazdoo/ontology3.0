# CP07 端到端联调与恢复语义验证

- 形成时间：2026-08-15T16:30:00.000Z
- 父基线：`1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 冻结标签：`prototype-v1.0.3-frozen`
- 冻结提交：`ea69e9ad3bceef93b000e6f3ddc639ab093e2515`
- 场景版本：`S003-v1`
- 原型版本：`1.1.0`
- 正式 C035 运行：`S003-RUN-20260815133000000-c03503000001`
- Checkpoint 节点：`e2e-integrated`

## 联调结论

- CP07 继续以 CP06 的正式 C035 运行作为当前权威成功运行，没有把恢复、回归或失败尝试改写为正式结果。
- M01—M06 精确导出、21 家 Published C035 结果、21 条 Published 风险事实、六项固定问数结果、通用决策状态、21 份正式企业报告与 M06 场景工作台已纳入同一封存边界。
- S003 工作台仍归 M06 场景能力，M05 一期保持无专属 Agent，没有新增第七个一级模块、专属处置页、多用户权限或多级审批。
- CP01—CP06 均保持原文件和独立 SHA；CP07 只追加新的入口、证据和不可变清单。

## 场景身份与快照运行证据

| 验证项 | operationId | 来源 | 结果 |
|---|---|---|---|
| 历史查看 | `OP-S003-20260815160000000-c03507000001` | 正式 C035 run | 保留原 `S003-RUN-20260815133000000-c03503000001`，状态为 `historical-readonly`，命名空间只读 |
| 克隆恢复 | `OP-S003-20260815160100000-c03507000002` | CP06 | 新建 `S003-RUN-20260815160100000-272c73e4c748` 和独立命名空间，不覆盖来源 |
| 隔离回归 | `OP-S003-20260815160200000-c03507000003` | CP06 | 新建 `S003-RUN-20260815160200000-151103697d6b`，模式为 `isolated-regression` |
| 失败重评 | `OP-S003-20260815160300000-c03507000004` | 上一成功运行 | 尝试 run 为 `S003-RUN-20260815160300000-58f834ed887a`；注入失败后成功指针仍指向正式 C035 run |
| 失败重试 | `OP-S003-20260815160500000-c03507000005` | 失败尝试 run | 新建 `S003-RUN-20260815160500000-90b11c72f26d` 和新的隔离命名空间 |

命名空间验证：

- 历史来源：`ofw:v1.1.0:S003:S003-v1:S003-RUN-20260815133000000-c03503000001`
- 克隆恢复：`ofw:v1.1.0:S003:S003-v1:S003-RUN-20260815160100000-272c73e4c748`
- 隔离回归：`ofw:v1.1.0:S003:S003-v1:S003-RUN-20260815160200000-151103697d6b`
- 失败重试：`ofw:v1.1.0:S003:S003-v1:S003-RUN-20260815160500000-90b11c72f26d`

## 阻断、幂等与副作用边界

- 将资源 runId 替换为 `S003-RUN-20260815160600000-deadbeef1234` 时，服务返回 `S003_CHECKPOINT_IDENTITY_MISMATCH`，拒绝读取或写入。
- 相同 `operationId=OP-S003-20260815160100000-c03507000002` 重放克隆恢复时，返回同一个不可变恢复回执和同一个目标 runId；同一 operationId 改作其他操作会返回 `S003_CHECKPOINT_OPERATION_CONFLICT`。
- 隔离回归明确关闭 `actionRequest`、`approval`、`notification`、`ownerTodo` 和 `externalDispatch`。
- 公共副作用策略同时保持 `allowHistoricalActionRequestReplay=false`、`allowHistoricalApprovalReplay=false`、`allowHistoricalNotificationReplay=false`、`allowHistoricalTodoReplay=false`、`allowExternalDispatch=false`。
- 失败重评返回 `previousSuccessfulRunPreserved=true`；只有新的重试运行成功后才允许切换上一成功指针。

## M01—M06 精确导出

| 模块 | 版本 | exportId | 导出引用 | SHA-256 |
|---|---|---|---|---|
| M01 | `1.0.1` | `S003-M01-RUNTIME-EXPORT-20260815-001` | `resources/m01/runtime-export.v1.json` | `7d0d3d65fc89688d4b2d839218245251c6b53ca28f5f171273b1e532a8ba4c60` |
| M02 | `1.1.0` | `S003-M02-DATA-CONTRACT` | `resources/m02/data-contract.v1.1.json` | `0de2eba3f36b1f7f14007fc5039df5de9a6b97a3f032c23b4e4e298079a5c8a2` |
| M03 | `1.0.0` | `S003-M03-QUERY-RUNTIME` | `resources/m03/query-runtime.v1.json` | `4680d2f78295d12a76acde3bc7ddcd66338aa51e727beb1bd98bb8be0294e6e6` |
| M04 | `1.0.0` | `S003-M04-DECISION-RUNTIME` | `resources/m04/decision-runtime.v1.json` | `0bee1570bb2c64367a1d996e478af979164c6ba50c64327e8669a49c120e55a2` |
| M05 | `1.0.0` | `S003-M05-NO-DEDICATED-AGENT` | `resources/m05/agent-position.v1.json` | `9332d85160efb29e637de41f796ec92fb259f5b4dabe8b0f8f1001ad52084703` |
| M06 | `1.0.0` | `S003-M06-REPORT-MANIFEST-20260815-001` | `resources/m06/report-manifest.v1.json` | `0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d` |

## CP06 工作台与报告继承

- CP06 Checkpoint：`4bb24ddc065d54cd9d7427d0ce33a01f53e87461d93e6a77773cec7c9526d443  checkpoints/CP06-agent-report-dashboard-completed.json`
- CP06 工作台/报告联合证据：`4c48344c045570ed28151aa2f3fcc2029a7af8f7b9f6bbefe5b864640e2b4bd3  evidence/CP06-agent-report-dashboard-validation.md`
- M06 报告清单：`0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d  resources/m06/report-manifest.v1.json`
- M06 报告内容：`ffa14290df718b0283df9714a7d519d1a74f75c1ee6d506ea60a7dca75835df6  resources/m06/report-contents.v1.json`
- M06 报告制品：`25d4d254055bcd598de62c9a2c2dd789430ac5918fdc48adfc5500dcd4808a8b  resources/m06/report-artifacts.v1.json`
- 工作台仍展示 21 家企业、绿 16 / 黄 4 / 红 1 / 黑 0，并可穿透 `S003-ENT-020` 正式报告。

## UI 与 CP07 运行服务哈希

- `646b28b5fdf7d121d0eff66da6b7eb779e6920b3e14f9527727f42b2c1d3b239  index.html`
- `a67bba643479f746dec6276959e7bf67bdc64bc5298519ad4004335391f5230a  app.js`
- `77e89e86c6ce7902ab32f23e2888090444169e2f880a67e9891a0f4ae9563e88  data.js`
- `9f21864b571d14d6a212842dfed0e4edd40023cbc7eee681ced073ce7179e221  state.js`
- `5ca25b2ac6315f6bdde788830c015c75d74542dff2f59f7bf17183394436e9f6  styles.css`
- `0d862954f2b2bdb7593cd49853ff48c8b420c0d7055a1faf778a1dd12379287d  domain/checkpoint-service.js`
- `af8936dc3d4c65e52d428b4d1cbbcbc0607ffcb12a7ee438544d70db2508c01a  tests/checkpoint-service.test.js`

## S001 v1.0.3 冻结树非回归

- `git rev-parse prototype-v1.0.3-frozen^{}` 返回 `ea69e9ad3bceef93b000e6f3ddc639ab093e2515`。
- `git diff --quiet ea69e9ad3bceef93b000e6f3ddc639ab093e2515 -- designs/prototype-releases/v1.0.3` 返回码为 `0`。
- `node designs/prototype-releases/verify-release.mjs 1.0.3`：9 个组件、15 个入口完整性校验通过。
- `node designs/scenario-checkpoints/baselines/v1.0.3/verify-baseline.mjs`：`BSL-S001-V103-DE0119608E26` 校验通过，`acceptanceReady=false`。
- 冻结清单 SHA：`de0119608e26b09cfbdcf86143db95ca9446c25030453086b4f8c1e840af8ba1`。
- 冻结 VERSION SHA：`64b5544e20a511933b47de6973672bcffa8bb505381710cf14024ed84a9f8d9b`。
- S001 历史运行快照 SHA：`3de07e7f69b013924dcb6725b6c35ff61f38fba3234f93a472aa45821ddec774`。

冻结清单中的 9 个组件树哈希均保持不变：

- 统一首页：`5205c427b9b683852bc47e02856b09ea8bd39beb67b48c9bbb624b0f918a9034`
- 数据工程：`dd47ca1f16b985c6e7acbdd2f262af2636b1bb18ceb7187f727ae33630b87fe5`
- 本体管理评审：`75870802dbcf5f3ced2b8c6efaca41f01ae1e57fc34893ef44a14710633142fd`
- 本体管理原型：`e0591568e3c52f464b53b295b8106056dea531c9f407c056bee6c21191645443`
- 智能问数：`5122f6b9bfab04af794460fdba30d41b35fecd71d4d966472f66e7bc799c3e56`
- 决策中心：`243f7a8a779b1fb9dddb74996c5bc7d99ad51211f019a2991afb6c8916f7b66b`
- Agent 应用：`027d9f20c7d7ebd753eb8e36b4475a5c271c91d979feda8e0d57c39b3cb9bcb2`
- 报告中心：`8be8533ca1583f9135c76acf3bfab844d1431abc0e4807ec301e2f63d1dad0ad`
- S001 端到端集成：`49a280a253ffbf6d912de3c9fc3cc240bcc1e6aca2ea869d4436cee0be64282f`

## 自动验证

- `node --check domain/checkpoint-service.js data.js state.js app.js`：通过。
- `node --test ../../foundation/ofw-scenario-foundation.test.cjs tests/*.test.js`：80 / 80 通过。
- 历史只读、克隆恢复、隔离回归、失败保护/重试、operationId 幂等、身份错配和基线迁移约束均有自动化断言。
- CP07 未触发历史 Action Request、审批、通知、负责人待办或外部派发，也未改写 S001、CP01—CP06 或正式 C035 运行结果。

## 恢复就绪边界

- 历史查看继续使用原正式 C035 `scenarioRunId`，只读展示当时状态和证据。
- 克隆恢复、隔离回归和失败重试必须使用新的 `scenarioRunId` 与空隔离命名空间。
- CP07 封存的是可恢复的原型运行与证据合同，不把浏览器 `localStorage`、页面 DOM 或临时 JSON 作为正式快照真源。
- 当前结论仅表示 S003 v1.1.0 场景端到端原型联调节点完成，不改变 S001 v1.0.3 的 `acceptanceReady=false`，也不替代后续总控复核或用户验收。
