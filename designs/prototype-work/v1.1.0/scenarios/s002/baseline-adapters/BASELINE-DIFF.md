# S002 v1.0.3 基线页面适配记录

适配日期：2026-08-15

最终复验日期：2026-08-17

父基线：`v1.0.3` · `BSL-S001-V103-DE0119608E26`

本目录是 S002 的场景本地基线副本。运行时入口分别属于 M01、M02、M03，不再使用旧的统一 `module.html`/`module-app.js`。冻结目录本身未改写。

## 入口映射

| 模块 | v1.0.3 权威入口 | S002 场景入口 | 适配方式 |
| --- | --- | --- | --- |
| M01 | `ontology-management-review/canvas-first/index.html` | `baseline-adapters/ontology-management-review/canvas-first/index.html` | 基线原文件副本 + 场景投影脚本 |
| M02 | `data-engineering-prototype-review/review-v3/方案B2.html` | `baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html` | 基线原文件副本 + 场景投影脚本 |
| M03 | `intelligent-query-prototype/review-next/conversation-workspace/index.html` | `baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html` | 基线原文件副本 + 场景投影脚本 |

## 保留的基线结构

- M01 保留平台栏、产品侧栏、画布视口、画布工具栏、Tab、抽屉、弹窗、对象/关系/Metric/Rule/Action Type 维护和 Published 生命周期。
- M02 保留数据资源与数据管道导航、来源快照、管道画布、质量/运行/资产版本、表格横向滚动、弹窗和本体刷新 handoff。
- M03 保留问数工作台、Agent 配置、会话/历史/视图导航、运行步骤、结果表、证据抽屉和保存/固定视图流程。

## 场景适配变更

所有变更均位于 S002 场景本地副本。M01 主要使用场景投影脚本；M02 因基线默认单一来源图无法表达“5 个逻辑源、年度作为 8 个快照”，在保留原 DOM、布局、组件、交互和运行合同的前提下，对本地 `shared` 数据与默认画布夹具作最小适配；M03 在基线问数域和原工作台内增加 S002 资源、固定题与结果合同：

- M01 投影 7 类对象、62 项属性、8 条关系、9 项 Metric、5 项 Rule、6 类整改/复核 Action Type 和 `T019-S002-v1` 指针；“数据与消费”页展开两个业务资产、各自来源/成员/双管道、C003、C033、目标 Draft 和 T019 联合证据，`S002-DATA-v1` 只保留为 C003 组合指针。
- M02 将实际执行、预算下达、预算申报、项目预算占用、项目预算使用组织为 5 个逻辑数据源；2024/2025/2026 文件作为 8 个不可变快照。预算管道消费 3 个逻辑源/6 个快照，项目与采购管道消费 4 个逻辑源/6 个快照，共发布两个独立业务资产。保留 21 组合法重复凭证、13 条期间异常、6 条日期倒置源值与 `CORRECTED` 标识；不注入预算公式或业务阈值。
- M03 投影 S002 预算问数 Agent、Prompt/Skill 版本、97 项 Published 语义资源、6 个获准问题及逐题语义路径、文字/表格/BI 结果、Rule Hit、证据下钻和能力详情；答案和计划随所选问题同步，非获准问题明确阻断，完整链路不再出现数据暂不可用占位。

## 原始文件证据

完整源树摘要、逐文件差异和核心 DOM 锚点见同目录 `adaptation-map.json`。源文件原始 SHA-256（权威入口文件）如下：

- M01 `index.html`：`f4f0dd80454248a3d230302b6f6c8cc8a12d3bfd847d194164cf0e702ec1f462`
- M01 `app.js`：`5e72d3184ca4437c688c12d36ffb5c43ebdd31948611a33d1a768d71b0d58d75`
- M01 `app.css`：`4e85357d3bd21d3408d48a9979c2271d3eb30b32ffc6af99b063a7cca20166c4`
- M02 `方案B2.html`：`cbc0360fc4aeddd1285ddd26c3f5bdbc1b3cf539610779f45bde5f26923ef2d3`
- M03 `index.html`：`2a253befbca1cce7dd891cc74609625591786949305b991aee1921ad06e7de88`
- M03 `app.jsx`：`43e633cbe9dfea22a308cfc4d96715dd4e85c9363ea5e1da6f8d2373f315e113`
- M03 `components.jsx`：`4506da4c3b6fd023945573c3352a5407318031d33d0b18ccca946c6b5495fd5f`
- M03 `data.jsx`：`ee971d58392ef97ba01b69fd068b60e3644b4a6aa45288ba3cd877dd3e158e8c`

当前 S002 本地入口/适配器 SHA-256（2026-08-15 实施口径；仅用于本场景差异追溯）：

- M01 `index.html`：`b6ba0e395ecb585b9140b3a0ba8aff39583d952d5bede81b3f8d61cca28d5ecd`
- M01 `s002-adapter.js`：`9c002dba79c1b2439ced882e46a207060688a10d9224b6d53a1aeb6a39e04287`
- M02 `方案B2.html`：`d6cd54e62b8ff46e7ccc6598622dd128dee3bbcd48e486229da682faa7428841`
- M02 `s002-adapter.js`：`6a40aabe9c0712da7567c38d3fb6110f95159bd8b91ee4f51ae0e1f1ec2a46d5`
- M02 `review-v3/shared/app.js`：`df99e8f5d4028d8445517a5e1289d4a50783c68c6bace654a8b7963f010a6074`
- M03 `index.html`：`284fd721b4dfbdf9993e86aefe0dee537daf7da86e6a6d8c6f0109a73f172700`
- M03 `app.jsx`：`67c8ce01bbc21e5c53028b6648bc36dfb2bfcdda9392cf3bc388c890e75d0388`
- M03 `data.jsx`：`46a2747c594bed990f885e77fc9fa673f087f102afd89868a0ef5cb69b0e0579`
- M03 `s002-adapter.js`：`185562333b4b006d57ecb3d86a5e2a1d7e1dccecbcae545dc1fb80965e99b968`

## 运行边界

适配层读取统一工作台传入的 `scenarioId`、`scenarioVersion`、`scenarioRunId`；直接打开副本仍使用 S002 默认上下文。历史快照查看、克隆恢复和隔离回归由统一工作台负责，适配页不复制平台状态真值。
