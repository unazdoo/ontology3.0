# S003 CP08 统一场景壳验证证据

- 验证日期：2026-08-15
- Checkpoint ID：`CP-S003-20260815173000000-c03508000008`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP08-unified-scene-shell-completed`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式 C035 运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP08`
- 入口：`runtime/cp08-entry.v1.html`

## 封存语义

CP08 是 CP07 端到端联调后的统一场景壳不可变封存。公共 C034 底座的允许节点清单
不新增专属节点，因此继续使用 `e2e-integrated`，并由 Checkpoint ID、构建版本、入口、
文件名和本证据明确区分 CP08。该处理不修改公共底座，不新增第七模块，也不把壳层完成
误写为新的业务评估结果。

本次只锁定 M01—M06 的 S003 场景内适配视图、持续身份脊柱、导航与响应式实现。M01—M06
正式导出、C035 风险结果、Published 事实、决策结果和 21 份企业报告全部继承 CP07；没有
执行评分重算，没有创建新的 `scenarioRunId`，也没有产生新的 Action Request、通知、审批、
负责人待办或外部派发。

## M01—M06 统一场景壳矩阵

| 模块 | Owner | S003 壳内视图 | 一期边界 |
| --- | --- | --- | --- |
| M01 本体管理 | 本体管理；业务 Owner 为财务公司 | `configuration` | 配置并发布权重、六项因子系数和四档阈值；不新增一级模型资源 |
| M02 数据工程 | 数据工程；人工输入 Owner 为财务公司 | `data-quality`、`factor-entry` | 数据、输入、管道、质量和资产版本；不拥有评分模型参数 |
| M03 智能问数 | 智能问数 | `query-decision/m03-query` | 只读消费同一轮 Published 风险事实，不在页面端重算 |
| M04 决策中心 | 决策中心 | `query-decision/m04-decision`、`m04-todos` | 人工确认后进入通用 Action Request 与负责人待办；无多级审批 |
| M05 Agent 应用 | Agent 应用 | `agent-boundary` | 一期无 S003 专属 Agent，仅锁定允许复用与禁止越界 |
| M06 报告中心 | 报告中心 | `overview`、`enterprises`、`runs`、`checkpoints`、`report` | 风险工作台、企业明细、运行、快照和报告穿透 |

- `data.js` 仅登记 M01—M06 六个模块；没有第七模块。
- 一级模块导航使用 `button[data-module-id]` 和 S003 内部 `view/anchor`，不存在旧模块原型 `href`。
- M03 与 M04 共用同一页面但使用独立锚点和当前模块身份；M04 不再跳转早期决策中心原型。
- 场景页签、企业明细、企业报告、配置、因子填报、运行和快照均留在同一 S003 壳内。

## 持续身份脊柱

所有 S003 工作台视图共同渲染以下身份，不以页面临时状态替代正式资源：

