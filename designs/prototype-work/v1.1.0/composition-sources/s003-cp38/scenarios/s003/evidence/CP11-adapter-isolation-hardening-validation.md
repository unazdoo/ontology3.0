# S003 CP11 适配器隔离加固验证证据

- 验证日期：2026-08-16
- Checkpoint ID：`CP-S003-20260816061959000-c03511000011`
- 公共 Checkpoint 节点：`e2e-integrated`
- 场景内节点语义：`CP11-adapter-isolation-hardening-completed`
- 父基线：`1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式 Published 运行：`S003-RUN-20260815133000000-c03503000001`
- 原型版本：`1.1.0`
- 构建版本：`S003-CP11`
- 入口：`runtime/cp11-entry.v1.html`
- 验收状态：`acceptanceReady = false`

## 追加快照原因

CP10 已在 2026-08-16T05:59:45.000Z 形成，不得覆盖。其后公共壳和 M03/M04 适配测试完成
最后一轮跨运行隔离加固，当前代码树相对 CP10 出现预期漂移。按照场景快照不可变规则，
本轮不回写 CP10 清单、sidecar、代码树哈希或来源 `scenarioRunId`，而是创建新的 CP11。

CP11 继续表示“v1.0.3 六模块真实实现 + S003 配置化/条件式适配”。它没有新增一级模块、
没有把用户带回早期独立原型，也没有修改冻结版 v1.0.3。

## 本轮新增锁定

- M03 原生桥接测试验证六个固定问题可以进入原问数结果、证据和运行历史结构。
- 非正式运行、错误 `scenarioRunId` 和历史只读上下文不得写入或消费当前正式 Published 结果。
- M04 状态、视图和 C019/Action Request 按 `scenarioRunId` 使用独立物理键。
- 历史/Checkpoint 上下文可只读查看原轮次，但所有 M04 写入口均被硬阻断。
- S003 持久化不得覆盖 S001 固定状态键、视图键或 C019 键。
- M04 测试在同一 VM realm 加载 Foundation 与适配器，保持生产普通对象校验不放宽。

## v1.0.3 与模块边界

| 模块 | CP11 锁定状态 | 不变边界 |
| --- | --- | --- |
| M01 | 原本体管理内的 S003 模型配置与 Published 子路由 | Metric、Rule、Action Type、系数、权重、阈值仍归 M01 |
| M02 | 原数据工程内的来源、快照、因子填报、资产与运行适配 | 管道和质量规则不计算风险分 |
| M03 | 原问数工作台 + 同轮 Published 只读投影 + 原生桥接隔离测试 | Draft、工作投影、错 runId 均 fail-closed |
| M04 | 原通用决策工作台 + Action Request/负责人待办投影 + 物理隔离测试 | 无 S003 专属路由；人工确认前不产生副作用 |
| M05 | 原 Agent 目录内一期能力边界卡 | 不重算评分、不改模型、不自动建单 |
| M06 | 原报告生命周期内的风险工作台、报告、配置、重跑和快照 | 不新增第七模块；仅消费 Published 结果和正式证据 |

v1.1.0 公共壳与 M01—M06 当前外部集成文件由
`resources/integration/v103-baseline-extension-inventory.v2.json` 逐文件记录 SHA-256。
CP11 只引用该 S003 包内清单，不把包外路径直接写入 Checkpoint `codeRefs`。

## 自动化与静态验证

- 扩展全量套件：`162 / 162` 通过，`0` 失败。
  - Foundation + S003 核心：`153 / 153`。
  - M03/M04 原生桥接与跨运行隔离：`9 / 9`。
- v1.0.3 完整性校验：`9` 个组件、`15` 个入口通过。
- 冻结目录差异：`git diff -- designs/prototype-releases/v1.0.3` 为 `0`。
- `git diff --check`：通过。
- M02 `build-standalone.mjs` 与 `verify-static.mjs`：通过。
- 外部集成文件清单复核：`build-baseline-extension-inventory.cjs --check --v2` 通过。
- CP11 manifest 与 Markdown sidecar SHA-256：通过。

## 浏览器终验

- S003 从 v1.0.3 派生公共壳进入，首页展示 `S003 · 债务风险监测`，六模块公共入口可用。
- M06 风险工作台显示集团风险总览、21 家企业明细、企业报告穿透、配置和运行快照。
- “运行与快照”页显示 `CP01—CP11`、Checkpoint 数量 11、CP11 完整 ID和正式来源运行。
- M03 原问数工作台和 S003 Published 只读投影并存；M04 显示通用决策工作区。
- S001 默认首页保持原上下文，未出现“集团债务风险监测”等 S003 内容泄漏。
- 浏览器终验未观察到 console error 或 page error。

CP10 浏览器证据继续保存在 `evidence/browser-cp10/`；CP11 未改写这些历史图片，新增终验以
自动化浏览器断言记录为准。

## 正式运行与重跑边界

- CP11 来源仍为正式运行 `S003-RUN-20260815133000000-c03503000001`。
- 快速重跑产生的新轮次仅形成 `published-runtime / projectionOnly=true` 工作投影。
- 工作投影不得提升正式 Published 指针，不得进入 M03/M04 正式消费或正式报告导出。
- `restored`、`historical-readonly`、`regression`、`closed` 均禁止 Action Request、审批、通知、
  负责人待办和外部派发。
- 历史查看保留原 `scenarioRunId`；恢复、回归、重跑必须创建新 `scenarioRunId` 和隔离命名空间。

## 验收边界

CP11 表示 S003 技术实施、总装、联调、跨运行隔离和回归验证完成。它不表示用户已经验收、
平台总控已经批准汇入、v1.1.0 已经冻结或其他场景已经完成。`acceptanceReady` 继续为
`false`。