- `scenarioId = S003`
- `scenarioVersion = S003-v1`
- `scenarioRunId = S003-RUN-20260815133000000-c03503000001`
- `baselineVersion = 1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- Published 模型版本与权威指针
- Published 人工输入快照
- 正式候选数据资产
- `assessmentAt = 2025-12-31`

历史查看仍展示来源 Checkpoint 的原 `scenarioRunId` 且严格只读；克隆恢复、隔离回归、重置、
升版和显式重评仍必须创建新的 `scenarioRunId` 与隔离命名空间。

## M02 数据与质量边界

- 使用 `resources/m02/data-contract.v1.1.json`，两个逻辑成员固定为“财务数据”和“调节因子”。
- 当前期财务列为 `I`，上期财务列为 `AA`；评估时点 `2025-12-31`，币种 `CNY`，金额单位“元”。
- 企业因子在线填报一期无复核人；发布形成新的不可变人工输入快照，保存 Draft 不触发评估。
- 环保企业和在建企业的电价波动率为 `NOT_APPLICABLE`；适用但缺失为 `DEFAULTED_ZERO`，非法值阻断。
- M02 质量明确不拥有风险评分、评分公式、因子系数、评分权重、风险阈值、风险分档和 Action Type 命中。
- 当前兼容性夹具继续保持不可消费，不得原地提升为正式数据资产。

## M05 Agent 边界

- `dedicatedAgent = false`，一期不存在 S003 专属 Agent。
- 允许项仅为后续用户显式进入时复用平台现有报告伴读入口。
- 强制阻断：重算 C035、修改模型配置、自动创建 Action Request、替代人工确认。
- Agent 不进入评分闭环，不写入 Published 事实、决策状态或正式报告。

## 响应式与信息密度

- 统一使用 `--type-caption`、`--type-meta`、`--type-body`、`--type-label` 字号 token。
- 固定 `1080px`、`820px`、`560px` 响应式断点。
- 窄屏保留场景运行身份、页签、模块 Owner、质量元数据和报告追溯信息。
- 风险阈值、风险评分企业明细、报告穿透、运行门和快照语义在同一工作台内连续展示。

## 统一壳层文件哈希

- `8f94f47a27adf209faa6d27b470652a083d38b0b62d98cbbf1237b15f44370eb  README.md`
- `c2054514860e665bc0320fea13bed4f1fe3e5bf32150fc9004b42c5acf58409d  CHANGELOG.md`
- `9610188ea98965ee18cd9f66a24fb32a0abfd07bb30483e759ddc29bd53c8d90  resources/scenario-manifest.json`
- `f6ec2708dd5ea9fb0383db8c76b74cb746edf5b511fe78e5c38baba92868b59b  index.html`
- `d6eb316ea1b2de5c20fa561349d0438e3581e184bb64e7f933ab529963545b42  app.js`
- `8178f8e87741bf35c092f3f9d61e71e3a0f5adb96e1430f7207dd558a93f25e1  data.js`
- `4e03b2c8d76992e077cd55647cb72d608ae6c9b6a69d913a15e625cac57dad07  state.js`
- `932aebba62c9b5f60ab96280ac1b7e23707ecfd0bd7c1f966d558e3141204624  styles.css`
- `53c2e82cef467e70ee92c4d1027cef13ff785dc7633192fa1218db09b9ced967  runtime/cp08-entry.v1.html`
- `d033e5fa46cb36b0a0cbae01da555689376a9d72cf62caa76eb5a2f2c5fe7da3  tests/workbench-shell.test.js`

## CP07 与业务制品继承

- `126defb56dc5515f16b87bd5e8ba7512be23da26f9bfdf71dd087a73df9ce3dd  checkpoints/CP07-e2e-integrated.json`
- `a1f32e82df07314079a57ae7d7a4f1c528c2b6b250441c8d0b621109a58694fb  evidence/CP07-e2e-integration-validation.md`
- `10e8ca2284abaaf680b549b6da3c5374ac6168a5e9b4bbe6d0abbcdb864b6153  resources/m01/c035-risk-results.v1.json`
- `8d31823a37c2b4949d01b5a2d2744607bddb7f9c2ee54e2e3c8e9acfebe74099  resources/m01/published-risk-facts.v1.json`
- `b21dcb8aa0092df23e6ed3b802602775ac3c1a396fb9f6b5fffceb69ad0dd43b  resources/m04/decision-results.v1.json`
- `0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d  resources/m06/report-manifest.v1.json`
- `ffa14290df718b0283df9714a7d519d1a74f75c1ee6d506ea60a7dca75835df6  resources/m06/report-contents.v1.json`
- `25d4d254055bcd598de62c9a2c2dd789430ac5918fdc48adfc5500dcd4808a8b  resources/m06/report-artifacts.v1.json`

上述业务制品 SHA 与 CP07 一致，证明 CP08 没有重算或改写正式 C035 结果、决策结果和企业报告。

## M01—M06 导出哈希

| 模块 | 版本 | 导出 | SHA-256 |
| --- | --- | --- | --- |
| M01 | `1.0.1` | `resources/m01/runtime-export.v1.json` | `7d0d3d65fc89688d4b2d839218245251c6b53ca28f5f171273b1e532a8ba4c60` |
| M02 | `1.1.0` | `resources/m02/data-contract.v1.1.json` | `0de2eba3f36b1f7f14007fc5039df5de9a6b97a3f032c23b4e4e298079a5c8a2` |
| M03 | `1.0.0` | `resources/m03/query-runtime.v1.json` | `4680d2f78295d12a76acde3bc7ddcd66338aa51e727beb1bd98bb8be0294e6e6` |
| M04 | `1.0.0` | `resources/m04/decision-runtime.v1.json` | `0bee1570bb2c64367a1d996e478af979164c6ba50c64327e8669a49c120e55a2` |
| M05 | `1.0.0` | `resources/m05/agent-position.v1.json` | `9332d85160efb29e637de41f796ec92fb259f5b4dabe8b0f8f1001ad52084703` |
| M06 | `1.0.0` | `resources/m06/report-manifest.v1.json` | `0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d` |

## 自动验证

- `node --check data.js && node --check state.js && node --check app.js`：通过。
- `node --test ../../foundation/ofw-scenario-foundation.test.cjs tests/*.test.js`：`88 / 88` 通过。
- 其中 `tests/workbench-shell.test.js` 的 `8 / 8` 专项断言覆盖六模块数量、壳内导航、Owner 映射、
  持续身份、M02 边界、M05 边界、CP08 可选加载、S001 身份隔离和响应式 token。
- `git diff --check`：通过。
- 静态服务验证：`/scenarios/s003/` 与 `/scenarios/s003/runtime/cp08-entry.v1.html` 均返回 HTTP `200`。
- 旧模块原型链接扫描：`app.js`、`data.js`、`state.js`、`index.html` 未命中早期模块原型路径。

## S001 v1.0.3 冻结非回归

- `git rev-parse prototype-v1.0.3-frozen^{}`：`ea69e9ad3bceef93b000e6f3ddc639ab093e2515`。
- `git diff --quiet ea69e9ad3bceef93b000e6f3ddc639ab093e2515 -- designs/prototype-releases/v1.0.3`：返回码 `0`。
- `node designs/prototype-releases/verify-release.mjs 1.0.3`：9 个组件、15 个入口完整性通过。
- `node designs/scenario-checkpoints/baselines/v1.0.3/verify-baseline.mjs`：
  `BSL-S001-V103-DE0119608E26` 通过，`acceptanceReady=false`。
- 冻结清单：`de0119608e26b09cfbdcf86143db95ca9446c25030453086b4f8c1e840af8ba1`。
- 冻结 VERSION：`64b5544e20a511933b47de6973672bcffa8bb505381710cf14024ed84a9f8d9b`。
- S001 历史运行快照：`3de07e7f69b013924dcb6725b6c35ff61f38fba3234f93a472aa45821ddec774`。

## 恢复就绪边界

- CP08 只读查看继续使用正式 C035 原 `scenarioRunId`。
- 从 CP08 恢复必须克隆为新 `scenarioRunId` 和空隔离命名空间，不覆盖 CP08 或 CP01—CP07。
- 回归默认演练模式，历史 Action Request、审批、通知、待办和外发不得重放。
- `localStorage`、DOM 和临时 JSON 仍是可丢弃投影，不是正式快照真源。
- CP08 表示 S003 v1.1.0 统一场景壳完成封存，不改变 S001 v1.0.3 的验收状态，也不替代总控复核。
